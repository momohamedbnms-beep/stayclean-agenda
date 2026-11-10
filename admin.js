/* =====================================================================
   StayClean — Assistant administratif et comptable (window.SCA)
   10/11/2026 — demande de Mohamed :
   « Je dépose → tu vérifies → tu me montres les exceptions → je vois quoi
   faire → la preuve est conservée. »

   Principes (non négociables) :
   - Revolut est la source des encaissements. Pas d'espèces : information
     acquise (déclaration de Mohamed du 10/11/2026). Un RDV de l'agenda n'est
     jamais une vente encaissée : ce module n'utilise pas l'agenda.
   - Tous les montants sont recalculés par le code, en centimes entiers, à
     partir des relevés et des pièces. L'IA ne fait que PROPOSER la lecture
     d'une photo ; le résultat reste « à vérifier ».
   - Une information inconnue reste inconnue : pas de pièce ≠ 0 €.
   - Rien n'est marqué payé sans preuve, rien n'est marqué déposé sans
     accusé de réception. Une période déclarée n'est jamais modifiée en
     silence : l'écart est reporté comme correction.
   - Sauvegarde automatique avant chaque import et avant une restauration.
   Données : DB.cpt.admOps / admImp / admDocs / admHist / admDos : tableaux
   d'objets avec id → fusion élément par élément par la synchro existante.
   Originaux : Supabase Storage, bucket privé « mp-files », <uid>/compta/…
   ===================================================================== */
