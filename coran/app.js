/* Mon Coran — espace « lire et mémoriser le Coran » de StayClean Agenda.
   Fichier assemblé depuis les modules (ordre numérique) ; chaque section commence par un titre « ===== ».
   Dépend de : supabase-js 2.117.1 (même fichier et même empreinte SRI que l'agenda).
   Les textes (arabe, phonétique, traduction) viennent uniquement de coran/data/, construits par
   coran/sources/build.py à partir de sources vérifiées : rien n'est écrit à la main dans ce fichier. */
(() => {
'use strict';
/* ===== Utilitaires ===== */
const TZ = 'Europe/Brussels';
const DATA_V = '20261027';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pad3 = (n) => String(n).padStart(3, '0');
const plural = (n, one, many) => (Math.abs(n) <= 1 ? one : many);
function debounce(fn, ms) { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = (...a) => { clearTimeout(t); fn(...a); }; return d; }
function icon(name, cls = '') { return `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`; }
const uniqSorted = (arr) => Array.from(new Set(arr)).sort((a, b) => a - b);
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arNum = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);

/* --- Dates (toujours en Europe/Brussels) --- */
const _dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
let _todayOverride = null; // tests uniquement
function todayISO() { return _todayOverride || _dayFmt.format(new Date()); }
function isoToUTC(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); }
function validISO(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = isoToUTC(s); return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}
function addDays(iso, n) { return new Date(isoToUTC(iso) + n * 86400000).toISOString().slice(0, 10); }
function daysBetween(a, b) { return Math.round((isoToUTC(b) - isoToUTC(a)) / 86400000); }
const _fDM = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const _fWD = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', timeZone: 'UTC' });
const _fFull = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
function dDM(iso) { return validISO(iso) ? _fDM.format(isoToUTC(iso)) : ''; }
function dFull(iso) { return validISO(iso) ? _fFull.format(isoToUTC(iso)) : ''; }
/* « aujourd'hui », « demain », « mardi », sinon « 12 novembre » */
function dayName(iso) {
  const n = daysBetween(todayISO(), iso);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  if (n > 1 && n < 7) return _fWD.format(isoToUTC(iso));
  return 'le ' + dDM(iso);
}
function nowStamp() { return new Date().toISOString(); }

/* --- Texte --- */
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[ʿʾ’'`´-]/g, '').replace(/\s+/g, ' ').trim();
}
/* Recherche : enlève l'article (al-, an-, ash-…) pour trouver « ikhlas » comme « Al-Ikhlas » */
function normName(s) { return norm(s).replace(/^(al|an|ar|as|ash|ach|at|ad|az|adh|aal)\s?/, '').replace(/[^a-z0-9 ]/g, '').replace(/\s/g, ''); }
/* Arabe : sans voyelles ni signes, alifs ramenés à ا, pour la recherche par nom arabe */
function normAr(s) {
  return String(s || '').replace(/[ً-ٰٟۖ-ۭـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
}

/* ===== Mon Coran dans StayClean Agenda =====
   Même appli, même compte, même serveur Supabase que l'agenda. Rien à connecter : on relit
   les réglages que l'agenda garde sur cet appareil (localStorage « stayclean-agenda-v1 »),
   sans jamais les modifier. La progression de Mon Coran ne va jamais dans les données de l'agenda. */
const AGENDA_DB_KEY = 'stayclean-agenda-v1';
const Host = { sb: null, uid: null, email: '', online: navigator.onLine !== false };

let _agendaDB;
function readAgendaDB() {
  if (_agendaDB !== undefined) return _agendaDB;
  try { const db = JSON.parse(localStorage.getItem(AGENDA_DB_KEY) || 'null'); _agendaDB = db && typeof db === 'object' ? db : null; }
  catch (e) { _agendaDB = null; }
  return _agendaDB;
}
function refreshAgendaDB() { _agendaDB = undefined; }
function hostSyncConf() {
  const db = readAgendaDB(); const s = (db && db.settings && db.settings.sync) || {};
  return { url: typeof s.url === 'string' ? s.url.trim().replace(/\/+$/, '') : '', key: typeof s.anonKey === 'string' ? s.anonKey.trim() : '' };
}
function hostConfigured() { const c = hostSyncConf(); return /^https?:\/\/[^/]+$/i.test(c.url) && c.key.length > 20; }
function initHost() {
  if (Host.sb) return Host.sb;
  if (!hostConfigured() || !window.supabase || typeof window.supabase.createClient !== 'function') return null;
  const c = hostSyncConf();
  try { Host.sb = window.supabase.createClient(c.url, c.key); } catch (e) { Host.sb = null; }
  return Host.sb;
}
/* Utilisateur connecté d'après la session enregistrée par l'agenda (fonctionne hors ligne) */
function storedSessionUser() {
  const c = hostSyncConf(); if (!c.url) return null;
  try {
    const ref = new URL(c.url).hostname.split('.')[0];
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    const s = raw ? JSON.parse(raw) : null;
    const u = s && (s.user || (s.currentSession && s.currentSession.user));
    return u && u.id ? { id: u.id, email: u.email || '' } : null;
  } catch (e) { return null; }
}
async function hostSessionUser() {
  if (!Host.sb) return storedSessionUser();
  try {
    const { data } = await Host.sb.auth.getSession();
    const u = data && data.session && data.session.user;
    if (u && u.id) return { id: u.id, email: u.email || '' };
  } catch (e) { /* hors ligne : session enregistrée */ }
  return storedSessionUser();
}
function isNetErr(e) {
  const m = String((e && (e.message || e.name)) || e || '');
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed|err_network|err_internet|timeout|timed out|aborted|offline/i.test(m);
}
function sbErr(error, fallback) {
  if (!error) return { code: fallback || 'unknown' };
  if (error.code && ['network', 'not_installed', 'session_expired', 'signed_out', 'forbidden', 'too_large', 'rate_limited', 'unavailable'].includes(error.code)) return error;
  const msg = String(error.message || error.error || ''); const code = String(error.code || ''); const st = Number(error.status || error.statusCode || 0);
  if (isNetErr(error) || (!st && !code && /fetch/i.test(msg))) return { code: 'network' };
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)|schema cache/i.test(msg)) return { code: 'not_installed', detail: msg };
  if (code === 'PGRST301' || code === 'PGRST303' || /jwt expired|invalid jwt|not authenticated/i.test(msg) || st === 401) return { code: 'session_expired' };
  if (code === '42501' || st === 403 || /row-level security|permission denied/i.test(msg)) return { code: 'forbidden', detail: msg };
  if (st === 413 || /payload too large|too large/i.test(msg)) return { code: 'too_large' };
  if (st === 429) return { code: 'rate_limited' };
  if (st >= 500) return { code: 'unavailable' };
  return { code: fallback || 'unknown', detail: msg };
}

/* ===== Contenus du Coran (lecture seule) =====
   index.json : sourates, juz, pages, provenance. s/NNN.json : versets de la sourate.
   Chaque fichier garde la mention de ses sources (Tanzil, QuranEnc, Wikipédia).
   Un fichier absent ou incomplet produit une erreur claire : jamais de texte de remplacement. */
const Content = { index: null, suras: new Map(), pending: new Map(), indexError: null };

class ContentError extends Error {
  constructor(code, detail) { super(code); this.code = code; this.detail = detail || ''; }
}
async function fetchJSON(url) {
  let r;
  try { r = await fetch(url, { cache: 'default' }); }
  catch (e) { throw new ContentError(navigator.onLine === false ? 'offline' : 'network'); }
  if (r.status === 404) throw new ContentError('missing');
  // réponse de secours du service worker quand le réseau manque
  if (r.status === 504 || r.status === 503) throw new ContentError(navigator.onLine === false ? 'offline' : 'network');
  if (!r.ok) throw new ContentError('unavailable', 'HTTP ' + r.status);
  try { return await r.json(); } catch (e) { throw new ContentError('invalid', 'JSON'); }
}
async function loadIndex() {
  if (Content.index) return Content.index;
  const idx = await fetchJSON('coran/data/index.json?v=' + DATA_V);
  if (!idx || idx.format !== 1 || !Array.isArray(idx.suras) || idx.suras.length !== 114 || !Array.isArray(idx.pages) || idx.pages.length !== 604 || !Array.isArray(idx.juz) || idx.juz.length !== 30) {
    throw new ContentError('invalid', 'index');
  }
  idx.suras.forEach((s, i) => { if (s.n !== i + 1) throw new ContentError('invalid', 'ordre des sourates'); });
  Content.index = idx;
  return idx;
}
const suraMeta = (n) => (Content.index ? Content.index.suras[n - 1] : null);
function loadSura(n) {
  n = Number(n);
  if (!(n >= 1 && n <= 114)) return Promise.reject(new ContentError('missing'));
  if (Content.suras.has(n)) return Promise.resolve(Content.suras.get(n));
  if (Content.pending.has(n)) return Content.pending.get(n);
  const p = (async () => {
    const meta = suraMeta(n);
    const d = await fetchJSON('coran/data/s/' + pad3(n) + '.json?v=' + DATA_V);
    const N = meta ? meta.ayas : -1;
    const ok = d && d.n === n && ['ar', 'tl', 'fr', 'fn', 'pg', 'jz'].every((k) => Array.isArray(d[k]) && d[k].length === N) && d.notice;
    if (!ok) throw new ContentError('invalid', 'sourate ' + n);
    d.arBody = d.ar.map((t, i) => (i === 0 && d.bsm ? t.split(' ').slice(d.bsm).join(' ') : t));
    d.basmala = d.bsm ? d.ar[0].split(' ').slice(0, d.bsm).join(' ') : '';
    Content.suras.set(n, d);
    return d;
  })();
  Content.pending.set(n, p);
  p.then(() => Content.pending.delete(n), () => Content.pending.delete(n));
  return p;
}
function contentErrorText(e) {
  const c = e && e.code;
  if (c === 'offline') return 'Pas de réseau, et cette partie du Coran n’est pas encore enregistrée sur ce téléphone.';
  if (c === 'network') return 'Le texte n’a pas pu être chargé (réseau). Réessaie dans un instant.';
  if (c === 'missing') return 'Ce fichier du Coran est introuvable sur le serveur de l’appli.';
  if (c === 'invalid') return 'Ce fichier du Coran est incomplet : il n’est pas affiché pour éviter toute erreur.';
  return 'Le texte n’a pas pu être chargé. Réessaie dans un instant.';
}

/* --- Découpage du texte (aucune modification : seulement des positions) --- */
const SIGN_TOKEN = /^[ۖ-ۜ۞۩]+$/;
const STOP_MARKS = ['ۖ', 'ۗ', 'ۘ', 'ۚ']; // pauses permises par le mushaf (ni ۙ « ne pas s'arrêter », ni ۛ paire de pauses)
const LONG_VERSE_WORDS = 16;
const MIN_CHUNK_WORDS = 5;
function verseTokens(d, a) { return d.arBody[a - 1].split(' ').filter(Boolean); }
function wordCount(d, a) { return verseTokens(d, a).filter((t) => !SIGN_TOKEN.test(t)).length; }
/* Morceaux d'un verset long : coupés uniquement après une marque de pause du texte source,
   jamais au milieu d'un mot ; les morceaux trop courts sont regroupés. Sans marque : un seul morceau. */
function verseChunks(d, a) {
  const toks = verseTokens(d, a);
  const words = toks.filter((t) => !SIGN_TOKEN.test(t)).length;
  if (words <= LONG_VERSE_WORDS) return [{ from: 0, to: toks.length }];
  const raw = []; let start = 0;
  toks.forEach((t, i) => { if (STOP_MARKS.includes(t) && i < toks.length - 1) { raw.push({ from: start, to: i + 1 }); start = i + 1; } });
  raw.push({ from: start, to: toks.length });
  const wc = (c) => toks.slice(c.from, c.to).filter((t) => !SIGN_TOKEN.test(t)).length;
  const merged = [];
  for (const c of raw) {
    const last = merged[merged.length - 1];
    if (last && wc(last) < MIN_CHUNK_WORDS) last.to = c.to; else merged.push({ ...c });
  }
  if (merged.length > 1 && wc(merged[merged.length - 1]) < MIN_CHUNK_WORDS) { const l = merged.pop(); merged[merged.length - 1].to = l.to; }
  return merged;
}
/* Phonétique d'un morceau : seulement si le nombre de mots latins correspond exactement aux mots arabes */
function tlTokens(d, a) {
  const out = []; const raw = d.tl[a - 1];
  // découpe par espaces hors balises, en gardant le balisage de chaque mot
  let cur = ''; let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '<') { const j = raw.indexOf('>', i); const tag = raw.slice(i, j + 1); cur += tag; depth += /^<\//.test(tag) ? -1 : 1; i = j; continue; }
    if (ch === ' ' && depth === 0) { if (cur) out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function tlForChunk(d, a, chunk) {
  const toks = verseTokens(d, a);
  const isWord = toks.map((t) => !SIGN_TOKEN.test(t));
  const nWords = isWord.filter(Boolean).length;
  const tl = tlTokens(d, a);
  if (tl.length !== nWords) return null;
  const firstWord = isWord.slice(0, chunk.from).filter(Boolean).length;
  const count = isWord.slice(chunk.from, chunk.to).filter(Boolean).length;
  return tl.slice(firstWord, firstWord + count).join(' ');
}

/* --- Rendu (HTML sûr) --- */
/* Arabe : un <span> par mot pour les indices de la récitation ; les marques de pause restent collées au texte */
function arHTML(tokens, opts = {}) {
  const shown = isNum(opts.shown) ? opts.shown : Infinity; let w = 0;
  const parts = tokens.map((t) => {
    if (SIGN_TOKEN.test(t)) return `<span class="w w--sign${w > shown ? ' is-hidden' : ''}">${esc(t)}</span>`;
    w++;
    const hidden = w > shown;
    return `<span class="w${hidden ? ' is-hidden' : ''}"${hidden ? ' aria-hidden="true"' : ''}>${esc(t)}</span>`;
  });
  if (isNum(opts.end) && parts.length) {
    const k = lastWordIndex(tokens);
    const tail = parts.splice(k).join(' ');
    parts.push(`<span class="nw">${tail} ${ayahEnd(opts.end)}</span>`);
  }
  return parts.join(' ');
}
function ayahEnd(a) { return `<span class="ayah-end" aria-label="fin du verset ${a}"><span>${arNum(a)}</span></span>`; }
/* Le numéro de fin de verset ne part jamais seul à la ligne : il reste collé au dernier mot */
function lastWordIndex(tokens) { let k = tokens.length - 1; while (k > 0 && SIGN_TOKEN.test(tokens[k])) k--; return Math.max(0, k); }
function arWithEnd(text, a) {
  const toks = String(text).split(' ');
  const k = lastWordIndex(toks);
  const head = toks.slice(0, k).join(' ');
  return `${head ? esc(head) + ' ' : ''}<span class="nw">${esc(toks.slice(k).join(' '))} ${ayahEnd(a)}</span>`;
}
/* Phonétique Tanzil : <u> son propre à l'arabe ou voyelle longue, <i> lettre distinguée (ẓ), <b>/<strong> écrit mais non prononcé */
function tlHTML(raw) {
  if (raw == null) return '';
  const parts = String(raw).split(/(<\/?(?:u|b|i|strong)>)/i);
  return parts.map((p) => {
    const m = /^<(\/?)(u|b|i|strong)>$/i.exec(p);
    if (!m) return esc(p);
    if (m[1]) return '</span>';
    const k = m[2].toLowerCase();
    return `<span class="${k === 'u' ? 'tl-u' : k === 'i' ? 'tl-i' : 'tl-b'}">`;
  }).join('');
}
/* Traduction : les renvois [12] deviennent de petits numéros ; les notes sont derrière « Comprendre » */
function frHTML(raw) { return esc(raw).replace(/\[(\d+)\]/g, '<sup class="fn-ref" aria-label="note $1">$1</sup>'); }
function footnotes(raw) {
  if (!raw) return [];
  return String(raw).split('\n').map((l) => { const m = /^\[(\d+)\]\s*(.*)$/.exec(l.trim()); return m ? { n: m[1], t: m[2] } : null; }).filter(Boolean);
}

/* --- Recherche : nom français, nom translittéré, nom arabe, numéro, verset (2:255), page, juz --- */
function searchSuras(q) {
  const idx = Content.index; if (!idx) return { suras: [], jump: null };
  const s = String(q || '').trim();
  if (!s) return { suras: idx.suras, jump: null };
  let m = /^(\d{1,3})\s*[:.,\s]\s*(\d{1,3})$/.exec(s);
  if (m) {
    const n = +m[1], a = +m[2];
    if (n >= 1 && n <= 114 && a >= 1 && a <= idx.suras[n - 1].ayas) return { suras: [idx.suras[n - 1]], jump: { type: 'verse', s: n, a } };
    return { suras: [], jump: { type: 'invalid', text: n >= 1 && n <= 114 ? `La sourate ${n} compte ${idx.suras[n - 1].ayas} versets.` : 'Il y a 114 sourates.' } };
  }
  m = /^p(?:age)?\s*(\d{1,3})$/i.exec(s);
  if (m) { const p = +m[1]; return { suras: [], jump: p >= 1 && p <= 604 ? { type: 'page', p } : { type: 'invalid', text: 'Les pages vont de 1 à 604.' } }; }
  m = /^(?:juz|jouz|partie)\s*(\d{1,2})$/i.exec(s);
  if (m) { const j = +m[1]; return { suras: [], jump: j >= 1 && j <= 30 ? { type: 'juz', j } : { type: 'invalid', text: 'Il y a 30 juz.' } }; }
  if (/^\d{1,3}$/.test(s)) { const n = +s; return { suras: n >= 1 && n <= 114 ? [idx.suras[n - 1]] : [], jump: null }; }
  const isAr = /[؀-ۿ]/.test(s);
  const qn = isAr ? normAr(s) : normName(s);
  const qw = norm(s);
  const hits = [];
  for (const su of idx.suras) {
    let score = 0;
    if (isAr) { const an = normAr(su.ar); if (an === qn) score = 3; else if (an.includes(qn)) score = 2; }
    else {
      const names = [su.name, su.tn, su.wtl].map(normName);
      const fr = su.frAll.map(norm);
      if (names.some((x) => x === qn)) score = 4;
      else if (names.some((x) => x.startsWith(qn))) score = 3;
      else if (names.some((x) => x.includes(qn)) || fr.some((x) => x.includes(qw))) score = 2;
    }
    if (score) hits.push([score, su]);
  }
  hits.sort((a, b) => b[0] - a[0] || a[1].n - b[1].n);
  return { suras: hits.map((h) => h[1]), jump: null };
}
function pageOfVerse(s, a) {
  const pages = Content.index.pages; let lo = 0, hi = pages.length - 1;
  const key = (x) => x[0] * 1000 + x[1]; const k = s * 1000 + a;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (key(pages[mid]) <= k) lo = mid; else hi = mid - 1; }
  return lo + 1;
}
/* Versets d'une page du Mushaf de Médine : [{s, a}] dans l'ordre */
function versesOfPage(p) {
  const idx = Content.index; const start = idx.pages[p - 1]; const end = p < 604 ? idx.pages[p] : [115, 1];
  const out = []; let s = start[0], a = start[1];
  while (s < end[0] || (s === end[0] && a < end[1])) {
    out.push({ s, a }); a++;
    if (a > idx.suras[s - 1].ayas) { s++; a = 1; }
  }
  return out;
}

/* ===== Sauvegarde : sur l'appareil d'abord, puis sur ton compte =====
   Chaque geste est enregistré tout de suite sur le téléphone (IndexedDB, jamais le localStorage de
   l'agenda). Si tu es connecté et que la table « qr_items » existe, tout part ensuite sur ton compte
   Supabase (même serveur que l'agenda, RLS : toi seul y as accès). Hors ligne, les envois attendent.
   Natures séparées : prefs (préférences), pos (dernière lecture), fav (favoris), attempt (tentatives),
   progress (étapes et jalons), review (calendrier de révision). La séance en cours, les audios
   téléchargés et tes enregistrements restent uniquement sur l'appareil. */
const KINDS = ['prefs', 'pos', 'fav', 'attempt', 'progress', 'review'];
const QR_TABLE = 'qr_items';
const DEFAULT_PATH_START = [1, 112, 113, 114, 108, 103, 109];
const DEFAULT_PREFS = {
  ambiance: 'vert',          // vert | papier | nuit
  readDisplay: 'ar_tl_fr',   // ar | fr | ar_fr | ar_tl | ar_tl_fr (dernier choix du lecteur libre)
  readMode: 'verse',         // verse | page
  arSize: 30,                // taille de l'arabe (px)
  reciter: 'husary',
  minutes: null,             // 5 | 10 | 15 ; null = pas encore choisi (10 par défaut)
  minutesAsked: false,
  reps: 3,                   // répétitions par défaut (réglage pédagogique)
  gap: 'auto',               // silence pour répéter : auto | court | long
  readGap: 0,                // secondes de silence entre les versets en lecture continue
  basmalaAudio: true,        // lire la basmala au début d'une sourate (lecture continue)
  tlNoteSeen: false,
  path: null,                // ordre du parcours (null = proposition par défaut)
  current: null,             // sourate en cours d'apprentissage
  remindTime: '19:00',
};
const Store = {
  owner: 'local', uid: null, ready: false, idbOk: true,
  mem: { prefs: clone(DEFAULT_PREFS), pos: null, fav: new Map(), attempt: new Map(), progress: new Map(), review: new Map() },
  items: new Map(),          // clé « kind|id » → { kind, id, data, deleted, dirty, lu }
  session: null,
  listeners: new Set(),
};

/* --- IndexedDB --- */
const IDB = { p: null };
function idbOpen() {
  if (IDB.p) return IDB.p;
  IDB.p = new Promise((res, rej) => {
    if (!('indexedDB' in window)) { rej(new Error('idb')); return; }
    let r; try { r = indexedDB.open('mon-coran', 1); } catch (e) { rej(e); return; }
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const st of ['items', 'kv', 'audio', 'rec']) if (!db.objectStoreNames.contains(st)) db.createObjectStore(st);
    };
    r.onsuccess = () => { const db = r.result; db.onclose = () => { IDB.p = null; }; db.onversionchange = () => { try { db.close(); } catch (e) { /* rien */ } IDB.p = null; }; res(db); };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('blocked'));
  });
  IDB.p.catch(() => { IDB.p = null; });
  return IDB.p;
}
async function idbTx(store, mode, fn) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    let tx; try { tx = db.transaction(store, mode); } catch (e) { IDB.p = null; rej(e); return; }
    const st = tx.objectStore(store); let out;
    const rq = fn(st);
    if (rq && 'onsuccess' in rq) rq.onsuccess = () => { out = rq.result; };
    tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  });
}
const idbGet = (store, k) => idbTx(store, 'readonly', (st) => st.get(k));
const idbPut = (store, k, v) => idbTx(store, 'readwrite', (st) => st.put(v, k));
const idbDel = (store, k) => idbTx(store, 'readwrite', (st) => st.delete(k));
async function idbAll(store, prefix) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const out = []; let tx;
    try { tx = db.transaction(store, 'readonly'); } catch (e) { IDB.p = null; rej(e); return; }
    const range = prefix ? IDBKeyRange.bound(prefix, prefix + '￿') : undefined;
    const rq = tx.objectStore(store).openCursor(range);
    rq.onsuccess = () => { const c = rq.result; if (c) { out.push([c.key, c.value]); c.continue(); } };
    tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error);
  });
}
async function idbKeys(store, prefix) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    let tx; try { tx = db.transaction(store, 'readonly'); } catch (e) { IDB.p = null; rej(e); return; }
    const range = prefix ? IDBKeyRange.bound(prefix, prefix + '￿') : undefined;
    const rq = tx.objectStore(store).getAllKeys(range);
    rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error);
  });
}

