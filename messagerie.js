/* messagerie.js — onglet « Messages » de l'app StayClean (6 octobre 2026)
   - Conversations WhatsApp du 0497 (Chatwoot + IA) en temps réel : ce que le client écrit,
     ce que l'IA répond, les alertes (réclamation, réservation…).
   - Répondre depuis l'app (fenêtre WhatsApp de 24 h) : l'IA se met alors en pause pour ce client.
   - « Rendre à l'IA », « Reprendre la main », « Terminer ».
   - « À relancer » : messages préparés, bouton qui ouvre WhatsApp sur le bon client avec le
     texte déjà écrit ; la relance se coche toute seule quand le message part du 0497.
   Données : sc_wa_conversations, sc_wa_messages, sc_relances (Supabase, temps réel).
   Écritures sensibles : fonction serveur « messagerie ». Aucune dépendance au reste de l'app
   sauf getSb(), session, DB.bookings, toast() — tous optionnels. */
(function () {
  "use strict";

  var BOITE_WA = 143967;
  var RAPIDES = [
    ["Photo", "Bonjour, pour obtenir un devis précis, il faudra juste nous envoyer une photo de l’élément à nettoyer ainsi que votre code postal📍"],
    ["Mes dispos", "Mes dispos en direct 👇 https://stayclean.be/reservation/ Choisissez votre créneau, ça me revient automatiquement ✅"],
    ["Commune ?", "Vous êtes situé sur quelle commune ?"],
    ["Adresse ?", "J’aurais juste besoin de l’adresse précise"],
    ["Canapé 2-3 pl.", "Formule Basique : 89€ 🌿\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n\nFormule Premium : 109€ 🏆\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n✅ Désinfection vapeur pour éliminer acariens, bactéries et allergènes 🦠\n✅ Neutralisation des mauvaises odeurs (dans la limite du possible)\n\n📍 Intervention à domicile\n⏳ Durée estimée : 1h à 1h30\nBien à vous, L’équipe StayClean 🚿✨"],
    ["Canapé 4-5 pl.", "Formule Basique : 99€ 🌿\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n\nFormule Premium : 119€ 🏆\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n✅ Désinfection vapeur pour éliminer acariens, bactéries et allergènes 🦠\n✅ Neutralisation des mauvaises odeurs (dans la limite du possible)\n\n📍 Intervention à domicile\n⏳ Durée estimée : 1h à 1h30\nBien à vous, L’équipe StayClean 🚿✨"],
    ["Canapé 6-7 pl.", "Formule Basique : 119€ 🌿\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n\nFormule Premium : 139€ 🏆\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n✅ Désinfection vapeur pour éliminer acariens, bactéries et allergènes 🦠\n✅ Neutralisation des mauvaises odeurs (dans la limite du possible)\n\n📍 Intervention à domicile\n⏳ Durée estimée : 1h à 2h\nBien à vous, L’équipe StayClean 🚿✨"],
    ["Canapé 8-9 pl.", "Formule Basique : 139€ 🌿\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n\nFormule Premium : 159€ 🏆\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n✅ Désinfection vapeur pour éliminer acariens, bactéries et allergènes 🦠\n✅ Neutralisation des mauvaises odeurs (dans la limite du possible)\n\n📍 Intervention à domicile\n⏳ Durée estimée : 1h à 2h\nBien à vous, L’équipe StayClean 🚿✨"],
    ["Confirmation", "Bonjour, afin de prendre la route nous avons juste besoin de votre confirmation pour le nettoyage d’aujourd’hui. Bien à vous, StayClean."],
    ["En route", "Bonjour, c’est pour vous prévenir que je suis en route. Je serai là d’ici 20 à 30 minutes."],
    ["Paiement", "Bonjour 👋, Juste petite précision : le paiement se fait en espèce 💶 (virement instantané possible aussi). Bien à vous, StayClean."],
    ["Annulation", "Bonjour 👋, C’est bien noté pour l’annulation, pas de souci. Quand vous voulez reprogrammer, vous pouvez choisir un nouveau créneau ici 👇 https://stayclean.be/reservation/ Bien à vous, StayClean."],
    ["Suivi", "Bonsoir 👋, Je reviens vers vous pour avoir un retour sur le canapé dès qu’il sera sec, pour savoir si le nettoyage a été efficace de notre côté. Bien à vous, StayClean."],
    ["Avis Google", "Bonjour {prenom} 😊 Merci pour votre confiance ! Si vous êtes satisfait du nettoyage StayClean, un petit avis Google nous aiderait énormément : https://maps.app.goo.gl/cXQTj98sb4RjMoYK7?g_st=ic — À très bientôt, l’équipe StayClean 🚿✨"],
    ["Excuse attente", "Bonjour, excusez-nous pour l’attente, nous avons eu beaucoup de demandes de devis. J’aimerais savoir si vous êtes toujours intéressé pour obtenir un devis ? Bien à vous, StayClean"],
    ["Relance", "Juste par curiosité, c’est quelque chose que vous envisagez bientôt ou c’était plutôt pour avoir une idée de prix ? 😊"]
  ];
  var PRIO = {
    aujourdhui: ["Aujourd'hui", "RDV de demain, clients oubliés ou mécontents, reports qui attendent une date."],
    verifier: ["À vérifier", "Le contexte manque ou contredit l'agenda : relis la conversation d'abord."],
    devis: ["Devis sans réponse", "Du plus récent au plus ancien."],
    agenda: ["Agenda à corriger", "Surtout des statuts à remettre d'aplomb dans l'agenda."]
  };

  var S = {
    pret: false, erreur: null, charge: false,
    convs: [], relances: [], msgs: {},
    vue: lire("scm-vue", "liste"),          // liste | relances | id de conversation
    filtreRel: lire("scm-filtre", "aujourdhui"),
    masquerFaits: lire("scm-masquer", false),
    voirTerminees: false,
    brouillons: {}, envoi: false, piedPour: null,
    canal: null, tests: lire("scm-tests", false)
  };
  if (typeof S.vue === "number" || /^\d+$/.test(String(S.vue))) S.vue = "liste";

  /* ------------------------------------------------------------ utilitaires */
  function lire(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function ecrire(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function sb() { try { return typeof window.getSb === "function" ? window.getSb() : null; } catch (e) { return null; } }
  function connecte() { try { return !!(sb() && window.session); } catch (e) { return false; } }
  function ok(m) { if (typeof window.toast === "function") window.toast("ok", [m]); }
  function ko(m) { if (typeof window.toast === "function") window.toast("err", [m]); else alert(m); }
  function chiffres(t) { return String(t || "").replace(/\D/g, ""); }
  function telLisible(t) {
    var d = chiffres(t);
    if (/^32\d{9}$/.test(d)) return "0" + d.slice(2, 5) + " " + d.slice(5, 7) + " " + d.slice(7, 9) + " " + d.slice(9);
    if (/^32\d{8}$/.test(d)) return "0" + d.slice(2, 4) + " " + d.slice(4, 7) + " " + d.slice(7, 9) + " " + d.slice(9);
    if (/^33\d{9}$/.test(d)) return "+33 " + d.slice(2, 3) + " " + d.slice(3, 5) + " " + d.slice(5, 7) + " " + d.slice(7, 9) + " " + d.slice(9);
    return t ? String(t) : "";
  }
  function waLien(numero, texte) {
    var d = chiffres(numero);
    return "whatsapp://send?phone=" + d + (texte ? "&text=" + encodeURIComponent(texte) : "");
  }
  function waWeb(numero, texte) {
    return "https://wa.me/" + chiffres(numero) + (texte ? "?text=" + encodeURIComponent(texte) : "");
  }
  var JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  var JOURS_L = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  var MOIS_L = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  function d2(n) { return (n < 10 ? "0" : "") + n; }
  function hm(d) { return d2(d.getHours()) + ":" + d2(d.getMinutes()); }
  function memeJour(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function quandCourt(iso) {
    if (!iso) return "";
    var d = new Date(iso), n = new Date(), h = new Date(n.getTime() - 864e5);
    if (memeJour(d, n)) return hm(d);
    if (memeJour(d, h)) return "hier";
    if (n - d < 6 * 864e5) return JOURS[d.getDay()];
    return d2(d.getDate()) + "/" + d2(d.getMonth() + 1);
  }
  function jourLong(d) {
    var n = new Date(), h = new Date(n.getTime() - 864e5);
    if (memeJour(d, n)) return "Aujourd'hui";
    if (memeJour(d, h)) return "Hier";
    return JOURS_L[d.getDay()] + " " + d.getDate() + " " + MOIS_L[d.getMonth()];
  }
  function initiales(nom, tel) {
    var n = String(nom || "").trim();
    if (!n || /^\+?\d/.test(n)) return "#";
    var p = n.split(/\s+/);
    return (p[0][0] + (p[1] ? p[1][0] : (p[0][1] || ""))).toUpperCase();
  }
  function nomDe(c) { var n = String(c && c.nom || "").trim(); return n && !/^\+?\d[\d\s]+$/.test(n) ? n : telLisible(c && c.tel) || "Client"; }
  function prenomDe(c) { var n = nomDe(c); return /^\d/.test(n) ? "" : n.split(/\s+/)[0]; }
  function copier(t) {
    function repli() {
      var ta = document.createElement("textarea");
      ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.top = "0"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length);
      var reussi = false; try { reussi = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      if (reussi) ok("Copié"); else ko("Copie impossible : sélectionne le texte à la main.");
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { ok("Copié"); }, repli);
      else repli();
    } catch (e) { repli(); }
  }
  function marque(s) { return esc(s).replace(/\[[^\]]+\]/g, function (m) { return "<mark>" + m + "</mark>"; }); }
  function liens(s) { return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }

  /* ------------------------------------------------------------ données */
  function visibles() {
    return S.convs.filter(function (c) { return S.tests || Number(c.inbox_id) === BOITE_WA || c.inbox_id == null; });
  }
  function conv(id) { id = Number(id); for (var i = 0; i < S.convs.length; i++) if (Number(S.convs[i].id) === id) return S.convs[i]; return null; }
  function estConv() { return /^\d+$/.test(String(S.vue)); }
  function attendToi(c) { return c.statut === "open" && (c.dernier_auteur === "client" || c.priorite === "urgent"); }
  function aTraiter() { return visibles().filter(attendToi).length; }
  function trierConvs() {
    S.convs.sort(function (a, b) { return String(b.dernier_le || b.maj || "").localeCompare(String(a.dernier_le || a.maj || "")); });
  }
  function majConv(row) {
    if (!row || row.id == null) return;
    var c = conv(row.id);
    if (c) { for (var k in row) if (Object.prototype.hasOwnProperty.call(row, k)) c[k] = row[k]; }
    else S.convs.push(row);
    trierConvs();
    if (estConv() && Number(S.vue) === Number(row.id) && (conv(row.id).non_lus || 0) > 0 && document.visibilityState === "visible" && $("scm-root")) marquerLu(row.id);
  }
  function majMsg(row) {
    if (!row || row.id == null) return;
    var l = S.msgs[row.conv_id];
    if (!l) return; // conversation pas encore ouverte : elle se chargera à l'ouverture
    var t = null;
    for (var i = 0; i < l.length; i++) if (Number(l[i].id) === Number(row.id)) { t = l[i]; break; }
    if (t) { for (var k in row) if (Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined) t[k] = row[k]; }
    else l.push(row);
    l.sort(function (a, b) { return String(a.cree_le).localeCompare(String(b.cree_le)) || (Number(a.id) - Number(b.id)); });
  }
  function majRel(row) {
    if (!row || row.id == null) return;
    for (var i = 0; i < S.relances.length; i++) if (S.relances[i].id === row.id) { S.relances[i] = row; return; }
    S.relances.push(row);
  }
  function rdvDe(c) {
    try {
      var d = chiffres(c && c.tel).slice(-9);
      if (!d || !window.DB || !window.DB.bookings) return null;
      var auj = new Date(); var a = auj.getFullYear() + "-" + d2(auj.getMonth() + 1) + "-" + d2(auj.getDate());
      var l = window.DB.bookings.filter(function (b) {
        return chiffres(b.telephone).slice(-9) === d && String(b.date) >= a && !/annul/i.test(String(b.statut || ""));
      }).sort(function (x, y) { return (String(x.date) + String(x.heure || "")).localeCompare(String(y.date) + String(y.heure || "")); });
      return l[0] || null;
    } catch (e) { return null; }
  }

  function charger() {
    var c = sb(); if (!c) return;
    S.charge = true;
    Promise.all([
      c.from("sc_wa_conversations").select("*").order("dernier_le", { ascending: false, nullsFirst: false }).limit(300),
      c.from("sc_relances").select("*").order("ordre", { ascending: true }).limit(500)
    ]).then(function (r) {
      S.charge = false;
      var err = r[0].error || r[1].error;
      if (err) { S.erreur = err.message || String(err); dessiner(); return; }
      S.erreur = null; S.pret = true;
      S.convs = r[0].data || []; trierConvs();
      S.relances = r[1].data || [];
      if (estConv()) chargerFil(S.vue); else dessiner();
    }).catch(function (e) { S.charge = false; S.erreur = String(e && e.message || e); dessiner(); });
  }
  function chargerFil(id) {
    var c = sb(); if (!c) return;
    c.from("sc_wa_messages").select("*").eq("conv_id", Number(id)).order("cree_le", { ascending: true }).limit(400)
      .then(function (r) {
        if (r.error) { ko("Messages non chargés : " + r.error.message); return; }
        S.msgs[id] = r.data || [];
        if (String(S.vue) === String(id)) { dessiner(); basDePage(); }
      });
  }
  function abonner() {
    var c = sb(); if (!c || S.canal) return;
    try {
      S.canal = c.channel("scm-messagerie")
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_wa_conversations" }, function (p) { majConv(p.new); dessiner(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_wa_messages" }, function (p) {
          var bas = presDuBas(); majMsg(p.new); dessiner(); if (bas && estConv() && Number(S.vue) === Number(p.new && p.new.conv_id)) basDePage();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_relances" }, function (p) { majRel(p.new); dessiner(); })
        .subscribe();
    } catch (e) { S.canal = null; }
  }
  function marquerLu(id) {
    var c = sb(), x = conv(id); if (!c || !x) return;
    x.non_lus = 0;
    c.from("sc_wa_conversations").update({ non_lus: 0, lu_le: new Date().toISOString() }).eq("id", Number(id)).then(function () {});
  }
  function appel(corps) {
    var c = sb(); if (!c) return Promise.resolve({ ok: false, erreur: "Pas connecté : ouvre l'app avec ton compte." });
    return c.functions.invoke("messagerie", { body: corps }).then(function (res) {
      if (res.error) {
        var ctx = res.error.context;
        if (ctx && typeof ctx.json === "function") return ctx.json().catch(function () { return { ok: false, erreur: res.error.message }; });
        return { ok: false, erreur: res.error.message || "erreur réseau" };
      }
      return res.data || { ok: false, erreur: "réponse vide" };
    }).catch(function (e) { return { ok: false, erreur: String(e && e.message || e) }; });
  }

  /* ------------------------------------------------------------ actions */
  function ouvrir(id) {
    S.vue = Number(id); S.piedPour = null;
    var x = conv(id); if (x && (x.non_lus || 0) > 0) marquerLu(id);
    if (!S.msgs[id]) chargerFil(id);
    dessiner(); basDePage();
    appel({ action: "rafraichir", conv: Number(id) }).then(function (r) { if (r && r.ok && r.conversation) { majConv(r.conversation); dessiner(); } });
  }
  function envoyer() {
    var id = Number(S.vue), ta = $("scm-txt"); if (!ta || S.envoi) return;
    var t = ta.value.trim(); if (!t) { ta.focus(); return; }
    S.envoi = true; etatEnvoi();
    appel({ action: "envoyer", conv: id, texte: t }).then(function (r) {
      S.envoi = false;
      if (r && r.ok) {
        S.brouillons[id] = ""; var t2 = $("scm-txt"); if (t2) { t2.value = ""; hauteur(t2); }
        if (r.message) { if (!S.msgs[id]) S.msgs[id] = []; majMsg(r.message); }
        if (r.conversation) majConv(r.conversation);
        dessiner(); basDePage();
      } else {
        ko((r && r.erreur) || "Envoi impossible.");
        if (r && r.raison === "fenetre") { majConv({ id: id, peut_repondre: false }); dessiner(); }
      }
      etatEnvoi();
    });
  }
  function basculer(action, extra, message) {
    var id = Number(S.vue);
    var corps = { action: action, conv: id }; for (var k in extra) corps[k] = extra[k];
    appel(corps).then(function (r) {
      if (r && r.ok) { if (r.conversation) majConv(r.conversation); dessiner(); ok(message); }
      else ko((r && r.erreur) || "Action impossible.");
    });
  }
  function cocherRelance(id) {
    var r = null; for (var i = 0; i < S.relances.length; i++) if (S.relances[i].id === id) r = S.relances[i];
    var c = sb(); if (!r || !c) return;
    var fait = r.statut !== "fait", ancien = { statut: r.statut, envoye_le: r.envoye_le, envoye_par: r.envoye_par };
    r.statut = fait ? "fait" : "a_faire"; r.envoye_le = fait ? new Date().toISOString() : null; r.envoye_par = fait ? "app" : null;
    dessiner();
    c.from("sc_relances").update({ statut: r.statut, envoye_le: r.envoye_le, envoye_par: r.envoye_par, maj: new Date().toISOString() }).eq("id", id)
      .then(function (x) { if (x.error) { r.statut = ancien.statut; r.envoye_le = ancien.envoye_le; r.envoye_par = ancien.envoye_par; dessiner(); ko("Pas enregistré : " + x.error.message); } });
  }

  /* ------------------------------------------------------------ rendu */
  function presDuBas() { var d = document.documentElement; return window.innerHeight + (window.scrollY || d.scrollTop) >= d.scrollHeight - 160; }
  function basDePage() { setTimeout(function () { var d = document.documentElement; window.scrollTo(0, d.scrollHeight); }, 30); }
  function hauteur(ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 168) + "px"; }
  // Le bouton « + » de l'app recouvrirait la zone de réponse : masqué tant que l'onglet est affiché
  var observe = false;
  function cacherFab() {
    document.body.classList.add("scm-actif");
    if (observe) return;
    var main = $("main"); if (!main || !window.MutationObserver) return;
    observe = true;
    new MutationObserver(function () { document.body.classList.toggle("scm-actif", !!$("scm-root")); })
      .observe(main, { childList: true });
  }

  function majBadge() {
    var n = aTraiter();
    var b = document.querySelector('[data-act="tab"][data-tab="messages"]');
    if (!b) return;
    var i = b.querySelector("i.navdot");
    if (n && !i) { b.insertAdjacentHTML("beforeend", '<i class="navdot">' + n + "</i>"); }
    else if (n && i) i.textContent = String(n);
    else if (!n && i) i.parentNode.removeChild(i);
  }

  function render(main) {
    injecterStyle();
    cacherFab();
    var root = $("scm-root");
    if (!root || !main.contains(root)) {
      main.innerHTML = '<div id="scm-root" class="scm"><div id="scm-haut"></div><div id="scm-corps"></div><div id="scm-pied"></div></div>';
      S.piedPour = null;
    }
    if (!S.pret && !S.charge && connecte()) { charger(); abonner(); }
    dessiner();
  }

  function dessiner() {
    majBadge();
    var haut = $("scm-haut"), corps = $("scm-corps"), pied = $("scm-pied");
    if (!haut || !corps || !pied) return;
    if (estConv() && !conv(S.vue) && S.pret) { S.vue = "liste"; S.piedPour = null; }
    if (!estConv()) ecrire("scm-vue", S.vue);
    haut.innerHTML = htmlHaut();
    corps.innerHTML = htmlCorps();
    var x = estConv() ? conv(S.vue) : null;
    var cle = x ? String(x.id) + "|" + (x.peut_repondre === false ? "fermee" : "ouverte") : "";
    if (S.piedPour !== cle) {
      pied.innerHTML = x ? htmlPied(x) : "";
      S.piedPour = cle;
      var ta = $("scm-txt");
      if (ta) { ta.value = S.brouillons[x.id] || ""; hauteur(ta); majLienFerme(); }
    }
    if (x) { var info = $("scm-info"); if (info) info.style.display = x.statut === "pending" || !x.statut ? "" : "none"; }
    etatEnvoi();
  }

  function htmlOnglets() {
    var n = aTraiter(), r = S.relances.filter(function (x) { return x.statut !== "fait" && x.reponse; }).length;
    return '<div class="scm-seg">' +
      '<button data-scm="vue" data-v="liste" class="' + (S.vue === "liste" ? "on" : "") + '">💬 Conversations' + (n ? ' <i class="navdot">' + n + "</i>" : "") + "</button>" +
      '<button data-scm="vue" data-v="relances" class="' + (S.vue === "relances" ? "on" : "") + '">📤 À relancer' + (r ? ' <span class="cnt">' + r + "</span>" : "") + "</button></div>";
  }

  function htmlHaut() {
    if (estConv() && connecte() && S.pret && conv(S.vue)) return "";
    return htmlOnglets();
  }

  function htmlEnteteFil(c) {
    var etat = c.statut === "resolved" ? '<span class="scm-etat fin">Terminée</span>'
      : c.statut === "open" ? '<span class="scm-etat toi">✋ Tu as la main</span>'
      : '<span class="scm-etat ia">🤖 L\'IA répond</span>';
    var actions = "";
    if (c.statut === "open") actions += '<button data-scm="ia-on" class="scm-a bleu">🤖 Rendre à l\'IA</button>';
    else if (c.statut !== "resolved") actions += '<button data-scm="ia-off" class="scm-a">✋ Reprendre la main</button>';
    else actions += '<button data-scm="ia-on" class="scm-a">🤖 Rouvrir avec l\'IA</button>';
    if (c.statut !== "resolved") actions += '<button data-scm="terminer" class="scm-a">✓ Terminer</button>';
    if (c.tel && !/^\+000/.test(c.tel)) actions += '<a class="scm-a vert" href="' + esc(waLien(c.tel, "")) + '">WhatsApp</a>';
    var h = '<div class="scm-th"><button data-scm="retour" class="scm-back" aria-label="Retour">‹</button>' +
      '<div class="scm-who"><b>' + esc(nomDe(c)) + "</b>" +
      (c.tel && !/^\+000/.test(c.tel) ? '<button data-scm="copier" data-t="' + esc(chiffres(c.tel).replace(/^32/, "0")) + '">' + esc(telLisible(c.tel)) + "</button>" : '<small>Chat du site (test)</small>') +
      "</div>" + etat + "</div>" +
      '<div class="scm-acts">' + actions + "</div>";
    var tags = (c.etiquettes || []);
    if (c.priorite === "urgent" || tags.indexOf("reclamation") >= 0) {
      h += '<div class="scm-ban rouge">⚠️ ' + esc(c.alerte ? c.alerte.replace(/^⚠️\s*/, "") : "Client à rassurer : réponds-lui toi-même.") + "</div>";
    } else if (tags.indexOf("reservation") >= 0 && c.alerte && /^✅/.test(c.alerte)) {
      h += '<div class="scm-ban vert">' + esc(c.alerte) + ' <button data-scm="aller-demandes">Voir les demandes →</button></div>';
    }
    var b = rdvDe(c);
    if (b) {
      var d = new Date(b.date + "T12:00:00");
      h += '<div class="scm-rdv">📅 Prochain RDV : <b>' + esc(JOURS[d.getDay()] + " " + d.getDate() + " " + MOIS_L[d.getMonth()].slice(0, 4) + ".") +
        (b.heure ? " · " + esc(b.heure) : "") + "</b>" + (b.adresse ? " · " + esc(b.adresse) : "") + "</div>";
    }
    return h;
  }

  function htmlCorps() {
    if (!connecte()) return '<div class="scm-vide">Connecte-toi (Réglages → Synchronisation) pour voir tes messages WhatsApp ici.</div>';
    if (S.erreur) return '<div class="scm-vide">Messages indisponibles : ' + esc(S.erreur) + '<br><button data-scm="recharger" class="scm-a">Réessayer</button></div>';
    if (!S.pret) return '<div class="scm-vide">Chargement des conversations…</div>';
    if (S.vue === "relances") return htmlRelances();
    if (estConv()) { var cc = conv(S.vue); return cc ? htmlEnteteFil(cc) + htmlFil(cc) : htmlListe(); }
    return htmlListe();
  }

  /* ---------- liste des conversations */
  function htmlListe() {
    var l = visibles();
    var h = '<p class="note">L\'IA répond seule à tes clients sur le 0497. Ici tu vois tout, et tu peux reprendre la main à tout moment.</p>';
    if (!l.length) return h + '<div class="scm-vide">Aucune conversation pour l\'instant. Dès qu\'un client écrit sur le 0497, elle apparaît ici.</div>';
    var toi = l.filter(attendToi);
    var main = l.filter(function (c) { return c.statut === "open" && !attendToi(c); });
    var ia = l.filter(function (c) { return c.statut !== "open" && c.statut !== "resolved"; });
    var fin = l.filter(function (c) { return c.statut === "resolved"; });
    function bloc(titre, liste, aide) {
      if (!liste.length) return "";
      return '<p class="grp">' + titre + ' <span class="cnt">' + liste.length + "</span></p>" + (aide ? '<p class="scm-aide">' + aide + "</p>" : "") +
        '<div class="card scm-liste">' + liste.map(ligne).join("") + "</div>";
    }
    h += bloc("À toi de répondre", toi, "Le client attend ta réponse : l'IA est en pause pour lui.");
    h += bloc("Tu as la main", main, "");
    h += bloc("L'IA s'en occupe", ia, "");
    if (fin.length) {
      var vus = S.voirTerminees ? fin : fin.slice(0, 5);
      h += bloc("Terminées", vus, "");
      if (fin.length > vus.length) h += '<button data-scm="voir-terminees" class="scm-plus">Voir les ' + fin.length + " conversations terminées</button>";
    }
    return h;
  }
  function ligne(c) {
    var etat = c.statut === "open" ? "toi" : c.statut === "resolved" ? "fin" : "ia";
    var qui = c.dernier_auteur === "ia" ? "IA : " : c.dernier_auteur === "mohamed" ? "Toi : " : "";
    var tags = "";
    if (c.priorite === "urgent") tags += '<i class="scm-t rouge">Urgent</i>';
    (c.etiquettes || []).forEach(function (e) {
      var cl = e === "reclamation" ? "rouge" : e === "reservation" ? "vert" : e === "annulation" ? "ambre" : "";
      if (e === "reclamation" && c.priorite === "urgent") return;
      tags += '<i class="scm-t ' + cl + '">' + esc(e) + "</i>";
    });
    return '<button class="scm-row" data-scm="ouvrir" data-id="' + c.id + '">' +
      '<span class="scm-av ' + etat + '">' + esc(initiales(c.nom, c.tel)) + "</span>" +
      '<span class="scm-mid"><span class="scm-l1"><b>' + esc(nomDe(c)) + "</b><time>" + esc(quandCourt(c.dernier_le)) + "</time></span>" +
      '<span class="scm-l2">' + esc(qui + (c.dernier_texte || "…")) + "</span>" +
      (tags ? '<span class="scm-tags">' + tags + "</span>" : "") + "</span>" +
      ((c.non_lus || 0) > 0 ? '<i class="navdot">' + c.non_lus + "</i>" : "") + "</button>";
  }

  /* ---------- fil d'une conversation */
  function htmlFil(c) {
    if (!c) return '<div class="scm-vide">Conversation introuvable.</div>';
    var l = S.msgs[c.id];
    if (!l) return '<div class="scm-vide">Chargement…</div>';
    if (!l.length) return '<div class="scm-vide">Pas encore de message enregistré ici pour ce client (seuls les messages reçus depuis la mise en route apparaissent).</div>';
    var h = '<div class="scm-fil">', jour = "";
    l.forEach(function (m) {
      var d = new Date(m.cree_le), j = jourLong(d);
      if (j !== jour) { h += '<p class="scm-jour">' + esc(j) + "</p>"; jour = j; }
      h += bulle(m, d);
    });
    return h + "</div>";
  }
  function pieces(m) {
    var h = "";
    (m.pieces || []).forEach(function (p) {
      if (p.type === "image" && p.url) h += '<a href="' + esc(p.url) + '" target="_blank" rel="noopener"><img class="scm-img" loading="lazy" src="' + esc(p.mini || p.url) + '" alt="Photo du client"></a>';
      else if (p.type === "audio") {
        h += '<p class="scm-voc">🎤 Message vocal' + (p.url ? ' · <a href="' + esc(p.url) + '" target="_blank" rel="noopener">écouter</a>' : "") + "</p>";
        if (p.transcription) h += '<p class="scm-tr">« ' + esc(p.transcription) + " »</p>";
      } else if (p.url) h += '<p><a href="' + esc(p.url) + '" target="_blank" rel="noopener">📎 Ouvrir la pièce jointe</a></p>';
    });
    return h;
  }
  function bulle(m, d) {
    var heure = '<time>' + hm(d) + (m.statut === "failed" ? ' · <b class="scm-err">non délivré</b>' : "") + "</time>";
    if (m.auteur === "note") return '<div class="scm-note">' + liens(m.texte || "") + heure + "</div>";
    var cl = m.auteur === "client" ? "c" : m.auteur === "mohamed" ? "mo" : "ia";
    var qui = m.auteur === "ia" ? '<small>IA</small>' : m.auteur === "mohamed" ? '<small>Toi</small>' : "";
    var err = m.statut === "failed" && m.erreur ? '<p class="scm-err">' + esc(m.erreur) + "</p>" : "";
    return '<div class="scm-b ' + cl + '">' + qui + pieces(m) + (m.texte ? '<p>' + liens(m.texte) + "</p>" : "") + err + heure + "</div>";
  }
  function htmlPied(c) {
    var rapides = '<div class="scm-rap">' + RAPIDES.map(function (r, i) { return '<button data-scm="rapide" data-i="' + i + '">' + esc(r[0]) + "</button>"; }).join("") + "</div>";
    if (c.peut_repondre === false) {
      return '<div class="scm-pied ferme"><p class="scm-ferme"><b>Fenêtre WhatsApp fermée.</b> Le client n\'a pas écrit depuis plus de 24 h : WhatsApp n\'autorise l\'envoi que depuis ton téléphone. Écris ton message, puis ouvre WhatsApp : il sera déjà rempli.</p>' +
        rapides + '<textarea id="scm-txt" rows="2" placeholder="Ton message…"></textarea>' +
        '<div class="scm-2"><a id="scm-walien" class="scm-wa" href="#">Ouvrir WhatsApp</a><button data-scm="copier-txt" class="scm-a">Copier</button></div></div>';
    }
    return '<div class="scm-pied">' + rapides +
      '<p id="scm-info" class="scm-info">En répondant, tu mets l\'IA en pause pour ce client.</p>' +
      '<div class="scm-saisie"><textarea id="scm-txt" rows="1" placeholder="Écrire à ' + esc(prenomDe(c) || "ce client") + '…"></textarea>' +
      '<button id="scm-envoi" data-scm="envoyer" class="scm-send" aria-label="Envoyer">➤</button></div></div>';
  }
  function majLienFerme() {
    var a = $("scm-walien"), ta = $("scm-txt"), c = estConv() ? conv(S.vue) : null;
    if (a && ta && c) a.setAttribute("href", waLien(c.tel, ta.value));
  }
  function etatEnvoi() {
    var b = $("scm-envoi"), ta = $("scm-txt"); if (!b || !ta) return;
    b.disabled = S.envoi || !ta.value.trim(); b.textContent = S.envoi ? "…" : "➤";
  }

  /* ---------- relances */
  function htmlRelances() {
    var tous = S.relances;
    if (!tous.length) return '<div class="scm-vide">Aucune relance préparée.</div>';
    var msgs = tous.filter(function (r) { return r.reponse; });
    var faits = msgs.filter(function (r) { return r.statut === "fait"; }).length;
    var pct = msgs.length ? Math.round(faits / msgs.length * 100) : 0;
    var h = '<div class="scm-prog"><div class="scm-track"><div class="scm-fill" style="width:' + pct + '%"></div></div><span>' + faits + " / " + msgs.length + " messages envoyés</span></div>";
    h += '<div class="scm-chips">';
    ["aujourdhui", "verifier", "devis", "agenda", "tout"].forEach(function (k) {
      var n = tous.filter(function (r) { return (k === "tout" || r.prio === k) && r.statut !== "fait"; }).length;
      h += '<button data-scm="rel-filtre" data-f="' + k + '" class="' + (S.filtreRel === k ? "on" : "") + '">' + (k === "tout" ? "Tout" : PRIO[k][0]) + ' <span>' + n + "</span></button>";
    });
    h += '</div><label class="scm-tog"><input type="checkbox" data-scm="rel-masquer"' + (S.masquerFaits ? " checked" : "") + "> Masquer les envoyées</label>";
    h += '<p class="note">« Ouvrir WhatsApp » ouvre le bon client avec le message déjà écrit. Complète ce qui est en jaune, puis envoie depuis le 0497 : la relance se coche toute seule et l\'IA gère la réponse du client.</p>';
    ["aujourdhui", "verifier", "devis", "agenda"].forEach(function (k) {
      if (S.filtreRel !== "tout" && S.filtreRel !== k) return;
      var l = tous.filter(function (r) { return r.prio === k && !(S.masquerFaits && r.statut === "fait"); })
        .sort(function (a, b) { return ((a.statut === "fait") - (b.statut === "fait")) || ((a.ordre || 0) - (b.ordre || 0)); });
      if (!l.length) return;
      h += '<p class="grp">' + esc(PRIO[k][0]) + "</p><p class=\"scm-aide\">" + esc(PRIO[k][1]) + "</p>" + l.map(carteRel).join("");
    });
    return h;
  }
  function carteRel(r) {
    var fait = r.statut === "fait";
    var trous = r.reponse ? (r.reponse.match(/\[[^\]]+\]/g) || []).filter(function (v, i, a) { return a.indexOf(v) === i; }) : [];
    var aTel = r.wa && r.tel && r.tel !== "—";
    var h = '<article class="card sec scm-rel' + (fait ? " fait" : "") + '">' +
      '<div class="scm-rh"><b>' + esc(r.client) + "</b>" + (fait ? '<span class="scm-t vert">Envoyé' + (r.envoye_par === "whatsapp" ? " ✓ détecté" : "") + "</span>" : "") + "</div>" +
      '<p class="scm-meta">' + (aTel ? 'Tél. <button data-scm="copier" data-t="' + esc(chiffres(r.wa).replace(/^32/, "0")) + '">' + esc(telLisible(r.wa)) + "</button>" : "") +
      (r.rdv ? (aTel ? " · " : "") + "RDV " + esc(r.rdv) : "") + "</p>";
    if (r.reponse) {
      if (trous.length) h += '<p class="scm-todo">À compléter avant d\'envoyer : ' + trous.map(esc).join(" · ") + "</p>";
      h += '<pre class="scm-msg">' + marque(r.reponse) + "</pre>";
      h += '<div class="scm-2">' + (aTel ? '<a class="scm-wa" href="' + esc(waLien(r.wa, r.reponse)) + '">Ouvrir WhatsApp</a>' : "") +
        '<button data-scm="copier-rel" data-id="' + esc(r.id) + '" class="scm-a"' + (aTel ? "" : ' style="grid-column:1/-1"') + ">Copier le message</button></div>";
      h += '<button data-scm="rel-fait" data-id="' + esc(r.id) + '" class="scm-fait' + (fait ? " on" : "") + '">' + (fait ? "Envoyé ✓ (appuie pour annuler)" : "Marquer comme envoyé") + "</button>";
    } else {
      h += '<p class="scm-act">' + esc(r.action || "") + "</p>";
      h += '<button data-scm="rel-fait" data-id="' + esc(r.id) + '" class="scm-fait' + (fait ? " on" : "") + '">' + (fait ? "Fait ✓ (appuie pour annuler)" : "Marquer comme fait") + "</button>";
    }
    h += '<details class="scm-det"><summary>Détail du dossier</summary>' +
      (r.situation ? '<p><b>Situation</b><br>' + esc(r.situation) + "</p>" : "") +
      (r.source ? '<p><b>Son dernier message</b><br>« ' + esc(r.source) + " »</p>" : "") +
      (r.action && r.reponse ? '<p><b>Prochaine action</b><br>' + esc(r.action) + "</p>" : "") +
      (r.incertitude ? '<p class="scm-inc"><b>Incertitude</b><br>' + esc(r.incertitude) + "</p>" : "") +
      (aTel && r.reponse ? '<p class="scm-aide">Si le bouton ouvre le mauvais WhatsApp : <a href="' + esc(waWeb(r.wa, r.reponse)) + '" target="_blank" rel="noopener">autre lien</a>, ou « Copier » puis colle dans WhatsApp Business.</p>' : "") +
      "</details></article>";
    return h;
  }

  /* ------------------------------------------------------------ événements */
  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-scm]") : null;
    if (!el) return;
    var a = el.getAttribute("data-scm");
    switch (a) {
      case "vue": S.vue = el.getAttribute("data-v"); S.piedPour = null; dessiner(); window.scrollTo(0, 0); break;
      case "ouvrir": ouvrir(el.getAttribute("data-id")); break;
      case "retour": S.vue = "liste"; S.piedPour = null; dessiner(); window.scrollTo(0, 0); break;
      case "envoyer": e.preventDefault(); envoyer(); break;
      case "ia-on": basculer("ia", { actif: true }, "L'IA reprend ce client : elle répondra à son prochain message."); break;
      case "ia-off": basculer("ia", { actif: false }, "Tu as la main : l'IA ne répond plus à ce client."); break;
      case "terminer": basculer("terminer", {}, "Conversation terminée. Si le client réécrit, l'IA lui répond."); break;
      case "copier": copier(el.getAttribute("data-t") || ""); break;
      case "copier-txt": { var ta = $("scm-txt"); if (ta && ta.value.trim()) copier(ta.value); break; }
      case "copier-rel": { var id = el.getAttribute("data-id"); S.relances.forEach(function (r) { if (r.id === id) copier(r.reponse || ""); }); break; }
      case "rel-fait": cocherRelance(el.getAttribute("data-id")); break;
      case "rel-filtre": S.filtreRel = el.getAttribute("data-f"); ecrire("scm-filtre", S.filtreRel); dessiner(); break;
      case "voir-terminees": S.voirTerminees = true; dessiner(); break;
      case "recharger": S.erreur = null; S.pret = false; charger(); dessiner(); break;
      case "aller-demandes": if (window.ui) { window.ui.tab = "demandes"; if (typeof window.renderChrome === "function") window.renderChrome(); if (typeof window.renderMain === "function") window.renderMain(); } break;
      case "rapide": {
        var t = $("scm-txt"), r = RAPIDES[+el.getAttribute("data-i")]; if (!t || !r) break;
        var c = conv(S.vue), txt = r[1].replace("{prenom}", prenomDe(c) || "").replace("Bonjour  ", "Bonjour ");
        t.value = t.value.trim() ? t.value.replace(/\s*$/, "") + "\n\n" + txt : txt;
        S.brouillons[S.vue] = t.value; hauteur(t); majLienFerme(); etatEnvoi(); t.focus();
        break;
      }
    }
  });
  document.addEventListener("change", function (e) {
    var el = e.target; if (!el || el.getAttribute("data-scm") !== "rel-masquer") return;
    S.masquerFaits = !!el.checked; ecrire("scm-masquer", S.masquerFaits); dessiner();
  });
  document.addEventListener("input", function (e) {
    if (!e.target || e.target.id !== "scm-txt") return;
    if (estConv()) S.brouillons[S.vue] = e.target.value;
    hauteur(e.target); majLienFerme(); etatEnvoi();
  });
  document.addEventListener("keydown", function (e) {
    if (e.target && e.target.id === "scm-txt" && e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); envoyer(); }
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || !connecte()) return;
    // retour dans l'app : le temps réel a pu décrocher en arrière-plan
    charger();
  });

  /* ------------------------------------------------------------ démarrage */
  var essais = 0;
  (function demarrer() {
    // l'onglet était peut-être déjà affiché avant le chargement de ce fichier
    try { if (window.ui && window.ui.space === "pro" && window.ui.tab === "messages" && !$("scm-root") && typeof window.renderMain === "function") window.renderMain(); } catch (e) {}
    if (connecte()) { if (!S.pret && !S.charge) charger(); abonner(); return; }
    if (++essais < 120) setTimeout(demarrer, 1500);
  })();

  function injecterStyle() {
    if ($("scm-style")) return;
    var css = "" +
      ".scm{padding-bottom:8px}" +
      ".scm .note{margin:8px 2px 4px}" +
      ".scm-seg{display:flex;gap:6px;margin:12px 0 6px}" +
      ".scm-seg button{flex:1;min-width:0;padding:10px 6px;border-radius:999px;font-size:13px;font-weight:700;background:#fff;border:1px solid var(--bordure);color:var(--nuit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".scm-seg button.on{background:var(--nuit);color:#fff;border-color:var(--nuit)}" +
      ".scm-seg button.on .cnt{background:rgba(255,255,255,.18);color:#fff}" +
      ".scm-aide{font-size:12px;color:var(--gris);margin:-2px 2px 6px}" +
      ".scm-vide{background:#fff;border:1px dashed var(--bordure);border-radius:16px;padding:22px 16px;text-align:center;color:var(--gris);font-size:13.5px;margin-top:14px;line-height:1.5}" +
      ".scm-liste{border-radius:16px;overflow:hidden}" +
      ".scm-row{display:flex;gap:12px;align-items:center;width:100%;text-align:left;padding:12px 14px;background:#fff;border:0;border-bottom:1px solid var(--bordure);color:var(--nuit);font:inherit}" +
      ".scm-row:last-child{border-bottom:0}" +
      ".scm-av{flex:0 0 42px;height:42px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;background:var(--pale);color:var(--bleu-dark)}" +
      ".scm-av.toi{background:var(--ambre-bg);color:var(--ambre)}.scm-av.fin{background:#EEF2F5;color:var(--gris)}" +
      ".scm-mid{flex:1;min-width:0;display:grid;gap:2px}" +
      ".scm-l1{display:flex;gap:8px;align-items:baseline;justify-content:space-between}.scm-l1 b{font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".scm-l1 time{font-size:11.5px;color:var(--gris);flex:0 0 auto;font-variant-numeric:tabular-nums}" +
      ".scm-l2{font-size:13px;color:var(--gris);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".scm-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}" +
      ".scm-t{font-style:normal;font-size:10.5px;font-weight:700;padding:1px 8px;border-radius:999px;background:var(--pale);color:var(--bleu-dark)}" +
      ".scm-t.rouge{background:var(--rouge-bg);color:var(--rouge)}.scm-t.vert{background:var(--vert-bg);color:var(--vert)}.scm-t.ambre{background:var(--ambre-bg);color:var(--ambre)}" +
      ".scm-plus{width:100%;margin-top:8px;padding:10px;border-radius:12px;border:1px dashed var(--bordure);background:#fff;color:var(--bleu-dark);font-weight:700;font-size:13px}" +
      ".scm-th{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;display:flex;gap:10px;align-items:center;background:var(--fond);padding:10px 0 8px;border-bottom:1px solid var(--bordure)}" +
      ".scm-back{flex:0 0 38px;height:38px;border-radius:999px;background:#fff;border:1px solid var(--bordure);font-size:26px;line-height:1;color:var(--nuit)}" +
      ".scm-who{flex:1;min-width:0;display:grid}.scm-who b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".scm-who button,.scm-meta button{background:none;border:0;padding:0;font:600 12.5px inherit;font-family:inherit;color:var(--gris);text-align:left;text-decoration:underline dotted;text-underline-offset:3px}" +
      ".scm-who small{font-size:12px;color:var(--gris)}" +
      ".scm-etat{flex:0 0 auto;font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:999px;background:var(--pale);color:var(--bleu-dark)}" +
      ".scm-etat.toi{background:var(--ambre-bg);color:var(--ambre)}.scm-etat.fin{background:#EEF2F5;color:var(--gris)}" +
      ".scm-acts{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 4px}" +
      ".scm-a{display:inline-flex;align-items:center;justify-content:center;gap:4px;padding:8px 12px;border-radius:999px;background:#fff;border:1px solid var(--bordure);font-weight:700;font-size:12.5px;color:var(--nuit);text-decoration:none}" +
      ".scm-a.bleu{background:var(--bleu);border-color:var(--bleu);color:#fff}.scm-a.vert{color:var(--vert)}" +
      ".scm-ban{margin:8px 0 4px;padding:10px 12px;border-radius:12px;font-size:13px;font-weight:600;line-height:1.45}" +
      ".scm-ban.rouge{background:var(--rouge-bg);color:#8F2323}.scm-ban.vert{background:var(--vert-bg);color:#046C4E}" +
      ".scm-ban button{background:none;border:0;font:inherit;font-weight:800;color:inherit;text-decoration:underline;padding:0}" +
      ".scm-rdv{margin:6px 0 2px;font-size:12.5px;color:var(--gris)}.scm-rdv b{color:var(--nuit)}" +
      ".scm-fil{display:flex;flex-direction:column;gap:6px;padding:8px 0 12px}" +
      ".scm-jour{align-self:center;font-size:11px;font-weight:700;color:var(--gris);background:#EEF2F5;border-radius:999px;padding:3px 10px;margin:8px 0 2px;text-transform:capitalize}" +
      ".scm-b{max-width:84%;padding:8px 12px 6px;border-radius:16px;font-size:14px;line-height:1.45;word-wrap:break-word;overflow-wrap:anywhere;box-shadow:0 1px 2px rgba(15,34,51,.06)}" +
      ".scm-b p{margin:0;white-space:pre-wrap}.scm-b a{color:inherit;text-decoration:underline}" +
      ".scm-b small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;opacity:.7;margin-bottom:2px}" +
      ".scm-b time{display:block;text-align:right;font-size:10.5px;opacity:.65;margin-top:3px;font-variant-numeric:tabular-nums}" +
      ".scm-b.c{align-self:flex-start;background:#fff;border:1px solid var(--bordure);border-bottom-left-radius:6px}" +
      ".scm-b.ia{align-self:flex-end;background:var(--pale);color:var(--nuit);border-bottom-right-radius:6px}" +
      ".scm-b.mo{align-self:flex-end;background:var(--bleu);color:#fff;border-bottom-right-radius:6px}" +
      ".scm-note{align-self:stretch;background:var(--ambre-bg);color:#6B3A07;border-radius:12px;padding:8px 12px;font-size:12.5px;font-weight:600;line-height:1.45;white-space:pre-wrap}" +
      ".scm-note time{display:block;font-size:10.5px;font-weight:500;opacity:.7;margin-top:2px}" +
      ".scm-img{display:block;max-width:220px;width:100%;border-radius:10px;margin:2px 0 4px}" +
      ".scm-voc{font-weight:700}.scm-tr{font-style:italic;opacity:.9}.scm-err{color:var(--rouge);font-weight:700}" +
      ".scm-b.mo .scm-err{color:#FFE1E1}" +
      "#scm-pied:empty{display:none}" +
      "#scm-pied{position:sticky;bottom:0;z-index:6}" +
      ".scm-pied{background:var(--fond);padding:8px 0 calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--bordure);display:grid;gap:6px}" +
      ".scm-rap{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px}.scm-rap::-webkit-scrollbar{display:none}" +
      ".scm-rap button{flex:0 0 auto;padding:6px 10px;border-radius:999px;background:#fff;border:1px solid var(--bordure);font-size:12px;font-weight:600;color:var(--nuit)}" +
      ".scm-info{font-size:11.5px;color:var(--ambre);margin:0 2px}" +
      ".scm-saisie{display:flex;gap:8px;align-items:flex-end}" +
      ".scm-saisie textarea{flex:1;resize:none;min-height:44px;max-height:168px;border-radius:22px;padding:11px 14px;background:#fff;line-height:1.35}" +
      ".scm-send{flex:0 0 44px;height:44px;border-radius:999px;border:0;background:var(--bleu);color:#fff;font-size:18px;font-weight:800}" +
      ".scm-send:disabled{opacity:.4}" +
      ".scm-pied.ferme textarea{resize:vertical;background:#fff}" +
      ".scm-ferme{font-size:12.5px;color:var(--gris);line-height:1.45;margin:0}" +
      ".scm-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
      ".scm-wa{display:flex;align-items:center;justify-content:center;padding:11px;border-radius:12px;background:#25D366;color:#fff;font-weight:800;font-size:14px;text-decoration:none}" +
      ".scm-2 .scm-a{border-radius:12px;padding:11px;font-size:14px}" +
      ".scm-prog{display:grid;gap:6px;margin:10px 2px 6px}.scm-prog span{font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}" +
      ".scm-track{height:8px;border-radius:999px;background:var(--pale);overflow:hidden}.scm-fill{height:100%;background:var(--vert);border-radius:999px;transition:width .3s}" +
      ".scm-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0}.scm-chips::-webkit-scrollbar{display:none}" +
      ".scm-chips button{flex:0 0 auto;padding:7px 12px;border-radius:999px;background:#fff;border:1px solid var(--bordure);font-weight:700;font-size:12.5px;color:var(--nuit)}" +
      ".scm-chips button span{color:var(--gris);margin-left:2px}.scm-chips button.on{background:var(--nuit);color:#fff;border-color:var(--nuit)}.scm-chips button.on span{color:#fff;opacity:.8}" +
      ".scm-tog{display:flex;gap:6px;align-items:center;font-size:12.5px;color:var(--gris);margin:8px 2px 0}.scm-tog input{width:16px;height:16px}" +
      ".scm-rel{display:grid;gap:8px}.scm-rel.fait{opacity:.6}" +
      ".scm-rh{display:flex;gap:8px;align-items:center;justify-content:space-between}.scm-rh b{font-size:15px}" +
      ".scm-meta{font-size:12.5px;color:var(--gris);margin:0}" +
      ".scm-todo{margin:0;background:#FFE7A3;color:#3B2A00;border-radius:10px;padding:7px 10px;font-size:12.5px;font-weight:700}" +
      ".scm-msg{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:400 13.5px/1.5 inherit;font-family:inherit;background:var(--pale);border-radius:12px;padding:10px 12px;color:var(--nuit)}" +
      ".scm-msg mark{background:#FFE7A3;color:#3B2A00;border-radius:4px;padding:0 3px}" +
      ".scm-act{margin:0;font-weight:600;font-size:13.5px}" +
      ".scm-fait{padding:10px;border-radius:12px;border:1px solid var(--bordure);background:#fff;font-weight:800;font-size:13.5px;color:var(--nuit)}" +
      ".scm-fait.on{background:var(--vert);border-color:var(--vert);color:#fff}" +
      ".scm-det{border-top:1px solid var(--bordure);padding-top:6px;font-size:12.5px;color:var(--nuit)}" +
      ".scm-det summary{cursor:pointer;color:var(--gris);font-weight:700}.scm-det p{margin:8px 0 0;line-height:1.45}.scm-inc{background:var(--ambre-bg);border-radius:8px;padding:6px 8px}" +
      "@media (max-width:380px){.scm-2{grid-template-columns:1fr}}" +
      "body.scm-actif #fab{display:none!important}";
    var st = document.createElement("style"); st.id = "scm-style"; st.textContent = css;
    document.head.appendChild(st);
  }

  window.SCM = {
    render: render,
    aTraiter: aTraiter,
    majBadge: majBadge,
    _etat: function () { return S; }
  };
})();
