/**
 * Place Memory. Orientation-relative pins on this device. Not a 3D scan.
 * IDB name stays xray-v3. Version 2 adds `places` and `feed` and does not wipe gallery.
 */
import { PLACES_STORE } from "./state.js";
import { idbAll, idbDelete, idbPut } from "./gallery-idb.js";

export const PLACE_CAP = 20;
export const PLACE_DEFAULTS = ["Room", "Desk", "Street"];

export function migrationPlan(fromVersion) {
  const from = Number(fromVersion || 0);
  return {
    fromVersion: from,
    toVersion: 2,
    wipeGallery: false,
    addStores: from >= 2 ? [] : ["places", "feed"],
  };
}

export function newPlaceId(now = Date.now()) {
  return "p-" + now.toString(36) + "-" + Math.random().toString(36).slice(2, 6);
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizePlaceCard(raw, index = 0) {
  const post = raw && raw.post && typeof raw.post === "object" ? raw.post : raw || {};
  const source = raw?.source === "owned" || raw?.source === "note" ? raw.source : "demo";
  return {
    id: String(raw?.id || post.id || "card-" + index),
    az: num(raw?.az ?? post.az),
    el: num(raw?.el ?? post.el),
    plane: raw?.plane || post.plane || "mid",
    source,
    pinned: !!raw?.pinned,
    post: {
      name: String(post.name || "Card").slice(0, 80),
      handle: String(post.handle || "@local").slice(0, 40),
      body: String(post.body || "").slice(0, 2000),
      likes: post.likes ?? 0,
      reposts: post.reposts ?? 0,
      insight: String(post.insight || "").slice(0, 500),
      theme: String(post.theme || "default").slice(0, 24),
    },
  };
}

export function serializePlace(input, now = Date.now()) {
  const src = input && typeof input === "object" ? input : {};
  const cards = Array.isArray(src.cards) ? src.cards.map((c, i) => normalizePlaceCard(c, i)) : [];
  const source = src.source === "owned" ? "owned" : "demo";
  return {
    id: String(src.id || newPlaceId(now)),
    name: String(src.name || "Room").trim().slice(0, 48) || "Room",
    created: num(src.created, now),
    updated: num(src.updated, now),
    origin: {
      yaw0: num(src.origin && src.origin.yaw0),
      pitch0: num(src.origin && src.origin.pitch0),
    },
    cards,
    source,
  };
}

export function restorePlace(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return serializePlace(raw, num(raw.updated, Date.now()));
}

/** Keep the newest `cap` places. Does not touch gallery records. */
export function evictPlaces(list, cap = PLACE_CAP) {
  const sorted = (Array.isArray(list) ? list : [])
    .map((p) => serializePlace(p))
    .sort((a, b) => b.updated - a.updated || (a.id < b.id ? -1 : 1));
  return sorted.slice(0, cap);
}

export function layoutFromPlace(place) {
  const restored = restorePlace(place);
  if (!restored) return [];
  return restored.cards.map((c) => ({
    id: c.id,
    source: c.source,
    pinned: c.pinned,
    name: c.post.name,
    handle: c.post.handle,
    body: c.post.body,
    likes: c.post.likes,
    reposts: c.post.reposts,
    insight: c.post.insight,
    theme: c.post.theme,
    az: c.az,
    el: c.el,
    plane: c.plane,
  }));
}

export function placeFromLayout({ id, name, origin, cards, source, created }) {
  const now = Date.now();
  return serializePlace({
    id,
    name,
    created: created || now,
    updated: now,
    origin: origin || { yaw0: 0, pitch0: 0 },
    source: source || "demo",
    cards: (cards || []).map((c, i) =>
      normalizePlaceCard(
        {
          id: c.id || "card-" + i,
          az: c.az,
          el: c.el,
          plane: c.plane,
          source: c.source,
          pinned: c.pinned,
          post: c,
        },
        i,
      ),
    ),
  });
}

export async function listPlaces() {
  const all = await idbAll(PLACES_STORE);
  return evictPlaces(all);
}

export async function savePlaceRecord(place) {
  const record = serializePlace(place);
  const all = await idbAll(PLACES_STORE);
  const next = evictPlaces([record, ...all.filter((p) => p && p.id !== record.id)]);
  const keep = new Set(next.map((p) => p.id));
  for (const old of all) {
    if (old && old.id && !keep.has(old.id)) await idbDelete(PLACES_STORE, old.id);
  }
  if (keep.has(record.id)) await idbPut(PLACES_STORE, record);
  const before = new Set(all.map((p) => p && p.id).filter(Boolean));
  let evicted = 0;
  for (const id of before) if (!keep.has(id)) evicted += 1;
  return { record: keep.has(record.id) ? record : null, places: next, evicted };
}

export async function deletePlaceRecord(id) {
  await idbDelete(PLACES_STORE, id);
  return listPlaces();
}
