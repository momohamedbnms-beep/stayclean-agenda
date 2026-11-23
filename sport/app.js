/* Mon Programme (« Le Camp ») — StayClean Agenda. Version 2 : le coach.
   - Accueil = le tableau des 6 séances (J1 → J6). On fait la suivante, le jour qu'on veut ; une séance faite se barre
     (croix rouge), même faite ailleurs (« Déjà faite » : aujourd'hui ou hier). Les 6 barrées = semaine bouclée, on repart.
   - GO = le coach : un exercice à la fois, série par série (combien, lourd ou pas, à fond ou non), charge proposée,
     repos chronométré, voix, minuteurs pour le gainage, la corde et les sprints.
   - Depuis l'agenda : même compte (cal_items : pesées partagées avec Mes Calories, programme dans settings/sport).
   - Lien ami « sport.html?ami=Prénom » : tout reste sur SON téléphone ; aucun compte, aucune lecture de l'agenda.
   Contenu des séances : sport/data.js (généré par sport/sources/gen_sport.py). */
'use strict';
(function () {
const D = window.SP_DATA || {}; const FR = window.SP_FRAMES || {};

/* ===== Utilitaires ===== */
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' });
function todayISO() { return window.__SP_TODAY || _day.format(new Date()); }
function parseISO(s) { const p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function addDays(s, n) { return new Date(parseISO(s) + n * 864e5).toISOString().slice(0, 10); }
function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 864e5); }
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function dShort(s) { const d = new Date(parseISO(s)); return d.getUTCDate() + ' ' + MOIS[d.getUTCMonth()]; }
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
function dWhen(s) { const t = todayISO(); if (s === t) return 'aujourd’hui'; if (s === addDays(t, -1)) return 'hier'; return JOURS[new Date(parseISO(s)).getUTCDay()] + ' ' + dShort(s); }
function fr(n, dec) { const d = dec == null ? 1 : dec; return Number(n).toLocaleString('fr-BE', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function kgTxt(n) { return Number.isInteger(n) ? String(n) : fr(n, 1); }
function num(v) { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : null; }
function uid() { return Math.random().toString(36).slice(2, 10); }
function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
function mmss(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2400); }

/* ===== Mode, stockage ===== */
const params = new URLSearchParams(location.search);
const AMI = params.has('ami');
const AMI_NAME = (params.get('ami') || '').replace(/[^\p{L}\p{M} '-]/gu, '').slice(0, 30);
const KEY = 'sp.state.v1';
function emptyState() { return { v: 2, uid: null, profile: null, profileAt: 0, log: {}, loads: {}, best: {}, weights: {}, dirtyW: {}, dirtyDoc: false, active: null, prefs: { voice: true } }; }
let S = emptyState();
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(emptyState(), JSON.parse(raw)); } catch (e) { /* rien */ }
if (!S.prefs) S.prefs = { voice: true };
if (!S.best) S.best = {};
/* v1 → v2 : les charges étaient rangées par position (« J1:0 ») */
(function migrate() {
  const map = {}; (D.sessions || []).forEach((s) => (s.old || []).forEach((id, i) => { map[s.id + ':' + i] = id; }));
  for (const k of Object.keys(S.loads)) if (map[k] && !S.loads[map[k]]) { S.loads[map[k]] = S.loads[k]; delete S.loads[k]; }
  if (S.active && !S.active.v2) S.active = null;
  S.v = 2;
})();
let storeOk = true;
function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); storeOk = true; } catch (e) { storeOk = false; } }

/* ===== Compte (seulement depuis l'agenda) ===== */
const Acc = { sb: null, uid: null, on: false, state: AMI ? 'ami' : 'local', pulling: null, pushing: false, again: false };
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
  const conf = agendaConf(); if (!conf) return;
  const id = storedUser(conf);
  if (!id || !window.supabase || typeof window.supabase.createClient !== 'function') { Acc.state = id ? 'local' : 'signedout'; return; }
  try { Acc.sb = window.supabase.createClient(conf.url, conf.key); } catch (e) { Acc.sb = null; return; }
  let u = id;
  try { const r = await Acc.sb.auth.getSession(); const su = r && r.data && r.data.session && r.data.session.user; if (su && su.id) u = su.id; } catch (e) { /* hors ligne */ }
  if (S.uid && S.uid !== u) { const p = S.prefs; S = emptyState(); S.prefs = p; }
  S.uid = u; Acc.uid = u; Acc.on = true; Acc.state = 'sync';
  if (!S.profile) S.profile = defaultProfile(conf.prenom);
  saveLocal();
  await pull();
  setInterval(() => { if (document.visibilityState === 'visible' && !Player.on) pull(); }, 60000);
}
function netErr(e) { return /fetch|network|load failed|timeout|offline/i.test(String((e && (e.message || e.name)) || e || '')); }
function mergeMap(a, b) { const o = Object.assign({}, a); for (const [k, v] of Object.entries(b || {})) if (!o[k] || (v.at || 0) > (o[k].at || 0)) o[k] = v; return o; }
function mergeDoc(a, b) {
  const out = { profile: a.profile, profileAt: a.profileAt || 0, log: Object.assign({}, a.log), loads: Object.assign({}, a.loads), best: Object.assign({}, a.best) };
  if (!b) return out;
  if (b.profile && (b.profileAt || 0) > out.profileAt) { out.profile = b.profile; out.profileAt = b.profileAt; }
  out.log = mergeMap(out.log, b.log); out.loads = mergeMap(out.loads, b.loads); out.best = mergeMap(out.best, b.best);
  return out;
}
function docOf(s) { return { v: 2, profile: s.profile, profileAt: s.profileAt, log: s.log, loads: s.loads, best: s.best }; }
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
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || S.dirtyW[date]) continue;
        if (r.deleted) delete S.weights[date];
        else if (r.data && Number.isFinite(+r.data.kg)) S.weights[date] = { kg: +r.data.kg, at: Date.parse(r.data.updatedAt || r.data.at || r.updated_at) || 0 };
      }
      const remote = d.data && d.data[0] && !d.data[0].deleted ? d.data[0].data : null;
      const m = mergeDoc(docOf(S), remote);
      const rn = remote ? mergeDoc({ profile: remote.profile, profileAt: remote.profileAt, log: remote.log || {}, loads: remote.loads || {}, best: remote.best || {} }, null) : null;
      if (!rn || JSON.stringify(m) !== JSON.stringify(rn)) S.dirtyDoc = true;
      Object.assign(S, m);
      Acc.state = 'sync'; saveLocal(); if (!Player.on) render();
      await push();
    } catch (e) {
      const msg = String((e && (e.message || e.code)) || '');
      Acc.state = netErr(e) ? 'offline' : (/jwt|auth|401/i.test(msg) ? 'signedout' : 'error');
      if (!Player.on) render();
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
    Acc.state = 'sync';
  } catch (e) { Acc.state = netErr(e) ? 'offline' : 'error'; }
  finally { Acc.pushing = false; if (Acc.again) { Acc.again = false; push(); } }
}
const pushSoon = debounce(push, 1200);
function changed(doc) { if (doc) S.dirtyDoc = true; saveLocal(); summary(); if (Acc.on) pushSoon(); if (!Player.on) render(); }

