#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(
  pathToFileURL(path.join(root, "workers/signal/src/index.js")).href
);

const {
  default: handler,
  parseRoomId,
  nextStamp,
  pollMessages,
  normalizeSignal,
  oversized,
  MAX_BODY,
  ROOM_ALPHABET,
  RoomHub,
} = mod;

const fails = [];
function ok(cond, name) {
  if (!cond) fails.push(name);
}

function memoryKv() {
  const map = new Map();
  return {
    async get(key) {
      if (Array.isArray(key)) {
        const out = new Map();
        for (const k of key) out.set(k, map.has(k) ? map.get(k) : null);
        return out;
      }
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, val) {
      map.set(key, val);
    },
    async list({ prefix }) {
      const keys = [...map.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys };
    },
  };
}

async function call(env, method, url, body) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await handler.fetch(new Request("https://xray-signal.test" + url, init), env);
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

const workerSrc = await readFile(path.join(root, "workers/signal/src/index.js"), "utf8");
ok(!workerSrc.includes("cacheTtl: 0"), "no illegal cacheTtl 0");
ok(workerSrc.includes("sig:${id}:"), "unique signal keys");

ok(parseRoomId("ab23cd") === "AB23CD", "parse lower");
ok(parseRoomId("ROOMIO") === null, "reject I/O");
ok(parseRoomId("AB12CD") === null, "reject 1");
ok(parseRoomId("ABC") === null, "reject short");
ok(parseRoomId("ZZZZZZZZ") !== null, "accept 8");
ok(parseRoomId("ZZZZZZZZZ") === null, "reject 9");
ok(!ROOM_ALPHABET.includes("I") && !ROOM_ALPHABET.includes("0"), "alphabet no I/0");
ok(parseRoomId(codeFromAlphabet()) !== null, "alphabet codes parse");

function codeFromAlphabet() {
  return ROOM_ALPHABET.slice(0, 6);
}

ok(nextStamp([], 100) === 100, "stamp empty");
ok(nextStamp([{ t: 100 }], 100) === 101, "stamp same-ms bump");
ok(nextStamp([{ t: 100 }], 99) === 101, "stamp rewind bump");
ok(nextStamp([{ t: 100 }], 200) === 200, "stamp forward");

const sameMs = [
  { from: "a", t: nextStamp([], 50) },
  { from: "a", t: 0 },
];
sameMs[1].t = nextStamp(sameMs.slice(0, 1), 50);
const polled = pollMessages(sameMs, "b", 0);
ok(polled.messages.length === 2, "poll both same-ms");
ok(polled.cursor === 51, "cursor last stamp");
const second = pollMessages(sameMs, "b", polled.cursor);
ok(second.messages.length === 0, "no replay after cursor");
ok(pollMessages(sameMs, "a", 0).messages.length === 0, "filter self");

ok(normalizeSignal({ type: "ice", from: "p1", candidate: { c: 1 } })?.type === "ice", "norm ice");
ok(normalizeSignal({ type: "answer", from: "p1", sdp: { type: "answer", sdp: "x" } })?.sdp, "norm answer");
ok(normalizeSignal({ type: "junk", from: "p1" }) === null, "reject junk type");
ok(normalizeSignal({ type: "ice", candidate: {} }) === null, "reject missing from");
ok(normalizeSignal({ type: "ice", from: "x".repeat(80), candidate: {} }) === null, "reject long from");
ok(normalizeSignal({ type: "ice", from: "p1", candidate: {}, extra: "nope" }).extra === undefined, "strip extra");
ok(oversized("x".repeat(MAX_BODY + 8)), "oversized flag");

const env = { ROOMS: memoryKv() };
const health = await call(env, "GET", "/health");
ok(health.status === 200 && health.data.ok && health.data.service === "xray-signal", "health");
ok(health.data.privacy.includes("No media"), "health privacy");
ok(health.headers.get("Access-Control-Allow-Origin") === "*", "cors");

const opt = await call(env, "OPTIONS", "/rooms/ABCDEF");
ok(opt.status === 204, "options");

const badPut = await call(env, "PUT", "/rooms/NOPE!!", { offer: { type: "offer", sdp: "x" } });
ok(badPut.status === 400 && badPut.data.error === "bad_room", "put bad room");

const put = await call(env, "PUT", "/rooms/ab23cd", {
  offer: { type: "offer", sdp: "offer-sdp" },
  host: "host1",
});
ok(put.status === 200 && put.data.id === "AB23CD" && put.data.kv === true, "put room");

const got = await call(env, "GET", "/rooms/AB23CD");
ok(got.status === 200 && got.data.offer?.sdp === "offer-sdp" && got.data.answer === null, "get offer");

const missing = await call(env, "GET", "/rooms/ZZZZZZ");
ok(missing.status === 404, "get missing");

const ghostIce = await call(env, "POST", "/rooms/ZZZZZZ/signal", {
  type: "ice",
  from: "g1",
  candidate: { c: 1 },
});
ok(ghostIce.status === 404, "no orphan signals");

