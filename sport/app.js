/* Mon Programme (« Le Camp ») — StayClean Agenda.
   Six séances d'athlète en rotation (J1 → J6, puis repos), la nutrition et le poids.
   Deux façons de l'utiliser :
   - depuis l'agenda (Mohamed) : même appli, même compte ; tout suit sur ses appareils via la table cal_items
     (pesées partagées avec l'ancienne Mes Calories, programme dans la ligne settings/sport) ;
   - par le lien « ?ami=1 » (un ami) : tout reste sur SON téléphone. Aucune connexion, aucun compte, aucune lecture
     des données de l'agenda : l'ami ne voit que ce programme.
   Le contenu des séances vient de sport/data.js (généré par sport/sources/gen_sport.py). */
'use strict';
(function () {
const D = window.SP_DATA || {}; const PICS = window.SP_PICS || {};

/* ===== Utilitaires ===== */
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const _day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' });
function todayISO() { return (window.__SP_TODAY) || _day.format(new Date()); }
function parseISO(s) { const p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function addDays(s, n) { const d = new Date(parseISO(s) + n * 864e5); return d.toISOString().slice(0, 10); }
function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 864e5); }
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function dShort(s) { const d = new Date(parseISO(s)); return d.getUTCDate() + (d.getUTCDate() === 1 ? 'er' : '') + ' ' + MOIS[d.getUTCMonth()]; }
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
function dayName(s) { return JOURS[new Date(parseISO(s)).getUTCDay()]; }
function fr(n, dec) { return Number(n).toLocaleString('fr-BE', { minimumFractionDigits: dec == null ? 1 : dec, maximumFractionDigits: dec == null ? 1 : dec }); }
function num(v) { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : null; }
function uid() { return Math.random().toString(36).slice(2, 10); }
function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }

/* ===== Mode et stockage sur l'appareil ===== */
const params = new URLSearchParams(location.search);
const AMI = params.has('ami');                       // lien partagé : jamais de compte, jamais l'agenda
const KEY = 'sp.state.v1';                          // une seule clé : l'écran d'accueil peut rouvrir sans « ?ami=1 »
function emptyState() { return { v: 1, uid: null, profile: null, profileAt: 0, log: {}, loads: {}, weights: {}, dirtyW: {}, dirtyDoc: false, active: null }; }
let S = emptyState();
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(emptyState(), JSON.parse(raw)); } catch (e) { /* stockage indisponible */ }
let storeOk = true;
function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); storeOk = true; } catch (e) { storeOk = false; } }

/* ===== Compte (seulement depuis l'agenda) : même serveur et même session que l'agenda =====
   Lecture seule des réglages de l'agenda (serveur + session). Écrit uniquement dans cal_items :
   - kind « weights », id « w-AAAA-MM-JJ » : les pesées (les mêmes que Mes Calories) ;
   - kind « settings », id « sport » : profil, séances faites et charges. */
const Acc = { sb: null, uid: null, on: false, state: AMI ? 'ami' : 'local', pulling: null, pushing: false, again: false, last: 0 };
function agendaConf() {
  if (AMI) return null;
  try {
    const db = JSON.parse(localStorage.getItem('stayclean-agenda-v1') || 'null');
    const s = (db && db.settings && db.settings.sync) || {};
    const url = typeof s.url === 'string' ? s.url.trim().replace(/\/+$/, '') : '';
    const key = typeof s.anonKey === 'string' ? s.anonKey.trim() : '';
    if (!/^https?:\/\/[^/]+$/i.test(url) || key.length < 20) return null;
    const p = (db.cpt && db.cpt.profil) || {};
    return { url, key, prenom: String(p.prenom || '').trim() };
  } catch (e) { return null; }
}
function storedUser(conf) {
  try {
    const ref = new URL(conf.url).hostname.split('.')[0];
    const s = JSON.parse(localStorage.getItem('sb-' + ref + '-auth-token') || 'null');
    const u = s && (s.user || (s.currentSession && s.currentSession.user));
    return u && u.id ? u.id : null;
  } catch (e) { return null; }
}
async function connect() {
  const conf = agendaConf();
  if (!conf) return;
  const id = storedUser(conf);
  if (!id || !window.supabase || typeof window.supabase.createClient !== 'function') { Acc.state = id ? 'local' : 'signedout'; return; }
  try { Acc.sb = window.supabase.createClient(conf.url, conf.key); } catch (e) { Acc.sb = null; return; }
  let u = id;
  try { const r = await Acc.sb.auth.getSession(); const su = r && r.data && r.data.session && r.data.session.user; if (su && su.id) u = su.id; } catch (e) { /* hors ligne */ }
  if (S.uid && S.uid !== u) { S = emptyState(); }      // autre compte sur cet appareil : on ne mélange jamais
  S.uid = u; Acc.uid = u; Acc.on = true; Acc.state = 'sync';
  if (!S.profile) S.profile = defaultProfile(conf.prenom);
  saveLocal();
  await pull();
  setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 60000);
}
function netErr(e) { return /fetch|network|load failed|timeout|offline/i.test(String((e && (e.message || e.name)) || e || '')); }
/* Fusion du programme : séances et charges entrée par entrée (la plus récente gagne), profil le plus récent */
function mergeDoc(a, b) {
  const out = { profile: a.profile, profileAt: a.profileAt || 0, log: Object.assign({}, a.log), loads: Object.assign({}, a.loads) };
  if (b && b.profile && (b.profileAt || 0) > out.profileAt) { out.profile = b.profile; out.profileAt = b.profileAt; }
  for (const [k, v] of Object.entries((b && b.log) || {})) if (!out.log[k] || (v.at || 0) > (out.log[k].at || 0)) out.log[k] = v;
  for (const [k, v] of Object.entries((b && b.loads) || {})) if (!out.loads[k] || (v.at || 0) > (out.loads[k].at || 0)) out.loads[k] = v;
  return out;
}
function docOf(s) { return { v: 1, profile: s.profile, profileAt: s.profileAt, log: s.log, loads: s.loads }; }
async function pull() {
  if (!Acc.on || !Acc.sb) return;
  if (Acc.pulling) return Acc.pulling;
  Acc.pulling = (async () => {
    try {
      const w = await Acc.sb.from('cal_items').select('kind,id,data,deleted,updated_at').eq('user_id', Acc.uid).eq('kind', 'weights');
      if (w.error) throw w.error;
      const d = await Acc.sb.from('cal_items').select('kind,id,data,deleted,updated_at').eq('user_id', Acc.uid).eq('kind', 'settings').eq('id', 'sport');
      if (d.error) throw d.error;
      for (const r of w.data || []) {
        const date = r.id.slice(2);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || S.dirtyW[date]) continue;       // une modification d'ici attend d'être envoyée
        if (r.deleted) delete S.weights[date];
        else if (r.data && Number.isFinite(+r.data.kg)) S.weights[date] = { kg: +r.data.kg, at: Date.parse(r.data.updatedAt || r.data.at || r.updated_at) || 0 };
      }
      const remote = d.data && d.data[0] && !d.data[0].deleted ? d.data[0].data : null;
      const m = mergeDoc(docOf(S), remote);
      const changed = JSON.stringify(m) !== JSON.stringify(mergeDoc(docOf({ profile: remote && remote.profile, profileAt: remote && remote.profileAt, log: (remote && remote.log) || {}, loads: (remote && remote.loads) || {} }), null));
      Object.assign(S, m);
      if (changed) S.dirtyDoc = true;
      Acc.state = 'sync'; Acc.last = Date.now();
      saveLocal(); render();
      await push();
    } catch (e) {
      const msg = String((e && (e.message || e.code)) || '');
      Acc.state = netErr(e) ? 'offline' : (/jwt|auth|401/i.test(msg) ? 'signedout' : (/does not exist|PGRST205|42P01/.test(msg) ? 'noTable' : 'error'));
      render();
    } finally { Acc.pulling = null; }
  })();
  return Acc.pulling;
}
async function push() {
  if (!Acc.on || !Acc.sb) return;
  if (Acc.pushing) { Acc.again = true; return; }
  Acc.pushing = true;
  try {
    for (const date of Object.keys(S.dirtyW)) {
      const w = S.weights[date];
      const row = w ? { user_id: Acc.uid, kind: 'weights', id: 'w-' + date, data: { id: 'w-' + date, date, kg: w.kg, at: new Date(w.at || Date.now()).toISOString(), updatedAt: new Date().toISOString() }, deleted: false }
                    : { user_id: Acc.uid, kind: 'weights', id: 'w-' + date, data: {}, deleted: true };
      const r = await Acc.sb.from('cal_items').upsert(row, { onConflict: 'user_id,kind,id' });
      if (r.error) throw r.error;
      delete S.dirtyW[date]; saveLocal();
    }
    if (S.dirtyDoc) {
      const r = await Acc.sb.from('cal_items').upsert({ user_id: Acc.uid, kind: 'settings', id: 'sport', data: docOf(S), deleted: false }, { onConflict: 'user_id,kind,id' });
      if (r.error) throw r.error;
      S.dirtyDoc = false; saveLocal();
    }
    Acc.state = 'sync'; Acc.last = Date.now();
  } catch (e) { Acc.state = netErr(e) ? 'offline' : 'error'; }
  finally {
    Acc.pushing = false;
    if (Acc.again) { Acc.again = false; push(); }
    renderTop();
  }
}
const pushSoon = debounce(push, 1200);
function changed(doc) { if (doc) S.dirtyDoc = true; saveLocal(); summary(); if (Acc.on) pushSoon(); render(); }

