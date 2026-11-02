"""Tour complet des écrans (petit, moyen et grand téléphone ; ambiance claire et sombre) : rien ne déborde, aucun texte
coupé, rien de caché sous la barre du bas, le lecteur ou un message, les feuilles se lisent jusqu'au bout.
Données proches d'un vrai usage : 6 sourates connues, 3 commencées, une en cours ; récitation qui continue."""
from qa import *
import sys

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

OVER = """(root) => { const W = document.documentElement.clientWidth; const out = [];
  for (const el of document.querySelectorAll(root + ' *')) { const r = el.getBoundingClientRect(); if (!r.width || el.closest('[hidden]')) continue;
    if (r.right > W + 1 || r.left < -1) out.push((el.className && el.className.baseVal == null ? el.className : el.tagName) + ' ' + Math.round(r.left) + '→' + Math.round(r.right)); }
  return out.slice(0, 4); }"""
# texte coupé : un bloc de texte plus large que sa boîte (hors champs, défilements voulus et textes arabes)
CLIP = """(root) => [...document.querySelectorAll(root + ' b, ' + root + ' small, ' + root + ' p, ' + root + ' span')].filter((el) => {
    if (!el.offsetParent || el.closest('[dir="rtl"]') || el.closest('.mz-days')) return false;
    const cs = getComputedStyle(el); if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.textOverflow === 'ellipsis') return false;
    return el.scrollWidth > el.clientWidth + 2 && cs.display !== 'inline'; }).map((el) => el.className || el.tagName).slice(0, 4)"""
# le bas du contenu n'est pas caché par ce qui flotte (barre du bas, lecteur)
BOTTOM = """(sel) => { window.scrollTo(0, document.documentElement.scrollHeight); const sc = document.querySelector('#pages .page'); if (sc) sc.scrollTop = sc.scrollHeight;
  const items = [...document.querySelectorAll(sel)].filter((el) => el.offsetParent); const last = items[items.length - 1]; if (!last) return { ok: true, why: 'rien' };
  const b = last.getBoundingClientRect().bottom; let top = innerHeight;
  for (const f of ['.nav__bar', '#player:not([hidden]) .player__in']) { const n = document.querySelector(f); if (n && n.offsetParent && getComputedStyle(n).visibility !== 'hidden') { const r = n.getBoundingClientRect(); if (r.height) top = Math.min(top, r.top); } }
  return { ok: b <= top + 1, b: Math.round(b), top: Math.round(top) }; }"""
SEED = """async () => { const Q = window.__QR; await Q.loadGroups();
  for (const s of [1, 113, 111, 110, 108, 107]) await Q.setStatus(Q.suraParts(s), 'known');
  for (const s of [109, 106, 105]) await Q.setStatus(Q.suraParts(s), 'learning');
  Q.renderAll(); }"""

