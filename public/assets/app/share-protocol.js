/**
 * Shared Reality application messages. v4 anchors/reactions. v3 presence still accepted.
 * Never carries camera fields. Transport is webrtc-room.js (data channel + BroadcastChannel).
 */
export const MAX_SHARE_BYTES = 8192;
export const V4_TYPES = ["presence", "anchor", "reaction", "handles", "place", "note", "ghost", "bye"];
export const V3_TYPES = ["presence", "handles", "reaction"];
const CAMERA_KEYS = new Set([
  "video",
  "frame",
  "image",
  "dataurl",
  "media",
  "stream",
  "track",
  "pixels",
  "blob",
  "screenshot",
  "jpeg",
  "png",
]);

function hasCamera(value, depth = 0) {
  if (depth > 8 || value == null) return false;
  if (typeof value === "string") {
    const head = value.slice(0, 40).toLowerCase();
    return head.startsWith("data:image") || head.startsWith("data:video");
  }
  if (Array.isArray(value)) return value.some((item) => hasCamera(item, depth + 1));
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (CAMERA_KEYS.has(String(key).toLowerCase())) return true;
      if (hasCamera(item, depth + 1)) return true;
    }
  }
  return false;
}

export function shareByteLength(msg) {
  try {
    return JSON.stringify(msg).length;
  } catch (_) {
    return Infinity;
  }
}

export function parseShare(input) {
  let msg = input;
  if (typeof input === "string") {
    if (input.length > MAX_SHARE_BYTES) return { ok: false, error: "oversize" };
    try {
      msg = JSON.parse(input);
    } catch (_) {
      return { ok: false, error: "parse" };
    }
  }
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return { ok: false, error: "shape" };
  if (hasCamera(msg)) return { ok: false, error: "camera" };
  if (shareByteLength(msg) > MAX_SHARE_BYTES) return { ok: false, error: "oversize" };
  const v = Number(msg.v);
  const type = String(msg.type || "");
  if (v === 3) {
    if (!V3_TYPES.includes(type)) return { ok: false, error: "unknown" };
    return { ok: true, compat: 3, msg: { ...msg, v: 3, type } };
  }
  if (v === 4) {
    if (!V4_TYPES.includes(type)) return { ok: false, error: "unknown" };
    return { ok: true, compat: 4, msg: { ...msg, v: 4, type } };
  }
  return { ok: false, error: "version" };
}

export function slimCard(card) {
  return {
    id: String(card.id || ""),
    az: Number(card.az || 0),
    el: Number(card.el || 0),
    plane: card.plane === "near" || card.plane === "far" ? card.plane : "mid",
    handle: String(card.handle || "").slice(0, 40),
    body: String(card.body || "").slice(0, 180),
  };
}

export function buildPresence(peerId, handles) {
  return {
    v: 4,
    type: "presence",
    peerId: String(peerId || ""),
    handles: Array.isArray(handles) ? handles.slice(0, 12).map((h) => String(h).slice(0, 40)) : [],
    t: Date.now(),
  };
}

export function buildAnchors({ peerId, origin, cards, placeName, includeBody }) {
  const slim = (Array.isArray(cards) ? cards : []).slice(0, 40).map((card) => {
    const row = slimCard(card);
    if (!includeBody) row.body = "";
    return row;
  });
  return {
    v: 4,
    type: "anchor",
    peerId: String(peerId || ""),
    origin: {
      yaw0: Number(origin && origin.yaw0) || 0,
      pitch0: Number(origin && origin.pitch0) || 0,
    },
    cards: slim,
    placeName: String(placeName || "").slice(0, 48),
    t: Date.now(),
  };
}

export function buildReaction(peerId, cardId, reaction = "✦") {
  return {
    v: 4,
    type: "reaction",
    peerId: String(peerId || ""),
    cardId: String(cardId || ""),
    reaction: String(reaction || "✦").slice(0, 4),
    t: Date.now(),
  };
}

export function buildNoteShare(peerId, card) {
  return {
    v: 4,
    type: "note",
    peerId: String(peerId || ""),
    cards: [slimCard(card)],
    t: Date.now(),
  };
}

export function buildBye(peerId) {
  return { v: 4, type: "bye", peerId: String(peerId || ""), t: Date.now() };
}

export function ghostsFromMessage(msg) {
  const cards = Array.isArray(msg && msg.cards) ? msg.cards : [];
  const peerId = String((msg && msg.peerId) || "peer");
  return cards.map((card, i) => ({
    id: "ghost-" + peerId + "-" + (card.id || i),
    source: "ghost",
    ghost: true,
    peerId,
    name: "Peer",
    handle: card.handle || "@peer",
    body: card.body || "",
    likes: 0,
    reposts: 0,
    insight: "",
    az: Number(card.az || 0),
    el: Number(card.el || 0),
    plane: card.plane || "mid",
    theme: "default",
  }));
}

export function safeShare(msg) {
  const parsed = parseShare(msg);
  return parsed.ok ? parsed.msg : null;
}
