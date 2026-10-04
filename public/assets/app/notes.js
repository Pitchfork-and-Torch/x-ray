import { sanitizeText } from "./owned-feed.js";

export function createNote(text, angles, now = Date.now()) {
  const body = sanitizeText(text, 500);
  if (!body) return null;
  const az = Number(angles && angles.az) || 0;
  const el = Number(angles && angles.el) || 0;
  return {
    id: "note-" + now.toString(36),
    source: "note",
    name: "Note",
    handle: "@local",
    body,
    likes: 0,
    reposts: 0,
    insight: "",
    az,
    el,
    plane: "near",
    theme: "default",
    pinned: true,
  };
}
