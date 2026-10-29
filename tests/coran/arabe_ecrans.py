"""« Lire et écrire l'arabe » : captures dans les trois ambiances et sur grand écran (contrôle visuel), plus
contrôles automatiques : pas de débordement horizontal, contraste des pastilles de chapitre, aucune erreur."""
from qa import *
import sys
from ar_helpers import answer_current, advance

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

OVER = """() => { const W = document.documentElement.clientWidth; const bad = [];
  for (const el of document.querySelectorAll('#tab-arabe *, #pages .page *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) { const cs = getComputedStyle(el); if (cs.position !== 'fixed' && !el.closest('.ar-kb, .ar-seg, [hidden], .nav')) bad.push((el.className || el.tagName) + ':' + Math.round(r.left) + '→' + Math.round(r.right)); } }
  return bad.slice(0, 5); }"""

CONTRAST = """() => { const lum = (c) => { const m = c.match(/\\d+(\\.\\d+)?/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const out = []; for (const el of document.querySelectorAll('.ar-num:not(.is-done)')) { const cs = getComputedStyle(el); const a = lum(cs.color), b = lum(cs.backgroundColor); const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); out.push(Math.round(r * 10) / 10); } return out; }"""

with sync_playwright() as p:
    for amb, vp in (('nuit', (390, 844)), ('papier', (390, 844)), ('vert', (1280, 900))):
        e = Env(p, viewport=vp, dark=(amb == 'nuit'))
        pg = e.open()
        e.js("(a) => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { ambiance: a }))", amb); pg.wait_for_timeout(300)
        pg.click('.nav__tab[data-tab="arabe"]'); pg.wait_for_timeout(900)
        e.shot(f'AE-{amb}-etudier')
        over = e.js(OVER); check(f'{amb} : Étudier sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : numéros de chapitre lisibles (contraste ≥ 4,5)', cr and min(cr) >= 4.5, sorted(set(cr)))
        pg.click('.ar-chap[data-ch="c6"]'); pg.wait_for_timeout(600)
        e.shot(f'AE-{amb}-chapitre')
        over = e.js(OVER); check(f'{amb} : page de chapitre sans débordement', not over, over)
        pg.click('.ar-path__b[data-act="ar-step"]'); pg.wait_for_timeout(700)
        e.shot(f'AE-{amb}-etape')
        over = e.js(OVER); check(f'{amb} : étape sans débordement', not over, over)
        pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
        pg.click('.ar-path__b[data-act="ar-exam"]'); pg.wait_for_timeout(600)
        e.shot(f'AE-{amb}-examen-annonce')
        over = e.js(OVER); check(f'{amb} : annonce de l’examen (10 ou 15 questions) sans débordement', not over, over)
        pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(300)
        n = 0; kb = False; sel = False
        while pg.locator('.ar-ex').count() and n < 25:
            t = e.js("() => { const e = window.__AR.Ex.cur; const it = e.secs.flatMap((x) => x.items)[e.i]; return it ? it.t : null; }")
            if t and t.startswith('k_') and not kb:
                e.shot(f'AE-{amb}-clavier'); kb = True
                over = e.js(OVER); check(f'{amb} : clavier arabe sans débordement', not over, over)
            if not sel and pg.locator('.ar-ex [data-act="ar-pick"]').count():
                pg.locator('.ar-ex [data-act="ar-pick"]').first.click(); pg.wait_for_timeout(250)
                e.shot(f'AE-{amb}-choix'); sel = True
                over = e.js(OVER); check(f'{amb} : réponse choisie + « Valider » sans débordement', not over, over)
            answer_current(e, right=(n % 6 != 2)); advance(pg); n += 1
        pg.wait_for_timeout(600)
        e.shot(f'AE-{amb}-resultat')
        pg.click('[data-act="ar-exam-close"]'); pg.wait_for_timeout(300)
        pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
        for v in ('train', 'exams', 'sheets'):
            pg.click(f'[data-act="ar-view"][data-v="{v}"]'); pg.wait_for_timeout(700)
            e.shot(f'AE-{amb}-{v}')
            over = e.js(OVER); check(f'{amb} : {v} sans débordement', not over, over)
        print(amb, 'ERRORS', real_errors(e.errors))
        check(f'{amb} : aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
        e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
