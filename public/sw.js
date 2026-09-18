/* X-Ray offline shell - static assets only, never camera data.
   Network-first for HTML + app JS so broken deploys cannot stick in cache. */
const CACHE = "xray-v3.2.0";
const PRECACHE = [
  "/",
  "/index.html",
  "/assets/styles.css?v=3.2.0",
  "/assets/app/main-v302.js?v=3.2.0",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/og.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isAppShell(url) {
  if (url.pathname === "/" || url.pathname.endsWith(".html")) return true;
  if (url.pathname.startsWith("/assets/app/") && url.pathname.endsWith(".js")) return true;
  if (url.pathname === "/sw.js") return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for documents + modules (avoids sticky white-screen bugs)
  if (isAppShell(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/index.html")))
    );
    return;
  }

  // Cache-first for immutable-ish static assets
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (
          res.ok &&
          (url.pathname.startsWith("/assets/") ||
            url.pathname.endsWith(".png") ||
            url.pathname.endsWith(".jpg") ||
            url.pathname.endsWith(".webmanifest"))
        ) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
