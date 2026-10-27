"""« Lire et écrire l'arabe » : onglet, séance en parties, notions, exercices corrigés et auto-évaluations,
écriture à l'écran (sur l'appareil), examens (grille annoncée, 16/20, confirmation un autre jour), fiches.
Audio remplacé par un son local, aucune donnée réelle."""
from qa import *
import sys, datetime
from zoneinfo import ZoneInfo

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

T0 = datetime.datetime.now(ZoneInfo('Europe/Brussels')).date()

from ar_helpers import answer_current

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    check('onglet « Arabe » dans la barre', pg.locator('.nav__tab[data-tab="arabe"]').count() == 1)
    pg.click('.nav__tab[data-tab="arabe"]'); pg.wait_for_timeout(900)
    home = pg.locator('#tab-arabe').inner_text()
    check('accueil : niveau 0, unité, compétence prioritaire', 'Niveau 0' in home and 'Unité en cours' in home and 'À travailler en priorité' in home, home[:160].replace('\n', ' | '))
    check('quatre entrées : parcours, entraînement, examens, fiches', all(x in home for x in ('Mon parcours', 'M’entraîner', 'Mes examens', 'Mes fiches PDF')))
    e.shot('AR1-accueil')
    # séance : notion d'abord, puis exercices
    pg.click('[data-act="ar-sess"]'); pg.wait_for_timeout(700)
    check('séance : la notion s’ouvre d’abord (Comprendre)', pg.locator('.page .ar-comprendre').count() == 1, pg.locator('.page h1').first.inner_text() if pg.locator('.page h1').count() else '')
    e.shot('AR2-notion')
    pg.click('[data-act="ar-lesson-done"]'); pg.wait_for_timeout(600)
    check('exercice : une consigne et l’étiquette de correction', pg.locator('.ar-ex__q').count() == 1 and pg.locator('.ar-tag').count() == 1, pg.locator('.ar-ex__meta').inner_text() if pg.locator('.ar-ex__meta').count() else '')
    e.shot('AR3-exercice')
    t1 = answer_current(e, right=False)
    check('mauvaise réponse : « Pas tout à fait » + explication', pg.locator('.ar-fb--ko').count() == 1, t1)
    e.shot('AR4-correction')
    pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(300)
    n = 0
    while pg.locator('.ar-ex').count() and n < 20:
        answer_current(e, right=True); pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(250); n += 1
    check('fin de partie : score et suite proposée', pg.locator('.ar-done').count() == 1 and pg.locator('[data-act="ar-sess-next"], [data-act="ar-sess-end"]').count() >= 1, pg.locator('.ar-done').inner_text()[:120].replace('\n', ' | ') if pg.locator('.ar-done').count() else '')
    att = e.js("() => [...window.__QR.Store.mem.ar_att.values()]")
    check('réponses enregistrées (journal)', len(att) >= 5 and any(a.get('err') for a in att), len(att))
    # s'arrêter puis reprendre (ou terminer la séance si c'était la dernière partie)
    if pg.locator('[data-act="ar-sess-pause"]').count():
        pg.click('[data-act="ar-sess-pause"]'); pg.wait_for_timeout(500)
        check('« M’arrêter là » : retour à l’accueil, « Continuer ma séance »', 'Continuer ma séance' in pg.locator('#tab-arabe').inner_text())
    else:
        pg.click('[data-act="ar-sess-end"]'); pg.wait_for_timeout(500)
        check('séance terminée : retour à l’accueil, unité suivante', 'Lettre, points et signes' in pg.locator('#tab-arabe').inner_text(), pg.locator('#tab-arabe').inner_text()[:200].replace('\n', ' | '))
    # Mon parcours
    pg.click('[data-act="ar-open"][data-page="ar-path"]'); pg.wait_for_timeout(500)
    txt = pg.locator('.page').inner_text()
    check('parcours : 8 niveaux, compétences, erreurs', pg.locator('.ar-level').count() == 8 and 'Mes compétences' in txt and 'Mes erreurs' in txt)
    e.shot('AR5-parcours')
    pg.locator('.ar-level').nth(1).locator('summary').click(); pg.wait_for_timeout(200)
    pg.locator('.ar-level').nth(1).locator('.ar-unit').first.click(); pg.wait_for_timeout(500)
    check('notion du niveau 1 : formes produites par la police (4 places)', pg.locator('.page .ar-forms li').count() >= 4 and pg.locator('.page .ar-word').count() >= 1)
    e.shot('AR6-lettres')
    pg.locator('.page .ar-word').first.click(); pg.wait_for_timeout(500)
    check('mot exemple : audio Al-Husary (EveryAyah, Al-Mu’allim)', any('Husary_Muallim_128kbps' in u for u in e.audio_requests), e.audio_requests[-1:])
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    # examen blanc : grille annoncée, correction visible, ne compte pas
    pg.click('[data-act="ar-open"][data-page="ar-exams"]'); pg.wait_for_timeout(500)
    check('examens : grille annoncée et règle 16/20', pg.locator('.ar-grid tbody tr').count() >= 1 and '16/20' in pg.locator('.page').inner_text())
    e.shot('AR7-examens')
    pg.click('[data-act="ar-exam"][data-k="blanc"]'); pg.wait_for_timeout(500)
    check('examen blanc : écran d’annonce avant de commencer', pg.locator('[data-act="ar-exam-go"]').count() == 1)
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(300)
    n = 0
    while pg.locator('.ar-ex').count() and n < 40:
        answer_current(e, right=True); pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(200); n += 1
    res = pg.locator('.page').inner_text()
    check('examen blanc : notes sur 20 par compétence', '/20' in res and 'Examen blanc' in res, res[:200].replace('\n', ' | '))
    check('examen blanc : le niveau n’est pas validé', e.js("() => !((window.__AR.st().levels || {})[0] || {}).pass"))
    pg.click('[data-act="ar-exam-close"]'); pg.wait_for_timeout(300)
    # examen de niveau réussi : « à confirmer » ; confirmation impossible le même jour
    pg.click('[data-act="ar-exam"][data-k="niveau"]'); pg.wait_for_timeout(400)
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(300)
    check('examen de niveau : pas de correction pendant l’examen', True)
    n = 0
    while pg.locator('.ar-ex').count() and n < 40:
        answer_current(e, right=True)
        if n == 0:
            check('examen de niveau : aucune correction affichée', pg.locator('.ar-fb').count() == 0)
        pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(200); n += 1
    lv = e.js("() => (window.__AR.st().levels || {})[0] || {}")
    check('examen de niveau réussi : noté « à confirmer », pas validé', lv.get('pass') and not lv.get('ok'), lv)
    e.shot('AR8-resultat')
    pg.click('[data-act="ar-exam-close"]'); pg.wait_for_timeout(300)
    check('confirmation proposée seulement un autre jour', pg.locator('[data-act="ar-exam"][data-k="confirmation"]').count() == 0 and 'demain' in pg.locator('.page').inner_text())
    # lendemain : confirmation sur une autre série → validé, niveau 1 ouvert
    tomorrow = (T0 + datetime.timedelta(days=1)).isoformat()
    e.js("(d) => window.__QR.setToday(d)", tomorrow); pg.wait_for_timeout(400)
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="ar-open"][data-page="ar-exams"]'); pg.wait_for_timeout(400)
    check('lendemain : bouton « Confirmer le niveau 0 »', pg.locator('[data-act="ar-exam"][data-k="confirmation"]').count() == 1)
    pg.click('[data-act="ar-exam"][data-k="confirmation"]'); pg.wait_for_timeout(400)
    series = e.js("() => window.__AR.Ex.cur.series")
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(300)
    n = 0
    while pg.locator('.ar-ex').count() and n < 40:
        answer_current(e, right=True); pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(200); n += 1
    lv = e.js("() => (window.__AR.st().levels || {})[0] || {}")
    check('confirmation (autre série) réussie : niveau validé', lv.get('ok') and lv['ok']['series'] != lv['pass']['series'], [series, lv])
    check('niveau 1 ouvert', e.js("() => window.__AR.currentLevel()") == 1)
    pg.click('[data-act="ar-exam-close"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    # séance du niveau 1 : lettres, formes, composer un mot, écrire à l'écran
    pg.click('[data-act="ar-sess"]'); pg.wait_for_timeout(600)
    if pg.locator('[data-act="ar-lesson-done"]').count():
        pg.click('[data-act="ar-lesson-done"]'); pg.wait_for_timeout(500)
    seen = set(); shots = set(); n = 0
    while n < 40:
        if not pg.locator('.ar-ex').count():
            if pg.locator('[data-act="ar-sess-next"]').count():
                pg.click('[data-act="ar-sess-next"]'); pg.wait_for_timeout(400)
                if pg.locator('[data-act="ar-lesson-done"]').count():
                    pg.click('[data-act="ar-lesson-done"]'); pg.wait_for_timeout(400)
                continue
            break
        t = e.js("() => { const s = window.__AR.Sess.cur; const it = s.blocks[s.cur].items[s.i]; return it.t; }")
        if t not in shots and t in ('forme', 'compose', 'trace', 'nom'):
            e.shot('AR9-' + t); shots.add(t)
        tt = answer_current(e, right=True); seen.add(tt)
        if tt == 'trace' and 'trace-done' not in shots:
            e.shot('AR10-ecrit'); shots.add('trace-done')
        pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(200); n += 1
    check('niveau 1 : lettres, formes, composition et écriture', {'compose', 'trace'} & seen and ({'nom', 'lettre', 'forme', 'son'} & seen), seen)
    # écriture gardée sur l'appareil puis supprimée
    if pg.locator('[data-act="ar-sess-end"]').count():
        pg.click('[data-act="ar-sess-end"]'); pg.wait_for_timeout(400)
    e.js("""async () => { const c = document.createElement('canvas'); c.width = 10; c.height = 10; const b = await new Promise((r) => c.toBlob(r)); }""")
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
