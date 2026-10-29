"""Le coach : captures dans les trois ambiances et sur grand écran (carte d'« Étudier », page « Mon coach » de haut
en bas, résultat d'examen), plus contrôles automatiques : pas de débordement horizontal, contrastes, aucune erreur."""
from qa import *
import sys
from ar_helpers import SEED, TODAY   # historique fictif partagé

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

OVER = """() => { const W = document.documentElement.clientWidth; const bad = [];
  for (const el of document.querySelectorAll('#tab-arabe *, #pages .page *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) { const cs = getComputedStyle(el); if (cs.position !== 'fixed' && !el.closest('.ar-seg, [hidden], .nav')) bad.push((el.className && el.className.baseVal == null ? el.className : el.tagName) + ':' + Math.round(r.left) + '→' + Math.round(r.right)); } }
  return bad.slice(0, 5); }"""
CONTRAST = """() => { const parse = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
  const lum = (c) => { const m = parse(c); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const bgOf = (el) => { let e = el; while (e) { const cs = getComputedStyle(e); const m = parse(cs.backgroundColor); if (cs.backgroundColor && !(m.length === 4 && m[3] === 0) && cs.backgroundColor !== 'transparent') return cs.backgroundColor; e = e.parentElement; } return 'rgb(255,255,255)'; };
  const out = {};
  for (const sel of ['.ar-coach__k', '.ar-coach__d', '.ar-cw__n', '.ar-cw__x', '.ar-ctypes li.is-ko b', '.ar-ctypes li.is-ok b', '.ar-again', '.ar-cex li small', '.ar-cnote']) {
    const el = document.querySelector('#tab-arabe ' + sel + ', #pages ' + sel); if (!el || !el.offsetParent) continue;
    const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); out[sel] = Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10; }
  return out; }"""

def scroll_page(pg, y):
    pg.evaluate("(y) => { const p = document.querySelector('#pages .page'); if (p) p.scrollTop = y; }", y); pg.wait_for_timeout(250)

with sync_playwright() as p:
    for amb, vp in (('nuit', (390, 844)), ('papier', (390, 844)), ('vert', (1280, 900))):
        e = Env(p, viewport=vp, dark=(amb == 'nuit'))
        pg = e.open()
        e.js("(d) => window.__QR.setToday(d)", TODAY)
        e.js("(a) => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { ambiance: a }))", amb); pg.wait_for_timeout(300)
        pg.click('.nav__tab[data-tab="arabe"]'); pg.wait_for_timeout(800)
        e.js(SEED); pg.wait_for_timeout(700)
        pg.locator('#tab-arabe .ar-coach').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        e.shot(f'CE-{amb}-carte')
        over = e.js(OVER); check(f'{amb} : carte du coach sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : carte, contrastes ≥ 4,5', cr and min(cr.values()) >= 4.5, cr)
        pg.click('#tab-arabe .ar-coach [data-page="ar-coach"]'); pg.wait_for_timeout(700)
        h = pg.evaluate("() => document.querySelector('#pages .page').scrollHeight")
        for k, y in enumerate(range(0, h, 700)):
            scroll_page(pg, y); e.shot(f'CE-{amb}-page-{k}')
            if k > 6: break
        over = e.js(OVER); check(f'{amb} : page du coach sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : page du coach, contrastes ≥ 4,5', cr and min(cr.values()) >= 4.5, cr)
        print(amb, 'ERRORS', real_errors(e.errors))
        check(f'{amb} : aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
        e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
