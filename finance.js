/* =====================================================================
   StayClean Finance — module 1 (24/09/2026)
   Profil fiscal · Caisse espèces · Mes revenus (attestations) ·
   Facture client imprimable · Note de crédit · Journal d'audit.

   Principes (voir aussi le doc projet « stayclean-finance ») :
   - AUCUN CHIFFRE SANS ORIGINE : chaque montant d'une attestation est
     recalculé depuis les opérations (RDV terminés, factures, dépenses) et
     la liste de ces opérations est consultable. Aucun total n'est éditable.
   - La caisse ne crée JAMAIS de chiffre d'affaires : le CA vient des
     prestations et des factures. La caisse dit seulement où est l'argent.
     Un dépôt sur Revolut = transfert caisse -> banque.
   - Pas de fiche de paie : indépendant personne physique = attestation de
     revenus professionnels (situation intermédiaire), jamais un salaire.
   - Aucun document présenté comme officiel. Niveaux : 1 généré,
     2 établi et signé par l'exploitant. Le niveau 3 (validation par un
     professionnel ITAA) viendra avec un vrai circuit de validation.
   - Un document généré n'est jamais modifié : on crée une nouvelle version.
   Toutes les données vivent dans DB.cpt (déjà synchronisé avec Supabase).
   ===================================================================== */