/* ===== Profil ===== */
function defaultProfile(prenom) {
  /* depuis l'agenda : le programme de Mohamed (départ le lundi 23 novembre 2026 à 106 kg) */
  return { name: prenom || 'Mohamed', startKg: 106, goalKg: 87, startDate: '2026-11-23', heightCm: 184, age: 24 };
}
function P() { return S.profile; }

/* ===== Le programme : semaine, phase, rotation ===== */
function weekNo(date) { const p = P(); if (!p) return 1; return Math.max(1, Math.floor(diffDays(p.startDate, date || todayISO()) / 7) + 1); }
function isRamadan(date) { const d = date || todayISO(); return D.ramadan && d >= D.ramadan[0] && d <= D.ramadan[1]; }
function order(date) { return isRamadan(date) ? D.ramadanOrder : D.sessions.map((s) => s.id); }
function sess(id) { return D.sessions.find((s) => s.id === id); }
function doneLog() { return Object.values(S.log).filter((e) => e && e.done && !e.del).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at || 0) - (b.at || 0))); }
function nextId(date) {
  const ord = order(date); const all = D.sessions.map((s) => s.id);
  const L = doneLog().filter((e) => e.date < (date || todayISO()) || e.date === (date || todayISO()));
  const last = L[L.length - 1];
  if (!last) return ord[0];
  const i = all.indexOf(last.sid);
  return ord.find((id) => all.indexOf(id) > i) || ord[0];
}
function doneOn(date) { return doneLog().filter((e) => e.date === date); }
/* Statut du jour : 'active' (séance commencée), 'done', 'rest' (le lendemain de J6), 'go' */
function todayStatus() {
  const t = todayISO();
  if (S.active && S.active.date === t) return { k: 'active', sid: S.active.sid };
  const dn = doneOn(t);
  if (dn.length) return { k: 'done', sid: dn[dn.length - 1].sid, next: nextId(t) };
  const L = doneLog(); const last = L[L.length - 1]; const ord = order(t);
  if (last && last.sid === ord[ord.length - 1] && last.date === addDays(t, -1)) return { k: 'rest', next: nextId(t) };
  const week = L.filter((e) => e.date > addDays(t, -7)).length;
  if (week >= 6) return { k: 'rest', next: nextId(t), six: true };
  return { k: 'go', next: nextId(t) };
}
function parseSets(d) { const m = /^(\d+)\s*×/.exec(d || ''); return m ? +m[1] : 1; }
function parseRest(r) {
  if (!r || r === '—') return 0;
  let s = 0; const m = /(\d+)\s*min/.exec(r); if (m) s += 60 * +m[1];
  const m2 = /(\d+)\s*s\b/.exec(r); if (m2) s += +m2[1];
  const m3 = /min\s+(\d+)$/.exec(r); if (m3) s += +m3[1];
  return s;
}
/* La séance réelle d'un jour donné : séries ajustées (semaines 1-2, semaine 7, Ramadan), niveau de La Totale, gilet */
function buildSession(sid, date) {
  const s = sess(sid); const w = weekNo(date); const ram = isRamadan(date);
  const lessOne = w <= 2 || w === 7;
  const items = [];
  const note = ram ? 'Ramadan : trois séries maximum. Rien d’intense à jeun.' : (w <= 2 ? 'Semaines 1 et 2 : une série de moins partout, charges modérées.' : (w === 7 ? 'Semaine 7, allégée : une série de moins, mêmes charges.' : ''));
  const adj = (n) => { let x = n; if (x >= 3 && lessOne) x -= 1; if (ram) x = Math.min(x, 3); return x; };
  s.ex.forEach((e, i) => {
    let dose = e.d; let n = parseSets(e.d);
    if (/×/.test(e.d)) { const m = adj(n); dose = e.d.replace(/^\d+/, String(m)); n = m; }
    if (e.k === 'vest') { const v = w <= 2 ? D.vest[0] : (w <= 6 ? D.vest[1] : D.vest[2]); dose = v[2] + ' · ' + v[1]; }
    items.push({ key: sid + ':' + i, pic: e.k, n: e.n, dose, x: e.x || '', sets: n, rest: parseRest(e.r), restTxt: e.r === '—' ? '' : e.r, mark: e.m || 'keep', cue: e.c, w: !!e.w });
  });
  if (s.abs) items.push({ key: sid + ':abs', pic: 'crunch', n: 'Circuit abdos', dose: (ram ? 2 : 3) + ' tours', sets: ram ? 2 : 3, rest: 60, restTxt: '1 min', mark: 'keep', cue: s.abs.map((a) => a[1] + ' ' + a[2]).join(' · ') + '. Sans pause entre les exercices.', w: false });
  if (s.fin && !ram) items.push({ key: sid + ':fin', pic: s.fin.k, n: s.fin.n, dose: s.fin.d.replace(/^\d+/, String(adj(parseSets(s.fin.d)))), sets: adj(parseSets(s.fin.d)), rest: parseRest(s.fin.r), restTxt: s.fin.r, mark: 'push', cue: s.fin.c, w: true, fin: true });
  if (s.totale && !ram) {
    const lv = w <= 2 ? D.totale[0] : (w <= 6 ? D.totale[1] : D.totale[2]); const tours = parseInt(lv[1], 10);
    items.push({ key: sid + ':tot1', pic: 'rope', n: 'La Totale · corde + abdos', dose: tours + ' tours', sets: tours, rest: 0, restTxt: 'sans pause', mark: 'push', cue: 'Corde puis abdos, à la suite (crunch, relevés de jambes, mountain climbers, planche à tour de rôle). ' + lv[2], w: false, tot: true });
    items.push({ key: sid + ':tot2', pic: 'run', n: 'La Totale · sprints sur tapis', dose: tours + ' × 30 s', sets: tours, rest: 30, restTxt: '30 s de marche', mark: 'push', cue: 'Pente 6 %. Tu changes la vitesse au bouton, mains sur les barres. Jamais de saut sur un tapis lancé.', w: false, tot: true });
  }
  if (s.cardio) items.push({ key: sid + ':cardio', pic: /gilet/i.test(s.cardio.t) ? 'vest' : 'treadmill', n: s.cardio.t, dose: s.cardio.d, sets: 1, rest: 0, restTxt: '', mark: 'steady', cue: s.cardio.c + (/gilet/i.test(s.cardio.t) ? ' ' + vestTxt(w) : ''), w: false, cardio: true });
  return { s, w, ram, note, items };
}
function vestTxt(w) { const v = w <= 2 ? D.vest[0] : (w <= 6 ? D.vest[1] : D.vest[2]); return 'Cette semaine : ' + v[1] + '.'; }
function lastLoad(key) { const l = S.loads[key]; return l && Number.isFinite(l.kg) ? l.kg : null; }

