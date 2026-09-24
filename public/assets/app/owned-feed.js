/**
 * Feed Bay. Parses files the user already has. Never fetches a social API.
 */
import { FEED_STORE } from "./state.js";
import { idbGet, idbPut } from "./gallery-idb.js";

export const MAX_FEED_BYTES = 400 * 1024;
export const MAX_FEED_CARDS = 80;
export const FEED_RECORD_ID = "active";

const URL_RE = /^\s*https?:\/\//i;

export function sanitizeText(value, max = 2000) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function looksLikeHtmlDoc(text) {
  const head = text.slice(0, 200).trim().toLowerCase();
  return (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<script") ||
    head.startsWith("<head") ||
    head.startsWith("<body")
  );
}

function unwrapTweet(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  if (obj.tweet && typeof obj.tweet === "object") return obj.tweet;
  return obj;
}

export function normalizeCard(raw, index = 0) {
  const obj = unwrapTweet(raw);
  if (!obj) return null;
  const body = sanitizeText(obj.full_text || obj.text || obj.body || "");
  if (!body) return null;
  if (/<script/i.test(body) || /<[^>]+>/.test(body)) return null;
  const screen = obj.user && obj.user.screen_name ? "@" + obj.user.screen_name : "";
  let handle = sanitizeText(obj.handle || screen || "@import", 40);
  if (handle && !handle.startsWith("@")) handle = "@" + handle.replace(/^@+/, "");
  const name = sanitizeText(
    obj.name || (obj.user && obj.user.name) || handle.replace(/^@/, "") || "Import",
    80,
  );
  const plane = obj.plane === "near" || obj.plane === "far" || obj.plane === "mid" ? obj.plane : "mid";
  return {
    id: sanitizeText(obj.id_str || obj.id || "card-" + index, 64) || "card-" + index,
    source: obj.source === "note" ? "note" : "owned",
    name: name || "Import",
    handle: handle || "@import",
    body,
    likes: obj.favorite_count ?? obj.likes ?? 0,
    reposts: obj.retweet_count ?? obj.reposts ?? 0,
    insight: sanitizeText(obj.insight || "", 500),
    az: Number.isFinite(Number(obj.az)) ? Number(obj.az) : (index % 7) * 8 - 24,
    el: Number.isFinite(Number(obj.el)) ? Number(obj.el) : (index % 3) * 3 - 3,
    plane,
    theme: sanitizeText(obj.theme || "default", 24) || "default",
    pinned: !!obj.pinned,
  };
}

function cardsFromParsed(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value.cards)) return value.cards;
  if (Array.isArray(value.posts)) return value.posts;
  if (Array.isArray(value.feed)) return value.feed;
  if (Array.isArray(value.tweets)) return value.tweets;
  if (value.tweet || value.full_text || value.text || value.body || value.handle) return [value];
  return null;
}

function parseJsonCards(text) {
  try {
    const value = JSON.parse(text);
    const list = cardsFromParsed(value);
    if (!list) return null;
    return list;
  } catch (_) {
    return null;
  }
}

function extractAssignedArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseMarkdownList(text) {
  const cards = [];
  for (const line of text.split(/\n/)) {
    const m = line.match(/^\s*[-*]\s+(@[\w.]{1,40})\s*[:\-]\s+(.+)$/);
    if (!m) continue;
    cards.push({ handle: m[1], name: m[1].slice(1), body: m[2], source: "owned" });
  }
  return cards;
}

export function parseFeedText(text) {
  const raw = String(text ?? "");
  if (URL_RE.test(raw.trim())) return { ok: false, error: "network-url", cards: [] };
  if (raw.length > MAX_FEED_BYTES) return { ok: false, error: "too-large", cards: [] };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "empty", cards: [] };
  if (looksLikeHtmlDoc(trimmed)) return { ok: false, error: "html", cards: [] };

  let list = null;
  const head = trimmed.slice(0, 120);
  if (/tweets|YTD|window\./i.test(head) && trimmed.includes("[")) {
    list = parseJsonCards(extractAssignedArray(trimmed) || "");
  }
  if (list === null && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
    list = parseJsonCards(trimmed);
  }
  if (list === null && trimmed.includes("\n")) {
    const lines = trimmed
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 1 && lines.every((line) => line.startsWith("{") || line.startsWith("["))) {
      const acc = [];
      let bad = false;
      for (const line of lines) {
        const part = parseJsonCards(line);
        if (part === null) {
          bad = true;
          break;
        }
        acc.push(...part);
      }
      if (!bad) list = acc;
    }
  }
  if (list === null) {
    const md = parseMarkdownList(trimmed);
    if (!md.length) return { ok: false, error: "parse", cards: [] };
    list = md;
  }

  const clean = [];
  list.forEach((item, i) => {
    const card = normalizeCard(item, i);
    if (card) clean.push(card);
  });
  if (!clean.length) return { ok: false, error: "empty", cards: [] };
  return {
    ok: true,
    error: null,
    truncated: clean.length > MAX_FEED_CARDS,
    cards: clean.slice(0, MAX_FEED_CARDS),
  };
}

export function mergeFeed(existing, incoming, mode) {
  const next = Array.isArray(incoming) ? incoming : [];
  if (mode === "replace") return next.slice(0, MAX_FEED_CARDS);
  const base = Array.isArray(existing) ? existing.slice() : [];
  const seen = new Set(base.map((c) => c.handle + "\n" + c.body));
  for (const card of next) {
    const key = card.handle + "\n" + card.body;
    if (seen.has(key)) continue;
    seen.add(key);
    base.push(card);
    if (base.length >= MAX_FEED_CARDS) break;
  }
  return base.slice(0, MAX_FEED_CARDS);
}

export function exportFeedJson(cards) {
  return JSON.stringify(Array.isArray(cards) ? cards : [], null, 2);
}

export async function loadOwnedFeed() {
  const row = await idbGet(FEED_STORE, FEED_RECORD_ID);
  return row && Array.isArray(row.cards) ? row.cards : [];
}

export async function saveOwnedFeed(cards) {
  const clean = (Array.isArray(cards) ? cards : []).slice(0, MAX_FEED_CARDS);
  await idbPut(FEED_STORE, { id: FEED_RECORD_ID, cards: clean, updated: Date.now() });
  return clean;
}
