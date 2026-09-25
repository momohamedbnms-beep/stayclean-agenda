/* =====================================================================
   StayClean Business OS — module 2 (24/09/2026)
   Clients 360° · Interventions (statut opérationnel ≠ statut financier) ·
   Paiement en 1 geste (cash / carte / virement / Payconiq) ·
   Facture Express (brouillon modifiable → validation → PDF) ·
   Centre « À payer » (moteur d'obligations OFFICIEL vs ESTIMÉ).

   Une seule source de vérité : les clients ne sont PAS une copie. Ils sont
   reconstruits à chaque affichage depuis les RDV, les demandes du site et
   les factures (regroupés par téléphone, sinon par nom). Seules les infos
   qui n'existent nulle part ailleurs (société, n° TVA, email, notes) sont
   stockées dans DB.cpt.clients.
   Dépend de finance.js (window.SCF), chargé avant.
   ===================================================================== */
(function () {
  "use strict";
  if (!window.SCF) return;
  var S = window.SCF;
  var eur2 = S.eur2, dfr = S.dfr, r2 = S.r2, uid = S.uid;

  function C() {
    var c = cptData();
    if (!c.clients) c.clients = {};
    if (!c.oblig) c.oblig = [];
    if (c.set && c.set.autoBrouillon == null) c.set.autoBrouillon = true;
    return c;
  }
  function jours(d) { return Math.round((parseDateStr(d) - parseDateStr(todayStr())) / 864e5); }
  function telIntl(t) { return (t || "").replace(/[^0-9+]/g, "").replace(/^\+/, "").replace(/^00/, "").replace(/^0/, "32"); }
  function prenom(n) { return (n || "").split(" ")[0]; }

  /* ============================ CLIENTS =============================== */
  function cleTel(t) { var d = (t || "").replace(/\D/g, ""); return d.length >= 8 ? "t" + d.slice(-9) : null; }
  function cleNom(n) { var k = norm(n || "").replace(/[^a-z]/g, ""); return k.length >= 3 && k !== "acompleter" ? "n" + k : null; }

  function clients() {
    var alias = {}, map = {};
    function note(nom, tel) { var kn = cleNom(nom), kt = cleTel(tel); if (kn && kt && !alias[kn]) alias[kn] = kt; }
    DB.bookings.forEach(function (b) { note(b.client, b.telephone); });
    (DB.dem || []).forEach(function (d) { note(d.nom, d.tel); });
    function cle(nom, tel) { var kt = cleTel(tel); if (kt) return kt; var kn = cleNom(nom); return kn ? (alias[kn] || kn) : null; }
    function get(k) { return map[k] || (map[k] = { key: k, nom: "", tel: "", email: "", adresse: "", bks: [], dems: [], vens: [] }); }
    DB.bookings.forEach(function (b) {
      var k = cle(b.client, b.telephone); if (!k) return;
      var c = get(k); c.bks.push(b);
      if (b.client && b.client !== "À COMPLÉTER" && (!c._d || b.date > c._d)) { c.nom = b.client; c._d = b.date; }
      if (b.telephone && !c.tel) c.tel = b.telephone;
      if (b.adresse && (!c._da || b.date > c._da)) { c.adresse = b.adresse; c._da = b.date; }
    });
    (DB.dem || []).forEach(function (d) {
      var k = cle(d.nom, d.tel); if (!k) return;
      var c = get(k); c.dems.push(d);
      if (!c.nom && d.nom) c.nom = d.nom; if (!c.tel && d.tel) c.tel = d.tel;
      if (d.email && !c.email) c.email = d.email; if (!c.adresse && d.adresse) c.adresse = d.adresse;
    });
    cptData().ven.forEach(function (v) {
      if (v.type === "nc") return;
      var bk = null, i = (v.source || "").indexOf("bk_");
      var k = null;
      if (i !== -1) { bk = findBk(v.source.slice(i)); if (bk) k = cle(bk.client, bk.telephone); }
      if (!k) k = cle(v.client, v.clientTel);
      if (!k) return;
      var c = get(k); c.vens.push(v); if (!c.nom) c.nom = v.client;
    });
    var ov = C().clients, td = todayStr();
    return Object.keys(map).map(function (k) {
      var c = map[k], o = ov[k] || {};
      c.o = o;
      if (o.adresse) c.adresse = o.adresse; if (o.email) c.email = o.email;
      var faits = c.bks.filter(function (b) { return b.statut === "termine"; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      var futurs = c.bks.filter(function (b) { return b.statut !== "termine" && b.statut !== "annule" && b.date >= td; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      c.faits = faits; c.prochain = futurs[0] || null;
      var credC = bkCreditees();
      c.caTTC = r2(faits.reduce(function (s, b) { return s + (credC[b.id] ? 0 : (b.total || 0)); }, 0));
      c.caHT = r2(c.caTTC / (1 + S.tauxPresta() / 100));
      c.panier = faits.length ? r2(c.caTTC / faits.length) : 0;
      c.dernier = faits[0] || null;
      var imp = 0, impN = 0;
      faits.forEach(function (b) {
        var fb = factureDe(b.id);
        if (fb && fb.statut !== "brouillon") return; /* la facture porte déjà la dette */
        if (b.pay && b.pay.statut === "non_paye") { imp += b.total || 0; impN++; }
      });
      c.vens.forEach(function (v) { if (v.statut !== "brouillon" && !v.creditee && (v.ttc || 0) - (v.paye || 0) > 0.009) { imp += (v.ttc || 0) - (v.paye || 0); impN++; } });
      c.impaye = r2(imp); c.impayeN = impN;
      c.sansFacture = faits.filter(function (b) { return !factureDe(b.id); }).length;
      c.devisOuvert = c.dems.filter(function (d) { return d.statut === "nouvelle"; }).length;
      var srv = {};
      faits.forEach(function (b) { (b.prestations || []).forEach(function (p) { if (p.nom) srv[p.nom] = (srv[p.nom] || 0) + 1; }); });
      c.services = srv;
      c.derniereActivite = [c.prochain && c.prochain.date, c.dernier && c.dernier.date, c.dems.length && (c.dems[0].cree_le ? fmtDate(new Date(c.dems[0].cree_le)) : "")].filter(Boolean).sort().pop() || "";
      if (!c.nom) c.nom = c.tel || "Client";
      return c;
    });
  }
  function clientDeBk(b) {
    var all = clients();
    return all.filter(function (c) { return c.bks.indexOf(b) !== -1; })[0] || null;
  }

  /* ======================= INTERVENTIONS ============================== */
  var MOYENS = { cash: "Cash", carte: "Carte", virement: "Virement", payconiq: "Payconiq" };
  function factureDe(bkId) {
    var vs = cptData().ven.filter(function (v) { return v.type !== "nc" && !v.creditee && v.statut !== "annulee" && (v.source || "").indexOf(bkId) !== -1; });
    return vs.filter(function (v) { return v.statut !== "brouillon"; })[0] || vs[0] || null;
  }
  function statutOp(b) {
    if (b.statut === "annule") return { l: "Annulé", c: "#64748b" };
    if (b.statut === "termine") return { l: b.autoTermine ? "Terminé (auto)" : "Terminé", c: "#047857" };
    if (b.date < todayStr()) return { l: "À clôturer", c: "#b45309" };
    return { l: "Confirmé", c: "#1d4ed8" };
  }
  function statutFin(b) {
    if (b.statut !== "termine") return null;
    var p = b.pay;
    var pay = !p ? { l: "Paiement ?", c: "#b45309" } : p.statut === "non_paye" ? { l: "Non payé", c: "#dc2626" } : { l: "Payé " + (MOYENS[p.moyen] || "").toLowerCase(), c: "#047857" };
    var f = factureDe(b.id);
    var fac = !f ? null : f.statut === "brouillon" ? { l: "Brouillon facture", c: "#b45309" } : { l: "Facturé " + f.numero, c: "#047857" };
    return { pay: pay, fac: fac };
  }
  function tag(t) { return '<span class="tag" style="background:#fff;border:1px solid ' + t.c + ";color:" + t.c + '">' + esc(t.l) + "</span>"; }
  function bkTags(b) {
    var f = statutFin(b); if (!f) return "";
    return tag(f.pay) + (f.fac ? tag(f.fac) : "");
  }

  /* bloc « intervention » de la fiche RDV : statuts séparés + actions */
  function bkPanel(b) {
    var op = statutOp(b), fin = statutFin(b);
    var h = '<div class="mini-analyse" style="margin:0 0 12px"><p class="t">Intervention</p><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' +
      tag(op) + (fin ? tag(fin.pay) + (fin.fac ? tag(fin.fac) : "") : "") + "</div>";
    if (b.statut === "termine") {
      var cur = b.pay ? (b.pay.statut === "non_paye" ? "non_paye" : b.pay.moyen) : null;
      h += '<p class="note" style="margin:0 0 6px">Le client a payé comment ?</p><div class="sitgrid" style="margin:0 0 8px;grid-template-columns:repeat(5,1fr);gap:6px">';
      ["cash", "carte", "virement", "payconiq", "non_paye"].forEach(function (m) {
        var on = cur === m;
        h += '<button data-scb="payer" data-id="' + b.id + '" data-m="' + m + '" style="padding:9px 2px;border-radius:12px;font-size:12px;font-weight:700;border:1.5px solid ' + (on ? (m === "non_paye" ? "#dc2626" : "#059669") : "var(--bordure)") + ";background:" + (on ? (m === "non_paye" ? "#fef2f2" : "#ecfdf5") : "#fff") + '">' + (m === "non_paye" ? "Pas payé" : MOYENS[m]) + "</button>";
      });
      h += "</div>";
      var f = factureDe(b.id);
      h += '<button class="btn-main" style="margin:0;padding:12px;background:#059669" data-scb="fac-express" data-id="' + b.id + '">' +
        (!f ? "🧾 Préparer la facture" : f.statut === "brouillon" ? "🧾 Finaliser la facture (brouillon prêt)" : "📄 Voir la facture " + esc(f.numero)) + "</button>";
    } else {
      h += '<p class="note" style="margin:0">Après l\'intervention, touche « ✓ Marquer terminé » : tu pourras enregistrer le paiement et la facture en un geste.</p>';
    }
    h += '<button class="linkline" data-scb="client-bk" data-id="' + b.id + '">Voir la fiche client 360° →</button></div>';
    return h;
  }

  function payer(bkId, m) {
    var b = findBk(bkId); if (!b) return;
    var avant = b.pay ? (b.pay.statut === "non_paye" ? "non payé" : b.pay.moyen) : "inconnu";
    var mvCash = S.F().caisse.mv.filter(function (x) { return x.bkId === b.id && x.type === "encaissement"; });
    if (m === "non_paye") {
      if (mvCash.length && !confirm("Un encaissement cash de " + eur2(mvCash[0].montant) + " est lié à ce RDV dans ta caisse. Le retirer ?")) return;
      S.F().caisse.mv = S.F().caisse.mv.filter(function (x) { return mvCash.indexOf(x) === -1; });
      b.pay = { statut: "non_paye", date: todayStr() };
    } else {
      b.pay = { statut: "paye", moyen: m, montant: b.total || 0, date: todayStr() };
      if (m === "cash" && !mvCash.length) S.F().caisse.mv.push({ id: uid("mv"), type: "encaissement", montant: r2(b.total || 0), date: b.date <= todayStr() ? todayStr() : b.date, motif: "Paiement du RDV", bkId: b.id, cree: new Date().toISOString(), auto: true });
      if (m !== "cash" && mvCash.length) S.F().caisse.mv = S.F().caisse.mv.filter(function (x) { return mvCash.indexOf(x) === -1; });
    }
    var f = factureDe(b.id);
    if (f) {
      if (m === "non_paye") { if (f.statut === "brouillon") f.paye = 0; }
      else { f.paye = f.ttc || 0; f.moyen = MOYENS[m]; if (f.statut !== "brouillon") f.statut = "payee"; }
    }
    S.log("Paiement d'intervention", (b.client || "") + " · " + eur2(b.total || 0) + " · " + avant + " → " + (m === "non_paye" ? "non payé" : m));
    save(); renderAll();
    toast("ok", [m === "non_paye" ? "Noté : pas encore payé. Il apparaît dans les impayés du client." : "Payé " + MOYENS[m].toLowerCase() + " : " + eur2(b.total || 0) + (m === "cash" ? " — ajouté à ta caisse (pas du CA en plus)." : ".")]);
  }

  /* appelé quand un RDV passe « terminé » */
  function onTermine(b) {
    if (!C().set.autoBrouillon || factureDe(b.id) || !(b.total > 0)) return;
    cptData().ven.push(brouillonDepuis(b));
  }

  /* ========================= FACTURE EXPRESS ========================== */
  function recalc(v) {
    var tx = v.tvaTaux != null ? v.tvaTaux : S.tauxPresta();
    if (v.ttcCible != null && (v.lignes || []).length) {
      /* facture issue d'un RDV : le total TVAC est le prix convenu avec le client.
         On en déduit TVA et HTVA, et la dernière ligne absorbe l'arrondi. */
      v.ttc = r2(v.ttcCible); v.tvaMontant = r2(v.ttc * tx / (100 + tx)); v.ht = r2(v.ttc - v.tvaMontant);
      var autres = 0, L = v.lignes;
      L.forEach(function (l, i) { if (i < L.length - 1) autres += r2((Number(l.qte) || 0) * (Number(l.puHT) || 0)); });
      var der = L[L.length - 1], q = Number(der.qte) || 1;
      der.puHT = r2((v.ht - r2(autres)) / q);
      if (Math.abs(r2(autres + r2(q * der.puHT)) - v.ht) > 0.001) { v.ttcCible = null; return recalc(v); }
      if (v.payeTout) v.paye = v.ttc;
      return v;
    }
    var ht = 0;
    (v.lignes || []).forEach(function (l) { ht += r2((Number(l.qte) || 0) * (Number(l.puHT) || 0)); });
    v.ht = r2(ht); v.tvaMontant = r2(ht * tx / 100); v.ttc = r2(v.ht + v.tvaMontant);
    if (v.payeTout) v.paye = v.ttc;
    return v;
  }
  function brouillonDepuis(b) {
    var tx = S.tauxPresta();
    var pres = (b.prestations || []).filter(function (x) { return x && x.nom; });
    var somme = pres.reduce(function (s, x) { return s + (x.prix || 0); }, 0);
    var ok = pres.length && pres.every(function (x) { return x.prix != null; }) && Math.abs(somme - (b.total || 0)) < 0.01;
    var lignes = ok ? pres.map(function (x) { return { lib: x.nom, qte: 1, puHT: r2(x.prix / (1 + tx / 100)) }; })
      : [{ lib: pres.map(function (x) { return x.nom; }).join(" + ") || "Nettoyage textile à domicile", qte: 1, puHT: r2((b.total || 0) / (1 + tx / 100)) }];
    var paye = b.pay && b.pay.statut === "paye";
    var c = clientDeBk(b), o = c ? c.o : {};
    return recalc({
      id: uidVen(), statut: "brouillon", numero: "BROUILLON",
      client: o.societe || b.client || "", clientType: o.type || "particulier", clientTva: o.tva || "",
      clientAdresse: b.adresse || (c && c.adresse) || "", clientTel: b.telephone || "", clientEmail: (c && c.email) || "",
      date: todayStr(), datePrestation: b.date, echeance: paye ? todayStr() : addDaysStr(todayStr(), 14),
      tvaTaux: tx, lignes: lignes, ttcCible: r2(b.total || 0), payeTout: paye, paye: 0, moyen: paye ? MOYENS[b.pay.moyen] : "",
      note: "", creeLe: todayStr(), source: "StayClean · " + b.id
    });
  }
  var E = null; /* facture en cours d'édition */
  function factureExpress(bkId) {
    var b = findBk(bkId); if (!b) return;
    var f = factureDe(b.id);
    if (f && f.statut !== "brouillon") { S.ouvrirDoc(S.factureHtml(f)); return; }
    if (!f) {
      if (!(b.total > 0)) { toast("err", ["Indique d'abord le montant du RDV."]); return; }
      f = brouillonDepuis(b); cptData().ven.push(f); S.log("Brouillon de facture préparé", (b.client || "") + " · " + eur2(f.ttc)); save();
    }
    ouvrirEditeur(f.id);
  }
  function ouvrirEditeur(venId) { E = findVen(venId); if (!E) return; M = { k: "fac" }; draw(); }
  /* après une synchronisation, DB est remplacé : l'éditeur ouvert doit pointer
     vers la facture de la nouvelle copie (sinon la validation ne serait pas enregistrée) */
  function relier() {
    if (!E) return;
    var n = findVen(E.id);
    if (n) { if (n !== E && n.statut === "brouillon") { n.lignes = E.lignes; n.client = E.client; n.clientAdresse = E.clientAdresse; recalc(n); } E = n; }
    else if (E.statut === "brouillon") cptData().ven.push(E);
  }

  function editeurHtml(v) {
    var p = S.F().profil;
    var h = '<p class="note" style="margin:-4px 0 10px">Brouillon : tout est modifiable. Le numéro de facture est attribué à la validation — après, plus de modification (correction = note de crédit).</p>';
    h += '<div class="two"><div class="fld"><label>Client</label><input data-e="client" value="' + esc(v.client) + '"></div>' +
      '<div class="fld small"><label>Type</label><select data-e="clientType"><option value="particulier"' + (v.clientType !== "entreprise" ? " selected" : "") + '>Particulier</option><option value="entreprise"' + (v.clientType === "entreprise" ? " selected" : "") + ">Entreprise</option></select></div></div>";
    h += '<div class="fld"><label>Adresse du client</label><input data-e="clientAdresse" value="' + esc(v.clientAdresse) + '"' + (!v.clientAdresse ? ' class="warn"' : "") + "></div>";
    if (v.clientType === "entreprise") h += '<div class="fld"><label>N° TVA du client (obligatoire pour une entreprise)</label><input data-e="clientTva" value="' + esc(v.clientTva || "") + '" placeholder="BE0xxx.xxx.xxx"' + (!v.clientTva ? ' class="warn"' : "") + "></div>" +
      '<div class="anomalie" style="margin:0 0 10px">Client entreprise belge : depuis le 1/1/2026 la facture doit partir via Peppol. Ce PDF ne suffit pas tant qu\'aucun prestataire Peppol n\'est branché.</div>';
    h += '<div class="two"><div class="fld"><label>Date de facture</label><div style="padding:10px 0;font-size:13.5px;color:var(--gris)">Le jour de la validation (numéro suivant)</div></div><div class="fld"><label>Date de prestation</label><input type="date" data-e="datePrestation" value="' + (v.datePrestation || "") + '"></div></div>';
    h += '<p class="k" style="margin:10px 0 6px;font-size:12px;font-weight:800;color:var(--gris)">LIGNES (prix HTVA)</p>';
    (v.lignes || []).forEach(function (l, i) {
      h += '<div style="display:grid;grid-template-columns:1fr 52px 84px 30px;gap:6px;margin-bottom:6px;align-items:center">' +
        '<input data-l="' + i + '" data-lf="lib" value="' + esc(l.lib) + '" style="padding:9px;border:1px solid var(--bordure);border-radius:10px">' +
        '<input data-l="' + i + '" data-lf="qte" type="number" step="1" value="' + l.qte + '" style="padding:9px 4px;border:1px solid var(--bordure);border-radius:10px;text-align:center">' +
        '<input data-l="' + i + '" data-lf="puHT" type="number" step="0.01" inputmode="decimal" value="' + l.puHT + '" style="padding:9px 4px;border:1px solid var(--bordure);border-radius:10px;text-align:right">' +
        '<button data-scb="l-del" data-i="' + i + '" style="color:var(--rouge);font-weight:800">×</button></div>';
    });
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px">' +
      '<button class="linkline" style="margin:0" data-scb="l-add" data-t="ligne">+ ligne</button>' +
      '<button class="linkline" style="margin:0" data-scb="l-add" data-t="deplacement">+ déplacement</button>' +
      '<button class="linkline" style="margin:0" data-scb="l-add" data-t="remise">+ remise</button></div>';
    h += '<div id="scb-tot"></div>';
    h += '<div class="two"><div class="fld"><label>Moyen de paiement</label><select data-e="moyen"><option value="">Pas encore payé</option>' +
      ["Cash", "Carte", "Virement", "Payconiq"].map(function (m) { return "<option" + (v.moyen === m ? " selected" : "") + ">" + m + "</option>"; }).join("") + "</select></div>" +
      '<div class="fld"><label>Déjà payé (€ TVAC)</label><input type="number" step="0.01" inputmode="decimal" data-e="paye" value="' + (v.paye || 0) + '"></div></div>' +
      '<div class="fld"><label>Échéance</label><input type="date" data-e="echeance" value="' + (v.echeance || "") + '"></div>';
    h += '<div class="fld"><label>Note sur la facture (facultatif)</label><input data-e="note" value="' + esc(v.note || "") + '"></div>';
    var manq = [];
    if (!p.tva) manq.push("ton n° TVA"); if (!p.adresse) manq.push("ton adresse"); if (!p.nom) manq.push("ton nom"); if (!p.bce) manq.push("ton n° d'entreprise");
    if (manq.length) h += '<div class="anomalie">Pour valider, complète d\'abord ' + manq.join(", ") + ' dans Compta → Profil (mentions obligatoires). Le brouillon reste enregistré.</div>';
    h += '<div class="sitgrid" style="grid-template-columns:1fr 1fr">' +
      '<button class="btn-main" style="margin:6px 0 0;background:#fff;color:var(--nuit);box-shadow:none;border:1.5px solid var(--bordure)" data-scb="fac-apercu">Aperçu</button>' +
      '<button class="btn-main" style="margin:6px 0 0;background:#fff;color:var(--nuit);box-shadow:none;border:1.5px solid var(--bordure)" data-scb="fac-save">Garder en brouillon</button></div>' +
      '<button class="btn-main" style="background:#059669" data-scb="fac-valider"' + (manq.length ? ' disabled style="opacity:.5;background:#059669"' : "") + ">✓ Valider et générer le PDF</button>" +
      '<button class="linkline" style="color:var(--rouge)" data-scb="fac-suppr">Supprimer ce brouillon</button>';
    return h;
  }
  function totHtml(v) {
    return '<div class="card sec" style="padding:10px 12px;margin-bottom:10px"><div class="tvaline" style="border:0;padding:4px 0"><span>Total HTVA</span><b class="tnum">' + eur2(v.ht) + '</b></div>' +
      '<div class="tvaline" style="padding:4px 0"><span>TVA ' + v.tvaTaux + ' %</span><b class="tnum">' + eur2(v.tvaMontant) + '</b></div>' +
      '<div class="tvaline" style="padding:4px 0"><span><b>Total TVAC</b></span><b class="tnum" style="font-size:18px">' + eur2(v.ttc) + "</b></div>" +
      ((v.paye || 0) > 0 && (v.paye || 0) < v.ttc - 0.009 ? '<div class="tvaline" style="padding:4px 0;color:var(--rouge)"><span>Reste à payer par le client</span><b class="tnum">' + eur2(v.ttc - v.paye) + "</b></div>" : "") + "</div>";
  }
  function dLocB(ts) { var d = new Date(ts); return isNaN(d) ? "" : fmtDate(d); }
  function valider(v) {
    var p = S.F().profil;
    if (!p.tva || !p.adresse || !p.nom || !p.bce) { toast("err", ["Complète ton profil (Compta → Profil) avant de valider."]); return; }
    if (!v.client || !v.clientAdresse) { toast("err", ["Nom et adresse du client obligatoires sur une facture."]); return; }
    if (v.clientType === "entreprise" && !v.clientTva) { toast("err", ["N° TVA du client entreprise obligatoire."]); return; }
    if (!(v.lignes || []).length || !v.ttc) { toast("err", ["La facture est vide."]); return; }
    if (v.clientType === "entreprise" && !confirm("Client entreprise : la loi impose l'envoi via Peppol depuis le 1/1/2026 et ce n'est pas encore branché. Valider quand même le document ?")) return;
    /* date d'émission = jour de la validation (numérotation chronologique).
       Garde-fou : une facture déjà émise plus tard que « aujourd'hui » signale une horloge fausse. */
    var jour = todayStr();
    var derniere = cptData().ven.filter(function (x) { return x !== v && x.statut !== "brouillon" && x.type !== "nc" && x.valideeLe && /^\d{4}-\d+$/.test(x.numero || ""); })
      .map(function (x) { return dLocB(x.valideeLe); }).sort().pop() || "";
    if (derniere && jour < derniere) { toast("err", ["La date de ton appareil (" + jour + ") est antérieure à la dernière facture validée (" + derniere + ") : vérifie l'heure du téléphone."]); return; }
    v.date = jour;
    recalc(v);
    v.numero = S.nextNumero(false, v.date);
    v.statut = (v.paye || 0) >= v.ttc ? "payee" : "envoyee";
    v.valideeLe = new Date().toISOString();
    delete v.payeTout;
    S.log("Facture validée", v.numero + " · " + v.client + " · " + eur2(v.ttc));
    save(); M = null; E = null; draw(); renderAll();
    S.ouvrirDoc(S.factureHtml(v));
    toast("ok", ["Facture " + v.numero + " validée — PDF prêt (Imprimer / PDF)."]);
  }


  /* =================== REVENUS & CHARGES AUTOMATIQUES ==================== */
  /* Charges habituelles de Mohamed (modifiables) : estimations, remplacées par
     le réel dès que les dépenses saisies dépassent l'estimation. */
  function CH() {
    var s = cptData().set;
    if (!s.chargesAuto) s.chargesAuto = { essenceMin: 200, essenceMax: 320, produits: 100, pubJourMin: 20, pubJourMax: 25, autoTerminer: true };
    return s.chargesAuto;
  }
  /* Un RDV dont l'heure de fin est passée et qui n'a été ni annulé ni terminé
     est considéré comme réalisé (option). Il reste modifiable : « Rouvrir »
     ou « Annuler le RDV » s'il n'a pas eu lieu. */
  function autoTerminer() {
    if (!CH().autoTerminer) return 0;
    /* jamais avant d'avoir relu le cloud : sinon un appareil resté hors ligne
       modifiait sa vieille copie et la renvoyait par-dessus les données à jour */
    if (window.scSyncPret === false) return 0;
    var td = todayStr(), now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), n = 0;
    DB.bookings.forEach(function (b) {
      if (b.statut === "termine" || b.statut === "annule" || b.noAuto || !(b.total > 0) || !b.date) return;
      var fin = toMin(b.heure || "09:00") + (b.durationMin || 120);
      if (b.date < td || (b.date === td && fin <= nowMin)) { b.statut = "termine"; b.autoTermine = true; n++; }
    });
    if (n) { S.log("RDV passés comptés automatiquement comme réalisés", n + " RDV"); save(); }
    return n;
  }
  function joursEntre(a, b) { return Math.round((parseDateStr(b) - parseDateStr(a)) / 864e5) + 1; }
  /* RDV dont la facture a été annulée par une note de crédit */
  function bkCreditees() {
    var m = {};
    cptData().ven.forEach(function (v) { if (v.creditee) { var i = (v.source || "").indexOf("bk_"); if (i !== -1) m[v.source.slice(i)] = true; } });
    return m;
  }
  function bilan(deb, fin) {
    /* calcul pur : ne modifie plus les données (autoTerminer tourne sur son minuteur) */
    var ch = CH(), td = todayStr(), tx = S.tauxPresta();
    var finEcoule = fin < td ? fin : td;
    var nbJ = finEcoule >= deb ? joursEntre(deb, finEcoule) : 0, nbTot = joursEntre(deb, fin);
    var parJourMois = 12 / 365;
    var real = 0, aVenir = 0, nbR = 0, nbV = 0, cred = bkCreditees();
    DB.bookings.forEach(function (b) {
      if (b.statut === "annule" || !b.date || b.date < deb || b.date > fin) return;
      if (cred[b.id]) return; /* facture annulée par note de crédit : pas de revenu */
      if (b.statut === "termine") { real += b.total || 0; nbR++; } else { aVenir += b.total || 0; nbV++; }
    });
    var reel = { essence: 0, produits: 0, pub: 0, autres: 0 }, nbDep = 0;
    cptData().dep.forEach(function (d) {
      if (!d.date || d.date < deb || d.date > fin || d.nature === "perso" || d.categorie === "cotisations") return;
      var m = (d.ttc || 0) * (d.nature === "mixte" && d.pctPro != null ? d.pctPro / 100 : 1);
      var k = d.categorie === "carburant" ? "essence" : d.categorie === "produits" ? "produits" : d.categorie === "publicite" ? "pub" : "autres";
      reel[k] += m; nbDep++;
    });
    function est(min, max, parJour) { return { min: r2(min * parJour * nbJ), max: r2(max * parJour * nbJ), minT: r2(min * parJour * nbTot), maxT: r2(max * parJour * nbTot) }; }
    var E = { essence: est(ch.essenceMin, ch.essenceMax, parJourMois), produits: est(ch.produits, ch.produits, parJourMois), pub: est(ch.pubJourMin, ch.pubJourMax, 1) };
    var lignes = ["essence", "produits", "pub"].map(function (k) {
      var e = E[k], mid = r2((e.min + e.max) / 2), rr = r2(reel[k]);
      return { k: k, reel: rr, estMin: e.min, estMax: e.max, retenu: Math.max(rr, mid), retMin: Math.max(rr, e.min), retMax: Math.max(rr, e.max), midT: r2((e.minT + e.maxT) / 2), source: rr >= mid && rr > 0 ? "réel" : "estimé" };
    });
    var autres = r2(reel.autres);
    var charges = r2(lignes.reduce(function (s2, l) { return s2 + l.retenu; }, 0) + autres);
    var chargesMin = r2(lignes.reduce(function (s2, l) { return s2 + l.retMin; }, 0) + autres);
    var chargesMax = r2(lignes.reduce(function (s2, l) { return s2 + l.retMax; }, 0) + autres);
    var caHT = r2(real / (1 + tx / 100));
    var projCaHT = r2((real + aVenir) / (1 + tx / 100));
    var chargesTot = r2(lignes.reduce(function (s2, l) { return s2 + Math.max(l.reel, l.midT); }, 0) + autres);
    return { deb: deb, fin: fin, nbJ: nbJ, nbTot: nbTot, caTTC: r2(real), tva: r2(real - caHT), caHT: caHT, nbR: nbR, aVenir: r2(aVenir), nbV: nbV,
      lignes: lignes, autres: autres, charges: charges, benef: r2(caHT - charges), benefMin: r2(caHT - chargesMax), benefMax: r2(caHT - chargesMin),
      projBenef: r2(projCaHT - chargesTot), projCaTTC: r2(real + aVenir), enCours: fin >= td && deb <= td, nbDep: nbDep };
  }
  var LIB = { essence: "⛽ Essence", produits: "🧴 Produits", pub: "📣 Publicité (Google, Meta…)" };
  function beneficeHtml(deb, fin, label) {
    var B = bilan(deb, fin), ch = CH();
    if (B.nbJ === 0) return "";
    var h = '<section class="card sec" style="border:2px solid ' + (B.benef >= 0 ? "#059669" : "var(--rouge)") + '"><p class="k">💶 Mon bénéfice — ' + esc(label) + ' <span class="estbadge">calcul auto</span></p>' +
      '<div class="tvaline"><span>Revenus réalisés (TVAC)<br><small style="color:var(--gris)">' + B.nbR + " intervention" + (B.nbR > 1 ? "s" : "") + " réalisée" + (B.nbR > 1 ? "s" : "") + "</small></span><b class=\"tnum\">" + eur2(B.caTTC) + "</b></div>" +
      '<div class="tvaline"><span>− TVA incluse (à reverser à l\'État)</span><b class="tnum">−' + eur2(B.tva) + "</b></div>" +
      '<div class="tvaline"><span><b>Chiffre d\'affaires HTVA</b></span><b class="tnum">' + eur2(B.caHT) + "</b></div>";
    B.lignes.forEach(function (l) {
      h += '<div class="tvaline"><span>− ' + LIB[l.k] + '<br><small style="color:var(--gris)">' + (l.source === "réel" ? "réel saisi : " + eur2(l.reel) : "estimé sur " + B.nbJ + " j (" + (l.estMin === l.estMax ? eur2(l.estMin) : eur2(l.estMin) + " à " + eur2(l.estMax)) + ")" + (l.reel ? " · réel saisi " + eur2(l.reel) : "")) + '</small></span><b class="tnum">−' + eur2(l.retenu) + "</b></div>";
    });
    if (B.autres) h += '<div class="tvaline"><span>− Autres dépenses pro saisies</span><b class="tnum">−' + eur2(B.autres) + "</b></div>";
    h += '<div class="tvaline" style="border-top:2px solid var(--bordure)"><span><b>Bénéfice estimé</b><br><small style="color:var(--gris)">fourchette ' + eur2(B.benefMin) + " à " + eur2(B.benefMax) + '</small></span><b class="tnum" style="font-size:21px;color:' + (B.benef >= 0 ? "#047857" : "var(--rouge)") + '">' + eur2(B.benef) + "</b></div>";
    if (B.enCours && B.nbV) h += '<p class="note" style="margin:8px 0 0">📈 Avec les ' + B.nbV + " RDV encore prévus (" + eur2(B.aVenir) + "), fin de période estimée : CA " + eur2(B.projCaTTC) + " TVAC · bénéfice ≈ <b>" + eur2(B.projBenef) + "</b>.</p>";
    h += '<p class="note" style="margin:6px 0 0">Avant cotisations sociales et impôt (voir Compta → À payer). Ce n\'est pas un salaire.</p>';
    h += '<details class="scf-regle"><summary>Comment c\'est calculé ? · mes charges habituelles</summary>' +
      "<p>Revenus = RDV de la période marqués terminés" + (ch.autoTerminer ? " (un RDV passé et non annulé est compté automatiquement — si le client n'est pas venu, annule le RDV)" : "") + ". Charges : pour chaque poste, l'app prend le plus élevé entre ce que tu as réellement saisi dans Compta → Dépenses et ton estimation habituelle au prorata des jours écoulés. Les montants de charges sont ceux payés (TVAC) : c'est prudent, une partie de la TVA pourra être récupérée.</p>" +
      '<div class="two"><div class="fld"><label>Essence / mois min (€)</label><input id="scb-ch-essenceMin" type="number" value="' + ch.essenceMin + '"></div><div class="fld"><label>Essence / mois max (€)</label><input id="scb-ch-essenceMax" type="number" value="' + ch.essenceMax + '"></div></div>' +
      '<div class="two"><div class="fld"><label>Publicité / jour min (€)</label><input id="scb-ch-pubJourMin" type="number" value="' + ch.pubJourMin + '"></div><div class="fld"><label>Publicité / jour max (€)</label><input id="scb-ch-pubJourMax" type="number" value="' + ch.pubJourMax + '"></div></div>' +
      '<div class="fld"><label>Produits / mois (€)</label><input id="scb-ch-produits" type="number" value="' + ch.produits + '"></div>' +
      '<label style="display:flex;gap:8px;font-size:13px;margin:6px 0"><input type="checkbox" id="scb-ch-auto" style="width:auto"' + (ch.autoTerminer ? " checked" : "") + "> Compter automatiquement les RDV passés comme réalisés</label>" +
      '<button class="btn-main" style="margin-top:6px" data-scb="chg-save">Enregistrer mes charges</button></details></section>';
    return h;
  }
  /* bandeau du Planning : revenus du jour, du mois, bénéfice estimé */
  function stripHtml() {
    var td = todayStr(), mk = td.slice(0, 7);
    var fm = mk + "-" + pad(new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate());
    var J = bilan(td, td), Mo = bilan(mk + "-01", fm);
    return '<button data-act="tab" data-tab="revenus" style="display:flex;width:100%;justify-content:space-between;gap:8px;align-items:center;margin:0 0 10px;padding:11px 14px;border-radius:16px;background:#fff;border:1px solid var(--bordure);font-size:12.5px;text-align:left">' +
      '<span>Aujourd\'hui<br><b class="tnum" style="font-size:16px">' + euro(J.caTTC) + "</b>" + (J.aVenir > 0 ? '<br><small style="color:var(--gris)">+ ' + euro(J.aVenir) + " prévus</small>" : "") + "</span>" +
      "<span>" + MOIS_FULL[+mk.slice(5, 7) - 1] + '<br><b class="tnum" style="font-size:16px">' + euro(Mo.caTTC) + "</b>" + (Mo.aVenir > 0 ? '<br><small style="color:var(--gris)">+ ' + euro(Mo.aVenir) + " prévus</small>" : "") + "</span>" +
      '<span>Bénéfice estimé<br><b class="tnum" style="font-size:16px;color:' + (Mo.benef >= 0 ? "#047857" : "var(--rouge)") + '">' + euro(Mo.benef) + "</b></span>" +
      '<span style="color:var(--bleu);font-weight:800">›</span></button>';
  }

  /* =========================== À PAYER ================================ */
  var TYPES_OB = {
    VAT: "TVA", SOCIAL_CONTRIBUTION: "Cotisations sociales", INCOME_TAX: "Impôt", ADVANCE_TAX_PAYMENT: "Versement anticipé",
    SUPPLIER: "Fournisseur", SUBSCRIPTION: "Abonnement", FINE: "Amende / majoration", INSURANCE: "Assurance", BANK_FEE: "Frais bancaires", OTHER: "Autre"
  };
  var ETAT = { VAT: 1, SOCIAL_CONTRIBUTION: 1, INCOME_TAX: 1, ADVANCE_TAX_PAYMENT: 1, FINE: 1 };
  function trimInfo(dateStr) {
    var y = +dateStr.slice(0, 4), t = Math.floor((+dateStr.slice(5, 7) - 1) / 3) + 1;
    var finMois = t * 3, fin = y + "-" + pad(finMois) + "-" + pad(new Date(y, finMois, 0).getDate());
    var ech = finMois === 12 ? (y + 1) + "-01-25" : y + "-" + pad(finMois + 1) + "-25";
    return { y: y, t: t, label: "T" + t + " " + y, fin: fin, echTva: ech };
  }
  function trimPrec(ti) { return ti.t === 1 ? trimInfo((ti.y - 1) + "-12-01") : trimInfo(ti.y + "-" + pad((ti.t - 2) * 3 + 1) + "-01"); }

  function obligations() {
    var out = [], p = S.F().profil, td = todayStr();
    C().oblig.forEach(function (o) { out.push(Object.assign({ src: "manuel" }, o)); });
    function officielPour(type, periode) { return C().oblig.filter(function (o) { return o.type === type && o.officiel && o.periode === periode; })[0]; }
    facturesUnpaid().forEach(function (f) {
      out.push({ id: "fac_" + f.id, src: "fournisseur", ref: f.id, type: "SUPPLIER", creancier: f.fournisseur || "Fournisseur", montant: f.montantTTC, officiel: true, echeance: f.echeance || null, statut: "a_payer", iban: f.iban, communication: f.reference, notes: f.numero ? "Facture n° " + f.numero : "" });
    });
    cptData().dep.forEach(function (d) {
      if (d.statut === "paye" || d.nature === "perso") return; /* une dépense privée n'est pas une dette de l'entreprise */
      out.push({ id: "dep_" + d.id, src: "depense", ref: d.id, type: "SUPPLIER", creancier: d.fournisseur || "Dépense", montant: d.ttc, officiel: true, echeance: d.echeance || null, statut: "a_payer", iban: d.iban, communication: d.ref, notes: "Dépense scannée pas encore marquée payée" });
    });
    /* TVA : estimation seulement tant qu'aucun montant officiel n'est saisi */
    if (p.regimeTva !== "franchise") {
      var ti = trimInfo(td), tp = trimPrec(ti);
      [tp, ti].forEach(function (q, idx) {
        if (idx === 0 && td > q.echTva) return;
        var off = officielPour("VAT", q.label);
        if (off) return;
        var tv = cptTvaTrim(q.y, q.t);
        out.push({ id: "est_tva_" + q.label, src: "estimation", type: "VAT", creancier: "SPF Finances (TVA)", montant: r2(Math.max(0, tv.solde)), officiel: false, periode: q.label, echeance: q.echTva, statut: "a_payer",
          explication: "TVA collectée " + eur2(tv.col + tv.colResa) + " − TVA déductible " + eur2(tv.ded) + " = " + eur2(tv.solde) + " (" + q.label + "). Échéance trimestrielle le 25 du mois suivant (source secondaire, à vérifier" + (p.periodiciteTva === "mensuelle" ? " — tu as indiqué des déclarations mensuelles : ce calcul trimestriel est à adapter" : "") + ")." });
      });
    }
    /* Cotisations sociales : le décompte Xerius fait foi */
    var tq = trimInfo(td);
    if (!officielPour("SOCIAL_CONTRIBUTION", tq.label)) {
      var principal = p.statutIndep !== "complementaire";
      out.push({ id: "est_cot_" + tq.label, src: "estimation", type: "SOCIAL_CONTRIBUTION", creancier: p.caisseSociale || "Caisse d'assurances sociales", montant: principal ? 890.42 : null, officiel: false, periode: tq.label, echeance: tq.fin, statut: "a_payer",
        explication: principal ? "Hypothèse : cotisation provisoire minimale 2026 d'un indépendant à titre principal (890,42 € hors frais de gestion de la caisse, source secondaire UCM/Partena). Ton vrai montant est sur ton décompte Xerius : saisis-le pour remplacer cette estimation. Échéance supposée : fin du trimestre (à vérifier sur le décompte)." : "Je n'ai pas cette information : le minimum dépend de ta situation en complémentaire. Saisis ton décompte Xerius." });
    }
    return out;
  }
  function groupe(o) {
    if (o.statut === "paye") return "paye";
    if (!o.echeance) return "sans";
    var j = jours(o.echeance), td = todayStr();
    if (j < 0) return "retard"; if (j === 0) return "auj"; if (j <= 7) return "semaine";
    if (o.echeance.slice(0, 7) === td.slice(0, 7)) return "mois";
    if (o.echeance <= trimInfo(td).fin) return "trimestre";
    return "plustard";
  }
  var GROUPES = [["retard", "⚫ En retard"], ["auj", "Aujourd'hui"], ["semaine", "Cette semaine"], ["mois", "Ce mois"], ["trimestre", "Ce trimestre"], ["plustard", "Plus tard"], ["sans", "Sans échéance"]];
  function badge(off) { return off ? '<span class="estbadge" style="background:#ecfdf5;color:#047857">OFFICIEL</span>' : '<span class="estbadge">ESTIMÉ</span>'; }

  function obRow(o) {
    var j = o.echeance ? jours(o.echeance) : null;
    var alerte = j != null && o.statut !== "paye" && [30, 14, 7, 3, 0].some(function (x) { return j <= x; }) ? (j < 0 ? "dépassée de " + (-j) + " j" : j === 0 ? "aujourd'hui" : "dans " + j + " j") : (o.echeance ? "le " + dfr(o.echeance) : "");
    var h = '<div class="tvaline" style="align-items:flex-start;gap:8px"><span style="flex:1"><b>' + esc(TYPES_OB[o.type] || o.type) + "</b> " + badge(o.officiel) + "<br><small style=\"color:var(--gris)\">" + esc(o.creancier || "") + (o.periode ? " · " + esc(o.periode) : "") + (alerte ? " · échéance " + alerte : "") + (o.notes ? " · " + esc(o.notes) : "") + "</small>";
    if (o.explication) h += '<details class="scf-regle" style="margin-top:4px"><summary>Comment ce montant est calculé ?</summary><p>' + esc(o.explication) + "</p></details>";
    if (o.estimAvant != null) h += '<br><small style="color:var(--gris)">Estimation avant document : ' + eur2(o.estimAvant) + "</small>";
    h += '<br><span style="display:inline-flex;gap:10px;margin-top:4px;flex-wrap:wrap">';
    if (o.statut !== "paye") {
      if (o.src === "manuel") h += '<button class="scf-ops" data-scb="ob-payer" data-id="' + o.id + '">Marquer payé</button>';
      if (o.src === "fournisseur") h += '<button class="scf-ops" data-act="fac-open" data-id="' + o.ref + '">Ouvrir / payer</button>';
      if (o.src === "depense") h += '<button class="scf-ops" data-act="dep-pay" data-id="' + o.ref + '">Marquer payée</button>';
      if (o.src === "estimation") h += '<button class="scf-ops" data-scb="ob-new" data-t="' + o.type + '" data-p="' + esc(o.periode || "") + '" data-est="' + (o.montant != null ? o.montant : "") + '">Saisir le montant officiel</button>';
      if (o.iban || o.communication) h += '<button class="scf-ops" data-scb="ob-copier" data-id="' + o.id + '">Copier les infos de paiement</button>';
    } else if (o.payeLe) h += '<small style="color:#047857">Payé le ' + dfr(o.payeLe) + (o.preuve ? " · " + esc(o.preuve) : "") + "</small>";
    if (o.src === "manuel") h += '<button class="scf-ops" style="color:var(--gris)" data-scb="ob-suppr" data-id="' + o.id + '">supprimer</button>';
    h += "</span></span>" + '<b class="tnum" style="white-space:nowrap">' + (o.montant != null ? eur2(o.montant) : "montant ?") + "</b></div>";
    return h;
  }

  function renderAPayer() {
    var st = cptData().set, td = todayStr(), mk = td.slice(0, 7);
    var obs = obligations();
    var h = '<div class="tdy-head"><h2>À payer & à faire</h2><span class="n">' + dfr(td) + "</span></div>";

    /* --- aujourd'hui --- */
    var faitsJ = DB.bookings.filter(function (b) { return b.date === td && b.statut === "termine"; });
    var venduHT = r2(faitsJ.reduce(function (s, b) { return s + (b.total || 0); }, 0) / (1 + S.tauxPresta() / 100));
    var encJ = r2(DB.bookings.reduce(function (s, b) { return s + (b.pay && b.pay.statut === "paye" && b.pay.date === td ? (b.pay.montant || 0) : 0); }, 0));
    var cashJ = r2(S.F().caisse.mv.reduce(function (s, m) { return s + (m.type === "encaissement" && m.date === td ? m.montant : 0); }, 0));
    var depJ = r2(cptData().dep.reduce(function (s, d) { return s + (d.date === td ? d.ttc || 0 : 0); }, 0));
    h += '<div class="sitgrid">' +
      '<div class="card sit"><p class="k">Aujourd\'hui</p><p class="v tnum">' + faitsJ.length + ' <small style="font-size:12px">prestation' + (faitsJ.length > 1 ? "s" : "") + "</small></p></div>" +
      '<div class="card sit"><p class="k">Vendu HTVA</p><p class="v tnum">' + eur2(venduHT) + "</p></div>" +
      '<div class="card sit pos"><p class="k">Encaissé TVAC</p><p class="v tnum">' + eur2(encJ) + '</p></div>' +
      '<div class="card sit"><p class="k">Cash · dépenses</p><p class="v tnum" style="font-size:15px">' + eur2(cashJ) + " · " + eur2(depJ) + "</p></div></div>";

    /* --- dettes publiques : officiel vs estimé --- */
    var ouverts = obs.filter(function (o) { return o.statut !== "paye"; });
    function somme(f) { return r2(ouverts.filter(f).reduce(function (s, o) { return s + (o.montant || 0); }, 0)); }
    var offEtat = somme(function (o) { return o.officiel && ETAT[o.type]; });
    var estEtat = somme(function (o) { return !o.officiel && ETAT[o.type]; });
    var res = cptReserves();
    var impotEst = r2(res.impot);
    h += '<section class="card sec" style="margin-top:12px"><p class="k">Ce que je dois à l\'État</p><div class="sitgrid" style="margin-top:6px">' +
      '<div style="border:1.5px solid #059669;border-radius:14px;padding:10px"><p class="k" style="color:#047857;margin:0">OFFICIEL À PAYER</p><p class="tnum" style="font-size:20px;font-weight:800;margin:4px 0">' + eur2(offEtat) + '</p><small style="color:var(--gris)">montants de documents reçus et saisis</small></div>' +
      '<div style="border:1.5px dashed #d97706;border-radius:14px;padding:10px"><p class="k" style="color:#b45309;margin:0">ESTIMÉ À RÉSERVER</p><p class="tnum" style="font-size:20px;font-weight:800;margin:4px 0">' + eur2(estEtat + impotEst) + '</p><small style="color:var(--gris)">TVA + cotisations estimées + impôt ' + eur2(impotEst) + "</small></div></div>" +
      '<details class="scf-regle"><summary>Comment c\'est calculé ?</summary><p>Officiel = obligations TVA, cotisations, impôt, versements anticipés et amendes que tu as saisies depuis un document réel. Estimé = TVA du trimestre calculée depuis tes ventes et dépenses, cotisation minimale 2026 tant que ton décompte Xerius n\'est pas saisi, et provision impôt du mois selon ton paramètre (' + (st.impot || 0) + " % du bénéfice, dans Situation) — ce n'est pas un calcul de l'impôt belge. Les deux totaux ne sont jamais additionnés.</p></details></section>";

    /* --- disponible estimatif --- */
    var caisse = S.soldeCaisse();
    var offTous = somme(function (o) { return o.officiel; });
    if (st.solde == null) {
      h += '<div class="anomalie" style="margin-top:12px">Je n\'ai pas encore ton solde bancaire : je ne peux pas calculer ce que tu peux prendre pour toi. Saisis-le dans <button class="linkline" style="display:inline;margin:0" data-act="tab" data-tab="situation">Situation</button> (en attendant la connexion Revolut).</div>';
    } else {
      var dispo = r2(st.solde + caisse - offTous - estEtat - impotEst - (st.marge || 0));
      var etat = st.solde + caisse >= offTous + estEtat + impotEst + (st.marge || 0) ? ["PROVISIONS SUFFISANTES", "#047857"] : st.solde + caisse >= offTous ? ["À SURVEILLER", "#b45309"] : ["PROVISIONS POTENTIELLEMENT INSUFFISANTES", "#dc2626"];
      h += '<section class="card sec" style="margin-top:12px;border:2px solid ' + etat[1] + '"><p class="k">Disponible estimatif après provisions <span class="estbadge">estimation</span></p>' +
        '<div class="tvaline"><span>Banque (saisi le ' + dfr(st.soldeDate) + ")</span><b class=\"tnum\">" + eur2(st.solde) + "</b></div>" +
        '<div class="tvaline"><span>+ Caisse espèces</span><b class="tnum">' + eur2(caisse) + "</b></div>" +
        '<div class="tvaline"><span>− Obligations officielles non payées</span><b class="tnum">−' + eur2(offTous) + "</b></div>" +
        '<div class="tvaline"><span>− TVA et cotisations estimées</span><b class="tnum">−' + eur2(estEtat) + "</b></div>" +
        '<div class="tvaline"><span>− Impôt estimé (provision)</span><b class="tnum">−' + eur2(impotEst) + "</b></div>" +
        '<div class="tvaline"><span>− Réserve minimum</span><b class="tnum">−' + eur2(st.marge || 0) + "</b></div>" +
        '<div class="tvaline" style="border-top:2px solid var(--bordure)"><span><b>Potentiellement disponible</b></span><b class="tnum" style="font-size:20px;color:' + (dispo >= 0 ? "#047857" : "var(--rouge)") + '">' + eur2(dispo) + "</b></div>" +
        '<p class="note" style="margin:6px 0 0">Risque de mauvaise surprise fiscale : <b style="color:' + etat[1] + '">' + etat[0] + "</b>. Ce n'est pas un salaire : c'est ce qui resterait après avoir mis de côté ce que tu dois et devras probablement payer.</p></section>";
    }

    /* --- à faire --- */
    var todo = [];
    var nonPayes = DB.bookings.filter(function (b) { return b.statut === "termine" && b.pay && b.pay.statut === "non_paye"; });
    var sansPay = DB.bookings.filter(function (b) { return b.statut === "termine" && !b.pay && b.date >= addDaysStr(td, -30); });
    var brouillons = cptData().ven.filter(function (v) { return v.statut === "brouillon"; });
    var sansJustif = cptData().dep.filter(function (d) { return (d.date || "").slice(0, 7) === mk && (d.nature === "pro" || d.nature === "mixte") && !d.img; });
    var cashLibre = S.F().caisse.mv.filter(function (m) { return m.type === "encaissement" && !m.bkId && !m.venId; });
    var bientot = ouverts.filter(function (o) { return o.echeance && jours(o.echeance) <= 7; });
    if (bientot.length) todo.push(bientot.length + " paiement" + (bientot.length > 1 ? "s" : "") + " à faire dans les 7 jours (voir ci-dessous)");
    if (nonPayes.length) todo.push(nonPayes.length + " intervention" + (nonPayes.length > 1 ? "s" : "") + " terminée" + (nonPayes.length > 1 ? "s" : "") + " non payée" + (nonPayes.length > 1 ? "s" : "") + " : " + nonPayes.map(function (b) { return esc(b.client) + " " + eur2(b.total); }).join(", "));
    if (sansPay.length) todo.push(sansPay.length + " intervention" + (sansPay.length > 1 ? "s" : "") + " terminée" + (sansPay.length > 1 ? "s" : "") + " sans moyen de paiement indiqué (ouvre le RDV → Cash / Carte / …)");
    if (brouillons.length) todo.push(brouillons.length + " facture" + (brouillons.length > 1 ? "s" : "") + " en brouillon à valider ou supprimer (Ventes)");
    if (sansJustif.length) todo.push(sansJustif.length + " dépense" + (sansJustif.length > 1 ? "s" : "") + " pro de ce mois sans justificatif");
    if (cashLibre.length) todo.push(cashLibre.length + " encaissement" + (cashLibre.length > 1 ? "s" : "") + " cash sans vente associée (Caisse)");
    var manqP = ["nom", "bce", "tva", "adresse"].filter(function (k) { return !S.F().profil[k]; });
    if (manqP.length) todo.push("Profil fiscal incomplet : factures et attestations bloquées (Profil)");
    h += '<section class="card tsec" style="margin-top:12px"><p class="k">À faire <span class="cnt">' + todo.length + "</span></p>" + (todo.length ? todo.map(function (t, i) { return '<div class="tvaline"><span>' + (i + 1) + ". " + t + "</span></div>"; }).join("") : '<p class="emptyline">Rien d\'urgent 👌</p>') + "</section>";

    /* --- échéancier --- */
    h += '<div style="display:flex;gap:8px;margin-top:14px"><button class="cptscan" style="margin:0;flex:1" data-scb="ob-new">+ Obligation</button><button class="cptscan" style="margin:0;flex:1;background:linear-gradient(135deg,#1d4ed8,#60a5fa)" data-scb="ob-new" data-t="SOCIAL_CONTRIBUTION" data-off="1">Décompte Xerius</button></div>';
    GROUPES.forEach(function (g) {
      var lst = obs.filter(function (o) { return groupe(o) === g[0]; }).sort(function (a, b) { return (a.echeance || "9") < (b.echeance || "9") ? -1 : 1; });
      if (!lst.length) return;
      var tOff = r2(lst.filter(function (o) { return o.officiel; }).reduce(function (s, o) { return s + (o.montant || 0); }, 0));
      var tEst = r2(lst.filter(function (o) { return !o.officiel; }).reduce(function (s, o) { return s + (o.montant || 0); }, 0));
      h += '<section class="card tsec' + (g[0] === "retard" ? " late" : "") + '" style="margin-top:12px"><p class="k">' + g[1] + ' <span class="cnt">' + lst.length + '</span><span style="float:right;font-size:11px;font-weight:700">' + (tOff ? "officiel " + eur2(tOff) : "") + (tOff && tEst ? " · " : "") + (tEst ? "estimé " + eur2(tEst) : "") + "</span></p>";
      lst.forEach(function (o) { h += obRow(o); });
      h += "</section>";
    });
    var payes = obs.filter(function (o) { return o.statut === "paye"; }).slice(-5).reverse();
    if (payes.length) { h += '<section class="card tsec" style="margin-top:12px;opacity:.8"><p class="k">Payé récemment</p>'; payes.forEach(function (o) { h += obRow(o); }); h += "</section>"; }
    h += '<div class="disclaim">Les rappels apparaissent 30, 14, 7, 3 jours avant et le jour même. Rien n\'est payé automatiquement : l\'app ne touche pas à ton compte. « Payé » ne s\'affiche que quand tu le confirmes (et plus tard, avec la transaction Revolut rapprochée).</div>';
    return h;
  }

  /* ========================= CLIENTS : RENDU ========================== */
  var Q = "", M = null;
  function renderClients() {
    var all = clients().sort(function (a, b) { return a.derniereActivite < b.derniereActivite ? 1 : -1; });
    var ca = r2(all.reduce(function (s, c) { return s + c.caTTC; }, 0)), imp = r2(all.reduce(function (s, c) { return s + c.impaye; }, 0));
    var h = '<div class="tdy-head"><h2>Clients</h2><span class="n">' + all.length + " clients</span></div>";
    h += '<div class="sitgrid" style="margin-top:0"><div class="card sit"><p class="k">CA total (TVAC)</p><p class="v tnum">' + eur2(ca) + '</p></div><div class="card sit ' + (imp ? "neg" : "") + '"><p class="k">Impayés</p><p class="v tnum">' + eur2(imp) + "</p></div></div>";
    h += '<div class="searchbar"><input id="scb-q" placeholder="Nom, téléphone, adresse…" value="' + esc(Q) + '"></div><div id="scb-liste">' + listeHtml(all) + "</div>";
    return h;
  }
  function listeHtml(all) {
    var q = norm(Q);
    var l = q ? all.filter(function (c) { return norm(c.nom + " " + c.tel + " " + c.adresse + " " + (c.o.societe || "")).indexOf(q) !== -1 || (c.tel || "").replace(/\D/g, "").indexOf(q.replace(/\D/g, "") || "§") !== -1; }) : all;
    if (!l.length) return '<p class="emptyline">Aucun client.</p>';
    return '<section class="card tsec">' + l.slice(0, 150).map(function (c) {
      return '<button class="facrow" data-scb="client" data-k="' + c.key + '"><span class="bd"><span class="fo">' + esc(c.o.societe || c.nom) + '</span><span class="me">' +
        c.faits.length + " prestation" + (c.faits.length > 1 ? "s" : "") + (c.dernier ? " · dernière " + dfr(c.dernier.date) : "") + (c.prochain ? " · prochaine " + dfr(c.prochain.date) : "") + "</span></span>" +
        '<span class="mo tnum">' + eur2(c.caTTC) + "</span>" + (c.impaye ? '<span class="fbulle b-retard">Impayé</span>' : c.prochain ? '<span class="fbulle b-ok">RDV</span>' : "") + "</button>";
    }).join("") + "</section>";
  }
  function fiche(c) {
    var o = c.o, h = "";
    h += '<p class="hint" style="margin-top:-6px">' + [c.tel, c.email, c.adresse].filter(Boolean).map(esc).join(" · ") + (o.type === "entreprise" ? " · Entreprise" + (o.tva ? " " + esc(o.tva) : "") : "") + "</p>";
    var acts = "";
    if (c.tel) acts += '<a href="tel:' + esc(c.tel.replace(/\s/g, "")) + '">Appeler</a><a href="https://wa.me/' + telIntl(c.tel) + '" target="_blank" rel="noreferrer">WhatsApp</a>';
    if (c.email) acts += '<a href="mailto:' + esc(c.email) + '">Email</a>';
    if (acts) h += '<div class="acts">' + acts + "</div>";
    h += '<div class="sitgrid">' +
      '<div class="card sit"><p class="k">Prestations</p><p class="v tnum">' + c.faits.length + "</p></div>" +
      '<div class="card sit"><p class="k">CA généré (TVAC)</p><p class="v tnum">' + eur2(c.caTTC) + "</p></div>" +
      '<div class="card sit"><p class="k">Panier moyen</p><p class="v tnum">' + eur2(c.panier) + "</p></div>" +
      '<div class="card sit ' + (c.impaye ? "neg" : "pos") + '"><p class="k">Reste à payer</p><p class="v tnum">' + eur2(c.impaye) + "</p></div></div>";
    var al = [];
    if (c.prochain) al.push("📅 Prochain RDV : " + humanDate(c.prochain.date) + " à " + esc(c.prochain.heure) + " — " + euro(c.prochain.total));
    if (c.impaye) al.push("💶 " + c.impayeN + " paiement" + (c.impayeN > 1 ? "s" : "") + " en attente : " + eur2(c.impaye));
    if (c.sansFacture) al.push("🧾 " + c.sansFacture + " prestation" + (c.sansFacture > 1 ? "s" : "") + " sans facture (seulement si le client en demande une)");
    if (c.devisOuvert) al.push("📝 Demande du site en attente de réponse");
    if (al.length) h += '<section class="card sec" style="margin-top:10px">' + al.map(function (x) { return '<p style="margin:4px 0;font-size:13.5px">' + x + "</p>"; }).join("") + "</section>";
    h += '<div class="sitgrid" style="margin-top:10px">' +
      '<button class="cptscan" style="margin:0" data-scb="c-rdv" data-k="' + c.key + '">+ Nouveau RDV</button>' +
      '<button class="cptscan" style="margin:0;background:linear-gradient(135deg,#1d4ed8,#60a5fa)" data-act="open-devis">+ Nouveau devis</button></div>';
    var srv = Object.keys(c.services).sort(function (a, b) { return c.services[b] - c.services[a]; });
    if (srv.length) h += '<p class="note" style="margin:10px 0 0">Services : ' + srv.map(function (s) { return esc(s) + (c.services[s] > 1 ? " ×" + c.services[s] : ""); }).join(" · ") + "</p>";
    h += '<section class="card tsec" style="margin-top:10px"><p class="k">Historique <span class="cnt">' + c.bks.length + "</span></p>";
    c.bks.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).forEach(function (b) {
      var op = statutOp(b), fin = statutFin(b);
      h += '<div class="tvaline" style="align-items:flex-start"><span style="flex:1">' + dfr(b.date) + " · " + esc((b.prestations || []).map(function (p) { return p.nom; }).join(" + ") || "Prestation") +
        '<br><span style="display:inline-flex;gap:4px;flex-wrap:wrap;margin-top:3px">' + tag(op) + (fin ? tag(fin.pay) + (fin.fac ? tag(fin.fac) : "") : "") + "</span>" +
        (b.statut === "termine" ? '<br><span style="display:inline-flex;gap:10px;margin-top:4px">' + (!b.pay || b.pay.statut === "non_paye" ? '<button class="scf-ops" data-scb="payer" data-id="' + b.id + '" data-m="cash">Payé cash</button><button class="scf-ops" data-scb="payer" data-id="' + b.id + '" data-m="virement">Payé virement</button>' : "") +
          '<button class="scf-ops" data-scb="fac-express" data-id="' + b.id + '">' + (factureDe(b.id) && factureDe(b.id).statut !== "brouillon" ? "Voir facture" : "Facture") + "</button></span>" : "") +
        '</span><b class="tnum">' + euro(b.total) + "</b></div>";
    });
    h += "</section>";
    var fs = c.vens.filter(function (v) { return v.statut !== "brouillon"; });
    if (fs.length) {
      h += '<section class="card tsec" style="margin-top:10px"><p class="k">Factures <span class="cnt">' + fs.length + "</span></p>";
      fs.forEach(function (v) { h += '<button class="facrow" data-scf="fac-voir" data-id="' + v.id + '"><span class="bd"><span class="fo">' + esc(v.numero) + '</span><span class="me">' + dfr(v.date) + (v.creditee ? " · annulée (" + esc(v.creditee) + ")" : "") + '</span></span><span class="mo tnum">' + eur2(v.ttc) + "</span></button>"; });
      h += "</section>";
    }
    h += '<section class="card sec" style="margin-top:10px"><p class="k">Infos complémentaires</p>' +
      '<div class="two"><div class="fld small"><label>Type</label><select id="scb-c-type"><option value="particulier">Particulier</option><option value="entreprise"' + (o.type === "entreprise" ? " selected" : "") + '>Entreprise</option></select></div><div class="fld"><label>Société</label><input id="scb-c-societe" value="' + esc(o.societe || "") + '"></div></div>' +
      '<div class="two"><div class="fld"><label>N° TVA</label><input id="scb-c-tva" value="' + esc(o.tva || "") + '"></div><div class="fld"><label>Email</label><input id="scb-c-email" value="' + esc(o.email || c.email || "") + '"></div></div>' +
      '<div class="fld"><label>Adresse de facturation (si différente)</label><input id="scb-c-adresse" value="' + esc(o.adresse || "") + '"></div>' +
      '<div class="fld"><label>Notes</label><input id="scb-c-notes" value="' + esc(o.notes || "") + '" placeholder="Ex : chat à la maison, code porte 1234…"></div>' +
      '<button class="btn-main" style="margin-top:6px" data-scb="c-save" data-k="' + c.key + '">Enregistrer</button></section>';
    return h;
  }

  /* ======================== MODALE PROPRE ============================= */
  function obForm(t, per, off, est) {
    var h = '<div class="fld"><label>Type</label><select id="scb-o-type">' + Object.keys(TYPES_OB).map(function (k) { return '<option value="' + k + '"' + (k === t ? " selected" : "") + ">" + TYPES_OB[k] + "</option>"; }).join("") + "</select></div>" +
      '<div class="two"><div class="fld"><label>Créancier</label><input id="scb-o-cre" value="' + (t === "SOCIAL_CONTRIBUTION" ? esc(S.F().profil.caisseSociale || "Xerius") : t === "VAT" ? "SPF Finances" : "") + '"></div><div class="fld"><label>Montant (€)</label><input id="scb-o-mt" type="number" step="0.01" inputmode="decimal"></div></div>' +
      '<div class="two"><div class="fld"><label>Période</label><input id="scb-o-per" value="' + esc(per || "") + '" placeholder="Ex : T3 2026"></div><div class="fld"><label>Échéance</label><input id="scb-o-ech" type="date"></div></div>' +
      '<div class="fld"><label>IBAN du créancier</label><input id="scb-o-iban"></div>' +
      '<div class="fld"><label>Communication structurée / référence</label><input id="scb-o-com" placeholder="+++xxx/xxxx/xxxxx+++"></div>' +
      '<label style="display:flex;gap:8px;font-size:13px;margin:6px 0"><input type="checkbox" id="scb-o-off" style="width:auto"' + (off ? " checked" : "") + "> Ce montant vient d'un document officiel reçu (décompte, avertissement-extrait de rôle, facture, courrier)</label>" +
      '<div class="fld"><label>Note</label><input id="scb-o-note"></div>' +
      (est ? '<input type="hidden" id="scb-o-est" value="' + est + '">' : "") +
      '<p class="note">Une amende ou majoration ne s\'enregistre que sur base d\'un document réellement reçu. Rien n\'est jamais inventé.</p>' +
      '<button class="btn-main" data-scb="ob-save">Enregistrer</button>';
    return h;
  }
  function draw() {
    var box = document.getElementById("scb-modal");
    if (!box) { box = document.createElement("div"); box.id = "scb-modal"; document.body.appendChild(box); }
    if (!M) { box.innerHTML = ""; return; }
    var titre = "", body = "";
    if (M.k === "client") { var c = clients().filter(function (x) { return x.key === M.key; })[0]; if (!c) { M = null; box.innerHTML = ""; return; } titre = c.o.societe || c.nom; body = fiche(c); }
    if (M.k === "fac") { if (!E) { M = null; box.innerHTML = ""; return; } recalc(E); titre = "Facture — brouillon"; body = editeurHtml(E); }
    if (M.k === "ob") { titre = M.off ? "Décompte officiel" : "Nouvelle obligation"; body = obForm(M.t, M.p, M.off, M.est); }
    if (M.k === "obpaye") { titre = "Marquer comme payé"; body = '<div class="fld"><label>Date du paiement</label><input id="scb-p-date" type="date" value="' + todayStr() + '"></div><div class="fld"><label>Preuve (référence de la transaction Revolut, facultatif)</label><input id="scb-p-preuve"></div><button class="btn-main" data-scb="ob-payer-ok" data-id="' + M.id + '">Confirmer le paiement</button><p class="note">Confirme seulement si le paiement est réellement parti de ton compte.</p>'; }
    box.innerHTML = '<div class="overlay" id="scb-ov"><div class="sheet"><div class="sheet-head"><h2>' + esc(titre) + '</h2><button class="x" data-scb="close">×</button></div>' + body + "</div></div>";
    var t = document.getElementById("scb-tot"); if (t && E) t.innerHTML = totHtml(E);
  }

  /* ============================ ÉVÉNEMENTS ============================ */
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t.id === "scb-q") { Q = t.value; var l = document.getElementById("scb-liste"); if (l) l.innerHTML = listeHtml(clients().sort(function (a, b) { return a.derniereActivite < b.derniereActivite ? 1 : -1; })); return; }
    if (!E) return;
    var f = t.getAttribute("data-e"), li = t.getAttribute("data-l");
    if (f) {
      if (f === "moyen") { E.moyen = t.value; if (!t.value) { E.paye = 0; E.payeTout = false; } else if (!(E.paye > 0)) E.payeTout = true; recalc(E); draw(); return; }
      else if (f === "paye") { E.paye = t.value === "" ? 0 : Number(t.value.replace(",", ".")) || 0; E.payeTout = false; }
      else E[f] = t.value;
      if (f === "clientType") { draw(); return; }
    } else if (li != null) {
      var lf = t.getAttribute("data-lf"), L = E.lignes[+li]; if (!L) return;
      if (lf === "puHT" || lf === "qte") E.ttcCible = null;
      L[lf] = lf === "lib" ? t.value : (t.value === "" ? 0 : Number(t.value.replace(",", ".")) || 0);
    } else return;
    recalc(E);
    var box = document.getElementById("scb-tot"); if (box) box.innerHTML = totHtml(E);
  });

  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "scb-ov") { if (M && M.k === "fac" && E) save(); M = null; E = null; draw(); renderAll(); return; }
    var el = e.target.closest && e.target.closest("[data-scb]"); if (!el) return;
    var a = el.getAttribute("data-scb"), id = el.getAttribute("data-id");
    switch (a) {
      case "close": if (M && M.k === "fac" && E) save(); M = null; E = null; draw(); renderAll(); break;
      case "payer": payer(id, el.getAttribute("data-m")); if (M && M.k === "client") draw(); break;
      case "fac-express": factureExpress(id); break;
      case "client": M = { k: "client", key: el.getAttribute("data-k") }; draw(); break;
      case "client-bk": { var b = findBk(id), c = b && clientDeBk(b); if (c) { ui.detailId = null; renderAll(); M = { k: "client", key: c.key }; draw(); } else toast("err", ["Pas assez d'infos (nom ou téléphone) pour retrouver ce client."]); break; }
      case "c-save": {
        var k = el.getAttribute("data-k"), ov = C().clients[k] || (C().clients[k] = {});
        ["type", "societe", "tva", "email", "adresse", "notes"].forEach(function (f) { var i = document.getElementById("scb-c-" + f); if (i) ov[f] = i.value.trim(); });
        S.log("Fiche client modifiée", k); save(); draw(); toast("ok", ["Fiche client enregistrée."]); break;
      }
      case "c-rdv": {
        var cc = clients().filter(function (x) { return x.key === el.getAttribute("data-k"); })[0];
        M = null; draw();
        ui.manuelDate = todayStr(); ui.showDevis = false; ui.showManuel = true; renderModals();
        if (cc) { [["m-client", cc.nom], ["m-tel", cc.tel], ["m-adr", cc.adresse]].forEach(function (x) { var i = document.getElementById(x[0]); if (i && x[1]) i.value = x[1]; }); }
        break;
      }
      case "l-add": {
        var tt = el.getAttribute("data-t");
        E.ttcCible = null;
        E.lignes.push(tt === "deplacement" ? { lib: "Déplacement", qte: 1, puHT: 0 } : tt === "remise" ? { lib: "Remise", qte: 1, puHT: 0 } : { lib: "", qte: 1, puHT: 0 });
        draw(); break;
      }
      case "l-del": E.ttcCible = null; E.lignes.splice(+el.getAttribute("data-i"), 1); recalc(E); draw(); break;
      case "fac-apercu": recalc(E); save(); S.ouvrirDoc(S.factureHtml(E)); break;
      case "fac-save": recalc(E); S.log("Brouillon de facture modifié", (E.client || "") + " · " + eur2(E.ttc)); save(); M = null; E = null; draw(); renderAll(); toast("ok", ["Brouillon enregistré — tu peux le finaliser plus tard (Ventes ou fiche RDV)."]); break;
      case "fac-valider": valider(E); break;
      case "fac-suppr": if (confirm("Supprimer ce brouillon ? (il n'a jamais été émis)")) { DB.cpt.ven = cptData().ven.filter(function (v) { return v !== E; }); S.log("Brouillon supprimé", E.client || ""); save(); M = null; E = null; draw(); renderAll(); } break;
      case "ob-new": M = { k: "ob", t: el.getAttribute("data-t") || "OTHER", p: el.getAttribute("data-p") || "", off: el.getAttribute("data-off") === "1" || el.getAttribute("data-t") === "VAT" || el.getAttribute("data-t") === "SOCIAL_CONTRIBUTION", est: el.getAttribute("data-est") || "" }; draw(); break;
      case "ob-save": {
        var mt = Number((document.getElementById("scb-o-mt").value || "").replace(",", "."));
        var off = document.getElementById("scb-o-off").checked, ty = document.getElementById("scb-o-type").value;
        if (!mt || mt <= 0) { toast("err", ["Indique le montant."]); break; }
        if (ty === "FINE" && !off) { toast("err", ["Une amende ne s'enregistre que depuis un document réellement reçu : coche la case."]); break; }
        var est = document.getElementById("scb-o-est");
        var ob = { id: uid("ob"), type: ty, creancier: document.getElementById("scb-o-cre").value.trim(), montant: r2(mt), officiel: off,
          periode: document.getElementById("scb-o-per").value.trim(), echeance: document.getElementById("scb-o-ech").value || null, statut: "a_payer",
          iban: document.getElementById("scb-o-iban").value.trim(), communication: document.getElementById("scb-o-com").value.trim(),
          notes: document.getElementById("scb-o-note").value.trim(), estimAvant: est && est.value ? Number(est.value) : null, cree: new Date().toISOString() };
        C().oblig.push(ob);
        S.log("Obligation ajoutée", TYPES_OB[ty] + " · " + eur2(mt) + (off ? " (officiel)" : " (estimé)") + (ob.periode ? " · " + ob.periode : ""));
        save(); M = null; draw(); renderMain(); toast("ok", ["Enregistré" + (off ? " comme montant OFFICIEL." : " comme ESTIMATION.")]); break;
      }
      case "go-revenus": ui.space = "pro"; ui.tab = "revenus"; ui.revPeriod = "mois"; ui.revMonth = null; renderAll(); window.scrollTo(0, 0); break;
      case "chg-save": {
        var ch = CH();
        ["essenceMin", "essenceMax", "pubJourMin", "pubJourMax", "produits"].forEach(function (k) { var i = document.getElementById("scb-ch-" + k); if (i && i.value !== "") ch[k] = Math.max(0, Number(i.value.replace(",", ".")) || 0); });
        if (ch.essenceMax < ch.essenceMin) ch.essenceMax = ch.essenceMin; if (ch.pubJourMax < ch.pubJourMin) ch.pubJourMax = ch.pubJourMin;
        var au = document.getElementById("scb-ch-auto"); if (au) ch.autoTerminer = au.checked;
        S.log("Charges habituelles modifiées", "essence " + ch.essenceMin + "-" + ch.essenceMax + " €/mois · produits " + ch.produits + " €/mois · pub " + ch.pubJourMin + "-" + ch.pubJourMax + " €/jour");
        save(); renderMain(); toast("ok", ["Charges enregistrées — le bénéfice est recalculé."]); break;
      }
      case "ob-payer": M = { k: "obpaye", id: id }; draw(); break;
      case "ob-payer-ok": {
        var o = C().oblig.filter(function (x) { return x.id === id; })[0]; if (!o) break;
        o.statut = "paye"; o.payeLe = document.getElementById("scb-p-date").value || todayStr(); o.preuve = document.getElementById("scb-p-preuve").value.trim();
        S.log("Obligation payée", TYPES_OB[o.type] + " · " + eur2(o.montant) + " le " + dfr(o.payeLe)); save(); M = null; draw(); renderMain(); break;
      }
      case "ob-suppr": {
        var o2 = C().oblig.filter(function (x) { return x.id === id; })[0];
        if (o2 && confirm("Supprimer cette obligation saisie à la main ?")) { C().oblig = C().oblig.filter(function (x) { return x !== o2; }); S.log("Obligation supprimée", TYPES_OB[o2.type] + " · " + eur2(o2.montant)); save(); renderMain(); }
        break;
      }
      case "ob-copier": {
        var o3 = obligations().filter(function (x) { return x.id === id; })[0]; if (!o3) break;
        copyText([o3.creancier, o3.iban ? "IBAN : " + o3.iban : "", "Montant : " + (o3.montant != null ? eur2(o3.montant) : "?"), o3.communication ? "Communication : " + o3.communication : "", o3.echeance ? "Échéance : " + dfr(o3.echeance) : ""].filter(Boolean).join("\n"))
          .then(function () { toast("ok", ["Infos de paiement copiées — colle-les dans Revolut."]); });
        break;
      }
    }
  });

  /* Lien Compta ↔ StayClean : le CA de la Compta est celui de l'agenda pro (mêmes RDV, même calcul) */
  function caProHtml() {
    var td = todayStr(), mk = td.slice(0, 7);
    var fm = mk + "-" + pad(new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate());
    var Mo = bilan(mk + "-01", fm);
    return '<section class="card sec" style="margin-bottom:12px"><p class="k">🧼 Chiffre d\'affaires StayClean — ' + MOIS_FULL[+mk.slice(5, 7) - 1] + '</p>' +
      '<div class="tvaline"><span>Revenus réalisés (TVAC) · ' + Mo.nbR + ' RDV</span><b class="tnum">' + eur2(Mo.caTTC) + "</b></div>" +
      '<div class="tvaline"><span>Chiffre d\'affaires HTVA</span><b class="tnum">' + eur2(Mo.caHT) + "</b></div>" +
      '<div class="tvaline"><span>Charges (essence, produits, pub, autres)</span><b class="tnum">−' + eur2(Mo.charges) + "</b></div>" +
      '<div class="tvaline"><span><b>Bénéfice estimé</b></span><b class="tnum" style="color:' + (Mo.benef >= 0 ? "#047857" : "var(--rouge)") + '">' + eur2(Mo.benef) + "</b></div>" +
      '<button class="linkline" data-scb="go-revenus">Même calcul que StayClean → Revenus · voir le détail →</button></section>';
  }

  /* Garde-fou : si un écran plante, on affiche l'erreur au lieu de rester bloqué,
     et on la note (synchronisée) pour pouvoir la corriger. */
  function noteErreur(e, ou) {
    try {
      var c = cptData(); if (!c.erreurs) c.erreurs = [];
      c.erreurs.push({ ts: new Date().toISOString(), ou: ou, espace: ui.space, onglet: ui.tab, msg: String(e && e.message || e), pile: String(e && e.stack || "").slice(0, 600), nav: navigator.userAgent.slice(0, 120) });
      if (c.erreurs.length > 30) c.erreurs = c.erreurs.slice(-30);
      save();
    } catch (x) {}
  }
  ["renderMain", "renderChrome", "renderModals"].forEach(function (nom) {
    var f = window[nom]; if (typeof f !== "function") return;
    window[nom] = function () {
      try { return f.apply(this, arguments); }
      catch (e) {
        noteErreur(e, nom);
        if (nom === "renderMain") { var m = document.getElementById("main"); if (m) m.innerHTML = '<div class="anomalie" style="margin-top:14px">Oups, cet écran a rencontré une erreur (' + esc(String(e && e.message || e)) + '). Elle est enregistrée pour être corrigée.</div><button class="btn-main" data-act="go-home">← Revenir à l\'accueil</button>'; }
      }
    };
  });

  setTimeout(function () { try { if (autoTerminer()) renderAll(); } catch (e) {} }, 1500);
  setInterval(function () { try { if (autoTerminer()) renderAll(); } catch (e) {} }, 300000);

  window.SCB = {
    renderClients: renderClients, renderAPayer: renderAPayer, bkPanel: bkPanel, bkTags: bkTags,
    onTermine: onTermine, factureExpress: factureExpress, ouvrirEditeur: ouvrirEditeur, payer: payer,
    clients: clients, obligations: obligations, recalc: recalc, valider: valider, brouillonDepuis: brouillonDepuis, relier: relier,
    bilan: bilan, beneficeHtml: beneficeHtml, stripHtml: stripHtml, autoTerminer: autoTerminer, caProHtml: caProHtml
  };
})();