/* ===== Poids et trajectoire ===== */
function weights() { return Object.entries(S.weights).filter(([, v]) => v && Number.isFinite(v.kg)).map(([d, v]) => ({ d, kg: v.kg })).sort((a, b) => (a.d < b.d ? -1 : 1)); }
function lastWeight() { const w = weights(); return w.length ? w[w.length - 1] : null; }
function planKg(date) {
  const p = P(); if (!p) return null;
  const x = diffDays(p.startDate, date) / 7; if (x <= 0) return p.startKg;
  const k = p.startKg / 106; let kg = p.startKg; const st = D.steps;
  for (let i = 0; i < Math.floor(x) && i < st.length; i++) kg -= st[i] * k;
  const f = x - Math.floor(x); const i2 = Math.floor(x);
  kg -= (i2 < st.length ? st[i2] : st[st.length - 1]) * k * f;
  if (x > st.length) kg = Math.max(p.goalKg, kg - (x - st.length) * 0.75 * k);
  return Math.max(p.goalKg, kg);
}
function avg7(date) { let s = 0, n = 0; for (let i = 0; i < 7; i++) { const v = S.weights[addDays(date, -i)]; if (v && Number.isFinite(v.kg)) { s += v.kg; n++; } } return n ? s / n : null; }

/* ===== Nutrition : la cible du profil, le menu fixe et les ajouts ===== */
function nutrition() {
  const p = P(); const lw = lastWeight(); const kg = lw ? lw.kg : (p ? p.startKg : 106);
  const bmr = 10 * kg + 6.25 * ((p && p.heightCm) || 180) - 5 * ((p && p.age) || 25) + 5;
  const tdee = bmr * 1.5;
  let target = Math.round((tdee - 1100) / 50) * 50; target = Math.min(2600, Math.max(1800, target));
  const base = D.day.kcal; let extra = target - base; const adds = [];
  const ADD = [['+ 150 g de skyr', 95, 16], ['+ 30 g de riz (sec)', 105, 2], ['+ 1 banane', 105, 1], ['+ 20 g de flocons', 75, 3]];
  let i = 0; while (extra >= 75 && i < 8) { const a = ADD[i % ADD.length]; adds.push(a); extra -= a[1]; i++; }
  const less = target < base - 100 ? 'Ta cible est plus basse que le menu : riz 90 → 60 g.' : '';
  return { tdee: Math.round(tdee / 10) * 10, target, adds, less };
}

