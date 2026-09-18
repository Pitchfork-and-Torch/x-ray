#!/usr/bin/env node
/** Prove startCamera catch path stops tracks (no hot camera after bind fail). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "public/assets/app/camera.js"), "utf8");
const fails = [];
function ok(cond, name) {
  if (!cond) fails.push(name);
}

ok(src.includes("stopCamera();"), "catch calls stopCamera");
ok(/catch\s*\([^)]*\)\s*\{[^}]*stopCamera\(\)/s.test(src), "stopCamera inside catch");
ok(src.includes('return { ok: false, reason: "denied" }'), "still reports denied");

if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("CAMERA BIND STOP OK");
