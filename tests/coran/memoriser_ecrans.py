"""« Mémoriser » (bilan, sourate en cours, listes À réviser / Connues / À apprendre, fiche d'une sourate, objectif,
« Conseils et hadiths »), la vue par juz et
« Mes progrès » : captures dans les trois ambiances et sur grand écran (contrôle visuel), plus contrôles automatiques :
pas de débordement horizontal, contrastes, aucune erreur."""
from qa import *
import sys

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

OVER = """() => { const W = document.documentElement.clientWidth; const bad = [];
  for (const el of document.querySelectorAll('#tab-learn *, #tab-progress *, #pages .page *, #sheets *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) { const cs = getComputedStyle(el); if (cs.position !== 'fixed' && !el.closest('[hidden], .nav')) bad.push((el.className && el.className.baseVal == null ? el.className : el.tagName) + ':' + Math.round(r.left) + '→' + Math.round(r.right)); } }
  return bad.slice(0, 5); }"""

# contraste texte / fond des pastilles d'état et des tuiles (WCAG, texte normal ≥ 4,5)
CONTRAST = """() => { const parse = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
  const lum = (c) => { const m = parse(c); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  // fond réel : les couches translucides (teintes) sont composées sur le premier fond opaque, sinon sur le fond de l'ambiance
  const bgOf = (el) => { const layers = []; let e = el; let base = null;
    while (e) { const m = parse(getComputedStyle(e).backgroundColor); if (m.length >= 3 && !(m.length === 4 && m[3] === 0)) { if (m.length === 4 && m[3] < 1) layers.push(m); else { base = m.slice(0, 3); break; } } e = e.parentElement; }
    if (!base) { const v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); const h = v.replace('#', ''); base = h.length === 6 ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) : [255, 255, 255]; }
    for (let i = layers.length - 1; i >= 0; i--) { const [r, g, b, a] = layers[i]; base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)]; }
    return `rgb(${base[0]}, ${base[1]}, ${base[2]})`; };
  const blend = (fg, bg) => { const a = parse(fg); const b = parse(bg); if (a.length < 4) return fg; const k = a[3]; return `rgb(${a[0] * k + b[0] * (1 - k)}, ${a[1] * k + b[1] * (1 - k)}, ${a[2] * k + b[2] * (1 - k)})`; };
  const out = {};
  for (const sel of ['.mz-chip--known', '.mz-chip--learning', '.mz-chip--partial', '.mz-chip--none', '.mz-seg__b--known.is-on', '.mz-seg__b--learning.is-on', '.mz-tile--known .mz-tile__n', '.mz-tile--learning .mz-tile__p',
      '.mz-moment__k', '.mz-moment__s', '.mz-moment__goal small', '.mz-moment__goal.is-late b', '.mz-moment__more > button', '.mz-lede', '.mz-num span', '.mz-num--known b', '.mz-num--cur b', '.mz-num--rev b', '.mz-bilan__p',
      '.mz-tabs__b:not(.is-on)', '.mz-tabs__b:not(.is-on) b', '.mz-tabs__b.is-on', '.mz-tabs__b.is-on b', '.mz-lists__hint', '.mz-li__t b', '.mz-li__t small', '.mz-li.is-cur .mz-li__t small', '.mz-li__b', '.mz-empty small', '.mz-next__proj',
      '.mz-sh__s', '.mz-sh__st', '.mz-advice__b p', '.mz-hadiths small', '.mz-steps small', '.link-row__sub', '.mz-due__d small', '.opt__t small']) {
    const el = document.querySelector('#tab-learn ' + sel + ', #tab-progress ' + sel + ', #pages ' + sel + ', #sheets ' + sel); if (!el || !el.offsetParent) continue;
    const cs = getComputedStyle(el); const bg = bgOf(el);
    const a = lum(cs.color), b = lum(bg); out[sel] = Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10; }
  return out; }"""

