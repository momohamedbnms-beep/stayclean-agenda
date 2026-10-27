"""« Lire et écrire l'arabe » : le cours en chapitres. Quatre rubriques (Étudier, M'entraîner, Examens blancs,
Fiches PDF), « Où j'en suis », étapes numérotées validées par 3 questions, examens de 20 questions notés par l'appli
(clavier arabe), réussite à 16/20, examen similaire avec d'autres questions, évolution des notes.
Audio remplacé par un son local, aucune donnée réelle, aucun service extérieur."""
from qa import *
import sys
from ar_helpers import answer_current

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def run_items(e, wrong_at=(), limit=40):
    """Répond aux questions affichées (fausses aux positions données) ; renvoie les types vus."""
    pg = e.page; seen = []; n = 0
    while pg.locator('.ar-ex').count() and n < limit:
        t = answer_current(e, right=(n not in wrong_at)); seen.append(t)
        pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(180); n += 1
    return seen

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    check('onglet « Arabe » dans la barre', pg.locator('.nav__tab[data-tab="arabe"]').count() == 1)
    pg.click('.nav__tab[data-tab="arabe"]'); pg.wait_for_timeout(900)
    labels = pg.locator('.ar-seg__b').all_inner_texts()
    check('quatre rubriques dans l’ordre : Étudier, M’entraîner, Examens blancs, Fiches PDF', [x.replace('\n', ' ').strip() for x in labels] == ['Étudier', 'M’entraîner', 'Examens blancs', 'Fiches PDF'], labels)
    home = pg.locator('#tab-arabe').inner_text()
    check('Étudier : « Où j’en suis » = chapitre 1, étape 1 sur 3', 'Où j’en suis' in home and 'Chapitre 1 · étape 1 sur 3' in home, home[:200].replace('\n', ' | '))
    check('10 chapitres en 3 parties', pg.locator('.ar-chap').count() == 10 and pg.locator('.ar-part__t').count() == 3)
    e.shot('AR1-etudier')
    # étape 1 : lecture puis vérification réussie
    pg.click('.ar-now [data-act="ar-step"]'); pg.wait_for_timeout(700)
    txt = pg.locator('.page').inner_text()
    check('étape : « Chapitre 1 · étape 1 sur 3 », ce que tu vas apprendre, comprendre, vérification', 'Chapitre 1 · étape 1 sur 3' in txt and 'Ce que tu vas apprendre' in txt and 'Comprendre' in txt and pg.locator('[data-act="ar-check"]').count() == 1)
    e.shot('AR2-etape')
    pg.click('[data-act="ar-check"]'); pg.wait_for_timeout(500)
    check('vérification : 3 questions corrigées par l’appli', e.js("() => window.__AR.Run.set.items.length") == 3 and pg.locator('.ar-tag--auto').count() == 1)
    run_items(e)
    res = pg.locator('.page').inner_text()
    check('3 sur 3 : « Étape faite » et bouton vers l’étape 2', 'Étape faite' in res and pg.locator('[data-act="ar-step-next"]').count() == 1, res[:120].replace('\n', ' | '))
    check('étape enregistrée comme faite', e.js("() => !!window.__AR.st().done.u0a"))
    e.shot('AR3-etape-faite')
    pg.click('[data-act="ar-step-next"]'); pg.wait_for_timeout(600)
    check('étape suivante ouverte : étape 2 sur 3', 'étape 2 sur 3' in pg.locator('.page').inner_text())
    check('la pile de pages ne s’allonge pas (vérification et étape 1 fermées)', e.js("() => window.__QR.UI.pages.length") == 1, e.js("() => window.__QR.UI.pages.map((x) => x.name)"))
    # étape 2 : vérification ratée → pas faite
    pg.click('[data-act="ar-check"]'); pg.wait_for_timeout(500)
    run_items(e, wrong_at=(0, 1))
    res = pg.locator('.page').inner_text()
    check('1 sur 3 : « Pas encore », relire ou se vérifier à nouveau ; étape pas faite', 'Pas encore' in res and pg.locator('[data-act="ar-check"]').count() == 1 and not e.js("() => !!window.__AR.st().done.u0b"))
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    # page du chapitre : chemin numéroté
    pg.click('.ar-chap[data-ch="c1"]'); pg.wait_for_timeout(600)
    items = pg.locator('.ar-path__i').count(); done = pg.locator('.ar-path__i.is-done').count(); cur = pg.locator('.ar-path__i.is-cur').count()
    check('chapitre : 3 étapes + entraînement + examen ; étape 1 faite, étape 2 en cours', items == 5 and done == 1 and cur == 1, (items, done, cur))
    check('chapitre : « À la fin du chapitre, tu sais » et fiches PDF', 'À la fin du chapitre, tu sais' in pg.locator('.page').inner_text() and pg.locator('[data-act="ar-sheets-ch"]').count() == 1)
    e.shot('AR4-chapitre')
    # entraînement du chapitre
    pg.click('.ar-path__b[data-act="ar-train-ch"]'); pg.wait_for_timeout(500)
    check('entraînement : 10 exercices du chapitre', e.js("() => window.__AR.Run.set.items.length") == 10)
    run_items(e)
    check('fin de série : score, autre série, examen du chapitre', pg.locator('.ar-done').count() == 1 and pg.locator('[data-act="ar-train-again"]').count() == 1 and pg.locator('.ar-done [data-act="ar-exam"]').count() == 1)
    pg.click('.ar-done [data-act="ar-exam"]'); pg.wait_for_timeout(600)
    # examen du chapitre 1 (pas d'oral au chapitre 1)
    intro = pg.locator('.page').inner_text()
    check('examen : annonce (20 questions, notées par l’appli, réussi à 16/20) et grille', '20 questions notées par l’appli' in intro and '16/20' in intro and pg.locator('.ar-grid tbody tr').count() == 4, intro[:160].replace('\n', ' | '))
    e.shot('AR5-examen-annonce')
    keys1 = e.js("() => window.__AR.Ex.cur.secs.flatMap((s) => s.items).map((i) => i.key)")
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(400)
    check('examen : barre « Question 1 sur 20 »', 'Question 1 sur 20' in pg.locator('.page').inner_text())
    seen = []; n = 0; kb_seen = False
    while pg.locator('.ar-ex').count() and n < 25:
        t = e.js("() => { const e = window.__AR.Ex.cur; const it = e.secs.flatMap((x) => x.items)[e.i]; return it ? it.t : null; }")
        if t and t.startswith('k_') and not kb_seen:
            check('question au clavier arabe : clavier de l’appli (28 lettres) et « Valider » inactif tant que rien n’est tapé', pg.locator('.ar-kb .ar-kb__k[data-c]').count() >= 28 and pg.locator('[data-act="ar-kb-ok"]').is_disabled())
            e.shot('AR6-clavier'); kb_seen = True
        answer_current(e, right=(n not in (2, 9))); seen.append(t)
        if n == 0:
            check('pendant l’examen : aucune correction affichée', pg.locator('.ar-fb').count() == 0 and pg.locator('.ar-saved').count() == 1)
        pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(180); n += 1
    pg.wait_for_timeout(600)
    res = pg.locator('.page').inner_text()
    check('résultat : 18/20, réussi', '18' in pg.locator('.ar-result__note').inner_text() and 'Réussi' in res, pg.locator('.ar-result').inner_text().replace('\n', ' | ') if pg.locator('.ar-result').count() else res[:100])
    check('résultat : la correction, question par question (2 fausses)', pg.locator('.ar-corr__i').count() == 20 and pg.locator('.ar-corr__i.is-ko').count() == 2)
    check('pas d’oral au chapitre 1', 'Oral' not in pg.locator('.ar-result').inner_text())
    e.shot('AR7-resultat')
    rec = e.js("() => [...window.__QR.Store.mem.ar_exam.values()].filter((x) => x && x.exam === 'c1')")
    check('note enregistrée (examen, note, parties, erreurs)', len(rec) == 1 and rec[0]['score'] == 18 and rec[0]['passed'] and len(rec[0]['wrong']) == 2, rec[:1])
    # examen similaire : d'autres questions
    pg.click('[data-act="ar-exam-again"]'); pg.wait_for_timeout(500)
    keys2 = e.js("() => window.__AR.Ex.cur.secs.flatMap((s) => s.items).map((i) => i.key)")
    same = len(set(keys1) & set(keys2))
    check('examen similaire : même grille, autres questions', len(keys2) == 20 and same < 15, f'{same} questions en commun sur 20')
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(300)
    run_items(e, wrong_at=(0, 1, 2, 3, 4, 5))
    pg.wait_for_timeout(500)
    check('deuxième essai 14/20 : « Pas encore », refaire proposé', '14' in pg.locator('.ar-result__note').inner_text() and 'Pas encore' in pg.locator('.ar-result').inner_text())
    check('évolution : courbe des notes dès le 2e essai', pg.locator('.ar-result .ar-spark').count() == 1)
    pg.click('[data-act="ar-exam-close"]'); pg.wait_for_timeout(300)
    for _ in range(3):
        if pg.locator('[data-act="back"]').count(): pg.click('[data-act="back"]'); pg.wait_for_timeout(250)
    # Examens blancs : tous visibles d'un coup
    pg.click('[data-act="ar-view"][data-v="exams"]'); pg.wait_for_timeout(500)
    check('Examens blancs : les 10 chapitres et l’examen final, tous ouverts', pg.locator('.ar-excard').count() == 11 and pg.locator('.ar-excard [data-act="ar-exam"]').count() == 11)
    card = pg.locator('.ar-excard').first.inner_text()
    check('carte du chapitre 1 : meilleure note 18/20, 2 essais, « Refaire un examen similaire »', '18/20' in card and '2 essais' in card and 'Refaire un examen similaire' in card, card.replace('\n', ' | '))
    e.shot('AR8-examens')
    # Où j'en suis : chapitre 1 réussi → chapitre 2
    pg.click('[data-act="ar-view"][data-v="study"]'); pg.wait_for_timeout(400)
    now = pg.locator('.ar-now').inner_text()
    check('chapitre 1 réussi : « Où j’en suis » passe au chapitre 2, 1 chapitre réussi sur 10', 'Chapitre 2' in now and '1 chapitre réussi sur 10' in now, now.replace('\n', ' | ')[:160])
    # clavier du téléphone (champ texte) : réponse tapée, notée
    e.js("() => { localStorage.setItem('qr-ar-kb-native', '1'); }")
    pg.click('.ar-chap[data-ch="c2"]'); pg.wait_for_timeout(500)
    pg.click('.ar-path__b[data-act="ar-exam"]'); pg.wait_for_timeout(500)
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(300)
    n = 0
    while pg.locator('.ar-ex').count() and n < 25:
        t = e.js("() => { const e = window.__AR.Ex.cur; const it = e.secs.flatMap((x) => x.items)[e.i]; return it ? it.t : null; }")
        if t and t.startswith('k_'):
            pg.click('[data-act="ar-kb-mode"]'); pg.wait_for_timeout(250)
            check('« Clavier du téléphone » : champ de saisie arabe (de droite à gauche)', pg.locator('input[data-ar-kbin][dir="rtl"][lang="ar"]').count() == 1)
            ans = e.js("() => { const e = window.__AR.Ex.cur; return e.secs.flatMap((x) => x.items)[e.i].ans; }")
            pg.fill('input[data-ar-kbin]', ans); pg.click('[data-act="ar-kb-ok"]'); pg.wait_for_timeout(200)
            ok = e.js("() => { const e = window.__AR.Ex.cur; return e.secs.flatMap((x) => x.items)[e.i].done.ok; }")
            check('réponse tapée au clavier du téléphone : juste', ok == 1, ok)
            break
        answer_current(e); pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(150); n += 1
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
