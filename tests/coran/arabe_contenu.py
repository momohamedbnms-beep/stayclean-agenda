"""« Lire et écrire l'arabe » : balayage de tous les niveaux et unités (séries d'exercices et examens), sans
interface. Vérifie qu'aucune série n'est vide, que chaque examen a le nombre de questions annoncé, et qu'aux
niveaux 0 et 1 aucun exercice ne montre une lettre pas encore étudiée."""
from qa import *
import sys, json

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

JS = r"""async () => {
  const A = window.__AR; await A.bank(); const B = A.B; const out = { units: {}, exams: {}, leaks: [], errors: [] };
  const AR = /[ء-ي]/g;
  for (const lv of B.d.levels) {
    for (const u of lv.units) {
      let items = [];
      try { for (let k = 0; k < 6; k++) items = items.concat(A.makeSet({ lv: lv.n, unit: B.units.get(u.id), n: 10, seed: 'chk:' + u.id + ':' + k })); }
      catch (e) { out.errors.push(u.id + ' ' + e.message); }
      const types = {}; for (const it of items) types[it.t] = (types[it.t] || 0) + 1;
      out.units[u.id] = { n: items.length, types };
      if (lv.n <= 1) {
        // lettres étudiées jusqu'à cette unité
        const known = new Set();
        if (lv.n === 0) ['alif', 'ba', 'ta', 'tha', 'dal', 'dhal', 'ra', 'zay', 'waw', 'nun', 'ya'].forEach((id) => known.add(B.letters.get(id).ch));
        else { for (const x of lv.units) { (x.letters || []).forEach((id) => known.add(B.letters.get(id).ch)); if (x.id === u.id) break; } }
        for (const it of items) {
          if (it.t === 'liaison') continue;   // présente les six lettres qui ne s'attachent pas (notion du niveau 0)
          const shown = [].concat((it.ch || []).map((c) => c.html), it.tiles || [], it.show || '', it.model || '').join(' ');
          const letters = (shown.replace(/<[^>]+>/g, ' ').match(AR) || []).map((c) => ('أإآٱ'.includes(c) ? 'ا' : c));
          const bad = letters.filter((c) => !known.has(c) && !'ًٌٍَُِّْٰ'.includes(c));
          if (bad.length) out.leaks.push(u.id + ':' + it.t + ':' + [...new Set(bad)].join(''));
        }
      }
    }
    try {
      const ex = A.buildExam(lv.n, 'blanc');
      out.exams[lv.n] = ex.secs.map((s) => [s.comp, s.type, s.n, s.items.length, [...new Set(s.items.map((i) => i.t))].join('+')]);
    } catch (e) { out.errors.push('exam ' + lv.n + ' ' + e.message); }
  }
  return out;
}"""

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    r = e.js(JS)
    for u, v in r['units'].items():
        print('  ', u, v['n'], json.dumps(v['types'], ensure_ascii=False))
    for lv, secs in r['exams'].items():
        print('   examen', lv, secs)
    check('aucune erreur de génération', not r['errors'], r['errors'][:5])
    empty = [u for u, v in r['units'].items() if v['n'] == 0]
    check('chaque unité a des exercices', not empty, empty)
    short = [(lv, s) for lv, secs in r['exams'].items() for s in secs if s[3] != s[2]]
    check('chaque partie d’examen a le nombre de questions annoncé', not short, short)
    check('niveaux 0 et 1 : aucune lettre pas encore étudiée', not r['leaks'], r['leaks'][:10])
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
