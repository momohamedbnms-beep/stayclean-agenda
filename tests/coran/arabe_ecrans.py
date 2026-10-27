"""« Lire et écrire l'arabe » : captures dans les trois ambiances et sur grand écran (contrôle visuel)."""
from qa import *
import sys

with sync_playwright() as p:
    for amb, vp in (('nuit', (390, 844)), ('papier', (390, 844)), ('vert', (1280, 900))):
        e = Env(p, viewport=vp, dark=(amb == 'nuit'))
        pg = e.open()
        e.js("(a) => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { ambiance: a }))", amb); pg.wait_for_timeout(300)
        pg.click('.nav__tab[data-tab="arabe"]'); pg.wait_for_timeout(900)
        e.shot(f'AE-{amb}-accueil')
        pg.click('[data-act="ar-sess"]'); pg.wait_for_timeout(700)
        if pg.locator('[data-act="ar-lesson-done"]').count():
            e.shot(f'AE-{amb}-notion'); pg.click('[data-act="ar-lesson-done"]'); pg.wait_for_timeout(500)
        e.shot(f'AE-{amb}-exercice')
        print(amb, 'ERRORS', real_errors(e.errors))
        e.close()