/* --- Mémoire --- */
const itemKey = (kind, id) => kind + '|' + id;
const idbItemKey = (kind, id) => Store.owner + '|' + kind + '|' + id;
function applyToMem(kind, id, data, deleted) {
  const m = Store.mem;
  if (kind === 'prefs') { m.prefs = Object.assign(clone(DEFAULT_PREFS), deleted ? {} : data || {}); return; }
  if (kind === 'pos') { m.pos = deleted ? null : data; return; }
  const map = m[kind]; if (!map) return;
  if (deleted) map.delete(id); else map.set(id, data);
}
function emitChange() { Store.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
async function loadLocal(owner) {
  Store.owner = owner;
  Store.items.clear();
  Store.mem = { prefs: clone(DEFAULT_PREFS), pos: null, fav: new Map(), attempt: new Map(), progress: new Map(), review: new Map() };
  try {
    const rows = await idbAll('items', owner + '|');
    for (const [, v] of rows) {
      if (!v || !KINDS.includes(v.kind)) continue;
      Store.items.set(itemKey(v.kind, v.id), v);
      applyToMem(v.kind, v.id, v.data, v.deleted);
    }
    Store.session = (await idbGet('kv', owner + '|session')) || null;
    Sync.since = (await idbGet('kv', owner + '|since')) || null;
    Store.idbOk = true;
  } catch (e) { storageFailed(true); }
  Store.ready = true;
}
/* Écrit tout de suite sur l'appareil, puis programme l'envoi sur le compte. */
async function put(kind, id, data) {
  const lu = Date.now();
  const it = { kind, id, data: clone(data), deleted: false, dirty: true, lu };
  Store.items.set(itemKey(kind, id), it);
  applyToMem(kind, id, it.data, false);
  emitChange();
  try { await idbPut('items', idbItemKey(kind, id), it); Store.idbOk = true; }
  catch (e) { storageFailed(); }
  schedulePush();
  return it.data;
}
async function del(kind, id) {
  const lu = Date.now();
  const it = { kind, id, data: {}, deleted: true, dirty: true, lu };
  Store.items.set(itemKey(kind, id), it);
  applyToMem(kind, id, null, true);
  emitChange();
  try { await idbPut('items', idbItemKey(kind, id), it); } catch (e) { storageFailed(); }
  schedulePush();
}
const prefs = () => Store.mem.prefs;
function setPrefs(patch) { return put('prefs', 'main', Object.assign(clone(prefs()), patch)); }
/* Erreur d'enregistrement sur l'appareil : on le dit tout de suite (une fois), sans bloquer la séance */
function storageFailed(silent) {
  const was = Store.idbOk; Store.idbOk = false;
  if (was && !silent) toast('Ta progression n’a pas pu être enregistrée sur ce téléphone (stockage refusé ou plein).', true, { label: 'Réglages', fn: () => openPage('settings') });
  scheduleRender();
}
async function saveSession(s) {
  // la séance en cours reste le même objet en mémoire (les étapes audio y écrivent) ; on enregistre une copie simple
  Store.session = s || null;
  try { if (s) await idbPut('kv', Store.owner + '|session', clone(s)); else await idbDel('kv', Store.owner + '|session'); } catch (e) { storageFailed(); }
}

/* ===== Synchronisation avec le compte (table Supabase qr_items) ===== */
const Sync = { state: 'local', since: null, pulling: null, pushing: null, timer: null, pushTimer: null, lastOk: 0, refreshTried: false, error: null };
/* state : local (pas de compte relié) | signedout | connecting | synced | pending | offline | not_installed | error */
function dirtyCount() { let n = 0; Store.items.forEach((it) => { if (it.dirty) n++; }); return n; }
function setSyncState(st, err) { Sync.state = st; Sync.error = err || null; scheduleRender(); }
function overlapISO(since) { const t = Date.parse(since); return Number.isFinite(t) ? new Date(t - 120000).toISOString() : since; }
async function pullNow() {
  if (!Host.sb || !Store.uid) return;
  if (Sync.pulling) return Sync.pulling;
  Sync.pulling = (async () => {
    try {
      const since = Sync.since; const all = [];
      for (let from = 0; ; from += 1000) {
        let q = Host.sb.from(QR_TABLE).select('kind,id,data,deleted,updated_at').eq('user_id', Store.uid).order('updated_at', { ascending: true }).range(from, from + 999);
        q = since ? q.gte('updated_at', overlapISO(since)) : q.eq('deleted', false);
        const { data, error } = await q;
        if (error) throw sbErr(error, 'unavailable');
        all.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      let changed = false;
      for (const r of all) {
        if (r.updated_at && (!Sync.since || Date.parse(r.updated_at) > Date.parse(Sync.since))) Sync.since = r.updated_at;
        if (!KINDS.includes(r.kind)) continue;
        const k = itemKey(r.kind, r.id); const local = Store.items.get(k);
        const remoteLu = (r.data && Number(r.data._lu)) || 0;
        if (local && local.dirty && local.lu >= remoteLu) continue; // la version de l'appareil est plus récente : elle partira au prochain envoi
        if (local && !local.dirty && local.lu === remoteLu && !!local.deleted === !!r.deleted) continue;
        const data = r.deleted ? {} : Object.assign({}, r.data); delete data._lu;
        const it = { kind: r.kind, id: r.id, data, deleted: !!r.deleted, dirty: false, lu: remoteLu };
        Store.items.set(k, it); applyToMem(r.kind, r.id, data, !!r.deleted); changed = true;
        idbPut('items', idbItemKey(r.kind, r.id), it).catch(() => {});
      }
      idbPut('kv', Store.owner + '|since', Sync.since).catch(() => {});
      Sync.lastOk = Date.now(); Sync.refreshTried = false; Host.online = true;
      setSyncState(dirtyCount() ? 'pending' : 'synced');
      if (changed) emitChange();
    } catch (e) {
      const err = sbErr(e, 'unavailable');
      if (err.code === 'network') { Host.online = false; setSyncState('offline'); }
      else if (err.code === 'not_installed') setSyncState('not_installed');
      else if (err.code === 'session_expired') {
        if (!Sync.refreshTried && Host.sb) {
          Sync.refreshTried = true;
          try { const r = await Host.sb.auth.refreshSession(); if (r && r.data && r.data.session) { Sync.pulling = null; return pullNow(); } } catch (er) { /* rien */ }
        }
        setSyncState('signedout');
      } else setSyncState('error', err);
    } finally { Sync.pulling = null; }
  })();
  return Sync.pulling;
}
function schedulePush() {
  if (!Host.sb || !Store.uid) return;
  clearTimeout(Sync.pushTimer);
  Sync.pushTimer = setTimeout(pushNow, 900);
  if (Sync.state === 'synced') setSyncState('pending');
}
async function pushNow() {
  if (!Host.sb || !Store.uid || ['not_installed', 'signedout'].includes(Sync.state)) return;
  if (Sync.pushing) { schedulePush(); return Sync.pushing; }
  const dirty = []; Store.items.forEach((it) => { if (it.dirty) dirty.push(it); });
  if (!dirty.length) { if (Sync.state === 'pending') setSyncState('synced'); return; }
  if (navigator.onLine === false) { setSyncState('offline'); return; }
  Sync.pushing = (async () => {
    try {
      for (let i = 0; i < dirty.length; i += 200) {
        const batch = dirty.slice(i, i + 200);
        const rows = batch.map((it) => ({ user_id: Store.uid, kind: it.kind, id: it.id, data: it.deleted ? { _lu: it.lu } : Object.assign({}, it.data, { _lu: it.lu }), deleted: !!it.deleted }));
        const { error } = await Host.sb.from(QR_TABLE).upsert(rows, { onConflict: 'user_id,kind,id' });
        if (error) throw sbErr(error, 'unavailable');
        for (const it of batch) {
          const cur = Store.items.get(itemKey(it.kind, it.id));
          if (cur && cur.lu === it.lu) { cur.dirty = false; idbPut('items', idbItemKey(it.kind, it.id), cur).catch(() => {}); }
        }
      }
      Host.online = true; Sync.lastOk = Date.now();
      setSyncState(dirtyCount() ? 'pending' : 'synced');
    } catch (e) {
      const err = sbErr(e, 'unavailable');
      if (err.code === 'network') { Host.online = false; setSyncState('offline'); }
      else if (err.code === 'not_installed') setSyncState('not_installed');
      else if (err.code === 'session_expired') setSyncState('signedout');
      else setSyncState('error', err);
    } finally { Sync.pushing = null; }
  })();
  return Sync.pushing;
}
async function syncNow() { await pullNow(); await pushNow(); }
/* Première connexion sur cet appareil : la progression faite sans compte est rattachée au compte. */
async function adoptLocalData(uidv) {
  try {
    const mine = await idbKeys('items', uidv + '|');
    const local = await idbAll('items', 'local|');
    if (!local.length) return;
    if (mine.length) return; // le compte a déjà des données ici : on ne mélange pas
    for (const [k, v] of local) {
      await idbPut('items', uidv + k.slice('local'.length), Object.assign({}, v, { dirty: true }));
      await idbDel('items', k);
    }
    const sess = await idbGet('kv', 'local|session');
    if (sess) { await idbPut('kv', uidv + '|session', sess); await idbDel('kv', 'local|session'); }
  } catch (e) { /* on garde les données là où elles sont */ }
}
function syncLabel() {
  switch (Sync.state) {
    case 'synced': return { tone: 'ok', text: 'Sauvegardé sur ton compte : tu retrouves ta progression sur tes autres appareils.' };
    case 'pending': return { tone: 'ok', text: 'Enregistré sur ce téléphone, envoi vers ton compte en cours.' };
    case 'offline': return { tone: 'warn', text: `Hors connexion : ${dirtyCount()} changement(s) enregistré(s) sur ce téléphone, envoyés dès le retour du réseau.` };
    case 'not_installed': return { tone: 'warn', text: 'La sauvegarde en ligne n’est pas encore installée sur ton serveur : ta progression reste sur ce téléphone. Exporte-la pour la garder ailleurs.' };
    case 'signedout': return { tone: 'warn', text: 'Tu n’es pas connecté dans l’agenda : ta progression reste sur ce téléphone.' };
    case 'error': return { tone: 'warn', text: 'L’envoi vers ton compte a échoué. Tout reste enregistré sur ce téléphone ; nouvel essai automatique.' };
    case 'connecting': return { tone: 'ok', text: 'Connexion à ton compte…' };
    default: return { tone: 'warn', text: 'Sauvegarde sur ce téléphone uniquement (agenda non relié à un compte). Exporte ta progression pour la garder ailleurs.' };
  }
}

/* ===== Audio : un seul lecteur pour toute l'appli =====
   Récitation humaine, verset par verset (EveryAyah.com). Jamais de lecture sans geste de ta part,
   jamais deux sons en même temps : tout passe par un seul élément <audio> et « stop » coupe tout.
   Pas de synchronisation mot à mot : ces fichiers n'ont pas de minutage par mot. */
const RECITERS = {
  husary: { name: 'Mahmoud Khalil Al-Husary', style: 'murattal (récitation posée)', folder: 'Husary_128kbps' },
  minshawi: { name: 'Mohamed Siddiq Al-Minshawi', style: 'murattal', folder: 'Minshawy_Murattal_128kbps' },
  alafasy: { name: 'Mishary Rashid Alafasy', style: 'murattal', folder: 'Alafasy_128kbps' },
};
const AUDIO_BASE = 'https://everyayah.com/data/';
const reciter = () => RECITERS[prefs().reciter] || RECITERS.husary;
const audioKey = (folder, s, a) => folder + '/' + pad3(s) + pad3(a);
function audioUrl(folder, s, a) { return AUDIO_BASE + folder + '/' + pad3(s) + pad3(a) + '.mp3'; }

const Player = {
  el: null, token: 0, state: 'idle', cur: null, label: '', ctx: null, cycle: 0, cycles: 0, phase: '',
  gap: null, objUrl: null, error: null, listeners: new Set(), durations: new Map(),
};
function playerEl() {
  if (Player.el) return Player.el;
  const el = new Audio(); el.preload = 'auto'; el.setAttribute('playsinline', '');
  Player.el = el; return el;
}
function playerNotify() { Player.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
function setPlayer(patch) { Object.assign(Player, patch); playerNotify(); }
/* Arrêt immédiat : coupe le son, le silence en cours et toute boucle */
function stopAudio() {
  Player.token++;
  if (Player.pending) { const f = Player.pending; Player.pending = null; f(true, null); }
  const el = Player.el;
  if (el) { try { el.pause(); } catch (e) { /* rien */ } el.removeAttribute('src'); try { el.load(); } catch (e) { /* rien */ } }
  if (Player.gap) { clearTimeout(Player.gap.t); const r = Player.gap.resolve; Player.gap = null; r && r(false); }
  if (Player.objUrl) { URL.revokeObjectURL(Player.objUrl); Player.objUrl = null; }
  setPlayer({ state: 'idle', cur: null, ctx: null, phase: '', cycle: 0, cycles: 0, error: null });
}
async function trackSource(t) {
  if (t.blob instanceof Blob) return { url: URL.createObjectURL(t.blob), local: true };
  const folder = reciter().folder;
  try {
    const blob = await idbGet('audio', audioKey(folder, t.s, t.a));
    if (blob instanceof Blob && blob.size > 0) return { url: URL.createObjectURL(blob), local: true };
  } catch (e) { /* pas de copie locale */ }
  return { url: audioUrl(folder, t.s, t.a), local: false };
}
/* Joue une piste jusqu'au bout. Renvoie la durée réellement jouée (ms), ou null si elle a été arrêtée. */
function playTrack(t, token) {
  return new Promise((resolve, reject) => {
    (async () => {
      const el = playerEl();
      const src = await trackSource(t);
      if (token !== Player.token) { if (src.local) URL.revokeObjectURL(src.url); resolve(null); return; }
      if (Player.objUrl) URL.revokeObjectURL(Player.objUrl);
      Player.objUrl = src.local ? src.url : null;
      let started = 0; let settled = false;
      const finish = (ok, v) => {
        if (settled) return; settled = true;
        el.onended = null; el.onerror = null; el.onplaying = null;
        if (Player.pending === finish) Player.pending = null;
        if (ok) resolve(v); else reject(v);
      };
      Player.pending = finish;
      el.onplaying = () => { if (!started) started = performance.now(); if (token === Player.token && Player.state !== 'playing') setPlayer({ state: 'playing' }); };
      el.onended = () => { const ms = started ? performance.now() - started : (el.duration || 0) * 1000; if (!t.own && !t.intro) Player.durations.set(t.s + ':' + t.a, ms); finish(true, ms); };
      el.onerror = () => {
        if (token !== Player.token) { finish(true, null); return; }
        finish(false, { code: src.local ? 'local' : (navigator.onLine === false ? 'offline' : 'network') });
      };
      setPlayer({ state: 'loading', cur: t, error: null });
      mediaSessionMeta(t);
      el.src = src.url;
      try { await el.play(); }
      catch (e) {
        if (settled) return;
        if (token !== Player.token || (e && e.name === 'AbortError')) { finish(true, null); return; }
        finish(false, { code: e && e.name === 'NotAllowedError' ? 'blocked' : (src.local ? 'local' : navigator.onLine === false ? 'offline' : 'network') });
      }
    })().catch((e) => reject({ code: 'network', detail: String(e) }));
  });
}
/* Silence (pour répéter) : annulable, peut être mis en pause */
function waitGap(ms, token, onTick) {
  return new Promise((resolve) => {
    if (token !== Player.token) { resolve(false); return; }
    const g = { total: ms, left: ms, startedAt: performance.now(), paused: false, resolve, t: null, onTick };
    const arm = () => { g.startedAt = performance.now(); g.t = setTimeout(() => { if (Player.gap === g) Player.gap = null; resolve(token === Player.token); }, g.left); };
    Player.gap = g; arm();
    g.pause = () => { if (g.paused) return; clearTimeout(g.t); g.left -= performance.now() - g.startedAt; g.paused = true; };
    g.resume = () => { if (!g.paused) return; g.paused = false; arm(); };
  });
}
function gapFor(ms, mode) {
  const m = mode || prefs().gap;
  if (m === 'court') return clamp(ms * 0.8 + 500, 2000, 15000);
  if (m === 'long') return clamp(ms * 1.6 + 1000, 3000, 40000);
  return clamp(ms * 1.1 + 800, 2500, 25000);
}
function pauseAudio() {
  if (Player.state === 'playing' && Player.el) { Player.el.pause(); setPlayer({ state: 'paused' }); }
  else if (Player.state === 'gap' && Player.gap) { Player.gap.pause(); setPlayer({ state: 'paused', phase: 'gap' }); }
}
function resumeAudio() {
  if (Player.state !== 'paused') return;
  if (Player.gap && Player.gap.paused) { Player.gap.resume(); setPlayer({ state: 'gap' }); }
  else if (Player.el) { Player.el.play().then(() => setPlayer({ state: 'playing' }), () => setPlayer({ state: 'error', error: { code: 'blocked' } })); }
}
function audioErrorText(e) {
  const c = e && e.code;
  if (c === 'offline') return 'Pas de réseau : la récitation ne peut pas être chargée. Télécharge la sourate pour l’écouter hors connexion.';
  if (c === 'blocked') return 'Le téléphone a bloqué le son : touche à nouveau « Écouter ».';
  if (c === 'local') return 'Le fichier audio enregistré sur ce téléphone est illisible. Supprime le téléchargement et recommence.';
  return 'La récitation n’a pas pu être chargée (réseau ou serveur audio). Réessaie dans un instant.';
}

/* Séquence : joue des pistes, éventuellement en boucle, avec un silence après chaque passage.
   opts : { cycles, gap: 'auto'|ms, gapAfterEach (bool), ctx, onPhase(phase, info), onTrackEnd(track) } */
async function runSequence(tracks, opts = {}) {
  stopAudio();
  const token = Player.token;
  const cycles = opts.cycles === Infinity ? Infinity : Math.max(1, opts.cycles || 1);
  setPlayer({ ctx: opts.ctx || null, cycles, cycle: 0, label: opts.label || '' });
  try {
    for (let c = 1; c <= cycles; c++) {
      setPlayer({ cycle: c });
      let played = 0;
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        setPlayer({ phase: 'play', cur: t });
        opts.onPhase && opts.onPhase('play', { cycle: c, track: t, index: i });
        const ms = await playTrack(t, token);
        if (ms == null || token !== Player.token) return false;
        played += ms;
        if (!t.intro) opts.onTrackEnd && opts.onTrackEnd(t);
        const between = opts.gapEach ? opts.gapEach : 0;
        if (between > 0 && i < tracks.length - 1) {
          setPlayer({ state: 'gap', phase: 'between' });
          if (!(await waitGap(between, token))) return false;
        }
      }
      const hasNext = c < cycles;
      if (opts.gap && (hasNext || opts.gapAfterLast)) {
        const g = opts.gap === 'auto' || typeof opts.gap === 'string' ? gapFor(played, opts.gap === 'auto' ? null : opts.gap) : opts.gap;
        setPlayer({ state: 'gap', phase: 'gap', gapMs: g, gapStart: performance.now() });
        opts.onPhase && opts.onPhase('gap', { cycle: c, ms: g });
        if (!(await waitGap(g, token))) return false;
      }
    }
    if (token === Player.token) setPlayer({ state: 'idle', cur: null, phase: 'done' });
    opts.onPhase && opts.onPhase('done', {});
    return true;
  } catch (e) {
    if (token !== Player.token) return false;
    setPlayer({ state: 'error', error: e, phase: '' });
    opts.onPhase && opts.onPhase('error', { error: e });
    return false;
  }
}
function mediaSessionMeta(t) {
  if (!('mediaSession' in navigator) || !t || typeof MediaMetadata === 'undefined') return;
  try {
    const m = suraMeta(t.s);
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.own ? 'Mon enregistrement' : t.intro ? 'Basmala' : `${m ? m.name : 'Sourate ' + t.s} · verset ${t.a}`, artist: t.own ? 'Moi' : reciter().name, album: 'Mon Coran' });
  } catch (e) { /* facultatif */ }
}
/* Durée connue d'un verset (après une première écoute), sinon estimation prudente */

/* --- Téléchargement explicite d'une sourate (pour l'écouter hors connexion) --- */
const Downloads = { running: null };
async function downloadSura(s, onProgress) {
  const folder = reciter().folder; const meta = suraMeta(s); const n = meta.ayas;
  const ctl = { cancel: false }; Downloads.running = { s, ctl, done: 0, total: n };
  let bytes = 0;
  try {
    for (let a = 1; a <= n; a++) {
      if (ctl.cancel) throw { code: 'cancelled' };
      const key = audioKey(folder, s, a);
      const have = await idbGet('audio', key).catch(() => null);
      if (!(have instanceof Blob && have.size)) {
        let r;
        try { r = await fetch(audioUrl(folder, s, a), { mode: 'cors' }); } catch (e) { throw { code: navigator.onLine === false ? 'offline' : 'network' }; }
        if (!r.ok) throw { code: 'network' };
        const b = await r.blob();
        if (!b.size) throw { code: 'network' };
        try { await idbPut('audio', key, b); } catch (e) { throw { code: 'storage' }; }
        bytes += b.size;
      } else bytes += have.size;
      Downloads.running.done = a;
      onProgress && onProgress(a, n, bytes);
    }
    return { ok: true, bytes };
  } finally { Downloads.running = null; }
}
async function deleteSuraAudio(s, folder) {
  folder = folder || reciter().folder;
  const keys = await idbKeys('audio', folder + '/' + pad3(s)).catch(() => []);
  for (const k of keys) await idbDel('audio', k).catch(() => {});
  return keys.length;
}
async function audioInventory() {
  const keys = await idbKeys('audio').catch(() => []);
  const bySura = new Map();
  for (const k of keys) {
    const m = /^([^/]+)\/(\d{3})(\d{3})$/.exec(k); if (!m) continue;
    const id = m[1] + '/' + +m[2];
    bySura.set(id, (bySura.get(id) || 0) + 1);
  }
  return Array.from(bySura.entries()).map(([id, count]) => { const [folder, s] = id.split('/'); return { folder, s: +s, count }; });
}

/* ===== Apprentissage : passages, jalons, révisions espacées =====
   Méthode : écouter, répéter, réciter sans regarder (rappel actif), relier aux versets précédents.
   Une simple écoute ou l'ouverture d'un verset ne compte jamais comme une réussite.
   Une tentative avec indice ou texte réaffiché n'est jamais « sans aide ».
   Les jalons acquis ne sont jamais retirés ; les besoins de révision sont tenus à part. */
const REVIEW_OFFSETS = [1, 3, 7, 14, 30];  // jours après la première réussite sans aide (choix de conception ajustable)
const RESULT_LABEL = { solo: 'Sans aide', hesitation: 'Avec une hésitation', rework: 'À retravailler' };
const MILESTONES = [
  'J’ai écouté la sourate.',
  'J’ai travaillé tous ses versets.',
  'J’ai récité chaque verset sans aide.',
  'J’ai récité la sourate entière sans aide.',
  'Je l’ai récitée à nouveau sans aide le lendemain ou plus tard.',
  'Je l’ai récitée à nouveau sans aide au moins une semaine après la première réussite complète.',
];

/* --- Parcours proposé : Al-Fatiha, puis des sourates courtes de Juz Amma, puis le reste de Juz Amma
   des plus courtes aux plus longues (nombre de mots du texte). Proposition modifiable. --- */
function defaultPath() {
  const idx = Content.index; if (!idx) return DEFAULT_PATH_START.slice();
  const rest = idx.suras.filter((s) => s.n >= 78 && !DEFAULT_PATH_START.includes(s.n)).sort((a, b) => a.words - b.words || b.n - a.n).map((s) => s.n);
  return DEFAULT_PATH_START.concat(rest);
}
function learningPath() { const p = prefs().path; return Array.isArray(p) && p.length ? p.filter((n) => n >= 1 && n <= 114) : defaultPath(); }

/* --- Progression par sourate (kind « progress », id « sN ») --- */
function emptyProgress(s) { return { s, startedAt: null, level: 1, nextA: 1, nextC: 0, listened: [], worked: [], solo: [], chunkSolo: {}, chunkWorked: {}, m: {}, known: false, teacher: null, lastAt: null }; }
function progressOf(s) { const p = Store.mem.progress.get('s' + s); return p ? Object.assign(emptyProgress(s), p) : emptyProgress(s); }
function hasStarted(s) { const p = Store.mem.progress.get('s' + s); return !!(p && (p.startedAt || (p.listened && p.listened.length) || (p.worked && p.worked.length) || p.known)); }
function surahAttempts(s) { return Array.from(Store.mem.attempt.values()).filter((x) => x.s === s && x.scope === 'surah').sort((a, b) => String(a.at).localeCompare(String(b.at))); }
/* Recalcule les jalons à partir des faits enregistrés ; une date acquise est conservée */
function refreshMilestones(p) {
  const meta = suraMeta(p.s); if (!meta) return p;
  const N = meta.ayas; const today = todayISO(); const all = (arr) => arr && uniqSorted(arr).length >= N;
  const m = Object.assign({}, p.m || {});
  if (!m[1] && all(p.listened)) m[1] = today;
  if (!m[2] && all(p.worked)) m[2] = today;
  if (!m[3] && all(p.solo)) m[3] = today;
  const full = surahAttempts(p.s).filter((x) => x.result === 'solo' && !x.aided);
  if (!m[4] && full.length) m[4] = full[0].date;
  if (m[4]) {
    if (!m[5] && full.some((x) => x.date > m[4])) m[5] = full.find((x) => x.date > m[4]).date;
    if (!m[6]) { const lim = addDays(m[4], 7); const h = full.find((x) => x.date >= lim); if (h) m[6] = h.date; }
  }
  p.m = m; return p;
}
function milestoneCount(p) { return [1, 2, 3, 4, 5, 6].filter((k) => p.m && p.m[k]).length; }
async function saveProgress(p) { refreshMilestones(p); p.lastAt = nowStamp(); return put('progress', 's' + p.s, p); }
function markListened(s, a) {
  const p = progressOf(s);
  if (p.listened.includes(a)) return;
  p.listened = uniqSorted(p.listened.concat([a]));
  if (!p.startedAt && Store.mem.progress.has('s' + s)) p.startedAt = todayISO();
  return saveProgress(p);
}

/* États d'une sourate (le texte est toujours écrit, jamais seulement une couleur) */
const STATE_INFO = {
  decouvrir: { label: 'À découvrir', icon: 'circle' },
  apprentissage: { label: 'En apprentissage', icon: 'sprout' },
  memorisee: { label: 'Mémorisée — auto-évaluation', icon: 'check-circle' },
  revoir: { label: 'À revoir', icon: 'refresh' },
};
function surahState(s) {
  const p = Store.mem.progress.get('s' + s);
  if (!p || !(p.startedAt || (p.worked && p.worked.length) || (p.m && p.m[4]))) return 'decouvrir';
  if (!(p.m && p.m[4])) return 'apprentissage';
  const r = Store.mem.review.get('s' + s);
  if (r && (r.due <= todayISO() || (r.last && r.last.result === 'rework'))) return 'revoir';
  return 'memorisee';
}

/* --- Révisions (kind « review ») --- */
function reviewId(it) { return it.type === 'surah' ? 's' + it.s : 'p' + it.s + ':' + it.a1 + '-' + it.a2 + (isNum(it.c) ? 'c' + it.c : ''); }
function scheduleAfter(r, result, today) {
  r = Object.assign({ stage: 0, lapses: 0, interval: 1 }, r);
  if (result === 'solo') {
    if (!r.first) { r.first = today; r.stage = 0; r.due = addDays(today, REVIEW_OFFSETS[0]); r.interval = REVIEW_OFFSETS[0]; }
    else if (r.stage < REVIEW_OFFSETS.length - 1) {
      r.stage += 1;
      // repères calculés depuis la première réussite ; si la révision a eu lieu en retard, on garde un écart minimal
      const planned = addDays(r.first, REVIEW_OFFSETS[r.stage]);
      const minGap = REVIEW_OFFSETS[r.stage] - REVIEW_OFFSETS[r.stage - 1];
      r.due = planned > today ? planned : addDays(today, minGap);
      r.interval = daysBetween(today, r.due);
    } else {
      // entretien : l'écart s'allonge tant que c'est réussi sans aide (plafond 120 jours)
      r.stage = REVIEW_OFFSETS.length; r.interval = clamp(Math.round((r.interval || 30) * 2), 30, 120); r.due = addDays(today, r.interval);
    }
  } else if (result === 'hesitation') {
    // une hésitation rapproche la prochaine révision, sans effacer le travail fait
    r.interval = Math.max(1, Math.round((r.interval || 2) / 2)); r.due = addDays(today, r.interval);
  } else {
    // à retravailler : revu demain, puis l'espacement repart plus court (deux crans plus bas), sans effacer l'historique
    r.lapses = (r.lapses || 0) + 1; r.stage = Math.max(0, Math.min(r.stage || 0, REVIEW_OFFSETS.length - 1) - 2); r.interval = 1; r.due = addDays(today, 1);
  }
  r.last = { date: today, result };
  return r;
}
async function recordReview(it, result) {
  const id = reviewId(it); const today = todayISO();
  const cur = Store.mem.review.get(id);
  if (!cur && result !== 'solo') {
    // pas encore de première réussite : on revoit le passage demain, sans étape d'espacement
    return put('review', id, { type: it.type, s: it.s, a1: it.a1, a2: it.a2, c: isNum(it.c) ? it.c : null, first: null, stage: 0, interval: 1, due: addDays(today, 1), lapses: result === 'rework' ? 1 : 0, last: { date: today, result }, active: true });
  }
  if (cur && cur.last && cur.last.date === today && cur.last.result === 'rework' && result !== 'rework') {
    // reprise le jour même après « À retravailler » : utile pour apprendre, mais la révision reste prévue demain
    return put('review', id, Object.assign({}, cur, { covered: false, last: Object.assign({}, cur.last, { retry: result }) }));
  }
  const base = cur ? Object.assign({}, cur, { covered: false }) : { type: it.type, s: it.s, a1: it.a1, a2: it.a2, c: isNum(it.c) ? it.c : null, active: true };
  return put('review', id, scheduleAfter(base, result, today));
}
/* Révisions de versets qui se suivent dans une même sourate : une seule récitation (6 versets au plus).
   Chaque passage garde son propre calendrier. */
