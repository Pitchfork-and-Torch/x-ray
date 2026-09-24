/**
 * WebXR hit-test is progressive enhancement. CSS 3D world lock stays the default.
 * This is not SLAM and not a room mesh. iOS Safari without WebXR AR never enters here.
 */

export function xrHitApiPresent() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.xr &&
    typeof navigator.xr.isSessionSupported === "function"
  );
}

export async function probeImmersiveAr() {
  if (!xrHitApiPresent()) return false;
  try {
    return !!(await navigator.xr.isSessionSupported("immersive-ar"));
  } catch (_) {
    return false;
  }
}

function anglesFromPosition(pos) {
  if (!pos) return null;
  const x = Number(pos.x) || 0;
  const y = Number(pos.y) || 0;
  const z = Number(pos.z) || 0;
  const az = Math.round((Math.atan2(x, -z) * 180) / Math.PI);
  const el = Math.round((Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI);
  return { az, el, plane: "near" };
}

/**
 * Fail closed. Reduced motion and battery saver never start a session.
 * On any API miss, caller keeps the CSS 3D path.
 */
export async function startHitTest({ reducedMotion, batterySaver, onSelect } = {}) {
  if (reducedMotion || batterySaver) return { ok: false, reason: "skipped" };
  if (!(await probeImmersiveAr())) return { ok: false, reason: "unsupported" };
  let session;
  try {
    session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "local-floor"],
    });
  } catch (_) {
    return { ok: false, reason: "denied" };
  }

  let refSpace;
  let viewer;
  let hitSource;
  try {
    refSpace = await session.requestReferenceSpace("local-floor");
    viewer = await session.requestReferenceSpace("viewer");
    hitSource = await session.requestHitTestSource({ space: viewer });
  } catch (_) {
    try {
      await session.end();
    } catch (_) {}
    return { ok: false, reason: "unsupported" };
  }

  let last = null;
  const step = (_t, frame) => {
    if (!hitSource || session.ended) return;
    try {
      const hits = frame.getHitTestResults(hitSource);
      if (hits && hits.length) {
        const pose = hits[0].getPose(refSpace);
        if (pose && pose.transform) last = anglesFromPosition(pose.transform.position);
      }
    } catch (_) {}
    session.requestAnimationFrame(step);
  };
  session.addEventListener("end", () => {
    hitSource = null;
  });
  session.addEventListener("select", () => {
    if (last && typeof onSelect === "function") onSelect(last);
  });
  session.requestAnimationFrame(step);
  return { ok: true, session };
}
