#!/usr/bin/env node
/**
 * AbsoluteOrientationSensor error must attach deviceorientation fallback.
 * listening=true on absolute start used to make bindDeviceOrientation a no-op
 * (≠ #4 which only added the bind call, ≠ #9 stop on stopOrientation).
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(
  path.join(__dirname, "../public/assets/app/sensors/orientation.js"),
  "utf8"
);

const checks = [
  [/absoluteSensor = sensor/, "stores AbsoluteOrientationSensor on start"],
  [
    /error[\s\S]*?listening = false[\s\S]*?bindDeviceOrientation\(\)/,
    "error path clears listening before bindDeviceOrientation",
  ],
  [
    /absoluteSensor = sensor;\s*\/\/[^\n]*\s*return \{ ok: true, mode: "absolute" \}/,
    "absolute success does not set listening=true",
  ],
];

// Stronger: between absoluteSensor = sensor and mode absolute return, no listening = true
const absStart = src.indexOf("absoluteSensor = sensor;");
const absRet = src.indexOf('mode: "absolute"', absStart);
if (absStart < 0 || absRet < 0) {
  console.error("FAIL locate absolute success path");
  process.exit(1);
}
const between = src.slice(absStart, absRet);
if (/listening\s*=\s*true/.test(between)) {
  console.error("FAIL absolute success still sets listening=true");
  process.exit(1);
}
console.log("ok  absolute success does not set listening=true");

let failed = 0;
for (const [re, label] of checks) {
  if (!re.test(src)) {
    console.error("FAIL", label);
    failed++;
  } else {
    console.log("ok ", label);
  }
}
if (failed) process.exit(1);
console.log("ABSOLUTE ERROR FALLBACK OK");