const REVIEW_GROUP_MAX = 6;
function reviewGroups(due) {
  const groups = []; const bySura = new Map();
  for (const r of due) {
    if (r.type === 'passage' && !isNum(r.c)) { if (!bySura.has(r.s)) bySura.set(r.s, []); bySura.get(r.s).push(r); }
    else groups.push([r]);
  }
  bySura.forEach((list) => {
    list.sort((a, b) => a.a1 - b.a1 || a.a2 - b.a2);
    let g = []; let a1 = 0; let a2 = 0;
    for (const r of list) {
      const joins = g.length && r.a1 <= a2 + 1 && Math.max(a2, r.a2) - a1 + 1 <= REVIEW_GROUP_MAX;
      if (g.length && !joins) { groups.push(g); g = []; }
      if (!g.length) { a1 = r.a1; a2 = r.a2; } else a2 = Math.max(a2, r.a2);
      g.push(r);
    }
    if (g.length) groups.push(g);
  });
  const firstDue = (g) => g.reduce((m, r) => (r.due < m ? r.due : m), g[0].due);
  return groups.sort((x, y) => firstDue(x).localeCompare(firstDue(y)) || (x[0].type === 'surah' ? -1 : 1));
}
function dueReviews(today) {
  today = today || todayISO();
  return Array.from(Store.mem.review.entries()).map(([id, r]) => Object.assign({ id }, r))
    .filter((r) => r.active !== false && !r.covered && r.due && r.due <= today)
    .sort((a, b) => a.due.localeCompare(b.due) || (a.type === 'surah' ? -1 : 1));
}
function upcomingReviews(days) {
  const lim = addDays(todayISO(), days);
  return Array.from(Store.mem.review.values()).filter((r) => r.active !== false && !r.covered && r.due && r.due <= lim);
}
function nextReviewDate() {
  const t = todayISO();
  const ds = Array.from(Store.mem.review.values()).filter((r) => r.active !== false && !r.covered && r.due && r.due > t).map((r) => r.due).sort();
  return ds[0] || null;
}
/* Quand la sourate entière est réussie sans aide, ses passages n'ont plus besoin de révisions séparées */
async function coverPassages(s) {
  for (const [id, r] of Store.mem.review) if (r.type === 'passage' && r.s === s && !r.covered) await put('review', id, Object.assign({}, r, { covered: true }));
}

/* --- Tentatives (kind « attempt » : une ligne par tentative, jamais modifiée) --- */
async function recordAttempt(a) {
  const id = uid('t');
  const row = Object.assign({ at: nowStamp(), date: todayISO() }, a);
  await put('attempt', id, row);
  return row;
}
function practiceDays() { return new Set(Array.from(Store.mem.attempt.values()).map((x) => x.date)).size; }
function lastPracticeDate() { let d = null; Store.mem.attempt.forEach((x) => { if (!d || x.date > d) d = x.date; }); return d; }
function practicedToday() { const t = todayISO(); for (const x of Store.mem.attempt.values()) if (x.date === t) return true; return false; }

/* --- Prochain passage nouveau dans une sourate --- */
function nextPassage(s, d) { return d ? nextPassageFrom(s, d, {}) : null; }
function advanceAfterNew(p, item, d) {
  const meta = suraMeta(p.s);
  if (item.nc > 1 && item.c < item.nc - 1) { p.nextA = item.a1; p.nextC = item.c + 1; }
  else { p.nextA = Math.min(meta.ayas + 1, item.a2 + 1); p.nextC = 0; }
}
/* Versets précédents à relier (au plus 3 avant le passage, pour rester court) */
function linkRange(item) {
  if (item.a1 <= 1 && !(isNum(item.c) && item.c > 0)) return null;
  if (isNum(item.c) && item.c > 0) return { s: item.s, a1: item.a1, a2: item.a1, c: item.c, chainChunks: true };
  return { s: item.s, a1: Math.max(1, item.a1 - 3), a2: item.a2 };
}

/* --- Construction d'une séance : d'abord les révisions prévues, puis du nouveau si le temps le permet.
   La durée choisie est un repère, pas une quantité à finir. Après une absence : reprise légère. --- */
function sessionMinutes() { return prefs().minutes || 10; }
function estimateItem(it) {
  const meta = suraMeta(it.s);
  if (it.type === 'surah' || it.type === 'known') return clamp((meta ? meta.words : 30) / 22, 1, 12);
  if (it.type === 'review') return 1.2 + 0.35 * Math.max(0, (it.a2 || 0) - (it.a1 || 0));
  return 2.6;
}
function currentSurah() {
  const path = learningPath(); const cur = prefs().current;
  if (cur && cur >= 1 && cur <= 114) return cur;
  for (const n of path) { const p = Store.mem.progress.get('s' + n); if (!p || !(p.m && p.m[4])) return n; }
  return path[0] || 1;
}
function nextInPath(after) {
  const path = learningPath(); const i = path.indexOf(after);
  for (let k = i + 1; k < path.length; k++) { const p = Store.mem.progress.get('s' + path[k]); if (!p || !(p.m && p.m[4])) return path[k]; }
  for (const n of path) { const p = Store.mem.progress.get('s' + n); if (n !== after && (!p || !(p.m && p.m[4]))) return n; }
  return null;
}
function isReturning() { const last = lastPracticeDate(); return !!(last && daysBetween(last, todayISO()) >= 4); }
async function buildSession() {
  const budget = sessionMinutes(); const today = todayISO(); const returning = isReturning();
  const items = []; let used = 0;
  const groups = reviewGroups(dueReviews(today));
  const maxReviews = returning ? 3 : Math.max(2, Math.round(budget * 0.7 / 1.2));
  for (const g of groups) {
    if (items.length >= maxReviews) break;
    const r = g[0];
    const it = r.type === 'surah' ? { type: 'surah', s: r.s, mode: 'review', reviewId: r.id }
      : g.length > 1 ? { type: 'review', s: r.s, a1: Math.min(...g.map((x) => x.a1)), a2: Math.max(...g.map((x) => x.a2)), c: null, reviewIds: g.map((x) => x.id) }
      : { type: 'review', s: r.s, a1: r.a1, a2: r.a2, c: isNum(r.c) ? r.c : null, reviewId: r.id };
    if (items.length && used + estimateItem(it) > budget) break;
    items.push(it); used += estimateItem(it);
  }
  const s = currentSurah();
  const d = await loadSura(s);
  const p = progressOf(s); const meta = suraMeta(s);
  const allWorked = uniqSorted(p.worked).length >= meta.ayas;
  const allowNew = !returning || items.length === 0;
  if (allowNew) {
    if (allWorked && !(p.m && p.m[4])) {
      if (!items.some((x) => (x.type === 'surah' || x.type === 'known') && x.s === s)) { const it = { type: 'surah', s, mode: 'learn' }; items.push(it); used += estimateItem(it); }
    } else if (!allWorked) {
      let sim = { nextA: p.nextA || 1, nextC: p.nextC || 0, level: p.level || 1 };
      const maxNew = returning ? 1 : 4;
      let added = 0;
      while (added < maxNew && (used < budget - 1.5 || added === 0)) {
        const it = nextPassageFrom(s, d, sim);
        if (!it) break;
        items.push(it); used += estimateItem(it); added++;
        if (it.nc > 1 && it.c < it.nc - 1) sim = { nextA: it.a1, nextC: it.c + 1, level: sim.level };
        else sim = { nextA: it.a2 + 1, nextC: 0, level: sim.level };
        if (sim.nextA > meta.ayas) break;
      }
    }
  }
  return { id: uid('sess'), date: today, startedAt: nowStamp(), budget, returning, items, i: 0, step: null, stepState: {}, results: [], done: false };
}
function nextPassageFrom(s, d, sim) {
  const p = Object.assign(progressOf(s), sim);
  const meta = suraMeta(s); let a = p.nextA || 1; if (a > meta.ayas) return null;
  const chunks = verseChunks(d, a);
  if (chunks.length > 1) return { type: 'new', s, a1: a, a2: a, c: clamp(p.nextC || 0, 0, chunks.length - 1), nc: chunks.length };
  const level = clamp(p.level || 1, 1, 3); const maxWords = level === 1 ? Infinity : level === 2 ? 12 : 16;
  let a2 = a; let words = wordCount(d, a);
  while (a2 - a + 1 < level && a2 < meta.ayas) {
    const nx = a2 + 1; if (verseChunks(d, nx).length > 1) break;
    const w = wordCount(d, nx); if (words + w > maxWords) break; a2 = nx; words += w;
  }
  return { type: 'new', s, a1: a, a2, c: null, nc: 1 };
}
/* Prochaine action utile, pour l'accueil */
function homeAction() {
  const sess = Store.session;
  if (sess && !sess.done && sess.date === todayISO() && sess.items && sess.i < sess.items.length && (sess.step || sess.i > 0)) return { kind: 'resume', label: 'Reprendre ma séance' };
  if (dueReviews().length) return { kind: 'review', label: 'Commencer ma séance' };
  return { kind: 'new', label: 'Commencer ma séance' };
}

/* ===== Interface : briques communes ===== */
const UI = { tab: 'learn', pages: [], sheets: [], renderQueued: false, splashGone: false, q: '', readSeg: 'suras', learnMeaning: false, busy: false };
const AMBIANCES = {
  vert: { label: 'Vert doux', theme: '#E7F4EB', dark: false },
  papier: { label: 'Papier', theme: '#FAF8F1', dark: false },
  nuit: { label: 'Nuit', theme: '#0F1F1A', dark: true },
};
const DISPLAYS = {
  ar: { label: 'Arabe', ar: true, tl: false, fr: false },
  fr: { label: 'Français', ar: false, tl: false, fr: true },
  ar_fr: { label: 'Arabe + français', ar: true, tl: false, fr: true },
  ar_tl: { label: 'Arabe + phonétique', ar: true, tl: true, fr: false },
  ar_tl_fr: { label: 'Arabe + phonétique + français', ar: true, tl: true, fr: true },
};
function applyAmbiance() {
  const a = AMBIANCES[prefs().ambiance] ? prefs().ambiance : 'vert';
  document.documentElement.dataset.ambiance = a;
  document.documentElement.style.setProperty('--ar-size', clamp(prefs().arSize || 30, 22, 52) + 'px');
  const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', AMBIANCES[a].theme);
  document.documentElement.style.colorScheme = AMBIANCES[a].dark ? 'dark' : 'light';
}
function scheduleRender() {
  if (UI.renderQueued) return;
  UI.renderQueued = true;
  requestAnimationFrame(() => { UI.renderQueued = false; renderAll(); });
}
function typingIn(el) { const a = document.activeElement; return !!(a && el && el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }

/* --- Messages (avec action facultative) --- */
const Toast = { timer: null, action: null };
function toast(msg, isErr, action) {
  const root = $('#toasts'); clearTimeout(Toast.timer); Toast.action = action || null; root.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'toast' + (isErr ? ' is-err' : '');
  el.innerHTML = `${icon(isErr ? 'alert-circle' : 'check')}<span class="toast__t"></span>${action ? `<button type="button" class="toast__btn" data-act="toast-action">${esc(action.label)}</button>` : ''}`;
  el.querySelector('.toast__t').textContent = msg;
  root.appendChild(el);
  Toast.timer = setTimeout(() => { el.remove(); Toast.action = null; }, isErr ? 6500 : action ? 6500 : 3200);
}

/* --- Feuilles (bottom sheets) --- */
const SHEETS = {};
function openSheet(name, props = {}) {
  UI.sheets.push({ name, props, key: uid('s'), opener: document.activeElement });
  renderSheets();
  const s = $('#sheets .sheet-wrap:last-child .sheet');
  if (s) { const f = s.querySelector('[autofocus]') || s.querySelector('h2'); if (f) f.focus({ preventScroll: true }); }
}
function closeSheet() {
  const top = UI.sheets.pop();
  if (top && SHEETS[top.name] && SHEETS[top.name].onClose) SHEETS[top.name].onClose(top.props);
  renderSheets();
  if (top && top.opener && top.opener.isConnected) { try { top.opener.focus({ preventScroll: true }); } catch (e) { /* rien */ } }
}
function closeAllSheets() { while (UI.sheets.length) closeSheet(); }
function topSheet() { return UI.sheets[UI.sheets.length - 1] || null; }
function renderSheets() {
  const root = $('#sheets');
  if (!UI.sheets.length) { root.innerHTML = ''; document.body.classList.remove('has-sheet'); return; }
  document.body.classList.add('has-sheet');
  const focusId = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;
  const keep = new Map($$('#sheets .sheet-wrap').map((el) => [el.dataset.key, el.querySelector('.sheet').scrollTop]));
  root.innerHTML = UI.sheets.map((s, i) => {
    let inner;
    try { inner = SHEETS[s.name].render(s.props); } catch (e) { console.error(e); inner = { title: 'Oups', body: `<p class="notice notice--warn">${icon('alert')}<span>Cet écran n’a pas pu s’afficher. Ferme-le et réessaie.</span></p>` }; }
    if (!inner) return '';
    return `<div class="sheet-wrap" data-key="${s.key}" style="z-index:${60 + i}">
      <div class="sheet-scrim" data-act="sheet-close"></div>
      <section class="sheet${inner.cls ? ' ' + inner.cls : ''}" role="dialog" aria-modal="true" aria-labelledby="sh-${s.key}">
        <div class="sheet__grab" aria-hidden="true"></div>
        <div class="sheet__head"><h2 class="sheet__title" id="sh-${s.key}" tabindex="-1">${inner.title}</h2>
          <button type="button" class="icon-btn" data-act="sheet-close" aria-label="Fermer">${icon('x')}</button></div>
        <div class="sheet__body">${inner.body}</div>
      </section></div>`;
  }).join('');
  $$('#sheets .sheet-wrap').forEach((el) => {
    if (!keep.has(el.dataset.key)) return;
    const sh = el.querySelector('.sheet'); sh.scrollTop = keep.get(el.dataset.key);
    sh.style.animation = 'none'; el.querySelector('.sheet-scrim').style.animation = 'none';
  });
  if (focusId) { const f = document.getElementById(focusId); if (f) f.focus({ preventScroll: true }); }
}
function refreshSheet() { renderSheets(); }

/* --- Pages empilées (lecteur, séance, réglages, détails) --- */
const PAGES = {};
function openPage(name, props = {}) {
  const cur = UI.pages[UI.pages.length - 1];
  if (cur) { const el = $('#pages .page'); if (el) cur.scroll = el.scrollTop; }
  UI.pages.push({ name, props, key: uid('pg') });
  renderPage(true);
  updateNav();
}
function backPage() {
  const top = UI.pages.pop();
  if (top && PAGES[top.name] && PAGES[top.name].onClose) PAGES[top.name].onClose(top.props);
  renderPage(true); renderAll();
}
function topPage() { return UI.pages[UI.pages.length - 1] || null; }
function renderPage(fresh) {
  const root = $('#pages'); const top = topPage();
  document.body.classList.toggle('has-page', !!top);
  document.body.dataset.page = top ? top.name : '';
  if (!top) { root.innerHTML = ''; return; }
  const existing = root.querySelector('.page');
  if (!fresh && existing && existing.dataset.key === top.key && typingIn(existing)) return;
  const P = PAGES[top.name];
  let html;
  try { html = P.render(top.props, top); } catch (e) { console.error(e); html = `${pageHead('Oups')}<p class="notice notice--warn">${icon('alert')}<span>Cet écran n’a pas pu s’afficher.</span></p>`; }
  if (html == null) { UI.pages.pop(); renderPage(true); return; }
  const sameKey = existing && existing.dataset.key === top.key;
  const scroll = sameKey ? existing.scrollTop : (fresh ? (top.scroll || 0) : 0);
  // même écran redessiné : on garde le même contenu sous les yeux (pas seulement la même position en pixels)
  const snap = sameKey && P.snapshot ? P.snapshot(existing, top.props) : null;
  root.innerHTML = `<div class="page page--${top.name}" data-key="${top.key}" role="region" aria-label="${esc(P.label ? P.label(top.props) : '')}"><div class="page__inner">${html}</div></div>`;
  const el = root.querySelector('.page');
  if (sameKey || (P.noAnim)) el.style.animation = 'none';
  el.scrollTop = scroll;
  if (snap && P.restore) { try { P.restore(el, snap, top.props); } catch (e) { /* position approximative */ } }
  if (P.after) { try { P.after(top.props, el, fresh && !sameKey); } catch (e) { console.error(e); } }
}
function pageHead(title, opts = {}) {
  return `<div class="topbar">
      <button type="button" class="icon-btn" data-act="back" aria-label="${esc(opts.backLabel || 'Retour')}">${icon(opts.backIcon || 'chev-l')}</button>
      <h1 class="topbar__title">${esc(title)}</h1>
      <div class="topbar__end">${opts.end || ''}</div>
    </div>`;
}

/* --- Rendu général --- */
function renderAll() {
  applyAmbiance();
  for (const t of ['learn', 'read', 'progress']) { const el = $('#tab-' + t); if (el) el.hidden = UI.tab !== t; }
  try {
    if (UI.tab === 'learn') renderLearn();
    else if (UI.tab === 'read') renderRead();
    else renderProgress();
  } catch (e) { console.error(e); }
  updateNav();
  renderPage(false);
  renderPlayerBar();
  saveSummarySoon();
}
function updateNav() {
  $$('.nav__tab').forEach((b) => { const on = b.dataset.tab === UI.tab && !UI.pages.length; b.classList.toggle('is-active', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}
function busy(btn, label) {
  if (!btn) return () => {};
  const h = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin" aria-hidden="true"></span>${esc(label || 'Un instant…')}`;
  return () => { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = h; } };
}
/* Nom affiché d'une sourate */
function suraTitle(s) { const m = suraMeta(s); return m ? m.name : 'Sourate ' + s; }
function suraBadge(n) { return `<span class="snum" aria-hidden="true"><svg viewBox="0 0 40 40"><use href="#star8"/></svg><b>${n}</b></span>`; }
function rangeLabel(it) {
  if (!it) return '';
  if (it.type === 'surah' || it.type === 'known') return 'Toute la sourate';
  const base = it.a1 === it.a2 ? `Verset ${it.a1}` : `Versets ${it.a1} à ${it.a2}`;
  return isNum(it.c) ? (it.nc > 1 ? `${base}, partie ${it.c + 1} sur ${it.nc}` : `${base}, partie ${it.c + 1}`) : base;
}

/* Résumé lu par la carte « Mon Coran » de l'accueil de l'agenda (localStorage, quelques octets) */
function saveSummary() {
  if (!Store.ready || !Content.index) return;
  try {
    const s = currentSurah();
    localStorage.setItem('qr.summary.v1', JSON.stringify({ uid: Store.uid, date: todayISO(), s, name: suraTitle(s), due: dueReviews().length, done: practicedToday(), at: Date.now() }));
  } catch (e) { /* facultatif */ }
}
const saveSummarySoon = debounce(saveSummary, 800);

/* ===== Écrans principaux : Apprendre · Lire · Mes progrès ===== */
function topbarMain() {
  return `<div class="topbar topbar--main">
      <button type="button" class="icon-btn" data-act="go-agenda" aria-label="Revenir à l’agenda">${icon('chev-l')}</button>
      <span class="brand">${icon('book', 'sm')}Mon Coran</span>
      <button type="button" class="icon-btn" data-act="open-page" data-page="settings" aria-label="Réglages">${icon('settings')}</button>
    </div>`;
}
function bootError() {
  return `<div class="empty">
      ${icon('alert', 'lg')}
      <h2 class="h3">Le Coran n’a pas pu être chargé</h2>
      <p class="muted">${esc(contentErrorText(Content.indexError))}</p>
      <button type="button" class="btn btn--primary" data-act="reload">Réessayer</button>
    </div>`;
}

/* --- Apprendre --- */
function renderLearn() {
  const root = $('#tab-learn');
  if (!Content.index) { root.innerHTML = topbarMain() + (Content.indexError ? bootError() : '<div class="loading"><span class="spin"></span></div>'); return; }
  const act = homeAction(); const s = currentSurah(); const meta = suraMeta(s); const p = progressOf(s);
  const d = Content.suras.get(s);
  if (!d) loadSura(s).then(scheduleRender, () => {});
  const due = dueReviews();
  const returning = isReturning();
  let label = 'Passage en cours'; let line = ''; let sub = meta.sub ? esc(meta.sub) : '';
  if (act.kind === 'resume') {
    const it = Store.session.items[Store.session.i];
    label = 'Séance en cours';
    const stepName = { listen: 'Écouter', repeat: 'Répéter', recite: 'Réciter', eval: 'Réciter', after: 'Réciter', difficult: 'Réciter' }[Store.session.step] || (String(Store.session.step || '').startsWith('link') ? 'Relier' : '');
    line = !it ? '' : it.type === 'review' ? `Révision · ${esc(rangeLabel(it))}`
      : it.type === 'surah' || it.type === 'known' ? (it.mode === 'review' ? 'Révision · toute la sourate' : 'Toute la sourate, de mémoire')
      : `${esc(rangeLabel(it))}${stepName ? ` · étape « ${stepName} »` : ''}`;
  } else if (act.kind === 'review') {
    const r = due[0];
    label = 'Révision prévue';
    line = r.type === 'surah' ? 'Toute la sourate, de mémoire' : esc(rangeLabel({ type: 'review', a1: r.a1, a2: r.a2, c: r.c }));
  } else if (d) {
    const allWorked = uniqSorted(p.worked).length >= meta.ayas;
    const it = allWorked ? null : nextPassage(s, d);
    line = allWorked ? (p.m && p.m[4] ? 'Sourate récitée sans aide' : 'Prochaine étape : réciter toute la sourate') : esc(rangeLabel(it));
  } else line = 'Verset ' + (p.nextA || 1);
  const dueLine = due.length
    ? `${icon('refresh', 'sm')}<span>${due.length > 3 && returning ? 'Quelques révisions prévues' : `${due.length} ${plural(due.length, 'révision prévue', 'révisions prévues')} aujourd’hui`}</span>`
    : (() => { const n = nextReviewDate(); return `${icon('calendar', 'sm')}<span>${n ? `Prochaine révision ${esc(dayName(n))}` : 'Aucune révision prévue pour l’instant'}</span>`; })();
  const showKnown = s === 1 && !hasStarted(1) && act.kind === 'new';
  const focusS = act.kind === 'resume' ? ((Store.session.items[Store.session.i] || {}).s || s) : act.kind === 'review' ? due[0].s : s;
  const fm = suraMeta(focusS);
  root.innerHTML = `${topbarMain()}
    <section class="hero">
      <div class="hero__text">
        <h1 class="hero__title">Un peu chaque jour</h1>
        ${returning && act.kind !== 'resume' ? '<p class="hero__note">On reprend tranquillement.</p>' : ''}
      </div>
      <img class="hero__art" src="coran/livre-sur-pupitre.webp" alt="" width="768" height="768" decoding="async">
    </section>
    <section class="today" aria-labelledby="todayName">
      <p class="today__label">${esc(label)}</p>
      <div class="today__sura">
        <h2 id="todayName" class="today__name">${esc(fm.name)}</h2>
        <span class="today__ar ar-inline" lang="ar" dir="rtl" translate="no">${esc(fm.ar)}</span>
      </div>
      <p class="today__line">${act.kind === 'new' && sub ? `<span class="today__sub">${sub}</span> · ` : ''}${line}</p>
      <button type="button" class="btn btn--primary btn--xl" data-act="session-start">${icon(act.kind === 'resume' ? 'play' : act.kind === 'review' ? 'refresh' : 'play')}<span>${esc(act.label)}</span></button>
      <p class="today__time">${icon('clock', 'sm')}<span>Environ ${sessionMinutes()} min</span></p>
    </section>
    ${!Store.idbOk ? `<p class="notice notice--warn">${icon('alert')}<span>Ce navigateur n’enregistre pas ta progression (navigation privée ou stockage plein). Ouvre l’appli depuis son icône, ou exporte une sauvegarde dans les réglages.</span></p>` : ''}
    <p class="line-info">${dueLine}</p>
    ${showKnown ? `<button type="button" class="link-row" data-act="known-start" data-s="1">${icon('check-circle', 'sm')}<span>Je connais déjà Al-Fatiha : essayer de la réciter sans aide</span>${icon('chev-r', 'sm')}</button>` : ''}
    <div class="home-links">
      <button type="button" class="btn btn--soft" data-act="tab" data-tab="read">${icon('book-open')}<span>Ouvrir le Coran</span></button>
      <button type="button" class="btn btn--ghost" data-act="open-page" data-page="path">${icon('route')}<span>Mon parcours</span></button>
    </div>`;
}

/* --- Lire : recherche, reprise, favoris, sourates / juz / pages --- */
function renderRead() {
  const root = $('#tab-read');
  if (!Content.index) { root.innerHTML = topbarMain() + (Content.indexError ? bootError() : '<div class="loading"><span class="spin"></span></div>'); return; }
  if (root.querySelector('#readSearch') && typingIn(root)) { paintReadList(); return; }
  const pos = Store.mem.pos;
  const favs = Array.from(Store.mem.fav.entries()).map(([id, f]) => Object.assign({ id }, f)).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  root.innerHTML = `${topbarMain()}
    <h1 class="screen-title">Lire le Coran</h1>
    <label class="search" for="readSearch">${icon('search')}<input id="readSearch" type="search" inputmode="search" autocomplete="off" placeholder="Nom, numéro ou verset (2:255)" value="${esc(UI.q)}" aria-label="Rechercher une sourate, un verset, une page ou un juz"></label>
    <div id="readJump"></div>
    ${pos && pos.s ? `<button type="button" class="resume" data-act="open-reader" data-s="${pos.s}" data-a="${pos.a || 1}" data-mode="${esc(pos.mode || 'verse')}">
        <span class="resume__k">${icon('bookmark-check', 'sm')}Reprendre la lecture</span>
        <span class="resume__t">${esc(suraTitle(pos.s))} · ${pos.mode === 'page' && pos.page ? `page ${pos.page}` : `verset ${pos.a || 1}`}</span>
        ${icon('chev-r')}</button>` : ''}
    ${favs.length ? `<section class="favs" aria-label="Favoris">
        <h2 class="sec-title">${icon('bookmark', 'sm')}Favoris</h2>
        <ul class="fav-list">${favs.map((f) => `<li><button type="button" class="fav" data-act="open-reader" data-s="${f.s}" data-a="${f.a}">
            <span class="fav__ref">${esc(suraTitle(f.s))} · ${f.a}</span>${f.label ? `<span class="fav__label">${esc(f.label)}</span>` : ''}</button>
            <button type="button" class="icon-btn icon-btn--sm" data-act="fav-edit" data-id="${esc(f.id)}" aria-label="Modifier ce favori">${icon('pencil', 'sm')}</button></li>`).join('')}</ul>
      </section>` : ''}
    <div class="seg" role="tablist" aria-label="Parcourir par">
      ${[['suras', 'Sourates'], ['juz', 'Juz'], ['pages', 'Pages']].map(([k, l]) => `<button type="button" role="tab" class="seg__b${UI.readSeg === k ? ' is-on' : ''}" aria-selected="${UI.readSeg === k}" data-act="read-seg" data-seg="${k}">${l}</button>`).join('')}
    </div>
    <div id="readList"></div>`;
  paintReadList();
}
function paintReadList() {
  const list = $('#readList'); const jumpEl = $('#readJump'); if (!list) return;
  const idx = Content.index; const res = searchSuras(UI.q);
  if (jumpEl) {
    const j = res.jump;
    jumpEl.innerHTML = !j ? '' : j.type === 'invalid' ? `<p class="notice notice--warn">${icon('info')}<span>${esc(j.text)}</span></p>`
      : `<button type="button" class="jump" data-act="${j.type === 'verse' ? 'open-reader' : j.type === 'page' ? 'open-page-mode' : 'open-juz'}" data-s="${j.s || ''}" data-a="${j.a || ''}" data-p="${j.p || ''}" data-j="${j.j || ''}">
          ${icon('arrow-r')}<span>${j.type === 'verse' ? `Aller au verset ${j.s}:${j.a} — ${esc(suraTitle(j.s))}` : j.type === 'page' ? `Ouvrir la page ${j.p} du Coran` : `Ouvrir le juz ${j.j}`}</span></button>`;
  }
  if (UI.q.trim() || UI.readSeg === 'suras') {
    const rows = res.suras;
    list.innerHTML = rows.length ? `<ul class="slist">${rows.map((m) => suraRow(m)).join('')}</ul>` : (res.jump ? '' : `<p class="empty-line">Aucune sourate ne correspond. Essaie un numéro (1 à 114) ou un nom comme « Ikhlas ».</p>`);
    return;
  }
  if (UI.readSeg === 'juz') {
    list.innerHTML = `<button type="button" class="info-card" data-act="sheet" data-sheet="juzamma">${icon('info')}<span><b>Juz Amma</b> : la dernière des 30 parties, 37 sourates courtes pour la plupart.</span>${icon('chev-r', 'sm')}</button>
      <ul class="slist">${idx.juz.map((j) => `<li><button type="button" class="srow" data-act="open-juz" data-j="${j.n}">
        <span class="snum snum--plain" aria-hidden="true"><b>${j.n}</b></span>
        <span class="srow__main"><span class="srow__name">Juz ${j.n}${j.n === 30 ? ' · Juz Amma' : ''}</span><span class="srow__sub">Commence à ${esc(suraTitle(j.s))}, verset ${j.a}</span></span>
        ${icon('chev-r', 'sm')}</button></li>`).join('')}</ul>`;
    return;
  }
  // pages : accès direct + débuts de sourates
  list.innerHTML = `<form class="page-go" data-form="page-go">
      <label for="pageGo">Aller à la page</label>
      <div class="page-go__row"><input id="pageGo" type="number" inputmode="numeric" min="1" max="604" placeholder="1 à 604"><button type="submit" class="btn btn--primary">Ouvrir</button></div>
      <p class="muted tiny">Pages du Mushaf de Médine (604 pages) : chaque page contient exactement les mêmes versets que la page imprimée.</p>
    </form>
    <ul class="slist">${idx.suras.map((m) => `<li><button type="button" class="srow" data-act="open-page-mode" data-p="${m.p1}">
      ${suraBadge(m.n)}<span class="srow__main"><span class="srow__name">${esc(m.name)}</span><span class="srow__sub">Page ${m.p1}${m.p2 !== m.p1 ? ` à ${m.p2}` : ''}</span></span>
      <span class="srow__ar" lang="ar" dir="rtl" translate="no">${esc(m.ar)}</span></button></li>`).join('')}</ul>`;
}
function suraRow(m) {
  const st = surahState(m.n);
  return `<li><button type="button" class="srow" data-act="open-reader" data-s="${m.n}">
      ${suraBadge(m.n)}
      <span class="srow__main"><span class="srow__name">${esc(m.name)}</span><span class="srow__sub">${m.sub ? esc(m.sub) + ' · ' : ''}${m.ayas} versets${st !== 'decouvrir' ? ` · ${esc(STATE_INFO[st].label)}` : ''}</span></span>
      <span class="srow__ar" lang="ar" dir="rtl" translate="no">${esc(m.ar)}</span>
    </button></li>`;
}

/* --- Mes progrès : seulement l'utile --- */
function renderProgress() {
  const root = $('#tab-progress');
  if (!Content.index) { root.innerHTML = topbarMain() + (Content.indexError ? bootError() : '<div class="loading"><span class="spin"></span></div>'); return; }
  const started = Content.index.suras.filter((m) => surahState(m.n) !== 'decouvrir');
  const worked = started.length;
  const solo = Content.index.suras.filter((m) => { const p = Store.mem.progress.get('s' + m.n); return p && p.m && p.m[4]; }).length;
  const week = upcomingReviews(6).length;
  const days = practiceDays();
  const sl = syncLabel();
  root.innerHTML = `${topbarMain()}
    <h1 class="screen-title">Mes progrès</h1>
    <div class="tiles">
      <div class="tile"><b class="num">${worked}</b><span>${plural(worked, 'sourate travaillée', 'sourates travaillées')}</span></div>
      <div class="tile"><b class="num">${solo}</b><span>${plural(solo, 'sourate récitée sans aide', 'sourates récitées sans aide')}</span></div>
      <div class="tile"><b class="num">${week}</b><span>${plural(week, 'révision prévue', 'révisions prévues')} cette semaine</span></div>
      <div class="tile"><b class="num">${days}</b><span>${plural(days, 'jour de pratique', 'jours de pratique')}</span></div>
    </div>
    ${started.length ? `<ul class="plist">${started.map((m) => progressRow(m)).join('')}</ul>`
      : `<div class="empty"><p>Tes sourates apparaîtront ici dès ta première séance.</p><button type="button" class="btn btn--primary" data-act="tab" data-tab="learn">Commencer</button></div>`}
    <p class="fine">Les étapes et le pourcentage décrivent ton parcours dans l’appli : ce n’est pas une mesure certaine de ta mémoire ni de ta prononciation.</p>
    <p class="sync-line sync-line--${sl.tone}">${icon(sl.tone === 'ok' ? 'cloud' : 'phone', 'sm')}<span>${esc(sl.text)}</span></p>`;
}
function progressRow(m) {
  const p = progressOf(m.n); const n = milestoneCount(p); const st = surahState(m.n);
  return `<li><button type="button" class="prow" data-act="open-page" data-page="sura-progress" data-s="${m.n}">
      <span class="prow__top">${suraBadge(m.n)}<span class="prow__name">${esc(m.name)}</span><span class="badge badge--${st}">${icon(STATE_INFO[st].icon, 'sm')}${esc(STATE_INFO[st].label)}</span></span>
      <span class="bar" role="img" aria-label="${n === 6 ? 'Parcours validé à 100 %' : `${n} étapes sur 6`}"><span style="width:${Math.round(n / 6 * 100)}%"></span></span>
      <span class="prow__meta">${n === 6 ? 'Parcours validé à 100 %' : `${n} ${plural(n, 'étape', 'étapes')} sur 6`}${p.teacher ? ` · ${icon('user-check', 'sm')} vérifiée avec un enseignant (renseigné par toi)` : ''}</span>
    </button></li>`;
}

/* ===== Lecteur : verset par verset, ou pages du Mushaf de Médine ===== */
const Reader = { observer: null, anchor: null, activeKey: null, audio: null };
function readerDisplay() { return DISPLAYS[prefs().readDisplay] ? prefs().readDisplay : 'ar_tl_fr'; }
function frLabel() {
  const n = Content.index && Content.index.notice && Content.index.notice.traduction;
  return `Traduction du sens — ${esc(n ? 'Rachid Maach' : '')}${n && n.version ? ` (QuranEnc, version ${esc(n.version)})` : ''}`;
}
function tlNote() {
  if (prefs().tlNoteSeen) return '';
  return `<div class="tip" role="note">${icon('ear')}<p>La phonétique t’aide à démarrer. Écoute aussi la récitation pour apprendre les sons.</p>
      <div class="tip__acts"><button type="button" class="btn btn--sm btn--ghost" data-act="sheet" data-sheet="tlhelp">Comment la lire</button><button type="button" class="btn btn--sm btn--soft" data-act="tl-note-ok">Compris</button></div></div>`;
}
function verseBlock(d, a, disp, opts = {}) {
  const s = d.n; const D = DISPLAYS[disp]; const fns = footnotes(d.fn[a - 1]);
  const isFav = Array.from(Store.mem.fav.values()).some((f) => f.s === s && f.a === a);
  const key = s + ':' + a;
  return `<li class="verse${Reader.activeKey === key ? ' is-active' : ''}" id="v-${s}-${a}" data-s="${s}" data-a="${a}">
      <div class="verse__bar">
        <button type="button" class="vnum" data-act="verse-menu" data-s="${s}" data-a="${a}" aria-label="Verset ${s}:${a}, options">${s}:${a}</button>
        ${isFav ? `<span class="verse__fav" aria-label="Dans tes favoris">${icon('bookmark-fill', 'sm')}</span>` : ''}
        <span class="verse__playing" aria-hidden="true">${icon('volume', 'sm')}</span>
      </div>
      ${D.ar ? `<p class="ar" lang="ar" dir="rtl" translate="no">${arWithEnd(d.arBody[a - 1], a)}</p>` : ''}
      ${D.tl ? `<p class="tl notranslate" translate="no">${tlHTML(d.tl[a - 1])}</p>` : ''}
      ${D.fr ? `<p class="fr notranslate" lang="fr" translate="no">${frHTML(d.fr[a - 1])}</p>` : ''}
      ${D.fr && fns.length ? `<details class="notes"><summary>${icon('lightbulb', 'sm')}Comprendre <span class="muted">(${fns.length} ${plural(fns.length, 'note', 'notes')} du traducteur)</span></summary>
          <ol class="notes__list">${fns.map((f) => `<li><span class="notes__n">${esc(f.n)}</span><span translate="no">${esc(f.t)}</span></li>`).join('')}</ol>
          <p class="notes__src">Notes de Rachid Maach, traduction QuranEnc.</p></details>` : ''}
    </li>`;
}
function readerTopbar(title, s) {
  return `<div class="topbar topbar--reader">
      <button type="button" class="icon-btn" data-act="back" aria-label="Retour">${icon('chev-l')}</button>
      <h1 class="topbar__title">${esc(title)}</h1>
      <div class="topbar__end">
        <button type="button" class="icon-btn" data-act="sheet" data-sheet="display" aria-label="Affichage">${icon('type')}</button>
        <button type="button" class="icon-btn" data-act="reader-play" data-s="${s || ''}" aria-label="Écouter">${icon('headphones')}</button>
        <button type="button" class="icon-btn" data-act="sheet" data-sheet="reader-more" aria-label="Plus d’options">${icon('more')}</button>
      </div>
    </div>`;
}
PAGES.reader = {
  label: (p) => 'Lecture ' + suraTitle(p.s),
  render(props) {
    const mode = props.mode || prefs().readMode || 'verse';
    props.mode = mode;
    if (mode === 'page') return renderMushafPage(props);
    const s = props.s; const meta = suraMeta(s); const d = Content.suras.get(s);
    if (!d) {
      // une erreur reste affichée (avec « Réessayer ») au lieu de relancer le chargement en boucle
      if (!props.loading && !props.err) { props.loading = true; if (props.a > 1 && !props.scrollTo) props.scrollTo = props.a; loadSura(s).then(() => { props.loading = false; renderPage(false); }, (e) => { props.loading = false; props.err = e; renderPage(false); }); }
      return `${readerTopbar(meta.name, s)}${props.err ? `<div class="empty">${icon('alert', 'lg')}<p>${esc(contentErrorText(props.err))}</p><button type="button" class="btn btn--primary" data-act="reader-retry">Réessayer</button></div>` : '<div class="loading"><span class="spin"></span><span>Chargement de la sourate…</span></div>'}`;
    }
    const disp = readerDisplay(); const D = DISPLAYS[disp];
    return `${readerTopbar(meta.name, s)}
      <header class="sura-head">
        <p class="sura-head__ar" lang="ar" dir="rtl" translate="no">${esc(meta.ar)}</p>
        <h2 class="sura-head__name">${esc(meta.name)}${meta.sub ? ` <span class="sura-head__sub">· ${esc(meta.sub)}</span>` : ''}</h2>
        <p class="sura-head__meta">Sourate ${s} · ${meta.ayas} versets · ${meta.type === 'Meccan' ? 'mecquoise' : 'médinoise'} · page ${meta.p1}</p>
      </header>
      ${D.fr ? `<p class="fr-label">${icon('languages', 'sm')}<span>${frLabel()}</span></p>` : ''}
      ${D.tl ? tlNote() : ''}
      ${d.bsm ? `<p class="basmala${Reader.activeKey === 'b:' + s ? ' is-active' : ''}" id="b-${s}" lang="ar" dir="rtl" translate="no">${esc(d.basmala)}</p>` : ''}
      <ol class="verses verses--${disp}">${d.ar.map((_, i) => verseBlock(d, i + 1, disp)).join('')}</ol>
      <nav class="reader-nav" aria-label="Sourates voisines">
        ${s > 1 ? `<button type="button" class="btn btn--soft" data-act="open-reader" data-s="${s - 1}" data-replace="1">${icon('chev-l', 'sm')}${esc(suraTitle(s - 1))}</button>` : '<span></span>'}
        ${s < 114 ? `<button type="button" class="btn btn--soft" data-act="open-reader" data-s="${s + 1}" data-replace="1">${esc(suraTitle(s + 1))}${icon('chev-r', 'sm')}</button>` : '<span></span>'}
      </nav>
      <p class="fine center">Texte arabe : Tanzil (Uthmani 1.1, Hafs). <button type="button" class="linkish" data-act="open-page" data-page="sources">Sources et droits</button></p>`;
  },
  after(props, el, fresh) {
    if (props.mode === 'page') {
      setupPageSwipe(el, props); savePagePos(props);
      // en passant du mode verset au mode page : le verset lu reste visible sur la page
      if (props.focus && !props.loading) {
        const t = el.querySelector('#mv-' + props.focus); el.scrollTop = 0; props.focus = null;
        if (t && t.getBoundingClientRect().bottom > el.clientHeight * 0.8) t.scrollIntoView({ block: 'center' });
      }
      return;
    }
    if (!Content.suras.get(props.s)) return;
    if (fresh || props.scrollTo) {
      const target = props.scrollTo || props.a; const explicit = !!props.scrollTo;
      props.scrollTo = null;
      if (target && target > 1) keepVerseInView(el, props.s, target); else if (explicit) el.scrollTop = 0;
    }
    observeVerses(el, props);
  },
  onClose() { if (Reader.observer) Reader.observer.disconnect(); Reader.observer = null; exitImmersive(); },
  // verset en haut de l'écran et son décalage, pour le retrouver après un changement d'affichage, d'ambiance ou de taille
  // (ligne de lecture juste sous la barre du haut ; on retient le verset qu'elle traverse et à quelle hauteur)
  snapshot(el, props) {
    if (props.mode === 'page') return null;
    if (el.scrollTop < 8) return { top: true }; // en haut de la sourate : on y reste
    const line = el.getBoundingClientRect().top + 84;
    for (const v of el.querySelectorAll('.verse')) {
      const r = v.getBoundingClientRect();
      if (r.bottom <= line) continue;
      const base = { s: Number(v.dataset.s), a: Number(v.dataset.a) };
      // verset coupé par la ligne de lecture : on retient la proportion ; sinon, sa distance à cette ligne
      return r.top < line ? Object.assign(base, { frac: r.height ? (line - r.top) / r.height : 0 }) : Object.assign(base, { below: r.top - line });
    }
    return null;
  },
  restore(el, snap, props) {
    if (props.mode === 'page') return;
    if (snap.top) { el.scrollTop = 0; return; }
    if (snap.s !== props.s) return;
    const v = el.querySelector(`#v-${snap.s}-${snap.a}`); if (!v) return;
    const r = v.getBoundingClientRect(); const line = el.getBoundingClientRect().top + 84;
    el.scrollTop += isNum(snap.below) ? (r.top - line - snap.below) : (r.top + snap.frac * r.height) - line;
  },
};
/* Dernière position : le verset en haut de l'écran (sauvegarde discrète) */
const savePosSoon = debounce((pos) => { put('pos', 'last', pos); }, 1200);
/* Aller à un verset et l'y garder pendant que la mise en page se stabilise (polices, hauteur des blocs),
   tant que la personne n'a pas fait défiler elle-même */
function keepVerseInView(pageEl, s, a) {
  const v = pageEl.querySelector(`#v-${s}-${a}`); if (!v) return;
  const go = () => { if (v.isConnected && pageEl.isConnected) v.scrollIntoView({ block: 'start' }); };
  go();
  let moved = false; const stop = () => { moved = true; };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => pageEl.addEventListener(t, stop, { once: true, passive: true }));
  if ('ResizeObserver' in window) {
    const list = pageEl.querySelector('.verses');
    const ro = new ResizeObserver(() => { if (!moved) go(); });
    if (list) ro.observe(list);
    setTimeout(() => ro.disconnect(), 2500);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!moved) go(); });
}
function observeVerses(pageEl, props) {
  if (Reader.observer) Reader.observer.disconnect();
  if (!('IntersectionObserver' in window)) return;
  const visible = new Map();
  Reader.observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) visible.set(e.target, e.boundingClientRect.top); else visible.delete(e.target); });
    let best = null; let bestTop = Infinity;
    visible.forEach((top, el) => { const t = el.getBoundingClientRect().top; if (t >= -40 && t < bestTop) { bestTop = t; best = el; } });
    if (!best) return;
    const a = Number(best.dataset.a); const s = Number(best.dataset.s);
    Reader.anchor = { s, a };
    props.a = a;
    savePosSoon({ s, a, mode: 'verse', at: nowStamp() });
  }, { root: pageEl, rootMargin: '-10% 0px -55% 0px', threshold: 0 });
  pageEl.querySelectorAll('.verse').forEach((v) => Reader.observer.observe(v));
}
/* Re-dessine le lecteur en gardant le verset courant (changement d'affichage, de taille, d'ambiance) */
function rerenderReaderKeepingPlace() {
  // le lecteur garde le verset affiché en haut de l'écran (voir PAGES.reader.snapshot)
  renderAll();
}

