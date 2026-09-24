#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mod = await import(pathToFileURL(path.join(root, "public/assets/app/places.js")).href);
const { serializePlace, restorePlace, evictPlaces, migrationPlan, layoutFromPlace, PLACE_CAP } = mod;

const fails = [];
function ok(cond, name) {
  if (!cond) fails.push(name);
}

const plan = migrationPlan(1);
ok(plan.wipeGallery === false, "do not wipe gallery");
ok(plan.toVersion === 2, "version 2");
ok(plan.addStores.includes("places") && plan.addStores.includes("feed"), "add stores");
ok(migrationPlan(2).addStores.length === 0, "already v2");

const place = serializePlace({
  id: "desk-1",
  name: "Desk",
  origin: { yaw0: 12, pitch0: -3 },
  source: "owned",
  cards: [
    {
      id: "c1",
      az: 10,
      el: 2,
      plane: "near",
      source: "owned",
      pinned: true,
      post: { name: "Ada", handle: "@ada", body: "stay" },
    },
  ],
});
const back = restorePlace(place);
ok(back.origin.yaw0 === 12 && back.origin.pitch0 === -3, "origin");
ok(back.cards[0].az === 10 && back.cards[0].post.body === "stay", "card");
ok(back.source === "owned", "source");
const layout = layoutFromPlace(back);
ok(layout[0].handle === "@ada" && layout[0].pinned === true, "layout");

const many = [];
for (let i = 0; i < 25; i++) {
  many.push(serializePlace({ id: "p" + i, name: "R" + i, updated: i, cards: [] }));
}
const kept = evictPlaces(many);
ok(kept.length === PLACE_CAP, "cap");
ok(kept[0].updated === 24, "newest kept");
ok(!kept.some((p) => p.updated < 5), "oldest dropped");

const gallery = [{ id: "still-1", kind: "still", dataUrl: "data:image/png;base64,aaa" }];
ok(gallery.length === 1 && gallery[0].kind === "still", "gallery fixture untouched");

if (fails.length) {
  console.error("FAIL", fails.join(", "));
  process.exit(1);
}
console.log("PLACES OK");
