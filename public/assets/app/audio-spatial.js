import { state } from "./state.js";
import { getWorldRotation } from "./sensors/fusion.js";

let ctx = null;
let master = null;
let nodes = [];

export function setSpatialAudioEnabled(on) {
  if (!on) {
    stopAll();
    return;
  }
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    master = master || ctx.createGain();
    master.gain.value = 0.08;
    master.connect(ctx.destination);
    // soft nearby ticks for near cards
    nodes = [];
    const nearCards = document.querySelectorAll(".post-card.near");
    nearCards.forEach((card, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      osc.type = "sine";
      osc.frequency.value = 220 + i * 40;
      g.gain.value = 0.0001;
      osc.connect(g);
      if (panner) {
        g.connect(panner);
        panner.connect(master);
      } else {
        g.connect(master);
      }
      osc.start();
      nodes.push({ osc, g, panner, card });
    });
  } catch (_) {
    // ignore
  }
}

export function updateSpatialAudio() {
  if (!state.settings.spatialAudio || !ctx || !nodes.length) return;
  const { rotY } = getWorldRotation();
  nodes.forEach((n, i) => {
    const az = Number(n.card.dataset.az || 0);
    const rel = az + rotY;
    if (n.panner) n.panner.pan.value = Math.max(-1, Math.min(1, rel / 40));
    // gentle pulse
    const t = ctx.currentTime;
    const pulse = 0.002 + 0.004 * (0.5 + 0.5 * Math.sin(t * 2 + i));
    n.g.gain.setTargetAtTime(pulse, t, 0.05);
  });
}

function stopAll() {
  nodes.forEach((n) => {
    try {
      n.osc.stop();
      n.osc.disconnect();
      n.g.disconnect();
      n.panner?.disconnect();
    } catch (_) {}
  });
  nodes = [];
}

export function disposeAudio() {
  stopAll();
  try {
    ctx?.close();
  } catch (_) {}
  ctx = null;
  master = null;
}
