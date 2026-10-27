/* « Lire et écrire l'arabe » — module de Mon Coran (onglet « Arabe »).

   Contenu : coran/data/arabe/banque.json, construit par coran/sources/arabe/build_bank.py à partir de
   lettres.py, programme.py et du texte Tanzil. Rien n'est inventé à l'écran : lettres et signes viennent de la
   banque, leurs formes (isolée, début, milieu, fin) sont produites par la police, les mots et passages sont
   ceux du texte coranique. L'audio des mots est la récitation pédagogique d'Al-Husary (EveryAyah,
   « Al-Mu'allim »), découpée avec les repères quran-align (CC BY 4.0) ; il n'est jamais attribué à une autre voix.

   Correction : « corrigé par l'appli » = réponse vérifiable automatiquement ; « auto-évaluation » = ton
   jugement, présenté comme tel. Aucun contenu n'a été relu par un enseignant et l'appli ne le prétend pas.
   Un niveau ne se valide que par un examen (16/20 sur chaque compétence obligatoire) réussi puis confirmé
   un autre jour sur une autre série ; finir des exercices ou toucher « Terminé » ne valide rien.
   Écriture à l'écran, photos de feuilles et enregistrements de voix restent sur l'appareil (supprimables). */
(function () {
  'use strict';
  (window.QR_MODULES = window.QR_MODULES || []).push(function (api) {
    const { esc, icon, uid, clamp, plural, todayISO, daysBetween, dFull, dDM, Store, PAGES, ACT, put,
      idbGet, idbPut, idbDel, idbAll, fetchJSON, openPage, backPage, topPage, scheduleRender, swapHTML,
      pageHead, toast, stopAudio, loadSura, suraTitle } = api;
    api.addKinds(['ar_state', 'ar_att', 'ar_exam']);

    const BANK_V = '20261028b';
    const FICHES_V = '20261028';
    const SEUIL = 16;
    /* Typographie française : espace insécable avant ; : ! ? » et après « (texte entre les balises seulement) */
    const frNb = (h) => (typeof h === 'string' ? h.replace(/(^|>)([^<]+)/g, (m, a, t) => a + t.replace(/ ([;:!?»])/g, '\u00a0$1').replace(/« /g, '«\u00a0')) : h);
    const swapFr = (root, h) => swapHTML(root, frNb(h));
    const ZWJ = '‍';
    const HARAKAT = /[ً-ْٰ۟-ۭٕٓٔ]/g;

    /* ===== Données ===== */
    const B = { d: null, p: null, err: null, words: new Map(), letters: new Map(), byCh: new Map(), units: new Map(), fiches: null, fichesP: null };
    function bank() {
      if (B.d) return Promise.resolve(B.d);
      if (!B.p) {
        B.p = fetchJSON(`coran/data/arabe/banque.json?v=${BANK_V}`).then((d) => {
          if (!d || d.format !== 1 || !Array.isArray(d.letters) || d.letters.length !== 28) throw new Error('banque');
          for (const w of d.words) B.words.set(w.id, w);
          for (const l of d.letters) { B.letters.set(l.id, l); B.byCh.set(l.ch, l); }
          for (const lv of d.levels) for (const u of lv.units) B.units.set(u.id, Object.assign({ lv: lv.n }, u));
          B.d = d; B.err = null; scheduleRender(); return d;
        }).catch((e) => { B.err = e; B.p = null; scheduleRender(); throw e; });
      }
      return B.p;
    }
    function fiches() {
      if (B.fiches) return Promise.resolve(B.fiches);
      if (!B.fichesP) B.fichesP = fetchJSON(`coran/fiches/fiches.json?v=${FICHES_V}`).then((d) => { B.fiches = d; scheduleRender(); return d; }).catch((e) => { B.fichesP = null; throw e; });
      return B.fichesP;
    }
    const levelOf = (n) => B.d.levels[n];
    const skillName = (id) => { const s = B.d.skills.find((x) => x.id === id); return s ? s.court : id; };
    const skillLong = (id) => { const s = B.d.skills.find((x) => x.id === id); return s ? s.nom : id; };

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
    const AR_RUN = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)/g;
    const MARKS_ONLY = /^[\u064B-\u065F\u0670\u06D6-\u06ED]+$/;   // signe seul : posé sur un trait (ـ) pour être lisible
    const tx = (t) => esc(t).replace(AR_RUN, (m) => `<bdi class="ar-t" lang="ar" translate="no">${MARKS_ONLY.test(m) ? 'ـ' + m : m}</bdi>`);
    const sign = (ch) => ar(MARKS_ONLY.test(ch) ? 'ـ' + ch : ch);
    const exWord = (ex) => ex.uth.replace(/ (?=[\u06D6-\u06DC])/g, '');   // signe de pause collé au mot qui le porte

    /* ===== État (compte) ===== */
    const DEF = { v: 1, level: 0, unit: 'u0a', seen: {}, levels: {}, sess: null };
    function st() { const m = Store.mem.ar_state; const v = m && m.get('main'); return Object.assign({}, DEF, v || {}); }
    function saveSt(patch) { return put('ar_state', 'main', Object.assign(st(), patch)); }
    function atts() { const m = Store.mem.ar_att; return m ? [...m.values()].filter(Boolean).sort((a, b) => String(a.at).localeCompare(String(b.at))) : []; }
    function exams() { const m = Store.mem.ar_exam; return m ? [...m.values()].filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at))) : []; }
    function logAtt(it, score, extra) {
      const rec = { at: new Date().toISOString(), d: todayISO(), t: it.t, sk: it.sk, u: it.u || null, lv: it.lv, key: it.key, ok: score, g: it.grade, mode: it.mode || 'train' };
      if (score < 1 && it.err) rec.err = it.err;
      if (extra) Object.assign(rec, extra);
      return put('ar_att', uid('a'), rec);
    }
    /* Réussite récente d'une compétence : moyenne des 20 dernières réponses (null avant 5 réponses) */
    function skillScore(sk) {
      const xs = atts().filter((a) => a.sk === sk && a.mode !== 'blanc').slice(-20);
      if (xs.length < 5) return null;
      return xs.reduce((s, a) => s + (Number(a.ok) || 0), 0) / xs.length;
    }
    function unitScore(u) {
      const xs = atts().filter((a) => a.u === u).slice(-10);
      return { n: xs.length, p: xs.length ? xs.reduce((s, a) => s + (Number(a.ok) || 0), 0) / xs.length : 0 };
    }
    const unitDone = (u) => { const s = unitScore(u); return s.n >= 8 && s.p >= 0.8; };
    /* Niveau : examen réussi (16/20 sur chaque compétence obligatoire), puis confirmé un autre jour */
    function levelStatus(n) {
      const L = (st().levels || {})[n] || {};
      return { pass: L.pass || null, ok: L.ok || null };
    }
    const levelValidated = (n) => !!levelStatus(n).ok;
    function unlockedLevel() { let n = 0; while (n < 7 && levelValidated(n)) n++; return n; }
    function currentLevel() { return clamp(Math.max(st().level || 0, unlockedLevel()), 0, 7); }
    function currentUnit() {
      const lv = levelOf(currentLevel()); const s = st();
      const u = lv.units.find((x) => x.id === s.unit) || lv.units.find((x) => !unitDone(x.id)) || lv.units[lv.units.length - 1];
      return u;
    }
    /* Compétence à travailler en priorité : la plus faible parmi celles du niveau (jamais travaillée = priorité) */
    function weakestSkill() {
      const lv = levelOf(currentLevel()); let best = null; let bv = 2;
      for (const sk of lv.skills) { const v = skillScore(sk); const k = v == null ? -1 : v; if (k < bv) { bv = k; best = sk; } }
      return best;
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
    // niveau 0 : quelques lettres pour les repères (sens, points, les six lettres qui ne s'attachent pas)
    const L0_LETTERS = ['alif', 'ba', 'ta', 'tha', 'dal', 'dhal', 'ra', 'zay', 'waw', 'nun', 'ya'];
    const lettersOfUnit = (u) => (u && u.letters ? u.letters.map((id) => B.letters.get(id)) : []);
    function lettersUpTo(lvN, unitId) {
      // lettres déjà étudiées (niveau 1 : unités jusqu'à l'unité donnée ; au-delà : les 28)
      if (lvN > 1) return B.d.letters.slice();
      if (lvN < 1) return B.d.letters.filter((l) => L0_LETTERS.includes(l.id));
      const out = [];
      for (const u of levelOf(1).units) { out.push(...lettersOfUnit(u)); if (u.id === unitId) break; }
      return out;
    }
    /* Mot lisible avec les lettres déjà vues (niveaux 1 et 2) */
    const knownWord = (w, known) => baseLetters(w.ar).every((c) => known.has(c));

    /* ===== Exercices =====
       Un exercice = une consigne, un affichage, des choix (corrigé par l'appli) ou une auto-évaluation.
       { t, sk, u, lv, key, grade: 'auto'|'self', q, show, ch: [{v, html}], ans, expl, err, word, after, verse } */
    const uniq = (xs) => [...new Set(xs)];
    const trCons = (l) => String(l.tr).split(' / ')[0];
    const VOW = { fatha: ['َ', 'a'], kasra: ['ِ', 'i'], damma: ['ُ', 'u'] };
    const wordHTML = (w, cls = 'ar-big') => ar(w.ar, cls);
    /* Mots proches d'un mot (pour des choix qui demandent vraiment de déchiffrer) : même longueur à une lettre près,
       lettres communes à la même place, même première lettre ; un peu de hasard pour varier */
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
    const GEN = {
      sens(c, R) {
        const pool = c.words.filter((x) => x.n >= 3 && x.n <= 4); if (!pool.length) return null;
        const w = pickOne(pool, R); const bl = baseLetters(w.ar); const first = bl[0]; const last = bl[bl.length - 1];
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
        const l = pickOne(c.focus, R); const ch = letterChoices(l, c.letters, R);
        return { t: 'nom', sk: 'rec', key: 'L:' + l.id + ':nom', q: 'Comment s’appelle cette lettre ?', show: ar(l.ch, 'ar-huge ar-glyph'), ch: ch.map((x) => ({ v: x.id, html: `<b>${esc(x.nom)}</b>` })), ans: l.id, errFam: l.id, expl: `${ar(l.ch)} s’appelle ${esc(l.nom)} (${ar(l.ar)}). ${tx(l.son)}`, letterAudio: l.nomAudio ? l.id : null };
      },
      lettre(c, R) {
        const l = pickOne(c.focus, R); const ch = letterChoices(l, c.letters, R);
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
        const show = ex ? `${ar(exWord(ex), 'ar-big')}<p class="ar-cap">${esc(suraTitle(ex.s))} ${ex.s}:${ex.a} — le signe ${sign(m.ch)}</p>` : `${ar('ـ' + m.ch, 'ar-huge')}`;
        return { t: 'mushaf', sk: 'voy', key: 'M:' + m.id, q: 'Que signifie ce signe du mushaf ?', show, ch: shuffle(opts, R).map((x) => ({ v: x.id, html: `<b>${esc(x.nom)}</b>` })), ans: m.id, err: 'signe', expl: `${sign(m.ch)} — ${esc(m.nom)} : ${tx(m.role)}` };
      },
      compose(c, R) {
        const w = c.pickWord(R, 'ecr', (x) => x.n >= 2 && x.n <= 5 && baseLetters(x.ar).every((ch) => B.byCh.has(ch))); if (!w) return null;
        const bl = baseLetters(w.ar); const fams = bl.map((ch) => B.byCh.get(ch)).filter(Boolean);
        const extra = uniq(fams.flatMap((l) => B.d.letters.filter((x) => x.fam === l.fam && !bl.includes(x.ch)).map((x) => x.ch)));
        const tiles = shuffle(uniq([...bl, ...shuffle(extra, R).slice(0, 2), ...shuffle(c.letters.map((l) => l.ch).filter((ch) => !bl.includes(ch)), R).slice(0, 2)]), R);
        return { t: 'compose', sk: 'ecr', key: 'W:' + w.id + ':ecr', word: w.id, q: 'Écoute le mot, puis écris-le en touchant ses lettres dans l’ordre.', listen: w.id, tiles, target: bl, ans: bl.join(''), err: 'ordre', expl: `Le mot ${ar(w.ar)} (« ${esc(w.tr)} ») s’écrit avec ${bl.map((ch) => ar(ch)).join(' + ')}, de droite à gauche. Les voyelles sont des signes : elles ne comptent pas ici.` };
      },
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

    /* ===== Contexte d'un exercice : lettres vues, mots du niveau, éléments de l'unité ===== */
    const SIGN_FEAT = { madd_a: 'long_a', madd_i: 'long_i', madd_u: 'long_u', sukun: 'sukun', shadda: 'shadda', fathatan: 'tanwin', kasratan: 'tanwin', dammatan: 'tanwin' };
    const SPECIAL_OF = { hamza: ['hamza', 'hamza_alif_haut', 'hamza_alif_bas', 'hamza_waw', 'hamza_ya'], fins: ['ta_marbuta', 'alif_maqsura'], lam_alif: ['lam_alif'] };
    function seenWordIds() { const s = new Set(); for (const a of atts()) if (a.key && a.key.startsWith('W:')) s.add(a.key.split(':')[1]); return s; }
    function ctxFor(lvN, unit, opts = {}) {
      const c = { lv: lvN, unit, letters: [], focus: [], words: [], allWords: [], passages: [], vowels: null, signs: null, special: null, marks: null };
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
    const UNIT_GEN = {
      sens: ['sens'], parties: ['points', 'nom'], liaisons: ['liaison', 'forme'],
      lettres: ['nom', 'lettre', 'forme', 'son', 'compose', 'nom', 'lettre', 'forme'],
      voyelles: ['syllabe'], mots_courts: ['lecture', 'ecoute', 'syllabe', 'compose'],
      longues: ['lecture', 'ecoute', 'signe'], sukun: ['signe', 'lecture', 'ecoute'], shadda: ['signe', 'lecture', 'ecoute'], tanwin: ['signe', 'lecture', 'ecoute'],
      article: ['article', 'lecture', 'ecoute'], hamza: ['special', 'lecture', 'ecoute'], fins: ['special', 'lecture', 'ecoute'], lam_alif: ['special', 'lecture', 'compose'], liaison: ['lecture', 'ecoute', 'article'],
      mushaf: ['mushaf'], pauses: ['mushaf'], regles: ['mushaf', 'passage'], passages: ['passage'], fluidite: ['fluidite'], autonomie: ['lecture', 'passage'],
    };
    function genOne(t, c, R) { try { const it = GEN[t] ? GEN[t](c, R) : null; return it && (it.show !== undefined || it.ch || it.tiles || it.model || it.verse || it.listen) ? it : null; } catch (e) { console.warn('exercice', t, e); return null; } }
    function makeSet(spec) {
      const R = rng(spec.seed || uid('s')); const c = spec.ctx || ctxFor(spec.lv, spec.unit, { fresh: spec.fresh });
      const types = spec.types || (spec.unit ? UNIT_GEN[spec.unit.notion] : null) || ['nom', 'lettre'];
      const out = []; let guard = 0; let ti = Math.floor(R() * types.length);
      while (out.length < spec.n && guard++ < spec.n * 8) {
        const t = types[ti++ % types.length];
        const it = genOne(t, c, R); if (!it) continue;
        if (out.some((x) => x.key === it.key) && guard < spec.n * 5) continue;
        Object.assign(it, { lv: spec.lv, u: spec.unit ? spec.unit.id : null, mode: spec.mode || 'train', grade: it.grade || 'auto', id: uid('i') });
        out.push(it);
      }
      return out;
    }
    /* Reprendre un élément du journal des erreurs (même type d'exercice, même lettre / mot / signe) */
    function regen(e, R) {
      const [kind, id, x] = String(e.key).split(':'); const unit = e.u ? B.units.get(e.u) : null; const c = ctxFor(e.lv, unit);
      if (kind === 'L') { const l = B.letters.get(id); if (l) c.focus = [l]; }
      if (kind === 'W') { const w = B.words.get(id); if (w) c.words = [w]; }
      if (kind === 'S') { const l = B.letters.get(id); if (l) c.letters = [l]; if (x) c.vowels = [x]; }
      if (kind === 'G') c.signs = [id];
      if (kind === 'X') c.special = [id];
      if (kind === 'M') c.marks = [id];
      if (kind === 'P' || kind === 'F') { const p = B.d.passages.find((q) => q.s === Number(id) && q.a === Number(x)) || { s: Number(id), a: Number(x), p: [] }; c.pickPassage = () => p; }
      const it = genOne(e.t, c, R); if (!it) return null;
      return Object.assign(it, { lv: e.lv, u: e.u || null, mode: 'session', grade: it.grade || 'auto', id: uid('i'), review: true });
    }
    function reviewItems(lvN, n, seed) {
      const R = rng(seed); const errs = shuffle(errorItems().filter((e) => e.lv <= lvN && GEN[e.t]), R).slice(0, n);
      let out = errs.map((e) => regen(e, R)).filter(Boolean);
      if (out.length < n) {
        const sk = weakestSkill(); const lv = levelOf(lvN); const cu = currentUnit();
        const upto = lv.units.slice(0, Math.max(1, lv.units.findIndex((x) => x.id === cu.id) + 1)).reverse();
        const u = upto.find((x) => (UNIT_GEN[x.notion] || []).some((t) => { const g = genOne(t, ctxFor(lvN, x), R); return g && g.sk === sk; })) || cu;
        out.push(...makeSet({ lv: lvN, unit: u, n: n - out.length, seed: seed + ':faible', mode: 'session' }));
      }
      // lectures longues (passage, cycle de fluidité) : deux au plus dans une révision
      let long = 0; out = out.filter((it) => !['passage', 'fluidite'].includes(it.t) || ++long <= 2);
      return out;
    }

    /* ===== Séance (environ 20 min, en blocs qu'on peut faire séparément) — gardée sur l'appareil ===== */
    const SESS_KEY = () => (Store.owner || 'local') + '|ar-sess';
    const Sess = { cur: null, loaded: false };
    async function loadSess() { if (Sess.loaded) return Sess.cur; try { Sess.cur = (await idbGet('kv', SESS_KEY())) || null; } catch (e) { Sess.cur = null; } Sess.loaded = true; return Sess.cur; }
    function saveSess() { idbPut('kv', SESS_KEY(), Sess.cur).catch(() => {}); }
    function newSession() {
      const lvN = currentLevel(); const u = currentUnit(); const seed = 'sess:' + todayISO() + ':' + uid();
      const blocks = [];
      if (atts().length) blocks.push({ id: 'rev', titre: 'Je révise', sous: errorItems().length ? 'Tes erreurs récentes et ta compétence la plus fragile' : 'Ta compétence la plus fragile', min: 5, items: reviewItems(lvN, 5, seed + ':rev') });
      if (!st().seen[u.id]) blocks.push({ id: 'learn', titre: 'Je découvre', sous: u.titre, min: 3, lesson: u.id, items: [] });
      const longEx = ['passages', 'fluidite', 'autonomie'].includes(u.notion);
      blocks.push({ id: 'ex', titre: 'Je m’exerce', sous: u.titre, min: longEx ? 8 : 6, items: makeSet({ lv: lvN, unit: u, n: u.notion === 'fluidite' ? 2 : longEx ? 3 : 8, seed: seed + ':ex', mode: 'session' }) });
      if (lvN >= 1 && lvN <= 5) blocks.push({ id: 'ecr', titre: 'J’écris', sous: lvN === 1 ? 'Les lettres de l’unité' : 'Des mots entendus', min: 4, items: makeSet({ lv: lvN, unit: u, n: lvN === 1 ? 2 : 3, types: lvN === 1 ? ['trace', 'compose'] : ['compose', 'trace', 'compose'], seed: seed + ':ecr', mode: 'session' }) });
      if (lvN >= 2) blocks.push({ id: 'lire', titre: 'Je lis à voix haute', sous: lvN >= 5 ? 'Un passage' : 'Des mots', min: 4, items: makeSet({ lv: lvN, unit: lvN >= 5 ? u : null, n: lvN >= 5 ? 1 : 3, types: lvN >= 6 ? ['fluidite'] : lvN === 5 ? ['passage'] : ['voix'], seed: seed + ':lire', mode: 'session', ctx: lvN >= 5 ? null : ctxFor(lvN, u) }) });
      Sess.cur = { id: uid('ss'), date: todayISO(), lv: lvN, unit: u.id, blocks: blocks.filter((b) => b.lesson || b.items.length), cur: 0, i: 0, res: [] };
      saveSess(); return Sess.cur;
    }

    /* ===== Examens ===== */
    function examTypes(lvN, sec) {
      const k = sec.comp + ':' + (sec.type === 'auto' ? 'a' : 's');
      if (k === 'rec:a') return lvN === 0 ? ['sens', 'points', 'liaison'] : ['nom', 'lettre', 'son'];
      if (k === 'lie:a') return ['forme'];
      if (k === 'ecr:a') return ['compose'];
      if (k === 'ecr:s') return ['trace'];
      if (k === 'voy:a') return lvN === 2 ? ['syllabe', 'ecoute'] : lvN === 3 ? ['signe', 'ecoute'] : lvN === 4 ? ['article', 'special', 'ecoute'] : ['mushaf'];
      if (k === 'dec:a') return ['lecture'];
      if (k === 'pas:s') return lvN < 5 ? ['voix'] : ['passage'];
      if (k === 'flu:s') return ['fluidite'];
      return ['lecture'];
    }
    const EXAM_KIND = { blanc: 'Examen blanc', niveau: 'Examen de niveau', confirmation: 'Confirmation' };
    function examSeries(lvN) { return exams().filter((e) => e.lv === lvN && e.kind !== 'blanc').length; }
    function buildExam(lvN, kind) {
      const n = examSeries(lvN);
      const series = kind === 'blanc' ? 'B' + uid() : String.fromCharCode(65 + (n % 26)) + (n >= 26 ? String(Math.floor(n / 26) + 1) : '');
      /* tirage propre à chaque tentative : un examen interrompu puis recommencé n'a pas les mêmes questions */
      const draw = kind === 'blanc' ? '' : ':' + uid();
      const secs = (B.d.exams[String(lvN)] || []).map((sec, i) => {
        const c = ctxFor(lvN, null, { fresh: sec.comp === 'dec' });
        if (sec.comp === 'pas' || sec.comp === 'flu') { const pl = Math.max(5, Math.min(7, lvN)); c.passages = B.d.passages.filter((p) => p.lv === pl); }
        if (sec.comp === 'voy' || sec.comp === 'lie') c.focus = c.letters;
        const items = makeSet({ lv: lvN, n: sec.n, types: examTypes(lvN, sec), seed: `exam:${lvN}:${series}${draw}:${i}`, mode: kind === 'blanc' ? 'blanc' : 'exam', ctx: c });
        items.forEach((it) => { it.sec = i; it.sk = sec.comp; it.grade = sec.type === 'auto' ? (it.grade === 'self' ? 'self' : 'auto') : 'self'; });
        return Object.assign({}, sec, { i, items });
      });
      return { id: uid('ex'), lv: lvN, kind, series, date: todayISO(), at: new Date().toISOString(), secs, i: 0, res: [] };
    }
    /* Note sur 20 d'une compétence : réponses justes (corrigé par l'appli) ou ton jugement (1 / ½ / 0) */
    function secScore(ex, si) { const r = ex.res.filter((x) => x.sec === si); const n = ex.secs[si].items.length || 1; return Math.round((r.reduce((a, x) => a + x.ok, 0) / n) * 20 * 2) / 2; }
    function examOutcome(ex) {
      const parts = ex.secs.map((s) => ({ comp: s.comp, titre: s.titre, type: s.type, obligatoire: s.obligatoire, n: s.items.length, note: secScore(ex, s.i) }));
      const passed = parts.filter((p) => p.obligatoire).every((p) => p.note >= SEUIL);
      return { parts, passed };
    }
    async function finishExam(ex) {
      const out = examOutcome(ex); const L = Object.assign({}, st().levels || {}); const cur = Object.assign({}, L[ex.lv] || {});
      let msg = '';
      if (ex.kind === 'niveau' && out.passed) { cur.pass = { date: todayISO(), series: ex.series }; msg = 'Réussi. Pour valider le niveau, confirme-le un autre jour sur une autre série (au plus tôt demain).'; }
      if (ex.kind === 'confirmation') {
        if (out.passed && cur.pass && cur.pass.date < todayISO() && cur.pass.series !== ex.series) { cur.ok = { date: todayISO(), series: ex.series }; msg = 'Niveau validé : réussi puis confirmé un autre jour sur une autre série.'; }
        else if (!out.passed) msg = 'Pas encore confirmé. Ta réussite précédente reste notée : retente la confirmation un autre jour.';
      }
      L[ex.lv] = cur;
      const rec = { at: ex.at, d: ex.date, lv: ex.lv, kind: ex.kind, series: ex.series, parts: out.parts, passed: out.passed };
      await put('ar_exam', ex.id, rec);
      const patch = { levels: L };
      if (cur.ok && st().level <= ex.lv && ex.lv < 7) { patch.level = ex.lv + 1; patch.unit = levelOf(ex.lv + 1).units[0].id; }
      await saveSt(patch);
      return Object.assign({}, out, { msg, validated: !!cur.ok });
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
      try { await keepBlob('ecr', blob, { model: root.querySelector('.ar-canvas').dataset.model }); toast('Gardé sur ce téléphone seulement (Mes fiches → Mes écrits). Tu peux le supprimer.'); } catch (e) { toast('Ce navigateur n’a pas pu le garder (stockage refusé ou plein).', true); }
    };

    /* ===== Affichage : briques ===== */
    const gradeLabel = (it) => (it.grade === 'self' ? 'Auto-évaluation' : 'Corrigé par l’appli');
    const pct = (x) => Math.round(x * 100);
    const mixed = (t) => `<span dir="auto">${esc(t)}</span>`;   // titres mêlant français et lettres arabes
    function skillRow(sk) {
      const v = skillScore(sk); const n = atts().filter((a) => a.sk === sk && a.mode !== 'blanc').length;
      return `<li class="ar-skill">
          <span class="ar-skill__n">${esc(skillLong(sk))}</span>
          <span class="bar" role="img" aria-label="${v == null ? 'Pas encore assez de réponses' : pct(v) + ' % de réussite récente'}"><span style="width:${v == null ? 0 : pct(v)}%"></span></span>
          <span class="ar-skill__v">${v == null ? (n ? `${n} ${plural(n, 'réponse', 'réponses')} : encore un peu` : 'pas encore travaillée') : `${pct(v)} % de réussite récente`}</span>
        </li>`;
    }
    function levelBadge(n) {
      const L = levelStatus(n); const cur = currentLevel();
      if (L.ok) return `<span class="badge badge--memorisee">${icon('check-circle', 'sm')}Validé le ${esc(dDM(L.ok.date))}</span>`;
      if (L.pass) return `<span class="badge badge--revoir">${icon('clock', 'sm')}Réussi le ${esc(dDM(L.pass.date))} · à confirmer</span>`;
      if (n === cur) return `<span class="badge badge--apprentissage">${icon('sprout', 'sm')}En cours</span>`;
      return n < cur ? '' : `<span class="badge badge--decouvrir">${icon('circle', 'sm')}À venir</span>`;
    }
    function unitState(u) {
      const s = unitScore(u.id);
      if (unitDone(u.id)) return `Travaillée · ${pct(s.p)} % sur les ${s.n} dernières réponses`;
      if (s.n) return `${s.n} ${plural(s.n, 'réponse', 'réponses')} · ${pct(s.p)} % justes`;
      return st().seen[u.id] ? 'Notion vue' : 'À découvrir';
    }
    function wordChip(w, withTr = true) {
      if (!w) return '';
      return `<button type="button" class="ar-word" data-act="ar-play-word" data-w="${esc(w.id)}" aria-label="Écouter ${esc(w.tr)}">${ar(w.ar)}${withTr ? `<small class="tl">${esc(w.tr)}</small>` : ''}${icon('volume', 'sm')}</button>`;
    }
    const audioNote = () => `<p class="fine">Audio des mots : ${esc(B.d.audio.recitateur)}, ${esc(B.d.audio.style)} (${esc(B.d.audio.source)}), découpé mot par mot avec les repères ${esc(B.d.audio.reperes)}.</p>`;
    function loadingHTML() {
      if (B.err) return `<div class="empty"><p>Le contenu « Lire et écrire l’arabe » n’a pas pu être chargé (réseau).</p><button type="button" class="btn btn--primary" data-act="ar-retry">${icon('refresh', 'sm')}Réessayer</button></div>`;
      return '<div class="loading"><span class="spin"></span></div>';
    }
    function topbar() {
      return `<div class="topbar topbar--main">
          <button type="button" class="icon-btn" data-act="go-agenda" aria-label="Revenir à l’agenda">${icon('chev-l')}</button>
          <span class="brand">${icon('book', 'sm')}Mon Coran</span>
          <button type="button" class="icon-btn" data-act="open-page" data-page="settings" aria-label="Réglages">${icon('settings')}</button>
        </div>`;
    }

    /* ===== Onglet « Arabe » : accueil ===== */
    function renderTab(root) {
      if (!B.d) { swapFr(root, topbar() + loadingHTML()); bank().catch(() => {}); return; }
      if (!Sess.loaded) { loadSess().then(scheduleRender); }
      const lvN = currentLevel(); const lv = levelOf(lvN); const u = currentUnit(); const sk = weakestSkill();
      const s = Sess.cur && Sess.cur.lv === lvN && Sess.cur.cur < Sess.cur.blocks.length ? Sess.cur : null;
      const nb = s ? s.blocks.length - s.cur : null;
      const L = levelStatus(lvN); const allDone = lv.units.every((x) => unitDone(x.id));
      const examLine = L.pass && !L.ok
        ? (L.pass.date < todayISO() ? `<button type="button" class="link-row" data-act="ar-open" data-page="ar-exams">${icon('award', 'sm')}<span>Confirme ton examen du niveau ${lvN}<small class="link-row__sub">Réussi le ${esc(dDM(L.pass.date))} : une autre série, un autre jour, pour valider.</small></span>${icon('chev-r', 'sm')}</button>` : `<p class="line-info">${icon('calendar', 'sm')}<span>Examen du niveau ${lvN} réussi aujourd’hui : la confirmation sera possible demain.</span></p>`)
        : allDone && !L.ok ? `<button type="button" class="link-row" data-act="ar-open" data-page="ar-exams">${icon('award', 'sm')}<span>Toutes les unités du niveau ${lvN} sont travaillées<small class="link-row__sub">Passe l’examen du niveau quand tu veux (annoncé avant de commencer).</small></span>${icon('chev-r', 'sm')}</button>` : '';
      swapFr(root, `${topbar()}
        <section class="ar-home" data-anchor="home">
          <p class="ar-home__k">Lire et écrire l’arabe</p>
          <h1 class="ar-home__t">Niveau ${lvN} · ${esc(lv.nom)}</h1>
          <p class="ar-home__goal">${esc(lv.but)}</p>
          <dl class="ar-home__facts">
            <div><dt>Unité en cours</dt><dd>${mixed(u.titre)}</dd></div>
            <div><dt>À travailler en priorité</dt><dd>${esc(skillLong(sk))}</dd></div>
          </dl>
          <button type="button" class="btn btn--primary btn--xl" data-act="ar-sess">${icon('play')}<span>${s ? 'Continuer ma séance' : 'Commencer ma séance'}</span></button>
          <p class="today__time">${icon('clock', 'sm')}<span>${s ? `Encore ${nb} ${plural(nb, 'partie', 'parties')}, environ ${s.blocks.slice(s.cur).reduce((a, b) => a + (b.min || 4), 0)} min` : `Environ ${lvN === 0 ? 10 : 20} min, en parties courtes : tu peux t’arrêter après chacune`}</span></p>
        </section>
        ${examLine}
        <button type="button" class="link-row" data-act="ar-fiche-day">${icon('file-text', 'sm')}<span>Fiche du jour<small class="link-row__sub">${mixed(u.titre)} · à imprimer ou à remplir à la main</small></span>${icon('chev-r', 'sm')}</button>
        <nav class="ar-menu" aria-label="Lire et écrire l’arabe">
          <button type="button" class="ar-menu__b" data-act="ar-open" data-page="ar-path">${icon('route')}<b>Mon parcours</b><small>Niveaux, notions, compétences, erreurs</small></button>
          <button type="button" class="ar-menu__b" data-act="ar-open" data-page="ar-train">${icon('repeat')}<b>M’entraîner</b><small>Une compétence ou une unité, à ton rythme</small></button>
          <button type="button" class="ar-menu__b" data-act="ar-open" data-page="ar-exams">${icon('award')}<b>Mes examens</b><small>Examens blancs et examens de niveau</small></button>
          <button type="button" class="ar-menu__b" data-act="ar-open" data-page="ar-sheets">${icon('file-text')}<b>Mes fiches PDF</b><small>Couleur ou économique, à imprimer</small></button>
        </nav>
        <p class="fine">Chaque exercice indique s’il est corrigé par l’appli ou s’il s’agit d’une auto-évaluation. Les contenus viennent de sources identifiées (Sources et droits) ; aucun n’a été relu par un enseignant.</p>`);
    }

    /* ===== Mon parcours ===== */
    PAGES['ar-path'] = {
      label: () => 'Mon parcours',
      render() {
        if (!B.d) { bank().catch(() => {}); return pageHead('Mon parcours') + loadingHTML(); }
        const cur = currentLevel(); const errs = errorItems();
        return `${pageHead('Mon parcours')}
          <p class="lede">Huit niveaux. Un niveau est validé par un examen réussi (${SEUIL}/20 sur chaque compétence obligatoire), puis confirmé un autre jour sur une autre série.</p>
          <ol class="ar-levels">${B.d.levels.map((lv) => `<li class="ar-level${lv.n === cur ? ' is-cur' : ''}" data-anchor="lv${lv.n}">
              <details${lv.n === cur ? ' open' : ''}>
                <summary><span class="ar-level__n">${lv.n}</span><span class="ar-level__t"><b>${esc(lv.nom)}</b><small>${esc(lv.but)}</small></span>${levelBadge(lv.n)}</summary>
                <p class="ar-level__proof">${icon('award', 'sm')}<span>Preuve attendue : ${esc(lv.preuve)}</span></p>
                <ul class="ar-units">${lv.units.map((u) => `<li><button type="button" class="ar-unit" data-act="ar-unit" data-u="${esc(u.id)}">
                    <span class="ar-unit__t">${mixed(u.titre)}</span><span class="ar-unit__s">${esc(unitState(u))}</span>${icon('chev-r', 'sm')}</button></li>`).join('')}</ul>
              </details></li>`).join('')}</ol>
          <h2 class="sec-title">${icon('layers', 'sm')}Mes compétences</h2>
          <ul class="ar-skills">${B.d.skills.map((x) => skillRow(x.id)).join('')}</ul>
          <p class="fine">Réussite récente = moyenne de tes 20 dernières réponses dans cette compétence (examens blancs exclus). C’est un repère pour choisir quoi travailler, pas une note.</p>
          <button type="button" class="link-row" data-act="ar-open" data-page="ar-errors">${icon('alert-circle', 'sm')}<span>Mes erreurs<small class="link-row__sub">${errs.length ? `${errs.length} ${plural(errs.length, 'élément', 'éléments')} à reprendre` : 'Rien à reprendre pour l’instant'}</small></span>${icon('chev-r', 'sm')}</button>`;
      },
    };

    /* ===== Une notion (Comprendre + exemples) ===== */
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
        return `${sg.length ? `<ul class="ar-signs">${sg.map((x) => `<li>${ar((x.id.startsWith('madd_') ? 'ب' : 'ب') + x.ch, 'ar-big')}<span><b>${esc(x.nom)}</b> ${tx(x.role)}</span></li>`).join('')}</ul>` : ''}
          ${sp.length ? `<ul class="ar-signs">${sp.map((x) => `<li>${ar(x.ch, 'ar-big')}<span><b>${esc(x.nom)}</b> ${tx(x.role)}</span></li>`).join('')}</ul>` : ''}
          <div class="ar-words">${ws.map((w) => wordChip(w)).join('')}</div>`;
      }
      if (u.marks) {
        const ms = u.marks.map((id) => B.d.mushaf.find((x) => x.id === id) || B.d.stops.find((x) => x.id === id)).filter(Boolean);
        return `<ul class="ar-signs">${ms.map((m) => { const ex = B.d.mx && B.d.mx[m.id]; return `<li>${ar(ex ? exWord(ex) : 'ـ' + m.ch, 'ar-big')}<span><b>${esc(m.nom)}</b> ${tx(m.role)}${ex ? `<small class="fine">${esc(suraTitle(ex.s))} ${ex.s}:${ex.a}</small>` : ''}</span></li>`; }).join('')}</ul>`;
      }
      return '';
    }
    PAGES['ar-unit'] = {
      label: (p) => 'Notion',
      render(p) {
        if (!B.d) { bank().catch(() => {}); return pageHead('Notion') + loadingHTML(); }
        const u = B.units.get(p.u); if (!u) return null;
        const lv = levelOf(u.lv);
        return `${pageHead(`Niveau ${u.lv} · ${lv.nom}`)}
          <h1 class="screen-title">${mixed(u.titre)}</h1>
          <p class="ar-resume">${tx(u.resume)}</p>
          <div class="ar-comprendre"><h2 class="sec-title">${icon('lightbulb', 'sm')}Comprendre</h2><p>${tx(u.comprendre)}</p></div>
          ${lessonExamples(u)}
          ${(u.letters || u.signs || u.feat || ['sens', 'mots_courts', 'liaisons'].includes(u.notion)) ? audioNote() : ''}
          <div class="ar-actions">
            ${p.fromSess ? `<button type="button" class="btn btn--primary btn--block" data-act="ar-lesson-done" data-u="${esc(u.id)}">${icon('check', 'sm')}J’ai lu : je m’exerce</button>` : `<button type="button" class="btn btn--primary btn--block" data-act="ar-train-unit" data-u="${esc(u.id)}">${icon('repeat', 'sm')}M’entraîner sur cette notion</button>`}
            ${!p.fromSess && u.lv === currentLevel() && st().unit !== u.id ? `<button type="button" class="btn btn--ghost btn--block" data-act="ar-set-unit" data-u="${esc(u.id)}">En faire mon unité en cours</button>` : ''}
          </div>`;
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
          <p class="lede">Ce que tu as manqué ces 14 derniers jours et pas encore réussi depuis. Chaque élément revient en priorité dans tes séances.</p>
          ${errs.length ? `<button type="button" class="btn btn--primary btn--block" data-act="ar-train-errors">${icon('repeat', 'sm')}Retravailler mes erreurs</button>` : '<div class="empty"><p>Rien à reprendre pour l’instant.</p></div>'}
          ${[...by.entries()].map(([k, xs]) => `<section class="ar-errgroup"><h2 class="sec-title">${esc(B.d.errors[k] || 'autre')} <small>(${xs.length})</small></h2>
              <ul class="ar-errlist">${xs.slice(0, 30).map((e) => `<li>${errLabel(e)}<small>${esc(skillName(e.sk))}</small></li>`).join('')}</ul></section>`).join('')}
          ${counts.size ? `<h2 class="sec-title">${icon('list', 'sm')}Depuis le début</h2><ul class="ar-errcount">${[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `<li><span>${esc(B.d.errors[k] || k)}</span><b>${n}</b></li>`).join('')}</ul>` : ''}`;
      },
    };

    /* ===== M'entraîner ===== */
    PAGES['ar-train'] = {
      label: () => 'M’entraîner',
      render() {
        if (!B.d) { bank().catch(() => {}); return pageHead('M’entraîner') + loadingHTML(); }
        const cur = currentLevel(); const lv = levelOf(cur);
        const sks = uniq(B.d.levels.filter((x) => x.n <= cur).flatMap((x) => x.skills)).filter((sk) => sk !== 'flu' || cur >= 6);
        return `${pageHead('M’entraîner')}
          <p class="lede">Dix exercices courts. Les éléments que tu as manqués reviennent plus souvent.</p>
          <h2 class="sec-title">${icon('layers', 'sm')}Par compétence</h2>
          <div class="ar-pick">${sks.map((sk) => { const v = skillScore(sk); return `<button type="button" class="ar-pick__b" data-act="ar-train-skill" data-sk="${sk}"><b>${esc(skillLong(sk))}</b><small>${v == null ? 'pas encore assez de réponses' : pct(v) + ' % de réussite récente'}</small></button>`; }).join('')}</div>
          <h2 class="sec-title">${icon('route', 'sm')}Par notion du niveau ${cur}</h2>
          <div class="ar-pick">${lv.units.map((u) => `<button type="button" class="ar-pick__b" data-act="ar-train-unit" data-u="${esc(u.id)}"><b>${mixed(u.titre)}</b><small>${esc(unitState(u))}</small></button>`).join('')}</div>
          ${errorItems().length ? `<button type="button" class="link-row" data-act="ar-train-errors">${icon('alert-circle', 'sm')}<span>Mes erreurs à reprendre<small class="link-row__sub">${errorItems().length} ${plural(errorItems().length, 'élément', 'éléments')}</small></span>${icon('chev-r', 'sm')}</button>` : ''}`;
      },
    };
    /* Unité qui fait travailler une compétence au niveau courant (ou au niveau le plus récent qui l'a) */
    function setForSkill(sk) {
      const cur = currentLevel(); const R = rng('sk:' + sk + ':' + uid());
      for (let n = cur; n >= 0; n--) {
        const lv = levelOf(n); if (!lv.skills.includes(sk) && n !== 0) continue;
        const units = shuffle(lv.units, R);
        for (const u of units) {
          const types = (UNIT_GEN[u.notion] || []).filter((t) => { const g = genOne(t, ctxFor(n, u), rng('probe')); return g && g.sk === sk; });
          if (!types.length && sk === 'ecr') types.push('compose', 'trace');
          if (!types.length && sk === 'pas' && n >= 2) types.push(n >= 5 ? 'passage' : 'voix');
          if (!types.length && sk === 'flu' && n >= 6) types.push('fluidite');
          if (!types.length && sk === 'dec' && n >= 2) types.push('lecture', 'voix');
          if (!types.length && sk === 'lie' && n >= 1) types.push('forme');
          if (types.length) return makeSet({ lv: n, unit: u, n: ['pas', 'flu'].includes(sk) ? 3 : 10, types: uniq(types), seed: 'sk:' + sk + ':' + uid(), mode: 'train' });
        }
      }
      return [];
    }

    /* ===== Mes examens ===== */
    PAGES['ar-exams'] = {
      label: () => 'Mes examens',
      render() {
        if (!B.d) { bank().catch(() => {}); return pageHead('Mes examens') + loadingHTML(); }
        const cur = currentLevel(); const lv = levelOf(cur); const L = levelStatus(cur); const grid = B.d.exams[String(cur)] || [];
        const canConfirm = L.pass && !L.ok && L.pass.date < todayISO();
        const hist = exams();
        return `${pageHead('Mes examens')}
          <h1 class="screen-title">Niveau ${cur} · ${esc(lv.nom)}</h1>
          <p class="lede">${esc(B.d.validation.regle)}</p>
          <table class="ar-grid"><caption>Ce qui est évalué (annoncé avant de commencer)</caption>
            <thead><tr><th>Compétence</th><th>Questions</th><th>Correction</th><th>Compte</th></tr></thead>
            <tbody>${grid.map((g) => `<tr><td>${esc(g.titre)}</td><td>${g.n}</td><td>${g.type === 'auto' ? 'Par l’appli' : 'Auto-évaluation'}</td><td>${g.obligatoire ? `Oui (${SEUIL}/20)` : 'Non'}</td></tr>`).join('')}</tbody></table>
          <div class="ar-actions">
            ${L.ok ? `<p class="notice notice--ok">${icon('check-circle')}<span>Niveau ${cur} validé le ${esc(dFull(L.ok.date))}.</span></p>`
              : canConfirm ? `<button type="button" class="btn btn--primary btn--block" data-act="ar-exam" data-k="confirmation">${icon('award', 'sm')}Confirmer le niveau ${cur} (autre série)</button>`
              : L.pass ? `<p class="notice">${icon('calendar')}<span>Réussi le ${esc(dFull(L.pass.date))} : la confirmation, sur une autre série, sera possible à partir de demain.</span></p>`
              : `<button type="button" class="btn btn--primary btn--block" data-act="ar-exam" data-k="niveau">${icon('award', 'sm')}Passer l’examen du niveau ${cur}</button>`}
            <button type="button" class="btn btn--soft btn--block" data-act="ar-exam" data-k="blanc">${icon('repeat', 'sm')}Examen blanc (ne compte pas)</button>
          </div>
          <p class="fine">${esc(B.d.validation.nature)} Les parties « auto-évaluation » reposent sur ton jugement, avec le modèle ou l’audio de référence sous les yeux : la note le dit toujours.</p>
          ${hist.length ? `<h2 class="sec-title">${icon('list', 'sm')}Historique</h2><ul class="ar-hist">${hist.map((e) => `<li class="ar-hist__i">
              <div class="ar-hist__h"><b>${esc(EXAM_KIND[e.kind] || e.kind)} · niveau ${e.lv}</b><span>${esc(dDM(e.d))}${e.kind === 'blanc' ? '' : ` · série ${esc(e.series)}`}</span>${e.passed ? `<span class="badge badge--memorisee">${icon('check', 'sm')}${SEUIL}/20 atteint partout</span>` : `<span class="badge badge--decouvrir">Pas encore</span>`}</div>
              <ul class="ar-hist__p">${(e.parts || []).map((x) => `<li><span>${esc(x.titre)}</span><b>${String(x.note).replace('.', ',')}/20</b><small>${x.type === 'auto' ? 'corrigé par l’appli' : 'auto-évaluation'}${x.obligatoire ? '' : ' · ne compte pas'}</small></li>`).join('')}</ul></li>`).join('')}</ul>` : ''}`;
      },
    };

    /* ===== Mes fiches PDF ===== */
    const Fiche = { eco: false };
    PAGES['ar-sheets'] = {
      label: () => 'Mes fiches PDF',
      render(p) {
        if (!B.fiches) { fiches().catch(() => {}); return pageHead('Mes fiches PDF') + (B.fichesP ? '<div class="loading"><span class="spin"></span></div>' : `<div class="empty"><p>La liste des fiches n’a pas pu être chargée (réseau).</p><button type="button" class="btn btn--primary" data-act="ar-retry">${icon('refresh', 'sm')}Réessayer</button></div>`); }
        const F = B.fiches; const cur = B.d ? currentLevel() : 0; const ver = Fiche.eco ? 'eco' : 'couleur';
        const byLv = new Map(); for (const f of F.fiches) { if (!byLv.has(f.lv)) byLv.set(f.lv, []); byLv.get(f.lv).push(f); }
        return `${pageHead('Mes fiches PDF')}
          <p class="lede">Fiches A4 à imprimer ou à remplir à la main. Les lettres et les mots viennent de la même banque que les exercices ; les formes sont celles de la police (pas un tracé manuscrit).</p>
          <div class="seg" role="radiogroup" aria-label="Version">
            <button type="button" class="seg__b${!Fiche.eco ? ' is-on' : ''}" role="radio" aria-checked="${!Fiche.eco}" data-act="ar-fiche-ver" data-v="couleur">Couleur</button>
            <button type="button" class="seg__b${Fiche.eco ? ' is-on' : ''}" role="radio" aria-checked="${Fiche.eco}" data-act="ar-fiche-ver" data-v="eco">Économique (encre)</button>
          </div>
          ${[...byLv.entries()].map(([lvN, fs]) => `<details class="ar-fiches"${lvN === cur ? ' open' : ''} data-anchor="fl${lvN}"><summary><b>Niveau ${lvN}</b> · ${esc(B.d ? levelOf(lvN).nom : '')}<small>${fs.length} ${plural(fs.length, 'fiche', 'fiches')}</small></summary>
              <ul class="ar-fiche-list">${fs.map((f) => { const v = f[ver]; return `<li class="ar-fiche${p.focus === f.id ? ' is-focus' : ''}" id="fiche-${esc(f.id)}">
                  <img class="ar-fiche__img" src="${esc(v.thumb)}" alt="" loading="lazy" width="120" height="170">
                  <div class="ar-fiche__t"><b>${mixed(f.titre)}</b><small>${esc(f.desc)}</small>
                    <div class="ar-fiche__acts">
                      <a class="btn btn--soft btn--sm" href="${esc(v.pdf)}" target="_blank" rel="noopener">${icon('eye', 'sm')}Voir</a>
                      <a class="btn btn--ghost btn--sm" href="${esc(v.pdf)}" download>${icon('download', 'sm')}Télécharger le PDF</a>
                      <a class="btn btn--ghost btn--sm" href="${esc(v.png)}" download>${icon('image', 'sm')}Télécharger en image</a>
                      <button type="button" class="btn btn--ghost btn--sm" data-act="ar-print" data-src="${esc(v.pdf)}">${icon('printer', 'sm')}Imprimer</button>
                    </div></div></li>`; }).join('')}</ul></details>`).join('')}
          <p class="fine">${esc(F.note || '')}</p>
          <button type="button" class="link-row" data-act="ar-open" data-page="ar-kept">${icon('pencil', 'sm')}<span>Mes écrits, photos et enregistrements<small class="link-row__sub">Gardés sur ce téléphone seulement, supprimables</small></span>${icon('chev-r', 'sm')}</button>`;
      },
      after(p, el) { if (p.focus) { const n = el.querySelector('#fiche-' + CSS.escape(p.focus)); if (n) n.scrollIntoView({ block: 'center' }); } },
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

    /* ===== Enregistrer sa lecture (sur l'appareil seulement, jamais envoyé) ===== */
    const Rec = { mr: null, stream: null, chunks: [], blob: null, url: null, item: null, state: 'idle', t0: 0 };
    const canRec = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    function recReset() {
      if (Rec.mr && Rec.mr.state !== 'inactive') { try { Rec.mr.stop(); } catch (e) { /* rien */ } }
      if (Rec.stream) Rec.stream.getTracks().forEach((t) => t.stop());
      if (Rec.url) URL.revokeObjectURL(Rec.url);
      Object.assign(Rec, { mr: null, stream: null, chunks: [], blob: null, url: null, item: null, state: 'idle' });
    }
    function recHTML(it) {
      if (!canRec()) return '';
      const mine = Rec.item === it.id;
      const st = mine ? Rec.state : 'idle';
      return `<div class="ar-rec">
          ${st === 'rec' ? `<button type="button" class="btn btn--soft" data-act="ar-rec-stop">${icon('stop', 'sm')}Arrêter l’enregistrement</button>`
            : `<button type="button" class="btn btn--ghost" data-act="ar-rec-start">${icon('mic', 'sm')}${st === 'done' ? 'Recommencer' : 'Enregistrer ma lecture'}</button>`}
          ${st === 'done' ? `<button type="button" class="btn btn--ghost" data-act="ar-rec-play">${icon('play', 'sm')}Me réécouter</button><button type="button" class="btn btn--ghost" data-act="ar-rec-keep">${icon('download', 'sm')}Garder</button>` : ''}
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
      try { await keepBlob('voix', Rec.blob, { model: label }); toast('Enregistrement gardé sur ce téléphone (Mes fiches → Mes écrits et enregistrements). Tu peux le supprimer.'); } catch (e) { toast('Ce navigateur n’a pas pu le garder (stockage refusé ou plein).', true); }
    };

    /* ===== Déroulé des exercices (séance, entraînement, examen) ===== */
    const Run = { set: null };
    const Ex = { cur: null };
    function runState(src) {
      if (src === 'sess') { const s = Sess.cur; const b = s && s.blocks[s.cur]; return b ? { items: b.items, i: s.i, title: b.titre, sub: b.sous, go(i) { s.i = i; saveSess(); } } : null; }
      if (src === 'train') { const r = Run.set; return r ? { items: r.items, i: r.i, title: r.title, sub: r.sub, go(i) { r.i = i; } } : null; }
      if (src === 'exam') { const e = Ex.cur; if (!e) return null; const items = e.secs.flatMap((x) => x.items); return { items, i: e.i, title: EXAM_KIND[e.kind], go(i) { e.i = i; }, exam: e }; }
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
      if (it.t === 'compose') {
        const comp = it.comp || [];
        return `<div class="ar-compose">
            <div class="ar-compose__out" aria-live="polite">${comp.length ? ar(comp.join(''), 'ar-big') : '<span class="ar-compose__ph">Touche les lettres dans l’ordre</span>'}</div>
            <div class="ar-tiles">${it.tiles.map((ch) => `<button type="button" class="ar-tile" data-act="ar-tile" data-ch="${esc(ch)}"${done ? ' disabled' : ''} aria-label="${esc(B.byCh.get(ch) ? B.byCh.get(ch).nom : ch)}">${ar(ch)}</button>`).join('')}</div>
            ${done ? (reveal ? `<p class="ar-compose__ans">Réponse : ${ar(it.ans, 'ar-big')}</p>` : '') : `<div class="ar-compose__bar"><button type="button" class="btn btn--ghost btn--sm" data-act="ar-tile-undo"${comp.length ? '' : ' disabled'}>${icon('chev-r', 'sm')}Effacer la dernière lettre</button><button type="button" class="btn btn--primary" data-act="ar-compose-check"${comp.length ? '' : ' disabled'}>${icon('check', 'sm')}Vérifier</button></div>`}
          </div>`;
      }
      if (it.t === 'trace') {
        return `<div class="ar-trace"><div class="ar-trace__model"><small>Modèle (police)</small>${ar(it.model, 'ar-huge' + (/[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(it.model) ? '' : ' ar-glyph'))}</div>${done ? '' : canvasHTML(it.model)}</div>
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
      const ok = d.ok >= 1; const self = it.grade === 'self';
      return `<div class="ar-fb ${self ? 'ar-fb--self' : ok ? 'ar-fb--ok' : 'ar-fb--ko'}" role="status">
          <p class="ar-fb__t">${icon(self ? 'check' : ok ? 'check-circle' : 'alert-circle', 'sm')}${self ? 'Noté (auto-évaluation).' : ok ? 'Juste.' : 'Pas tout à fait.'}</p>
          ${it.expl ? `<p class="ar-fb__x">${it.expl}</p>` : ''}
          ${it.after ? `<button type="button" class="btn btn--soft btn--sm" data-act="ar-listen" data-w="${esc(it.after)}">${icon('volume', 'sm')}Écouter le mot</button>` : ''}
        </div>`;
    }
    function itemHTML(it, n, total, examMode, secTitle) {
      const listenBtn = it.listen ? `<div class="ar-listen"><button type="button" class="btn btn--primary" data-act="ar-listen" data-w="${esc(it.listen)}">${icon('volume', 'sm')}Écouter</button></div>` : '';
      return `<article class="ar-ex" data-anchor="ex${n}">
          <p class="ar-ex__meta"><span>${n} / ${total}</span><span>${esc(secTitle || skillName(it.sk))}</span><span class="ar-tag ar-tag--${it.grade === 'self' ? 'self' : 'auto'}">${esc(gradeLabel(it))}</span></p>
          <h2 class="ar-ex__q">${esc(it.q)}</h2>
          ${listenBtn}
          ${it.show ? `<div class="ar-ex__show">${it.show}</div>` : ''}
          ${itemBody(it, examMode)}
          ${examMode ? '' : feedbackHTML(it)}
          ${it.done ? `<button type="button" class="btn btn--primary btn--block ar-next" data-act="ar-next">${icon('arrow-r', 'sm')}Continuer</button>` : ''}
        </article>`;
    }
    function errTag(it, v) {
      if (it.errFam) { const a = B.letters.get(String(v)); const b = B.letters.get(it.errFam); return a && b && a.fam === b.fam ? 'point' : 'confusion'; }
      return it.err || null;
    }
    function record(src, it, ok, v, extra) {
      if (it.done) return;
      const err = ok < 1 ? errTag(it, v) : null;
      it.done = { v: v == null ? null : String(v), ok, err };
      const mode = src === 'exam' ? (Ex.cur.kind === 'blanc' ? 'blanc' : 'exam') : (src === 'sess' ? 'session' : 'train');
      logAtt(Object.assign({}, it, { mode }), ok, Object.assign(err ? { err } : {}, extra || {}));
      if (src === 'exam') Ex.cur.res.push({ sec: it.sec, ok });
      if (src === 'sess') saveSess();
      scheduleRender();
    }
    const topRun = () => { const t = topPage(); return t && (t.name === 'ar-run' || t.name === 'ar-exam') ? t : null; };
    function curItem() { const t = topRun(); if (!t) return null; const rs = runState(t.props.src); if (!rs) return null; return { src: t.props.src, rs, it: rs.items[rs.i] }; }

    /* Fin d'une partie de séance : unité suivante quand l'unité est travaillée (jamais de validation de niveau ici) */
    async function afterBlock() {
      const s = st(); const u = B.units.get(s.unit) || currentUnit();
      if (u && unitDone(u.id)) {
        const lv = levelOf(currentLevel()); const next = lv.units.find((x) => !unitDone(x.id));
        if (next && next.id !== u.id) { await saveSt({ unit: next.id }); return `Unité « ${u.titre} » travaillée. Prochaine unité : « ${next.titre} ».`; }
        if (!next) return `Toutes les unités du niveau ${lv.n} sont travaillées : l’examen du niveau t’attend dans « Mes examens ».`;
      }
      return '';
    }
    PAGES['ar-run'] = {
      label: () => 'Exercices',
      render(p) {
        const rs = runState(p.src); if (!rs || !B.d) return null;
        if (rs.i >= rs.items.length) {
          const n = rs.items.length; const sc = rs.items.reduce((a, x) => a + (x.done ? x.done.ok : 0), 0);
          const s = Sess.cur; const last = p.src === 'sess' && s && s.cur >= s.blocks.length - 1;
          const next = p.src === 'sess' && s && !last ? s.blocks[s.cur + 1] : null;
          return `${pageHead(rs.title)}
            <section class="ar-done">
              <h1 class="screen-title">${p.src === 'sess' ? (last ? 'Séance terminée' : 'Partie terminée') : 'Série terminée'}</h1>
              <p class="ar-done__score"><b>${String(Math.round(sc * 2) / 2).replace('.', ',')}</b> sur ${n}</p>
              ${p.msg ? `<p class="notice">${icon('info')}<span>${esc(p.msg)}</span></p>` : ''}
              <ul class="ar-done__list">${rs.items.map((x) => `<li class="${!x.done ? '' : x.done.ok >= 1 ? 'is-ok' : x.done.ok > 0 ? 'is-mid' : 'is-ko'}">${icon(!x.done ? 'circle' : x.done.ok >= 1 ? 'check' : 'repeat', 'sm')}<span>${esc(x.q)}</span><small>${esc(gradeLabel(x))}</small></li>`).join('')}</ul>
              ${next ? `<button type="button" class="btn btn--primary btn--block" data-act="ar-sess-next">${icon('arrow-r', 'sm')}Continuer : ${esc(next.titre)}</button><button type="button" class="btn btn--ghost btn--block" data-act="ar-sess-pause">M’arrêter là pour l’instant</button>`
                : `<button type="button" class="btn btn--primary btn--block" data-act="${p.src === 'sess' ? 'ar-sess-end' : 'back'}">${icon('check', 'sm')}Terminer</button>${p.src === 'train' ? `<button type="button" class="btn btn--ghost btn--block" data-act="ar-train-again">${icon('repeat', 'sm')}Une autre série</button>` : ''}`}
            </section>`;
        }
        const it = rs.items[rs.i];
        return `${pageHead(rs.title, { backLabel: p.src === 'sess' ? 'Quitter (ta séance est gardée)' : 'Quitter' })}${itemHTML(it, rs.i + 1, rs.items.length, false)}`;
      },
      after(p, el) { wireCanvas(el); },
      onClose() { clipStop(); recReset(); },
    };

    /* ===== Examen : grille annoncée, passage, résultat ===== */
    PAGES['ar-exam'] = {
      label: () => 'Examen',
      render(p) {
        const e = Ex.cur; if (!e || !B.d) return null;
        const lv = levelOf(e.lv); const title = `${EXAM_KIND[e.kind]} · niveau ${e.lv}`;
        if (e.step === 'intro') {
          return `${pageHead(title)}
            <h1 class="screen-title">${esc(lv.nom)}</h1>
            <p class="lede">${e.kind === 'blanc' ? 'Pour t’entraîner : la note ne compte pas et tu vois la correction après chaque question.' : e.kind === 'confirmation' ? `Autre série que celle réussie le ${esc(dFull((levelStatus(e.lv).pass || {}).date || todayISO()))}. Si tu atteins encore ${SEUIL}/20 partout, le niveau est validé.` : `Pas de correction pendant l’examen. ${SEUIL}/20 sur chaque compétence obligatoire, puis une confirmation un autre jour, valident le niveau.`}</p>
            <table class="ar-grid"><thead><tr><th>Partie</th><th>Questions</th><th>Correction</th><th>Compte</th></tr></thead>
              <tbody>${e.secs.map((g) => `<tr><td>${esc(g.titre)}</td><td>${g.items.length}</td><td>${g.type === 'auto' ? 'Par l’appli' : 'Auto-évaluation'}</td><td>${g.obligatoire ? `Oui (${SEUIL}/20)` : 'Non'}</td></tr>`).join('')}</tbody></table>
            <p class="fine">Les parties en auto-évaluation te demandent de juger toi-même, avec le modèle ou l’audio de référence. La note le dit. Aucun enseignant n’intervient.</p>
            <button type="button" class="btn btn--primary btn--block" data-act="ar-exam-go">${icon('play', 'sm')}Commencer</button>`;
        }
        if (e.step === 'done') {
          const out = e.out || examOutcome(e);
          return `${pageHead(title)}
            <section class="ar-done">
              <h1 class="screen-title">${e.kind === 'blanc' ? 'Résultat de l’examen blanc' : out.validated ? 'Niveau validé' : out.passed ? `${SEUIL}/20 atteint partout` : 'Résultat'}</h1>
              <ul class="ar-hist__p ar-hist__p--big">${out.parts.map((x) => `<li class="${x.note >= SEUIL ? 'is-ok' : 'is-ko'}"><span>${esc(x.titre)}</span><b>${String(x.note).replace('.', ',')}/20</b><small>${x.type === 'auto' ? 'corrigé par l’appli' : 'auto-évaluation'}${x.obligatoire ? '' : ' · ne compte pas pour la validation'}</small></li>`).join('')}</ul>
              ${out.msg ? `<p class="notice${out.validated ? ' notice--ok' : ''}">${icon(out.validated ? 'check-circle' : 'info')}<span>${esc(out.msg)}</span></p>` : ''}
              ${e.kind === 'blanc' ? '<p class="fine">Examen blanc : rien n’est validé, tes réponses servent seulement à choisir tes prochains exercices.</p>' : ''}
              <button type="button" class="btn btn--primary btn--block" data-act="ar-exam-close">${icon('check', 'sm')}Terminer</button>
            </section>`;
        }
        const rs = runState('exam'); const it = rs.items[rs.i];
        if (!it || e.step === 'saving') return `${pageHead(title)}<div class="loading"><span class="spin"></span></div>`;
        const sec = e.secs[it.sec];
        const secPos = sec.items.indexOf(it) + 1;
        return `${pageHead(title, { backLabel: 'Quitter l’examen (il ne sera pas compté)' })}
          <p class="ar-sec">Partie ${it.sec + 1} sur ${e.secs.length} · ${esc(sec.titre)}</p>
          ${itemHTML(it, secPos, sec.items.length, e.kind !== 'blanc', sec.titre)}`;
      },
      after(p, el) { wireCanvas(el); },
      onClose() { clipStop(); recReset(); if (Ex.cur && Ex.cur.step !== 'done') Ex.cur = null; },
    };

    /* ===== Actions ===== */
    const needBank = async () => { try { await bank(); return true; } catch (e) { toast('Le contenu « Lire et écrire l’arabe » n’a pas pu être chargé (réseau). Réessaie dans un instant.', true); return false; } };
    function replaceTop(name, props) { const t = topPage(); if (t && (t.name === 'ar-run' || t.name === 'ar-unit')) backPage(); openPage(name, props); }
    function openBlock() {
      const s = Sess.cur; const b = s && s.blocks[s.cur];
      if (!b) { replaceTop('ar-run', { src: 'sess' }); return; }
      if (b.lesson) replaceTop('ar-unit', { u: b.lesson, fromSess: true });
      else replaceTop('ar-run', { src: 'sess' });
    }
    ACT['ar-retry'] = () => { B.err = null; B.p = null; B.fichesP = null; bank().catch(() => {}); scheduleRender(); };
    ACT['ar-open'] = async (el) => { if (await needBank()) openPage(el.dataset.page, {}); };
    ACT['ar-unit'] = (el) => openPage('ar-unit', { u: el.dataset.u });
    ACT['ar-set-unit'] = async (el) => { await saveSt({ unit: el.dataset.u }); toast('Unité en cours changée.'); scheduleRender(); };
    ACT['ar-sess'] = async () => {
      if (!(await needBank())) return;
      await loadSess(); const s = Sess.cur;
      const stale = !s || s.lv !== currentLevel() || s.cur >= s.blocks.length || (s.date !== todayISO() && s.cur === 0 && s.i === 0);
      if (stale) newSession();
      openBlock();
    };
    ACT['ar-lesson-done'] = async (el) => {
      const s = st(); const seen = Object.assign({}, s.seen || {}); seen[el.dataset.u] = todayISO(); await saveSt({ seen });
      if (Sess.cur) { Sess.cur.cur++; Sess.cur.i = 0; saveSess(); }
      openBlock();
    };
    ACT['ar-sess-next'] = () => { if (!Sess.cur) return; Sess.cur.cur++; Sess.cur.i = 0; saveSess(); openBlock(); };
    ACT['ar-sess-pause'] = () => { if (Sess.cur) { Sess.cur.cur++; Sess.cur.i = 0; saveSess(); } backPage(); toast('Séance gardée : « Continuer ma séance » reprend à la partie suivante.'); };
    ACT['ar-sess-end'] = async () => { if (Sess.cur) { Sess.cur.cur = Sess.cur.blocks.length; saveSess(); } backPage(); const m = await afterBlock(); toast(m || 'Séance terminée. À demain !'); };
    function startTrain(title, sub, items, again) {
      if (!items.length) { toast('Pas encore d’exercice de ce type à ton niveau.'); return; }
      Run.set = { title, sub, items, i: 0, again }; clipStop();
      const t = topPage(); if (t && t.name === 'ar-run') backPage();
      openPage('ar-run', { src: 'train' });
    }
    ACT['ar-train-skill'] = async (el) => { if (!(await needBank())) return; const sk = el.dataset.sk; startTrain('M’entraîner', skillName(sk), setForSkill(sk), { sk }); };
    ACT['ar-train-unit'] = async (el) => {
      if (!(await needBank())) return; const u = B.units.get(el.dataset.u); if (!u) return;
      const seen = Object.assign({}, st().seen || {}); if (!seen[u.id]) { seen[u.id] = todayISO(); await saveSt({ seen }); }
      startTrain('M’entraîner', u.titre, makeSet({ lv: u.lv, unit: u, n: 10, seed: 'u:' + u.id + ':' + uid(), mode: 'train' }), { u: u.id });
    };
    ACT['ar-train-errors'] = async () => {
      if (!(await needBank())) return; const R = rng('err:' + uid());
      const items = shuffle(errorItems(), R).slice(0, 10).map((e) => regen(e, R)).filter(Boolean).map((it) => Object.assign(it, { mode: 'train' }));
      startTrain('Mes erreurs', 'à reprendre', items, { err: 1 });
    };
    ACT['ar-train-again'] = () => {
      const a = Run.set && Run.set.again; if (!a) { backPage(); return; }
      if (a.sk) ACT['ar-train-skill']({ dataset: { sk: a.sk } });
      else if (a.u) ACT['ar-train-unit']({ dataset: { u: a.u } });
      else ACT['ar-train-errors']();
    };
    ACT['ar-pick'] = (el) => { const c = curItem(); if (!c || !c.it || c.it.done) return; const v = el.dataset.v; record(c.src, c.it, String(v) === String(c.it.ans) ? 1 : 0, v); };
    ACT['ar-tile'] = (el) => { const c = curItem(); if (!c || !c.it || c.it.done) return; c.it.comp = (c.it.comp || []).concat(el.dataset.ch); if (c.src === 'sess') saveSess(); scheduleRender(); };
    ACT['ar-tile-undo'] = () => { const c = curItem(); if (!c || !c.it || c.it.done) return; c.it.comp = (c.it.comp || []).slice(0, -1); scheduleRender(); };
    ACT['ar-compose-check'] = () => { const c = curItem(); if (!c || !c.it || c.it.done) return; const v = (c.it.comp || []).join(''); record(c.src, c.it, v === c.it.ans ? 1 : 0, v); };
    ACT['ar-self'] = (el) => { const c = curItem(); if (!c || !c.it || c.it.done) return; record(c.src, c.it, Number(el.dataset.v), el.dataset.v); };
    ACT['ar-flu'] = (el) => { const c = curItem(); if (!c || !c.it) return; c.it.step = Number(el.dataset.step); if (c.src === 'sess') saveSess(); scheduleRender(); };
    ACT['ar-chrono'] = (el) => {
      const c = curItem(); if (!c || !c.it) return;
      if (el.dataset.v === 'start') { clipStop(); c.it.t0 = Date.now(); } else { c.it.secs = Math.max(1, Math.round((Date.now() - (c.it.t0 || Date.now())) / 1000)); c.it.step = 3; }
      if (c.src === 'sess') saveSess(); scheduleRender();
    };
    ACT['ar-crit'] = (el) => { const c = curItem(); if (!c || !c.it || c.it.done) return; c.it.crit = Object.assign({}, c.it.crit || {}, { [el.dataset.k]: !(c.it.crit || {})[el.dataset.k] }); scheduleRender(); };
    ACT['ar-crit-ok'] = () => { const c = curItem(); if (!c || !c.it || c.it.done) return; const n = Object.values(c.it.crit || {}).filter(Boolean).length; record(c.src, c.it, Math.round((n / 3) * 2) / 2, null, c.it.secs ? { secs: c.it.secs } : null); };
    ACT['ar-next'] = async () => {
      const t = topRun(); if (!t) return; const rs = runState(t.props.src); if (!rs) return;
      clipStop(); recReset(); rs.go(rs.i + 1);
      if (t.props.src === 'exam' && rs.i + 1 >= rs.items.length) { const e = Ex.cur; e.step = 'saving'; e.out = await finishExam(e); e.step = 'done'; }
      else if (t.props.src === 'sess' && rs.i + 1 >= rs.items.length) { t.props.msg = await afterBlock(); }
      const el = document.querySelector('#pages .page'); if (el) el.scrollTop = 0;
      scheduleRender();
    };
    ACT['ar-listen'] = (el) => { const w = B.words.get(el.dataset.w); if (w) playWord(w); };
    ACT['ar-play-word'] = (el) => { const w = B.words.get(el.dataset.w); if (w) playWord(w); };
    ACT['ar-listen-verse'] = (el) => playVerse(Number(el.dataset.s), Number(el.dataset.a));
    ACT['ar-play-name'] = (el) => { const l = B.letters.get(el.dataset.l); if (l && l.nomAudio) playClip(verseUrl(l.nomAudio.loc[0], l.nomAudio.loc[1]), 0, l.nomAudio.clip[1], 'nom:' + l.id); };
    ACT['ar-exam'] = async (el) => {
      if (!(await needBank())) return;
      const k = el.dataset.k; const lvN = currentLevel(); const L = levelStatus(lvN);
      if (k === 'confirmation' && !(L.pass && L.pass.date < todayISO())) { toast('La confirmation se fait un autre jour que la réussite.'); return; }
      Ex.cur = buildExam(lvN, k); Ex.cur.step = 'intro'; openPage('ar-exam', { src: 'exam' });
    };
    ACT['ar-exam-go'] = () => { if (!Ex.cur) return; Ex.cur.step = 'run'; scheduleRender(); };
    ACT['ar-exam-close'] = () => { Ex.cur = null; backPage(); };
    ACT['ar-fiche-day'] = async () => {
      if (!(await needBank())) return; let F = null; try { F = await fiches(); } catch (e) { toast('La liste des fiches n’a pas pu être chargée (réseau).', true); return; }
      const u = currentUnit(); const f = F.fiches.find((x) => x.unit === u.id) || F.fiches.find((x) => x.lv === currentLevel());
      openPage('ar-sheets', { focus: f ? f.id : null });
    };
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
            <p class="fine">Programme, consignes et exercices : choix de conception de l’appli, non relus par un enseignant. Validation d’un niveau : ${esc(B.d.validation.regle)} ${esc(B.d.validation.nature)}</p></section>`;
      };
    }

    for (const k of Object.keys(PAGES)) {
      if (!k.startsWith('ar-')) continue;
      const P = PAGES[k]; const r = P.render;
      P.render = function (...a) { return frNb(r.apply(this, a)); };
    }
    api.registerTab('arabe', renderTab);
    window.__AR = { bank, st, atts, exams, makeSet, buildExam, newSession, Sess, Run, Ex, GEN, ctxFor, currentLevel, currentUnit, unitDone, errorItems, B };
  });
})();
