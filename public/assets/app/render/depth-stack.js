import { state } from "../state.js";
import { DEMO_POSTS } from "../demo-posts.js";
import { getWorldRotation } from "../sensors/fusion.js";
import { t } from "../i18n.js";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initials(name) {
  const p = String(name || "?")
    .split(/\s+/)
    .filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
}

export function buildPosts() {
  const handles = (state.settings.handles || "")
    .split(/[,;\s]+/)
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.startsWith("@") ? h : `@${h}`));

  const feed = document.getElementById("feedInner");
  if (!feed) return;
  feed.innerHTML = "";

  const depthScale = state.settings.depthScale || 1;
  document.documentElement.style.setProperty("--depth-scale", String(depthScale));

  DEMO_POSTS.forEach((p, i) => {
    const handle = handles[i % Math.max(handles.length, 1)] || p.handle;
    const name =
      handles.length && handles[i % handles.length]
        ? handle.replace(/^@/, "")
        : p.name;
    const plane = p.plane || (i % 3 === 0 ? "near" : i % 3 === 1 ? "mid" : "far");
    const card = document.createElement("article");
    card.className = `post-card ${plane}`;
    card.dataset.az = String(p.az ?? 0);
    card.dataset.el = String(p.el ?? 0);
    card.dataset.plane = plane;
    card.dataset.theme = p.theme || "default";
    card.dataset.insight = p.insight || "";
    card.dataset.body = p.body || "";
    card.tabIndex = 0;
    card.setAttribute("role", "article");

    const insightHtml = state.settings.showInsights
      ? `<div class="insight-bubble" hidden data-insight-slot>${escapeHtml(p.insight || "")}</div>`
      : "";

    card.innerHTML = `
      <div class="post-head">
        <div class="avatar" aria-hidden="true">${escapeHtml(initials(name))}</div>
        <div class="post-meta">
          <div class="name">${escapeHtml(name)}</div>
          <div class="handle">${escapeHtml(handle)}</div>
        </div>
      </div>
      <p class="post-body">${escapeHtml(p.body)}</p>
      <div class="post-stats">
        <span>${escapeHtml(p.reposts)} reposts</span>
        <span>${escapeHtml(p.likes)} likes</span>
      </div>
      ${insightHtml}
    `;
    feed.appendChild(card);
  });

  applyCardOffsets();
}

export function applyCardOffsets() {
  const cards = document.querySelectorAll(".post-card");
  const scale = state.settings.depthScale || 1;
  const { rotY, rotX, mode } = getWorldRotation();

  cards.forEach((card, i) => {
    const az = Number(card.dataset.az || 0);
    const el = Number(card.dataset.el || 0);
    const plane = card.dataset.plane || "mid";
    let z = plane === "near" ? 28 : plane === "far" ? -48 : 0;
    z *= scale;
    const sc = plane === "near" ? 1 : plane === "far" ? 0.94 : 0.98;
    const op = plane === "near" ? 0.98 : plane === "far" ? 0.62 : 0.86;

    // World-lock: offset cards by fixed azimuth relative to device yaw
    let extraY = 0;
    let extraX = 0;
    if (mode === "world") {
      extraY = az * 0.35;
      extraX = el * 0.25;
    } else if (mode === "parallax") {
      extraY = az * 0.08 + (i % 3) * 0.5;
      extraX = el * 0.05;
    }

    const shadowX = (-rotY + az) * 0.15;
    card.style.opacity = String(op);
    card.style.transform = `translateZ(${z}px) rotateY(${extraY}deg) rotateX(${extraX}deg) scale(${sc})`;
    card.style.boxShadow = `${shadowX}px 14px 40px rgba(0,0,0,0.42), 0 0 0 1px rgba(29,155,240,0.08)`;
  });
}

export function applyWorldTransform() {
  const world = document.getElementById("feedWorld");
  const feed = document.getElementById("feedInner");
  const target = world || feed;
  if (!target) return;

  const { rotX, rotY, mode } = getWorldRotation();
  const smooth = state.settings.reducedMotion ? 0 : 1;
  target.style.transform = `rotateX(${rotX * smooth}deg) rotateY(${rotY * smooth}deg)`;
  target.dataset.lockMode = mode;
  applyCardOffsets();
}

export function updateLockBadge() {
  const badge = document.getElementById("lockBadge");
  const live = document.getElementById("lockLive");
  if (!badge) return;

  let key = "lockScroll";
  let cls = "lock-badge is-scroll";
  if (!state.settings.worldLock || state.settings.reducedMotion) {
    key = "lockOff";
    cls = "lock-badge is-off";
  } else if (state.lock.status === "calibrating") {
    key = "lockCalib";
    cls = "lock-badge is-calib";
  } else if (state.lock.status === "active" && state.lock.available) {
    key = "lockWorld";
    cls = "lock-badge is-world";
  } else {
    key = "lockScroll";
    cls = "lock-badge is-scroll";
  }

  badge.className = cls;
  badge.textContent = t(state, key);
  if (live) live.textContent = t(state, key);
}
