import { state } from "../state.js";

const DEADZONE = 0.4;
const ALPHA_FAST = 0.22;
const ALPHA_SLOW = 0.12;

function wrap180(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function reanchor() {
  state.lock.yaw0 = state.lock.yaw;
  state.lock.pitch0 = state.lock.pitch;
  state.lock.filtYaw = 0;
  state.lock.filtPitch = 0;
  state.lock.status = "calibrating";
  setTimeout(() => {
    if (state.lock.status === "calibrating") state.lock.status = "active";
  }, 450);
  try {
    if (navigator.vibrate) navigator.vibrate(12);
  } catch (_) {}
}

export function ingestPose({ yaw, pitch }) {
  state.lock.yaw = yaw;
  state.lock.pitch = pitch;
  if (state.lock.status === "off" || state.lock.status === "fallback") return;

  let dYaw = wrap180(yaw - state.lock.yaw0);
  let dPitch = pitch - state.lock.pitch0;

  if (Math.abs(dYaw) < DEADZONE) dYaw = state.lock.filtYaw;
  if (Math.abs(dPitch) < DEADZONE) dPitch = state.lock.filtPitch;

  const a = state.settings.batterySaver ? ALPHA_SLOW : ALPHA_FAST;
  state.lock.filtYaw = state.lock.filtYaw * (1 - a) + dYaw * a;
  state.lock.filtPitch = state.lock.filtPitch * (1 - a) + dPitch * a;
}

/**
 * Returns degrees to apply to the world layer.
 * Prefer sensor deltas; fall back to pointer parallax.
 */
export function getWorldRotation() {
  if (state.settings.reducedMotion) {
    return { rotX: 0, rotY: 0, mode: "static" };
  }

  if (
    state.settings.worldLock &&
    (state.lock.status === "active" || state.lock.status === "calibrating") &&
    state.lock.available
  ) {
    const rotY = -clamp(state.lock.filtYaw, -55, 55);
    const rotX = clamp(state.lock.filtPitch * 0.55, -28, 28);
    return { rotX, rotY, mode: "world" };
  }

  // Enhanced scroll / pointer fallback
  const px = state.pointerParallax.x * 8;
  const py = state.pointerParallax.y * 6;
  return { rotX: py, rotY: px, mode: "parallax" };
}
