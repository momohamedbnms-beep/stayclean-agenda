"""L'agenda existant continue de fonctionner, et la carte Mon Coran y mène (aller-retour)."""
from qa import *
import sys
checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

with sync_playwright() as p:
    e = Env(p)
    pg = e.page
    pg.goto(BASE + 'index.html'); pg.wait_for_timeout(2500)
    e.shot('80-agenda-portal', full=True)
    cards = e.js("() => [...document.querySelectorAll('.pcard .tt')].map(x => x.textContent)")
    check('accueil de l’agenda : cartes existantes + MON CORAN', cards == ['STAYCLEAN', 'COMPTA', 'MA PAPERASSE', 'MES CALORIES', 'MON CORAN'], cards)
    # les autres espaces s'ouvrent toujours
    pg.click('.pcard.pro'); pg.wait_for_timeout(800)
    check('STAYCLEAN (planning) s’ouvre', e.js("() => document.body.innerText.includes('Planning')"))
    pg.goto(BASE + 'index.html'); pg.wait_for_timeout(1500)
    pg.click('.pcard.cpt2'); pg.wait_for_timeout(800)
    check('COMPTA s’ouvre', e.js("() => document.body.innerText.includes('Situation')"))
    pg.goto(BASE + 'index.html'); pg.wait_for_timeout(1500)
    # aller dans Mon Coran
    pg.click('.pcard.qr'); pg.wait_for_url('**/coran.html', timeout=10000)
    pg.wait_for_function('window.__QR && window.__QR.Content.index !== null', timeout=15000)
    pg.wait_for_timeout(600)
    if pg.locator('[data-act="minutes-save"]').count(): pg.click('[data-act="minutes-save"]'); pg.wait_for_timeout(300)
    check('Mon Coran ouvert depuis la carte (« Mémoriser le Coran »)', 'Mémoriser le Coran' in pg.locator('#tab-learn').inner_text())
    check('retour : flèche vers l’agenda', pg.locator('#tab-learn .topbar [data-act="go-agenda"]').count() == 1)
    pg.wait_for_timeout(1200)
    pg.click('#tab-learn .topbar [data-act="go-agenda"]'); pg.wait_for_timeout(1800)
    check('retour à l’agenda', pg.url.endswith('index.html') or pg.url.endswith('/'), pg.url)
    pill = e.js("() => { const c = document.querySelector('.pcard.qr .pst'); return c ? c.textContent : null }")
    check('carte : résumé écrit par Mon Coran (prochaine étape, rien de quotidien)', pill and 'Prochaine étape : Al-Fatiha' in pill and 'aujourd' not in pill, pill)
    e.shot('81-agenda-portal-after')
    # la carte Mes Calories / Ma Paperasse n'ont pas bougé
    check('MES CALORIES toujours présente', e.js("() => !!document.querySelector('.pcard.cal')"))
    errs = real_errors(e.errors)
    print('ERRORS', errs)
    check('aucune erreur JavaScript', not [x for x in errs if 'pageerror' in x], errs)
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