/* --- Pages du Coran --- */
function renderMushafPage(props) {
  const p = clamp(props.p || pageOfVerse(props.s || 1, props.a || 1), 1, 604);
  props.p = p;
  const verses = versesOfPage(p);
  const suras = uniqSorted(verses.map((v) => v.s));
  const missing = suras.filter((s) => !Content.suras.get(s));
  const title = `Page ${p}`;
  if (missing.length) {
    if (!props.loading && !props.err) {
      props.loading = true;
      Promise.all(missing.map(loadSura)).then(() => { props.loading = false; renderPage(false); }, (e) => { props.loading = false; props.err = e; renderPage(false); });
    }
    return `${readerTopbar(title, verses[0].s)}${props.err ? `<div class="empty">${icon('alert', 'lg')}<p>${esc(contentErrorText(props.err))}</p><button type="button" class="btn btn--primary" data-act="reader-retry">Réessayer</button></div>` : '<div class="loading"><span class="spin"></span></div>'}`;
  }
  const juz = Content.suras.get(verses[0].s).jz[verses[0].a - 1];
  let html = ''; let open = false;
  for (const v of verses) {
    const d = Content.suras.get(v.s);
    if (v.a === 1) {
      if (open) { html += '</p>'; open = false; }
      const m = suraMeta(v.s);
      html += `<div class="mushaf__sura"><span lang="ar" dir="rtl" translate="no">سورة ${esc(m.ar)}</span><small dir="ltr">${esc(m.name)}</small></div>`;
      if (d.bsm) html += `<p class="mushaf__basmala${Reader.activeKey === 'b:' + v.s ? ' is-active' : ''}" lang="ar" dir="rtl" translate="no">${esc(d.basmala)}</p>`;
    }
    if (!open) { html += '<p class="mushaf__text" lang="ar" dir="rtl" translate="no">'; open = true; }
    html += `<span class="mv${Reader.activeKey === v.s + ':' + v.a ? ' is-active' : ''}" id="mv-${v.s}-${v.a}" data-act="verse-menu" data-s="${v.s}" data-a="${v.a}" role="button" tabindex="0" aria-label="Verset ${v.s}:${v.a}">${arWithEnd(d.arBody[v.a - 1], v.a)}</span> `;
  }
  if (open) html += '</p>';
  const first = verses[0]; const last = verses[verses.length - 1];
  return `${readerTopbar(title, first.s)}
    <div class="mushaf" data-page="${p}">
      <div class="mushaf__frame">
        <div class="mushaf__meta"><span>${esc(suraTitle(first.s))}</span><span>Juz ${juz}</span></div>
        ${html}
        <div class="mushaf__num" aria-hidden="true">${arNum(p)}</div>
      </div>
    </div>
    <nav class="pager" aria-label="Changer de page">
      <button type="button" class="btn btn--soft" data-act="page-step" data-d="1" aria-label="Page suivante" ${p >= 604 ? 'disabled' : ''}>${icon('chev-l', 'sm')}Suivante</button>
      <span class="pager__n num">${p} / 604</span>
      <button type="button" class="btn btn--soft" data-act="page-step" data-d="-1" aria-label="Page précédente" ${p <= 1 ? 'disabled' : ''}>Précédente${icon('chev-r', 'sm')}</button>
    </nav>
    <p class="fine">Pages du Mushaf de Médine (604 pages) selon les métadonnées Tanzil : la page ${p} contient les versets ${first.s}:${first.a} à ${last.s}:${last.a}, comme la page imprimée. Les lignes sont recomposées pour ton écran : elles ne reproduisent pas la mise en page exacte.</p>`;
}
function savePagePos(props) {
  const v = versesOfPage(props.p)[0];
  savePosSoon({ s: v.s, a: v.a, mode: 'page', page: props.p, at: nowStamp() });
  Reader.anchor = { s: v.s, a: v.a };
}
function setupPageSwipe(el, props) {
  const box = el.querySelector('.mushaf'); if (!box) return;
  let x0 = null; let y0 = null;
  box.addEventListener('touchstart', (e) => { const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
  box.addEventListener('touchend', (e) => {
    if (x0 == null) return; const t = e.changedTouches[0]; const dx = t.clientX - x0; const dy = t.clientY - y0; x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    // Livre de droite à gauche : glisser vers la droite = page suivante
    goPage(props.p + (dx > 0 ? 1 : -1));
  }, { passive: true });
}
function goPage(p) {
  const top = topPage(); if (!top || top.name !== 'reader') return;
  p = clamp(p, 1, 604); if (p === top.props.p) return;
  top.props.p = p; top.props.loading = false; top.props.err = null;
  renderPage(true);
  const el = $('#pages .page'); if (el) el.scrollTop = 0;
}

/* --- Plein écran (iPhone : mode immersif, sans barre ; ailleurs : plein écran du navigateur) --- */
function enterImmersive() {
  document.body.classList.add('is-immersive');
  const de = document.documentElement;
  if (de.requestFullscreen && !/iPhone|iPad|iPod/.test(navigator.userAgent)) de.requestFullscreen().catch(() => {});
  renderPlayerBar();
}
function exitImmersive() {
  document.body.classList.remove('is-immersive');
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

/* --- Lecture audio dans le lecteur --- */
function readerTracks(s, from, to, withIntro) {
  const d = Content.suras.get(s); const meta = suraMeta(s); const out = [];
  if (withIntro && from === 1 && d && d.bsm && prefs().basmalaAudio) out.push({ s: 1, a: 1, intro: true, forS: s });
  for (let a = from; a <= Math.min(to, meta.ayas); a++) out.push({ s, a });
  return out;
}
function startReaderAudio(cfg) {
  // cfg : { s, a, kind: 'continuous'|'verse'|'group', a1, a2, count, gap }
  Reader.audio = cfg;
  const meta = suraMeta(cfg.s);
  let tracks; let cycles = 1; let gap = 0; let gapEach = 0;
  if (cfg.kind === 'verse') { tracks = readerTracks(cfg.s, cfg.a, cfg.a, false); cycles = cfg.count; gap = cfg.gap === 'none' ? 0 : (cfg.gap || 'auto'); }
  else if (cfg.kind === 'group') { tracks = readerTracks(cfg.s, cfg.a1, cfg.a2, false); cycles = cfg.count; gap = cfg.gap === 'none' ? 0 : (cfg.gap || 'auto'); }
  else { tracks = readerTracks(cfg.s, cfg.a, meta.ayas, true); gapEach = (prefs().readGap || 0) * 1000; }
  runSequence(tracks, {
    ctx: 'reader', cycles, gap, gapEach, label: meta.name,
    onPhase: (ph, info) => {
      if (ph === 'play' && info.track) highlightVerse(info.track.intro ? 'b:' + info.track.forS : info.track.s + ':' + info.track.a, !info.track.intro);
      if (ph === 'done') { highlightVerse(null); if (cfg.kind === 'continuous' && cfg.s < 114) toast(`Fin de ${meta.name}.`, false, { label: 'Sourate suivante', fn: () => openReader(cfg.s + 1, 1, { replace: true }) }); }
      if (ph === 'error') { highlightVerse(null); toast(audioErrorText(info.error), true); }
    },
    onTrackEnd: (t) => markListened(t.s, t.a),
  });
  renderPlayerBar();
}
function highlightVerse(key, scroll) {
  Reader.activeKey = key;
  $$('.verse.is-active, .mv.is-active, .basmala.is-active, .mushaf__basmala.is-active').forEach((el) => el.classList.remove('is-active'));
  if (!key) return;
  let el = null;
  if (key.startsWith('b:')) el = $('#b-' + key.slice(2)) || $('.mushaf__basmala');
  else { const [s, a] = key.split(':'); el = $(`#v-${s}-${a}`) || $(`#mv-${s}-${a}`); }
  if (!el) return;
  el.classList.add('is-active');
  if (scroll) {
    const r = el.getBoundingClientRect(); const h = window.innerHeight;
    if (r.top < 70 || r.bottom > h - 140) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}
function renderPlayerBar() {
  const root = $('#player'); if (!root) return;
  const onReader = Player.ctx === 'reader' && Player.state !== 'idle';
  root.hidden = !onReader;
  document.body.classList.toggle('has-player', onReader);
  if (!onReader) { root.innerHTML = ''; return; }
  const t = Player.cur; const cfg = Reader.audio || {};
  const where = t ? (t.intro ? 'Basmala' : `${suraTitle(t.s)} · verset ${t.a}`) : '';
  const rep = cfg.kind === 'verse' || cfg.kind === 'group' ? ` · ${Player.cycle}${Player.cycles === Infinity ? '' : '/' + Player.cycles}` : '';
  const playing = Player.state === 'playing' || Player.state === 'loading' || Player.state === 'gap';
  root.innerHTML = `<div class="player__in">
      <div class="player__info"><b>${esc(where)}${esc(rep)}</b><span>${Player.state === 'gap' ? 'À toi de répéter…' : esc(reciter().name)}</span></div>
      <div class="player__btns">
        <button type="button" class="icon-btn" data-act="player-step" data-d="-1" aria-label="Verset précédent">${icon('skip-back')}</button>
        <button type="button" class="icon-btn icon-btn--solid" data-act="player-toggle" aria-label="${playing ? 'Pause' : 'Lecture'}">${icon(playing ? 'pause' : 'play')}</button>
        <button type="button" class="icon-btn" data-act="player-step" data-d="1" aria-label="Verset suivant">${icon('skip-fwd')}</button>
        <button type="button" class="icon-btn" data-act="player-stop" aria-label="Arrêter">${icon('stop')}</button>
      </div></div>`;
}
function openReader(s, a, opts = {}) {
  s = clamp(Number(s) || 1, 1, 114);
  const props = { s, a: Number(a) || 1, mode: opts.mode || 'verse', p: opts.p || null };
  if (opts.mode === 'page' && !opts.p) props.p = pageOfVerse(s, props.a);
  if (props.mode === 'verse' && prefs().readMode !== 'verse' && !opts.mode) props.mode = 'verse';
  closeAllSheets();
  const top = topPage();
  if (opts.replace && top && top.name === 'reader') { top.props = props; renderPage(true); const el = $('#pages .page'); if (el && (props.a || 1) <= 1) el.scrollTop = 0; return; }
  openPage('reader', props);
}

/* ===== Séance : un passage à la fois, une consigne principale, une action dominante =====
   Nouveau passage : Écouter → Répéter → Réciter (sans regarder) → Relier aux versets précédents.
   Révision : Réciter directement, puis réécouter. Sourate entière : réciter tout, sans regarder. */
const SESSION_STEPS = [['listen', 'Écouter', 'ear'], ['repeat', 'Répéter', 'repeat'], ['recite', 'Réciter', 'eye-off'], ['link', 'Relier', 'link']];
const Sess = { tick: null, loading: false, loadErr: null };
const cur = () => Store.session;
const curItem = () => { const s = cur(); return s && s.items[s.i] ? s.items[s.i] : null; };
function persistSession() { saveSession(cur()); }
function setStep(step, patch) {
  const s = cur(); if (!s) return;
  s.step = step; s.st = Object.assign({}, step === 'listen' ? {} : (s.st || {}), patch || {});
  persistSession(); renderPage(false); announce();
}
function announce() {
  const live = $('#live'); const el = $('#pages .page--session .instr');
  if (live && el) { live.textContent = ''; setTimeout(() => { live.textContent = el.textContent.trim(); }, 30); }
}
/* Texte d'un passage (positions dans le texte source, sans rien modifier) */
function passageParts(d, it) {
  const out = [];
  const a1 = it.type === 'surah' || it.type === 'known' ? 1 : it.a1;
  const a2 = it.type === 'surah' || it.type === 'known' ? d.ar.length : it.a2;
  for (let a = a1; a <= a2; a++) {
    const toks = verseTokens(d, a);
    const ch = isNum(it.c) ? verseChunks(d, a) : null;
    if (ch && ch.length > 1 && ch[it.c]) {
      const from = it.chainChunks ? ch[0].from : ch[it.c].from; const to = ch[it.c].to;
      const chunk = { from, to };
      out.push({ a, tokens: toks.slice(from, to), isEnd: to >= toks.length, tl: tlForChunk(d, a, chunk), partial: true });
    } else out.push({ a, tokens: toks, isEnd: true, tl: d.tl[a - 1], partial: false });
  }
  return out;
}
function passageTracks(it) {
  const s = it.s; const meta = suraMeta(s);
  const a1 = it.type === 'surah' || it.type === 'known' ? 1 : it.a1; const a2 = it.type === 'surah' || it.type === 'known' ? meta.ayas : it.a2;
  const out = []; for (let a = a1; a <= a2; a++) out.push({ s, a }); return out;
}
function passageHTML(d, it, opts = {}) {
  const parts = passageParts(d, it); let shownLeft = isNum(opts.shown) ? opts.shown : Infinity;
  const showTl = opts.tl && !opts.hidden; const showFr = opts.fr && !opts.hidden;
  return `<div class="passage${opts.hidden ? ' is-veiled' : ''}">${parts.map((pt) => {
    const words = pt.tokens.filter((t) => !SIGN_TOKEN.test(t)).length;
    const shown = opts.hidden ? Math.max(0, Math.min(words, shownLeft)) : Infinity;
    if (opts.hidden) shownLeft -= words;
    return `<div class="pv">
        <p class="ar ar--learn" lang="ar" dir="rtl" translate="no">${arHTML(pt.tokens, { shown, end: pt.isEnd ? pt.a : null })}</p>
        ${showTl ? (pt.tl != null ? `<p class="tl tl--learn notranslate" translate="no">${tlHTML(pt.tl)}</p>` : `<p class="tl tl--learn notranslate" translate="no"><span class="muted tiny">Phonétique du verset entier :</span> ${tlHTML(d.tl[pt.a - 1])}</p>`) : ''}
        ${showFr ? `<p class="fr fr--learn notranslate" lang="fr" translate="no">${pt.partial ? '<span class="muted tiny">Sens du verset entier : </span>' : ''}${frHTML(d.fr[pt.a - 1])}</p>` : ''}
      </div>`;
  }).join('')}</div>`;
}
function totalWords(d, it) { return passageParts(d, it).reduce((n, p) => n + p.tokens.filter((t) => !SIGN_TOKEN.test(t)).length, 0); }

PAGES.session = {
  label: () => 'Séance',
  noAnim: false,
  render() {
    const s = cur();
    if (!s) return `${pageHead('Séance')}<div class="empty"><p>Aucune séance en cours.</p><button type="button" class="btn btn--primary" data-act="back">Retour</button></div>`;
    if (s.done || s.i >= s.items.length) return renderSessionDone(s);
    const it = curItem(); const d = Content.suras.get(it.s);
    if (!d) {
      if (!Sess.loading && !Sess.loadErr) { Sess.loading = true; loadSura(it.s).then(() => { Sess.loading = false; renderPage(false); }, (e) => { Sess.loading = false; Sess.loadErr = e; renderPage(false); }); }
      return sessionShell(it, Sess.loadErr ? `<div class="empty">${icon('alert', 'lg')}<p>${esc(contentErrorText(Sess.loadErr))}</p><button type="button" class="btn btn--primary" data-act="session-retry">Réessayer</button></div>` : '<div class="loading"><span class="spin"></span></div>');
    }
    if (!s.step) { s.step = it.type === 'new' ? 'listen' : 'recite'; s.st = {}; persistSession(); }
    if (s.budgetPrompt) return sessionShell(it, budgetPrompt(s));
    return sessionShell(it, renderStep(s, it, d));
  },
  after() { startSessionTick(); },
  onClose() { stopAudio(); stopRecording(true); stopSessionTick(); Sess.loadErr = null; renderAll(); },
};
function sessionShell(it, body) {
  const s = cur(); const meta = suraMeta(it.s);
  const kindLabel = it.type === 'review' ? 'Révision' : it.type === 'surah' ? (it.mode === 'review' ? 'Révision de la sourate' : 'Sourate entière') : it.type === 'known' ? 'Je la connais déjà' : 'Nouveau passage';
  const showSteps = it.type === 'new' && !(s.st && s.st.rework);
  const stepKey = (s.step || '').startsWith('link') ? 'link' : (['eval', 'after'].includes(s.step) ? 'recite' : s.step);
  return `<div class="sess">
      <div class="sess__top">
        <button type="button" class="icon-btn" data-act="session-close" aria-label="Fermer la séance (elle est gardée)">${icon('x')}</button>
        <div class="sess__where"><b>${esc(meta.name)}</b><span>${esc(kindLabel)} · ${esc(rangeLabel(it))}</span></div>
        <span class="sess__count num" aria-label="Passage ${s.i + 1} sur ${s.items.length}">${s.i + 1}/${s.items.length}</span>
      </div>
      ${showSteps ? `<ol class="steps" aria-label="Étapes">${SESSION_STEPS.filter(([k]) => k !== 'link' || linkRange(it)).map(([k, l, ic]) => {
        const order = SESSION_STEPS.map((x) => x[0]); const done = order.indexOf(k) < order.indexOf(stepKey);
        return `<li class="steps__i${k === stepKey ? ' is-cur' : ''}${done ? ' is-done' : ''}"${k === stepKey ? ' aria-current="step"' : ''}>${icon(done ? 'check' : ic, 'sm')}<span>${l}</span></li>`;
      }).join('')}</ol>` : ''}
      <div class="sess__body">${body}</div>
    </div>`;
}
function meaningToggle() {
  return `<button type="button" class="btn btn--sm btn--ghost" data-act="learn-meaning" aria-pressed="${UI.learnMeaning}">${icon(UI.learnMeaning ? 'eye-off' : 'eye', 'sm')}${UI.learnMeaning ? 'Masquer le sens' : 'Voir le sens'}</button>`;
}
function reciterLine() { const r = reciter(); return `<p class="reciter">${icon('mic', 'sm')}<span>Récitation : ${esc(r.name)} · ${esc(r.style)}</span></p>`; }
function audioState() {
  if (Player.ctx !== 'session') return 'idle';
  if (Player.state === 'error') return 'error';
  if (Player.state === 'paused') return 'paused';
  if (Player.state === 'gap') return Player.phase === 'gap' ? 'gap' : 'play';
  if (Player.state === 'playing' || Player.state === 'loading') return 'play';
  return 'idle';
}
function gapRing() {
  const ms = Player.gapMs || 3000; const left = Math.max(0, ms - (performance.now() - (Player.gapStart || performance.now())));
  return `<span class="ring" style="--ring-ms:${Math.round(left)}ms" aria-hidden="true"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/></svg></span>`;
}
function renderStep(s, it, d) {
  const st = s.st || {}; const aud = audioState();
  const showTl = true; const showFr = UI.learnMeaning;
  const tip = !prefs().tlNoteSeen ? tlNote() : '';
  const longNote = isNum(it.c) && it.nc > 1 ? `<p class="fine">${icon('info', 'sm')} Verset long : on le travaille en ${it.nc} parties, coupées seulement aux marques de pause du texte. L’audio lit le verset entier.</p>` : '';
  switch (s.step) {
    case 'listen': {
      const playing = aud === 'play' || aud === 'gap';
      return `<p class="instr">${playing ? 'Écoute la récitation.' : st.listened ? 'Tu peux réécouter, ou passer à la répétition.' : 'Écoute la récitation en suivant le texte.'}</p>
        ${passageHTML(d, it, { tl: showTl, fr: showFr })}
        <div class="sess__tools">${meaningToggle()}</div>${tip}${longNote}
        ${aud === 'error' ? `<p class="notice notice--warn">${icon('alert')}<span>${esc(audioErrorText(Player.error))}</span></p>` : ''}
        <div class="sess__acts">
          ${playing ? `<button type="button" class="btn btn--primary btn--xl" data-act="audio-stop">${icon('stop')}Arrêter</button>`
            : st.listened ? `<button type="button" class="btn btn--primary btn--xl" data-act="step-next" data-to="repeat">À toi de répéter${icon('chev-r')}</button>
                <button type="button" class="btn btn--soft" data-act="learn-listen">${icon('repeat')}Réécouter</button>`
            : `<button type="button" class="btn btn--primary btn--xl" data-act="learn-listen">${icon('play')}Écouter</button>
               ${aud === 'error' ? `<button type="button" class="btn btn--ghost" data-act="step-next" data-to="repeat">Continuer sans l’audio</button>` : ''}`}
        </div>${reciterLine()}`;
    }
    case 'repeat': {
      const target = st.target || prefs().reps || 3; const done = st.done || 0;
      const running = aud === 'play' || aud === 'gap' || aud === 'paused';
      const phase = aud === 'gap' ? 'gap' : aud;
      const finished = done >= target && !running;
      const instr = !running ? (finished ? 'Bien. Tu peux encore répéter, ou réciter sans regarder.' : `Écoute, puis répète à voix haute pendant le silence. ${target} fois.`) : phase === 'gap' ? 'À toi de répéter' : phase === 'paused' ? 'En pause.' : 'Écoute…';
      return `<p class="instr${phase === 'gap' ? ' instr--you' : ''}">${phase === 'gap' ? gapRing() : ''}${esc(instr)}</p>
        <p class="counter num">${running ? `Répétition ${Math.min(target, done + 1)} sur ${target}` : `${done} sur ${target} répétitions`}</p>
        ${st.hideText ? `<div class="passage is-veiled"><p class="veil-note">${icon('eye-off', 'sm')}Texte masqué</p></div>` : passageHTML(d, it, { tl: showTl, fr: showFr })}
        <div class="sess__tools">${meaningToggle()}<button type="button" class="btn btn--sm btn--ghost" data-act="repeat-hide" aria-pressed="${!!st.hideText}">${icon(st.hideText ? 'eye' : 'eye-off', 'sm')}${st.hideText ? 'Afficher le texte' : 'Masquer le texte'}</button></div>
        ${aud === 'error' ? `<p class="notice notice--warn">${icon('alert')}<span>${esc(audioErrorText(Player.error))}</span></p>` : ''}
        <div class="sess__acts">
          ${running ? `<button type="button" class="btn btn--primary btn--xl" data-act="audio-stop">${icon('stop')}Arrêter</button>`
            : finished ? `<button type="button" class="btn btn--primary btn--xl" data-act="step-next" data-to="recite">Réciter sans regarder${icon('chev-r')}</button>
                <button type="button" class="btn btn--soft" data-act="repeat-more">${icon('plus')}Encore une fois</button>`
            : `<button type="button" class="btn btn--primary btn--xl" data-act="repeat-run">${icon('play')}${done ? 'Continuer' : 'Commencer'}</button>
               <button type="button" class="btn btn--ghost" data-act="step-next" data-to="recite">Passer à la récitation</button>`}
        </div>
        <p class="fine">Le nombre de répétitions est un réglage pédagogique, modifiable dans les réglages : ce n’est ni une règle religieuse ni une preuve de mémorisation.</p>`;
    }
    case 'recite': case 'link-recite': {
      const link = s.step === 'link-recite';
      const target = link ? linkItem(it) : it;
      const hints = st.hints || 0; const revealed = !!st.revealed; const words = totalWords(d, target);
      const title = link ? 'Récite l’enchaînement, sans regarder.' : 'À toi, sans regarder.';
      return `<p class="instr">${title}</p>
        <p class="sub">${it.type === 'surah' || it.type === 'known' ? `Toute la sourate ${esc(suraTitle(it.s))}, de mémoire, à voix haute.` : 'Récite à voix haute. Un indice ou le texte réaffiché compte comme une aide.'}</p>
        ${passageHTML(d, target, { hidden: !revealed, shown: hints, tl: false, fr: false })}
        <div class="sess__tools">
          <button type="button" class="btn btn--sm btn--soft" data-act="hint" ${revealed || hints >= words ? 'disabled' : ''}>${icon('lightbulb', 'sm')}Un indice</button>
          <button type="button" class="btn btn--sm btn--soft" data-act="reveal" ${revealed ? 'disabled' : ''}>${icon('eye', 'sm')}Réafficher le texte</button>
          ${recButton()}
        </div>
        ${hints || revealed ? `<p class="aided">${icon('info', 'sm')}Aide utilisée : cette tentative comptera « avec aide ».</p>` : ''}
        <div class="sess__acts"><button type="button" class="btn btn--primary btn--xl" data-act="recited">${icon('check')}J’ai récité</button></div>`;
    }
    case 'eval': case 'link-eval': {
      const aided = (st.hints || 0) > 0 || !!st.revealed;
      return `<p class="instr">Comment ça s’est passé ?</p>
        <p class="sub">Ton auto-évaluation : elle sert à planifier les révisions.</p>
        <div class="choices">
          <button type="button" class="choice choice--solo" data-act="evaluate" data-r="solo" ${aided ? 'disabled aria-describedby="aidedWhy"' : ''}>${icon('check-circle')}<span><b>Sans aide</b><small>Je l’ai récité de mémoire, sans hésiter.</small></span></button>
          ${aided ? `<p class="aided" id="aidedWhy">${icon('info', 'sm')}Tu as utilisé un indice ou réaffiché le texte : cette tentative ne peut pas compter « sans aide ».</p>` : ''}
          <button type="button" class="choice choice--hes" data-act="evaluate" data-r="hesitation">${icon('pause-circle')}<span><b>Avec une hésitation</b><small>${aided ? 'J’y suis arrivé avec l’aide.' : 'Je l’ai retrouvé, avec un blanc ou une petite erreur.'}</small></span></button>
          <button type="button" class="choice choice--rework" data-act="evaluate" data-r="rework">${icon('refresh')}<span><b>À retravailler</b><small>Je n’ai pas réussi à le retrouver.</small></span></button>
        </div>`;
    }
    case 'after': case 'link-after': {
      const link = s.step === 'link-after'; const r = st.result;
      const target = link ? linkItem(it) : it;
      const msg = r === 'solo' ? 'C’est noté : sans aide.' : r === 'hesitation' ? 'C’est noté : avec une hésitation.' : 'Pas de souci : on le reprend.';
      const when = st.reviewDue ? `Prochaine révision ${dayName(st.reviewDue)}.` : '';
      const subMsg = r === 'rework' ? `Réécoute la référence, puis réessaie. ${when}` : `${r === 'hesitation' ? 'On le revoit bientôt. ' : ''}${when} Compare avec la référence et corrige ce qui a coincé.`;
      const canRework = !link && r === 'rework' && !(st.reworkCount >= 1);
      return `<p class="instr">${esc(msg)}</p>
        ${st.firstFull ? `<p class="notice notice--ok">${icon('award')}<span>Sourate entière récitée sans aide (auto-évaluation). Elle reviendra ${esc(dayName(st.reviewDue))} en révision.</span></p>` : ''}
        <p class="sub">${esc(subMsg.trim())}</p>
        ${passageHTML(d, target, { tl: true, fr: UI.learnMeaning })}
        <div class="sess__tools">
          <button type="button" class="btn btn--sm btn--soft" data-act="relisten" data-link="${link ? 1 : ''}">${icon('play', 'sm')}Réécouter la référence</button>
          ${st.recId ? `<button type="button" class="btn btn--sm btn--soft" data-act="rec-play" data-id="${esc(st.recId)}">${icon('mic', 'sm')}Réécouter ma voix</button>` : ''}
          ${meaningToggle()}
        </div>
        ${it.type === 'surah' && r === 'rework' ? `<button type="button" class="link-row" data-act="difficult-open">${icon('list', 'sm')}<span>Choisir les versets difficiles à revoir</span>${icon('chev-r', 'sm')}</button>` : ''}
        <div class="sess__acts">
          ${canRework ? `<button type="button" class="btn btn--primary btn--xl" data-act="rework-now">${icon('refresh')}On le retravaille maintenant</button>
              <button type="button" class="btn btn--ghost" data-act="step-continue">Plus tard</button>`
            : `<button type="button" class="btn btn--primary btn--xl" data-act="step-continue">Continuer${icon('chev-r')}</button>`}
        </div>`;
    }
    case 'link-intro': {
      const li = linkItem(it); const aud2 = audioState(); const playing = aud2 === 'play';
      return `<p class="instr">Relie avec ce qui précède</p>
        <p class="sub">${li.chainChunks ? 'Récite le début du verset jusqu’à la partie que tu viens d’apprendre.' : `${esc(rangeLabel(li))} : apprends la transition et l’ordre des versets.`}</p>
        ${passageHTML(d, li, { tl: true, fr: false })}
        ${aud2 === 'error' ? `<p class="notice notice--warn">${icon('alert')}<span>${esc(audioErrorText(Player.error))}</span></p>` : ''}
        <div class="sess__acts">
          ${playing ? `<button type="button" class="btn btn--primary btn--xl" data-act="audio-stop">${icon('stop')}Arrêter</button>`
            : st.listened ? `<button type="button" class="btn btn--primary btn--xl" data-act="step-next" data-to="link-recite">Réciter l’enchaînement${icon('chev-r')}</button>
                <button type="button" class="btn btn--soft" data-act="link-listen">${icon('repeat')}Réécouter</button>`
            : `<button type="button" class="btn btn--primary btn--xl" data-act="link-listen">${icon('play')}Écouter l’enchaînement</button>
               <button type="button" class="btn btn--ghost" data-act="step-next" data-to="link-recite">Réciter directement</button>`}
          <button type="button" class="btn btn--ghost" data-act="step-continue" data-skip="1">Passer cette étape</button>
        </div>`;
    }
    case 'difficult': {
      const meta = suraMeta(it.s); const sel = new Set(st.difficult || []);
      return `<p class="instr">Quels versets étaient difficiles ?</p>
        <p class="sub">Ils reviendront en révision dès demain. La sourate garde tout le travail déjà fait.</p>
        <div class="vchips">${Array.from({ length: meta.ayas }, (_, i) => i + 1).map((a) => `<button type="button" class="vchip${sel.has(a) ? ' is-on' : ''}" data-act="difficult-toggle" data-a="${a}" aria-pressed="${sel.has(a)}">${a}</button>`).join('')}</div>
        <div class="sess__acts">
          <button type="button" class="btn btn--primary btn--xl" data-act="difficult-save" ${sel.size ? '' : 'disabled'}>Les revoir${icon('chev-r')}</button>
          <button type="button" class="btn btn--ghost" data-act="step-continue">Passer</button>
        </div>`;
    }
    default: return '';
  }
}
function linkItem(it) { const r = linkRange(it); return r ? Object.assign({ type: 'chain', nc: it.nc }, r) : it; }
function allVersesWorked(s) { const meta = suraMeta(s); return uniqSorted(progressOf(s).worked).length >= meta.ayas; }
function budgetPrompt(s) {
  return `<div class="budget">
      <p class="instr">Tu as fait tes ${s.budget} minutes.</p>
      <p class="sub">La durée est un repère : tu peux t’arrêter là ou continuer encore un peu.</p>
      <div class="sess__acts"><button type="button" class="btn btn--primary btn--xl" data-act="session-finish">Terminer la séance</button>
      <button type="button" class="btn btn--soft" data-act="budget-continue">Continuer</button></div></div>`;
}
function renderSessionDone(s) {
  // on compte les passages (pas chaque essai) : une reprise ou un enchaînement ne compte pas deux fois
  const uniq = (list) => new Set(list.map((r) => [r.type, r.s, r.a1, r.a2, r.c].join('|'))).size;
  const main = s.results.filter((r) => !r.link);
  const learned = uniq(main.filter((r) => r.type === 'new'));
  const reviewed = uniq(main.filter((r) => r.type === 'review' || (r.type === 'surah' && r.mode === 'review')));
  const full = uniq(main.filter((r) => (r.type === 'surah' || r.type === 'known') && r.mode !== 'review'));
  const nx = nextReviewDate();
  const bits = [];
  if (learned) bits.push(`${learned} ${plural(learned, 'nouveau passage travaillé', 'nouveaux passages travaillés')}`);
  if (reviewed) bits.push(`${reviewed} ${plural(reviewed, 'révision', 'révisions')}`);
  if (full) bits.push(`${full} ${plural(full, 'récitation complète', 'récitations complètes')}`);
  return `<div class="sess sess--done">
      <div class="sess__top"><button type="button" class="icon-btn" data-act="session-close" aria-label="Fermer">${icon('x')}</button></div>
      <div class="done">
        <span class="done__mark" aria-hidden="true"><svg viewBox="0 0 40 40"><use href="#star8"/></svg>${icon('check', 'lg')}</span>
        <h1 class="done__title">Séance terminée</h1>
        <p class="done__sum">${bits.length ? esc(bits.join(' · ')) : 'Merci pour ce moment.'}</p>
        <p class="done__next">${nx ? `Prochaine révision ${esc(dayName(nx))}.` : 'Pas de révision prévue pour l’instant.'}</p>
        <div class="sess__acts">
          <button type="button" class="btn btn--primary btn--xl" data-act="session-close">Revenir à l’accueil</button>
          <button type="button" class="btn btn--soft" data-act="session-more">Encore un passage</button>
        </div>
      </div></div>`;
}
/* Temps actif (page visible) pour la proposition de fin à la durée choisie */
function startSessionTick() {
  stopSessionTick();
  Sess.tick = setInterval(() => {
    const s = cur(); if (!s || s.done || document.visibilityState !== 'visible') return;
    s.activeMs = (s.activeMs || 0) + 1000;
    if (s.activeMs % 15000 === 0) persistSession();
  }, 1000);
}
function stopSessionTick() { clearInterval(Sess.tick); Sess.tick = null; }

/* --- Démarrer, reprendre, avancer --- */
async function startSession(btn) {
  const act = homeAction();
  if (act.kind === 'resume' && cur()) { openPage('session'); return; }
  const done = busy(btn, 'Préparation…');
  try {
    const sess = await buildSession();
    if (!sess.items.length) { done(); toast('Rien de prévu pour l’instant : choisis une sourate dans ton parcours.', false, { label: 'Mon parcours', fn: () => openPage('path') }); return; }
    if (!prefs().current) await setPrefs({ current: currentSurah() });
    await saveSession(sess);
    done(); UI.learnMeaning = false;
    openPage('session');
  } catch (e) { done(); toast(e && e.code ? contentErrorText(e) : 'La séance n’a pas pu être préparée. Réessaie.', true); }
}
async function startSingle(item) {
  stopAudio();
  const sess = { id: uid('sess'), date: todayISO(), startedAt: nowStamp(), budget: sessionMinutes(), returning: false, items: [item], i: 0, step: null, st: {}, results: [], done: false };
  await saveSession(sess); UI.learnMeaning = false;
  const top = topPage(); if (top && top.name === 'session') { renderPage(true); return; }
  openPage('session');
}
function nextItem() {
  const s = cur(); if (!s) return;
  stopAudio(); stopRecording(true); Sess.loadErr = null;
  s.i += 1; s.step = null; s.st = {};
  if (s.i >= s.items.length) { s.done = true; s.endedAt = nowStamp(); }
  else if ((s.activeMs || 0) >= s.budget * 60000 && !s.budgetAck) s.budgetPrompt = true;
  persistSession(); renderPage(true); announce();
}
/* Effets d'une auto-évaluation : tentative, étapes, révisions. Jamais de réussite sans aide si une aide a été utilisée. */
async function applyEvaluation(result) {
  const s = cur(); const it = curItem(); const st = s.st || {};
  const aided = (st.hints || 0) > 0 || !!st.revealed;
  if (result === 'solo' && aided) result = 'hesitation';
  const link = s.step === 'link-eval';
  const d = Content.suras.get(it.s);
  const p = progressOf(it.s); if (!p.startedAt) p.startedAt = todayISO();
  const base = { s: it.s, aided, hints: st.hints || 0, revealed: !!st.revealed, result };
  let reviewDue = null; let firstFull = false;
  if (link) {
    const li = linkItem(it);
    await recordAttempt(Object.assign(base, { scope: 'chain', mode: 'learn', a1: li.a1, a2: li.a2, c: isNum(li.c) ? li.c : null }));
  } else if (it.type === 'surah' || it.type === 'known') {
    const meta = suraMeta(it.s);
    await recordAttempt(Object.assign(base, { scope: 'surah', mode: it.type === 'known' ? 'known' : (it.mode || 'learn'), a1: 1, a2: meta.ayas }));
    if (it.type === 'known') p.known = true;
    const hadFull = !!(p.m && p.m[4]);
    const all = Array.from({ length: meta.ayas }, (_, i) => i + 1);
    // réciter toute la sourate (sans aide ou avec une hésitation), c'est aussi avoir travaillé chacun de ses versets
    if (result !== 'rework') p.worked = uniqSorted(p.worked.concat(all));
    if (result === 'solo' && !aided) {
      p.solo = uniqSorted(p.solo.concat(all));
      if (!hadFull) firstFull = true;
    }
    await saveProgress(p);
    if (hadFull || (result === 'solo' && !aided)) { const r = await recordReview({ type: 'surah', s: it.s }, result); reviewDue = r && r.due; }
    // sourate entière réussie sans aide : ses passages n'ont plus besoin de révisions séparées
    if (result === 'solo' && !aided) await coverPassages(it.s);
    if (firstFull) { const nx = nextInPath(it.s); if (prefs().current === it.s || !prefs().current) await setPrefs({ current: nx || it.s }); }
    if (it.type === 'known' && !(result === 'solo' && !aided)) await setPrefs({ current: it.s });
  } else {
    const verses = []; for (let a = it.a1; a <= it.a2; a++) verses.push(a);
    await recordAttempt(Object.assign(base, { scope: 'passage', mode: it.type === 'review' ? 'review' : 'learn', a1: it.a1, a2: it.a2, c: isNum(it.c) ? it.c : null }));
    const isChunk = isNum(it.c) && it.nc > 1;
    if (isChunk) {
      const nc = it.nc; const a = it.a1;
      p.chunkWorked = Object.assign({}, p.chunkWorked); p.chunkWorked[a] = uniqSorted((p.chunkWorked[a] || []).concat([it.c]));
      if (p.chunkWorked[a].length >= nc) p.worked = uniqSorted(p.worked.concat([a]));
      if (result === 'solo' && !aided) {
        p.chunkSolo = Object.assign({}, p.chunkSolo); p.chunkSolo[a] = uniqSorted((p.chunkSolo[a] || []).concat([it.c]));
        if (p.chunkSolo[a].length >= nc) p.solo = uniqSorted(p.solo.concat([a]));
      }
    } else {
      p.worked = uniqSorted(p.worked.concat(verses));
      if (result === 'solo' && !aided) p.solo = uniqSorted(p.solo.concat(verses));
    }
    if (it.type === 'new' && !st.reworkCount && !it.retry) {
      // taille des passages : un peu plus après deux réussites sans aide de suite, retour à un verset si c'est à retravailler
      if (result === 'solo' && !aided) { p.streak = (p.streak || 0) + 1; if (p.streak >= 2) { p.level = Math.min(3, (p.level || 1) + 1); p.streak = 0; } }
      else if (result === 'rework') { p.level = 1; p.streak = 0; }
      else p.streak = 0;
      advanceAfterNew(p, it, d);
    }
    await saveProgress(p);
    const surahDone = p.m && p.m[4];
    // une révision prévue est toujours replanifiée ; un passage nouveau n'en crée pas si la sourate entière est déjà acquise
    if (!surahDone || it.type === 'review' || it.retry) {
      const targets = it.reviewIds && it.reviewIds.length
        ? it.reviewIds.map((id) => Store.mem.review.get(id)).filter(Boolean).map((r) => ({ type: 'passage', s: r.s, a1: r.a1, a2: r.a2, c: isNum(r.c) ? r.c : null }))
        : [{ type: 'passage', s: it.s, a1: it.a1, a2: it.a2, c: isNum(it.c) ? it.c : null }];
      for (const t of targets) { const r = await recordReview(t, result); if (r && r.due && (!reviewDue || r.due < reviewDue)) reviewDue = r.due; }
    }
  }
  s.results.push({ type: it.type === 'surah' && it.mode === 'review' ? 'surah' : it.type, mode: it.mode, s: it.s, a1: it.a1, a2: it.a2, c: it.c, result, aided, link });
  setStep(link ? 'link-after' : 'after', { result, reviewDue, firstFull, reworkCount: st.reworkCount || 0, recId: st.recId || null, hints: st.hints, revealed: st.revealed });
}
function continueAfterStep(skipLink) {
  const s = cur(); const it = curItem();
  if (s.step === 'after' && it.type === 'new' && !skipLink && linkRange(it)) { stopAudio(); setStep('link-intro', {}); return; }
  // dernier passage nouveau de la sourate : proposer la récitation complète
  if (it.type === 'new' && allVersesWorked(it.s) && !(progressOf(it.s).m || {})[4] && !s.items.slice(s.i + 1).some((x) => x.type === 'surah' && x.s === it.s)) {
    s.items.splice(s.i + 1, 0, { type: 'surah', s: it.s, mode: 'learn' });
    toast('Tous les versets sont travaillés : on essaie la sourate entière.');
  }
  nextItem();
}

/* ===== Enregistrement personnel (facultatif) =====
   Pour te réécouter et comparer avec la référence. Reste sur ce téléphone (IndexedDB),
   supprimable à tout moment, jamais envoyé. Aucune analyse automatique de la récitation. */
const Rec = { mr: null, stream: null, chunks: [], startedAt: 0, timer: null, for: null };
function recSupported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); }
function recButton() {
  if (!recSupported()) return '';
  const on = !!Rec.mr;
  return `<button type="button" class="btn btn--sm ${on ? 'btn--rec' : 'btn--soft'}" data-act="rec-toggle" aria-pressed="${on}">${icon(on ? 'stop' : 'mic', 'sm')}${on ? 'Arrêter l’enregistrement' : 'M’enregistrer'}</button>`;
}
function pickMime() {
  const c = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const m of c) { try { if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* rien */ } }
  return '';
}
async function startRecording(forItem) {
  if (Rec.mr) return;
  stopAudio();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { toast(e && e.name === 'NotAllowedError' ? 'Micro refusé : autorise-le dans les réglages du téléphone pour t’enregistrer.' : 'Le micro n’est pas disponible.', true); return; }
  const mime = pickMime();
  let mr; try { mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); } catch (e) { stream.getTracks().forEach((t) => t.stop()); toast('L’enregistrement n’est pas possible sur cet appareil.', true); return; }
  Rec.mr = mr; Rec.stream = stream; Rec.chunks = []; Rec.startedAt = Date.now(); Rec.for = forItem;
  mr.ondataavailable = (e) => { if (e.data && e.data.size) Rec.chunks.push(e.data); };
  mr.onstop = async () => {
    const chunks = Rec.chunks; const meta = Rec.for; const dur = Date.now() - Rec.startedAt; const discard = Rec.discard;
    Rec.stream && Rec.stream.getTracks().forEach((t) => t.stop());
    Object.assign(Rec, { mr: null, stream: null, chunks: [], for: null, discard: false }); clearTimeout(Rec.timer);
    if (discard || !chunks.length) { renderPage(false); return; }
    const blob = new Blob(chunks, { type: mr.mimeType || mime || 'audio/webm' });
    const id = uid('r');
    try {
      await idbPut('rec', id, { id, s: meta.s, a1: meta.a1, a2: meta.a2, c: isNum(meta.c) ? meta.c : null, scope: meta.scope || 'passage', at: nowStamp(), ms: dur, size: blob.size, type: blob.type, blob });
      const s = cur(); if (s && s.st) { s.st.recId = id; persistSession(); }
      toast('Enregistré sur ce téléphone uniquement.');
    } catch (e) { toast('L’enregistrement n’a pas pu être gardé (stockage du téléphone).', true); }
    renderPage(false);
  };
  mr.start(1000);
  Rec.timer = setTimeout(() => stopRecording(false), 180000); // 3 minutes au plus
  renderPage(false);
}
function stopRecording(discard) {
  if (!Rec.mr) return;
  Rec.discard = !!discard;
  try { Rec.mr.stop(); } catch (e) { /* déjà arrêté */ }
}
async function playRecording(id) {
  let r; try { r = await idbGet('rec', id); } catch (e) { r = null; }
  if (!r || !r.blob) { toast('Cet enregistrement n’existe plus.', true); return; }
  runSequence([{ s: r.s, a: r.a1, blob: r.blob, own: true }], { ctx: 'session-rec', cycles: 1 });
}
async function listRecordings() { try { return (await idbAll('rec')).map(([, v]) => v).filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at))); } catch (e) { return []; } }

