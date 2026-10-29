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
/* Compte : celui de l'agenda s'il est configuré sur cet appareil ; sinon le projet officiel de StayClean
   (adresse et clé publique, les mêmes que la page publique dispo.html). La session est commune à l'agenda
   (même clé de stockage « sb-<projet>-auth-token ») : se connecter ici ou dans l'agenda revient au même. */
const QR_ACCOUNT = { url: 'https://rgfanwbyzsfjlhwwhudg.supabase.co', key: 'sb_publishable_WHb6CLrjubW_GxRGdKbPWA_B6SnRFNU' };
function hostSyncConf() {
  const db = readAgendaDB(); const s = (db && db.settings && db.settings.sync) || {};
  const url = typeof s.url === 'string' ? s.url.trim().replace(/\/+$/, '') : ''; const key = typeof s.anonKey === 'string' ? s.anonKey.trim() : '';
  if (/^https?:\/\/[^/]+$/i.test(url) && key.length > 20) return { url, key, from: 'agenda' };
  return { url: QR_ACCOUNT.url, key: QR_ACCOUNT.key, from: 'default' };
}
function hostConfigured() { const c = hostSyncConf(); return /^https?:\/\/[^/]+$/i.test(c.url) && c.key.length > 20; }
function hostRef() { try { return new URL(hostSyncConf().url).hostname.split('.')[0]; } catch (e) { return ''; } }
function initHost() {
  if (Host.sb) return Host.sb;
  if (!hostConfigured() || !window.supabase || typeof window.supabase.createClient !== 'function') return null;
  const c = hostSyncConf();
  try { Host.sb = window.supabase.createClient(c.url, c.key); } catch (e) { Host.sb = null; }
  return Host.sb;
}
/* La bibliothèque Supabase n'a pas pu se charger (appli ouverte hors connexion) : on la recharge au retour du réseau */
function ensureSupabaseLib() {
  if (window.supabase && typeof window.supabase.createClient === 'function') return Promise.resolve(true);
  if (Host.libP) return Host.libP;
  const tag = document.querySelector('script[src*="@supabase/supabase-js"]'); if (!tag) return Promise.resolve(false);
  Host.libP = new Promise((res) => {
    const s = document.createElement('script'); s.src = tag.src; if (tag.integrity) s.integrity = tag.integrity; s.crossOrigin = 'anonymous';
    s.onload = () => { Host.libP = null; res(!!(window.supabase && window.supabase.createClient)); };
    s.onerror = () => { Host.libP = null; s.remove(); res(false); };
    document.head.appendChild(s);
  });
  return Host.libP;
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
  if (error.code && ['network', 'not_installed', 'outdated', 'session_expired', 'signed_out', 'forbidden', 'too_large', 'rate_limited', 'unavailable'].includes(error.code)) return error;
  const msg = String(error.message || error.error || ''); const code = String(error.code || ''); const st = Number(error.status || error.statusCode || 0);
  if (isNetErr(error) || (!st && !code && /fetch/i.test(msg))) return { code: 'network' };
  if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /does not exist|could not find the (table|function)|schema cache/i.test(msg)) return { code: 'not_installed', detail: msg };
  // table installée avec une version plus ancienne du code d'installation (natures de l'arabe pas encore acceptées)
  if (code === '23514' || /violates check constraint/i.test(msg)) return { code: 'outdated', detail: msg };
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
  const shown = isNum(opts.shown) ? opts.shown : Infinity; const w0 = opts.w0 || 0; let w = 0;
  const parts = tokens.map((t) => {
    if (SIGN_TOKEN.test(t)) return `<span class="w w--sign${w > shown ? ' is-hidden' : ''}">${esc(t)}</span>`;
    const i = w; w++;
    const hidden = w > shown;
    return `<span class="w${hidden ? ' is-hidden' : ''}" data-w="${w0 + i}"${hidden ? ' aria-hidden="true"' : ''}>${esc(t)}</span>`;
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
/* Verset affiché : un <span> par mot (data-w) pour le suivi coloré ; un mot n'est jamais coupé, les liaisons restent intactes */
function arWithEnd(text, a) { return arHTML(String(text).split(' '), { end: a }); }
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
  reciter: 'luhaidan',
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
  remindFreq: 'weekly',       // rappel facultatif : weekly | daily
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
  for (const k of KINDS) if (k !== 'prefs' && k !== 'pos' && !Store.mem[k]) Store.mem[k] = new Map();
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

/* ===== Synchronisation avec le compte (table Supabase qr_items) =====
   Chaque élément (kind, id) est envoyé tel quel. À la réception, le plus récent gagne, sauf pour les natures qui
   savent se fusionner (MERGE) : la progression d'une sourate et les étapes de « Lire et écrire l'arabe ». Pour
   elles, rien de ce qui a été fait sur un appareil ne disparaît parce qu'un autre appareil a écrit après lui. */
const Sync = { state: 'connecting', since: null, pulling: null, pushing: null, timer: null, pushTimer: null, lastOk: 0, refreshTried: false, error: null, blocked: new Set() };
/* state : local (compte injoignable) | signedout | connecting | synced | pending | offline | not_installed | outdated | error */
const MERGE = {};   // kind → (local, remote, luLocal, luRemote) => version fusionnée
/* Comparaison stable (l'ordre des clés ne compte pas) */
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
const sameData = (a, b) => canon(a || {}) === canon(b || {});
function dirtyCount() { let n = 0; Store.items.forEach((it) => { if (it.dirty) n++; }); return n; }
function setSyncState(st, err) { Sync.state = st; Sync.error = err || null; scheduleRender(); }
const settledState = () => (Sync.blocked.size ? 'outdated' : dirtyCount() ? 'pending' : 'synced');
function overlapISO(since) { const t = Date.parse(since); return Number.isFinite(t) ? new Date(t - 120000).toISOString() : since; }
/* Une ligne reçue du compte, comparée à ce que l'appareil a déjà */
function receiveRow(r) {
  const k = itemKey(r.kind, r.id); const local = Store.items.get(k);
  const remoteLu = (r.data && Number(r.data._lu)) || 0;
  const rdata = r.deleted ? {} : Object.assign({}, r.data); delete rdata._lu;
  const merge = MERGE[r.kind];
  if (merge && local && !local.deleted && !r.deleted) {
    if (!local.dirty && local.lu === remoteLu && sameData(local.data, rdata)) return false;   // notre propre envoi qui revient
    let m = null; try { m = merge(clone(local.data), clone(rdata), local.lu || 0, remoteLu); } catch (e) { console.error('fusion', r.kind, e); }
    if (m) {
      let it;
      if (sameData(m, rdata)) it = { kind: r.kind, id: r.id, data: rdata, deleted: false, dirty: false, lu: remoteLu };   // le compte a déjà tout
      else if (local.dirty && sameData(m, local.data)) return false;                                                      // l'appareil a déjà tout : il partira au prochain envoi
      else it = { kind: r.kind, id: r.id, data: m, deleted: false, dirty: true, lu: Math.max(Date.now(), remoteLu + 1, (local.lu || 0) + 1) };   // du nouveau des deux côtés
      const changed = !sameData(it.data, local.data);
      Store.items.set(k, it); if (changed) applyToMem(r.kind, r.id, it.data, false);
      idbPut('items', idbItemKey(r.kind, r.id), it).catch(() => {});
      return changed;
    }
  }
  if (local && local.dirty && local.lu >= remoteLu) return false; // la version de l'appareil est plus récente : elle partira au prochain envoi
  if (local && !local.dirty && local.lu === remoteLu && !!local.deleted === !!r.deleted) return false;
  const it = { kind: r.kind, id: r.id, data: rdata, deleted: !!r.deleted, dirty: false, lu: remoteLu };
  Store.items.set(k, it); applyToMem(r.kind, r.id, rdata, !!r.deleted);
  idbPut('items', idbItemKey(r.kind, r.id), it).catch(() => {});
  return true;
}
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
        if (receiveRow(r)) changed = true;
      }
      idbPut('kv', Store.owner + '|since', Sync.since).catch(() => {});
      Sync.lastOk = Date.now(); Sync.refreshTried = false; Host.online = true;
      setSyncState(settledState());
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
/* Envoi nature par nature : si le compte refuse une nature (installation ancienne), les autres partent quand même */
async function pushNow() {
  if (!Host.sb || !Store.uid || ['not_installed', 'signedout', 'local'].includes(Sync.state)) return;
  if (Sync.pushing) { schedulePush(); return Sync.pushing; }
  const dirty = []; Store.items.forEach((it) => { if (it.dirty && !Sync.blocked.has(it.kind)) dirty.push(it); });
  if (!dirty.length) { if (Sync.state === 'pending' || Sync.state === 'connecting') setSyncState(settledState()); return; }
  if (navigator.onLine === false) { setSyncState('offline'); return; }
  Sync.pushing = (async () => {
    try {
      const byKind = new Map();
      for (const it of dirty) { if (!byKind.has(it.kind)) byKind.set(it.kind, []); byKind.get(it.kind).push(it); }
      for (const [kind, list] of byKind) {
        for (let i = 0; i < list.length; i += 200) {
          const batch = list.slice(i, i + 200);
          const rows = batch.map((it) => ({ user_id: Store.uid, kind: it.kind, id: it.id, data: it.deleted ? { _lu: it.lu } : Object.assign({}, it.data, { _lu: it.lu }), deleted: !!it.deleted }));
          const { error } = await Host.sb.from(QR_TABLE).upsert(rows, { onConflict: 'user_id,kind,id' });
          if (error) { const err = sbErr(error, 'unavailable'); if (err.code === 'outdated') { Sync.blocked.add(kind); break; } throw err; }
          for (const it of batch) {
            const cur = Store.items.get(itemKey(it.kind, it.id));
            if (cur && cur.lu === it.lu) { cur.dirty = false; idbPut('items', idbItemKey(it.kind, it.id), cur).catch(() => {}); }
          }
        }
      }
      Host.online = true; Sync.lastOk = Date.now();
      setSyncState(settledState());
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
    case 'pending': return { tone: 'ok', text: 'Enregistré sur cet appareil, envoi vers ton compte en cours.' };
    case 'offline': { const n = dirtyCount(); return { tone: 'warn', text: n ? `Hors connexion : ${n} ${plural(n, 'changement enregistré', 'changements enregistrés')} sur cet appareil, ${plural(n, 'envoyé', 'envoyés')} dès le retour du réseau.` : 'Hors connexion : tout est enregistré sur cet appareil ; la synchronisation reprend au retour du réseau.' }; }
    case 'not_installed': return { tone: 'warn', text: 'Ta progression reste sur cet appareil : la sauvegarde en ligne n’est pas encore activée sur ton compte (une étape, une seule fois).' };
    case 'outdated': return { tone: 'warn', text: 'Ta progression en arabe reste sur cet appareil : la sauvegarde en ligne doit être mise à jour (une étape, une seule fois). Le reste est sauvegardé sur ton compte.' };
    case 'signedout': return { tone: 'warn', text: 'Ta progression reste sur cet appareil. Connecte-toi pour la retrouver sur tes autres appareils.' };
    case 'error': return { tone: 'warn', text: 'L’envoi vers ton compte a échoué. Tout reste enregistré sur cet appareil ; nouvel essai automatique.' };
    case 'connecting': return { tone: 'ok', text: 'Connexion à ton compte…' };
    default: return { tone: 'warn', text: 'Ta progression reste sur cet appareil : le compte est injoignable pour l’instant (réseau). Nouvel essai au retour de la connexion.' };
  }
}
/* Bandeau en haut de Mémoriser, de l'arabe et de Mes progrès, tant que la progression ne suit pas sur tes autres appareils */
const BANNER = {
  signedout: { t: 'Ta progression reste sur cet appareil', s: 'Connecte-toi avec le compte de ton agenda : tu retrouves tout sur ton téléphone et ton Mac.', b: 'Me connecter', ic: 'user-check', a: 'data-act="sheet" data-sheet="account"' },
  not_installed: { t: 'Ta progression reste sur cet appareil', s: 'La sauvegarde en ligne n’est pas encore activée sur ton compte : une étape, une seule fois.', b: 'L’activer', ic: 'cloud', a: 'data-act="sheet" data-sheet="sync-install"' },
  outdated: { t: 'Ta progression en arabe reste sur cet appareil', s: 'La sauvegarde en ligne doit être mise à jour : une étape, une seule fois.', b: 'Mettre à jour', ic: 'cloud', a: 'data-act="sheet" data-sheet="sync-install"' },
  error: { t: 'L’envoi vers ton compte a échoué', s: 'Tout reste enregistré sur cet appareil ; nouvel essai automatique.', b: 'Réessayer', ic: 'refresh', a: 'data-act="sync-retry"' },
  local: { t: 'Ta progression reste sur cet appareil', s: 'Le compte est injoignable pour l’instant (réseau).', b: 'Réessayer', ic: 'refresh', a: 'data-act="sync-retry"' },
};
function syncBanner() {
  const B0 = BANNER[Sync.state]; if (!B0) return '';
  return `<section class="sync-banner" data-anchor="sync">
      <span class="sync-banner__ic" aria-hidden="true">${icon('smartphone')}</span>
      <p class="sync-banner__t"><b>${esc(B0.t)}</b><small>${esc(B0.s)}</small></p>
      <button type="button" class="btn btn--primary btn--sm sync-banner__b" ${B0.a}>${icon(B0.ic, 'sm')}${esc(B0.b)}</button>
    </section>`;
}

/* ===== Audio : un seul lecteur pour toute l'appli =====
   Récitations humaines identifiées. Jamais de lecture sans geste de ta part, jamais deux sons à la fois :
   tout passe par un seul élément <audio> et « stop » coupe tout. Le nom affiché est toujours celui de
   l'enregistrement réellement joué ; si un récitateur n'a pas ce qu'il faut, on le dit (aucun remplacement).

   Deux sortes d'enregistrements :
   - « verset » (EveryAyah) : un fichier par verset ; repères mot à mot quran-align (CC BY 4.0) quand ils existent ;
   - « sourate » (MP3Quran) : un fichier par sourate ; un verset se joue entre ses repères de début et de fin.
   Le suivi coloré lit toujours la position réelle de l'audio (currentTime) : pause, reprise, déplacement,
   répétition et vitesse restent justes. Aucune minuterie indépendante, aucun repère emprunté à une autre voix. */
const RECITERS = {
  luhaidan: { id: 'luhaidan', name: 'Mohamed Al-Luhaidan', ar: 'محمد اللحيدان', style: 'murattal', kind: 'surah', base: 'https://cdn.mp3quran.net/audio/muhammad-luhaidan/r1/', src: 'MP3Quran', sync: 'computed' },
  dossari: { id: 'dossari', name: 'Yasser Al-Dossari', ar: 'ياسر الدوسري', style: 'murattal', kind: 'surah', base: 'https://cdn.mp3quran.net/audio/yasser-dosari/r1/', src: 'MP3Quran', sync: 'mp3quran', read: 92 },
  husary_muallim: { id: 'husary_muallim', name: 'Mahmoud Khalil Al-Husary', ar: 'محمود خليل الحصري', style: 'pédagogique (muʿallim)', kind: 'ayah', folder: 'Husary_Muallim_128kbps', src: 'EveryAyah', sync: 'words' },
  husary: { id: 'husary', name: 'Mahmoud Khalil Al-Husary', ar: 'محمود خليل الحصري', style: 'murattal', kind: 'ayah', folder: 'Husary_64kbps', src: 'EveryAyah', sync: 'words' },
  minshawi: { id: 'minshawi', name: 'Mohamed Siddiq Al-Minshawi', ar: 'محمد صديق المنشاوي', style: 'murattal', kind: 'ayah', folder: 'Minshawy_Murattal_128kbps', src: 'EveryAyah', sync: 'words' },
  alafasy: { id: 'alafasy', name: 'Mishary Rashid Alafasy', ar: 'مشاري راشد العفاسي', style: 'murattal', kind: 'ayah', folder: 'Alafasy_128kbps', src: 'EveryAyah', sync: 'words' },
};
const RECITER_ORDER = ['luhaidan', 'dossari', 'husary_muallim', 'husary', 'minshawi', 'alafasy'];
const EVERYAYAH = 'https://everyayah.com/data/';
const TIMING_V = '20261027d';
/* Al-Luhaidan est la voix principale : un choix fait avant cette version (sans « reciterV2 ») n'est plus repris ;
   tout choix fait ensuite dans les réglages est respecté (et suit le compte d'un appareil à l'autre). */
function reciterId() { const P = prefs(); const r = P.reciterV2 ? P.reciter : 'luhaidan'; return RECITERS[r] ? r : 'luhaidan'; }
const reciter = () => RECITERS[reciterId()];
const audioKey = (folder, s, a) => folder + '/' + pad3(s) + pad3(a);   // copie locale d'un verset (EveryAyah)
const surahKey = (rid, s) => rid + '/' + pad3(s);                      // copie locale d'une sourate entière
function ayahUrl(folder, s, a) { return EVERYAYAH + folder + '/' + pad3(s) + pad3(a) + '.mp3'; }
function surahUrl(R, s) { return R.base + pad3(s) + '.mp3'; }
const RATES = [1, 0.75, 1.25];
function playRate() { const r = Number(prefs().rate); return RATES.includes(r) ? r : 1; }

/* --- Repères temporels --- */
const Timing = { words: new Map(), wordsFail: new Map(), computed: null, computedTry: 0, verses: new Map(), sizeCheck: new Map() };
async function wordTimings(folder, s) {
  const k = folder + '/' + s;
  if (Timing.words.has(k)) return Timing.words.get(k);
  if (Timing.wordsFail.get(k) > Date.now() - 60000) return null;
  try {
    const d = await fetchJSON(`coran/data/timing/${folder}/${pad3(s)}.json?v=${TIMING_V}`);
    const meta = suraMeta(s);
    if (!d || d.s !== s || d.f !== folder || !Array.isArray(d.v) || d.v.length !== meta.ayas) throw new ContentError('invalid');
    Timing.words.set(k, d.v); return d.v;
  } catch (e) { Timing.wordsFail.set(k, Date.now()); return null; }
}
async function computedTimings() {
  if (Timing.computed) return Timing.computed;
  if (Timing.computedTry > Date.now() - 60000) return null;
  Timing.computedTry = Date.now();
  try { const d = await fetchJSON(`coran/data/timing/luhaidan.json?v=${TIMING_V}`); if (d && d.format === 1 && d.s) Timing.computed = d; } catch (e) { /* hors ligne */ }
  return Timing.computed;
}
/* Repères par verset d'une sourate (récitateurs « sourate ») : null si absents */
async function surahTimings(R, s) {
  const k = R.id + ':' + s;
  if (Timing.verses.has(k)) return Timing.verses.get(k);
  const meta = suraMeta(s); let tm = null;
  if (R.sync === 'computed') {
    const d = await computedTimings(); const e = d && d.s[String(s)];
    if (e && e.ok && Array.isArray(e.v) && e.v.length === meta.ayas) {
      // u : limites non confirmées (k = entre les versets k et k+1) — ces versets ne sont jamais présentés comme séparés
      const u = Array.isArray(e.u) ? e.u.filter((k) => Number.isInteger(k) && k >= 1 && k < meta.ayas) : [];
      tm = { verses: e.v, intro: e.intro || null, bytes: e.bytes || null, src: 'computed', u };
    }
  } else if (R.sync === 'mp3quran') {
    const ck = 'timing|' + R.id + '|' + s;
    let arr = await idbGet('kv', ck).catch(() => null);
    if (!Array.isArray(arr)) {
      try {
        const j = await fetchJSON(`https://www.mp3quran.net/api/v3/ayat_timing?surah=${s}&read=${R.read}`);
        if (Array.isArray(j)) { arr = j.filter((x) => x && x.ayah >= 1).sort((a, b) => a.ayah - b.ayah).map((x) => [Number(x.start_time), Number(x.end_time)]); idbPut('kv', ck, arr).catch(() => {}); }
      } catch (e) { arr = null; }
    }
    if (Array.isArray(arr) && arr.length === meta.ayas && arr.every((v, i) => v[0] < v[1] && (i === 0 || v[0] >= arr[i - 1][0]))) tm = { verses: arr, intro: null, src: 'mp3quran' };
  }
  if (tm) Timing.verses.set(k, tm);
  return tm;
}
/* Les repères calculés valent pour UN fichier précis : on vérifie sa taille avant de s'en servir */
async function timingFileOk(R, s, tm) {
  if (!tm || !tm.bytes) return true;
  const k = R.id + ':' + s;
  if (Timing.sizeCheck.has(k)) return Timing.sizeCheck.get(k);
  let size = null;
  try { const b = await idbGet('audio', surahKey(R.id, s)); if (b instanceof Blob) size = b.size; } catch (e) { /* rien */ }
  if (size == null) { try { const r = await fetch(surahUrl(R, s), { method: 'HEAD' }); if (r.ok) size = Number(r.headers.get('content-length')) || null; } catch (e) { /* hors ligne */ } }
  const ok = size == null ? true : size === tm.bytes;
  Timing.sizeCheck.set(k, ok);
  return ok;
}
/* Ce que le suivi coloré peut faire pour ce récitateur et cette sourate */
function syncInfo(rid, s) {
  const R = RECITERS[rid] || reciter();
  if (R.sync === 'words') return { level: 'mot', label: 'Suivi mot à mot', detail: 'Repères mot à mot quran-align (CC BY 4.0) pour ces fichiers EveryAyah.' };
  if (R.sync === 'mp3quran') return { level: 'verset', label: 'Suivi par verset', detail: 'Repères de versets publiés par MP3Quran pour cet enregistrement. Pas de repères mot à mot publiés.' };
  const d = Timing.computed; const e = d && s ? d.s[String(s)] : null;
  if (!d) return { level: '?', label: 'Suivi par verset', detail: 'Repères de versets calculés pour cet enregistrement (contrôlés).' };
  if (e && e.ok) {
    const nu = Array.isArray(e.u) ? e.u.length : 0;
    return { level: 'verset', label: 'Suivi par verset', detail: `Repères de versets calculés pour ce fichier précis et contrôlés.${nu ? ` ${nu} limite${nu > 1 ? 's' : ''} entre versets non confirmée${nu > 1 ? 's' : ''} : ces versets sont surlignés ensemble.` : ''} Aucun repère mot à mot n’existe pour cette voix.` };
  }
  return { level: 'aucun', label: 'Sans suivi', detail: 'Pas encore de repères de versets pour cette sourate avec cette voix : lecture de la sourate entière seulement.' };
}

/* --- Lecteur --- */
const Player = {
  el: null, token: 0, state: 'idle', cur: null, run: null, label: '', ctx: null, cycle: 0, cycles: 0, phase: '',
  gap: null, objUrls: new Map(), error: null, listeners: new Set(), pending: null, noted: new Set(),
};
function playerEl() {
  if (Player.el) return Player.el;
  const el = new Audio(); el.preload = 'auto'; el.setAttribute('playsinline', '');
  try { el.preservesPitch = true; el.webkitPreservesPitch = true; } catch (e) { /* rien */ }
  Player.el = el; return el;
}
function playerNotify() { Player.listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
function setPlayer(patch) { Object.assign(Player, patch); playerNotify(); }
function revokeObjUrls(keep) { Player.objUrls.forEach((u, k) => { if (k !== keep) { URL.revokeObjectURL(u); Player.objUrls.delete(k); } }); }
/* Arrêt immédiat : coupe le son, le silence en cours et toute boucle */
function stopAudio() {
  Player.token++;
  if (Player.pending) { const f = Player.pending; Player.pending = null; f(true, null); }
  const el = Player.el;
  if (el) { try { el.pause(); } catch (e) { /* rien */ } }
  if (Player.gap) { clearTimeout(Player.gap.t); const r = Player.gap.resolve; Player.gap = null; r && r(false); }
  Follow.suspended = false;
  setPlayer({ state: 'idle', cur: null, run: null, ctx: null, phase: '', cycle: 0, cycles: 0, error: null });
  followClear();
}
/* Regroupe les pistes : avec un récitateur « sourate », des versets qui se suivent forment un seul passage continu */
function buildRuns(tracks, merge) {
  const R0 = reciter(); const runs = [];
  for (const t of tracks) {
    if (t.blob) { runs.push({ kind: 'own', tracks: [t], s: t.s, a1: t.a1 || t.a, a2: t.a2 || t.a }); continue; }
    const R = t.rid && RECITERS[t.rid] ? RECITERS[t.rid] : R0;
    if (R.kind === 'ayah') { runs.push({ kind: 'ayah', R, tracks: [t], s: t.intro ? t.forS : t.s, a1: t.a, a2: t.a, intro: !!t.intro }); continue; }
    const last = runs[runs.length - 1];
    if (t.intro) { runs.push({ kind: 'surah', R, tracks: [], s: t.forS, a1: 1, a2: 0, withIntro: true }); continue; }
    if (merge && last && last.kind === 'surah' && last.R === R && last.s === t.s && (last.a2 === t.a - 1 || (last.withIntro && last.a2 === 0 && t.a === 1))) { last.a2 = t.a; last.tracks.push(t); continue; }
    runs.push({ kind: 'surah', R, tracks: [t], s: t.s, a1: t.a, a2: t.a });
  }
  return runs;
}
/* Source et bornes d'un passage */
async function runSource(run) {
  if (run.kind === 'own') {
    const t = run.tracks[0]; const key = 'own:' + (t.recId || 'x');
    let url = Player.objUrls.get(key); if (!url) { url = URL.createObjectURL(t.blob); Player.objUrls.set(key, url); }
    return { url, local: true, from: 0, to: null };
  }
  if (run.kind === 'ayah') {
    const R = run.R; const t = run.tracks[0]; const s = t.s; const a = t.a;
    run.words = (await wordTimings(R.folder, s) || [])[a - 1] || null;
    const key = audioKey(R.folder, s, a);
    let url = Player.objUrls.get(key);
    if (!url) {
      try { const b = await idbGet('audio', key); if (b instanceof Blob && b.size) { url = URL.createObjectURL(b); revokeObjUrls(); Player.objUrls.set(key, url); } } catch (e) { /* pas de copie locale */ }
    }
    return { url: url || ayahUrl(R.folder, s, a), local: !!url, from: 0, to: null };
  }
  // sourate entière
  const R = run.R; const s = run.s; const meta = suraMeta(s);
  const tm = await surahTimings(R, s);
  const okFile = tm ? await timingFileOk(R, s, tm) : false;
  const key = surahKey(R.id, s);
  let url = Player.objUrls.get(key);
  if (!url) { try { const b = await idbGet('audio', key); if (b instanceof Blob && b.size) { url = URL.createObjectURL(b); revokeObjUrls(); Player.objUrls.set(key, url); } } catch (e) { /* rien */ } }
  const src = { url: url || surahUrl(R, s), local: !!url };
  if (!tm || !okFile) {
    // sans repères : seule la sourate entière, du début, peut être jouée honnêtement
    if (run.a1 === 1 && run.a2 >= meta.ayas) { run.verses = null; return Object.assign(src, { from: 0, to: null, untimed: true }); }
    throw { code: !tm ? 'notiming' : 'filechanged' };
  }
  run.verses = tm.verses; run.intro = tm.intro; run.u = tm.u && tm.u.length ? tm.u : null;
  if (run.a2 < run.a1) {
    // basmala seule : jouée si l'enregistrement la contient et qu'elle est repérée, sinon passée
    if (!tm.intro) return Object.assign(src, { skip: true });
    return Object.assign(src, { from: tm.intro[0] / 1000, to: (tm.intro[1] + 180) / 1000 });
  }
  const v1 = tm.verses[run.a1 - 1]; const v2 = tm.verses[run.a2 - 1];
  const from = run.withIntro && tm.intro ? tm.intro[0] : (tm.src === 'computed' ? Math.max(0, v1[0] - 150) : v1[0]);
  const isLast = run.a2 >= meta.ayas;
  const to = isLast ? null : (tm.src === 'computed' ? v2[1] + 180 : v2[1]);
  return Object.assign(src, { from: from / 1000, to: to == null ? null : to / 1000 });
}
/* Versets séparés par une limite non confirmée : surlignés et annoncés ensemble, dans les bornes du passage */
function groupAround(run, a) {
  const u = run && run.u; if (!u || !a) return [a, a];
  let g1 = a; let g2 = a;
  while (g1 > run.a1 && u.includes(g1 - 1)) g1--;
  while (g2 < run.a2 && u.includes(g2)) g2++;
  return [g1, g2];
}
function verseAtTime(run, ms) {
  const v = run.verses; if (!v) return null;
  if (run.withIntro && run.intro && ms < v[0][0] - 60) return 0;
  let a = run.a1;
  for (let i = run.a1 - 1; i < run.a2; i++) { if (ms >= v[i][0] - 60) a = i + 1; else break; }
  return a;
}
function waitMeta(el, token) {
  return new Promise((resolve) => {
    if (el.readyState >= 1) { resolve(true); return; }
    const done = (ok) => { el.removeEventListener('loadedmetadata', onOk); el.removeEventListener('error', onErr); resolve(ok && token === Player.token); };
    const onOk = () => done(true); const onErr = () => done(false);
    el.addEventListener('loadedmetadata', onOk); el.addEventListener('error', onErr);
  });
}
/* Joue un passage jusqu'au bout. Renvoie la durée réellement jouée (ms, temps réel), ou null s'il a été arrêté. */
function playRun(run, token, hooks) {
  hooks = hooks || {};
  return new Promise((resolve, reject) => {
    (async () => {
      const el = playerEl();
      let src;
      try { src = await runSource(run); } catch (e) { reject(e); return; }
      if (token !== Player.token) { resolve(null); return; }
      if (src.skip) { resolve(0); return; }
      let settled = false; let started = 0; let timer = 0; let curA = null;
      const firstA = run.kind === 'own' ? null : run.a1;
      const cleanup = () => { el.onended = null; el.onerror = null; el.onplaying = null; el.ontimeupdate = null; el.onratechange = null; el.onseeked = null; el.onpause = null; clearTimeout(timer); };
      const finish = (ok, v) => {
        if (settled) return; settled = true; cleanup();
        if (Player.pending === finish) Player.pending = null;
        if (ok) resolve(v); else reject(v);
      };
      Player.pending = finish;
      const elapsed = () => (started ? performance.now() - started : 0);
      const verseChanged = (a) => {
        if (a === curA) return;
        const prev = curA; curA = a;
        if (prev && prev > 0 && hooks.onTrackEnd) hooks.onTrackEnd({ s: run.s, a: prev });
        Player.cur = Object.assign({}, Player.cur, { s: run.s, a: a || run.a1, intro: a === 0 });
        mediaSessionMeta(Player.cur); playerNotify();
      };
      const check = () => {
        if (settled || token !== Player.token) return;
        const t = el.currentTime;
        if (run.kind === 'surah' && run.verses) { const a = verseAtTime(run, t * 1000); if (a != null) verseChanged(a); }
        if (src.to != null && t >= src.to - 0.015) {
          el.pause();
          if (run.kind === 'surah' && curA && hooks.onTrackEnd) hooks.onTrackEnd({ s: run.s, a: curA });
          finish(true, elapsed()); return;
        }
        arm();
      };
      const arm = () => {
        clearTimeout(timer);
        if (src.to == null || el.paused) return;
        const ms = (src.to - el.currentTime) * 1000 / (el.playbackRate || 1);
        timer = setTimeout(check, clamp(ms - 10, 5, 400));
      };
      el.ontimeupdate = check;
      el.onseeked = () => { check(); followNow(); };
      el.onratechange = () => { arm(); followNow(); };
      el.onpause = () => followNow();
      el.onplaying = () => { if (!started) started = performance.now(); if (token === Player.token && Player.state !== 'playing') setPlayer({ state: 'playing' }); arm(); followStart(); };
      el.onended = () => {
        if (run.kind === 'surah' && curA && hooks.onTrackEnd) hooks.onTrackEnd({ s: run.s, a: curA });
        else if (run.kind === 'ayah' && !run.intro && hooks.onTrackEnd) hooks.onTrackEnd(run.tracks[0]);
        finish(true, elapsed());
      };
      el.onerror = () => {
        if (token !== Player.token) { finish(true, null); return; }
        finish(false, { code: src.local ? 'local' : (navigator.onLine === false ? 'offline' : 'network') });
      };
      Player.run = run;
      setPlayer({ state: 'loading', cur: { s: run.s, a: firstA, intro: !!run.intro || (run.withIntro && run.kind === 'surah'), own: run.kind === 'own' }, error: null });
      mediaSessionMeta(Player.cur);
      if (el.src !== src.url) { el.src = src.url; }
      if (!(await waitMeta(el, token))) { if (token !== Player.token) finish(true, null); else finish(false, { code: src.local ? 'local' : (navigator.onLine === false ? 'offline' : 'network') }); return; }
      if (token !== Player.token) { finish(true, null); return; }
      if (Math.abs(el.currentTime - src.from) > 0.12) { try { el.currentTime = src.from; } catch (e) { /* rien */ } }
      el.playbackRate = run.kind === 'own' ? 1 : playRate();
      try { el.preservesPitch = true; } catch (e) { /* rien */ }
      if (run.kind === 'surah' && run.verses) verseChanged(verseAtTime(run, src.from * 1000 + 80));
      try { await el.play(); }
      catch (e) {
        if (settled) return;
        if (token !== Player.token || (e && e.name === 'AbortError')) { finish(true, null); return; }
        finish(false, { code: e && e.name === 'NotAllowedError' ? 'blocked' : (src.local ? 'local' : navigator.onLine === false ? 'offline' : 'network') });
      }
    })().catch((e) => reject(e && e.code ? e : { code: 'network', detail: String(e) }));
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
function setRate(r) {
  if (!RATES.includes(r)) return;
  setPrefs({ rate: r });
  if (Player.el && Player.run && Player.run.kind !== 'own') Player.el.playbackRate = r;
}
function audioErrorText(e) {
  const c = e && e.code; const R = reciter();
  if (c === 'offline') return 'Pas de réseau : la récitation ne peut pas être chargée. Télécharge la sourate pour l’écouter hors connexion.';
  if (c === 'blocked') return 'Le téléphone a bloqué le son : touche à nouveau « Écouter ».';
  if (c === 'local') return 'Le fichier audio enregistré sur ce téléphone est illisible. Supprime le téléchargement et recommence.';
  if (c === 'notiming') return `Pas encore de repères de versets pour cette sourate avec ${R.name} : on ne peut pas isoler un verset. Écoute la sourate entière dans le lecteur, ou choisis une autre voix dans les réglages.`;
  if (c === 'filechanged') return `Le fichier audio de ${R.name} a changé sur le serveur : ses repères ne correspondent plus, ils sont désactivés pour cette sourate.`;
  return 'La récitation n’a pas pu être chargée (réseau ou serveur audio). Réessaie dans un instant.';
}

/* Séquence : joue des pistes, éventuellement en boucle, avec un silence après chaque passage.
   opts : { cycles, gap: 'auto'|ms, gapAfterLast, gapEach (ms entre versets), ctx, onPhase(phase, info), onTrackEnd(track) } */
const FALLBACK_RID = 'husary';
/* Voix « sourate » : un verset ne peut être isolé que si ses deux limites sont confirmées dans ce fichier.
   Sans repères vérifiés pour la sourate, ou pour un passage dont une borne n'est pas confirmée, les versets
   concernés sont lus par une voix verset par verset, et c'est annoncé ; le nom affiché reste toujours celui
   de la voix réellement entendue. La sourate entière, depuis le début, reste possible. */
async function planVoices(tracks, merge) {
  const R = reciter(); if (R.kind !== 'surah') return tracks;
  const bySura = new Map();
  tracks.forEach((t, i) => { if (t.blob || t.rid) return; const s = t.intro ? t.forS : t.s; if (!bySura.has(s)) bySura.set(s, []); bySura.get(s).push(i); });
  const swap = new Set(); const F = RECITERS[FALLBACK_RID];
  const note = (key, msg) => { if (!Player.noted.has(key)) { Player.noted.add(key); toast(msg); } };
  for (const [s, idx] of bySura) {
    const tm = await surahTimings(R, s); const ok = tm && await timingFileOk(R, s, tm);
    const N = suraMeta(s).ayas;
    if (!ok) {
      const as = idx.map((i) => tracks[i]).filter((t) => !t.intro).map((t) => t.a);
      const whole = merge && as.length === N && as.every((a, i) => a === i + 1);
      if (!whole) { idx.forEach((i) => swap.add(i)); note(R.id + s, `${R.name} : pas de repères de versets vérifiés pour ${suraTitle(s)}. Ces versets sont lus par ${F.name} ; le nom affiché suit la voix entendue.`); }
      continue;
    }
    const u = tm.u || []; if (!u.length) continue;
    // passages tels que la lecture les formera (versets qui se suivent réunis si merge)
    const runs = []; let cur = null;
    for (const i of idx) {
      const t = tracks[i];
      if (t.intro) { cur = { a1: 1, a2: 0, idx: [], last: i }; runs.push(cur); continue; }
      if (merge && cur && cur.last === i - 1 && cur.a2 === t.a - 1) { cur.a2 = t.a; cur.idx.push(i); cur.last = i; continue; }
      cur = { a1: t.a, a2: t.a, idx: [i], last: i }; runs.push(cur);
    }
    const bad = new Set();
    for (const r of runs) {
      if (!r.idx.length) continue;
      if (r.a1 > 1 && u.includes(r.a1 - 1)) { let a = r.a1; do { bad.add(a); a++; } while (a <= r.a2 && u.includes(a - 1)); }
      if (r.a2 < N && u.includes(r.a2)) { let a = r.a2; do { bad.add(a); a--; } while (a >= r.a1 && u.includes(a)); }
      r.idx.forEach((i) => { if (bad.has(tracks[i].a)) swap.add(i); });
    }
    if (bad.size) {
      const list = [...bad].sort((x, y) => x - y);
      note(R.id + s + ':' + list.join(','), `${R.name}, ${suraTitle(s)} : la limite ${list.length > 1 ? `des versets ${list.join(', ')}` : `du verset ${list[0]}`} n’est pas assez sûre dans cet enregistrement pour l’isoler. ${list.length > 1 ? 'Ils sont lus' : 'Il est lu'} par ${F.name} ; le nom affiché suit la voix entendue.`);
    }
  }
  if (!swap.size) return tracks;
  return tracks.map((t, i) => (swap.has(i) ? Object.assign({}, t, { rid: FALLBACK_RID }) : t));
}
async function runSequence(tracks, opts = {}) {
  stopAudio();
  const token = Player.token;
  const cycles = opts.cycles === Infinity ? Infinity : Math.max(1, opts.cycles || 1);
  const merge = !(opts.gapEach > 0);
  try { tracks = await planVoices(tracks, merge); } catch (e) { /* les repères seront revérifiés à la lecture */ }
  if (token !== Player.token) return false;
  const runs = buildRuns(tracks, merge);
  setPlayer({ ctx: opts.ctx || null, cycles, cycle: 0, label: opts.label || '' });
  try {
    for (let c = 1; c <= cycles; c++) {
      setPlayer({ cycle: c });
      let played = 0;
      for (let i = 0; i < runs.length; i++) {
        const run = runs[i];
        setPlayer({ phase: 'play' });
        opts.onPhase && opts.onPhase('play', { cycle: c, run, index: i });
        const ms = await playRun(run, token, { onTrackEnd: opts.onTrackEnd });
        if (ms == null || token !== Player.token) return false;
        played += ms;
        const between = opts.gapEach ? opts.gapEach : 0;
        if (between > 0 && i < runs.length - 1) {
          setPlayer({ state: 'gap', phase: 'between' });
          if (!(await waitGap(between, token))) return false;
        }
      }
      const hasNext = c < cycles;
      if (opts.gap && (hasNext || opts.gapAfterLast)) {
        const g = opts.gap === 'auto' || typeof opts.gap === 'string' ? gapFor(played, opts.gap === 'auto' ? null : opts.gap) : opts.gap;
        setPlayer({ state: 'gap', phase: 'gap', gapMs: g, gapStart: performance.now() });
        followClear();
        opts.onPhase && opts.onPhase('gap', { cycle: c, ms: g });
        if (!(await waitGap(g, token))) return false;
      }
    }
    if (token === Player.token) { setPlayer({ state: 'idle', cur: null, run: null, phase: 'done' }); followClear(); }
    opts.onPhase && opts.onPhase('done', {});
    return true;
  } catch (e) {
    if (token !== Player.token) return false;
    setPlayer({ state: 'error', error: e, phase: '' }); followClear();
    opts.onPhase && opts.onPhase('error', { error: e });
    return false;
  }
}
function mediaSessionMeta(t) {
  if (!('mediaSession' in navigator) || !t || typeof MediaMetadata === 'undefined') return;
  try {
    const m = suraMeta(t.s);
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.own ? 'Mon enregistrement' : t.intro ? `${m ? m.name : ''} · basmala` : `${m ? m.name : 'Sourate ' + t.s} · verset ${t.a}`, artist: t.own ? 'Moi' : ((Player.run && Player.run.R) || reciter()).name, album: 'Mon Coran' });
  } catch (e) { /* facultatif */ }
}

/* ===== Suivi coloré du texte =====
   Le verset actif reçoit un fond menthe discret, le mot récité un fond arrondi plus marqué (sans changer la
   taille ni la position des lettres). Calculé à chaque image depuis la position réelle de l'audio. */
const Follow = { raf: 0, vk: null, wk: null, suspended: false, autoAt: 0, lastW: null };
function reducedMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
function followStart() { cancelAnimationFrame(Follow.raf); const tick = () => { followNow(); if (Player.state === 'playing' || Player.state === 'loading') Follow.raf = requestAnimationFrame(tick); }; Follow.raf = requestAnimationFrame(tick); }
function followClear() { cancelAnimationFrame(Follow.raf); applyHighlight(null, null); Follow.lastW = null; }
function wordAt(words, ms) {
  if (!words || !words.length) return null;
  let lo = 0; let hi = words.length - 1; let k = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (words[mid][2] <= ms + 40) { k = mid; lo = mid + 1; } else hi = mid - 1; }
  if (k < 0) return null;
  const g = words[k];
  // entre deux mots : on garde le dernier mot prononcé (pas de clignotement), sauf longue pause
  if (ms > g[3] + 700) return null;
  return [g[0], g[1]];
}
function followNow() {
  const run = Player.run; const el = Player.el;
  if (!run || !el || !Player.cur || Player.state === 'idle' || Player.state === 'gap' || run.kind === 'own') { if (Player.state !== 'paused') applyHighlight(null, null); return; }
  const ms = el.currentTime * 1000;
  if (run.kind === 'ayah') {
    if (run.intro) { applyHighlight('b:' + run.s, null); return; }
    applyHighlight(run.s + ':' + run.a1, wordAt(run.words, ms));
    return;
  }
  if (!run.verses) { applyHighlight(null, null); return; }
  const a = verseAtTime(run, ms);
  if (a === 0) { applyHighlight('b:' + run.s, null); return; }
  const [g1, g2] = groupAround(run, a);
  applyHighlight(g1 === g2 ? run.s + ':' + a : `${run.s}:${g1}-${g2}`, null);
}
/* Clé de surlignage : un verset (« 2:5 »), la basmala (« b:2 ») ou des versets regroupés (« 2:5-6 ») */
function vkList(vk) {
  const m = /^(\d+):(\d+)-(\d+)$/.exec(vk || ''); if (!m) return vk ? [vk] : [];
  const out = []; for (let a = Number(m[2]); a <= Number(m[3]); a++) out.push(m[1] + ':' + a);
  return out;
}
const isActiveKey = (key) => Reader.activeKey != null && vkList(Reader.activeKey).includes(key);
function applyHighlight(vk, w) {
  if (vk !== Follow.vk) {
    $$('[data-vk].is-active').forEach((n) => n.classList.remove('is-active'));
    const keys = vkList(vk);
    keys.forEach((k) => $$(`[data-vk="${k}"]`).forEach((n) => n.classList.add('is-active')));
    Follow.vk = vk; Reader.activeKey = vk;
    if (keys.length && !w) followScroll($(`.page [data-vk="${keys[0]}"]`), true);
  }
  const wk = vk && w ? vk + '#' + w[0] + '-' + w[1] : null;
  if (wk !== Follow.wk) {
    $$('.w.is-now').forEach((n) => n.classList.remove('is-now'));
    let first = null;
    if (wk) {
      $$(`[data-vk="${vk}"]`).forEach((box) => {
        for (let i = w[0]; i < w[1]; i++) { const n = box.querySelector(`.w[data-w="${i}"]`); if (n) { n.classList.add('is-now'); if (!first && n.closest('.page')) first = n; } }
      });
    }
    Follow.wk = wk;
    if (first) followScroll(first, false);
  }
}
/* Défilement doux seulement quand le passage actif approche du bord (jamais à chaque mot),
   et jamais contre ton geste : si tu fais défiler toi-même, le suivi automatique se met en pause. */
function followScroll(node, isVerse) {
  if (!node || Follow.suspended) return;
  const sc = node.closest('.page'); if (!sc) return;
  const H = sc.clientHeight; const r = node.getBoundingClientRect(); const top0 = sc.getBoundingClientRect().top;
  const y = r.top - top0; const yb = r.bottom - top0;
  const topLimit = 96; const bottomLimit = H - (document.body.classList.contains('has-player') ? 150 : 90);
  if (isVerse ? (y >= topLimit && y < bottomLimit - 60) : (y >= topLimit && yb <= bottomLimit)) return;
  const target = sc.scrollTop + y - Math.max(topLimit + 8, H * 0.3);
  Follow.autoAt = performance.now();
  sc.scrollTo({ top: Math.max(0, target), behavior: reducedMotion() ? 'auto' : 'smooth' });
}
function followUserScrolled() {
  if (Follow.suspended) return;
  if (!(Player.state === 'playing' || Player.state === 'paused' || Player.state === 'gap')) return;
  if (!Player.run || Player.run.kind === 'own') return;
  Follow.suspended = true; renderPlayerBar(); playerNotify();
}
function followResume() {
  Follow.suspended = false;
  const n = $('.page .w.is-now') || (Follow.vk ? $(`.page [data-vk="${vkList(Follow.vk)[0]}"]`) : null);
  if (n) {
    const sc = n.closest('.page');
    if (sc) { const r = n.getBoundingClientRect(); const top0 = sc.getBoundingClientRect().top; Follow.autoAt = performance.now(); sc.scrollTo({ top: Math.max(0, sc.scrollTop + r.top - top0 - sc.clientHeight * 0.3), behavior: reducedMotion() ? 'auto' : 'smooth' }); }
  }
  renderPlayerBar(); playerNotify();
}
function followWire() {
  const onGesture = (e) => {
    if (!e.target || !e.target.closest || !e.target.closest('.page')) return;
    if (e.type === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
    if (e.type === 'keydown' && e.key === ' ' && /^(BUTTON|INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    followUserScrolled();
  };
  document.addEventListener('wheel', onGesture, { passive: true, capture: true });
  document.addEventListener('touchmove', onGesture, { passive: true, capture: true });
  document.addEventListener('keydown', onGesture, true);
}

/* --- Téléchargement explicite d'une sourate (pour l'écouter hors connexion) --- */
const Downloads = { running: null };
async function downloadSura(s, onProgress) {
  const R = reciter(); const meta = suraMeta(s);
  const ctl = { cancel: false };
  if (R.kind === 'surah') {
    Downloads.running = { s, ctl, done: 0, total: 1 };
    try {
      const key = surahKey(R.id, s);
      const have = await idbGet('audio', key).catch(() => null);
      if (have instanceof Blob && have.size) { onProgress && onProgress(1, 1, have.size); return { ok: true, bytes: have.size }; }
      let r;
      try { r = await fetch(surahUrl(R, s), { mode: 'cors' }); } catch (e) { throw { code: navigator.onLine === false ? 'offline' : 'network' }; }
      if (!r.ok) throw { code: 'network' };
      const b = await r.blob();
      if (!b.size) throw { code: 'network' };
      try { await idbPut('audio', key, b); } catch (e) { throw { code: 'storage' }; }
      Timing.sizeCheck.delete(R.id + ':' + s);
      onProgress && onProgress(1, 1, b.size);
      return { ok: true, bytes: b.size };
    } finally { Downloads.running = null; }
  }
  const folder = R.folder; const n = meta.ayas;
  Downloads.running = { s, ctl, done: 0, total: n };
  let bytes = 0;
  try {
    for (let a = 1; a <= n; a++) {
      if (ctl.cancel) throw { code: 'cancelled' };
      const key = audioKey(folder, s, a);
      const have = await idbGet('audio', key).catch(() => null);
      if (!(have instanceof Blob && have.size)) {
        let r;
        try { r = await fetch(ayahUrl(folder, s, a), { mode: 'cors' }); } catch (e) { throw { code: navigator.onLine === false ? 'offline' : 'network' }; }
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
async function deleteSuraAudio(s, folderOrRid) {
  const R = RECITERS[folderOrRid];
  const prefix = R ? (R.kind === 'surah' ? surahKey(R.id, s) : R.folder + '/' + pad3(s)) : folderOrRid + '/' + pad3(s);
  const keys = await idbKeys('audio', prefix).catch(() => []);
  for (const k of keys) await idbDel('audio', k).catch(() => {});
  revokeObjUrls();
  return keys.length;
}
async function audioInventory() {
  const keys = await idbKeys('audio').catch(() => []);
  const by = new Map();
  for (const k of keys) {
    let m = /^([^/]+)\/(\d{3})(\d{3})$/.exec(k);
    if (m) { const id = m[1] + '/' + +m[2]; by.set(id, (by.get(id) || 0) + 1); continue; }
    m = /^([^/]+)\/(\d{3})$/.exec(k);
    if (m) { const id = m[1] + '/' + +m[2]; by.set(id, (by.get(id) || 0) + 1); }
  }
  return Array.from(by.entries()).map(([id, count]) => { const [folder, s] = id.split('/'); return { folder, s: +s, count }; });
}
function reciterOfFolder(folder) { return Object.values(RECITERS).find((r) => r.folder === folder || r.id === folder) || null; }

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
function learningPath() { return defaultPath(); }

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
/* Union de deux tables { clé: date } : on garde chaque clé, avec sa date la plus ancienne */
function mergeDates(x, y) { const o = Object.assign({}, x || {}); for (const [k, d] of Object.entries(y || {})) if (d && (!o[k] || String(d) < String(o[k]))) o[k] = d; return o; }
/* Une même sourate sur deux appareils (téléphone et Mac) : tout ce qui a été fait d'un côté ou de l'autre est gardé
   (versets écoutés, travaillés, récités sans aide, jalons). Pour le statut que tu as déclaré (Pas encore, J'apprends,
   Je connais), ton choix le plus récent compte ; une version qui n'a jamais reçu de statut n'efface pas celui de
   l'autre. Le reste (où reprendre la séance guidée, niveau, mention de l'enseignant) vient de la version la plus récente. */
const ST_KEYS = ['kv', 'lr', 'kvAt', 'stAt', 'self'];
const hasStatus = (p) => Array.isArray(p.kv) || Array.isArray(p.lr) || !!p.self;
MERGE.progress = (a, b, la, lb) => {
  const ta = String(a.lastAt || ''); const tb = String(b.lastAt || '');
  const newer = ta > tb || (ta === tb && la > lb) ? a : b;
  const out = clone(newer);
  const sa = Number(a.stAt) || 0; const sb = Number(b.stAt) || 0;
  let src;
  if (sa !== sb) src = sa > sb ? a : b;
  else if (hasStatus(a) !== hasStatus(b)) src = hasStatus(a) ? a : b;
  else if (String(a.kvAt || '') !== String(b.kvAt || '')) src = String(a.kvAt || '') > String(b.kvAt || '') ? a : b;
  else src = newer;
  for (const k of ST_KEYS) { if (src[k] === undefined) delete out[k]; else out[k] = clone(src[k]); }
  for (const k of ['listened', 'worked', 'solo']) out[k] = uniqSorted([...(a[k] || []), ...(b[k] || [])]);
  for (const k of ['chunkSolo', 'chunkWorked']) {
    const o = {};
    for (const x of [a[k] || {}, b[k] || {}]) for (const [v, cs] of Object.entries(x)) o[v] = uniqSorted([...(o[v] || []), ...(Array.isArray(cs) ? cs : [])]);
    out[k] = o;
  }
  out.m = mergeDates(a.m, b.m);
  out.startedAt = [a.startedAt, b.startedAt].filter(Boolean).sort()[0] || null;
  return out;
};
function markListened(s, a) {
  const p = progressOf(s);
  if (p.listened.includes(a)) return;
  p.listened = uniqSorted(p.listened.concat([a]));
  if (!p.startedAt && Store.mem.progress.has('s' + s)) p.startedAt = todayISO();
  return saveProgress(p);
}

/* État d'une sourate : d'après ce que tu as marqué (voir « Mémoriser »), jamais d'après un simple geste */
function surahState(s) { return unitStat(suraParts(s)).st; }
/* « Je la connais » : sourate entière marquée connue (par la sourate, ses groupes, ou « à 100 % » avec une version précédente) */
function selfKnown(s) {
  if (!suraKnown(s)) return null;
  const p = Store.mem.progress.get('s' + s) || {};
  return p.self || { date: p.kvAt || todayISO(), pct: 100 };
}
const isLearned = (p) => !!(p && p.s && suraKnown(p.s));
async function setSelfKnown(s, on) {
  await setStatus(suraParts(s), on ? 'known' : 'none');
  if (on && prefs().current === s) await setPrefs({ current: null });
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
  const cur = prefs().current;
  if (cur && cur >= 1 && cur <= 114 && !suraKnown(cur)) return cur;
  const w = Groups.d ? whereAmI() : null;
  if (w && w.u) return firstToLearn(w.u.parts)[0];
  for (const n of learningPath()) { if (!suraKnown(n)) return n; }
  return cur || 1;
}
/* Ordre des sourates du parcours (Al-Fatiha, juz 30 des plus courtes aux plus longues, puis juz 29 à 1) */
function pathSuras() {
  if (!Groups.d) return learningPath();
  const out = []; for (const u of pathUnits()) for (const [n] of learnOrder(u.parts)) if (!out.includes(n)) out.push(n);
  return out;
}
function nextInPath(after) {
  const path = pathSuras(); const i = path.indexOf(after);
  for (let k = i + 1; k < path.length; k++) { if (!suraKnown(path[k])) return path[k]; }
  for (const n of path) { if (n !== after && !suraKnown(n)) return n; }
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
const TABS = ['learn', 'read', 'arabe', 'progress'];
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
/* Remplace le contenu d'un onglet seulement s'il a changé, en gardant sous les yeux le même élément repère
   ([data-anchor]) : une mise à jour (audio, synchro, enregistrement) ne fait plus bouger la liste. */
const LastHTML = new WeakMap();
function swapHTML(root, html) {
  if (!root) return false;
  if (LastHTML.get(root) === html && root.firstChild) return false;
  let anchor = null;
  if (!root.hidden && root.firstChild) {
    for (const el of root.querySelectorAll('[data-anchor]')) {
      const r = el.getBoundingClientRect();
      if (r.bottom > 72) { anchor = { id: el.dataset.anchor, top: r.top }; break; }
    }
  }
  const y = window.scrollY;
  root.innerHTML = html; LastHTML.set(root, html);
  const el = anchor ? root.querySelector(`[data-anchor="${anchor.id}"]`) : null;
  if (el) { const d = el.getBoundingClientRect().top - anchor.top; if (Math.abs(d) > 1) window.scrollTo(0, window.scrollY + d); }
  else if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  return true;
}
/* Onglet, recherche et filtre de la liste : gardés pendant la session (même après un rechargement) */
function saveUIState() { try { sessionStorage.setItem('qr.ui', JSON.stringify({ tab: UI.tab, q: UI.q, seg: UI.readSeg })); } catch (e) { /* facultatif */ } }
function loadUIState() {
  try {
    const v = JSON.parse(sessionStorage.getItem('qr.ui') || 'null'); if (!v) return;
    if (TABS.includes(v.tab)) UI.tab = v.tab;
    if (typeof v.q === 'string') UI.q = v.q.slice(0, 60);
    if (['suras', 'juz', 'pages'].includes(v.seg)) UI.readSeg = v.seg;
  } catch (e) { /* rien */ }
}

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
  const sameKey = !!(existing && existing.dataset.key === top.key);
  if (!fresh && sameKey && typingIn(existing)) return;
  const P = PAGES[top.name];
  // Même écran, mêmes données : on ne recrée pas le DOM. Recréer la zone qui défile pendant un geste
  // (ou à chaque enregistrement de la position) faisait sauter la page, parfois jusqu'en haut.
  if (!fresh && sameKey && P.sig) {
    const sig = P.sig(top.props, top);
    if (sig != null && sig === top.sig) { if (P.refresh) { try { P.refresh(top.props, existing); } catch (e) { console.error(e); } } return; }
  }
  let html;
  try { html = P.render(top.props, top); } catch (e) { console.error(e); html = `${pageHead('Oups')}<p class="notice notice--warn">${icon('alert')}<span>Cet écran n’a pas pu s’afficher.</span></p>`; }
  if (html == null) { UI.pages.pop(); renderPage(true); return; }
  if (!fresh && sameKey && html === top.html) { top.sig = P.sig ? P.sig(top.props, top) : null; if (P.refresh) { try { P.refresh(top.props, existing); } catch (e) { console.error(e); } } return; }
  top.html = html;
  const scroll = sameKey ? existing.scrollTop : (fresh ? (top.scroll || 0) : 0);
  // même écran redessiné : on garde le même contenu sous les yeux (pas seulement la même position en pixels)
  const snap = sameKey && P.snapshot ? P.snapshot(existing, top.props) : null;
  root.innerHTML = `<div class="page page--${top.name}" data-key="${top.key}" role="region" aria-label="${esc(P.label ? P.label(top.props) : '')}"><div class="page__inner">${html}</div></div>`;
  const el = root.querySelector('.page');
  if (sameKey || (P.noAnim)) el.style.animation = 'none';
  el.scrollTop = scroll;
  if (snap && P.restore) { try { P.restore(el, snap, top.props); } catch (e) { /* position approximative */ } }
  if (P.after) { try { P.after(top.props, el, fresh && !sameKey); } catch (e) { console.error(e); } }
  top.sig = P.sig ? P.sig(top.props, top) : null;
  followRepaint();
}
/* Après un nouveau rendu, le mot et le verset en cours retrouvent leur couleur */
function followRepaint() { const vk = Follow.vk; const wk = Follow.wk; if (!vk && !wk) return; Follow.vk = null; Follow.wk = null; const susp = Follow.suspended; Follow.suspended = true; followNow(); Follow.suspended = susp; }
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
  for (const t of TABS) { const el = $('#tab-' + t); if (el) el.hidden = UI.tab !== t; }
  try {
    if (UI.tab === 'learn') renderLearn();
    else if (UI.tab === 'read') renderRead();
    else if (UI.tab === 'arabe') renderArabeTab();
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
    if (!Groups.d) return;
    const w = whereAmI(); const T = unitStat(allParts());
    const name = w && w.u ? (w.u.kind === 'sura' ? suraTitle(w.u.s) : `juz ${w.u.g.j}, groupe ${w.u.g.k}`) : '';
    localStorage.setItem('qr.summary.v1', JSON.stringify({ v: 2, uid: Store.uid, date: todayISO(), name, learning: !!(w && w.kind === 'learning'), done: !!(w && w.kind === 'done'), pct: T.kn ? pctTxt(T.pct) : '', at: Date.now() }));
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

/* ===== Mémoriser : juz par juz, groupe par groupe =====
   C'est toi qui dis ce que tu sais : « Pas encore », « J'apprends », « Je connais ». Rien ne change tout seul :
   ouvrir une sourate, écouter, lancer une séance ou y répondre ne modifie jamais un statut.
   Enregistré dans la progression de chaque sourate (kind « progress », id « sN ») : kv = versets connus,
   lr = versets en cours d'apprentissage, en plages [premier, dernier]. Une sourate validée « à 100 % » avec une
   version précédente compte comme connue, tant que tu n'as rien changé. Une récitation réussie en séance guidée
   ne marque rien d'office : l'appli te propose seulement de la marquer « Je connais ».
   Groupes : coran/data/groupes.json (8 par juz, calés sur les quarts de hizb ; coran/sources/build_groupes.py).
   Les pourcentages sont pondérés par le nombre de mots : un long verset compte plus qu'un court. */
const GROUPS_V = '20261028';
const Groups = { d: null, p: null, err: null, pre: null };
function loadGroups() {
  if (Groups.d) return Promise.resolve(Groups.d);
  if (!Groups.p) {
    Groups.p = fetchJSON('coran/data/groupes.json?v=' + GROUPS_V).then((d) => {
      if (!d || d.format !== 1 || !Array.isArray(d.groups) || d.groups.length !== 240 || !Array.isArray(d.juz) || d.juz.length !== 30 || !Array.isArray(d.path) || !d.vw) throw new ContentError('invalid', 'groupes');
      const pre = {};
      for (let s = 1; s <= 114; s++) { const a = d.vw[s] || []; const p = [0]; for (let i = 0; i < a.length; i++) p.push(p[i] + a[i]); pre[s] = p; }
      Groups.pre = pre; Groups.d = d; Groups.err = null; scheduleRender();
      return d;
    });
    Groups.p.catch((e) => { Groups.err = e; Groups.p = null; scheduleRender(); });
  }
  return Groups.p;
}
/* --- Plages de versets [premier, dernier], triées et fusionnées --- */
function rgNorm(rs) {
  const a = (Array.isArray(rs) ? rs : []).filter((r) => Array.isArray(r) && isNum(r[0]) && isNum(r[1]) && r[0] <= r[1]).map((r) => [r[0], r[1]]).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const r of a) { const l = out[out.length - 1]; if (l && r[0] <= l[1] + 1) l[1] = Math.max(l[1], r[1]); else out.push(r); }
  return out;
}
const rgAdd = (rs, a1, a2) => rgNorm((rs || []).concat([[a1, a2]]));
function rgSub(rs, a1, a2) {
  const out = [];
  for (const [x, y] of rgNorm(rs)) { if (y < a1 || x > a2) { out.push([x, y]); continue; } if (x < a1) out.push([x, a1 - 1]); if (y > a2) out.push([a2 + 1, y]); }
  return out;
}
function rgCount(rs, a1, a2) { let t = 0; for (const [x, y] of rs) { const lo = Math.max(x, a1); const hi = Math.min(y, a2); if (lo <= hi) t += hi - lo + 1; } return t; }
/* Mots des versets de rs compris entre a1 et a2 (nombre de versets si les groupes ne sont pas encore chargés) */
function rgWords(s, rs, a1, a2) {
  const pre = Groups.pre && Groups.pre[s]; if (!pre) return rgCount(rs, a1, a2);
  let t = 0; for (const [x, y] of rs) { const lo = Math.max(x, a1); const hi = Math.min(y, a2); if (lo <= hi) t += pre[hi] - pre[lo - 1]; }
  return t;
}
const ayasOf = (s) => { const m = suraMeta(s); return m ? m.ayas : 0; };
function knownRanges(s) {
  const p = Store.mem.progress.get('s' + s); if (!p) return [];
  if (Array.isArray(p.kv)) return rgNorm(p.kv);
  return p.self ? [[1, ayasOf(s)]] : [];   // « Je la connais à 100 % » d'une version précédente
}
function learningRanges(s) { const p = Store.mem.progress.get('s' + s); return p && Array.isArray(p.lr) ? rgNorm(p.lr) : []; }
function suraKnown(s) { const N = ayasOf(s); return N > 0 && rgCount(knownRanges(s), 1, N) === N; }
/* État d'un ensemble de versets (une sourate, un groupe, un juz, tout le Coran) */
function unitStat(parts) {
  let w = 0; let kw = 0; let n = 0; let kn = 0; let ln = 0;
  for (const [s, a1, a2] of parts) {
    const kr = knownRanges(s); const lr = learningRanges(s);
    n += a2 - a1 + 1; kn += rgCount(kr, a1, a2); ln += rgCount(lr, a1, a2);
    w += rgWords(s, [[a1, a2]], a1, a2); kw += rgWords(s, kr, a1, a2);
  }
  const pct = w ? kw / w : 0;
  const st = n && kn === n ? 'known' : ln ? 'learning' : kn ? 'partial' : 'none';
  return { w, kw, n, kn, ln, pct, st };
}
const suraParts = (s) => [[s, 1, ayasOf(s)]];
const allParts = () => Array.from({ length: 114 }, (_, i) => [i + 1, 1, ayasOf(i + 1)]);
function juzParts(n) { const d = Groups.d; return d ? d.juz[n - 1].g.flatMap((i) => d.groups[i].r) : []; }
/* Pourcentage affiché : jamais « 100 % » avant d'avoir tout, jamais « 0 % » quand il y a quelque chose */
const pctTxt = (x) => { const v = x * 100; return v > 0 && v < 1 ? '< 1' : String(Math.floor(v + 1e-9)); };
const ST = {
  none: { label: 'Pas encore', icon: 'circle' },
  learning: { label: 'J’apprends', icon: 'sprout' },
  partial: { label: 'En partie', icon: 'circle-half' },
  known: { label: 'Je connais', icon: 'check-circle' },
};
const stLabel = (t) => (t.st === 'partial' ? `${pctTxt(t.pct)} % connu` : ST[t.st].label);
const stChip = (t) => `<span class="mz-chip mz-chip--${t.st}">${icon(ST[t.st].icon, 'sm')}${esc(stLabel(t))}</span>`;
const mzBar = (pct, cls = '') => `<span class="mz-bar${cls ? ' mz-bar--' + cls : ''}" aria-hidden="true"><span style="width:${(clamp(pct, 0, 1) * 100).toFixed(1)}%"></span></span>`;
/* Changer un statut, seulement sur ton geste. « J'apprends » ne retire jamais des versets connus,
   sauf si tout l'ensemble était connu (on le remet alors en apprentissage). Renvoie de quoi annuler. */
async function setStatus(parts, st) {
  const before = new Map();
  for (const [s] of parts) if (!before.has(s)) before.set(s, Store.mem.progress.has('s' + s) ? clone(Store.mem.progress.get('s' + s)) : null);
  const allKnown = unitStat(parts).st === 'known'; const today = todayISO();
  const bySura = new Map();
  for (const [s, a1, a2] of parts) { if (!bySura.has(s)) bySura.set(s, []); bySura.get(s).push([a1, a2]); }
  for (const [s, rs] of bySura) {
    if (st === 'none' && !Store.mem.progress.has('s' + s)) continue;
    const p = progressOf(s); const N = ayasOf(s);
    let kv = knownRanges(s); let lr = learningRanges(s);
    for (const [a1, a2] of rs) {
      if (st === 'known') { kv = rgAdd(kv, a1, a2); lr = rgSub(lr, a1, a2); }
      else if (st === 'learning') {
        if (allKnown) { kv = rgSub(kv, a1, a2); lr = rgAdd(lr, a1, a2); }
        else { let add = [[a1, a2]]; for (const [x, y] of kv) add = add.flatMap((r) => rgSub([r], x, y)); for (const [u, v] of add) lr = rgAdd(lr, u, v); }
      } else { kv = rgSub(kv, a1, a2); lr = rgSub(lr, a1, a2); }
    }
    p.kv = kv; p.lr = lr; p.kvAt = today; p.stAt = Date.now();   // stAt : moment exact du choix (fusion entre appareils)
    const full = rgCount(kv, 1, N) === N;
    if (full && !p.self) p.self = { date: today, pct: 100 };
    if (!full && p.self) delete p.self;
    await saveProgress(p);
  }
  return before;
}
async function undoStatus(before) {
  // l'annulation est elle-même un choix : elle porte l'heure d'aujourd'hui, pour l'emporter aussi sur tes autres appareils
  for (const [s, data] of before) { if (data) await put('progress', 's' + s, Object.assign({}, data, { stAt: Date.now() })); else await del('progress', 's' + s); }
}
async function applyStatus(parts, st, name) {
  const before = await setStatus(parts, st);
  const t = unitStat(parts);
  renderAll();
  toast(`${name} : ${stLabel(t)}.`, false, { label: 'Annuler', fn: async () => { await undoStatus(before); renderAll(); toast('Changement annulé.'); } });
}
/* --- Le parcours conseillé : Al-Fatiha, puis le juz 30 des sourates les plus courtes aux plus longues
   (groupe 8 → 1), puis les juz 29 à 1, chacun du groupe 1 au groupe 8. Tout reste ouvert. --- */
function pathUnits() {
  const d = Groups.d; if (!d) return [];
  return d.path.map((x) => (x.t === 'sura' ? { kind: 'sura', s: x.s, parts: suraParts(x.s) } : { kind: 'group', i: x.i, g: d.groups[x.i], parts: d.groups[x.i].r }));
}
function whereAmI() {
  const units = pathUnits(); if (!units.length) return null;
  const stats = units.map((u) => unitStat(u.parts));
  const lk = stats.findIndex((t) => t.st === 'learning');
  if (lk >= 0) return { u: units[lk], t: stats[lk], kind: 'learning', others: stats.filter((t) => t.st === 'learning').length - 1 };
  const k = stats.findIndex((t) => t.st !== 'known');
  if (k < 0) return { kind: 'done' };
  return { u: units[k], t: stats[k], kind: stats[k].st === 'partial' ? 'partial' : 'next', others: 0 };
}
function partLabel([s, a1, a2]) { return a1 === 1 && a2 === ayasOf(s) ? suraTitle(s) : `${suraTitle(s)} ${a1}–${a2}`; }
function unitTitle(u) {
  if (u.kind === 'sura') return suraTitle(u.s);
  const r = u.parts;
  if (r.length === 1) return partLabel(r[0]);
  if (r.length === 2) return `${partLabel(r[0])} · ${partLabel(r[1])}`;
  return `${partLabel(r[0])} → ${partLabel(r[r.length - 1])}`;
}
function unitSub(u, t) {
  const bits = [];
  if (u.kind === 'group' && u.parts.length > 2) bits.push(`${u.parts.length} sourates`);
  bits.push(`${t.n} ${plural(t.n, 'verset', 'versets')}`);
  return bits.join(' · ');
}
const groupUnit = (i) => ({ kind: 'group', i, g: Groups.d.groups[i], parts: Groups.d.groups[i].r });
const juzOrder = (n) => Groups.d.path.filter((x) => x.t === 'g' && Groups.d.groups[x.i].j === n).map((x) => x.i);
const juzName = (n) => (n === 30 ? 'Juz ʿAmma' : '');
/* Ordre conseillé à l'intérieur d'un groupe pour la séance guidée : dans le juz 30, Al-Ikhlas, Al-Falaq, An-Nas,
   Al-Kawthar, Al-ʿAsr, Al-Kafirun d'abord, puis les plus courtes ; ailleurs, l'ordre du mushaf */
function learnOrder(parts) {
  const pri = (n) => { const i = DEFAULT_PATH_START.indexOf(n); return i >= 0 ? i : 99; };
  const w = (n) => (n >= 78 && suraMeta(n) ? suraMeta(n).words : 0);
  return parts.slice().sort((a, b) => (a[0] >= 78 && b[0] >= 78 ? pri(a[0]) - pri(b[0]) || w(a[0]) - w(b[0]) : 0) || a[0] - b[0] || a[1] - b[1]);
}
/* Première sourate à apprendre d'un ensemble (pour la séance guidée) */
function firstToLearn(parts) { for (const r of learnOrder(parts)) { const t = unitStat([r]); if (t.st !== 'known') return r; } return parts[0]; }
function groupsLoading(root) {
  loadGroups().catch(() => {});
  swapHTML(root, topbarMain() + (Groups.err ? `<div class="empty">${icon('alert', 'lg')}<p>Les groupes de mémorisation n’ont pas pu être chargés (réseau).</p><button type="button" class="btn btn--primary" data-act="mz-retry">Réessayer</button></div>` : '<div class="loading"><span class="spin"></span></div>'));
}
const METHOD = [
  ['Écoute', 'Écoute le groupe en suivant le texte. « Aa » change l’affichage : arabe, phonétique, français.'],
  ['Répète', 'Verset par verset : le casque propose un verset en boucle (3, 5 ou 10 fois) ou un groupe de versets.'],
  ['Récite sans regarder', 'Livre fermé, puis vérifie avec le texte. Reprends ce qui a coincé.'],
  ['Marque « Je connais »', 'Quand tu le récites sans erreur. Reviens le réciter de temps en temps pour le garder.'],
];
function methodHTML(open) {
  return `<details class="mz-method"${open ? ' open' : ''}><summary>${icon('lightbulb', 'sm')}<span>La méthode, étape par étape</span>${icon('chev-d', 'sm')}</summary>
      <ol class="mz-steps">${METHOD.map(([t, d], k) => `<li><span class="mz-steps__n">${k + 1}</span><span><b>${esc(t)}</b><small>${esc(d)}</small></span></li>`).join('')}</ol></details>`;
}
function nowCard(w) {
  if (!w) return '';
  if (w.kind === 'done') return `<section class="mz-now mz-now--known"><p class="mz-now__k">${icon('award', 'sm')}Où j’en suis</p><h2 class="mz-now__t">Tu as marqué tout le Coran comme connu</h2><p class="mz-now__p">Continue de le réciter pour le garder.</p></section>`;
  const u = w.u; const t = w.t;
  const k = w.kind === 'learning' ? 'Tu apprends' : w.kind === 'partial' ? 'Tu as commencé' : 'Prochaine étape';
  const kicker = u.kind === 'sura' ? 'Pour commencer' : `Juz ${u.g.j} · groupe ${u.g.k} sur 8${u.g.j === 30 && u.g.k === 8 ? ' · les sourates les plus courtes' : ''}`;
  const prog = t.kn ? `${t.kn} ${plural(t.kn, 'verset connu', 'versets connus')} sur ${t.n}` : t.ln ? 'Marqué « J’apprends »' : 'Rien de marqué connu pour l’instant';
  const open = u.kind === 'sura' ? `data-act="open-reader" data-s="${u.s}" data-a="1"` : `data-act="mz-group" data-i="${u.i}"`;
  return `<section class="mz-now mz-now--${t.st}" data-anchor="now">
      <p class="mz-now__k">${icon('target', 'sm')}Où j’en suis · ${esc(k)}</p>
      <div class="mz-now__row">${u.kind === 'sura' ? suraBadge(u.s) : `<span class="mz-jn" aria-hidden="true">${u.g.j}</span>`}
        <div><p class="mz-now__c">${esc(kicker)}</p><h2 class="mz-now__t">${esc(unitTitle(u))}</h2><p class="mz-now__s">${esc(unitSub(u, t))}</p></div></div>
      ${mzBar(t.pct)}<p class="mz-now__p">${esc(prog)}${w.others > 0 ? ` · et ${w.others} ${plural(w.others, 'autre groupe', 'autres groupes')} en cours` : ''}</p>
      <button type="button" class="btn btn--primary btn--xl" ${open}>${icon('book-open')}<span>${u.kind === 'sura' ? 'Étudier Al-Fatiha' : 'Étudier ce groupe'}</span></button>
      ${u.kind === 'sura' ? `<div class="mz-now__set">${seg3(t.st, `data-s="${u.s}"`, 'mz-set-sura')}</div>` : ''}
    </section>`;
}
function seg3(cur, attrs, act) {
  return `<div class="mz-seg" role="radiogroup" aria-label="Où tu en es">${['none', 'learning', 'known'].map((k) => `<button type="button" class="mz-seg__b mz-seg__b--${k}${cur === k ? ' is-on' : ''}" role="radio" aria-checked="${cur === k}" data-act="${act}" data-st="${k}" ${attrs}>${icon(ST[k].icon, 'sm')}<span>${esc(ST[k].label)}</span></button>`).join('')}</div>`;
}
/* Séance guidée (facultative) : écouter, répéter, réciter, relier, avec révisions espacées */
function guidedHTML() {
  const act = homeAction(); const due = dueReviews();
  let line;
  if (act.kind === 'resume') { const it = Store.session.items[Store.session.i]; line = it ? `Séance en cours : ${suraTitle(it.s)} · ${rangeLabel(it)}` : 'Séance en cours'; }
  else if (due.length) line = `${due.length} ${plural(due.length, 'révision prévue', 'révisions prévues')} par tes séances`;
  else { const nx = nextReviewDate(); line = `${nx ? `Prochaine révision de tes séances ${dayName(nx)} · ` : ''}sur ${suraTitle(currentSurah())}`; line = line.charAt(0).toUpperCase() + line.slice(1); }
  return `<section class="mz-guided" data-anchor="guided">
      <h2 class="sec-title">${icon('headphones', 'sm')}Séance guidée <small>facultatif</small></h2>
      <p class="fine">L’appli te guide : écouter, répéter, réciter sans regarder, relier. Elle ne change jamais tes statuts : c’est toi qui marques « Je connais ».</p>
      <button type="button" class="link-row" data-act="session-start">${icon(act.kind === 'resume' ? 'play' : due.length ? 'refresh' : 'play', 'sm')}<span>${esc(act.label)}<small class="link-row__sub">${esc(line)}</small></span>${icon('chev-r', 'sm')}</button>
    </section>`;
}

/* --- Onglet « Mémoriser » --- */
function renderLearn() {
  const root = $('#tab-learn');
  if (!Content.index) { swapHTML(root, topbarMain() + (Content.indexError ? bootError() : '<div class="loading"><span class="spin"></span></div>')); return; }
  if (!Groups.d) { groupsLoading(root); return; }
  const w = whereAmI(); const fat = unitStat(suraParts(1));
  const anyMarked = Content.index.suras.some((m) => { const p = Store.mem.progress.get('s' + m.n); return p && (Array.isArray(p.kv) || Array.isArray(p.lr) || p.self); });
  swapHTML(root, `${topbarMain()}
    <section class="hero mz-hero">
      <div class="hero__text"><h1 class="hero__title">Mémoriser le Coran</h1><p class="hero__note">Juz par juz, groupe par groupe. C’est toi qui dis ce que tu connais : rien ne change tout seul.</p></div>
      <img class="hero__art" src="coran/livre-sur-pupitre.webp" alt="" width="768" height="768" decoding="async">
    </section>
    ${syncBanner()}
    ${nowCard(w)}
    ${!Store.idbOk ? `<p class="notice notice--warn">${icon('alert')}<span>Ce navigateur n’enregistre pas ta progression (navigation privée ou stockage plein). Ouvre l’appli depuis son icône, ou exporte une sauvegarde dans les réglages.</span></p>` : ''}
    ${methodHTML(!anyMarked)}
    <h2 class="sec-title mz-h">${icon('route', 'sm')}Ton parcours, juz par juz</h2>
    <p class="fine">Ordre conseillé : Al-Fatiha, puis le juz 30 en commençant par les sourates les plus courtes, puis les juz 29, 28… jusqu’au juz 1. Tu peux ouvrir n’importe quel juz.</p>
    <ol class="mz-path">
      <li><div class="mz-row mz-row--fat"><button type="button" class="mz-row__main" data-act="open-reader" data-s="1" data-a="1">${suraBadge(1)}<span class="mz-row__t"><b>Al-Fatiha</b><small>7 versets · pour commencer</small></span></button>
        <button type="button" class="mz-chip mz-chip--${fat.st} mz-chip--btn" data-act="mz-cycle" data-s="1" data-a1="1" data-a2="7" aria-label="Al-Fatiha : ${esc(stLabel(fat))}. Toucher pour changer.">${icon(ST[fat.st].icon, 'sm')}${esc(stLabel(fat))}</button></div></li>
      ${Array.from({ length: 30 }, (_, k) => 30 - k).map((n) => {
        const t = unitStat(juzParts(n)); const gk = juzOrder(n).filter((i) => unitStat(Groups.d.groups[i].r).st === 'known').length;
        return `<li><button type="button" class="mz-row mz-row--${t.st}" data-act="mz-juz" data-j="${n}" data-anchor="j${n}">
            <span class="mz-jn${t.st === 'known' ? ' is-known' : ''}" aria-hidden="true">${n}</span>
            <span class="mz-row__t"><b>Juz ${n}${juzName(n) ? ` · ${juzName(n)}` : ''}</b><small>${t.kn ? `${esc(pctTxt(t.pct))} % · ${gk} ${plural(gk, 'groupe connu', 'groupes connus')} sur 8` : t.ln ? 'En cours' : '8 groupes'}</small>${t.kn ? mzBar(t.pct, 'sm') : ''}</span>
            ${t.st === 'learning' ? stChip(t) : ''}${icon('chev-r', 'sm')}</button></li>`;
      }).join('')}
    </ol>
    ${guidedHTML()}`);
}

/* --- Un juz : ses 8 groupes --- */
function groupCard(i) {
  const u = groupUnit(i); const t = unitStat(u.parts);
  return `<li><button type="button" class="mz-gcard mz-gcard--${t.st}" data-act="mz-group" data-i="${i}" data-anchor="g${i}">
      <span class="mz-gn" aria-hidden="true">${u.g.k}</span>
      <span class="mz-gcard__t"><small>Groupe ${u.g.k}</small><b>${esc(unitTitle(u))}</b><small>${esc(unitSub(u, t))}</small>${t.kn && t.st !== 'known' ? mzBar(t.pct, 'sm') : ''}</span>
      ${stChip(t)}</button></li>`;
}
PAGES['mz-juz'] = {
  label: (p) => 'Juz ' + p.j,
  render(p) {
    const n = clamp(Number(p.j) || 30, 1, 30);
    if (!Groups.d) { loadGroups().catch(() => {}); return pageHead('Juz ' + n) + '<div class="loading"><span class="spin"></span></div>'; }
    const J = Groups.d.juz[n - 1]; const t = unitStat(juzParts(n)); const order = juzOrder(n);
    const gk = order.filter((i) => unitStat(Groups.d.groups[i].r).st === 'known').length;
    return `${pageHead('Juz ' + n)}
      <header class="mz-jhead"><span class="mz-jn mz-jn--big" aria-hidden="true">${n}</span>
        <div><p class="mz-jhead__k">Juz ${n} sur 30${juzName(n) ? ` · ${juzName(n)}` : ''}</p>
          <p class="mz-jhead__ar" lang="ar" dir="rtl" translate="no">${esc(J.debut)}</p>
          <p class="mz-jhead__s">Ses premiers mots · ${esc(suraTitle(J.a[0]))} ${J.a[0]}:${J.a[1]}</p></div></header>
      <div class="mz-stat">${mzBar(t.pct)}<p>${t.kn ? `${esc(pctTxt(t.pct))} % connu · ` : ''}${gk} ${plural(gk, 'groupe connu', 'groupes connus')} sur 8${t.ln ? ' · en cours' : ''}</p></div>
      <p class="lede">${n === 30 ? 'Ordre conseillé : du groupe 8 (les sourates les plus courtes) au groupe 1.' : 'Ordre conseillé : du groupe 1 au groupe 8, dans l’ordre du mushaf.'} Un groupe fait environ deux pages et demie et suit les quarts de hizb (<span class="ar-inline" lang="ar">۞</span>).</p>
      <ol class="mz-groups">${order.map((i) => groupCard(i)).join('')}</ol>
      <button type="button" class="link-row" data-act="sheet" data-sheet="mz-bulk" data-j="${n}">${icon('layers', 'sm')}<span>Marquer tout le juz ${n}<small class="link-row__sub">Pas encore, J’apprends ou Je connais, pour les 8 groupes d’un coup</small></span>${icon('chev-r', 'sm')}</button>
      <button type="button" class="btn btn--ghost btn--block" data-act="open-juz" data-j="${n}">${icon('book-open', 'sm')}Lire le juz ${n} dans le lecteur</button>`;
  },
};
/* --- Un groupe : ce que tu en sais, l'étudier, ses sourates --- */
function partRow(r) {
  const [s, a1, a2] = r; const t = unitStat([r]); const whole = a1 === 1 && a2 === ayasOf(s);
  return `<li class="mz-part" data-anchor="p${s}-${a1}">
      <button type="button" class="mz-part__main" data-act="open-reader" data-s="${s}" data-a="${a1}">${suraBadge(s)}<span><b>${esc(suraTitle(s))}</b><small>${whole ? `${a2} ${plural(a2, 'verset', 'versets')}` : `versets ${a1} à ${a2}`}</small></span></button>
      <button type="button" class="mz-chip mz-chip--${t.st} mz-chip--btn" data-act="mz-cycle" data-s="${s}" data-a1="${a1}" data-a2="${a2}" aria-label="${esc(partLabel(r))} : ${esc(stLabel(t))}. Toucher pour changer.">${icon(ST[t.st].icon, 'sm')}${esc(stLabel(t))}</button>
    </li>`;
}
function pathNeighbours(i) {
  const gs = Groups.d.path.filter((x) => x.t === 'g').map((x) => x.i); const k = gs.indexOf(i);
  return { prev: k > 0 ? gs[k - 1] : null, next: k >= 0 && k < gs.length - 1 ? gs[k + 1] : null };
}
PAGES['mz-group'] = {
  label: () => 'Groupe',
  render(p) {
    if (!Groups.d) { loadGroups().catch(() => {}); return pageHead('Groupe') + '<div class="loading"><span class="spin"></span></div>'; }
    const i = Number(p.i); const g = Groups.d.groups[i]; if (!g) return null;
    const u = groupUnit(i); const t = unitStat(u.parts); const nb = pathNeighbours(i);
    const mine = t.st === 'known' ? 'Tout le groupe est marqué connu.' : t.st === 'partial' ? `${t.kn} ${plural(t.kn, 'verset connu', 'versets connus')} sur ${t.n} (${pctTxt(t.pct)} % du texte).` : t.st === 'learning' ? `Tu l’apprends${t.kn ? ` : ${t.kn} ${plural(t.kn, 'verset déjà connu', 'versets déjà connus')} sur ${t.n}` : ''}.` : 'Pas encore commencé.';
    const nbBtn = (x, lab, ic) => { const v = groupUnit(x); return `<button type="button" class="mz-pn__b" data-act="mz-group" data-i="${x}" data-replace="1">${ic === 'l' ? icon('chev-l', 'sm') : ''}<span><small>${lab}</small>Juz ${v.g.j} · groupe ${v.g.k}</span>${ic === 'r' ? icon('chev-r', 'sm') : ''}</button>`; };
    return `${pageHead(`Juz ${g.j} · groupe ${g.k}`)}
      <header class="mz-ghead"><span class="mz-gn mz-gn--big" aria-hidden="true">${g.k}</span>
        <div><p class="mz-ghead__k">Juz ${g.j} · groupe ${g.k} sur 8</p><h1 class="mz-ghead__t">${esc(unitTitle(u))}</h1><p class="mz-ghead__s">${esc(unitSub(u, t))} · ${g.w} mots</p></div></header>
      <section class="mz-mine" data-anchor="mine"><h2 class="sec-title">${icon('target', 'sm')}Ce groupe, pour toi</h2>
        ${seg3(t.st, `data-i="${i}"`, 'mz-set-group')}
        ${t.kn && t.st !== 'known' ? mzBar(t.pct) : ''}<p class="mz-mine__p">${esc(mine)}</p></section>
      <div class="mz-acts">
        <button type="button" class="btn btn--primary btn--block" data-act="open-reader" data-s="${g.r[0][0]}" data-a="${g.r[0][1]}">${icon('book-open', 'sm')}Étudier dans le lecteur</button>
        <button type="button" class="btn btn--soft btn--block" data-act="mz-guided" data-i="${i}">${icon('headphones', 'sm')}<span>Séance guidée${t.st === 'known' ? '' : ` · commence par ${esc(partLabel(firstToLearn(u.parts)))}`}</span></button>
      </div>
      <h2 class="sec-title">${icon('list', 'sm')}${g.r.length > 1 ? `Les ${g.r.length} sourates du groupe` : 'Le texte du groupe'}</h2>
      <p class="fine">Touche l’état pour le changer : Pas encore → J’apprends → Je connais.</p>
      <ul class="mz-parts">${g.r.map((r) => partRow(r)).join('')}</ul>
      ${methodHTML(false)}
      <nav class="mz-pn" aria-label="Groupes voisins dans le parcours">${nb.prev != null ? nbBtn(nb.prev, 'Groupe précédent', 'l') : '<span></span>'}${nb.next != null ? nbBtn(nb.next, 'Groupe suivant', 'r') : ''}</nav>`;
  },
};
SHEETS['mz-bulk'] = {
  render(p) {
    const n = Number(p.j);
    const opt = (st, lab, sub) => `<button type="button" class="opt" data-act="mz-bulk-go" data-j="${n}" data-st="${st}"><span class="opt__dot" aria-hidden="true">${icon(ST[st].icon, 'sm')}</span><span class="opt__t"><b>${esc(lab)}</b><small>${esc(sub)}</small></span></button>`;
    return { title: `Tout le juz ${n}`, body: `<p class="sub">Change d’un coup l’état des 8 groupes. Tu pourras annuler juste après.</p>
      <div class="opts">${opt('known', 'Je connais tout le juz', 'Les 8 groupes passent à « Je connais ».')}${opt('learning', 'J’apprends ce juz', 'Ce qui n’est pas encore connu passe à « J’apprends ».')}${opt('none', 'Pas encore', 'Tout le juz repart de zéro (connu et en cours effacés).')}</div>` };
  },
};

/* --- Lire : recherche, reprise, favoris, sourates / juz / pages --- */
function renderRead() {
  const root = $('#tab-read');
  if (!Content.index) { swapHTML(root, topbarMain() + (Content.indexError ? bootError() : '<div class="loading"><span class="spin"></span></div>')); return; }
  if (root.querySelector('#readSearch') && typingIn(root)) { paintReadList(); return; }
  const pos = Store.mem.pos;
  const favs = Array.from(Store.mem.fav.entries()).map(([id, f]) => Object.assign({ id }, f)).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const parts = readListParts();
  swapHTML(root, `${topbarMain()}
    <h1 class="screen-title">Lire le Coran</h1>
    <label class="search" for="readSearch">${icon('search')}<input id="readSearch" type="search" inputmode="search" autocomplete="off" placeholder="Nom, numéro ou verset (2:255)" value="${esc(UI.q)}" aria-label="Rechercher une sourate, un verset, une page ou un juz"></label>
    <div id="readJump">${parts.jump}</div>
    ${pos && pos.s ? `<button type="button" class="resume" data-act="open-reader" data-s="${pos.s}" data-a="${pos.a || 1}" data-mode="${esc(pos.mode || 'verse')}">
        <span class="resume__k">${icon('bookmark-check', 'sm')}Reprendre la lecture</span>
        <span class="resume__t">${esc(suraTitle(pos.s))} · ${pos.mode === 'page' && pos.page ? `page ${pos.page}` : `verset ${pos.a || 1}`}</span>
        ${icon('chev-r')}</button>` : ''}
    ${favs.length ? `<section class="favs" aria-label="Favoris">
        <h2 class="sec-title">${icon('bookmark', 'sm')}Favoris</h2>
        <ul class="fav-list">${favs.map((f) => `<li><button type="button" class="fav" data-act="open-reader" data-s="${f.s}" data-a="${f.a}" data-anchor="f${esc(f.id)}">
            <span class="fav__ref">${esc(suraTitle(f.s))} · ${f.a}</span>${f.label ? `<span class="fav__label">${esc(f.label)}</span>` : ''}</button>
            <button type="button" class="icon-btn icon-btn--sm" data-act="fav-edit" data-id="${esc(f.id)}" aria-label="Modifier ce favori">${icon('pencil', 'sm')}</button></li>`).join('')}</ul>
      </section>` : ''}
    <div class="seg" role="tablist" aria-label="Parcourir par">
      ${[['suras', 'Sourates'], ['juz', 'Juz'], ['pages', 'Pages']].map(([k, l]) => `<button type="button" role="tab" class="seg__b${UI.readSeg === k ? ' is-on' : ''}" aria-selected="${UI.readSeg === k}" data-act="read-seg" data-seg="${k}">${l}</button>`).join('')}
    </div>
    <div id="readList">${parts.list}</div>`);
}
function paintReadList() {
  const list = $('#readList'); const jumpEl = $('#readJump'); if (!list) return;
  const parts = readListParts();
  if (jumpEl) swapHTML(jumpEl, parts.jump);
  swapHTML(list, parts.list);
}
function readListParts() {
  const idx = Content.index; const res = searchSuras(UI.q); const out = { jump: '', list: '' };
  {
    const j = res.jump;
    out.jump = !j ? '' : j.type === 'invalid' ? `<p class="notice notice--warn">${icon('info')}<span>${esc(j.text)}</span></p>`
      : `<button type="button" class="jump" data-act="${j.type === 'verse' ? 'open-reader' : j.type === 'page' ? 'open-page-mode' : 'open-juz'}" data-s="${j.s || ''}" data-a="${j.a || ''}" data-p="${j.p || ''}" data-j="${j.j || ''}">
          ${icon('arrow-r')}<span>${j.type === 'verse' ? `Aller au verset ${j.s}:${j.a} — ${esc(suraTitle(j.s))}` : j.type === 'page' ? `Ouvrir la page ${j.p} du Coran` : `Ouvrir le juz ${j.j}`}</span></button>`;
  }
  if (UI.q.trim() || UI.readSeg === 'suras') {
    const rows = res.suras;
    out.list = rows.length ? `<ul class="slist">${rows.map((m) => suraRow(m)).join('')}</ul>` : (res.jump ? '' : `<p class="empty-line">Aucune sourate ne correspond. Essaie un numéro (1 à 114) ou un nom comme « Ikhlas ».</p>`);
    return out;
  }
  if (UI.readSeg === 'juz') {
    out.list = `<button type="button" class="info-card" data-act="sheet" data-sheet="juzamma">${icon('info')}<span><b>Juz Amma</b> : la dernière des 30 parties, 37 sourates courtes pour la plupart.</span>${icon('chev-r', 'sm')}</button>
      <ul class="slist">${idx.juz.map((j) => `<li><button type="button" class="srow" data-act="open-juz" data-j="${j.n}" data-anchor="j${j.n}">
        <span class="snum snum--plain" aria-hidden="true"><b>${j.n}</b></span>
        <span class="srow__main"><span class="srow__name">Juz ${j.n}${j.n === 30 ? ' · Juz Amma' : ''}</span><span class="srow__sub">Commence à ${esc(suraTitle(j.s))}, verset ${j.a}</span></span>
        ${icon('chev-r', 'sm')}</button></li>`).join('')}</ul>`;
    return out;
  }
  // pages : accès direct + débuts de sourates
  out.list = `<form class="page-go" data-form="page-go">
      <label for="pageGo">Aller à la page</label>
      <div class="page-go__row"><input id="pageGo" type="number" inputmode="numeric" min="1" max="604" placeholder="1 à 604"><button type="submit" class="btn btn--primary">Ouvrir</button></div>
      <p class="muted tiny">Pages du Mushaf de Médine (604 pages) : chaque page contient exactement les mêmes versets que la page imprimée.</p>
    </form>
    <ul class="slist">${idx.suras.map((m) => `<li><button type="button" class="srow" data-act="open-page-mode" data-p="${m.p1}" data-anchor="p${m.n}">
      ${suraBadge(m.n)}<span class="srow__main"><span class="srow__name">${esc(m.name)}</span><span class="srow__sub">Page ${m.p1}${m.p2 !== m.p1 ? ` à ${m.p2}` : ''}</span></span>
      <span class="srow__ar" lang="ar" dir="rtl" translate="no">${esc(m.ar)}</span></button></li>`).join('')}</ul>`;
  return out;
}
function suraRow(m) {
  const t = unitStat(suraParts(m.n));
  return `<li><button type="button" class="srow" data-act="open-reader" data-s="${m.n}" data-anchor="s${m.n}">
      ${suraBadge(m.n)}
      <span class="srow__main"><span class="srow__name">${esc(m.name)}</span><span class="srow__sub">${m.sub ? esc(m.sub) + ' · ' : ''}${m.ayas} versets${t.st !== 'none' ? ` · ${esc(stLabel(t))}` : ''}</span></span>
      <span class="srow__ar" lang="ar" dir="rtl" translate="no">${esc(m.ar)}</span>
    </button></li>`;
}

/* --- Mes progrès : ce que tu connais, d'après ce que tu as marqué --- */
const fmtInt = (n) => Number(n).toLocaleString('fr-BE');
function arabeCard() {
  const A = Mods.api && Mods.api.arabeSummary ? Mods.api.arabeSummary() : null;
  if (!A) return '';
  const passed = A.chapters.filter((c) => c.passed).length;
  const tries = A.chapters.filter((c) => c.tries);
  const last = tries.map((c) => ({ c, at: c.last && c.last.at })).filter((x) => x.at).sort((x, y) => String(y.at).localeCompare(String(x.at)))[0];
  const pos = A.pos && A.pos.c;
  return `<section class="mz-ar" data-anchor="arabe">
      <h2 class="sec-title">${icon('pen-line', 'sm')}Lire et écrire l’arabe</h2>
      <p class="mz-ar__n"><b>${passed}</b> ${plural(passed, 'chapitre réussi', 'chapitres réussis')} sur 10${A.final && A.final.passed ? ' · examen final réussi' : ''}</p>
      <ol class="mz-ar__chs" aria-label="Les 10 chapitres">${A.chapters.map((c) => `<li class="mz-ar__ch mz-ar__ch--${c.part}${c.passed ? ' is-passed' : c.tries || c.nd ? ' is-started' : ''}" title="Chapitre ${c.n}"><span>${c.n}</span></li>`).join('')}</ol>
      <p class="fine">${pos ? `En cours : chapitre ${pos.n}${A.pos.u ? `, étape ${pos.units.indexOf(A.pos.u) + 1} sur ${pos.units.length}` : ', examen à passer'}.` : 'Les 10 chapitres sont réussis.'}${last ? ` Dernier examen : chapitre ${last.c.n}, ${String(last.c.last.score).replace('.', ',')}/20.` : ''}</p>
      ${A.coach && A.coach.n ? `<p class="mz-ar__c">${icon('target', 'sm')}<span>Ton coach : ${A.coach.top || 'rien qui revient pour l’instant.'}${A.coach.weak ? ` ${A.coach.weak} ${plural(A.coach.weak, 'élément', 'éléments')} à revoir.` : ''}</span></p>` : ''}
      <div class="row-btns"><button type="button" class="btn btn--soft btn--sm" data-act="tab" data-tab="arabe">${icon('arrow-r', 'sm')}Continuer l’arabe</button>
        ${A.coach && A.coach.n ? `<button type="button" class="btn btn--ghost btn--sm" data-act="ar-open" data-page="ar-coach">${icon('target', 'sm')}Mon coach</button>` : ''}</div>
    </section>`;
}
function renderProgress() {
  const root = $('#tab-progress');
  if (!Content.index) { swapHTML(root, topbarMain() + (Content.indexError ? bootError() : '<div class="loading"><span class="spin"></span></div>')); return; }
  if (!Groups.d) { groupsLoading(root); return; }
  const T = unitStat(allParts());
  const nS = Content.index.suras.filter((m) => suraKnown(m.n)).length;
  const gst = Groups.d.groups.map((g) => unitStat(g.r).st);
  const nG = gst.filter((x) => x === 'known').length;
  const jst = Groups.d.juz.map((J) => unitStat(juzParts(J.n)));
  const nJ = jst.filter((t) => t.st === 'known').length;
  const fat = unitStat(suraParts(1));
  // en cours : groupes marqués « J'apprends » ou connus en partie (Al-Fatiha, affichée à part, n'y compte pas)
  const cur = pathUnits().filter((u) => u.kind === 'group').map((u) => ({ u, t: unitStat(u.parts.filter(([n]) => n !== 1)) })).filter((x) => x.t.st === 'learning' || x.t.st === 'partial');
  const sl = syncLabel();
  swapHTML(root, `${topbarMain()}
    <h1 class="screen-title">Mes progrès</h1>
    ${syncBanner()}
    <section class="mz-total" data-anchor="total">
      <p class="mz-total__k">Ce que tu connais du Coran</p>
      <p class="mz-total__n"><b>${esc(pctTxt(T.pct))}</b><span>%</span></p>
      <p class="mz-total__s">${fmtInt(T.kw)} mots sur ${fmtInt(T.w)}, d’après ce que tu as marqué « Je connais ».</p>
      <ul class="mz-kpis"><li><b>${nS}</b><span>${plural(nS, 'sourate', 'sourates')} sur 114</span></li><li><b>${nG}</b><span>${plural(nG, 'groupe', 'groupes')} sur 240</span></li><li><b>${nJ}</b><span>juz sur 30</span></li></ul>
    </section>
    <h2 class="sec-title mz-h">${icon('layers', 'sm')}La carte des 30 juz</h2>
    <div class="mz-fat"><button type="button" class="mz-row__main" data-act="open-reader" data-s="1" data-a="1">${suraBadge(1)}<span class="mz-row__t"><b>Al-Fatiha</b><small>La première sourate</small></span></button>${stChip(fat)}</div>
    <ol class="mz-map" aria-label="Les 30 juz, avec ce que tu en connais">${jst.map((t, k) => { const n = k + 1; return `<li><button type="button" class="mz-tile mz-tile--${t.st}" data-act="mz-juz" data-j="${n}" style="--fill:${(t.pct * 100).toFixed(1)}%" aria-label="Juz ${n} : ${esc(stLabel(t))}">
        <span class="mz-tile__n">${n}</span><span class="mz-tile__p">${t.st === 'known' ? icon('check', 'sm') : t.kn ? `${esc(pctTxt(t.pct))} %` : t.ln ? icon('sprout', 'sm') : ''}</span></button></li>`; }).join('')}</ol>
    <p class="mz-legend"><span><i class="mz-lg mz-lg--known"></i>Connu</span><span><i class="mz-lg mz-lg--partial"></i>En partie</span><span><i class="mz-lg mz-lg--learning"></i>J’apprends</span><span><i class="mz-lg mz-lg--none"></i>Pas encore</span></p>
    ${cur.length ? `<h2 class="sec-title mz-h">${icon('sprout', 'sm')}En cours</h2><ul class="mz-groups mz-groups--cur">${cur.slice(0, 8).map((x) => groupCard(x.u.i)).join('')}</ul>${cur.length > 8 ? `<p class="fine">et ${cur.length - 8} autres groupes en cours.</p>` : ''}` : ''}
    ${arabeCard()}
    <p class="fine">Les pourcentages comptent les mots du texte (un long verset compte plus qu’un court). Ils reflètent ce que tu as marqué toi-même : ce n’est pas une mesure de ta mémoire ni de ta prononciation.</p>
    <p class="sync-line sync-line--${sl.tone}">${icon(sl.tone === 'ok' ? 'cloud' : 'phone', 'sm')}<span>${esc(sl.text)}</span></p>`);
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
  return `<li class="verse${isActiveKey(key) ? ' is-active' : ''}" id="v-${s}-${a}" data-s="${s}" data-a="${a}" data-vk="${key}">
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
        ${selfKnown(s) ? `<p class="sura-head__known">${icon('check-circle', 'sm')}Tu la connais à 100 %</p>` : ''}
      </header>
      ${D.fr ? `<p class="fr-label">${icon('languages', 'sm')}<span>${frLabel()}</span></p>` : ''}
      ${D.tl ? tlNote() : ''}
      ${d.bsm ? `<p class="basmala${isActiveKey('b:' + s) ? ' is-active' : ''}" id="b-${s}" data-vk="b:${s}" lang="ar" dir="rtl" translate="no">${arHTML(d.basmala.split(' '))}</p>` : ''}
      <ol class="verses verses--${disp}">${d.ar.map((_, i) => verseBlock(d, i + 1, disp)).join('')}</ol>
      ${selfCard(s)}
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
  // ce qui change vraiment l'écran du lecteur (le reste — audio, synchro, position — ne le recrée pas)
  sig(props) {
    const mode = props.mode || prefs().readMode || 'verse';
    const loaded = mode === 'page' ? versesOfPage(clamp(props.p || pageOfVerse(props.s || 1, props.a || 1), 1, 604)).every((v) => Content.suras.has(v.s)) : Content.suras.has(props.s);
    const favs = mode === 'page' ? '' : Array.from(Store.mem.fav.values()).filter((f) => f.s === props.s).map((f) => f.a).sort((x, y) => x - y).join(',');
    const known = mode === 'page' ? '' : (() => { const t = unitStat(suraParts(props.s)); return `${t.st}:${t.kn}:${t.ln}:${Groups.d ? 1 : 0}`; })();
    return [mode, props.s, props.p || '', props.loading ? 1 : 0, props.err ? 1 : 0, loaded ? 1 : 0, readerDisplay(), prefs().tlNoteSeen ? 1 : 0, favs, reciterId(), known].join('|');
  },
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
/* Fin de sourate : étudier seul, à sa façon, puis dire soi-même où on en est */
function selfCard(s) {
  const t = unitStat(suraParts(s)); const k = selfKnown(s);
  const txt = t.st === 'known' ? `Tu la connais${k && k.date ? ` (marqué le ${dFull(k.date)})` : ''} : c’est noté dans Mes progrès.`
    : t.st === 'partial' ? `${pctTxt(t.pct)} % connu (marqué par groupes) : tu peux compléter ici.`
    : t.st === 'learning' ? 'Tu l’apprends. Quand tu la récites sans erreur, marque « Je connais ».'
    : 'Lis, écoute et répète à ta façon : le casque en haut propose un verset en boucle, un groupe de versets ou toute la sourate ; « Aa » change l’affichage. Puis dis où tu en es.';
  return `<section class="self-card${t.st === 'known' ? ' is-on' : ''}" data-anchor="self">
      <h2 class="self-card__t">${icon('target', 'sm')}Cette sourate, pour toi</h2>
      ${seg3(t.st, `data-s="${s}"`, 'mz-set-sura')}
      <p class="self-card__p">${esc(txt)}</p>
      <button type="button" class="linkish" data-act="open-page" data-page="sura-progress" data-s="${s}">Séance guidée, récitation complète et étapes de cette sourate</button>
    </section>`;
}
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
    if (Reader.anchor && Reader.anchor.s === s && Reader.anchor.a === a) return;
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
      if (d.bsm) html += `<p class="mushaf__basmala${isActiveKey('b:' + v.s) ? ' is-active' : ''}" data-vk="b:${v.s}" lang="ar" dir="rtl" translate="no">${arHTML(d.basmala.split(' '))}</p>`;
    }
    if (!open) { html += '<p class="mushaf__text" lang="ar" dir="rtl" translate="no">'; open = true; }
    html += `<span class="mv${isActiveKey(v.s + ':' + v.a) ? ' is-active' : ''}" id="mv-${v.s}-${v.a}" data-vk="${v.s}:${v.a}" data-act="verse-menu" data-s="${v.s}" data-a="${v.a}" role="button" tabindex="0" aria-label="Verset ${v.s}:${v.a}">${arWithEnd(d.arBody[v.a - 1], v.a)}</span> `;
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
async function startReaderAudio(cfg) {
  // cfg : { s, a, kind: 'continuous'|'verse'|'group', a1, a2, count, gap }
  const R = reciter(); const meta = suraMeta(cfg.s);
  // Voix « sourate » sans repères de versets : seule la sourate entière, depuis le début, est possible
  if (R.kind === 'surah') {
    const tm = await surahTimings(R, cfg.s);
    if (!tm && cfg.kind === 'continuous') {
      // lecture continue : on garde la voix choisie, depuis le début de la sourate
      if ((cfg.a || 1) > 1) toast(`Lecture depuis le début : pas encore de repères de versets vérifiés pour ${meta.name} avec ${R.name}.`);
      cfg = Object.assign({}, cfg, { a: 1 });
    } else if (tm && tm.u && tm.u.length && (cfg.kind === 'continuous' || cfg.kind === 'group')) {
      // borne non confirmée : on part (ou on s'arrête) à la limite sûre la plus proche si elle est à 3 versets au plus,
      // sinon les versets concernés seront lus par une autre voix (annoncé par planVoices)
      const u = tm.u; const a1 = cfg.kind === 'group' ? cfg.a1 : (cfg.a || 1); const a2 = cfg.kind === 'group' ? cfg.a2 : meta.ayas;
      let b1 = a1; while (b1 > 1 && u.includes(b1 - 1)) b1--;
      let b2 = a2; while (b2 < meta.ayas && u.includes(b2)) b2++;
      if ((b1 !== a1 || b2 !== a2) && (a1 - b1) + (b2 - a2) <= 3) {
        toast(cfg.kind === 'continuous'
          ? `${R.name} : lecture à partir du verset ${b1}, car la limite avant le verset ${a1} n’est pas assez sûre dans cet enregistrement pour commencer exactement là.`
          : `${R.name} : répétition des versets ${b1} à ${b2}, car la limite ${b1 !== a1 ? `avant le verset ${a1}` : `après le verset ${a2}`} n’est pas assez sûre dans cet enregistrement pour couper exactement.`);
        cfg = cfg.kind === 'group' ? Object.assign({}, cfg, { a1: b1, a2: b2 }) : Object.assign({}, cfg, { a: b1 });
      }
    }
  }
  Reader.audio = cfg; Follow.suspended = false;
  let tracks; let cycles = 1; let gap = 0; let gapEach = 0;
  if (cfg.kind === 'verse') { tracks = readerTracks(cfg.s, cfg.a, cfg.a, false); cycles = cfg.count; gap = cfg.gap === 'none' ? 0 : (cfg.gap || 'auto'); }
  else if (cfg.kind === 'group') { tracks = readerTracks(cfg.s, cfg.a1, cfg.a2, false); cycles = cfg.count; gap = cfg.gap === 'none' ? 0 : (cfg.gap || 'auto'); }
  else { tracks = readerTracks(cfg.s, cfg.a, meta.ayas, true); gapEach = (prefs().readGap || 0) * 1000; }
  runSequence(tracks, {
    ctx: 'reader', cycles, gap, gapEach, label: meta.name,
    onPhase: (ph, info) => {
      if (ph === 'done' && cfg.kind === 'continuous' && cfg.s < 114) toast(`Fin de ${meta.name}.`, false, { label: 'Sourate suivante', fn: () => openReader(cfg.s + 1, 1, { replace: true }) });
      if (ph === 'error') toast(audioErrorText(info.error), true);
    },
    onTrackEnd: (t) => markListened(t.s, t.a),
  });
  renderPlayerBar();
}
function renderPlayerBar() {
  const root = $('#player'); if (!root) return;
  const onReader = Player.ctx === 'reader' && Player.state !== 'idle';
  root.hidden = !onReader;
  document.body.classList.toggle('has-player', onReader);
  if (!onReader) { swapHTML(root, ''); return; }
  const t = Player.cur; const cfg = Reader.audio || {};
  const R = (Player.run && Player.run.R) || reciter(); const si = syncInfo(R.id, t && t.s);
  const g = t && !t.intro ? groupAround(Player.run && Player.run.kind === 'surah' ? Player.run : null, t.a || 1) : null;
  const where = t ? (t.intro ? `${suraTitle(t.s)} · basmala` : g[0] !== g[1] ? `${suraTitle(t.s)} · versets ${g[0]} ${g[1] - g[0] > 1 ? 'à' : 'et'} ${g[1]}` : `${suraTitle(t.s)} · verset ${t.a || 1}`) : '';
  const rep = cfg.kind === 'verse' || cfg.kind === 'group' ? ` · ${Player.cycle}${Player.cycles === Infinity ? '' : '/' + Player.cycles}` : '';
  const playing = Player.state === 'playing' || Player.state === 'loading' || Player.state === 'gap';
  const rate = playRate();
  swapHTML(root, `${Follow.suspended ? `<button type="button" class="player__back" data-act="follow-resume">${icon('arrow-d', 'sm')}Revenir à la récitation</button>` : ''}
    <div class="player__in">
      <div class="player__info"><b>${esc(where)}${esc(rep)}</b><span>${Player.state === 'gap' ? 'À toi de répéter…' : `${esc(R.name)} · ${esc(si.label.toLowerCase())}`}</span></div>
      <div class="player__btns">
        <button type="button" class="icon-btn" data-act="player-step" data-d="-1" aria-label="Verset précédent">${icon('skip-back')}</button>
        <button type="button" class="icon-btn icon-btn--solid" data-act="player-toggle" aria-label="${playing ? 'Pause' : 'Lecture'}">${icon(playing ? 'pause' : 'play')}</button>
        <button type="button" class="icon-btn" data-act="player-step" data-d="1" aria-label="Verset suivant">${icon('skip-fwd')}</button>
        <button type="button" class="rate-btn" data-act="player-rate" aria-label="Vitesse de lecture : ${String(rate).replace('.', ',')} fois">${String(rate).replace('.', ',')}×</button>
        <button type="button" class="icon-btn" data-act="player-stop" aria-label="Arrêter">${icon('stop')}</button>
      </div></div>`);
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
      out.push({ a, tokens: toks.slice(from, to), isEnd: to >= toks.length, tl: tlForChunk(d, a, chunk), partial: true, w0: toks.slice(0, from).filter((t) => !SIGN_TOKEN.test(t)).length });
    } else out.push({ a, tokens: toks, isEnd: true, tl: d.tl[a - 1], partial: false, w0: 0 });
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
    return `<div class="pv"${opts.hidden ? '' : ` data-vk="${d.n}:${pt.a}"`}>
        <p class="ar ar--learn" lang="ar" dir="rtl" translate="no">${arHTML(pt.tokens, { shown, end: pt.isEnd ? pt.a : null, w0: pt.w0 || 0 })}</p>
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
function audioErrorNotice() {
  const c = Player.error && Player.error.code;
  return `<div class="notice notice--warn">${icon('alert')}<span>${esc(audioErrorText(Player.error))}${c === 'notiming' || c === 'filechanged' ? `<br><button type="button" class="linkish" data-act="open-page" data-page="settings">Choisir une autre voix</button>` : ''}</span></div>`;
}
function reciterLine(s) { const r = reciter(); const si = syncInfo(r.id, s); return `<p class="reciter">${icon('mic', 'sm')}<span>Récitation : ${esc(r.name)} · ${esc(r.style)} · ${esc(si.label.toLowerCase())}</span></p>`; }
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
        ${aud === 'error' ? audioErrorNotice() : ''}
        <div class="sess__acts">
          ${playing ? `<button type="button" class="btn btn--primary btn--xl" data-act="audio-stop">${icon('stop')}Arrêter</button>`
            : st.listened ? `<button type="button" class="btn btn--primary btn--xl" data-act="step-next" data-to="repeat">À toi de répéter${icon('chev-r')}</button>
                <button type="button" class="btn btn--soft" data-act="learn-listen">${icon('repeat')}Réécouter</button>`
            : `<button type="button" class="btn btn--primary btn--xl" data-act="learn-listen">${icon('play')}Écouter</button>
               ${aud === 'error' ? `<button type="button" class="btn btn--ghost" data-act="step-next" data-to="repeat">Continuer sans l’audio</button>` : ''}`}
        </div>${reciterLine(it.s)}`;
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
        ${aud === 'error' ? audioErrorNotice() : ''}
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
/* Sourate récitée en entier sans aide pendant la séance : on te propose de la marquer « Je connais » (jamais d'office) */
function offerKnown(s) {
  const xs = [...new Set(s.results.filter((r) => (r.type === 'surah' || r.type === 'known') && r.result === 'solo' && !r.aided).map((r) => r.s))].filter((n) => !suraKnown(n));
  return xs.map((n) => `<div class="mz-offer"><p>Tu as récité <b>${esc(suraTitle(n))}</b> en entier, sans aide.</p><button type="button" class="btn btn--soft" data-act="mz-set-sura" data-s="${n}" data-st="known">${icon('check-circle', 'sm')}Marquer « Je connais »</button></div>`).join('');
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
        ${offerKnown(s)}
        <div class="sess__acts">
          <button type="button" class="btn btn--primary btn--xl" data-act="session-close">Revenir à « Mémoriser »</button>
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
    if (!sess.items.length) { done(); toast('Rien de prévu pour l’instant : choisis un groupe dans « Mémoriser ».'); return; }
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
function reciterSub(k) {
  const r = RECITERS[k]; const d = Timing.computed;
  const n = d ? Object.values(d.s).filter((e) => e && e.ok).length : null;
  const sync = r.sync === 'words' ? 'suivi mot à mot (repères quran-align)'
    : r.sync === 'mp3quran' ? 'suivi par verset (repères MP3Quran)'
    : `suivi par verset ${n != null ? `sur ${n} sourate${n > 1 ? 's' : ''}` : ''} (repères calculés et contrôlés) ; pas de suivi mot à mot : aucune donnée publiée pour cette voix`;
  return `${r.style} · Hafs · ${r.kind === 'surah' ? 'fichiers par sourate (MP3Quran)' : 'fichiers par verset (EveryAyah)'} · ${sync}`;
}
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
        <h2 class="set__h">Répéter</h2>
        <p class="set__l">Répétitions par défaut</p>
        <div class="stepper"><button type="button" class="icon-btn" data-act="reps-step" data-d="-1" aria-label="Moins">${icon('minus')}</button><b class="num" aria-live="polite">${P.reps}</b><button type="button" class="icon-btn" data-act="reps-step" data-d="1" aria-label="Plus">${icon('plus')}</button></div>
        <p class="set__l">Silence pour répéter</p>
        <div class="seg seg--3">${[['court', 'Court'], ['auto', 'Normal'], ['long', 'Long']].map(([k, l]) => `<button type="button" class="seg__b${P.gap === k ? ' is-on' : ''}" aria-pressed="${P.gap === k}" data-act="set-pref" data-k="gap" data-v="${k}">${l}</button>`).join('')}</div>
        <p class="fine">Le silence s’adapte à la durée du passage. Ces réglages sont des choix pédagogiques, pas des règles religieuses.</p>
      </section>
      <section class="set">
        <h2 class="set__h" id="set-reciter">Récitateur</h2>
        <p class="fine">Choix unique pour toute l’appli. Le nom affiché est toujours celui de l’enregistrement joué : aucune autre voix ne le remplace en silence.</p>
        <div class="opts" role="radiogroup" aria-label="Récitateur">${RECITER_ORDER.map((k) => { const r = RECITERS[k]; return radioRow('reciter', k, reciterId(), r.name + (k === 'luhaidan' ? ' (principal)' : k === 'dossari' ? ' (secondaire)' : ''), reciterSub(k)); }).join('')}</div>
        <button type="button" class="btn btn--soft btn--sm" data-act="reciter-test">${icon('play', 'sm')}Écouter un exemple (Al-Fatiha, verset 1)</button>
      </section>
      <section class="set">
        <h2 class="set__h">Rappel (facultatif)</h2>
        <p class="fine">Si tu le veux, ajoute toi-même un rappel à ton calendrier, chaque semaine ou chaque jour. L’appli n’envoie aucune notification d’elle-même.</p>
        <button type="button" class="link-row" data-act="sheet" data-sheet="remind">${icon('bell', 'sm')}<span>Ajouter un rappel à mon calendrier</span>${icon('chev-r', 'sm')}</button>
      </section>
      <section class="set">
        <h2 class="set__h">Hors connexion</h2>
        <button type="button" class="link-row" data-act="offline-text" ${Offline.textBusy ? 'disabled' : ''}>${icon('download', 'sm')}<span>${Offline.textBusy ? 'Enregistrement du texte…' : Offline.textState === DATA_V ? 'Texte complet du Coran enregistré sur ce téléphone' : 'Garder tout le texte sur ce téléphone (environ 4 Mo)'}</span>${Offline.textState === DATA_V ? icon('check', 'sm') : icon('chev-r', 'sm')}</button>
        <p class="set__l">Audio téléchargé</p>
        ${inv.length ? `<ul class="mini-list">${inv.map((x) => { const r = reciterOfFolder(x.folder); return `<li><span>${esc(suraTitle(x.s))} · ${esc(r ? r.name + (r.style !== 'murattal' ? ' (' + r.style + ')' : '') : x.folder)} · ${r && r.kind === 'surah' ? 'sourate entière' : `${x.count}/${suraMeta(x.s).ayas} versets`}</span><button type="button" class="icon-btn icon-btn--sm" data-act="audio-del" data-s="${x.s}" data-folder="${esc(x.folder)}" aria-label="Supprimer l’audio de ${esc(suraTitle(x.s))}">${icon('trash', 'sm')}</button></li>`; }).join('')}</ul>` : '<p class="fine">Aucun audio téléchargé. Dans le lecteur, menu ⋯ → « Télécharger l’audio de cette sourate ».</p>'}
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
        ${Store.uid && Host.email && ['synced', 'pending', 'offline'].includes(Sync.state) ? `<p class="fine">Compte : ${esc(Host.email)}</p>` : ''}
        <div class="row-btns">
          ${Sync.state === 'signedout' ? `<button type="button" class="btn btn--primary btn--sm" data-act="sheet" data-sheet="account">${icon('user-check', 'sm')}Me connecter</button>` : ''}
          ${['not_installed', 'outdated'].includes(Sync.state) ? `<button type="button" class="btn btn--primary btn--sm" data-act="sheet" data-sheet="sync-install">${icon('cloud', 'sm')}${Sync.state === 'outdated' ? 'Mettre à jour la sauvegarde' : 'Activer la sauvegarde en ligne'}</button>` : ''}
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

/* --- Détail d'une sourate : six jalons, état, vérification par un enseignant --- */
PAGES['sura-progress'] = {
  label: (p) => suraTitle(p.s),
  render(props) {
    const s = Number(props.s); const m = suraMeta(s); const p = refreshMilestones(progressOf(s)); const n = milestoneCount(p); const t = unitStat(suraParts(s));
    const r = Store.mem.review.get('s' + s);
    const atts = Array.from(Store.mem.attempt.values()).filter((x) => x.s === s).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 6);
    const k = selfKnown(s);
    const mine = t.st === 'known' ? `Tu la connais${k && k.date ? ` : marqué le ${dFull(k.date)}` : ''}.` : t.st === 'partial' ? `${t.kn} ${plural(t.kn, 'verset connu', 'versets connus')} sur ${t.n} (${pctTxt(t.pct)} % du texte).` : t.st === 'learning' ? 'Tu l’apprends.' : 'Pas encore commencé.';
    return `${pageHead(m.name)}
      <div class="sp-head"><p class="sp-head__ar" lang="ar" dir="rtl" translate="no">${esc(m.ar)}</p><p class="sp-head__n">${m.ayas} versets${m.sub ? ` · ${esc(m.sub)}` : ''}</p></div>
      <section class="mz-mine" data-anchor="mine"><h2 class="sec-title">${icon('target', 'sm')}Cette sourate, pour toi</h2>
        ${seg3(t.st, `data-s="${s}"`, 'mz-set-sura')}${t.kn && t.st !== 'known' ? mzBar(t.pct) : ''}<p class="mz-mine__p">${esc(mine)}</p></section>
      <div class="row-btns row-btns--col">
        <button type="button" class="btn btn--primary" data-act="open-reader" data-s="${s}">${icon('book-open', 'sm')}Étudier dans le lecteur</button>
        <button type="button" class="btn btn--soft" data-act="mz-guided-sura" data-s="${s}">${icon('headphones', 'sm')}Séance guidée sur cette sourate</button>
        <button type="button" class="btn btn--soft" data-act="surah-recite" data-s="${s}">${icon('eye-off', 'sm')}Réciter toute la sourate sans regarder</button>
        ${!hasStarted(s) ? `<button type="button" class="btn btn--ghost" data-act="known-start" data-s="${s}">${icon('mic', 'sm')}Le vérifier en la récitant</button>` : ''}
      </div>
      <h2 class="set__h">Séance guidée : les 6 étapes <small class="muted">(facultatif)</small></h2>
      <p class="fine">${n === 6 ? 'Les 6 étapes de la séance guidée sont faites.' : `${n} ${plural(n, 'étape faite', 'étapes faites')} sur 6.`} Elles décrivent ton travail dans la séance guidée ; elles ne changent pas ton état : c’est toi qui marques « Je connais ».</p>
      <ol class="miles">${MILESTONES.map((x, i) => { const kk = i + 1; const dte = p.m && p.m[kk]; return `<li class="miles__i${dte ? ' is-done' : ''}"><span class="miles__ck" aria-hidden="true">${dte ? icon('check', 'sm') : ''}</span><span><b>${esc(x)}</b><small>${dte ? `Validé le ${esc(dFull(dte))}` : milestoneHint(kk, p, m)}</small></span><span class="sr-only">${dte ? 'fait' : 'pas encore'}</span></li>`; }).join('')}</ol>
      ${r ? `<p class="line-info">${icon('calendar', 'sm')}<span>Prochaine révision de la sourate : ${esc(dayName(r.due))}${r.last ? ` · dernière : ${esc(RESULT_LABEL[r.last.result] || '')}` : ''}</span></p>` : ''}
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
      ${row('Groupes de mémorisation (« Mémoriser »)', `<p>240 groupes, 8 par juz : quarts de hizb (۞) des métadonnées Tanzil (CC BY 3.0). ${Groups.d ? esc(Groups.d.regle) : 'Dans une sourate courte ou moyenne, une limite qui tombe au milieu de la sourate est déplacée au début de cette sourate ou de la suivante.'}</p><p class="fine">Les pourcentages comptent les mots du texte Tanzil (sans la basmala du verset 1 ni les signes de pause). Les premiers mots de chaque juz sont copiés du texte Tanzil.</p>`)}
      ${row('Récitation (audio)', `<p><b>Mohamed Al-Luhaidan</b> (récitateur principal) et <b>Yasser Al-Dossari</b> : un fichier par sourate, depuis <a href="https://www.mp3quran.net" target="_blank" rel="noopener">MP3Quran.net</a> (Hafs ʿan ʿĀṣim, murattal). MP3Quran publie une API pour les développeurs mais aucune licence : les fichiers ne sont pas copiés dans l’appli, ils sont lus depuis leurs serveurs et, seulement si tu le demandes, gardés sur ton téléphone pour ton usage personnel.</p>
        <p><b>Mahmoud Khalil Al-Husary</b> (murattal et pédagogique), <b>Mohamed Siddiq Al-Minshawi</b>, <b>Mishary Alafasy</b> : fichiers verset par verset d’<a href="https://everyayah.com" target="_blank" rel="noopener">EveryAyah.com</a>, mêmes conditions.</p>
        <p class="fine">Le nom affiché est toujours celui de l’enregistrement joué. Les exercices de l’espace « Lire et écrire l’arabe » utilisent des mots extraits de la récitation pédagogique d’Al-Husary : ils ne sont jamais attribués à une autre voix.</p>`)}
      ${row('Suivi du texte pendant la récitation', `<p><b>Mot à mot</b> (Al-Husary, Al-Minshawi, Alafasy) : repères <a href="https://github.com/cpfair/quran-align" target="_blank" rel="noopener">quran-align</a> de Collin Fair, licence CC BY 4.0, calculés pour ces fichiers EveryAyah précis. Qualité publiée par l’auteur : écart moyen inférieur à 73 ms avec une méthode indépendante ; 99,8 à 99,9 % des mots ont leur repère.</p>
        <p><b>Par verset, Yasser Al-Dossari</b> : repères publiés par MP3Quran pour son enregistrement.</p>
        <p><b>Par verset, Mohamed Al-Luhaidan</b> : aucun fournisseur ne publie de repères pour cette voix (vérifié auprès de MP3Quran, Quran.com et QUL). Ils ont été calculés pour chaque fichier exact, en alignant son audio sur trois récitations découpées verset par verset (EveryAyah : Saoud Al-Shuraim, Abdurrahman As-Sudais, Maher Al-Muaiqly). Une limite n’est retenue que si elle tombe dans une pause réelle du fichier et que les références concordent ; sinon les versets qu’elle sépare sont surlignés ensemble, jamais coupés au hasard, et un verset qu’on ne peut pas isoler est lu par Al-Husary (annoncé). Une sourate qui ne passe pas les contrôles reste sans suivi.</p>
        <p><b>Mot à mot, Mohamed Al-Luhaidan</b> : couverture 0 %. Aucun repère mot à mot n’existe pour cet enregistrement et l’appli n’en invente pas : pas de mot surligné avec cette voix.</p>
        ${timingQcLine()}`)}
      ${row('Police arabe', '<p>Amiri Quran (Amiri Project), licence SIL Open Font License 1.1, hébergée avec l’appli. Interface : Rubik, même licence.</p>')}
      ${row('Illustration', '<p>Livre fermé sur un pupitre : illustration générée une seule fois pour l’appli (Higgsfield, modèle gpt_image_2_5), sans texte, sans calligraphie et sans page du Coran.</p>')}
      ${row('Quran Foundation', '<p>Les API de contenu de Quran Foundation demandent des identifiants gardés sur un serveur et un accès de production validé (l’accès de test ne contient que deux sourates). Elles ne sont pas utilisées dans cette version.</p>')}
      ${row('La méthode', `<p>Rappel actif : <a href="https://www.psychologicalscience.org/journals/perspectives/j.1745-6916.2006.00012.x/" target="_blank" rel="noopener">Roediger et Karpicke (2006)</a>. Pratique espacée : <a href="https://digitalcommons.usf.edu/psy_facpub/1771/" target="_blank" rel="noopener">Cepeda et collaborateurs</a>. Ces travaux soutiennent l’intérêt de ces techniques pour la rétention, sans garantie de maîtrise. Le calendrier (1, 3, 7, 14, 30 jours) est un choix de conception ajustable.</p>`)}`;
  },
};

/* ===== Feuilles ===== */
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
function timingQcLine() {
  const d = Timing.computed; if (!d) return '';
  const c = d.coverage || {}; const v = d.validation || {};
  const n = c.suras_with_verse_sync != null ? c.suras_with_verse_sync : Object.values(d.s).filter((e) => e && e.ok).length;
  const fr = (x) => String(x).replace('.', ',');
  const cov = `Couverture actuelle : ${n} sourate${n > 1 ? 's' : ''} sur 114 avec suivi par verset${c.verses ? ` (${c.verses_isolable} versets sur ${c.verses} repérables seuls, les autres surlignés par groupes de deux ou plus)` : ''}.`;
  const val = v.confirmed ? ` Méthode contrôlée sur l’enregistrement de Yasser Al-Dossari, dont MP3Quran publie les repères (jamais utilisés pour Al-Luhaidan) : ${v.usable_suras} sourates, ${v.confirmed} limites confirmées, ${fr(v.confirmed_within_300ms_pct)} % à moins de 0,3 s et ${fr(v.confirmed_within_1s_pct)} % à moins de 1 s de ces repères.` : '';
  return `<p class="fine">${cov}${val}</p>`;
}
function dlSizeLabel(s) {
  const R = reciter();
  if (R.kind === 'surah') { const e = Timing.computed && Timing.computed.s[String(s)]; return e && e.bytes ? `${(e.bytes / 1048576).toFixed(1).replace('.', ',')} Mo` : 'sourate entière (taille variable)'; }
  return `environ ${Math.max(1, Math.round(suraMeta(s).ayas * 0.09))} Mo`;
}
SHEETS['reader-more'] = {
  render() {
    const top = topPage(); const s = top && top.props ? (top.props.mode === 'page' ? versesOfPage(top.props.p)[0].s : top.props.s) : 1;
    const dl = Downloads.running;
    return { title: esc(suraTitle(s)), body: `
      <form class="page-go" data-form="verse-go"><label for="verseGo">Aller au verset</label><div class="page-go__row"><input id="verseGo" type="number" inputmode="numeric" min="1" max="${suraMeta(s).ayas}" placeholder="1 à ${suraMeta(s).ayas}"><button type="submit" class="btn btn--primary">Aller</button></div></form>
      <form class="page-go" data-form="page-go"><label for="pageGo2">Aller à la page</label><div class="page-go__row"><input id="pageGo2" type="number" inputmode="numeric" min="1" max="604" placeholder="1 à 604"><button type="submit" class="btn btn--primary">Ouvrir</button></div></form>
      <div class="opts">
        <button type="button" class="opt" data-act="dl-sura" data-s="${s}" ${dl ? 'disabled' : ''}><span class="opt__dot" aria-hidden="true">${icon('download', 'sm')}</span><span class="opt__t"><b>${dl && dl.s === s ? `Téléchargement… ${dl.done}/${dl.total}` : 'Télécharger l’audio de cette sourate'}</b><small>${esc(reciter().name)} · ${dlSizeLabel(s)} · pour l’écouter hors connexion</small></span></button>
        <div class="opt opt--static"><span class="opt__dot" aria-hidden="true">${icon('target', 'sm')}</span><span class="opt__t"><b>Cette sourate, pour toi</b>${seg3(surahState(s), `data-s="${s}"`, 'mz-set-sura')}</span></div>
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
    return { title: 'Choisir une sourate', body: `
      <label class="search" for="pickSearch">${icon('search')}<input id="pickSearch" type="search" autocomplete="off" placeholder="Nom ou numéro" value="${esc(p.q || '')}"></label>
      <ul class="slist slist--pick">${res.suras.slice(0, 114).map((m) => `<li><button type="button" class="srow" data-act="pick-sura" data-s="${m.n}">${suraBadge(m.n)}<span class="srow__main"><span class="srow__name">${esc(m.name)}</span><span class="srow__sub">${m.sub ? esc(m.sub) + ' · ' : ''}${m.ayas} versets</span></span><span class="srow__ar" lang="ar" dir="rtl" translate="no">${esc(m.ar)}</span></button></li>`).join('')}</ul>` };
  },
};
SHEETS.remind = {
  render() {
    const t = prefs().remindTime || '19:00';
    const f = prefs().remindFreq === 'daily' ? 'daily' : 'weekly';
    return { title: 'Rappel dans ton calendrier', body: `
      <p class="sub">Choisis quand, puis ajoute le rappel à ton calendrier. Tu pourras le modifier ou le supprimer dans ton calendrier.</p>
      <div class="seg">${[['weekly', 'Chaque semaine'], ['daily', 'Chaque jour']].map(([k, l]) => `<button type="button" class="seg__b${f === k ? ' is-on' : ''}" aria-pressed="${f === k}" data-act="set-pref" data-k="remindFreq" data-v="${k}">${l}</button>`).join('')}</div>
      <label class="field"><span>Heure</span><input id="remindTime" type="time" value="${esc(t)}"></label>
      <div class="sheet__acts">
        <button type="button" class="btn btn--primary btn--block" data-act="remind-ics">${icon('calendar', 'sm')}Calendrier du téléphone (.ics)</button>
        <button type="button" class="btn btn--soft btn--block" data-act="remind-google">${icon('calendar', 'sm')}Google Agenda</button>
      </div>
      <p class="fine">Le rappel s’appelle « Mon Coran » pour rester discret. Rien n’est envoyé par l’appli.</p>` };
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
  const t = el.dataset.tab; if (!TABS.includes(t)) return;
  const same = UI.tab === t && !UI.pages.length;
  while (UI.pages.length) { const top = UI.pages.pop(); if (PAGES[top.name] && PAGES[top.name].onClose) PAGES[top.name].onClose(top.props); }
  renderPage(true); closeAllSheets();
  UI.tab = t; saveUIState(); renderAll();
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
  await setPrefs({ [k]: v, ...(k === 'minutes' ? { minutesAsked: true } : {}), ...(k === 'reciter' ? { reciterV2: true } : {}) });
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

/* --- Mémoriser : juz, groupes, statuts déclarés --- */
const needGroups = async () => { try { await loadGroups(); return true; } catch (e) { toast('Les groupes de mémorisation n’ont pas pu être chargés (réseau). Réessaie dans un instant.', true); return false; } };
ACT['mz-retry'] = () => { Groups.err = null; loadGroups().catch(() => {}); scheduleRender(); };
ACT['mz-juz'] = async (el) => { if (!(await needGroups())) return; openPage('mz-juz', { j: Number(el.dataset.j) }); };
ACT['mz-group'] = async (el) => {
  if (!(await needGroups())) return;
  if (el.dataset.replace) { const t = topPage(); if (t && t.name === 'mz-group') backPage(); }
  openPage('mz-group', { i: Number(el.dataset.i) });
};
ACT['mz-set-group'] = async (el) => { const g = Groups.d && Groups.d.groups[Number(el.dataset.i)]; if (!g) return; await applyStatus(g.r, el.dataset.st, `Juz ${g.j}, groupe ${g.k}`); };
ACT['mz-set-sura'] = async (el) => { const s = Number(el.dataset.s); if (!(s >= 1 && s <= 114)) return; await applyStatus(suraParts(s), el.dataset.st, suraTitle(s)); refreshSheet(); };
ACT['mz-cycle'] = async (el) => {
  const r = [Number(el.dataset.s), Number(el.dataset.a1), Number(el.dataset.a2)]; if (!(r[0] >= 1 && r[1] >= 1 && r[2] >= r[1])) return;
  const nx = { none: 'learning', learning: 'known', partial: 'known', known: 'none' }[unitStat([r]).st];
  await applyStatus([r], nx, partLabel(r));
};
ACT['mz-bulk-go'] = async (el) => { const n = Number(el.dataset.j); closeSheet(); if (!(await needGroups())) return; await applyStatus(juzParts(n), el.dataset.st, `Juz ${n}`); };
/* Séance guidée sur un groupe ou une sourate (facultative) : elle commence au premier verset du groupe */
async function startGuided(r, btn) {
  const [s, a1, a2] = r; const N = ayasOf(s);
  if (a1 > 1 || a2 < N) { const p = progressOf(s); if (!(p.nextA >= a1 && p.nextA <= a2)) { p.nextA = a1; p.nextC = 0; await saveProgress(p); } }
  await setPrefs({ current: s });
  const sess = Store.session;
  if (sess && !sess.done && sess.date === todayISO() && sess.items && sess.i < sess.items.length) {
    const it = sess.items[sess.i]; if (it && it.s === s) { openPage('session'); return; }
    await saveSession(null);
  }
  await startSession(btn);
}
ACT['mz-guided'] = async (el) => { if (!(await needGroups())) return; const g = Groups.d.groups[Number(el.dataset.i)]; if (!g) return; await startGuided(firstToLearn(g.r), el); };
ACT['mz-guided-sura'] = async (el) => { const s = Number(el.dataset.s); if (!(s >= 1 && s <= 114)) return; await startGuided([s, 1, ayasOf(s)], el); };

/* --- Lecteur --- */
ACT['open-reader'] = (el) => { if (UI.pages.some((p) => p.name === 'session')) return; openReader(el.dataset.s, el.dataset.a, { replace: el.dataset.replace === '1', mode: el.dataset.mode === 'page' ? 'page' : (prefs().readMode === 'page' && !el.dataset.a ? 'page' : 'verse') }); };
ACT['open-page-mode'] = (el) => { const p = clamp(Number(el.dataset.p) || 1, 1, 604); const v = versesOfPage(p)[0]; setPrefs({ readMode: 'page' }); openReader(v.s, v.a, { mode: 'page', p }); };
ACT['open-juz'] = (el) => { const j = Content.index.juz[clamp(Number(el.dataset.j) || 1, 1, 30) - 1]; openReader(j.s, j.a, { mode: prefs().readMode === 'page' ? 'page' : 'verse' }); };
ACT['read-seg'] = (el) => { UI.readSeg = el.dataset.seg; saveUIState(); renderRead(); window.scrollTo(0, Math.min(window.scrollY, ($('#tab-read .seg') || { offsetTop: 0 }).offsetTop)); };
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
ACT['player-stop'] = () => { stopAudio(); renderPlayerBar(); };
ACT['player-rate'] = () => { const r = playRate(); const nx = RATES[(RATES.indexOf(r) + 1) % RATES.length]; setRate(nx); renderPlayerBar(); toast(`Vitesse ${String(nx).replace('.', ',')}× : le suivi du texte suit la vitesse.`); };
ACT['follow-resume'] = () => followResume();
ACT['player-step'] = (el) => {
  const cfg = Reader.audio; const t = Player.cur; if (!cfg || !t) return;
  const s = t.s; const meta = suraMeta(s); const d = Number(el.dataset.d);
  const a = clamp((t.intro ? 0 : (t.a || 1)) + d, 1, meta.ayas);
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
function onSearchInput(v) { UI.q = v; saveUIState(); paintReadList(); }

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

ACT['pick-sura'] = async (el) => {
  const s = Number(el.dataset.s);
  closeAllSheets();
  openReader(s, 1);
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
ACT['self-known'] = async (el) => {
  const s = Number(el.dataset.s);
  await setSelfKnown(s, true);
  const hasRev = Store.mem.review.has('s' + s);
  toast(`${suraTitle(s)} : connue à 100 %, notée dans tes progrès.`, false, hasRev ? null : { label: 'Ajouter des révisions', fn: async () => { await recordReview({ type: 'surah', s }, 'solo'); toast('Révisions espacées ajoutées pour cette sourate.'); } });
};
ACT['self-known-undo'] = async (el) => {
  const s = Number(el.dataset.s);
  await setSelfKnown(s, false);
  toast('Validation annulée.');
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
const remindRule = () => (prefs().remindFreq === 'daily' ? 'RRULE:FREQ=DAILY' : 'RRULE:FREQ=WEEKLY');
ACT['remind-ics'] = async () => {
  const t = ($('#remindTime') || {}).value || '19:00'; await setPrefs({ remindTime: t });
  const [h, m] = t.split(':').map(Number); const d = addDays(todayISO(), 1).replace(/-/g, '');
  const hh = String(h).padStart(2, '0'); const mm = String(m).padStart(2, '0'); const end = String(Math.min(23, h + (m + 10 >= 60 ? 1 : 0))).padStart(2, '0') + String((m + 10) % 60).padStart(2, '0');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StayClean Agenda//Mon Coran//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    'UID:' + uid('qr') + '@stayclean-agenda', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
    `DTSTART;TZID=Europe/Brussels:${d}T${hh}${mm}00`, `DTEND;TZID=Europe/Brussels:${d}T${end}00`, remindRule(),
    'SUMMARY:Mon Coran', 'DESCRIPTION:Ouvre StayClean Agenda : Mon Coran.', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Mon Coran', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const file = new File([ics], 'rappel-mon-coran.ics', { type: 'text/calendar' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Mon Coran' }); closeSheet(); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = 'rappel-mon-coran.ics'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  closeSheet(); toast('Fichier du rappel prêt : ouvre-le pour l’ajouter à ton calendrier.');
};
ACT['remind-google'] = async () => {
  const t = ($('#remindTime') || {}).value || '19:00'; await setPrefs({ remindTime: t });
  const [h, m] = t.split(':').map(Number); const d = addDays(todayISO(), 1).replace(/-/g, '');
  const s = `${d}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
  const e2 = new Date(Date.UTC(2000, 0, 1, h, m + 10)); const e = `${d}T${String(e2.getUTCHours()).padStart(2, '0')}${String(e2.getUTCMinutes()).padStart(2, '0')}00`;
  const url = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Mon Coran') + '&dates=' + s + '/' + e + '&ctz=Europe/Brussels&recur=' + encodeURIComponent(remindRule());
  window.open(url, '_blank', 'noopener'); closeSheet();
};
ACT['offline-text'] = async (el) => {
  if (Offline.textBusy) return; Offline.textBusy = true; renderPage(false);
  let ok = 0;
  try {
    await fetch('coran/data/index.json?v=' + DATA_V);
    await fetch('coran/data/groupes.json?v=' + GROUPS_V).catch(() => null);
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
    if (MERGE[it.kind] && local && !local.deleted) {   // progression d'une sourate, étapes de l'arabe : on fusionne
      let m = null; try { m = MERGE[it.kind](clone(local.data), clone(it.data), local.lu || 0, it.lu || 0); } catch (e) { m = null; }
      if (m && !sameData(m, local.data)) { await put(it.kind, it.id, m); n++; }
      continue;
    }
    if (local && !local.deleted && (local.lu || 0) >= (it.lu || 0)) continue;
    await put(it.kind, it.id, it.data); n++;
  }
  toast(n ? `${n} élément(s) importé(s).` : 'Rien de nouveau dans ce fichier.');
  renderAll();
}
ACT['sync-now'] = async (el) => { const done = busy(el, 'Synchronisation…'); await syncNow(); done(); toast(syncLabel().text, Sync.state !== 'synced'); renderPage(false); };
ACT['sync-retry'] = async (el) => {
  const done = busy(el, 'Un instant…');
  if (Host.sb && Store.uid) await syncNow(); else await connectAccount();
  done(); toast(syncLabel().text, !['synced', 'pending'].includes(Sync.state)); renderAll();
};
ACT['sync-copy-sql'] = async () => {
  if (!Install.sql) return;
  let ok = false;
  try { await navigator.clipboard.writeText(Install.sql); ok = true; } catch (e) { ok = false; }
  if (ok) { Install.copied = true; toast('Code copié. Colle-le dans l’éditeur SQL de Supabase.'); }
  else { Install.show = true; toast('Copie automatique refusée par le navigateur : sélectionne le code affiché et copie-le.', true); }
  refreshSheet();
};
ACT['sync-check'] = async (el) => {
  const done = busy(el, 'Vérification…');
  Sync.blocked.clear();
  if (Host.sb && Store.uid) { setSyncState('connecting'); await syncNow(); } else await connectAccount();
  done();
  if (Sync.state === 'synced' || Sync.state === 'pending') { closeAllSheets(); toast('C’est activé : ta progression est envoyée sur ton compte et te suit sur tous tes appareils.'); }
  else if (Sync.state === 'not_installed') toast('Pas encore : le tableau n’est pas trouvé. Vérifie que « Run » a affiché « Success », puis réessaie.', true);
  else if (Sync.state === 'outdated') toast('Pas encore à jour : relance le code dans Supabase (Run), puis réessaie.', true);
  else if (Sync.state === 'signedout') { closeAllSheets(); openSheet('account'); }
  else toast(syncLabel().text, true);
  renderAll();
};
ACT['teacher-save'] = async (el) => {
  const s = Number(el.dataset.s); const date = ($('#tDate') || {}).value; const name = (($('#tName') || {}).value || '').trim().slice(0, 60);
  if (!validISO(date) || date > todayISO()) { toast('Choisis une date valide (aujourd’hui ou avant).', true); return; }
  const p = progressOf(s); p.teacher = { date, name, declaredByUser: true, at: nowStamp() }; if (!p.startedAt) p.startedAt = todayISO();
  await saveProgress(p); closeAllSheets(); renderAll(); toast('Mention enregistrée (renseignée par toi).');
};
ACT['teacher-del'] = async (el) => { const s = Number(el.dataset.s); const p = progressOf(s); p.teacher = null; await saveProgress(p); closeAllSheets(); renderAll(); };

/* --- Branchements --- */
function wire() {
  followWire();
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
    if (f.dataset.form === 'sign-in') {
      const email = (($('#accEmail') || {}).value || '').trim(); const pass = ($('#accPass') || {}).value || '';
      Account.email = email;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !pass) { Account.err = 'Entre ton e-mail et ton mot de passe.'; refreshSheet(); return; }
      signIn(email, pass);
      return;
    }
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
    resumeSync();
  });
  window.addEventListener('online', () => { Host.online = true; resumeSync(); scheduleRender(); });
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

/* ===== Modules complémentaires =====
   Un module (ex. « Lire et écrire l'arabe », coran/arabe.js) est chargé avant ce fichier et s'inscrit dans
   window.QR_MODULES. Il reçoit les briques communes : sauvegarde, pages, actions, lecteur audio unique. */
const MODULE_TABS = {};
const Mods = { api: null };
function renderArabeTab() { const root = $('#tab-arabe'); const f = MODULE_TABS.arabe; if (root && f) f(root); }
function initModules() {
  const mods = Array.isArray(window.QR_MODULES) ? window.QR_MODULES : [];
  const api = {
    $, $$, esc, icon, uid, clamp, isNum, plural, debounce, todayISO, addDays, daysBetween, nowStamp, dFull, dDM, dayName,
    UI, Store, Content, Player, PAGES, ACT, SHEETS, RECITERS,
    put, del, prefs, setPrefs, idbGet, idbPut, idbDel, idbAll, fetchJSON, loadSura, suraMeta, suraTitle,
    openPage, backPage, topPage, renderPage, renderAll, scheduleRender, swapHTML, pageHead, toast, openSheet, closeSheet, refreshSheet,
    runSequence, stopAudio, pauseAudio, resumeAudio, wordTimings, arHTML, playerNotify,
    addKinds(list) { for (const k of list) if (!KINDS.includes(k)) { KINDS.push(k); if (!Store.mem[k]) Store.mem[k] = new Map(); } },
    /* fusion d'une nature entre appareils (au lieu de « le plus récent écrase ») */
    setMerge(kind, fn) { MERGE[kind] = fn; },
    mergeDates, syncBanner,
    registerTab(name, fn) { MODULE_TABS[name] = fn; },
    /* réglages de l'agenda sur cet appareil (lecture seule) : clé Gemini pour la partie orale, par exemple */
    agendaSettings() { refreshAgendaDB(); const db = readAgendaDB(); return (db && db.settings) || {}; },
  };
  Mods.api = api;
  for (const m of mods) { try { m(api); } catch (e) { console.error('module', e); } }
  if (!MODULE_TABS.arabe && UI.tab === 'arabe') UI.tab = 'learn';
}

/* ===== Démarrage =====
   1) contenu (index), 2) progression enregistrée sur l'appareil, 3) compte (si l'agenda est connecté). */
function hideSplash() {
  const s = $('#splash'); if (!s || UI.splashGone) return;
  UI.splashGone = true; s.classList.add('is-gone'); setTimeout(() => s.remove(), 450);
}
/* Relie l'appli au compte. Rappelé après « Me connecter », au retour sur l'appli et au retour du réseau
   tant que le compte n'est pas relié (connexion faite entre-temps dans l'agenda, bibliothèque rechargée…). */
function connectAccount() {
  if (Host.connecting) return Host.connecting;
  Host.connecting = (async () => {
    if (!hostConfigured()) { setSyncState('local'); return; }
    await ensureSupabaseLib();
    initHost();
    // bibliothèque du compte injoignable (hors connexion) : si tu es connecté, tout partira au retour du réseau
    if (!Host.sb) { setSyncState(storedSessionUser() ? 'offline' : 'local'); return; }
    if (!Host.authWired) { Host.authWired = true; Host.sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { Store.uid = null; setSyncState('signedout'); } }); }
    const stored = storedSessionUser();
    const user = stored || await hostSessionUser();
    if (!user) { setSyncState('signedout'); return; }
    if (Store.owner !== user.id) {
      await adoptLocalData(user.id);
      await loadLocal(user.id);
      emitChange();
    }
    Store.uid = user.id; Host.uid = user.id; Host.email = user.email || '';
    Sync.blocked.clear(); Sync.refreshTried = false;
    setSyncState('connecting');
    await syncNow();
    clearInterval(Sync.timer);
    // toutes les minutes quand l'appli est affichée ; pas de relance en boucle tant que la sauvegarde n'est pas activée (on réessaie au retour sur l'appli)
    Sync.timer = setInterval(() => { if (document.visibilityState === 'visible' && !['not_installed', 'signedout', 'local'].includes(Sync.state)) syncNow(); }, 60000);
    const confirmed = await hostSessionUser();
    if (confirmed && confirmed.id !== user.id) location.reload(); // autre compte connecté entre-temps
  })().catch(() => setSyncState('error')).finally(() => { Host.connecting = null; });
  return Host.connecting;
}
/* Retour sur l'appli : compte pas encore relié → on réessaie ; relié → on synchronise */
function resumeSync() {
  if (Host.sb && Store.uid && Sync.state !== 'signedout') { syncNow(); return; }
  connectAccount();
}
/* « Me connecter » : e-mail et mot de passe tapés par toi, envoyés seulement au service de connexion du compte */
const Account = { busy: false, err: '', email: '' };
async function signIn(email, password) {
  if (Account.busy) return;
  Account.err = ''; Account.busy = true; refreshSheet();
  try {
    await ensureSupabaseLib(); initHost();
    if (!Host.sb) throw new Error('lib');
    const { data, error } = await Host.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data || !data.session) throw new Error('session');
    try { localStorage.setItem('qr-email', email); } catch (e) { /* rien */ }
    Account.busy = false; closeAllSheets();
    await connectAccount();
    toast(Sync.state === 'synced' ? 'Connecté : ta progression est la même sur tous tes appareils.' : Sync.state === 'not_installed' ? 'Connecté. Il reste à activer la sauvegarde en ligne (une seule fois).' : 'Connecté à ton compte.', false);
    renderAll();
  } catch (e) {
    const m = String((e && e.message) || ''); const st = Number(e && e.status) || 0;
    Account.err = m === 'lib' || isNetErr(e) ? 'Pas de connexion au compte pour l’instant (réseau). Réessaie dans un instant.'
      : /invalid login|invalid credentials|invalid grant/i.test(m) || st === 400 ? 'E-mail ou mot de passe incorrect.'
      : /not confirmed/i.test(m) ? 'Ce compte n’est pas encore confirmé (lien envoyé par e-mail à la création).'
      : st === 429 ? 'Trop d’essais d’affilée : attends une minute, puis réessaie.'
      : 'La connexion a échoué. Réessaie, ou connecte-toi dans l’agenda (Réglages).';
    Account.busy = false; refreshSheet();
  }
}
SHEETS.account = {
  render() {
    let email = Account.email;
    if (!email) { try { email = localStorage.getItem('qr-email') || ''; } catch (e) { /* rien */ } }
    if (!email) { const db = readAgendaDB(); email = (db && db.settings && db.settings.syncEmail) || ''; }
    return { title: 'Retrouver ta progression partout', body: `
      <p class="lede">Connecte-toi avec le compte de ton agenda StayClean. Mémoriser, Lire et écrire l’arabe (étapes, examens, notes, entraînement) : tout sera pareil sur ton téléphone et ton Mac.</p>
      <form class="acc-form" data-form="sign-in" novalidate>
        <label class="field"><span>E-mail</span><input id="accEmail" type="email" name="email" autocomplete="username" inputmode="email" required value="${esc(email)}"${email ? '' : ' autofocus'}></label>
        <label class="field"><span>Mot de passe</span><input id="accPass" type="password" name="password" autocomplete="current-password" required${email ? ' autofocus' : ''}></label>
        ${Account.err ? `<p class="notice notice--warn" role="alert">${icon('alert-circle')}<span>${esc(Account.err)}</span></p>` : ''}
        <button type="submit" class="btn btn--primary btn--block"${Account.busy ? ' disabled' : ''}>${Account.busy ? '<span class="spin" aria-hidden="true"></span>Connexion…' : `${icon('user-check', 'sm')}Me connecter`}</button>
      </form>
      <p class="fine">C’est le même compte que ton agenda StayClean. Ce que tu as fait ici sans compte est ajouté à ta progression ; rien n’est effacé.</p>` };
  },
  onClose() { Account.err = ''; Account.busy = false; },
};
/* Activer (ou mettre à jour) la sauvegarde en ligne : le code d'installation se lance une fois dans Supabase */
const Install = { sql: null, err: false, copied: false, show: false };
function loadInstallSQL() {
  if (Install.sql || Install.p) return Install.p;
  Install.p = fetch('supabase/mon-coran.sql?v=' + DATA_V, { cache: 'no-cache' }).then((r) => (r.ok ? r.text() : Promise.reject(new Error('sql')))).then((t) => { Install.sql = t; Install.err = false; refreshSheet(); return t; }, () => { Install.err = true; Install.p = null; refreshSheet(); });
  return Install.p;
}
SHEETS['sync-install'] = {
  render() {
    loadInstallSQL();
    const upd = Sync.state === 'outdated'; const ref = hostRef();
    const link = ref ? `https://supabase.com/dashboard/project/${encodeURIComponent(ref)}/sql/new` : 'https://supabase.com/dashboard';
    return { title: upd ? 'Mettre à jour la sauvegarde en ligne' : 'Activer la sauvegarde en ligne', body: `
      <p class="lede">${upd ? 'Ton compte garde déjà ta progression du Coran, mais pas encore celle de « Lire et écrire l’arabe ». Le même code d’installation, relancé une fois, l’ajoute.' : 'Une seule fois : ton compte a besoin d’un tableau pour garder ta progression de Mon Coran. Ça prend une minute, de préférence sur ton Mac.'}</p>
      <ol class="inst">
        <li><b>Copie le code d’installation</b>
          <button type="button" class="btn btn--soft btn--sm" data-act="sync-copy-sql"${Install.sql ? '' : ' disabled'}>${icon(Install.copied ? 'check' : 'copy', 'sm')}${Install.copied ? 'Code copié' : Install.err ? 'Code indisponible (réseau)' : Install.sql ? 'Copier le code' : 'Chargement…'}</button>
          ${Install.show && Install.sql ? `<textarea class="inst__sql" readonly rows="6" aria-label="Code d’installation">${esc(Install.sql)}</textarea><small>Sélectionne tout le texte ci-dessus et copie-le.</small>` : ''}</li>
        <li><b>Ouvre l’éditeur SQL de ton projet Supabase</b>
          <a class="btn btn--soft btn--sm" href="${esc(link)}" target="_blank" rel="noopener">${icon('link', 'sm')}Ouvrir Supabase</a></li>
        <li><b>Colle le code, puis appuie sur « Run »</b><small>Il crée seulement ce tableau (chaque compte ne voit que ses propres lignes) et ne touche à rien d’autre. On peut le relancer sans risque.</small></li>
        <li><b>Reviens ici</b>
          <button type="button" class="btn btn--primary btn--sm" data-act="sync-check">${icon('refresh', 'sm')}C’est fait, vérifier</button></li>
      </ol>
      <p class="fine">En attendant, rien n’est perdu : ta progression reste enregistrée sur cet appareil et partira sur ton compte dès que ce sera fait.</p>` };
  },
  onClose() { Install.copied = false; Install.show = false; },
};
async function boot() {
  try { NAV.fromAgenda = sessionStorage.getItem('qr.from') === 'agenda'; sessionStorage.removeItem('qr.from'); } catch (e) { NAV.fromAgenda = false; }
  loadUIState();
  try { if (/^#lire/.test(location.hash)) UI.tab = 'read'; else if (/^#arabe/.test(location.hash)) UI.tab = 'arabe'; else if (/^#progres/.test(location.hash)) UI.tab = 'progress'; } catch (e) { /* rien */ }
  initModules();
  wire();
  const stored = hostConfigured() ? storedSessionUser() : null;
  await loadLocal(stored ? stored.id : 'local');
  applyAmbiance();
  renderAll();
  try { await loadIndex(); } catch (e) { Content.indexError = e; }
  renderAll();
  setTimeout(hideSplash, 250);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (Content.index) loadGroups().catch(() => {});
  connectAccount();
}
/* Retour sur la page depuis l'historique : on rafraîchit */
window.addEventListener('pageshow', (e) => { if (!e.persisted) return; refreshAgendaDB(); scheduleRender(); resumeSync(); });
/* Accès pour le banc d'essai automatisé (aucune donnée réelle) */
window.__QR = { Store, Content, Player, Sync, UI, prefs, put, MERGE, syncNow, connectAccount, sameData, reciterId, selfKnown, dueReviews, buildSession, scheduleAfter, refreshMilestones, progressOf, verseChunks, searchSuras, versesOfPage, pageOfVerse, surahState, milestoneCount, stopAudio, Groups, loadGroups, unitStat, setStatus, whereAmI, suraKnown, juzParts, suraParts, allParts, setToday: (iso) => { _todayOverride = iso; scheduleRender(); }, renderAll };
boot();

})();
