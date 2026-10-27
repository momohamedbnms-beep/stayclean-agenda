"""Étudier seul : texte complet (arabe, phonétique, français), « Je la connais à 100 % » enregistré dans les
progrès (auto-évaluation déclarée, distincte des récitations), révisions proposées, annulation, persistance."""
from qa import *
import sys

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    check('accueil : entrée « Étudier seul, à ta façon »', pg.locator('.link-row:has-text("Étudier seul")').count() == 1)
    pg.locator('.link-row:has-text("Étudier seul")').click(); pg.wait_for_timeout(400)
    pg.fill('#readSearch', '112'); pg.wait_for_timeout(250)
    pg.click('#readList .srow[data-s="112"]'); pg.wait_for_timeout(1200)
    check('texte complet : 4 versets en arabe', pg.locator('.page .verse').count() == 4)
    check('phonétique et français affichés', pg.locator('.page .verse .tr').count() >= 1 or 'Dis' in pg.locator('.page').inner_text(), '')
    card = pg.locator('.page .self-card')
    check('carte « Étudier à ta façon » en fin de sourate', card.count() == 1 and 'Je la connais à 100' in card.inner_text())
    card.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    e.shot('A1-etudier-seul')
    pg.locator('.page .self-card [data-act="self-known"]').click(); pg.wait_for_timeout(600)
    toast = pg.locator('#toasts').inner_text()
    check('validation : message « notée dans tes progrès »', 'connue à 100 %' in toast and 'progrès' in toast, toast)
    check('révisions proposées (sans être imposées)', pg.locator('#toasts [data-act="toast-action"]').count() == 1)
    check('lecteur : « Tu la connais à 100 % »', pg.locator('.page .sura-head__known').count() == 1 and pg.locator('.page .self-card.is-on').count() == 1)
    e.shot('A2-validee')
    pg.locator('#toasts [data-act="toast-action"]').click(); pg.wait_for_timeout(500)
    check('révisions ajoutées à la demande', e.js("() => window.__QR.Store.mem.review.has('s112')"))
    rec = e.js("() => window.__QR.Store.mem.progress.get('s112')")
    check('progrès enregistré comme auto-évaluation (pas comme récitation)', rec and rec.get('self', {}).get('pct') == 100 and not (rec.get('m') or [0, 0, 0, 0, 0])[4], rec)
    # onglet Progrès
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    pg.click('.nav__tab[data-tab="progress"]'); pg.wait_for_timeout(600)
    txt = pg.locator('#tab-progress').inner_text()
    check('Progrès : « 1 sourate connue à 100 % (validée par toi) »', '1\nsourate connue à 100 %' in txt or '1 sourate connue à 100 %' in txt.replace('\n', ' '), txt[:200].replace('\n', ' | '))
    row = pg.locator('#tab-progress .prow:has-text("Al-Ikhlas")')
    check('Progrès : barre pleine, badge « validée par toi », auto-évaluation datée', row.count() == 1 and row.locator('.bar--self').count() == 1 and 'validée par toi' in row.inner_text() and 'Auto-évaluation' in row.inner_text(), row.inner_text().replace('\n', ' | ') if row.count() else '')
    e.shot('A3-progres')
    # persistance après rechargement
    pg.reload(); pg.wait_for_function('window.__QR && window.__QR.Content.index !== null', timeout=15000); pg.wait_for_timeout(800)
    check('après rechargement : toujours validée', e.js("() => !!window.__QR.selfKnown(112)"))
    # annulation depuis le détail de la sourate
    pg.click('.nav__tab[data-tab="progress"]'); pg.wait_for_timeout(500)
    pg.locator('#tab-progress .prow:has-text("Al-Ikhlas")').click(); pg.wait_for_timeout(500)
    check('détail : date de validation affichée', pg.locator('.page .sp-head__self').count() == 1)
    e.shot('A4-detail')
    pg.locator('.page .sp-head__self [data-act="self-known-undo"]').click(); pg.wait_for_timeout(500)
    check('annulation : validation retirée', not e.js("() => !!window.__QR.selfKnown(112)") and pg.locator('.page [data-act="self-known"]').count() >= 1)
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors))
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
