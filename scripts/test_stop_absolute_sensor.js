/**
 * Source contract: stopOrientation must stop AbsoluteOrientationSensor.
 * Distinct from camera bind-stop (#8) and absolute→deviceorientation fallback (#4).
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(
  path.join(__dirname, "../public/assets/app/sensors/orientation.js"),
  "utf8"
);
const checks = [
  [/let absoluteSensor = null/, "tracks absoluteSensor ref"],
  [/absoluteSensor = sensor/, "stores AbsoluteOrientationSensor on start"],
  [/absoluteSensor\.stop\(\)/, "stopOrientation stops absolute sensor"],
  [/if \(absoluteSensor === sensor\) absoluteSensor = null/, "error path clears absoluteSensor after stop"],
];
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
console.log("STOP ABSOLUTE SENSOR OK");
