import { state } from "./state.js";

let canvas;
let ctx;
let last = 0;

export function sampleAmbient(now = performance.now()) {
  if (state.settings.batterySaver || state.settings.reducedMotion) return;
  if (state.mode !== "live") return;
  if (now - last < 280) return;
  last = now;

  const video = document.getElementById("arVideo");
  if (!video || video.readyState < 2 || video.hidden) return;

  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  }
  try {
    ctx.drawImage(video, 0, 0, 32, 32);
    const data = ctx.getImageData(0, 0, 32, 32).data;
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
    r = Math.round(r / n);
    g = Math.round(g / n);
    b = Math.round(b / n);
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    state.ambient = { r, g, b, luma };
    document.documentElement.style.setProperty("--ambient-tint", `rgb(${r},${g},${b})`);
    document.documentElement.style.setProperty("--ambient-luma", String(luma.toFixed(3)));
    document.documentElement.style.setProperty(
      "--ambient-soft",
      `rgba(${r},${g},${b},0.18)`
    );
  } catch (_) {
    // tainted or not ready
  }
}

export function resetAmbient() {
  document.documentElement.style.setProperty("--ambient-tint", "rgb(20,28,40)");
  document.documentElement.style.setProperty("--ambient-luma", "0.12");
  document.documentElement.style.setProperty("--ambient-soft", "rgba(29,155,240,0.12)");
}
