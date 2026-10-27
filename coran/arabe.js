/* « Lire et écrire l'arabe » — module de Mon Coran (onglet « Arabe »).

   Le cours : 10 chapitres en 3 parties (coran/data/arabe/banque.json, construit par coran/sources/arabe/build_bank.py à
   partir de programme.py, lettres.py et du texte Tanzil). Un chapitre = des étapes numérotées (notion, exemples à écouter,
   3 questions de vérification), l'entraînement du chapitre, puis l'examen du chapitre. Tout est ouvert : l'appli montre
   seulement où tu en es et ce qui vient ensuite.

   Rien n'est inventé à l'écran : lettres et signes viennent de la banque, leurs formes (isolée, début, milieu, fin) sont
   produites par la police, les mots et passages sont ceux du texte coranique. L'audio des mots est la récitation
   pédagogique d'Al-Husary (EveryAyah, « Al-Mu'allim »), découpée avec les repères quran-align (CC BY 4.0) ; il n'est
   jamais attribué à une autre voix.

   Examens : 20 questions notées par l'appli (l'examen final : 30, ramenées sur 20), réponses tapées au clavier arabe de
   l'appli pour l'écriture ; réussi à partir de 16/20, sinon un examen similaire (autres questions). Partie orale
   facultative : la voix est envoyée à Google (Gemini, avec la clé de l'agenda) seulement après accord ; notée à part,
   à titre indicatif. Écriture à l'écran, photos de feuilles et enregistrements de voix restent sur l'appareil
   (supprimables). Aucun contenu n'a été relu par un enseignant et l'appli ne le prétend pas. */
