/* messagerie.js v5 — onglet « Messages » de l'app StayClean (6 octobre 2026, nuit)
   v5 : dossiers « À traiter » (incidents, demandes transmises au responsable, alertes) visibles
   jusqu'à leur résolution ; commandes « Rendre au robot / Je prends la main / Pause » et état
   explicite de chaque client (automatique, prise en main avec reprise automatique, pause, attente
   du responsable) ; base de règles de l'IA modifiable (source + date, seules les règles validées
   servent à l'IA) ; indicateurs (demandes, conversion, délais de réponse, incidents).
   - Conversations WhatsApp du 0497 (Chatwoot + IA) en temps réel.
   - Interrupteur IA PAR NUMÉRO : dès que Mohamed écrit à un client (app, Chatwoot ou téléphone),
     l'IA ne répond plus à ce client jusqu'à ce qu'il la réactive ici.
   - « À relancer » : une étiquette par catégorie (Devis à envoyer, Annulation…), messages prêts
     à envoyer (sans crochets), modifiables, avec Copier / Ouvrir WhatsApp / Marquer envoyé /
     Envoyer d'ici (quand WhatsApp l'autorise : fenêtre de 24 h).
   - « Santé » : contrôle du système (WhatsApp, pont, IA, messages non délivrés, erreurs), réglages
     de l'IA (nouveaux clients, frein d'urgence) et journal des erreurs. Les erreurs de l'app sont
     notées automatiquement.
   Données : sc_wa_conversations, sc_wa_messages, sc_relances, sc_wa_ia, sc_wa_reglages, sc_erreurs.
   Écritures sensibles : fonction serveur « messagerie ». Dépendances optionnelles : getSb(),
   session, DB.bookings, toast(), ui, renderMain(). */