/* ===== Résumé pour la carte de l'agenda ===== */
function summary() {
  if (AMI) return;
  let fromAgenda = false; try { fromAgenda = sessionStorage.getItem('sp.from') === 'agenda'; } catch (e) { /* rien */ }
  if (!agendaConf() && !fromAgenda) return;          // seulement pour la carte de l'agenda, sur les appareils de l'agenda
  try {
    const st = todayStatus(); const n = sess(st.next || st.sid); const lw = lastWeight();
    localStorage.setItem('sp.summary.v1', JSON.stringify({ uid: Acc.uid || S.uid || null, date: todayISO(), k: st.k, sid: st.sid || null, next: n ? n.id + ' · ' + n.name : '', kg: lw ? lw.kg : null, at: Date.now() }));
  } catch (e) { /* facultatif */ }
}

/* ===== Affichage ===== */
let tab = 'today';
function pic(k) { return PICS[k] || ''; }
function mark(m) { const v = (D.marks && D.marks[m]) || ['keep', '']; return `<span class="cp ${v[0]}">${esc(v[1])}</span>`; }
function X(s) { return esc(s).replace(/ × /g, '<span class="tx">×</span>'); }
function render() { renderTop(); if (tab === 'today') renderToday(); else if (tab === 'plan') renderPlan(); else if (tab === 'food') renderFood(); else renderWeight(); }
function renderTop() {
  const back = !AMI && sessionStorage.getItem('sp.from') === 'agenda';
  const p = P(); const w = weekNo();
  const sync = { sync: 'Synchronisé avec ton compte', offline: 'Hors ligne : envoi au retour du réseau', signedout: 'Connecte-toi dans l’agenda pour synchroniser', noTable: 'Serveur pas prêt : gardé sur ce téléphone', error: 'Envoi impossible pour l’instant', local: 'Gardé sur ce téléphone', ami: 'Gardé sur ton téléphone' }[Acc.state] || '';
  $('#top').innerHTML = `${back ? '<button class="back" data-act="go-agenda" aria-label="Retour à l’agenda">‹</button>' : ''}
    <div class="brand"><b>${esc(AMI ? 'Le Camp' : 'Opération 87')}</b><span>${p ? esc(p.name) + ' · semaine ' + w : 'Bienvenue'}</span></div>
    <button class="prof" data-act="profile" aria-label="Profil et réglages">⚙︎</button>
    <div class="sync">${esc(sync)}${storeOk ? '' : ' · stockage plein'}</div>`;
}
function rotationStrip(cur) {
  const t = todayISO(); const ord = order(t); const L = doneLog();
  const since = (() => { // séances du cycle en cours : depuis le dernier J1 (ou le début)
    let k = L.length - 1; while (k >= 0 && L[k].sid !== ord[0]) k--; return k >= 0 ? L.slice(k) : [];
  })();
  const done = new Set(since.map((e) => e.sid));
  return `<div class="rot">${ord.map((id) => { const s = sess(id); return `<button class="rc ${s.cls}${done.has(id) ? ' ok' : ''}${id === cur ? ' cur' : ''}" data-act="open" data-sid="${id}"><i>${id}</i>${pic(s.pic)}<b>${esc(s.name)}</b>${done.has(id) ? '<u>✓</u>' : ''}</button>`; }).join('')}</div>`;
}
function renderToday() {
  const el = $('#tab-today'); const p = P();
  if (!p) { el.innerHTML = `<div class="hero"><h1>Le Camp</h1><p>Six séances d’athlète, toujours dans le même ordre. Tu appuies sur « Je m’entraîne », je te donne la séance du jour.</p><button class="big" data-act="profile">Créer mon profil</button></div>`; return; }
  const t = todayISO(); const st = todayStatus(); const ram = isRamadan(t);
  let hero = '';
  if (st.k === 'active') {
    const s = sess(st.sid);
    hero = `<div class="hero ${s.cls}"><small>Séance en cours</small><h1>${s.id} · ${esc(s.name)}</h1><p>${esc(s.nick)} · ${esc(s.dur)}</p><button class="big" data-act="resume">Reprendre ma séance</button></div>`;
  } else if (st.k === 'done') {
    const s = sess(st.sid); const n = sess(st.next);
    hero = `<div class="hero done"><small>Aujourd’hui</small><h1>✓ ${s.id} faite</h1><p>Bien joué. Demain : <b>${n.id} · ${esc(n.name)}</b>. Jamais deux séances le même jour.</p><button class="ghostb" data-act="open" data-sid="${n.id}">Voir la prochaine</button></div>`;
  } else if (st.k === 'rest') {
    const n = sess(st.next);
    hero = `<div class="hero rest"><small>Aujourd’hui</small><h1>Repos</h1><p>${st.six ? 'Six séances en sept jours : ton corps se reconstruit aujourd’hui.' : 'Tu as bouclé J6 hier : un jour off, puis tu repars sur J1.'} 10 000 pas, étirements, sommeil.</p><button class="ghostb" data-act="start" data-sid="${n.id}">Je m’entraîne quand même (${n.id})</button></div>`;
  } else {
    const n = sess(st.next); const b = buildSession(n.id, t);
    hero = `<div class="hero ${n.cls}"><small>Ta séance du jour</small><h1>${n.id} · ${esc(n.name)}</h1><p>${esc(n.nick)} · ${esc(n.dur)} · ${b.items.length} exercices</p>${b.note ? `<p class="hn">${esc(b.note)}</p>` : ''}<button class="big" data-act="start" data-sid="${n.id}">Je m’entraîne aujourd’hui</button><button class="link" data-act="open" data-sid="${n.id}">Voir la séance avant</button></div>`;
  }
  const lw = lastWeight(); const wToday = S.weights[t];
  el.innerHTML = `${hero}
    <h2 class="st">Ton cycle${ram ? ' (Ramadan)' : ''}<span>${ram ? '4 séances' : '6 séances, puis repos'}</span></h2>${rotationStrip(st.k === 'go' ? st.next : st.sid)}
    <p class="note">Le jour de la semaine ne compte pas : tu fais toujours la suivante. Un jour raté, tu reprends où tu t’es arrêté.</p>
    <div class="tiles">
      <button class="tile" data-act="tab" data-tab="weight"><small>Pesée du matin</small><b>${wToday ? fr(wToday.kg) + ' kg' : (lw ? fr(lw.kg) + ' kg' : '—')}</b><span>${wToday ? 'notée aujourd’hui' : 'Noter ma pesée'}</span></button>
      <button class="tile" data-act="tab" data-tab="food"><small>Assiette du jour</small><b>${nutrition().target.toLocaleString('fr-BE')} kcal</b><span>Bol · shake · assiette</span></button>
    </div>
    <div class="strip">👟 <span><b>10 000 pas</b> chaque jour, séance ou pas.</span></div>`;
}
function sessionCard(s, i) {
  return `<button class="sc ${s.cls}" data-act="open" data-sid="${s.id}"><div class="scp">${pic(s.pic)}</div><div><small>${s.id} · ${esc(s.dur)}</small><b>${esc(s.name)}</b><span>${esc(s.nick)} · ${esc(s.tags.join(' · '))}</span></div><i>›</i></button>`;
}
function renderPlan() {
  const hist = doneLog().slice(-8).reverse();
  $('#tab-plan').innerHTML = `<h2 class="st">Les 6 séances<span>dans l’ordre</span></h2>${D.sessions.map(sessionCard).join('')}
    <div class="sc srest"><div class="scp">${pic('walk')}</div><div><small>7e jour</small><b>Repos</b><span>${esc(D.rest.c)}</span></div></div>
    <h2 class="st">Lourd ? À l’échec ?</h2>
    <div class="yn"><div class="ok"><small>Tu portes lourd ?</small><b>OUI</b><span>La dernière répétition est dure, mais propre. Tu pourrais en faire 3 de plus ? Monte.</span></div>
    <div class="no"><small>À l’échec ?</small><b>NON</b><span>Tu t’arrêtes avec 2 répétitions en réserve. Sauf la flamme 🔥 : dernière série à fond (épaules, bras, leg curl, mollets).</span></div></div>
    <div class="rule"><b>Tu montes dès que ça passe</b><span>Toutes les séries en haut de la fourchette ? La fois suivante : +1 à 2 kg aux haltères, +2,5 à 5 kg aux machines. L’appli retient tes charges.</span></div>
    <div class="rule"><b>Le gilet lesté</b><span>${D.vest.map((v) => esc(v[0] + ' : ' + v[1] + ', ' + v[2])).join(' · ')}. Tu marches lesté en pente, tu ne cours pas lesté : la course viendra plus tard.</span></div>
    <div class="rule"><b>Les semaines spéciales</b><span>Semaines 1 et 2 : une série de moins. Semaine 7 : allégée. Ramadan : J1, J3, J4, J6 seulement, trois séries max, rien d’intense à jeun. L’appli ajuste tout toute seule.</span></div>
    <div class="rule warn"><b>Douleur ou malaise</b><span>Poitrine, vertiges : tu arrêtes et tu consultes. Une articulation qui tire : tu remplaces, tu ne forces pas.</span></div>
    <h2 class="st">Tes dernières séances</h2>
    ${hist.length ? `<div class="hist">${hist.map((e) => { const s = sess(e.sid); return `<div class="hrow ${s ? s.cls : ''}"><b>${esc(e.sid)}</b><span>${esc(s ? s.name : '')}</span><em>${esc(dayName(e.date))} ${esc(dShort(e.date))}</em><button class="x" data-act="del-log" data-id="${esc(e.id)}" aria-label="Retirer">×</button></div>`; }).join('')}</div>` : '<p class="note">Rien encore. Ta première séance apparaîtra ici.</p>'}`;
}
function renderFood() {
  const n = nutrition(); const ram = isRamadan();
  const meal = (m) => `<div class="meal"><div class="mh"><b>${esc(m.name)}</b><i>${esc(m.when)}</i></div><div class="ings">${m.items.map((x) => `<div><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('')}</div><div class="mk"><span>${m.tot.kcal} kcal</span><span>${m.tot.p} g de protéines</span></div><p class="note">${esc(m.prep)}</p></div>`;
  $('#tab-food').innerHTML = `<div class="kpi"><div><b>${n.target.toLocaleString('fr-BE')}</b><span>kcal par jour (ta cible)</span></div><div><b>${D.day.p} g</b><span>de protéines</span></div><div><b>3 L</b><span>d’eau</span></div></div>
    ${n.adds.length ? `<div class="rule"><b>Pour toi, en plus du menu</b><span>${n.adds.map((a) => esc(a[0])).join(' · ')}. Ta dépense estimée : ${n.tdee.toLocaleString('fr-BE')} kcal par jour.</span></div>` : ''}
    ${n.less ? `<div class="rule"><b>Ajustement</b><span>${esc(n.less)}</span></div>` : ''}
    <h2 class="st">Ton menu, tous les jours<span>tout se pèse cru</span></h2>${D.meals.map(meal).join('')}
    <div class="totb"><div><b>${D.day.kcal.toLocaleString('fr-BE')}</b><span>kcal</span></div><div><b>${D.day.p} g</b><span>protéines</span></div><div><b>${D.day.c} g</b><span>glucides</span></div><div><b>${D.day.f} g</b><span>lipides</span></div></div>
    <h2 class="st">Tu changes sans recalculer</h2>
    <div class="rule"><b>À la place des 300 g de poulet</b><span>300 g de dinde · 300 g de bœuf haché 5 % · 380 g de poisson blanc · 250 g de saumon (sans huile)</span></div>
    <div class="rule"><b>À la place des 90 g de riz</b><span>400 g de pommes de terre · 90 g de pâtes · 90 g de semoule · 120 g de pain</span></div>
    <h2 class="st">Les règles</h2>
    <div class="rule"><b>Zéro calorie liquide</b><span>Eau, café, thé sans sucre, sodas zéro.</span></div>
    <div class="rule"><b>Un repas libre par semaine</b><span>Il remplace l’assiette. Une assiette, pas un buffet. Si tu craques : jamais deux fois de suite.</span></div>
    <div class="rule"><b>Chez ta mère</b><span>Moitié légumes, un quart viande, un quart féculent, une louche de sauce.</span></div>
    <div class="rule"><b>Compléments</b><span>Whey 60 g par jour (certifiée halal). Créatine 5 g par jour avec le bol.</span></div>
    <div class="rule ${ram ? 'on' : ''}"><b>Pendant le Ramadan</b><span>Iftar : 3 dattes, eau, soupe. Après la prière : l’assiette avec 70 g de riz. Soirée : 200 g de skyr et la créatine. Suhoor : le bol.</span></div>
    <p class="note">Valeurs moyennes, calculées sur ces portions. Ce n’est pas un avis médical.</p>`;
}
function chart() {
  const p = P(); const W = weights(); if (!p) return '';
  const t = todayISO(); const d0 = p.startDate; const end = addDays(d0, 7 * 17);
  const dEnd = t > end ? t : end;
  const span = Math.max(14, diffDays(d0, dEnd));
  const ys = W.map((x) => x.kg).concat([p.startKg, p.goalKg]);
  const lo = Math.floor(Math.min(...ys) - 1), hi = Math.ceil(Math.max(...ys) + 1);
  const X0 = 34, X1 = 352, Y0 = 16, Y1 = 220;
  const x = (d) => X0 + (X1 - X0) * Math.max(0, Math.min(1, diffDays(d0, d) / span));
  const y = (kg) => Y1 - (Y1 - Y0) * (kg - lo) / (hi - lo);
  let planPts = ''; for (let k = 0; k <= span; k += 3) { const d = addDays(d0, k); planPts += `${x(d).toFixed(1)},${y(planKg(d)).toFixed(1)} `; }
  const pts = W.filter((w) => w.d >= d0).map((w) => `${x(w.d).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ');
  const grid = []; const step = (hi - lo) > 12 ? 4 : 2; for (let g = Math.ceil(lo / step) * step; g <= hi; g += step) grid.push(`<line x1="${X0}" x2="${X1}" y1="${y(g)}" y2="${y(g)}" class="gl"/><text x="${X0 - 6}" y="${y(g) + 4}" class="gt" text-anchor="end">${g}</text>`);
  const dots = W.filter((w) => w.d >= d0).slice(-40).map((w) => `<circle cx="${x(w.d).toFixed(1)}" cy="${y(w.kg).toFixed(1)}" r="3.4" class="wd"/>`).join('');
  return `<svg class="chart" viewBox="0 0 360 240" role="img" aria-label="Évolution du poids et objectif">${grid.join('')}
    <polyline points="${planPts}" class="pl"/>${pts ? `<polyline points="${pts}" class="wl"/>` : ''}${dots}
    <text x="${X1}" y="${y(p.goalKg) - 6}" class="gt" text-anchor="end">objectif ${fr(p.goalKg, 0)} kg</text></svg>
    <div class="legend"><span><i class="lw"></i>tes pesées</span><span><i class="lp"></i>le plan (≈ 1 kg par semaine)</span></div>`;
}
function renderWeight() {
  const p = P(); const t = todayISO(); const W = weights(); const lw = lastWeight();
  const a7 = avg7(t); const pl = p ? planKg(t) : null;
  let verdict = '';
  if (p && a7 != null && weekNo() > 1) {
    const dlt = a7 - pl;
    verdict = Math.abs(dlt) <= 1 ? 'Dans le plan. Tu ne touches à rien.' : (dlt > 1 ? `Au-dessus du plan de ${fr(dlt)} kg : vérifie tes pesées d’aliments, puis riz à 50 g ou 2 000 pas de plus.` : `Plus vite que le plan de ${fr(-dlt)} kg : ajoute une banane et 20 g de flocons. Jamais sous 1 800 kcal.`);
  }
  $('#tab-weight').innerHTML = `<div class="wform"><label for="wIn">Ta pesée du ${esc(dShort(t))}</label><div class="wrow"><input id="wIn" inputmode="decimal" placeholder="${lw ? fr(lw.kg) : '106,0'}" value="${S.weights[t] ? fr(S.weights[t].kg) : ''}"><span>kg</span><button class="big sm" data-act="save-w">Enregistrer</button></div><p class="note">Le matin, à jeun, après les toilettes. La moyenne de la semaine compte, pas un jour.</p></div>
    <div class="kpi"><div><b>${lw ? fr(lw.kg) : '—'}</b><span>dernière pesée</span></div><div><b>${p && lw ? fr(p.startKg - lw.kg) : '—'}</b><span>kg perdus</span></div><div><b>${a7 != null ? fr(a7) : '—'}</b><span>moyenne 7 jours</span></div></div>
    ${verdict ? `<div class="rule on"><b>Le verdict</b><span>${esc(verdict)}</span></div>` : ''}
    ${chart()}
    <h2 class="st">Tes pesées</h2>${W.length ? `<div class="hist">${W.slice(-30).reverse().map((w) => `<div class="hrow"><b>${fr(w.kg)} kg</b><span>${esc(dayName(w.d))}</span><em>${esc(dShort(w.d))}</em><button class="x" data-act="del-w" data-d="${w.d}" aria-label="Supprimer">×</button></div>`).join('')}</div>` : '<p class="note">Aucune pesée pour l’instant.</p>'}
    ${Acc.on ? '<p class="note">Tes pesées sont les mêmes que dans l’ancienne appli Mes Calories.</p>' : ''}`;
}

