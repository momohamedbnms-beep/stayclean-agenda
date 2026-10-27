"""« Mémoriser » et « Mes progrès » : captures dans les trois ambiances et sur grand écran (contrôle visuel),
plus contrôles automatiques : pas de débordement horizontal, contraste des états, aucune erreur."""
from qa import *
import sys

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

OVER = """() => { const W = document.documentElement.clientWidth; const bad = [];
  for (const el of document.querySelectorAll('#tab-learn *, #tab-progress *, #pages .page *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) { const cs = getComputedStyle(el); if (cs.position !== 'fixed' && !el.closest('[hidden], .nav')) bad.push((el.className && el.className.baseVal == null ? el.className : el.tagName) + ':' + Math.round(r.left) + '→' + Math.round(r.right)); } }
  return bad.slice(0, 5); }"""

# contraste texte / fond des pastilles d'état et des tuiles (WCAG, texte normal ≥ 4,5)
CONTRAST = """() => { const parse = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
  const lum = (c) => { const m = parse(c); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const bgOf = (el) => { let e = el; while (e) { const cs = getComputedStyle(e); const m = parse(cs.backgroundColor); if (cs.backgroundColor && !(m.length === 4 && m[3] === 0) && cs.backgroundColor !== 'transparent') return cs.backgroundColor; e = e.parentElement; } return 'rgb(255,255,255)'; };
  const blend = (fg, bg) => { const a = parse(fg); const b = parse(bg); if (a.length < 4) return fg; const k = a[3]; return `rgb(${a[0] * k + b[0] * (1 - k)}, ${a[1] * k + b[1] * (1 - k)}, ${a[2] * k + b[2] * (1 - k)})`; };
  const out = {};
  for (const sel of ['.mz-chip--known', '.mz-chip--learning', '.mz-chip--partial', '.mz-chip--none', '.mz-seg__b--known.is-on', '.mz-seg__b--learning.is-on', '.mz-tile--known .mz-tile__n', '.mz-tile--learning .mz-tile__p']) {
    const el = document.querySelector('#tab-learn ' + sel + ', #tab-progress ' + sel + ', #pages ' + sel); if (!el || !el.offsetParent) continue;
    const cs = getComputedStyle(el); let bg = bgOf(el); const pb = bgOf(el.parentElement || el); bg = blend(bg, pb);
    const a = lum(cs.color), b = lum(bg); out[sel] = Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10; }
  return out; }"""

SEED = """async () => { const Q = window.__QR; await Q.loadGroups(); const G = Q.Groups.d;
  await Q.setStatus([[1, 1, 7]], 'known');
  await Q.setStatus(G.groups[238].r, 'known');
  await Q.setStatus([[112, 1, 4], [113, 1, 5], [114, 1, 6], [108, 1, 3]], 'known');
  await Q.setStatus(G.groups[239].r, 'learning');
  await Q.setStatus(G.groups[224].r, 'learning');
  await Q.setStatus([[2, 1, 25]], 'known');
  Q.renderAll(); }"""

with sync_playwright() as p:
    for amb, vp in (('nuit', (390, 844)), ('papier', (390, 844)), ('vert', (1280, 900))):
        e = Env(p, viewport=vp, dark=(amb == 'nuit'))
        pg = e.open()
        e.js("(a) => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { ambiance: a }))", amb); pg.wait_for_timeout(300)
        e.js(SEED); pg.wait_for_timeout(600)
        pg.evaluate("() => window.scrollTo(0, 0)")
        e.shot(f'ME-{amb}-memoriser')
        over = e.js(OVER); check(f'{amb} : Mémoriser sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : contrastes des états (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        pg.click('#tab-learn [data-act="mz-juz"][data-j="30"]'); pg.wait_for_timeout(600)
        e.shot(f'ME-{amb}-juz')
        over = e.js(OVER); check(f'{amb} : juz sans débordement', not over, over)
        pg.click('.page [data-act="mz-group"][data-i="239"]'); pg.wait_for_timeout(600)
        e.shot(f'ME-{amb}-groupe')
        over = e.js(OVER); check(f'{amb} : groupe sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : contrastes dans le groupe (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        pg.locator('.page .mz-parts').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        e.shot(f'ME-{amb}-groupe-sourates')
        pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300); pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
        pg.click('.nav__tab[data-tab="progress"]'); pg.wait_for_timeout(700)
        e.shot(f'ME-{amb}-progres')
        over = e.js(OVER); check(f'{amb} : Mes progrès sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : contrastes de la carte (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        pg.locator('#tab-progress .mz-map').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        e.shot(f'ME-{amb}-carte')
        print(amb, 'ERRORS', real_errors(e.errors))
        check(f'{amb} : aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
        e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