/* ===== Profil ===== */
function defaultProfile(prenom) { return { name: prenom || 'Mohamed', startKg: 106, goalKg: 87, startDate: '2026-11-23', heightCm: 184, age: 24 }; }
function P() { return S.profile; }

/* ===== Le programme : semaine, Ramadan, tableau des 6 ===== */
function weekNo(date) { const p = P(); if (!p) return 1; return Math.max(1, Math.floor(diffDays(p.startDate, date || todayISO()) / 7) + 1); }
function isRamadan(date) { const d = date || todayISO(); return !!D.ramadan && d >= D.ramadan[0] && d <= D.ramadan[1]; }
function order(date) { return isRamadan(date) ? D.ramadanOrder : D.sessions.map((s) => s.id); }
function sess(id) { return D.sessions.find((s) => s.id === id); }
function doneLog() { return Object.values(S.log).filter((e) => e && e.done && !e.del).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.at || 0) - (b.at || 0))); }
/* Le tableau : les séances barrées du cycle en cours. Un cycle se ferme quand toutes sont faites. */
function board() {
  const t = todayISO(); const ord = order(t); const L = doneLog();
  let cur = []; let set = new Set(); let closedOn = null;
  for (const e of L) {
    if (closedOn || set.has(e.sid)) { cur = []; set = new Set(); closedOn = null; }
    cur.push(e); set.add(e.sid);
    if (ord.every((id) => set.has(id))) closedOn = e.date;
  }
  if (closedOn && closedOn < t) { cur = []; set = new Set(); closedOn = null; }   // bouclée un jour d'avant : tableau neuf
  const byId = {}; cur.forEach((e) => { byId[e.sid] = e; });
  const next = ord.find((id) => !byId[id]) || null;
  return { ord, byId, next, count: ord.filter((id) => byId[id]).length, full: !!closedOn, today: L.filter((e) => e.date === t) };
}
function tiers(w) { return w <= 2 ? 0 : (w <= 6 ? 1 : 2); }
/* La séance d'un jour, compilée en étapes pour le coach */
function plan(sid, date) {
  const s = sess(sid); const w = weekNo(date); const ram = isRamadan(date); const lessOne = w <= 2 || w === 7;
  const adj = (n) => { let x = n; if (x >= 3 && lessOne) x -= 1; if (ram) x = Math.min(x, 3); return x; };
  const exs = [];
  for (const e0 of s.ex) {
    if (ram && (e0.fin || e0.tot)) continue;
    const e = Object.assign({}, e0);
    if (e.mode !== 'steady' && e.mode !== 'totale') e.sets = adj(e.sets);
    if (e.mode === 'circuit' && ram) e.sets = 2;
    if (e.vest) { const v = D.vest[tiers(w)]; if (!e.cardio) e.min = parseInt(v[2], 10); e.spec = (e.spec || []).concat([v[1].replace(/^./, (c) => c.toUpperCase())]); }
    if (e.mode === 'totale') {
      const lv = D.totale[tiers(w)]; e.sets = parseInt(lv[1], 10);
      e.work = e.part === 1 ? (tiers(w) === 0 ? 20 : 30) : 30; e.alt = e.part === 1 ? (tiers(w) === 0 ? 40 : 30) : 30;
      e.spec = e.part === 1 ? [] : [tiers(w) === 0 ? 'Marche rapide 6 km/h' : (tiers(w) === 1 ? 'Course 8 km/h' : 'Course 9–10 km/h'), tiers(w) === 0 ? 'Pente 10 %' : 'Pente 6 %'];
    }
    exs.push(e);
  }
  const steps = [{ t: 'steady', warm: true, ex: { id: sid + ':warm', name: 'Échauffement', pic: s.pic === 'swim' ? 'swim' : 'rope', lvl: 'facile', spec: s.warm.spec, cue: '' }, sec: s.warm.min * 60 }];
  exs.forEach((e, xi) => {
    const prev = exs[xi - 1];
    if (prev && prev.rest && e.mode !== 'steady') steps.push({ t: 'rest', sec: Math.min(prev.rest, 120), next: true, xi });
    const n = e.sets;
    if (e.mode === 'reps' || e.mode === 'dist') {
      for (let i = 1; i <= n; i++) { steps.push({ t: 'set', ex: e, xi, i, n }); if (i < n && e.rest) steps.push({ t: 'rest', sec: e.rest, xi }); }
      if (e.kg) steps.push({ t: 'feel', ex: e, xi });
    } else if (e.mode === 'timed') {
      for (let i = 1; i <= n; i++) { steps.push({ t: 'timed', ex: e, xi, i, n, sec: e.sec }); if (i < n && e.rest) steps.push({ t: 'rest', sec: e.rest, xi }); }
    } else if (e.mode === 'hold') {
      for (let i = 1; i <= n; i++) { steps.push({ t: 'hold', ex: e, xi, i, n }); if (i < n && e.rest) steps.push({ t: 'rest', sec: e.rest, xi }); }
    } else if (e.mode === 'steady') {
      steps.push({ t: 'steady', ex: e, xi, sec: e.min * 60 });
    } else if (e.mode === 'circuit') {
      for (let i = 1; i <= n; i++) {
        e.stations.forEach((st, k) => {
          const x = { ex: e, xi, i, n, st, auto: k > 0 };
          steps.push(st.sec ? Object.assign({ t: 'timed', sec: st.sec }, x) : Object.assign({ t: 'set' }, x));
        });
        if (i < n) steps.push({ t: 'rest', sec: e.rest, xi });
      }
    } else if (e.mode === 'totale') {
      const ABS = [['crunch', 'Crunch'], ['legraise', 'Relevés de jambes'], ['climber', 'Mountain climbers'], ['plank', 'Planche']];
      for (let i = 1; i <= n; i++) {
        if (e.part === 1) {
          steps.push({ t: 'timed', ex: e, xi, i, n, sec: e.work, st: { pic: 'rope', name: 'Corde' }, auto: i > 1 });
          const a = ABS[(i - 1) % ABS.length]; steps.push({ t: 'timed', ex: e, xi, i, n, sec: e.alt, st: { pic: a[0], name: a[1] }, auto: true });
        } else {
          steps.push({ t: 'timed', ex: e, xi, i, n, sec: e.work, st: { pic: 'run', name: 'Sprint', spec: e.spec }, auto: i > 1 });
          steps.push({ t: 'timed', ex: e, xi, i, n, sec: e.alt, st: { pic: 'treadmill', name: 'Marche', spec: ['4,5 km/h'] }, auto: true, easy: true });
        }
      }
    }
  });
  steps.push({ t: 'end' });
  return { s, w, ram, exs, steps };
}
function suggestKg(ex) {
  const l = S.loads[ex.id]; if (!l || !Number.isFinite(l.kg)) return { kg: null, up: 0 };
  if (l.feel === 'facile' && ex.step) return { kg: Math.round((l.kg + ex.step) * 10) / 10, up: ex.step, last: l.kg };
  return { kg: l.kg, up: 0, last: l.kg };
}

