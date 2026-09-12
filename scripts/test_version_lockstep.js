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
  "public/index.html": "softwareVersion\": \"" + version + "\"",
};
const html = fs.readFileSync(path.join(root, "public/index.html"), "utf8");
const fails = [];
if (!html.includes("og.jpg?v=" + version)) fails.push("og cache-bust");
if (!html.includes("Local Pulse")) fails.push("changelog Local Pulse");
if (!html.includes("id=\"pulse-panel\"")) fails.push("pulse panel");
Object.entries(files).forEach(([rel, needle]) => {
  const t = fs.readFileSync(path.join(root, rel), "utf8");
  if (!t.includes(needle)) fails.push(rel);
});
if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("LOCKSTEP OK", version);
