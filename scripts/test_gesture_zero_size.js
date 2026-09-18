#!/usr/bin/env node
/** Prove gesture parallax guards zero-size stage rect (no /0 → Infinity). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "public/assets/app/gestures.js"), "utf8");
const fails = [];
function ok(cond, name) {
  if (!cond) fails.push(name);
}

ok(/if\s*\(\s*!rect\.width\s*\|\|\s*!rect\.height\s*\)\s*return/.test(src), "zero-size rect guard present");
const guards = src.match(/if\s*\(\s*!rect\.width\s*\|\|\s*!rect\.height\s*\)\s*return/g) || [];
ok(guards.length >= 2, "guard on pointer and mouse parallax paths");
ok(src.includes("rect.width") && src.includes("rect.height"), "still divides by width/height when sized");
// ensure divide comes after a guard in both parallax blocks
const parts = src.split("getBoundingClientRect()");
ok(parts.length >= 3, "two getBoundingClientRect call sites");
for (let i = 1; i < parts.length; i++) {
  const chunk = parts[i].slice(0, 280);
  ok(/!rect\.width/.test(chunk), `guard before divide at site ${i}`);
}

if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("GESTURE ZERO SIZE OK");