(function () {
  "use strict";

  /* --------------------------- règles sourcées --------------------------- */
  /* Chaque règle utilisée par ce module, avec sa source et son niveau de
     confiance. Rien n'est affiché comme certain s'il ne l'est pas. */
  var REGLES = {
    tva21: {
      titre: "Taux de TVA du nettoyage de meubles/textiles chez un particulier : 21 %",
      resume: "Le taux réduit de 6 % pour les logements de plus de 10 ans exclut expressément le nettoyage.",
      source: "https://www.accountable.eu/fr-be/help-center/quels-sont-les-taux-de-tva-en-belgique/",
      confiance: "Source secondaire — à confirmer avec le comptable", consulte: "2026-09-24"
    },
    factureB2C: {
      titre: "Facture à un particulier : pas obligatoire pour ce type de service, mais permise",
      resume: "L'AR n°1 TVA (art. 1) impose la facture au particulier pour des opérations précises (travaux immobiliers, véhicules…). Le nettoyage de biens meubles n'y figure pas. Les recettes sans facture doivent être inscrites chaque jour au journal des recettes (art. 14 §2). Une moquette collée au sol pourrait être vue comme un travail immobilier : à vérifier.",
      source: "https://etaamb.openjustice.be/fr/arrete-royal-du-19-decembre-2012_n2012003370",
      confiance: "Source secondaire (reproduction non officielle de l'AR) — à vérifier", consulte: "2026-09-24"
    },
    mentions: {
      titre: "Mentions obligatoires d'une facture TVA (AR n°1, art. 5)",
      resume: "Date, numéro séquentiel, nom/adresse/n° TVA du prestataire, nom/adresse du client (n° TVA du client seulement si c'est une entreprise), date de la prestation, description et quantité, prix HTVA, taux et montant de TVA.",
      source: "https://etaamb.openjustice.be/fr/arrete-royal-du-19-decembre-2012_n2012003370",
      confiance: "Source secondaire", consulte: "2026-09-24"
    },
    peppol: {
      titre: "Facture électronique Peppol obligatoire entre entreprises belges depuis le 1/1/2026",
      resume: "Un PDF envoyé par e-mail ne suffit plus pour un client entreprise belge assujetti. Les clients particuliers ne sont pas concernés. La tolérance des 3 premiers mois de 2026 est terminée.",
      source: "https://einvoice.belgium.be/en/FAQ/general-questions-b2b",
      confiance: "Vérifié — source officielle", consulte: "2026-09-24"
    },
    cash3000: {
      titre: "Paiement en espèces limité à 3 000 € par prestation",
      resume: "Au-delà, amende possible. Des paiements liés entre eux comptent ensemble.",
      source: "https://news.economie.fgov.be/164290-paiement-cash-c-est-maximum-3-000-euros/",
      confiance: "Vérifié — source officielle (SPF Économie)", consulte: "2026-09-24"
    },
    conservation: {
      titre: "Conservation des factures et pièces : 10 ans",
      resume: "Délai fiscal (TVA et impôts sur les revenus) porté à 10 ans depuis le 1/1/2023.",
      source: "https://blog.forumforthefuture.be/fr/article/impot-sur-les-revenus-et-tva-depuis-le-1er-janvier-2023-les-delais-de-conservation-des-livres-et-documents-sont-plus-longs-/18863",
      confiance: "Source secondaire", consulte: "2026-09-24"
    },
    pasDeFicheDePaie: {
      titre: "Indépendant personne physique : pas de fiche de paie",
      resume: "Il n'y a ni employeur ni salaire. La preuve de revenus se fait par l'avertissement-extrait de rôle (officiel), une attestation d'un professionnel ITAA, ou une situation comptable intermédiaire comme celle-ci.",
      source: "https://www.ipi.be/actualites/articles/que-faut-il-savoir-de-la-recente-regionalisation-du-bail-dhabitation-a-bruxelles",
      confiance: "Source secondaire", consulte: "2026-09-24"
    }
  };

  /* ------------------------------- utils -------------------------------- */
  function eur2(n) {
    return (Math.round((n || 0) * 100) / 100).toLocaleString("fr-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }
  function r2(n) { return Math.round((n || 0) * 100) / 100; }
  function uid(p) { return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function dfr(s) { if (!s) return "—"; var p = s.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  function moisLabel(mk) { return MOIS_FULL[+mk.slice(5, 7) - 1] + " " + mk.slice(0, 4); }
  function finMois(mk) { var y = +mk.slice(0, 4), m = +mk.slice(5, 7); return mk + "-" + pad(new Date(y, m, 0).getDate()); }
  function mkAdd(mk, n) { var y = +mk.slice(0, 4), m = +mk.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + "-" + pad(m + 1); }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ""; }
  function num(id) { var v = val(id).replace(",", "."); return v === "" ? null : Number(v); }
  function sha256(txt) {
    if (!window.crypto || !crypto.subtle) return Promise.resolve("indisponible");
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt)).then(function (b) {
      return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    });
  }
  function regleHtml(k) {
    var r = REGLES[k]; if (!r) return "";
    return '<details class="scf-regle"><summary>ℹ️ ' + esc(r.titre) + "</summary><p>" + esc(r.resume) + '</p><p class="scf-src">Source : <a href="' + r.source + '" target="_blank" rel="noreferrer">' + esc(r.source.replace(/^https?:\/\//, "").slice(0, 60)) + "…</a> · " + esc(r.confiance) + " · consulté le " + dfr(r.consulte) + "</p></details>";
  }

  /* ------------------------------ données -------------------------------- */
  function F() {
    var c = cptData();
    if (!c.profil) c.profil = { nomCommercial: "StayClean", forme: "pp", activite: "Nettoyage professionnel à domicile de canapés, tapis, moquettes, matelas, fauteuils et sièges automobiles", caisseSociale: "Xerius" };
    if (!c.caisse) c.caisse = { mv: [], comptages: [] };
    if (!c.attest) c.attest = [];
    if (!c.log) c.log = [];
    return c;
  }
  function log(action, detail) {
    F().log.push({ ts: new Date().toISOString(), action: action, detail: detail || "" });
    if (F().log.length > 2000) F().log = F().log.slice(-2000);
  }

  var CHAMPS_PROFIL = [
    ["prenom", "Prénom", "text", true], ["nom", "Nom", "text", true],
    ["nomCommercial", "Nom commercial", "text", true],
    ["adresse", "Adresse professionnelle", "text", true],
    ["bce", "N° d'entreprise (BCE)", "text", true, "0xxx.xxx.xxx"],
    ["tva", "N° de TVA", "text", true, "BE0xxx.xxx.xxx"],
    ["debut", "Date de début d'activité", "date", true],
    ["statutIndep", "Indépendant", "select", true, [["", "À compléter"], ["principal", "À titre principal"], ["complementaire", "À titre complémentaire"]]],
    ["regimeTva", "Régime TVA", "select", false, [["", "À compléter"], ["normal", "Régime normal (déclarations)"], ["franchise", "Franchise (petite entreprise)"]]],
    ["periodiciteTva", "Déclarations TVA", "select", false, [["", "À compléter"], ["trimestrielle", "Trimestrielles"], ["mensuelle", "Mensuelles"]]],
    ["nace", "Code(s) NACE", "text", false],
    ["caisseSociale", "Caisse d'assurances sociales", "text", false],
    ["iban", "IBAN professionnel (Revolut Business)", "text", false, "BE.. .... .... ...."],
    ["email", "Email professionnel", "text", false], ["tel", "Téléphone professionnel", "text", false],
    ["comptableNom", "Comptable / professionnel ITAA — nom", "text", false],
    ["comptableCabinet", "Cabinet", "text", false],
    ["comptableItaa", "N° ITAA", "text", false],
    ["comptableEmail", "Email du comptable", "text", false],
    ["peppolId", "Identifiant Peppol (si tu en as un)", "text", false],
    ["vehicule", "Véhicule utilisé pour l'activité", "select", false, [["", "À compléter"], ["aucun", "Aucun"], ["pro", "Uniquement professionnel"], ["mixte", "Mixte pro/privé"]]],
    ["domicile", "Domicile utilisé pour l'activité", "select", false, [["", "À compléter"], ["non", "Non"], ["oui", "Oui (partie du logement)"]]]
  ];
  function profilManquants(essentielsSeulement) {
    var p = F().profil;
    return CHAMPS_PROFIL.filter(function (c) { return (!essentielsSeulement || c[3]) && !p[c[0]]; }).map(function (c) { return c[1]; });
  }

  /* ------------------------ moteur : revenus ---------------------------- */
  /* Calcule les chiffres d'une période en listant CHAQUE opération source. */
  /* horodatage ISO (UTC) → date et heure de Bruxelles (l'appareil) */
  function dLoc(ts) { var d = new Date(ts); return isNaN(d) ? String(ts || "").slice(0, 10) : fmtDate(d); }
  function hLoc(ts) { var d = new Date(ts); return isNaN(d) ? "" : pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function tauxPresta() {
    if (F().profil && F().profil.regimeTva === "franchise") return 0;
    var t = cptData().set.tvaDefault;
    return (t == null || t === "" || isNaN(t)) ? 21 : Number(t);
  }
  function periode(debut, fin) {
    var tx = tauxPresta();
    var linked = venLinkedBkIds();
    var R = {
      debut: debut, fin: fin,
      caFactureHT: 0, caEncaisseHT: 0, avoirsHT: 0,
      tvaCollectee: 0, tvaDeductible: 0,
      charges: {}, chargesTotal: 0, cotisations: 0,
      ops: { ventes: [], charges: [], cotisations: [], exclues: [] },
      alertes: []
    };
    function inP(d) { return d && d >= debut && d <= fin; }
    DB.bookings.forEach(function (b) {
      if (b.statut !== "termine" || !inP(b.date) || linked[b.id]) return;
      var ttc = b.total || 0, ht = ttc / (1 + tx / 100);
      R.caFactureHT += ht; R.tvaCollectee += ttc - ht;
      if (!(b.pay && b.pay.statut === "non_paye")) R.caEncaisseHT += ht; /* règle conservée : sans mention contraire, une intervention terminée est considérée payée sur place */
      R.ops.ventes.push({ date: b.date, lib: "Prestation terminée (sans facture)", ht: ht, ttc: ttc, id: b.id });
    });
    cptData().ven.forEach(function (v) {
      if (v.statut === "brouillon" || !inP(v.date)) return;
      if (v.statut === "annulee" && !v.nc) return; /* ancienne annulation sans note de crédit : déjà exclue par l'app */
      var ttc = v.ttc || 0;
      var ht = v.ht != null ? v.ht : ttc / (1 + (v.tvaTaux != null ? v.tvaTaux : tx) / 100);
      var tva = v.tvaMontant != null ? v.tvaMontant : ttc - ht;
      if (v.type === "nc") R.avoirsHT += ht; else R.caFactureHT += ht;
      R.tvaCollectee += tva;
      var ratio = ttc ? Math.max(-1, Math.min(1, (v.paye || 0) / ttc)) : 0;
      R.caEncaisseHT += ht * ratio;
      R.ops.ventes.push({ date: v.date, lib: (v.type === "nc" ? "Note de crédit " : "Facture ") + v.numero, ht: ht, ttc: ttc, id: v.id });
    });
    cptData().dep.forEach(function (d) {
      if (!inP(d.date)) return;
      var ttc = d.ttc || 0;
      var tva = d.tvaMontant || 0;
      var ht = d.ht != null ? d.ht : ttc - tva;
      var pct = d.nature === "pro" ? 100 : (d.nature === "mixte" && d.pctPro != null ? d.pctPro : null);
      if (pct == null) {
        R.ops.exclues.push({ date: d.date, lib: (d.fournisseur || CAT_LABEL[d.categorie] || "Dépense") + " — " + (d.nature === "perso" ? "privée" : d.nature === "mixte" ? "mixte sans % pro" : "à vérifier"), ttc: ttc, id: d.id });
        return;
      }
      var htPro = ht * pct / 100;
      R.tvaDeductible += tva * pct / 100;
      if (d.categorie === "cotisations") {
        R.cotisations += ttc * pct / 100;
        R.ops.cotisations.push({ date: d.date, lib: d.fournisseur || "Cotisations sociales", ht: ttc * pct / 100, id: d.id });
        return;
      }
      var cat = d.categorie || "autre";
      R.charges[cat] = (R.charges[cat] || 0) + htPro;
      R.chargesTotal += htPro;
      R.ops.charges.push({ date: d.date, lib: (d.fournisseur || CAT_LABEL[cat] || "Dépense") + (pct < 100 ? " (" + pct + " % pro)" : ""), ht: htPro, id: d.id, sansJustif: !d.img });
    });
    R.recettesNettes = R.caFactureHT + R.avoirsHT;
    R.resultatAvant = R.recettesNettes - R.chargesTotal;
    R.resultatApres = R.resultatAvant - R.cotisations;
    R.tvaSolde = R.tvaCollectee - R.tvaDeductible;
    var sansJ = R.ops.charges.filter(function (x) { return x.sansJustif; }).length;
    if (sansJ) R.alertes.push(sansJ + " dépense" + (sansJ > 1 ? "s" : "") + " sans justificatif photo");
    if (R.ops.exclues.length) R.alertes.push(R.ops.exclues.length + " dépense" + (R.ops.exclues.length > 1 ? "s" : "") + " non retenue" + (R.ops.exclues.length > 1 ? "s" : "") + " (privée, à vérifier ou % pro manquant)");
    if (!R.ops.cotisations.length) R.alertes.push("aucune cotisation sociale enregistrée sur la période (catégorie « Cotisations sociales » dans Dépenses)");
    var cashLibre = F().caisse.mv.filter(function (m) { return m.type === "encaissement" && inP(m.date) && !m.bkId && !m.venId; }).length;
    if (cashLibre) R.alertes.push(cashLibre + " encaissement" + (cashLibre > 1 ? "s" : "") + " cash sans vente associée");
    ["caFactureHT", "caEncaisseHT", "avoirsHT", "tvaCollectee", "tvaDeductible", "chargesTotal", "cotisations", "recettesNettes", "resultatAvant", "resultatApres", "tvaSolde"].forEach(function (k) { R[k] = r2(R[k]); });
    Object.keys(R.charges).forEach(function (k) { R.charges[k] = r2(R.charges[k]); });
    return R;
  }
  /* empreinte des chiffres (pour savoir si les données ont changé depuis un document) */
  function empreinte(R) {
    return JSON.stringify([R.caFactureHT, R.caEncaisseHT, R.avoirsHT, R.tvaCollectee, R.tvaDeductible, R.charges, R.cotisations,
      R.ops.ventes.map(function (o) { return o.id; }).sort(), R.ops.charges.map(function (o) { return o.id; }).sort()]);
  }
  function moisDe(debut, fin) { var out = [], mk = debut.slice(0, 7); while (mk <= fin.slice(0, 7)) { out.push(mk); mk = mkAdd(mk, 1); } return out; }

  /* ------------------------------ caisse -------------------------------- */
  var TYPES_MV = {
    encaissement: { l: "Encaissement client", s: 1 },
    depense: { l: "Dépense payée en cash", s: -1 },
    depot: { l: "Dépôt sur le compte (caisse → banque)", s: -1 },
    retrait: { l: "Retrait du compte (banque → caisse)", s: 1 },
    apport: { l: "Apport privé dans la caisse", s: 1 },
    prelevement: { l: "Prélèvement privé (caisse → poche)", s: -1 }
  };
  function soldeCaisse(jusqua) {
    return r2(F().caisse.mv.reduce(function (s, m) { return (!jusqua || m.date <= jusqua) ? s + TYPES_MV[m.type].s * (m.montant || 0) : s; }, 0));
  }

  /* ---------------------------- UI : état -------------------------------- */
  var U = { modal: null, revMois: null, revType: "mensuel", voirOps: null, doc: null };
  function refresh() { renderMain(); drawModal(); }

  /* ============================== RENDUS ================================= */
  function renderProfil() {
    var p = F().profil;
    var manq = profilManquants(true);
    var h = '<div class="tdy-head"><h2>Profil fiscal</h2><span class="n">' + (manq.length ? manq.length + " à compléter" : "essentiel complet") + "</span></div>";
    h += '<div class="disclaim" style="margin-top:0">Ces informations apparaissent sur tes factures et tes attestations de revenus. Rien n\'est deviné : ce qui est vide reste <b>« À compléter »</b>. Ton numéro national n\'est jamais demandé ni affiché.</div>';
    h += '<section class="card sec" style="margin-top:12px"><p class="k">Forme juridique</p><p style="margin:4px 0 0;font-weight:700">Indépendant en personne physique</p><p class="note" style="margin:4px 0 0">Si un jour tu passes en SRL, les documents changeront (rémunération du dirigeant, fiches fiscales) : ce module ne traite que l\'entreprise individuelle.</p></section>';
    h += '<section class="card sec" style="margin-top:12px">';
    CHAMPS_PROFIL.forEach(function (c) {
      var v = p[c[0]] || "";
      h += '<div class="fld"><label>' + esc(c[1]) + (c[3] ? " *" : "") + "</label>";
      if (c[2] === "select") {
        h += '<select id="scf-p-' + c[0] + '"' + (!v && c[3] ? ' class="warn"' : "") + ">" + c[4].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
      } else {
        h += '<input id="scf-p-' + c[0] + '" type="' + c[2] + '" value="' + esc(v) + '" placeholder="' + esc(c[4] || "À compléter") + '"' + (!v && c[3] ? ' class="warn"' : "") + ">";
      }
      h += "</div>";
    });
    h += '<button class="btn-main" data-scf="profil-save">Enregistrer le profil</button></section>';
    h += '<section class="card sec" style="margin-top:12px"><p class="k">Intégrations</p>' +
      [["Revolut Business", "NON CONNECTÉ", "Import des relevés prévu (CSV d'abord, puis connexion en lecture seule)."],
        ["Peppol (factures B2B)", p.peppolId ? "IDENTIFIANT RENSEIGNÉ" : "CONFIGURATION NÉCESSAIRE", "L'app n'est pas un Access Point Peppol : il faudra brancher un prestataire agréé pour envoyer les factures aux entreprises."],
        ["Xerius", "IMPORT MANUEL", "Enregistre tes paiements Xerius dans Dépenses → catégorie « Cotisations sociales »."],
        ["VIES / BCE", "NON CONNECTÉ", "Vérification automatique des n° de TVA clients : prévue."]]
        .map(function (x) { return '<div class="tvaline"><span><b>' + x[0] + '</b><br><small style="color:var(--gris)">' + x[2] + '</small></span><span class="estbadge" style="white-space:nowrap">' + x[1] + "</span></div>"; }).join("") + "</section>";
    var L = F().log.slice(-15).reverse();
    h += '<section class="card sec" style="margin-top:12px"><p class="k">Journal des opérations importantes <span class="cnt">' + F().log.length + "</span></p>";
    if (!L.length) h += '<p class="emptyline">Rien pour l\'instant.</p>';
    L.forEach(function (x) { h += '<div class="tvaline"><span>' + esc(x.action) + (x.detail ? '<br><small style="color:var(--gris)">' + esc(x.detail) + "</small>" : "") + '</span><small class="tnum" style="color:var(--gris);white-space:nowrap">' + dfr(dLoc(x.ts)) + " " + hLoc(x.ts) + "</small></div>"; });
    h += "</section>";
    return h;
  }

  function renderCaisse() {
    var c = F().caisse;
    var solde = soldeCaisse();
    var h = '<div class="tdy-head"><h2>Caisse espèces</h2><span class="n">solde attendu</span></div>';
    h += '<section class="card sec" style="text-align:center"><p class="k">Cash qui devrait être dans ta caisse</p><p class="tnum" style="font-size:30px;font-weight:800;margin:6px 0">' + eur2(solde) + "</p>";
    var dern = c.comptages[c.comptages.length - 1];
    if (dern) h += '<p class="note" style="margin:0">Dernier comptage le ' + dfr(dern.date) + " : " + eur2(dern.reel) + (dern.ecart ? " (écart " + (dern.ecart > 0 ? "+" : "") + eur2(dern.ecart) + ")" : " — juste") + "</p>";
    h += "</section>";
    h += '<div class="sitgrid">' +
      '<button class="cptscan" style="margin:0" data-scf="mv" data-t="encaissement">+ Encaissement cash</button>' +
      '<button class="cptscan" style="margin:0;background:linear-gradient(135deg,#b45309,#f59e0b)" data-scf="mv" data-t="depense">− Dépense cash</button>' +
      '<button class="cptscan" style="margin:0;background:linear-gradient(135deg,#1d4ed8,#60a5fa)" data-scf="mv" data-t="depot">→ Dépôt sur Revolut</button>' +
      '<button class="cptscan" style="margin:0;background:linear-gradient(135deg,#334155,#64748b)" data-scf="compter">🧮 Compter ma caisse</button></div>';
    h += '<button class="linkline" data-scf="mv" data-t="autre">autre mouvement (apport, retrait, prélèvement privé) →</button>';
    h += '<div class="disclaim">💡 <b>Le cash n\'est jamais du chiffre d\'affaires en plus.</b> Ton CA vient de tes prestations terminées et de tes factures. La caisse suit seulement <i>où</i> est l\'argent. Quand tu déposes 119 € cash sur Revolut, c\'est un transfert caisse → banque, pas un nouveau revenu.</div>';
    var libres = c.mv.filter(function (m) { return m.type === "encaissement" && !m.bkId && !m.venId; });
    if (libres.length) h += '<div class="anomalie" style="margin-top:10px">⚠️ ' + libres.length + " encaissement" + (libres.length > 1 ? "s" : "") + " cash sans prestation ni facture associée. Une recette professionnelle doit toujours être enregistrée : associe-le à un RDV terminé (ou crée la prestation), sinon il manque dans ton CA.</div>";
    var mv = c.mv.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.cree < b.cree ? 1 : -1); });
    h += '<section class="card tsec" style="margin-top:12px"><p class="k">Mouvements <span class="cnt">' + mv.length + "</span></p>";
    if (!mv.length) h += '<p class="emptyline">Aucun mouvement. Commence par un comptage pour fixer ton solde de départ.</p>';
    mv.slice(0, 60).forEach(function (m) {
      var t = TYPES_MV[m.type], bk = m.bkId ? findBk(m.bkId) : null;
      h += '<div class="tvaline"><span>' + esc(t.l) + '<br><small style="color:var(--gris)">' + dfr(m.date) + (bk ? " · " + esc(bk.client) : "") + (m.motif ? " · " + esc(m.motif) : "") + (m.type === "encaissement" && !m.bkId && !m.venId ? ' · <b style="color:var(--rouge)">sans vente associée</b>' : "") + "</small></span>" +
        '<b class="tnum" style="color:' + (t.s > 0 ? "#047857" : "var(--rouge)") + '">' + (t.s > 0 ? "+" : "−") + eur2(m.montant) + "</b></div>";
    });
    h += "</section>";
    h += regleHtml("cash3000");
    return h;
  }

  function renderRevenus() {
    if (!U.revMois) U.revMois = mkAdd(todayStr().slice(0, 7), 0);
    var h = '<div class="tdy-head"><h2>Mes revenus</h2><span class="n">preuve de revenus</span></div>';
    h += '<div class="seg" style="margin-top:0">' +
      '<button class="' + (U.revType === "mensuel" ? "on" : "") + '" data-scf="rev-type" data-v="mensuel">1 mois</button>' +
      '<button class="' + (U.revType === "3mois" ? "on" : "") + '" data-scf="rev-type" data-v="3mois">3 derniers mois</button></div>';
    var debut, fin, titre;
    if (U.revType === "mensuel") { debut = U.revMois + "-01"; fin = finMois(U.revMois); titre = moisLabel(U.revMois); }
    else { debut = mkAdd(U.revMois, -2) + "-01"; fin = finMois(U.revMois); titre = moisLabel(mkAdd(U.revMois, -2)) + " → " + moisLabel(U.revMois); }
    h += '<div class="wknav"><button class="card arrow" data-scf="rev-nav" data-d="-1">‹</button><button class="lbl" data-scf="rev-nav" data-d="0">' + titre + '</button><button class="card arrow" data-scf="rev-nav" data-d="1">›</button></div>';
    var R = periode(debut, fin);
    function ligne(label, v, opsKey, fort) {
      var n = opsKey ? R.ops[opsKey].length : null;
      return '<div class="tvaline"><span>' + (fort ? "<b>" + label + "</b>" : label) + (n != null ? '<br><button class="scf-ops" data-scf="ops" data-k="' + opsKey + '">calculé depuis ' + n + " opération" + (n > 1 ? "s" : "") + " · voir</button>" : "") + '</span><b class="tnum"' + (fort ? ' style="font-size:17px"' : "") + ">" + eur2(v) + "</b></div>";
    }
    h += '<section class="card sec"><p class="k">Revenus professionnels (HTVA)</p>' +
      ligne("Chiffre d'affaires HTVA", R.caFactureHT, "ventes") +
      (R.avoirsHT ? ligne("Notes de crédit", R.avoirsHT) : "") +
      ligne("Charges professionnelles HTVA", -R.chargesTotal, "charges") +
      ligne("Résultat provisoire avant cotisations", R.resultatAvant, null, true) +
      ligne("Cotisations sociales payées", -R.cotisations, "cotisations") +
      ligne("Résultat provisoire après cotisations", R.resultatApres, null, true) +
      '<p class="note" style="margin:8px 0 0">Ce n\'est pas un salaire ni un revenu net fiscal définitif : c\'est une situation comptable intermédiaire, avant clôture et avant impôt.</p></section>';
    if (U.voirOps) {
      var lst = R.ops[U.voirOps] || [];
      h += '<section class="card tsec" style="margin-top:10px"><p class="k">Opérations sources <span class="cnt">' + lst.length + '</span> <button class="linkline" style="display:inline;margin:0 0 0 8px" data-scf="ops" data-k="">fermer</button></p>';
      lst.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (o) { h += '<div class="tvaline"><span>' + dfr(o.date) + " · " + esc(o.lib) + (o.sansJustif ? ' <b style="color:var(--ambre)">(sans justificatif)</b>' : "") + '</span><b class="tnum">' + eur2(o.ht != null ? o.ht : o.ttc) + "</b></div>"; });
      h += '<p class="note">Un montant faux ? Corrige l\'opération elle-même (le RDV, la facture ou la dépense) : les totaux ne se modifient jamais à la main.</p></section>';
    }
    if (R.alertes.length) h += '<div class="anomalie" style="margin-top:10px">À régler avant d\'envoyer : ' + R.alertes.join(" · ") + ".</div>";
    var manq = profilManquants(true);
    if (manq.length) h += '<div class="anomalie" style="margin-top:10px">Profil incomplet (' + esc(manq.join(", ")) + ') — <button class="linkline" style="display:inline;margin:0" data-act="tab" data-tab="profil">compléter</button>. L\'attestation ne peut pas être générée sans ces informations.</div>';
    h += '<button class="btn-main" data-scf="gen" data-debut="' + debut + '" data-fin="' + fin + '"' + (manq.length ? " disabled style=\"opacity:.5\"" : "") + ">📄 Générer l'attestation" + (U.revType === "3mois" ? " (3 mois)" : "") + "</button>";

    var docs = F().attest.slice().sort(function (a, b) { return a.generatedAt < b.generatedAt ? 1 : -1; });
    h += '<section class="card tsec" style="margin-top:14px"><p class="k">Documents générés <span class="cnt">' + docs.length + "</span></p>";
    if (!docs.length) h += '<p class="emptyline">Aucun document pour l\'instant.</p>';
    docs.forEach(function (d) {
      var change = empreinte(periode(d.debut, d.fin)) !== d.empreinte;
      h += '<button class="facrow" data-scf="doc" data-id="' + d.id + '"><span class="bd"><span class="fo">' + esc(d.ref) + " · V" + d.version + '</span><span class="me">' + dfr(d.debut) + " – " + dfr(d.fin) + (change ? ' · <b style="color:var(--ambre)">données modifiées depuis</b>' : "") + '</span></span><span class="fbulle ' + (d.niveau >= 2 ? "b-payee" : "b-ok") + '">' + (d.niveau >= 2 ? "Signé" : "Généré") + "</span></button>";
    });
    h += "</section>";
    h += regleHtml("pasDeFicheDePaie");
    return h;
  }

  /* ========================== documents A4 ============================= */
  var CSS_DOC = "#scf-doc{background:#fff;color:#0f172a;font:12px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:794px;margin:0 auto;padding:28px 30px}" +
    "#scf-doc h1{font-size:17px;letter-spacing:.04em;margin:0}#scf-doc h2{font-size:12px;margin:0;color:#475569;font-weight:600}" +
    "#scf-doc .hd{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #0f2233;padding-bottom:12px;margin-bottom:14px}" +
    "#scf-doc .brand{font-size:22px;font-weight:800;color:#0f2233;letter-spacing:.02em}#scf-doc .brand small{display:block;font-size:10px;font-weight:600;color:#64748b;letter-spacing:.08em}" +
    "#scf-doc .meta{text-align:right;font-size:11px;color:#334155}#scf-doc .meta b{color:#0f172a}" +
    "#scf-doc .blk{border:1px solid #cbd5e1;border-radius:6px;margin:10px 0;overflow:hidden}#scf-doc .blk>p{margin:0;background:#0f2233;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.08em;padding:5px 10px;text-transform:uppercase}" +
    "#scf-doc table{width:100%;border-collapse:collapse}#scf-doc td,#scf-doc th{padding:5px 10px;border-top:1px solid #e2e8f0;text-align:left;vertical-align:top}#scf-doc th{font-size:10.5px;color:#475569;background:#f8fafc}" +
    "#scf-doc td.n,#scf-doc th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}#scf-doc tr.t td{font-weight:800;background:#f1f5f9}#scf-doc tr.tt td{font-weight:800;background:#0f2233;color:#fff}" +
    "#scf-doc .grid{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;padding:6px 10px}#scf-doc .grid div{padding:2px 0}#scf-doc .grid span{color:#64748b;display:inline-block;min-width:150px}" +
    "#scf-doc .warn{border:1px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:6px;padding:7px 10px;margin:8px 0;font-size:11px}" +
    "#scf-doc .small{font-size:10px;color:#64748b}#scf-doc .sig{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px}#scf-doc .sig div{border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;min-height:74px}" +
    "#scf-doc .stamp{display:inline-block;border:2px solid #0f2233;border-radius:4px;padding:2px 8px;font-weight:800;font-size:10.5px;letter-spacing:.06em}" +
    "#scf-doc .foot{margin-top:14px;border-top:1px solid #cbd5e1;padding-top:8px;font-size:9.5px;color:#64748b;word-break:break-all}" +
    "@media print{body>*:not(#scf-print){display:none!important}#scf-print{position:static!important;background:#fff!important;padding:0!important}#scf-print .scf-noprint{display:none!important}#scf-doc{padding:0;max-width:none}@page{size:A4;margin:14mm}}" +
    "#scf-print{position:fixed;inset:0;z-index:90;background:rgba(15,34,51,.6);overflow:auto;padding:12px}#scf-print .scf-bar{max-width:794px;margin:0 auto 8px;display:flex;gap:8px}#scf-print .scf-bar button{flex:1;padding:12px;border-radius:999px;font-weight:700;background:#fff;color:#0f2233}#scf-print .scf-bar button.p{background:#059669;color:#fff}" +
    "@media(max-width:600px){#scf-doc{padding:18px 14px}#scf-doc .hd{flex-direction:column}#scf-doc .meta{text-align:left}#scf-doc .grid{grid-template-columns:1fr}#scf-doc .sig{grid-template-columns:1fr}}" +
    ".scf-ops{background:none;border:0;padding:0;color:var(--bleu);font-size:11px;font-weight:700;cursor:pointer}.scf-regle{font-size:11.5px;color:var(--gris);margin-top:12px}.scf-regle summary{cursor:pointer;font-weight:700}.scf-regle p{margin:6px 0}.scf-src{font-size:10.5px}";
  (function injectCss() { var s = document.createElement("style"); s.textContent = CSS_DOC; document.head.appendChild(s); })();

  function identiteHtml(p) {
    function f(v) { return v ? esc(v) : '<i style="color:#b45309">à compléter</i>'; }
    return '<div class="grid">' +
      "<div><span>Nom et prénom</span>" + f([p.nom, p.prenom].filter(Boolean).join(" ")) + "</div>" +
      "<div><span>Nom commercial</span>" + f(p.nomCommercial) + "</div>" +
      "<div><span>Statut</span>Travailleur indépendant — personne physique" + (p.statutIndep ? " (à titre " + p.statutIndep + ")" : "") + "</div>" +
      "<div><span>N° d'entreprise</span>" + f(p.bce) + "</div>" +
      "<div><span>N° TVA</span>" + f(p.tva) + "</div>" +
      "<div><span>Adresse professionnelle</span>" + f(p.adresse) + "</div>" +
      "<div><span>Début d'activité</span>" + (p.debut ? dfr(p.debut) : f("")) + "</div>" +
      "<div><span>Caisse sociale</span>" + f(p.caisseSociale) + "</div>" +
      '<div style="grid-column:1/-1"><span>Activité</span>' + f(p.activite) + "</div>" +
      (p.comptableNom ? '<div style="grid-column:1/-1"><span>Comptable</span>' + esc(p.comptableNom) + (p.comptableCabinet ? " — " + esc(p.comptableCabinet) : "") + (p.comptableItaa ? " — n° ITAA " + esc(p.comptableItaa) : "") + " <i>(n'a pas examiné ce document, sauf mention contraire ci-dessous)</i></div>" : "") +
      "</div>";
  }

  function attestationHtml(d) {
    var p = d.profil, R = d.chiffres, mois = d.mois;
    var titre = d.type === "3mois" ? "SYNTHÈSE DES 3 DERNIERS MOIS — REVENUS PROFESSIONNELS" : "ATTESTATION DE REVENUS PROFESSIONNELS";
    var statutTxt = d.niveau >= 2 ? "ÉTABLI ET SIGNÉ PAR L'EXPLOITANT" : "DOCUMENT GÉNÉRÉ — NON SIGNÉ";
    var h = '<div id="scf-doc"><div class="hd"><div><div class="brand">' + esc((p.nomCommercial || "StayClean").toUpperCase()) + "<small>" + esc(p.adresse || "") + "</small></div></div>" +
      '<div class="meta"><h1>' + titre + "</h1><h2>Travailleur indépendant – Personne physique · Situation comptable intermédiaire</h2>" +
      "<div style=\"margin-top:6px\">Période : <b>" + dfr(d.debut) + " – " + dfr(d.fin) + "</b><br>Référence : <b>" + esc(d.ref) + "</b> · Version <b>" + d.version + "</b><br>Établi le : <b>" + dfr(dLoc(d.generatedAt)) + "</b></div>" +
      '<div style="margin-top:6px"><span class="stamp">' + statutTxt + "</span></div></div></div>";
    h += '<div class="blk"><p>Identification</p>' + identiteHtml(p) + "</div>";
    if (d.type === "3mois" && mois && mois.length) {
      h += '<div class="blk"><p>Synthèse mensuelle (HTVA)</p><table><tr><th></th>' + mois.map(function (m) { return '<th class="n">' + esc(moisLabel(m.mk)) + "</th>"; }).join("") + '<th class="n">Total</th></tr>';
      [["Chiffre d'affaires HTVA", "ca"], ["Charges professionnelles", "ch"], ["Cotisations sociales", "co"], ["Résultat provisoire après cotisations", "res"]].forEach(function (L, i) {
        var tot = mois.reduce(function (s, m) { return s + m[L[1]]; }, 0);
        h += "<tr" + (i === 3 ? ' class="t"' : "") + "><td>" + L[0] + "</td>" + mois.map(function (m) { return '<td class="n">' + eur2(m[L[1]]) + "</td>"; }).join("") + '<td class="n">' + eur2(tot) + "</td></tr>";
      });
      h += "</table>" + '<table><tr class="tt"><td>Moyenne mensuelle — chiffre d\'affaires HTVA</td><td class="n">' + eur2(R.recettesNettes / mois.length) + '</td></tr><tr class="tt"><td>Moyenne mensuelle — résultat professionnel provisoire après cotisations</td><td class="n">' + eur2(R.resultatApres / mois.length) + "</td></tr></table></div>";
    }
    h += '<div class="blk"><p>Revenus professionnels</p><table>' +
      '<tr><td>Chiffre d\'affaires facturé / presté HTVA</td><td class="n">' + eur2(R.caFactureHT) + "</td></tr>" +
      '<tr><td>Chiffre d\'affaires encaissé HTVA</td><td class="n">' + eur2(R.caEncaisseHT) + "</td></tr>" +
      '<tr><td>Notes de crédit / corrections</td><td class="n">' + eur2(R.avoirsHT) + "</td></tr>" +
      '<tr class="t"><td>RECETTES PROFESSIONNELLES NETTES (HTVA)</td><td class="n">' + eur2(R.recettesNettes) + "</td></tr></table></div>";
    h += '<div class="blk"><p>Charges professionnelles (part professionnelle, HTVA)</p><table>';
    var cats = Object.keys(R.charges).sort(function (a, b) { return R.charges[b] - R.charges[a]; });
    if (!cats.length) h += '<tr><td colspan="2" class="small">Aucune charge professionnelle enregistrée sur la période.</td></tr>';
    cats.forEach(function (k) { h += "<tr><td>" + esc(CAT_LABEL[k] || k) + '</td><td class="n">' + eur2(R.charges[k]) + "</td></tr>"; });
    h += '<tr class="t"><td>TOTAL CHARGES PROFESSIONNELLES</td><td class="n">' + eur2(R.chargesTotal) + "</td></tr></table></div>";
    h += '<div class="blk"><p>Résultat professionnel</p><table>' +
      '<tr><td>Recettes HTVA</td><td class="n">' + eur2(R.recettesNettes) + "</td></tr>" +
      '<tr><td>− Charges professionnelles</td><td class="n">' + eur2(-R.chargesTotal) + "</td></tr>" +
      '<tr class="t"><td>RÉSULTAT PROFESSIONNEL PROVISOIRE AVANT COTISATIONS</td><td class="n">' + eur2(R.resultatAvant) + "</td></tr>" +
      '<tr><td>− Cotisations sociales payées sur la période</td><td class="n">' + eur2(-R.cotisations) + "</td></tr>" +
      '<tr class="tt"><td>RÉSULTAT PROFESSIONNEL PROVISOIRE APRÈS COTISATIONS</td><td class="n">' + eur2(R.resultatApres) + "</td></tr></table></div>";
    h += '<div class="blk"><p>TVA (hors revenus — pour information)</p><table>' +
      '<tr><td>TVA collectée</td><td class="n">' + eur2(R.tvaCollectee) + "</td></tr>" +
      '<tr><td>TVA déductible (estimée)</td><td class="n">' + eur2(R.tvaDeductible) + "</td></tr>" +
      '<tr class="t"><td>Solde TVA estimatif (à reverser si positif)</td><td class="n">' + eur2(R.tvaSolde) + "</td></tr></table>" +
      '<p class="small" style="padding:4px 10px;margin:0;background:none;color:#64748b;text-transform:none;letter-spacing:0;font-weight:400">La TVA n\'est pas un revenu : elle est collectée pour l\'État et exclue des montants ci-dessus.</p></div>';
    if (R.alertes && R.alertes.length) h += '<div class="warn"><b>Éléments encore à régulariser à la date d\'établissement :</b> ' + esc(R.alertes.join(" · ")) + ".</div>";
    h += '<p class="small">Ce document est une situation comptable intermédiaire établie à partir des opérations enregistrées par l\'exploitant (' + d.nbOps + " opérations). Les montants sont provisoires, avant écritures de clôture, régularisations fiscales et sociales. Ce document n'est ni une fiche de paie, ni un avertissement-extrait de rôle, ni une attestation d'un professionnel ITAA, et il n'a pas été examiné par un professionnel sauf mention expresse ci-dessous. Montants arrondis au centime.</p>";
    h += '<div class="sig"><div><b>EXPLOITANT</b><br>' + esc([p.prenom, p.nom].filter(Boolean).join(" ")) + "<br>" +
      (d.signe ? "Établi et signé le " + dfr(dLoc(d.signe.date)) + "<br><i>Signature électronique simple : « " + esc(d.signe.nom) + " »</i>" : '<span class="small">Date et signature :</span>') + "</div>" +
      "<div><b>PROFESSIONNEL</b><br><span class=\"small\">Non examiné par un professionnel.</span></div></div>";
    h += '<div class="foot">Réf. ' + esc(d.ref) + " · V" + d.version + " · ID " + esc(d.id) + " · généré le " + esc(d.generatedAt) + "<br>Empreinte SHA-256 des chiffres : " + esc(d.hash) + "</div></div>";
    return h;
  }

  function factureHtml(v) {
    var p = F().profil;
    var tx = v.tvaTaux != null ? v.tvaTaux : tauxPresta();
    var lignes = v.lignes && v.lignes.length ? v.lignes : [{ lib: v.note || "Prestation de nettoyage", qte: 1, ttc: v.ttc || 0 }];
    var manq = [];
    if (!p.tva) manq.push("ton n° de TVA"); if (!p.adresse) manq.push("ton adresse"); if (!p.nom) manq.push("ton nom");
    if (!v.clientAdresse) manq.push("l'adresse du client");
    var b2b = v.clientType === "entreprise";
    var nc = v.type === "nc";
    var brouillon = v.statut === "brouillon";
    var h = (brouillon ? '<div class="warn" style="max-width:794px;margin:0 auto 8px;font-size:13px"><b>BROUILLON</b> — pas encore une facture : le numéro est attribué à la validation. Ne l\'envoie pas au client avant de valider.</div>' : "") + '<div id="scf-doc"><div class="hd"><div><div class="brand">' + esc((p.nomCommercial || "StayClean").toUpperCase()) + "<small>" + esc([p.prenom, p.nom].filter(Boolean).join(" ")) + "</small></div>" +
      '<div class="small" style="margin-top:6px">' + esc(p.adresse || "Adresse à compléter") + "<br>N° entreprise : " + esc(p.bce || "à compléter") + " · TVA : " + esc(p.tva || "à compléter") + (p.iban ? "<br>IBAN : " + esc(p.iban) : "") + (p.email ? "<br>" + esc(p.email) : "") + (p.tel ? " · " + esc(p.tel) : "") + "</div></div>" +
      '<div class="meta"><h1>' + (nc ? "NOTE DE CRÉDIT" : brouillon ? "FACTURE — BROUILLON" : "FACTURE") + "</h1>N° <b>" + (brouillon ? "attribué à la validation" : esc(v.numero)) + "</b><br>Date : <b>" + dfr(v.date) + "</b>" + (v.datePrestation && v.datePrestation !== v.date ? "<br>Date de la prestation : <b>" + dfr(v.datePrestation) + "</b>" : "") + (v.echeance && !nc ? "<br>Échéance : <b>" + dfr(v.echeance) + "</b>" : "") + (nc && v.refFacture ? "<br>Annule la facture n° <b>" + esc(v.refFacture) + "</b>" : "") + "</div></div>";
    h += '<div class="blk"><p>Client</p><div style="padding:8px 10px"><b>' + esc(v.client || "") + "</b>" + (v.clientAdresse ? "<br>" + esc(v.clientAdresse) : "") + (b2b && v.clientTva ? "<br>N° TVA : " + esc(v.clientTva) : "") + "</div></div>";
    h += '<div class="blk"><p>Détail</p><table><tr><th>Description</th><th class="n">Qté</th><th class="n">HTVA</th></tr>';
    var totHT = 0;
    var parPU = lignes.every(function (l) { return l.puHT != null; });
    lignes.forEach(function (l, i) {
      var ht = parPU ? r2((l.qte || 1) * l.puHT) : (i === lignes.length - 1 ? r2((v.ht || 0) - totHT) : r2((l.ttc || 0) / (1 + tx / 100)));
      totHT = r2(totHT + ht);
      h += "<tr><td>" + esc(l.lib) + '</td><td class="n">' + (l.qte || 1) + (parPU ? " × " + eur2(l.puHT) : "") + '</td><td class="n">' + eur2(ht) + "</td></tr>";
    });
    h += '<tr class="t"><td colspan="2">Total HTVA</td><td class="n">' + eur2(v.ht) + "</td></tr>" +
      '<tr><td colspan="2">TVA ' + tx + " %</td><td class=\"n\">" + eur2(v.tvaMontant) + "</td></tr>" +
      '<tr class="tt"><td colspan="2">TOTAL TVAC</td><td class="n">' + eur2(v.ttc) + "</td></tr>";
    if (!nc) h += '<tr><td colspan="2">Payé</td><td class="n">' + eur2(v.paye || 0) + '</td></tr><tr class="t"><td colspan="2">Reste dû</td><td class="n">' + eur2(Math.max(0, (v.ttc || 0) - (v.paye || 0))) + "</td></tr>";
    h += "</table></div>";
    if (!nc && (v.paye || 0) >= (v.ttc || 0) && v.ttc > 0) h += '<p style="font-weight:700;color:#047857">Facture acquittée' + (v.moyen ? " — payée par " + esc(v.moyen) : "") + ".</p>";
    else if (!nc && (v.paye || 0) > 0) h += "<p>Acompte reçu" + (v.moyen ? " (" + esc(v.moyen) + ")" : "") + " : " + eur2(v.paye) + ".</p>";
    if (!nc && (v.paye || 0) < (v.ttc || 0) && p.iban) h += "<p>Paiement par virement sur " + esc(p.iban) + " en mentionnant la communication <b>" + esc(v.numero) + "</b>.</p>";
    if (manq.length) h += '<div class="warn scf-noprint-hint"><b>Mentions obligatoires manquantes :</b> ' + esc(manq.join(", ")) + ". Complète le Profil (et la fiche client) avant d'envoyer cette facture.</div>";
    if (b2b) h += '<div class="warn"><b>Client entreprise :</b> depuis le 1/1/2026, une facture à une entreprise belge assujettie doit être envoyée en format électronique structuré via Peppol. Ce PDF seul ne suffit pas — un prestataire Peppol doit encore être configuré.</div>';
    h += '<div class="foot">' + esc(p.nomCommercial || "StayClean") + " · " + esc(p.bce || "") + " · Document généré par StayClean Finance le " + dfr(todayStr()) + "</div></div>";
    return h;
  }

  function ouvrirDoc(html, titre) {
    fermerDoc();
    var box = document.createElement("div");
    box.id = "scf-print";
    box.innerHTML = '<div class="scf-bar scf-noprint"><button data-scf="doc-close">← Fermer</button><button class="p" data-scf="doc-print">🖨 Imprimer / PDF</button></div>' +
      '<div style="background:#fff;border-radius:10px;max-width:794px;margin:0 auto">' + html + "</div>";
    document.body.appendChild(box);
    U.docTitre = titre || document.title;
  }
  function fermerDoc() { var b = document.getElementById("scf-print"); if (b) b.remove(); }

  /* ======================= actions : attestation ======================= */
  function generer(debut, fin) {
    var manq = profilManquants(true);
    if (manq.length) { toast("err", ["Profil incomplet : " + manq.join(", ") + "."]); return; }
    var R = periode(debut, fin);
    var type = debut.slice(0, 7) === fin.slice(0, 7) ? "mensuel" : "3mois";
    var mois = type === "3mois" ? moisDe(debut, fin).map(function (mk) {
      var r = periode(mk + "-01", finMois(mk));
      return { mk: mk, ca: r.recettesNettes, ch: r.chargesTotal, co: r.cotisations, res: r.resultatApres };
    }) : null;
    var memes = F().attest.filter(function (a) { return a.debut === debut && a.fin === fin && a.type === type; });
    var dernier = memes.sort(function (a, b) { return b.version - a.version; })[0];
    var empr = empreinte(R);
    if (dernier && dernier.empreinte === empr) { toast("ok", ["Rien n'a changé depuis la version " + dernier.version + " : je te la rouvre."]); ouvrirDoc(attestationHtml(dernier)); return; }
    var ref;
    if (dernier) ref = dernier.ref;
    else {
      var prefix = "SC-" + (type === "3mois" ? "S3M" : "ARP") + "-" + fin.slice(0, 4) + "-" + fin.slice(5, 7) + "-";
      var n = F().attest.filter(function (a) { return a.ref.indexOf(prefix) === 0; }).map(function (a) { return a.ref; })
        .filter(function (r, i, arr) { return arr.indexOf(r) === i; }).length + 1;
      ref = prefix + String(n).padStart(3, "0");
    }
    var d = {
      id: uid("att"), ref: ref, type: type, debut: debut, fin: fin,
      version: dernier ? dernier.version + 1 : 1, precedente: dernier ? dernier.id : null,
      niveau: 1, generatedAt: new Date().toISOString(),
      profil: JSON.parse(JSON.stringify(F().profil)),
      chiffres: { caFactureHT: R.caFactureHT, caEncaisseHT: R.caEncaisseHT, avoirsHT: R.avoirsHT, recettesNettes: R.recettesNettes, charges: R.charges, chargesTotal: R.chargesTotal, cotisations: R.cotisations, resultatAvant: R.resultatAvant, resultatApres: R.resultatApres, tvaCollectee: R.tvaCollectee, tvaDeductible: R.tvaDeductible, tvaSolde: R.tvaSolde, alertes: R.alertes },
      mois: mois,
      sources: { ventes: R.ops.ventes.map(function (o) { return o.id; }), charges: R.ops.charges.map(function (o) { return o.id; }), cotisations: R.ops.cotisations.map(function (o) { return o.id; }) },
      nbOps: R.ops.ventes.length + R.ops.charges.length + R.ops.cotisations.length,
      empreinte: empr
    };
    if (U.genBusy) return; /* double clic : une seule version */
    U.genBusy = true;
    sha256(JSON.stringify([d.ref, d.version, d.debut, d.fin, d.chiffres, d.sources, d.generatedAt])).then(function (hsh) {
      U.genBusy = false;
      d.hash = hsh;
      F().attest.push(Object.freeze ? JSON.parse(JSON.stringify(d)) : d);
      log("Attestation générée", d.ref + " V" + d.version + " (" + dfr(debut) + " – " + dfr(fin) + ")");
      save();
      refresh();
      ouvrirDoc(attestationHtml(d));
      toast("ok", [d.ref + " V" + d.version + " générée." + (dernier ? " La V" + dernier.version + " reste conservée telle quelle." : "")]);
    }, function () { U.genBusy = false; toast("err", ["Empreinte impossible à calculer : attestation non générée."]); });
  }
  function findAtt(id) { return F().attest.filter(function (a) { return a.id === id; })[0]; }

  /* ========================= actions : factures ======================== */
  function nextNumero(nc, dateStr) {
    var y = String(dateStr ? String(dateStr).slice(0, 4) : new Date().getFullYear());
    var pre = nc ? "NC-" + y + "-" : y + "-";
    var max = 0;
    cptData().ven.forEach(function (v) {
      var n = v.numero || "";
      if (n.indexOf(pre) === 0) { var k = parseInt(n.slice(pre.length), 10); if (k > max) max = k; }
    });
    return pre + String(max + 1).padStart(3, "0");
  }
  function factureDepuisRdv(bkId) {
    var b = findBk(bkId); if (!b) return;
    var deja = cptData().ven.filter(function (v) { return v.type !== "nc" && v.statut !== "annulee" && !v.creditee && (v.source || "").indexOf(b.id) !== -1; })[0];
    if (deja) { ouvrirDoc(factureHtml(deja)); return; }
    var tx = tauxPresta();
    var ttc = r2(b.total || 0);
    if (!ttc) { toast("err", ["Ce RDV n'a pas de montant : indique le montant avant de facturer."]); return; }
    var ht = r2(ttc / (1 + tx / 100));
    var pres = (b.prestations || []).filter(function (x) { return x && x.nom; });
    var somme = pres.reduce(function (s, x) { return s + (x.prix || 0); }, 0);
    var lignes = pres.length && pres.every(function (x) { return x.prix != null; }) && Math.abs(somme - ttc) < 0.01
      ? pres.map(function (x) { return { lib: x.nom, qte: 1, ttc: x.prix }; })
      : [{ lib: pres.map(function (x) { return x.nom; }).join(" + ") || "Nettoyage textile à domicile", qte: 1, ttc: ttc }];
    var v = {
      id: uidVen(), numero: nextNumero(false), client: b.client || "", clientType: "particulier",
      clientAdresse: b.adresse || "", clientTel: b.telephone || "",
      date: todayStr(), datePrestation: b.date, echeance: todayStr(),
      ht: ht, tvaTaux: tx, tvaMontant: r2(ttc - ht), ttc: ttc, paye: ttc, statut: "payee",
      note: lignes.map(function (l) { return l.lib; }).join(" + "), lignes: lignes,
      creeLe: todayStr(), source: "StayClean · " + b.id, valideeLe: new Date().toISOString()
    };
    cptData().ven.push(v);
    b.facture = true;
    log("Facture créée depuis un RDV", v.numero + " · " + v.client + " · " + eur2(ttc));
    save();
    renderAll();
    ouvrirDoc(factureHtml(v));
    toast("ok", ["Facture " + v.numero + " créée (" + eur2(ttc) + " TVAC, marquée payée).", "Si le client n'a pas encore payé, ouvre-la dans Compta → Ventes et clique « Rouvrir »."]);
  }
  /* Une facture validée ne disparaît jamais : on l'annule par une note de crédit. */
  function annulerParNC(venId) {
    var v = findVen(venId); if (!v) return;
    if (v.statut === "brouillon") {
      if (confirm("Supprimer ce brouillon (jamais envoyé) ?")) { DB.cpt.ven = cptData().ven.filter(function (x) { return x.id !== v.id; }); log("Brouillon supprimé", v.numero); save(); ui.venId = null; renderAll(); }
      return;
    }
    if (v.type === "nc") { toast("err", ["Une note de crédit ne se supprime pas."]); return; }
    if (v.creditee) { toast("err", ["Cette facture est déjà annulée par la note de crédit " + v.creditee + "."]); return; }
    var motif = prompt("La facture " + v.numero + " ne peut pas être supprimée (numérotation continue obligatoire).\n\nJe peux l'annuler par une NOTE DE CRÉDIT du même montant.\nMotif de l'annulation :");
    if (motif == null) return;
    if (!motif.trim()) { toast("err", ["Un motif est nécessaire."]); return; }
    var nc = {
      id: uidVen(), type: "nc", nc: true, numero: nextNumero(true), refFacture: v.numero, refId: v.id,
      client: v.client, clientType: v.clientType, clientAdresse: v.clientAdresse, clientTva: v.clientTva,
      date: todayStr(), ht: -(v.ht || 0), tvaTaux: v.tvaTaux, tvaMontant: -(v.tvaMontant || 0), ttc: -(v.ttc || 0),
      paye: -(v.paye || 0), statut: "payee", note: "Annulation de la facture " + v.numero + " — " + motif.trim(),
      lignes: [{ lib: "Annulation de la facture " + v.numero + " — " + motif.trim(), qte: 1, ttc: -(v.ttc || 0) }],
      creeLe: todayStr()
    };
    v.creditee = nc.numero;
    cptData().ven.push(nc);
    log("Facture annulée par note de crédit", v.numero + " → " + nc.numero + " · motif : " + motif.trim());
    save(); ui.venId = null; renderAll();
    ouvrirDoc(factureHtml(nc));
    toast("ok", ["Note de crédit " + nc.numero + " créée. La facture " + v.numero + " reste dans ton historique.", "Si la prestation a bien eu lieu, réémets une facture corrigée."]);
  }

  /* ============================ modales ================================ */
  function drawModal() {
    var box = document.getElementById("scf-modal");
    if (!box) { box = document.createElement("div"); box.id = "scf-modal"; document.body.appendChild(box); }
    var m = U.modal;
    if (!m) { box.innerHTML = ""; return; }
    var h = '<div class="overlay" id="scf-ov"><div class="sheet"><div class="sheet-head"><h2>' + esc(m.titre) + '</h2><button class="x" data-scf="modal-close">×</button></div>';
    if (m.k === "mv") {
      var t = m.t;
      if (t === "autre") {
        h += '<div class="fld"><label>Type</label><select id="scf-mv-type">' + ["apport", "retrait", "prelevement"].map(function (k) { return '<option value="' + k + '">' + TYPES_MV[k].l + "</option>"; }).join("") + "</select></div>";
      }
      h += '<div class="two"><div class="fld"><label>Montant (€)</label><input id="scf-mv-montant" type="number" step="0.01" inputmode="decimal"></div><div class="fld"><label>Date</label><input id="scf-mv-date" type="date" value="' + todayStr() + '"></div></div>';
      if (t === "encaissement") {
        var rdvs = DB.bookings.filter(function (b) { return b.statut !== "annule" && b.date <= todayStr() && b.date >= addDaysStr(todayStr(), -45); })
          .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        h += '<div class="fld"><label>Pour quelle prestation ?</label><select id="scf-mv-bk"><option value="">— aucune (à associer plus tard) —</option>' +
          rdvs.map(function (b) { return '<option value="' + b.id + '">' + dfr(b.date) + " · " + esc(b.client) + " · " + euro(b.total) + (b.statut !== "termine" ? " (pas encore terminé)" : "") + "</option>"; }).join("") + "</select></div>" +
          '<p class="note">L\'encaissement ne crée pas de CA : c\'est la prestation qui compte dans ton CA. Ici tu dis juste qu\'elle a été payée en cash. Si tu choisis une prestation pas encore terminée, elle sera marquée terminée.</p>';
      }
      if (t === "depense") h += '<p class="note">Pense aussi à photographier le ticket dans <b>Dépenses</b> : c\'est là que la dépense compte pour ta comptabilité. La caisse suit seulement le cash sorti.</p>';
      if (t === "depot") h += '<p class="note">Un dépôt n\'est pas un revenu : l\'argent passe juste de ta caisse à ton compte Revolut.</p>';
      h += '<div class="fld"><label>Motif / note</label><input id="scf-mv-motif" placeholder="' + (t === "depense" ? "Ex : produits détachants Action" : "Facultatif") + '"></div>';
      h += '<button class="btn-main" data-scf="mv-save" data-t="' + t + '">Enregistrer</button>';
    }
    if (m.k === "compter") {
      var theo = soldeCaisse();
      h += '<p>Selon tes mouvements, il devrait y avoir <b>' + eur2(theo) + "</b> dans ta caisse.</p>" +
        '<div class="fld"><label>Montant compté réellement (€)</label><input id="scf-cpt-reel" type="number" step="0.01" inputmode="decimal"></div>' +
        '<div class="fld"><label>Explication si écart</label><input id="scf-cpt-justif" placeholder="Ex : 4 € de parking payés en cash, ticket perdu"></div>' +
        '<p class="note">S\'il y a un écart, j\'enregistre un mouvement de régularisation daté d\'aujourd\'hui avec ton explication — le premier comptage fixe simplement ton solde de départ.</p>' +
        '<button class="btn-main" data-scf="cpt-save">Valider le comptage</button>';
    }
    if (m.k === "signer") {
      var d = findAtt(m.id);
      h += "<p>Tu vas établir et signer <b>" + esc(d.ref) + " V" + d.version + "</b>. En signant, tu déclares que ces chiffres reflètent sincèrement les opérations que tu as enregistrées.</p>" +
        '<div class="fld"><label>Tape ton nom complet comme signature</label><input id="scf-sig-nom" value="' + esc([F().profil.prenom, F().profil.nom].filter(Boolean).join(" ")) + '"></div>' +
        '<label style="display:flex;gap:8px;align-items:flex-start;font-size:13px"><input type="checkbox" id="scf-sig-ok" style="width:auto;margin-top:3px"> Je confirme l\'exactitude des opérations enregistrées et je comprends que ce document est une situation intermédiaire, pas une attestation d\'un professionnel.</label>' +
        '<button class="btn-main" data-scf="sig-save" data-id="' + d.id + '">Signer (niveau 2)</button>';
    }
    h += "</div></div>";
    box.innerHTML = h;
  }

  /* ============================ clics ================================= */
  document.addEventListener("click", function (e) {
    var ov = e.target && e.target.id === "scf-ov" ? e.target : null;
    if (ov) { U.modal = null; drawModal(); return; }
    var el = e.target.closest && e.target.closest("[data-scf]");
    if (!el) return;
    var a = el.getAttribute("data-scf");
    switch (a) {
      case "modal-close": U.modal = null; drawModal(); break;
      case "profil-save": {
        var p = F().profil, chg = [];
        CHAMPS_PROFIL.forEach(function (c) { var nv = val("scf-p-" + c[0]); if ((p[c[0]] || "") !== nv) { chg.push(c[1]); p[c[0]] = nv; } });
        if (chg.length) { log("Profil fiscal modifié", chg.join(", ")); save(); }
        toast("ok", [chg.length ? "Profil enregistré (" + chg.length + " champ" + (chg.length > 1 ? "s" : "") + ")." : "Aucun changement."]);
        renderMain(); break;
      }
      case "mv": {
        var t = el.getAttribute("data-t");
        U.modal = { k: "mv", t: t, titre: t === "autre" ? "Autre mouvement de caisse" : TYPES_MV[t].l }; drawModal(); break;
      }
      case "mv-save": {
        var tt = el.getAttribute("data-t"); if (tt === "autre") tt = val("scf-mv-type");
        var mt = num("scf-mv-montant"), dt = val("scf-mv-date") || todayStr();
        if (!mt || mt <= 0) { toast("err", ["Indique un montant positif."]); break; }
        var bkId = tt === "encaissement" ? val("scf-mv-bk") : "";
        if ((tt === "depense" || tt === "depot" || tt === "prelevement") && mt > soldeCaisse(dt) + 0.001) {
          if (!confirm("Ta caisse ne contient en théorie que " + eur2(soldeCaisse(dt)) + " à cette date. Enregistrer quand même ? (un comptage réel corrigera l'écart)")) break;
        }
        if (tt === "encaissement" && mt >= 3000) toast("err", ["⚠️ Un paiement cash de 3 000 € ou plus pour une même prestation est interdit en Belgique (SPF Économie)."]);
        if (bkId && F().caisse.mv.some(function (m0) { return m0.bkId === bkId && m0.type === "encaissement"; })) {
          toast("err", ["Ce RDV a déjà un encaissement cash dans ta caisse — pas de doublon."]); break;
        }
        var mvx = { id: uid("mv"), type: tt, montant: r2(mt), date: dt, motif: val("scf-mv-motif"), bkId: bkId || null, cree: new Date().toISOString() };
        F().caisse.mv.push(mvx);
        if (bkId) { var bb = findBk(bkId); if (bb) { bb.paiement = "cash"; bb.pay = { statut: "paye", moyen: "cash", montant: r2(mt), date: dt }; if (bb.statut !== "termine") { bb.statut = "termine"; if (window.SCB && SCB.onTermine) SCB.onTermine(bb); } if (bb.total && Math.abs(bb.total - mt) > 0.01) toast("err", ["Attention : le RDV est à " + eur2(bb.total) + " mais tu as encaissé " + eur2(mt) + ". Corrige le montant du RDV si le prix a changé."]); } }
        log("Caisse : " + TYPES_MV[tt].l, eur2(mt) + (mvx.motif ? " · " + mvx.motif : ""));
        save(); U.modal = null; drawModal(); renderAll();
        toast("ok", [TYPES_MV[tt].l + " : " + eur2(mt) + ". Caisse attendue : " + eur2(soldeCaisse()) + "."]);
        break;
      }
      case "compter": U.modal = { k: "compter", titre: "Compter ma caisse" }; drawModal(); break;
      case "cpt-save": {
        var reel = num("scf-cpt-reel");
        if (reel == null || reel < 0) { toast("err", ["Indique le montant compté."]); break; }
        var theo = soldeCaisse(), ecart = r2(reel - theo), just = val("scf-cpt-justif");
        var premier = !F().caisse.comptages.length && !F().caisse.mv.length;
        if (ecart && !premier && !just) { toast("err", ["Il y a un écart de " + eur2(ecart) + " : explique-le en une phrase."]); break; }
        if (ecart) F().caisse.mv.push({ id: uid("mv"), type: ecart > 0 ? "apport" : "prelevement", montant: Math.abs(ecart), date: todayStr(), motif: premier ? "Solde de départ (premier comptage)" : "Régularisation après comptage : " + just, cree: new Date().toISOString(), regul: true });
        F().caisse.comptages.push({ id: uid("cc"), date: todayStr(), theo: theo, reel: r2(reel), ecart: premier ? 0 : ecart, justif: just });
        log("Comptage de caisse", "attendu " + eur2(theo) + " · compté " + eur2(reel) + (ecart ? " · écart " + eur2(ecart) : ""));
        save(); U.modal = null; drawModal(); renderMain();
        toast("ok", [ecart ? (premier ? "Solde de départ fixé à " + eur2(reel) + "." : "Écart de " + eur2(ecart) + " enregistré avec ton explication.") : "Caisse juste 👌"]);
        break;
      }
      case "rev-type": U.revType = el.getAttribute("data-v"); U.voirOps = null; renderMain(); break;
      case "rev-nav": { var dd = +el.getAttribute("data-d"); U.revMois = dd === 0 ? todayStr().slice(0, 7) : mkAdd(U.revMois, dd); U.voirOps = null; renderMain(); break; }
      case "ops": U.voirOps = el.getAttribute("data-k") || null; renderMain(); break;
      case "gen": generer(el.getAttribute("data-debut"), el.getAttribute("data-fin")); break;
      case "doc": {
        var d = findAtt(el.getAttribute("data-id")); if (!d) break;
        ouvrirDoc(attestationHtml(d));
        var bar = document.querySelector("#scf-print .scf-bar");
        var change = empreinte(periode(d.debut, d.fin)) !== d.empreinte;
        if (bar) {
          if (d.niveau < 2) bar.insertAdjacentHTML("beforeend", '<button data-scf="signer" data-id="' + d.id + '">✍️ Signer</button>');
          if (change) bar.insertAdjacentHTML("afterend", '<div class="scf-noprint" style="max-width:794px;margin:0 auto 8px;background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;padding:10px;font-size:13px">Les données de cette période ont changé depuis la génération de ce document. <button data-scf="gen" data-debut="' + d.debut + '" data-fin="' + d.fin + '" style="font-weight:800;color:#059669;background:none;border:0">Créer une nouvelle version →</button></div>');
        }
        break;
      }
      case "signer": fermerDoc(); U.modal = { k: "signer", id: el.getAttribute("data-id"), titre: "Signer le document" }; drawModal(); break;
      case "sig-save": {
        var ds = findAtt(el.getAttribute("data-id")); if (!ds) break;
        var nm = val("scf-sig-nom"), ok = document.getElementById("scf-sig-ok");
        if (!nm || !ok || !ok.checked) { toast("err", ["Tape ton nom et coche la confirmation."]); break; }
        if (empreinte(periode(ds.debut, ds.fin)) !== ds.empreinte) { toast("err", ["Les données ont changé depuis ce document : génère d'abord une nouvelle version, puis signe-la."]); break; }
        ds.niveau = 2; ds.signe = { nom: nm, date: new Date().toISOString() };
        log("Attestation signée par l'exploitant", ds.ref + " V" + ds.version);
        save(); U.modal = null; drawModal(); renderMain(); ouvrirDoc(attestationHtml(ds));
        break;
      }
      case "doc-close": fermerDoc(); break;
      case "doc-print": window.print(); break;
      case "fac-rdv": e.stopPropagation(); if (window.SCB) SCB.factureExpress(el.getAttribute("data-id")); else factureDepuisRdv(el.getAttribute("data-id")); break;
      case "fac-voir": { var vv = findVen(el.getAttribute("data-id")); if (vv) ouvrirDoc(factureHtml(vv)); break; }
      case "fac-annuler": annulerParNC(el.getAttribute("data-id")); break;
    }
  });

  /* ============================ API publique =========================== */
  window.SCF = {
    render: function (tab) {
      F();
      if (tab === "caisse") return renderCaisse();
      if (tab === "revenus") return renderRevenus();
      if (tab === "profil") return renderProfil();
      return "";
    },
    periode: periode, soldeCaisse: soldeCaisse, nextNumero: nextNumero,
    factureDepuisRdv: factureDepuisRdv, annulerParNC: annulerParNC,
    factureHtml: factureHtml, attestationHtml: attestationHtml, regles: REGLES, log: log,
    ouvrirDoc: ouvrirDoc, fermerDoc: fermerDoc, F: F, eur2: eur2, dfr: dfr, r2: r2, uid: uid, regleHtml: regleHtml,
    tauxPresta: tauxPresta, TYPES_MV: TYPES_MV
  };
})();