(function () {
  'use strict';
  (window.QR_MODULES = window.QR_MODULES || []).push(function (api) {
    const { esc, icon, uid, clamp, plural, todayISO, daysBetween, dFull, dDM, Store, PAGES, ACT, put,
      idbGet, idbPut, idbDel, idbAll, fetchJSON, openPage, backPage, topPage, scheduleRender, swapHTML,
      pageHead, toast, stopAudio, loadSura, suraTitle } = api;
    api.addKinds(['ar_state', 'ar_att', 'ar_exam']);

    const BANK_V = '20261028c';
    const FICHES_V = '20261028c';
    const SEUIL = 16;
    /* Typographie française : espace insécable avant ; : ! ? » et après « (texte entre les balises seulement) */
    const frNb = (h) => (typeof h === 'string' ? h.replace(/(^|>)([^<]+)/g, (m, a, t) => a + t.replace(/ ([;:!?»])/g, ' $1').replace(/« /g, '« ')) : h);
    const swapFr = (root, h) => swapHTML(root, frNb(h));
    const ZWJ = '‍';
    const HARAKAT = /[ً-ْٰ۟-ۭٕٓٔ]/g;
    const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } };

    /* ===== Données ===== */
    const B = { d: null, p: null, err: null, words: new Map(), letters: new Map(), byCh: new Map(), units: new Map(), unitCh: new Map(), fiches: null, fichesP: null };
    function bank() {
      if (B.d) return Promise.resolve(B.d);
      if (!B.p) {
        B.p = fetchJSON(`coran/data/arabe/banque.json?v=${BANK_V}`).then((d) => {
          if (!d || d.format !== 1 || !Array.isArray(d.letters) || d.letters.length !== 28 || !Array.isArray(d.chapters)) throw new Error('banque');
          for (const w of d.words) B.words.set(w.id, w);
          for (const l of d.letters) { B.letters.set(l.id, l); B.byCh.set(l.ch, l); }
          for (const lv of d.levels) for (const u of lv.units) B.units.set(u.id, Object.assign({ lv: lv.n }, u));
          for (const c of d.chapters) for (const u of c.units) B.unitCh.set(u, c);
          B.d = d; B.err = null; scheduleRender(); return d;
        }).catch((e) => { B.err = e; B.p = null; scheduleRender(); throw e; });
      }
      return B.p;
    }
    function fiches() {
      if (B.fiches) return Promise.resolve(B.fiches);
      if (!B.fichesP) B.fichesP = fetchJSON(`coran/fiches/fiches.json?v=${FICHES_V}`).then((d) => { B.fiches = d; scheduleRender(); return d; }).catch((e) => { B.fichesP = null; scheduleRender(); throw e; });
      return B.fichesP;
    }
    const levelOf = (n) => B.d.levels[n];
    const skillName = (id) => { const s = B.d.skills.find((x) => x.id === id); return s ? s.court : id; };
    const CHS = () => B.d.chapters;
    const chOf = (id) => B.d.chapters.find((c) => c.id === id) || null;
    const partOf = (c) => B.d.parts.find((p) => p.id === c.part);
    const chOfUnit = (u) => B.unitCh.get(u) || null;
    const pc = (c) => `--pc: var(--ar-${c ? c.part : 'p0'}); --pc-tint: var(--ar-${c ? c.part : 'p0'}-tint); --pc-ink: var(--ar-${c ? c.part : 'p0'}-ink)`;
    const note20 = (x) => String(Math.round(Number(x) * 2) / 2).replace('.', ',');

    /* Lettres de base d'un mot, dans l'ordre de lecture (signes retirés ; alif porteur de hamza ou de liaison = alif) */
    function baseLetters(ar) {
      const out = [];
      for (const c of ar.replace(HARAKAT, '')) {
        if ('أإآٱ'.includes(c)) out.push('ا');
        else if (c === 'ى') out.push('ى');
        else if (c === 'ة') out.push('ة');
        else if (/[ء-ي]/.test(c)) out.push(c);
      }
      return out;
    }
    /* Formes d'une lettre produites par la police (jointures invisibles), jamais dessinées */
    function formOf(ch, pos) {
      const l = B.byCh.get(ch); const joins = l ? l.lie : true;
      if (pos === 'debut') return joins ? ch + ZWJ : ch;
      if (pos === 'milieu') return joins ? ZWJ + ch + ZWJ : ZWJ + ch;
      if (pos === 'fin') return ZWJ + ch;
      return ch;
    }
    const POS = { seule: 'seule', debut: 'au début', milieu: 'au milieu', fin: 'à la fin' };
    const ar = (t, cls = '') => `<span class="ar-t ${cls}" lang="ar" dir="rtl" translate="no">${esc(t)}</span>`;
    /* Texte français contenant des lettres arabes : chaque mot arabe est isolé (ordre d'affichage correct) */
    const AR_RUN = /([؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+)/g;
    const MARKS_ONLY = /^[ً-ٰٟۖ-ۭ]+$/;   // signe seul : posé sur un trait (ـ) pour être lisible
    const tx = (t) => esc(t).replace(AR_RUN, (m) => `<bdi class="ar-t" lang="ar" translate="no">${MARKS_ONLY.test(m) ? 'ـ' + m : m}</bdi>`);
    const sign = (ch) => ar(MARKS_ONLY.test(ch) ? 'ـ' + ch : ch);
    const exWord = (ex) => ex.uth.replace(/ (?=[ۖ-ۜ])/g, '');   // signe de pause collé au mot qui le porte
    const mixed = (t) => `<span dir="auto">${esc(t)}</span>`;   // titres mêlant français et lettres arabes
    /* Titre : tout en arabe (lettres d'un chapitre) → police du Coran, de droite à gauche ; sinon texte normal */
    const ttl = (t) => (/^[\u0600-\u06FF\s·]+$/.test(String(t)) ? ar(t, 'ar-ttl') : mixed(t));

    /* ===== État (compte) : étapes faites, notions lues. Les examens sont dans ar_exam, les réponses dans ar_att. ===== */
    const DEF = { v: 2, done: {}, seen: {} };
    function st() { const m = Store.mem.ar_state; const v = m && m.get('main'); return Object.assign({}, DEF, v || {}); }
    function saveSt(patch) { return put('ar_state', 'main', Object.assign(st(), patch)); }
    function atts() { const m = Store.mem.ar_att; return m ? [...m.values()].filter(Boolean).sort((a, b) => String(a.at).localeCompare(String(b.at))) : []; }
    function exams() { const m = Store.mem.ar_exam; return m ? [...m.values()].filter((e) => e && e.exam).sort((a, b) => String(b.at).localeCompare(String(a.at))) : []; }
    function logAtt(it, score, extra) {
      const rec = { at: new Date().toISOString(), d: todayISO(), t: it.t, sk: it.sk, u: it.u || null, lv: it.lv, key: it.key, ok: score, g: it.grade, mode: it.mode || 'train' };
      if (score < 1 && it.err) rec.err = it.err;
      if (extra) Object.assign(rec, extra);
      return put('ar_att', uid('a'), rec);
    }
    const stepDone = (u) => !!(st().done || {})[u];
    function examRecs(id) { return exams().filter((e) => e.exam === id); }   // la plus récente d'abord
    function examState(id) {
      const xs = examRecs(id); const best = xs.length ? Math.max(...xs.map((x) => Number(x.score) || 0)) : null;
      return { tries: xs.length, best, last: xs[0] || null, passed: best != null && best >= SEUIL, xs };
    }
    function chState(c) {
      const nd = c.units.filter(stepDone).length; const ex = examState(c.id);
      return Object.assign({ nd, total: c.units.length }, ex);
    }
    /* Où j'en suis : le premier chapitre pas encore réussi ; dans ce chapitre, la première étape pas faite */
    function position() {
      for (const c of CHS()) { const s = chState(c); if (!s.passed) return { c, u: c.units.find((x) => !stepDone(x)) || null, s }; }
      return { c: null, u: null, s: null };
    }
    /* Réussite récente d'un chapitre à l'entraînement (20 dernières réponses corrigées par l'appli) */
    function chPractice(c) {
      const set = new Set(c.units); const xs = atts().filter((a) => set.has(a.u) && a.g !== 'self' && (a.mode === 'train' || a.mode === 'check')).slice(-20);
      return { n: xs.length, p: xs.length ? xs.reduce((s, a) => s + (Number(a.ok) || 0), 0) / xs.length : 0 };
    }
    /* Erreurs récentes : éléments à reprendre (mal réussis lors des 14 derniers jours et pas réussis depuis) */
    function errorItems() {
      const last = new Map();
      for (const a of atts()) { if (!a.key) continue; last.set(a.key, a); }
      const out = [];
      for (const [k, a] of last) if (Number(a.ok) < 1 && daysBetween(a.d || todayISO(), todayISO()) <= 14) out.push({ key: k, t: a.t, sk: a.sk, err: a.err, lv: a.lv, u: a.u });
      return out;
    }

    /* ===== Hasard reproductible : une même graine donne le même tirage (chaque examen a la sienne) ===== */
    function rng(seed) { let s = 0; for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    const pickOne = (xs, R) => xs[Math.floor(R() * xs.length)];
    function shuffle(xs, R) { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
    function sample(xs, n, R) { return shuffle(xs, R).slice(0, n); }

    /* ===== Audio des mots : un seul son à la fois, coupé exactement à la fin du mot ===== */
    const Clip = { el: null, timer: 0, token: 0, playing: null };
    function clipStop() { Clip.token++; clearTimeout(Clip.timer); if (Clip.el) { try { Clip.el.pause(); } catch (e) { /* rien */ } } Clip.playing = null; }
    function verseUrl(s, a) { return B.d.audio.base + String(s).padStart(3, '0') + String(a).padStart(3, '0') + '.mp3'; }
    async function playClip(src, from, to, tag) {
      stopAudio(); clipStop();
      const tk = Clip.token; const el = Clip.el || (Clip.el = new Audio()); el.preload = 'auto';
      Clip.playing = tag || src;
      try {
        if (el.src !== src) el.src = src;
        await new Promise((res, rej) => { if (el.readyState >= 1) { res(); return; } const ok = () => { el.removeEventListener('loadedmetadata', ok); res(); }; el.addEventListener('loadedmetadata', ok); el.addEventListener('error', () => rej(new Error('audio')), { once: true }); });
        if (tk !== Clip.token) return false;
        el.currentTime = from / 1000; el.playbackRate = 1;
        await el.play();
        if (to != null) {
          const arm = () => { clearTimeout(Clip.timer); if (tk !== Clip.token) return; const left = to / 1000 - el.currentTime; if (left <= 0.02) { el.pause(); Clip.playing = null; return; } Clip.timer = setTimeout(arm, clamp(left * 1000 - 10, 5, 250)); };
          arm();
        }
        return true;
      } catch (e) {
        if (tk === Clip.token) toast('Le son n’a pas pu être lu (réseau ou serveur audio). L’exercice continue sans le son.', true);
        Clip.playing = null; return false;
      }
    }
    function playWord(w) { if (!w || !w.clip) return Promise.resolve(false); return playClip(verseUrl(w.loc[0], w.loc[1]), w.clip[0], w.clip[1], w.id); }
    function playVerse(s, a) { return playClip(verseUrl(s, a), 0, null, s + ':' + a); }

    /* ===== Choix des éléments (adaptatif : erreurs récentes et éléments peu vus d'abord) ===== */
    function weightOf(key) {
      const xs = atts().filter((a) => a.key === key).slice(-4);
      if (!xs.length) return 2;                                    // jamais vu
      const last = xs[xs.length - 1];
      if (Number(last.ok) < 1) return 4;                           // dernière réponse ratée
      const p = xs.reduce((s, a) => s + (Number(a.ok) || 0), 0) / xs.length;
      return p >= 1 ? 0.6 : 1.5;
    }
    function weighted(xs, n, R, keyFn) {
      const pool = xs.map((x) => ({ x, w: weightOf(keyFn(x)) * (0.5 + R()) }));
      pool.sort((a, b) => b.w - a.w);
      return pool.slice(0, n).map((p) => p.x);
    }
    // chapitre 1 : quelques lettres pour les repères (sens, points, les six lettres qui ne s'attachent pas)
    const L0_LETTERS = ['alif', 'ba', 'ta', 'tha', 'dal', 'dhal', 'ra', 'zay', 'waw', 'nun', 'ya'];
    const lettersOfUnit = (u) => (u && u.letters ? u.letters.map((id) => B.letters.get(id)) : []);
    function lettersUpTo(lvN, unitId) {
      // lettres déjà étudiées (unités de lettres jusqu'à l'unité donnée ; après les lettres : les 28)
      if (lvN > 1) return B.d.letters.slice();
      if (lvN < 1) return B.d.letters.filter((l) => L0_LETTERS.includes(l.id));
      const out = [];
      for (const u of levelOf(1).units) { out.push(...lettersOfUnit(u)); if (u.id === unitId) break; }
      return out;
    }
    /* Mot lisible avec les lettres déjà vues (chapitres de lettres) */
    const knownWord = (w, known) => baseLetters(w.ar).every((c) => known.has(c));

    /* ===== Exercices =====
       Un exercice = une consigne, un affichage, puis des choix, un clavier arabe (corrigés par l'appli) ou une
       auto-évaluation. { t, sk, u, lv, key, grade: 'auto'|'self', q, show, ch: [{v, html}] | kb, ans, expl, err } */
    const uniq = (xs) => [...new Set(xs)];
    const trCons = (l) => String(l.tr).split(' / ')[0];
    const VOW = { fatha: ['َ', 'a'], kasra: ['ِ', 'i'], damma: ['ُ', 'u'] };
    const wordHTML = (w, cls = 'ar-big') => ar(w.ar, cls);
    const SELF_TYPES = new Set(['trace', 'voix', 'passage', 'fluidite']);
    /* Mots proches d'un mot (pour des choix qui demandent vraiment de déchiffrer) */
    function nearWords(w, pool, R, n) {
      const a = baseLetters(w.ar);
      const score = (x) => { const b = baseLetters(x.ar); let sc = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) sc += 2; if (a[0] === b[0]) sc += 2; sc -= Math.abs(a.length - b.length) * 2; return sc + R() * 1.5; };
      return pool.filter((x) => x.id !== w.id && x.tr !== w.tr && Math.abs(x.n - w.n) <= 1).map((x) => [score(x), x]).sort((p, q) => q[0] - p[0]).slice(0, n).map((p) => p[1]);
    }
    function letterChoices(target, pool, R, n = 4) {
      const fam = B.d.letters.filter((l) => l.fam === target.fam && l.id !== target.id);
      const rest = shuffle(pool.filter((l) => l.id !== target.id && l.fam !== target.fam), R);
      return shuffle(uniq([target, ...shuffle(fam, R).slice(0, 2), ...rest]).slice(0, n), R);
    }
    const kbWord = (x) => x.n >= 2 && x.n <= 5 && baseLetters(x.ar).every((ch) => B.byCh.has(ch) || 'ءأإآؤئةى'.includes(ch));
    const GEN = {
      sens(c, R) {
        const pool = c.words.filter((x) => x.n >= 3 && x.n <= 4); if (!pool.length) return null;
        const w = weighted(pool, 1, R, (x) => 'W:' + x.id + ':debut')[0]; const bl = baseLetters(w.ar); const first = bl[0]; const last = bl[bl.length - 1];
        const opts = shuffle(uniq([first, last, ...bl, ...lettersUpTo(0).map((l) => l.ch)]).slice(0, 4), R);
        if (!opts.includes(first)) opts[0] = first;
        return { t: 'sens', sk: 'rec', key: 'W:' + w.id + ':debut', q: 'Quelle est la première lettre de ce mot ?', show: wordHTML(w), ch: shuffle(opts, R).map((ch) => ({ v: ch, html: ar(ch, 'ar-glyph') })), ans: first, err: 'ordre', after: w.id, expl: `L’arabe se lit de droite à gauche : la première lettre est celle tout à droite, ${ar(first)}.` };
      },
      points(c, R) {
        const l = pickOne(c.letters.filter((x) => x.pts[0] > 0 || R() < 0.3), R); const n = l.pts[0];
        return { t: 'points', sk: 'rec', key: 'L:' + l.id + ':pts', q: 'Combien de points porte cette lettre ?', show: ar(l.ch, 'ar-huge ar-glyph'), ch: [0, 1, 2, 3].map((v) => ({ v, html: `<b>${v}</b>` })), ans: n, err: 'point', expl: `${ar(l.ch)} (${esc(l.nom)}) : ${n ? `${n} point${n > 1 ? 's' : ''} ${esc(l.pts[1])}` : 'aucun point'}.` };
      },
      liaison(c, R) {
        const non = pickOne(B.d.nonJoining, R); const joins = sample(B.d.letters.filter((l) => l.lie).map((l) => l.ch), 3, R);
        return { t: 'liaison', sk: 'rec', key: 'L:' + B.byCh.get(non).id + ':lie', q: 'Laquelle de ces lettres ne s’attache jamais à la lettre suivante ?', show: null, ch: shuffle([non, ...joins], R).map((ch) => ({ v: ch, html: ar(ch, 'ar-glyph') })), ans: non, err: 'liaison', expl: `Six lettres ne s’attachent jamais à la suivante : ${ar(B.d.nonJoining.join(' '))}.` };
      },
      nom(c, R) {
        const l = weighted(c.focus, 1, R, (x) => 'L:' + x.id + ':nom')[0]; const ch = letterChoices(l, c.letters, R);
        return { t: 'nom', sk: 'rec', key: 'L:' + l.id + ':nom', q: 'Comment s’appelle cette lettre ?', show: ar(l.ch, 'ar-huge ar-glyph'), ch: ch.map((x) => ({ v: x.id, html: `<b>${esc(x.nom)}</b>` })), ans: l.id, errFam: l.id, expl: `${ar(l.ch)} s’appelle ${esc(l.nom)} (${ar(l.ar)}). ${tx(l.son)}`, letterAudio: l.nomAudio ? l.id : null };
      },
      lettre(c, R) {
        const l = weighted(c.focus, 1, R, (x) => 'L:' + x.id + ':ch')[0]; const ch = letterChoices(l, c.letters, R);
        return { t: 'lettre', sk: 'rec', key: 'L:' + l.id + ':ch', q: `Touche la lettre ${l.nom}.`, show: `<p class="ar-hint">${tx(l.son)}</p>`, ch: ch.map((x) => ({ v: x.id, html: ar(x.ch, 'ar-glyph') })), ans: l.id, errFam: l.id, expl: `${esc(l.nom)} s’écrit ${ar(l.ch)}.` };
      },
      forme(c, R) {
        const l = pickOne(c.focus, R); const pos = pickOne(l.lie ? ['debut', 'milieu', 'fin'] : ['milieu', 'fin'], R); const ch = letterChoices(l, c.letters, R);
        return { t: 'forme', sk: 'lie', key: 'L:' + l.id + ':' + pos, q: 'Quelle lettre est-ce ?', show: `${ar(formOf(l.ch, pos), 'ar-huge ar-glyph')}<p class="ar-cap">Forme ${esc(POS[pos])} d’un mot</p>`, ch: ch.map((x) => ({ v: x.id, html: ar(x.ch, 'ar-glyph') })), ans: l.id, errFam: l.id, expl: `C’est ${ar(l.ch)} (${esc(l.nom)}) ${esc(POS[pos])} d’un mot : ${ar(formOf(l.ch, pos))}.${l.lie ? '' : ' Elle ne s’attache pas à la lettre suivante.'}` };
      },
      son(c, R) {
        const known = new Set(c.letters.map((l) => l.id));
        const pairs = B.d.close.filter(([a, b]) => known.has(a) && known.has(b) && c.focus.some((l) => l.id === a || l.id === b));
        const pr = pairs.length ? pickOne(pairs, R) : null;
        const l = pr ? B.letters.get(pickOne([pr[0], pr[1]], R)) : pickOne(c.focus, R);
        const other = pr ? B.letters.get(pr[0] === l.id ? pr[1] : pr[0]) : null;
        const pool = uniq([l, other, ...shuffle(c.letters, R)].filter(Boolean)).slice(0, 4);
        return { t: 'son', sk: 'rec', key: 'L:' + l.id + ':son', q: 'Quelle lettre correspond à ce son ?', show: `<p class="ar-hint">${tx(l.son)}</p>`, ch: shuffle(pool, R).map((x) => ({ v: x.id, html: ar(x.ch, 'ar-glyph') })), ans: l.id, err: 'confusion', expl: `${ar(l.ch)} (${esc(l.nom)}) : ${tx(l.son)}${pr ? ` À distinguer : ${tx(pr[2])}.` : ''}` };
      },
      syllabe(c, R) {
        const l = pickOne(c.letters.filter((x) => x.id !== 'alif'), R); const vs = c.vowels && c.vowels.length ? c.vowels : ['fatha', 'kasra', 'damma']; const v = pickOne(vs, R);
        const cons = trCons(l); const opts = ['fatha', 'kasra', 'damma'].map((k) => cons + VOW[k][1]);
        return { t: 'syllabe', sk: 'voy', key: 'S:' + l.id + ':' + v, q: 'Comment se lit cette syllabe ?', show: ar(l.ch + VOW[v][0], 'ar-huge'), ch: uniq([...opts, cons]).map((x) => ({ v: x, html: `<b class="tl">${esc(x)}</b>` })), ans: cons + VOW[v][1], err: 'voyelle', expl: `${ar(l.ch + VOW[v][0])} = « ${esc(cons + VOW[v][1])} » : ${v === 'fatha' ? 'trait au-dessus, son « a »' : v === 'kasra' ? 'trait au-dessous, son « i »' : 'petit wāw au-dessus, son « ou »'}.` };
      },
      lecture(c, R) {
        const w = c.pickWord(R, 'lire'); if (!w) return null;
        const opts = uniq([w.tr, ...nearWords(w, c.allWords, R, 8).map((x) => x.tr)]).slice(0, 4);
        return { t: 'lecture', sk: 'dec', key: 'W:' + w.id + ':lire', word: w.id, q: 'Comment se lit ce mot ?', show: wordHTML(w), ch: shuffle(opts, R).map((x) => ({ v: x, html: `<b class="tl">${esc(x)}</b>` })), ans: w.tr, err: 'voyelle', after: w.id, expl: `${ar(w.ar)} se lit « ${esc(w.tr)} ». Écoute-le pour vérifier.` };
      },
      ecoute(c, R) {
        const w = c.pickWord(R, 'ecoute'); if (!w) return null;
        const opts = uniq([w, ...nearWords(w, c.allWords, R, 8)]).filter((x, i, xs) => xs.findIndex((y) => y.ar === x.ar) === i).slice(0, 4);
        return { t: 'ecoute', sk: c.ecouteSk || 'voy', key: 'W:' + w.id + ':ecoute', word: w.id, q: 'Écoute, puis touche le mot entendu.', show: null, listen: w.id, ch: shuffle(opts, R).map((x) => ({ v: x.id, html: ar(x.ar) })), ans: w.id, err: 'voyelle', expl: `Le mot entendu est ${ar(w.ar)} (« ${esc(w.tr)} »).` };
      },
      signe(c, R) {
        const ids = c.signs && c.signs.length ? c.signs : ['sukun', 'shadda', 'fathatan', 'kasratan', 'dammatan'];
        const sg = B.d.signs.find((x) => x.id === pickOne(ids, R)) || B.d.signs[3];
        const l = pickOne(c.letters.filter((x) => !['alif', 'waw', 'ya'].includes(x.id)), R);
        const all = B.d.signs.filter((x) => !x.id.startsWith('madd_') || sg.id.startsWith('madd_'));
        const opts = uniq([sg, ...shuffle(all.filter((x) => x.id !== sg.id), R)]).slice(0, 4);
        const show = sg.id.startsWith('madd_') ? l.ch + sg.ch : l.ch + (sg.id === 'shadda' ? 'َّ' : sg.ch);
        return { t: 'signe', sk: 'voy', key: 'G:' + sg.id, q: 'Que t’indique le signe sur cette lettre ?', show: ar(show, 'ar-huge'), ch: shuffle(opts, R).map((x) => ({ v: x.id, html: `<b>${esc(x.nom)}</b><small>${esc(x.son)}</small>` })), ans: sg.id, err: 'signe', expl: `${ar(show)} : ${tx(sg.role)}` };
      },
      article(c, R) {
        const w = c.pickWord(R, 'art', (x) => x.f.includes('article_sun') || x.f.includes('article_moon')); if (!w) return null; const sun = w.f.includes('article_sun');
        return { t: 'article', sk: 'voy', key: 'W:' + w.id + ':art', word: w.id, q: 'Dans ce mot, le ل de l’article se prononce-t-il ?', show: wordHTML(w), ch: [{ v: 'oui', html: '<b>Oui</b><small>lettre lunaire</small>' }, { v: 'non', html: '<b>Non</b><small>lettre solaire, doublée</small>' }], ans: sun ? 'non' : 'oui', err: 'liaison', after: w.id, expl: sun ? `Lettre solaire : le ل ne se prononce pas, la lettre suivante porte une shadda. ${ar(w.ar)} = « ${esc(w.tr)} ».` : `Lettre lunaire : le ل porte un sukūn et se prononce. ${ar(w.ar)} = « ${esc(w.tr)} ».` };
      },
      special(c, R) {
        const ids = c.special && c.special.length ? c.special : B.d.special.map((x) => x.id);
        const sp = B.d.special.find((x) => x.id === pickOne(ids, R)); const opts = uniq([sp, ...shuffle(B.d.special.filter((x) => x.id !== sp.id), R)]).slice(0, 4);
        return { t: 'special', sk: 'voy', key: 'X:' + sp.id, q: 'Quel est le rôle de cette forme ?', show: ar(sp.ch, 'ar-huge'), ch: shuffle(opts, R).map((x) => ({ v: x.id, html: `<b>${esc(x.nom)}</b>` })), ans: sp.id, err: 'signe', expl: `${ar(sp.ch)} — ${esc(sp.nom)} : ${tx(sp.role)}` };
      },
      mushaf(c, R) {
        const pool = (c.marks && c.marks.length ? c.marks : ['wasla', 'dagger', 'small_waw', 'small_ya', 'zero', 'madd', 'lazim', 'awla_waqf', 'jaiz', 'awla_wasl', 'mamnu', 'taanuq']).map((id) => B.d.mushaf.find((x) => x.id === id) || B.d.stops.find((x) => x.id === id)).filter(Boolean);
        const m = pickOne(pool, R); const all = [...B.d.mushaf, ...B.d.stops]; const opts = uniq([m, ...shuffle(pool.filter((x) => x.id !== m.id), R), ...shuffle(all.filter((x) => x.id !== m.id), R)]).slice(0, 4);
        const ex = B.d.mx && B.d.mx[m.id];
        const show = ex ? `${ar(exWord(ex), 'ar-big')}<p class="ar-cap">${esc(suraTitle(ex.s))} ${ex.s}:${ex.a} — le signe ${sign(m.ch)}</p>` : `${ar('ـ' + m.ch, 'ar-big')}`;
        return { t: 'mushaf', sk: 'voy', key: 'M:' + m.id, q: 'Que signifie ce signe du mushaf ?', show, ch: shuffle(opts, R).map((x) => ({ v: x.id, html: `<b>${esc(x.nom)}</b>` })), ans: m.id, err: 'signe', expl: `${sign(m.ch)} — ${esc(m.nom)} : ${tx(m.role)}` };
      },
      compose(c, R) {
        const w = c.pickWord(R, 'ecr', (x) => x.n >= 2 && x.n <= 5 && baseLetters(x.ar).every((ch) => B.byCh.has(ch))); if (!w) return null;
        const bl = baseLetters(w.ar); const fams = bl.map((ch) => B.byCh.get(ch)).filter(Boolean);
        const extra = uniq(fams.flatMap((l) => B.d.letters.filter((x) => x.fam === l.fam && !bl.includes(x.ch)).map((x) => x.ch)));
        const tiles = shuffle(uniq([...bl, ...shuffle(extra, R).slice(0, 2), ...shuffle(c.letters.map((l) => l.ch).filter((ch) => !bl.includes(ch)), R).slice(0, 2)]), R);
        return { t: 'compose', sk: 'ecr', key: 'W:' + w.id + ':ecr', word: w.id, q: 'Écoute le mot, puis écris-le en touchant ses lettres dans l’ordre.', listen: w.id, tiles, target: bl, ans: bl.join(''), err: 'ordre', expl: `Le mot ${ar(w.ar)} (« ${esc(w.tr)} ») s’écrit avec ${bl.map((ch) => ar(ch)).join(' + ')}, de droite à gauche. Les voyelles sont des signes : elles ne comptent pas ici.` };
      },
      /* --- Réponses tapées au clavier arabe de l'appli (corrigées par l'appli) --- */
      k_premiere(c, R) {
        const pool = c.words.filter((x) => x.n >= 3 && x.n <= 4); if (!pool.length) return null;
        const w = weighted(pool, 1, R, (x) => 'W:' + x.id + ':kp')[0]; const first = baseLetters(w.ar)[0];
        return { t: 'k_premiere', sk: 'rec', key: 'W:' + w.id + ':kp', q: 'Écris la première lettre de ce mot.', show: wordHTML(w), kb: 1, cmp: 'letters', loose: true, ans: first, err: 'ordre', after: w.id, expl: `La première lettre est celle tout à droite : ${ar(first)}.` };
      },
      k_lettre(c, R) {
        const l = weighted(c.focus, 1, R, (x) => 'L:' + x.id + ':kb')[0];
        return { t: 'k_lettre', sk: 'ecr', key: 'L:' + l.id + ':kb', q: `Écris la lettre ${l.nom}.`, show: `<p class="ar-hint">${tx(l.son)}</p>`, kb: 1, cmp: 'letters', ans: l.ch, errFam: l.id, expl: `${esc(l.nom)} s’écrit ${ar(l.ch)}.` };
      },
      k_syllabe(c, R) {
        const l = pickOne(c.letters.filter((x) => x.id !== 'alif'), R); const vs = c.vowels && c.vowels.length ? c.vowels : ['fatha', 'kasra', 'damma']; const v = pickOne(vs, R); const cons = trCons(l);
        return { t: 'k_syllabe', sk: 'ecr', key: 'S:' + l.id + ':' + v + ':kb', q: `Écris la syllabe « ${cons + VOW[v][1]} », avec sa voyelle.`, kb: 1, marks: 1, cmp: 'strict', ans: l.ch + VOW[v][0], err: 'voyelle', expl: `« ${esc(cons + VOW[v][1])} » s’écrit ${ar(l.ch + VOW[v][0])}.` };
      },
      k_dictee(c, R) {
        const w = c.pickWord(R, 'kd', kbWord); if (!w) return null; const full = !!c.full;
        return { t: 'k_dictee', sk: 'ecr', key: 'W:' + w.id + ':kd', word: w.id, q: full ? 'Écoute le mot, puis écris-le avec ses voyelles et ses signes.' : 'Écoute le mot, puis écris-le (les voyelles ne comptent pas).', listen: w.id, kb: 1, marks: c.lv >= 2 ? 1 : 0, hamza: c.lv >= 4 ? 1 : 0, cmp: full ? 'full' : 'letters', ans: w.ar, err: 'ordre', after: w.id, expl: `Le mot entendu s’écrit ${ar(w.ar)} (« ${esc(w.tr)} »).${full ? '' : ' Les voyelles ne comptaient pas.'}` };
      },
      /* --- Auto-évaluations (entraînement seulement, jamais dans un examen) --- */
      trace(c, R) {
        const w = c.traceWords && R() < 0.6 ? c.pickWord(R, 'trace', (x) => x.n <= 4) : null; const l = w ? null : pickOne(c.focus.length ? c.focus : c.letters, R);
        const model = w ? w.ar.replace(HARAKAT, '') : l.ch;
        return { t: 'trace', sk: 'ecr', grade: 'self', key: w ? 'W:' + w.id + ':trace' : 'L:' + l.id + ':trace', q: w ? 'Écris ce mot, puis compare avec le modèle.' : `Écris la lettre ${l.nom} plusieurs fois, puis compare avec le modèle.`, model, word: w ? w.id : null, err: 'forme', expl: 'Compare la forme, la place des points et l’attache entre les lettres. Le modèle est la lettre de la police, pas le tracé de la main : l’ordre des traits n’est pas montré.' };
      },
      voix(c, R) {
        const w = c.pickWord(R, 'voix'); if (!w) return null;
        return { t: 'voix', sk: c.voixSk || 'dec', grade: 'self', key: 'W:' + w.id + ':voix', word: w.id, q: 'Lis ce mot à voix haute, puis écoute la correction.', show: wordHTML(w), err: 'hesitation', expl: `${ar(w.ar)} = « ${esc(w.tr)} ».` };
      },
      passage(c, R) {
        const ps = c.passages.length ? c.passages : B.d.passages.filter((p) => p.lv === 5);
        const p = c.pickPassage ? c.pickPassage(R) : pickOne(ps, R);
        return { t: 'passage', sk: c.passageSk || 'pas', grade: 'self', key: 'P:' + p.s + ':' + p.a, verse: [p.s, p.a], marks: p.p, q: 'Lis ce passage à voix haute en respectant les arrêts, puis écoute la correction.', err: 'hesitation', expl: 'Compare : chaque mot juste, sans hésitation, et les arrêts aux bons endroits.' };
      },
      fluidite(c, R) {
        const ps = c.passages.length ? c.passages : B.d.passages.filter((p) => p.lv === 6);
        const p = c.pickPassage ? c.pickPassage(R) : pickOne(ps, R);
        return { t: 'fluidite', sk: 'flu', grade: 'self', key: 'F:' + p.s + ':' + p.a, verse: [p.s, p.a], marks: p.p, q: 'Cycle de fluidité : lis par petits groupes, réécoute, relis tout le passage.', err: 'hesitation', expl: 'On cherche la justesse d’abord, puis moins d’hésitations ; jamais la vitesse au prix de la justesse.' };
      },
    };

    /* ===== Contexte d'un exercice : lettres vues, mots, éléments de l'étape ===== */
    const SIGN_FEAT = { madd_a: 'long_a', madd_i: 'long_i', madd_u: 'long_u', sukun: 'sukun', shadda: 'shadda', fathatan: 'tanwin', kasratan: 'tanwin', dammatan: 'tanwin' };
    const SPECIAL_OF = { hamza: ['hamza', 'hamza_alif_haut', 'hamza_alif_bas', 'hamza_waw', 'hamza_ya'], fins: ['ta_marbuta', 'alif_maqsura'], lam_alif: ['lam_alif'] };
    function seenWordIds() { const s = new Set(); for (const a of atts()) if (a.key && a.key.startsWith('W:')) s.add(a.key.split(':')[1]); return s; }
    function ctxFor(lvN, unit, opts = {}) {
      const c = { lv: lvN, unit, letters: [], focus: [], words: [], allWords: [], passages: [], vowels: null, signs: null, special: null, marks: null, full: !!opts.full };
      c.letters = lettersUpTo(lvN, unit && unit.lv === 1 ? unit.id : (lvN === 1 ? levelOf(1).units[levelOf(1).units.length - 1].id : null));
      c.focus = unit && unit.letters ? lettersOfUnit(unit) : c.letters;
      const known = new Set(c.letters.map((l) => l.ch));
      if (lvN <= 1) c.allWords = B.d.words.filter((w) => w.lv === 2 && w.n <= 4 && knownWord(w, known));
      else if (lvN === 2) c.allWords = B.d.words.filter((w) => w.lv === 2);
      else if (lvN === 3) c.allWords = B.d.words.filter((w) => w.lv <= 3);
      else c.allWords = B.d.words.slice();
      if (c.allWords.length < 4 && lvN >= 2) c.allWords = B.d.words.filter((w) => w.lv === 2 && w.n <= 4);
      let fw = null;
      if (unit && unit.signs) {
        if (unit.signs.every((sg) => VOW[sg])) c.vowels = unit.signs;
        const fs = unit.signs.map((sg) => SIGN_FEAT[sg]).filter(Boolean);
        if (fs.length) { c.signs = unit.signs.filter((sg) => !VOW[sg]); fw = c.allWords.filter((w) => w.lv === 3 && fs.some((f) => w.f.includes(f))); }
      }
      if (unit && unit.feat) { const fs = unit.feat.split('|'); fw = c.allWords.filter((w) => fs.some((f) => w.f.includes(f))); }
      if (unit && SPECIAL_OF[unit.notion]) c.special = SPECIAL_OF[unit.notion];
      if (unit && unit.marks) c.marks = unit.marks;
      if (opts.fresh) { const seen = seenWordIds(); const fresh = (fw || c.allWords).filter((w) => !seen.has(w.id)); if (fresh.length >= 4) fw = fresh; }
      c.words = fw && fw.length >= 4 ? fw : c.allWords;
      c.traceWords = lvN >= 2;
      const pl = Math.max(5, Math.min(7, lvN));
      c.passages = B.d.passages.filter((p) => p.lv === pl);
      c.pickWord = (R, purpose, pred) => {
        let pool = c.words.filter((w) => !pred || pred(w));
        if (!pool.length) pool = c.allWords.filter((w) => !pred || pred(w));
        if (!pool.length) return null;
        return weighted(pool, 1, R, (w) => 'W:' + w.id + ':' + purpose)[0];
      };
      return c;
    }
    /* Exercices de chaque notion (entraînement) ; la vérification d'une étape n'en garde que les questions corrigées par l'appli */
    const UNIT_GEN = {
      sens: ['sens', 'k_premiere'], parties: ['points', 'nom'], liaisons: ['liaison', 'forme'],
      lettres: ['nom', 'lettre', 'forme', 'son', 'k_lettre', 'compose', 'nom', 'forme', 'trace'],
      voyelles: ['syllabe', 'k_syllabe'], mots_courts: ['lecture', 'ecoute', 'syllabe', 'k_dictee', 'voix'],
      longues: ['lecture', 'ecoute', 'signe', 'k_dictee', 'voix'], sukun: ['signe', 'lecture', 'ecoute', 'k_dictee'], shadda: ['signe', 'lecture', 'ecoute', 'k_dictee'], tanwin: ['signe', 'lecture', 'ecoute', 'k_dictee'],
      article: ['article', 'lecture', 'ecoute', 'k_dictee'], hamza: ['special', 'lecture', 'ecoute'], fins: ['special', 'lecture', 'ecoute', 'k_dictee'], lam_alif: ['special', 'lecture', 'compose'], liaison: ['lecture', 'ecoute', 'article'],
      mushaf: ['mushaf'], pauses: ['mushaf'], regles: ['mushaf', 'passage'], passages: ['passage', 'lecture'], fluidite: ['fluidite', 'lecture'], autonomie: ['lecture', 'passage'],
    };
    const CHECK_GEN = { passages: ['lecture', 'ecoute'], fluidite: ['lecture', 'ecoute'], autonomie: ['lecture', 'ecoute'], regles: ['mushaf', 'lecture'] };
    function genOne(t, c, R) { try { const it = GEN[t] ? GEN[t](c, R) : null; return it && (it.show !== undefined || it.ch || it.tiles || it.model || it.verse || it.listen || it.kb) ? it : null; } catch (e) { console.warn('exercice', t, e); return null; } }
    function makeSet(spec) {
      const R = rng(spec.seed || uid('s')); const c = spec.ctx || ctxFor(spec.lv, spec.unit, { fresh: spec.fresh, full: spec.full });
      const types = spec.types || (spec.unit ? UNIT_GEN[spec.unit.notion] : null) || ['nom', 'lettre'];
      const out = []; let guard = 0; let ti = Math.floor(R() * types.length);
      while (out.length < spec.n && guard++ < spec.n * 10) {
        const t = types[ti++ % types.length];
        const it = genOne(t, c, R); if (!it) continue;
        if (out.some((x) => x.key === it.key) && guard < spec.n * 6) continue;
        Object.assign(it, { lv: spec.lv, u: spec.unit ? spec.unit.id : (spec.u || null), mode: spec.mode || 'train', grade: it.grade || 'auto', id: uid('i') });
        out.push(it);
      }
      return out;
    }
    /* Reprendre un élément du journal des erreurs (même type d'exercice, même lettre / mot / signe) */
    function regen(e, R) {
      const [kind, id, x] = String(e.key).split(':'); const unit = e.u ? B.units.get(e.u) : null; const c = ctxFor(e.lv == null ? 1 : e.lv, unit);
      if (kind === 'L') { const l = B.letters.get(id); if (l) c.focus = [l]; }
      if (kind === 'W') { const w = B.words.get(id); if (w) c.words = [w]; }
      if (kind === 'S') { const l = B.letters.get(id); if (l) c.letters = [l]; if (x && VOW[x]) c.vowels = [x]; }
      if (kind === 'G') c.signs = [id];
      if (kind === 'X') c.special = [id];
      if (kind === 'M') c.marks = [id];
      if (kind === 'P' || kind === 'F') { const p = B.d.passages.find((q) => q.s === Number(id) && q.a === Number(x)) || { s: Number(id), a: Number(x), p: [] }; c.pickPassage = () => p; }
      const it = genOne(e.t, c, R); if (!it) return null;
      return Object.assign(it, { lv: e.lv, u: e.u || null, mode: 'train', grade: it.grade || 'auto', id: uid('i'), review: true });
    }
    /* Vérification d'une étape : 3 questions corrigées par l'appli */
    function checkSet(u) {
      const types = uniq((CHECK_GEN[u.notion] || UNIT_GEN[u.notion] || ['nom']).filter((t) => !SELF_TYPES.has(t) && t !== 'compose'));
      return makeSet({ lv: u.lv, unit: u, n: 3, types, seed: 'chk:' + u.id + ':' + uid(), mode: 'check' });
    }
    /* Entraînement d'un chapitre : 10 exercices mêlant ses étapes (lectures longues : deux au plus) */
    function trainSet(c, n = 10) {
      const R = rng('tr:' + c.id + ':' + uid()); const us = c.units.map((x) => B.units.get(x)); const per = Math.ceil(n / us.length) + 1;
      let items = [];
      us.forEach((u, i) => { items = items.concat(makeSet({ lv: u.lv, unit: u, n: per, seed: 'tr:' + c.id + ':' + i + ':' + uid(), mode: 'train' })); });
      items = shuffle(items, R); let long = 0;
      items = items.filter((it) => !['passage', 'fluidite'].includes(it.t) || ++long <= 2);
      if (items.length < n) { const u = us[us.length - 1]; items = items.concat(makeSet({ lv: u.lv, unit: u, n: n - items.length, types: ['lecture', 'ecoute'], seed: 'tr:' + c.id + ':plus:' + uid(), mode: 'train' })); }
      return items.slice(0, n);
    }
    function mixSet(n = 10) {
      const started = CHS().filter((c) => c.units.some((u) => stepDone(u) || (st().seen || {})[u]));
      const cs = started.length ? started : [CHS()[0]]; const R = rng('mix:' + uid());
      let items = []; for (const c of cs) items = items.concat(trainSet(c, Math.ceil(n / cs.length) + 1).filter((it) => !SELF_TYPES.has(it.t)));
      return shuffle(items, R).slice(0, n);
    }

    /* ===== Examens : 20 questions notées par l'appli (examen final : 30, ramenées sur 20) ===== */
    const EXAM_N = (id) => (id === 'final' ? 30 : 20);
    function examTitle(id) { const c = chOf(id); return c ? `Examen du chapitre ${c.n}` : 'Examen final'; }
    function buildExam(id) {
      const c = chOf(id); const secs = (B.d.chExams || {})[id] || []; const draw = uid();
      const lastUnit = c ? B.units.get(c.units[c.units.length - 1]) : null;
      const out = secs.map((sec, i) => {
        const lv = sec.lv != null ? sec.lv : c.lv;
        const ctx = ctxFor(lv, c && lv === c.lv && lv <= 1 ? lastUnit : null, { fresh: sec.fresh, full: sec.full });
        if (c && c.lv === 1 && lv === 1) ctx.focus = c.units.flatMap((u) => lettersOfUnit(B.units.get(u)));
        if (sec.marks) ctx.marks = sec.marks;
        if (c && c.id === 'c7') ctx.signs = ['madd_a', 'madd_i', 'madd_u', 'sukun', 'shadda', 'fathatan', 'kasratan', 'dammatan'];
        if (c && c.id === 'c7') ctx.words = ctx.allWords.filter((w) => w.lv === 3);
        const seed = `exam:${id}:${draw}:${i}`;
        let items = makeSet({ lv, n: sec.n, types: sec.types, seed, mode: 'exam', ctx, u: c ? c.units[0] : null });
        if (items.length < sec.n && sec.fb) items = items.concat(makeSet({ lv, n: sec.n - items.length, types: sec.fb, seed: seed + ':fb', mode: 'exam', ctx, u: c ? c.units[0] : null }));
        items.forEach((it) => { it.sec = i; it.grade = 'auto'; });
        return { i, titre: sec.titre, items };
      });
      return { id: uid('ex'), exam: id, draw, date: todayISO(), at: new Date().toISOString(), secs: out, i: 0, step: 'intro', oral: oralItems(id, c, draw), oi: 0 };
    }
    const examItems = (e) => e.secs.flatMap((s) => s.items);
    function examResult(e) {
      const items = examItems(e); const n = items.length || 1; const pts = items.reduce((a, it) => a + (it.done ? Number(it.done.ok) || 0 : 0), 0);
      const score = Math.round((pts / n) * 20 * 2) / 2;
      const parts = e.secs.map((s) => ({ titre: s.titre, n: s.items.length, ok: s.items.reduce((a, it) => a + (it.done ? Number(it.done.ok) || 0 : 0), 0) }));
      const oralDone = e.oral.filter((o) => o.res);
      const oral = oralDone.length ? { n: oralDone.length, ok: oralDone.reduce((a, o) => a + (o.res.ok || 0), 0) } : null;
      return { score, pts, n: items.length, parts, oral, passed: score >= SEUIL };
    }
    async function finishExam(e) {
      const out = examResult(e);
      const wrong = examItems(e).filter((it) => !it.done || it.done.ok < 1).map((it) => it.key);
      const rec = { at: new Date().toISOString(), d: todayISO(), exam: e.exam, draw: e.draw, score: out.score, pts: out.pts, n: out.n, parts: out.parts, oral: out.oral, passed: out.passed, wrong: wrong.slice(0, 40) };
      try { await put('ar_exam', e.id, rec); } catch (er) { toast('Ta note n’a pas pu être enregistrée sur ce téléphone (stockage refusé ou plein).', true); }
      return out;
    }

    /* ===== Clavier arabe de l'appli ===== */
    const KB_ROWS = [['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ'], ['د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص'], ['ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق'], ['ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي']];
    const KB_HAMZA = ['ء', 'أ', 'إ', 'آ', 'ؤ', 'ئ', 'ة', 'ى'];
    const KB_MARKS = [['َ', 'fatḥa'], ['ِ', 'kasra'], ['ُ', 'ḍamma'], ['ْ', 'sukūn'], ['ّ', 'shadda'], ['ً', 'tanwīn an'], ['ٍ', 'tanwīn in'], ['ٌ', 'tanwīn oun']];
    const KBN = { native: lsGet('qr-ar-kb-native', '') === '1' };
    /* Comparaison : sans les signes (lettres seules), ou avec (ordre des signes d'une lettre sans importance) */
    function normAr(s, full, loose) {
      s = String(s || '').normalize('NFC').replace(/[ـ‌‍]/g, '').replace(/ٱ/g, 'ا').replace(/ٰ/g, 'ا').replace(/اً/g, 'ًا').replace(/\s+/g, ' ').trim();
      if (loose) s = s.replace(/[أإآ]/g, 'ا');
      if (!full) return s.replace(/[ً-ٟۖ-ۭ]/g, '');
      let out = ''; let marks = [];
      const flush = () => { marks.sort((a, b) => (a === 'ّ' ? -1 : b === 'ّ' ? 1 : a < b ? -1 : 1)); out += marks.join(''); marks = []; };
      for (const ch of s) {
        if (/[ً-ٟ]/.test(ch)) marks.push(ch);
        else if (/[ۖ-ۭ]/.test(ch)) continue;
        else { flush(); out += ch; }
      }
      flush(); return out;
    }
    function kbScore(it, typed) {
      const okL = normAr(typed, false, it.loose) === normAr(it.ans, false, it.loose) && normAr(typed, false) !== '';
      if (it.cmp === 'letters') return okL ? 1 : 0;
      const okF = normAr(typed, true, it.loose) === normAr(it.ans, true, it.loose);
      if (it.cmp === 'strict') return okF ? 1 : 0;
      return okF ? 1 : okL ? 0.5 : 0;
    }
    function kbFieldHTML(it) {
      const v = it.kb && it.kb !== 1 ? String(it.kb) : '';
      return v ? `${ar(v, 'ar-kbf__v')}<span class="ar-kbf__caret" aria-hidden="true"></span>` : '<span class="ar-kbf__ph">Ta réponse s’écrit ici</span>';
    }
    function kbHTML(it, done) {
      const v = it.kb && it.kb !== 1 ? String(it.kb) : '';
      if (done) return `<div class="ar-kbf is-done" dir="rtl">${v ? ar(v, 'ar-kbf__v') : '<span class="ar-kbf__ph">(rien)</span>'}</div>`;
      if (KBN.native) {
        return `<label class="ar-kbn"><span class="sr-only">Ta réponse en arabe</span><input class="ar-kbn__in" type="text" lang="ar" dir="rtl" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(v)}" data-ar-kbin></label>
          <div class="ar-kb__bar"><button type="button" class="btn btn--ghost btn--sm" data-act="ar-kb-mode">${icon('keyboard', 'sm')}Clavier de l’appli</button><button type="button" class="btn btn--primary" data-act="ar-kb-ok"${v ? '' : ' disabled'}>${icon('check', 'sm')}Valider</button></div>
          <p class="fine">Avec le clavier arabe de ton téléphone (à ajouter dans ses réglages s’il n’y est pas).</p>`;
      }
      const key = (ch, label, cls) => `<button type="button" class="ar-kb__k${cls ? ' ' + cls : ''}" data-act="ar-kb" data-c="${esc(ch)}" aria-label="${esc(label)}"><span lang="ar" translate="no">${esc(cls === 'is-mark' ? 'ـ' + ch : ch)}</span></button>`;
      const names = (ch) => { const l = B.byCh.get(ch); return l ? l.nom : ({ 'ء': 'hamza', 'أ': 'alif hamza dessus', 'إ': 'alif hamza dessous', 'آ': 'alif madda', 'ؤ': 'wāw hamza', 'ئ': 'yā’ hamza', 'ة': 'tā’ marbūṭa', 'ى': 'alif maqṣūra' })[ch] || ch; };
      return `<div class="ar-kbf" dir="rtl" aria-live="polite" data-kbf>${kbFieldHTML(it)}</div>
        <div class="ar-kb" role="group" aria-label="Clavier arabe">
          ${KB_ROWS.map((r) => `<div class="ar-kb__r">${r.map((ch) => key(ch, names(ch))).join('')}</div>`).join('')}
          ${it.hamza ? `<div class="ar-kb__r ar-kb__r--8">${KB_HAMZA.map((ch) => key(ch, names(ch), 'is-alt')).join('')}</div>` : ''}
          ${it.marks ? `<div class="ar-kb__r ar-kb__r--8">${KB_MARKS.map(([ch, n]) => key(ch, n, 'is-mark')).join('')}</div>` : ''}
          <div class="ar-kb__r ar-kb__r--end">
            <button type="button" class="ar-kb__k is-wide" data-act="ar-kb-del" aria-label="Effacer le dernier signe">${icon('delete', 'sm')}<span>Effacer</span></button>
            <button type="button" class="ar-kb__k is-wide" data-act="ar-kb" data-c=" " aria-label="Espace"><span>espace</span></button>
          </div>
        </div>
        <div class="ar-kb__bar"><button type="button" class="btn btn--ghost btn--sm" data-act="ar-kb-mode">${icon('smartphone', 'sm')}Clavier du téléphone</button><button type="button" class="btn btn--primary" data-act="ar-kb-ok" data-kbok${v ? '' : ' disabled'}>${icon('check', 'sm')}Valider</button></div>`;
    }
    function kbRefresh(it) {
      const root = document.querySelector('#pages .page'); if (!root) return;
      const f = root.querySelector('[data-kbf]'); if (f) f.innerHTML = frNb(kbFieldHTML(it));
      const ok = root.querySelector('[data-kbok]'); if (ok) ok.disabled = !(it.kb && it.kb !== 1 && String(it.kb).trim());
    }

    /* ===== Partie orale (facultative) : la voix part chez Google (Gemini, clé de l'agenda) seulement après accord ===== */
    const ORAL_KEY = () => (Store.owner || 'local') + '|ar-oral-ok';
    const Oral = { consent: null, mr: null, stream: null, chunks: [], state: 'idle', timer: 0, busy: false };
    const geminiKey = () => { try { return String((api.agendaSettings() || {}).geminiKey || '').trim(); } catch (e) { return ''; } };
    const canRec = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    const oralPossible = () => !!geminiKey() && canRec();
    async function loadOralConsent() { if (Oral.consent == null) { try { Oral.consent = !!(await idbGet('kv', ORAL_KEY())); } catch (e) { Oral.consent = false; } } return Oral.consent; }
    function oralItems(id, c, draw) {
      if (c && c.n === 1) return [];
      const R = rng('oral:' + id + ':' + draw);
      if (c && c.lv === 1) {
        const ls = sample(c.units.flatMap((u) => lettersOfUnit(B.units.get(u))), 5, R);
        return ls.map((l) => ({ kind: 'nom', key: 'L:' + l.id + ':oral', show: l.ch, expect: [l.ar, l.ch], tr: l.nom, q: 'Dis le nom de cette lettre.' }));
      }
      const lv = c ? c.lv : 4; const ctx = ctxFor(lv, null); const pool = (c && c.id === 'c6' ? ctx.allWords : ctx.words).filter((w) => w.n >= 2 && w.n <= 5);
      return sample(pool, 5, R).map((w) => ({ kind: 'mot', key: 'W:' + w.id + ':oral', word: w.id, show: w.ar, expect: [w.ar], tr: w.tr, q: 'Lis ce mot à voix haute.' }));
    }
    function oralConsentLine() {
      if (Oral.consent == null) { loadOralConsent().then(() => scheduleRender()); return ''; }
      return Oral.consent ? `<button type="button" class="btn btn--ghost btn--sm" data-act="ar-oral-revoke">${icon('mic', 'sm')}Retirer mon accord pour l’oral</button>` : '';
    }
    function oralStop() {
      clearTimeout(Oral.timer);
      if (Oral.mr && Oral.mr.state !== 'inactive') { try { Oral.mr.stop(); } catch (e) { /* rien */ } }
      if (Oral.stream) Oral.stream.getTracks().forEach((t) => t.stop());
      Oral.stream = null;
    }
    /* Enregistrement → WAV 16 kHz mono (format accepté partout), silence détecté sans rien envoyer */
    async function toWav16(blob) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw new Error('audio');
      const ac = new AC();
      try {
        const buf = await blob.arrayBuffer();
        const audio = await new Promise((res, rej) => { const p = ac.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); });
        const src = audio.getChannelData(0); const ratio = audio.sampleRate / 16000; const n = Math.max(1, Math.floor(src.length / ratio));
        const pcm = new Int16Array(n); let peak = 0;
        for (let i = 0; i < n; i++) {
          const a = Math.floor(i * ratio); const b = Math.min(src.length, Math.max(a + 1, Math.floor((i + 1) * ratio))); let s = 0;
          for (let j = a; j < b; j++) s += src[j];
          const v = Math.max(-1, Math.min(1, s / (b - a))); if (Math.abs(v) > peak) peak = Math.abs(v); pcm[i] = Math.round(v * 0x7fff);
        }
        const dv = new DataView(new ArrayBuffer(44 + n * 2)); const w = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
        w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
        dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, pcm[i], true);
        return { bytes: new Uint8Array(dv.buffer), peak, secs: n / 16000 };
      } finally { try { ac.close(); } catch (e) { /* rien */ } }
    }
    function b64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
    async function geminiHear(wav, o) {
      const key = geminiKey(); if (!key) throw { code: 'nokey' };
      const what = o.kind === 'nom' ? `le nom de la lettre arabe « ${o.show} » (${o.tr}, en arabe ${o.expect[0]})` : `le mot arabe « ${o.show} » (lecture attendue : ${o.tr})`;
      const prompt = `Tu aides un adulte qui apprend à lire l’arabe du Coran. Il devait prononcer ${what}. Écoute l’enregistrement.\n`
        + '1) Écris en arabe, avec les voyelles, exactement ce que tu entends (pas ce qui était attendu si tu ne l’entends pas).\n'
        + '2) Dis si ce qui est prononcé correspond à ce qui était attendu, voyelles comprises.\n'
        + 'Réponds uniquement en JSON : {"entendu": "…", "juste": true ou false, "remarque": "une phrase courte en français, sans jugement sur le tajwid"}. '
        + 'Si l’enregistrement est vide ou inaudible : {"entendu": "", "juste": false, "remarque": "inaudible"}.';
      const body = { contents: [{ parts: [{ inline_data: { mime_type: 'audio/wav', data: b64(wav.bytes) } }, { text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } } };
      let r, j = null;
      try { r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
      catch (e) { throw { code: 'network' }; }
      try { j = await r.json(); } catch (e) { j = null; }
      if (!r.ok) { const m = String((j && j.error && (j.error.status + ' ' + j.error.message)) || ''); throw { code: r.status === 429 || /RESOURCE_EXHAUSTED/.test(m) ? 'quota' : /API_KEY|PERMISSION|UNAUTHENTICATED/.test(m) || r.status === 403 ? 'key' : 'service' }; }
      const cand = j && j.candidates && j.candidates[0];
      const txt = ((cand && cand.content && cand.content.parts) || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
      let res = null; try { res = JSON.parse(txt.replace(/^```(json)?|```$/g, '').trim()); } catch (e) { throw { code: 'service' }; }
      return { heard: String(res.entendu || '').slice(0, 80), juste: res.juste === true, remark: String(res.remarque || '').slice(0, 160) };
    }
    /* Note d'un mot prononcé : lettres reconnues (vérifiées par l'appli) et avis de l'IA sur les voyelles */
    function oralScore(o, h) {
      const L = (s) => normAr(s, false, true).replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, '');
      const heard = L(h.heard); const lettersOk = !!heard && o.expect.some((x) => L(x) === heard || (o.kind === 'nom' && heard.includes(L(x))));
      return lettersOk ? (h.juste ? 1 : 0.5) : (h.juste ? 0.5 : 0);
    }
    function oralErrText(code) {
      if (code === 'nokey' || code === 'key') return 'La clé Gemini de l’agenda est absente ou refusée : l’oral est passé (rien n’est compté).';
      if (code === 'quota') return 'Le quota Gemini est atteint pour l’instant : réessaie plus tard, ou passe ce mot.';
      if (code === 'network') return 'Pas de réseau : réessaie, ou passe ce mot.';
      if (code === 'mic') return 'Le micro n’est pas disponible (refusé ou absent).';
      return 'L’analyse n’a pas pu se faire : réessaie, ou passe ce mot.';
    }

    /* ===== Écriture à l'écran, photos de feuilles et enregistrements : sur l'appareil seulement ===== */
    const KEEP = (k) => (Store.owner || 'local') + '|ar-keep|' + k;
    async function keepBlob(kind, blob, meta) { const id = uid(kind); await idbPut('kv', KEEP(id), Object.assign({ id, kind, at: new Date().toISOString(), blob }, meta || {})); return id; }
    async function keptList() { try { return (await idbAll('kv', (Store.owner || 'local') + '|ar-keep|')).map(([, v]) => v).filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at))); } catch (e) { return []; } }
    async function keptDel(id) { await idbDel('kv', KEEP(id)); }
    function canvasHTML(model) {
      return `<div class="ar-canvas" data-model="${esc(model)}">
          <div class="ar-canvas__model" aria-hidden="true">${ar(model)}</div>
          <canvas class="ar-canvas__c" aria-label="Zone d’écriture : écris avec le doigt ou un stylet"></canvas>
        </div>
        <div class="ar-canvas__bar">
          <button type="button" class="btn btn--ghost btn--sm" data-act="ar-cv-clear">${icon('refresh', 'sm')}Effacer</button>
          <button type="button" class="btn btn--ghost btn--sm" data-act="ar-cv-model" aria-pressed="false">${icon('eye', 'sm')}Modèle en transparence</button>
          <button type="button" class="btn btn--ghost btn--sm" data-act="ar-cv-keep">${icon('download', 'sm')}Garder sur ce téléphone</button>
        </div>`;
    }
    function wireCanvas(root) {
      const cv = root.querySelector('.ar-canvas__c'); if (!cv || cv.dataset.wired) return; cv.dataset.wired = '1';
      const box = cv.parentElement; const dpr = Math.min(3, window.devicePixelRatio || 1);
      const size = () => { const r = box.getBoundingClientRect(); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); const g = cv.getContext('2d'); g.scale(dpr, dpr); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = Math.max(4, r.width / 70); g.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#123'; };
      size();
      let down = false; let last = null; const g = () => cv.getContext('2d');
      const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', (e) => { down = true; last = pt(e); cv.setPointerCapture(e.pointerId); box.classList.add('is-used'); e.preventDefault(); });
      cv.addEventListener('pointermove', (e) => { if (!down) return; const p = pt(e); const c = g(); c.beginPath(); c.moveTo(last[0], last[1]); c.lineTo(p[0], p[1]); c.stroke(); last = p; e.preventDefault(); });
      const up = () => { down = false; last = null; };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    }
    ACT['ar-cv-clear'] = (el) => { const root = el.closest('.ar-ex'); const cv = root && root.querySelector('.ar-canvas__c'); if (!cv) return; cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); cv.parentElement.classList.remove('is-used'); };
    ACT['ar-cv-model'] = (el) => { const root = el.closest('.ar-ex'); const box = root && root.querySelector('.ar-canvas'); if (!box) return; const on = !box.classList.contains('show-model'); box.classList.toggle('show-model', on); el.setAttribute('aria-pressed', String(on)); };
    ACT['ar-cv-keep'] = async (el) => {
      const root = el.closest('.ar-ex'); const cv = root && root.querySelector('.ar-canvas__c'); if (!cv) return;
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png')); if (!blob) return;
      try { await keepBlob('ecr', blob, { model: root.querySelector('.ar-canvas').dataset.model }); toast('Gardé sur ce téléphone seulement (Fiches PDF → Mes écrits). Tu peux le supprimer.'); } catch (e) { toast('Ce navigateur n’a pas pu le garder (stockage refusé ou plein).', true); }
    };

    /* ===== Affichage : briques ===== */
    const gradeLabel = (it) => (it.grade === 'self' ? 'Auto-évaluation' : 'Corrigé par l’appli');
    const pct = (x) => Math.round(x * 100);
    function wordChip(w, withTr = true) {
      if (!w) return '';
      return `<button type="button" class="ar-word" data-act="ar-play-word" data-w="${esc(w.id)}" aria-label="Écouter ${esc(w.tr)}">${ar(w.ar)}${withTr ? `<small class="tl">${esc(w.tr)}</small>` : ''}${icon('volume', 'sm')}</button>`;
    }
    const audioNote = () => `<p class="fine">Audio des mots : ${esc(B.d.audio.recitateur)}, ${esc(B.d.audio.style)} (${esc(B.d.audio.source)}), découpé mot par mot avec les repères ${esc(B.d.audio.reperes)}.</p>`;
    function loadingHTML() {
      if (B.err) return `<div class="empty"><p>Le cours « Lire et écrire l’arabe » n’a pas pu être chargé (réseau).</p><button type="button" class="btn btn--primary" data-act="ar-retry">${icon('refresh', 'sm')}Réessayer</button></div>`;
      return '<div class="loading"><span class="spin"></span></div>';
    }
    function topbar() {
      return `<div class="topbar topbar--main">
          <button type="button" class="icon-btn" data-act="go-agenda" aria-label="Revenir à l’agenda">${icon('chev-l')}</button>
          <span class="brand">${icon('book', 'sm')}Mon Coran</span>
          <button type="button" class="icon-btn" data-act="open-page" data-page="settings" aria-label="Réglages">${icon('settings')}</button>
        </div>`;
    }
    /* Pastille de chapitre (numéro dans la couleur de sa partie) */
    const chNum = (c, done) => `<span class="ar-num${done ? ' is-done' : ''}" style="${pc(c)}" aria-hidden="true">${done ? icon('check', 'sm') : c.n}</span>`;
    function chStatusText(c, s) {
      if (s.passed) return `Réussi · meilleure note ${note20(s.best)}/20`;
      if (s.tries) return `Examen : ${note20(s.best)}/20, à refaire (${SEUIL}/20 pour réussir)`;
      if (s.nd === s.total) return 'Étapes faites · examen à passer';
      if (s.nd) return `Étape ${s.nd + 1} sur ${s.total}`;
      return `${s.total} ${plural(s.total, 'étape', 'étapes')}`;
    }
    /* Évolution des notes d'un examen (de la plus ancienne à la plus récente) */
    function spark(xs) {
      const pts = xs.slice(0, 8).reverse(); if (pts.length < 2) return '';
      const W = 132; const H = 34; const pad = 4; const step = pts.length > 1 ? (W - pad * 2) / (pts.length - 1) : 0;
      const y = (v) => H - pad - (clamp(Number(v) || 0, 0, 20) / 20) * (H - pad * 2);
      const P = pts.map((e, i) => [pad + i * step, y(e.score)]);
      const label = 'Notes, de la plus ancienne à la plus récente : ' + pts.map((e) => note20(e.score)).join(' ; ') + ' sur 20';
      return `<svg class="ar-spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">
          <line class="ar-spark__seuil" x1="${pad}" x2="${W - pad}" y1="${y(SEUIL)}" y2="${y(SEUIL)}"/>
          ${P.length > 1 ? `<polyline class="ar-spark__l" points="${P.map((p) => p.join(',')).join(' ')}"/>` : ''}
          ${P.map((p, i) => `<circle class="ar-spark__d${Number(pts[i].score) >= SEUIL ? ' is-ok' : ''}${i === P.length - 1 ? ' is-last' : ''}" cx="${p[0]}" cy="${p[1]}" r="${i === P.length - 1 ? 4 : 3}"/>`).join('')}
        </svg>`;
    }

    /* ===== Onglet « Arabe » : Étudier · M'entraîner · Examens blancs · Fiches PDF ===== */
    const AR = { view: lsGet('qr-ar-view', 'study') };
    const VIEWS = [['study', 'Étudier', 'book-open'], ['train', 'M’entraîner', 'repeat'], ['exams', 'Examens blancs', 'award'], ['sheets', 'Fiches PDF', 'file-text']];
    function segHTML() {
      return `<nav class="ar-seg" aria-label="Lire et écrire l’arabe">${VIEWS.map(([v, l, ic]) => `<button type="button" class="ar-seg__b${AR.view === v ? ' is-on' : ''}" data-act="ar-view" data-v="${v}"${AR.view === v ? ' aria-current="page"' : ''}>${icon(ic, 'sm')}<span>${esc(l)}</span></button>`).join('')}</nav>`;
    }
    function renderTab(root) {
      if (!B.d) { swapFr(root, topbar() + loadingHTML()); bank().catch(() => {}); return; }
      const view = { study: viewStudy, train: viewTrain, exams: viewExams, sheets: viewSheets }[AR.view] || viewStudy;
      swapFr(root, `${topbar()}
        <header class="ar-top"><h1 class="ar-top__t">Lire et écrire l’arabe</h1>${segHTML()}</header>
        ${view()}`);
    }
    /* --- Étudier : où j'en suis, puis les 10 chapitres --- */
    function viewStudy() {
      const pos = position(); const nPassed = CHS().filter((c) => chState(c).passed).length;
      let now;
      if (!pos.c) {
        const f = examState('final');
        now = `<section class="ar-now" style="${pc(CHS()[9])}">
            <p class="ar-now__k">Les 10 chapitres sont réussis</p>
            <h2 class="ar-now__t">${f.passed ? `Examen final réussi : ${note20(f.best)}/20` : 'Il reste l’examen final, sur tout le programme'}</h2>
            <button type="button" class="btn btn--primary btn--xl" data-act="ar-exam" data-x="final">${icon('award')}<span>${f.tries ? 'Refaire l’examen final' : 'Passer l’examen final'}</span></button>
          </section>`;
      } else {
        const c = pos.c; const s = pos.s; const u = pos.u ? B.units.get(pos.u) : null; const k = u ? c.units.indexOf(u.id) + 1 : null;
        now = `<section class="ar-now" style="${pc(c)}">
            <p class="ar-now__k">Où j’en suis</p>
            <div class="ar-now__row">${chNum(c)}<div><p class="ar-now__c">Chapitre ${c.n} · ${u ? `étape ${k} sur ${c.units.length}` : 'étapes faites'}</p><h2 class="ar-now__t">${u ? ttl(u.titre) : ttl(c.titre)}</h2></div></div>
            <p class="ar-now__s">${u ? tx(u.resume) : s.tries ? `Ton dernier examen : ${note20(s.last.score)}/20. Il faut ${SEUIL}/20 : entraîne-toi sur ce qui t’a manqué, puis refais un examen similaire.` : 'Toutes les étapes du chapitre sont faites. Entraîne-toi un peu, puis passe l’examen du chapitre.'}</p>
            ${u ? `<button type="button" class="btn btn--primary btn--xl" data-act="ar-step" data-u="${esc(u.id)}">${icon('play')}<span>${stepDone(c.units[0]) || k > 1 ? 'Continuer' : 'Commencer'} : étape ${k}</span></button>`
              : `<div class="ar-now__acts"><button type="button" class="btn btn--primary btn--xl" data-act="ar-exam" data-x="${c.id}">${icon('award')}<span>${s.tries ? 'Refaire un examen similaire' : `Passer l’examen du chapitre ${c.n}`}</span></button>
                 <button type="button" class="btn btn--soft btn--block" data-act="ar-train-ch" data-ch="${c.id}">${icon('repeat', 'sm')}M’entraîner sur le chapitre ${c.n}</button></div>`}
            <div class="ar-now__prog"><span class="bar" role="img" aria-label="${nPassed} chapitres réussis sur 10"><span style="width:${nPassed * 10}%"></span></span><small>${nPassed} ${plural(nPassed, 'chapitre réussi', 'chapitres réussis')} sur 10</small></div>
          </section>`;
      }
      return `${now}
        ${B.d.parts.map((p) => `<section class="ar-part" style="--pc: var(--ar-${p.id}); --pc-tint: var(--ar-${p.id}-tint); --pc-ink: var(--ar-${p.id}-ink)">
            <h2 class="ar-part__t"><span>Partie ${p.n}</span>${esc(p.nom)}</h2><p class="ar-part__d">${esc(p.desc)}</p>
            <ol class="ar-chaps">${p.chapitres.map((n) => { const c = CHS()[n - 1]; const s = chState(c); const cur = pos.c && pos.c.id === c.id; return `<li><button type="button" class="ar-chap${cur ? ' is-cur' : ''}${s.passed ? ' is-passed' : ''}" data-act="ar-chap" data-ch="${c.id}">
                ${chNum(c, s.passed)}<span class="ar-chap__t"><b>${ttl(c.titre)}</b><small>${esc(chStatusText(c, s))}</small></span>
                <span class="ar-chap__steps" aria-hidden="true">${c.units.map((u) => `<i class="${stepDone(u) ? 'is-on' : ''}"></i>`).join('')}</span>${icon('chev-r', 'sm')}</button></li>`; }).join('')}</ol>
          </section>`).join('')}
        <p class="fine">Tout est ouvert : tu peux aller à n’importe quel chapitre. Chaque étape se valide par 3 questions ; chaque chapitre se termine par un examen noté sur 20 (${SEUIL}/20 pour le réussir). Contenus de sources identifiées (Sources et droits), non relus par un enseignant.</p>`;
    }
    /* --- M'entraîner --- */
    function viewTrain() {
      const errs = errorItems();
      return `<p class="lede">Choisis un chapitre : 10 exercices. Ce que tu rates revient plus souvent. Les exercices d’écriture à la main et de lecture à voix haute sont des auto-évaluations ; tout le reste est corrigé par l’appli.</p>
        ${errs.length ? `<button type="button" class="link-row" data-act="ar-train-errors">${icon('alert-circle', 'sm')}<span>Mes erreurs à reprendre<small class="link-row__sub">${errs.length} ${plural(errs.length, 'élément manqué', 'éléments manqués')} ces 14 derniers jours</small></span>${icon('chev-r', 'sm')}</button>` : ''}
        <button type="button" class="link-row" data-act="ar-train-mix">${icon('shuffle', 'sm')}<span>Tout réviser<small class="link-row__sub">Un mélange des chapitres commencés</small></span>${icon('chev-r', 'sm')}</button>
        ${B.d.parts.map((p) => `<section class="ar-part" style="--pc: var(--ar-${p.id}); --pc-tint: var(--ar-${p.id}-tint); --pc-ink: var(--ar-${p.id}-ink)"><h2 class="ar-part__t"><span>Partie ${p.n}</span>${esc(p.nom)}</h2>
            <ol class="ar-chaps">${p.chapitres.map((n) => { const c = CHS()[n - 1]; const pr = chPractice(c); return `<li><button type="button" class="ar-chap" data-act="ar-train-ch" data-ch="${c.id}">${chNum(c)}<span class="ar-chap__t"><b>${ttl(c.titre)}</b><small>${pr.n ? `${pct(pr.p)} % de réussite sur tes ${pr.n} dernières réponses` : 'Pas encore d’exercice fait'}</small></span>${icon('repeat', 'sm')}</button></li>`; }).join('')}</ol></section>`).join('')}
        <button type="button" class="link-row" data-act="ar-open" data-page="ar-errors">${icon('list', 'sm')}<span>Mon journal des erreurs<small class="link-row__sub">Ce qui t’a manqué, par type d’erreur</small></span>${icon('chev-r', 'sm')}</button>`;
    }
    /* --- Examens blancs : tous visibles, dans l'ordre --- */
    function examCard(id) {
      const c = chOf(id); const s = examState(id);
      return `<li class="ar-excard${s.passed ? ' is-passed' : ''}" style="${pc(c)}">
          <div class="ar-excard__h">${c ? chNum(c, s.passed) : `<span class="ar-num ar-num--final" aria-hidden="true">${icon('award', 'sm')}</span>`}
            <div class="ar-excard__t"><b>${esc(examTitle(id))}</b><small>${c ? ttl(c.titre) : 'Tout le programme'} · ${EXAM_N(id)} questions${id === 'final' ? ', ramenées sur 20' : ''}</small></div></div>
          ${s.tries ? `<div class="ar-excard__res"><p><b>${note20(s.best)}/20</b> meilleure note${s.passed ? ' · réussi' : ` · ${SEUIL}/20 pour réussir`}<small>${s.tries} ${plural(s.tries, 'essai', 'essais')} · dernier le ${esc(dDM(s.last.d))} (${note20(s.last.score)}/20)</small></p>${spark(s.xs)}</div>` : ''}
          <button type="button" class="btn ${s.tries ? 'btn--soft' : 'btn--primary'} btn--block" data-act="ar-exam" data-x="${id}">${icon(s.tries ? 'repeat' : 'play', 'sm')}${s.tries ? 'Refaire un examen similaire' : 'Passer l’examen'}</button>
        </li>`;
    }
    function viewExams() {
      return `<p class="lede">Tous tes examens sont là. Chacun compte ${20} questions notées par l’appli (l’examen final : 30, ramenées sur 20). Réussi à partir de ${SEUIL}/20 ; sinon, tu refais un examen similaire, avec d’autres questions.</p>
        <p class="line-info">${icon('mic', 'sm')}<span>${oralPossible() ? 'Partie orale à la fin de chaque examen (sauf le chapitre 1), notée à part par l’IA.' : 'Partie orale : elle s’ajoute quand une clé Gemini est enregistrée dans les réglages de l’agenda.'}</span></p>
        ${oralConsentLine()}
        ${B.d.parts.map((p) => `<section class="ar-part" style="--pc: var(--ar-${p.id}); --pc-tint: var(--ar-${p.id}-tint); --pc-ink: var(--ar-${p.id}-ink)"><h2 class="ar-part__t"><span>Partie ${p.n}</span>${esc(p.nom)}</h2>
            <ol class="ar-exlist">${p.chapitres.map((n) => examCard(CHS()[n - 1].id)).join('')}</ol></section>`).join('')}
        <section class="ar-part ar-part--final"><h2 class="ar-part__t"><span>À la fin</span>L’examen final</h2><ol class="ar-exlist">${examCard('final')}</ol></section>
        <p class="fine">${esc(B.d.validation.nature)}</p>`;
    }
    /* --- Fiches PDF : par chapitre, une fiche de révision et les fiches d'exercices --- */
    const Fiche = { eco: false };
    function sheetActs(v) {
      return `<div class="ar-fiche__acts">
          <a class="btn btn--soft btn--sm" href="${esc(v.pdf)}" target="_blank" rel="noopener">${icon('eye', 'sm')}Voir</a>
          <a class="btn btn--ghost btn--sm" href="${esc(v.pdf)}" download>${icon('download', 'sm')}Télécharger le PDF</a>
          ${v.png ? `<a class="btn btn--ghost btn--sm" href="${esc(v.png)}" download>${icon('image', 'sm')}Télécharger en image</a>` : ''}
          <button type="button" class="btn btn--ghost btn--sm" data-act="ar-print" data-src="${esc(v.pdf)}">${icon('printer', 'sm')}Imprimer</button>
        </div>`;
    }
    function sheetsHTML(onlyCh) {
      if (!B.fiches) { fiches().catch(() => {}); return B.fichesP ? '<div class="loading"><span class="spin"></span></div>' : `<div class="empty"><p>La liste des fiches n’a pas pu être chargée (réseau).</p><button type="button" class="btn btn--primary" data-act="ar-retry">${icon('refresh', 'sm')}Réessayer</button></div>`; }
      const F = B.fiches; const ver = Fiche.eco ? 'eco' : 'couleur';
      const list = (F.chapters || []).filter((x) => !onlyCh || x.ch === onlyCh);
      return `<div class="seg" role="radiogroup" aria-label="Version des fiches">
            <button type="button" class="seg__b${!Fiche.eco ? ' is-on' : ''}" role="radio" aria-checked="${!Fiche.eco}" data-act="ar-fiche-ver" data-v="couleur">Couleur</button>
            <button type="button" class="seg__b${Fiche.eco ? ' is-on' : ''}" role="radio" aria-checked="${Fiche.eco}" data-act="ar-fiche-ver" data-v="eco">Économique (encre)</button>
          </div>
          ${list.map((x) => { const c = chOf(x.ch); const r = x.revision[ver]; const open = onlyCh || (position().c || CHS()[0]).id === x.ch; return `<details class="ar-fich" style="${pc(c)}" id="fiches-${esc(x.ch)}"${open ? ' open' : ''}>
              <summary class="ar-fich__h">${chNum(c)}<span><small>Chapitre ${c.n} · ${1 + x.exos.length} ${plural(1 + x.exos.length, 'fiche', 'fiches')}</small>${ttl(c.titre)}</span>${icon('chev-d', 'sm')}</summary>
              <div class="ar-fiche is-rev"><img class="ar-fiche__img" src="${esc(r.thumb)}" alt="" loading="lazy" width="120" height="170">
                <div class="ar-fiche__t"><b>Fiche de révision</b><small>${esc(x.revision.desc)}</small></div>${sheetActs(r)}</div>
              ${x.exos.length ? `<h3 class="ar-fich__sub">Fiches d’exercices</h3><ul class="ar-fiche-list">${x.exos.map((f) => { const v = f[ver]; return `<li class="ar-fiche"><img class="ar-fiche__img" src="${esc(v.thumb)}" alt="" loading="lazy" width="120" height="170">
                  <div class="ar-fiche__t"><b>${ttl(f.titre)}</b><small>${esc(f.desc)}</small></div>${sheetActs(v)}</li>`; }).join('')}</ul>` : ''}
              ${x.cahier ? `<a class="link-row" href="${esc(x.cahier[ver].pdf)}" target="_blank" rel="noopener">${icon('layers', 'sm')}<span>Tout le chapitre en un seul PDF<small class="link-row__sub">Fiche de révision et fiches d’exercices</small></span>${icon('chev-r', 'sm')}</a>` : ''}
            </details>`; }).join('')}
          <p class="fine">${esc(F.note || '')}</p>`;
    }
    function viewSheets() {
      return `<p class="lede">Pour chaque chapitre : une fiche de révision (ce qu’il faut savoir pour l’examen) et des fiches d’exercices à remplir à la main. Rien n’oblige à imprimer : les examens se passent dans l’appli.</p>
        ${sheetsHTML(null)}
        <button type="button" class="link-row" data-act="ar-open" data-page="ar-kept">${icon('pencil', 'sm')}<span>Mes écrits, photos et enregistrements<small class="link-row__sub">Gardés sur ce téléphone seulement, supprimables</small></span>${icon('chev-r', 'sm')}</button>`;
    }

    /* ===== Un chapitre : ses étapes, l'entraînement, l'examen ===== */
    PAGES['ar-chapter'] = {
      label: () => 'Chapitre',
      render(p) {
        if (!B.d) { bank().catch(() => {}); return pageHead('Chapitre') + loadingHTML(); }
        const c = chOf(p.ch); if (!c) return null;
        const s = chState(c); const part = partOf(c); const todo = c.units.find((u) => !stepDone(u)); const pr = chPractice(c);
        return `${pageHead(`Partie ${part.n} · ${part.nom}`)}
          <header class="ar-chhead" style="${pc(c)}">${chNum(c, s.passed)}<div><p class="ar-chhead__k">Chapitre ${c.n} sur 10</p><h1 class="ar-chhead__t">${ttl(c.titre)}</h1></div></header>
          <p class="lede">${tx(c.but)}</p>
          <ol class="ar-path" style="${pc(c)}">
            ${c.units.map((id, i) => { const u = B.units.get(id); const d = stepDone(id); const cur = id === todo; return `<li class="ar-path__i${d ? ' is-done' : cur ? ' is-cur' : ''}"><button type="button" class="ar-path__b" data-act="ar-step" data-u="${esc(id)}">
                <span class="ar-path__n">${d ? icon('check', 'sm') : i + 1}</span><span class="ar-path__t"><small>Étape ${i + 1}</small><b>${ttl(u.titre)}</b><small>${d ? `Faite le ${esc(dDM(st().done[id]))}` : cur ? 'À faire maintenant' : 'À faire'}</small></span>${icon('chev-r', 'sm')}</button></li>`; }).join('')}
            <li class="ar-path__i${!todo && !s.passed ? ' is-cur' : ''}"><button type="button" class="ar-path__b" data-act="ar-train-ch" data-ch="${c.id}">
                <span class="ar-path__n">${icon('repeat', 'sm')}</span><span class="ar-path__t"><small>S’entraîner</small><b>10 exercices du chapitre</b><small>${pr.n ? `${pct(pr.p)} % de réussite récente` : 'Avant l’examen, autant de fois que tu veux'}</small></span>${icon('chev-r', 'sm')}</button></li>
            <li class="ar-path__i${s.passed ? ' is-done' : ''}"><button type="button" class="ar-path__b" data-act="ar-exam" data-x="${c.id}">
                <span class="ar-path__n">${s.passed ? icon('check', 'sm') : icon('award', 'sm')}</span><span class="ar-path__t"><small>Examen du chapitre</small><b>20 questions, noté sur 20</b><small>${s.tries ? `Meilleure note ${note20(s.best)}/20 · ${s.tries} ${plural(s.tries, 'essai', 'essais')}${s.passed ? ' · réussi' : ''}` : `Réussi à partir de ${SEUIL}/20`}</small></span>${icon('chev-r', 'sm')}</button></li>
          </ol>
          <section class="ar-savoir" style="${pc(c)}"><h2 class="sec-title">${icon('check-circle', 'sm')}À la fin du chapitre, tu sais</h2><ul>${c.savoir.map((x) => `<li>${tx(x)}</li>`).join('')}</ul></section>
          <button type="button" class="link-row" data-act="ar-sheets-ch" data-ch="${c.id}">${icon('file-text', 'sm')}<span>Fiches PDF du chapitre ${c.n}<small class="link-row__sub">Fiche de révision et fiches d’exercices</small></span>${icon('chev-r', 'sm')}</button>`;
      },
    };

    /* ===== Une étape : ce que tu vas apprendre, comprendre, exemples, vérification ===== */
    function lessonExamples(u) {
      const n = u.notion;
      if (u.letters) {
        return lettersOfUnit(u).map((l) => `<section class="ar-letter">
            <div class="ar-letter__head">${ar(l.ch, 'ar-huge ar-glyph')}<div><h3>${esc(l.nom)} <span class="ar-inline">${ar(l.ar)}</span></h3><p>${tx(l.son)}</p><p class="fine">API : ${esc(l.api)} · ${l.pts[0] ? `${l.pts[0]} point${l.pts[0] > 1 ? 's' : ''} ${esc(l.pts[1])}` : 'aucun point'} · ${l.lie ? 's’attache à la lettre suivante' : 'ne s’attache jamais à la lettre suivante'}</p></div></div>
            <ul class="ar-forms">${['seule', 'debut', 'milieu', 'fin'].map((p) => `<li>${ar(formOf(l.ch, p), 'ar-big ar-glyph')}<small>${esc(POS[p])}</small></li>`).join('')}</ul>
            ${l.nomAudio ? `<p class="fine">${icon('volume', 'sm')}Le nom de cette lettre est récité au début de la sourate ${l.nomAudio.loc[0]} (${esc(suraTitle(l.nomAudio.loc[0]))}) : <button type="button" class="linkish" data-act="ar-play-name" data-l="${esc(l.id)}">l’écouter</button>.</p>` : ''}
            <div class="ar-words">${l.ex.map((id) => wordChip(B.words.get(id))).join('')}</div>
          </section>`).join('');
      }
      if (n === 'sens' || n === 'mots_courts') {
        const ws = B.d.words.filter((w) => w.lv === 2 && w.n >= 3 && w.n <= 4).slice(0, 6);
        return `${n === 'sens' ? `<ol class="ar-steps">${ws.slice(0, 2).map((w) => `<li>${ar(w.ar, 'ar-big')} = ${baseLetters(w.ar).map((c) => ar(c)).join(' puis ')}</li>`).join('')}</ol>` : ''}<div class="ar-words">${ws.map((w) => wordChip(w)).join('')}</div>`;
      }
      if (n === 'parties') {
        const fam = B.d.families.ba;
        return `<p>${tx(fam.regle)}</p><ul class="ar-forms">${['ba', 'ta', 'tha', 'nun', 'ya'].map((id) => { const l = B.letters.get(id); return `<li>${ar(l.ch, 'ar-big ar-glyph')}<small>${esc(l.nom)}</small></li>`; }).join('')}</ul>
          <ul class="ar-forms">${['fatha', 'kasra', 'damma'].map((id) => { const sg = B.d.signs.find((x) => x.id === id); return `<li>${ar('ب' + sg.ch, 'ar-big')}<small>${esc(sg.nom)}</small></li>`; }).join('')}</ul>`;
      }
      if (n === 'liaisons') {
        const ws = B.d.words.filter((w) => w.lv === 2 && w.n === 3 && baseLetters(w.ar).some((c) => B.d.nonJoining.includes(c))).slice(0, 4);
        return `<ul class="ar-forms">${B.d.nonJoining.map((c) => `<li>${ar(c, 'ar-big ar-glyph')}<small>${esc(B.byCh.get(c).nom)}</small></li>`).join('')}</ul><div class="ar-words">${ws.map((w) => wordChip(w)).join('')}</div>`;
      }
      if (n === 'voyelles') {
        const sg = B.d.signs.find((x) => x.id === u.signs[0]);
        return `<ul class="ar-forms">${['ba', 'ta', 'nun', 'mim', 'lam', 'kaf'].map((id) => { const l = B.letters.get(id); return `<li>${ar(l.ch + sg.ch, 'ar-big')}<small class="tl">${esc(trCons(l) + sg.son)}</small></li>`; }).join('')}</ul>`;
      }
      if (u.signs || u.feat) {
        const c = ctxFor(u.lv, u); const ws = c.words.slice(0, 8);
        const sp = SPECIAL_OF[n] ? B.d.special.filter((x) => SPECIAL_OF[n].includes(x.id)) : [];
        const sg = u.signs ? B.d.signs.filter((x) => u.signs.includes(x.id)) : [];
        return `${sg.length ? `<ul class="ar-signs">${sg.map((x) => `<li>${ar('ب' + x.ch, 'ar-big')}<span><b>${esc(x.nom)}</b> ${tx(x.role)}</span></li>`).join('')}</ul>` : ''}
          ${sp.length ? `<ul class="ar-signs">${sp.map((x) => `<li>${ar(x.ch, 'ar-big')}<span><b>${esc(x.nom)}</b> ${tx(x.role)}</span></li>`).join('')}</ul>` : ''}
          <div class="ar-words">${ws.map((w) => wordChip(w)).join('')}</div>`;
      }
      if (u.marks) {
        const ms = u.marks.map((id) => B.d.mushaf.find((x) => x.id === id) || B.d.stops.find((x) => x.id === id)).filter(Boolean);
        return `<ul class="ar-signs">${ms.map((m) => { const ex = B.d.mx && B.d.mx[m.id]; return `<li>${ar(ex ? exWord(ex) : 'ـ' + m.ch, 'ar-big')}<span><b>${esc(m.nom)}</b> ${tx(m.role)}${ex ? `<small class="fine">${esc(suraTitle(ex.s))} ${ex.s}:${ex.a}</small>` : ''}</span></li>`; }).join('')}</ul>`;
      }
      if (['passages', 'fluidite', 'autonomie', 'regles'].includes(n)) {
        const pl = n === 'autonomie' ? 7 : n === 'fluidite' ? 6 : 5; const p = B.d.passages.find((x) => x.lv === pl && x.n <= 8) || B.d.passages.find((x) => x.lv === pl);
        if (!p) return '';
        return `<h2 class="sec-title">${icon('book-open', 'sm')}Un exemple</h2>${passageHTML({ verse: [p.s, p.a] })}<div class="ar-listen"><button type="button" class="btn btn--soft" data-act="ar-listen-verse" data-s="${p.s}" data-a="${p.a}">${icon('volume', 'sm')}Écouter ce verset (Al-Husary, pédagogique)</button></div>`;
      }
      return '';
    }
    PAGES['ar-step'] = {
      label: () => 'Étape',
      render(p) {
        if (!B.d) { bank().catch(() => {}); return pageHead('Étape') + loadingHTML(); }
        const u = B.units.get(p.u); if (!u) return null; const c = chOfUnit(u.id); const k = c.units.indexOf(u.id) + 1;
        const done = (st().done || {})[u.id]; const next = c.units[k] ? B.units.get(c.units[k]) : null;
        return `${pageHead(`Chapitre ${c.n} · ${c.titre}`)}
          <header class="ar-stephead" style="${pc(c)}"><p class="ar-stephead__k">${chNum(c)}<span>Chapitre ${c.n} · étape ${k} sur ${c.units.length}</span></p>
            <h1 class="screen-title">${ttl(u.titre)}</h1>${done ? `<span class="badge badge--memorisee">${icon('check', 'sm')}Étape faite le ${esc(dDM(done))}</span>` : ''}</header>
          <section class="ar-learn" style="${pc(c)}"><h2 class="sec-title">${icon('target', 'sm')}Ce que tu vas apprendre</h2><p class="ar-resume">${tx(u.resume)}</p></section>
          <div class="ar-comprendre"><h2 class="sec-title">${icon('lightbulb', 'sm')}Comprendre</h2><p>${tx(u.comprendre)}</p></div>
          ${lessonExamples(u)}
          ${(u.letters || u.signs || u.feat || ['sens', 'mots_courts', 'liaisons'].includes(u.notion)) ? audioNote() : ''}
          <section class="ar-checkcta" style="${pc(c)}">
            <h2 class="sec-title">${icon('check-circle', 'sm')}Vérifie que tu as compris</h2>
            <p>3 questions corrigées tout de suite. Avec 2 bonnes réponses sur 3, l’étape est faite.</p>
            <button type="button" class="btn btn--primary btn--block" data-act="ar-check" data-u="${esc(u.id)}">${icon('play', 'sm')}${done ? 'Me vérifier encore' : 'Je vérifie (3 questions)'}</button>
            ${done ? (next ? `<button type="button" class="btn btn--soft btn--block" data-act="ar-step" data-u="${esc(next.id)}" data-replace="1">${icon('arrow-r', 'sm')}Étape suivante : ${ttl(next.titre)}</button>` : `<button type="button" class="btn btn--soft btn--block" data-act="ar-chap" data-ch="${c.id}" data-replace="1">${icon('arrow-r', 'sm')}Retour au chapitre : entraînement et examen</button>`) : ''}
          </section>`;
      },
    };

    /* ===== Mes erreurs ===== */
    function errLabel(e) {
      const [kind, id, x] = String(e.key).split(':');
      if (kind === 'L') { const l = B.letters.get(id); return l ? `${ar(l.ch)} ${esc(l.nom)}` : esc(id); }
      if (kind === 'W') { const w = B.words.get(id); return w ? `${ar(w.ar)} <span class="tl">${esc(w.tr)}</span>` : esc(id); }
      if (kind === 'S') { const l = B.letters.get(id); return l ? ar(l.ch + (VOW[x] ? VOW[x][0] : '')) : esc(id); }
      if (kind === 'G') { const sg = B.d.signs.find((q) => q.id === id); return sg ? esc(sg.nom) : esc(id); }
      if (kind === 'X') { const sp = B.d.special.find((q) => q.id === id); return sp ? `${ar(sp.ch)} ${esc(sp.nom)}` : esc(id); }
      if (kind === 'M') { const m = B.d.mushaf.find((q) => q.id === id) || B.d.stops.find((q) => q.id === id); return m ? `${ar(m.ch)} ${esc(m.nom)}` : esc(id); }
      if (kind === 'P' || kind === 'F') return `${esc(suraTitle(Number(id)))} ${esc(id)}:${esc(x)}`;
      return esc(e.key);
    }
    PAGES['ar-errors'] = {
      label: () => 'Mes erreurs',
      render() {
        if (!B.d) { bank().catch(() => {}); return pageHead('Mes erreurs') + loadingHTML(); }
        const errs = errorItems(); const by = new Map();
        for (const e of errs) { const k = e.err || 'autre'; if (!by.has(k)) by.set(k, []); by.get(k).push(e); }
        const counts = new Map(); for (const a of atts()) if (a.err) counts.set(a.err, (counts.get(a.err) || 0) + 1);
        return `${pageHead('Mes erreurs')}
          <p class="lede">Ce que tu as manqué ces 14 derniers jours et pas encore réussi depuis. Chaque élément revient plus souvent dans tes exercices.</p>
          ${errs.length ? `<button type="button" class="btn btn--primary btn--block" data-act="ar-train-errors">${icon('repeat', 'sm')}Retravailler mes erreurs</button>` : '<div class="empty"><p>Rien à reprendre pour l’instant.</p></div>'}
          ${[...by.entries()].map(([k, xs]) => `<section class="ar-errgroup"><h2 class="sec-title">${esc(B.d.errors[k] || 'autre')} <small>(${xs.length})</small></h2>
              <ul class="ar-errlist">${xs.slice(0, 30).map((e) => `<li>${errLabel(e)}<small>${esc(skillName(e.sk))}</small></li>`).join('')}</ul></section>`).join('')}
          ${counts.size ? `<h2 class="sec-title">${icon('list', 'sm')}Depuis le début</h2><ul class="ar-errcount">${[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `<li><span>${esc(B.d.errors[k] || k)}</span><b>${n}</b></li>`).join('')}</ul>` : ''}`;
      },
    };

    /* ===== Fiches d'un chapitre ===== */
    PAGES['ar-sheets'] = {
      label: () => 'Fiches PDF',
      render(p) {
        const c = B.d && p.ch ? chOf(p.ch) : null;
        return `${pageHead(c ? `Chapitre ${c.n} · fiches PDF` : 'Fiches PDF')}${sheetsHTML(p.ch || null)}`;
      },
    };
    /* Écrits gardés et photos de feuilles : sur l'appareil seulement */
    const Kept = { list: null, urls: new Map() };
    function keptRefresh() { keptList().then((xs) => { Kept.list = xs; scheduleRender(); }); }
    PAGES['ar-kept'] = {
      label: () => 'Mes écrits et enregistrements',
      render() {
        if (!Kept.list) { keptRefresh(); return pageHead('Mes écrits et enregistrements') + '<div class="loading"><span class="spin"></span></div>'; }
        const url = (k) => { if (!Kept.urls.has(k.id) && k.blob) Kept.urls.set(k.id, URL.createObjectURL(k.blob)); return Kept.urls.get(k.id) || ''; };
        return `${pageHead('Mes écrits et enregistrements')}
          <p class="lede">Ce que tu as écrit à l’écran, les photos de tes feuilles et les enregistrements de ta voix restent sur ce téléphone : rien n’est envoyé, ni à ton compte ni à un service extérieur. Tu peux tout supprimer.</p>
          <label class="btn btn--soft btn--block ar-file">${icon('camera', 'sm')}Ajouter une photo de ma feuille<input type="file" accept="image/*" capture="environment" data-ar-photo hidden></label>
          ${Kept.list.length ? `<ul class="ar-kept">${Kept.list.map((k) => `<li>${k.kind === 'voix' ? `<audio controls preload="none" src="${url(k)}"></audio>` : `<img src="${url(k)}" alt="${k.kind === 'photo' ? 'Photo de feuille' : 'Écriture à l’écran'}">`}<span>${k.kind === 'photo' ? 'Photo de feuille' : k.kind === 'voix' ? 'Ma lecture' : 'Écrit à l’écran'}${k.model ? ` · ${k.kind === 'voix' ? esc(k.model) : ar(k.model)}` : ''}<small>${esc(dDM(String(k.at).slice(0, 10)))}</small></span><button type="button" class="icon-btn" data-act="ar-kept-del" data-id="${esc(k.id)}" aria-label="Supprimer">${icon('trash')}</button></li>`).join('')}</ul>
            <button type="button" class="btn btn--ghost btn--block" data-act="ar-kept-clear">${icon('trash', 'sm')}Tout supprimer</button>` : '<div class="empty"><p>Rien de gardé pour l’instant.</p></div>'}`;
      },
      onClose() { Kept.urls.forEach((u) => URL.revokeObjectURL(u)); Kept.urls.clear(); Kept.list = null; },
    };

    /* ===== Enregistrer sa lecture (entraînement : sur l'appareil seulement, jamais envoyé) ===== */
    const Rec = { mr: null, stream: null, chunks: [], blob: null, url: null, item: null, state: 'idle', t0: 0 };
    function recReset() {
      if (Rec.mr && Rec.mr.state !== 'inactive') { try { Rec.mr.stop(); } catch (e) { /* rien */ } }
      if (Rec.stream) Rec.stream.getTracks().forEach((t) => t.stop());
      if (Rec.url) URL.revokeObjectURL(Rec.url);
      Object.assign(Rec, { mr: null, stream: null, chunks: [], blob: null, url: null, item: null, state: 'idle' });
    }
    function recHTML(it) {
      if (!canRec()) return '';
      const mine = Rec.item === it.id;
      const s = mine ? Rec.state : 'idle';
      return `<div class="ar-rec">
          ${s === 'rec' ? `<button type="button" class="btn btn--soft" data-act="ar-rec-stop">${icon('stop', 'sm')}Arrêter l’enregistrement</button>`
            : `<button type="button" class="btn btn--ghost" data-act="ar-rec-start">${icon('mic', 'sm')}${s === 'done' ? 'Recommencer' : 'Enregistrer ma lecture'}</button>`}
          ${s === 'done' ? `<button type="button" class="btn btn--ghost" data-act="ar-rec-play">${icon('play', 'sm')}Me réécouter</button><button type="button" class="btn btn--ghost" data-act="ar-rec-keep">${icon('download', 'sm')}Garder</button>` : ''}
          <small>Ta voix reste sur ce téléphone : rien n’est envoyé.</small>
        </div>`;
    }
    ACT['ar-rec-start'] = async () => {
      const c = curItem(); if (!c || !c.it) return;
      recReset(); clipStop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream); const chunks = [];
        mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
        mr.onstop = () => { Rec.blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' }); Rec.url = URL.createObjectURL(Rec.blob); Rec.state = 'done'; if (Rec.stream) Rec.stream.getTracks().forEach((t) => t.stop()); Rec.stream = null; scheduleRender(); };
        Object.assign(Rec, { mr, stream, chunks, item: c.it.id, state: 'rec', t0: Date.now() });
        mr.start(); scheduleRender();
      } catch (e) { recReset(); toast('Le micro n’est pas disponible (refusé ou absent). Tu peux lire à voix haute sans enregistrer.', true); scheduleRender(); }
    };
    ACT['ar-rec-stop'] = () => { if (Rec.mr && Rec.mr.state !== 'inactive') Rec.mr.stop(); };
    ACT['ar-rec-play'] = () => { if (!Rec.url) return; clipStop(); stopAudio(); const el = Clip.el || (Clip.el = new Audio()); el.src = Rec.url; el.currentTime = 0; el.play().catch(() => {}); };
    ACT['ar-rec-keep'] = async () => {
      const c = curItem(); if (!Rec.blob || !c || !c.it) return;
      const label = c.it.verse ? `${suraTitle(c.it.verse[0])} ${c.it.verse[0]}:${c.it.verse[1]}` : (B.words.get(c.it.word) || {}).ar || '';
      try { await keepBlob('voix', Rec.blob, { model: label }); toast('Enregistrement gardé sur ce téléphone (Fiches PDF → Mes écrits et enregistrements). Tu peux le supprimer.'); } catch (e) { toast('Ce navigateur n’a pas pu le garder (stockage refusé ou plein).', true); }
    };

    /* ===== Déroulé des exercices (vérification d'une étape, entraînement, examen) ===== */
    const Run = { set: null };
    const Ex = { cur: null };
    function runState(src) {
      if (src === 'train') { const r = Run.set; return r ? { items: r.items, i: r.i, title: r.title, sub: r.sub, go(i) { r.i = i; } } : null; }
      if (src === 'exam') { const e = Ex.cur; if (!e) return null; const items = examItems(e); return { items, i: e.i, title: examTitle(e.exam), go(i) { e.i = i; }, exam: e }; }
      return null;
    }
    const SELF = [[1, 'Réussi', 'sans aide, sans erreur'], [0.5, 'Avec hésitation', 'juste, mais pas fluide'], [0, 'À reprendre', 'une erreur ou un blocage']];
    function selfButtons(it) {
      return `<div class="ar-self" role="group" aria-label="Ton auto-évaluation">${SELF.map(([v, l, s]) => `<button type="button" class="ar-self__b${it.done && it.done.ok === v ? ' is-on' : ''}" data-act="ar-self" data-v="${v}"${it.done ? ' disabled' : ''}><b>${esc(l)}</b><small>${esc(s)}</small></button>`).join('')}</div>`;
    }
    function verseText(s, a) { const d = api.Content.suras.get(s); return d ? (d.arBody || d.ar)[a - 1] : null; }
    function passageHTML(it) {
      const [s, a] = it.verse; const t = verseText(s, a);
      if (!t) { loadSura(s).then(scheduleRender, () => {}); return '<div class="loading"><span class="spin"></span></div>'; }
      return `<figure class="ar-passage"><p lang="ar" dir="rtl" translate="no">${esc(t)}</p><figcaption>${esc(suraTitle(s))} · verset ${a}</figcaption></figure>`;
    }
    function groupsOf(t) {
      const toks = t.split(' '); const out = []; let cur = [];
      for (const w of toks) { cur.push(w); if (/[ۖۗۘۙۚۛ]/.test(w) || cur.filter((x) => !/^[ۖۗۘۙۚۛ]$/.test(x)).length >= 4) { out.push(cur.join(' ')); cur = []; } }
      if (cur.length) out.push(cur.join(' '));
      return out;
    }
    function itemBody(it, examMode) {
      const done = it.done; const reveal = done && !examMode;
      if (it.ch) {
        return `<div class="ar-choices${it.ch.length > 4 ? ' ar-choices--many' : ''}" role="group" aria-label="Choix">${it.ch.map((c) => {
          const cls = reveal ? (String(c.v) === String(it.ans) ? ' is-right' : (String(c.v) === String(done.v) ? ' is-wrong' : '')) : (done && String(c.v) === String(done.v) ? ' is-on' : '');
          return `<button type="button" class="ar-choice${cls}" data-act="ar-pick" data-v="${esc(String(c.v))}"${done ? ' disabled' : ''}>${c.html}</button>`;
        }).join('')}</div>`;
      }
      if (it.kb) return `<div class="ar-kbwrap">${kbHTML(it, !!done)}</div>${reveal ? `<p class="ar-kb__ans">Réponse attendue : ${ar(it.ans, 'ar-big')}</p>` : ''}`;
      if (it.t === 'compose') {
        const comp = it.comp || [];
        return `<div class="ar-compose">
            <div class="ar-compose__out" aria-live="polite">${comp.length ? ar(comp.join(''), 'ar-big') : '<span class="ar-compose__ph">Touche les lettres dans l’ordre</span>'}</div>
            <div class="ar-tiles">${it.tiles.map((ch) => `<button type="button" class="ar-tile" data-act="ar-tile" data-ch="${esc(ch)}"${done ? ' disabled' : ''} aria-label="${esc(B.byCh.get(ch) ? B.byCh.get(ch).nom : ch)}">${ar(ch)}</button>`).join('')}</div>
            ${done ? (reveal ? `<p class="ar-compose__ans">Réponse : ${ar(it.ans, 'ar-big')}</p>` : '') : `<div class="ar-compose__bar"><button type="button" class="btn btn--ghost btn--sm" data-act="ar-tile-undo"${comp.length ? '' : ' disabled'}>${icon('chev-r', 'sm')}Effacer la dernière lettre</button><button type="button" class="btn btn--primary" data-act="ar-compose-check"${comp.length ? '' : ' disabled'}>${icon('check', 'sm')}Vérifier</button></div>`}
          </div>`;
      }
      if (it.t === 'trace') {
        return `<div class="ar-trace"><div class="ar-trace__model"><small>Modèle (police)</small>${ar(it.model, 'ar-huge' + (/[ً-ٰٟۖ-ۭ]/.test(it.model) ? '' : ' ar-glyph'))}</div>${done ? '' : canvasHTML(it.model)}</div>
          ${done ? '' : '<p class="ar-instr">Écris avec le doigt (ou sur papier), puis compare : forme, points, attaches. Note-toi :</p>'}${selfButtons(it)}`;
      }
      if (it.t === 'voix') {
        return `${done ? '' : recHTML(it)}<div class="ar-listen"><button type="button" class="btn btn--soft" data-act="ar-listen" data-w="${esc(it.word)}">${icon('volume', 'sm')}Écouter la correction</button></div>
          <p class="ar-instr">Après avoir lu à voix haute et écouté, note-toi :</p>${selfButtons(it)}`;
      }
      if (it.t === 'passage') {
        return `${passageHTML(it)}${done ? '' : recHTML(it)}<div class="ar-listen"><button type="button" class="btn btn--soft" data-act="ar-listen-verse" data-s="${it.verse[0]}" data-a="${it.verse[1]}">${icon('volume', 'sm')}Écouter la correction</button></div>
          <p class="ar-instr">Mots justes, sans hésiter, arrêts aux bons endroits ? Note-toi :</p>${selfButtons(it)}`;
      }
      if (it.t === 'fluidite') {
        const [s, a] = it.verse; const t = verseText(s, a); const step = it.step || 0;
        if (!t) { loadSura(s).then(scheduleRender, () => {}); return '<div class="loading"><span class="spin"></span></div>'; }
        const steps = ['Lis par petits groupes', 'Réécoute la correction', 'Relis tout d’une traite', 'Ton bilan'];
        const head = `<ol class="ar-flu-steps">${steps.map((x, i) => `<li class="${i === step ? 'is-cur' : i < step ? 'is-done' : ''}">${esc(x)}</li>`).join('')}</ol>`;
        if (step === 0) return `${head}<ul class="ar-groups">${groupsOf(t).map((g) => `<li lang="ar" dir="rtl" translate="no">${esc(g)}</li>`).join('')}</ul><button type="button" class="btn btn--primary btn--block" data-act="ar-flu" data-step="1">J’ai lu chaque groupe</button>`;
        if (step === 1) return `${head}${passageHTML(it)}<div class="ar-listen"><button type="button" class="btn btn--soft" data-act="ar-listen-verse" data-s="${s}" data-a="${a}">${icon('volume', 'sm')}Écouter la correction</button></div><button type="button" class="btn btn--primary btn--block" data-act="ar-flu" data-step="2">J’ai réécouté</button>`;
        if (step === 2) return `${head}${passageHTML(it)}${recHTML(it)}${it.t0 ? `<button type="button" class="btn btn--primary btn--block" data-act="ar-chrono" data-v="stop">${icon('stop', 'sm')}J’ai fini de lire</button>` : `<button type="button" class="btn btn--primary btn--block" data-act="ar-chrono" data-v="start">${icon('play', 'sm')}Je commence à lire (chrono)</button>`}<p class="fine">Le chrono sert seulement à suivre ta progression : la justesse passe avant la vitesse.</p>`;
        const cr = it.crit || {};
        return `${head}${it.secs ? `<p class="ar-instr">Lecture en ${it.secs} s.</p>` : ''}<ul class="ar-crit">${[['juste', 'Tous les mots justes'], ['fluide', 'Peu d’hésitations'], ['suite', 'Sans reprendre en arrière']].map(([k, l]) => `<li><button type="button" class="ar-crit__b${cr[k] ? ' is-on' : ''}" data-act="ar-crit" data-k="${k}" aria-pressed="${!!cr[k]}"${done ? ' disabled' : ''}>${icon(cr[k] ? 'check-circle' : 'circle', 'sm')}${esc(l)}</button></li>`).join('')}</ul>
          ${done ? '' : '<button type="button" class="btn btn--primary btn--block" data-act="ar-crit-ok">Valider mon bilan</button>'}`;
      }
      return '';
    }
    function feedbackHTML(it) {
      const d = it.done; if (!d) return '';
      const ok = d.ok >= 1; const half = d.ok > 0 && d.ok < 1; const self = it.grade === 'self';
      return `<div class="ar-fb ${self ? 'ar-fb--self' : ok ? 'ar-fb--ok' : half ? 'ar-fb--half' : 'ar-fb--ko'}" role="status">
          <p class="ar-fb__t">${icon(self ? 'check' : ok ? 'check-circle' : 'alert-circle', 'sm')}${self ? 'Noté (auto-évaluation).' : ok ? 'Juste.' : half ? 'Les lettres sont justes, pas les voyelles : ½ point.' : 'Pas tout à fait.'}</p>
          ${it.expl ? `<p class="ar-fb__x">${it.expl}</p>` : ''}
          ${it.after ? `<button type="button" class="btn btn--soft btn--sm" data-act="ar-listen" data-w="${esc(it.after)}">${icon('volume', 'sm')}Écouter le mot</button>` : ''}
        </div>`;
    }
    function itemHTML(it, n, total, examMode, secTitle) {
      const listenBtn = it.listen ? `<div class="ar-listen"><button type="button" class="btn btn--primary" data-act="ar-listen" data-w="${esc(it.listen)}">${icon('volume', 'sm')}Écouter</button></div>` : '';
      return `<article class="ar-ex" data-anchor="ex${n}">
          <p class="ar-ex__meta"><span>${n} / ${total}</span>${secTitle ? `<span>${esc(secTitle)}</span>` : ''}<span class="ar-tag ar-tag--${it.grade === 'self' ? 'self' : 'auto'}">${esc(gradeLabel(it))}</span></p>
          <h2 class="ar-ex__q">${esc(it.q)}</h2>
          ${listenBtn}
          ${it.show ? `<div class="ar-ex__show">${it.show}</div>` : ''}
          ${itemBody(it, examMode)}
          ${examMode ? (it.done ? `<p class="ar-saved">${icon('check', 'sm')}Réponse enregistrée. La correction sera donnée à la fin.</p>` : '') : feedbackHTML(it)}
          ${it.done ? `<button type="button" class="btn btn--primary btn--block ar-next" data-act="ar-next">${icon('arrow-r', 'sm')}${n >= total && examMode ? 'Terminer' : 'Continuer'}</button>` : ''}
        </article>`;
    }
    function errTag(it, v) {
      if (it.errFam) { const a = B.letters.get(String(v)) || B.byCh.get(normAr(v)); const b = B.letters.get(it.errFam); return a && b && a.fam === b.fam ? 'point' : 'confusion'; }
      return it.err || null;
    }
    function record(src, it, ok, v, extra) {
      if (it.done) return;
      const err = ok < 1 ? errTag(it, v) : null;
      it.done = { v: v == null ? null : String(v), ok, err };
      const mode = src === 'exam' ? 'exam' : (Run.set && Run.set.kind === 'check' ? 'check' : 'train');
      logAtt(Object.assign({}, it, { mode }), ok, Object.assign(err ? { err } : {}, extra || {}));
      scheduleRender();
    }
    const topRun = () => { const t = topPage(); return t && (t.name === 'ar-run' || t.name === 'ar-exam') ? t : null; };
    function curItem() { const t = topRun(); if (!t) return null; const rs = runState(t.props.src); if (!rs) return null; return { src: t.props.src, rs, it: rs.items[rs.i] }; }

    PAGES['ar-run'] = {
      label: () => 'Exercices',
      render(p) {
        const rs = runState(p.src); if (!rs || !B.d) return null;
        const set = Run.set;
        if (rs.i >= rs.items.length) {
          const n = rs.items.length; const sc = rs.items.reduce((a, x) => a + (x.done ? x.done.ok : 0), 0);
          if (set && set.kind === 'check') {
            const u = B.units.get(set.u); const c = chOfUnit(u.id); const k = c.units.indexOf(u.id); const next = c.units[k + 1] ? B.units.get(c.units[k + 1]) : null;
            const ok = sc >= 2;
            return `${pageHead(`Chapitre ${c.n} · étape ${k + 1}`)}
              <section class="ar-done" style="${pc(c)}">
                <h1 class="screen-title">${ok ? 'Étape faite' : 'Pas encore'}</h1>
                <p class="ar-done__score"><b>${String(Math.round(sc * 2) / 2).replace('.', ',')}</b> sur ${n}</p>
                <p class="notice${ok ? ' notice--ok' : ''}">${icon(ok ? 'check-circle' : 'info')}<span>${ok ? (next ? `Tu peux passer à l’étape ${k + 2} : « ${esc(next.titre)} ».` : `Toutes les étapes du chapitre ${c.n} sont faites. Entraîne-toi un peu, puis passe l’examen du chapitre.`) : 'Il faut 2 bonnes réponses sur 3. Relis l’étape, écoute les exemples, puis vérifie-toi à nouveau.'}</span></p>
                <ul class="ar-done__list">${rs.items.map((x) => `<li class="${!x.done ? '' : x.done.ok >= 1 ? 'is-ok' : x.done.ok > 0 ? 'is-mid' : 'is-ko'}">${icon(!x.done ? 'circle' : x.done.ok >= 1 ? 'check' : 'repeat', 'sm')}<span>${esc(x.q)}</span></li>`).join('')}</ul>
                ${ok ? (next ? `<button type="button" class="btn btn--primary btn--block" data-act="ar-step-next" data-u="${esc(next.id)}">${icon('arrow-r', 'sm')}Étape ${k + 2} : ${ttl(next.titre)}</button>`
                  : `<button type="button" class="btn btn--primary btn--block" data-act="ar-train-ch" data-ch="${c.id}">${icon('repeat', 'sm')}M’entraîner sur le chapitre ${c.n}</button><button type="button" class="btn btn--soft btn--block" data-act="ar-exam" data-x="${c.id}">${icon('award', 'sm')}Passer l’examen du chapitre ${c.n}</button>`)
                  : `<button type="button" class="btn btn--primary btn--block" data-act="back">${icon('book-open', 'sm')}Relire l’étape</button><button type="button" class="btn btn--soft btn--block" data-act="ar-check" data-u="${esc(u.id)}">${icon('repeat', 'sm')}Me vérifier à nouveau</button>`}
              </section>`;
          }
          return `${pageHead(rs.title)}
            <section class="ar-done">
              <h1 class="screen-title">Série terminée</h1>
              <p class="ar-done__score"><b>${String(Math.round(sc * 2) / 2).replace('.', ',')}</b> sur ${n}</p>
              <ul class="ar-done__list">${rs.items.map((x) => `<li class="${!x.done ? '' : x.done.ok >= 1 ? 'is-ok' : x.done.ok > 0 ? 'is-mid' : 'is-ko'}">${icon(!x.done ? 'circle' : x.done.ok >= 1 ? 'check' : 'repeat', 'sm')}<span>${esc(x.q)}</span><small>${esc(gradeLabel(x))}</small></li>`).join('')}</ul>
              <button type="button" class="btn btn--primary btn--block" data-act="ar-train-again">${icon('repeat', 'sm')}Une autre série</button>
              ${set && set.ch ? `<button type="button" class="btn btn--soft btn--block" data-act="ar-exam" data-x="${set.ch}">${icon('award', 'sm')}Passer l’examen du chapitre ${chOf(set.ch).n}</button>` : ''}
              <button type="button" class="btn btn--ghost btn--block" data-act="back">${icon('check', 'sm')}Terminer</button>
            </section>`;
        }
        const it = rs.items[rs.i];
        return `${pageHead(rs.title, { backLabel: 'Quitter' })}${rs.sub ? `<p class="ar-sec">${mixed(rs.sub)}</p>` : ''}${itemHTML(it, rs.i + 1, rs.items.length, false)}`;
      },
      after(p, el) { wireCanvas(el); },
      onClose() { clipStop(); recReset(); },
    };

    /* ===== Examen : annonce, questions, partie orale, résultat et correction ===== */
    function choiceHTML(it, v) { const c = (it.ch || []).find((x) => String(x.v) === String(v)); return c ? c.html : '—'; }
    function correctionHTML(e) {
      return `<ol class="ar-corr">${examItems(e).map((it, i) => {
        const d = it.done || { ok: 0, v: null }; const cls = d.ok >= 1 ? 'is-ok' : d.ok > 0 ? 'is-mid' : 'is-ko';
        const mine = it.kb ? (d.v ? ar(d.v) : '(rien)') : it.ch ? choiceHTML(it, d.v) : esc(d.v || '—');
        const good = it.kb ? ar(it.ans) : it.ch ? choiceHTML(it, it.ans) : ar(it.ans || '');
        return `<li class="ar-corr__i ${cls}"><p class="ar-corr__q"><span>${i + 1}.</span>${esc(it.q)}</p>
            ${it.show ? `<div class="ar-corr__show">${it.show}</div>` : ''}
            <p class="ar-corr__a"><span>Ta réponse</span>${mine}</p>${d.ok < 1 ? `<p class="ar-corr__a is-good"><span>Bonne réponse</span>${good}</p>` : ''}
            ${d.ok < 1 && it.expl ? `<p class="ar-corr__x">${it.expl}</p>` : ''}</li>`;
      }).join('')}</ol>`;
    }
    function oralHTML(e) {
      const o = e.oral[e.oi]; if (!o) return '';
      const st0 = Oral.state;
      const res = o.res;
      return `<p class="ar-sec">${icon('mic', 'sm')}Partie orale · ${e.oi + 1} sur ${e.oral.length} · notée à part, à titre indicatif</p>
        <article class="ar-ex ar-oral">
          <h2 class="ar-ex__q">${esc(o.q)}</h2>
          <div class="ar-ex__show">${ar(o.show, o.kind === 'nom' ? 'ar-huge ar-glyph' : 'ar-big')}</div>
          ${res ? `<div class="ar-fb ${res.ok >= 1 ? 'ar-fb--ok' : res.ok > 0 ? 'ar-fb--half' : 'ar-fb--ko'}" role="status"><p class="ar-fb__t">${icon(res.ok >= 1 ? 'check-circle' : 'alert-circle', 'sm')}${res.ok >= 1 ? 'L’IA a reconnu ce qu’il fallait.' : res.ok > 0 ? 'Presque : l’IA a un doute.' : 'L’IA n’a pas reconnu ce qu’il fallait.'}</p>
              <p class="ar-fb__x">L’IA a entendu : ${res.heard ? ar(res.heard) : '(rien de clair)'}${res.remark && res.remark !== 'inaudible' ? ` — ${esc(res.remark)}` : ''}</p>
              <p class="ar-fb__x">Attendu : ${ar(o.expect[0])} (« ${esc(o.tr)} »)</p></div>
            ${(o.tries || 0) < 2 && res.ok < 1 ? `<button type="button" class="btn btn--soft btn--block" data-act="ar-oral-again">${icon('repeat', 'sm')}Réessayer une fois</button>` : ''}
            <button type="button" class="btn btn--primary btn--block" data-act="ar-oral-next">${icon('arrow-r', 'sm')}${e.oi + 1 >= e.oral.length ? 'Voir mon résultat' : 'Mot suivant'}</button>`
          : st0 === 'busy' ? '<div class="loading"><span class="spin"></span><span>L’IA écoute…</span></div>'
          : `<button type="button" class="ar-mic${st0 === 'rec' ? ' is-rec' : ''}" data-act="ar-oral-rec" aria-pressed="${st0 === 'rec'}">${icon(st0 === 'rec' ? 'stop' : 'mic', 'lg')}<span>${st0 === 'rec' ? 'J’ai fini' : 'Appuie, puis parle'}</span></button>
            ${o.err ? `<p class="notice notice--warn">${icon('alert-circle')}<span>${esc(o.err)}</span></p>` : ''}
            <button type="button" class="btn btn--ghost btn--block" data-act="ar-oral-skip">Passer ce mot</button>`}
        </article>`;
    }
    PAGES['ar-exam'] = {
      label: () => 'Examen',
      render(p) {
        const e = Ex.cur; if (!e || !B.d) return null;
        const c = chOf(e.exam); const title = examTitle(e.exam); const N = examItems(e).length;
        if (e.step === 'intro') {
          const prev = examState(e.exam);
          return `${pageHead(title)}
            <header class="ar-chhead" style="${pc(c)}">${c ? chNum(c) : `<span class="ar-num ar-num--final" aria-hidden="true">${icon('award', 'sm')}</span>`}<div><p class="ar-chhead__k">${c ? `Chapitre ${c.n}` : 'Tout le programme'}</p><h1 class="ar-chhead__t">${c ? ttl(c.titre) : 'Examen final'}</h1></div></header>
            <p class="lede">${N} questions notées par l’appli${e.exam === 'final' ? ', ramenées sur 20' : ', une question = 1 point'}. Pas de correction pendant l’examen : tu la vois à la fin. Réussi à partir de ${SEUIL}/20.${prev.tries ? ` Ce sont d’autres questions que tes ${prev.tries} ${plural(prev.tries, 'essai', 'essais')} précédents.` : ''}</p>
            <table class="ar-grid"><thead><tr><th>Partie</th><th>Questions</th></tr></thead>
              <tbody>${e.secs.map((g) => `<tr><td>${esc(g.titre)}</td><td>${g.items.length}</td></tr>`).join('')}${e.oral.length ? `<tr><td>Partie orale (à part, à titre indicatif)</td><td>${oralPossible() ? e.oral.length : '—'}</td></tr>` : ''}</tbody></table>
            ${e.oral.length ? `<p class="fine">${oralPossible() ? 'Partie orale : tu prononces 5 lettres ou mots ; l’IA (Gemini, avec la clé de ton agenda) dit ce qu’elle entend. Ta voix ne part qu’avec ton accord, demandé au début de l’oral.' : 'Partie orale : elle s’ajoute quand une clé Gemini est enregistrée dans les réglages de l’agenda. Sans elle, l’examen est noté sur l’écrit seulement.'}</p>` : ''}
            <button type="button" class="btn btn--primary btn--block" data-act="ar-exam-go">${icon('play', 'sm')}Commencer</button>`;
        }
        if (e.step === 'oral-consent') {
          return `${pageHead(title)}
            <h1 class="screen-title">Partie orale</h1>
            <p class="lede">Tu vas prononcer ${e.oral.length} ${e.oral[0] && e.oral[0].kind === 'nom' ? 'noms de lettres' : 'mots'}. Pour chacun, l’appli enregistre quelques secondes de ta voix et les envoie à Google (Gemini), avec la clé enregistrée dans ton agenda, pour savoir ce qui est entendu.</p>
            <ul class="ar-savoir"><li>Rien n’est gardé dans l’appli : ni l’enregistrement, ni la réponse de l’IA en dehors de ta note.</li><li>Avec une clé Gemini gratuite, Google peut conserver ces enregistrements et s’en servir pour améliorer ses services.</li><li>L’IA juge si elle reconnaît le bon mot ; elle ne juge pas le tajwid. La note orale est à part, à titre indicatif.</li></ul>
            <button type="button" class="btn btn--primary btn--block" data-act="ar-oral-ok">${icon('check', 'sm')}J’accepte, je commence l’oral</button>
            <button type="button" class="btn btn--ghost btn--block" data-act="ar-oral-no">Passer l’oral cette fois</button>
            <p class="fine">Tu pourras retirer ton accord à tout moment dans « Examens blancs ».</p>`;
        }
        if (e.step === 'oral') return `${pageHead(title, { backLabel: 'Quitter l’examen (il ne sera pas compté)' })}${oralHTML(e)}`;
        if (e.step === 'done') {
          const out = e.out || examResult(e); const st1 = examState(e.exam);
          return `${pageHead(title)}
            <section class="ar-result${out.passed ? ' is-ok' : ''}" style="${pc(c)}">
              <p class="ar-result__k">${esc(title)}</p>
              <p class="ar-result__note"><b>${note20(out.score)}</b><span>/20</span></p>
              <p class="ar-result__m">${out.passed ? (out.score >= 18 ? 'Réussi, très bien.' : 'Réussi.') : `Pas encore : il faut ${SEUIL}/20.`}</p>
              ${out.oral ? `<p class="ar-result__o">${icon('mic', 'sm')}Oral : ${note20(out.oral.ok)} sur ${out.oral.n} reconnus par l’IA (à titre indicatif)</p>` : ''}
              ${spark(st1.xs)}
            </section>
            <ul class="ar-hist__p ar-hist__p--big">${out.parts.map((x) => `<li class="${x.ok >= x.n * 0.8 ? 'is-ok' : 'is-ko'}"><span>${esc(x.titre)}</span><b>${note20(x.ok)} / ${x.n}</b></li>`).join('')}</ul>
            <div class="ar-actions">
              <button type="button" class="btn ${out.passed ? 'btn--soft' : 'btn--primary'} btn--block" data-act="ar-exam-again">${icon('repeat', 'sm')}Refaire un examen similaire</button>
              ${c ? `<button type="button" class="btn btn--soft btn--block" data-act="ar-train-ch" data-ch="${c.id}">${icon('repeat', 'sm')}M’entraîner sur le chapitre ${c.n}</button>` : ''}
              <button type="button" class="btn btn--ghost btn--block" data-act="ar-exam-close">${icon('check', 'sm')}Terminer</button>
            </div>
            <h2 class="sec-title">${icon('list', 'sm')}La correction</h2>
            ${correctionHTML(e)}`;
        }
        const rs = runState('exam'); const it = rs.items[rs.i];
        if (!it || e.step === 'saving') return `${pageHead(title)}<div class="loading"><span class="spin"></span></div>`;
        const sec = e.secs[it.sec];
        return `${pageHead(title, { backLabel: 'Quitter l’examen (il ne sera pas compté)' })}
          <div class="ar-exprog" style="${pc(c)}"><span class="bar" role="img" aria-label="Question ${rs.i + 1} sur ${N}"><span style="width:${Math.round((rs.i / N) * 100)}%"></span></span><small>Question ${rs.i + 1} sur ${N}</small></div>
          ${itemHTML(it, rs.i + 1, N, true, sec.titre)}`;
      },
      after(p, el) { wireCanvas(el); },
      onClose() { clipStop(); recReset(); oralStop(); Oral.state = 'idle'; if (Ex.cur && Ex.cur.step !== 'done') Ex.cur = null; },
    };

    /* ===== Actions ===== */
    const needBank = async () => { try { await bank(); return true; } catch (e) { toast('Le cours « Lire et écrire l’arabe » n’a pas pu être chargé (réseau). Réessaie dans un instant.', true); return false; } };
    ACT['ar-retry'] = () => { B.err = null; B.p = null; B.fichesP = null; bank().catch(() => {}); scheduleRender(); };
    ACT['ar-view'] = (el) => { AR.view = el.dataset.v; lsSet('qr-ar-view', AR.view); clipStop(); scheduleRender(); try { window.scrollTo(0, 0); } catch (e) { /* rien */ } };
    ACT['ar-open'] = async (el) => { if (await needBank()) openPage(el.dataset.page, {}); };
    ACT['ar-chap'] = async (el) => { if (!(await needBank())) return; if (el.dataset.replace) { const t = topPage(); if (t && t.name === 'ar-step') backPage(); } openPage('ar-chapter', { ch: el.dataset.ch }); };
    ACT['ar-step'] = async (el) => {
      if (!(await needBank())) return; const id = el.dataset.u;
      const seen = Object.assign({}, st().seen || {}); if (!seen[id]) { seen[id] = todayISO(); saveSt({ seen }); }
      if (el.dataset.replace) { const t = topPage(); if (t && t.name === 'ar-step') backPage(); }
      openPage('ar-step', { u: id });
    };
    /* Après une vérification réussie : on ferme la vérification et l'étape, on ouvre l'étape suivante */
    ACT['ar-step-next'] = (el) => {
      for (let k = 0; k < 2; k++) { const t = topPage(); if (t && (t.name === 'ar-run' || t.name === 'ar-step')) backPage(); }
      openPage('ar-step', { u: el.dataset.u });
    };
    ACT['ar-sheets-ch'] = async (el) => { if (!(await needBank())) return; openPage('ar-sheets', { ch: el.dataset.ch }); };
    function startRun(set) {
      if (!set.items.length) { toast('Pas d’exercice disponible ici pour l’instant.'); return; }
      Run.set = Object.assign({ i: 0 }, set); clipStop();
      const t = topPage(); if (t && t.name === 'ar-run') backPage();
      openPage('ar-run', { src: 'train' });
    }
    ACT['ar-check'] = async (el) => {
      if (!(await needBank())) return; const u = B.units.get(el.dataset.u); if (!u) return; const c = chOfUnit(u.id);
      startRun({ kind: 'check', u: u.id, ch: c.id, title: `Chapitre ${c.n} · étape ${c.units.indexOf(u.id) + 1}`, sub: 'Vérification : 3 questions', items: checkSet(u) });
    };
    ACT['ar-train-ch'] = async (el) => {
      if (!(await needBank())) return; const c = chOf(el.dataset.ch); if (!c) return;
      const t = topPage(); if (t && t.name === 'ar-exam') { Ex.cur = null; backPage(); }
      startRun({ kind: 'train', ch: c.id, title: `M’entraîner · chapitre ${c.n}`, sub: c.titre, items: trainSet(c), again: { ch: c.id } });
    };
    ACT['ar-train-mix'] = async () => { if (!(await needBank())) return; startRun({ kind: 'train', title: 'Tout réviser', sub: 'Mélange des chapitres commencés', items: mixSet(), again: { mix: 1 } }); };
    ACT['ar-train-errors'] = async () => {
      if (!(await needBank())) return; const R = rng('err:' + uid());
      const items = shuffle(errorItems(), R).slice(0, 10).map((e) => regen(e, R)).filter(Boolean);
      startRun({ kind: 'train', title: 'Mes erreurs', sub: 'à reprendre', items, again: { err: 1 } });
    };
    ACT['ar-train-again'] = () => {
      const a = Run.set && Run.set.again; if (!a) { backPage(); return; }
      if (a.ch) ACT['ar-train-ch']({ dataset: { ch: a.ch } });
      else if (a.mix) ACT['ar-train-mix']();
      else ACT['ar-train-errors']();
    };
    ACT['ar-pick'] = (el) => { const c = curItem(); if (!c || !c.it || c.it.done) return; const v = el.dataset.v; record(c.src, c.it, String(v) === String(c.it.ans) ? 1 : 0, v); };
    ACT['ar-kb'] = (el) => {
      const c = curItem(); if (!c || !c.it || c.it.done || !c.it.kb) return;
      const cur = c.it.kb === 1 ? '' : String(c.it.kb); const ch = el.dataset.c;
      if (ch === ' ' && (!cur || cur.endsWith(' '))) return;
      c.it.kb = (cur + ch).slice(0, 40); kbRefresh(c.it);
    };
    ACT['ar-kb-del'] = () => { const c = curItem(); if (!c || !c.it || c.it.done || !c.it.kb) return; const cur = c.it.kb === 1 ? '' : String(c.it.kb); const a = [...cur]; a.pop(); c.it.kb = a.join('') || 1; kbRefresh(c.it); };
    ACT['ar-kb-ok'] = () => {
      const c = curItem(); if (!c || !c.it || c.it.done || !c.it.kb) return;
      const v = c.it.kb === 1 ? '' : String(c.it.kb).trim(); if (!v) return;
      record(c.src, c.it, kbScore(c.it, v), v);
    };
    ACT['ar-kb-mode'] = () => { KBN.native = !KBN.native; lsSet('qr-ar-kb-native', KBN.native ? '1' : ''); scheduleRender(); };
    document.addEventListener('input', (e) => {
      const inp = e.target; if (!inp || !inp.matches || !inp.matches('input[data-ar-kbin]')) return;
      const c = curItem(); if (!c || !c.it || c.it.done) return; c.it.kb = inp.value || 1;
      const ok = document.querySelector('#pages .page [data-act="ar-kb-ok"]'); if (ok) ok.disabled = !inp.value.trim();
    });
    ACT['ar-tile'] = (el) => { const c = curItem(); if (!c || !c.it || c.it.done) return; c.it.comp = (c.it.comp || []).concat(el.dataset.ch); scheduleRender(); };
    ACT['ar-tile-undo'] = () => { const c = curItem(); if (!c || !c.it || c.it.done) return; c.it.comp = (c.it.comp || []).slice(0, -1); scheduleRender(); };
    ACT['ar-compose-check'] = () => { const c = curItem(); if (!c || !c.it || c.it.done) return; const v = (c.it.comp || []).join(''); record(c.src, c.it, v === c.it.ans ? 1 : 0, v); };
    ACT['ar-self'] = (el) => { const c = curItem(); if (!c || !c.it || c.it.done) return; record(c.src, c.it, Number(el.dataset.v), el.dataset.v); };
    ACT['ar-flu'] = (el) => { const c = curItem(); if (!c || !c.it) return; c.it.step = Number(el.dataset.step); scheduleRender(); };
    ACT['ar-chrono'] = (el) => {
      const c = curItem(); if (!c || !c.it) return;
      if (el.dataset.v === 'start') { clipStop(); c.it.t0 = Date.now(); } else { c.it.secs = Math.max(1, Math.round((Date.now() - (c.it.t0 || Date.now())) / 1000)); c.it.step = 3; }
      scheduleRender();
    };
    ACT['ar-crit'] = (el) => { const c = curItem(); if (!c || !c.it || c.it.done) return; c.it.crit = Object.assign({}, c.it.crit || {}, { [el.dataset.k]: !(c.it.crit || {})[el.dataset.k] }); scheduleRender(); };
    ACT['ar-crit-ok'] = () => { const c = curItem(); if (!c || !c.it || c.it.done) return; const n = Object.values(c.it.crit || {}).filter(Boolean).length; record(c.src, c.it, Math.round((n / 3) * 2) / 2, null, c.it.secs ? { secs: c.it.secs } : null); };
    async function examToEnd(e) {
      if (e.oral.length && oralPossible()) { await loadOralConsent(); e.step = Oral.consent ? 'oral' : 'oral-consent'; e.oi = 0; return; }
      await examSave(e);
    }
    async function examSave(e) { e.step = 'saving'; scheduleRender(); e.out = await finishExam(e); e.step = 'done'; }
    ACT['ar-next'] = async () => {
      const t = topRun(); if (!t) return; const rs = runState(t.props.src); if (!rs) return;
      clipStop(); recReset(); rs.go(rs.i + 1);
      if (t.props.src === 'train' && Run.set && Run.set.kind === 'check' && rs.i + 1 >= rs.items.length) {
        const sc = rs.items.reduce((a, x) => a + (x.done ? x.done.ok : 0), 0);
        if (sc >= 2) { const done = Object.assign({}, st().done || {}); if (!done[Run.set.u]) { done[Run.set.u] = todayISO(); await saveSt({ done }); } }
      }
      if (t.props.src === 'exam' && rs.i + 1 >= rs.items.length) await examToEnd(Ex.cur);
      const el = document.querySelector('#pages .page'); if (el) el.scrollTop = 0;
      scheduleRender();
    };
    ACT['ar-listen'] = (el) => { const w = B.words.get(el.dataset.w); if (w) playWord(w); };
    ACT['ar-play-word'] = (el) => { const w = B.words.get(el.dataset.w); if (w) playWord(w); };
    ACT['ar-listen-verse'] = (el) => playVerse(Number(el.dataset.s), Number(el.dataset.a));
    ACT['ar-play-name'] = (el) => { const l = B.letters.get(el.dataset.l); if (l && l.nomAudio) playClip(verseUrl(l.nomAudio.loc[0], l.nomAudio.loc[1]), 0, l.nomAudio.clip[1], 'nom:' + l.id); };
    ACT['ar-exam'] = async (el) => {
      if (!(await needBank())) return; const id = el.dataset.x; if (!B.d.chExams[id]) return;
      Ex.cur = buildExam(id);
      const t = topPage(); if (t && (t.name === 'ar-run' || t.name === 'ar-exam')) backPage();
      openPage('ar-exam', { src: 'exam' });
    };
    ACT['ar-exam-go'] = () => { if (!Ex.cur) return; Ex.cur.step = 'run'; scheduleRender(); };
    ACT['ar-exam-again'] = () => { const e = Ex.cur; if (!e) return; Ex.cur = buildExam(e.exam); const el = document.querySelector('#pages .page'); if (el) el.scrollTop = 0; scheduleRender(); };
    ACT['ar-exam-close'] = () => { Ex.cur = null; backPage(); };
    /* --- oral --- */
    ACT['ar-oral-ok'] = async () => { const e = Ex.cur; if (!e) return; Oral.consent = true; try { await idbPut('kv', ORAL_KEY(), todayISO()); } catch (er) { /* accord gardé pour cette visite */ } e.step = 'oral'; e.oi = 0; scheduleRender(); };
    ACT['ar-oral-no'] = async () => { const e = Ex.cur; if (!e) return; e.oral.forEach((o) => { o.skipped = true; }); await examSave(e); scheduleRender(); };
    ACT['ar-oral-revoke'] = async () => { Oral.consent = false; try { await idbDel('kv', ORAL_KEY()); } catch (e) { /* rien */ } toast('Accord retiré : l’appli te le redemandera avant tout oral.'); scheduleRender(); };
    ACT['ar-oral-rec'] = async () => {
      const e = Ex.cur; if (!e) return; const o = e.oral[e.oi]; if (!o || o.res) return;
      if (Oral.state === 'rec') { oralStop(); return; }
      if (Oral.state === 'busy') return;
      clipStop(); o.err = null;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream); const chunks = [];
        mr.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
        mr.onstop = async () => {
          if (Oral.stream) Oral.stream.getTracks().forEach((t) => t.stop()); Oral.stream = null;
          const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
          Oral.state = 'busy'; scheduleRender();
          try {
            const wav = await toWav16(blob);
            if (wav.peak < 0.015 || wav.secs < 0.3) { o.err = 'Je n’ai rien entendu : approche-toi du téléphone et parle un peu plus fort.'; Oral.state = 'idle'; scheduleRender(); return; }
            const h = await geminiHear(wav, o); o.tries = (o.tries || 0) + 1;
            const ok = oralScore(o, h); o.res = { heard: h.heard, juste: h.juste, remark: h.remark, ok: Math.max(ok, (o.res && o.res.ok) || 0) };
          } catch (er) { o.err = oralErrText(er && er.code); if (er && (er.code === 'key' || er.code === 'nokey')) { e.oral.forEach((x) => { x.skipped = true; }); Oral.state = 'idle'; await examSave(e); scheduleRender(); toast(o.err, true); return; } }
          Oral.state = 'idle'; scheduleRender();
        };
        Object.assign(Oral, { mr, stream, chunks, state: 'rec' });
        mr.start(); scheduleRender();
        clearTimeout(Oral.timer); Oral.timer = setTimeout(() => { if (Oral.state === 'rec') oralStop(); }, 6000);
      } catch (er) { o.err = oralErrText('mic'); Oral.state = 'idle'; scheduleRender(); }
    };
    ACT['ar-oral-again'] = () => { const e = Ex.cur; if (!e) return; const o = e.oral[e.oi]; if (!o) return; o.prev = o.res; o.res = null; scheduleRender(); };
    ACT['ar-oral-skip'] = async () => { const e = Ex.cur; if (!e) return; oralStop(); Oral.state = 'idle'; const o = e.oral[e.oi]; if (o) { o.skipped = true; if (o.prev && !o.res) o.res = o.prev; } await nextOral(e); };
    ACT['ar-oral-next'] = async () => { const e = Ex.cur; if (!e) return; await nextOral(e); };
    async function nextOral(e) {
      e.oi++; const el = document.querySelector('#pages .page'); if (el) el.scrollTop = 0;
      if (e.oi >= e.oral.length) await examSave(e);
      scheduleRender();
    }
    ACT['ar-fiche-ver'] = (el) => { Fiche.eco = el.dataset.v === 'eco'; scheduleRender(); };
    ACT['ar-print'] = (el) => {
      const src = el.dataset.src; const ua = navigator.userAgent;
      const ios = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      /* un PDF dans un cadre caché ne s'imprime de façon fiable que dans Chrome, Edge ou Firefox sur ordinateur :
         ailleurs (iPhone, Android, Safari sur Mac), la fiche s'ouvre et on l'imprime depuis le lecteur PDF */
      const android = /Android/i.test(ua); const safari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|Android/.test(ua);
      if (ios || android || safari) {
        window.open(src, '_blank', 'noopener');
        toast(ios ? 'La fiche s’ouvre : utilise le bouton Partager → Imprimer.' : android ? 'La fiche s’ouvre : imprime-la depuis le lecteur PDF (menu → Imprimer).' : 'La fiche s’ouvre : Fichier → Imprimer.');
        return;
      }
      let fr = document.getElementById('ar-print-frame'); if (fr) fr.remove();
      fr = document.createElement('iframe'); fr.id = 'ar-print-frame'; fr.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;border:0;right:0;bottom:0';
      fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.open(src, '_blank', 'noopener'); } };
      fr.src = src; document.body.appendChild(fr);
    };
    ACT['ar-kept-del'] = async (el) => { await keptDel(el.dataset.id); Kept.list = null; Kept.urls.forEach((u) => URL.revokeObjectURL(u)); Kept.urls.clear(); keptRefresh(); toast('Supprimé de ce téléphone.'); };
    ACT['ar-kept-clear'] = async () => { const xs = await keptList(); for (const k of xs) await keptDel(k.id); Kept.list = null; keptRefresh(); toast('Tout est supprimé de ce téléphone.'); };
    document.addEventListener('change', async (e) => {
      const inp = e.target; if (!inp || !inp.matches || !inp.matches('input[data-ar-photo]')) return;
      const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      if (!/^image\//.test(f.type) || f.size > 15e6) { toast('Choisis une photo (15 Mo au plus).', true); return; }
      try { await keepBlob('photo', f); Kept.list = null; keptRefresh(); toast('Photo gardée sur ce téléphone seulement.'); } catch (er) { toast('Ce navigateur n’a pas pu garder la photo (stockage refusé ou plein).', true); }
    });

    /* Sources et droits : celles de « Lire et écrire l'arabe » */
    if (PAGES.sources && PAGES.sources.render) {
      const base = PAGES.sources.render;
      PAGES.sources.render = function (...a) {
        const html = base.apply(this, a);
        if (!B.d) { bank().catch(() => {}); return html; }
        return html + `<section class="src"><h2 class="set__h">Lire et écrire l’arabe</h2>
            <ul class="ar-srcs">${B.d.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titre)}</a><small>${esc(x.sert)}</small></li>`).join('')}</ul>
            <p class="fine">Programme, consignes et exercices : choix de conception de l’appli, non relus par un enseignant. Examens : ${esc(B.d.validation.regle)} ${esc(B.d.validation.nature)}</p></section>`;
      };
    }

    /* Résumé pour « Mes progrès » : chapitres réussis et notes */
    api.arabeSummary = () => {
      if (!B.d) { bank().catch(() => {}); return null; }
      return { chapters: CHS().map((c) => Object.assign({ id: c.id, n: c.n, titre: c.titre, part: c.part }, chState(c))), final: examState('final'), pos: position() };
    };

    for (const k of Object.keys(PAGES)) {
      if (!k.startsWith('ar-')) continue;
      const P = PAGES[k]; const r = P.render;
      P.render = function (...a) { return frNb(r.apply(this, a)); };
    }
    api.registerTab('arabe', renderTab);
    window.__AR = { bank, st, atts, exams, makeSet, buildExam, Run, Ex, GEN, ctxFor, checkSet, trainSet, position, chState, examState, errorItems, normAr, kbScore, oralScore, startRun, Oral, B, AR };
  });
})();
