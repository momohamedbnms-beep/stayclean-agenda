"""Ordre d'apprentissage : « Les plus courtes d'abord » par défaut (longueur réelle), « Le moins de versets d'abord »,
« L'ordre des écoles coraniques » ; la liste « À apprendre », la sourate proposée, la suivante après « Je la connais »,
« Autre sourate », la date prévue de chaque sourate, la projection, le bilan, la page Conseils ; changer d'ordre ne
touche pas la sourate en cours. Dates simulées, données fictives, aucun service réel."""
from qa import *
import sys, re

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def norm(s): return (s or '').replace(' ', ' ').replace(' ', ' ')
def st(e, s): return e.js(f"() => window.__QR.surahState({s})")
def cu(e): return e.js("() => { const c = window.__QR.curUnit(); return { kind: c.kind, r: c.r || null, g: c.g || null }; }")
def day(e, iso):
    e.js("(d) => window.__QR.setToday(d)", iso); e.page.wait_for_timeout(450)
def rows(e): return e.js("() => [...document.querySelectorAll('#tab-learn .mz-list .mz-li__main')].map((b) => Number(b.dataset.s))")
def row(pg, s): return norm(pg.locator(f'#tab-learn .mz-li:has(.mz-li__main[data-s="{s}"])').inner_text())
def go_tab(pg, k):
    pg.click(f'#tab-learn .mz-tabs__b[data-tab="{k}"]'); pg.wait_for_timeout(400)
def toast(pg): return norm(pg.locator('#toasts').inner_text())
def moment(pg): return norm(pg.locator('#tab-learn .mz-moment').inner_text())

COURT = [1, 108, 103, 112, 106, 110, 114, 113, 111, 105, 107, 109, 94, 102]
VERSETS = [1, 108, 103, 110, 112, 106, 113, 111, 105, 97, 114, 109, 107]

