// TRex Calc - offline cache. Bump VERSION when files change.
var VERSION = "trexcalc-v3";
var FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  // cache: "reload" skips the browser's HTTP cache so a new version is always stored fresh.
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return fetch(new Request(f, { cache: "reload" })).then(function (res) { if (res.ok) return c.put(f, res); });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  var page = e.request.mode === "navigate";
  e.respondWith(caches.open(VERSION).then(function (c) {
    var net = fetch(e.request, page ? { cache: "no-cache" } : undefined).then(function (res) {
      if (res && res.ok) c.put(page ? "./" : e.request, res.clone());
      return res;
    });
    if (page) {
      // Page: newest version when there's signal, cached copy when there isn't (or after 3 s of weak signal).
      var cached = function () { return c.match("./").then(function (hit) { return hit || c.match("index.html"); }); };
      var slow = new Promise(function (r) { setTimeout(r, 3000); }).then(cached);
      return Promise.race([net, slow.then(function (hit) { return hit || net; })]).catch(cached);
    }
    // Icons/manifest: cache first, refresh in background.
    return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
      return hit || net.catch(function () { return c.match("index.html"); });
    });
  }));
});