/* ===== Poids, trajectoire, nutrition ===== */
function weights() { return Object.entries(S.weights).filter(([, v]) => v && Number.isFinite(v.kg)).map(([d, v]) => ({ d, kg: v.kg })).sort((a, b) => (a.d < b.d ? -1 : 1)); }
function lastWeight() { const w = weights(); return w.length ? w[w.length - 1] : null; }
function planKg(date) {
  const p = P(); if (!p) return null;
  const x = diffDays(p.startDate, date) / 7; if (x <= 0) return p.startKg;
  const k = p.startKg / 106; const st = D.steps; let kg = p.startKg;
  for (let i = 0; i < Math.floor(x) && i < st.length; i++) kg -= st[i] * k;
  const i2 = Math.floor(x); kg -= (i2 < st.length ? st[i2] : 0.75) * k * (x - i2);
  if (x > st.length) kg -= (Math.floor(x) - st.length) * 0.75 * k;
  return Math.max(p.goalKg, kg);
}
function avg7(date) { let s = 0, n = 0; for (let i = 0; i < 7; i++) { const v = S.weights[addDays(date, -i)]; if (v && Number.isFinite(v.kg)) { s += v.kg; n++; } } return n ? s / n : null; }
function nutrition() {
  const p = P(); const lw = lastWeight(); const kg = lw ? lw.kg : (p ? p.startKg : 106);
  const tdee = (10 * kg + 6.25 * ((p && p.heightCm) || 180) - 5 * ((p && p.age) || 25) + 5) * 1.5;
  const target = Math.min(2600, Math.max(1800, Math.round((tdee - 1100) / 50) * 50));
  const ADD = [['+ 150 g skyr', 95], ['+ 30 g riz', 105], ['+ 1 banane', 105], ['+ 20 g flocons', 75]];
  let extra = target - D.day.kcal; const adds = []; let i = 0;
  while (extra >= 75 && i < 8) { const a = ADD[i % ADD.length]; adds.push(a[0]); extra -= a[1]; i++; }
  return { target, adds, less: target < D.day.kcal - 100 };
}

/* ===== Résumé pour la carte de l'agenda ===== */
function summary() {
  if (AMI) return;
  let fromAgenda = false; try { fromAgenda = sessionStorage.getItem('sp.from') === 'agenda'; } catch (e) { /* rien */ }
  if (!agendaConf() && !fromAgenda) return;
  try {
    const b = board(); const t = todayISO(); const lw = lastWeight(); const n = b.next && sess(b.next);
    const k = S.active && S.active.date === t ? 'active' : (b.today.length ? 'done' : (b.full ? 'rest' : 'go'));
    localStorage.setItem('sp.summary.v1', JSON.stringify({ uid: Acc.uid || S.uid || null, date: t, k, sid: k === 'active' ? S.active.sid : (b.today.length ? b.today[b.today.length - 1].sid : null), next: n ? n.id + ' · ' + n.name : '', count: b.count, of: b.ord.length, kg: lw ? lw.kg : null, at: Date.now() }));
  } catch (e) { /* facultatif */ }
}

/* ===== Briques visuelles ===== */
const LV = { lourd: ['LOURD', 'garde 2 reps'], moyen: ['SOLIDE', 'garde 2 reps'], controle: ['CONTRÔLÉ', 'lent et propre'], explosif: ['EXPLOSIF', 'vite et fort'],
  gainage: ['GAINAGE', 'tiens propre'], facile: ['TRANQUILLE', 'respire'], endurance: ['ENDURANCE', 'tu dois pouvoir parler'] };
