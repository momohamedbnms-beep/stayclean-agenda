"""« Lire et écrire l'arabe » : balayage de tout le cours, sans interface.
Chaque examen (10 chapitres + final) a exactement le nombre de questions annoncé dans chaque partie, à chaque tirage ;
chaque étape a sa vérification de 3 questions corrigées par l'appli ; chaque chapitre a ses 10 exercices ;
dans les chapitres 1 à 5, aucun exercice ne montre une lettre pas encore étudiée ; la correction au clavier
compte juste ce qui est juste (lettres, voyelles, ordre des signes sans importance)."""
from qa import *
import sys, json

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

JS = r"""async () => {
  const A = window.__AR; await A.bank(); const B = A.B; const out = { exams: {}, checks: {}, train: {}, leaks: [], errors: [], kbtypes: {} };
  const AR = /[ء-ي]/g;
  const ids = B.d.chapters.map((c) => c.id).concat(['final']);
  for (const id of ids) {
    for (let k = 0; k < 4; k++) {
      try {
        const e = A.buildExam(id);
        const got = e.secs.map((s) => s.items.length); const want = B.d.chExams[id].map((s) => s.n);
        out.exams[id] = out.exams[id] || { want, got: [], types: {}, oral: e.oral.length, self: 0 };
        out.exams[id].got.push(got);
        for (const it of e.secs.flatMap((s) => s.items)) { out.exams[id].types[it.t] = (out.exams[id].types[it.t] || 0) + 1; if (it.grade === 'self') out.exams[id].self++; if (it.kb) out.kbtypes[it.t] = (out.kbtypes[it.t] || 0) + 1; }
      } catch (er) { out.errors.push('examen ' + id + ' : ' + er.message); }
    }
  }
  for (const c of B.d.chapters) {
    for (const u of c.units) {
      try { const xs = A.checkSet(B.units.get(u)); out.checks[u] = [xs.length, xs.filter((x) => x.grade === 'self').length, [...new Set(xs.map((x) => x.t))].join('+')]; }
      catch (er) { out.errors.push('vérification ' + u + ' : ' + er.message); }
    }
    try { const xs = A.trainSet(c); out.train[c.id] = [xs.length, [...new Set(xs.map((x) => x.t))].join('+')]; } catch (er) { out.errors.push('entraînement ' + c.id + ' : ' + er.message); }
    // lettres montrées dans les chapitres 1 à 5 : seulement celles déjà étudiées
    if (c.n <= 5) {
      const known = new Set();
      if (c.n === 1) ['alif', 'ba', 'ta', 'tha', 'dal', 'dhal', 'ra', 'zay', 'waw', 'nun', 'ya'].forEach((id) => known.add(B.letters.get(id).ch));
      else { for (const x of B.d.levels[1].units) { (x.letters || []).forEach((id) => known.add(B.letters.get(id).ch)); if (x.id === c.units[c.units.length - 1]) break; } }
      let items = [];
      for (let k = 0; k < 3; k++) { items = items.concat(A.buildExam(c.id).secs.flatMap((s) => s.items)); items = items.concat(A.trainSet(c)); }
      for (const u of c.units) items = items.concat(A.checkSet(B.units.get(u)));
      for (const it of items) {
        if (it.t === 'liaison') continue;   // présente les six lettres qui ne s'attachent pas (notion du chapitre 1)
        const shown = [].concat((it.ch || []).map((x) => x.html), it.tiles || [], it.show || '', it.model || '', it.kb ? it.ans : '').join(' ');
        const letters = (shown.replace(/<[^>]+>/g, ' ').match(AR) || []).map((x) => ('أإآٱ'.includes(x) ? 'ا' : x));
        const bad = letters.filter((x) => !known.has(x) && !'ًٌٍَُِّْٰ'.includes(x));
        if (bad.length) out.leaks.push(c.id + ':' + it.t + ':' + [...new Set(bad)].join(''));
      }
    }
  }
  // correction au clavier
  const K = (ans, typed, cmp, loose) => A.kbScore({ ans, cmp, loose }, typed);
  out.kb = {
    lettre_ok: K('ج', 'ج', 'letters'), lettre_ko: K('ج', 'ح', 'letters'), vide: K('ج', ' ', 'letters'),
    dictee_sans_voyelles: K('كَتَبَ', 'كتب', 'letters'), dictee_ordre: K('كَتَبَ', 'بتك', 'letters'),
    full_ok: K('رَبِّ', 'رَبِّ', 'full'), full_ordre_signes: K('رَبِّ', 'رَبِّ'.replace('ِّ', 'ِّ').normalize('NFD').split('').join(''), 'full'), full_shadda_apres: K('رَبِّ', 'ر' + 'َ' + 'ب' + 'ِ' + 'ّ', 'full'),
    full_lettres_seulement: K('رَبِّ', 'رب', 'full'), syllabe_ko: K('بُ', 'بَ', 'strict'), syllabe_ok: K('بُ', 'بُ', 'strict'),
    tanwin_alif: K('كَثِيرًا', 'كَثِيرَاً'.replace('َاً', 'اً'), 'full'), premiere_hamza: K('ا', 'أ', 'letters', true), wasla: K('وَٱلشَّمْسِ', 'والشمس', 'letters'),
  };
  out.oral = {
    nom_ok: A.oralScore({ kind: 'nom', expect: ['جِيم', 'ج'] }, { heard: 'جيم', juste: true }),
    nom_lettre_seule: A.oralScore({ kind: 'nom', expect: ['جِيم', 'ج'] }, { heard: 'ج', juste: true }),
    mot_ok: A.oralScore({ kind: 'mot', expect: ['رَحْمَةً'] }, { heard: 'رحمه', juste: true }),
    mot_voyelles: A.oralScore({ kind: 'mot', expect: ['رَحْمَةً'] }, { heard: 'رَحْمَةُ', juste: false }),
    mot_faux: A.oralScore({ kind: 'mot', expect: ['رَحْمَةً'] }, { heard: 'نعمة', juste: false }),
    vide: A.oralScore({ kind: 'mot', expect: ['رَحْمَةً'] }, { heard: '', juste: false }),
  };
  return out;
}"""

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    r = e.js(JS)
    for k, v in r['exams'].items():
        print('   examen', k, 'attendu', v['want'], 'tirages', v['got'], 'oral', v['oral'], json.dumps(v['types'], ensure_ascii=False))
    for k, v in r['checks'].items():
        print('   vérif', k, v)
    for k, v in r['train'].items():
        print('   entraînement', k, v)
    check('aucune erreur de génération', not r['errors'], r['errors'][:5])
    short = [(k, g) for k, v in r['exams'].items() for g in v['got'] if g != v['want']]
    check('chaque partie d’examen a le nombre de questions annoncé, à chaque tirage', not short, short[:4])
    check('examens : 20 questions par chapitre, 30 pour le final', all(sum(v['want']) == (30 if k == 'final' else 20) for k, v in r['exams'].items()) and len(r['exams']) == 11)
    check('examens : aucune auto-évaluation (tout est noté par l’appli)', all(v['self'] == 0 for v in r['exams'].values()))
    check('examens : réponses au clavier arabe (lettre, syllabe, dictée, première lettre)', all(t in r['kbtypes'] for t in ('k_lettre', 'k_syllabe', 'k_dictee', 'k_premiere')), r['kbtypes'])
    check('partie orale : 5 éléments, sauf au chapitre 1', r['exams']['c1']['oral'] == 0 and all(v['oral'] == 5 for k, v in r['exams'].items() if k != 'c1'))
    bad_checks = {k: v for k, v in r['checks'].items() if v[0] != 3 or v[1] != 0}
    check('chaque étape : 3 questions de vérification corrigées par l’appli', not bad_checks and len(r['checks']) == 31, bad_checks)
    check('chaque chapitre : 10 exercices d’entraînement', all(v[0] == 10 for v in r['train'].values()) and len(r['train']) == 10, {k: v[0] for k, v in r['train'].items() if v[0] != 10})
    check('chapitres 1 à 5 : aucune lettre pas encore étudiée', not r['leaks'], r['leaks'][:10])
    kb = r['kb']; print('   clavier', kb)
    check('clavier : lettre juste 1, fausse 0, vide 0', kb['lettre_ok'] == 1 and kb['lettre_ko'] == 0 and kb['vide'] == 0)
    check('clavier : dictée sans voyelles acceptée quand elles ne comptent pas ; mauvais ordre refusé', kb['dictee_sans_voyelles'] == 1 and kb['dictee_ordre'] == 0)
    check('clavier : voyelles exigées → juste 1, ordre des signes libre, lettres seules ½', kb['full_ok'] == 1 and kb['full_shadda_apres'] == 1 and kb['full_lettres_seulement'] == 0.5)
    check('clavier : syllabe avec la mauvaise voyelle 0, la bonne 1', kb['syllabe_ko'] == 0 and kb['syllabe_ok'] == 1)
    check('clavier : tanwīn « an » avant ou après l’alif, alif de liaison, alif hamza pour la première lettre', kb['tanwin_alif'] == 1 and kb['wasla'] == 1 and kb['premiere_hamza'] == 1)
    o = r['oral']; print('   oral', o)
    check('oral : nom reconnu 1, lettre seule acceptée, mot reconnu malgré ة/ه 1, voyelles douteuses ½, faux 0, vide 0',
          o['nom_ok'] == 1 and o['nom_lettre_seule'] == 1 and o['mot_ok'] == 1 and o['mot_voyelles'] == 0.5 and o['mot_faux'] == 0 and o['vide'] == 0)
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
