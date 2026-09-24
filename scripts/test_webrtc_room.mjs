#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(
  pathToFileURL(path.join(root, "public/assets/app/webrtc-room.js")).href
);

const { parseRoomId, joinSignalPath, ROOM_ALPHABET, ROOM_RE } = mod;
const fails = [];
function ok(cond, name) {
  if (!cond) fails.push(name);
}

ok(parseRoomId("ab23cd") === "AB23CD", "parse lower");
ok(parseRoomId("  ab23cd  ") === "AB23CD", "trim");
ok(parseRoomId("") === null, "empty");
ok(parseRoomId("IIIIII") === null, "I invalid");
ok(parseRoomId("ROOM00") === null, "0 invalid");
ok(parseRoomId("@a,@b") === null, "vector deep link is not a room");
ok(parseRoomId("AB") === null, "too short");
ok(ROOM_RE.test("ABCDEF"), "regex 6");
ok([...ROOM_ALPHABET].every((ch) => ROOM_RE.test(ch.repeat(6))), "alphabet members");

ok(joinSignalPath({ ok: true, status: 200, data: { offer: { type: "offer" } } }) === "offer", "offer path");
ok(joinSignalPath({ ok: false, status: 404, data: { error: "not_found" } }) === "missing", "404 missing");
ok(joinSignalPath({ ok: false, status: 0, data: null }) === "local", "network local");
ok(joinSignalPath({ ok: true, status: 200, data: { offer: null, offline: true } }) === "local", "kv offline local");
ok(joinSignalPath(null) === "local", "null local");
ok(joinSignalPath({ ok: false, status: 500, data: { error: "corrupt" } }) === "local", "500 local");

if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("WEBRTC ROOM OK");
