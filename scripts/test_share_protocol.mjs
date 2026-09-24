#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(pathToFileURL(path.join(root, "public/assets/app/share-protocol.js")).href);
const {
  parseShare,
  buildAnchors,
  buildPresence,
  buildReaction,
  ghostsFromMessage,
  MAX_SHARE_BYTES,
} = mod;

const fails = [];
function ok(cond, name) {
  if (!cond) fails.push(name);
}

const anchors = buildAnchors({
  peerId: "host1",
  origin: { yaw0: 5, pitch0: 1 },
  placeName: "Desk",
  includeBody: true,
  cards: [{ id: "demo-0", az: 8, el: -2, plane: "near", handle: "@ada", body: "hello" }],
});
const round = parseShare(JSON.stringify(anchors));
ok(round.ok && round.compat === 4, "v4 round trip");
ok(round.msg.cards[0].handle === "@ada" && round.msg.cards[0].az === 8, "v4 card");
ok(round.msg.origin.yaw0 === 5, "v4 origin");

const ghosts = ghostsFromMessage(round.msg);
ok(ghosts.length === 1 && ghosts[0].ghost && ghosts[0].body === "hello", "ghost");

const v3 = parseShare({ v: 3, type: "presence", peerId: "old", handles: ["@a"], t: 1 });
ok(v3.ok && v3.compat === 3, "v3 presence");
ok(parseShare({ v: 3, type: "handles", peerId: "old", handles: ["@a"] }).ok, "v3 handles");
ok(!parseShare({ v: 3, type: "anchor", peerId: "old", cards: [] }).ok, "v3 anchor rejected");

const huge = { v: 4, type: "note", peerId: "p", body: "z".repeat(MAX_SHARE_BYTES + 20) };
ok(parseShare(huge).error === "oversize", "oversize");
ok(parseShare({ v: 4, type: "explode", peerId: "p" }).error === "unknown", "unknown type");
ok(parseShare({ v: 4, type: "anchor", peerId: "p", video: "frame" }).error === "camera", "camera key");
ok(
  parseShare({ v: 4, type: "note", peerId: "p", cards: [{ body: "data:image/png;base64,aaaa" }] }).error ===
    "camera",
  "camera data url",
);

const reaction = parseShare(buildReaction("p2", "demo-0", "✦"));
ok(reaction.ok && reaction.msg.reaction === "✦", "reaction");
ok(parseShare(buildPresence("p2", ["@a"])).ok, "presence build");

if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("SHARE PROTOCOL OK");
