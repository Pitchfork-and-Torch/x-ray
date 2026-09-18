#!/usr/bin/env node
/** Prove drawStageToCanvas guards zero-size / missing stage (no /0). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "public/assets/app/capture.js"), "utf8");
const fails = [];
function ok(cond, name) {
  if (!cond) fails.push(name);
}

ok(/if\s*\(\s*!stage\s*\)/.test(src), "guards missing stage");
ok(/if\s*\(\s*!w\s*\|\|\s*!h\s*\)/.test(src), "guards zero width/height");
ok(!/const scale = canvas\.width \/ w;/.test(src.split("if (!w || !h)")[0]), "scale after size guard");
const after = src.split("if (!w || !h)")[1] || "";
ok(after.includes("const scale = canvas.width / w;"), "scale still computed when sized");
ok(src.includes("return canvas;"), "early return present");

if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("CAPTURE ZERO STAGE OK");
