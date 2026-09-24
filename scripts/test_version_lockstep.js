#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("bad VERSION", version);
  process.exit(1);
}
const files = {
  "public/assets/app/state.js": 'export const VERSION = "' + version + '"',
  "public/sw.js": 'const CACHE = "xray-v' + version + '"',
  "public/llms.txt": "Version: " + version,
  "public/index.html": '"softwareVersion": "' + version + '"',
};
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const fails = [];
if (!html.includes("og.jpg?v=" + version)) fails.push("og cache-bust");
if (!html.includes("4.0.0 Grounded Reality")) fails.push("grounded reality");
if (!html.includes('id="pulse-panel"')) fails.push("pulse panel");
if (!html.includes("/assets/app/main-v400.js")) fails.push("entry");
const i18n = fs.readFileSync(path.join(root, "public/assets/app/i18n.js"), "utf8");
if (!i18n.includes("4.0.0 Grounded Reality")) fails.push("i18n whatsNewBody");
const webrtc = fs.readFileSync(path.join(root, "public/assets/app/webrtc-room.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "workers/signal/src/index.js"), "utf8");
const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
if (!webrtc.includes(alpha)) fails.push("webrtc room alphabet");
if (!worker.includes(alpha)) fails.push("signal worker alphabet");
Object.entries(files).forEach(([rel, needle]) => {
  const t = fs.readFileSync(path.join(root, rel), "utf8");
  if (!t.includes(needle)) fails.push(rel);
});
if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("LOCKSTEP OK", version);
