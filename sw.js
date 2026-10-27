var V = "stayclean-agenda-cache-v41";
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

/* v41 (28/10/2026) — Mon Coran : « Lire et écrire l'arabe » en 10 chapitres (Étudier, M'entraîner, Examens blancs,
   Fiches PDF), examens notés par l'appli avec clavier arabe et partie orale. Même règle « réseau d'abord ». */
/* v40 (27/10/2026) — Mon Coran : onglet « Lire et écrire l'arabe » (coran/arabe.js) et fiches PDF (coran/fiches/).
   Même règle « réseau d'abord » ; les fiches ne sont mises en cache qu'une fois ouvertes. */
/* v39 (27/10/2026) — Mon Coran : voix principale Al-Luhaidan avec repères par verset (coran/data/timing/),
   suivi du texte pendant la récitation, « Je la connais à 100 % ». Même règle « réseau d'abord ». */
/* v38 (27/10/2026) — Mon Coran (coran.html + coran/) : nouvelle carte de l'accueil.
   Même règle « réseau d'abord » : le texte d'une sourate reste lisible hors ligne une fois ouvert
   (ou après « Garder le texte hors ligne » dans ses réglages). L'audio n'est jamais mis en cache ici :
   il est téléchargé sourate par sourate, à la demande, dans le stockage de Mon Coran. */
/* v37 (13/10/2026) — Mes Calories (calories.html) : nouvelle carte de l'accueil.
   Rien ne change ici : la page et ses fichiers passent par la même règle « réseau d'abord ». */
/* v36 (13/10/2026) — Ma Paperasse : rappels sur le téléphone, même appli fermée.
   La fonction Supabase « mp-push » envoie au plus un rappel par jour, à l'heure choisie.
   Texte discret par défaut (« 2 choses à faire »), sans montant ni nom. */
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (er) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Ma Paperasse", {
    body: d.body || "Ouvre Ma Paperasse pour voir quoi faire.",
    icon: "icon-192.png",
    tag: d.tag || "ma-paperasse",
    data: { url: d.url || "paperasse.html" }
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = new URL((e.notification.data && e.notification.data.url) || "paperasse.html", self.registration.scope).href;
  /* Ma Paperasse déjà ouverte : on la montre. L'agenda ouvert : on le montre et c'est lui qui décide
     (il n'ouvre Ma Paperasse que si rien n'est en cours, pour ne jamais perdre un devis). */
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    var mine = list.filter(function (c) { return c.url.indexOf(self.registration.scope) === 0; });
    var pap = mine.filter(function (c) { return c.url.indexOf("paperasse.html") !== -1; })[0];
    if (pap && "focus" in pap) return pap.focus();
    var other = mine[0];
    if (other && "focus" in other) {
      return other.focus().then(function (w) { (w || other).postMessage({ type: "mp-open" }); })
        .catch(function () { other.postMessage({ type: "mp-open" }); });
    }
    return self.clients.openWindow(url);
  }));
});