(function () {
  "use strict";

  var VERSION = "messagerie-6";
  var BOITE_WA = 143967;
  var RAPIDES = [
    ["📷 Photo", "Bonjour, pour obtenir un devis précis, il faudra juste nous envoyer une photo de l’élément à nettoyer ainsi que votre code postal📍"],
    ["📅 Mes dispos", "Mes dispos en direct 👇 https://stayclean.be/reservation/ Choisissez votre créneau, ça me revient automatiquement ✅"],
    ["📍 Commune ?", "Vous êtes situé sur quelle commune ?"],
    ["🏠 Adresse ?", "J’aurais juste besoin de l’adresse précise"],
    ["🛋️ Canapé 2-3 pl.", "Formule Basique : 89€ 🌿\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n\nFormule Premium : 109€ 🏆\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n✅ Désinfection vapeur pour éliminer acariens, bactéries et allergènes 🦠\n✅ Neutralisation des mauvaises odeurs (dans la limite du possible)\n\n📍 Intervention à domicile\n⏳ Durée estimée : 1h à 1h30\nBien à vous, L’équipe StayClean 🚿✨"],
    ["🛋️ Canapé 4-5 pl.", "Formule Basique : 99€ 🌿\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n\nFormule Premium : 119€ 🏆\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n✅ Désinfection vapeur pour éliminer acariens, bactéries et allergènes 🦠\n✅ Neutralisation des mauvaises odeurs (dans la limite du possible)\n\n📍 Intervention à domicile\n⏳ Durée estimée : 1h à 1h30\nBien à vous, L’équipe StayClean 🚿✨"],
    ["🛋️ Canapé 6-7 pl.", "Formule Basique : 119€ 🌿\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n\nFormule Premium : 139€ 🏆\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n✅ Désinfection vapeur pour éliminer acariens, bactéries et allergènes 🦠\n✅ Neutralisation des mauvaises odeurs (dans la limite du possible)\n\n📍 Intervention à domicile\n⏳ Durée estimée : 1h à 2h\nBien à vous, L’équipe StayClean 🚿✨"],
    ["🛋️ Canapé 8-9 pl.", "Formule Basique : 139€ 🌿\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n\nFormule Premium : 159€ 🏆\n✅ Aspiration complète des poussières et saletés\n✅ Nettoyage en profondeur avec shampouineuse et produit écologique\n✅ Désinfection vapeur pour éliminer acariens, bactéries et allergènes 🦠\n✅ Neutralisation des mauvaises odeurs (dans la limite du possible)\n\n📍 Intervention à domicile\n⏳ Durée estimée : 1h à 2h\nBien à vous, L’équipe StayClean 🚿✨"],
    ["✅ Confirmation", "Bonjour, afin de prendre la route nous avons juste besoin de votre confirmation pour le nettoyage d’aujourd’hui. Bien à vous, StayClean."],
    ["🚐 En route", "Bonjour, c’est pour vous prévenir que je suis en route. Je serai là d’ici 20 à 30 minutes."],
    ["💶 Paiement", "Bonjour 👋, Juste petite précision : le paiement se fait en espèce 💶 (virement instantané possible aussi). Bien à vous, StayClean."],
    ["↩️ Annulation", "Bonjour 👋, C’est bien noté pour l’annulation, pas de souci. Quand vous voulez reprogrammer, vous pouvez choisir un nouveau créneau ici 👇 https://stayclean.be/reservation/ Bien à vous, StayClean."],
    ["🔎 Suivi", "Bonsoir 👋, Je reviens vers vous pour avoir un retour sur le canapé dès qu’il sera sec, pour savoir si le nettoyage a été efficace de notre côté. Bien à vous, StayClean."],
    ["⭐ Avis Google", "Bonjour {prenom} 😊 Merci pour votre confiance ! Si vous êtes satisfait du nettoyage StayClean, un petit avis Google nous aiderait énormément : https://maps.app.goo.gl/cXQTj98sb4RjMoYK7?g_st=ic — À très bientôt, l’équipe StayClean 🚿✨"],
    ["🙏 Excuse attente", "Bonjour, excusez-nous pour l’attente, nous avons eu beaucoup de demandes de devis. J’aimerais savoir si vous êtes toujours intéressé pour obtenir un devis ? Bien à vous, StayClean"],
    ["🤔 Relance douce", "Juste par curiosité, c’est quelque chose que vous envisagez bientôt ou c’était plutôt pour avoir une idée de prix ? 😊"]
  ];
  /* Étiquettes des relances : [nom, icône, couleur, aide] — ordre d'affichage = ordre de ce tableau */
  var CATS = [
    ["reclamation", "Réclamation", "⚠️", "rouge", "Client mécontent : à traiter en premier, avec des excuses."],
    ["manque", "RDV manqué", "🙏", "orange", "On n'est pas venu ou pas répondu : s'excuser et proposer une date."],
    ["confirmer", "RDV à confirmer", "📅", "vert", "Réservation reçue : confirmer la date au client."],
    ["annulation", "Annulation / report", "↩️", "ambre", "RDV annulé ou déplacé : fixer une nouvelle date."],
    ["devis_relancer", "Devis à relancer", "🔁", "violet", "Devis déjà envoyé, pas de réponse."],
    ["devis_envoyer", "Devis à envoyer", "💶", "bleu", "Demande de prix restée sans réponse : le devis est prêt à envoyer."],
    ["suivi", "Suivi client", "💬", "teal", "Client existant avec une question."],
    ["agenda", "Agenda à corriger", "🗓️", "gris", "Tâches dans ton agenda : rien à envoyer."]
  ];
  var CAT = {}; CATS.forEach(function (c, i) { CAT[c[0]] = { cle: c[0], nom: c[1], ico: c[2], cl: c[3], aide: c[4], rang: i }; });
  var THEMES = [["prix", "💶 Prix"], ["zone", "📍 Zone et déplacement"], ["prestation", "🧽 Prestations"], ["sechage", "💨 Séchage"],
    ["duree", "⏳ Durées"], ["paiement", "💳 Paiement"], ["reservation", "📅 Réservation"], ["annulation", "↩️ Annulation / report"],
    ["horaires", "🕘 Horaires"], ["style", "🗣️ Style et comportement"], ["autre", "📌 Autre"]];
  var THEME = {}; THEMES.forEach(function (t) { THEME[t[0]] = t[1]; });
  var DOSS = {
    absence: "Personne n'est venu", reclamation: "Réclamation", dommage: "Dommage signalé", remboursement: "Demande de remboursement",
    prix: "Prix contesté", question: "Demande transmise", panne: "L'IA n'a pas pu répondre", reservation: "Réservation à valider",
    annulation: "Annulation / report", agenda: "Incohérence d'agenda", autre: "Alerte"
  };

  /* Messages automatiques : [icône, nom, quand] */
  var AUTO = {
    relance_douce: ["🤔", "Relance douce", "Un prospect a reçu un prix de l'IA et ne répond plus : une seule relance (ton message « Relance douce »), avant la fin des 24 h."],
    rappel_veille: ["📅", "Rappel la veille", "RDV confirmé demain : petit rappel à 18 h."],
    suivi_apres: ["🔎", "Suivi après prestation", "Prestation d'hier, payée dans l'app : demande de retour à 11 h."],
    avis: ["⭐", "Avis Google", "3 jours après une prestation payée, sans aucun incident : lien vers l'avis Google, à 12 h."]
  };
  var AUTO_ORDRE = ["rappel_veille", "suivi_apres", "avis", "relance_douce"];
  var S = {
    pret: false, erreur: null, charge: false, avert: null,
    convs: [], relances: [], msgs: {}, ia: {}, reglages: {}, erreurs: [], dossiers: [], regles: [], auto: [], optout: [], autoErreur: null,
    relMode: lire("scm6-relmode", "manuel"), demanderAuto: null,
    vue: lire("scm-vue", "liste"),               // liste | relances | regles | sante | id de conversation
    filtreRegle: lire("scm5-regles", "tout"), regleEdit: null, regleAjout: false,
    kpi: null, kpiCharge: false, kpiJours: lire("scm5-kpi", 7),
    filtreRel: lire("scm4-filtre", "tout"),
    masquerFaits: lire("scm4-masquer", true),
    recherche: "",
    voirTerminees: false,
    brouillons: lire("scm4-brouillons", {}),       // brouillon par conversation
    relEdits: lire("scm4-rel", {}),                // message de relance retouché, par fiche
    relDansPied: {},                               // conversation → relance insérée dans la réponse
    envoi: false, piedPour: null, canal: null, tests: lire("scm-tests", false),
    confirmer: null, envoiRel: null, ouvertWa: null, demanderEnvoye: null, surligner: null,
    sante: null, santeCharge: false, santeLe: 0, horsLigne: (typeof navigator !== "undefined" && navigator.onLine === false),
    renduEnAttente: false, tempsReel: "attente"
  };
  if (!/^(liste|relances|regles|sante)$/.test(String(S.vue))) S.vue = "liste";
  if (S.filtreRel !== "tout" && !CAT[S.filtreRel]) S.filtreRel = "tout";

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
  function ko(m) { if (typeof window.toast === "function") window.toast("err", [m]); }
  function chiffres(t) { return String(t || "").replace(/\D/g, ""); }
  function telLisible(t) {
    var d = chiffres(t);
    if (/^32\d{9}$/.test(d)) return "0" + d.slice(2, 5) + " " + d.slice(5, 7) + " " + d.slice(7, 9) + " " + d.slice(9);
    if (/^32\d{8}$/.test(d)) return "0" + d.slice(2, 4) + " " + d.slice(4, 7) + " " + d.slice(7, 9) + " " + d.slice(9);
    if (/^33\d{9}$/.test(d)) return "+33 " + d.slice(2, 3) + " " + d.slice(3, 5) + " " + d.slice(5, 7) + " " + d.slice(7, 9) + " " + d.slice(9);
    return t ? String(t) : "";
  }
  function telLocal(t) { var d = chiffres(t); return /^32\d{8,9}$/.test(d) ? "0" + d.slice(2) : d; }
  function waLien(numero, texte) { return "whatsapp://send?phone=" + chiffres(numero) + (texte ? "&text=" + encodeURIComponent(texte) : ""); }
  function waWeb(numero, texte) { return "https://wa.me/" + chiffres(numero) + (texte ? "?text=" + encodeURIComponent(texte) : ""); }
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
  function quandLong(iso) {
    if (!iso) return "";
    var d = new Date(iso), n = new Date();
    if (memeJour(d, n)) return "aujourd'hui à " + hm(d);
    if (memeJour(d, new Date(n.getTime() - 864e5))) return "hier à " + hm(d);
    return "le " + d.getDate() + "/" + d2(d.getMonth() + 1) + " à " + hm(d);
  }
  function jourLong(d) {
    var n = new Date(), h = new Date(n.getTime() - 864e5);
    if (memeJour(d, n)) return "Aujourd'hui";
    if (memeJour(d, h)) return "Hier";
    return JOURS_L[d.getDay()] + " " + d.getDate() + " " + MOIS_L[d.getMonth()];
  }
  function minutesDepuis(iso) { return iso ? (Date.now() - new Date(iso).getTime()) / 60000 : 1e9; }
  function initiales(nom) {
    var n = String(nom || "").trim();
    if (!n || /^\+?\d/.test(n)) return "#";
    var p = n.split(/\s+/);
    return (p[0][0] + (p[1] ? p[1][0] : (p[0][1] || ""))).toUpperCase();
  }
  function nomDe(c) { var n = String(c && c.nom || "").trim(); return n && !/^\+?\d[\d\s]+$/.test(n) ? n : telLisible(c && c.tel) || "Client"; }
  function prenomDe(c) { var n = nomDe(c); return /^\d/.test(n) ? "" : n.split(/\s+/)[0]; }
  function copier(t, silencieux) {
    function repli() {
      var ta = document.createElement("textarea");
      ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.top = "0"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length);
      var reussi = false; try { reussi = document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      if (silencieux) return;
      if (reussi) ok("Copié ✓ Colle-le dans WhatsApp."); else ko("Copie impossible : sélectionne le texte à la main.");
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { if (!silencieux) ok("Copié ✓ Colle-le dans WhatsApp."); }, repli);
      else repli();
    } catch (e) { repli(); }
  }
  function liens(s) { return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }

  /* ------------------------------------------------------------ journal des erreurs de l'app */
  var budget = { n: 0, t0: 0 }, dejaNote = {};
  function noterErreurApp(message, detail) {
    try {
      var m = String(message || "Erreur").slice(0, 480);
      if (/^Script error\.?$/i.test(m) || /ResizeObserver loop/i.test(m)) return;
      var now = Date.now();
      if (now - budget.t0 > 60000) { budget.t0 = now; budget.n = 0; }
      if (++budget.n > 5) return;
      if (dejaNote[m] && now - dejaNote[m] < 600000) return;
      dejaNote[m] = now;
      var c = sb(); if (!c || !connecte()) return;
      var p = c.from("sc_erreurs").insert({ source: "app", message: m, detail: String(detail || "").slice(0, 3900), version: VERSION });
      if (p && typeof p.then === "function") p.then(function () {}, function () {});
    } catch (e) {}
  }
  window.addEventListener("error", function (e) {
    noterErreurApp(e && e.message, (e && e.filename || "") + ":" + (e && e.lineno || "") + " " + (e && e.error && e.error.stack || ""));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason; noterErreurApp("Promesse rejetée : " + (r && r.message || r), r && r.stack || "");
  });

  /* ------------------------------------------------------------ données */
  function visibles() {
    return S.convs.filter(function (c) { return S.tests || Number(c.inbox_id) === BOITE_WA || c.inbox_id == null; });
  }
  function conv(id) { id = Number(id); for (var i = 0; i < S.convs.length; i++) if (Number(S.convs[i].id) === id) return S.convs[i]; return null; }
  function estConv() { return /^\d+$/.test(String(S.vue)); }
  function retardIA(c) { return c.statut === "pending" && c.dernier_auteur === "client" && minutesDepuis(c.dernier_le) > 10; }
  function attendToi(c) { return (c.statut === "open" && (c.dernier_auteur === "client" || c.priorite === "urgent")) || retardIA(c); }
  function aTraiter() {
    var vus = {}, n = 0;
    visibles().forEach(function (c) { if (attendToi(c)) { vus[c.tel || c.id] = 1; n++; } });
    dossiersOuverts().forEach(function (d) { if (bloquant(d) && !vus[d.tel || ("d" + d.id)]) { vus[d.tel || ("d" + d.id)] = 1; n++; } });
    return n;
  }
  function trierConvs() {
    S.convs.sort(function (a, b) { return String(b.dernier_le || b.maj || "").localeCompare(String(a.dernier_le || a.maj || "")); });
  }
  function relance(id) { for (var i = 0; i < S.relances.length; i++) if (S.relances[i].id === id) return S.relances[i]; return null; }
  function catDe(r) { return CAT[r.categorie] || (r.prio === "agenda" ? CAT.agenda : CAT.devis_envoyer); }
  function texteRel(r) { var e = S.relEdits[r.id]; return typeof e === "string" ? e : (r.reponse || ""); }
  function convPourWa(wa) {
    var d = chiffres(wa); if (!d) return null;
    var l = S.convs.filter(function (c) { return Number(c.inbox_id) === BOITE_WA && chiffres(c.tel) === d; });
    return l[0] || null; // S.convs est trié du plus récent au plus ancien
  }
  function relancesPour(c) {
    var d = chiffres(c && c.tel); if (!d) return [];
    return S.relances.filter(function (r) { return r.statut !== "fait" && r.reponse && chiffres(r.wa) === d; });
  }
  function reglage(cle, defaut) { return Object.prototype.hasOwnProperty.call(S.reglages, cle) ? S.reglages[cle] : defaut; }
  /* L'IA est-elle activée pour ce client ? (choix mémorisé pour son numéro, sinon réglage général) */
  function iaNumero(c) {
    var f = c && S.ia[c.tel];
    if (f) return f.ia !== false;
    return reglage("ia_nouveaux", true) !== false;
  }
  function dossiersOuverts() { return S.dossiers.filter(function (d) { return d.statut === "ouvert"; }); }
  function dossiersPour(c) { return c && c.tel ? dossiersOuverts().filter(function (d) { return d.tel === c.tel; }) : []; }
  function bloquant(d) { return d.type === "incident" || d.type === "transfert"; }
  function hhmm(ms) { var d = new Date(ms), n = new Date(); return (memeJour(d, n) ? "" : (memeJour(d, new Date(n.getTime() + 864e5)) ? "demain " : JOURS[d.getDay()] + " ")) + hm(d); }
  /* État explicite d'un client : automatique, prise en main (reprise auto), pause, attente du responsable */
  function etatNumero(c) {
    if (reglage("ia_pause", false) === true) return { code: "frein", label: "⏸ Frein d'urgence tiré", sous: "L'IA ne répond à personne (à relâcher dans Santé)." };
    if (dossiersPour(c).some(bloquant)) return { code: "attente", label: "🙋 Attente du responsable", sous: "Dossier ouvert : l'IA ne reprendra pas seule tant qu'il n'est pas résolu (ou que tu la relances)." };
    var f = c && S.ia[c.tel];
    if (f && f.ia === false && f.par === "pause") return { code: "pause", label: "⏸ En pause", sous: "L'IA ne répond pas à ce client et ne reprendra pas seule." };
    if (f && f.ia === false) {
      var h = Number(reglage("reprise_heures", 12)) || 0;
      var t = Date.parse(f.maj || "") || Date.now();
      return { code: "main", label: "✋ Tu as la main", sous: h > 0 ? "Si tu ne lui écris plus, l'IA reprendra au prochain message du client après " + hhmm(t + h * 3600e3) + "." : "L'IA ne reprendra pas seule (reprise automatique désactivée)." };
    }
    if (!f && reglage("ia_nouveaux", true) === false) return { code: "main", label: "✋ Tu as la main", sous: "IA désactivée pour les nouveaux clients (Santé)." };
    return { code: "auto", label: "🤖 Automatique", sous: "L'IA répond à ce client. Dès que tu lui écris, elle se met en retrait." };
  }

  function majConv(row) {
    if (!row || row.id == null) return;
    var c = conv(row.id);
    if (c) { for (var k in row) if (Object.prototype.hasOwnProperty.call(row, k) && row[k] !== undefined) c[k] = row[k]; }
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
  function majIA(row) { if (row && row.tel) S.ia[row.tel] = row; }
  function majListe(liste, row) {
    if (!row || row.id == null) return;
    for (var i = 0; i < liste.length; i++) if (liste[i].id === row.id) { liste[i] = row; return; }
    liste.unshift(row);
  }
  function majReglage(row) { if (row && row.cle) S.reglages[row.cle] = row.valeur; }
  function majErreur(row) {
    if (!row || row.id == null) return;
    for (var i = 0; i < S.erreurs.length; i++) if (S.erreurs[i].id === row.id) { S.erreurs[i] = row; return; }
    S.erreurs.unshift(row);
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
    var c = sb(); if (!c || S.charge) return;
    S.charge = true;
    var depuis = new Date(Date.now() - 7 * 864e5).toISOString();
    Promise.all([
      c.from("sc_wa_conversations").select("*").order("dernier_le", { ascending: false, nullsFirst: false }).limit(300),
      c.from("sc_relances").select("*").order("ordre", { ascending: true }).limit(500),
      c.from("sc_wa_ia").select("*").limit(2000),
      c.from("sc_wa_reglages").select("*"),
      c.from("sc_erreurs").select("*").gt("cree_le", depuis).order("cree_le", { ascending: false }).limit(60),
      c.from("sc_dossiers").select("*").order("cree_le", { ascending: false }).limit(200),
      c.from("sc_regles").select("*").order("ordre", { ascending: true }).limit(500),
      c.from("sc_auto").select("*").gt("cree_le", new Date(Date.now() - 14 * 864e5).toISOString()).order("prevu_le", { ascending: false }).limit(400),
      c.from("sc_optout").select("*").limit(1000)
    ]).then(function (r) {
      S.charge = false;
      var err = r[0].error || r[1].error;
      if (err) { S.erreur = err.message || String(err); dessiner(); return; }
      S.erreur = null; S.pret = true;
      S.convs = r[0].data || []; trierConvs();
      S.relances = r[1].data || [];
      // Tables v2 : une erreur ne bloque pas les messages (signalée dans « Santé »)
      var e2 = r[2].error || r[3].error || r[4].error || r[5].error || r[6].error;
      S.avert = e2 ? "Réglages de l'IA illisibles : " + (e2.message || "erreur") : null;
      S.dossiers = r[5].data || [];
      S.regles = r[6].data || [];
      // Messages automatiques (v4) : une erreur ne bloque rien, elle est montrée dans l'onglet
      S.autoErreur = r[7].error ? (r[7].error.message || "erreur") : null;
      S.auto = r[7].data || [];
      S.optout = r[8].error ? [] : (r[8].data || []);
      S.ia = {}; (r[2].data || []).forEach(majIA);
      S.reglages = {}; (r[3].data || []).forEach(majReglage);
      S.erreurs = r[4].data || [];
      if (estConv() && !S.msgs[S.vue]) chargerFil(S.vue); else dessiner();
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
      S.canal = c.channel("scm-messagerie-6")
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_wa_conversations" }, function (p) { majConv(p.new); dessiner(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_wa_messages" }, function (p) {
          var bas = presDuBas(); majMsg(p.new); dessiner(); if (bas && estConv() && Number(S.vue) === Number(p.new && p.new.conv_id)) basDePage();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_relances" }, function (p) { majRel(p.new); dessiner(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_wa_ia" }, function (p) { majIA(p.new); dessiner(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_wa_reglages" }, function (p) { majReglage(p.new); dessiner(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_erreurs" }, function (p) { majErreur(p.new); dessiner(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_dossiers" }, function (p) { majListe(S.dossiers, p.new); dessiner(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_regles" }, function (p) { majListe(S.regles, p.new); dessiner(); })
        .on("postgres_changes", { event: "*", schema: "public", table: "sc_auto" }, function (p) { majListe(S.auto, p.new); dessiner(); })
        .subscribe(function (etat) {
          S.tempsReel = etat === "SUBSCRIBED" ? "ok" : /CLOSED|ERROR|TIMED_OUT/.test(String(etat)) ? "ko" : S.tempsReel;
          if (S.tempsReel === "ko") { try { c.removeChannel(S.canal); } catch (e) {} S.canal = null; }
        });
    } catch (e) { S.canal = null; }
  }
  function marquerLu(id) {
    var c = sb(), x = conv(id); if (!c || !x) return;
    x.non_lus = 0;
    c.from("sc_wa_conversations").update({ non_lus: 0, lu_le: new Date().toISOString() }).eq("id", Number(id)).then(function () {});
  }
  function appel(corps) {
    var c = sb(); if (!c) return Promise.resolve({ ok: false, erreur: "Pas connecté : ouvre l'app avec ton compte." });
    if (S.horsLigne) return Promise.resolve({ ok: false, erreur: "Pas de connexion internet : réessaie dans un instant." });
    return c.functions.invoke("messagerie", { body: corps }).then(function (res) {
      if (res.error) {
        var ctx = res.error.context;
        if (ctx && typeof ctx.json === "function") return ctx.json().catch(function () { return { ok: false, erreur: res.error.message }; });
        return { ok: false, erreur: res.error.message || "erreur réseau" };
      }
      return res.data || { ok: false, erreur: "réponse vide" };
    }).catch(function (e) { return { ok: false, erreur: String(e && e.message || e) }; });
  }
  function verifierSante(force) {
    if (S.santeCharge || !connecte()) return;
    if (!force && Date.now() - S.santeLe < 5 * 60000) return;
    S.santeCharge = true; dessiner();
    appel({ action: "sante" }).then(function (r) {
      S.santeCharge = false; S.santeLe = Date.now();
      S.sante = r && r.ok ? r : { ok: false, verifs: [], problemes: 1, erreur: (r && r.erreur) || "contrôle impossible" };
      dessiner();
    });
  }

  /* ------------------------------------------------------------ actions */
  function ouvrir(id) {
    S.vue = Number(id); S.piedPour = null; S.confirmer = null;
    var x = conv(id); if (x && (x.non_lus || 0) > 0) marquerLu(id);
    if (!S.msgs[id]) chargerFil(id);
    dessiner(); basDePage();
    appel({ action: "rafraichir", conv: Number(id) }).then(function (r) {
      if (r && r.ok) { if (r.conversation) majConv(r.conversation); if (r.ia) majIA(r.ia); dessiner(); }
    });
  }
  function envoyer() {
    var id = Number(S.vue), ta = $("scm-txt"); if (!ta || S.envoi) return;
    var t = ta.value.trim(); if (!t) { ta.focus(); return; }
    S.envoi = true; etatEnvoi();
    var corps = { action: "envoyer", conv: id, texte: t };
    if (S.relDansPied[id]) corps.relance = S.relDansPied[id];
    appel(corps).then(function (r) {
      S.envoi = false;
      if (r && r.ok) {
        S.brouillons[id] = ""; ecrire("scm4-brouillons", S.brouillons); delete S.relDansPied[id];
        var t2 = $("scm-txt"); if (t2) { t2.value = ""; hauteur(t2); }
        if (r.message) { if (!S.msgs[id]) S.msgs[id] = []; majMsg(r.message); }
        if (r.conversation) majConv(r.conversation);
        if (r.ia) majIA(r.ia);
        S.piedPour = null; dessiner(); basDePage();
        ok(r.suivi && r.suivi.length ? "Envoyé ✓ (un détail n'a pas suivi : voir Santé)" : "Envoyé ✓ L'IA est coupée pour ce client.");
      } else {
        ko((r && r.erreur) || "Envoi impossible.");
        if (r && r.raison === "fenetre") { majConv({ id: id, peut_repondre: false }); S.piedPour = null; dessiner(); }
      }
      etatEnvoi();
    });
  }
  /* « Rendre au robot » (robot), « Je prends la main » (main), « Mettre en pause » (pause) */
  function commandeIA(mode) {
    var id = Number(S.vue), c = conv(id); if (!c) return;
    var actif = mode === "robot";
    var avant = { statut: c.statut, flag: S.ia[c.tel] };
    c.statut = actif ? "pending" : (c.statut === "resolved" ? "resolved" : "open");
    if (c.tel) S.ia[c.tel] = { tel: c.tel, ia: actif, par: actif ? "app" : mode, maj: new Date().toISOString() };
    dessiner();
    var corps = { action: "ia", conv: id, actif: actif }; if (!actif) corps.mode = mode;
    appel(corps).then(function (r) {
      if (r && r.ok) {
        if (r.conversation) majConv(r.conversation);
        if (r.ia) majIA(r.ia);
        dessiner();
        var bloq = dossiersPour(c).some(bloquant);
        ok(actif ? "Rendu au robot : l'IA répondra au prochain message de " + nomDe(c) + "." + (bloq ? " (Le dossier reste dans « À traiter ».)" : "")
          : mode === "pause" ? "En pause : l'IA ne répond plus à " + nomDe(c) + " et ne reprendra pas seule."
          : "Tu as la main : l'IA ne répond plus à " + nomDe(c) + ".");
      } else {
        c.statut = avant.statut; if (avant.flag) S.ia[c.tel] = avant.flag; else delete S.ia[c.tel];
        dessiner(); ko((r && r.erreur) || "Action impossible.");
      }
    });
  }
  function dossier(id) { for (var i = 0; i < S.dossiers.length; i++) if (String(S.dossiers[i].id) === String(id)) return S.dossiers[i]; return null; }
  function changerDossier(id, statut, niveau) {
    var d = dossier(id); if (!d) return;
    var avant = { statut: d.statut, niveau: d.niveau };
    if (statut) d.statut = statut; if (niveau) d.niveau = niveau;
    dessiner();
    var corps = { action: "dossier", id: Number(id) }; if (statut) corps.statut = statut; if (niveau) corps.niveau = niveau;
    appel(corps).then(function (r) {
      if (r && r.ok) {
        if (r.dossier) majListe(S.dossiers, r.dossier);
        if (r.ia) majIA(r.ia);
        dessiner();
        ok(statut === "resolu" ? (bloquant(d) ? "Dossier résolu. L'IA reprendra après le délai prévu, ou tout de suite si tu la rends au robot." : "C'est noté.")
          : niveau === "confirme" ? "Incident confirmé : il reste ouvert jusqu'à sa résolution." : niveau === "non_fonde" ? "Noté : ce n'était pas un incident." : "C'est noté.");
      } else { d.statut = avant.statut; d.niveau = avant.niveau; dessiner(); ko((r && r.erreur) || "Action impossible."); }
    });
  }
  function regle(id) { for (var i = 0; i < S.regles.length; i++) if (String(S.regles[i].id) === String(id)) return S.regles[i]; return null; }
  function ecrireRegle(id, champs, message) {
    var c = sb(), r = regle(id); if (!c || !r) return;
    var avant = {}; for (var k in champs) { avant[k] = r[k]; r[k] = champs[k]; }
    r.maj = new Date().toISOString(); champs.maj = r.maj;
    S.regleEdit = null; dessiner();
    c.from("sc_regles").update(champs).eq("id", r.id).then(function (x) {
      if (x && x.error) { for (var k2 in avant) r[k2] = avant[k2]; dessiner(); ko("Pas enregistré : " + x.error.message); }
      else ok(message);
    });
  }
  function ajouterRegle() {
    var c = sb(), th = $("scm-r-theme"), tx = $("scm-r-texte"); if (!c || !th || !tx) return;
    var t = tx.value.trim(); if (t.length < 3) { ko("Écris la règle d'abord."); return; }
    var auj = new Date(), jour = auj.getFullYear() + "-" + d2(auj.getMonth() + 1) + "-" + d2(auj.getDate());
    var ligne = { theme: th.value, texte: t, source: "Ajoutée par Mohamed dans l'app", source_le: jour, statut: "validee", ordre: 500 };
    S.regleAjout = false; dessiner();
    c.from("sc_regles").insert(ligne).select().then(function (x) {
      if (x && x.error) { ko("Pas enregistré : " + x.error.message); return; }
      if (x && x.data && x.data[0]) majListe(S.regles, x.data[0]);
      dessiner(); ok("Règle ajoutée : l'IA l'utilisera dès son prochain message.");
    });
  }
  /* Indicateurs : uniquement des chiffres observés (aucune estimation) */
  function chargerKpi() {
    var c = sb(); if (!c || S.kpiCharge) return;
    S.kpiCharge = true; dessiner();
    var j = Number(S.kpiJours) || 7, depuis = new Date(Date.now() - j * 864e5).toISOString();
    Promise.all([
      c.from("sc_demandes").select("id,statut,cree_le,traite_le").gte("cree_le", depuis).limit(2000),
      c.from("sc_wa_messages").select("conv_id,auteur,cree_le").gte("cree_le", depuis).order("cree_le", { ascending: true }).limit(5000)
    ]).then(function (r) {
      S.kpiCharge = false;
      var k = { jours: j, le: Date.now() };
      if (r[0].error) k.demErreur = r[0].error.message;
      else {
        var d = r[0].data || [];
        k.dem = d.length;
        k.conf = d.filter(function (x) { return x.statut === "confirmee"; }).length;
        k.perdues = d.filter(function (x) { return x.statut === "annulee" || x.statut === "refusee"; }).length;
        k.attente = d.filter(function (x) { return x.statut === "nouvelle"; }).length;
      }
      if (r[1].error) k.msgErreur = r[1].error.message;
      else {
        var parConv = {}, delaisIA = [], delaisMo = [], sans = 0;
        (r[1].data || []).forEach(function (m) { (parConv[m.conv_id] = parConv[m.conv_id] || []).push(m); });
        Object.keys(parConv).forEach(function (id) {
          var l = parConv[id], attente = null;
          l.forEach(function (m) {
            if (m.auteur === "client") { if (attente === null) attente = Date.parse(m.cree_le); }
            else if ((m.auteur === "ia" || m.auteur === "mohamed") && attente !== null) {
              (m.auteur === "ia" ? delaisIA : delaisMo).push((Date.parse(m.cree_le) - attente) / 60000); attente = null;
            }
          });
          if (attente !== null && Date.now() - attente > 3600e3) sans++;
        });
        function med(a) { if (!a.length) return null; a.sort(function (x, y) { return x - y; }); var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
        k.convs = Object.keys(parConv).length; k.medIA = med(delaisIA); k.medMo = med(delaisMo); k.nIA = delaisIA.length; k.nMo = delaisMo.length; k.sans = sans;
      }
      var depMs = Date.now() - j * 864e5;
      k.incOuverts = S.dossiers.filter(function (x) { return x.type === "incident" && x.statut === "ouvert"; }).length;
      k.incPeriode = S.dossiers.filter(function (x) { return x.type === "incident" && Date.parse(x.cree_le) >= depMs; }).length;
      k.relEnv = S.relances.filter(function (x) { return x.statut === "fait" && x.envoye_le && Date.parse(x.envoye_le) >= depMs; }).length;
      S.kpi = k; dessiner();
    }).catch(function (e) { S.kpiCharge = false; S.kpi = { erreur: String(e && e.message || e) }; dessiner(); });
  }
  function autoMsg(id) { for (var i = 0; i < S.auto.length; i++) if (String(S.auto[i].id) === String(id)) return S.auto[i]; return null; }
  function changerAuto(id, champs, message) {
    var c = sb(), x = autoMsg(id); if (!c || !x) return;
    var avant = { statut: x.statut, raison: x.raison, envoye_le: x.envoye_le };
    champs.maj = new Date().toISOString();
    Object.keys(champs).forEach(function (k) { x[k] = champs[k]; }); dessiner();
    c.from("sc_auto").update(champs).eq("id", x.id).in("statut", ["prevu", "attente_modele", "apercu"]).select().then(function (r) {
      if (r.error || !r.data || !r.data.length) {
        Object.keys(avant).forEach(function (k) { x[k] = avant[k]; }); dessiner();
        ko(r.error ? "Impossible : " + r.error.message : "Ce message a déjà changé d'état (recharge la page).");
        return;
      }
      majListe(S.auto, r.data[0]); dessiner(); ok(message);
    });
  }
  function terminer() {
    var id = Number(S.vue), c = conv(id); if (!c) return;
    appel({ action: "terminer", conv: id }).then(function (r) {
      if (r && r.ok) {
        if (r.conversation) majConv(r.conversation); if (r.ia) majIA(r.ia); dessiner();
        ok(iaNumero(c) ? "Conversation terminée. Si le client réécrit, l'IA lui répond." : "Conversation terminée. Si le client réécrit, c'est toi qui réponds (IA coupée pour lui).");
      } else ko((r && r.erreur) || "Action impossible.");
    });
  }
  function changerReglage(cle, valeur) {
    var avant = S.reglages[cle];
    S.reglages[cle] = valeur; dessiner();
    appel({ action: "reglage", cle: cle, valeur: valeur }).then(function (r) {
      if (r && r.ok) {
        if (r.reglage) majReglage(r.reglage);
        dessiner();
        if (cle === "ia_pause") ok(valeur ? "Frein tiré : l'IA ne répond plus à personne." : "Frein relâché : l'IA répond de nouveau.");
        else if (cle === "reprise_heures") ok(valeur ? "Reprise automatique après " + valeur + " h sans message de ta part." : "Reprise automatique désactivée.");
        else if (cle === "auto_mode") ok(valeur === "actif" ? "Messages automatiques ACTIFS : ils partiront aux heures prévues." : valeur === "apercu" ? "Mode aperçu : rien n'est envoyé, tu vois ce qui partirait." : "Messages automatiques coupés.");
        else if (cle === "auto_types") ok("C'est noté.");
        else ok(valeur ? "L'IA répondra aux nouveaux clients." : "L'IA ne répondra plus aux nouveaux clients.");
      } else { S.reglages[cle] = avant; dessiner(); ko((r && r.erreur) || "Réglage impossible."); }
    });
  }
  function cocherRelance(id, forcer) {
    var r = relance(id), c = sb(); if (!r || !c) return;
    var fait = forcer === undefined ? r.statut !== "fait" : forcer;
    var ancien = { statut: r.statut, envoye_le: r.envoye_le, envoye_par: r.envoye_par };
    r.statut = fait ? "fait" : "a_faire"; r.envoye_le = fait ? new Date().toISOString() : null; r.envoye_par = fait ? "app" : null;
    if (S.demanderEnvoye === id) S.demanderEnvoye = null;
    dessiner();
    c.from("sc_relances").update({ statut: r.statut, envoye_le: r.envoye_le, envoye_par: r.envoye_par, maj: new Date().toISOString() }).eq("id", id)
      .then(function (x) {
        if (x && x.error) { r.statut = ancien.statut; r.envoye_le = ancien.envoye_le; r.envoye_par = ancien.envoye_par; dessiner(); ko("Pas enregistré : " + x.error.message); }
      });
  }
  function envoyerRelance(id) {
    var r = relance(id), d = r ? directPossible(r) : null;
    if (!r || !d || !d.ok || S.envoiRel) return;
    var t = texteRel(r).trim(); if (!t) { ko("Le message est vide."); return; }
    S.envoiRel = id; S.confirmer = null; dessiner();
    appel({ action: "envoyer", conv: d.conv.id, texte: t, relance: id }).then(function (x) {
      S.envoiRel = null;
      if (x && x.ok) {
        r.statut = "fait"; r.envoye_par = "app"; r.envoye_le = new Date().toISOString();
        if (x.message) { if (S.msgs[d.conv.id]) majMsg(x.message); }
        if (x.conversation) majConv(x.conversation);
        if (x.ia) majIA(x.ia);
        delete S.relEdits[id]; ecrire("scm4-rel", S.relEdits);
        dessiner(); ok("Envoyé à " + r.client + " ✓ L'IA est coupée pour ce client.");
      } else {
        dessiner(); ko((x && x.erreur) || "Envoi impossible.");
        if (x && x.raison === "fenetre") { majConv({ id: d.conv.id, peut_repondre: false }); dessiner(); }
      }
    });
  }
  function directPossible(r) {
    if (!r.wa) return { ok: false, pourquoi: "pas de numéro" };
    var c = convPourWa(r.wa);
    if (!c) return { ok: false, pourquoi: "ce client ne t'a pas encore écrit sur le 0497 depuis l'installation" };
    if (c.peut_repondre === false) return { ok: false, conv: c, pourquoi: "il ne t'a pas écrit depuis plus de 24 h (règle WhatsApp)" };
    return { ok: true, conv: c };
  }
  function marquerErreursVues() {
    var c = sb(); if (!c) return;
    var ids = S.erreurs.filter(function (e) { return !e.vu; }).map(function (e) { return e.id; });
    if (!ids.length) return;
    S.erreurs.forEach(function (e) { e.vu = true; }); dessiner();
    c.from("sc_erreurs").update({ vu: true }).in("id", ids).then(function (x) { if (x && x.error) ko("Pas enregistré : " + x.error.message); });
  }

  /* ------------------------------------------------------------ rendu */
  function presDuBas() { var d = document.documentElement; return window.innerHeight + (window.scrollY || d.scrollTop) >= d.scrollHeight - 160; }
  function basDePage() { setTimeout(function () { var d = document.documentElement; window.scrollTo(0, d.scrollHeight); }, 30); }
  function hauteur(ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, Math.max(168, Math.round(window.innerHeight * 0.4))) + "px"; }
  function hauteurRel(ta) { ta.style.height = "auto"; ta.style.height = (ta.scrollHeight + 2) + "px"; }
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
    verifierSante(false);
    dessiner();
  }

  function dessiner() {
    try { dessiner0(); }
    catch (e) {
      noterErreurApp("Affichage Messages : " + (e && e.message), e && e.stack);
      var c = $("scm-corps");
      if (c) c.innerHTML = '<div class="scm-vide">Un affichage a échoué (c\'est noté dans « Santé »).<br><button data-scm="recharger" class="scm-btn">↻ Recharger</button></div>';
    }
  }
  function saisieEnCours() {
    var a = document.activeElement, corps = $("scm-corps");
    return !!(a && corps && corps.contains(a) && /^(TEXTAREA|INPUT)$/.test(a.tagName) && a.getAttribute("data-scm-garder") !== null);
  }
  function dessiner0() {
    majBadge();
    var haut = $("scm-haut"), corps = $("scm-corps"), pied = $("scm-pied");
    if (!haut || !corps || !pied) return;
    if (estConv() && !conv(S.vue) && S.pret) { S.vue = "liste"; S.piedPour = null; }
    if (!estConv()) ecrire("scm-vue", S.vue);
    haut.innerHTML = htmlHaut();
    // Mohamed est en train d'écrire (recherche, message de relance) : on ne casse pas sa saisie
    if (saisieEnCours()) {
      S.renduEnAttente = true;
      if (S.vue === "liste" && $("scm-lz")) $("scm-lz").innerHTML = htmlListeLignes();
    } else {
      S.renduEnAttente = false;
      corps.innerHTML = htmlCorps();
      if (S.vue === "relances") {
        var tas = corps.querySelectorAll("textarea[data-scm-rel]");
        for (var i = 0; i < tas.length; i++) hauteurRel(tas[i]);
        if (S.surligner) {
          var el = $("rel-" + S.surligner); S.surligner = null;
          if (el) { el.classList.add("scm-flash"); setTimeout(function () { el.scrollIntoView({ block: "center" }); }, 30); }
        }
      }
    }
    var x = estConv() ? conv(S.vue) : null;
    var cle = x ? String(x.id) + "|" + (x.peut_repondre === false ? "fermee" : "ouverte") + "|" + (S.horsLigne ? "off" : "on") : "";
    if (S.piedPour !== cle) {
      pied.innerHTML = x ? htmlPied(x) : "";
      S.piedPour = cle;
      var ta = $("scm-txt");
      if (ta) { ta.value = S.brouillons[x.id] || ""; hauteur(ta); majLienFerme(); }
    }
    if (x) {
      var info = $("scm-info");
      if (info) {
        var montrer = etatNumero(x).code === "auto";
        info.style.display = montrer ? "" : "none";
      }
      majChipRelance(x);
    }
    etatEnvoi();
  }

  /* ---------- en-tête : onglets + état du système */
  function etatSysteme() {
    if (S.horsLigne) return ["rouge", "📴 Pas de connexion internet"];
    if (reglage("ia_pause", false)) return ["rouge", "⏸ IA en pause pour tout le monde"];
    var nonLues = S.erreurs.filter(function (e) { return !e.vu; }).length;
    var pb = S.sante && S.sante.verifs ? S.sante.verifs.filter(function (v) { return v.ok === false && v.cle !== "erreurs"; }).length : 0;
    if (S.sante && S.sante.erreur) pb++;
    if (S.avert) pb++;
    var total = pb + (nonLues ? 1 : 0);
    if (total) return ["ambre", "⚠️ " + total + (total > 1 ? " points à vérifier" : " point à vérifier")];
    if (!S.sante) return ["gris", S.santeCharge ? "… Vérification du système" : "Santé du système"];
    return ["vert", "✅ Tout fonctionne · IA " + (reglage("ia_nouveaux", true) ? "active" : "seulement sur tes clients activés")];
  }
  function htmlHaut() {
    if (estConv() && connecte() && S.pret && conv(S.vue)) return S.horsLigne ? '<div class="scm-hors">📴 Pas de connexion : rien ne peut partir pour l\'instant.</div>' : "";
    var n = aTraiter(), r = S.relances.filter(function (x) { return x.statut !== "fait" && x.reponse; }).length + autoAEnvoyer().length;
    var e = etatSysteme();
    var av = S.regles.filter(function (x) { return x.statut === "a_valider"; }).length;
    return '<div class="scm-seg trois">' +
      '<button data-scm="vue" data-v="liste" class="' + (S.vue === "liste" ? "on" : "") + '"><span class="ico">💬 </span>Discussions' + (n ? ' <i class="navdot">' + n + "</i>" : "") + "</button>" +
      '<button data-scm="vue" data-v="relances" class="' + (S.vue === "relances" ? "on" : "") + '"><span class="ico">📤 </span>Relances' + (r ? ' <span class="scm-cnt">' + r + "</span>" : "") + "</button>" +
      '<button data-scm="vue" data-v="regles" class="' + (S.vue === "regles" ? "on" : "") + '"><span class="ico">📚 </span>Règles' + (av ? ' <span class="scm-cnt ambre">' + av + "</span>" : "") + "</button></div>" +
      '<button class="scm-sys ' + e[0] + (S.vue === "sante" ? " on" : "") + '" data-scm="vue" data-v="sante"><span>' + esc(e[1]) + "</span><b>›</b></button>";
  }

  function htmlCorps() {
    if (!connecte()) return '<div class="scm-vide">Connecte-toi (Réglages → Synchronisation) pour voir tes messages WhatsApp ici.</div>';
    if (S.erreur) return '<div class="scm-vide">Messages indisponibles : ' + esc(S.erreur) + '<br><button data-scm="recharger" class="scm-btn">↻ Réessayer</button></div>';
    if (!S.pret) return '<div class="scm-vide">Chargement des conversations…</div>';
    if (S.vue === "relances") return htmlRelances();
    if (S.vue === "sante") return htmlSante();
    if (S.vue === "regles") return htmlRegles();
    if (estConv()) { var cc = conv(S.vue); return cc ? htmlEnteteFil(cc) + htmlFil(cc) : htmlListe(); }
    return htmlListe();
  }

  /* ---------- liste des conversations */
  function htmlListe() {
    var h = '<div class="scm-cherche"><input id="scm-q" data-scm-garder type="search" placeholder="🔎 Rechercher un client, un numéro…" value="' + esc(S.recherche) + '" autocomplete="off"></div>';
    return h + '<div id="scm-lz">' + htmlListeLignes() + "</div>";
  }
  function htmlListeLignes() {
    var l = visibles();
    var q = String(S.recherche || "").trim().toLowerCase();
    if (q) {
      var qd = chiffres(q);
      l = l.filter(function (c) {
        return nomDe(c).toLowerCase().indexOf(q) >= 0 || String(c.dernier_texte || "").toLowerCase().indexOf(q) >= 0 ||
          (qd.length >= 3 && (chiffres(c.tel).indexOf(qd) >= 0 || telLocal(c.tel).indexOf(qd) >= 0));
      });
      if (!l.length) return '<div class="scm-vide">Aucun client ne correspond à « ' + esc(S.recherche) + " ».</div>";
    }
    var doss = q ? "" : htmlDossiers();
    if (!l.length) return doss + '<p class="scm-intro">L\'IA répond seule à tes clients sur le 0497. Ici tu vois tout, et tu reprends la main quand tu veux.</p><div class="scm-vide">Aucune conversation pour l\'instant. Dès qu\'un client écrit sur le 0497, elle apparaît ici.</div>';
    var toi = l.filter(attendToi);
    var main = l.filter(function (c) { return c.statut === "open" && !attendToi(c); });
    var ia = l.filter(function (c) { return c.statut !== "open" && c.statut !== "resolved" && !attendToi(c); });
    var fin = l.filter(function (c) { return c.statut === "resolved"; });
    function bloc(titre, cl, liste, aide) {
      if (!liste.length) return "";
      return '<p class="scm-grp ' + cl + '"><i></i>' + titre + ' <span class="scm-cnt">' + liste.length + "</span></p>" + (aide ? '<p class="scm-aide">' + aide + "</p>" : "") +
        '<div class="scm-liste">' + liste.map(ligne).join("") + "</div>";
    }
    var h = doss;
    h += bloc("À toi de répondre", "toi", toi, "Ces clients attendent ta réponse.");
    h += bloc("Tu as la main", "main", main, "");
    h += bloc("L'IA s'en occupe", "ia", ia, "");
    if (fin.length) {
      var vus = S.voirTerminees || q ? fin : fin.slice(0, 5);
      h += bloc("Terminées", "fin", vus, "");
      if (fin.length > vus.length) h += '<button data-scm="voir-terminees" class="scm-plus">Voir les ' + fin.length + " conversations terminées</button>";
    }
    return h;
  }
  function ligne(c) {
    var etat = retardIA(c) ? "retard" : c.statut === "open" ? "toi" : c.statut === "resolved" ? "fin" : "ia";
    var qui = c.dernier_auteur === "ia" ? "🤖 " : c.dernier_auteur === "mohamed" ? "Toi : " : "";
    var tags = "";
    if (retardIA(c)) tags += '<i class="scm-t rouge">IA en retard</i>';
    if (c.priorite === "urgent") tags += '<i class="scm-t rouge">Urgent</i>';
    var en = etatNumero(c);
    if (en.code === "main") tags += '<i class="scm-t gris">✋ Toi</i>';
    else if (en.code === "pause") tags += '<i class="scm-t gris">⏸ Pause</i>';
    else if (en.code === "attente") tags += '<i class="scm-t rouge">🙋 Attente responsable</i>';
    if (relancesPour(c).length) tags += '<i class="scm-t bleu">📤 Relance prête</i>';
    (c.etiquettes || []).forEach(function (e) {
      if (e === "reclamation" && c.priorite === "urgent") return;
      var cl = e === "reclamation" ? "rouge" : e === "reservation" ? "vert" : e === "annulation" ? "ambre" : "bleu";
      tags += '<i class="scm-t ' + cl + '">' + esc(e) + "</i>";
    });
    return '<button class="scm-row" data-scm="ouvrir" data-id="' + c.id + '">' +
      '<span class="scm-av ' + etat + '">' + esc(initiales(c.nom)) + "</span>" +
      '<span class="scm-mid"><span class="scm-l1"><b>' + esc(nomDe(c)) + "</b><time>" + esc(quandCourt(c.dernier_le)) + "</time></span>" +
      '<span class="scm-l2">' + esc(qui + (c.dernier_texte || "…")) + "</span>" +
      (tags ? '<span class="scm-tags">' + tags + "</span>" : "") + "</span>" +
      ((c.non_lus || 0) > 0 ? '<i class="navdot">' + c.non_lus + "</i>" : "") + "</button>";
  }

  /* ---------- fil d'une conversation */
  function htmlEnteteFil(c) {
    var e0 = etatNumero(c).code;
    var etat = c.statut === "resolved" ? '<span class="scm-etat fin">Terminée</span>'
      : e0 === "auto" ? '<span class="scm-etat ia">🤖 L\'IA répond</span>'
      : '<span class="scm-etat toi">✋ Toi</span>';
    var h = '<div class="scm-th"><button data-scm="retour" class="scm-back" aria-label="Retour">‹</button>' +
      '<div class="scm-who"><b>' + esc(nomDe(c)) + "</b>" +
      (c.tel && !/^\+000/.test(c.tel) ? '<button data-scm="copier" data-t="' + esc(telLocal(c.tel)) + '">' + esc(telLisible(c.tel)) + " · copier</button>" : '<small>Chat du site (test)</small>') +
      "</div>" + etat + "</div>";
    var en = etatNumero(c);
    h += '<div class="scm-etat-c e-' + en.code + '"><b>' + esc(en.label) + "</b><small>" + esc(en.sous) + "</small>" +
      '<div class="scm-cmd" role="group" aria-label="Qui répond à ce client ?">' +
      '<button data-scm="cmd" data-mode="robot" class="' + (en.code === "auto" ? "on" : "") + '">🤖 Rendre au robot</button>' +
      '<button data-scm="cmd" data-mode="main" class="' + (en.code === "main" ? "on" : "") + '">✋ Je prends la main</button>' +
      '<button data-scm="cmd" data-mode="pause" class="' + (en.code === "pause" ? "on" : "") + '">⏸ Pause</button></div></div>';
    dossiersPour(c).forEach(function (d) { h += carteDossier(d, true); });
    var actions = "";
    if (c.statut !== "resolved") actions += '<button data-scm="terminer" class="scm-btn">✓ Terminer</button>';
    if (c.tel && !/^\+000/.test(c.tel)) actions += '<a class="scm-btn wa-txt" href="' + esc(waLien(c.tel, "")) + '">💬 Ouvrir dans WhatsApp</a>';
    if (actions) h += '<div class="scm-acts">' + actions + "</div>";
    var tags = (c.etiquettes || []);
    if (c.priorite === "urgent" || tags.indexOf("reclamation") >= 0) {
      h += '<div class="scm-ban rouge">⚠️ ' + esc(c.alerte ? c.alerte.replace(/^⚠️\s*/, "") : "Client à rassurer : réponds-lui toi-même.") + "</div>";
    } else if (tags.indexOf("reservation") >= 0 && c.alerte && /^✅/.test(c.alerte)) {
      h += '<div class="scm-ban vert">' + esc(c.alerte) + ' <button data-scm="aller-demandes">Voir les demandes →</button></div>';
    }
    if (retardIA(c)) h += '<div class="scm-ban rouge">⏱ Ce client attend depuis plus de 10 min et l\'IA n\'a pas répondu : réponds-lui (et regarde « Santé »).</div>';
    relancesPour(c).slice(0, 1).forEach(function (r) {
      var k = catDe(r);
      h += '<div class="scm-ban bleu"><span>📤 Relance prête · <b>' + esc(k.nom) + "</b></span>" +
        '<span class="scm-ban-b"><button data-scm="rel-dans-pied" data-id="' + esc(r.id) + '">Mettre dans ma réponse</button>' +
        '<button data-scm="voir-relance" data-id="' + esc(r.id) + '">Voir la fiche</button></span></div>';
    });
    var b = rdvDe(c);
    if (b) {
      var d = new Date(b.date + "T12:00:00");
      h += '<div class="scm-rdv">📅 Prochain RDV : <b>' + esc(JOURS[d.getDay()] + " " + d.getDate() + " " + MOIS_L[d.getMonth()].slice(0, 4) + ".") +
        (b.heure ? " · " + esc(b.heure) : "") + "</b>" + (b.adresse ? " · " + esc(b.adresse) : "") + "</div>";
    }
    return h;
  }
  function htmlFil(c) {
    var l = S.msgs[c.id];
    if (!l) return '<div class="scm-vide">Chargement…</div>';
    if (!l.length) return '<div class="scm-vide">Pas encore de message enregistré ici pour ce client (seuls les messages depuis la mise en route apparaissent).</div>';
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
  function coches(m) {
    if (m.auteur === "client" || m.auteur === "note") return "";
    if (m.statut === "failed") return ' · <b class="scm-err">⚠️ non délivré</b>';
    if (m.statut === "read") return ' <span class="scm-lu" title="Lu">✓✓</span>';
    if (m.statut === "delivered") return ' <span title="Reçu">✓✓</span>';
    if (m.statut === "sent") return ' <span title="Envoyé">✓</span>';
    return "";
  }
  function bulle(m, d) {
    var heure = "<time>" + hm(d) + coches(m) + "</time>";
    if (m.auteur === "note") return '<div class="scm-note">📝 ' + liens(m.texte || "") + heure + "</div>";
    var cl = m.auteur === "client" ? "c" : m.auteur === "mohamed" ? "mo" : "ia";
    var qui = m.auteur === "ia" ? "<small>🤖 IA</small>" : m.auteur === "mohamed" ? "<small>Toi</small>" : "";
    var err = m.statut === "failed" && m.erreur ? '<p class="scm-err">' + esc(m.erreur) + "</p>" : "";
    return '<div class="scm-b ' + cl + '">' + qui + pieces(m) + (m.texte ? "<p>" + liens(m.texte) + "</p>" : "") + err + heure + "</div>";
  }
  function htmlRapides(c) {
    var h = '<div class="scm-rap">';
    relancesPour(c).slice(0, 1).forEach(function (r) { h += '<button class="rel" data-scm="rel-dans-pied" data-id="' + esc(r.id) + '">📤 Relance prête</button>'; });
    return h + RAPIDES.map(function (r, i) { return '<button data-scm="rapide" data-i="' + i + '">' + esc(r[0]) + "</button>"; }).join("") + "</div>";
  }
  function htmlPied(c) {
    if (c.peut_repondre === false) {
      return '<div class="scm-pied ferme"><p class="scm-ferme"><b>🔒 Fenêtre WhatsApp fermée.</b> Le client n\'a pas écrit depuis plus de 24 h : WhatsApp n\'autorise l\'envoi que depuis ton téléphone. Écris ici, puis « Ouvrir WhatsApp » : le message sera déjà rempli (et copié).</p>' +
        htmlRapides(c) + '<textarea id="scm-txt" rows="3" placeholder="Ton message pour ' + esc(prenomDe(c) || "ce client") + '…"></textarea>' +
        '<div class="scm-2"><a id="scm-walien" class="scm-btn wa" data-scm="pied-wa" href="#">💬 Ouvrir WhatsApp</a><button data-scm="copier-txt" class="scm-btn">📋 Copier</button></div></div>';
    }
    return '<div class="scm-pied">' + htmlRapides(c) +
      '<p id="scm-info" class="scm-info">✋ En envoyant, tu prends la main : l\'IA se met en retrait pour ce client.</p>' +
      '<div class="scm-saisie"><textarea id="scm-txt" rows="2" placeholder="Écrire à ' + esc(prenomDe(c) || "ce client") + '…"></textarea>' +
      '<button id="scm-envoi" data-scm="envoyer" class="scm-send" aria-label="Envoyer">➤</button></div></div>';
  }
  function majChipRelance(c) {
    var b = document.querySelector("#scm-pied .scm-rap button.rel");
    var aRel = relancesPour(c).length > 0;
    if (!!b !== aRel) { S.piedPour = null; var pied = $("scm-pied"); if (pied && !(document.activeElement && document.activeElement.id === "scm-txt")) { var v = $("scm-txt") ? $("scm-txt").value : ""; pied.innerHTML = htmlPied(c); S.piedPour = String(c.id) + "|" + (c.peut_repondre === false ? "fermee" : "ouverte") + "|" + (S.horsLigne ? "off" : "on"); var ta = $("scm-txt"); if (ta) { ta.value = v; hauteur(ta); majLienFerme(); } } }
  }
  function majLienFerme() {
    var a = $("scm-walien"), ta = $("scm-txt"), c = estConv() ? conv(S.vue) : null;
    if (a && ta && c) a.setAttribute("href", waLien(c.tel, ta.value));
  }
  function etatEnvoi() {
    var b = $("scm-envoi"), ta = $("scm-txt"); if (!b || !ta) return;
    b.disabled = S.envoi || S.horsLigne || !ta.value.trim(); b.textContent = S.envoi ? "…" : "➤";
  }

  /* ---------- relances */
  function autoAEnvoyer() { return S.auto.filter(function (x) { return x.statut === "attente_modele"; }); }
  function htmlSousRel() {
    var na = autoAEnvoyer().length, np = S.auto.filter(function (x) { return x.statut === "prevu"; }).length;
    return '<div class="scm-sous"><button data-scm="rel-mode" data-m="manuel" class="' + (S.relMode !== "auto" ? "on" : "") + '">✍️ Préparées</button>' +
      '<button data-scm="rel-mode" data-m="auto" class="' + (S.relMode === "auto" ? "on" : "") + '">🤖 Automatiques' + (na ? ' <span class="scm-cnt ambre">' + na + "</span>" : np ? ' <span class="scm-cnt">' + np + "</span>" : "") + "</button></div>";
  }
  function htmlRelances() {
    if (S.relMode === "auto") return htmlSousRel() + htmlAuto();
    var tous = S.relances;
    if (!tous.length) return htmlSousRel() + '<div class="scm-vide">Aucune relance préparée.</div>';
    var msgs = tous.filter(function (r) { return r.reponse; });
    var faits = msgs.filter(function (r) { return r.statut === "fait"; }).length;
    var pct = msgs.length ? Math.round(faits / msgs.length * 100) : 0;
    var h = htmlSousRel();
    if (S.demanderEnvoye) {
      var rq = relance(S.demanderEnvoye);
      if (rq && rq.statut !== "fait") {
        h += '<div class="scm-question"><p>Tu as envoyé le message à <b>' + esc(rq.client) + "</b> ?</p>" +
          '<div class="scm-2"><button class="scm-btn ok" data-scm="rel-oui" data-id="' + esc(rq.id) + '">✓ Oui, envoyé</button><button class="scm-btn" data-scm="rel-pas-encore">Pas encore</button></div></div>';
      } else S.demanderEnvoye = null;
    }
    h += '<div class="scm-prog"><div class="scm-track"><div class="scm-fill" style="width:' + pct + '%"></div></div><span>' + faits + " / " + msgs.length + " messages envoyés</span></div>";
    h += '<div class="scm-chips">';
    var afaire = tous.filter(function (r) { return r.statut !== "fait"; });
    h += '<button data-scm="rel-filtre" data-f="tout" class="' + (S.filtreRel === "tout" ? "on" : "") + '">Tout <span>' + afaire.length + "</span></button>";
    CATS.forEach(function (k) {
      var nb = afaire.filter(function (r) { return catDe(r).cle === k[0]; }).length;
      var total = tous.filter(function (r) { return catDe(r).cle === k[0]; }).length;
      if (!total) return;
      h += '<button data-scm="rel-filtre" data-f="' + k[0] + '" class="c-' + k[3] + (nb ? "" : " vide") + (S.filtreRel === k[0] ? " on" : "") + '"><i></i>' + esc(k[1]) + " <span>" + nb + "</span></button>";
    });
    h += '</div><label class="scm-tog"><input type="checkbox" data-scm="rel-masquer"' + (S.masquerFaits ? " checked" : "") + "> Masquer les messages déjà envoyés</label>";
    h += '<p class="scm-intro">Chaque message est prêt : retouche-le si tu veux, puis <b>Ouvrir WhatsApp</b> (le texte est déjà écrit et copié) ou <b>Envoyer d\'ici</b> quand c\'est possible. Dès que tu écris à un client, l\'IA se coupe pour lui.</p>';
    var rien = true;
    CATS.forEach(function (k) {
      if (S.filtreRel !== "tout" && S.filtreRel !== k[0]) return;
      var l = tous.filter(function (r) { return catDe(r).cle === k[0] && !(S.masquerFaits && r.statut === "fait"); })
        .sort(function (a, b) {
          return ((a.statut === "fait") - (b.statut === "fait")) || ((a.prio === "aujourdhui" ? 0 : 1) - (b.prio === "aujourdhui" ? 0 : 1)) || ((Number(a.ordre) || 0) - (Number(b.ordre) || 0));
        });
      if (!l.length) return;
      rien = false;
      h += '<div class="scm-cat-t c-' + k[3] + '"><span class="scm-tag ' + k[3] + '">' + k[2] + " " + esc(k[1]) + '</span><span class="scm-cnt">' + l.length + '</span></div><p class="scm-aide">' + esc(k[4]) + "</p>" + l.map(carteRel).join("");
    });
    if (rien) h += '<div class="scm-vide">🎉 Rien à relancer ici' + (S.masquerFaits ? " (les messages envoyés sont masqués)" : "") + ".</div>";
    return h;
  }
  function carteRel(r) {
    var fait = r.statut === "fait", k = catDe(r);
    var aTel = !!(r.wa && r.tel && r.tel !== "—");
    var c = aTel ? convPourWa(r.wa) : null;
    var h = '<article class="scm-rc c-' + k.cl + (fait ? " fait" : "") + '" id="rel-' + esc(r.id) + '">';
    h += '<div class="scm-rc-h"><span class="scm-tag ' + k.cl + '">' + k.ico + " " + esc(k.nom) + "</span>" +
      (r.prio === "aujourdhui" && !fait ? '<span class="scm-tag rouge">Urgent</span>' : "") +
      (r.prio === "verifier" && !fait ? '<span class="scm-tag ambre">À vérifier</span>' : "") +
      (fait ? '<span class="scm-tag vert">✓ Envoyé ' + esc(quandLong(r.envoye_le)) + (r.envoye_par === "whatsapp" ? " (détecté)" : "") + "</span>" : "") + "</div>";
    h += '<div class="scm-rc-who"><b>' + esc(r.client) + "</b>" +
      (aTel ? '<button data-scm="copier" data-t="' + esc(telLocal(r.wa)) + '">' + esc(telLisible(r.wa)) + "</button>" : "") +
      (c ? '<button data-scm="ouvrir" data-id="' + c.id + '">💬 Voir la conversation</button>' : "") + "</div>";
    if (r.rdv && r.rdv !== "Aucun") h += '<p class="scm-rc-rdv">📅 ' + esc(r.rdv) + "</p>";
    if (fait) {
      h += '<div class="scm-rc-bas"><button data-scm="rel-fait" data-id="' + esc(r.id) + '" class="scm-lien">↺ Annuler « envoyé »</button>' + detailRel(r, aTel) + "</div></article>";
      return h;
    }
    if (!r.reponse) {
      h += '<p class="scm-rc-act">👉 ' + esc(r.action || "") + "</p>" + (r.situation ? '<p class="scm-rc-sit">' + esc(r.situation) + "</p>" : "");
      h += '<button data-scm="rel-fait" data-id="' + esc(r.id) + '" class="scm-btn ok plein">✓ C\'est fait</button></article>';
      return h;
    }
    if (r.incertitude) h += '<p class="scm-rc-warn">⚠️ <b>Avant d\'envoyer :</b> ' + esc(r.incertitude) + "</p>";
    var t = texteRel(r), modifie = typeof S.relEdits[r.id] === "string" && S.relEdits[r.id] !== r.reponse;
    h += '<div class="scm-bulle"><textarea data-scm-rel="' + esc(r.id) + '" data-scm-garder rows="4" aria-label="Message pour ' + esc(r.client) + '">' + esc(t) + "</textarea>" +
      '<span class="scm-bulle-p">✏️ Tu peux modifier le texte</span></div>';
    if (modifie) h += '<button data-scm="rel-reset" data-id="' + esc(r.id) + '" class="scm-lien">↺ Revenir au message préparé</button>';
    var d = directPossible(r);
    h += '<div class="scm-rc-actions">' +
      (aTel ? '<a class="scm-btn wa" data-scm="rel-wa" data-id="' + esc(r.id) + '" href="' + esc(waLien(r.wa, t)) + '">💬 Ouvrir WhatsApp</a>' : "") +
      '<button data-scm="rel-copier" data-id="' + esc(r.id) + '" class="scm-btn">📋 Copier</button>' +
      '<button data-scm="rel-fait" data-id="' + esc(r.id) + '" class="scm-btn ok">✓ Marquer envoyé</button>' +
      (aTel ? '<button data-scm="rel-direct" data-id="' + esc(r.id) + '" class="scm-btn bleu"' + (d.ok && !S.horsLigne ? "" : " disabled") + ">" + (S.envoiRel === r.id ? "Envoi…" : "🚀 Envoyer d'ici") + "</button>" : "") +
      "</div>";
    if (aTel && !d.ok) h += '<p class="scm-rc-lock">🔒 Envoi direct indisponible : ' + esc(d.pourquoi) + ". Utilise « Ouvrir WhatsApp ».</p>";
    if (S.confirmer === r.id && d.ok) {
      h += '<div class="scm-confirme"><p>Envoyer ce message à <b>' + esc(r.client) + "</b> maintenant, depuis le 0497 ?</p>" +
        '<div class="scm-2"><button data-scm="rel-direct-oui" data-id="' + esc(r.id) + '" class="scm-btn bleu">Oui, envoyer</button><button data-scm="rel-direct-non" class="scm-btn">Annuler</button></div></div>';
    }
    h += '<div class="scm-rc-bas">' + detailRel(r, aTel) + "</div></article>";
    return h;
  }
  function detailRel(r, aTel) {
    return '<details class="scm-det"><summary>Détail du dossier</summary>' +
      (r.situation ? "<p><b>Situation</b><br>" + esc(r.situation) + "</p>" : "") +
      (r.source ? "<p><b>Son dernier message</b><br>« " + esc(r.source) + " »</p>" : "") +
      (r.action && r.reponse ? "<p><b>Prochaine action</b><br>" + esc(r.action) + "</p>" : "") +
      (aTel && r.reponse ? '<p class="scm-aide">Si le bouton ouvre le mauvais WhatsApp : <a href="' + esc(waWeb(r.wa, texteRel(r))) + '" target="_blank" rel="noopener">autre lien</a>, ou « Copier » puis colle dans WhatsApp Business.</p>' : "") +
      "</details>";
  }

  /* ---------- messages automatiques */
  function modeAuto() { var m = reglage("auto_mode", null); return m === "actif" || m === "off" || m === "apercu" ? m : null; }
  function bandeauAuto() {
    var m = modeAuto(), hr = reglage("auto_heures", { debut: 9, fin: 20 }) || {};
    if (!m) return '<div class="scm-amode gris">Les messages automatiques ne sont pas encore installés.</div>';
    if (m === "off") return '<div class="scm-amode gris">⏸ <span><b>Coupés</b> : aucun message automatique n\'est préparé.</span><button class="scm-lien" data-scm="vue" data-v="sante">Réglages</button></div>';
    if (m === "apercu") return '<div class="scm-amode ambre">👀 <span><b>Mode aperçu</b> : rien n\'est envoyé à tes clients. Tu vois ici ce qui partirait, et quand.</span><button class="scm-lien" data-scm="vue" data-v="sante">Réglages</button></div>';
    return '<div class="scm-amode vert">🟢 <span><b>Actifs</b> : les messages partent tout seuls, entre ' + (hr.debut || 9) + " h et " + (hr.fin || 20) + ' h, après une dernière vérification.</span><button class="scm-lien" data-scm="vue" data-v="sante">Réglages</button></div>';
  }
  function carteAuto(x) {
    var t = AUTO[x.type] || ["🤖", x.type, ""];
    var cl = { prevu: "bleu", envoi: "bleu", attente_modele: "ambre", apercu: "violet", envoye: "vert", annule: "gris", echec: "rouge" }[x.statut] || "gris";
    var quand = x.statut === "prevu" ? "Prévu " + hhmm(new Date(x.prevu_le).getTime())
      : x.statut === "attente_modele" ? "À envoyer toi-même"
      : x.statut === "apercu" ? "Serait parti " + quandLong(x.envoye_le || x.prevu_le)
      : x.statut === "envoye" ? "✓ Envoyé " + quandLong(x.envoye_le)
      : x.statut === "envoi" ? "Envoi en cours…" : x.statut === "echec" ? "Échec" : "Annulé";
    var c = x.conv_id ? conv(x.conv_id) : null, fini = /^(envoye|annule|echec)$/.test(x.statut);
    var h = '<article class="scm-rc c-' + cl + (fini ? " fait" : "") + '" id="auto-' + x.id + '"><div class="scm-rc-h"><span class="scm-tag ' + (x.statut === "attente_modele" ? "ambre" : "bleu") + '">' + t[0] + " " + esc(t[1]) + '</span><span class="scm-tag ' + cl + '">' + esc(quand) + "</span></div>";
    h += '<div class="scm-rc-who"><b>' + esc(x.client || telLisible(x.tel) || "Client") + "</b>" +
      (x.tel ? '<button data-scm="copier" data-t="' + esc(telLocal(x.tel)) + '">' + esc(telLisible(x.tel)) + "</button>" : "") +
      (c ? '<button data-scm="ouvrir" data-id="' + c.id + '">💬 Voir la conversation</button>' : "") + "</div>";
    if (x.raison && x.statut !== "prevu") h += '<p class="scm-rc-lock">' + (x.statut === "annule" ? "🚫 " : x.statut === "echec" ? "⚠️ " : "ℹ️ ") + esc(x.raison) + "</p>";
    h += '<div class="scm-atxt">' + liens(x.texte || "").replace(/\n/g, "<br>") + "</div>";
    var b = "";
    if (x.statut === "attente_modele" || x.statut === "apercu") {
      b += (x.tel ? '<a class="scm-btn wa" data-scm="auto-wa" data-id="' + x.id + '" href="' + esc(waLien(x.tel, x.texte)) + '">💬 Ouvrir WhatsApp</a>' : "") +
        '<button class="scm-btn" data-scm="auto-copier" data-id="' + x.id + '">📋 Copier</button>' +
        '<button class="scm-btn ok" data-scm="auto-envoye" data-id="' + x.id + '">✓ Marquer envoyé</button>';
    }
    if (x.statut === "prevu" || x.statut === "attente_modele") b += '<button class="scm-btn" data-scm="auto-annuler" data-id="' + x.id + '">✕ Ne pas envoyer</button>';
    if (b) h += '<div class="scm-rc-actions">' + b + "</div>";
    if (S.demanderAuto === String(x.id) && !fini) {
      h += '<div class="scm-question"><p>Tu as envoyé ce message à <b>' + esc(x.client || telLisible(x.tel)) + "</b> ?</p>" +
        '<div class="scm-2"><button class="scm-btn ok" data-scm="auto-envoye" data-id="' + x.id + '">✓ Oui, envoyé</button><button class="scm-btn" data-scm="auto-pas-encore">Pas encore</button></div></div>';
    }
    return h + "</article>";
  }
  function htmlAuto() {
    var h = bandeauAuto();
    if (S.autoErreur) return h + '<div class="scm-vide">Messages automatiques illisibles : ' + esc(S.autoErreur) + "</div>";
    var semaine = Date.now() - 7 * 864e5;
    function recents(st) { return S.auto.filter(function (x) { return st.indexOf(x.statut) !== -1 && new Date(x.envoye_le || x.maj || x.prevu_le).getTime() > semaine; }); }
    var aEnv = autoAEnvoyer().sort(function (a, b) { return String(a.prevu_le).localeCompare(String(b.prevu_le)); });
    var prevus = S.auto.filter(function (x) { return x.statut === "prevu" || x.statut === "envoi"; }).sort(function (a, b) { return String(a.prevu_le).localeCompare(String(b.prevu_le)); });
    var apercus = recents(["apercu"]).sort(function (a, b) { return String(b.prevu_le).localeCompare(String(a.prevu_le)); });
    var envoyes = recents(["envoye"]).sort(function (a, b) { return String(b.envoye_le).localeCompare(String(a.envoye_le)); });
    var autres = recents(["annule", "echec"]).sort(function (a, b) { return String(b.maj).localeCompare(String(a.maj)); });
    if (aEnv.length) h += '<div class="scm-cat-t c-ambre"><span class="scm-tag ambre">✋ À envoyer toi-même</span><span class="scm-cnt ambre">' + aEnv.length + '</span></div><p class="scm-aide">WhatsApp n\'autorise pas l\'envoi automatique (le client n\'a pas écrit depuis 24 h et le modèle Meta n\'est pas encore validé) : ouvre WhatsApp, le texte est prêt.</p>' + aEnv.map(carteAuto).join("");
    h += '<div class="scm-cat-t c-bleu"><span class="scm-tag bleu">🕐 Prévus</span><span class="scm-cnt">' + prevus.length + "</span></div>";
    h += prevus.length ? prevus.map(carteAuto).join("") : '<p class="scm-aide">Rien de prévu pour l\'instant. Les messages se préparent tout seuls (toutes les 15 min) à partir de l\'agenda et des conversations.</p>';
    if (apercus.length) h += '<div class="scm-cat-t c-violet"><span class="scm-tag violet">👀 Aperçu : ce qui serait parti</span><span class="scm-cnt">' + apercus.length + "</span></div>" + apercus.map(carteAuto).join("");
    if (envoyes.length) h += '<div class="scm-cat-t c-vert"><span class="scm-tag vert">✓ Envoyés (7 jours)</span><span class="scm-cnt">' + envoyes.length + "</span></div>" + envoyes.map(carteAuto).join("");
    if (autres.length) h += '<details class="scm-det scm-auto-det"><summary>🚫 Annulés ou en échec (7 jours) : ' + autres.length + "</summary>" + autres.map(carteAuto).join("") + "</details>";
    h += '<p class="scm-grp">Les règles</p><div class="scm-carte scm-aregles">' + AUTO_ORDRE.map(function (k) { return "<p><b>" + AUTO[k][0] + " " + esc(AUTO[k][1]) + "</b> — " + esc(AUTO[k][2]) + "</p>"; }).join("") +
      "<p><b>Jamais</b> : la nuit, à un client qui a dit stop, à un client avec une réclamation ou une demande transmise ouverte, à un client en pause. La relance s\'arrête aussi dès que tu écris au client ou qu\'il répond. Un seul message automatique par client et par jour (sauf le rappel de RDV).</p></div>";
    return h;
  }
  function htmlReglagesAuto() {
    var m = modeAuto();
    if (!m) return "";
    var types = reglage("auto_types", {}) || {};
    var h = '<p class="scm-grp">Messages automatiques</p><div class="scm-carte">' +
      '<div class="scm-ctrl"><select id="scm-auto-mode" data-scm-reglage="auto_mode" aria-label="Mode des messages automatiques">' +
      [["apercu", "👀 Aperçu"], ["actif", "🟢 Actifs"], ["off", "⏸ Coupés"]].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === m ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") +
      '</select><div class="scm-ctrl-t"><b>Mode</b><small>' + (m === "actif" ? "Les messages partent vraiment, aux heures prévues." : m === "apercu" ? "Rien n'est envoyé : tu vois ce qui partirait (Relances → Automatiques)." : "Aucun message automatique.") + "</small></div></div>";
    if (S.confirmer === "auto-actif") {
      h += '<div class="scm-confirme scm-marge"><p><b>Activer pour de vrai ?</b> Les rappels, suivis, avis et relances partiront tout seuls à tes clients, selon les règles de l\'onglet Relances → Automatiques.</p>' +
        '<div class="scm-2"><button class="scm-btn bleu" data-scm="auto-actif-oui">Oui, activer</button><button class="scm-btn" data-scm="auto-actif-non">Annuler</button></div></div>';
    }
    h += AUTO_ORDRE.map(function (k) {
      var on = types[k] !== false;
      return '<div class="scm-ctrl"><button class="scm-switch' + (on ? " on" : "") + '" role="switch" aria-checked="' + on + '" data-scm="auto-type" data-t="' + k + '" aria-label="' + esc(AUTO[k][1]) + '"><span></span></button>' +
        '<div class="scm-ctrl-t"><b>' + AUTO[k][0] + " " + esc(AUTO[k][1]) + "</b><small>" + esc(AUTO[k][2]) + "</small></div></div>";
    }).join("");
    h += '<div class="scm-v"><span>🙅</span><div><b>Ne veulent plus de messages</b><small>' + (S.optout.length ? S.optout.length + " client(s) : " + S.optout.slice(0, 8).map(function (o) { return telLisible(o.tel); }).join(", ") + (S.optout.length > 8 ? "…" : "") : "aucun pour l'instant (dès qu'un client écrit « stop », il est ajouté ici)") + "</small></div></div>";
    return h + "</div>";
  }

  /* ---------- dossiers « À traiter » */
  function rdvAutour(tel) {
    try {
      var d = chiffres(tel).slice(-9); if (!d || !window.DB || !window.DB.bookings) return [];
      var l = window.DB.bookings.filter(function (b) { return chiffres(b.telephone).slice(-9) === d; })
        .sort(function (x, y) { return (String(y.date) + String(y.heure || "")).localeCompare(String(x.date) + String(x.heure || "")); });
      return l.slice(0, 2);
    } catch (e) { return []; }
  }
  function carteDossier(d, dansFil) {
    var c = d.conv_id ? conv(d.conv_id) : null;
    var cl = d.type === "incident" ? "rouge" : d.type === "transfert" ? "bleu" : "ambre";
    var titre = (d.type === "incident" ? "⚠️ " : d.type === "transfert" ? "🙋 " : "🔔 ") + (DOSS[d.categorie] || DOSS.autre);
    var h = '<article class="scm-dos c-' + cl + '" id="dos-' + d.id + '"><div class="scm-rc-h"><span class="scm-tag ' + cl + '">' + esc(titre) + "</span>" +
      (d.type === "incident" ? '<span class="scm-tag ' + (d.niveau === "confirme" ? "rouge" : "gris") + '">' + (d.niveau === "confirme" ? "Confirmé" : d.niveau === "non_fonde" ? "Non fondé" : "Possible, à vérifier") + "</span>" : "") +
      '<time>' + esc(quandCourt(d.maj || d.cree_le)) + "</time></div>";
    if (!dansFil) h += '<div class="scm-rc-who"><b>' + esc(d.client || (c ? nomDe(c) : telLisible(d.tel)) || "Client") + "</b>" + (d.tel ? '<button data-scm="copier" data-t="' + esc(telLocal(d.tel)) + '">' + esc(telLisible(d.tel)) + "</button>" : "") + "</div>";
    if (d.resume) h += '<p class="scm-dos-r">' + esc(d.resume) + "</p>";
    if (d.action) h += '<p class="scm-rc-act">👉 ' + esc(d.action) + "</p>";
    if (d.extrait && !dansFil) h += '<p class="scm-dos-x">' + esc(d.extrait) + "</p>";
    rdvAutour(d.tel).forEach(function (b) {
      var passe = String(b.date) < new Date().toISOString().slice(0, 10);
      h += '<p class="scm-rc-rdv">📅 RDV ' + (passe ? "passé" : "prévu") + " : " + esc(b.date) + (b.heure ? " · " + esc(b.heure) : "") + " · statut agenda « " + esc(b.statut || "?") + " »" + (passe && d.categorie === "absence" ? " — à vérifier (un statut ne prouve rien)" : "") + "</p>";
    });
    h += '<div class="scm-dos-b">' + (!dansFil && c ? '<button class="scm-btn" data-scm="ouvrir" data-id="' + c.id + '">💬 Ouvrir</button>' : "") +
      '<button class="scm-btn ok" data-scm="dossier" data-id="' + d.id + '" data-statut="resolu">✓ ' + (d.type === "alerte" ? "Traité" : "Résolu") + "</button>" +
      (d.type === "incident" && d.niveau !== "confirme" ? '<button class="scm-btn" data-scm="dossier" data-id="' + d.id + '" data-niveau="confirme">Confirmer</button>' : "") +
      (d.type === "incident" ? '<button class="scm-btn" data-scm="dossier" data-id="' + d.id + '" data-niveau="non_fonde" data-statut="resolu">Pas un incident</button>' : "") +
      "</div></article>";
    return h;
  }
  function htmlDossiers() {
    var l = dossiersOuverts().slice().sort(function (a, b) {
      var r = function (d) { return d.type === "incident" ? 0 : d.type === "transfert" ? 1 : 2; };
      return (r(a) - r(b)) || String(b.maj || b.cree_le).localeCompare(String(a.maj || a.cree_le));
    });
    if (!l.length) return "";
    return '<p class="scm-grp toi"><i></i>À traiter <span class="scm-cnt rouge">' + l.length + '</span></p><p class="scm-aide">Incidents, demandes transmises par l\'IA et alertes : visibles jusqu\'à ce que tu les marques résolus. Tant qu\'un incident est ouvert, l\'IA ne reprend pas seule.</p>' +
      l.map(function (d) { return carteDossier(d, false); }).join("");
  }

  /* ---------- règles de l'IA */
  function htmlRegles() {
    var tous = S.regles;
    var nb = { tout: tous.filter(function (r) { return r.statut !== "archivee"; }).length,
      a_valider: tous.filter(function (r) { return r.statut === "a_valider"; }).length,
      validee: tous.filter(function (r) { return r.statut === "validee"; }).length,
      archivee: tous.filter(function (r) { return r.statut === "archivee"; }).length };
    var h = '<p class="scm-intro"><b>Les règles que l\'IA applique.</b> Seules les règles <b>validées</b> lui sont données. Corrige-les ici : la correction sert dès son prochain message. Ce qu\'écrit un client ne peut jamais changer ces règles.</p>';
    h += '<div class="scm-chips">' + [["tout", "Toutes"], ["a_valider", "À valider"], ["validee", "Validées"], ["archivee", "Archivées"]].map(function (f) {
      return '<button data-scm="regle-filtre" data-f="' + f[0] + '" class="' + (S.filtreRegle === f[0] ? "on" : "") + (f[0] === "a_valider" && nb.a_valider ? " c-ambre" : "") + '">' + (f[0] === "a_valider" && nb.a_valider ? "<i></i>" : "") + f[1] + " <span>" + nb[f[0]] + "</span></button>";
    }).join("") + "</div>";
    if (S.regleAjout) {
      h += '<div class="scm-regle neuve"><label class="scm-lab">Thème<select id="scm-r-theme">' + THEMES.map(function (t) { return '<option value="' + t[0] + '">' + esc(t[1]) + "</option>"; }).join("") + "</select></label>" +
        '<label class="scm-lab">Règle<textarea id="scm-r-texte" data-scm-garder rows="3" placeholder="Ex. : Le déplacement est offert jusqu\'à 15 km de Bruxelles."></textarea></label>' +
        '<div class="scm-2"><button class="scm-btn bleu" data-scm="regle-ajout-ok">Ajouter (validée)</button><button class="scm-btn" data-scm="regle-ajout-non">Annuler</button></div></div>';
    } else h += '<button class="scm-plus" data-scm="regle-ajout">+ Ajouter une règle</button>';
    if (!tous.length) return h + '<div class="scm-vide">Aucune règle pour le moment.</div>';
    THEMES.forEach(function (t) {
      var l = tous.filter(function (r) {
        return (r.theme === t[0] || (t[0] === "autre" && !THEME[r.theme])) && (S.filtreRegle === "tout" ? r.statut !== "archivee" : r.statut === S.filtreRegle);
      }).sort(function (a, b) { return ((a.statut === "a_valider" ? 0 : 1) - (b.statut === "a_valider" ? 0 : 1)) || ((Number(a.ordre) || 0) - (Number(b.ordre) || 0)); });
      if (!l.length) return;
      h += '<p class="scm-grp">' + esc(t[1]) + ' <span class="scm-cnt">' + l.length + "</span></p>" + l.map(carteRegle).join("");
    });
    return h;
  }
  function carteRegle(r) {
    var st = r.statut === "validee" ? '<span class="scm-tag vert">✓ Validée</span>' : r.statut === "a_valider" ? '<span class="scm-tag ambre">À valider</span>' : '<span class="scm-tag gris">Archivée</span>';
    var h = '<article class="scm-regle ' + r.statut + '" id="regle-' + r.id + '"><div class="scm-rc-h">' + st + "</div>";
    if (S.regleEdit === r.id) {
      h += '<textarea class="scm-r-edit" id="scm-r-edit" data-scm-garder rows="4">' + esc(r.texte) + "</textarea>" +
        '<div class="scm-2"><button class="scm-btn bleu" data-scm="regle-enreg" data-id="' + r.id + '">Enregistrer (validée)</button><button class="scm-btn" data-scm="regle-annul">Annuler</button></div>';
    } else h += '<p class="scm-regle-t">' + esc(r.texte) + "</p>";
    h += '<p class="scm-regle-s">Source : ' + esc(r.source || "non précisée") + (r.source_le ? " · " + esc(String(r.source_le).split("-").reverse().join("/")) : "") + "</p>";
    if (r.remarque) h += '<p class="scm-rc-warn">⚠️ ' + esc(r.remarque) + "</p>";
    if (S.regleEdit !== r.id) {
      h += '<div class="scm-dos-b">' +
        (r.statut === "a_valider" ? '<button class="scm-btn ok" data-scm="regle-valider" data-id="' + r.id + '">✓ Valider</button>' : "") +
        (r.statut !== "archivee" ? '<button class="scm-btn" data-scm="regle-modifier" data-id="' + r.id + '">✏️ Corriger</button><button class="scm-btn" data-scm="regle-archiver" data-id="' + r.id + '">Archiver</button>'
          : '<button class="scm-btn" data-scm="regle-restaurer" data-id="' + r.id + '">↺ Restaurer</button>') + "</div>";
    }
    return h + "</article>";
  }

  /* ---------- indicateurs */
  function htmlKpi() {
    var k = S.kpi;
    var h = '<p class="scm-grp">📊 Indicateurs <span class="scm-per">' + [7, 30].map(function (j) { return '<button data-scm="kpi-jours" data-j="' + j + '" class="' + (Number(S.kpiJours) === j ? "on" : "") + '">' + j + " j</button>"; }).join("") + "</span></p>";
    if (!k || S.kpiCharge) return h + '<div class="scm-vide">' + (S.kpiCharge ? "Calcul en cours…" : "") + "</div>";
    if (k.erreur) return h + '<div class="scm-vide">Indicateurs indisponibles : ' + esc(k.erreur) + "</div>";
    function tuile(v, l, d) { return '<div class="scm-kpi"><b>' + v + "</b><span>" + l + "</span>" + (d ? "<small>" + d + "</small>" : "") + "</div>"; }
    function min(m) { return m === null || m === undefined ? "—" : m < 1 ? "< 1 min" : m < 60 ? Math.round(m) + " min" : (Math.round(m / 6) / 10) + " h"; }
    var taux = k.dem ? Math.round(k.conf / k.dem * 100) + " %" : "—";
    h += '<div class="scm-kpis">' +
      tuile(k.demErreur ? "—" : k.dem, "demandes reçues", k.demErreur ? "illisible" : "site + IA") +
      tuile(k.demErreur ? "—" : k.conf, "RDV confirmés", k.attente ? k.attente + " encore à traiter" : "") +
      tuile(k.demErreur ? "—" : taux, "conversion", "confirmées ÷ reçues") +
      tuile(k.demErreur ? "—" : k.perdues, "demandes perdues", "annulées ou refusées") +
      tuile(min(k.medIA), "réponse de l'IA", k.nIA ? "médiane sur " + k.nIA : "pas de mesure") +
      tuile(min(k.medMo), "ta réponse", k.nMo ? "médiane sur " + k.nMo : "pas de mesure") +
      tuile(k.incOuverts, "incidents ouverts", k.incPeriode + " sur la période") +
      tuile(k.relEnv, "relances envoyées", "sur la période") + "</div>";
    h += '<p class="scm-aide">Chiffres observés sur les ' + k.jours + " derniers jours, rien d'estimé. Conversion = demandes confirmées ÷ demandes reçues sur la même période. Délais : temps entre le message d'un client et la première réponse (WhatsApp 0497, mesurés depuis le 6/10). " + (k.sans ? k.sans + " client(s) sans réponse depuis plus d'1 h." : "") + "</p>";
    return h;
  }

  /* ---------- santé */
  function htmlSante() {
    var h = '<div class="scm-sante-t"><div><b>Santé du système</b><small>' +
      (S.santeCharge ? "Vérification en cours…" : S.santeLe ? "Vérifié " + esc(quandLong(new Date(S.santeLe).toISOString())) : "Pas encore vérifié") +
      '</small></div><button data-scm="sante-verifier" class="scm-btn"' + (S.santeCharge ? " disabled" : "") + ">↻ Vérifier</button></div>";
    var v = (S.sante && S.sante.verifs) || [];
    var lignes = v.slice();
    lignes.push({ nom: "Ton app (cet appareil)", ok: !S.horsLigne && !S.avert, detail: (S.horsLigne ? "pas de connexion internet" : "en ligne") + " · temps réel " + (S.tempsReel === "ok" ? "connecté" : S.tempsReel === "ko" ? "coupé (recharge la page)" : "en cours") + (S.avert ? " · " + S.avert : "") + " · " + VERSION });
    if (S.sante && S.sante.erreur) lignes.unshift({ nom: "Contrôle du serveur", ok: false, detail: S.sante.erreur });
    h += '<div class="scm-carte">' + lignes.map(function (x) {
      var ic = x.ok === true ? "✅" : x.ok === false ? "⚠️" : "❔";
      return '<div class="scm-v ' + (x.ok === false ? "ko" : "") + '"><span>' + ic + "</span><div><b>" + esc(x.nom) + "</b><small>" + esc(x.detail || "") + "</small></div></div>";
    }).join("") + "</div>";

    var nouveaux = reglage("ia_nouveaux", true) !== false, pause = reglage("ia_pause", false) === true;
    h += '<p class="scm-grp">Réglages de l\'IA</p><div class="scm-carte">' +
      '<div class="scm-ctrl"><button class="scm-switch' + (nouveaux ? " on" : "") + '" role="switch" aria-checked="' + nouveaux + '" data-scm="reglage" data-cle="ia_nouveaux" aria-label="IA pour les nouveaux clients"><span></span></button>' +
      '<div class="scm-ctrl-t"><b>IA pour les nouveaux clients</b><small>' + (nouveaux ? "Elle répond aux clients à qui tu n'as jamais écrit." : "Elle ne répond qu'aux clients pour qui tu l'as activée.") + "</small></div></div>" +
      '<div class="scm-ctrl"><button class="scm-switch rouge' + (pause ? " on" : "") + '" role="switch" aria-checked="' + pause + '" data-scm="reglage" data-cle="ia_pause" aria-label="Frein d\'urgence"><span></span></button>' +
      '<div class="scm-ctrl-t"><b>Frein d\'urgence</b><small>' + (pause ? "Tiré : l'IA ne répond plus à personne, tous les messages arrivent chez toi." : "Si quelque chose ne va pas, tire-le : l'IA arrête de répondre à tout le monde.") + "</small></div></div>" +
      '<div class="scm-ctrl"><select id="scm-reprise" data-scm-reglage="reprise_heures" aria-label="Reprise automatique">' + [0, 6, 12, 24, 48].map(function (v) {
        var cur = Number(reglage("reprise_heures", 12)) || 0;
        return '<option value="' + v + '"' + (v === cur ? " selected" : "") + ">" + (v ? v + " h" : "Jamais") + "</option>";
      }).join("") + '</select><div class="scm-ctrl-t"><b>Reprise automatique</b><small>Quand tu as pris la main et que tu n\'écris plus pendant ce délai, l\'IA reprend au message suivant du client. Jamais après une pause ni avec un incident ouvert.</small></div></div></div>';

    h += htmlReglagesAuto();
    h += htmlKpi();
    var coupes = visibles().filter(function (c) { var f = S.ia[c.tel]; return f && f.ia === false; });
    var vu = {};
    coupes = coupes.filter(function (c) { if (vu[c.tel]) return false; vu[c.tel] = 1; return true; });
    h += '<p class="scm-grp">L\'IA ne répond pas à ' + coupes.length + " client" + (coupes.length > 1 ? "s" : "") + "</p>";
    if (coupes.length) {
      h += '<div class="scm-liste">' + coupes.map(function (c) {
        var f = S.ia[c.tel];
        return '<div class="scm-row plat"><span class="scm-av fin">' + esc(initiales(c.nom)) + '</span><span class="scm-mid"><span class="scm-l1"><b>' + esc(nomDe(c)) + "</b></span>" +
          '<span class="scm-l2">' + esc(etatNumero(c).label) + " · " + (f.par === "relance" ? "relance envoyée" : f.par === "pause" ? "pause" : f.par === "attente" ? "dossier ouvert" : "tu lui as écrit") + (f.maj ? " " + esc(quandLong(f.maj)) : "") + "</span></span>" +
          '<button class="scm-btn" data-scm="ouvrir" data-id="' + c.id + '">Ouvrir</button></div>';
      }).join("") + "</div>";
    } else h += '<p class="scm-aide">Aucun : l\'IA répond à tous tes clients.</p>';

    var errs = S.erreurs.slice(0, 30), nonLues = S.erreurs.filter(function (e) { return !e.vu; }).length;
    h += '<p class="scm-grp">Journal des erreurs (7 jours)' + (nonLues ? ' <span class="scm-cnt rouge">' + nonLues + " non lue" + (nonLues > 1 ? "s" : "") + "</span>" : "") + "</p>";
    if (!errs.length) h += '<p class="scm-aide">Aucune erreur ✨</p>';
    else {
      h += '<div class="scm-carte">' + errs.map(function (e) {
        return '<details class="scm-e' + (e.vu ? "" : " neuve") + '"><summary><span>' + esc(quandCourt(e.cree_le)) + " · " + esc(e.source) + "</span> " + esc(e.message) + "</summary>" +
          (e.detail ? "<pre>" + esc(e.detail) + "</pre>" : "") + "<small>" + esc(e.version || "") + "</small></details>";
      }).join("") + "</div>";
      if (nonLues) h += '<button class="scm-plus" data-scm="erreurs-vues">✓ Tout marquer comme lu</button>';
    }
    return h;
  }

  /* ------------------------------------------------------------ événements */
  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-scm]") : null;
    if (!el) return;
    var a = el.getAttribute("data-scm"), id = el.getAttribute("data-id");
    try {
      switch (a) {
        case "vue": S.vue = el.getAttribute("data-v"); S.piedPour = null; S.confirmer = null; S.regleEdit = null; if (S.vue === "sante") { verifierSante(true); chargerKpi(); } dessiner(); window.scrollTo(0, 0); break;
        case "ouvrir": ouvrir(id); break;
        case "retour": S.vue = "liste"; S.piedPour = null; dessiner(); window.scrollTo(0, 0); break;
        case "envoyer": e.preventDefault(); envoyer(); break;
        case "cmd": commandeIA(el.getAttribute("data-mode")); break;
        case "dossier": changerDossier(id, el.getAttribute("data-statut"), el.getAttribute("data-niveau")); break;
        case "regle-filtre": S.filtreRegle = el.getAttribute("data-f"); ecrire("scm5-regles", S.filtreRegle); dessiner(); break;
        case "regle-ajout": S.regleAjout = true; dessiner(); { var tx0 = $("scm-r-texte"); if (tx0) tx0.focus(); } break;
        case "regle-ajout-non": S.regleAjout = false; dessiner(); break;
        case "regle-ajout-ok": ajouterRegle(); break;
        case "regle-valider": ecrireRegle(id, { statut: "validee", valide_le: new Date().toISOString() }, "Règle validée : l'IA l'utilise dès maintenant."); break;
        case "regle-modifier": S.regleEdit = Number(id); dessiner(); { var te = $("scm-r-edit"); if (te) { te.focus(); hauteurRel(te); } } break;
        case "regle-annul": S.regleEdit = null; dessiner(); break;
        case "regle-enreg": { var te2 = $("scm-r-edit"); if (!te2 || te2.value.trim().length < 3) { ko("La règle est vide."); break; }
          ecrireRegle(id, { texte: te2.value.trim(), statut: "validee", valide_le: new Date().toISOString() }, "Règle corrigée : l'IA utilise la nouvelle version."); break; }
        case "regle-archiver": ecrireRegle(id, { statut: "archivee" }, "Règle archivée : l'IA ne l'utilise plus."); break;
        case "regle-restaurer": ecrireRegle(id, { statut: "a_valider" }, "Règle restaurée (à valider)."); break;
        case "kpi-jours": S.kpiJours = Number(el.getAttribute("data-j")) || 7; ecrire("scm5-kpi", S.kpiJours); S.kpi = null; chargerKpi(); break;
        case "terminer": terminer(); break;
        case "rel-mode": S.relMode = el.getAttribute("data-m") === "auto" ? "auto" : "manuel"; ecrire("scm6-relmode", S.relMode); S.demanderAuto = null; dessiner(); window.scrollTo(0, 0); break;
        case "auto-annuler": changerAuto(id, { statut: "annule", raison: "annulé par toi" }, "Ce message ne partira pas."); break;
        case "auto-envoye": S.demanderAuto = null; changerAuto(id, { statut: "envoye", envoye_le: new Date().toISOString(), raison: "envoyé par toi" }, "Noté comme envoyé."); break;
        case "auto-pas-encore": S.demanderAuto = null; dessiner(); break;
        case "auto-copier": { var xa = autoMsg(id); if (xa) copier(xa.texte || ""); break; }
        case "auto-wa": { var xw = autoMsg(id); if (xw) { copier(xw.texte || "", true); S.demanderAuto = String(xw.id); setTimeout(dessiner, 600); } break; }
        case "auto-type": { var tt = el.getAttribute("data-t"), cur = Object.assign({ relance_douce: true, rappel_veille: true, suivi_apres: true, avis: true }, reglage("auto_types", {}) || {}); cur[tt] = cur[tt] === false; changerReglage("auto_types", cur); break; }
        case "auto-actif-oui": S.confirmer = null; changerReglage("auto_mode", "actif"); break;
        case "auto-actif-non": S.confirmer = null; dessiner(); break;
        case "reglage": { var cle = el.getAttribute("data-cle"); changerReglage(cle, !(reglage(cle, cle === "ia_nouveaux") === true)); break; }
        case "sante-verifier": verifierSante(true); break;
        case "erreurs-vues": marquerErreursVues(); break;
        case "copier": copier(el.getAttribute("data-t") || ""); break;
        case "copier-txt": { var ta = $("scm-txt"); if (ta && ta.value.trim()) copier(ta.value); break; }
        case "pied-wa": { var t3 = $("scm-txt"); if (!t3 || !t3.value.trim()) { e.preventDefault(); ko("Écris d'abord ton message."); break; } copier(t3.value, true); break; }
        case "rel-copier": { var r1 = relance(id); if (r1) copier(texteRel(r1)); break; }
        case "rel-wa": { var r2 = relance(id); if (r2) { copier(texteRel(r2), true); S.ouvertWa = { id: id, le: Date.now() }; } break; }
        case "rel-fait": cocherRelance(id); break;
        case "rel-oui": cocherRelance(id, true); break;
        case "rel-pas-encore": S.demanderEnvoye = null; S.ouvertWa = null; dessiner(); break;
        case "rel-direct": S.confirmer = id; dessiner(); break;
        case "rel-direct-non": S.confirmer = null; dessiner(); break;
        case "rel-direct-oui": envoyerRelance(id); break;
        case "rel-reset": delete S.relEdits[id]; ecrire("scm4-rel", S.relEdits); dessiner(); break;
        case "rel-filtre": S.filtreRel = el.getAttribute("data-f"); ecrire("scm4-filtre", S.filtreRel); dessiner(); break;
        case "voir-relance": S.vue = "relances"; S.filtreRel = "tout"; S.surligner = id; S.piedPour = null; { var rv = relance(id); if (rv && rv.statut === "fait") { S.masquerFaits = false; } } dessiner(); break;
        case "rel-dans-pied": {
          var r3 = relance(id), t4 = $("scm-txt"); if (!r3 || !t4) break;
          var txt0 = texteRel(r3);
          t4.value = t4.value.trim() ? t4.value.replace(/\s*$/, "") + "\n\n" + txt0 : txt0;
          S.brouillons[S.vue] = t4.value; ecrire("scm4-brouillons", S.brouillons); S.relDansPied[S.vue] = id;
          hauteur(t4); majLienFerme(); etatEnvoi(); t4.focus();
          break;
        }
        case "voir-terminees": S.voirTerminees = true; dessiner(); break;
        case "recharger": S.erreur = null; S.pret = false; S.charge = false; charger(); dessiner(); break;
        case "aller-demandes": if (window.ui) { window.ui.tab = "demandes"; if (typeof window.renderChrome === "function") window.renderChrome(); if (typeof window.renderMain === "function") window.renderMain(); } break;
        case "rapide": {
          var t = $("scm-txt"), r = RAPIDES[+el.getAttribute("data-i")]; if (!t || !r) break;
          var c = conv(S.vue), txt = r[1].replace("{prenom}", prenomDe(c) || "").replace("Bonjour  ", "Bonjour ");
          t.value = t.value.trim() ? t.value.replace(/\s*$/, "") + "\n\n" + txt : txt;
          S.brouillons[S.vue] = t.value; ecrire("scm4-brouillons", S.brouillons); hauteur(t); majLienFerme(); etatEnvoi(); t.focus();
          break;
        }
      }
    } catch (x) { noterErreurApp("Action « " + a + " » : " + (x && x.message), x && x.stack); ko("Petit souci : l'action n'a pas abouti (c'est noté)."); }
  });
  document.addEventListener("change", function (e) {
    var el = e.target; if (!el) return;
    if (el.getAttribute("data-scm-reglage") === "reprise_heures") { changerReglage("reprise_heures", Number(el.value) || 0); return; }
    if (el.getAttribute("data-scm-reglage") === "auto_mode") {
      // passer en « actif » demande une confirmation : le menu revient à l'ancien choix en attendant
      if (el.value === "actif" && modeAuto() !== "actif") { S.confirmer = "auto-actif"; dessiner(); return; }
      S.confirmer = null; changerReglage("auto_mode", el.value); return;
    }
    if (el.getAttribute("data-scm") !== "rel-masquer") return;
    S.masquerFaits = !!el.checked; ecrire("scm4-masquer", S.masquerFaits); dessiner();
  });
  var minuteurSauve = null;
  document.addEventListener("input", function (e) {
    var el = e.target; if (!el) return;
    if (el.id === "scm-txt") {
      if (estConv()) { S.brouillons[S.vue] = el.value; clearTimeout(minuteurSauve); minuteurSauve = setTimeout(function () { ecrire("scm4-brouillons", S.brouillons); }, 400); }
      hauteur(el); majLienFerme(); etatEnvoi();
    } else if (el.id === "scm-q") {
      S.recherche = el.value; var lz = $("scm-lz"); if (lz) lz.innerHTML = htmlListeLignes();
    } else if (el.hasAttribute && el.hasAttribute("data-scm-rel")) {
      var id = el.getAttribute("data-scm-rel"), r = relance(id); if (!r) return;
      S.relEdits[id] = el.value; clearTimeout(minuteurSauve); minuteurSauve = setTimeout(function () { ecrire("scm4-rel", S.relEdits); }, 400);
      hauteurRel(el);
      var art = $("rel-" + id), lien = art && art.querySelector('[data-scm="rel-wa"]');
      if (lien) lien.setAttribute("href", waLien(r.wa, el.value));
    }
  });
  document.addEventListener("focusout", function () {
    setTimeout(function () { if (S.renduEnAttente && !saisieEnCours() && $("scm-root")) dessiner(); }, 120);
  });
  document.addEventListener("keydown", function (e) {
    if (e.target && e.target.id === "scm-txt" && e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); envoyer(); }
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || !connecte()) return;
    // retour dans l'app : le temps réel a pu décrocher en arrière-plan
    if (!S.canal) abonner();
    charger();
    verifierSante(false);
    if (S.vue === "sante" && $("scm-root")) { S.kpi = null; chargerKpi(); }
    if (S.ouvertWa && Date.now() - S.ouvertWa.le < 30 * 60000) {
      var r = relance(S.ouvertWa.id);
      if (r && r.statut !== "fait") { S.demanderEnvoye = r.id; if ($("scm-root") && S.vue === "relances") dessiner(); }
      S.ouvertWa = null;
    }
  });
  window.addEventListener("online", function () { S.horsLigne = false; S.piedPour = null; if ($("scm-root")) { charger(); dessiner(); } });
  window.addEventListener("offline", function () { S.horsLigne = true; S.piedPour = null; if ($("scm-root")) dessiner(); });
  // Filet de sécurité : relecture toutes les 2 min tant que l'onglet est affiché
  setInterval(function () {
    if (document.visibilityState === "visible" && $("scm-root") && connecte()) { charger(); verifierSante(false); }
  }, 120000);

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
      ".scm{padding-bottom:8px;--wa:#25D366;--wa-b:#E7FFDB;--violet:#6D28D9;--violet-bg:#EDE9FE;--teal:#0F766E;--teal-bg:#CCFBF1;--orange:#C2410C;--orange-bg:#FFEDD5;--gris-bg:#EEF2F5}" +
      ".scm .scm-intro{font-size:12.5px;color:var(--gris);margin:10px 2px 4px;line-height:1.5}" +
      ".scm-seg{display:flex;gap:6px;margin:12px 0 8px}" +
      ".scm-seg button{flex:1;min-width:0;padding:11px 6px;border-radius:999px;font-size:13.5px;font-weight:700;background:#fff;border:1px solid var(--bordure);color:var(--nuit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".scm-seg button.on{background:var(--nuit);color:#fff;border-color:var(--nuit)}" +
      ".scm-seg button.on .scm-cnt{background:rgba(255,255,255,.18);color:#fff}" +
      ".scm-sys{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:9px 14px;border-radius:12px;border:1px solid var(--bordure);background:#fff;font:inherit;font-size:12.5px;font-weight:700;color:var(--nuit);text-align:left}" +
      ".scm-sys b{font-size:18px;line-height:1;color:var(--gris)}" +
      ".scm-sys.vert{background:var(--vert-bg);border-color:#BCEBD7;color:#046C4E}.scm-sys.ambre{background:var(--ambre-bg);border-color:#F6DE95;color:#7A3B06}" +
      ".scm-sys.rouge{background:var(--rouge-bg);border-color:#F5C2C2;color:#8F2323}.scm-sys.gris{color:var(--gris)}.scm-sys.on{outline:2px solid var(--nuit);outline-offset:1px}" +
      ".scm-hors{margin:10px 0 0;padding:9px 12px;border-radius:12px;background:var(--rouge-bg);color:#8F2323;font-size:12.5px;font-weight:700}" +
      ".scm-cherche{margin:10px 0 2px}.scm-cherche input{width:100%;padding:11px 14px;border-radius:999px;background:#fff;border:1px solid var(--bordure);font-size:15px}" +
      ".scm-grp{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--gris);margin:18px 2px 6px}" +
      ".scm-grp i{width:8px;height:8px;border-radius:999px;background:var(--bordure)}.scm-grp.toi i{background:var(--rouge)}.scm-grp.main i{background:var(--ambre)}.scm-grp.ia i{background:var(--bleu)}.scm-grp.fin i{background:#B8C4CE}" +
      ".scm-cnt{display:inline-block;font-weight:800;color:var(--bleu-dark);background:var(--pale);border-radius:999px;padding:1px 8px;font-size:11px;letter-spacing:0;text-transform:none}.scm-cnt.rouge{background:var(--rouge-bg);color:var(--rouge)}" +
      ".scm-aide{font-size:12px;color:var(--gris);margin:-2px 2px 8px;line-height:1.45}" +
      ".scm-vide{background:#fff;border:1px dashed var(--bordure);border-radius:16px;padding:22px 16px;text-align:center;color:var(--gris);font-size:13.5px;margin-top:14px;line-height:1.55}" +
      ".scm-liste{background:#fff;border:1px solid var(--bordure);border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(74,163,227,.07)}" +
      ".scm-row{display:flex;gap:12px;align-items:center;width:100%;text-align:left;padding:12px 14px;background:#fff;border:0;border-bottom:1px solid var(--bordure);color:var(--nuit);font:inherit;cursor:pointer}" +
      ".scm-row:last-child{border-bottom:0}.scm-row.plat{cursor:default}.scm-row .scm-btn{flex:0 0 auto}" +
      ".scm-av{flex:0 0 44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;background:var(--pale);color:var(--bleu-dark)}" +
      ".scm-av.toi{background:var(--ambre-bg);color:var(--ambre)}.scm-av.fin{background:var(--gris-bg);color:var(--gris)}.scm-av.retard{background:var(--rouge-bg);color:var(--rouge)}" +
      ".scm-mid{flex:1;min-width:0;display:grid;gap:2px}" +
      ".scm-l1{display:flex;gap:8px;align-items:baseline;justify-content:space-between}.scm-l1 b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".scm-l1 time{font-size:11.5px;color:var(--gris);flex:0 0 auto;font-variant-numeric:tabular-nums}" +
      ".scm-l2{font-size:13px;color:var(--gris);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".scm-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:3px}" +
      ".scm-t{font-style:normal;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--pale);color:var(--bleu-dark)}" +
      ".scm-t.rouge,.scm-tag.rouge{background:var(--rouge-bg);color:var(--rouge)}.scm-t.vert,.scm-tag.vert{background:var(--vert-bg);color:var(--vert)}.scm-t.ambre,.scm-tag.ambre{background:var(--ambre-bg);color:var(--ambre)}" +
      ".scm-t.gris,.scm-tag.gris{background:var(--gris-bg);color:var(--gris)}.scm-t.bleu,.scm-tag.bleu{background:var(--pale);color:var(--bleu-dark)}" +
      ".scm-tag.orange{background:var(--orange-bg);color:var(--orange)}.scm-tag.violet{background:var(--violet-bg);color:var(--violet)}.scm-tag.teal{background:var(--teal-bg);color:var(--teal)}" +
      ".scm-tag{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:800;padding:3px 10px;border-radius:999px;white-space:nowrap}" +
      ".scm-plus{width:100%;margin-top:8px;padding:11px;border-radius:12px;border:1px dashed var(--bordure);background:#fff;color:var(--bleu-dark);font-weight:700;font-size:13px}" +
      ".scm-th{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;display:flex;gap:10px;align-items:center;background:var(--fond);padding:10px 0 8px;border-bottom:1px solid var(--bordure)}" +
      ".scm-back{flex:0 0 40px;height:40px;border-radius:999px;background:#fff;border:1px solid var(--bordure);font-size:26px;line-height:1;color:var(--nuit)}" +
      ".scm-who{flex:1;min-width:0;display:grid}.scm-who b{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".scm-who button,.scm-rc-who button{background:none;border:0;padding:0;font:600 12.5px inherit;font-family:inherit;color:var(--gris);text-align:left;text-decoration:underline dotted;text-underline-offset:3px}" +
      ".scm-who small{font-size:12px;color:var(--gris)}" +
      ".scm-etat{flex:0 0 auto;font-size:11.5px;font-weight:800;padding:5px 10px;border-radius:999px;background:var(--pale);color:var(--bleu-dark)}" +
      ".scm-etat.toi{background:var(--ambre-bg);color:var(--ambre)}.scm-etat.fin{background:var(--gris-bg);color:var(--gris)}" +
      ".scm-ctrl{display:flex;gap:12px;align-items:center;margin:10px 0 4px;background:#fff;border:1px solid var(--bordure);border-radius:14px;padding:10px 12px}" +
      ".scm-carte .scm-ctrl{border:0;border-bottom:1px solid var(--bordure);border-radius:0;margin:0;padding:12px 14px}.scm-carte .scm-ctrl:last-child{border-bottom:0}" +
      ".scm-ctrl-t{display:grid;gap:1px;min-width:0}.scm-ctrl-t b{font-size:14px}.scm-ctrl-t small{font-size:12px;color:var(--gris);line-height:1.4}" +
      ".scm-switch{flex:0 0 52px;height:30px;border-radius:999px;border:0;background:#C8D3DC;position:relative;padding:0;transition:background .2s}" +
      ".scm-switch span{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:left .2s}" +
      ".scm-switch.on{background:var(--vert)}.scm-switch.rouge.on{background:var(--rouge)}.scm-switch.on span{left:25px}" +
      ".scm-acts{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px}" +
      ".scm-btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:42px;padding:9px 14px;border-radius:12px;background:#fff;border:1px solid var(--bordure);font:inherit;font-weight:700;font-size:13.5px;color:var(--nuit);text-decoration:none;cursor:pointer}" +
      ".scm-btn:disabled{opacity:.45;cursor:default}" +
      ".scm-btn.wa{background:var(--wa);border-color:var(--wa);color:#fff}.scm-btn.wa-txt{color:#128C4A}" +
      ".scm-btn.ok{color:var(--vert);border-color:#BCEBD7}.scm-btn.ok.plein{width:100%;background:var(--vert);color:#fff;border-color:var(--vert)}" +
      ".scm-btn.bleu{background:var(--bleu);border-color:var(--bleu);color:#fff}" +
      ".scm-lien{background:none;border:0;padding:4px 0;font:inherit;font-size:12.5px;font-weight:700;color:var(--bleu-dark);text-decoration:underline;text-underline-offset:3px;cursor:pointer}" +
      ".scm-ban{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;margin:8px 0 4px;padding:10px 12px;border-radius:12px;font-size:13px;font-weight:600;line-height:1.45}" +
      ".scm-ban.rouge{background:var(--rouge-bg);color:#8F2323}.scm-ban.vert{background:var(--vert-bg);color:#046C4E}.scm-ban.bleu{background:var(--pale);color:var(--nuit)}" +
      ".scm-ban button{background:none;border:0;font:inherit;font-weight:800;color:inherit;text-decoration:underline;padding:0;cursor:pointer}" +
      ".scm-ban-b{display:flex;gap:12px}.scm-ban.bleu button{color:var(--bleu-dark)}" +
      ".scm-rdv{margin:6px 0 2px;font-size:12.5px;color:var(--gris)}.scm-rdv b{color:var(--nuit)}" +
      ".scm-fil{display:flex;flex-direction:column;gap:6px;padding:8px 0 12px}" +
      ".scm-jour{align-self:center;font-size:11px;font-weight:700;color:var(--gris);background:var(--gris-bg);border-radius:999px;padding:3px 10px;margin:8px 0 2px;text-transform:capitalize}" +
      ".scm-b{max-width:84%;padding:8px 12px 6px;border-radius:16px;font-size:14.5px;line-height:1.45;word-wrap:break-word;overflow-wrap:anywhere;box-shadow:0 1px 2px rgba(15,34,51,.06)}" +
      ".scm-b p{margin:0;white-space:pre-wrap}.scm-b a{color:inherit;text-decoration:underline}" +
      ".scm-b small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;opacity:.7;margin-bottom:2px}" +
      ".scm-b time{display:block;text-align:right;font-size:10.5px;opacity:.7;margin-top:3px;font-variant-numeric:tabular-nums}" +
      ".scm-b.c{align-self:flex-start;background:#fff;border:1px solid var(--bordure);border-bottom-left-radius:6px}" +
      ".scm-b.ia{align-self:flex-end;background:var(--pale);color:var(--nuit);border-bottom-right-radius:6px}" +
      ".scm-b.mo{align-self:flex-end;background:var(--wa-b);color:var(--nuit);border:1px solid #CDEFC0;border-bottom-right-radius:6px}" +
      ".scm-lu{color:#2D9CDB;font-weight:800}" +
      ".scm-note{align-self:stretch;background:var(--ambre-bg);color:#6B3A07;border-radius:12px;padding:8px 12px;font-size:12.5px;font-weight:600;line-height:1.45;white-space:pre-wrap}" +
      ".scm-note time{display:block;font-size:10.5px;font-weight:500;opacity:.7;margin-top:2px}" +
      ".scm-img{display:block;max-width:220px;width:100%;border-radius:10px;margin:2px 0 4px}" +
      ".scm-voc{font-weight:700}.scm-tr{font-style:italic;opacity:.9}.scm-err{color:var(--rouge);font-weight:700}" +
      "#scm-pied:empty{display:none}" +
      "#scm-pied{position:sticky;bottom:0;z-index:6}" +
      ".scm-pied{background:var(--fond);padding:8px 0 calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--bordure);display:grid;gap:6px}" +
      ".scm-rap{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px}.scm-rap::-webkit-scrollbar{display:none}" +
      ".scm-rap button{flex:0 0 auto;padding:7px 11px;border-radius:999px;background:#fff;border:1px solid var(--bordure);font-size:12.5px;font-weight:600;color:var(--nuit)}" +
      ".scm-rap button.rel{background:var(--pale);border-color:var(--bleu);color:var(--bleu-dark);font-weight:800}" +
      ".scm-info{font-size:11.5px;color:var(--ambre);margin:0 2px;font-weight:600}" +
      ".scm-saisie{display:flex;gap:8px;align-items:flex-end}" +
      ".scm-saisie textarea{flex:1;resize:none;min-height:48px;border-radius:20px;padding:12px 14px;background:#fff;line-height:1.4;font-size:16px}" +
      ".scm-send{flex:0 0 48px;height:48px;border-radius:999px;border:0;background:var(--bleu);color:#fff;font-size:19px;font-weight:800}" +
      ".scm-send:disabled{opacity:.4}" +
      ".scm-pied.ferme textarea{resize:vertical;background:#fff;font-size:16px;line-height:1.4}" +
      ".scm-ferme{font-size:12.5px;color:var(--gris);line-height:1.45;margin:0}" +
      ".scm-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
      ".scm-prog{display:grid;gap:6px;margin:12px 2px 8px}.scm-prog span{font-weight:700;font-size:13px;font-variant-numeric:tabular-nums}" +
      ".scm-track{height:8px;border-radius:999px;background:var(--pale);overflow:hidden}.scm-fill{height:100%;background:var(--vert);border-radius:999px;transition:width .3s}" +
      ".scm-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0}.scm-chips::-webkit-scrollbar{display:none}" +
      ".scm-chips button{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;background:#fff;border:1px solid var(--bordure);font-weight:700;font-size:12.5px;color:var(--nuit)}" +
      ".scm-chips button i{width:9px;height:9px;border-radius:999px;background:var(--bordure)}" +
      ".scm-chips .c-rouge i{background:var(--rouge)}.scm-chips .c-orange i{background:#F97316}.scm-chips .c-vert i{background:var(--vert)}.scm-chips .c-ambre i{background:#F59E0B}" +
      ".scm-chips .c-violet i{background:#8B5CF6}.scm-chips .c-bleu i{background:var(--bleu)}.scm-chips .c-teal i{background:#14B8A6}.scm-chips .c-gris i{background:#94A3B8}" +
      ".scm-chips button.vide{opacity:.55}.scm-chips button span{color:var(--gris)}.scm-chips button.on{background:var(--nuit);color:#fff;border-color:var(--nuit)}.scm-chips button.on span{color:#fff;opacity:.8}" +
      ".scm-tog{display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--gris);margin:10px 2px 0}.scm-tog input{width:18px;height:18px}" +
      ".scm-cat-t{display:flex;align-items:center;gap:8px;margin:20px 2px 4px}" +
      ".scm-rc{display:grid;gap:9px;background:#fff;border:1px solid var(--bordure);border-left:5px solid var(--bordure);border-radius:16px;padding:14px 14px 10px;margin-top:10px;box-shadow:0 4px 14px rgba(74,163,227,.07);min-width:0}" +
      ".scm-rc.c-rouge{border-left-color:var(--rouge)}.scm-rc.c-orange{border-left-color:#F97316}.scm-rc.c-vert{border-left-color:var(--vert)}.scm-rc.c-ambre{border-left-color:#F59E0B}" +
      ".scm-rc.c-violet{border-left-color:#8B5CF6}.scm-rc.c-bleu{border-left-color:var(--bleu)}.scm-rc.c-teal{border-left-color:#14B8A6}.scm-rc.c-gris{border-left-color:#94A3B8}" +
      ".scm-rc.fait{opacity:.72}.scm-rc.scm-flash{box-shadow:0 0 0 3px var(--bleu)}" +
      ".scm-rc-h{display:flex;flex-wrap:wrap;gap:6px;align-items:center}" +
      ".scm-rc-who{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}.scm-rc-who b{font-size:16px}" +
      ".scm-rc-rdv,.scm-rc-sit{margin:0;font-size:12.5px;color:var(--gris);line-height:1.45}" +
      ".scm-rc-act{margin:0;font-weight:700;font-size:14px;line-height:1.45}" +
      ".scm-rc-warn{margin:0;background:var(--ambre-bg);color:#6B3A07;border-radius:10px;padding:8px 10px;font-size:12.5px;line-height:1.45}" +
      ".scm-bulle{position:relative;background:var(--wa-b);border:1px solid #CDEFC0;border-radius:14px 14px 4px 14px;padding:10px 12px 22px}" +
      ".scm-bulle textarea{display:block;width:100%;min-height:80px;border:0;background:transparent;padding:0;font:inherit;font-size:15px;line-height:1.5;color:var(--nuit);resize:none;overflow:hidden;outline:none}" +
      ".scm-bulle-p{position:absolute;right:10px;bottom:4px;font-size:10.5px;color:#4B7A3C;font-weight:700}" +
      ".scm-rc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.scm-rc-actions .scm-btn{font-size:13px;padding:9px 6px;white-space:nowrap}" +
      ".scm-rc-lock{margin:-2px 0 0;font-size:11.5px;color:var(--gris);line-height:1.4}" +
      ".scm-confirme,.scm-question{background:var(--pale);border:1px solid var(--bleu);border-radius:12px;padding:10px 12px;display:grid;gap:8px}.scm-confirme p,.scm-question p{margin:0;font-size:13.5px}" +
      ".scm-question{margin-top:12px;background:var(--vert-bg);border-color:#BCEBD7}" +
      ".scm-rc-bas{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px}" +
      ".scm-det{flex:1 1 100%;border-top:1px solid var(--bordure);padding-top:6px;font-size:12.5px;color:var(--nuit)}" +
      ".scm-det summary{cursor:pointer;color:var(--gris);font-weight:700}.scm-det p{margin:8px 0 0;line-height:1.45}" +
      ".scm-sante-t{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 2px 8px}.scm-sante-t div{display:grid}.scm-sante-t b{font-size:16px}.scm-sante-t small{font-size:12px;color:var(--gris)}" +
      ".scm-carte{background:#fff;border:1px solid var(--bordure);border-radius:16px;overflow:hidden}" +
      ".scm-v{display:flex;gap:10px;align-items:flex-start;padding:11px 14px;border-bottom:1px solid var(--bordure)}.scm-v:last-child{border-bottom:0}.scm-v.ko{background:#FFFBEB}" +
      ".scm-v>span{flex:0 0 auto;font-size:16px;line-height:1.3}.scm-v div{display:grid;gap:1px;min-width:0}.scm-v b{font-size:13.5px}.scm-v small{font-size:12px;color:var(--gris);line-height:1.4;overflow-wrap:anywhere}" +
      ".scm-e{padding:10px 14px;border-bottom:1px solid var(--bordure);font-size:12.5px}.scm-e:last-child{border-bottom:0}.scm-e.neuve{background:#FFFBEB}" +
      ".scm-e summary{cursor:pointer;line-height:1.45}.scm-e summary span{color:var(--gris);font-weight:700}" +
      ".scm-e pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;background:var(--fond);border-radius:8px;padding:8px;margin:6px 0 4px;max-height:200px;overflow:auto}.scm-e small{color:var(--gris)}" +
      ".scm-seg.trois button{padding:10px 4px;font-size:13px}@media (max-width:430px){.scm-seg.trois .ico{display:none}.scm-seg.trois button{font-size:12.5px;padding:10px 2px}}.scm-cnt.ambre{background:var(--ambre-bg);color:var(--ambre)}" +
      ".scm-dos{display:grid;gap:8px;background:#fff;border:1px solid var(--bordure);border-left:5px solid var(--bordure);border-radius:16px;padding:12px 14px;margin-top:10px;box-shadow:0 4px 14px rgba(74,163,227,.07);min-width:0}" +
      ".scm-dos.c-rouge{border-left-color:var(--rouge);background:#FFFBFB}.scm-dos.c-bleu{border-left-color:var(--bleu)}.scm-dos.c-ambre{border-left-color:#F59E0B}" +
      ".scm-dos time{margin-left:auto;font-size:11.5px;color:var(--gris)}" +
      ".scm-dos-r{margin:0;font-size:14px;font-weight:600;line-height:1.45}.scm-dos-x{margin:0;font-size:12.5px;color:var(--gris);white-space:pre-wrap;line-height:1.45;font-style:italic}" +
      ".scm-dos-b{display:flex;flex-wrap:wrap;gap:6px}.scm-dos-b .scm-btn{min-height:38px;padding:7px 12px;font-size:13px}" +
      ".scm-etat-c{display:grid;gap:4px;margin:10px 0 4px;background:#fff;border:1px solid var(--bordure);border-radius:14px;padding:10px 12px}" +
      ".scm-etat-c b{font-size:14.5px}.scm-etat-c small{font-size:12px;color:var(--gris);line-height:1.4}" +
      ".scm-etat-c.e-auto{border-color:#BFE0F5}.scm-etat-c.e-main{border-color:#F6DE95}.scm-etat-c.e-attente,.scm-etat-c.e-frein{border-color:#F5C2C2;background:#FFFBFB}" +
      ".scm-cmd{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:6px;background:var(--fond);border-radius:12px;padding:3px}" +
      ".scm-cmd button{min-height:40px;border:0;border-radius:10px;background:transparent;font:inherit;font-size:12.5px;font-weight:700;color:var(--gris);padding:6px 4px;line-height:1.2}" +
      ".scm-cmd button.on{background:#fff;color:var(--nuit);box-shadow:0 1px 3px rgba(15,34,51,.15)}" +
      ".scm-regle{display:grid;gap:7px;background:#fff;border:1px solid var(--bordure);border-radius:14px;padding:12px 14px;margin-top:8px;min-width:0}" +
      ".scm-regle.a_valider{border-color:#F6DE95;background:#FFFDF5}.scm-regle.archivee{opacity:.6}.scm-regle.neuve{margin-top:10px;border-color:var(--bleu)}" +
      ".scm-regle-t{margin:0;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.scm-regle-s{margin:0;font-size:11.5px;color:var(--gris)}" +
      ".scm-r-edit,.scm-regle textarea{width:100%;font-size:15px;line-height:1.45;border-radius:10px;padding:10px;background:#fff}" +
      ".scm-lab{display:grid;gap:4px;font-size:12px;font-weight:700;color:var(--gris)}.scm-lab select{font-size:15px;padding:9px;border-radius:10px;background:#fff}" +
      ".scm-per{display:inline-flex;gap:4px;margin-left:auto;text-transform:none;letter-spacing:0}.scm-per button{border:1px solid var(--bordure);background:#fff;border-radius:999px;padding:3px 10px;font:inherit;font-size:11.5px;font-weight:700;color:var(--gris)}.scm-per button.on{background:var(--nuit);color:#fff;border-color:var(--nuit)}" +
      ".scm-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}" +
      ".scm-kpi{background:#fff;border:1px solid var(--bordure);border-radius:14px;padding:10px 12px;display:grid;gap:1px;min-width:0}" +
      ".scm-kpi b{font-size:22px;font-variant-numeric:tabular-nums;line-height:1.2}.scm-kpi span{font-size:12.5px;font-weight:700}.scm-kpi small{font-size:11px;color:var(--gris)}" +
      "#scm-reprise{flex:0 0 auto;width:auto;font-size:15px;padding:8px;border-radius:10px;background:#fff}" +
      "#scm-auto-mode{flex:0 0 auto;width:auto;font-size:15px;padding:8px;border-radius:10px;background:#fff}" +
      ".scm-sous{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:2px 0 10px;background:var(--fond);border:1px solid var(--bordure);border-radius:14px;padding:3px}" +
      ".scm-sous button{min-height:40px;border:0;border-radius:11px;background:transparent;font:inherit;font-size:13px;font-weight:700;color:var(--gris);padding:6px 4px;white-space:nowrap}" +
      ".scm-sous button.on{background:#fff;color:var(--nuit);box-shadow:0 1px 3px rgba(15,34,51,.15)}" +
      ".scm-amode{display:flex;gap:8px;align-items:flex-start;border-radius:14px;padding:10px 12px;font-size:13px;line-height:1.45;margin-bottom:6px;border:1px solid var(--bordure);background:#fff}" +
      ".scm-amode span{flex:1;min-width:0}.scm-amode .scm-lien{flex:0 0 auto;margin:0}" +
      ".scm-amode.ambre{background:#FFFBEB;border-color:#F6DE95}.scm-amode.vert{background:var(--vert-bg);border-color:#A7E3C4}.scm-amode.gris{background:var(--fond)}" +
      ".scm-atxt{background:var(--fond);border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.5;overflow-wrap:anywhere}" +
      ".scm-aregles{padding:4px 14px}.scm-aregles p{margin:8px 0;font-size:13px;line-height:1.5}.scm-auto-det{margin-top:12px}.scm-marge{margin:8px 12px}" +
      "@media (min-width:760px){.scm-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}" +
      "@media (max-width:360px){.scm-2,.scm-rc-actions{grid-template-columns:1fr}}" +
      "@media (min-width:760px){.scm-rc-actions{grid-template-columns:repeat(4,1fr)}}" +
      "body.scm-actif #fab,body.scm-actif #chatfab{display:none!important}" +
      "body.scm-actif .toast{top:calc(10px + env(safe-area-inset-top,0px));bottom:auto!important;pointer-events:none}" +
      "body.scm-actif #main{padding-bottom:12px}";
    var st = document.createElement("style"); st.id = "scm-style"; st.textContent = css;
    document.head.appendChild(st);
  }

  window.SCM = {
    render: render,
    aTraiter: aTraiter,
    majBadge: majBadge,
    version: VERSION,
    _etat: function () { return S; }
  };
})();