function anim(k, cls) { const f = FR[k] || []; if (!f.length) return ''; return f.length > 1 ? `<div class="anim ${cls || ''}"><div class="fa">${f[0]}</div><div class="fb">${f[1]}</div></div>` : `<div class="anim one ${cls || ''}">${f[0]}</div>`; }
function still(k) { const f = FR[k] || []; return f.length ? `<div class="anim still">${f[f.length - 1]}</div>` : ''; }
const IC = {
  board: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M15 15l5 5M20 15l-5 5"/></svg>',
  food: '<svg viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
  scale: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 10a5 5 0 0 1 8 0M12 10.2l1.6-1.8"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>', back: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/></svg>',
  share: '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
};
function ring(frac, label, sub, cls) {
  const R = 88, C = 2 * Math.PI * R;
  return `<div class="ring ${cls || ''}"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="${R}" class="rb"/><circle cx="100" cy="100" r="${R}" class="rf" style="stroke-dasharray:${C.toFixed(1)};stroke-dashoffset:${(C * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1)}"/></svg><div class="rt"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
}

/* ===== Écrans ===== */
let tab = 'home';
function render() {
  renderTop();
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== 'tab-' + tab; });
  document.querySelectorAll('.nav__tab').forEach((x) => x.classList.toggle('on', x.dataset.tab === tab));
  if (tab === 'home') renderHome(); else if (tab === 'food') renderFood(); else renderWeight();
}
function renderTop() {
  let back = false; if (!AMI) { try { back = sessionStorage.getItem('sp.from') === 'agenda'; } catch (e) { back = false; } }
  const p = P();
  $('#top').innerHTML = `${back ? `<button class="ib" data-act="go-agenda" aria-label="Retour à l’agenda">${IC.back}</button>` : ''}
    <div class="brand"><b>${AMI ? 'LE CAMP' : 'OPÉRATION 87'}</b><span>${p ? esc(p.name) + ' · semaine ' + weekNo() : ''}</span></div>
    <span class="dot-sync ${Acc.state}" title="${Acc.on ? 'Synchronisé avec ton compte' : 'Gardé sur ce téléphone'}"></span>
    <button class="ib" data-act="profile" aria-label="Profil">${IC.gear}</button>`;
}
function coachLine() {
  const L = (D.coach || []).filter((c) => !(AMI && c[1])); if (!L.length) return '';
  return L[(diffDays('2026-01-01', todayISO()) % L.length + L.length) % L.length][0];
}
function renderHome() {
  const el = $('#tab-home'); const p = P();
  if (!p) { el.innerHTML = `<div class="welcome">${anim('swing', 'hero')}<h1>LE CAMP</h1><p>6 séances. Le jour que tu veux.</p><button class="cta" data-act="profile">C’EST PARTI</button></div>`; return; }
  const t = todayISO(); const b = board(); const ram = isRamadan(t);
  const active = S.active && S.active.date === t ? S.active : null;
  const tiles = b.ord.map((id) => {
    const s = sess(id); const e = b.byId[id];
    const st = e ? 'done' : (id === b.next ? 'next' : '');
    return `<button class="tile ${s.cls} ${st}" data-act="preview" data-sid="${id}">
      <span class="tn">${id.slice(1)}</span>${e ? still(s.pic) : anim(s.pic)}
      <span class="tl"><b>${esc(s.name)}</b><small>${e ? '✓ ' + esc(dWhen(e.date)) : esc(s.dur)}</small></span>
      ${e ? '<svg class="cross" viewBox="0 0 100 100" aria-label="faite"><path d="M20 20 80 80M80 20 20 80"/></svg>' : ''}${st === 'next' && !active ? '<span class="nx">GO</span>' : ''}</button>`;
  }).join('');
  let cta = '';
  if (active) { const s = sess(active.sid); cta = `<button class="cta ${s.cls}" data-act="resume">${IC.play}<span>REPRENDRE · ${s.id}</span></button>`; }
  else if (b.full) cta = `<div class="bravo"><b>${b.ord.length}/${b.ord.length} ✓</b><span>Semaine bouclée. Repos quand tu veux.</span></div>`;
  else if (b.next) { const s = sess(b.next); cta = `<button class="cta ${s.cls}" data-act="go" data-sid="${s.id}">${IC.play}<span>GO · ${s.id} ${esc(s.name)}</span></button>`; }
  const lw = lastWeight(); const n = nutrition();
  el.innerHTML = `<div class="bh"><h1>TA SEMAINE</h1><span class="cnt"><b>${b.count}</b>/${b.ord.length}</span></div>
    ${ram ? '<p class="ram">🌙 Ramadan : 4 séances</p>' : ''}
    <div class="board">${tiles}</div>${cta}
    <p class="coach">${esc(coachLine())}</p>
    <div class="minis"><button class="mini" data-act="tab" data-tab="weight">${IC.scale}<b>${lw ? kgTxt(lw.kg) : '—'}<small> kg</small></b></button>
    <button class="mini" data-act="tab" data-tab="food">${IC.food}<b>${n.target.toLocaleString('fr-BE')}<small> kcal</small></b></button></div>`;
}
function doseTxt(x) {
  if (x.mode === 'reps') return `${x.sets}<i>×</i>${esc(x.reps)}`;
  if (x.mode === 'dist') return `${x.sets}<i>×</i>${esc(x.dist)}`;
  if (x.mode === 'timed') return `${x.sets}<i>×</i>${x.sec} s`;
  if (x.mode === 'hold') return `${x.sets}<i>×</i>max`;
  if (x.mode === 'steady') return `${x.min} min`;
  return `${x.sets} tours`;
}
function previewSheet(sid) {
  const t = todayISO(); const pl = plan(sid, t); const s = pl.s; const b = board(); const e = b.byId[sid];
  const rows = pl.exs.map((x) => `<div class="row lv-${x.lvl}">${still(x.pic)}<div><b>${esc(x.name)}</b><span class="lvb">${LV[x.lvl][0]}${x.fin ? ' · ☠ FINISHER' : ''}</span></div><em>${doseTxt(x)}</em></div>`).join('');
  $('#sheet').className = 'sheet ' + s.cls;
  $('#sheet').innerHTML = `<div class="sh"><button class="ib close" data-act="close" aria-label="Fermer">${IC.x}</button>
      <span class="shn">${s.id.slice(1)}</span>${anim(s.pic, 'hero')}<h1>${esc(s.name)}</h1>
      <div class="chips"><span>⏱ ${esc(s.dur)}</span><span>${pl.exs.length} exos</span>${pl.w <= 2 ? '<span>S1–2 : −1 série</span>' : ''}</div></div>
    <div class="shb">${rows}
      ${e ? `<div class="donebox"><span>✓ Faite ${esc(dWhen(e.date))}</span><button data-act="undone" data-id="${esc(e.id)}">Annuler</button></div>`
          : `<button class="cta ${s.cls}" data-act="go" data-sid="${s.id}">${IC.play}<span>GO</span></button>
             <div class="already"><span>Déjà faite ?</span><button data-act="mark" data-sid="${s.id}" data-d="${t}">Aujourd’hui</button><button data-act="mark" data-sid="${s.id}" data-d="${addDays(t, -1)}">Hier</button></div>`}</div>`;
  openSheet();
}
function openSheet() { $('#sheet').hidden = false; $('#sheet').scrollTop = 0; document.body.classList.add('locked'); }
function closeSheet() { $('#sheet').hidden = true; document.body.classList.remove('locked'); }
function renderFood() {
  const n = nutrition(); const ram = isRamadan();
  const meal = (m) => `<div class="meal"><div class="mi">${m.svg}</div><div class="mt"><div class="mh"><b>${esc(m.name)}</b><i>${esc(m.when)}</i></div>
    ${m.items.map((x) => `<div class="ig"><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join('')}</div></div>`;
  $('#tab-food').innerHTML = `<div class="bh"><h1>TON ASSIETTE</h1></div>
    <div class="totb"><div><b>${n.target.toLocaleString('fr-BE')}</b><span>kcal</span></div><div><b>${D.day.p} g</b><span>protéines</span></div><div><b>3 L</b><span>d’eau</span></div></div>
    ${n.adds.length ? `<div class="plus">Pour toi : ${n.adds.map(esc).join(' · ')}</div>` : ''}${n.less ? '<div class="plus">Pour toi : riz 60 g</div>' : ''}
    ${D.meals.map(meal).join('')}
    <div class="swaps"><div><b>Poulet ⇄</b><span>dinde 300 g · bœuf 5 % 300 g · poisson 380 g · saumon 250 g</span></div>
    <div><b>Riz ⇄</b><span>pdt 400 g · pâtes 90 g · semoule 90 g · pain 120 g</span></div></div>
    <div class="rules"><div>⚖️<span>Tout pesé cru</span></div><div>💧<span>Zéro calorie liquide</span></div><div>🍕<span>1 repas libre / sem.</span></div><div>🍲<span>Chez maman : ½ légumes</span></div></div>
    ${ram ? '<div class="plus">🌙 Iftar : 3 dattes, soupe, l’assiette (riz 70 g) · Soirée : 200 g skyr · Suhoor : le bol</div>' : ''}`;
}
function chart() {
  const p = P(); const W = weights().filter((w) => w.d >= p.startDate); const t = todayISO();
  const span = Math.max(28, diffDays(p.startDate, t > addDays(p.startDate, 119) ? t : addDays(p.startDate, 119)));
  const ys = W.map((x) => x.kg).concat([p.startKg, p.goalKg]);
  const lo = Math.floor(Math.min(...ys) - 1), hi = Math.ceil(Math.max(...ys) + 1);
  const X0 = 30, X1 = 352, Y0 = 14, Y1 = 196;
  const x = (d) => X0 + (X1 - X0) * Math.max(0, Math.min(1, diffDays(p.startDate, d) / span));
  const y = (kg) => Y1 - (Y1 - Y0) * (kg - lo) / (hi - lo);
  let pl = ''; for (let k = 0; k <= span; k += 3) { const d = addDays(p.startDate, k); pl += `${x(d).toFixed(1)},${y(planKg(d)).toFixed(1)} `; }
  const pts = W.map((w) => `${x(w.d).toFixed(1)},${y(w.kg).toFixed(1)}`).join(' ');
  const step = (hi - lo) > 12 ? 5 : 2; let g = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) g += `<line x1="${X0}" x2="${X1}" y1="${y(v)}" y2="${y(v)}" class="gl"/><text x="${X0 - 5}" y="${y(v) + 4}" class="gt" text-anchor="end">${v}</text>`;
  return `<svg class="chart" viewBox="0 0 360 210" role="img" aria-label="Évolution du poids">${g}<polyline points="${pl}" class="pl"/>${pts ? `<polyline points="${pts}" class="wl"/>` : ''}${W.slice(-30).map((w) => `<circle cx="${x(w.d).toFixed(1)}" cy="${y(w.kg).toFixed(1)}" r="3.5" class="wd"/>`).join('')}</svg>
    <div class="legend"><span><i class="lw"></i>toi</span><span><i class="lp"></i>le plan</span></div>`;
}
let wDraft = null;
function renderWeight() {
  const p = P(); const t = todayISO(); const lw = lastWeight();
  if (wDraft == null) wDraft = S.weights[t] ? S.weights[t].kg : (lw ? lw.kg : (p ? p.startKg : 100));
  const a7 = avg7(t); let verdict = '';
  if (p && a7 != null && weekNo() > 1) { const d = a7 - planKg(t); verdict = Math.abs(d) <= 1 ? '✓ Dans le plan' : (d > 1 ? '⚠ Au-dessus du plan : riz 50 g ou +2 000 pas' : '⚡ Plus vite que le plan : +1 banane'); }
  $('#tab-weight').innerHTML = `<div class="bh"><h1>TON POIDS</h1></div>
    <div class="wcard"><button class="stp" data-act="w-" aria-label="Moins">−</button><div class="wv"><b>${fr(wDraft)}</b><small>kg</small></div><button class="stp" data-act="w+" aria-label="Plus">+</button></div>
    <button class="cta" data-act="save-w">${S.weights[t] ? 'MODIFIER' : 'ENREGISTRER'} · ${esc(dShort(t))}</button>
    <div class="kpis"><div><b>${p && lw ? fr(p.startKg - lw.kg) : '—'}</b><span>kg perdus</span></div><div><b>${a7 != null ? fr(a7) : '—'}</b><span>moy. 7 jours</span></div><div><b>${p ? kgTxt(p.goalKg) : '—'}</b><span>objectif</span></div></div>
    ${verdict ? `<p class="verdict">${esc(verdict)}</p>` : ''}${p ? chart() : ''}
    <div class="wl-list">${weights().slice(-6).reverse().map((w) => `<div><b>${fr(w.kg)}</b><span>${esc(dWhen(w.d))}</span><button data-act="del-w" data-d="${w.d}" aria-label="Supprimer">${IC.x}</button></div>`).join('')}</div>`;
}

/* ===== Le coach (lecteur de séance) ===== */
const Player = { on: false, pl: null, tick: null, wake: null };
const Voice = {
  speak(txt) {
    if (!S.prefs.voice || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'fr-FR'; u.rate = 1.05;
      const v = speechSynthesis.getVoices().find((x) => /^fr/i.test(x.lang)); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) { /* rien */ }
  },
};
const Beep = { ctx: null,
  init() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { this.ctx = null; } },
  play(f, ms) { if (!this.ctx || !S.prefs.voice) return; try { const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.frequency.value = f; g.gain.value = 0.18; o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + ms / 1000); } catch (e) { /* rien */ } },
};
function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* rien */ } }
async function wakeOn() { try { if ('wakeLock' in navigator) Player.wake = await navigator.wakeLock.request('screen'); } catch (e) { Player.wake = null; } }
function wakeOff() { try { if (Player.wake) Player.wake.release(); } catch (e) { /* rien */ } Player.wake = null; }
function spokenReps(r) { return String(r || '').replace(/–/g, ' à '); }
function startPlayer(sid, fresh) {
  const t = todayISO();
  if (fresh || !S.active || S.active.date !== t || S.active.sid !== sid) S.active = { v2: true, id: 'l-' + t + '-' + uid(), sid, date: t, startedAt: Date.now(), step: 0, kg: {}, feel: {}, hold: {}, done: {}, timer: null };
  Player.on = true; Player.pl = plan(sid, t); Beep.init(); wakeOn(); endedView = false; $('#toast').hidden = true;
  saveLocal(); summary(); closeSheet();
  $('#player').hidden = false; document.body.classList.add('locked');
  enterStep();
}
function curStep() { return Player.pl.steps[S.active.step]; }
function enterStep() {
  const st = curStep(); const A = S.active;
  A.timer = null; lastBeep = -1;
  if (st.t === 'rest') { A.timer = { end: Date.now() + st.sec * 1000, dur: st.sec, run: true }; Voice.speak(st.next ? 'Repos. Prochain : ' + Player.pl.exs[st.xi].name + '.' : 'Repos.'); }
  else if (st.t === 'timed' || st.t === 'steady') { A.timer = { end: null, dur: st.sec, left: st.sec, run: false }; if (st.auto) startTimer(true); else announce(st); }
  else if (st.t === 'hold') { A.timer = { start: null, run: false }; announce(st); }
  else if (st.t === 'set') { if (st.ex.kg && A.kg[st.ex.id] == null) { const sg = suggestKg(st.ex); A.kg[st.ex.id] = sg.kg != null ? sg.kg : 0; } announce(st); }
  else if (st.t === 'feel') Voice.speak('C’était comment ?');
  else if (st.t === 'end') { finish(); return; }
  saveLocal(); drawPlayer(); loop();
}
function announce(st) {
  const e = st.ex; const A = S.active;
  if (st.st) { Voice.speak(st.st.name + (st.sec ? '. ' + st.sec + ' secondes.' : '. ' + spokenReps(st.st.reps) + '.')); return; }
  if (st.t === 'steady') { Voice.speak(e.name + '. ' + Math.round(st.sec / 60) + ' minutes.'); return; }
  const last = st.i === st.n && e.lastMax;
  let txt = st.i === 1 ? `${e.name}. ${st.n} séries. ` : `Série ${st.i}. `;
  if (st.t === 'set') txt += e.mode === 'dist' ? e.dist.replace(' m', ' mètres') + '. ' : spokenReps(e.reps) + ' répétitions. ';
  if (st.t === 'timed') txt += st.sec + ' secondes. ';
  if (st.t === 'hold') txt += 'Tiens le plus longtemps possible. ';
  if (last) txt += 'Dernière série. À fond.'; else if (st.i === 1) txt += LV[e.lvl][0].toLowerCase() + '.';
  if (e.kg && A.kg[e.id]) txt += ' ' + kgTxt(A.kg[e.id]) + ' kilos.';
  Voice.speak(txt);
}
function startTimer(auto) {
  const T = S.active.timer; if (!T) return; const st = curStep();
  T.end = Date.now() + (T.left != null ? T.left : T.dur) * 1000; T.run = true;
  if (auto && st.st) Voice.speak(st.st.name + '.'); else Voice.speak('Go');
  Beep.play(880, 180); saveLocal(); drawPlayer();
}
function pauseTimer() { const T = S.active.timer; if (!T || !T.run) return; T.left = Math.max(0, (T.end - Date.now()) / 1000); T.run = false; saveLocal(); drawPlayer(); }
let lastBeep = -1;
function loop() {
  clearInterval(Player.tick);
  Player.tick = setInterval(() => {
    if (!Player.on || !S.active) return;
    const st = curStep(); const T = S.active.timer; if (!T) return;
    if (st.t === 'hold') { if (T.run) { const b = $('#pt-big'); if (b) b.textContent = mmss((Date.now() - T.start) / 1000); } return; }
    if (!T.run || !T.end) return;
    const left = (T.end - Date.now()) / 1000; const sLeft = Math.ceil(left);
    const lab = $('#pt-big'); if (lab) lab.textContent = mmss(left);
    const rf = $('#player .ring .rf'); if (rf) { const C = 2 * Math.PI * 88; rf.style.strokeDashoffset = (C * (1 - Math.max(0, left) / T.dur)).toFixed(1); }
    if (sLeft <= 3 && sLeft > 0 && sLeft !== lastBeep) { lastBeep = sLeft; Beep.play(660, 120); }
    if (st.t === 'rest' && sLeft === 10 && lastBeep !== 10 && T.dur > 20) { lastBeep = 10; Voice.speak('Dix secondes.'); }
    if (left <= 0) { Beep.play(990, 420); buzz([220, 90, 220]); completeStep(); }
  }, 250);
}
function completeStep() {
  const st = curStep(); const A = S.active;
  if ((st.t === 'set' || st.t === 'timed' || st.t === 'hold') && !st.st) A.done[st.ex.id] = (A.done[st.ex.id] || 0) + 1;
  if (st.t === 'hold' && A.timer && A.timer.start) { const sec = Math.round((Date.now() - A.timer.start) / 1000); (A.hold[st.ex.id] = A.hold[st.ex.id] || []).push(sec); }
  if (A.step < Player.pl.steps.length - 1) A.step++;
  enterStep();
}
function skipTo(dir) { const A = S.active; A.step = Math.max(0, Math.min(Player.pl.steps.length - 1, A.step + dir)); enterStep(); }
function drawPlayer() {
  const A = S.active; const pl = Player.pl; const st = curStep(); const s = pl.s;
  const exN = pl.exs.length; const xi = st.xi != null ? st.xi : -1;
  const seg = pl.exs.map((e, i) => `<i class="${i < xi ? 'ok' : (i === xi ? 'cur' : '')}"></i>`).join('');
  const T = A.timer; let body = '';
  if (st.t === 'rest') {
    const nxt = pl.steps[A.step + 1] || {}; const ne = nxt.ex || pl.exs[st.xi] || {};
    const nk = ne.kg ? (A.kg[ne.id] != null ? A.kg[ne.id] : suggestKg(ne).kg) : null;
    const nd = nxt.st ? '' : (nxt.t === 'set' ? (ne.mode === 'dist' ? ne.dist : ne.reps + ' reps') : (nxt.t === 'timed' ? nxt.sec + ' s' : (nxt.t === 'hold' ? 'max' : '')));
    const left = T && T.run ? (T.end - Date.now()) / 1000 : st.sec;
    body = `<div class="pr"><p class="lbl">REPOS</p>${ring(left / (T ? T.dur : st.sec), `<span id="pt-big">${mmss(left)}</span>`, '', 'rest')}
      <div class="nextc">${still(nxt.st ? nxt.st.pic : (ne.pic || s.pic))}<div><small>${st.next ? 'PROCHAIN' : 'ENSUITE'}</small><b>${esc(nxt.st ? nxt.st.name : (ne.name || ''))}</b><span>${nxt.i && !nxt.st ? 'Série ' + nxt.i + '/' + nxt.n + ' · ' : ''}${esc(nd)}${nk ? ' · ' + kgTxt(nk) + ' kg' : ''}</span></div></div>
      <div class="pbtns"><button class="ghost" data-act="p-add">+15 s</button><button class="cta" data-act="p-next">PASSER</button></div></div>`;
  } else if (st.t === 'feel') {
    const ex = st.ex;
    body = `<div class="pf">${still(ex.pic)}<h2>${esc(ex.name)}</h2><p class="lbl">C’ÉTAIT COMMENT ?</p>
      <div class="feel"><button data-act="feel" data-v="dur"><span>🥵</span>DUR</button><button data-act="feel" data-v="ok"><span>💪</span>PARFAIT</button><button data-act="feel" data-v="facile"><span>😎</span>FACILE</button></div>
      <p class="hint">Facile = la prochaine fois, ça monte.</p></div>`;
  } else {
    const e = st.ex; const lv = LV[st.easy ? 'facile' : e.lvl]; const last = st.i === st.n && e.lastMax && !st.st;
    const pic = st.st ? st.st.pic : e.pic; const name = st.st ? st.st.name : e.name;
    const unit = (e.mode === 'circuit' || e.mode === 'totale') ? 'TOUR' : 'SÉRIE';
    const head = `<div class="ph">${anim(pic, 'hero')}<h2>${esc(name)}</h2>${st.i ? `<p class="setn">${unit} <b>${st.i}</b>/${st.n}</p>` : ''}</div>`;
    let main = '';
    if (st.t === 'set') {
      const big = st.st ? st.st.reps : (e.mode === 'dist' ? e.dist : e.reps);
      main = `<div class="big"><b>${esc(big)}</b><small>${e.mode === 'dist' && !st.st ? '' : 'REPS'}${e.per && !st.st ? ' ' + esc(e.per) : ''}</small></div>
        <div class="badges">${last ? '<span class="bd max">🔥 À FOND</span>' : `<span class="bd lv-${e.lvl}">${lv[0]}</span><span class="bs">${e.rir === 1 ? 'garde 1 rep' : lv[1]}</span>`}${e.fin && !st.st ? '<span class="bd fin">☠ FINISHER</span>' : ''}</div>`;
      if (e.kg && !st.st) {
        const sg = suggestKg(e); const k = A.kg[e.id];
        main += `<div class="kg"><button class="stp" data-act="kg-" aria-label="Moins lourd">−</button><div><b>${k ? kgTxt(k) : 'PDC'}</b><small>${k ? 'kg' : 'poids du corps'}</small></div><button class="stp" data-act="kg+" aria-label="Plus lourd">+</button></div>
          ${sg.last != null ? `<p class="hint">${sg.up ? `▲ +${kgTxt(sg.up)} kg : c’était facile la dernière fois` : `Dernière fois : ${kgTxt(sg.last)} kg`}</p>` : ''}`;
      }
      main += '<button class="cta done" data-act="p-done">FAIT ✓</button>';
    } else if (st.t === 'timed' || st.t === 'steady') {
      const left = T.run ? (T.end - Date.now()) / 1000 : (T.left != null ? T.left : T.dur);
      const spec = (st.st && st.st.spec) || e.spec || [];
      main = `${ring(left / T.dur, `<span id="pt-big">${mmss(left)}</span>`, '', st.t)}
        <div class="badges">${spec.map((x) => `<span class="bd spec">${esc(x)}</span>`).join('')}${!spec.length ? `<span class="bd lv-${st.easy ? 'facile' : e.lvl}">${lv[0]}</span>` : ''}</div>
        ${T.run ? `<div class="pbtns"><button class="ghost" data-act="p-pause">PAUSE</button><button class="cta" data-act="p-next">${st.t === 'steady' ? 'TERMINÉ' : 'PASSER'}</button></div>`
                : `<button class="cta done" data-act="p-start">${IC.play}<span>${T.left != null && T.left < T.dur ? 'REPRENDRE' : 'GO'}</span></button>${st.t === 'steady' ? '<button class="link" data-act="p-next">Passer</button>' : ''}`}`;
    } else if (st.t === 'hold') {
      const best = S.best[e.id] && S.best[e.id].sec;
      main = `${ring(1, `<span id="pt-big">${T.run ? mmss((Date.now() - T.start) / 1000) : '0:00'}</span>`, best ? 'record ' + best + ' s' : esc(e.target), 'hold')}
        <div class="badges"><span class="bd max">🔥 TIENS AU MAX</span></div>
        ${T.run ? '<button class="cta done" data-act="p-stop">STOP</button>' : `<button class="cta done" data-act="p-hold">${IC.play}<span>GO</span></button>`}`;
    }
    body = `${head}<div class="pm">${main}</div>${e.cue && !st.st ? `<p class="cue">${esc(e.cue)}</p>` : ''}`;
  }
  $('#player').className = 'player ' + s.cls + (st.t === 'rest' ? ' resting' : '');
  $('#player').innerHTML = `<div class="ptop"><button class="ib" data-act="p-quit" aria-label="Quitter">${IC.x}</button><div class="seg">${seg}</div>
      <button class="ib" data-act="p-voice" aria-label="${S.prefs.voice ? 'Couper la voix' : 'Activer la voix'}">${S.prefs.voice ? IC.vol : IC.mute}</button></div>
    <div class="pmeta"><span>${s.id} · ${esc(s.name)}</span><span>${xi >= 0 ? (xi + 1) + '/' + exN : 'ÉCHAUFFEMENT'}</span></div>
    <div class="pbody">${body}</div>
    <div class="pnav"><button data-act="p-prev" aria-label="Étape précédente">‹</button><button data-act="p-skip" aria-label="Étape suivante">›</button></div>`;
}
let endedView = false;
function finish() {
  const A = S.active; const pl = Player.pl; const t = Date.now(); const recs = [];
  for (const [id, kg] of Object.entries(A.kg)) {
    if (!Number.isFinite(kg) || kg <= 0 || !A.done[id]) continue;
    const prevBest = (S.best[id] && S.best[id].kg) || (S.loads[id] && S.loads[id].kg) || null; const ex = pl.exs.find((e) => e.id === id);
    if (prevBest != null && kg > prevBest && ex) recs.push(ex.name + ' ' + kgTxt(kg) + ' kg');
    if (prevBest == null || kg > prevBest) S.best[id] = { kg, at: t };
    S.loads[id] = { kg, feel: A.feel[id] || 'ok', at: t };
  }
  for (const [id, arr] of Object.entries(A.hold)) { const m = Math.max(...arr); const pb = S.best[id] && S.best[id].sec; if (pb != null && m > pb) recs.push('Suspension ' + m + ' s'); if (pb == null || m > pb) S.best[id] = { sec: m, at: t }; }
  const sets = Object.values(A.done).reduce((n, x) => n + x, 0);
  const of = pl.steps.filter((x) => (x.t === 'set' || x.t === 'timed' || x.t === 'hold') && !x.st).length;
  const mins = Math.max(1, Math.round((t - A.startedAt) / 60000));
  S.log[A.id] = { id: A.id, date: A.date, sid: A.sid, done: true, sets, of, kg: A.kg, feel: A.feel, min: mins, at: t };
  S.active = null; changed(true);
  const b = board(); const nx = b.next && sess(b.next);
  Voice.speak('Séance terminée. Bravo.'); clearInterval(Player.tick); wakeOff(); endedView = true;
  $('#player').className = 'player ' + pl.s.cls + ' ended';
  $('#player').innerHTML = `<div class="endv"><div class="burst">✓</div><h1>${pl.s.id} BOUCLÉE</h1>
    <div class="kpis"><div><b>${mins}</b><span>min</span></div><div><b>${sets}</b><span>séries</span></div><div><b>${recs.length}</b><span>record${recs.length > 1 ? 's' : ''}</span></div></div>
    ${recs.length ? `<div class="recs">${recs.map((r) => `<span>🏆 ${esc(r)}</span>`).join('')}</div>` : ''}
    <p class="coach">${esc(coachLine())}</p>
    ${b.full ? `<div class="bravo"><b>${b.ord.length}/${b.ord.length} ✓</b><span>Semaine bouclée. Repos quand tu veux.</span></div>` : (nx ? `<div class="nextc">${still(nx.pic)}<div><small>LA PROCHAINE</small><b>${nx.id} · ${esc(nx.name)}</b><span>${esc(nx.dur)}</span></div></div>` : '')}
    <button class="cta" data-act="p-close">FERMER</button></div>`;
}
function closePlayer() { Player.on = false; clearInterval(Player.tick); wakeOff(); try { speechSynthesis.cancel(); } catch (e) { /* rien */ } $('#player').hidden = true; document.body.classList.remove('locked'); endedView = false; render(); }

