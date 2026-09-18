#!/usr/bin/env node
/** Prove drawStageToCanvas guards zero videoWidth/Height (no /0). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "public/assets/app/capture.js"), "utf8");
const fails = [];
function ok(cond, name) {
  if (!cond) fails.push(name);
}

ok(/video\.videoWidth/.test(src), "reads videoWidth");
ok(/video\.videoHeight/.test(src), "reads videoHeight");
ok(/vw\s*>\s*0\s*&&\s*vh\s*>\s*0/.test(src), "guards zero video dims");
// cover must sit inside the positive-dim branch
const afterGuard = src.split(/vw\s*>\s*0\s*&&\s*vh\s*>\s*0/)[1] || "";
ok(afterGuard.includes("canvas.width / vw"), "cover uses vw only after guard");
const beforeGuard = src.split(/vw\s*>\s*0\s*&&\s*vh\s*>\s*0/)[0] || "";
ok(!/canvas\.width\s*\/\s*vw/.test(beforeGuard.split("video.videoWidth")[1] || beforeGuard), "no unguarded vw divide after read");

if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("CAPTURE ZERO VIDEO OK");
