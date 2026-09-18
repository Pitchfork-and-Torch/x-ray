/** Prove deadzone zeros deltas so EMA decays to center (not sticky filt). */
function wrap180(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}
const DEADZONE = 0.4;
const ALPHA = 0.22;
function step(filtYaw, yaw, yaw0, sticky) {
  let dYaw = wrap180(yaw - yaw0);
  if (Math.abs(dYaw) < DEADZONE) dYaw = sticky ? filtYaw : 0;
  return filtYaw * (1 - ALPHA) + dYaw * ALPHA;
}
// After a tilt, return to yaw0: sticky holds; fixed decays.
let sticky = 8;
let fixed = 8;
for (let i = 0; i < 40; i++) {
  sticky = step(sticky, 0, 0, true);
  fixed = step(fixed, 0, 0, false);
}
if (Math.abs(sticky) < 1) {
  console.error("sticky unexpectedly decayed", sticky);
  process.exit(1);
}
if (Math.abs(fixed) > 0.05) {
  console.error("fixed did not decay", fixed);
  process.exit(1);
}
console.log("ok: deadzone decays to zero", { sticky: +sticky.toFixed(4), fixed: +fixed.toFixed(6) });