/* ===== Profil, partage ===== */
function profileSheet() {
  const p = P() || { name: AMI_NAME || '', startKg: '', goalKg: '', startDate: todayISO(), heightCm: '', age: '' };
  $('#sheet').className = 'sheet sN';
  $('#sheet').innerHTML = `<div class="sh flat"><button class="ib close" data-act="close" aria-label="Fermer">${IC.x}</button><h1>${P() ? 'PROFIL' : 'TON PROFIL'}</h1></div>
    <div class="shb"><form class="form" data-form="profile">
      <label>Prénom<input name="name" value="${esc(p.name)}" autocomplete="given-name" required></label>
      <div class="two"><label>Poids actuel<input name="startKg" inputmode="decimal" value="${p.startKg !== '' ? esc(kgTxt(p.startKg)) : ''}" placeholder="kg" required></label>
      <label>Objectif<input name="goalKg" inputmode="decimal" value="${p.goalKg !== '' ? esc(kgTxt(p.goalKg)) : ''}" placeholder="kg" required></label></div>
      <div class="two"><label>Taille<input name="heightCm" inputmode="numeric" value="${esc(p.heightCm)}" placeholder="cm" required></label>
      <label>Âge<input name="age" inputmode="numeric" value="${esc(p.age)}" required></label></div>
      <label>Semaine 1 à partir du<input name="startDate" type="date" value="${esc(p.startDate)}" required></label>
      <button class="cta" type="submit">ENREGISTRER</button></form>
      <button class="row-btn" data-act="voice">${S.prefs.voice ? IC.vol : IC.mute}<span>Voix du coach : ${S.prefs.voice ? 'oui' : 'non'}</span></button>
      ${AMI ? '' : `<button class="row-btn" data-act="share">${IC.share}<span>Envoyer le programme à un ami</span></button>
      <p class="hint">Son lien n’ouvre que le programme, sur son téléphone : pas de compte, rien de StayClean, son poids à lui.</p>
      <a class="link" href="calories.html">Ancienne appli Mes Calories</a>`}</div>`;
  openSheet();
}
function saveProfile(form) {
  const f = new FormData(form);
  const p = { name: String(f.get('name') || '').trim().slice(0, 40), startKg: num(f.get('startKg')), goalKg: num(f.get('goalKg')), heightCm: num(f.get('heightCm')), age: num(f.get('age')), startDate: String(f.get('startDate') || '') };
  if (!p.name || !(p.startKg > 40 && p.startKg < 300) || !(p.goalKg > 40 && p.goalKg < p.startKg) || !(p.heightCm > 120 && p.heightCm < 230) || !(p.age > 12 && p.age < 100) || !/^\d{4}-\d{2}-\d{2}$/.test(p.startDate)) { toast('Vérifie les chiffres : objectif plus bas que le poids actuel.'); return; }
  S.profile = p; S.profileAt = Date.now();
  if (!weights().length) { S.weights[todayISO()] = { kg: p.startKg, at: Date.now() }; S.dirtyW[todayISO()] = 1; }
  wDraft = null; closeSheet(); changed(true); toast('C’est enregistré.');
}
async function share() {
  const name = (prompt('Prénom de ton ami ?', '') || '').trim();
  const url = location.origin + location.pathname + '?ami=' + encodeURIComponent(name || '1');
  const text = (name ? name + ', v' : 'V') + 'oici le programme Le Camp. Ouvre le lien, mets ton poids, puis « Ajouter à l’écran d’accueil ».';
  try { if (navigator.share) { await navigator.share({ title: 'Le Camp', text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('Lien copié.'); } catch (e) { prompt('Copie ce lien :', url); }
}

/* ===== Actions ===== */
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act; const A = S.active;
  switch (a) {
    case 'tab': tab = b.dataset.tab; closeSheet(); render(); scrollTo(0, 0); break;
    case 'preview': previewSheet(b.dataset.sid); break;
    case 'close': closeSheet(); render(); break;
    case 'go': {
      if (board().today.length && !confirm('Tu as déjà fait une séance aujourd’hui. On en fait une deuxième ?')) return;
      startPlayer(b.dataset.sid, true); break;
    }
    case 'resume': startPlayer(A.sid, false); break;
    case 'mark': { const d = b.dataset.d; const id = 'm-' + d + '-' + uid(); S.log[id] = { id, date: d, sid: b.dataset.sid, done: true, manual: true, at: Date.now() };
      closeSheet(); changed(true); toast('✗ ' + b.dataset.sid + ' barrée'); break; }
    case 'undone': { const e = Object.values(S.log).find((x) => x.id === b.dataset.id); if (e) { e.del = true; e.at = Date.now(); } closeSheet(); changed(true); break; }
    case 'profile': profileSheet(); break;
    case 'voice': S.prefs.voice = !S.prefs.voice; saveLocal(); profileSheet(); break;
    case 'share': share(); break;
    case 'w-': wDraft = Math.round((wDraft - 0.1) * 10) / 10; renderWeight(); break;
    case 'w+': wDraft = Math.round((wDraft + 0.1) * 10) / 10; renderWeight(); break;
    case 'save-w': { const t = todayISO(); if (!(wDraft > 40 && wDraft < 300)) return; S.weights[t] = { kg: wDraft, at: Date.now() }; S.dirtyW[t] = 1; changed(false); toast('Pesée enregistrée'); break; }
    case 'del-w': { const d = b.dataset.d; if (!confirm('Supprimer la pesée ' + dWhen(d) + ' ?')) return; delete S.weights[d]; S.dirtyW[d] = 1; wDraft = null; changed(false); break; }
    case 'go-agenda': location.href = 'index.html'; break;
    /* lecteur */
    case 'p-done': Beep.play(880, 90); buzz(40); completeStep(); break;
    case 'p-next': completeStep(); break;
    case 'p-skip': if (curStep().t !== 'end') skipTo(1); break;
    case 'p-prev': skipTo(-1); break;
    case 'p-start': Beep.init(); startTimer(false); break;
    case 'p-pause': pauseTimer(); break;
    case 'p-add': if (A.timer && A.timer.run) { A.timer.end += 15000; A.timer.dur += 15; saveLocal(); drawPlayer(); } break;
    case 'p-hold': A.timer = { start: Date.now(), run: true }; Beep.play(880, 180); Voice.speak('Go'); saveLocal(); drawPlayer(); break;
    case 'p-stop': Beep.play(990, 300); completeStep(); break;
    case 'kg-': case 'kg+': { const e = curStep().ex; const s0 = e.step || 2.5; const v = (A.kg[e.id] || 0) + (a === 'kg+' ? s0 : -s0); A.kg[e.id] = Math.max(0, Math.round(v * 10) / 10); saveLocal(); drawPlayer(); break; }
    case 'feel': A.feel[curStep().ex.id] = b.dataset.v; completeStep(); break;
    case 'p-voice': S.prefs.voice = !S.prefs.voice; saveLocal(); if (!S.prefs.voice) { try { speechSynthesis.cancel(); } catch (e) { /* rien */ } } drawPlayer(); break;
    case 'p-quit': if (endedView || confirm('Quitter ? Ta séance reste en cours, tu la reprends quand tu veux.')) closePlayer(); break;
    case 'p-close': closePlayer(); break;
    default: break;
  }
});
document.addEventListener('submit', (ev) => { const f = ev.target.closest('[data-form="profile"]'); if (!f) return; ev.preventDefault(); saveProfile(f); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (Player.on && !endedView) { wakeOn(); drawPlayer(); } else if (!Player.on) { render(); if (Acc.on) pull(); }
});
window.addEventListener('online', () => { if (Acc.on) pull(); });

/* ===== Démarrage ===== */
if (!S.profile && !AMI) { const c = agendaConf(); if (c) S.profile = defaultProfile(c.prenom); }
if (S.active && S.active.date !== todayISO()) {   // séance d'un autre jour jamais terminée : comptée si des séries ont été faites
  const A = S.active; const done = Object.values(A.done || {}).reduce((n, x) => n + x, 0);
  if (done) S.log[A.id] = { id: A.id, date: A.date, sid: A.sid, done: true, sets: done, kg: A.kg, at: Date.now() };
  S.active = null; saveLocal();
}
render(); summary();
if (!S.profile) profileSheet();
connect().then(() => { summary(); if (!Player.on) render(); });
window.__SP = { get S() { return S; }, Acc, board, plan, suggestKg, nutrition, planKg, pull, push, render, Player, completeStep, curStep: () => curStep() };
})();