/* ===== Réglages, parcours, détail d'une sourate, sources ===== */
function radioRow(name, value, cur, label, sub) {
  const on = String(value) === String(cur);
  return `<button type="button" class="opt${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-act="set-pref" data-k="${name}" data-v="${esc(value)}">
      <span class="opt__dot" aria-hidden="true">${on ? icon('check', 'sm') : ''}</span><span class="opt__t"><b>${esc(label)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`;
}
const Offline = { inv: null, recs: null, textState: null, textBusy: false };
PAGES.settings = {
  label: () => 'Réglages',
  render() {
    const P = prefs(); const sl = syncLabel();
    if (Offline.inv == null) audioInventory().then((v) => { Offline.inv = v; renderPage(false); });
    if (Offline.recs == null) listRecordings().then((v) => { Offline.recs = v; renderPage(false); });
    if (Offline.textState == null) idbGet('kv', 'offline-text').then((v) => { Offline.textState = v || ''; renderPage(false); }, () => { Offline.textState = ''; });
    const inv = Offline.inv || []; const recs = Offline.recs || [];
    return `${pageHead('Réglages')}
      <section class="set">
        <h2 class="set__h">Ambiance</h2>
        <div class="amb" role="radiogroup" aria-label="Ambiance">${Object.entries(AMBIANCES).map(([k, a]) => `<button type="button" class="amb__b amb__b--${k}${P.ambiance === k ? ' is-on' : ''}" role="radio" aria-checked="${P.ambiance === k}" data-act="set-pref" data-k="ambiance" data-v="${k}"><span class="amb__sw" aria-hidden="true"></span><span>${esc(a.label)}</span>${P.ambiance === k ? icon('check', 'sm') : ''}</button>`).join('')}</div>
        <p class="fine">L’ambiance ne change que les couleurs : les langues affichées restent celles que tu as choisies.</p>
      </section>
      <section class="set">
        <h2 class="set__h">Apprentissage</h2>
        <p class="set__l">Temps par jour</p>
        <div class="seg seg--3">${[5, 10, 15].map((m) => `<button type="button" class="seg__b${sessionMinutes() === m ? ' is-on' : ''}" aria-pressed="${sessionMinutes() === m}" data-act="set-pref" data-k="minutes" data-v="${m}">${m} min</button>`).join('')}</div>
        <p class="set__l">Répétitions par défaut</p>
        <div class="stepper"><button type="button" class="icon-btn" data-act="reps-step" data-d="-1" aria-label="Moins">${icon('minus')}</button><b class="num" aria-live="polite">${P.reps}</b><button type="button" class="icon-btn" data-act="reps-step" data-d="1" aria-label="Plus">${icon('plus')}</button></div>
        <p class="set__l">Silence pour répéter</p>
        <div class="seg seg--3">${[['court', 'Court'], ['auto', 'Normal'], ['long', 'Long']].map(([k, l]) => `<button type="button" class="seg__b${P.gap === k ? ' is-on' : ''}" aria-pressed="${P.gap === k}" data-act="set-pref" data-k="gap" data-v="${k}">${l}</button>`).join('')}</div>
        <p class="fine">Le silence s’adapte à la durée du passage. Ces réglages sont des choix pédagogiques, pas des règles religieuses.</p>
        <button type="button" class="link-row" data-act="open-page" data-page="path">${icon('route', 'sm')}<span>Mon parcours (ordre des sourates)</span>${icon('chev-r', 'sm')}</button>
      </section>
      <section class="set">
        <h2 class="set__h">Récitateur</h2>
        <div class="opts" role="radiogroup" aria-label="Récitateur">${Object.entries(RECITERS).map(([k, r]) => radioRow('reciter', k, P.reciter, r.name, r.style + ' · Hafs')).join('')}</div>
        <button type="button" class="btn btn--soft btn--sm" data-act="reciter-test">${icon('play', 'sm')}Écouter un exemple (Al-Fatiha, verset 1)</button>
      </section>
      <section class="set">
        <h2 class="set__h">Rappel quotidien</h2>
        <p class="fine">Facultatif : ajoute toi-même un rappel à ton calendrier. L’appli n’envoie aucune notification d’elle-même.</p>
        <button type="button" class="link-row" data-act="sheet" data-sheet="remind">${icon('bell', 'sm')}<span>Ajouter un rappel à mon calendrier</span>${icon('chev-r', 'sm')}</button>
      </section>
      <section class="set">
        <h2 class="set__h">Hors connexion</h2>
        <button type="button" class="link-row" data-act="offline-text" ${Offline.textBusy ? 'disabled' : ''}>${icon('download', 'sm')}<span>${Offline.textBusy ? 'Enregistrement du texte…' : Offline.textState === DATA_V ? 'Texte complet du Coran enregistré sur ce téléphone' : 'Garder tout le texte sur ce téléphone (environ 4 Mo)'}</span>${Offline.textState === DATA_V ? icon('check', 'sm') : icon('chev-r', 'sm')}</button>
        <p class="set__l">Audio téléchargé</p>
        ${inv.length ? `<ul class="mini-list">${inv.map((x) => { const r = Object.values(RECITERS).find((rr) => rr.folder === x.folder); return `<li><span>${esc(suraTitle(x.s))} · ${esc(r ? r.name : x.folder)} · ${x.count}/${suraMeta(x.s).ayas} versets</span><button type="button" class="icon-btn icon-btn--sm" data-act="audio-del" data-s="${x.s}" data-folder="${esc(x.folder)}" aria-label="Supprimer l’audio de ${esc(suraTitle(x.s))}">${icon('trash', 'sm')}</button></li>`; }).join('')}</ul>` : '<p class="fine">Aucun audio téléchargé. Dans le lecteur, menu ⋯ → « Télécharger l’audio de cette sourate ».</p>'}
      </section>
      <section class="set">
        <h2 class="set__h">Mes enregistrements</h2>
        <p class="fine">Ils restent sur ce téléphone et ne sont jamais envoyés.</p>
        ${recs.length ? `<ul class="mini-list">${recs.slice(0, 30).map((r) => `<li><span>${esc(suraTitle(r.s))} · ${r.scope === 'surah' ? 'sourate' : `v. ${r.a1}${r.a2 !== r.a1 ? '–' + r.a2 : ''}`} · ${esc(dDM(String(r.at).slice(0, 10)))}</span>
            <span class="mini-list__btns"><button type="button" class="icon-btn icon-btn--sm" data-act="rec-play" data-id="${esc(r.id)}" aria-label="Écouter">${icon('play', 'sm')}</button><button type="button" class="icon-btn icon-btn--sm" data-act="rec-del" data-id="${esc(r.id)}" aria-label="Supprimer">${icon('trash', 'sm')}</button></span></li>`).join('')}</ul>
            <button type="button" class="btn btn--ghost btn--sm" data-act="rec-del-all">${icon('trash', 'sm')}Tout supprimer</button>` : '<p class="fine">Aucun enregistrement.</p>'}
      </section>
      <section class="set">
        <h2 class="set__h">Sauvegarde</h2>
        <p class="sync-line sync-line--${sl.tone}">${icon(sl.tone === 'ok' ? 'cloud' : 'phone', 'sm')}<span>${esc(sl.text)}</span></p>
        ${!Store.idbOk ? `<p class="notice notice--warn">${icon('alert')}<span>Ce navigateur refuse le stockage local : ta progression risque de ne pas être gardée après fermeture. Ouvre l’appli depuis son icône, hors navigation privée.</span></p>` : ''}
        <div class="row-btns">
          <button type="button" class="btn btn--soft btn--sm" data-act="export">${icon('download', 'sm')}Exporter ma progression</button>
          <button type="button" class="btn btn--ghost btn--sm" data-act="import">${icon('upload', 'sm')}Importer</button>
          ${Host.sb && Store.uid ? `<button type="button" class="btn btn--ghost btn--sm" data-act="sync-now">${icon('refresh', 'sm')}Synchroniser</button>` : ''}
        </div>
        <p class="fine">Tes données d’apprentissage sont privées et séparées de ton activité professionnelle.</p>
      </section>
      <section class="set">
        <h2 class="set__h">Aide</h2>
        <button type="button" class="link-row" data-act="sheet" data-sheet="tlhelp">${icon('help', 'sm')}<span>Comment lire la phonétique</span>${icon('chev-r', 'sm')}</button>
        <button type="button" class="link-row" data-act="sheet" data-sheet="method">${icon('sprout', 'sm')}<span>La méthode : écouter, répéter, réciter, relier</span>${icon('chev-r', 'sm')}</button>
        <button type="button" class="link-row" data-act="sheet" data-sheet="juzamma">${icon('info', 'sm')}<span>Juz Amma</span>${icon('chev-r', 'sm')}</button>
        <button type="button" class="link-row" data-act="open-page" data-page="sources">${icon('file-text', 'sm')}<span>Sources et droits</span>${icon('chev-r', 'sm')}</button>
      </section>
      <button type="button" class="btn btn--ghost btn--block" data-act="go-agenda">${icon('home', 'sm')}Revenir à l’agenda</button>`;
  },
  onClose() { Offline.inv = null; Offline.recs = null; Offline.textState = null; },
};

