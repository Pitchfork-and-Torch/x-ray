/**
 * X-Ray Shared Reality signaling (ephemeral).
 * Stores SDP offers/answers + ICE candidates in KV with short TTL.
 * Never stores camera media or post bodies.
 */

export const TTL = 60 * 60 * 2; // 2 hours
export const ROOM_RE = /^[A-HJ-NP-Z2-9]{4,8}$/;
export const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_BODY = 24 * 1024;
export const MAX_SIGNALS = 80;
export const MAX_FROM = 40;
export const SIGNAL_TYPES = ["answer", "ice", "offer"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json; charset=utf-8",
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export function roomKey(id) {
  return `room:${id}`;
}

export function signalsKey(id) {
  return `signals:${id}`;
}

export function parseRoomId(raw) {
  const id = String(raw || "").trim().toUpperCase();
  return ROOM_RE.test(id) ? id : null;
}

/** Monotonic millisecond stamp so same-ms ICE is not dropped by t > since. */
export function nextStamp(list, now = Date.now()) {
  const last =
    Array.isArray(list) && list.length ? Number(list[list.length - 1].t || 0) : 0;
  return now <= last ? last + 1 : now;
}

export function pollMessages(list, peer, since) {
  const peerId = String(peer || "");
  const sinceN = Number(since || 0) || 0;
  const messages = (Array.isArray(list) ? list : []).filter(
    (m) => m && m.from && m.from !== peerId && Number(m.t || 0) > sinceN,
  );
  const cursor = messages.reduce((acc, m) => Math.max(acc, Number(m.t || 0)), sinceN);
  return { messages, cursor };
}

export function normalizeSignal(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return null;
  const type = String(msg.type || "");
  if (!SIGNAL_TYPES.includes(type)) return null;
  const from = String(msg.from || "");
  if (!from || from.length > MAX_FROM) return null;
  const out = { type, from };
  if (type === "answer" || type === "offer") {
    if (msg.sdp == null) return null;
    out.sdp = msg.sdp;
  }
  if (type === "ice") {
    if (msg.candidate == null) return null;
    out.candidate = msg.candidate;
  }
  return out;
}

export function oversized(value) {
  try {
    return JSON.stringify(value).length > MAX_BODY;
  } catch {
    return true;
  }
}

export function uniqueStamp(now = Date.now()) {
  const frac =
    typeof performance !== "undefined"
      ? Math.floor(performance.now() * 100) % 1000
      : (Math.random() * 1000) | 0;
  return now * 1000 + frac;
}

export function signalItemKey(id, t, nonce) {
  return `sig:${id}:${t}:${nonce}`;
}

export function uniqueNonce() {
  return Math.random().toString(36).slice(2, 10);
}

export async function readSignals(env, id) {
  const prefix = `sig:${id}:`;
  if (env.ROOMS.list) {
    const listed = await env.ROOMS.list({ prefix });
    const names = (listed && listed.keys ? listed.keys : []).map((k) => k.name);
    if (names.length) {
      const out = [];
      const bulk = await env.ROOMS.get(names);
      const readOne = async (name) => {
        if (bulk && typeof bulk.get === "function") return bulk.get(name);
        return env.ROOMS.get(name);
      };
      for (const name of names) {
        const stored = parseStored(await readOne(name), null);
        if (stored.ok && stored.value) out.push(stored.value);
      }
      out.sort((a, b) => Number(a.t || 0) - Number(b.t || 0));
      return out.length > MAX_SIGNALS ? out.slice(-MAX_SIGNALS) : out;
    }
  }
  const sraw = (await env.ROOMS.get(signalsKey(id))) || "[]";
  const listStored = parseStored(sraw, []);
  return Array.isArray(listStored.value) ? listStored.value : [];
}

function parseStored(raw, fallback) {
  if (raw == null || raw === "") return { value: fallback, ok: true, empty: true };
  try {
    return { value: JSON.parse(raw), ok: true, empty: false };
  } catch {
    return { value: fallback, ok: false, empty: false };
  }
}

async function readJsonLimited(request) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > MAX_BODY) return { error: "too_large" };
  let text;
  try {
    text = await request.text();
  } catch {
    return { error: "bad_json" };
  }
  if (text.length > MAX_BODY) return { error: "too_large" };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: "bad_json" };
  }
}

