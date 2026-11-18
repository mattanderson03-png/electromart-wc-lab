// sw.js — service worker that lets the app install and work offline.
// Network first: always try for the newest file, so each merged change shows up.
// If the network fails (offline), fall back to the copy saved in the cache.

const CACHE = "electromart-ccc-v1";

// Relative paths, because the site lives at /<repository>/, not the domain root.
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "ccc.js",
  "app.js",
  "manifest.webmanifest",
  "data/electromart.csv",
  "data/assumptions.csv",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
                             .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  // Only handle this site's own GET requests.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === "navigate" ? caches.match("index.html") : undefined);
      });
    })
  );
});
