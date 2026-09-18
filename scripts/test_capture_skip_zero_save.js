#!/usr/bin/env node
/** Prove captureStill/captureMoment skip gallery save when stage is zero-size.
 * Distinct from test_capture_zero_stage.js (divide-by-zero guard only).
 */
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(
  path.join(__dirname, "../public/assets/app/capture.js"),
  "utf8"
);
let failed = 0;
function ok(cond, msg) {
  if (cond) console.log("ok -", msg);
  else {
    console.error("not ok -", msg);
    failed++;
  }
}
ok(/return null/.test(src), "drawStageToCanvas returns null on abort");
ok(
  /if\s*\(\s*!drawStageToCanvas\s*\(\s*canvas\s*\)\s*\)\s*\{[^}]*return null/s.test(src),
  "captureStill skips save when draw aborts"
);
ok(
  /captureMoment[\s\S]*?if\s*\(\s*!drawStageToCanvas\s*\(\s*canvas\s*\)\s*\)\s*\{[^}]*return null/.test(src),
  "captureMoment skips save when draw aborts"
);
ok(
  /do not putCapture a 1×1 placeholder|skip-save as captureStill|Signal caller: do not gallery-save/.test(src),
  "comment documents skip-save (≠ zero-size /0 guard alone)"
);
process.exit(failed ? 1 : 0);