/* --- Mon parcours --- */
PAGES.path = {
  label: () => 'Mon parcours',
  render() {
    const path = learningPath(); const cur = currentSurah();
    return `${pageHead('Mon parcours')}
      <p class="lede">Une proposition pour commencer en douceur. L’ordre est modifiable et ne change jamais l’ordre du Coran dans le lecteur.</p>
      <button type="button" class="info-card" data-act="sheet" data-sheet="juzamma">${icon('info')}<span><b>Juz Amma</b> : pourquoi commencer par ces sourates ?</span>${icon('chev-r', 'sm')}</button>
      <ol class="path">${path.map((n, i) => {
        const m = suraMeta(n); const st = surahState(n); const p = progressOf(n);
        return `<li class="path__i${n === cur ? ' is-cur' : ''}">
          <div class="path__main">${suraBadge(n)}<span class="path__t"><b>${esc(m.name)}</b><small>${esc(STATE_INFO[st].label)} · ${milestoneCount(p)}/6 · ${m.ayas} versets</small></span></div>
          <div class="path__btns">
            ${n === cur ? '<span class="pill">En cours</span>' : `<button type="button" class="btn btn--sm btn--soft" data-act="path-learn" data-s="${n}">Apprendre</button>`}
            <button type="button" class="icon-btn icon-btn--sm" data-act="path-move" data-i="${i}" data-d="-1" aria-label="Monter ${esc(m.name)}" ${i === 0 ? 'disabled' : ''}>${icon('arrow-u', 'sm')}</button>
            <button type="button" class="icon-btn icon-btn--sm" data-act="path-move" data-i="${i}" data-d="1" aria-label="Descendre ${esc(m.name)}" ${i === path.length - 1 ? 'disabled' : ''}>${icon('arrow-d', 'sm')}</button>
            <button type="button" class="icon-btn icon-btn--sm" data-act="path-remove" data-i="${i}" aria-label="Retirer ${esc(m.name)} du parcours">${icon('x', 'sm')}</button>
          </div></li>`;
      }).join('')}</ol>
      <div class="row-btns">
        <button type="button" class="btn btn--soft" data-act="sheet" data-sheet="sura-pick" data-purpose="path-add">${icon('plus', 'sm')}Ajouter une sourate</button>
        <button type="button" class="btn btn--ghost" data-act="path-reset">Revenir à la proposition</button>
      </div>`;
  },
};

/* --- Détail d'une sourate : six jalons, état, vérification par un enseignant --- */
PAGES['sura-progress'] = {
  label: (p) => 'Progrès ' + suraTitle(p.s),
  render(props) {
    const s = Number(props.s); const m = suraMeta(s); const p = refreshMilestones(progressOf(s)); const n = milestoneCount(p); const st = surahState(s);
    const r = Store.mem.review.get('s' + s);
    const atts = Array.from(Store.mem.attempt.values()).filter((x) => x.s === s).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 6);
    return `${pageHead(m.name)}
      <div class="sp-head"><p class="sp-head__ar" lang="ar" dir="rtl" translate="no">${esc(m.ar)}</p>
        <span class="badge badge--${st}">${icon(STATE_INFO[st].icon, 'sm')}${esc(STATE_INFO[st].label)}</span>
        <p class="sp-head__n">${n === 6 ? 'Parcours validé à 100 %' : `${n} ${plural(n, 'étape', 'étapes')} sur 6`}</p>
        <span class="bar"><span style="width:${Math.round(n / 6 * 100)}%"></span></span></div>
      <ol class="miles">${MILESTONES.map((t, i) => { const k = i + 1; const dte = p.m && p.m[k]; return `<li class="miles__i${dte ? ' is-done' : ''}"><span class="miles__ck" aria-hidden="true">${dte ? icon('check', 'sm') : ''}</span><span><b>${esc(t)}</b><small>${dte ? `Validé le ${esc(dFull(dte))}` : milestoneHint(k, p, m)}</small></span><span class="sr-only">${dte ? 'fait' : 'pas encore'}</span></li>`; }).join('')}</ol>
      <p class="fine">Le pourcentage concerne les étapes du parcours, pas une mesure certaine de ta mémoire ou de ta prononciation. Les étapes 5 et 6 demandent une nouvelle récitation à la bonne date : elles ne se cochent jamais toutes seules.</p>
      ${r ? `<p class="line-info">${icon('calendar', 'sm')}<span>Prochaine révision de la sourate : ${esc(dayName(r.due))}${r.last ? ` · dernière : ${esc(RESULT_LABEL[r.last.result] || '')}` : ''}</span></p>` : ''}
      <div class="row-btns row-btns--col">
        ${!(p.m && p.m[4]) ? `<button type="button" class="btn btn--primary" data-act="path-learn" data-s="${s}" data-go="1">${icon('play', 'sm')}${hasStarted(s) ? 'Continuer l’apprentissage' : 'Apprendre cette sourate'}</button>` : ''}
        <button type="button" class="btn btn--soft" data-act="surah-recite" data-s="${s}">${icon('eye-off', 'sm')}Réciter toute la sourate sans regarder</button>
        ${!hasStarted(s) ? `<button type="button" class="btn btn--ghost" data-act="known-start" data-s="${s}">${icon('check-circle', 'sm')}Je la connais déjà</button>` : ''}
        <button type="button" class="btn btn--ghost" data-act="open-reader" data-s="${s}">${icon('book-open', 'sm')}Lire et écouter</button>
      </div>
      <section class="teacher">
        <h2 class="set__h">Vérification par un enseignant</h2>
        ${p.teacher ? `<p class="teacher__on">${icon('user-check')}<span><b>Vérifiée avec un enseignant</b><small>Renseigné par toi le ${esc(dFull(p.teacher.date))}${p.teacher.name ? ` · ${esc(p.teacher.name)}` : ''}. L’appli ne l’a pas vérifié elle-même.</small></span></p>` : '<p class="fine">L’appli ne remplace pas l’écoute d’un enseignant : certains sons arabes ne s’écrivent pas exactement en lettres latines. Quand un enseignant a écouté ta récitation, tu peux le noter ici.</p>'}
        <button type="button" class="btn btn--soft btn--sm" data-act="sheet" data-sheet="teacher" data-s="${s}">${icon('user-check', 'sm')}${p.teacher ? 'Modifier la mention' : 'Noter une vérification'}</button>
      </section>
      ${atts.length ? `<section class="hist"><h2 class="set__h">Dernières récitations</h2><ul class="mini-list">${atts.map((x) => `<li><span>${esc(dDM(x.date))} · ${x.scope === 'surah' ? 'sourate entière' : x.scope === 'chain' ? `enchaînement v. ${x.a1}–${x.a2}` : `v. ${x.a1}${x.a2 !== x.a1 ? '–' + x.a2 : ''}`}</span><b>${esc(RESULT_LABEL[x.result] || '')}${x.aided ? ' (avec aide)' : ''}</b></li>`).join('')}</ul></section>` : ''}`;
  },
};
function milestoneHint(k, p, m) {
  const N = m.ayas;
  if (k === 1) return `${uniqSorted(p.listened).length} sur ${N} versets écoutés en entier`;
  if (k === 2) return `${uniqSorted(p.worked).length} sur ${N} versets travaillés`;
  if (k === 3) return `${uniqSorted(p.solo).length} sur ${N} versets récités sans aide`;
  if (k === 4) return 'Récitation complète, sans indice ni texte';
  if (k === 5) return p.m && p.m[4] ? `Possible à partir du ${dFull(addDays(p.m[4], 1))}` : 'Après l’étape 4';
  return p.m && p.m[4] ? `Possible à partir du ${dFull(addDays(p.m[4], 7))}` : 'Après l’étape 4';
}

