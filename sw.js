var V = "stayclean-agenda-cache-v35";
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
   en secours si hors-ligne.
   v35 (26/09/2026) :
   - on ne met en cache que les réponses valides (plus de page d'erreur 404/500 servie hors ligne) ;
   - une seule version par fichier : finance.js?v=… remplace l'ancienne au lieu de s'empiler ;
   - le repli sur index.html ne concerne que les pages, jamais un script (sinon erreur de syntaxe). */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return; /* API et fonts passent en direct */
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.ok && res.type === "basic") {
        var cp = res.clone();
        caches.open(V).then(function (c) {
          if (url.search && /\.(js|css)$/.test(url.pathname)) {
            c.keys().then(function (ks) {
              ks.forEach(function (k) { var u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) c.delete(k); });
            });
          }
          c.put(e.request, cp);
        });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (r) {
        if (r) return r;
        if (e.request.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504, statusText: "Hors ligne" });
      });
    })
  );
});