with sync_playwright() as p:
    e = Env(p)
    pg = e.open(order=None)   # l'ordre par défaut
    day(e, '2026-11-02')
    e.js("() => window.__QR.loadGroups()"); pg.wait_for_timeout(300)
    check('ordre par défaut : les plus courtes d’abord', e.js("() => window.__QR.orderKey()") == 'court')
    o = e.js("() => window.__QR.suraOrder()")
    check('les plus courtes d’abord : Al-Fatiha, puis Al-Kawthar, Al-Asr, Al-Ikhlas, Quraish, An-Nasr… (longueur réelle)', o[:len(COURT)] == COURT and len(o) == 114 and sorted(o) == list(range(1, 115)), o[:16])
    words = e.js("() => window.__QR.suraOrder().slice(1).map((s) => window.__QR.Content.index.suras[s - 1].words)")
    check('rangées de la plus courte à la plus longue (en mots)', all(words[i] <= words[i + 1] for i in range(len(words) - 1)), words[:10])
    ov = e.js("() => window.__QR.suraOrder('versets')")
    check('le moins de versets d’abord : Al-Kawthar, Al-Asr, An-Nasr (3 versets), puis Al-Ikhlas, Quraish (4)…', ov[:len(VERSETS)] == VERSETS, ov[:14])
    check('par versets, Al-Mumtahina (13 versets, 348 mots) passe avant Ash-Shams (15 versets, 54 mots) ; pas par longueur', ov.index(60) < ov.index(91) and o.index(60) > o.index(91))
    check('l’ordre des écoles est intact (Al-Fatiha, 114, 113… 2)', e.js("() => window.__QR.suraOrder('ecoles')") == [1] + list(range(114, 1, -1)))
    go_tab(pg, 'todo')
    r0 = rows(e)
    check('« À apprendre » : les 12 premières dans l’ordre des plus courtes', r0 == COURT[:12], r0)
    order_row = norm(pg.locator('#tab-learn .mz-order').inner_text())
    check('la liste dit son ordre (« Ordre : Les plus courtes d’abord », Changer)', 'Ordre : Les plus courtes d’abord' in order_row and 'Changer' in order_row, order_row)
    check('l’explication suit l’ordre : « De la plus courte à la plus longue »', 'De la plus courte à la plus longue' in norm(pg.locator('#tab-learn .mz-lists__hint').inner_text()))
    c = cu(e)
    check('sourate proposée : Al-Fatiha', c['kind'] == 'next' and c['r'] == [1, 1, 7], c)
    # dates prévues : Al-Fatiha 5 jours (2 → 6 nov.), puis Al-Kawthar 2 jours (→ dimanche 8), puis Al-Asr 3 jours (→ 11 nov.)
    check('chaque ligne : versets, effort, date prévue (Al-Kawthar d’ici dimanche, Al-Asr vers le 11 nov.)',
          '3 versets · ≈ 2 jours · d’ici dimanche' in row(pg, 108) and '3 versets · ≈ 3 jours · vers le 11 nov.' in row(pg, 103), (row(pg, 108), row(pg, 103)))
    proj = norm(pg.locator('#tab-learn .mz-next__proj').inner_text()) if pg.locator('#tab-learn .mz-next__proj').count() else ''
    check('projection : « À ce rythme, tu connaîtras les 10 suivantes vers … »', proj.startswith('À ce rythme, tu connaîtras les 10 suivantes vers'), proj)
    bil = norm(pg.locator('#tab-learn .mz-bilan').inner_text())
    check('bilan : tout le Coran et le texte connu en % (pas de juz ʿAmma dans cet ordre)', 'Tout le Coran : 0 sourate sur 114' in bil and 'Texte connu : 0 % des mots du Coran' in bil and 'Juz ʿAmma' not in bil, bil)
    e.shot('OR1-plus-courtes')
    # cocher Al-Fatiha, commencer la suivante, « Je la connais » → la suivante dans l'ordre
    pg.click('#tab-learn .mz-tick[data-s="1"]'); pg.wait_for_timeout(400)
    c = cu(e)
    check('Al-Fatiha cochée : la prochaine est Al-Kawthar', c['kind'] == 'next' and c['r'] == [108, 1, 3] and 'Al-Kawthar' in moment(pg), c)
    pg.click('#tab-learn .mz-moment [data-act="mz-start"]'); pg.wait_for_timeout(500)
    pg.click('#tab-learn .mz-moment [data-act="mz-cur-known"]'); pg.wait_for_timeout(700)
    c = cu(e)
    check('« Je la connais » : la suivante commence, Al-Asr (la plus courte qui reste)', c['kind'] == 'goal' and c['r'] == [103, 1, 3] and 'Ensuite : Al-Asr' in toast(pg), (c, toast(pg)))
    bil = norm(pg.locator('#tab-learn .mz-bilan').inner_text())
    check('bilan : 2 sourates sur 114', 'Tout le Coran : 2 sourates sur 114' in bil, bil)
    # « Autre sourate » : dans l'ordre choisi
    pg.click('#tab-learn .mz-moment [data-sheet="mz-pick"]'); pg.wait_for_timeout(500)
    pick = e.js("() => [...document.querySelectorAll('.sheet [data-act=\"mz-start\"]')].map((b) => Number(b.dataset.s))")
    check('« Autre sourate » : dans l’ordre des plus courtes (Al-Ikhlas, Quraish, An-Nasr…)', pick[:4] == [112, 106, 110, 114], pick[:6])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # changer d'ordre
    go_tab(pg, 'todo')
    pg.click('#tab-learn .mz-order'); pg.wait_for_timeout(500)
    sh = norm(pg.locator('#sheets .sheet').last.inner_text())
    check('feuille « Dans quel ordre apprendre ? » : 3 choix, le conseillé coché, l’exemple d’Al-Mumtahina',
          pg.locator('#sheets [data-act="mz-order-set"]').count() == 3 and pg.locator('#sheets [data-act="mz-order-set"][data-v="court"][aria-checked="true"]').count() == 1
          and 'conseillé' in sh and 'Al-Mumtahina' in sh and 'Al-Kawthar, Al-Asr, Al-Ikhlas' in sh, sh[:300])
    e.shot('OR2-choisir-ordre')
    pg.click('#sheets [data-act="mz-order-set"][data-v="versets"]'); pg.wait_for_timeout(600)
    check('« Le moins de versets d’abord » : enregistré, message, feuille fermée', e.js("() => window.__QR.prefs().order") == 'versets'
          and 'Ordre : le moins de versets d’abord. Ta sourate en cours ne change pas.' in toast(pg) and pg.locator('#sheets .sheet').count() == 0, toast(pg))
    c = cu(e)
    check('la sourate en cours ne change pas (Al-Asr)', c['kind'] == 'goal' and c['r'] == [103, 1, 3], c)
    rv = rows(e)
    check('« À apprendre » par versets : Al-Asr (en cours), An-Nasr, Al-Ikhlas, Quraish, Al-Falaq…', rv[:6] == [103, 110, 112, 106, 113, 111], rv[:8])
    check('l’explication suit : « du moins de versets au plus de versets »', 'du moins de versets au plus de versets' in norm(pg.locator('#tab-learn .mz-lists__hint').inner_text()).lower())
    pg.click('#tab-learn .mz-order'); pg.wait_for_timeout(400)
    pg.click('#sheets [data-act="mz-order-set"][data-v="ecoles"]'); pg.wait_for_timeout(600)
    re_ = rows(e)
    check('« L’ordre des écoles » : Al-Asr (en cours), puis An-Nas, Al-Falaq, Al-Ikhlas… et la projection du juz ʿAmma', re_[:5] == [103, 114, 113, 112, 111]
          and norm(pg.locator('#tab-learn .mz-next__proj').inner_text()).startswith('À ce rythme, tout le juz ʿAmma vers'), re_[:6])
    check('bilan dans cet ordre : juz ʿAmma (avec Al-Fatiha) : 2 sur 38', 'Juz ʿAmma (avec Al-Fatiha) : 2 sur 38' in norm(pg.locator('#tab-learn .mz-bilan').inner_text()))
    pg.click('#tab-learn .mz-order'); pg.wait_for_timeout(400)
    pg.click('#sheets [data-act="mz-order-set"][data-v="court"]'); pg.wait_for_timeout(600)
    check('retour aux plus courtes', e.js("() => window.__QR.orderKey()") == 'court' and rows(e)[:3] == [103, 112, 106], rows(e)[:4])
    # une sourate commencée passe avant les autres (et c'est elle qui est proposée sans objectif)
    e.js("() => window.__QR.setStatus([[99, 1, 8]], 'learning')"); pg.wait_for_timeout(300)
    check('Az-Zalzala commencée : juste après la sourate en cours, marquée « Commencée » avec sa date prévue', rows(e)[:2] == [103, 99] and 'Commencée · ' in row(pg, 99) and ('vers le' in row(pg, 99) or 'd’ici' in row(pg, 99)), (rows(e)[:3], row(pg, 99)))
    e.js("() => window.__QR.setStatus([[103, 1, 3]], 'none')"); pg.wait_for_timeout(400)
    c = cu(e)
    check('sans objectif, la sourate proposée est celle que tu as commencée (Az-Zalzala)', c['kind'] == 'next' and c['r'] == [99, 1, 8] and 'Tu l’as commencée' in moment(pg), c)
    # Conseils et hadiths : l'ordre expliqué, modifiable
    pg.click('#tab-learn [data-page="mz-conseils"]'); pg.wait_for_timeout(500)
    adv = norm(pg.locator('#pages .page').last.inner_text())
    check('Conseils : les trois ordres, le tien, et « Changer l’ordre »', all(x in adv for x in ('Les plus courtes d’abord', 'Le moins de versets d’abord', 'L’ordre des écoles coraniques', 'Ton ordre : les plus courtes d’abord', 'Aucun hadith n’impose d’ordre')) and pg.locator('.page [data-sheet="mz-order"]').count() == 1, adv[:200])
    pg.click('.page [data-sheet="mz-order"]'); pg.wait_for_timeout(400)
    check('« Changer l’ordre » ouvre le choix depuis la page', pg.locator('#sheets [data-act="mz-order-set"]').count() == 3)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    # l'ordre suit le compte (réglages) et survit au rechargement
    pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_function('window.__QR && window.__QR.Content.index !== null'); pg.wait_for_timeout(900)
    check('après rechargement : toujours les plus courtes', e.js("() => window.__QR.orderKey()") == 'court')
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()
    # écrans : nuit et papier, petit téléphone
    for amb, vp in (('nuit', (375, 667)), ('papier', (390, 844))):
        e = Env(p, viewport=vp, dark=(amb == 'nuit'))
        pg = e.open(order=None)
        e.js("(a) => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { ambiance: a }))", amb); pg.wait_for_timeout(300)
        day(e, '2026-11-02')
        e.js("async () => { const Q = window.__QR; await Q.loadGroups(); for (const s of [1, 108, 107]) await Q.setStatus(Q.suraParts(s), 'known'); await Q.setStatus([[106, 1, 4]], 'learning'); Q.renderAll(); }"); pg.wait_for_timeout(400)
        pg.click('#tab-learn .mz-moment [data-act="mz-start"]'); pg.wait_for_timeout(500)
        go_tab(pg, 'todo')
        pg.locator('#tab-learn .mz-lists').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        e.shot(f'OR3-{amb}-a-apprendre')
        over = e.js("() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('#tab-learn *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).map((el) => String(el.className && el.className.baseVal == null ? el.className : el.tagName)).slice(0, 4); }")
        check(f'{amb} : « À apprendre » sans débordement', not over, over)
        clipped = e.js("() => [...document.querySelectorAll('#tab-learn .mz-li__t small, #tab-learn .mz-order__t')].filter((el) => el.scrollWidth > el.clientWidth + 1).length")
        check(f'{amb} : aucun texte coupé dans les lignes', clipped == 0, clipped)
        pg.click('#tab-learn .mz-order'); pg.wait_for_timeout(500)
        e.shot(f'OR4-{amb}-choisir-ordre')
        over = e.js("() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('#sheets *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length; }")
        check(f'{amb} : feuille de l’ordre sans débordement', over == 0, over)
        check(f'{amb} : aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
        e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