/* --- Sources et droits --- */
PAGES.sources = {
  label: () => 'Sources et droits',
  render() {
    const n = Content.index ? Content.index.notice : null;
    const row = (t, body) => `<section class="src"><h2 class="set__h">${esc(t)}</h2>${body}</section>`;
    return `${pageHead('Sources et droits')}
      <p class="lede">Aucun verset, aucune traduction et aucune phonétique ne sont écrits par l’appli : tout vient des sources ci-dessous, vérifiées par empreinte SHA-256 avant d’être intégrées.</p>
      ${n ? row('Texte arabe', `<p>${esc(n.arabe.edition)}.</p><p>Source : <a href="https://tanzil.net" target="_blank" rel="noopener">Tanzil Project (tanzil.net)</a>, options : ${esc(n.arabe.options)}.</p><p class="fine">${esc(n.arabe.basmala)}</p><details class="notes"><summary>Mention de copyright (reproduite telle quelle)</summary><pre class="pre" translate="no">${esc(n.arabe.copyright)}</pre></details>`) : ''}
      ${n ? row('Traduction française du sens', `<p>${esc(n.traduction.titre)}, ${esc(n.traduction.traducteur)}, version ${esc(n.traduction.version)}.</p><p>Source : <a href="https://quranenc.com/fr/browse/french_rashid" target="_blank" rel="noopener">QuranEnc.com</a>. ${esc(n.traduction.conditions)}</p><p class="fine">Une traduction ne remplace pas le texte arabe : c’est une traduction du sens. Les notes affichées sous « Comprendre » sont celles du traducteur.</p>`) : ''}
      ${n ? row('Phonétique (translittération)', `<p>Translittération de Tanzil (en.transliteration, 2010), convention anglophone. ${esc(n.translitteration.conditions)}</p><p class="fine">Il n’existe pas, dans les sources vérifiées, de phonétique pensée pour les francophones : celle-ci est affichée telle quelle, avec une aide de lecture. Elle ne remplace pas l’écoute de la récitation.</p>`) : ''}
      ${n ? row('Noms des sourates en français', `<p>${esc(n.noms.source)}, licence <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener">CC BY-SA 4.0</a>. ${esc(n.noms.modifications)}</p>`) : ''}
      ${n ? row('Juz et pages', `<p>${esc(n.metadonnees.source)}. ${esc(n.metadonnees.pages)}</p><p class="fine">Contrôle croisé : les pages de début et de fin des 114 sourates correspondent à celles de Quran.com.</p>`) : ''}
      ${row('Récitation (audio)', `<p>Fichiers verset par verset d’<a href="https://everyayah.com" target="_blank" rel="noopener">EveryAyah.com</a> (les mêmes que ceux utilisés par Quran.com) : ${Object.values(RECITERS).map((r) => esc(r.name)).join(', ')}, lecture de Hafs.</p><p class="fine">EveryAyah ne publie pas de licence de redistribution : les fichiers ne sont pas copiés dans l’appli. Ils sont lus depuis leur site et, seulement si tu le demandes, gardés sur ton téléphone pour ton usage personnel.</p>`)}
      ${row('Police arabe', '<p>Amiri Quran (Amiri Project), licence SIL Open Font License 1.1, hébergée avec l’appli. Interface : Rubik, même licence.</p>')}
      ${row('Illustration', '<p>Livre fermé sur un pupitre : illustration générée une seule fois pour l’appli (Higgsfield, modèle gpt_image_2_5), sans texte, sans calligraphie et sans page du Coran.</p>')}
      ${row('Quran Foundation', '<p>Les API de contenu de Quran Foundation demandent des identifiants gardés sur un serveur et un accès de production validé (l’accès de test ne contient que deux sourates). Elles ne sont pas utilisées dans cette version.</p>')}
      ${row('La méthode', `<p>Rappel actif : <a href="https://www.psychologicalscience.org/journals/perspectives/j.1745-6916.2006.00012.x/" target="_blank" rel="noopener">Roediger et Karpicke (2006)</a>. Pratique espacée : <a href="https://digitalcommons.usf.edu/psy_facpub/1771/" target="_blank" rel="noopener">Cepeda et collaborateurs</a>. Ces travaux soutiennent l’intérêt de ces techniques pour la rétention, sans garantie de maîtrise. Le calendrier (1, 3, 7, 14, 30 jours) est un choix de conception ajustable.</p>`)}`;
  },
};

/* ===== Feuilles ===== */
SHEETS.minutes = {
  render() {
    const v = UI.pickMinutes || prefs().minutes || 10;
    return { title: 'Combien de temps par jour ?', body: `
      <p class="sub">Un repère pour préparer ta séance. Tu pourras le changer à tout moment.</p>
      <div class="opts" role="radiogroup">${[5, 10, 15].map((m) => `<button type="button" class="opt${v === m ? ' is-on' : ''}" role="radio" aria-checked="${v === m}" data-act="pick-minutes" data-v="${m}"><span class="opt__dot" aria-hidden="true">${v === m ? icon('check', 'sm') : ''}</span><span class="opt__t"><b>${m} minutes</b>${m === 10 ? '<small>Proposé pour commencer</small>' : ''}</span></button>`).join('')}</div>
      <div class="sheet__acts"><button type="button" class="btn btn--primary btn--block" data-act="minutes-save">Valider</button><button type="button" class="btn btn--ghost btn--block" data-act="minutes-skip">Passer</button></div>` };
  },
};
SHEETS.display = {
  render() {
    const top = topPage(); const mode = top && top.name === 'reader' ? top.props.mode : prefs().readMode; const disp = readerDisplay(); const P = prefs();
    return { title: 'Affichage', body: `
      <p class="set__l">Présentation</p>
      <div class="seg">${[['verse', 'Verset par verset'], ['page', 'Pages du Coran']].map(([k, l]) => `<button type="button" class="seg__b${mode === k ? ' is-on' : ''}" aria-pressed="${mode === k}" data-act="read-mode" data-v="${k}">${l}</button>`).join('')}</div>
      <p class="set__l">Langues</p>
      ${mode === 'page' ? '<p class="fine">En mode « Pages du Coran », seul le texte arabe est affiché, comme dans un mushaf.</p>' : ''}
      <div class="opts" role="radiogroup" aria-label="Langues affichées">${Object.entries(DISPLAYS).map(([k, d]) => `<button type="button" class="opt${disp === k ? ' is-on' : ''}" role="radio" aria-checked="${disp === k}" data-act="read-display" data-v="${k}" ${mode === 'page' ? 'disabled' : ''}><span class="opt__dot" aria-hidden="true">${disp === k ? icon('check', 'sm') : ''}</span><span class="opt__t"><b>${esc(d.label)}</b>${k === 'fr' ? '<small>Traduction du sens — Rachid Maach</small>' : ''}</span></button>`).join('')}</div>
      <p class="set__l">Taille du texte arabe</p>
      <div class="stepper"><button type="button" class="icon-btn" data-act="size-step" data-d="-2" aria-label="Plus petit">${icon('minus')}</button><b class="num">${P.arSize}</b><button type="button" class="icon-btn" data-act="size-step" data-d="2" aria-label="Plus grand">${icon('plus')}</button></div>
      <p class="set__l">Ambiance</p>
      <div class="amb amb--row">${Object.entries(AMBIANCES).map(([k, a]) => `<button type="button" class="amb__b amb__b--${k}${P.ambiance === k ? ' is-on' : ''}" aria-pressed="${P.ambiance === k}" data-act="set-pref" data-k="ambiance" data-v="${k}"><span class="amb__sw" aria-hidden="true"></span><span>${esc(a.label)}</span></button>`).join('')}</div>
      <div class="sheet__acts"><button type="button" class="btn btn--soft btn--block" data-act="immersive">${icon('maximize', 'sm')}Plein écran</button></div>` };
  },
};
SHEETS['reader-more'] = {
  render() {
    const top = topPage(); const s = top && top.props ? (top.props.mode === 'page' ? versesOfPage(top.props.p)[0].s : top.props.s) : 1;
    const dl = Downloads.running;
    return { title: esc(suraTitle(s)), body: `
      <form class="page-go" data-form="verse-go"><label for="verseGo">Aller au verset</label><div class="page-go__row"><input id="verseGo" type="number" inputmode="numeric" min="1" max="${suraMeta(s).ayas}" placeholder="1 à ${suraMeta(s).ayas}"><button type="submit" class="btn btn--primary">Aller</button></div></form>
      <form class="page-go" data-form="page-go"><label for="pageGo2">Aller à la page</label><div class="page-go__row"><input id="pageGo2" type="number" inputmode="numeric" min="1" max="604" placeholder="1 à 604"><button type="submit" class="btn btn--primary">Ouvrir</button></div></form>
      <div class="opts">
        <button type="button" class="opt" data-act="dl-sura" data-s="${s}" ${dl ? 'disabled' : ''}><span class="opt__dot" aria-hidden="true">${icon('download', 'sm')}</span><span class="opt__t"><b>${dl && dl.s === s ? `Téléchargement… ${dl.done}/${dl.total}` : 'Télécharger l’audio de cette sourate'}</b><small>${esc(reciter().name)} · environ ${Math.max(1, Math.round(suraMeta(s).ayas * 0.09))} Mo · pour l’écouter hors connexion</small></span></button>
        <button type="button" class="opt" data-act="path-learn" data-s="${s}" data-go="1"><span class="opt__dot" aria-hidden="true">${icon('sprout', 'sm')}</span><span class="opt__t"><b>Apprendre cette sourate</b><small>Elle devient ta sourate en cours</small></span></button>
        <button type="button" class="opt" data-act="open-page" data-page="sources"><span class="opt__dot" aria-hidden="true">${icon('file-text', 'sm')}</span><span class="opt__t"><b>Sources et droits</b></span></button>
      </div>` };
  },
};
SHEETS['verse-menu'] = {
  render(p) {
    const s = Number(p.s); const a = Number(p.a); const d = Content.suras.get(s);
    const fav = Array.from(Store.mem.fav.entries()).find(([, f]) => f.s === s && f.a === a);
    const notes = d ? footnotes(d.fn[a - 1]) : [];
    return { title: `${esc(suraTitle(s))} · verset ${a}`, body: `
      <div class="opts">
        <button type="button" class="opt" data-act="play-from" data-s="${s}" data-a="${a}"><span class="opt__dot">${icon('play', 'sm')}</span><span class="opt__t"><b>Écouter à partir d’ici</b></span></button>
        <div class="opt opt--static"><span class="opt__dot">${icon('repeat', 'sm')}</span><span class="opt__t"><b>Répéter ce verset</b><span class="chips">${[3, 5, 10].map((n) => `<button type="button" class="chip" data-act="repeat-verse" data-s="${s}" data-a="${a}" data-n="${n}">${n} fois</button>`).join('')}<button type="button" class="chip" data-act="repeat-verse" data-s="${s}" data-a="${a}" data-n="inf">En boucle</button></span></span></div>
        <button type="button" class="opt" data-act="sheet" data-sheet="group" data-s="${s}" data-a="${a}"><span class="opt__dot">${icon('layers', 'sm')}</span><span class="opt__t"><b>Répéter un groupe de versets</b></span></button>
        <button type="button" class="opt" data-act="${fav ? 'fav-edit' : 'fav-add'}" data-s="${s}" data-a="${a}" ${fav ? `data-id="${esc(fav[0])}"` : ''}><span class="opt__dot">${icon(fav ? 'bookmark-fill' : 'bookmark', 'sm')}</span><span class="opt__t"><b>${fav ? 'Modifier le favori' : 'Ajouter aux favoris'}</b>${fav && fav[1].label ? `<small>${esc(fav[1].label)}</small>` : ''}</span></button>
        ${notes.length ? `<button type="button" class="opt" data-act="sheet" data-sheet="notes" data-s="${s}" data-a="${a}"><span class="opt__dot">${icon('lightbulb', 'sm')}</span><span class="opt__t"><b>Comprendre</b><small>${notes.length} ${plural(notes.length, 'note', 'notes')} du traducteur</small></span></button>` : ''}
        <button type="button" class="opt" data-act="path-learn" data-s="${s}" data-go="1"><span class="opt__dot">${icon('sprout', 'sm')}</span><span class="opt__t"><b>Apprendre cette sourate</b></span></button>
        <button type="button" class="opt" data-act="copy-verse" data-s="${s}" data-a="${a}"><span class="opt__dot">${icon('copy', 'sm')}</span><span class="opt__t"><b>Copier le verset</b><small>Texte arabe et référence</small></span></button>
      </div>` };
  },
};
SHEETS.group = {
  render(p) {
    const s = Number(p.s); const max = suraMeta(s).ayas;
    if (!p.a1) { p.a1 = Number(p.a); p.a2 = Math.min(max, Number(p.a) + 2); p.n = 3; }
    return { title: 'Répéter un groupe', body: `
      <div class="grp"><span>Du verset</span><div class="stepper"><button type="button" class="icon-btn" data-act="grp-step" data-k="a1" data-d="-1" aria-label="Moins">${icon('minus')}</button><b class="num">${p.a1}</b><button type="button" class="icon-btn" data-act="grp-step" data-k="a1" data-d="1" aria-label="Plus">${icon('plus')}</button></div></div>
      <div class="grp"><span>au verset</span><div class="stepper"><button type="button" class="icon-btn" data-act="grp-step" data-k="a2" data-d="-1" aria-label="Moins">${icon('minus')}</button><b class="num">${p.a2}</b><button type="button" class="icon-btn" data-act="grp-step" data-k="a2" data-d="1" aria-label="Plus">${icon('plus')}</button></div></div>
      <p class="set__l">Nombre de fois</p>
      <div class="seg">${[[3, '3'], [5, '5'], [10, '10'], ['inf', 'En boucle']].map(([k, l]) => `<button type="button" class="seg__b${String(p.n) === String(k) ? ' is-on' : ''}" aria-pressed="${String(p.n) === String(k)}" data-act="grp-n" data-v="${k}">${l}</button>`).join('')}</div>
      <p class="fine">Un silence suit chaque passage pour que tu répètes. « Arrêter » coupe tout immédiatement.</p>
      <div class="sheet__acts"><button type="button" class="btn btn--primary btn--block" data-act="grp-go">${icon('play', 'sm')}Lancer</button></div>` };
  },
};
SHEETS['fav-edit'] = {
  render(p) {
    const f = p.id ? Store.mem.fav.get(p.id) : null; const s = f ? f.s : Number(p.s); const a = f ? f.a : Number(p.a);
    if (p.label == null) p.label = f ? f.label || '' : '';
    return { title: f ? 'Modifier le favori' : 'Ajouter aux favoris', body: `
      <p class="sub">${esc(suraTitle(s))} · verset ${a}</p>
      <label class="field"><span>Libellé (facultatif)</span><input id="favLabel" type="text" maxlength="40" value="${esc(p.label)}" placeholder="Par exemple : vendredi, à relire…"></label>
      <div class="chips">${['Vendredi', 'À relire', 'À apprendre'].map((l) => `<button type="button" class="chip" data-act="fav-label" data-v="${esc(l)}">${esc(l)}</button>`).join('')}</div>
      <div class="sheet__acts"><button type="button" class="btn btn--primary btn--block" data-act="fav-save" data-id="${esc(p.id || '')}" data-s="${s}" data-a="${a}">Enregistrer</button>
      ${f ? `<button type="button" class="btn btn--ghost btn--block" data-act="fav-del" data-id="${esc(p.id)}">${icon('trash', 'sm')}Retirer des favoris</button>` : ''}</div>` };
  },
};
SHEETS.notes = {
  render(p) {
    const d = Content.suras.get(Number(p.s)); const notes = d ? footnotes(d.fn[Number(p.a) - 1]) : [];
    return { title: 'Comprendre', body: `<p class="sub">${esc(suraTitle(Number(p.s)))} · verset ${p.a}</p>
      ${d ? `<p class="fr" lang="fr" translate="no">${frHTML(d.fr[Number(p.a) - 1])}</p>` : ''}
      <ol class="notes__list">${notes.map((f) => `<li><span class="notes__n">${esc(f.n)}</span><span translate="no">${esc(f.t)}</span></li>`).join('')}</ol>
      <p class="notes__src">Notes du traducteur Rachid Maach (QuranEnc). L’appli n’ajoute aucune explication de son cru.</p>` };
  },
};
SHEETS.juzamma = {
  render() {
    return { title: 'Juz Amma', body: `
      <p>Le Coran est réparti en 30 parties appelées juz. Juz Amma est la dernière : elle rassemble 37 sourates, d’An-Naba, numéro 78, à An-Nas, numéro 114. Plusieurs sont courtes et permettent de commencer progressivement.</p>
      <p class="fine">Al-Fatiha, la première sourate, ne fait pas partie de Juz Amma : elle est proposée en premier dans ton parcours, à part.</p>
      <p class="fine">Référence : <a href="https://quran.com/fr/juz/30" target="_blank" rel="noopener">Juz 30 sur Quran.com</a>.</p>
      <div class="sheet__acts"><button type="button" class="btn btn--soft btn--block" data-act="open-juz" data-j="30">${icon('book-open', 'sm')}Ouvrir Juz Amma dans le lecteur</button></div>` };
  },
};
SHEETS.tlhelp = {
  render() {
    return { title: 'Comment lire la phonétique', body: `
      <p>La phonétique t’aide à démarrer. Écoute aussi la récitation pour apprendre les sons : l’écriture latine ne restitue pas exactement certains sons arabes.</p>
      <p class="fine">Cette phonétique est la translittération de Tanzil, écrite avec des conventions anglaises. Voici comment la lire :</p>
      <ul class="tlh">
        <li><span class="tl"><span class="tl-u">a</span></span><span>lettre soulignée : voyelle longue (« a » prolongé) ou son propre à l’arabe</span></li>
        <li><span class="tl">ee · oo</span><span>« i » long et « ou » long</span></li>
        <li><span class="tl">AA</span><span>la lettre ʿayn (ع), un son de gorge sans équivalent en français</span></li>
        <li><span class="tl">kh · gh · q</span><span>son raclé comme la jota espagnole · « r » grasseyé · « k » prononcé au fond de la gorge</span></li>
        <li><span class="tl">th · <span class="tl-u">th</span></span><span>« th » de l’anglais <i>think</i> (ث) · « th » de <i>this</i> (ذ)</span></li>
        <li><span class="tl"><span class="tl-u">h</span> · <span class="tl-u">s d t</span></span><span>« h » soufflé fort (ح) · versions « lourdes » de s, d, t (ص ض ط)</span></li>
        <li><span class="tl">bb · ll</span><span>lettre doublée : on appuie dessus</span></li>
        <li><span class="tl"><span class="tl-b">l</span> · fin en <span class="tl-b">i</span></span><span>lettre en gris : écrite mais non prononcée (assimilée, ou fin de verset quand on s’arrête)</span></li>
      </ul>
      <p class="fine">La phonétique ne remplace pas l’écoute d’un enseignant : fais vérifier ta récitation quand tu peux.</p>` };
  },
};
SHEETS.method = {
  render() {
    return { title: 'La méthode', body: `
      <ol class="meth">
        <li><b>Écouter</b><span>une récitation humaine, en suivant le texte.</span></li>
        <li><b>Répéter</b><span>à voix haute, dans le silence après chaque écoute (3 fois par défaut, modifiable).</span></li>
        <li><b>Réciter</b><span>sans regarder : c’est le rappel actif, essayer de retrouver de mémoire.</span></li>
        <li><b>Relier</b><span>le nouveau passage aux versets précédents, pour l’ordre et les transitions.</span></li>
      </ol>
      <p>Les révisions reviennent le lendemain, puis 3 jours, une semaine, deux semaines et un mois après la première réussite sans aide. Ensuite, un entretien régulier, adapté à tes résultats.</p>
      <p class="fine">La recherche soutient l’intérêt du rappel actif (<a href="https://www.psychologicalscience.org/journals/perspectives/j.1745-6916.2006.00012.x/" target="_blank" rel="noopener">Roediger et Karpicke</a>) et de la pratique espacée (<a href="https://digitalcommons.usf.edu/psy_facpub/1771/" target="_blank" rel="noopener">Cepeda et collaborateurs</a>) pour la rétention. Ce calendrier est un choix ajustable : ni un calendrier religieux, ni une garantie de mémorisation en un nombre de jours.</p>` };
  },
};
SHEETS['sura-pick'] = {
  render(p) {
    const res = searchSuras(p.q || '');
    return { title: p.purpose === 'path-add' ? 'Ajouter une sourate' : 'Choisir une sourate', body: `
      <label class="search" for="pickSearch">${icon('search')}<input id="pickSearch" type="search" autocomplete="off" placeholder="Nom ou numéro" value="${esc(p.q || '')}"></label>
      <ul class="slist slist--pick">${res.suras.slice(0, 114).map((m) => `<li><button type="button" class="srow" data-act="pick-sura" data-s="${m.n}">${suraBadge(m.n)}<span class="srow__main"><span class="srow__name">${esc(m.name)}</span><span class="srow__sub">${m.sub ? esc(m.sub) + ' · ' : ''}${m.ayas} versets</span></span><span class="srow__ar" lang="ar" dir="rtl" translate="no">${esc(m.ar)}</span></button></li>`).join('')}</ul>` };
  },
};
SHEETS.remind = {
  render() {
    const t = prefs().remindTime || '19:00';
    return { title: 'Rappel quotidien', body: `
      <p class="sub">Choisis une heure, puis ajoute le rappel à ton calendrier. Tu pourras le modifier ou le supprimer dans ton calendrier.</p>
      <label class="field"><span>Heure</span><input id="remindTime" type="time" value="${esc(t)}"></label>
      <div class="sheet__acts">
        <button type="button" class="btn btn--primary btn--block" data-act="remind-ics">${icon('calendar', 'sm')}Calendrier du téléphone (.ics)</button>
        <button type="button" class="btn btn--soft btn--block" data-act="remind-google">${icon('calendar', 'sm')}Google Agenda</button>
      </div>
      <p class="fine">Le rappel s’appelle « Ma séance du jour » pour rester discret. Rien n’est envoyé par l’appli.</p>` };
  },
};
SHEETS.teacher = {
  render(p) {
    const s = Number(p.s); const cur = progressOf(s).teacher || {};
    return { title: 'Vérifiée avec un enseignant', body: `
      <p class="sub">${esc(suraTitle(s))} — cette mention est renseignée par toi : l’appli n’a pas entendu l’enseignant.</p>
      <label class="field"><span>Date</span><input id="tDate" type="date" value="${esc(cur.date || todayISO())}" max="${todayISO()}"></label>
      <label class="field"><span>Enseignant (facultatif)</span><input id="tName" type="text" maxlength="60" value="${esc(cur.name || '')}"></label>
      <div class="sheet__acts"><button type="button" class="btn btn--primary btn--block" data-act="teacher-save" data-s="${s}">Enregistrer</button>
      ${cur.date ? `<button type="button" class="btn btn--ghost btn--block" data-act="teacher-del" data-s="${s}">Retirer la mention</button>` : ''}</div>` };
  },
};
SHEETS.confirm = {
  render(p) {
    return { title: esc(p.title || 'Confirmer'), body: `<p>${esc(p.text || '')}</p><div class="sheet__acts"><button type="button" class="btn btn--danger btn--block" data-act="confirm-yes">${esc(p.yes || 'Confirmer')}</button><button type="button" class="btn btn--ghost btn--block" data-act="sheet-close">Annuler</button></div>` };
  },
};

/* ===== Actions ===== */
const NAV = { fromAgenda: false };
function goAgenda(hash) {
  stopAudio();
  if (!hash && NAV.fromAgenda && history.length > 1) { history.back(); return; }
  location.href = './' + (hash || '');
}
const ACT = {};
ACT.tab = (el) => {
  const t = el.dataset.tab; if (!['learn', 'read', 'progress'].includes(t)) return;
  const same = UI.tab === t && !UI.pages.length;
  while (UI.pages.length) { const top = UI.pages.pop(); if (PAGES[top.name] && PAGES[top.name].onClose) PAGES[top.name].onClose(top.props); }
  renderPage(true); closeAllSheets();
  UI.tab = t; renderAll();
  window.scrollTo({ top: 0, behavior: same ? 'smooth' : 'auto' });
};
ACT['go-agenda'] = () => goAgenda();
ACT.reload = () => location.reload();
ACT.back = () => backPage();
ACT['open-page'] = (el) => { closeAllSheets(); const props = {}; if (el.dataset.s) props.s = Number(el.dataset.s); openPage(el.dataset.page, props); };
ACT['sheet-close'] = () => closeSheet();
ACT.sheet = (el) => { const props = Object.assign({}, el.dataset); delete props.act; delete props.sheet; openSheet(el.dataset.sheet, props); };
ACT['toast-action'] = () => { const a = Toast.action; Toast.action = null; $('#toasts').innerHTML = ''; if (a) a.fn(); };

/* --- Préférences --- */
ACT['set-pref'] = async (el) => {
  const k = el.dataset.k; let v = el.dataset.v;
  if (k === 'minutes') v = Number(v);
  if (k === 'ambiance' && !AMBIANCES[v]) return;
  await setPrefs({ [k]: v, ...(k === 'minutes' ? { minutesAsked: true } : {}) });
  if (k === 'reciter') stopAudio();
  if (k === 'ambiance') { applyAmbiance(); rerenderReaderKeepingPlace(); refreshSheet(); return; }
  renderAll(); refreshSheet();
};
ACT['reps-step'] = async (el) => { const v = clamp((prefs().reps || 3) + Number(el.dataset.d), 1, 10); await setPrefs({ reps: v }); renderPage(false); };
ACT['size-step'] = async (el) => { const v = clamp((prefs().arSize || 30) + Number(el.dataset.d), 22, 52); await setPrefs({ arSize: v }); applyAmbiance(); refreshSheet(); };
ACT['read-display'] = async (el) => { if (!DISPLAYS[el.dataset.v]) return; await setPrefs({ readDisplay: el.dataset.v }); refreshSheet(); rerenderReaderKeepingPlace(); };
ACT['read-mode'] = async (el) => {
  const mode = el.dataset.v === 'page' ? 'page' : 'verse'; await setPrefs({ readMode: mode });
  const top = topPage();
  if (top && top.name === 'reader') {
    const anchor = Reader.anchor || { s: top.props.s, a: top.props.a || 1 };
    if (mode === 'page') top.props = { s: anchor.s, a: anchor.a, mode: 'page', p: pageOfVerse(anchor.s, anchor.a), focus: anchor.s + '-' + anchor.a };
    else { const first = top.props.mode === 'page' ? versesOfPage(top.props.p)[0] : anchor; top.props = { s: first.s, a: first.a, mode: 'verse', scrollTo: first.a }; }
    renderPage(true);
  }
  refreshSheet();
};
ACT['tl-note-ok'] = async () => { await setPrefs({ tlNoteSeen: true }); renderAll(); };
ACT['learn-meaning'] = () => { UI.learnMeaning = !UI.learnMeaning; renderPage(false); };
ACT.immersive = () => { closeAllSheets(); enterImmersive(); };
ACT['immersive-exit'] = () => exitImmersive();
ACT['pick-minutes'] = (el) => { UI.pickMinutes = Number(el.dataset.v); refreshSheet(); };
ACT['minutes-save'] = async () => { await setPrefs({ minutes: UI.pickMinutes || 10, minutesAsked: true }); closeSheet(); renderAll(); };
ACT['minutes-skip'] = async () => { await setPrefs({ minutesAsked: true }); closeSheet(); renderAll(); };

/* --- Lecteur --- */
ACT['open-reader'] = (el) => { if (UI.pages.some((p) => p.name === 'session')) return; openReader(el.dataset.s, el.dataset.a, { replace: el.dataset.replace === '1', mode: el.dataset.mode === 'page' ? 'page' : (prefs().readMode === 'page' && !el.dataset.a ? 'page' : 'verse') }); };
ACT['open-page-mode'] = (el) => { const p = clamp(Number(el.dataset.p) || 1, 1, 604); const v = versesOfPage(p)[0]; setPrefs({ readMode: 'page' }); openReader(v.s, v.a, { mode: 'page', p }); };
ACT['open-juz'] = (el) => { const j = Content.index.juz[clamp(Number(el.dataset.j) || 1, 1, 30) - 1]; openReader(j.s, j.a, { mode: prefs().readMode === 'page' ? 'page' : 'verse' }); };
ACT['read-seg'] = (el) => { UI.readSeg = el.dataset.seg; renderRead(); };
ACT['reader-retry'] = () => { const top = topPage(); if (top) { top.props.err = null; top.props.loading = false; } renderPage(true); };
ACT['page-step'] = (el) => { const top = topPage(); if (top) goPage((top.props.p || 1) + Number(el.dataset.d)); };
ACT['verse-menu'] = (el) => openSheet('verse-menu', { s: el.dataset.s, a: el.dataset.a });
ACT['reader-play'] = () => {
  const top = topPage(); if (!top) return;
  if (Player.ctx === 'reader' && Player.state !== 'idle') { if (Player.state === 'paused') resumeAudio(); else pauseAudio(); renderPlayerBar(); return; }
  const a = top.props.mode === 'page' ? versesOfPage(top.props.p)[0] : (Reader.anchor && Reader.anchor.s === top.props.s ? Reader.anchor : { s: top.props.s, a: top.props.a || 1 });
  loadSura(a.s).then(() => startReaderAudio({ s: a.s, a: a.a, kind: 'continuous' }), (e) => toast(contentErrorText(e), true));
};
ACT['play-from'] = (el) => { closeAllSheets(); const s = Number(el.dataset.s); loadSura(s).then(() => startReaderAudio({ s, a: Number(el.dataset.a), kind: 'continuous' })); };
ACT['repeat-verse'] = (el) => { closeAllSheets(); const s = Number(el.dataset.s); const n = el.dataset.n === 'inf' ? Infinity : Number(el.dataset.n); loadSura(s).then(() => startReaderAudio({ s, a: Number(el.dataset.a), kind: 'verse', count: n, gap: 'auto' })); };
ACT['grp-step'] = (el) => {
  const t = topSheet(); if (!t) return; const p = t.props; const max = suraMeta(Number(p.s)).ayas;
  p[el.dataset.k] = clamp(p[el.dataset.k] + Number(el.dataset.d), 1, max);
  if (p.a2 < p.a1) { if (el.dataset.k === 'a1') p.a2 = p.a1; else p.a1 = p.a2; }
  refreshSheet();
};
ACT['grp-n'] = (el) => { const t = topSheet(); if (t) { t.props.n = el.dataset.v; refreshSheet(); } };
ACT['grp-go'] = () => {
  const t = topSheet(); if (!t) return; const p = t.props; const s = Number(p.s);
  closeAllSheets();
  loadSura(s).then(() => startReaderAudio({ s, kind: 'group', a1: p.a1, a2: p.a2, count: p.n === 'inf' ? Infinity : Number(p.n), gap: 'auto' }));
};
ACT['player-toggle'] = () => { if (Player.state === 'paused') resumeAudio(); else pauseAudio(); renderPlayerBar(); };
ACT['player-stop'] = () => { stopAudio(); highlightVerse(null); renderPlayerBar(); };
ACT['player-step'] = (el) => {
  const cfg = Reader.audio; const t = Player.cur; if (!cfg || !t) return;
  const s = t.intro ? t.forS : t.s; const meta = suraMeta(s); const d = Number(el.dataset.d);
  const a = clamp((t.intro ? 0 : t.a) + d, 1, meta.ayas);
  if (cfg.kind === 'continuous') startReaderAudio({ s, a, kind: 'continuous' });
  else if (cfg.kind === 'verse') startReaderAudio(Object.assign({}, cfg, { s, a }));
  else { const len = cfg.a2 - cfg.a1; const a1 = clamp(cfg.a1 + d, 1, meta.ayas - len); startReaderAudio(Object.assign({}, cfg, { a1, a2: a1 + len })); }
};
ACT['copy-verse'] = async (el) => {
  const s = Number(el.dataset.s); const a = Number(el.dataset.a); const d = Content.suras.get(s); if (!d) return;
  const txt = `${d.arBody[a - 1]} (${suraTitle(s)} ${s}:${a})`;
  try { await navigator.clipboard.writeText(txt); toast('Verset copié.'); } catch (e) { toast('La copie n’est pas possible ici.', true); }
  closeAllSheets();
};
ACT['dl-sura'] = async (el) => {
  const s = Number(el.dataset.s);
  if (Downloads.running) return;
  const tick = debounce(() => refreshSheet(), 150);
  try {
    const r = await downloadSura(s, () => tick());
    tick.flush && tick.flush();
    toast(`Audio de ${suraTitle(s)} gardé sur ce téléphone (${(r.bytes / 1048576).toFixed(1).replace('.', ',')} Mo).`);
    Offline.inv = null;
  } catch (e) {
    toast(e && e.code === 'storage' ? 'Plus assez de place sur le téléphone pour garder cet audio.' : e && e.code === 'cancelled' ? 'Téléchargement arrêté.' : 'Téléchargement interrompu (réseau). Les versets déjà reçus sont gardés : relance pour finir.', true);
  }
  refreshSheet();
};
ACT['audio-del'] = async (el) => { const n = await deleteSuraAudio(Number(el.dataset.s), el.dataset.folder); Offline.inv = null; toast(`${n} fichier(s) audio supprimé(s).`); renderPage(false); };

/* --- Recherche et formulaires --- */
function onSearchInput(v) { UI.q = v; paintReadList(); }

/* --- Favoris --- */
ACT['fav-add'] = (el) => { closeAllSheets(); openSheet('fav-edit', { s: el.dataset.s, a: el.dataset.a }); };
ACT['fav-edit'] = (el) => { closeAllSheets(); openSheet('fav-edit', { id: el.dataset.id }); };
ACT['fav-label'] = (el) => { const t = topSheet(); if (!t) return; t.props.label = el.dataset.v; const i = $('#favLabel'); if (i) i.value = el.dataset.v; };
ACT['fav-save'] = async (el) => {
  const label = ($('#favLabel') || {}).value || '';
  const id = el.dataset.id || uid('f');
  const prev = Store.mem.fav.get(id);
  await put('fav', id, { s: prev ? prev.s : Number(el.dataset.s), a: prev ? prev.a : Number(el.dataset.a), label: label.trim().slice(0, 40), at: prev ? prev.at : nowStamp() });
  closeAllSheets(); toast(prev ? 'Favori modifié.' : 'Ajouté aux favoris.'); renderAll(); rerenderReaderKeepingPlace();
};
ACT['fav-del'] = async (el) => {
  const id = el.dataset.id; const f = clone(Store.mem.fav.get(id)); if (!f) return;
  await del('fav', id); closeAllSheets(); renderAll(); rerenderReaderKeepingPlace();
  toast('Favori retiré.', false, { label: 'Annuler', fn: () => put('fav', id, f).then(() => { renderAll(); rerenderReaderKeepingPlace(); }) });
};

/* --- Parcours --- */
ACT['path-learn'] = async (el) => {
  const s = Number(el.dataset.s); const path = learningPath();
  const patch = { current: s };
  if (!path.includes(s)) patch.path = path.concat([s]);
  await setPrefs(patch);
  closeAllSheets();
  toast(`${suraTitle(s)} est ta sourate en cours.`);
  if (el.dataset.go) { while (UI.pages.length) UI.pages.pop(); renderPage(true); UI.tab = 'learn'; }
  renderAll();
};
ACT['path-move'] = async (el) => {
  const path = learningPath().slice(); const i = Number(el.dataset.i); const j = i + Number(el.dataset.d);
  if (j < 0 || j >= path.length) return; [path[i], path[j]] = [path[j], path[i]];
  await setPrefs({ path }); renderPage(false);
};
ACT['path-remove'] = async (el) => {
  const path = learningPath().slice(); const i = Number(el.dataset.i); const [n] = path.splice(i, 1);
  const patch = { path }; if (prefs().current === n) patch.current = null;
  await setPrefs(patch); renderAll();
  toast(`${suraTitle(n)} retirée du parcours (sa progression est gardée).`);
};
ACT['path-reset'] = async () => { await setPrefs({ path: null }); renderAll(); toast('Parcours proposé rétabli.'); };
ACT['pick-sura'] = async (el) => {
  const t = topSheet(); const s = Number(el.dataset.s); const purpose = t && t.props.purpose;
  closeAllSheets();
  if (purpose === 'path-add') {
    const path = learningPath(); if (path.includes(s)) { toast('Elle est déjà dans ton parcours.'); return; }
    await setPrefs({ path: path.concat([s]) }); renderAll(); toast(`${suraTitle(s)} ajoutée au parcours.`);
  } else openReader(s, 1);
};

/* --- Séance --- */
ACT['session-start'] = (el) => startSession(el);
ACT['session-more'] = async (el) => {
  const s = cur(); const surah = currentSurah(); const d = await loadSura(surah).catch(() => null);
  const it = d ? nextPassage(surah, d) : null;
  if (!it) { toast('Plus de nouveau passage dans cette sourate : passe à la récitation complète ou choisis une sourate.'); return; }
  s.items.push(it); s.done = false; s.i = s.items.length - 1; s.step = null; s.st = {}; s.budgetAck = true;
  persistSession(); renderPage(true);
};
ACT['session-close'] = () => {
  stopAudio(); stopRecording(true);
  const s = cur();
  if (s && s.done) saveSession(null);
  while (UI.pages.length) { const top = UI.pages.pop(); if (PAGES[top.name] && PAGES[top.name].onClose) PAGES[top.name].onClose(top.props); }
  UI.tab = 'learn'; renderPage(true); renderAll();
  if (s && !s.done) toast('Séance gardée : reprends-la quand tu veux.');
};
ACT['session-finish'] = () => { const s = cur(); if (!s) return; s.done = true; s.budgetPrompt = false; s.endedAt = nowStamp(); persistSession(); renderPage(true); };
ACT['budget-continue'] = () => { const s = cur(); if (!s) return; s.budgetPrompt = false; s.budgetAck = true; persistSession(); renderPage(true); };
ACT['session-retry'] = () => { Sess.loadErr = null; renderPage(true); };
ACT['audio-stop'] = () => { stopAudio(); renderPage(false); };
ACT['learn-listen'] = () => {
  const it = curItem(); const s = cur(); if (!it) return;
  runSequence(passageTracks(it), {
    ctx: 'session', cycles: 1,
    onTrackEnd: (t) => markListened(t.s, t.a),
    onPhase: (ph) => { if (ph === 'done') { s.st.listened = true; persistSession(); } renderPage(false); },
  });
  renderPage(false);
};
ACT['step-next'] = (el) => {
  const to = el.dataset.to; stopAudio();
  if (to === 'recite' || to === 'link-recite') { setStep(to, { hints: 0, revealed: false, recId: null }); return; }
  const rework = cur() && cur().st && cur().st.rework;
  setStep(to, to === 'repeat' ? { done: 0, target: rework ? 2 : (prefs().reps || 3) } : {});
};
ACT['repeat-run'] = () => {
  const it = curItem(); const s = cur(); if (!it) return;
  const st = s.st; const left = Math.max(1, (st.target || prefs().reps || 3) - (st.done || 0));
  st.doneBase = st.done || 0;
  runSequence(passageTracks(it), {
    ctx: 'session', cycles: left, gap: prefs().gap || 'auto', gapAfterLast: true,
    onTrackEnd: (t) => markListened(t.s, t.a),
    onPhase: (ph) => {
      if (ph === 'gap') { /* rien : le compteur avance à la fin du silence */ }
      if (ph === 'play' && Player.cycle > 1) { st.done = Math.min(st.target, (st.doneBase || 0) + Player.cycle - 1); }
      if (ph === 'done') st.done = st.target;
      persistSession(); renderPage(false);
    },
  });
  renderPage(false);
};
ACT['repeat-more'] = () => { const s = cur(); if (!s) return; s.st.target = (s.st.target || prefs().reps || 3) + 1; persistSession(); ACT['repeat-run'](); };
ACT['repeat-hide'] = () => { const s = cur(); if (!s) return; s.st.hideText = !s.st.hideText; persistSession(); renderPage(false); };
ACT.hint = () => { const s = cur(); if (!s) return; s.st.hints = (s.st.hints || 0) + 1; persistSession(); renderPage(false); };
ACT.reveal = () => { const s = cur(); if (!s) return; s.st.revealed = true; persistSession(); renderPage(false); };
ACT.recited = () => { const s = cur(); if (!s) return; stopRecording(false); setStep(s.step === 'link-recite' ? 'link-eval' : 'eval', {}); };
ACT.evaluate = (el) => applyEvaluation(el.dataset.r);
ACT['step-continue'] = (el) => {
  const s = cur(); if (!s) return; stopAudio();
  if (s.step === 'link-after' || s.step === 'link-intro' || s.step === 'difficult') { continueAfterStep(true); return; }
  continueAfterStep(!!el.dataset.skip);
};
ACT['link-listen'] = () => {
  const it = curItem(); const s = cur(); if (!it) return;
  runSequence(passageTracks(linkItem(it)), { ctx: 'session', cycles: 1, onTrackEnd: (t) => markListened(t.s, t.a), onPhase: (ph) => { if (ph === 'done') { s.st.listened = true; persistSession(); } renderPage(false); } });
  renderPage(false);
};
ACT.relisten = (el) => { const it = curItem(); if (!it) return; runSequence(passageTracks(el.dataset.link ? linkItem(it) : it), { ctx: 'session', cycles: 1, onPhase: () => renderPage(false) }); renderPage(false); };
ACT['rework-now'] = () => { const s = cur(); if (!s) return; const n = (s.st.reworkCount || 0) + 1; stopAudio(); s.step = 'listen'; s.st = { rework: true, reworkCount: n }; persistSession(); renderPage(false); };
ACT['difficult-open'] = () => { const s = cur(); if (!s) return; setStep('difficult', { difficult: [] }); };
ACT['difficult-toggle'] = (el) => { const s = cur(); if (!s) return; const a = Number(el.dataset.a); const set = new Set(s.st.difficult || []); if (set.has(a)) set.delete(a); else set.add(a); s.st.difficult = Array.from(set).sort((x, y) => x - y); persistSession(); renderPage(false); };
ACT['difficult-save'] = async () => {
  const s = cur(); const it = curItem(); if (!s || !it) return;
  const list = s.st.difficult || [];
  for (const a of list) await recordReview({ type: 'passage', s: it.s, a1: a, a2: a, c: null }, 'rework');
  // les reprendre tout de suite, en commençant par l'écoute
  s.items.splice(s.i + 1, 0, ...list.map((a) => ({ type: 'new', s: it.s, a1: a, a2: a, c: null, nc: 1, retry: true })));
  toast(`${list.length} ${plural(list.length, 'verset ajouté', 'versets ajoutés')} : on les reprend maintenant, puis en révision demain.`);
  nextItem();
};
ACT['known-start'] = async (el) => {
  const s = Number(el.dataset.s);
  try { await loadSura(s); } catch (e) { toast(contentErrorText(e), true); return; }
  while (UI.pages.length && topPage().name !== 'session') UI.pages.pop();
  closeAllSheets();
  await startSingle({ type: 'known', s, mode: 'known' });
};
ACT['surah-recite'] = async (el) => {
  const s = Number(el.dataset.s);
  try { await loadSura(s); } catch (e) { toast(contentErrorText(e), true); return; }
  const hasFull = !!(progressOf(s).m || {})[4];
  await startSingle({ type: 'surah', s, mode: hasFull ? 'review' : 'learn' });
};
ACT['rec-toggle'] = () => {
  if (Rec.mr) { stopRecording(false); return; }
  const s = cur(); const it = curItem(); if (!it) return;
  const tgt = s.step === 'link-recite' ? linkItem(it) : it;
  startRecording({ s: it.s, a1: tgt.a1 || 1, a2: tgt.a2 || suraMeta(it.s).ayas, c: tgt.c, scope: it.type === 'surah' || it.type === 'known' ? 'surah' : 'passage' });
};
ACT['rec-play'] = (el) => playRecording(el.dataset.id);
ACT['rec-del'] = async (el) => { await idbDel('rec', el.dataset.id).catch(() => {}); Offline.recs = null; toast('Enregistrement supprimé.'); renderPage(false); };
ACT['rec-del-all'] = () => openSheet('confirm', { title: 'Supprimer tous tes enregistrements ?', text: 'Ils seront effacés de ce téléphone. Ta progression n’est pas touchée.', yes: 'Tout supprimer', then: 'rec-del-all' });
ACT['confirm-yes'] = async () => {
  const t = topSheet(); if (!t) return; const what = t.props.then; closeSheet();
  if (what === 'rec-del-all') { const recs = await listRecordings(); for (const r of recs) await idbDel('rec', r.id).catch(() => {}); Offline.recs = null; toast('Enregistrements supprimés.'); renderPage(false); }
};

/* --- Récitateur, rappel, hors connexion, sauvegarde --- */
ACT['reciter-test'] = () => { runSequence([{ s: 1, a: 1 }], { ctx: 'test', cycles: 1, onPhase: (ph, info) => { if (ph === 'error') toast(audioErrorText(info.error), true); } }); };
ACT['remind-ics'] = async () => {
  const t = ($('#remindTime') || {}).value || '19:00'; await setPrefs({ remindTime: t });
  const [h, m] = t.split(':').map(Number); const d = addDays(todayISO(), 1).replace(/-/g, '');
  const hh = String(h).padStart(2, '0'); const mm = String(m).padStart(2, '0'); const end = String(Math.min(23, h + (m + 10 >= 60 ? 1 : 0))).padStart(2, '0') + String((m + 10) % 60).padStart(2, '0');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StayClean Agenda//Mon Coran//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    'UID:' + uid('qr') + '@stayclean-agenda', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
    `DTSTART;TZID=Europe/Brussels:${d}T${hh}${mm}00`, `DTEND;TZID=Europe/Brussels:${d}T${end}00`, 'RRULE:FREQ=DAILY',
    'SUMMARY:Ma séance du jour', 'DESCRIPTION:Ouvre StayClean Agenda pour ta séance.', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Ma séance du jour', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const file = new File([ics], 'rappel-ma-seance.ics', { type: 'text/calendar' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Ma séance du jour' }); closeSheet(); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = 'rappel-ma-seance.ics'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  closeSheet(); toast('Fichier du rappel prêt : ouvre-le pour l’ajouter à ton calendrier.');
};
ACT['remind-google'] = async () => {
  const t = ($('#remindTime') || {}).value || '19:00'; await setPrefs({ remindTime: t });
  const [h, m] = t.split(':').map(Number); const d = addDays(todayISO(), 1).replace(/-/g, '');
  const s = `${d}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
  const e2 = new Date(Date.UTC(2000, 0, 1, h, m + 10)); const e = `${d}T${String(e2.getUTCHours()).padStart(2, '0')}${String(e2.getUTCMinutes()).padStart(2, '0')}00`;
  const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Ma séance du jour') + '&dates=' + s + '/' + e + '&ctz=Europe/Brussels&recur=' + encodeURIComponent('RRULE:FREQ=DAILY');
  window.open(url, '_blank', 'noopener'); closeSheet();
};
ACT['offline-text'] = async (el) => {
  if (Offline.textBusy) return; Offline.textBusy = true; renderPage(false);
  let ok = 0;
  try {
    await fetch('coran/data/index.json?v=' + DATA_V);
    for (let n = 1; n <= 114; n++) { const r = await fetch('coran/data/s/' + pad3(n) + '.json?v=' + DATA_V); if (r.ok) ok++; }
    if (ok === 114) { await idbPut('kv', 'offline-text', DATA_V).catch(() => {}); Offline.textState = DATA_V; toast('Les 114 sourates sont enregistrées sur ce téléphone.'); }
    else toast(`${ok} sourates sur 114 enregistrées : relance avec une meilleure connexion.`, true);
  } catch (e) { toast(`Interrompu (réseau) : ${ok} sourates sur 114 enregistrées. Relance pour finir.`, true); }
  Offline.textBusy = false; renderPage(false);
};
ACT.export = () => {
  const items = []; Store.items.forEach((it) => { if (!it.deleted) items.push({ kind: it.kind, id: it.id, data: it.data, lu: it.lu }); });
  const out = { format: 'mon-coran-progression', version: 1, exportedAt: nowStamp(), app: 'StayClean Agenda — Mon Coran', items };
  const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `mon-coran-progression-${todayISO()}.json`;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  toast(`Progression exportée (${items.length} éléments).`);
};
ACT.import = () => $('#fileImport').click();
async function importFile(file) {
  let data; try { data = JSON.parse(await file.text()); } catch (e) { toast('Ce fichier n’est pas un export de Mon Coran.', true); return; }
  if (!data || data.format !== 'mon-coran-progression' || !Array.isArray(data.items)) { toast('Ce fichier n’est pas un export de Mon Coran.', true); return; }
  let n = 0;
  for (const it of data.items) {
    if (!KINDS.includes(it.kind) || typeof it.id !== 'string' || !it.data || typeof it.data !== 'object') continue;
    const local = Store.items.get(itemKey(it.kind, it.id));
    if (local && !local.deleted && (local.lu || 0) >= (it.lu || 0)) continue;
    await put(it.kind, it.id, it.data); n++;
  }
  toast(n ? `${n} élément(s) importé(s).` : 'Rien de nouveau dans ce fichier.');
  renderAll();
}
ACT['sync-now'] = async (el) => { const done = busy(el, 'Synchronisation…'); await syncNow(); done(); toast(syncLabel().text, Sync.state !== 'synced'); renderPage(false); };
ACT['teacher-save'] = async (el) => {
  const s = Number(el.dataset.s); const date = ($('#tDate') || {}).value; const name = (($('#tName') || {}).value || '').trim().slice(0, 60);
  if (!validISO(date) || date > todayISO()) { toast('Choisis une date valide (aujourd’hui ou avant).', true); return; }
  const p = progressOf(s); p.teacher = { date, name, declaredByUser: true, at: nowStamp() }; if (!p.startedAt) p.startedAt = todayISO();
  await saveProgress(p); closeAllSheets(); renderAll(); toast('Mention enregistrée (renseignée par toi).');
};
ACT['teacher-del'] = async (el) => { const s = Number(el.dataset.s); const p = progressOf(s); p.teacher = null; await saveProgress(p); closeAllSheets(); renderAll(); };

/* --- Branchements --- */
function wire() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.getAttribute('aria-disabled') === 'true' || el.disabled) return;
    const fn = ACT[el.dataset.act]; if (!fn) return;
    e.preventDefault();
    try { const r = fn(el, e); if (r && r.catch) r.catch((err) => { console.error(err); toast('Une erreur est survenue. Réessaie.', true); }); }
    catch (err) { console.error(err); toast('Une erreur est survenue. Réessaie.', true); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (UI.sheets.length) closeSheet(); else if (document.body.classList.contains('is-immersive')) exitImmersive(); else if (UI.pages.length) backPage(); return; }
    const el = e.target.closest && e.target.closest('[role="button"][data-act]');
    if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'readSearch') onSearchInput(t.value);
    if (t.id === 'pickSearch') { const s = topSheet(); if (s) { s.props.q = t.value; const list = $('#sheets .slist--pick'); if (list) { const res = searchSuras(t.value); list.innerHTML = res.suras.map((m) => `<li><button type="button" class="srow" data-act="pick-sura" data-s="${m.n}">${suraBadge(m.n)}<span class="srow__main"><span class="srow__name">${esc(m.name)}</span><span class="srow__sub">${m.ayas} versets</span></span><span class="srow__ar" lang="ar" dir="rtl" translate="no">${esc(m.ar)}</span></button></li>`).join(''); } } }
    if (t.id === 'favLabel') { const s = topSheet(); if (s) s.props.label = t.value; }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault();
    const kind = f.dataset.form; const inp = f.querySelector('input'); const v = Number(inp && inp.value);
    if (kind === 'page-go') { if (!(v >= 1 && v <= 604)) { toast('Les pages vont de 1 à 604.', true); return; } const top = topPage(); if (top && top.name === 'reader' && top.props.mode === 'page') { closeAllSheets(); goPage(v); } else { const vv = versesOfPage(v)[0]; closeAllSheets(); openReader(vv.s, vv.a, { mode: 'page', p: v }); } }
    if (kind === 'verse-go') {
      const top = topPage(); const s = top.props.mode === 'page' ? versesOfPage(top.props.p)[0].s : top.props.s;
      if (!(v >= 1 && v <= suraMeta(s).ayas)) { toast(`Cette sourate compte ${suraMeta(s).ayas} versets.`, true); return; }
      closeAllSheets(); top.props = { s, a: v, mode: 'verse', scrollTo: v }; renderPage(true);
    }
  });
  $('#fileImport').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
  Player.listeners.add(() => {
    renderPlayerBar();
    const top = topPage();
    if (top && top.name === 'session') { if (!Sess.paintQueued) { Sess.paintQueued = true; requestAnimationFrame(() => { Sess.paintQueued = false; renderPage(false); }); } }
  });
  Store.listeners.add(() => scheduleRender());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') { saveSummary(); if (cur()) persistSession(); if (Rec.mr) stopRecording(false); return; }
    refreshAgendaDB(); scheduleRender();
    if (Host.sb && Store.uid) syncNow();
  });
  window.addEventListener('online', () => { Host.online = true; if (Host.sb && Store.uid) syncNow(); scheduleRender(); });
  window.addEventListener('offline', () => { Host.online = false; if (Sync.state === 'synced' || Sync.state === 'pending') setSyncState('offline'); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && document.body.classList.contains('is-immersive') && !/iPhone|iPad|iPod/.test(navigator.userAgent)) document.body.classList.remove('is-immersive'); });
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('pause', () => { pauseAudio(); renderPlayerBar(); });
      navigator.mediaSession.setActionHandler('play', () => { resumeAudio(); renderPlayerBar(); });
      navigator.mediaSession.setActionHandler('stop', () => { stopAudio(); });
    } catch (e) { /* facultatif */ }
  }
}

