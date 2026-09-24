#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(pathToFileURL(path.join(root, "public/assets/app/owned-feed.js")).href);
const { parseFeedText, mergeFeed, sanitizeText, MAX_FEED_CARDS } = mod;

const fails = [];
function ok(cond, name) {
  if (!cond) fails.push(name);
}

const sample = parseFeedText(
  JSON.stringify([{ name: "Ada", handle: "@ada", body: "hello room", az: 4, el: 1, plane: "near" }]),
);
ok(sample.ok && sample.cards[0].body === "hello room", "json card");
ok(sample.cards[0].handle === "@ada", "handle");
ok(sample.cards[0].plane === "near", "plane");

const tweets = parseFeedText(
  'window.YTD.tweets.part0 = [{ "tweet": { "full_text": "hello room", "favorite_count": "3", "retweet_count": "1" } }];',
);
ok(tweets.ok && tweets.cards[0].body === "hello room", "tweets.js");
ok(String(tweets.cards[0].likes) === "3", "likes");

const html = parseFeedText("<html><script>alert(1)</script><body>nope</body></html>");
ok(!html.ok && html.error === "html", "reject html");

const scriptOnly = parseFeedText(JSON.stringify([{ handle: "@a", body: "<script>alert(1)</script>" }]));
ok(!scriptOnly.ok, "reject script-only card");

const stripped = sanitizeText("keep <script>alert(1)</script> this");
ok(stripped === "keep this" && !stripped.includes("<script"), "strip script");

const url = parseFeedText("https://x.com/suddenlyjon");
ok(!url.ok && url.error === "network-url", "reject network url");

const many = Array.from({ length: 100 }, (_, i) => ({ handle: "@h" + i, body: "card " + i }));
const capped = parseFeedText(JSON.stringify(many));
ok(capped.ok && capped.truncated && capped.cards.length === MAX_FEED_CARDS, "cap 80");

const big = parseFeedText("x".repeat(400 * 1024 + 1));
ok(!big.ok && big.error === "too-large", "reject 400kb");

const merged = mergeFeed(
  [{ handle: "@a", body: "one" }],
  [
    { handle: "@a", body: "one" },
    { handle: "@b", body: "two" },
  ],
  "merge",
);
ok(merged.length === 2, "merge dedupe");
ok(mergeFeed([{ handle: "@a", body: "one" }], [{ handle: "@b", body: "two" }], "replace").length === 1, "replace");

const src = await readFile(path.join(root, "public/assets/app/owned-feed.js"), "utf8");
ok(!src.includes("fetch("), "no fetch");
ok(!src.includes("api.x.com"), "no x api");

if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("OWNED FEED OK");
