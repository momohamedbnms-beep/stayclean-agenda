var V = "stayclean-agenda-cache-v8";
var CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png"];
self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(CORE); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});
/* Réseau en priorité (toujours la dernière version en ligne), cache seulement
   en secours si hors-ligne — évite de rester bloqué sur une ancienne version
   après une mise à jour du site. */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return; /* API et fonts passent en direct */
  e.respondWith(
    fetch(e.request).then(function (res) {
      var cp = res.clone();
      caches.open(V).then(function (c) { c.put(e.request, cp); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (r) { return r || caches.match("./index.html"); });
    })
  );
});