/* ===== Démarrage =====
   1) contenu (index), 2) progression enregistrée sur l'appareil, 3) compte (si l'agenda est connecté). */
function hideSplash() {
  const s = $('#splash'); if (!s || UI.splashGone) return;
  UI.splashGone = true; s.classList.add('is-gone'); setTimeout(() => s.remove(), 450);
}
async function connectAccount() {
  if (!hostConfigured()) { setSyncState('local'); return; }
  initHost();
  if (!Host.sb) { setSyncState('local'); return; }
  Host.sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { Store.uid = null; setSyncState('signedout'); } });
  const stored = storedSessionUser();
  const user = stored || await hostSessionUser();
  if (!user) { setSyncState('signedout'); return; }
  if (Store.owner !== user.id) {
    await adoptLocalData(user.id);
    await loadLocal(user.id);
    emitChange();
  }
  Store.uid = user.id; Host.uid = user.id; Host.email = user.email || '';
  setSyncState('connecting');
  await syncNow();
  clearInterval(Sync.timer);
  Sync.timer = setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
  const confirmed = await hostSessionUser();
  if (confirmed && confirmed.id !== user.id) location.reload(); // autre compte connecté entre-temps
}
async function boot() {
  try { NAV.fromAgenda = sessionStorage.getItem('qr.from') === 'agenda'; sessionStorage.removeItem('qr.from'); } catch (e) { NAV.fromAgenda = false; }
  try { if (/^#lire/.test(location.hash)) UI.tab = 'read'; else if (/^#progres/.test(location.hash)) UI.tab = 'progress'; } catch (e) { /* rien */ }
  wire();
  const stored = hostConfigured() ? storedSessionUser() : null;
  await loadLocal(stored ? stored.id : 'local');
  applyAmbiance();
  renderAll();
  try { await loadIndex(); } catch (e) { Content.indexError = e; }
  renderAll();
  setTimeout(hideSplash, 250);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (Content.index && !prefs().minutesAsked) setTimeout(() => { if (!UI.sheets.length && !UI.pages.length) { UI.pickMinutes = 10; openSheet('minutes'); } }, 500);
  connectAccount().catch(() => setSyncState('error'));
}
/* Retour sur la page depuis l'historique : on rafraîchit */
window.addEventListener('pageshow', (e) => { if (!e.persisted) return; refreshAgendaDB(); scheduleRender(); if (Host.sb && Store.uid) syncNow(); });
/* Accès pour le banc d'essai automatisé (aucune donnée réelle) */
window.__QR = { Store, Content, Player, Sync, UI, prefs, put, dueReviews, buildSession, scheduleAfter, refreshMilestones, progressOf, verseChunks, searchSuras, versesOfPage, pageOfVerse, surahState, milestoneCount, stopAudio, setToday: (iso) => { _todayOverride = iso; scheduleRender(); }, renderAll };
boot();

})();