def screens(e, pg, tag):
    def ok_over(root, what):
        o = e.js(OVER, root); check(f'{tag} : {what} sans débordement', not o, o)
    def ok_clip(root, what):
        c = e.js(CLIP, root); check(f'{tag} : {what}, aucun texte coupé', not c, c)
    # Mémoriser : haut, listes, bas de page
    pg.evaluate("() => window.scrollTo(0, 0)"); pg.wait_for_timeout(250)
    e.shot(f'EC-{tag}-1-haut')
    ok_over('#tab-learn', 'Mémoriser'); ok_clip('#tab-learn', 'Mémoriser')
    for k in ('rev', 'known', 'todo'):
        pg.click(f'#tab-learn .mz-tabs__b[data-tab="{k}"]'); pg.wait_for_timeout(350)
        ok_over('#tab-learn', f'liste « {k} »'); ok_clip('#tab-learn .mz-lists', f'liste « {k} »')
    pg.locator('#tab-learn .mz-lists').scroll_into_view_if_needed(); pg.wait_for_timeout(250)
    e.shot(f'EC-{tag}-2-a-apprendre')
    r = e.js(BOTTOM, '#tab-learn section, #tab-learn .link-row'); check(f'{tag} : bas de « Mémoriser » visible au-dessus de la barre', r['ok'], r)
    e.shot(f'EC-{tag}-3-bas')
    # les fiches : connue, en cours, à apprendre
    for s, what in ((113, 'fiche connue'), (99, 'fiche en cours'), (102, 'fiche à apprendre')):
        pg.click('#tab-learn .mz-tabs__b[data-tab="known"]' if s == 113 else '#tab-learn .mz-tabs__b[data-tab="todo"]'); pg.wait_for_timeout(300)
        if not pg.locator(f'#tab-learn .mz-li__main[data-s="{s}"]').count():
            pg.click('#tab-learn [data-act="mz-all"]'); pg.wait_for_timeout(300)
        pg.click(f'#tab-learn .mz-li__main[data-s="{s}"]'); pg.wait_for_timeout(450)
        ok_over('#sheets', what); ok_clip('#sheets', what)
        r = e.js("() => { const sh = document.querySelector('#sheets .sheet'); sh.scrollTop = sh.scrollHeight; const o = [...sh.querySelectorAll('.opt')].pop(); const b = o.getBoundingClientRect().bottom; return { ok: b <= innerHeight + 1, b: Math.round(b), h: innerHeight }; }")
        check(f'{tag} : {what}, dernier bouton atteignable', r['ok'], r)
        check(f'{tag} : {what}, aucun message par-dessus', pg.locator('#toasts .toast').count() == 0)
        if s == 99: e.shot(f'EC-{tag}-4-fiche-en-cours')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # les feuilles : ordre, objectif, autre sourate
    pg.click('#tab-learn .mz-tabs__b[data-tab="todo"]'); pg.wait_for_timeout(300)
    for sel, what in (('#tab-learn .mz-order', 'feuille de l’ordre'), ('#tab-learn .mz-moment [data-sheet="mz-goal"]', 'feuille de l’objectif'), ('#tab-learn .mz-moment [data-sheet="mz-pick"]', 'feuille « Autre sourate »')):
        pg.locator(sel).scroll_into_view_if_needed(); pg.click(sel); pg.wait_for_timeout(450)
        ok_over('#sheets', what); ok_clip('#sheets', what)
        if 'ordre' in what: e.shot(f'EC-{tag}-5-ordre')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # Conseils, par juz, un juz
    pg.click('#tab-learn [data-page="mz-conseils"]'); pg.wait_for_timeout(500)
    ok_over('#pages', 'Conseils et hadiths'); ok_clip('#pages', 'Conseils et hadiths')
    r = e.js(BOTTOM, '#pages .page p'); check(f'{tag} : Conseils lisibles jusqu’en bas', r['ok'], r)
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    pg.click('#tab-learn [data-page="mz-path"]'); pg.wait_for_timeout(500)
    ok_over('#pages', 'Par juz'); pg.click('.page [data-act="mz-juz"][data-j="30"]'); pg.wait_for_timeout(500)
    ok_over('#pages', 'Juz 30'); ok_clip('#pages', 'Juz 30')
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300); pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    # lecteur avec récitation, puis retour sur l'onglet (la récitation continue)
    pg.click('#tab-learn .mz-moment [data-act="open-reader"]'); pg.wait_for_timeout(1300)
    pg.click('.page [data-act="reader-play"]'); pg.wait_for_timeout(1200)
    ok_over('#pages', 'lecteur'); ok_over('#player', 'lecteur audio')
    r = e.js(BOTTOM, '#pages .page .verse'); check(f'{tag} : lecteur, dernier verset au-dessus du lecteur audio', r['ok'], r)
    e.shot(f'EC-{tag}-6-lecteur')
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(500)
    lay = e.js("() => { const p = document.querySelector('#player .player__in'); const n = document.querySelector('.nav__bar'); if (!p || !n) return null; return { pb: Math.round(p.getBoundingClientRect().bottom), nt: Math.round(n.getBoundingClientRect().top) }; }")
    check(f'{tag} : récitation en cours sur l’onglet : lecteur au-dessus de la barre du bas', lay and lay['pb'] <= lay['nt'] + 1, lay)
    r = e.js(BOTTOM, '#tab-learn section, #tab-learn .link-row'); check(f'{tag} : avec le lecteur, bas de « Mémoriser » encore visible', r['ok'], r)
    e.shot(f'EC-{tag}-7-onglet-lecteur')
    pg.click('#player [data-act="player-stop"]'); pg.wait_for_timeout(300)
    # réglages (voix), Mes progrès, Lire, Arabe
    pg.click('[data-act="open-page"][data-page="settings"]'); pg.wait_for_timeout(600)
    ok_over('#pages', 'Réglages'); ok_clip('#pages .rc', 'Réglages, voix')
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    for t in ('progress', 'read', 'arabe'):
        if not pg.locator(f'.nav__tab[data-tab="{t}"]').count(): continue
        pg.click(f'.nav__tab[data-tab="{t}"]'); pg.wait_for_timeout(800)
        ok_over(f'#tab-{t}', f'onglet {t}')
        r = e.js(BOTTOM, f'#tab-{t} > *'); check(f'{tag} : onglet {t}, bas visible au-dessus de la barre', r['ok'], r)
    pg.click('.nav__tab[data-tab="learn"]'); pg.wait_for_timeout(400)

with sync_playwright() as p:
    for vp, amb in (((375, 667), 'vert'), ((390, 844), 'nuit'), ((430, 932), 'papier')):
        tag = f'{vp[0]}-{amb}'
        e = Env(p, viewport=vp, dark=(amb == 'nuit'))
        pg = e.open(order=None)
        e.js("(a) => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { ambiance: a }))", amb); pg.wait_for_timeout(300)
        e.js("(d) => window.__QR.setToday(d)", '2026-11-02'); pg.wait_for_timeout(200)
        e.js(SEED); pg.wait_for_timeout(500)
        pg.click('#tab-learn .mz-tabs__b[data-tab="todo"]'); pg.wait_for_timeout(300)
        pg.click('#tab-learn [data-act="mz-all"]'); pg.wait_for_timeout(300)
        pg.click('#tab-learn .mz-li__main[data-s="99"]'); pg.wait_for_timeout(400)
        pg.click('#sheets [data-act="mz-start"]'); pg.wait_for_timeout(600)
        e.js("(d) => window.__QR.setToday(d)", '2026-11-12'); pg.wait_for_timeout(400)   # des révisions arrivent
        screens(e, pg, tag)
        check(f'{tag} : aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
        e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
