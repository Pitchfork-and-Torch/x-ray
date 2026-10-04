/** Freeze a card's az/el to the current gaze. Orientation-relative, not a scan. */

export function gazeAngles(lock, parallax) {
  const world =
    lock &&
    lock.available &&
    (lock.status === "active" || lock.status === "calibrating");
  if (world) {
    return {
      az: Math.round(Number(lock.filtYaw) || 0),
      el: Math.round(Number(lock.filtPitch) || 0),
    };
  }
  return {
    az: Math.round((parallax && parallax.x ? parallax.x : 0) * 20),
    el: Math.round((parallax && parallax.y ? parallax.y : 0) * 12),
  };
}

export function pinCard(card, angles) {
  if (!card || typeof card !== "object") return null;
  return {
    ...card,
    az: Number(angles && angles.az) || 0,
    el: Number(angles && angles.el) || 0,
    pinned: true,
    plane: card.plane || "near",
  };
}
