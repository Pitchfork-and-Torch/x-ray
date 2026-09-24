/**
 * Device orientation feature detection + iOS Safari permission.
 * Emits raw yaw/pitch degrees via callback.
 */

let listening = false;
let lastCb = null;

function wrap180(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function onDeviceOrientation(e) {
  if (!lastCb) return;
  // alpha: z (0-360 compass-ish), beta: x (-180..180), gamma: y (-90..90)
  if (e.alpha == null && e.beta == null) return;
  const yaw = wrap180(e.alpha ?? 0);
  const pitch = e.beta ?? 0;
  lastCb({ yaw, pitch, source: "deviceorientation", absolute: !!e.absolute });
}

function onAbsoluteSensor(sensor) {
  return () => {
    if (!lastCb || !sensor.quaternion) return;
    const [x, y, z, w] = sensor.quaternion;
    // yaw (heading) and pitch from quaternion
    const siny = 2 * (w * z + x * y);
    const cosy = 1 - 2 * (y * y + z * z);
    const yaw = (Math.atan2(siny, cosy) * 180) / Math.PI;
    const sinp = 2 * (w * y - z * x);
    const pitch =
      Math.abs(sinp) >= 1
        ? (Math.sign(sinp) * 90)
        : (Math.asin(sinp) * 180) / Math.PI;
    lastCb({ yaw: wrap180(yaw), pitch, source: "absolute", absolute: true });
  };
}

export function orientationSupported() {
  return (
    typeof window !== "undefined" &&
    ("DeviceOrientationEvent" in window ||
      (typeof AbsoluteOrientationSensor !== "undefined"))
  );
}

export function needsOrientationPermission() {
  return (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  );
}

/**
 * Request permission if needed, then start streaming orientation.
 * Must be called from a user gesture on iOS.
 */
export async function startOrientation(onPose) {
  lastCb = onPose;

  if (typeof AbsoluteOrientationSensor !== "undefined") {
    try {
      const sensor = new AbsoluteOrientationSensor({ frequency: 60 });
      sensor.addEventListener("reading", onAbsoluteSensor(sensor));
      sensor.addEventListener("error", () => {
        // fall through to deviceorientation
        bindDeviceOrientation();
      });
      sensor.start();
      listening = true;
      return { ok: true, mode: "absolute" };
    } catch (_) {
      // continue
    }
  }

  if (needsOrientationPermission()) {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") {
        return { ok: false, reason: "denied" };
      }
    } catch (_) {
      return { ok: false, reason: "denied" };
    }
  }

  return bindDeviceOrientation();
}

function bindDeviceOrientation() {
  if (!("DeviceOrientationEvent" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  if (!listening) {
    window.addEventListener("deviceorientation", onDeviceOrientation, true);
    listening = true;
  }
  return { ok: true, mode: "deviceorientation" };
}

export function stopOrientation() {
  if (listening) {
    window.removeEventListener("deviceorientation", onDeviceOrientation, true);
    listening = false;
  }
  lastCb = null;
}
