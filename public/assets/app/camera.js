import { state } from "./state.js";

export function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach((tr) => tr.stop());
    state.stream = null;
  }
  const video = document.getElementById("arVideo");
  if (video) {
    video.srcObject = null;
    video.hidden = true;
  }
  const fb = document.getElementById("arFallback");
  if (fb) fb.hidden = false;
}

export async function startCamera() {
  stopCamera();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { ok: false, reason: "unsupported" };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    state.stream = stream;
    const video = document.getElementById("arVideo");
    video.srcObject = stream;
    video.hidden = false;
    document.getElementById("arFallback").hidden = true;
    await video.play().catch(() => {});
    return { ok: true };
  } catch (_) {
    return { ok: false, reason: "denied" };
  }
}
