"""Lecteur : recherche, aller au verset, position gardée (affichage/ambiance/rechargement), favoris, pages, juz."""
from qa import *
import sys
checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def in_view(pg, sel):
    return pg.evaluate("""(sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 ? Math.round(r.top) : false }""", sel)

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(300)
    # recherche
    def names(q):
        pg.fill('#readSearch', q); pg.wait_for_timeout(250)
        return e.js("() => [...document.querySelectorAll('#readList .srow, .slist .srow')].map(x => +x.dataset.s)")
    check('recherche nom français « royauté » → 67', 67 in names('royauté')[:3], names('royauté')[:5])
    check('recherche translittéré « mulk » → 67', names('mulk')[:1] == [67], names('mulk')[:3])
    check('recherche arabe « الملك » → 67', 67 in names('الملك')[:2], names('الملك')[:3])
    check('recherche numéro « 36 » → Ya-Sin', names('36') == [36])
    check('recherche « fatiha » → 1', names('fatiha')[:1] == [1])
    check('recherche « Al Kahf » (espace) → 18', names('Al Kahf')[:1] == [18], names('Al Kahf')[:3])
    pg.fill('#readSearch', '2:255'); pg.wait_for_timeout(250)
    check('« 2:255 » propose d’aller au verset', 'Aller au verset 2:255' in pg.locator('.jump').inner_text())
    pg.click('.jump'); pg.wait_for_timeout(1500)
    pos = in_view(pg, '#v-2-255')
    check('verset 2:255 affiché', pos is not None and pos is not False, pos)
    e.shot('60-ayat-kursi')
    # changer d'affichage puis d'ambiance : le verset reste à l'écran
    pg.click('[data-sheet="display"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="read-display"][data-v="ar"]'); pg.wait_for_timeout(500)
    pg.click('#sheets [data-act="set-pref"][data-v="nuit"]'); pg.wait_for_timeout(400)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    pos2 = in_view(pg, '#v-2-255')
    check('après affichage « Arabe » + ambiance Nuit : 2:255 toujours à l’écran', pos2 not in (None, False), pos2)
    e.shot('61-ayat-kursi-nuit-ar')
    # taille du texte
    before = e.js("() => getComputedStyle(document.querySelector('#v-2-255 .ar')).fontSize")
    pg.click('[data-sheet="display"]'); pg.wait_for_timeout(300)
    pg.click('#sheets [data-act="size-step"][data-d="2"]'); pg.wait_for_timeout(300)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    after = e.js("() => getComputedStyle(document.querySelector('#v-2-255 .ar')).fontSize")
    check('taille du texte arabe modifiable', before != after, (before, after))
    # favori
    pg.click('#v-2-255 .vnum'); pg.wait_for_timeout(300)
    e.shot('62-verse-menu')
    pg.click('#sheets [data-act="fav-add"]'); pg.wait_for_timeout(300)
    pg.fill('#favLabel', 'Préparation du vendredi'); pg.click('#sheets [data-act="fav-save"]'); pg.wait_for_timeout(400)
    favs = e.js("() => [...window.__QR.Store.mem.fav.values()].map(f => [f.s, f.a, f.label])")
    check('favori ajouté avec étiquette libre', ['2', '255'] != None and [2, 255, 'Préparation du vendredi'] in favs, favs)
    # rechargement : reprise de la lecture
    pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_function('window.__QR && window.__QR.Content.index !== null'); pg.wait_for_timeout(800)
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(300)
    txt = pg.locator('.resume').inner_text() if pg.locator('.resume').count() else ''
    check('« Reprendre la lecture » sur Al-Baqara 2:255', 'Al-Baqara' in txt and '255' in txt, txt)
    check('favori visible dans Lire', 'Préparation du vendredi' in pg.locator('#tab-read').inner_text())
    e.shot('63-read-tab-resume')
    pg.click('.resume'); pg.wait_for_timeout(1500)
    check('reprise au verset 2:255', in_view(pg, '#v-2-255') not in (None, False))
    check('ambiance Nuit gardée', e.js("() => document.documentElement.dataset.ambiance") == 'nuit')
    # mode pages : 2:255 est en page 42 (Médine, Tanzil)
    pg.click('[data-sheet="display"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="read-mode"][data-v="page"]'); pg.wait_for_timeout(900)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    title = pg.locator('#pages .topbar').first.inner_text()
    check('mode Pages : page 42 pour 2:255', 'Page 42' in title, title)
    check('mode Pages : verset 2:255 présent', pg.locator('#mv-2-255').count() == 1)
    e.shot('64-page-42')
    pg.click('#pages [data-act="back"]'); pg.wait_for_timeout(400)
    # la recherche est gardée au retour (voulu) : on l'efface avant de parcourir par juz
    check('recherche gardée au retour à la liste', pg.input_value('#readSearch') == '2:255', pg.input_value('#readSearch'))
    pg.fill('#readSearch', ''); pg.wait_for_timeout(250)
    # juz 30 → 78:1
    pg.click('[data-act="read-seg"][data-seg="juz"]'); pg.wait_for_timeout(300)
    e.shot('65-juz-list')
    pg.click('[data-act="open-juz"][data-j="30"]'); pg.wait_for_timeout(1200)
    title = pg.locator('#pages .topbar').first.inner_text()
    check('juz 30 commence à An-Naba (78:1), page 582', ('An-Naba' in title or 'Page 582' in title), title)
    print('ERRORS', real_errors(e.errors))
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