ICONS = """() => { const parse = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
  const lum = (c) => { const m = parse(c); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const bgOf = (el) => { let e = el; while (e) { const m = parse(getComputedStyle(e).backgroundColor); if (m.length >= 3 && !(m.length === 4 && m[3] < 1)) return getComputedStyle(e).backgroundColor; e = e.parentElement; } return getComputedStyle(document.body).backgroundColor; };
  const out = {};
  for (const sel of ['.mz-li__ok', '.mz-li__ok.is-due', '.mz-tick', '.mz-num span']) {
    const el = document.querySelector('#tab-learn ' + sel); if (!el || !el.offsetParent) continue;
    const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); out[sel] = Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10; }
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
        e.js("(d) => window.__QR.setToday(d)", '2026-11-02'); pg.wait_for_timeout(200)
        # premier lancement : rien de coché, la liste « À apprendre » ouverte
        pg.evaluate("() => window.scrollTo(0, 0)")
        e.shot(f'ME-{amb}-depart')
        pg.locator('#tab-learn .mz-lists').scroll_into_view_if_needed(); pg.wait_for_timeout(250)
        e.shot(f'ME-{amb}-a-apprendre')
        over = e.js(OVER); check(f'{amb} : départ et « À apprendre » sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : départ et « À apprendre », contrastes (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        ic = e.js(ICONS); check(f'{amb} : départ, icônes et cases (≥ 3)', ic and min(ic.values()) >= 3, ic)
        pg.click('#tab-learn [data-page="mz-conseils"]'); pg.wait_for_timeout(500)
        e.shot(f'ME-{amb}-conseils')
        over = e.js(OVER); check(f'{amb} : « Conseils et hadiths » sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : « Conseils et hadiths », contrastes (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
        e.js(SEED); pg.wait_for_timeout(600)
        pg.click('#tab-learn .mz-moment [data-act="mz-start"]'); pg.wait_for_timeout(500)
        e.js("(d) => window.__QR.setToday(d)", '2026-11-04'); pg.wait_for_timeout(500)
        pg.evaluate("() => window.scrollTo(0, 0)")
        e.shot(f'ME-{amb}-memoriser')
        pg.locator('#tab-learn .mz-lists').scroll_into_view_if_needed(); pg.wait_for_timeout(250)
        e.shot(f'ME-{amb}-listes')
        over = e.js(OVER); check(f'{amb} : Mémoriser sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : Mémoriser, contrastes (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        pg.click('#tab-learn .mz-moment [data-sheet="mz-goal"]'); pg.wait_for_timeout(500)
        e.shot(f'ME-{amb}-objectif')
        over = e.js(OVER); check(f'{amb} : feuille « objectif » sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : feuille « objectif », contrastes (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        pg.click('.sheet [data-act="sheet-close"]'); pg.wait_for_timeout(300)
        e.js("(d) => window.__QR.setToday(d)", '2026-11-20'); pg.wait_for_timeout(400)
        pg.evaluate("() => window.scrollTo(0, 0)")
        e.shot(f'ME-{amb}-depasse')
        cr = e.js(CONTRAST); check(f'{amb} : objectif dépassé, contrastes (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        pg.click('#tab-learn .mz-num--rev'); pg.wait_for_timeout(600)
        e.shot(f'ME-{amb}-reviser')
        over = e.js(OVER); check(f'{amb} : « À réviser » sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : « À réviser », contrastes (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        ic = e.js(ICONS); check(f'{amb} : « À réviser », icônes (≥ 3)', ic and min(ic.values()) >= 3, ic)
        pg.click('#tab-learn .mz-tabs__b[data-tab="known"]'); pg.wait_for_timeout(400)
        pg.locator('#tab-learn .mz-lists').scroll_into_view_if_needed(); pg.wait_for_timeout(250)
        e.shot(f'ME-{amb}-connues')
        over = e.js(OVER); check(f'{amb} : « Connues » sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : « Connues », contrastes (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        ic = e.js(ICONS); check(f'{amb} : « Connues », icônes (≥ 3)', ic and min(ic.values()) >= 3, ic)
        pg.click('#tab-learn .mz-li__main[data-s="113"]'); pg.wait_for_timeout(500)
        e.shot(f'ME-{amb}-fiche')
        over = e.js(OVER); check(f'{amb} : fiche d’une sourate sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : fiche d’une sourate, contrastes (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pg.click('#tab-learn .mz-tabs__b[data-tab="todo"]'); pg.wait_for_timeout(400)
        pg.click('#tab-learn [data-page="mz-path"]'); pg.wait_for_timeout(500)
        pg.click('.page [data-act="mz-juz"][data-j="30"]'); pg.wait_for_timeout(600)
        e.shot(f'ME-{amb}-juz')
        over = e.js(OVER); check(f'{amb} : juz sans débordement', not over, over)
        pg.click('.page [data-act="mz-group"][data-i="239"]'); pg.wait_for_timeout(600)
        e.shot(f'ME-{amb}-groupe')
        over = e.js(OVER); check(f'{amb} : groupe sans débordement', not over, over)
        cr = e.js(CONTRAST); check(f'{amb} : contrastes dans le groupe (≥ 4,5)', cr and min(cr.values()) >= 4.5, cr)
        pg.locator('.page .mz-parts').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        e.shot(f'ME-{amb}-groupe-sourates')
        while pg.locator('.page [data-act="back"]').count():
            pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
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
