/* Vidéos à publier (12/11/2026) — section de StayClean Agenda.
   La banque (textes, plans, calendrier) est dans videos/data.js : c'est le seul fichier à modifier pour ajouter une vidéo.
   Sur l'appareil : `vd.state.v1` (date de départ, ce qui est publié) et `vd.summary.v1` (résumé de la carte d'accueil).
   Aucune donnée ne part vers un serveur. */
(function () {
  "use strict";
  var D = window.VD_DATA, $ = function (s) { return document.querySelector(s); };
  var TX = { canape: "Canapé", tapis: "Tapis", matelas: "Matelas", voiture: "Voiture", fauteuil: "Fauteuil et chaises", tout: "Tout le salon" };
  var PF = [["tiktok", "TikTok"], ["instagram", "Instagram"], ["snapchat", "Snapchat"]];
  var ui = { tab: "jour", filtre: "tous" };
  var st = lire();

  function lire() {
    try { var s = JSON.parse(localStorage.getItem("vd.state.v1") || "{}"); return { start: s.start || null, pub: s.pub || {} }; }
    catch (e) { return { start: null, pub: {} }; }
  }
  function ecrire() {
    try { localStorage.setItem("vd.state.v1", JSON.stringify(st)); } catch (e) {}
    resume();
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function auj() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
  function plus(d, n) { var p = d.split("-"), t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return t.toISOString().slice(0, 10); }
  function ecart(a, b) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5); }
  function dateFr(d) { var p = d.split("-"); return new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function vid(id) { for (var i = 0; i < D.videos.length; i++) if (D.videos[i].id === id) return D.videos[i]; return null; }
  function pret(v) { return v.statut === "pret" && v.file; }

  /* ---- calendrier : 30 jours, 2 vidéos par jour ----
     Jours 1 à 14 : version A des 28 vidéos sans date. Jours 15 à 28 : version B (autre début, autre couverture,
     ordre des plans inversé, midi et soir échangés). Jours 29 et 30 : à choisir d'après les chiffres.
     Une vidéo datée (Black Friday, fêtes) prend la place du soir, le premier jour possible de sa période. */
  function calendrier() {
    var rot = D.videos.filter(function (v) { return !v.fenetre; }), jours = [], d, s;
    for (d = 1; d <= 30; d++) {
      var j = { n: d, date: st.start ? plus(st.start, d - 1) : null, slots: [] };
      for (s = 0; s < 2; s++) {
        var v = null, ver = "A";
        if (d <= 14) v = rot[(d - 1) * 2 + s];
        else if (d <= 28) { v = rot[(d - 15) * 2 + (1 - s)]; ver = "B"; }
        j.slots.push({ key: "J" + d + "S" + s, h: D.heures[s], v: v || null, ver: ver });
      }
      jours.push(j);
    }
    if (st.start) D.videos.filter(function (v) { return v.fenetre; }).forEach(function (v) {
      for (var i = 0; i < jours.length; i++) {
        var j = jours[i];
        if (j.date >= v.fenetre[0] && j.date <= v.fenetre[1] && !j.slots[1].date_) { j.slots[1].v = v; j.slots[1].ver = "A"; j.slots[1].date_ = true; break; }
      }
    });
    return jours;
  }
  function publie(key) { var p = st.pub[key] || {}; return PF.filter(function (x) { return p[x[0]]; }).length; }

  function resume() {
    var ok = D.videos.filter(pret).length, due = 0;
    if (st.start) {
      var n = ecart(st.start, auj()) + 1, cal = calendrier();
      if (n >= 1 && n <= 30) cal[n - 1].slots.forEach(function (s) { if (s.v && publie(s.key) < 2) due++; });
    }
    try { localStorage.setItem("vd.summary.v1", JSON.stringify({ at: Date.now(), date: auj(), pretes: ok, textes: D.videos.length, due: due, lance: !!st.start })); } catch (e) {}
  }

  /* ---- petits morceaux d'écran ---- */
  function etiquettes(v, ver) {
    return '<div class="tags"><span class="tag">' + esc(TX[v.tx]) + '</span><span class="tag f">' + v.dur + " s</span>" +
      (ver === "B" ? '<span class="tag f">Version B</span>' : "") +
      (v.fenetre ? '<span class="tag d">Datée</span>' : "") +
      (pret(v) ? '<span class="tag p">Prête à publier</span>' : '<span class="tag s">Texte prêt · images à filmer</span>') + "</div>";
  }
  function ligne(v, ver, key) {
    var c = ver === "B" ? v.coverB : v.cover, h = ver === "B" ? v.hookB : v.hook;
    return '<button class="vid" data-act="ouvrir" data-id="' + v.id + '" data-ver="' + (ver || "A") + '" data-key="' + esc(key || v.id + (ver || "A")) + '">' +
      '<span class="th">' + esc(c) + '</span><span class="bd"><span class="tt" style="display:block">' + esc(v.id + " · " + v.t) + "</span>" +
      '<span class="hk" style="display:block">« ' + esc(h) + " »</span>" + etiquettes(v, ver) + "</span></button>";
  }

  function ecranJour() {
    var ok = D.videos.filter(pret).length, h = "";
    if (!st.start || !ok) {
      h += '<div class="card note"><p class="big">Il me manque tes images.</p>' +
        "<p>Les " + D.videos.length + " textes, les voix off, les couvertures et les légendes sont écrits. " +
        "Aucune vidéo n’est encore montée : je n’ai reçu aucun rush, et je ne fabrique pas de faux chantier.</p>" +
        '<button class="btn" data-act="tab" data-tab="guide">Voir les 10 plans à filmer</button></div>';
      h += "<h2>Pour démarrer</h2>" +
        '<div class="card"><p><b>1. Filme</b> tes prochaines interventions avec la liste du Guide. Téléphone debout, 5 à 10 secondes par plan.</p>' +
        "<p><b>2. Envoie-moi les rushs</b> dans la conversation Claude. Je les classe, je monte et la vidéo passe en « Prête à publier » ici.</p>" +
        "<p><b>3. Relie TikTok et Instagram</b> une seule fois : ensuite je prépare les publications, tu valides.</p></div>";
      h += "<h2>Les deux premières prévues</h2>" + ligne(D.videos[0], "A", "J1S0") + ligne(D.videos[1], "A", "J1S1");
      return h;
    }
    var n = ecart(st.start, auj()) + 1, cal = calendrier();
    if (n < 1) return '<div class="card"><p class="big">Départ le ' + esc(dateFr(st.start)) + ".</p><p class=\"muted\">Les deux premières vidéos apparaîtront ici ce jour-là.</p></div>";
    if (n > 30) return '<div class="card"><p class="big">Les 30 jours sont terminés.</p><p>On regarde les chiffres et on prépare le mois suivant.</p></div>';
    var j = cal[n - 1];
    h += "<h2>Jour " + n + " sur 30 · " + esc(dateFr(j.date)) + "</h2>";
    j.slots.forEach(function (s) {
      if (!s.v) { h += '<div class="card"><p><b>' + s.h + "</b> · à choisir d’après les chiffres des 4 premières semaines.</p></div>"; return; }
      h += '<p class="muted" style="margin:10px 4px 4px">' + s.h + (publie(s.key) ? " · publiée sur " + publie(s.key) + " réseau" + (publie(s.key) > 1 ? "x" : "") : "") + "</p>" + ligne(s.v, s.ver, s.key);
    });
    return h;
  }

  function ecranBanque() {
    var f = ui.filtre, liste = D.videos.filter(function (v) { return f === "tous" || (f === "pret" ? pret(v) : v.tx === f); });
    var h = '<div class="chips">' + [["tous", "Toutes (" + D.videos.length + ")"], ["pret", "Prêtes (" + D.videos.filter(pret).length + ")"]]
      .concat(Object.keys(TX).map(function (k) { return [k, TX[k]]; }))
      .map(function (c) { return '<button class="chip' + (f === c[0] ? " on" : "") + '" data-act="filtre" data-f="' + c[0] + '">' + esc(c[1]) + "</button>"; }).join("") + "</div>";
    h += liste.length ? liste.map(function (v) { return ligne(v, "A"); }).join("") : '<div class="card"><p class="muted">Rien ici pour l’instant.</p></div>';
    h += '<p class="muted" style="margin:14px 4px">Chaque vidéo existe en version A et en version B (autre début, autre couverture, ordre des plans inversé) : ' + (D.videos.length * 2) + " publications possibles.</p>";
    return h;
  }

  function ecranCal() {
    var cal = calendrier(), t = auj();
    var h = '<div class="card"><p class="kv">Premier jour de publication</p>' +
      '<input type="date" id="dStart" value="' + esc(st.start || "") + '" min="' + t + '" style="width:100%;min-height:46px;border:1px solid var(--bord);border-radius:12px;padding:0 12px;font:inherit;background:#fff">' +
      '<p class="muted" style="margin-top:8px">' + (st.start ? "Publications à " + D.heures.join(" et à ") + ", heure de Bruxelles." : "Choisis la date quand les premières vidéos sont montées. D’ici là, le calendrier reste en « Jour 1, Jour 2… ».") + "</p></div>";
    cal.forEach(function (j) {
      h += '<div class="day' + (j.date === t ? " auj" : "") + '"><div class="dh">Jour ' + j.n + "<span>" + (j.date ? esc(dateFr(j.date)) : "") + "</span></div>";
      j.slots.forEach(function (s) {
        if (!s.v) { h += '<div class="slot"><span class="h">' + s.h + '</span><span class="n" style="color:var(--gris)">À choisir d’après les chiffres</span></div>'; return; }
        h += '<button class="slot" data-act="ouvrir" data-id="' + s.v.id + '" data-ver="' + s.ver + '" data-key="' + s.key + '"><span class="h">' + s.h + '</span><span class="n">' +
          esc(s.v.t) + '</span><span class="x">' + esc(TX[s.v.tx]) + (s.ver === "B" ? " · B" : "") + (publie(s.key) ? " · ✓" : "") + "</span></button>";
      });
      h += "</div>";
    });
    return h;
  }

  function ecranGuide() {
    var h = "<h2>À filmer pendant tes interventions</h2><div class=\"card\"><p class=\"muted\">Téléphone debout, lumière du jour, 5 à 10 secondes par plan, sans parler. Trois plans suffisent pour une vidéo.</p><table class=\"t\">";
    Object.keys(D.plans).forEach(function (k) { h += "<tr><td>" + esc(D.plans[k][0]) + "</td><td>" + esc(D.plans[k][1]) + "</td></tr>"; });
    h += "</table></div>";
    h += "<h2>Les 15 formats, par priorité</h2><div class=\"card\"><ul class=\"l\">";
    D.formats.forEach(function (f, i) {
      h += "<li><b>" + (i + 1) + ". " + esc(f[0]) + "</b><br>" + esc(f[1]) + '<br><span class="sc">Vues <b>' + f[2] + '/5</b></span><span class="sc">Local <b>' + f[3] + '/5</b></span><span class="sc">Clics site <b>' + f[4] + "/5</b></span></li>";
    });
    h += "</ul><p class=\"muted\">Notes données d’après la veille ci-dessous. Ce sont des paris à vérifier avec tes propres chiffres.</p></div>";
    h += "<h2>Ce que font les sociétés du métier</h2>";
    D.veille.forEach(function (v) {
      h += '<div class="card"><p class="big">' + esc(v[0]) + "</p>" + (v[1] ? '<p class="muted">' + esc(v[1]) + "</p>" : "") + "<p>" + esc(v[2]) + "</p>" +
        (v[3] ? "<p><b>Pourquoi ça marche :</b> " + esc(v[3]) + "</p>" : "") + "<p><b>Pour toi :</b> " + esc(v[4]) + "</p>" + (v[5] ? '<p class="muted">Plan nécessaire : ' + esc(v[5]) + "</p>" : "") + "</div>";
    });
    h += "<h2>Ce qu’on a le droit de dire</h2><div class=\"card\"><table class=\"t\">" + D.reperes.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") +
      "</table><p class=\"muted\" style=\"margin-top:8px\">Relevé sur stayclean.be le " + esc(D.maj.split("-").reverse().join("/")) + ".</p></div>";
    h += "<h2>Le style des vidéos</h2><div class=\"card\"><table class=\"t\">" + D.da.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + "</td></tr>"; }).join("") + "</table></div>";
    h += "<h2>À ne pas faire</h2><div class=\"card\"><ul class=\"l\">" + D.eviter.map(function (e) { return "<li>" + esc(e) + "</li>"; }).join("") + "</ul></div>";
    h += "<h2>Les 20 appels à réserver</h2><div class=\"card\"><ul class=\"l\">" + D.cta.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul></div>";
    return h;
  }

  /* ---- fiche d'une vidéo ---- */
  function legende(v, pf) {
    var t = v.leg + "\n" + D.cta[v.c];
    if (pf === "snapchat") return t;
    var H = D.hashtags[pf];
    return t + "\n\n" + H.base + " " + (H[v.tx] || "");
  }
  function bloc(k, corps, copie) {
    return '<div class="card"><p class="kv">' + k + "</p>" + corps + (copie ? '<button class="cp" data-act="copier" data-txt="' + esc(copie) + '">Copier</button>' : "") + "</div>";
  }
  function fiche(id, ver, key) {
    var v = vid(id); if (!v) return;
    var B = ver === "B", hook = B ? v.hookB : v.hook, cover = B ? v.coverB : v.cover, plans = B ? v.plans.slice().reverse() : v.plans, p = st.pub[key] || {};
    var h = '<div class="in" role="dialog" aria-modal="true" aria-label="' + esc(v.t) + '"><div class="hd"><div><h3>' + esc(v.t) + "</h3>" + etiquettes(v, ver) + '</div><button class="x" data-act="fermer" aria-label="Fermer">✕</button></div>';
    if (pret(v)) h += '<div class="card"><video src="' + esc(v.file) + '" controls playsinline preload="metadata" style="width:100%;border-radius:12px;background:#000;max-height:60vh"></video>' +
      '<a class="btn" href="' + esc(v.file) + '" download>Télécharger la vidéo</a></div>';
    else h += '<div class="card note"><p><b>Pas encore montée.</b> Il me faut ces plans : ' + esc(v.plans.filter(function (x, i, a) { return a.indexOf(x) === i; }).map(function (x) { return D.plans[x][0].toLowerCase(); }).join(", ")) + ".</p></div>";
    if (B) h += '<div class="card"><p class="muted">Version B : on commence par le résultat, le début et la couverture changent, les plans sont dans l’ordre inverse.</p></div>';
    if (v.fenetre) h += '<div class="card note"><p><b>À publier seulement du ' + esc(v.fenetre[0].split("-").reverse().join("/")) + " au " + esc(v.fenetre[1].split("-").reverse().join("/")) + ".</b></p></div>";
    h += bloc("Première phrase à l’écran", '<p class="big">« ' + esc(hook) + " »</p>");
    h += bloc("Voix off", v.vo ? '<p class="txt">' + esc(v.vo) + "</p>" : '<p class="muted">Pas de voix : ' + esc(v.son.toLowerCase()) + ".</p>", v.vo);
    h += bloc("Textes à l’écran", '<div class="ecr">' + (B ? [hook].concat(v.ecran.slice(1)) : v.ecran).map(function (e) { return "<span>" + esc(e) + "</span>"; }).join("") + "</div>");
    h += bloc("Plans, dans l’ordre", '<ol class="pl">' + plans.map(function (x) { return "<li><b>" + esc(D.plans[x][0]) + "</b></li>"; }).join("") + "<li><b>Carte de fin</b> · logo, stayclean.be, « " + esc(D.cta[v.c]) + " »</li></ol>" +
      '<p class="muted" style="margin-top:8px">Son : ' + esc(v.son) + ".</p>");
    h += bloc("Couverture", '<p class="big">' + esc(cover) + "</p>");
    PF.forEach(function (x) { h += bloc("Légende " + x[1], '<p class="txt">' + esc(legende(v, x[0])) + "</p>", legende(v, x[0])); });
    h += bloc("Pourquoi cette vidéo", "<p>" + esc(v.hyp) + '</p><p class="muted">But : ' + esc({ vues: "des vues", clics: "des clics vers le site", preuve: "montrer le résultat", confiance: "donner confiance" }[v.obj]) + " · angle : " + esc(v.angle.toLowerCase()) + " · coût prévu : moins de 0,30 €.</p>");
    h += '<div class="card"><p class="kv">Publiée sur</p><div class="pub">' + PF.map(function (x) {
      return '<button data-act="pub" data-key="' + esc(key) + '" data-pf="' + x[0] + '" data-id="' + v.id + '" data-ver="' + ver + '" class="' + (p[x[0]] ? "on" : "") + '" aria-pressed="' + (p[x[0]] ? "true" : "false") + '">' + (p[x[0]] ? "✓ " : "") + x[1] + "</button>";
    }).join("") + "</div></div></div>";
    var s = $("#sheet"); s.innerHTML = h; s.hidden = false; document.body.style.overflow = "hidden";
  }
  function fermer() { var s = $("#sheet"); s.hidden = true; s.innerHTML = ""; document.body.style.overflow = ""; }

  var tt;
  function toast(m) { var t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(tt); tt = setTimeout(function () { t.hidden = true; }, 1800); }

  function rendre() {
    var ok = D.videos.filter(pret).length;
    $("#sub").textContent = "2 par jour · TikTok, Instagram, Snapchat · " + ok + " prête" + (ok > 1 ? "s" : "") + ", " + D.videos.length + " textes écrits";
    $("#app").innerHTML = { jour: ecranJour, banque: ecranBanque, cal: ecranCal, guide: ecranGuide }[ui.tab]();
    [].forEach.call(document.querySelectorAll(".nav button"), function (b) { var on = b.dataset.tab === ui.tab; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) { if (e.target.id === "sheet") fermer(); return; }
    switch (b.dataset.act) {
      case "tab": ui.tab = b.dataset.tab; rendre(); window.scrollTo(0, 0); break;
      case "filtre": ui.filtre = b.dataset.f; rendre(); break;
      case "ouvrir": fiche(b.dataset.id, b.dataset.ver || "A", b.dataset.key); break;
      case "fermer": fermer(); break;
      case "copier":
        (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.txt) : Promise.reject()).then(function () { toast("Copié"); }, function () { toast("Copie impossible sur cet appareil"); });
        break;
      case "pub": {
        var k = b.dataset.key, p = st.pub[k] || (st.pub[k] = {});
        if (p[b.dataset.pf]) delete p[b.dataset.pf]; else p[b.dataset.pf] = auj();
        ecrire(); fiche(b.dataset.id, b.dataset.ver, k); rendre(); break;
      }
      case "home": {
        var from = false; try { from = sessionStorage.getItem("vd.from") === "agenda"; sessionStorage.removeItem("vd.from"); } catch (er) {}
        if (from && history.length > 1) history.back(); else location.href = "./";
        break;
      }
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "dStart") { st.start = e.target.value || null; ecrire(); rendre(); toast(st.start ? "Départ enregistré" : "Date retirée"); }
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#sheet").hidden) fermer(); });

  resume(); rendre();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
})();
