import { state, saveSettings } from "./state.js";

/**
 * Pinch to scale depth; pointer parallax for desktop fallback.
 */
export function bindGestures({ onDepthScale, root }) {
  const el = root || document.getElementById("arStage");
  if (!el) return () => {};

  let pointers = new Map();
  let pinchStart = 0;
  let scaleStart = 1;

  function dist() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.hypot(dx, dy);
  }

  function onDown(e) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      pinchStart = dist();
      scaleStart = state.settings.depthScale || 1;
    }
    try {
      el.setPointerCapture(e.pointerId);
    } catch (_) {}
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2 && pinchStart > 0) {
      const d = dist();
      const ratio = d / pinchStart;
      const next = Math.max(0.6, Math.min(1.6, scaleStart * ratio));
      state.settings.depthScale = next;
      if (onDepthScale) onDepthScale(next);
      return;
    }

    // single pointer parallax when not world-locked
    if (
      pointers.size === 1 &&
      (!state.lock.available || state.lock.status === "fallback" || !state.settings.worldLock)
    ) {
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      state.pointerParallax.x = Math.max(-1, Math.min(1, nx));
      state.pointerParallax.y = Math.max(-1, Math.min(1, ny));
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      pinchStart = 0;
      saveSettings();
    }
  }

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("pointerleave", onUp);

  // desktop mouse move for parallax without press
  function onMouseMove(e) {
    if (state.settings.reducedMotion) return;
    if (state.lock.status === "active" && state.lock.available && state.settings.worldLock) return;
    const rect = el.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    state.pointerParallax.x = Math.max(-1, Math.min(1, nx)) * 0.6;
    state.pointerParallax.y = Math.max(-1, Math.min(1, ny)) * 0.6;
  }
  el.addEventListener("mousemove", onMouseMove);

  return () => {
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.removeEventListener("pointerleave", onUp);
    el.removeEventListener("mousemove", onMouseMove);
  };
}