/* ===== La séance : séries à cocher, charges, minuteur ===== */
let view = null; // { sid, date, run: bool }
function openSession(sid, run) {
  const t = todayISO();
  if (run) {
    if (!S.active || S.active.date !== t || S.active.sid !== sid) S.active = { id: 'l-' + t + '-' + uid(), sid, date: t, sets: {}, kg: {}, startedAt: Date.now() };
    saveLocal(); summary();
  }
  view = { sid, run: !!run };
  drawSheet();
}
function drawSheet() {
  if (!view) { $('#sheet').hidden = true; document.body.classList.remove('locked'); return; }
  const t = todayISO(); const b = buildSession(view.sid, t); const s = b.s; const A = view.run ? S.active : null;
  const doneSets = A ? Object.values(A.sets).reduce((n, x) => n + x, 0) : 0; const allSets = b.items.reduce((n, it) => n + it.sets, 0);
  const row = (it, i) => {
    const got = A ? (A.sets[it.key] || 0) : 0; const ll = lastLoad(it.key);
    const dots = A ? `<div class="dots">${Array.from({ length: it.sets }, (_, k) => `<button class="dot${k < got ? ' on' : ''}" data-act="set" data-k="${esc(it.key)}" data-i="${k}" aria-label="Série ${k + 1}">${k + 1}</button>`).join('')}</div>` : '';
    const kg = A && it.w ? `<label class="kg">Charge <input inputmode="decimal" data-kg="${esc(it.key)}" value="${A.kg[it.key] != null ? fr(A.kg[it.key], A.kg[it.key] % 1 ? 1 : 0) : ''}" placeholder="${ll != null ? fr(ll, ll % 1 ? 1 : 0) : 'kg'}"> kg</label>` : '';
    const prev = it.w && ll != null ? `<span class="prev">La dernière fois : ${fr(ll, ll % 1 ? 1 : 0)} kg</span>` : '';
    return `<div class="ex${it.fin ? ' fin' : ''}${it.tot ? ' tot sH' : ''}${it.cardio ? ' sK' : ''}${A && got >= it.sets ? ' full' : ''}"><div class="exp">${pic(it.pic)}</div><div class="exb">
      <div class="nm"><i>${it.fin ? '+' : (it.cardio ? '↻' : i + 1)}</i>${esc(it.n)}</div>
      <div class="dr"><b class="dose">${X(it.dose)}${it.x ? `<small> ${esc(it.x)}</small>` : ''}</b>${it.restTxt ? `<span class="rest">⏱ ${esc(it.restTxt)}</span>` : ''}</div>
      <div class="chips">${mark(it.mark)}${prev}</div><p class="cue">${esc(it.cue)}</p>${kg}${dots}</div></div>`;
  };
  let n = 0;
  const rows = b.items.map((it) => row(it, it.fin || it.cardio ? 0 : n++)).join('');
  $('#sheet').innerHTML = `<div class="sh ${s.cls}"><button class="close" data-act="close" aria-label="Fermer">×</button><small>${s.id} · ${esc(s.dur)}${view.run ? ' · ' + esc(dShort(t)) : ''}</small><h1>${esc(s.name)}</h1><p>${esc(s.nick)} · ${esc(s.tags.join(' · '))}</p>
    ${A ? `<div class="prog"><i style="width:${allSets ? Math.round(100 * doneSets / allSets) : 0}%"></i></div><span class="progt">${doneSets} / ${allSets} séries</span>` : ''}</div>
    <div class="shb">${b.note ? `<div class="rule on"><b>Cette semaine</b><span>${esc(b.note)}</span></div>` : ''}
    <p class="warm"><b>Échauffement, 5 min :</b> ${esc(s.warm)}</p>${rows}
    ${A ? `<button class="big" data-act="finish">Séance terminée ✓</button><button class="link" data-act="abandon">Abandonner cette séance</button>`
        : `<button class="big" data-act="start" data-sid="${s.id}">Faire cette séance aujourd’hui</button>`}</div>`;
  $('#sheet').className = 'sheet ' + s.cls; $('#sheet').hidden = false; document.body.classList.add('locked');
}
let timer = null;
function startTimer(sec, label) {
  clearInterval(timer); if (!sec) { $('#timer').hidden = true; return; }
  const end = Date.now() + sec * 1000; const el = $('#timer');
  const tick = () => {
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    el.innerHTML = `<b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b><span>Repos · ${esc(label)}</span><button data-act="skip">Passer</button>`;
    el.hidden = false;
    if (!left) { clearInterval(timer); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* rien */ } el.innerHTML = '<b>GO</b><span>Série suivante</span><button data-act="skip">OK</button>'; setTimeout(() => { el.hidden = true; }, 4000); }
  };
  tick(); timer = setInterval(tick, 500);
}
function finishSession() {
  const A = S.active; if (!A) return;
  const b = buildSession(A.sid, A.date);
  const done = Object.values(A.sets).reduce((n, x) => n + x, 0);
  const t = Date.now();
  for (const [k, v] of Object.entries(A.kg)) if (Number.isFinite(v)) S.loads[k] = { kg: v, at: t };
  S.log[A.id] = { id: A.id, date: A.date, sid: A.sid, done: true, sets: done, of: b.items.reduce((n, it) => n + it.sets, 0), kg: A.kg, at: t };
  S.active = null; view = null; clearInterval(timer); $('#timer').hidden = true;
  drawSheet(); changed(true);
  const n = sess(nextId(todayISO()));
  toast(`✓ ${A.sid} enregistrée. Prochaine : ${n.id} · ${n.name}`);
}