const junk = await call(env, "POST", "/rooms/AB23CD/signal", { type: "photo", from: "g1", blob: "nope" });
ok(junk.status === 400, "reject junk signal");

const iceA = await call(env, "POST", "/rooms/AB23CD/signal", {
  type: "ice",
  from: "guest",
  candidate: { candidate: "a" },
});
ok(iceA.status === 200, "post ice");

const iceB = await call(env, "POST", "/rooms/AB23CD/signal", {
  type: "ice",
  from: "guest",
  candidate: { candidate: "b" },
});
ok(iceB.status === 200, "post ice 2");

const poll0 = await call(env, "GET", "/rooms/AB23CD/poll?peer=host1&since=0");
ok(poll0.status === 200 && poll0.data.messages && poll0.data.messages.length === 2, "poll both ice");
ok(
  poll0.data.messages && poll0.data.messages[0].t < poll0.data.messages[1].t,
  "monotonic t",
);
const poll1 = await call(
  env,
  "GET",
  `/rooms/AB23CD/poll?peer=host1&since=${poll0.data.cursor || 0}`,
);
ok(poll1.data.messages && poll1.data.messages.length === 0, "cursor exclusive");

const ans1 = await call(env, "POST", "/rooms/AB23CD/signal", {
  type: "answer",
  from: "guest",
  sdp: { type: "answer", sdp: "first" },
});
ok(ans1.status === 200, "first answer");
const ans2 = await call(env, "POST", "/rooms/AB23CD/signal", {
  type: "answer",
  from: "other",
  sdp: { type: "answer", sdp: "second" },
});
ok(ans2.status === 200, "second answer accepted as ice-list only");
const afterAns = await call(env, "GET", "/rooms/AB23CD");
ok(afterAns.data.answer?.sdp === "first", "first answer wins");

const anchorReject = await call(env, "POST", "/rooms/AB23CD/signal", {
  type: "anchor",
  from: "guest",
  cards: [{ body: "not stored here" }],
});
ok(anchorReject.status === 400, "worker rejects app anchors");
ok(!workerSrc.includes("api.x.com"), "worker does not call X");

const huge = await call(env, "POST", "/rooms/AB23CD/signal", {
  type: "ice",
  from: "guest",
  candidate: { candidate: "z".repeat(MAX_BODY) },
});
ok(huge.status === 413, "413 too large");

const badJson = await call(env, "PUT", "/rooms/AB23CD", "not-json");
ok(badJson.status === 400, "bad json");

await env.ROOMS.put("room:AB23CD", "{not json");
const corrupt = await call(env, "GET", "/rooms/AB23CD");
ok(corrupt.status === 500 && corrupt.data.error === "corrupt", "corrupt kv");

const offline = await call({}, "GET", "/rooms/AB23CD");
ok(offline.status === 200 && offline.data.offline === true, "no kv offline");

function memoryStorage() {
  const map = new Map();
  return {
    async get(key) {
      if (Array.isArray(key)) {
        const out = new Map();
        for (const k of key) out.set(k, map.has(k) ? map.get(k) : undefined);
        return out;
      }
      return map.has(key) ? map.get(key) : undefined;
    },
    async put(key, val) {
      map.set(key, val);
    },
    async list({ prefix }) {
      const out = new Map();
      for (const [k, v] of map) if (k.startsWith(prefix)) out.set(k, v);
      return out;
    },
    async setAlarm() {},
    async deleteAll() {
      map.clear();
    },
  };
}

ok(typeof RoomHub === "function", "RoomHub export");
const hub = new RoomHub({ storage: memoryStorage() }, {});
async function hubCall(method, url, body) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await hub.fetch(new Request("https://xray-signal.test" + url, init));
  return { status: res.status, data: JSON.parse(await res.text()) };
}
const hubPut = await hubCall("PUT", "/rooms/ZZ2345", {
  offer: { type: "offer", sdp: "o" },
  host: "h1",
});
ok(hubPut.status === 200 && hubPut.data.id === "ZZ2345", "do put");
await hubCall("POST", "/rooms/ZZ2345/signal", {
  type: "ice",
  from: "g",
  candidate: { candidate: "a" },
});
await hubCall("POST", "/rooms/ZZ2345/signal", {
  type: "ice",
  from: "g",
  candidate: { candidate: "b" },
});
const hubPoll = await hubCall("GET", "/rooms/ZZ2345/poll?peer=h1&since=0");
ok(hubPoll.data.messages && hubPoll.data.messages.length === 2, "do poll both ice");
ok(
  hubPoll.data.messages && hubPoll.data.messages[0].t < hubPoll.data.messages[1].t,
  "do monotonic t",
);
const hubGhost = await hubCall("POST", "/rooms/ZZ2345/signal", {
  type: "photo",
  from: "g",
  blob: "nope",
});
ok(hubGhost.status === 400, "do reject junk");

if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("SIGNAL WORKER OK");
