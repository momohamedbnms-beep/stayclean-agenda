"""Étudier seul : texte complet (arabe, phonétique, français), puis dire soi-même où on en est en fin de sourate
(Pas encore, J'apprends, Je connais) ; enregistré dans les progrès, annulable, persistant, distinct des récitations."""
from qa import *
import sys

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    check('accueil : la méthode pour étudier seul, étape par étape', pg.locator('#tab-learn details.mz-method .mz-steps li').count() == 4)
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(400)
    pg.fill('#readSearch', '112'); pg.wait_for_timeout(250)
    pg.click('#readList .srow[data-s="112"]'); pg.wait_for_timeout(1200)
    check('texte complet : 4 versets en arabe', pg.locator('.page .verse').count() == 4)
    check('phonétique et français affichés', pg.locator('.page .verse .tr').count() >= 1 or 'Dis' in pg.locator('.page').inner_text(), '')
    card = pg.locator('.page .self-card')
    check('fin de sourate : « Cette sourate, pour toi » avec Pas encore, J’apprends, Je connais', card.count() == 1 and card.locator('.mz-seg__b').count() == 3 and 'Je connais' in card.inner_text())
    check('lire ne change rien : Al-Ikhlas « Pas encore »', e.js("() => window.__QR.surahState(112)") == 'none' and card.locator('.mz-seg__b--none.is-on').count() == 1)
    card.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    e.shot('A1-etudier-seul')
    card.locator('[data-act="mz-set-sura"][data-st="known"]').click(); pg.wait_for_timeout(600)
    toast = pg.locator('#toasts').inner_text()
    check('« Je connais » : message et « Annuler »', 'Al-Ikhlas' in toast and 'Je connais' in toast and pg.locator('#toasts [data-act="toast-action"]').count() == 1, toast)
    check('lecteur : « Tu la connais à 100 % » en tête, carte cochée', pg.locator('.page .sura-head__known').count() == 1 and pg.locator('.page .self-card.is-on').count() == 1)
    e.shot('A2-validee')
    rec = e.js("() => window.__QR.Store.mem.progress.get('s112')")
    check('enregistré comme déclaration (versets 1 à 4), pas comme récitation', rec and rec.get('kv') == [[1, 4]] and rec.get('self', {}).get('pct') == 100 and not (rec.get('m') or {}).get('4'), rec)
    check('aucune révision imposée', not e.js("() => window.__QR.Store.mem.review.has('s112')"))
    # onglet Progrès
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    pg.click('.nav__tab[data-tab="progress"]'); pg.wait_for_timeout(600)
    kp = pg.locator('#tab-progress .mz-kpis').inner_text()
    check('Progrès : « 1 sourate sur 114 »', '1\nsourate sur 114' in kp, kp.replace('\n', ' | '))
    check('Progrès : la carte du juz 30 se remplit', 'mz-tile--partial' in pg.locator('#tab-progress .mz-tile[data-j="30"]').get_attribute('class'))
    e.shot('A3-progres')
    # persistance après rechargement
    pg.reload(); pg.wait_for_function('window.__QR && window.__QR.Content.index !== null', timeout=15000); pg.wait_for_timeout(800)
    check('après rechargement : toujours « Je connais »', e.js("() => window.__QR.surahState(112)") == 'known' and e.js("() => !!window.__QR.selfKnown(112)"))
    # changer d'avis depuis le détail de la sourate (groupe → sourate)
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(300)
    pg.fill('#readSearch', '112'); pg.wait_for_timeout(250)
    pg.click('#readList .srow[data-s="112"]'); pg.wait_for_timeout(1200)
    pg.click('.page .self-card [data-page="sura-progress"]'); pg.wait_for_timeout(500)
    check('détail : « Cette sourate, pour toi » sur « Je connais »', pg.locator('.page .mz-mine .mz-seg__b--known.is-on').count() == 1)
    e.shot('A4-detail')
    pg.click('.page .mz-mine [data-act="mz-set-sura"][data-st="learning"]'); pg.wait_for_timeout(500)
    check('« J’apprends » : plus connue, en cours', e.js("() => window.__QR.surahState(112)") == 'learning' and not e.js("() => !!window.__QR.selfKnown(112)"))
    pg.click('.page .mz-mine [data-act="mz-set-sura"][data-st="none"]'); pg.wait_for_timeout(500)
    check('« Pas encore » : tout est retiré', e.js("() => window.__QR.surahState(112)") == 'none')
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors))
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