/* ===== Profil, partage ===== */
function profileSheet() {
  const p = P() || { name: '', startKg: '', goalKg: '', startDate: todayISO(), heightCm: '', age: '' };
  const shareTxt = AMI ? '' : `<div class="rule"><b>Partager à un ami</b><span>Il reçoit le même programme, avec son propre profil et ses données sur SON téléphone. Il n’a pas de compte : il ne voit rien de StayClean, ni tes séances, ni tes pesées.</span></div><button class="ghostb" data-act="share">Partager le lien</button>`;
  $('#sheet').innerHTML = `<div class="sh sN"><button class="close" data-act="close" aria-label="Fermer">×</button><small>Profil</small><h1>${P() ? 'Ton profil' : 'Créer ton profil'}</h1><p>Il règle ta trajectoire, ta cible de calories et ta semaine 1.</p></div>
    <div class="shb"><form class="form" data-form="profile">
      <label>Prénom<input name="name" value="${esc(p.name)}" autocomplete="given-name" required></label>
      <div class="two"><label>Poids de départ (kg)<input name="startKg" inputmode="decimal" value="${p.startKg !== '' ? esc(fr(p.startKg)) : ''}" required></label>
      <label>Objectif (kg)<input name="goalKg" inputmode="decimal" value="${p.goalKg !== '' ? esc(fr(p.goalKg)) : ''}" required></label></div>
      <div class="two"><label>Taille (cm)<input name="heightCm" inputmode="numeric" value="${esc(p.heightCm)}" required></label>
      <label>Âge<input name="age" inputmode="numeric" value="${esc(p.age)}" required></label></div>
      <label>Début du programme (semaine 1)<input name="startDate" type="date" value="${esc(p.startDate)}" required></label>
      <button class="big" type="submit">Enregistrer</button></form>
      ${shareTxt}
      ${!AMI ? '<a class="link" href="calories.html">Ouvrir l’ancienne appli Mes Calories</a>' : ''}</div>`;
  $('#sheet').className = 'sheet sN'; $('#sheet').hidden = false; document.body.classList.add('locked'); view = null;
}
function saveProfile(form) {
  const f = new FormData(form);
  const p = { name: String(f.get('name') || '').trim().slice(0, 40), startKg: num(f.get('startKg')), goalKg: num(f.get('goalKg')), heightCm: num(f.get('heightCm')), age: num(f.get('age')), startDate: String(f.get('startDate') || '') };
  if (!p.name || !(p.startKg > 40 && p.startKg < 300) || !(p.goalKg > 40 && p.goalKg < p.startKg) || !(p.heightCm > 120 && p.heightCm < 230) || !(p.age > 12 && p.age < 100) || !/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)) {
    toast('Vérifie les valeurs : l’objectif doit être plus bas que le départ.'); return;
  }
  S.profile = p; S.profileAt = Date.now();
  if (!S.weights[p.startDate] && !weights().length) { S.weights[p.startDate] = { kg: p.startKg, at: Date.now() }; S.dirtyW[p.startDate] = 1; }
  $('#sheet').hidden = true; document.body.classList.remove('locked');
  changed(true); toast('Profil enregistré.');
}
async function share() {
  const url = location.origin + location.pathname + '?ami=1';
  const text = 'Le Camp : 6 séances d’athlète, la nutrition et le suivi du poids. Ouvre le lien, crée ton profil, puis « Ajouter à l’écran d’accueil ».';
  try { if (navigator.share) { await navigator.share({ title: 'Le Camp', text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Lien copié : envoie-le à ton ami.'); } catch (e) { prompt('Copie ce lien pour ton ami :', url); }
}

/* ===== Actions ===== */
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'tab') { tab = b.dataset.tab; document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== 'tab-' + tab; }); document.querySelectorAll('.nav__tab').forEach((x) => x.classList.toggle('is-on', x.dataset.tab === tab)); $('#sheet').hidden = true; view = null; document.body.classList.remove('locked'); render(); scrollTo(0, 0); }
  else if (a === 'open') openSession(b.dataset.sid, false);
  else if (a === 'start') {
    const t = todayISO();
    if (doneOn(t).length && !confirm('Tu as déjà fait une séance aujourd’hui. Jamais deux le même jour : tu veux vraiment commencer celle-ci ?')) return;
    if (S.active && S.active.date === t && S.active.sid !== b.dataset.sid && Object.keys(S.active.sets).length && !confirm('Une autre séance est commencée. La remplacer ?')) return;
    openSession(b.dataset.sid, true); render();
  }
  else if (a === 'resume') openSession(S.active.sid, true);
  else if (a === 'close') { view = null; $('#sheet').hidden = true; document.body.classList.remove('locked'); render(); }
  else if (a === 'set') {
    const A = S.active; if (!A) return; const k = b.dataset.k; const i = +b.dataset.i; const cur = A.sets[k] || 0;
    A.sets[k] = i < cur ? i : i + 1;
    saveLocal(); drawSheet();
    const it = buildSession(A.sid, A.date).items.find((x) => x.key === k);
    if (A.sets[k] > cur && it && it.rest && A.sets[k] < it.sets) startTimer(it.rest, it.n);
    else if (A.sets[k] > cur) { clearInterval(timer); $('#timer').hidden = true; }
  }
  else if (a === 'skip') { clearInterval(timer); $('#timer').hidden = true; }
  else if (a === 'finish') {
    const A = S.active; const done = A ? Object.values(A.sets).reduce((n, x) => n + x, 0) : 0;
    if (!done && !confirm('Aucune série cochée. Enregistrer quand même la séance comme faite ?')) return;
    finishSession();
  }
  else if (a === 'abandon') { if (!confirm('Abandonner cette séance ? Elle ne comptera pas.')) return; S.active = null; view = null; drawSheet(); clearInterval(timer); $('#timer').hidden = true; saveLocal(); summary(); render(); }
  else if (a === 'profile') profileSheet();
  else if (a === 'share') share();
  else if (a === 'save-w') {
    const v = num($('#wIn').value); const t = todayISO();
    if (!(v > 40 && v < 300)) { toast('Entre ton poids en kg, par exemple 104,6.'); return; }
    S.weights[t] = { kg: Math.round(v * 10) / 10, at: Date.now() }; S.dirtyW[t] = 1; changed(false); toast('Pesée enregistrée.');
  }
  else if (a === 'del-w') { const d = b.dataset.d; if (!confirm('Supprimer la pesée du ' + dShort(d) + ' ?')) return; delete S.weights[d]; S.dirtyW[d] = 1; changed(false); }
  else if (a === 'del-log') { const e = S.log[b.dataset.id]; if (!e || !confirm('Retirer la séance ' + e.sid + ' du ' + dShort(e.date) + ' ?')) return; e.del = true; e.at = Date.now(); changed(true); }
  else if (a === 'go-agenda') { location.href = 'index.html'; }
});
document.addEventListener('input', (ev) => {
  const i = ev.target.closest('[data-kg]'); if (!i || !S.active) return;
  const v = num(i.value); if (v == null) delete S.active.kg[i.dataset.kg]; else if (v >= 0 && v < 500) S.active.kg[i.dataset.kg] = v;
  saveLocal();
});
document.addEventListener('submit', (ev) => { const f = ev.target.closest('[data-form="profile"]'); if (!f) return; ev.preventDefault(); saveProfile(f); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { render(); if (Acc.on) pull(); } });
window.addEventListener('online', () => { if (Acc.on) pull(); });

/* ===== Démarrage ===== */
if (!S.profile && !AMI) { const c = agendaConf(); if (c) S.profile = defaultProfile(c.prenom); }
render(); summary();
if (!S.profile) profileSheet();
if (S.active && S.active.date !== todayISO()) {
  /* séance commencée un autre jour et jamais terminée */
  const A = S.active; const done = Object.values(A.sets).reduce((n, x) => n + x, 0);
  if (done) { S.log[A.id] = { id: A.id, date: A.date, sid: A.sid, done: true, sets: done, kg: A.kg, at: Date.now() }; for (const [k, v] of Object.entries(A.kg)) if (Number.isFinite(v)) S.loads[k] = { kg: v, at: Date.now() }; }
  S.active = null; changed(true);
}
connect().then(() => { summary(); render(); });
window.__SP = { get S() { return S; }, Acc, todayStatus, nextId, buildSession, nutrition, planKg, pull, push, render };
})();
