import { state } from "./state.js";
import { putCapture } from "./gallery-idb.js";

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH);
      lines++;
      if (lines >= maxLines) return;
      line = words[i];
    } else line = test;
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineH);
}

function drawStageToCanvas(canvas) {
  const stage = document.getElementById("arStage");
  const video = document.getElementById("arVideo");
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  const ctx = canvas.getContext("2d");
  const scale = canvas.width / w;

  if (state.mode === "live" && video && video.readyState >= 2) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const cover = Math.max(canvas.width / vw, canvas.height / vh);
    const dw = vw * cover;
    const dh = vh * cover;
    ctx.drawImage(video, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, "#0a0c10");
    g.addColorStop(1, "#000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // ambient wash
    ctx.fillStyle = `rgba(${state.ambient.r},${state.ambient.g},${state.ambient.b},0.15)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const cards = document.querySelectorAll(".post-card");
  const stageRect = stage.getBoundingClientRect();
  cards.forEach((card) => {
    const r = card.getBoundingClientRect();
    if (r.bottom < stageRect.top || r.top > stageRect.bottom) return;
    const x = (r.left - stageRect.left) * scale;
    const y = (r.top - stageRect.top) * scale;
    const cw = r.width * scale;
    const ch = r.height * scale;
    const alpha = card.classList.contains("far")
      ? 0.55
      : card.classList.contains("mid")
        ? 0.8
        : 0.92;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(12,14,18,${0.55 + state.settings.blend / 200})`;
    roundRect(ctx, x, y, cw, ch, 16 * scale);
    ctx.fill();
    ctx.strokeStyle = "rgba(29,155,240,0.45)";
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();
    ctx.fillStyle = "#e7e9ea";
    ctx.font = `600 ${12 * scale}px ${getComputedStyle(document.body).fontFamily}`;
    const name = card.querySelector(".name")?.textContent || "";
    const handle = card.querySelector(".handle")?.textContent || "";
    const body = card.querySelector(".post-body")?.textContent || "";
    ctx.fillText(name, x + 12 * scale, y + 22 * scale);
    ctx.fillStyle = "#71767b";
    ctx.font = `500 ${10 * scale}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.fillText(handle, x + 12 * scale, y + 36 * scale);
    ctx.fillStyle = "#e7e9ea";
    ctx.font = `400 ${11 * scale}px ${getComputedStyle(document.body).fontFamily}`;
    wrapText(ctx, body, x + 12 * scale, y + 56 * scale, cw - 24 * scale, 14 * scale, 4);
    ctx.restore();
  });

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(12 * scale, canvas.height - 36 * scale, 190 * scale, 22 * scale);
  ctx.fillStyle = "#1d9bf0";
  ctx.font = `600 ${11 * scale}px ${getComputedStyle(document.body).fontFamily}`;
  ctx.fillText("X-Ray v3 · on-device", 20 * scale, canvas.height - 20 * scale);
  return canvas;
}

export async function captureStill() {
  const canvas = document.createElement("canvas");
  drawStageToCanvas(canvas);
  const dataUrl = canvas.toDataURL("image/png");
  const id = Date.now();
  await putCapture({
    id,
    kind: "still",
    dataUrl,
    createdAt: id,
    mime: "image/png",
  });
  state.lastCapture = dataUrl;
  state.lastCaptureKind = "still";
  return { dataUrl, id, kind: "still" };
}

export function momentsSupported() {
  return typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;
}

export async function captureMoment(seconds = 3, onTick) {
  const secs = Math.max(2, Math.min(6, seconds || state.settings.momentSeconds || 3));
  const canvas = document.createElement("canvas");
  drawStageToCanvas(canvas);
  const stream = canvas.captureStream(state.settings.batterySaver ? 24 : 30);
  const mimeCandidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  const done = new Promise((resolve, reject) => {
    rec.onstop = () => resolve();
    rec.onerror = () => reject(new Error("recorder"));
  });

  rec.start(100);
  const start = performance.now();
  let raf = 0;
  const tick = (now) => {
    drawStageToCanvas(canvas);
    if (onTick) onTick(Math.min(1, (now - start) / (secs * 1000)));
    if (now - start < secs * 1000) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  await new Promise((r) => setTimeout(r, secs * 1000));
  cancelAnimationFrame(raf);
  rec.stop();
  stream.getTracks().forEach((t) => t.stop());
  await done;

  const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
  const dataUrl = await blobToDataUrl(blob);
  const id = Date.now();
  await putCapture({
    id,
    kind: "moment",
    dataUrl,
    createdAt: id,
    mime: blob.type || "video/webm",
  });
  state.lastCapture = dataUrl;
  state.lastCaptureKind = "moment";
  return { dataUrl, id, kind: "moment", blob };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}