export async function handleRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length === 0 || (parts.length === 1 && parts[0] === "health")) {
    return json({
      ok: true,
      service: "xray-signal",
      version: 2,
      kv: Boolean(env.ROOMS),
      privacy: "SDP/ICE only. No media. TTL 2h.",
    });
  }

  if (parts[0] === "rooms" && parts.length === 2 && request.method === "PUT") {
    const id = parseRoomId(parts[1]);
    if (!id) return json({ error: "bad_room" }, 400);
    const parsed = await readJsonLimited(request);
    if (parsed.error === "too_large") return json({ error: "too_large" }, 413);
    if (parsed.error) return json({ error: "bad_json" }, 400);
    const body = parsed.value || {};
    if (oversized(body) || oversized(body.offer)) return json({ error: "too_large" }, 413);
    const host = body.host == null ? null : String(body.host).slice(0, MAX_FROM);
    const record = {
      id,
      offer: body.offer || null,
      host,
      answer: null,
      updated: Date.now(),
    };
    if (env.ROOMS) {
      await env.ROOMS.put(roomKey(id), JSON.stringify(record), { expirationTtl: TTL });
      await env.ROOMS.put(signalsKey(id), JSON.stringify([]), { expirationTtl: TTL });
    }
    return json({ ok: true, id, kv: Boolean(env.ROOMS) });
  }

  if (parts[0] === "rooms" && parts.length === 2 && request.method === "GET") {
    const id = parseRoomId(parts[1]);
    if (!id) return json({ error: "bad_room" }, 400);
    if (!env.ROOMS) return json({ id, offer: null, offline: true });
    const raw = await env.ROOMS.get(roomKey(id));
    if (!raw) return json({ error: "not_found" }, 404);
    const stored = parseStored(raw, null);
    if (!stored.ok || !stored.value) return json({ error: "corrupt" }, 500);
    const room = stored.value;
    return json({ id: room.id, offer: room.offer, answer: room.answer });
  }

  if (
    parts[0] === "rooms" &&
    parts[2] === "signal" &&
    parts.length === 3 &&
    request.method === "POST"
  ) {
    const id = parseRoomId(parts[1]);
    if (!id) return json({ error: "bad_room" }, 400);
    const parsed = await readJsonLimited(request);
    if (parsed.error === "too_large") return json({ error: "too_large" }, 413);
    if (parsed.error) return json({ error: "bad_json" }, 400);
    const msg = normalizeSignal(parsed.value);
    if (!msg) return json({ error: "bad_signal" }, 400);
    if (oversized(msg)) return json({ error: "too_large" }, 413);
    if (!env.ROOMS) return json({ ok: true, local: true });

    const roomRaw = await env.ROOMS.get(roomKey(id));
    if (!roomRaw) return json({ error: "not_found" }, 404);
    const roomStored = parseStored(roomRaw, null);
    if (!roomStored.ok || !roomStored.value) return json({ error: "corrupt" }, 500);
    const room = roomStored.value;

    if (msg.type === "answer" && msg.sdp && !room.answer) {
      room.answer = msg.sdp;
      room.updated = Date.now();
      await env.ROOMS.put(roomKey(id), JSON.stringify(room), { expirationTtl: TTL });
    }

    const list = await readSignals(env, id);
    msg.t = nextStamp(list, uniqueStamp());
    await env.ROOMS.put(
      signalItemKey(id, msg.t, uniqueNonce()),
      JSON.stringify(msg),
      { expirationTtl: TTL },
    );
    return json({ ok: true });
  }

  if (
    parts[0] === "rooms" &&
    parts[2] === "poll" &&
    parts.length === 3 &&
    request.method === "GET"
  ) {
    const id = parseRoomId(parts[1]);
    if (!id) return json({ error: "bad_room" }, 400);
    const peer = url.searchParams.get("peer") || "";
    const since = Number(url.searchParams.get("since") || 0) || 0;
    if (!env.ROOMS) return json({ messages: [], cursor: since });
    const list = await readSignals(env, id);
    return json(pollMessages(list, peer, since));
  }

  return json({ error: "not_found" }, 404);
}

/** Durable Object storage as a KV-shaped binding (strong consistency, no cacheTtl). */
export function storageToKv(storage) {
  return {
    async get(key) {
      if (Array.isArray(key)) {
        const out = new Map();
        if (!key.length) return out;
        const values = await storage.get(key);
        for (const k of key) {
          const v = values && typeof values.get === "function" ? values.get(k) : undefined;
          out.set(k, v == null ? null : typeof v === "string" ? v : JSON.stringify(v));
        }
        return out;
      }
      const v = await storage.get(key);
      if (v == null) return null;
      return typeof v === "string" ? v : JSON.stringify(v);
    },
    async put(key, val) {
      await storage.put(key, String(val));
    },
    async list({ prefix }) {
      const listed = await storage.list({ prefix });
      const keys = [];
      if (listed && typeof listed.forEach === "function") {
        listed.forEach((_v, name) => keys.push({ name }));
      } else if (listed && typeof listed.keys === "function") {
        for (const name of listed.keys()) keys.push({ name });
      }
      return { keys };
    },
  };
}

export class RoomHub {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    try {
      const res = await handleRequest(request, { ROOMS: storageToKv(this.ctx.storage) });
      if (request.method === "PUT" || request.method === "POST") {
        try {
          await this.ctx.storage.setAlarm(Date.now() + TTL * 1000);
        } catch (_) {}
      }
      return res;
    } catch {
      return json({ error: "server" }, 500);
    }
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "rooms" && parts[1] && env.ROOMS_DO) {
        const id = parseRoomId(parts[1]);
        if (!id) return json({ error: "bad_room" }, 400);
        const ns = env.ROOMS_DO;
        return ns.get(ns.idFromName(id)).fetch(request);
      }
      return await handleRequest(request, env);
    } catch {
      return json({ error: "server" }, 500);
    }
  },
};