(function () {
  "use strict";

  var VERIF = "2026-11-10"; /* date de vérification des règles ci-dessous */
  var CLE_RAPPELS = "sca-rappels-v1", CLE_SECOURS = "sca-secours-v1";

  /* ------------------------------ utilitaires ------------------------------ */
  function A() {
    var c = cptData();
    ["admOps", "admImp", "admDocs", "admHist", "admDos"].forEach(function (k) { if (!Array.isArray(c[k])) c[k] = []; });
    return c;
  }
  function ct(n) { return Math.round((+n || 0) * 100); }
  function eu(c, signe) {
    if (c == null || isNaN(c)) return "—";
    var neg = c < 0; c = Math.abs(Math.round(c));
    var s = Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + pad(c % 100);
    return (neg ? "−" : (signe && c ? "+" : "")) + s + " €";
  }
  function dfr(s) { if (!s) return "—"; var p = String(s).slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(s); }
  function addJ(s, n) { var d = parseDateStr(s); d.setDate(d.getDate() + n); return fmtDate(d); }
  function ecart(a, b) { return Math.round((parseDateStr(b) - parseDateStr(a)) / 864e5); }
  function uid(p) { return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function nrm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function h(s) { return esc(s == null ? "" : String(s)); }
  function nowIso() { return new Date().toISOString(); }
  function sha256(buf) {
    return crypto.subtle.digest("SHA-256", buf).then(function (x) {
      return Array.from(new Uint8Array(x)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    });
  }
  function trimDe(d) {
    var y = +d.slice(0, 4), t = Math.floor((+d.slice(5, 7) - 1) / 3) + 1;
    return { y: y, t: t, id: y + "T" + t, label: "T" + t + " " + y,
      deb: y + "-" + pad((t - 1) * 3 + 1) + "-01", fin: fmtDate(new Date(y, t * 3, 0)),
      ech: t === 4 ? (y + 1) + "-01-25" : y + "-" + pad(t * 3 + 1) + "-25" };
  }
  function trimSuiv(q) { return trimDe(addJ(q.fin, 1)); }
  function finMois(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7); return fmtDate(new Date(y, m, 0)); }
  function debutActivite() { var p = (window.SCF && SCF.F) ? SCF.F().profil : {}; return p.debut || "2026-09-01"; }

  /* ------------------------- règles vérifiées (sources) ------------------------- */
  /* Chaque règle : texte court, source officielle, date de vérification. Les liens
     sont des entrées officielles : l'appli n'invente jamais de lien personnel. */
  var R = {
    tva21: { t: "Nettoyage de canapés, tapis, matelas chez un particulier ou une entreprise : TVA 21 %.", src: "SPF Finances — taux de TVA (le taux réduit des logements de plus de 10 ans exclut le nettoyage)", url: "https://finances.belgium.be/fr/entreprises/tva/taux-tva" },
    delaiTva: { t: "Déclarant trimestriel : déclaration ET paiement au plus tard le 25 du mois qui suit le trimestre. Le report au jour ouvrable suivant ne vaut plus que pour les déclarants mensuels (régime du compte-provisions, depuis le 01/05/2026).", src: "OECCBB et Forum for the Future (sites du SPF Finances inaccessibles aux robots)", url: "https://blog.oeccbb.be/fr/article/le-compte-provisions-tva-remplace-le-compte-courant.-guide-pratique-pour-la-mise-en-route-au-1er-mai-2026/31047" },
    payTva: { t: "Paiement de la TVA sur le compte-provisions BE41 6792 0036 4210 avec ta communication structurée (calculée sur ton n° d'entreprise). Un paiement lancé depuis MyMinfin remplit le compte et la communication automatiquement. BIC (seulement depuis l'étranger) : GEBABEBB.", src: "Communiqué du SPF Finances (news.belgium.be) ; Deloitte", url: "https://news.belgium.be/fr/node/42188/pdf" },
    grilles: { t: "Grilles : 03 base des ventes à 21 % · 54 TVA due sur ces ventes · 81/82/83 achats (marchandises / services et biens divers / investissements), sans la TVA déductible · 87 services reçus d'un prestataire hors UE · 88 services reçus d'un prestataire de l'UE · 55 TVA sur 86 et 88 · 56 TVA sur 87 · 59 TVA déductible · 71 solde dû à l'État · 72 solde en ta faveur.", src: "Notice 625 de la déclaration périodique (copie) ; aide Accountable « achats hors UE / dans l'UE »", url: "https://download.noalyss.eu/Documentation/625-notice.pdf" },
    autoliq: { t: "Service acheté à un prestataire étranger (logiciel, publicité) avec ton n° de TVA : pas de TVA sur la facture, tu déclares la TVA due (hors UE : 87 + 56 ; UE : 88 + 55), la base en 82 et tu la déduis en 59 dans la même déclaration — effet nul si l'usage est 100 % professionnel.", src: "Code TVA, art. 21 § 2 et 51 § 2, 1° ; aide Accountable « achats en dehors de l'UE »", url: "https://www.accountable.eu/fr-be/help-center/%F0%9F%9B%92-comment-encoder-mes-achats-en-dehors-de-lunion-europeenne/" },
    facture: { t: "Pour déduire la TVA, il faut une facture à ton nom et ton n° de TVA. Un ticket de caisse prouve la dépense mais ne suffit pas pour récupérer la TVA. Carburant : demande la facture à la station (ex. Q8 : en station avec personnel ou via le service clients, jusqu'à 1 an en arrière).", src: "AR n° 3, art. 3 ; Degand & Partners (ticket de caisse et TVA) ; aide Q8", url: "https://support.q8.be/hc/en-us/articles/360015368439-How-can-I-receive-an-invoice-for-my-fuel-purchases-at-Q8-and-Q8-easy-for-businesses-only" },
    voiture: { t: "Voiture : TVA déductible au maximum à 50 % (carburant, entretien, leasing ; parking assimilé — à confirmer), et seulement pour la part professionnelle. Camionnette immatriculée utilitaire : selon l'usage professionnel réel, jusqu'à 100 %. Restaurant et repas : TVA non déductible.", src: "Code TVA, art. 45 § 2 et § 3 ; Infos TVA (avocats.be)", url: "https://infos-tva.avocats.be/print/38" },
    listing: { t: "Listing annuel des clients assujettis à la TVA : à déposer au plus tard le 31 mars de l'année suivante, pour les clients belges assujettis facturés pour plus de 250 € HTVA sur l'année.", src: "Aide Accountable « listing clients annuel »", url: "https://www.accountable.eu/fr-be/help-center/quand-et-comment-soumettre-mon-listing-clients-annuel/" },
    peppol: { t: "Depuis le 01/01/2026, une facture à une entreprise belge assujettie à la TVA doit être une facture électronique structurée envoyée via Peppol (la tolérance du 1er trimestre 2026 est finie ; amendes prévues : 1 500 €, puis 3 000 €, puis 5 000 €). Les particuliers ne sont pas concernés.", src: "SPF Finances — efacture.belgium.be ; Xerius", url: "https://efacture.belgium.be/fr/news/periode-de-tolerance-pendant-les-trois-premiers-mois-de-2026" },
    archives: { t: "Garde factures, relevés et pièces 10 ans, lisibles et non modifiés : 10 ans pour la TVA et l'impôt (depuis 2023), 7 ans selon le Code de droit économique — on retient la durée la plus longue.", src: "IRE, note technique « délai de conservation des archives » ; Forum for the Future", url: "https://www.ibr-ire.be/fr/reglementation-et-publications/doctrine/notes-techniques/note-technique-detail-page/d-lai-de-conservation-des-archives-partie-2" },
    cotis: { t: "Indépendant à titre principal 2026 : cotisation provisoire minimale 890,42 € par trimestre hors frais (917,58 € avec les frais de gestion Xerius de 3,05 %). Primostarter : réduction possible pendant les 4 premiers trimestres si le revenu annualisé reste sous 17 374,08 € ; au plus bas 459,82 € hors frais, soit 473,85 € chez Xerius, sous 8 972,07 €. Une réduction injustifiée est régularisée avec majorations.", src: "SPF Sécurité sociale, note de cotisations 2026 ; INASTI (primostarter) ; Xerius", url: "https://socialsecurity.belgium.be/sites/default/files/content/docs/fr/elaboration-politique-sociale/independants/note_de_cotisations_2026_tableau_fr.pdf" },
    payXerius: { t: "La cotisation doit être arrivée chez Xerius au plus tard le dernier jour du trimestre. Starter : tes deux premiers trimestres bénéficient automatiquement d'un report d'un trimestre. Comptes certifiés de Xerius : BE36 4100 4034 8181, BE15 0682 1587 3830, BE86 6300 3299 8550 ; la communication structurée est celle de ton décompte.", src: "Xerius — cotisations sociales (comptes certifiés, délais, report starter)", url: "https://www.xerius.be/fr-be/independants/securite-sociale/cotisations-sociales" },
    ipp: { t: "Impôt des personnes physiques (revenus 2026) : barème 25 % jusqu'à 16 720 €, 40 % jusqu'à 29 510 €, 45 % jusqu'à 51 070 €, 50 % au-delà ; quotité exemptée de base 11 180 € ; centimes additionnels communaux en plus. Versements anticipés facultatifs.", src: "SPF Finances — barèmes revenus 2026 ; versements anticipés", url: "https://finances.belgium.be/fr/particuliers/declaration_impot/taux_revenus_imposables/taux" },
    ciao: { t: "Nettoyage : l'enregistrement des présences « Check in and out at Work » (depuis le 01/09/2024) et la déclaration de travaux visent le nettoyage d'un bien IMMOBILIER pour un tiers, à partir de 30 000 € HTVA sans sous-traitant (5 000 € avec). Les biens meubles — canapés, tapis, matelas, sièges de voiture — sont exclus.", src: "Sécurité sociale — Check in and out at Work ; FAQ déclaration de travaux", url: "https://www.socialsecurity.be/site_fr/employer/applics/check-in-and-out-at-work/index.htm" },
    revolut: { t: "Relevé Revolut Business : Accueil → « … » → Statements → Account statement → compte EUR → période → format PDF ou CSV.", src: "Revolut — aide « How to get a monthly statement »", url: "https://help.revolut.com/business/help/managing-my-business/viewing-my-account-statements/how-to-get-a-monthly-statement/" }
  };
  var LIENS = {
    myminfin: { lib: "MyMinfin", url: "https://www.minfin.fgov.be/myminfin-web/pages/public" },
    intervat: { lib: "Intervat", url: "https://intervat.minfin.fgov.be" },
    accountable: { lib: "Accountable", url: "https://web.accountable.eu/login" },
    myxerius: { lib: "My Xerius", url: "https://www.xerius.be/tool/my-xerius/fr-be/" },
    revolut: { lib: "Revolut Business", url: "https://business.revolut.com" }
  };
  var IBAN_TVA = "BE41 6792 0036 4210";
  var TAUX_CARTE = 0.017; /* commission constatée sur les règlements carte de sept. 2026 (prix ronds) — à confirmer */
  var INASTI = { 2026: { min: 89042, seuil: 1737408, primo: 897207, primoTrim: 45982, frais: 0.0305, minXerius: 91758, primoXerius: 47385 } }; /* centimes ; montants Xerius frais compris (site Xerius, 10/11/2026) */
  function inasti(y) { return INASTI[y] || INASTI[2026]; }

  /* ------------------------- chargement des bibliothèques ------------------------- */
  var LIB = {
    pdf: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    worker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
    zip: "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
  };
  var SRI = {};
  SRI[LIB.pdf] = "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e";
  SRI[LIB.worker] = "sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2";
  SRI[LIB.zip] = "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG";
  var _sc = {};
  function charger(src, glob) {
    if (glob && window[glob]) return Promise.resolve(window[glob]);
    if (_sc[src]) return _sc[src];
    _sc[src] = new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      if (SRI[src]) { s.integrity = SRI[src]; s.crossOrigin = "anonymous"; }
      s.onload = function () { res(glob ? window[glob] : true); };
      s.onerror = function () { delete _sc[src]; rej(new Error("Bibliothèque non chargée (connexion ?) : " + src.split("/").pop())); };
      document.head.appendChild(s);
    });
    return _sc[src];
  }
  function pdfjs() { return charger(LIB.worker, "pdfjsWorker").then(function () { return charger(LIB.pdf, "pdfjsLib"); }); }

  /* --------------------------- lecture des PDF (texte) --------------------------- */
  function pdfLignes(buf) {
    return pdfjs().then(function (lib) {
      return lib.getDocument({ data: new Uint8Array(buf.slice(0)), isEvalSupported: false }).promise;
    }).then(function (pdf) {
      var pages = [], ch = Promise.resolve();
      for (var n = 1; n <= pdf.numPages; n++) (function (n) {
        ch = ch.then(function () {
          return pdf.getPage(n).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
            var it = tc.items.filter(function (i) { return i.str && i.str.trim(); }).map(function (i) {
              return { s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0 };
            });
            it.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
            var L = [];
            it.forEach(function (i) {
              var der = L[L.length - 1];
              if (der && Math.abs(der.y - i.y) <= 2.5) der.items.push(i); else L.push({ y: i.y, items: [i] });
            });
            L.forEach(function (l) {
              l.items.sort(function (a, b) { return a.x - b.x; });
              /* fusionne les morceaux collés (même mot coupé en deux) */
              var cells = [];
              l.items.forEach(function (i) {
                var c = cells[cells.length - 1];
                if (c && i.x - (c.x + c.w) < 2.2) { c.s += (i.x - (c.x + c.w) > 0.8 ? " " : "") + i.s; c.w = i.x + i.w - c.x; }
                else cells.push({ s: i.s, x: i.x, w: i.w });
              });
              l.cells = cells;
              l.txt = cells.map(function (c) { return c.s; }).join(" ").replace(/\s+/g, " ").trim();
            });
            pages.push(L);
          });
        });
      })(n);
      return ch.then(function () {
        return { pages: pages, texte: pages.map(function (L) { return L.map(function (l) { return l.txt; }).join("\n"); }).join("\n") };
      });
    });
  }

  /* ------------------------------ dates & montants ------------------------------ */
  var MOIS = { janv: 1, jan: 1, janvier: 1, january: 1, januari: 1, fevr: 2, fev: 2, feb: 2, fevrier: 2, february: 2, februari: 2,
    mars: 3, mar: 3, march: 3, maart: 3, mrt: 3, avr: 4, apr: 4, avril: 4, april: 4, mai: 5, may: 5, mei: 5,
    juin: 6, jun: 6, june: 6, juni: 6, juil: 7, jul: 7, juillet: 7, july: 7, juli: 7, aout: 8, aug: 8, august: 8, augustus: 8,
    sept: 9, sep: 9, septembre: 9, september: 9, oct: 10, okt: 10, octobre: 10, october: 10, oktober: 10,
    nov: 11, novembre: 11, november: 11, dec: 12, decembre: 12, december: 12 };
  function dateTxt(s) {
    var t = nrm(s).replace(/[.,]/g, " ").replace(/\s+/g, " ").trim(), m;
    if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return m[1] + "-" + m[2] + "-" + m[3];
    if ((m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/))) return m[3] + "-" + pad(+m[2]) + "-" + pad(+m[1]);
    if ((m = t.match(/^(\d{1,2}) ([a-z]+) (\d{4})/)) && MOIS[m[2]]) return m[3] + "-" + pad(MOIS[m[2]]) + "-" + pad(+m[1]);
    if ((m = t.match(/^([a-z]+) (\d{1,2}) (\d{4})/)) && MOIS[m[1]]) return m[3] + "-" + pad(MOIS[m[1]]) + "-" + pad(+m[2]);
    return null;
  }
  function estMontant(s) { var t = String(s || "").trim(); return /[€$£]/.test(t) && /^[\-−+]?\s?[€$£]?\s?\d[\d .  ]*[,.]\d{2}\s?[€$£]?$/.test(t); }
  function montantTxt(s) {
    var t = String(s || "").replace(/[  ]/g, " ").trim();
    var dev = /\$|usd/i.test(t) ? "USD" : /£|gbp/i.test(t) ? "GBP" : "EUR";
    var m = t.replace(/[^\d,.\-−]/g, "");
    if (!/\d/.test(m)) return null;
    var neg = /^[\-−]/.test(m); m = m.replace(/[\-−]/g, "");
    if (/,\d{1,2}$/.test(m)) m = m.replace(/\./g, "").replace(",", ".");
    else if (/\.\d{1,2}$/.test(m)) m = m.replace(/,/g, "");
    else m = m.replace(/[,.]/g, "");
    var v = Math.round(parseFloat(m) * 100);
    if (isNaN(v)) return null;
    return { c: neg ? -v : v, dev: dev };
  }

  /* --------------------------- relevé Revolut (PDF) --------------------------- */
  var PIED = /revolut bank uab|signaler une carte|report (a )?lost|page \d+ (sur|of|van) \d+|©|obtenez de l.aide|get help|scannez|scan the|garantie des dépôts|deposit guarantee|le solde figurant|the balance on/i;
  function colonnes(l) {
    var c = {};
    l.cells.forEach(function (x) {
      var t = nrm(x.s);
      if (/^description|^omschrijving/.test(t)) c.desc = x.x;
      else if (/sortant|money out|uitgaand/.test(t)) c.out = x.x;
      else if (/entrant|money in|inkomend/.test(t)) c.inn = x.x;
      else if (/^(solde|balance|saldo)$/.test(t)) c.solde = x.x;
    });
    return (c.desc != null && c.out != null && c.inn != null && c.solde != null) ? c : null;
  }
  function colDe(x, c) {
    /* montants alignés à gauche sous leur en-tête (relevés FR/EN) ; on prend l'en-tête le plus proche */
    var d = [["out", Math.abs(x.x - c.out)], ["inn", Math.abs(x.x - c.inn)], ["solde", Math.abs(x.x - c.solde)]];
    d.sort(function (a, b) { return a[1] - b[1]; });
    return d[0][0];
  }
  var RE_DATES = /(\d{1,2}\s+[a-zA-Zéûô]{3,9}\.?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})/g;
  function parseRevolutPdf(P) {
    var txt = P.texte;
    if (!/revolut/i.test(txt) || !/(argent sortant|money out|uitgaand)/i.test(txt)) return null;
    var R0 = { banque: "Revolut", iban: null, sections: [], resume: [], ops: [], anomalies: [] };
    var mI = txt.match(/IBAN[ :]*([A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?)(?![A-Z0-9])/);
    if (mI) R0.iban = mI[1].replace(/\s/g, "");
    var sec = null, cur = null;
    P.pages.forEach(function (L, pi) {
      var cols = null;
      L.forEach(function (l) {
        var t = l.txt;
        var mp = t.match(/^Transactions\s+(.*?)\s*(?:de|from|van)\s+(\d{1,2}\s+\S+\s+\d{4})\s+(?:à|a|to|tot)\s+(\d{1,2}\s+\S+\s+\d{4})/i);
        if (mp) { sec = { produit: (mp[1] || "").trim() || "Compte", du: dateTxt(mp[2]), au: dateTxt(mp[3]) }; R0.sections.push(sec); cur = null; return; }
        var am = l.cells.filter(function (x) { return estMontant(x.s); });
        if (!cols && am.length === 4 && !dateTxt(l.cells[0].s)) {
          R0.resume.push({ produit: l.cells[0].s.trim(), ouv: montantTxt(am[0].s).c, out: montantTxt(am[1].s).c, inn: montantTxt(am[2].s).c, clo: montantTxt(am[3].s).c });
          return;
        }
        var cc = colonnes(l);
        if (cc) { cols = cc; cur = null; return; }
        if (!cols || !sec || PIED.test(t)) return;
        var dates = [], gauche = [], desc = [], mts = [];
        l.cells.forEach(function (x) {
          if (x.x < cols.desc - 4) gauche.push(x.s);
          else if (estMontant(x.s) && x.x + x.w > cols.out - 10) mts.push(x);
          else desc.push(x.s);
        });
        (gauche.join(" ").match(RE_DATES) || []).forEach(function (z) { var d = dateTxt(z); if (d) dates.push(d); });
        if (dates.length) {
          cur = { dv: dates[0], dr: dates[1] || dates[0], lib: desc.join(" ").replace(/\s+/g, " ").trim(), det: [], out: 0, inn: 0, solde: null, txid: null, page: pi + 1, produit: sec.produit, y: l.y };
          mts.forEach(function (x) {
            var m = montantTxt(x.s), k = colDe(x, cols);
            if (!m) return;
            if (k === "out") cur.out = Math.abs(m.c); else if (k === "inn") cur.inn = Math.abs(m.c); else cur.solde = m.c;
          });
          R0.ops.push(cur);
          return;
        }
        if (!cur) return;
        var dt = desc.join(" ").replace(/\s+/g, " ").trim(), mx;
        if ((mx = dt.match(/(?:ID de transaction|Transaction ID|Transactie-?ID)\s*:?\s*([0-9a-f][0-9a-f\-]{15,})/i))) { cur.txid = mx[1].toLowerCase(); return; }
        if ((mx = dt.match(/^(?:À|A|To|Aan)\s*:\s*(.+)$/i))) { cur.a = mx[1].trim(); return; }
        if ((mx = dt.match(/^(?:De|From|Van)\s*:\s*(.+)$/i))) { cur.de = mx[1].trim(); return; }
        if ((mx = dt.match(/^(?:Référence|Reference|Referentie)\s*:\s*(.+)$/i))) { cur.ref = mx[1].trim(); return; }
        if (/^(Carte|Card|Kaart)\s*:/i.test(dt)) { cur.carte = dt.replace(/^[^:]*:\s*/, ""); return; }
        if (/taux|rate|koers/i.test(dt) || (!dt && mts.length)) {
          var fm = mts.map(function (x) { return montantTxt(x.s); }).filter(Boolean)[0];
          if (fm) cur.dev = { c: Math.abs(fm.c), dev: fm.dev };
          if (dt) cur.taux = dt;
          return;
        }
        if (dt && !cur.txid && !cur.ref && !cur.a && !cur.de && !cur.det.length && Math.abs(cur.y - l.y) < 16) { cur.lib += " " + dt; return; }
        if (dt) cur.det.push(dt);
      });
    });
    /* contrôles : sommes, soldes ligne par ligne */
    var parProd = {};
    R0.ops.forEach(function (o) { (parProd[o.produit] = parProd[o.produit] || []).push(o); });
    Object.keys(parProd).forEach(function (pr) {
      var res = R0.resume.filter(function (r) { return nrm(r.produit) === nrm(pr); })[0] || (R0.resume.length === 2 ? R0.resume[0] : null);
      var ops = parProd[pr], sOut = 0, sIn = 0, prev = res ? res.ouv : null, okSolde = true;
      ops.forEach(function (o) {
        sOut += o.out; sIn += o.inn;
        if (prev != null && o.solde != null) {
          if (prev + o.inn - o.out !== o.solde) { okSolde = false; R0.anomalies.push("Solde incohérent après « " + o.lib + " » du " + dfr(o.dv) + " (attendu " + eu(prev + o.inn - o.out) + ", relevé " + eu(o.solde) + ")."); }
          prev = o.solde;
        } else if (prev != null) prev = prev + o.inn - o.out;
      });
      var ctrl = { produit: pr, sOut: sOut, sIn: sIn, ouv: res ? res.ouv : null, clo: res ? res.clo : null, okSommes: !!res && res.out === sOut && res.inn === sIn, okSolde: okSolde && !!res && res.ouv + sIn - sOut === res.clo };
      if (!res) R0.anomalies.push("Résumé du solde introuvable pour « " + pr + " » : contrôle des totaux impossible.");
      else if (!ctrl.okSommes) R0.anomalies.push("Totaux lus (" + eu(sOut) + " sortis, " + eu(sIn) + " entrés) différents du résumé du relevé (" + eu(res.out) + " / " + eu(res.inn) + ") : une ligne n'a peut-être pas été lue.");
      (R0.ctrl = R0.ctrl || []).push(ctrl);
    });
    if (!R0.ops.length) R0.anomalies.push("Aucune opération lue dans ce relevé.");
    return R0;
  }

  /* ----------------------------- relevé Revolut (CSV) ----------------------------- */
  function csvLignes(txt) {
    txt = txt.replace(/^﻿/, "");
    var sep = (txt.split("\n")[0].match(/;/g) || []).length > (txt.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim(); }); });
  }
  function parseRevolutCsv(txt, nomFichier) {
    var rows = csvLignes(txt);
    if (rows.length < 2) return null;
    var H = rows[0].map(nrm);
    function col(re) { for (var i = 0; i < H.length; i++) if (re.test(H[i])) return i; return -1; }
    var ix = {
      id: col(/^id$|transaction id|id de transaction/), dc: col(/completed|achevement|date de fin|termine/), ds: col(/started|date de debut|^date/),
      type: col(/^type$/), etat: col(/^state$|^etat$|^statut$/), desc: col(/^description$/), ref: col(/^reference$|^référence$|^reference /),
      payer: col(/^payer$|^payeur$/), mt: col(/^amount$|^montant$/), tot: col(/total amount|montant total/), fee: col(/^fee$|^frais$/),
      dev: col(/payment currency|devise du paiement|^currency$|^devise$/), solde: col(/^balance$|^solde$/), compte: col(/^account$|^compte$/),
      odev: col(/orig currency|devise d.origine/), omt: col(/orig amount|montant d.origine/), benef: col(/beneficiary iban|iban du beneficiaire/)
    };
    if (ix.mt < 0 || (ix.dc < 0 && ix.ds < 0) || ix.desc < 0) return null;
    var R0 = { banque: "Revolut", iban: null, sections: [], resume: [], ops: [], anomalies: [], csv: true };
    rows.slice(1).forEach(function (r, n) {
      function g(i) { return i >= 0 ? (r[i] || "").trim() : ""; }
      var etat = nrm(g(ix.etat));
      if (etat && !/completed|termine|effectue|complete/.test(etat)) return; /* en attente / refusée / annulée : pas une opération réelle */
      var d = dateTxt(g(ix.dc) || g(ix.ds));
      var m = montantTxt(g(ix.mt) + " €"), fee = ix.fee >= 0 ? montantTxt(g(ix.fee) + " €") : null, so = ix.solde >= 0 && g(ix.solde) ? montantTxt(g(ix.solde) + " €") : null;
      if (!d || !m) { R0.anomalies.push("Ligne " + (n + 2) + " illisible (date ou montant)."); return; }
      if (g(ix.dev) && !/eur/i.test(g(ix.dev))) R0.anomalies.push("Ligne " + (n + 2) + " en " + g(ix.dev) + " : compte en devise à vérifier.");
      var o = { dv: d, dr: d, lib: g(ix.desc), det: [], out: m.c < 0 ? -m.c : 0, inn: m.c > 0 ? m.c : 0, solde: so ? so.c : null, txid: g(ix.id) ? g(ix.id).toLowerCase() : null, produit: g(ix.compte) || "Compte", typ: g(ix.type) };
      if (g(ix.ref)) o.ref = g(ix.ref);
      if (g(ix.payer)) o.de = g(ix.payer);
      if (fee && fee.c) o.frais = Math.abs(fee.c);
      if (ix.omt >= 0 && g(ix.odev) && !/eur/i.test(g(ix.odev))) { var om = montantTxt(g(ix.omt) + " $"); if (om) o.dev = { c: Math.abs(om.c), dev: g(ix.odev).toUpperCase() }; }
      R0.ops.push(o);
    });
    if (!R0.ops.length) return null;
    R0.ops.sort(function (a, b) { return a.dv < b.dv ? -1 : a.dv > b.dv ? 1 : 0; });
    var ds = R0.ops.map(function (o) { return o.dv; });
    var mfn = (nomFichier || "").match(/(\d{4}-\d{2}-\d{2}).*?(\d{4}-\d{2}-\d{2})/);
    R0.sections.push({ produit: R0.ops[0].produit, du: mfn ? mfn[1] : ds[0], au: mfn ? mfn[2] : ds[ds.length - 1], approx: !mfn });
    if (!mfn) R0.anomalies.push("Période déduite des dates des opérations (" + dfr(ds[0]) + " → " + dfr(ds[ds.length - 1]) + ") : le CSV ne contient pas les dates exactes du relevé.");
    return R0;
  }

  /* ------------------------------ pièces (factures…) ------------------------------ */
  var MOI_TVA = /1041[\s.]?970[\s.]?832/;
  var CONNUS = [[/google/i, "Google Ads", "IE"], [/facebook|meta platforms/i, "Meta (Facebook)", "IE"], [/higgsfield/i, "Higgsfield Inc.", "US"],
    [/elevenlabs|eleven labs/i, "ElevenLabs", null], [/openai/i, "OpenAI", null], [/anthropic/i, "Anthropic", null], [/chatwoot/i, "Chatwoot", "US"],
    [/accountable/i, "Accountable", "BE"], [/apple/i, "Apple", "IE"], [/xerius/i, "Xerius", "BE"], [/\bshell\b/i, "Shell", "BE"], [/\bq8\b|kuwait petroleum/i, "Q8", "BE"],
    [/\besso\b/i, "Esso", "BE"], [/lukoil/i, "Lukoil", "BE"], [/totalenergies/i, "TotalEnergies", "BE"], [/easypark/i, "EasyPark", "BE"], [/proximus/i, "Proximus", "BE"]];
  function montantsDe(ligne) {
    return (ligne.match(/[\-−]?(?:€|\$|EUR|USD)?\s?\d{1,3}(?:[ .  ]?\d{3})*[.,]\d{2}(?!\d)\s?(?:€|\$|EUR|USD)?/g) || [])
      .map(function (s) { return montantTxt(/[€$]|EUR|USD/.test(s) ? s : s + " €"); }).filter(Boolean);
  }
  function lirePiece(texte) {
    var t = texte || "", tn = nrm(t), f = { lu: "auto" }, lignes = t.split(/\n/);
    /* facture émise par StayClean : notre IBAN y figure (instructions de paiement) ou elle commence par notre nom */
    var nous = /BE90\s?6500\s?6531\s?0632/.test(t) || /^\s*stay ?clean/i.test(lignes.filter(function (l) { return l.trim(); })[0] || "");
    if (/xerius/.test(tn) && /(decompte|cotisation|avis)/.test(tn)) f.type = "decompte_xerius";
    else if (/(accuse de reception|accuse de depot|ontvangstbevestiging|bevestiging van indiening)/.test(tn)) f.type = "accuse_depot";
    else if (/(avertissement.extrait de role|aanslagbiljet)/.test(tn)) f.type = "courrier_fisc";
    else if (/(facture|invoice|factuur|note de credit|credit note)/.test(tn) && nous) f.type = "facture_vente";
    else if (/(facture|invoice|factuur|receipt|recu de paiement|kwitantie)/.test(tn)) f.type = "facture_achat";
    else if (/(ticket|kassabon|bon de caisse|carburant|diesel|euro ?95|super ?98|litres?)/.test(tn)) f.type = "ticket";
    else if (/(virement|ordre de paiement|payment confirmation|confirmation de paiement|betalingsbevestiging)/.test(tn)) f.type = "preuve_paiement";
    else f.type = "autre";
    CONNUS.some(function (k) { if (k[0].test(t)) { f.fournisseur = k[1]; if (k[2]) f.pays = k[2]; return true; } return false; });
    if (!f.fournisseur) { var l0 = lignes.map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 2 && !/^(facture|invoice|receipt|page)/i.test(x); })[0]; if (l0) f.fournisseur = l0.slice(0, 60); }
    var dm = t.match(RE_DATES); if (dm) { for (var i = 0; i < dm.length; i++) { var d = dateTxt(dm[i]); if (d && d >= "2020-01-01") { f.date = d; break; } } }
    var mn = t.match(/(?:facture|invoice|factuur|receipt|re[çc]u)\s*(?:n[°o]\.?|number|no\.?|#|nr\.?|num[ée]ro)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/_.]{2,30})/i);
    if (mn) f.numero = mn[1];
    /* total : dernière ligne « total / à payer / amount due » portant un montant */
    var tot = null, tvaL = null;
    lignes.forEach(function (l) {
      var ln = nrm(l), ms = montantsDe(l);
      if (!ms.length) return;
      if (/(total|a payer|amount due|amount paid|montant du|te betalen|totaal|total due)/.test(ln) && !/(sous.total|subtotal|hors tva|htva|excl|zonder btw|before tax)/.test(ln)) tot = ms[ms.length - 1];
      if (/\b(tva|vat|btw|tax)\b/.test(ln) && !/(n[°o]|number|numero|nummer|id|reg)/.test(ln.replace(/\d/g, ""))) tvaL = ms[ms.length - 1];
    });
    if (tot) { f.ttc = Math.abs(tot.c); f.devise = tot.dev; }
    if (tvaL && tot && Math.abs(tvaL.c) < Math.abs(tot.c)) f.tva = Math.abs(tvaL.c);
    var mt = t.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s?%/); if (mt) f.taux = parseFloat(mt[1].replace(",", "."));
    var vf = (t.match(/\b(BE|IE|NL|FR|DE|LU|LT|PL|ES|IT|EU)\s?0?\d[\d .]{7,13}\d\b/g) || []).filter(function (v) { return !MOI_TVA.test(v); })[0];
    if (vf) { f.tvaFour = vf.replace(/\s/g, ""); if (!f.pays && vf.slice(0, 2) !== "EU") f.pays = vf.slice(0, 2); if (vf.slice(0, 2) === "EU") f.oss = true; }
    f.monTva = MOI_TVA.test(t);
    f.autoliq = /autoliquidation|reverse.charge|verlegging|btw verlegd|art(icle)?\.?\s?196|to be accounted for by the recipient|vat to be paid by the customer|tva due par le preneur/i.test(t);
    if (f.ttc == null && f.type !== "autre") f.aCompleter = true;
    return f;
  }
  function imageB64(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var max = 1600, sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * sc); c.height = Math.round(im.naturalHeight * sc);
        var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
      };
      im.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Image illisible par le navigateur (format HEIC ?) : saisis les montants à la main.")); };
      im.src = url;
    });
  }
  function lireParIA(file) {
    if (typeof callIA !== "function" || (typeof activeKeyMissing === "function" && activeKeyMissing())) return Promise.resolve(null);
    return imageB64(file).then(function (b64) {
      var p = "Tu lis une pièce comptable belge (photo). Réponds UNIQUEMENT par un objet JSON : " +
        '{"type":"facture_achat|ticket|facture_vente|decompte_xerius|accuse_depot|preuve_paiement|autre","lisible":true,"fournisseur":"","pays":"code ISO 2 lettres ou vide","numero":"","date":"AAAA-MM-JJ","ttc":0,"tva":0,"taux":21,"devise":"EUR","tva_fournisseur":"","mon_tva_present":false,"autoliquidation":false}. ' +
        "ttc et tva en euros (nombre). mon_tva_present = le numéro BE 1041.970.832 apparaît. Si la photo est floue ou coupée, lisible=false. N'invente rien : laisse vide ce que tu ne vois pas.";
      return callIA(p, [{ media: "image/jpeg", b64: b64 }]);
    }).then(function (txt) {
      if (!txt) return null;
      var m = String(txt).match(/\{[\s\S]*\}/); if (!m) return null;
      var j = JSON.parse(m[0]);
      var f = { lu: "ia", type: j.type || "autre", lisible: j.lisible !== false, fournisseur: j.fournisseur || "", pays: (j.pays || "").toUpperCase().slice(0, 2) || undefined, numero: j.numero || "", date: /^\d{4}-\d{2}-\d{2}$/.test(j.date || "") ? j.date : undefined,
        ttc: j.ttc ? ct(j.ttc) : undefined, tva: j.tva || j.tva === 0 ? ct(j.tva) : undefined, taux: j.taux || undefined, devise: j.devise || "EUR", tvaFour: j.tva_fournisseur || "", monTva: !!j.mon_tva_present, autoliq: !!j.autoliquidation };
      return f;
    });
  }

  /* ---------------------------- originaux en ligne ---------------------------- */
  function slug(s) { return nrm(s).replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "fichier"; }
  function client() { try { var sb = typeof getSb === "function" ? getSb() : null; return sb && window.session && window.session.user ? sb : null; } catch (e) { return null; } }
  function envoyerOriginal(doc, blob) {
    var sb = client();
    if (!sb) { doc.envoi = "hors connexion"; return Promise.resolve(false); }
    var an = (doc.date || doc.le || "").slice(0, 4) || "divers";
    var chemin = window.session.user.id + "/compta/" + an + "/" + doc.sha.slice(0, 16) + "-" + slug(doc.nom);
    return sb.storage.from("mp-files").upload(chemin, blob, { upsert: false, contentType: doc.mime || "application/octet-stream" }).then(function (r) {
      if (r.error && !/exist|duplicate/i.test(r.error.message || "")) throw new Error(r.error.message);
      doc.chemin = chemin; delete doc.envoi; return true;
    }).catch(function (e) { doc.envoi = "échec : " + (e && e.message || e); return false; });
  }
  function ouvrirOriginal(doc) {
    var sb = client();
    if (!sb || !doc.chemin) { toast("err", ["Original non disponible en ligne" + (doc.envoi ? " (" + doc.envoi + ")" : "") + "."]); return; }
    var w = window.open("", "_blank");
    sb.storage.from("mp-files").createSignedUrl(doc.chemin, 300).then(function (r) {
      if (r.error) throw r.error;
      if (w) w.location.href = r.data.signedUrl; else location.href = r.data.signedUrl;
    }).catch(function (e) { if (w) w.close(); toast("err", ["Ouverture impossible : " + (e.message || e)]); });
  }

  /* ------------------------------ historique ------------------------------ */
  function hist(x) {
    var e = Object.assign({ id: uid("h"), le: nowIso() }, x);
    A().admHist.push(e);
    return e;
  }

  /* ------------------------- sauvegardes & restauration ------------------------- */
  /* copie complète des données, sans les secrets propres à l'appareil (clé API, connexion) — comme la synchro */
  function donneesSures() { return JSON.parse(JSON.stringify(typeof syncPayload === "function" ? syncPayload() : DB)); }
  function gzip(u8) {
    if (typeof CompressionStream === "undefined") return Promise.resolve(null);
    try { return new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer().then(function (b) { return new Uint8Array(b); }).catch(function () { return null; }); } catch (e) { return Promise.resolve(null); }
  }
  function gunzip(blob) { return new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).text(); }
  function sauvegarder(raison) {
    var paquet = { type: "stayclean-sauvegarde", version: 1, quand: nowIso(), build: window.APP_BUILD || "", raison: raison, local: donneesSures() };
    try { localStorage.setItem(CLE_SECOURS, JSON.stringify({ quand: paquet.quand, raison: raison, cpt: DB.cpt })); } catch (e) { /* stockage plein : la copie en ligne reste */ }
    var sb = client();
    if (!sb) return Promise.resolve({ ok: false, local: true, msg: "Pas de connexion : copie de secours gardée sur cet appareil seulement." });
    var enc = new TextEncoder().encode(JSON.stringify(paquet)), base = window.session.user.id + "/sauvegardes/" + paquet.quand.replace(/[:.]/g, "-") + "-" + slug(raison);
    return Promise.all([sha256(enc), gzip(enc)]).then(function (z) {
      var hash = z[0], gz = z[1], chemin = base + (gz ? ".json.gz" : ".json"), corps = gz || enc;
      return sb.storage.from("mp-files").upload(chemin, new Blob([corps], { type: gz ? "application/gzip" : "application/json" }), { upsert: false, contentType: gz ? "application/gzip" : "application/json" }).then(function (r) {
        if (r.error) throw new Error(r.error.message);
        hist({ type: "sauvegarde", objet: raison, chemin: chemin, octets: corps.length, sha: hash, etape: "faite" });
        return { ok: true, chemin: chemin, octets: corps.length };
      });
    }).catch(function (e) { return { ok: false, msg: "Sauvegarde en ligne impossible : " + (e.message || e) }; });
  }
  function listeSauvegardes() {
    var sb = client();
    if (!sb) return Promise.reject(new Error("Connexion nécessaire pour lister les sauvegardes en ligne."));
    return sb.storage.from("mp-files").list(window.session.user.id + "/sauvegardes", { limit: 100, sortBy: { column: "name", order: "desc" } }).then(function (r) {
      if (r.error) throw new Error(r.error.message);
      return (r.data || []).filter(function (f) { return /\.json(\.gz)?$/.test(f.name); });
    });
  }
  function chargerSauvegarde(nom) {
    var sb = client();
    return sb.storage.from("mp-files").download(window.session.user.id + "/sauvegardes/" + nom).then(function (r) {
      if (r.error) throw new Error(r.error.message);
      return /\.gz$/.test(nom) ? gunzip(r.data) : r.data.text();
    }).then(function (t) { return JSON.parse(t); });
  }
  function resumeSauvegarde(obj) {
    var s = obj && (obj.local || obj.DB || obj), c = s && s.cpt;
    if (!c) return null;
    return { quand: obj.quand || null, raison: obj.raison || "", ops: (c.admOps || []).length, docs: (c.admDocs || []).length, dep: (c.dep || []).length, ven: (c.ven || []).length, oblig: (c.oblig || []).length };
  }
  /* Restaure la COMPTA (DB.cpt) d'une sauvegarde. L'agenda n'est pas touché.
     Une sauvegarde de l'état actuel est faite juste avant. */
  function restaurer(obj) {
    var s = obj && (obj.local || obj.DB || obj);
    if (!s || !s.cpt || typeof s.cpt !== "object") return Promise.reject(new Error("Fichier de sauvegarde non reconnu."));
    return sauvegarder("avant restauration").then(function (r) {
      DB.cpt = JSON.parse(JSON.stringify(s.cpt));
      A();
      hist({ type: "restauration", objet: "Compta restaurée depuis la sauvegarde du " + dfr(obj.quand) + (obj.raison ? " (" + obj.raison + ")" : ""), etape: "faite", note: r.ok ? "État précédent sauvegardé : " + r.chemin : (r.msg || "") });
      save();
      return r;
    });
  }

  /* ------------------------------ classement ------------------------------ */
  var CAT = {
    vente_carte: ["Paiement client par carte", "vente"], vente_vir: ["Virement d'un client", "vente"], rembt_client: ["Remboursement à un client", "vente"],
    interne: ["Mouvement interne (Pocket ou compte à ton nom)", "neutre"], prelev: ["Prélèvement privé (vers ton compte personnel)", "neutre"],
    apport: ["Apport personnel (depuis ton compte personnel)", "neutre"], cashback: ["Cashback Revolut (pas une vente)", "neutre"],
    rembt_four: ["Remboursement d'un fournisseur", "neutre"], paiement_spf: ["Paiement au SPF Finances (TVA ou impôt)", "neutre"],
    cotisations: ["Cotisations sociales (Xerius)", "charge"], logiciel: ["Logiciel / abonnement", "charge"], pub: ["Publicité", "charge"],
    carburant: ["Carburant", "charge"], parking: ["Parking", "charge"], produits: ["Produits de nettoyage", "charge"], materiel: ["Matériel", "charge"],
    telephone: ["Téléphone / internet", "charge"], assurance: ["Assurance", "charge"], frais_bq: ["Frais bancaires", "charge"], formation: ["Formation", "charge"],
    repas: ["Repas / restaurant", "charge"], autre_pro: ["Autre dépense professionnelle", "charge"],
    prive: ["Dépense privée payée avec la carte pro", "neutre"], amende: ["Amende (jamais déductible)", "neutre"], inconnu: ["À préciser", "inconnu"]
  };
  var CAT_CHOIX = ["vente_carte", "vente_vir", "rembt_client", "logiciel", "pub", "carburant", "parking", "produits", "materiel", "telephone", "assurance", "frais_bq", "formation", "repas", "autre_pro", "cotisations", "paiement_spf", "interne", "prelev", "apport", "cashback", "rembt_four", "prive", "amende", "inconnu"];
  var CONF = "Confirmé par Mohamed le 10/11/2026";
  var MEMO = [
    { re: /^to mohamed|^to eur personal|^vers ton compte|^vers eur personal|benmous/, cat: "prelev" },
    { re: /pocket|^to eur( pro)?\b|^depuis eur|^from eur|^exchange|^change /, cat: "interne" },
    { re: /xerius/, cat: "cotisations", four: "Xerius", pays: "BE" },
    { re: /spf finances|fod financien|679200364210/, cat: "paiement_spf" },
    { re: /google/, cat: "pub", four: "Google Ads", usage: "Annonces Google pour trouver des clients StayClean" },
    { re: /facebook|facebk|meta platforms/, cat: "pub", four: "Meta (Facebook / Instagram)", usage: "Publicités Facebook / Instagram StayClean" },
    { re: /higgsfield/, cat: "logiciel", four: "Higgsfield Inc.", usage: "Création des vidéos publicitaires de StayClean", conf: CONF },
    { re: /elevenlabs/, cat: "logiciel", four: "ElevenLabs", usage: "Voix off des vidéos publicitaires de StayClean", conf: CONF },
    { re: /openai|chatgpt/, cat: "logiciel", four: "OpenAI (ChatGPT)", usage: "Assistant IA : devis, messages clients, site StayClean" },
    { re: /anthropic|claude/, cat: "logiciel", four: "Anthropic (Claude)", usage: "Assistant IA : application, site et compta StayClean" },
    { re: /chatwoot/, cat: "logiciel", four: "Chatwoot", usage: "Messagerie clients StayClean" },
    { re: /^apple/, cat: "logiciel", four: "Apple (abonnement Accountable)", usage: "Logiciel de facturation et de TVA Accountable, payé via l'App Store", min: 4549, max: 4549, appstore: true },
    { re: /^apple/, cat: "inconnu", four: "Apple", note: "Achat App Store : quelle application ?" },
    { re: /lukoil|\bshell\b|\bq8\b|\besso\b|\bmaes\b|totalenergies|\btexaco\b|\bgulf\b|\bdats\b|\bavia\b/, cat: "carburant", min: 800 },
    { re: /lukoil|\bshell\b|\bq8\b|\besso\b|\bmaes\b|totalenergies|\btexaco\b|\bgulf\b|\bdats\b|\bavia\b/, cat: "inconnu", note: "Petit montant dans une station-service : achat en boutique ?" },
    { re: /parking puget|vitrolles|marseille|marignane|airport|aeroport|flibco|sl belgium|uber ?\*? ?eats|deliveroo|rentumo|fit ?five|leonidas|nabs |smtpc|azeri|las olas|dia food|isaac gradi/, cat: "prive", note: "Classé privé d'après tes relevés (proposé) : change-le si c'était pour StayClean." },
    { re: /easypark|interparking|indigo|q-park|parking|yellowbrick|4411/, cat: "parking", four: "Parking" },
    { re: /roda market|dodopay|citiclean/, cat: "inconnu" }
  ];
  var ISO3 = { BEL: "BE", IRL: "IE", FRA: "FR", NLD: "NL", DEU: "DE", LUX: "LU", DNK: "DK", GBR: "GB", USA: "US", ESP: "ES", ITA: "IT", PRT: "PT", CHE: "CH", LTU: "LT", POL: "PL", SWE: "SE", AUT: "AT", CZE: "CZ",
    BRU: "BE", VAN: "BE", VLI: "BE", VOV: "BE", VWV: "BE", VBR: "BE", WBR: "BE", WHT: "BE", WLG: "BE", WNA: "BE", WLX: "BE", PAC: "FR", IDF: "FR", NH: "NL", ZH: "NL" };
  var VILLES = [[/dublin|cork/, "IE"], [/san francisco|new york|delaware|palo alto|menlo park|seattle|wilmington/, "US"], [/amsterdam|rotterdam/, "NL"],
    [/marseille|marignane|vitrolles|paris/, "FR"], [/k benhavn|copenhag/, "DK"],
    [/bruxelles|brussel|ixelles|jette|uccle|laeken|molenbeek|schaerbeek|anderlecht|charleroi|schelle|sint-|berchem|etterbeek|forest|evere|easypark\.be/, "BE"]];
  var UE = ["BE", "IE", "FR", "NL", "DE", "LU", "DK", "ES", "IT", "PT", "LT", "PL", "SE", "AT", "CZ", "FI", "GR", "HU", "RO", "BG", "HR", "SI", "SK", "EE", "LV", "CY", "MT"];
  function paysDe(a) {
    if (!a) return null;
    var parts = a.split(",").map(function (x) { return x.trim(); }), der = parts[parts.length - 1] || "", n = nrm(a);
    if (/^BE\d{2}/.test(der)) return "BE";
    if (ISO3[der.toUpperCase()]) return ISO3[der.toUpperCase()];
    for (var i = 0; i < VILLES.length; i++) if (VILLES[i][0].test(n)) return VILLES[i][1];
    if (/^[A-Z]{2}$/.test(der)) return "US"; /* Revolut écrit les pays en 3 lettres : 2 lettres = État américain */
    return null;
  }
  function typeClient(n) {
    var t = " " + nrm((n || "").split(",")[0]).replace(/paiement envoye par|payment from|betaling van/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ") + " ";
    if (/ (sprl|srl|sa|nv|bv|bvba|asbl|vzw|scrl|sc|snc|scs|cv|commv|gmbh|ltd|sas|sarl|auction|immo|group|services|consult|company|societe) /.test(t)) return "entreprise";
    if (/ (m et mme|mr|mme|mlle|monsieur|madame|dhr|mevr) /.test(t)) return "particulier";
    var mots = t.trim().split(" ").filter(function (w) { return w.length > 1; });
    return mots.length >= 2 && mots.length <= 5 ? "particulier" : "à préciser";
  }
  function catAuto(o) {
    var t = nrm((o.lib || "") + " " + (o.a || "") + " " + (o.ref || ""));
    if (o.inn > 0) {
      if (/payment settlement|reglement des paiements|acquiring/.test(t)) return { cat: "vente_carte" };
      if (/cashback/.test(t)) return { cat: "cashback" };
      if (/pocket|depuis eur|from eur|^to eur|exchange/.test(t)) return { cat: "interne" };
      if (/benmous/.test(nrm(o.de || ""))) return { cat: "apport" };
      if (/refund|rembours|terugbetaling/.test(t)) return { cat: "rembt_four" };
      if (/paiement envoye par|payment from|betaling van|virement|transfer from/.test(t)) return { cat: "vente_vir" };
      return { cat: "inconnu" };
    }
    for (var i = 0; i < MEMO.length; i++) {
      var m = MEMO[i];
      if (m.re.test(t) && (m.min == null || o.out >= m.min) && (m.max == null || o.out <= m.max)) return m;
    }
    return { cat: "inconnu" };
  }

  /* ------------------------------ dossier (une fois) ------------------------------ */
  var DOSSIER_INIT = [
    { id: "identite", lib: "Identité professionnelle", val: "Mohamed Benmousa — nom commercial StayClean", src: "Mail Xerius du 07/09/2026 ; relevés Revolut (titulaire MOHAMED BENMOUSA)", st: "confirmé" },
    { id: "bce", lib: "Numéro d'entreprise et de TVA", val: "1041.970.832 (BE 1041.970.832)", src: "Mail Xerius du 07/09/2026 ; profil de l'appli", st: "confirmé" },
    { id: "forme", lib: "Forme juridique", val: "Entreprise personne physique (pas de société)", src: "Mail Xerius du 07/09/2026 : « entreprise personne physique »", st: "confirmé" },
    { id: "adresse", lib: "Siège (domicile) et commune", val: "", src: "Trois adresses différentes : profil de l'appli « Avenue du Sippelberg 4b » ; relevés Revolut « Rue de l'Intendant, 1080 Molenbeek-Saint-Jean » ; unité d'établissement « Rue Kasterlinden 44, 1082 Berchem-Sainte-Agathe »", st: "à confirmer", q: "Quelle est l'adresse officielle de ton domicile aujourd'hui (celle de ta carte d'identité) ?", qType: "texte" },
    { id: "region", lib: "Région", val: "Bruxelles-Capitale", src: "Les trois adresses connues sont dans la Région de Bruxelles-Capitale", st: "confirmé" },
    { id: "debut", lib: "Début d'activité et affiliation", val: "01/09/2026 — Xerius, n° 021108.365.28", src: "My Xerius ; mail Xerius du 07/09/2026", st: "confirmé" },
    { id: "statut", lib: "Statut social", val: "Indépendant à titre principal, starter (primostarter)", src: "My Xerius ; décompte du 03/09/2026", st: "confirmé" },
    { id: "tva", lib: "Régime TVA", val: "Régime normal, déclaration trimestrielle", src: "Formulaire 604A envoyé le 09/09/2026", st: "confirmé" },
    { id: "exercice", lib: "Exercice comptable", val: "Année civile (1er janvier – 31 décembre)", src: "Règle pour une personne physique", st: "confirmé" },
    { id: "banque", lib: "Compte professionnel", val: "Revolut Pro BE90 6500 6531 0632", src: "Relevés Revolut", st: "confirmé" },
    { id: "cash", lib: "Espèces", val: "Aucun encaissement en espèces : tous les clients paient via Revolut", src: "Déclaration de Mohamed, 10/11/2026 (information acquise)", st: "confirmé" },
    { id: "peppol", lib: "Factures électroniques (Peppol)", val: "Inscrit via Accountable le 15/09/2026", src: "Mail Accountable du 15/09/2026", st: "confirmé" },
    { id: "personnel", lib: "Salariés, aidant, sous-traitants", val: "", src: "", st: "à confirmer", q: "As-tu des salariés, un conjoint aidant ou des sous-traitants, même occasionnels ?", qType: "choix", opts: ["Aucun", "Oui"] },
    { id: "vehicule", lib: "Véhicule pour StayClean", val: "", src: "", st: "à confirmer", q: "Ton véhicule pour StayClean : voiture ou camionnette ? Et quelle part de tes kilomètres est professionnelle ?", qType: "vehicule" }
  ];
  function dossierInit() {
    var C = A();
    if (C.admDos.length) return;
    DOSSIER_INIT.forEach(function (d) { C.admDos.push(Object.assign({ le: VERIF }, d)); });
    try { save(); } catch (e) {}
  }
  function dos(id) { return A().admDos.filter(function (d) { return d.id === id; })[0]; }
  function dossierOk(id) { var d = dos(id); return d && d.st === "confirmé" ? d : null; }
  function questions() { return A().admDos.filter(function (d) { return d.st !== "confirmé" && d.q; }).slice(0, 3); }

  /* ----------------------------- calcul par opération ----------------------------- */
  function pctDeduction(cat, o) {
    if (cat === "repas") return { p: 0, r: "TVA des repas non déductible (art. 45 § 3)" };
    if (cat === "carburant" || cat === "parking") {
      var v = dossierOk("vehicule");
      if (!v) return { p: null, r: "Véhicule pas encore précisé" };
      var pro = Math.max(0, Math.min(100, v.pro == null ? 100 : +v.pro)) / 100;
      if (v.val === "voiture") return { p: Math.min(0.5, pro), r: "Voiture : 50 % maximum (art. 45 § 2), limité à ta part professionnelle (" + Math.round(pro * 100) + " %)" };
      if (v.val === "camionnette") return { p: pro, r: "Camionnette : selon ta part professionnelle (" + Math.round(pro * 100) + " %)" };
      return { p: 0, r: "Pas de véhicule professionnel déclaré" };
    }
    if (o && o.pct != null) return { p: o.pct / 100, r: "Part professionnelle précisée : " + o.pct + " %" };
    return { p: 1, r: "Usage 100 % professionnel" };
  }
  var PIECES = { facture_achat: 1, ticket: 1, decompte_xerius: 1 };
  /* prix payé par le client G tel que G − commission arrondie (1,7 %) = net reçu ; on préfère un prix rond */
  function brutDepuisNet(net) {
    var base = Math.floor(net / (1 - TAUX_CARTE)), ok = [];
    for (var g = base - 3; g <= base + 3; g++) if (g - Math.round(g * TAUX_CARTE) === net) ok.push(g);
    if (!ok.length) return Math.round(net / (1 - TAUX_CARTE));
    return ok.filter(function (g) { return g % 100 === 0; })[0] || ok.filter(function (g) { return g % 50 === 0; })[0] || ok[0];
  }
  function enrichir(o, M, horsRevolut) {
    var auto = horsRevolut ? { cat: o.cat } : catAuto(o), cat = o.cat || auto.cat, def = CAT[cat] || CAT.inconnu;
    var x = { o: o, id: o.id, d: o.d, cat: cat, auto: auto, manuel: !!o.cat && !horsRevolut, grp: def[1], lib: def[0], q: trimDe(o.d), horsRevolut: !!horsRevolut };
    x.pays = o.pays || auto.pays || paysDe(o.a);
    x.four = o.four || auto.four || (o.a ? o.a.split(",")[0].replace(/\s*\*.*$/, "") : o.lib);
    x.usage = o.usage || auto.usage || "";
    x.conf = o.usage ? "Précisé par toi" : (auto.conf || (auto.usage ? "Proposé (à corriger si besoin)" : ""));
    x.note = auto.note || "";
    x.docs = M.docsParOp[o.id] || [];
    if (x.grp === "vente") {
      if (cat === "vente_carte") {
        if (o.brut) { x.brut = o.brut; x.brutSrc = "montant confirmé"; }
        else if (o.frais != null) { x.brut = o.inn + o.frais; x.brutSrc = "commission lue dans le relevé CSV"; }
        else { x.brut = brutDepuisNet(o.inn); x.brutSrc = "calculé avec la commission constatée de 1,7 % — à confirmer"; x.brutCalc = true; }
        x.frais = x.brut - o.inn; x.client = "particulier"; x.clientSrc = "paiement par carte";
      } else if (cat === "rembt_client") { x.brut = -o.out; x.frais = 0; x.client = "particulier"; }
      else { x.brut = o.inn; x.frais = 0; x.client = o.client || typeClient(o.de || o.lib); x.payeur = (o.de || o.lib || "").split(",")[0].replace(/^paiement envoy[ée] par\s*/i, ""); }
      x.tva = Math.round(x.brut * 21 / 121); x.base = x.brut - x.tva;
      if (o.datePresta) { x.dTva = o.datePresta; x.dTvaSrc = "date de prestation indiquée"; }
    }
    if (x.grp === "charge") {
      var docs = x.docs.filter(function (d) { return PIECES[d.type]; });
      var fac = docs.filter(function (d) { return (d.type === "facture_achat" || d.type === "decompte_xerius") && d.lisible !== false; })[0];
      var tic = docs.filter(function (d) { return d.type === "ticket" && d.lisible !== false; })[0];
      var illisible = docs.some(function (d) { return d.lisible === false; });
      var pd = pctDeduction(cat, o);
      x.fac = fac; x.ticket = tic; x.pct = pd; x.montant = o.out;
      if (o.horsTva || cat === "cotisations" || cat === "assurance" || cat === "frais_bq") x.regime = "sans_tva";
      else if (fac) {
        var fp = fac.pays || x.pays;
        if (fac.tva > 0 && (fp === "BE" || !fp) && !fac.oss) x.regime = "tva_be";
        else if (fac.tva > 0) x.regime = "tva_etrangere";
        else if (fp && fp !== "BE") x.regime = UE.indexOf(fp) >= 0 ? "autoliq_ue" : "autoliq_hors_ue";
        else x.regime = "a_verifier";
      } else x.regime = null;
      if (cat === "inconnu") x.statut = "Usage à préciser";
      else if (!fac && !tic) x.statut = illisible ? "Document illisible" : "Facture à récupérer";
      else if (!fac) x.statut = "Facture à récupérer";
      else if (x.regime !== "sans_tva" && pd.p == null) x.statut = "Usage à préciser";
      else if (x.regime === "tva_etrangere" || x.regime === "a_verifier" || auto.appstore) x.statut = "Traitement à vérifier";
      else x.statut = "Complet";
      x.tvaFac = 0; x.tvaDue = 0; x.ded = 0; x.base8x = 0; x.baseAutoliq = 0;
      var p = pd.p == null ? 0 : pd.p;
      if (x.statut === "Complet") {
        if (x.regime === "tva_be") { x.tvaFac = fac.tva; x.ded = Math.round(fac.tva * p); x.base8x = (fac.ttc || o.out) - x.ded; }
        else if (x.regime === "autoliq_ue" || x.regime === "autoliq_hors_ue") { x.baseAutoliq = o.out; x.tvaDue = Math.round(o.out * 0.21); x.ded = Math.round(x.tvaDue * p); x.base8x = o.out + (x.tvaDue - x.ded); }
        else if (x.regime === "sans_tva") { x.base8x = cat === "cotisations" ? 0 : o.out; }
      }
      /* TVA belge que tu pourrais récupérer si la facture est obtenue (estimation 21 % sur un fournisseur belge) */
      if (x.statut !== "Complet" && x.regime !== "sans_tva" && (x.pays === "BE" || o.tvaConnue != null) && cat !== "inconnu")
        x.potentiel = Math.round((o.tvaConnue != null ? o.tvaConnue : Math.round(o.out * 21 / 121)) * (pd.p == null ? (cat === "carburant" || cat === "parking" ? 0.5 : 1) : pd.p));
      /* coût pour l'impôt : montant payé moins la TVA récupérée ; en autoliquidation, + la TVA due non déductible */
      x.cout = x.regime === "tva_be" ? o.out - x.ded : (x.regime === "autoliq_ue" || x.regime === "autoliq_hors_ue") ? o.out + (x.tvaDue - x.ded) : o.out;
    }
    return x;
  }

  /* ----------------------------- modèle (calculé) ----------------------------- */
  var _M = null;
  function signature() { var C = A(); return [DB.updatedAt, C.admOps.length, C.admDocs.length, C.admHist.length, C.admDos.length, (C.dep || []).length, (C.ven || []).length, (C.oblig || []).length].join("|"); }
  function modele() {
    var sig = signature();
    if (_M && _M.sig === sig) return _M;
    var C = A(), M = { sig: sig, ops: [], parId: {}, docsParOp: {} };
    C.admDocs.forEach(function (d) { (d.ops || []).forEach(function (id) { (M.docsParOp[id] = M.docsParOp[id] || []).push(d); }); });
    C.admOps.forEach(function (o) { var x = enrichir(o, M); M.ops.push(x); M.parId[o.id] = x; });
    /* dépenses enregistrées dans l'appli et payées hors Revolut (ex. factures Xerius du 01/09) */
    (C.dep || []).forEach(function (d) {
      if (d.nature === "perso" || !d.date) return;
      var revo = C.admOps.some(function (o) { return o.out && Math.abs(o.out - ct(d.ttc)) <= 1 && Math.abs(ecart(o.d, d.date)) <= 5; });
      if (revo) return;
      var ps = { id: "dep:" + d.id, d: d.date, out: ct(d.ttc), inn: 0, lib: d.fournisseur || "Dépense", a: "", cat: "autre_pro", horsTva: !(d.tvaMontant > 0), tvaConnue: d.tvaMontant > 0 ? ct(d.tvaMontant) : null, four: d.fournisseur, pays: /xerius/i.test(d.fournisseur || "") ? "BE" : null, usage: "Frais de démarrage (inscription BCE, activation TVA)", depId: d.id };
      if (d.img) M.docsParOp[ps.id] = (M.docsParOp[ps.id] || []).concat([{ id: "img:" + d.id, type: "facture_achat", lisible: true, ttc: ct(d.ttc), tva: ct(d.tvaMontant || 0), pays: ps.pays, nom: "Photo enregistrée dans Dépenses" }]);
      var x = enrichir(ps, M, true); x.horsRevolut = true; M.ops.push(x); M.parId[ps.id] = x;
    });
    M.ops.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    rapprocherVentes(M);
    _M = M;
    return M;
  }

  /* ------------------- rapprochement factures de vente ↔ encaissements ------------------- */
  function rapprocherVentes(M) {
    var C = A(), pris = {};
    M.facturesSansEnc = []; M.ventesSansFacture = [];
    var factures = (C.ven || []).filter(function (v) { return v.numero && v.numero !== "BROUILLON" && v.statut !== "annulee" && v.statut !== "brouillon"; })
      .map(function (v) { return { src: "appli", id: v.id, numero: v.numero, date: v.date, datePresta: v.datePrestation || null, ttc: ct(v.ttc), client: v.client || "", type: v.clientType || "" }; });
    C.admDocs.filter(function (d) { return d.type === "facture_vente"; }).forEach(function (d) { factures.push({ src: "pièce", id: d.id, numero: d.numero || "", date: d.date || "", ttc: d.ttc || 0, client: d.client || d.fournisseur || "", doc: d, opForce: (d.ops || [])[0] }); });
    var ventes = M.ops.filter(function (x) { return x.grp === "vente" && x.brut > 0; });
    factures.forEach(function (f) {
      var c = null;
      if (f.opForce && M.parId[f.opForce]) c = M.parId[f.opForce];
      else {
        var cands = ventes.filter(function (x) { return !pris[x.id] && Math.abs(x.brut - f.ttc) <= 1 && f.date && ecart(f.date, x.d) >= -20 && ecart(f.date, x.d) <= 60; });
        var mots = nrm(f.client).split(/\s+/).filter(function (w) { return w.length > 2; });
        cands.sort(function (a, b) {
          function sc(x) { var t = nrm((x.payeur || "") + " " + (x.o.ref || "")); return mots.filter(function (w) { return t.indexOf(w) >= 0; }).length * 10 + (f.numero && t.indexOf(nrm(f.numero)) >= 0 ? 50 : 0) - Math.abs(ecart(f.date, x.d)) / 100; }
          return sc(b) - sc(a);
        });
        c = cands[0] || null;
      }
      if (c) { pris[c.id] = true; c.facture = f; f.op = c; if (!c.dTva && f.datePresta) { c.dTva = f.datePresta; c.dTvaSrc = "date de prestation de la facture " + f.numero; } }
      else M.facturesSansEnc.push(f);
    });
    M.clientsAPreciser = [];
    ventes.forEach(function (x) {
      if (!x.facture && x.client === "entreprise") M.ventesSansFacture.push(x);
      if (x.cat === "vente_vir" && x.client === "à préciser") M.clientsAPreciser.push(x);
      /* encaissement des 15 premiers jours d'un trimestre sans date de prestation : le service peut appartenir au trimestre précédent */
      var q = trimDe(x.d);
      if (!x.dTva && q.deb > debutActivite() && ecart(q.deb, x.d) < 15 && x.cat === "vente_vir") x.periodeAConfirmer = true;
    });
  }

  /* ------------------------------- couverture ------------------------------- */
  function couverture() {
    var C = A(), deb = debutActivite(), per = [];
    C.admImp.forEach(function (i) { (i.sections || []).forEach(function (s) { if (s.du && s.au) per.push([s.du, s.au]); }); });
    per.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    var trous = [], cur = deb, fin = null;
    per.forEach(function (p) {
      if (p[1] < cur) return;
      if (p[0] > cur) trous.push([cur, addJ(p[0], -1)]);
      if (p[1] >= cur) cur = addJ(p[1], 1);
      fin = !fin || p[1] > fin ? p[1] : fin;
    });
    var td = todayStr(), finAttendue = +td.slice(8, 10) >= 5 ? addJ(td.slice(0, 7) + "-01", -1) : addJ(addJ(td.slice(0, 7) + "-01", -1).slice(0, 7) + "-01", -1);
    if (!per.length) trous.push([deb, td]);
    else if (cur <= finAttendue) trous.push([cur, finAttendue]);
    return { jusqua: fin, trous: trous, aucun: !per.length };
  }
  function couvre(deb, fin) { var c = couverture(); if (c.aucun || !c.jusqua || c.jusqua < fin) return false; return !c.trous.some(function (t) { return t[0] <= fin && t[1] >= deb; }); }

  /* ------------------------------ TVA par trimestre ------------------------------ */
  function qParId(id) { var m = /^(\d{4})T([1-4])$/.exec(id || ""); return m ? trimDe(m[1] + "-" + pad((+m[2] - 1) * 3 + 1) + "-01") : null; }
  function parLe(a, b) { return a.le < b.le ? -1 : a.le > b.le ? 1 : 0; }
  function decl(obl) { return A().admHist.filter(function (e) { return e.type === "declaration" && e.obl === obl; }).sort(parLe).pop() || null; }
  function paiementsDe(obl) { return A().admHist.filter(function (e) { return e.type === "paiement" && e.obl === obl; }).sort(parLe); }
  function etatPaiement(obl) {
    var p = paiementsDe(obl), ex = p.filter(function (e) { return e.etape === "execute" || e.etape === "affecte"; });
    return { liste: p, ordre: p.some(function (e) { return e.etape === "ordre"; }), ordrePreuve: p.some(function (e) { return e.etape === "ordre" && e.docId; }), execute: ex.length > 0, affecte: p.some(function (e) { return e.etape === "affecte"; }), total: ex.reduce(function (s, e) { return s + (e.montant || 0); }, 0) };
  }
  var GRILLES = ["03", "54", "55", "56", "59", "81", "82", "83", "87", "88"];
  function tvaTrim(q, M) {
    M = M || modele();
    if (typeof q === "string") q = qParId(q);
    var deb = q.deb < debutActivite() ? debutActivite() : q.deb, td = todayStr(), G = {};
    GRILLES.forEach(function (k) { G[k] = 0; });
    var V = { q: q, id: q.id, deb: deb, fin: q.fin, ventes: [], achats: [], aVerifier: [], G: G, potentiel: 0, enCours: td <= q.fin };
    M.ops.forEach(function (x) {
      var dx = x.grp === "vente" && x.dTva ? x.dTva : x.d;
      if (dx < deb || dx > q.fin) return;
      if (x.grp === "vente") { G["03"] += x.base; G["54"] += x.tva; V.ventes.push(x); return; }
      if (x.grp === "inconnu") { V.aVerifier.push(x); return; }
      if (x.grp !== "charge") return;
      if (x.statut === "Complet") {
        if (x.regime === "tva_be") { G["82"] += x.base8x; G["59"] += x.ded; }
        else if (x.regime === "autoliq_ue") { G["82"] += x.base8x; G["88"] += x.baseAutoliq; G["55"] += x.tvaDue; G["59"] += x.ded; }
        else if (x.regime === "autoliq_hors_ue") { G["82"] += x.base8x; G["87"] += x.baseAutoliq; G["56"] += x.tvaDue; G["59"] += x.ded; }
        else if (x.regime === "sans_tva") G["82"] += x.base8x;
        V.achats.push(x);
      } else { V.aVerifier.push(x); if (x.potentiel) V.potentiel += x.potentiel; }
    });
    var du = G["54"] + G["55"] + G["56"], ded = G["59"];
    G["71"] = Math.max(0, du - ded); G["72"] = Math.max(0, ded - du);
    V.solde = du - ded;
    V.factSansEnc = (M.facturesSansEnc || []).filter(function (f) { return f.date >= deb && f.date <= q.fin; });
    V.ventesSansFacture = (M.ventesSansFacture || []).filter(function (x) { return x.d >= deb && x.d <= q.fin; });
    V.brutCalc = V.ventes.filter(function (x) { return x.brutCalc; });
    V.periodeAConfirmer = V.ventes.filter(function (x) { return x.periodeAConfirmer; });
    V.decl = decl("tva:" + q.id);
    V.pay = etatPaiement("tva:" + q.id);
    V.ctrl = controle(V);
    if (V.decl && V.decl.grilles) { /* période déjà déclarée : on garde les chiffres déposés, l'écart devient une correction */
      V.ecartDecl = (V.solde) - ((V.decl.grilles["71"] || 0) - (V.decl.grilles["72"] || 0));
    }
    return V;
  }

  /* --------------------------------- contrôleur --------------------------------- */
  function controle(V) {
    var C = A(), c = [];
    var finVue = V.enCours ? (couverture().jusqua || V.deb) : V.fin;
    var cov = couvre(V.deb, finVue);
    c.push({ k: "Période couverte par les relevés", ok: cov && !V.enCours, txt: cov ? (V.enCours ? "Trimestre en cours : relevés jusqu'au " + dfr(finVue) : "Du " + dfr(V.deb) + " au " + dfr(V.fin)) : "Relevé manquant pour une partie de la période" });
    var imps = C.admImp.filter(function (i) { return (i.sections || []).some(function (s) { return s.du <= V.fin && s.au >= V.deb; }); });
    var okConc = imps.length > 0 && imps.every(function (i) { return okImp(i); });
    c.push({ k: "Relevés concordants (totaux et soldes)", ok: okConc, txt: imps.length ? imps.map(function (i) { return i.nom + (okImp(i) ? " ✓" : " ⚠️"); }).join(" · ") : "Aucun relevé" });
    var confl = imps.reduce(function (s, i) { return s + (i.conflits || 0); }, 0);
    c.push({ k: "Doublons", ok: confl === 0, txt: confl ? confl + " opération(s) lue(s) avec des montants différents" : "Aucun doublon (identifiant Revolut unique par opération)" });
    var manq = V.aVerifier.filter(function (x) { return x.grp === "charge"; });
    c.push({ k: "Pièces des dépenses", ok: manq.length === 0, txt: manq.length ? manq.length + " dépense(s) sans pièce complète : TVA non déduite" : "Toutes les dépenses ont leur pièce" });
    var inc = V.aVerifier.filter(function (x) { return x.grp === "inconnu"; }).length;
    c.push({ k: "Traitement fiscal des opérations", ok: inc === 0 && !V.brutCalc.length, txt: (inc ? inc + " opération(s) à préciser. " : "") + (V.brutCalc.length ? V.brutCalc.length + " paiement(s) carte : montant client recalculé (commission 1,7 %) à confirmer." : (inc ? "" : "OK")) });
    c.push({ k: "Période des ventes", ok: !V.periodeAConfirmer.length, txt: V.periodeAConfirmer.length ? V.periodeAConfirmer.map(function (x) { return (x.payeur || x.o.lib) + " (payé le " + dfr(x.d) + ")"; }).join(", ") + " : la prestation a-t-elle eu lieu au trimestre précédent ? La TVA est due à la fin du service." : "OK" });
    c.push({ k: "Ventes et factures", ok: !V.factSansEnc.length && !V.ventesSansFacture.length, txt: (V.factSansEnc.length ? V.factSansEnc.length + " facture(s) sans encaissement. " : "") + (V.ventesSansFacture.length ? V.ventesSansFacture.length + " client(s) entreprise sans facture." : "") || "OK" });
    var ageRegles = ecart(VERIF, todayStr());
    c.push({ k: "Règles et dates", ok: ageRegles <= 120, txt: "Règles vérifiées le " + dfr(VERIF) + (ageRegles > 120 ? " : à revérifier" : "") });
    var G = V.G, coh = (G["71"] - G["72"]) === (G["54"] + G["55"] + G["56"] - G["59"]) && V.ventes.every(function (x) { return x.base + x.tva === x.brut; });
    c.push({ k: "Cohérence des totaux", ok: coh, txt: coh ? "71/72 = 54 + 55 + 56 − 59 ; base + TVA = encaissé" : "Incohérence de calcul" });
    c.pret = c.every(function (z) { return z.ok; });
    return c;
  }
  function okImp(i) { return !!(i.ctrl && i.ctrl.length && i.ctrl.every(function (k) { return k.okSommes && k.okSolde; }) && !(i.anomalies || []).some(function (a) { return /incohérent|différents|introuvable|Aucune opération/.test(a); })); }

  /* ------------------------------ résultat & impôt ------------------------------ */
  function resultat(deb, fin, M) {
    M = M || modele();
    var r = { ca: 0, tvaCol: 0, frais: 0, charges: 0, sansPiece: 0, inconnu: 0, cotis: 0, ventes: 0, encaisse: 0 };
    M.ops.forEach(function (x) {
      if (x.d < deb || x.d > fin) return;
      if (x.grp === "vente") { r.ca += x.base; r.tvaCol += x.tva; r.frais += x.frais || 0; r.ventes++; r.encaisse += x.brut; }
      else if (x.grp === "charge") { if (x.cat === "cotisations") r.cotis += x.o.out; else { r.charges += x.cout; if (x.statut !== "Complet") r.sansPiece += x.cout; } }
      else if (x.grp === "inconnu" && x.o.out) r.inconnu += x.o.out;
    });
    r.charges += r.frais;
    r.benef = r.ca - r.charges;
    return r;
  }
  /* pour business.js : bénéfice (avant cotisations) en euros, seulement si les relevés couvrent la période */
  function bilanReel(deb, fin) {
    var c = couverture();
    if (c.aucun || !c.jusqua) return null;
    var d0 = deb < debutActivite() ? debutActivite() : deb, f = fin > c.jusqua ? c.jusqua : fin;
    if (f < d0 || !couvre(d0, f)) return null;
    var r = resultat(d0, f);
    return { benef: r.benef / 100, caHT: r.ca / 100, charges: r.charges / 100, nbJ: ecart(d0, f) + 1, deb: d0, fin: f, source: "relevés Revolut" };
  }
  function ippEstim(netCents) {
    var tr = [[16720, 0.25], [29510, 0.40], [51070, 0.45], [1e12, 0.50]];
    function bar(x) { var t = 0, prev = 0; tr.forEach(function (z) { if (x > prev) t += (Math.min(x, z[0]) - prev) * z[1]; prev = z[0]; }); return t; }
    var e = Math.max(0, netCents) / 100;
    return Math.round(Math.max(0, bar(e) - bar(11180)) * 1.07 * 100);
  }
  function xeriusVue(M) {
    M = M || modele();
    var C = A(), td = todayStr(), y = +td.slice(0, 4), I = inasti(y), obs = (C.oblig || []).filter(function (o) { return o.type === "SOCIAL_CONTRIBUTION"; });
    obs.sort(function (a, b) { return (a.echeance || "") < (b.echeance || "") ? -1 : 1; });
    var deb = debutActivite() > y + "-01-01" ? debutActivite() : y + "-01-01", cov = couverture();
    var fin = cov.jusqua && cov.jusqua < td ? cov.jusqua : td;
    var r = cov.jusqua && couvre(deb, fin) ? resultat(deb, fin, M) : null, nbJ = ecart(deb, fin) + 1, jAn = ecart(deb, y + "-12-31") + 1;
    var benefAn = r && nbJ >= 28 ? Math.round(r.benef / nbJ * jAn) : null;
    var nbQ = 4 - Math.floor((+deb.slice(5, 7) - 1) / 3);
    /* une cotisation est déductible l'année où elle est payée : on retient celles à payer au plus tard le 31/12 */
    var cotY = obs.filter(function (o) { return (o.echeance || "9") <= y + "-12-31"; }).reduce(function (s, o) { return s + ct(o.montant); }, 0);
    var net = benefAn == null ? null : benefAn - cotY, annualise = net == null ? null : Math.round(Math.max(0, net) * 4 / nbQ);
    var xer = /xerius/i.test((window.SCF ? SCF.F().profil.caisseSociale : "") || "Xerius");
    var pleine = xer && I.minXerius ? I.minXerius : Math.round(I.min * (1 + I.frais)), reduite = null;
    if (annualise != null) {
      if (annualise <= I.primo) reduite = xer && I.primoXerius ? I.primoXerius : Math.round(I.primoTrim * (1 + I.frais));
      else if (annualise < I.seuil) reduite = Math.round(annualise * 0.205 / 4 * (1 + I.frais));
    }
    return { obs: obs, y: y, deb: deb, fin: fin, r: r, nbJ: nbJ, benefAn: benefAn, cotY: cotY, net: net, annualise: annualise, nbQ: nbQ, pleine: pleine, reduite: reduite, I: I, ipp: net == null ? null : ippEstim(net) };
  }
  function idXerius(o) { var m = /T([1-4])\s*(\d{4})/.exec(o.periode || ""); return m ? "xerius:" + m[2] + "T" + m[1] : "xerius:" + (o.id || ""); }
  function legalXerius(o) { return o.echeance ? finMois(o.echeance) : null; }

  /* --------------------------- registre des obligations --------------------------- */
  function trimestresTva() {
    var td = todayStr(), out = [], q = trimDe(debutActivite());
    while (q.deb <= td) { out.push(q); q = trimSuiv(q); }
    return out;
  }
  function registre(M) {
    M = M || modele();
    var C = A(), L = [], pers = dossierOk("personnel"), td = todayStr();
    var aB2B = M.ops.some(function (x) { return x.grp === "vente" && x.client === "entreprise"; });
    var b2bListing = {};
    M.ops.forEach(function (x) { if (x.grp === "vente" && x.client === "entreprise") { var k = nrm(x.payeur); b2bListing[k] = (b2bListing[k] || 0) + x.base; } });
    var listing250 = Object.keys(b2bListing).filter(function (k) { return b2bListing[k] > 25000; });
    var qs = trimestresTva().filter(function (q) { return q.fin < td; });
    var tvaRetard = qs.filter(function (q) { var d = decl("tva:" + q.id); return !(d && d.etape === "deposee") && td > q.ech; });
    var sansOriginal = C.admDocs.filter(function (d) { return !d.chemin; }).length;
    function add(o) { L.push(o); }
    add({ id: "bce", t: "Inscription à la BCE et identification TVA", st: "applicable", suivi: "traité", j: "Inscription par le guichet Xerius le 01/09/2026 ; TVA activée (604A du 09/09/2026).", src: "Mails Xerius du 01/09, 07/09 et 09/09/2026" });
    add({ id: "compta", t: "Comptabilité simplifiée (journal financier, achats, ventes et recettes, inventaire annuel)", st: "applicable", suivi: C.admImp.length ? "en cours" : "à faire", j: "Personne physique : comptabilité simplifiée. Tes relevés Revolut importés forment le journal financier ; les pièces déposées, le journal des achats.", src: R.archives.src, url: R.archives.url });
    add({ id: "tva", t: "Déclarations et paiements TVA trimestriels (le 25 du mois suivant)", st: "applicable", suivi: tvaRetard.length ? "en retard" : "en cours", j: tvaRetard.length ? "Aucun accusé de dépôt enregistré pour : " + tvaRetard.map(function (q) { return q.label; }).join(", ") + "." : "Suivi par trimestre dans l'appli.", src: R.delaiTva.src, url: R.delaiTva.url });
    add({ id: "factB2B", t: "Factures aux clients entreprises, en Peppol depuis le 01/01/2026", st: aB2B ? "applicable" : "à confirmer", suivi: M.ventesSansFacture.length ? "à faire" : (aB2B ? "traité" : "—"), j: aB2B ? (M.ventesSansFacture.length ? M.ventesSansFacture.length + " encaissement(s) d'entreprise sans facture reliée : " + M.ventesSansFacture.map(function (x) { return x.payeur + " " + eu(x.brut); }).join(", ") + "." : "Chaque encaissement d'entreprise a sa facture.") : "Pas de client entreprise identifié pour l'instant.", src: R.peppol.src, url: R.peppol.url });
    add({ id: "factB2C", t: "Clients particuliers : recettes notées, facture si le client la demande", st: "applicable", suivi: "en cours", j: "Chaque paiement Revolut d'un particulier est une recette (TVA 21 % incluse). Les factures de l'appli sont rapprochées des paiements.", src: R.facture.src, url: R.facture.url });
    add({ id: "archives", t: "Conservation des pièces pendant 10 ans", st: "applicable", suivi: sansOriginal ? "à faire" : "en cours", j: sansOriginal ? sansOriginal + " document(s) pas encore conservé(s) en ligne." : "Originaux conservés dans ton espace privé. Papiers : photographie-les, puis range-les dans une pochette par année (ne jette rien tant que l'archivage n'est pas validé).", src: R.archives.src, url: R.archives.url });
    add({ id: "listing", t: "Listing annuel des clients assujettis (avant le 31/03/2027 pour 2026)", st: listing250.length ? "applicable" : (aB2B ? "à confirmer" : "non applicable"), suivi: listing250.length ? "à venir" : "—", j: listing250.length ? listing250.length + " client(s) entreprise à plus de 250 € HTVA en 2026 (à confirmer : sont-ils assujettis à la TVA ?)." : aB2B ? "Clients entreprises sous 250 € HTVA pour l'instant." : "Aucun client entreprise.", src: R.listing.src, url: R.listing.url });
    add({ id: "intra", t: "Relevé intracommunautaire (ventes à des entreprises de l'UE)", st: "non applicable", suivi: "—", j: "Aucune vente à une entreprise d'un autre pays de l'UE dans tes relevés.", src: "Relevés Revolut importés" });
    add({ id: "ipp", t: "Impôt des personnes physiques (revenus 2026, déclaration en 2027)", st: "applicable", suivi: "à venir", j: "Date de dépôt fixée par le SPF Finances au printemps 2027. Estimation dans « Impôt et cotisations ».", src: R.ipp.src, url: R.ipp.url });
    add({ id: "va", t: "Versements anticipés d'impôt", st: "non applicable", suivi: "—", j: "Facultatifs : pas d'obligation. Utiles seulement si un bénéfice imposable se dessine.", src: R.ipp.src, url: R.ipp.url });
    add({ id: "cotis", t: "Cotisations sociales personnelles (Xerius)", st: "applicable", suivi: "en cours", j: "Décomptes trimestriels de Xerius ; paiements suivis dans l'appli.", src: R.payXerius.src, url: R.payXerius.url });
    add({ id: "cotsoc", t: "Cotisation annuelle des sociétés", st: "non applicable", suivi: "—", j: "Tu es une personne physique, pas une société.", src: "Mail Xerius du 07/09/2026" });
    add({ id: "societe", t: "Comptes annuels, assemblée, registre UBO", st: "non applicable", suivi: "—", j: "Obligations réservées aux sociétés et associations.", src: "Mail Xerius du 07/09/2026" });
    add({ id: "employeur", t: "Obligations d'employeur (Dimona, ONSS, précompte, assurance accidents du travail)", st: pers ? (pers.val === "Aucun" ? "non applicable" : "applicable") : "à confirmer", suivi: pers && pers.val !== "Aucun" ? "à faire" : "—", j: pers ? (pers.val === "Aucun" ? "Aucun salarié, aidant ni sous-traitant (ta réponse du " + dfr(pers.le) + ")." : "Tu as indiqué du personnel ou des sous-traitants : obligations à vérifier en détail.") : "Question en attente : as-tu des salariés ou des sous-traitants ?", src: pers ? "Ta réponse" : "" });
    add({ id: "ciao", t: "Check in and out at Work et déclaration de travaux (nettoyage)", st: "non applicable", suivi: "—", j: "Tu nettoies des biens meubles (canapés, tapis, matelas, sièges auto), exclus du régime, et loin du seuil de 30 000 € HTVA par chantier. À revoir si tu nettoies un jour des moquettes fixées ou des bâtiments.", src: R.ciao.src, url: R.ciao.url });
    add({ id: "assurance", t: "Assurance responsabilité civile professionnelle", st: "à confirmer", suivi: "—", j: "Pas d'obligation légale générale identifiée pour ton activité ; fortement conseillée (dégât chez un client).", src: "À vérifier avec ton assureur" });
    add({ id: "produits", t: "Produits de nettoyage : étiquettes et fiches de sécurité", st: "à confirmer", suivi: "—", j: "Garde les fiches de données de sécurité de tes produits ; les obligations de prévention visent surtout les employeurs.", src: "" });
    add({ id: "rgpd", t: "Protection des données des clients (RGPD)", st: "applicable", suivi: "à vérifier", j: "Noms, téléphones et adresses de clients : à protéger, à garder seulement le temps utile, information sur ton site.", src: "Règlement (UE) 2016/679" });
    add({ id: "local", t: "Obligations communales ou régionales spécifiques", st: "non applicable", suivi: "—", j: "Aucune identifiée pour un nettoyage à domicile sans local ouvert au public.", src: "" });
    return L;
  }

  /* ------------------------------ actions prioritaires ------------------------------ */
  function actions(M) {
    M = M || modele();
    var C = A(), td = todayStr(), out = [];
    var acc = { lib: "Ouvrir Accountable", url: LIENS.accountable.url }, mym = { lib: "Ouvrir MyMinfin", url: LIENS.myminfin.url };
    trimestresTva().forEach(function (q) {
      var V = tvaTrim(q, M), d = V.decl, fini = q.fin < td;
      if (!fini) return;
      var mt = V.G["71"], statutMt = V.ctrl.pret ? "calculé à valider" : "calculé — à vérifier", retard = td > q.ech;
      if (!(d && d.etape === "deposee")) out.push({ id: "decl:" + q.id, obl: "tva:" + q.id, kind: "declarer", prio: retard ? 0 : 10 + ecart(td, q.ech),
        titre: "Déclarer la TVA du " + q.label, phrase: "Tu dois envoyer ta déclaration TVA du " + q.label + (q.id === trimDe(debutActivite()).id ? " (depuis ton début le " + dfr(V.deb) + ")" : "") + ", même si le montant est faible.",
        montant: V.solde >= 0 ? mt : -V.G["72"], statutMt: statutMt, periode: dfr(V.deb) + " → " + dfr(q.fin), legal: q.ech, conseil: retard ? td : addJ(q.ech, -5), retard: retard,
        bouton: acc, bouton2: { lib: "Intervat", url: LIENS.intervat.url },
        etapes: ["Dans Accountable, ouvre ta déclaration TVA du " + q.label + " : vérifie si elle a déjà été soumise.", "Sinon, compare-la avec « Voir le détail » (grilles) puis clique « Soumettre au SPF Finances ».", "Télécharge l'accusé de réception et ajoute-le avec « J'ai déposé »."],
        preuve: "L'accusé de réception de la déclaration (PDF Intervat / Accountable).", vtrim: V,
        regul: retard ? "Délai dépassé le " + dfr(q.ech) + " : dépose dès que possible. Une amende et des intérêts de retard peuvent s'appliquer ; un dépôt rapide limite le problème." : "" });
      var pay = V.pay;
      if (mt > 0 && !pay.execute && !pay.ordrePreuve) out.push({ id: "paytva:" + q.id, obl: "tva:" + q.id, kind: "payer", prio: retard ? 1 : 11 + ecart(td, q.ech),
        titre: "Payer la TVA du " + q.label, phrase: "Virement au SPF Finances du solde de ta déclaration du " + q.label + ".",
        montant: mt, statutMt: statutMt, periode: q.label, legal: q.ech, conseil: retard ? td : addJ(q.ech, -5), retard: retard, a: "SPF Finances", iban: IBAN_TVA,
        bouton: mym, etapes: ["Le plus simple : paie depuis MyMinfin, qui remplit le compte et ta communication structurée.", "Sinon, virement Revolut Pro de " + eu(mt) + " vers " + IBAN_TVA + " avec ta communication structurée TVA.", "Ajoute la confirmation du virement avec « J'ai payé »."],
        preuve: "La confirmation du virement (PDF Revolut), puis la ligne dans ton relevé suivant.", vtrim: V,
        regul: retard ? "Paiement en retard : des intérêts de retard courent jusqu'au paiement." : "" });
    });
    xeriusVue(M).obs.forEach(function (o) {
      var obl = idXerius(o), st = etatPaiement(obl);
      if (st.execute || st.ordrePreuve || o.statut === "paye") return;
      var legal = legalXerius(o), cons = o.echeance;
      out.push({ id: "payx:" + obl, obl: obl, kind: "payer", prio: 20 + Math.max(0, ecart(td, cons || td)) / 3,
        titre: "Payer la cotisation Xerius du " + o.periode, phrase: "Cotisation sociale provisoire de ton " + o.periode + ", réclamée par Xerius.",
        montant: ct(o.montant), statutMt: o.officiel ? "réclamé" : "estimé", periode: o.periode, legal: legal, conseil: cons, a: "Xerius",
        bouton: { lib: "Ouvrir My Xerius", url: LIENS.myxerius.url },
        etapes: ["Dans My Xerius, ouvre le décompte du " + o.periode + " : il donne l'IBAN de Xerius et ta communication structurée.", "Virement de " + eu(ct(o.montant)) + " depuis Revolut Pro" + (cons ? " avant le " + dfr(cons) : "") + ".", "Ajoute la confirmation du virement avec « J'ai payé »."],
        preuve: "La confirmation du virement, puis « paiement reçu » dans My Xerius." });
    });
    var manq = M.ops.filter(function (x) { return x.grp === "charge" && (x.statut === "Facture à récupérer" || x.statut === "Document illisible"); });
    if (manq.length) {
      var pot = manq.reduce(function (s, x) { return s + (x.potentiel || 0); }, 0);
      out.push({ id: "docs:factures", kind: "document", prio: 40, titre: "Récupérer " + manq.length + " facture" + (manq.length > 1 ? "s" : "") + " de dépenses",
        phrase: "Sans facture, la dépense est mal justifiée et la TVA belge payée n'est pas récupérable.", montant: pot || null, statutMt: pot ? "estimé (TVA récupérable)" : null,
        periode: "depuis le " + dfr(debutActivite()), etapes: ["Ouvre « Documents manquants » ci-dessous : chaque ligne dit où trouver la facture.", "Télécharge les PDF depuis tes espaces clients (Google Ads, Meta, Higgsfield…) ou demande un duplicata.", "Dépose-les avec « Ajouter mes documents » : je les relie aux paiements."],
        preuve: "Les factures originales (PDF reçus), pas une capture du paiement.", vue: "manquants" });
    }
    var inc = M.ops.filter(function (x) { return x.grp === "inconnu" || (x.grp === "charge" && x.statut === "Usage à préciser") || x.periodeAConfirmer || (x.cat === "vente_vir" && x.client === "à préciser"); });
    if (inc.length) out.push({ id: "usage", kind: "question", prio: 45, titre: "Préciser " + inc.length + " opération" + (inc.length > 1 ? "s" : ""), phrase: "Il me manque une information pour ces opérations : usage (pro ou privé), type de client ou date de la prestation.", etapes: ["Ouvre « À préciser ».", "Pour chacune, choisis la bonne catégorie (ou « privé »).", "Le calcul se met à jour tout de suite."], preuve: "Rien à garder de plus : ta réponse est notée avec la date.", vue: "preciser" });
    if (M.facturesSansEnc.length) out.push({ id: "factsans", kind: "question", prio: 35, titre: "Vérifier " + M.facturesSansEnc.length + " facture" + (M.facturesSansEnc.length > 1 ? "s" : "") + " sans paiement Revolut", phrase: "Une facture remise au client rend la TVA due, même si elle n'a pas été payée sur Revolut.", montant: M.facturesSansEnc.reduce(function (s, f) { return s + Math.round(f.ttc * 21 / 121); }, 0), statutMt: "estimé (TVA en jeu)", etapes: ["Ouvre « Ventes à vérifier ».", "Pour chaque facture : le client l'a-t-il reçue ? A-t-il payé autrement ?", "Si elle n'aurait pas dû exister : annule-la par une note de crédit (onglet Ventes)."], preuve: "La facture et, si besoin, la note de crédit.", vue: "ventes" });
    if (M.ventesSansFacture.length) out.push({ id: "factb2b", kind: "document", prio: 30, titre: "Facturer " + M.ventesSansFacture.length + " client" + (M.ventesSansFacture.length > 1 ? "s" : "") + " entreprise", phrase: "Un client entreprise doit recevoir une facture ; depuis 2026, une facture électronique Peppol s'il est assujetti à la TVA.", montant: M.ventesSansFacture.reduce(function (s, x) { return s + x.brut; }, 0), statutMt: "encaissé", bouton: acc, etapes: ["Vérifie si la facture existe déjà dans Accountable ; sinon crée-la (envoi Peppol).", "Montant TVAC = le virement reçu (TVA 21 % incluse).", "Dépose le PDF de la facture ici pour la relier au paiement."], preuve: "La facture PDF et la confirmation d'envoi Peppol.", vue: "ventes", regul: "" });
    var cov = couverture();
    cov.trous.forEach(function (t) { out.push({ id: "rel:" + t[0], kind: "document", prio: 25, titre: "Déposer le relevé Revolut du " + dfr(t[0]) + " au " + dfr(t[1]), phrase: "Sans ce relevé, je ne peux pas vérifier tes encaissements sur cette période.", bouton: { lib: "Ouvrir Revolut Business", url: LIENS.revolut.url }, etapes: ["Revolut Business : Accueil → « … » → Statements → Account statement.", "Choisis le compte EUR, la période et le format PDF (ou CSV).", "Dépose le fichier avec « Ajouter mes documents »."], preuve: "Le relevé PDF original." }); });
    var qq = questions();
    if (qq.length) out.push({ id: "questions", kind: "question", prio: 50, titre: "Répondre à " + qq.length + " question" + (qq.length > 1 ? "s" : "") + " sur ton dossier", phrase: "Ces réponses changent certains calculs (voiture, personnel, adresse).", etapes: qq.map(function (d) { return d.q; }), preuve: "Ta réponse est enregistrée avec la date ; plus besoin de la redonner.", vue: "dossier" });
    out.sort(function (a, b) { return a.prio - b.prio; });
    return out;
  }

  /* ------------------------------ échéances & rappels ------------------------------ */
  function echeances(M) {
    M = M || modele();
    var td = todayStr(), L = [];
    actions(M).forEach(function (a) { if (a.legal || a.conseil) L.push({ id: a.id, titre: a.titre, legal: a.legal, conseil: a.conseil, montant: a.montant, statutMt: a.statutMt, retard: a.retard }); });
    var q = trimDe(td), qn = trimSuiv(q);
    [q, qn].forEach(function (z) { if (!L.some(function (e) { return e.id === "decl:" + z.id; })) L.push({ id: "decl:" + z.id, titre: "Déclarer et payer la TVA du " + z.label, legal: z.ech, conseil: addJ(z.ech, -5), futur: true }); });
    var y = +td.slice(0, 4);
    if (registre(M).some(function (r) { return r.id === "listing" && r.st !== "non applicable"; })) L.push({ id: "listing:" + y, titre: "Listing des clients assujettis " + y, legal: (y + 1) + "-03-31", conseil: (y + 1) + "-03-20", futur: true });
    L.forEach(function (e) { e.jours = e.conseil ? ecart(td, e.conseil) : null; });
    L.sort(function (a, b) { return (a.conseil || a.legal || "9") < (b.conseil || b.legal || "9") ? -1 : 1; });
    return L;
  }
  function lireJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function ecrireJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function rappelsDus(M) {
    var td = todayStr(), etat = lireJSON(CLE_RAPPELS) || {}, out = [];
    echeances(M).forEach(function (e) {
      if (!e.conseil || e.futur && ecart(td, e.conseil) > 14) return;
      var j = ecart(td, e.retard && e.legal ? e.legal : e.conseil);
      var palier = j < 0 ? "retard-" + Math.floor(-j / 7) : j === 0 ? "J0" : j <= 2 ? "J2" : j <= 7 ? "J7" : j <= 14 ? "J14" : null;
      if (!palier) return;
      var k = e.id + "|" + palier;
      if (!etat[k]) out.push({ e: e, j: j, k: k });
    });
    return out;
  }
  function verifierRappels(silencieux) {
    var dus;
    try { dus = rappelsDus(); } catch (e) { return []; }
    if (!dus.length) return [];
    var etat = lireJSON(CLE_RAPPELS) || {};
    dus.forEach(function (r) { etat[r.k] = nowIso(); });
    var ok = ecrireJSON(CLE_RAPPELS, etat);
    var lignes = dus.slice(0, 4).map(function (r) { return (r.j < 0 ? "⚠️ En retard : " : r.j === 0 ? "Aujourd'hui : " : "Dans " + r.j + " j : ") + r.e.titre + (r.e.montant ? " — " + eu(r.e.montant) : ""); });
    if (!ok) lignes.push("(Rappels non mémorisés sur cet appareil : stockage plein.)");
    if (!silencieux && typeof toast === "function") toast(dus.some(function (r) { return r.j < 0; }) ? "err" : "ok", ["Paperasse — " + dus.length + " rappel" + (dus.length > 1 ? "s" : "")].concat(lignes));
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(function (reg) { return reg.showNotification("StayClean — paperasse", { body: lignes.join("\n"), tag: "sca-rappel", icon: "icon-192.png" }); }).catch(function () {});
    }
    return dus;
  }
  function icsTxt(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
  function ics(list) {
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//StayClean//Assistant compta//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:StayClean — échéances"];
    var stamp = nowIso().replace(/[-:]/g, "").slice(0, 15) + "Z";
    list.forEach(function (e) {
      var d0 = e.conseil || e.legal; if (!d0) return;
      L.push("BEGIN:VEVENT", "UID:" + String(e.id).replace(/[^a-zA-Z0-9]/g, "-") + "@stayclean-agenda", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + d0.replace(/-/g, ""), "DTEND;VALUE=DATE:" + addJ(d0, 1).replace(/-/g, ""),
        "SUMMARY:" + icsTxt("StayClean — " + e.titre), "DESCRIPTION:" + icsTxt((e.montant ? "Montant : " + eu(e.montant) + (e.statutMt ? " (" + e.statutMt + ")" : "") + ". " : "") + (e.legal ? "Échéance légale : " + dfr(e.legal) + ". " : "") + "Détails dans l'appli StayClean → Compta → Assistant."),
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsTxt(e.titre), "TRIGGER:-P6DT15H", "END:VALARM",
        "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsTxt(e.titre), "TRIGGER:-PT15H", "END:VALARM", "END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.join("\r\n");
  }
  function telecharger(blob, nom) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nom;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ------------------------------ export complet ------------------------------ */
  function csv(rows) { return "﻿" + rows.map(function (r) { return r.map(function (c) { c = c == null ? "" : String(c); return /[;"\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(";"); }).join("\r\n"); }
  function e2(c) { return c == null ? "" : (c / 100).toFixed(2).replace(".", ","); }
  function exporter() {
    return charger(LIB.zip, "JSZip").then(function (JSZip) {
      var z = new JSZip(), C = A(), M = modele(), dt = todayStr();
      z.file("LISEZMOI.txt", ["Dossier comptable StayClean — export du " + dfr(dt), "",
        "dossier-complet.json : toutes les données (profil, dossier, opérations, pièces, historique, obligations).",
        "operations.csv : opérations Revolut avec catégorie, TVA et statut des pièces.", "documents.csv : pièces déposées et leur lien avec les opérations.",
        "tva/ : brouillon de chaque déclaration trimestrielle (grilles).", "obligations.csv : registre des obligations.", "historique.csv : déclarations, paiements, demandes et sauvegardes.",
        "echeances.ics : échéances à importer dans un calendrier.", "pieces/ : originaux conservés en ligne.", "",
        "Les montants « calculé — à vérifier » ne sont pas définitifs : voir les points listés dans chaque fichier TVA."].join("\r\n"));
      z.file("dossier-complet.json", JSON.stringify({ export: nowIso(), regles: R, verifie: VERIF, profil: (window.SCF ? SCF.F().profil : null), dossier: C.admDos, operations: C.admOps, imports: C.admImp, documents: C.admDocs, historique: C.admHist, obligations: C.oblig || [], depenses: C.dep || [], ventes: C.ven || [] }, null, 2));
      z.file("operations.csv", csv([["Date", "Libellé", "Détail", "Sortant", "Entrant", "Catégorie", "Encaissé client (brut)", "Commission", "Base HTVA", "TVA", "Pièces", "Statut", "Régime TVA", "TVA déductible", "Identifiant"]].concat(M.ops.map(function (x) {
        return [x.d, x.o.lib, [x.o.a, x.o.de, x.o.ref].filter(Boolean).join(" | "), e2(x.o.out), e2(x.o.inn), x.lib, e2(x.brut), e2(x.frais), e2(x.base), e2(x.tva), x.docs.map(function (d) { return d.nom; }).join(" + "), x.statut || "", x.regime || "", e2(x.ded), x.id];
      }))));
      z.file("documents.csv", csv([["Nom", "Type", "Fournisseur", "Date", "Numéro", "TTC", "TVA", "Pays", "Opérations liées", "Original en ligne", "Déposé le"]].concat(C.admDocs.map(function (d) { return [d.nom, d.type, d.fournisseur || "", d.date || "", d.numero || "", e2(d.ttc), e2(d.tva), d.pays || "", (d.ops || []).join(" "), d.chemin ? "oui" : "non" + (d.envoi ? " (" + d.envoi + ")" : ""), d.le]; }))));
      trimestresTva().forEach(function (q) {
        var V = tvaTrim(q, M);
        var rows = [["Trimestre", q.label], ["Période", V.deb + " → " + V.fin], ["Statut", V.ctrl.pret ? "calculé à valider" : "calculé — à vérifier"], [""], ["Grille", "Montant"]];
        GRILLES.concat(["71", "72"]).forEach(function (k) { rows.push([k, e2(V.G[k])]); });
        rows.push([""], ["Contrôle", "OK", "Détail"]);
        V.ctrl.forEach(function (c) { rows.push([c.k, c.ok ? "oui" : "non", c.txt]); });
        rows.push([""], ["Encaissements", "Date", "Brut", "Base", "TVA"]);
        V.ventes.forEach(function (x) { rows.push([x.o.lib + (x.payeur ? " " + x.payeur : ""), x.d, e2(x.brut), e2(x.base), e2(x.tva)]); });
        rows.push([""], ["Dépenses non incluses (pièce ou traitement à compléter)", "Date", "Montant", "Statut"]);
        V.aVerifier.forEach(function (x) { rows.push([x.four || x.o.lib, x.d, e2(x.o.out), x.statut || x.lib]); });
        z.file("tva/" + q.id + ".csv", csv(rows));
      });
      z.file("obligations.csv", csv([["Obligation", "Statut", "Suivi", "Justification", "Source"]].concat(registre(M).map(function (r) { return [r.t, r.st, r.suivi, r.j, r.src + (r.url ? " " + r.url : "")]; }))));
      z.file("historique.csv", csv([["Date", "Type", "Objet", "Étape", "Montant", "Preuve", "Note"]].concat(C.admHist.map(function (e) { return [e.le, e.type, e.objet || e.obl || "", e.etape || "", e2(e.montant), e.docId || e.opId || e.chemin || "", e.note || ""]; }))));
      z.file("echeances.ics", ics(echeances(M)));
      var sb = client(), ch = Promise.resolve(), manquants = [];
      C.admDocs.forEach(function (d) {
        if (!d.chemin || !sb) { manquants.push(d.nom + (d.envoi ? " (" + d.envoi + ")" : "")); return; }
        ch = ch.then(function () {
          return sb.storage.from("mp-files").download(d.chemin).then(function (r) { if (r.error) throw r.error; z.file("pieces/" + (d.date || d.le).slice(0, 4) + "/" + d.chemin.split("/").pop(), r.data); }).catch(function () { manquants.push(d.nom); });
        });
      });
      return ch.then(function () {
        if (manquants.length) z.file("pieces/NON-INCLUS.txt", "Originaux non inclus (pas en ligne ou téléchargement impossible) :\r\n" + manquants.join("\r\n"));
        return z.generateAsync({ type: "blob" });
      }).then(function (blob) {
        telecharger(blob, "stayclean-dossier-compta-" + dt + ".zip");
        hist({ type: "export", objet: "Export complet du dossier", etape: "fait", note: C.admDocs.length - manquants.length + " original(aux) inclus" + (manquants.length ? ", " + manquants.length + " non inclus" : "") });
        save();
        return { ok: true, manquants: manquants };
      });
    });
  }

  /* ------------------------------ import des fichiers ------------------------------ */
  function hashCourt(s) { var hh = 2166136261; for (var i = 0; i < s.length; i++) { hh ^= s.charCodeAt(i); hh = Math.imul(hh, 16777619); } return (hh >>> 0).toString(16); }
  function periodesTxt(imp) { return (imp.sections || []).map(function (s) { return (s.produit && s.produit !== "Compte" ? s.produit + " " : "") + dfr(s.du) + " → " + dfr(s.au); }).join(", "); }
  function integrerReleve(R0, doc) {
    var C = A(), imp = { id: "imp_" + doc.sha.slice(0, 16), docId: doc.id, nom: doc.nom, sha: doc.sha, banque: "Revolut", compte: R0.iban || "?", format: R0.csv ? "CSV" : "PDF", le: nowIso(),
      sections: R0.sections, resume: R0.resume, ctrl: R0.ctrl || (R0.csv ? [{ produit: "CSV", okSommes: true, okSolde: true, csv: true }] : []), anomalies: R0.anomalies.slice(), nb: R0.ops.length, nouv: 0, deja: 0, conflits: 0 };
    R0.ops.forEach(function (o) {
      var id = o.txid ? "rv_" + o.txid : "rvh_" + hashCourt([imp.compte, o.produit, o.dv, o.lib, o.inn, o.out, o.solde].join("|"));
      var ex = C.admOps.filter(function (x) { return x.id === id; })[0];
      if (ex) {
        imp.deja++;
        if (ex.inn !== o.inn || ex.out !== o.out) { imp.conflits++; imp.anomalies.push("« " + o.lib + " » du " + dfr(o.dv) + " lue avec un autre montant qu'au premier import : je garde la première lecture, à vérifier."); }
        if ((ex.imps || []).indexOf(imp.id) < 0) (ex.imps = ex.imps || []).push(imp.id);
        if (o.frais != null && ex.frais == null) ex.frais = o.frais;
        return;
      }
      var op = { id: id, compte: imp.compte, produit: o.produit, d: o.dv, dr: o.dr, lib: o.lib, inn: o.inn, out: o.out, solde: o.solde, imps: [imp.id], le: nowIso() };
      ["a", "de", "ref", "carte", "dev", "taux", "frais", "typ"].forEach(function (k) { if (o[k] != null && o[k] !== "") op[k] = o[k]; });
      if (o.det && o.det.length) op.det = o.det.join(" · ");
      C.admOps.push(op); imp.nouv++;
    });
    var chev = C.admImp.filter(function (x) { return x.compte === imp.compte && (x.sections || []).some(function (s) { return imp.sections.some(function (t) { return s.produit === t.produit && s.du <= t.au && t.du <= s.au; }); }); });
    if (chev.length) imp.chevauche = chev.map(function (x) { return x.nom; });
    C.admImp.push(imp);
    doc.type = "releve"; doc.impId = imp.id; doc.date = (imp.sections[0] || {}).au || null; doc.fournisseur = "Revolut";
    var ok = okImp(imp);
    return { res: "Relevé Revolut " + imp.format + " (" + periodesTxt(imp) + ") : " + imp.nb + " opérations, " + imp.nouv + " nouvelle" + (imp.nouv > 1 ? "s" : "") + (imp.deja ? ", " + imp.deja + " déjà connue" + (imp.deja > 1 ? "s" : "") + " (pas de doublon)" : "") + (chev.length ? ". Chevauche « " + imp.chevauche.join(", ") + " »" : "") + ". Contrôle des totaux et des soldes : " + (ok ? "✓" : "⚠️ " + (imp.anomalies[0] || "à vérifier")), ok: ok };
  }
  function lierAuto(doc) {
    if (!PIECES[doc.type] || (doc.ops && doc.ops.length)) return null;
    var M = modele(), deja = {};
    A().admDocs.forEach(function (d) { if (d !== doc && d.type === doc.type) (d.ops || []).forEach(function (id) { deja[id] = true; }); });
    var mots = nrm(doc.fournisseur).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; });
    var cands = M.ops.filter(function (x) {
      if (!x.o.out || deja[x.id]) return false;
      var okMt = (doc.ttc && Math.abs(x.o.out - doc.ttc) <= 1) || (doc.devise && doc.devise !== "EUR" && x.o.dev && doc.ttc && Math.abs(x.o.dev.c - doc.ttc) <= 1);
      if (!okMt) return false;
      if (!doc.date) return true;
      var e = ecart(doc.date, x.d); return e >= -40 && e <= 45; /* facture mensuelle (Google, Meta) datée après les débits */
    });
    function sc(x) { var t = nrm(x.o.lib + " " + (x.o.a || "") + " " + (x.four || "")); return mots.filter(function (w) { return t.indexOf(w) >= 0; }).length * 10 - (doc.date ? Math.abs(ecart(doc.date, x.d)) / 10 : 0); }
    cands.sort(function (a, b) { return sc(b) - sc(a); });
    if (cands.length === 1 || (cands.length > 1 && sc(cands[0]) > sc(cands[1]))) { doc.ops = [cands[0].id]; return cands[0]; }
    return null;
  }
  function detecterPaiements() {
    var C = A(), M = modele(), n = 0;
    M.ops.forEach(function (x) {
      if (!x.o.out || (x.cat !== "cotisations" && x.cat !== "paiement_spf")) return;
      if (C.admHist.some(function (e) { return e.opId === x.id; })) return;
      var obl = null, objet = "";
      if (x.cat === "cotisations") {
        var o = xeriusVue(M).obs.filter(function (z) { return Math.abs(ct(z.montant) - x.o.out) <= 1 && !etatPaiement(idXerius(z)).execute; })[0];
        if (o) { obl = idXerius(o); objet = "Cotisation Xerius " + o.periode; }
      } else {
        var q = trimestresTva().filter(function (z) { var V = tvaTrim(z, M); return V.G["71"] && Math.abs(V.G["71"] - x.o.out) <= 100 && !V.pay.execute; })[0];
        if (q) { obl = "tva:" + q.id; objet = "TVA " + q.label; }
      }
      hist({ type: "paiement", obl: obl, objet: objet || "Paiement à affecter : " + (x.four || x.o.lib), etape: "execute", montant: x.o.out, date: x.d, opId: x.id, note: "Vu dans le relevé Revolut" + (obl ? "" : " — à rattacher à une obligation") });
      n++;
    });
    return n;
  }
  function chiffresCles() {
    var M = modele(), k = {};
    trimestresTva().forEach(function (q) { var V = tvaTrim(q, M); k["TVA " + q.label] = V.solde; });
    k["Encaissements clients"] = M.ops.filter(function (x) { return x.grp === "vente"; }).reduce(function (s, x) { return s + x.brut; }, 0);
    k["Dépenses sans pièce complète"] = M.ops.filter(function (x) { return x.grp === "charge" && x.statut !== "Complet"; }).length;
    k["Opérations à préciser"] = M.ops.filter(function (x) { return x.grp === "inconnu"; }).length;
    return k;
  }
  function deposer(fichiers) {
    var files = Array.prototype.slice.call(fichiers || []);
    if (!files.length || U.busy) return Promise.resolve(null);
    U.busy = true;
    var D = { quand: nowIso(), lignes: [], erreurs: [], avant: chiffresCles() };
    U.depot = D; rafraichir();
    return sauvegarder("avant import de " + files.length + " fichier" + (files.length > 1 ? "s" : "")).then(function (r) { D.sauvegarde = r; }).then(function () {
      var ch = Promise.resolve();
      files.forEach(function (f) { ch = ch.then(function () { return traiterFichier(f, D).catch(function (e) { D.erreurs.push(f.name + " : " + ((e && e.message) || e)); }); }); });
      return ch;
    }).then(function () {
      A().admDocs.forEach(function (d) { if (PIECES[d.type] && !(d.ops || []).length) { var x = lierAuto(d); if (x) D.lignes.push({ nom: d.nom, res: "Relié au paiement « " + (x.four || x.o.lib) + " » du " + dfr(x.d) + " (" + eu(x.o.out) + ")." }); } });
      var np = detecterPaiements();
      if (np) D.lignes.push({ nom: "Relevés", res: np + " paiement(s) Xerius / SPF Finances repéré(s) et noté(s) dans l'historique." });
      _M = null;
      var apres = chiffresCles();
      D.changements = Object.keys(apres).filter(function (k) { return apres[k] !== D.avant[k]; }).map(function (k) { var monnaie = /TVA|Encaissements/.test(k); return k + " : " + (D.avant[k] == null ? "—" : monnaie ? eu(D.avant[k]) : D.avant[k]) + " → " + (monnaie ? eu(apres[k]) : apres[k]); });
      hist({ type: "import", objet: files.length + " fichier(s) déposé(s)", etape: "fait", note: D.lignes.map(function (l) { return l.nom + " : " + l.res; }).join(" | ").slice(0, 900) + (D.erreurs.length ? " | Erreurs : " + D.erreurs.join(" ; ") : "") });
      save();
    }).catch(function (e) { D.erreurs.push((e && e.message) || String(e)); }).then(function () { U.busy = false; rafraichir(); return D; });
  }
  function traiterFichier(f, D) {
    return f.arrayBuffer().then(function (buf) {
      return sha256(buf).then(function (sha) {
        var C = A(), deja = C.admDocs.filter(function (d) { return d.sha === sha; })[0];
        if (deja) {
          var L = { nom: f.name, res: "Déjà déposé le " + dfr(deja.le) + " : rien n'a changé.", deja: true };
          D.lignes.push(L);
          if (!deja.chemin) return envoyerOriginal(deja, new Blob([buf], { type: deja.mime })).then(function (ok) { if (ok) L.res += " Original maintenant conservé en ligne."; });
          return null;
        }
        var nom = nrm(f.name), mime = f.type || (/\.pdf$/.test(nom) ? "application/pdf" : /\.csv$/.test(nom) ? "text/csv" : /\.(jpe?g)$/.test(nom) ? "image/jpeg" : /\.png$/.test(nom) ? "image/png" : "application/octet-stream");
        var doc = { id: "doc_" + sha.slice(0, 16), nom: f.name, sha: sha, mime: mime, taille: f.size, le: nowIso(), type: "autre", ops: [], chemin: null };
        var suite;
        if (/pdf/.test(mime)) suite = pdfLignes(buf).then(function (P) {
          var R0 = parseRevolutPdf(P);
          if (R0) return integrerReleve(R0, doc);
          if (!P.texte.replace(/\s/g, "").length) { doc.type = "facture_achat"; doc.aCompleter = true; doc.lu = "aucun"; return { res: "PDF scanné sans texte : indique le montant et la date dans la fiche du document." }; }
          Object.assign(doc, lirePiece(P.texte));
          return { res: descPiece(doc) };
        });
        else if (/csv|text\/plain/.test(mime) || /\.(csv|txt)$/.test(nom)) suite = Promise.resolve().then(function () {
          var txt = new TextDecoder().decode(buf), R0 = parseRevolutCsv(txt, f.name);
          if (R0) return integrerReleve(R0, doc);
          doc.type = "autre"; return { res: "Fichier texte non reconnu comme relevé Revolut : conservé tel quel." };
        });
        else if (/^image\//.test(mime) || /\.(heic|heif|webp)$/.test(nom)) suite = lireParIA(f).then(function (fx) {
          if (fx) { Object.assign(doc, fx); return { res: descPiece(doc) + " (lu par l'IA : vérifie les montants)" }; }
          doc.type = "ticket"; doc.aCompleter = true; doc.lu = "aucun";
          return { res: "Photo conservée. Lecture automatique indisponible : indique le montant et la date dans la fiche du document." };
        }, function (e) { doc.type = "ticket"; doc.aCompleter = true; doc.lu = "aucun"; return { res: "Photo conservée. " + e.message }; });
        else suite = Promise.resolve({ res: "Format non lu automatiquement : original conservé." });
        return suite.then(function (L) {
          C.admDocs.push(doc);
          var ligne = Object.assign({ nom: f.name }, L);
          D.lignes.push(ligne);
          return envoyerOriginal(doc, new Blob([buf], { type: mime })).then(function (ok) { if (!ok) ligne.res += " ⚠️ Original pas encore conservé en ligne (" + (doc.envoi || "erreur") + ") : redépose ce fichier plus tard."; });
        });
      });
    });
  }
  /* Relevés déjà lus ailleurs (même code de lecture) : on intègre l'analyse sans l'original ;
     le document reste marqué « original à redéposer » jusqu'au dépôt du fichier lui-même
     (même empreinte → l'original est alors simplement conservé, rien n'est recompté). */
  function importerAnalyses(liste) {
    var D = { quand: nowIso(), lignes: [], erreurs: [], avant: chiffresCles() };
    return sauvegarder("avant import des relevés analysés").then(function (r) {
      D.sauvegarde = r;
      var C = A();
      liste.forEach(function (x) {
        if (C.admDocs.some(function (d) { return d.sha === x.sha; })) { D.lignes.push({ nom: x.nom, res: "Déjà présent : rien n'a changé." }); return; }
        var doc = { id: "doc_" + x.sha.slice(0, 16), nom: x.nom, sha: x.sha, mime: "application/pdf", taille: x.taille, le: nowIso(), type: "releve", ops: [], chemin: null, envoi: "original à redéposer (relevé lu par l'assistant à partir du fichier envoyé dans la conversation)" };
        var L = integrerReleve(x.R, doc); C.admDocs.push(doc); D.lignes.push(Object.assign({ nom: x.nom }, L));
      });
      var np = detecterPaiements(); if (np) D.lignes.push({ nom: "Relevés", res: np + " paiement(s) Xerius / SPF Finances repéré(s)." });
      _M = null;
      var apres = chiffresCles();
      D.changements = Object.keys(apres).filter(function (k) { return apres[k] !== D.avant[k]; }).map(function (k) { var monnaie = /TVA|Encaissements/.test(k); return k + " : " + (D.avant[k] == null ? "—" : monnaie ? eu(D.avant[k]) : D.avant[k]) + " → " + (monnaie ? eu(apres[k]) : apres[k]); });
      hist({ type: "import", objet: liste.length + " relevé(s) analysé(s)", etape: "fait", note: D.lignes.map(function (l) { return l.nom + " : " + l.res; }).join(" | ").slice(0, 900) });
      U.depot = D; save(); rafraichir();
      return D;
    });
  }
  var TYPES_DOC = { releve: "Relevé bancaire", facture_achat: "Facture d'achat", ticket: "Ticket de caisse", facture_vente: "Facture de vente", decompte_xerius: "Décompte Xerius", accuse_depot: "Accusé de dépôt", preuve_paiement: "Preuve de paiement", courrier_fisc: "Courrier fiscal", autre: "Autre document" };
  function descPiece(d) {
    return (TYPES_DOC[d.type] || "Document") + (d.fournisseur ? " " + d.fournisseur : "") + (d.ttc != null ? " — " + eu(d.ttc) + (d.devise && d.devise !== "EUR" ? " (" + d.devise + ")" : "") : "") + (d.date ? " du " + dfr(d.date) : "") +
      (d.tva ? ", TVA " + eu(d.tva) : "") + (d.autoliq ? ", autoliquidation" : "") + (d.aCompleter ? " — montant à compléter" : "");
  }

  /* ================================== AFFICHAGE ================================== */
  var U = { vue: "accueil", busy: false, depot: null, ouvert: {}, modal: null, filtre: "tout", sauv: null };
  var VUES = [["accueil", "Accueil"], ["docs", "Documents"], ["hist", "Historique"], ["dossier", "Mon dossier"], ["oblig", "Obligations"], ["echeances", "Échéances"], ["tva", "TVA"], ["ops", "Opérations"], ["sauv", "Sauvegardes"]];
  function rafraichir() { _M = null; try { if (window.ui && ui.space === "cpt" && ui.tab === "assistant") renderMain(); } catch (e) {} dessinerModal(); }
  function badge(t, cl) { return '<span class="sca-badge ' + (cl || "") + '">' + h(t) + "</span>"; }
  function stCl(st) { return /retard|illisible/i.test(st) ? "r" : /récupérer|préciser|vérifier|faire|confirmer/i.test(st) ? "a" : /complet|traité|ok|fait|exécuté|affecté|déposée/i.test(st) ? "v" : ""; }
  function lien(b, cl) { return b ? '<a class="sca-b ' + (cl || "") + '" href="' + h(b.url) + '" target="_blank" rel="noopener">' + h(b.lib) + " ↗</a>" : ""; }
  function quand(d) { if (!d) return "—"; var j = ecart(todayStr(), d); return dfr(d) + (j === 0 ? " (aujourd'hui)" : j < 0 ? " (dépassée de " + (-j) + " j)" : j <= 31 ? " (dans " + j + " j)" : ""); }
  function carteAction(a) {
    var x = '<div class="sca-act' + (a.retard ? " retard" : "") + '"><div class="sca-act-h"><b>' + h(a.titre) + "</b>" + (a.retard ? badge("En retard", "r") : "") + "</div>";
    x += '<p class="sca-p">' + h(a.phrase) + "</p>";
    if (a.montant != null) x += '<div class="sca-kv"><span>Montant</span><b>' + eu(a.montant) + "</b>" + (a.statutMt ? badge(a.statutMt, /réclamé|encaissé/.test(a.statutMt) ? "v" : "a") : "") + "</div>";
    if (a.a) x += '<div class="sca-kv"><span>À qui</span><b>' + h(a.a) + (a.iban ? " — " + h(a.iban) : "") + "</b></div>";
    if (a.periode) x += '<div class="sca-kv"><span>Période</span><b>' + h(a.periode) + "</b></div>";
    if (a.legal || a.conseil) x += '<div class="sca-kv"><span>Échéance</span><b>' + (a.legal ? "légale " + quand(a.legal) : "") + (a.conseil && a.conseil !== a.legal ? " · conseillé " + (a.retard ? "dès aujourd'hui" : dfr(a.conseil)) : "") + "</b></div>";
    if (a.regul) x += '<p class="sca-alerte">' + h(a.regul) + "</p>";
    if (a.etapes && a.etapes.length) x += '<ol class="sca-steps">' + a.etapes.slice(0, 3).map(function (e) { return "<li>" + h(e) + "</li>"; }).join("") + "</ol>";
    if (a.preuve) x += '<p class="sca-preuve">📎 Preuve à garder : ' + h(a.preuve) + "</p>";
    x += '<div class="sca-btns">' + lien(a.bouton, "p") + lien(a.bouton2);
    if (a.kind === "declarer") x += '<button class="sca-b" data-sca="fait-decl" data-obl="' + h(a.obl) + '">J\'ai déposé</button>';
    if (a.kind === "payer") x += '<button class="sca-b" data-sca="fait-pay" data-obl="' + h(a.obl) + '" data-mt="' + (a.montant || 0) + '">J\'ai payé</button>';
    if (a.vue) x += '<button class="sca-b" data-sca="vue" data-v="' + h(a.vue === "manquants" ? "docs" : a.vue === "preciser" ? "ops" : a.vue === "ventes" ? "ops" : a.vue) + '" data-f="' + h(a.vue) + '">Ouvrir</button>';
    if (a.vtrim) x += '<button class="sca-b" data-sca="ouvrir" data-k="' + h(a.id) + '">' + (U.ouvert[a.id] ? "Masquer le détail" : "Voir le détail") + "</button>";
    x += "</div>";
    if (a.vtrim && U.ouvert[a.id]) x += detailTva(a.vtrim);
    return x + "</div>";
  }
  var LIB_G = { "03": "Ventes à 21 % (base HTVA)", "54": "TVA due sur ces ventes", "55": "TVA due sur services de l'UE (88)", "56": "TVA due sur services hors UE (87)", "59": "TVA déductible", "81": "Marchandises", "82": "Services et biens divers", "83": "Biens d'investissement", "87": "Services hors UE (autoliquidation)", "88": "Services de l'UE (autoliquidation)", "71": "À payer à l'État", "72": "En ta faveur" };
  function detailTva(V) {
    var x = '<div class="sca-detail"><p class="sca-k">Brouillon de déclaration — ' + h(V.q.label) + " (" + dfr(V.deb) + " → " + dfr(V.fin) + ")</p>";
    if (V.decl && V.decl.grilles) x += '<p class="sca-alerte">Déclaration déposée le ' + dfr(V.decl.date || V.decl.le) + " : les chiffres déposés ne sont pas modifiés." + (V.ecartDecl ? " Écart avec le recalcul actuel : " + eu(V.ecartDecl) + " → à corriger dans la déclaration du trimestre suivant." : "") + "</p>";
    x += '<table class="sca-t"><tr><th>Grille</th><th></th><th>Montant</th></tr>';
    GRILLES.concat(["71", "72"]).forEach(function (k) { if (V.G[k] || k === "03" || k === "54" || k === "59" || k === "71" || k === "72") x += "<tr><td>" + k + "</td><td>" + h(LIB_G[k]) + '</td><td class="n">' + eu(V.G[k]) + "</td></tr>"; });
    x += '</table><p class="sca-mini">Les autres grilles sont à 0. Grille 71 = 54 + 55 + 56 − 59.</p>';
    x += '<p class="sca-k">Contrôles avant validation</p><ul class="sca-ctrl">' + V.ctrl.map(function (c) { return '<li class="' + (c.ok ? "ok" : "ko") + '">' + (c.ok ? "✓ " : "⚠️ ") + "<b>" + h(c.k) + "</b> — " + h(c.txt) + "</li>"; }).join("") + "</ul>";
    if (!V.ctrl.pret) x += '<p class="sca-mini">Résultat provisoire : il ne pourra être présenté comme prêt qu\'une fois ces points réglés.' + (V.potentiel ? " Avec les factures manquantes, la TVA déductible pourrait baisser le solde d'environ " + eu(V.potentiel) + " (estimé)." : "") + "</p>";
    x += '<p class="sca-k">Encaissements (' + V.ventes.length + ")</p><table class=\"sca-t\">" + V.ventes.map(function (v) { return "<tr><td>" + dfr(v.d) + "</td><td>" + h(v.cat === "vente_carte" ? "Carte" + (v.brutCalc ? " (brut calculé)" : "") : v.payeur || v.o.lib) + (v.facture ? " · fact. " + h(v.facture.numero) : "") + '</td><td class="n">' + eu(v.brut) + '</td><td class="n">TVA ' + eu(v.tva) + "</td></tr>"; }).join("") + "</table>";
    if (V.aVerifier.length) x += '<p class="sca-k">Non inclus pour l\'instant (' + V.aVerifier.length + ")</p><table class=\"sca-t\">" + V.aVerifier.map(function (v) { return "<tr><td>" + dfr(v.d) + "</td><td>" + h(v.four || v.o.lib) + '</td><td class="n">' + eu(v.o.out) + "</td><td>" + badge(v.statut || v.lib, stCl(v.statut || "à préciser")) + "</td></tr>"; }).join("") + "</table>";
    if (V.factSansEnc.length) x += '<p class="sca-alerte">Factures de vente sans paiement Revolut : ' + V.factSansEnc.map(function (f) { return h(f.numero + " " + f.client + " " + eu(f.ttc) + " (" + dfr(f.date) + ")"); }).join(" · ") + ". Si elles ont été remises au client, leur TVA est due pour cette période.</p>";
    x += '<p class="sca-src">Sources : ' + srcHtml(R.grilles) + " · " + srcHtml(R.autoliq) + " · " + srcHtml(R.delaiTva) + "</p>";
    return x + "</div>";
  }
  function srcHtml(r) { return r ? '<a href="' + h(r.url) + '" target="_blank" rel="noopener">' + h(r.src) + "</a> (vérifié le " + dfr(VERIF) + ")" : ""; }
  function phraseVerif(M, acts) {
    var cov = couverture(), C = A();
    if (cov.aucun) return { phrase: "Aucun relevé déposé : je ne peux encore rien vérifier. Commence par « Ajouter mes documents » avec tes relevés Revolut depuis le " + dfr(debutActivite()) + ".", points: null };
    var ouvertes = acts.filter(function (a) { return a.kind === "declarer" || a.kind === "payer"; }), points = [];
    if (cov.trous.length) points.push("relevés manquants (" + cov.trous.map(function (t) { return dfr(t[0]) + " → " + dfr(t[1]); }).join(", ") + ")");
    var nf = M.ops.filter(function (x) { return x.grp === "charge" && x.statut !== "Complet"; }).length; if (nf) points.push(nf + " dépense" + (nf > 1 ? "s" : "") + " sans pièce complète");
    var ni = M.ops.filter(function (x) { return x.grp === "inconnu"; }).length; if (ni) points.push(ni + " opération" + (ni > 1 ? "s" : "") + " à préciser");
    var nb = M.ops.filter(function (x) { return x.brutCalc; }).length; if (nb) points.push(nb + " paiement" + (nb > 1 ? "s" : "") + " carte dont le montant client est recalculé");
    if (M.facturesSansEnc.length) points.push(M.facturesSansEnc.length + " facture" + (M.facturesSansEnc.length > 1 ? "s" : "") + " de vente sans paiement");
    var npc = M.ops.filter(function (x) { return x.periodeAConfirmer; }).length; if (npc) points.push(npc + " encaissement" + (npc > 1 ? "s" : "") + " de début de trimestre : date de la prestation à confirmer");
    if (M.clientsAPreciser.length) points.push(M.clientsAPreciser.length + " virement" + (M.clientsAPreciser.length > 1 ? "s" : "") + " : client entreprise ou particulier ?");
    if (M.ventesSansFacture.length) points.push(M.ventesSansFacture.length + " client" + (M.ventesSansFacture.length > 1 ? "s" : "") + " entreprise sans facture");
    questions().forEach(function (q) { points.push(q.lib.charAt(0).toLowerCase() + q.lib.slice(1)); });
    var periode = "du " + dfr(debutActivite()) + " au " + dfr(cov.jusqua);
    var d = new Date(), heure = pad(d.getHours()) + ":" + pad(d.getMinutes());
    var nRet = ouvertes.filter(function (a) { return a.retard; }).length;
    return { phrase: (ouvertes.length ? "Pour la période vérifiée (" + periode + "), " + ouvertes.length + " obligation" + (ouvertes.length > 1 ? "s identifiées ne sont" : " identifiée n'est") + " pas encore traitée" + (ouvertes.length > 1 ? "s" : "") + (nRet ? ", dont " + nRet + " en retard" : "") + "."
      : "Pour la période vérifiée (" + periode + "), les obligations identifiées sont traitées.") + " Dernière vérification : " + dfr(todayStr()) + " à " + heure + " (relevés jusqu'au " + dfr(cov.jusqua) + ").", points: points };
  }
  function htmlDepot() {
    var D = U.depot; if (!D) return "";
    var x = '<section class="card sec sca-depot"><p class="k">' + (U.busy ? "⏳ Dépôt en cours…" : "Compte rendu du dépôt") + '</p>';
    if (D.sauvegarde) x += '<p class="sca-mini">' + (D.sauvegarde.ok ? "Sauvegarde faite avant import ✓" : "⚠️ " + h(D.sauvegarde.msg || "Sauvegarde en ligne impossible")) + "</p>";
    x += "<ul class=\"sca-ul\">" + D.lignes.map(function (l) { return "<li><b>" + h(l.nom) + "</b> — " + h(l.res) + "</li>"; }).join("") + "</ul>";
    if (D.erreurs.length) x += '<p class="sca-alerte">Échec : ' + D.erreurs.map(h).join(" · ") + "</p>";
    if (D.changements && D.changements.length) x += '<p class="sca-k">Ce qui a changé</p><ul class="sca-ul">' + D.changements.map(function (c) { return "<li>" + h(c) + "</li>"; }).join("") + "</ul>";
    else if (!U.busy) x += '<p class="sca-mini">Aucun total n\'a changé.</p>';
    if (!U.busy) x += '<button class="sca-b" data-sca="fermer-depot">Fermer</button>';
    return x + "</section>";
  }
  function accueil() {
    var M = modele(), acts = actions(M), td = todayStr(), x = "";
    var PV = phraseVerif(M, acts);
    x += '<section class="card sec sca-verif"><p class="sca-p">' + h(PV.phrase) + "</p>" + (PV.points ? '<p class="sca-p"><b>Points restant à confirmer :</b> ' + (PV.points.length ? "</p><ul class=\"sca-ul\">" + PV.points.map(function (p) { return "<li>" + h(p) + "</li>"; }).join("") + "</ul>" : "aucun.</p>") : "") + "</section>";
    x += htmlDepot();
    x += '<section class="sca-q"><h3>1. Que dois-je faire maintenant ?</h3>';
    x += acts.length ? acts.slice(0, 3).map(carteAction).join("") : '<p class="emptyline">Rien d\'urgent : toutes les actions identifiées sont faites.</p>';
    if (acts.length > 3) x += U.ouvert.toutes ? acts.slice(3).map(carteAction).join("") + '<button class="sca-b" data-sca="ouvrir" data-k="toutes">Réduire</button>' : '<button class="sca-b" data-sca="ouvrir" data-k="toutes">Voir les ' + (acts.length - 3) + " autres actions</button>";
    x += "</section>";
    /* 2. payer */
    var pay = acts.filter(function (a) { return a.kind === "payer"; });
    var qc = trimDe(td);
    if (debutActivite() <= qc.fin) { var Vc = tvaTrim(qc, M); if (Vc.solde > 0) pay.push({ titre: "TVA du " + qc.label + " (trimestre en cours)", a: "SPF Finances", montant: Vc.solde, statutMt: "estimé (en cours)", legal: qc.ech, conseil: addJ(qc.ech, -5) }); }
    x += '<section class="sca-q"><h3>2. Que dois-je payer, à qui et avant quand ?</h3>';
    if (pay.length) {
      x += '<table class="sca-t sca-pay"><tr><th>Quoi</th><th>À qui</th><th>Montant</th><th>Avant le</th></tr>' + pay.map(function (a) { return "<tr" + (a.retard ? ' class="r"' : "") + "><td>" + h(a.titre.replace(/^Payer (la |le )?/, "").replace(/^./, function (c) { return c.toUpperCase(); })) + "</td><td>" + h(a.a || "") + '</td><td class="n">' + eu(a.montant) + "<br>" + badge(a.statutMt, /réclamé/.test(a.statutMt) ? "v" : "a") + "</td><td>" + (a.retard ? "<b>dépassé (" + dfr(a.legal) + ")</b>" : dfr(a.conseil || a.legal) + (a.legal && a.conseil !== a.legal ? '<br><span class="sca-mini">légal ' + dfr(a.legal) + "</span>" : "")) + "</td></tr>"; }).join("") + "</table>";
      var tot = { "réclamé": 0, calc: 0, est: 0 };
      pay.forEach(function (a) { if (/réclamé/.test(a.statutMt)) tot["réclamé"] += a.montant; else if (/calculé/.test(a.statutMt)) tot.calc += a.montant; else tot.est += a.montant; });
      x += '<p class="sca-mini">Total réclamé : <b>' + eu(tot["réclamé"]) + "</b> · calculé à valider : <b>" + eu(tot.calc) + "</b> · estimé : <b>" + eu(tot.est) + "</b>. Chaque obligation n'est comptée qu'une fois.</p>";
    } else x += '<p class="emptyline">Aucun paiement identifié.</p>';
    var XV = xeriusVue(M);
    x += '<div class="sca-reserve"><b>Réserves conseillées (à mettre de côté, pas à payer maintenant)</b><ul class="sca-ul">';
    x += "<li>Impôt sur les revenus " + XV.y + " : " + (XV.ipp == null ? "inconnu (trop peu de données)" : XV.ipp > 0 ? "≈ " + eu(XV.ipp) + " (estimé avec tes relevés jusqu'au " + dfr(XV.fin) + ")" : "rien à prévoir pour StayClean seul (revenu net " + XV.y + " estimé ≈ " + eu(Math.max(0, XV.net)) + ", sous la quotité exemptée)") + ". Ce n'est pas une absence d'impôt garantie : il manque tes autres revenus de " + XV.y + " (salaire, allocations avant septembre ?) et les mois à venir.</li>";
    x += "<li>Cotisations des trimestres pas encore réclamés : environ " + eu(XV.pleine) + " par trimestre (minimum légal, estimé).</li></ul></div></section>";
    /* 3. documents */
    var manq = M.ops.filter(function (o) { return o.grp === "charge" && o.statut !== "Complet"; }), cov = couverture();
    x += '<section class="sca-q"><h3>3. Quel document manque ?</h3><ul class="sca-ul">';
    cov.trous.forEach(function (t) { x += "<li>Relevé Revolut du " + dfr(t[0]) + " au " + dfr(t[1]) + ".</li>"; });
    trimestresTva().forEach(function (q) { var d = decl("tva:" + q.id); if (q.fin < td && !(d && d.etape === "deposee")) x += "<li>Accusé de dépôt de la déclaration TVA du " + h(q.label) + " (ou la déclaration elle-même si elle n'est pas faite).</li>"; });
    if (manq.length) x += "<li>" + manq.length + " facture" + (manq.length > 1 ? "s" : "") + " de dépenses : " + h(manq.slice(0, 4).map(function (o) { return (o.four || o.o.lib) + " " + eu(o.o.out); }).join(", ")) + (manq.length > 4 ? "…" : "") + ' <button class="sca-lk" data-sca="vue" data-v="docs">voir la liste</button></li>';
    M.ventesSansFacture.forEach(function (v) { x += "<li>Facture de vente pour " + h(v.payeur) + " (" + eu(v.brut) + ", " + dfr(v.d) + ").</li>"; });
    var poches = M.ops.filter(function (o) { return o.cat === "interne" && /pocket/i.test(o.o.lib); });
    if (poches.length) x += '<li class="sca-mini">Info : ' + poches.length + " mouvements vers ou depuis ta Pocket « EUR 100k » (argent à toi, pas du chiffre d'affaires). Son propre relevé n'est utile que si elle a d'autres mouvements.</li>";
    if (!cov.trous.length && !manq.length && !M.ventesSansFacture.length) x += "<li>Aucun document manquant identifié.</li>";
    x += '</ul><button class="btn-main sca-add" data-sca="ajouter">📎 Ajouter mes documents</button></section>';
    /* 4. réduire / étaler */
    x += '<section class="sca-q"><h3>4. Quelle démarche peut réduire ou étaler ce que je dois ?</h3>' + reduireHtml(M, XV) + "</section>";
    return x;
  }
  function reduireHtml(M, XV) {
    var x = "", demande = A().admHist.filter(function (e) { return e.type === "demande" && e.obl === "xerius:reduction"; }).sort(parLe).pop();
    var prochaine = XV.obs.filter(function (o) { return !etatPaiement(idXerius(o)).execute; })[0];
    x += '<div class="sca-act"><div class="sca-act-h"><b>Réduction de cotisations starter (Xerius)</b>' + (demande ? badge("Demande " + (demande.etape === "envoyee" ? "envoyée le " + dfr(demande.date) : "préparée"), "a") : "") + "</div>";
    if (XV.annualise == null) x += '<p class="sca-p">Pas encore assez de relevés pour estimer ton revenu.</p>';
    else {
      x += '<p class="sca-p">Revenu ' + XV.y + " estimé avec tes relevés (" + dfr(XV.deb) + " → " + dfr(XV.fin) + ", prolongé jusqu'au 31/12) : bénéfice ≈ " + eu(XV.benefAn) + (XV.cotY ? " − cotisations payées en " + XV.y + " (" + eu(XV.cotY) + ")" : "") + " = revenu net ≈ " + eu(Math.max(0, XV.net)) + ", soit ≈ " + eu(XV.annualise) + " en revenu annualisé (× 4 ÷ " + XV.nbQ + " trimestres actifs). Seuil de la réduction maximale : " + eu(XV.I.primo) + ".</p>";
      x += '<div class="sca-kv"><span>Réclamé aujourd\'hui</span><b>' + (prochaine ? eu(ct(prochaine.montant)) + " (" + h(prochaine.periode) + ")" : eu(XV.pleine) + " par trimestre") + "</b>" + badge("réclamé", "v") + "</div>";
      x += '<div class="sca-kv"><span>Si la demande est acceptée</span><b>' + (XV.reduite ? "≈ " + eu(XV.reduite) + " par trimestre" : "pas de réduction possible (revenu au-dessus du seuil)") + "</b>" + badge("estimé", "a") + "</div>";
      if (XV.reduite) x += '<p class="sca-alerte">Ce n\'est pas acquis : tant que Xerius n\'a pas accepté, le montant réclamé reste dû à son échéance. Si ton revenu ' + XV.y + " dépasse finalement le seuil, Xerius réclamera la différence avec des majorations. Tu m'as dit préférer payer le montant plein : c'est un choix prudent et possible.</p>";
      x += '<button class="sca-b" data-sca="ouvrir" data-k="dem-x">' + (U.ouvert["dem-x"] ? "Masquer la demande" : "Voir la demande préparée") + "</button>";
      if (U.ouvert["dem-x"]) x += demandeXerius(XV, demande);
    }
    x += '<p class="sca-src">' + srcHtml(R.cotis) + "</p></div>";
    var pot = M.ops.reduce(function (s, o) { return s + (o.potentiel || 0); }, 0);
    if (pot) x += '<div class="sca-act"><div class="sca-act-h"><b>Récupérer la TVA de tes dépenses</b></div><p class="sca-p">Avec les factures manquantes (au nom de StayClean, n° BE 1041.970.832), environ <b>' + eu(pot) + '</b> de TVA belge pourraient être déduits (estimé). Ajoute aussi ton n° de TVA dans tes comptes Google, Meta, OpenAI, Higgsfield… : leurs factures seront sans TVA (autoliquidation).</p><p class="sca-src">' + srcHtml(R.facture) + "</p></div>";
    x += '<div class="sca-act"><div class="sca-act-h"><b>Étaler un paiement</b></div><p class="sca-p">Si tu ne peux pas payer à temps : Xerius et le SPF Finances acceptent des plans de paiement sur demande motivée. La demande ne suspend pas l\'échéance tant qu\'elle n\'est pas acceptée. Je la prépare si tu en as besoin.</p></div>';
    return x;
  }
  function demandeXerius(XV, demande) {
    var p = window.SCF ? SCF.F().profil : {};
    var txt = "Objet : demande de réduction des cotisations provisoires (indépendant starter)\n\nBonjour,\n\nJe suis indépendant à titre principal depuis le " + dfr(debutActivite()) + " (n° d'affilié 021108.365.28, n° d'entreprise " + (p.bce || "1041.970.832") + ").\n\n" +
      "Je demande la réduction de mes cotisations sociales provisoires de starter pour " + XV.y + ". D'après mes relevés bancaires professionnels (du " + dfr(XV.deb) + " au " + dfr(XV.fin) + "), mon chiffre d'affaires hors TVA est de " + eu(XV.r ? XV.r.ca : 0) + " et mon bénéfice estimé de " + eu(XV.benefAn) + " pour " + XV.y + ", soit un revenu annualisé d'environ " + eu(XV.annualise) + ".\n\n" +
      "Merci de me confirmer le montant réduit, les trimestres concernés et les nouvelles dates de paiement. Je sais que la réduction sera régularisée si mes revenus définitifs dépassent le seuil.\n\nMohamed Benmousa — StayClean";
    return '<div class="sca-detail"><p class="sca-k">Demande prête (rien n\'est envoyé sans toi)</p><pre class="sca-pre">' + h(txt) + '</pre><ol class="sca-steps"><li>My Xerius → Demande → « Modification cotisations sociales ou statut » (chemin vu dans ton espace le 10/11/2026).</li><li>Colle le texte, joins tes relevés Revolut de septembre et octobre (téléchargeables depuis « Documents »).</li><li>Envoie, puis ajoute la capture de confirmation avec « J\'ai envoyé la demande ».</li></ol><div class="sca-btns">' + lien({ lib: "Ouvrir My Xerius", url: LIENS.myxerius.url }, "p") + '<button class="sca-b" data-sca="copier" data-txt="' + h(txt) + '">Copier le texte</button><button class="sca-b" data-sca="fait-demande">J\'ai envoyé la demande</button></div><p class="sca-mini">Après envoi : garde la confirmation de My Xerius, puis la réponse de Xerius. Le montant réclamé reste dû tant que la réponse n\'est pas arrivée.</p></div>';
  }

  /* --------------------------------- Documents --------------------------------- */
  function ouTrouver(x) {
    var f = nrm((x.four || "") + " " + x.o.lib);
    if (/google/.test(f)) return "Espace Google Ads, rubrique Facturation → Documents (chemin habituel) : facture mensuelle.";
    if (/meta|facebook|facebk/.test(f)) return "Gestionnaire de publicités Meta, rubrique Facturation et paiements (chemin habituel) : un reçu par paiement.";
    if (/higgsfield|elevenlabs|openai|anthropic|chatwoot|dodopay/.test(f)) return "Compte en ligne du service, rubrique Billing / Facturation → Invoices. Ajoute d'abord « StayClean » et ton n° de TVA BE1041970832.";
    if (/apple/.test(f)) return "Reçu Apple (mail « Votre reçu Apple » ou reportaproblem.apple.com). Achat App Store : TVA non récupérable ; un abonnement direct chez Accountable donnerait une vraie facture.";
    if (x.cat === "carburant") return /q8/.test(f) ? "Q8 : demande la facture en station avec personnel, ou via le service clients Q8 avec tes tickets (jusqu'à 1 an en arrière). Le ticket seul prouve la dépense, pas le droit à la TVA." : "Demande une facture à ton nom et n° de TVA à la station (avec ton ticket). Le ticket seul prouve la dépense, pas le droit à la TVA.";
    if (x.cat === "parking") return "Appli EasyPark, rubrique reçus / factures (profil professionnel avec ton n° de TVA).";
    if (/xerius/.test(f)) return "Mail de Xerius du 01/09/2026 ou My Xerius → documents.";
    return "Demande la facture au fournisseur avec le modèle ci-dessous.";
  }
  function demandeDuplicata(x) {
    var carte = (x.o.carte || "").replace(/\D/g, "").slice(-4), p = window.SCF ? SCF.F().profil : {}, adr = dossierOk("adresse");
    return "Bonjour,\n\nPourriez-vous m'envoyer la facture de mon paiement de " + eu(x.o.out) + " du " + dfr(x.d) + (carte ? " (carte se terminant par " + carte + ")" : "") + " ?\n\nMerci de l'établir au nom de : Mohamed Benmousa – StayClean, n° de TVA BE " + (p.bce || "1041.970.832") + ", " + (adr && adr.val ? adr.val : "[ton adresse]") + ".\n\nCordialement,\nMohamed Benmousa";
  }
  function vueDocs() {
    var M = modele(), C = A(), x = "";
    var manq = M.ops.filter(function (o) { return o.grp === "charge" && o.statut !== "Complet"; });
    x += '<section class="sca-q"><h3>Documents manquants (' + manq.length + ")</h3>";
    if (!manq.length) x += '<p class="emptyline">Aucun.</p>';
    manq.forEach(function (o) {
      x += '<div class="sca-row"><div class="sca-row-h"><b>' + h(o.four || o.o.lib) + "</b><span>" + eu(o.o.out) + " · " + dfr(o.d) + "</span></div>" + badge(o.statut, stCl(o.statut)) + (o.horsRevolut ? badge("payé hors Revolut", "") : "") +
        '<p class="sca-mini">' + h(ouTrouver(o)) + (o.potentiel ? " TVA récupérable estimée : " + eu(o.potentiel) + "." : "") + "</p>" +
        '<div class="sca-btns"><button class="sca-b" data-sca="ajouter">J\'ai la facture</button>' + (o.horsRevolut ? "" : '<button class="sca-b" data-sca="op" data-id="' + h(o.id) + '">Corriger</button>') + '<button class="sca-b" data-sca="copier" data-txt="' + h(demandeDuplicata(o)) + '">Copier une demande de duplicata</button></div></div>';
    });
    x += "</section>";
    var docs = C.admDocs.slice().sort(function (a, b) { return a.le < b.le ? 1 : -1; });
    x += '<section class="sca-q"><h3>Mes documents (' + docs.length + ')</h3><button class="btn-main sca-add" data-sca="ajouter">📎 Ajouter mes documents</button>';
    docs.forEach(function (d) {
      var liees = (d.ops || []).map(function (id) { var o = M.parId[id]; return o ? (o.four || o.o.lib) + " " + eu(o.o.out || o.o.inn) + " (" + dfr(o.d) + ")" : id; });
      x += '<div class="sca-row"><div class="sca-row-h"><b>' + h(d.nom) + "</b><span>" + h(TYPES_DOC[d.type] || d.type) + "</span></div>" +
        '<p class="sca-mini">' + h(d.type === "releve" ? "Déposé le " + dfr(d.le) : descPiece(d)) + (liees.length ? " · relié à : " + h(liees.join(", ")) : (PIECES[d.type] ? " · pas encore relié à un paiement" : "")) + "</p>" +
        (d.chemin ? badge("Original conservé", "v") : badge("Original pas en ligne" + (d.envoi ? " : " + d.envoi : ""), "r")) + (d.lu === "ia" ? badge("lu par l'IA : à vérifier", "a") : "") + (d.lisible === false ? badge("Document illisible", "r") : "") + (d.aCompleter ? badge("montant à compléter", "a") : "") +
        '<div class="sca-btns">' + (d.chemin ? '<button class="sca-b" data-sca="original" data-id="' + h(d.id) + '">Ouvrir l\'original</button>' : "") + (d.type !== "releve" ? '<button class="sca-b" data-sca="doc" data-id="' + h(d.id) + '">Vérifier / modifier</button>' : "") + "</div></div>";
    });
    return x + "</section>";
  }

  /* --------------------------------- Opérations --------------------------------- */
  function vueOps() {
    var M = modele(), f = U.filtre || "tout", x = '<section class="sca-q"><h3>Opérations Revolut</h3><div class="sca-chips">';
    [["tout", "Tout"], ["ventes", "Encaissements"], ["depenses", "Dépenses"], ["preciser", "À préciser"], ["neutres", "Privé et interne"]].forEach(function (c) { x += '<button class="' + (f === c[0] ? "on" : "") + '" data-sca="filtre" data-f="' + c[0] + '">' + c[1] + "</button>"; });
    x += "</div>";
    if (f === "ventes" && (M.facturesSansEnc.length || M.ventesSansFacture.length)) {
      x += '<div class="sca-act"><div class="sca-act-h"><b>Ventes à vérifier</b></div>';
      M.facturesSansEnc.forEach(function (fa) { x += '<p class="sca-p">Facture ' + h(fa.numero) + " — " + h(fa.client) + " — " + eu(fa.ttc) + " du " + dfr(fa.date) + " : aucun paiement Revolut correspondant. Remise au client ? Payée autrement ? Sinon, note de crédit.</p>"; });
      M.ventesSansFacture.forEach(function (v) { x += '<p class="sca-p">' + h(v.payeur) + " — " + eu(v.brut) + " le " + dfr(v.d) + " : client entreprise, facture à relier (ou à émettre via Peppol).</p>"; });
      var nums = {}; (A().ven || []).forEach(function (v) { if (v.numero && v.numero !== "BROUILLON") nums[v.numero] = (nums[v.numero] || 0) + 1; });
      if (/2026-003/.test(JSON.stringify(A().admOps.map(function (o) { return o.ref || ""; }))) && nums["2026-003"]) x += '<p class="sca-alerte">Le numéro 2026-003 est utilisé deux fois : par Accountable (AZ Auction, 131,89 €) et par l\'appli (143,99 €). Une numérotation doit être unique et continue : garde celle d\'Accountable et corrige celle de l\'appli (note de crédit + nouvelle facture).</p>';
      x += "</div>";
    }
    var ops = M.ops.filter(function (o) {
      if (f === "ventes") return o.grp === "vente"; if (f === "depenses") return o.grp === "charge"; if (f === "neutres") return o.grp === "neutre";
      if (f === "preciser") return o.grp === "inconnu" || o.statut === "Usage à préciser" || o.periodeAConfirmer || (o.cat === "vente_vir" && o.client === "à préciser"); return true;
    }).slice().reverse();
    if (!ops.length) x += '<p class="emptyline">Aucune opération.</p>';
    var mois = "";
    ops.forEach(function (o) {
      var mk = o.d.slice(0, 7);
      if (mk !== mois) { mois = mk; x += '<p class="sca-k">' + h(MOIS_FULL[+mk.slice(5, 7) - 1] + " " + mk.slice(0, 4)) + "</p>"; }
      var mt = o.o.inn ? "+" + eu(o.o.inn).replace("−", "") : "−" + eu(o.o.out);
      x += '<button class="sca-op" data-sca="op" data-id="' + h(o.id) + '"' + (o.horsRevolut ? " disabled" : "") + "><span>" + dfr(o.d).slice(0, 5) + "</span><span><b>" + h(o.grp === "vente" && o.payeur ? o.payeur : o.four || o.o.lib) + "</b><small>" + h(o.lib) + (o.grp === "vente" ? " · TVA " + eu(o.tva) + (o.brutCalc ? " · brut calculé" : "") : "") + (o.manuel ? " · corrigé" : "") + '</small></span><span class="n ' + (o.o.inn ? "in" : "") + '">' + mt + "</span>" + (o.statut ? badge(o.statut, stCl(o.statut)) : o.grp === "inconnu" ? badge("À préciser", "a") : "") + "</button>";
    });
    return x + "</section>";
  }

  /* --------------------------------- Historique --------------------------------- */
  var ICONES = { declaration: "🧾", paiement: "💶", demande: "✉️", correction: "✏️", sauvegarde: "💾", restauration: "↩️", import: "📥", export: "📦", dossier: "🗂️" };
  var ETAPES = { ordre: "ordre de paiement donné", execute: "paiement exécuté", affecte: "affectation confirmée", deposee: "déposée (accusé joint)", deposee_sans_accuse: "dépôt annoncé — accusé manquant", preparee: "préparée", envoyee: "envoyée", faite: "faite", fait: "fait" };
  function vueHist() {
    var C = A(), L = C.admHist.slice().sort(function (a, b) { return a.le < b.le ? 1 : -1; });
    var x = '<section class="sca-q"><h3>Historique des déclarations, paiements et demandes</h3>';
    if (!L.length) x += '<p class="emptyline">Rien encore.</p>';
    L.forEach(function (e) {
      var doc = e.docId ? C.admDocs.filter(function (d) { return d.id === e.docId; })[0] : null;
      x += '<div class="sca-row"><div class="sca-row-h"><b>' + (ICONES[e.type] || "•") + " " + h(e.objet || e.obl || e.type) + "</b><span>" + dfr(e.date || e.le) + "</span></div>" +
        '<p class="sca-mini">' + h(ETAPES[e.etape] || e.etape || "") + (e.montant ? " · " + eu(e.montant) : "") + (e.note ? " · " + h(e.note) : "") + (doc ? " · preuve : " + h(doc.nom) : (e.opId ? " · preuve : ligne du relevé Revolut" : "")) + "</p>" +
        (doc && doc.chemin ? '<button class="sca-b" data-sca="original" data-id="' + h(doc.id) + '">Voir la preuve</button>' : "") + "</div>";
    });
    return x + "</section>";
  }

  /* --------------------------------- Dossier --------------------------------- */
  function vueDossier() {
    var C = A(), qs = questions(), x = "";
    if (qs.length) {
      x += '<section class="sca-q"><h3>Questions (' + qs.length + ")</h3>";
      qs.forEach(function (d) {
        x += '<div class="sca-act"><p class="sca-p"><b>' + h(d.q) + "</b></p>" + (d.src ? '<p class="sca-mini">' + h(d.src) + "</p>" : "");
        if (d.qType === "choix") x += '<div class="sca-btns">' + d.opts.map(function (o) { return '<button class="sca-b" data-sca="rep" data-id="' + h(d.id) + '" data-val="' + h(o) + '">' + h(o) + "</button>"; }).join("") + "</div>";
        else if (d.qType === "vehicule") x += '<div class="sca-form"><select id="sca-q-veh"><option value="">Type…</option><option value="voiture">Voiture</option><option value="camionnette">Camionnette</option><option value="aucun">Pas de véhicule</option></select><input id="sca-q-pro" type="number" min="0" max="100" placeholder="% pro (ex. 80)"><button class="sca-b p" data-sca="rep-veh">Enregistrer</button></div>';
        else x += '<div class="sca-form"><input id="sca-q-' + h(d.id) + '" type="text" placeholder="Ta réponse"><button class="sca-b p" data-sca="rep-txt" data-id="' + h(d.id) + '">Enregistrer</button></div>';
        x += "</div>";
      });
      x += "</section>";
    }
    x += '<section class="sca-q"><h3>Mon dossier (rempli une fois, avec les sources)</h3>';
    C.admDos.forEach(function (d) {
      x += '<div class="sca-row"><div class="sca-row-h"><b>' + h(d.lib) + "</b>" + badge(d.st, d.st === "confirmé" ? "v" : "a") + "</div><p class=\"sca-p\">" + h(d.val || "—") + (d.id === "vehicule" && d.pro != null ? " (" + d.pro + " % pro)" : "") + '</p><p class="sca-mini">Source : ' + h(d.src || "—") + (d.le ? " · " + dfr(d.le) : "") + "</p></div>";
    });
    return x + "</section>";
  }

  /* -------------------------- Obligations, échéances, TVA -------------------------- */
  function vueOblig() {
    var L = registre(), x = '<section class="sca-q"><h3>Registre des obligations</h3><p class="sca-mini">Trié à partir de ton activité réelle : applicable, non applicable (avec la raison) ou à confirmer.</p>';
    ["applicable", "à confirmer", "non applicable"].forEach(function (st) {
      var g = L.filter(function (r) { return r.st === st; }); if (!g.length) return;
      x += '<p class="sca-k">' + h(st.charAt(0).toUpperCase() + st.slice(1)) + " (" + g.length + ")</p>";
      g.forEach(function (r) { x += '<div class="sca-row"><div class="sca-row-h"><b>' + h(r.t) + "</b>" + (r.suivi && r.suivi !== "—" ? badge(r.suivi, stCl(r.suivi)) : "") + '</div><p class="sca-mini">' + h(r.j) + (r.src ? " — " + (r.url ? '<a href="' + h(r.url) + '" target="_blank" rel="noopener">' + h(r.src) + "</a>" : h(r.src)) : "") + "</p></div>"; });
    });
    return x + "</section>";
  }
  function vueEcheances() {
    var L = echeances(), x = '<section class="sca-q"><h3>Calendrier des échéances</h3>';
    L.forEach(function (e) { x += '<div class="sca-row"><div class="sca-row-h"><b>' + h(e.titre) + "</b><span>" + (e.retard ? "en retard" : e.conseil ? dfr(e.conseil) : dfr(e.legal)) + '</span></div><p class="sca-mini">' + (e.legal ? "Échéance légale : " + dfr(e.legal) : "") + (e.conseil && e.conseil !== e.legal ? " · date conseillée : " + dfr(e.conseil) : "") + (e.montant ? " · " + eu(e.montant) + (e.statutMt ? " (" + h(e.statutMt) + ")" : "") : "") + "</p></div>"; });
    var perm = typeof Notification !== "undefined" ? Notification.permission : "indisponible";
    x += '<div class="sca-act"><div class="sca-act-h"><b>Rappels</b></div><ul class="sca-ul"><li><b>Quand l\'appli est ouverte</b> : un rappel s\'affiche 14, 7 et 2 jours avant la date conseillée, le jour même, puis une fois par semaine si c\'est en retard — seulement si l\'action est encore ouverte.</li>' +
      "<li><b>Notifications du téléphone</b> : " + (perm === "granted" ? "autorisées — elles s'affichent quand l'appli tourne (même en arrière-plan)." : perm === "denied" ? "bloquées dans ce navigateur (à réautoriser dans ses réglages)." : "pas encore autorisées.") + "</li>" +
      "<li><b>Quand l'appli est fermée</b> : l'appli ne peut pas t'avertir. Pour être prévenu quand même, ajoute le calendrier ci-dessous à ton téléphone : il contient une alarme 7 jours et 1 jour avant chaque date.</li></ul>" +
      '<div class="sca-btns"><button class="sca-b p" data-sca="ics">Ajouter à mon calendrier (.ics)</button>' + (perm === "default" ? '<button class="sca-b" data-sca="notif">Autoriser les notifications</button>' : "") + '<button class="sca-b" data-sca="test-rappel">Tester un rappel</button></div></div>';
    return x + "</section>";
  }
  function vueTva() {
    var M = modele(), x = '<section class="sca-q"><h3>TVA par trimestre</h3><p class="sca-mini">' + h(R.delaiTva.t) + "</p>";
    trimestresTva().slice().reverse().forEach(function (q) {
      var V = tvaTrim(q, M), k = "tva-" + q.id, d = V.decl;
      x += '<div class="sca-act"><div class="sca-act-h"><b>' + h(q.label) + (V.enCours ? " (en cours)" : "") + "</b>" + (d && d.etape === "deposee" ? badge("déposée", "v") : !V.enCours && todayStr() > q.ech ? badge("non déposée — délai dépassé", "r") : badge(V.enCours ? "en cours" : "à déposer", "a")) + "</div>" +
        '<div class="sca-kv"><span>' + (V.solde >= 0 ? "À payer" : "En ta faveur") + "</span><b>" + eu(Math.abs(V.solde)) + "</b>" + badge(V.enCours ? "estimé (en cours)" : V.ctrl.pret ? "calculé à valider" : "calculé — à vérifier", "a") + "</div>" +
        '<div class="sca-kv"><span>TVA collectée</span><b>' + eu(V.G["54"]) + "</b><span>déductible</span><b>" + eu(V.G["59"]) + "</b></div>" +
        '<div class="sca-kv"><span>Échéance</span><b>' + quand(q.ech) + "</b></div>" +
        (V.pay.liste.length ? '<p class="sca-mini">Paiements : ' + V.pay.liste.map(function (p) { return eu(p.montant) + " — " + (ETAPES[p.etape] || p.etape); }).join(" · ") + "</p>" : "") +
        '<div class="sca-btns"><button class="sca-b" data-sca="ouvrir" data-k="' + k + '">' + (U.ouvert[k] ? "Masquer le détail" : "Voir le détail") + "</button></div>" + (U.ouvert[k] ? detailTva(V) : "") + "</div>";
    });
    return x + "</section>";
  }
  function vueSauv() {
    var C = A(), sv = C.admHist.filter(function (e) { return e.type === "sauvegarde"; }).sort(function (a, b) { return a.le < b.le ? 1 : -1; });
    var x = '<section class="sca-q"><h3>Sauvegardes et export</h3><p class="sca-mini">Une sauvegarde complète est faite automatiquement avant chaque dépôt et avant chaque restauration. La restauration remplace uniquement la compta (pas l\'agenda).</p>' +
      '<div class="sca-btns"><button class="sca-b p" data-sca="sauver">Sauvegarder maintenant</button><button class="sca-b" data-sca="sauv-liste">Voir les sauvegardes en ligne</button><button class="sca-b" data-sca="sauv-fichier">Télécharger une copie</button><button class="sca-b" data-sca="restore-fichier">Restaurer depuis un fichier</button><button class="sca-b" data-sca="exporter">Exporter tout le dossier (ZIP)</button></div>' +
      '<input type="file" id="sca-restore" accept=".json,application/json" hidden>';
    if (U.sauv) {
      x += U.sauv.err ? '<p class="sca-alerte">' + h(U.sauv.err) + "</p>" : U.sauv.liste.map(function (f) { return '<div class="sca-row"><div class="sca-row-h"><b>' + h(f.name.replace(/\.json(\.gz)?$/, "")) + "</b><span>" + (f.metadata && f.metadata.size ? Math.round(f.metadata.size / 1024) + " Ko" : "") + '</span></div><div class="sca-btns"><button class="sca-b" data-sca="sauv-voir" data-n="' + h(f.name) + '">Restaurer…</button></div></div>'; }).join("");
    }
    x += '<p class="sca-k">Dernières sauvegardes notées</p>' + (sv.length ? sv.slice(0, 8).map(function (e) { return '<p class="sca-mini">' + dfr(e.le) + " " + e.le.slice(11, 16) + " — " + h(e.objet) + " (" + Math.round((e.octets || 0) / 1024) + " Ko, empreinte " + h((e.sha || "").slice(0, 12)) + ")</p>"; }).join("") : '<p class="sca-mini">Aucune encore.</p>');
    return x + "</section>";
  }

  /* --------------------------------- page principale --------------------------------- */
  function render() {
    A(); dossierInit();
    var x = '<div class="sca">';
    x += '<div class="sca-top"><div><b>Assistant compta</b><small>Je dépose → tu vérifies → tu vois quoi faire → la preuve est gardée</small></div><button class="sca-b p" data-sca="ajouter"' + (U.busy ? " disabled" : "") + ">📎 Ajouter mes documents</button></div>";
    x += '<input type="file" id="sca-file" multiple accept=".pdf,.csv,.txt,image/*,application/pdf" hidden>';
    x += '<div class="sca-chips">' + VUES.map(function (v) { return '<button class="' + (U.vue === v[0] ? "on" : "") + '" data-sca="vue" data-v="' + v[0] + '">' + v[1] + "</button>"; }).join("") + "</div>";
    try {
      x += U.vue === "docs" ? vueDocs() : U.vue === "hist" ? vueHist() : U.vue === "dossier" ? vueDossier() : U.vue === "oblig" ? vueOblig() : U.vue === "echeances" ? vueEcheances() : U.vue === "tva" ? vueTva() : U.vue === "ops" ? vueOps() : U.vue === "sauv" ? vueSauv() : accueil();
    } catch (e) {
      x += '<p class="sca-alerte">Erreur d\'affichage : ' + h(e.message) + "</p>";
      if (typeof noteErreur === "function") try { noteErreur(e, "assistant"); } catch (e2) {}
    }
    return x + "</div>";
  }

  /* ---------------------------------- fenêtres ---------------------------------- */
  function v(id) { var e = document.getElementById(id); return e ? String(e.value || "").trim() : ""; }
  function coche(id) { var e = document.getElementById(id); return !!(e && e.checked); }
  function fichier(id) { var e = document.getElementById(id); return e && e.files && e.files[0] ? e.files[0] : null; }
  function piece(file, type) {
    return file.arrayBuffer().then(function (buf) {
      return sha256(buf).then(function (sha) {
        var C = A(), ex = C.admDocs.filter(function (d) { return d.sha === sha; })[0];
        if (ex) { ex.type = type || ex.type; return (ex.chemin ? Promise.resolve() : envoyerOriginal(ex, new Blob([buf], { type: ex.mime }))).then(function () { return ex; }); }
        var doc = { id: "doc_" + sha.slice(0, 16), nom: file.name, sha: sha, mime: file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "application/octet-stream"), taille: file.size, le: nowIso(), type: type, ops: [], chemin: null };
        var lecture = /pdf/.test(doc.mime) ? pdfLignes(buf).then(function (P) { var f = lirePiece(P.texte); delete f.type; Object.assign(doc, f); }).catch(function () {}) : Promise.resolve();
        return lecture.then(function () { C.admDocs.push(doc); return envoyerOriginal(doc, new Blob([buf], { type: doc.mime })); }).then(function () { return doc; });
      });
    });
  }
  function noterDepot(obl, doc, date) {
    var q = qParId((obl || "").split(":")[1]), V = q ? tvaTrim(q) : null;
    doc.obl = obl;
    return hist({ type: "declaration", obl: obl, objet: "Déclaration TVA " + (q ? q.label : obl), etape: "deposee", date: date || todayStr(), docId: doc.id, grilles: V ? Object.assign({}, V.G) : null, montant: V ? V.solde : null, note: "Accusé de réception joint" });
  }
  function optionsObl(sel) {
    var o = ['<option value="">— choisir —</option>'];
    trimestresTva().forEach(function (q) { o.push('<option value="tva:' + q.id + '"' + (sel === "tva:" + q.id ? " selected" : "") + ">TVA " + q.label + "</option>"); });
    xeriusVue().obs.forEach(function (x) { var id = idXerius(x); o.push('<option value="' + id + '"' + (sel === id ? " selected" : "") + ">Cotisation Xerius " + h(x.periode) + "</option>"); });
    return o.join("");
  }
  function dessinerModal() {
    var box = document.getElementById("sca-modal");
    if (!U.modal) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement("div"); box.id = "sca-modal"; document.body.appendChild(box); }
    var m = U.modal, x = '<div class="sca-ov" id="sca-ov"><div class="sca-mod" role="dialog" aria-modal="true"><button class="sca-x" data-sca="fermer" aria-label="Fermer">×</button>';
    if (m.k === "decl") {
      x += "<h3>J'ai déposé la déclaration</h3><p class=\"sca-p\">Ajoute l'accusé de réception (PDF ou capture) : sans lui, je ne note pas la déclaration comme déposée.</p>" +
        '<label>Déclaration<select id="sca-m-obl">' + optionsObl(m.obl) + '</select></label><label>Date du dépôt<input type="date" id="sca-m-date" value="' + todayStr() + '"></label><label>Accusé de réception<input type="file" id="sca-m-file" accept=".pdf,image/*"></label>' +
        '<div class="sca-btns"><button class="sca-b p" data-sca="m-decl">Enregistrer</button><button class="sca-b" data-sca="m-decl-sans">Je n\'ai pas l\'accusé</button></div>';
    } else if (m.k === "pay") {
      x += "<h3>J'ai payé</h3><p class=\"sca-p\">Je note l'ordre de paiement. Il passera à « exécuté » quand je le verrai dans ton prochain relevé Revolut, puis « affecté » quand l'organisme le confirmera.</p>" +
        '<label>Pour<select id="sca-m-obl">' + optionsObl(m.obl) + '</select></label><label>Montant (€)<input id="sca-m-mt" inputmode="decimal" value="' + (m.mt ? (m.mt / 100).toFixed(2).replace(".", ",") : "") + '"></label><label>Date<input type="date" id="sca-m-date" value="' + todayStr() + '"></label><label>Preuve (confirmation du virement)<input type="file" id="sca-m-file" accept=".pdf,image/*"></label>' +
        '<div class="sca-btns"><button class="sca-b p" data-sca="m-pay">Enregistrer</button></div>';
    } else if (m.k === "demande") {
      x += "<h3>J'ai envoyé la demande à Xerius</h3><label>Date d'envoi<input type=\"date\" id=\"sca-m-date\" value=\"" + todayStr() + "\"></label><label>Confirmation (capture ou PDF)<input type=\"file\" id=\"sca-m-file\" accept=\".pdf,image/*\"></label>" +
        '<div class="sca-btns"><button class="sca-b p" data-sca="m-demande">Enregistrer</button></div>';
    } else if (m.k === "doc") {
      var d = A().admDocs.filter(function (z) { return z.id === m.id; })[0]; if (!d) { U.modal = null; return dessinerModal(); }
      var M = modele(), ops = M.ops.filter(function (o) { return o.o.out && !o.horsRevolut; }).slice().reverse();
      x += "<h3>" + h(d.nom) + '</h3><p class="sca-mini">' + (d.lu === "ia" ? "Lu par l'IA : vérifie chaque champ." : d.lu === "auto" ? "Lu automatiquement dans le PDF : vérifie." : "À compléter à la main.") + " Je ne modifie jamais l'original.</p>" +
        '<label>Type<select id="sca-d-type">' + Object.keys(TYPES_DOC).filter(function (k) { return k !== "releve"; }).map(function (k) { return '<option value="' + k + '"' + (d.type === k ? " selected" : "") + ">" + TYPES_DOC[k] + "</option>"; }).join("") + "</select></label>" +
        '<label>Fournisseur / émetteur<input id="sca-d-four" value="' + h(d.fournisseur || "") + '"></label><div class="sca-2"><label>Date<input type="date" id="sca-d-date" value="' + h(d.date || "") + '"></label><label>N° de facture<input id="sca-d-num" value="' + h(d.numero || "") + '"></label></div>' +
        '<div class="sca-2"><label>Total payé (€)<input id="sca-d-ttc" inputmode="decimal" value="' + (d.ttc != null ? (d.ttc / 100).toFixed(2).replace(".", ",") : "") + '"></label><label>dont TVA (€)<input id="sca-d-tva" inputmode="decimal" value="' + (d.tva != null ? (d.tva / 100).toFixed(2).replace(".", ",") : "") + '"></label></div>' +
        '<label>Pays du fournisseur (BE, IE, US…)<input id="sca-d-pays" maxlength="2" value="' + h(d.pays || "") + '"></label>' +
        '<label class="sca-c"><input type="checkbox" id="sca-d-monTva"' + (d.monTva ? " checked" : "") + "> Mon n° de TVA figure sur la facture</label>" +
        '<label class="sca-c"><input type="checkbox" id="sca-d-autoliq"' + (d.autoliq ? " checked" : "") + "> Mention « autoliquidation / reverse charge » (pas de TVA facturée)</label>" +
        '<label class="sca-c"><input type="checkbox" id="sca-d-illis"' + (d.lisible === false ? " checked" : "") + "> Document illisible ou incomplet</label>" +
        '<label>Paiement correspondant<select id="sca-d-op"><option value="">— aucun / payé hors Revolut —</option>' + ops.map(function (o) { return '<option value="' + h(o.id) + '"' + ((d.ops || []).indexOf(o.id) >= 0 ? " selected" : "") + ">" + dfr(o.d) + " · " + h(o.four || o.o.lib) + " · " + eu(o.o.out) + "</option>"; }).join("") + "</select></label>" +
        '<label>Si accusé ou preuve de paiement : pour quelle obligation ?<select id="sca-d-obl">' + optionsObl(d.obl) + "</select></label>" +
        '<label>Note (usage professionnel…)<input id="sca-d-note" value="' + h(d.note || "") + '"></label><div class="sca-btns"><button class="sca-b p" data-sca="m-doc" data-id="' + h(d.id) + '">Enregistrer</button></div>';
    } else if (m.k === "op") {
      var M2 = modele(), xo = M2.parId[m.id]; if (!xo) { U.modal = null; return dessinerModal(); }
      var o = xo.o, q = xo.q, dq = decl("tva:" + q.id), docsLibres = A().admDocs.filter(function (z) { return PIECES[z.type]; });
      x += "<h3>" + h(xo.four || o.lib) + '</h3><p class="sca-mini">' + dfr(o.d) + " · " + (o.inn ? "+" + eu(o.inn) : "−" + eu(o.out)) + " · " + h([o.a, o.de, o.ref, o.det].filter(Boolean).join(" · ")) + "</p>" +
        (dq && dq.etape === "deposee" ? '<p class="sca-alerte">Le ' + h(q.label) + " est déjà déclaré : une modification ne change pas la déclaration déposée ; l'écart sera à corriger dans la déclaration suivante.</p>" : "") +
        '<label>Catégorie<select id="sca-o-cat">' + CAT_CHOIX.map(function (k) { return '<option value="' + k + '"' + (xo.cat === k ? " selected" : "") + ">" + h(CAT[k][0]) + (xo.auto.cat === k && !xo.manuel ? " (proposé)" : "") + "</option>"; }).join("") + "</select></label>" +
        (xo.note ? '<p class="sca-mini">' + h(xo.note) + "</p>" : "") +
        '<label>Usage professionnel (une phrase)<input id="sca-o-usage" value="' + h(o.usage || xo.usage || "") + '"></label>' +
        '<label>Part professionnelle (%) — vide = 100 %<input id="sca-o-pct" type="number" min="0" max="100" value="' + (o.pct != null ? o.pct : "") + '"></label>';
      if (xo.cat === "vente_carte") { var bv = (xo.brut / 100).toFixed(2).replace(".", ","); x += '<label>Montant payé par le client (€) — ' + h(xo.brutSrc) + '<input id="sca-o-brut" inputmode="decimal" value="' + bv + '" data-init="' + bv + '"></label>' + (xo.brutCalc ? '<label class="sca-c"><input type="checkbox" id="sca-o-brutok"> J\'ai vérifié ce montant dans le détail Revolut</label>' : ""); }
      if (xo.grp === "vente") x += '<label>Date de la prestation (si différente du paiement)' + (xo.periodeAConfirmer ? " — à confirmer : la TVA est due à la fin du service" : "") + '<input type="date" id="sca-o-dp" value="' + h(o.datePresta || "") + '"></label>';
      if (xo.cat === "vente_vir") x += '<label>Client<select id="sca-o-cli">' + ["particulier", "entreprise", "à préciser"].map(function (c) { return "<option" + (xo.client === c ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></label>";
      x += '<label>Pièce jointe<select id="sca-o-doc"><option value="">—</option>' + docsLibres.map(function (z) { return '<option value="' + h(z.id) + '"' + ((z.ops || []).indexOf(o.id) >= 0 ? " selected" : "") + ">" + h(z.nom) + (z.ttc ? " · " + eu(z.ttc) : "") + "</option>"; }).join("") + "</select></label>" +
        '<div class="sca-btns"><button class="sca-b p" data-sca="m-op" data-id="' + h(o.id) + '">Enregistrer</button></div>';
    } else if (m.k === "restaurer") {
      var s = m.resume;
      x += "<h3>Restaurer cette sauvegarde ?</h3><p class=\"sca-p\">Sauvegarde du " + dfr(s.quand) + (s.quand ? " à " + s.quand.slice(11, 16) : "") + (s.raison ? " (" + h(s.raison) + ")" : "") + " : " + s.ops + " opérations, " + s.docs + " documents, " + s.dep + " dépenses, " + s.ven + " factures, " + s.oblig + " obligations.</p><p class=\"sca-alerte\">La compta actuelle sera remplacée par celle-ci. Je fais d'abord une sauvegarde de l'état actuel. L'agenda n'est pas touché.</p>" +
        '<div class="sca-btns"><button class="sca-b p" data-sca="m-restaurer">Restaurer</button><button class="sca-b" data-sca="fermer">Annuler</button></div>';
    }
    box.innerHTML = x + "</div></div>";
  }

  /* ---------------------------------- événements ---------------------------------- */
  function occupe(p, ok) {
    U.busy = true; rafraichir();
    return p.then(function (r) { U.busy = false; if (ok) toast("ok", [typeof ok === "function" ? ok(r) : ok]); rafraichir(); return r; }, function (e) { U.busy = false; toast("err", [(e && e.message) || String(e)]); rafraichir(); });
  }
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "sca-ov") { U.modal = null; dessinerModal(); return; }
    var el = e.target.closest && e.target.closest("[data-sca]"); if (!el) return;
    var a = el.getAttribute("data-sca"), id = el.getAttribute("data-id");
    switch (a) {
      case "ajouter": { var inp = document.getElementById("sca-file"); if (inp) inp.click(); break; }
      case "vue": U.vue = el.getAttribute("data-v") || "accueil"; U.filtre = { preciser: "preciser", ventes: "ventes" }[el.getAttribute("data-f")] || (U.vue === "ops" ? U.filtre : "tout"); rafraichir(); window.scrollTo(0, 0); break;
      case "filtre": U.filtre = el.getAttribute("data-f"); rafraichir(); break;
      case "ouvrir": { var k = el.getAttribute("data-k"); U.ouvert[k] = !U.ouvert[k]; rafraichir(); break; }
      case "fermer": U.modal = null; dessinerModal(); break;
      case "fermer-depot": U.depot = null; rafraichir(); break;
      case "fait-decl": U.modal = { k: "decl", obl: el.getAttribute("data-obl") }; dessinerModal(); break;
      case "fait-pay": U.modal = { k: "pay", obl: el.getAttribute("data-obl"), mt: +el.getAttribute("data-mt") || 0 }; dessinerModal(); break;
      case "fait-demande": U.modal = { k: "demande" }; dessinerModal(); break;
      case "doc": U.modal = { k: "doc", id: id }; dessinerModal(); break;
      case "op": if (!el.disabled) { U.modal = { k: "op", id: id }; dessinerModal(); } break;
      case "original": { var d0 = A().admDocs.filter(function (z) { return z.id === id; })[0]; if (d0) ouvrirOriginal(d0); break; }
      case "copier": { var t = el.getAttribute("data-txt") || ""; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast("ok", ["Texte copié."]); }, function () { window.prompt("Copie ce texte :", t); }); break; }
      case "m-decl": {
        var f = fichier("sca-m-file"), obl = v("sca-m-obl"), dd = v("sca-m-date");
        if (!obl) { toast("err", ["Choisis la déclaration."]); break; }
        if (!f) { toast("err", ["Ajoute l'accusé de réception : sans lui, la déclaration n'est pas notée comme déposée."]); break; }
        occupe(piece(f, "accuse_depot").then(function (doc) { noterDepot(obl, doc, dd); save(); U.modal = null; }), "Déclaration notée comme déposée, accusé conservé.");
        break;
      }
      case "m-decl-sans": {
        var o2 = v("sca-m-obl"); if (!o2) { toast("err", ["Choisis la déclaration."]); break; }
        hist({ type: "declaration", obl: o2, objet: "Déclaration TVA " + o2.split(":")[1], etape: "deposee_sans_accuse", date: v("sca-m-date"), note: "Dépôt annoncé sans accusé : télécharge l'accusé dans Accountable ou Intervat." });
        save(); U.modal = null; toast("ok", ["Noté. La déclaration reste « à prouver » tant que l'accusé n'est pas ajouté."]); rafraichir(); break;
      }
      case "m-pay": {
        var fp = fichier("sca-m-file"), ob = v("sca-m-obl"), mt = montantTxt(v("sca-m-mt") + " €");
        if (!ob || !mt) { toast("err", ["Indique l'obligation et le montant."]); break; }
        var fin = function (doc) { hist({ type: "paiement", obl: ob, objet: (/^tva/.test(ob) ? "TVA " : "Cotisation Xerius ") + ob.split(":")[1], etape: "ordre", montant: Math.abs(mt.c), date: v("sca-m-date"), docId: doc ? doc.id : null, note: doc ? "Preuve jointe ; en attente de la ligne du relevé" : "Sans preuve jointe" }); save(); U.modal = null; };
        occupe(fp ? piece(fp, "preuve_paiement").then(fin) : Promise.resolve().then(function () { fin(null); }), fp ? "Paiement noté (ordre donné, preuve conservée)." : "Paiement noté sans preuve : ajoute la confirmation dès que possible.");
        break;
      }
      case "m-demande": {
        var fd = fichier("sca-m-file");
        var fin2 = function (doc) { hist({ type: "demande", obl: "xerius:reduction", objet: "Demande de réduction starter à Xerius", etape: "envoyee", date: v("sca-m-date"), docId: doc ? doc.id : null, note: doc ? "Confirmation jointe" : "Sans confirmation jointe" }); save(); U.modal = null; };
        occupe(fd ? piece(fd, "autre").then(fin2) : Promise.resolve().then(function () { fin2(null); }), "Demande notée comme envoyée. Le montant réclamé reste dû jusqu'à la réponse de Xerius.");
        break;
      }
      case "m-doc": {
        var dc = A().admDocs.filter(function (z) { return z.id === id; })[0]; if (!dc) break;
        dc.type = v("sca-d-type") || dc.type; dc.fournisseur = v("sca-d-four"); dc.date = v("sca-d-date") || null; dc.numero = v("sca-d-num");
        var tt = v("sca-d-ttc") ? montantTxt(v("sca-d-ttc") + " €") : null, tv = v("sca-d-tva") ? montantTxt(v("sca-d-tva") + " €") : null;
        dc.ttc = tt ? Math.abs(tt.c) : null; dc.tva = tv ? Math.abs(tv.c) : null; dc.pays = v("sca-d-pays").toUpperCase() || null;
        dc.monTva = coche("sca-d-monTva"); dc.autoliq = coche("sca-d-autoliq"); dc.lisible = coche("sca-d-illis") ? false : true; dc.note = v("sca-d-note");
        var opSel = v("sca-d-op"); dc.ops = opSel ? [opSel] : []; dc.aCompleter = dc.ttc == null && PIECES[dc.type]; dc.verifieLe = todayStr();
        var oblD = v("sca-d-obl");
        if (oblD && dc.type === "accuse_depot" && !A().admHist.some(function (e) { return e.type === "declaration" && e.docId === dc.id; })) noterDepot(oblD, dc, dc.date);
        if (oblD && dc.type === "preuve_paiement" && !A().admHist.some(function (e) { return e.type === "paiement" && e.docId === dc.id; })) hist({ type: "paiement", obl: oblD, objet: "Paiement " + oblD.split(":")[1], etape: "ordre", montant: dc.ttc, date: dc.date, docId: dc.id, note: "Preuve de paiement déposée" });
        save(); U.modal = null; toast("ok", ["Document enregistré. Les calculs sont à jour."]); rafraichir(); break;
      }
      case "m-op": {
        var C = A(), op = C.admOps.filter(function (z) { return z.id === id; })[0]; if (!op) break;
        var soldes = function () { var r = {}; trimestresTva().forEach(function (q) { r[q.id] = tvaTrim(q).solde; }); return r; };
        var avantT = soldes(), avant = avantT[trimDe(op.d).id], cat = v("sca-o-cat"), pctS = v("sca-o-pct");
        var dpEl = document.getElementById("sca-o-dp"); if (dpEl) { if (dpEl.value) op.datePresta = dpEl.value; else delete op.datePresta; }
        op.cat = cat; op.catLe = todayStr(); op.usage = v("sca-o-usage") || undefined; op.pct = pctS === "" ? undefined : Math.max(0, Math.min(100, +pctS));
        var br = document.getElementById("sca-o-brut");
        if (br) { var bm = montantTxt(br.value + " €"); if (bm && (br.value.trim() !== br.getAttribute("data-init") || coche("sca-o-brutok"))) op.brut = Math.abs(bm.c); }
        var cl = document.getElementById("sca-o-cli"); if (cl) op.client = cl.value;
        var dsel = v("sca-o-doc");
        C.admDocs.forEach(function (z) { if ((z.ops || []).indexOf(op.id) >= 0 && z.id !== dsel) z.ops = z.ops.filter(function (i) { return i !== op.id; }); });
        if (dsel) { var dz = C.admDocs.filter(function (z) { return z.id === dsel; })[0]; if (dz) dz.ops = [op.id]; }
        _M = null;
        var q = trimDe(op.d), apresT = soldes(), apres = apresT[q.id];
        Object.keys(apresT).forEach(function (qid) {
          var dq = decl("tva:" + qid), qq = qParId(qid);
          if (dq && dq.etape === "deposee" && apresT[qid] !== avantT[qid]) hist({ type: "correction", obl: "tva:" + qid, objet: "Correction après dépôt — " + qq.label, etape: "preparee", montant: apresT[qid] - avantT[qid], note: "Écart à reporter dans la déclaration suivante (« " + (op.lib || "") + " » du " + dfr(op.d) + ")." });
        });
        save(); U.modal = null;
        toast("ok", ["Enregistré." + (apres !== avant ? " TVA du " + q.label + " : " + eu(avant) + " → " + eu(apres) + "." : "")]); rafraichir(); break;
      }
      case "rep": { var dd2 = dos(id); if (dd2) { dd2.val = el.getAttribute("data-val"); dd2.st = "confirmé"; dd2.src = "Ta réponse du " + dfr(todayStr()); dd2.le = todayStr(); save(); rafraichir(); } break; }
      case "rep-txt": { var dt = dos(id), tx = v("sca-q-" + id); if (dt && tx) { dt.val = tx; dt.st = "confirmé"; dt.src = "Ta réponse du " + dfr(todayStr()); dt.le = todayStr(); save(); rafraichir(); } else toast("err", ["Écris ta réponse."]); break; }
      case "rep-veh": { var dv = dos("vehicule"), ty = v("sca-q-veh"), pr = v("sca-q-pro"); if (!dv || !ty) { toast("err", ["Choisis le type de véhicule."]); break; } dv.val = ty; dv.pro = ty === "aucun" ? 0 : (pr === "" ? null : Math.max(0, Math.min(100, +pr))); dv.st = ty === "aucun" || dv.pro != null ? "confirmé" : "à confirmer"; dv.src = "Ta réponse du " + dfr(todayStr()); dv.le = todayStr(); save(); if (dv.st !== "confirmé") toast("err", ["Indique aussi la part professionnelle (%)."]); rafraichir(); break; }
      case "ics": telecharger(new Blob([ics(echeances())], { type: "text/calendar" }), "stayclean-echeances.ics"); toast("ok", ["Fichier calendrier téléchargé : ouvre-le pour l'ajouter à ton agenda."]); break;
      case "notif": if (typeof Notification !== "undefined") Notification.requestPermission().then(function () { rafraichir(); }); break;
      case "test-rappel": { var etat = lireJSON(CLE_RAPPELS) || {}; var n = rappelsDus().length; toast("ok", [n ? n + " rappel(s) en attente : ils s'afficheront maintenant." : "Aucun rappel en attente aujourd'hui (tout a déjà été signalé ou rien n'est proche).", "Mémoire des rappels sur cet appareil : " + Object.keys(etat).length + " entrée(s)."]); if (n) verifierRappels(); break; }
      case "sauver": occupe(sauvegarder("manuelle"), function (r) { return r.ok ? "Sauvegarde faite (" + Math.round(r.octets / 1024) + " Ko)." : r.msg; }); break;
      case "sauv-liste": occupe(listeSauvegardes().then(function (l) { U.sauv = { liste: l }; }, function (er) { U.sauv = { err: er.message }; })); break;
      case "sauv-voir": occupe(chargerSauvegarde(el.getAttribute("data-n")).then(function (obj) { var s = resumeSauvegarde(obj); if (!s) throw new Error("Sauvegarde illisible."); U.modal = { k: "restaurer", obj: obj, resume: s }; })); break;
      case "sauv-fichier": telecharger(new Blob([JSON.stringify({ type: "stayclean-sauvegarde", version: 1, quand: nowIso(), raison: "copie téléchargée", local: donneesSures() })], { type: "application/json" }), "stayclean-sauvegarde-" + todayStr() + ".json"); hist({ type: "sauvegarde", objet: "Copie téléchargée sur l'appareil", etape: "faite" }); save(); break;
      case "restore-fichier": { var ri = document.getElementById("sca-restore"); if (ri) ri.click(); break; }
      case "m-restaurer": { var ob2 = U.modal && U.modal.obj; occupe(restaurer(ob2).then(function (r) { U.modal = null; return r; }), "Compta restaurée. L'état précédent a été sauvegardé."); break; }
      case "exporter": occupe(exporter(), function (r) { return "Export prêt" + (r.manquants.length ? " (" + r.manquants.length + " original(aux) non inclus)" : "") + "."; }); break;
    }
  });
  document.addEventListener("change", function (e) {
    var t = e.target; if (!t) return;
    if (t.id === "sca-file" && t.files && t.files.length) { var fs = Array.prototype.slice.call(t.files); t.value = ""; U.vue = "accueil"; deposer(fs); }
    if (t.id === "sca-restore" && t.files && t.files[0]) {
      var f = t.files[0]; t.value = "";
      f.text().then(function (txt) { var obj = JSON.parse(txt), s = resumeSauvegarde(obj); if (!s) throw new Error("Ce fichier n'est pas une sauvegarde StayClean."); U.modal = { k: "restaurer", obj: obj, resume: s }; dessinerModal(); }).catch(function (er) { toast("err", [er.message]); });
    }
  });

  /* ------------------------------------ styles ------------------------------------ */
  var css = ".sca{padding-bottom:30px}.sca-top{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:4px 0 10px}.sca-top .sca-b{flex:0 0 auto;white-space:nowrap}.sca-top b{display:block;font-size:17px}.sca-top small{color:var(--gris);font-size:12px}" +
    ".sca-chips{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;scrollbar-width:none}.sca-chips button{flex:0 0 auto;padding:7px 12px;border-radius:999px;border:1px solid var(--bordure);background:#fff;font-size:13px;color:var(--nuit)}.sca-chips button.on{background:var(--nuit);color:#fff;border-color:var(--nuit)}" +
    ".sca-q{margin-top:16px}.sca-q h3{font-size:16px;margin:0 0 8px}.sca-verif{border-left:4px solid var(--bleu)}.sca-p{margin:4px 0;font-size:14px;line-height:1.45}.sca-mini{font-size:12.5px;color:var(--gris);margin:4px 0;line-height:1.4}" +
    ".sca-act,.sca-row{background:#fff;border:1px solid var(--bordure);border-radius:14px;padding:12px;margin:8px 0}.sca-act.retard{border-color:var(--rouge);box-shadow:0 0 0 1px var(--rouge-bg)}.sca-act-h,.sca-row-h{display:flex;gap:8px;justify-content:space-between;align-items:flex-start}.sca-act-h b{font-size:15px}.sca-row-h span{color:var(--gris);font-size:12.5px;white-space:nowrap}" +
    ".sca-kv{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:13.5px;margin:3px 0}.sca-kv span{color:var(--gris)}.sca-badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--pale);color:var(--bleu-dark);margin:2px 4px 2px 0}.sca-badge.v{background:var(--vert-bg);color:var(--vert)}.sca-badge.a{background:var(--ambre-bg);color:var(--ambre)}.sca-badge.r{background:var(--rouge-bg);color:var(--rouge)}" +
    ".sca-steps{margin:8px 0 4px 18px;padding:0;font-size:13.5px;line-height:1.45}.sca-steps li{margin:2px 0}.sca-preuve{font-size:12.5px;background:var(--fond);border-radius:8px;padding:6px 8px;margin:6px 0}.sca-alerte{font-size:13px;background:var(--ambre-bg);color:#7c2d12;border-radius:8px;padding:7px 9px;margin:6px 0}" +
    ".sca-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.sca-b{display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;border:1px solid var(--bordure);background:#fff;color:var(--nuit);font-size:13px;font-weight:600;text-decoration:none;cursor:pointer}.sca-b.p{background:var(--bleu);border-color:var(--bleu);color:#fff}.sca-b[disabled]{opacity:.5}.sca-lk{background:none;border:0;color:var(--bleu-dark);text-decoration:underline;font-size:inherit;padding:0}" +
    ".sca-t{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0}.sca-t td,.sca-t th{padding:5px 4px;border-bottom:1px solid var(--bordure);text-align:left;vertical-align:top}.sca-t .n{text-align:right;white-space:nowrap}.sca-t tr.r td{color:var(--rouge)}.sca-detail{margin-top:10px;border-top:1px dashed var(--bordure);padding-top:8px}.sca-k{font-size:11px;font-weight:700;text-transform:uppercase;color:var(--gris);margin:10px 0 4px}" +
    ".sca-ctrl{list-style:none;padding:0;margin:4px 0;font-size:13px}.sca-ctrl li{margin:3px 0}.sca-ctrl li.ko{color:#7c2d12}.sca-ul{margin:4px 0 4px 18px;padding:0;font-size:13.5px;line-height:1.45}.sca-src{font-size:11.5px;color:var(--gris);margin-top:6px}.sca-src a{color:var(--bleu-dark)}.sca-reserve{background:var(--fond);border-radius:12px;padding:10px;margin-top:8px;font-size:13.5px}" +
    ".sca-add{margin-top:10px}.sca-op{display:grid;grid-template-columns:42px 1fr auto;gap:2px 8px;width:100%;text-align:left;background:#fff;border:1px solid var(--bordure);border-radius:12px;padding:9px 10px;margin:5px 0;font-size:13.5px;color:var(--nuit)}.sca-op small{display:block;color:var(--gris);font-size:11.5px}.sca-op .n{font-weight:700;white-space:nowrap}.sca-op .n.in{color:var(--vert)}.sca-op .sca-badge{grid-column:2/4;justify-self:start}" +
    ".sca-form{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.sca-form input,.sca-form select{flex:1 1 140px;padding:8px;border:1px solid var(--bordure);border-radius:10px;font-size:14px}.sca-pre{white-space:pre-wrap;font-size:12.5px;background:var(--fond);border-radius:10px;padding:10px;max-height:260px;overflow:auto}" +
    ".sca-ov{position:fixed;inset:0;background:rgba(15,34,51,.45);z-index:9000;display:flex;align-items:flex-end;justify-content:center}.sca-mod{background:#fff;width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:18px 18px 0 0;padding:16px 16px 28px;position:relative}.sca-mod h3{margin:0 30px 8px 0;font-size:17px}.sca-mod label{display:block;font-size:12.5px;color:var(--gris);margin:8px 0}.sca-mod label input:not([type=checkbox]),.sca-mod label select{display:block;width:100%;margin-top:3px;padding:9px;border:1px solid var(--bordure);border-radius:10px;font-size:14px;color:var(--nuit);background:#fff;box-sizing:border-box}.sca-mod .sca-c{display:flex;gap:8px;align-items:center;color:var(--nuit);font-size:13.5px}.sca-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sca-x{position:absolute;top:10px;right:12px;border:0;background:none;font-size:26px;line-height:1;color:var(--gris)}" +
    "@media(min-width:700px){.sca-ov{align-items:center}.sca-mod{border-radius:18px}}";
  var stl = document.createElement("style"); stl.textContent = css; document.head.appendChild(stl);

  /* ------------------------------------ démarrage ------------------------------------ */
  setTimeout(function () { if (window.scSyncPret !== false) verifierRappels(); }, 8000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") setTimeout(function () { verifierRappels(); }, 3000); });

  window.SCA = {
    render: render, rafraichir: rafraichir, modele: modele, tvaTrim: function (id) { return tvaTrim(id); }, bilanReel: bilanReel, couverture: couverture,
    actions: function () { return actions(); }, registre: function () { return registre(); }, echeances: function () { return echeances(); }, xerius: function () { return xeriusVue(); },
    deposer: deposer, sauvegarder: sauvegarder, restaurer: restaurer, exporter: exporter, verifierRappels: verifierRappels, rappelsDus: function () { return rappelsDus(); }, ics: function () { return ics(echeances()); },
    aDesReleves: function () { return A().admImp.length > 0; }, regles: R, verifie: VERIF,
    _t: { parseRevolutPdf: parseRevolutPdf, parseRevolutCsv: parseRevolutCsv, pdfLignes: pdfLignes, lirePiece: lirePiece, catAuto: catAuto, paysDe: paysDe, typeClient: typeClient, montantTxt: montantTxt, dateTxt: dateTxt, U: U, piece: piece, noterDepot: noterDepot, resumeSauvegarde: resumeSauvegarde, listeSauvegardes: listeSauvegardes, chargerSauvegarde: chargerSauvegarde, brutDepuisNet: brutDepuisNet, importerAnalyses: importerAnalyses, CLE_RAPPELS: CLE_RAPPELS }
  };
})();
