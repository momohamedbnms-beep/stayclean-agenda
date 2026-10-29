"""« Lire et écrire l'arabe » : le cours en chapitres. Quatre rubriques (Étudier, M'entraîner, Examens blancs,
Fiches PDF), « Où j'en suis », étapes numérotées validées par 3 questions, examens de 10 ou 15 questions au choix notés
par l'appli et ramenés sur 20 (clavier arabe), réponse choisie puis validée (on peut en changer avant), réussite à 16/20,
examen similaire avec d'autres questions, évolution des notes.
Audio remplacé par un son local, aucune donnée réelle, aucun service extérieur."""
from qa import *
import sys
from ar_helpers import answer_current, advance

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def run_items(e, wrong_at=(), limit=40):
    """Répond aux questions affichées (fausses aux positions données) ; renvoie les types vus."""
    pg = e.page; seen = []; n = 0
    while pg.locator('.ar-ex').count() and n < limit:
        t = answer_current(e, right=(n not in wrong_at)); seen.append(t)
        advance(pg); n += 1
    return seen

def norm(s):
    return (s or '').replace('\u00a0', ' ').replace('\u202f', ' ')

def grid(pg):
    return [int(x) for x in pg.locator('.ar-grid tbody tr td:nth-child(2)').all_inner_texts() if x.strip().isdigit()]

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
    # examen du chapitre 1 (pas d'oral au chapitre 1) : 10 questions par défaut, 15 au choix
    intro = norm(pg.locator('.page').inner_text())
    lens = pg.locator('[data-act="ar-exam-len"]')
    check('examen : choix « 10 » ou « 15 » questions, 10 par défaut', lens.count() == 2 and pg.locator('[data-act="ar-exam-len"].is-on').get_attribute('data-n') == '10')
    check('annonce : 10 questions notées par l’appli, ramenées sur 20, réussi à 16/20 (8 bonnes réponses sur 10), choisir puis valider', '10 questions notées par l’appli, ramenées sur 20' in intro and '16/20' in intro and '8 bonnes réponses sur 10' in intro and 'tu peux en changer' in intro, intro[:260].replace('\n', ' | '))
    g10 = grid(pg)
    check('grille à 10 : les 4 parties gardées (au moins 1 question chacune), total 10', len(g10) == 4 and sum(g10) == 10 and min(g10) >= 1, g10)
    e.shot('AR5-examen-annonce')
    pg.click('[data-act="ar-exam-len"][data-n="15"]'); pg.wait_for_timeout(300)
    g15 = grid(pg); intro15 = norm(pg.locator('.page').inner_text())
    check('choisir 15 : grille de 15 questions, réussi à 12 bonnes réponses sur 15, choix gardé sur l’appareil', len(g15) == 4 and sum(g15) == 15 and '12 bonnes réponses sur 15' in intro15 and e.js("() => localStorage.getItem('qr-ar-exam-n')") == '15', g15)
    pg.click('[data-act="ar-exam-len"][data-n="10"]'); pg.wait_for_timeout(300)
    keys1 = e.js("() => window.__AR.Ex.cur.secs.flatMap((s) => s.items).map((i) => i.key)")
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(400)
    check('examen : barre « Question 1 sur 10 »', 'Question 1 sur 10' in pg.locator('.page').inner_text())
    seen = []; n = 0; kb_seen = False; changed = False
    while pg.locator('.ar-ex').count() and n < 15:
        it = e.js("() => { const e = window.__AR.Ex.cur; const it = e.secs.flatMap((x) => x.items)[e.i]; return it ? { t: it.t, ch: (it.ch || []).map((c) => String(c.v)), ans: String(it.ans) } : null; }")
        t = it and it['t']
        if t and t.startswith('k_') and not kb_seen:
            check('question au clavier arabe : clavier de l’appli (28 lettres) et « Valider » inactif tant que rien n’est tapé', pg.locator('.ar-kb .ar-kb__k[data-c]').count() >= 28 and pg.locator('[data-act="ar-kb-ok"]').is_disabled())
            e.shot('AR6-clavier'); kb_seen = True
        if it and it['ch'] and not changed and n != 2:
            # choisir une réponse, changer d'avis, puis valider : seule la réponse validée compte
            wrong = next(x for x in it['ch'] if x != it['ans'])
            check('« Valider » inactif tant qu’aucune réponse n’est choisie', pg.locator('.ar-ex [data-act="ar-validate"]').is_disabled())
            natt = e.js("() => window.__QR.Store.mem.ar_att.size")
            pg.locator('.ar-ex [data-act="ar-pick"][data-v="%s"]' % wrong).first.click(); pg.wait_for_timeout(200)
            on1 = pg.locator('.ar-ex .ar-choice.is-on').get_attribute('data-v')
            check('réponse choisie : surlignée, rien d’enregistré, « Valider » actif, « tu peux encore changer »', on1 == wrong and e.js("() => window.__QR.Store.mem.ar_att.size") == natt and not pg.locator('.ar-ex [data-act="ar-validate"]').is_disabled() and 'changer' in pg.locator('.ar-valid__h').inner_text())
            e.shot('AR6b-choix-modifiable')
            pg.locator('.ar-ex [data-act="ar-pick"][data-v="%s"]' % it['ans']).first.click(); pg.wait_for_timeout(200)
            on2 = pg.locator('.ar-ex .ar-choice.is-on')
            check('changer d’avis : une seule réponse surlignée, la nouvelle', on2.count() == 1 and on2.get_attribute('data-v') == it['ans'])
            pg.click('.ar-ex [data-act="ar-validate"]'); pg.wait_for_timeout(400)
            last = e.js("() => [...window.__QR.Store.mem.ar_att.values()].filter((a) => a.mode === 'exam').sort((a, b) => String(a.at).localeCompare(String(b.at))).pop()")
            check('« Valider » : la réponse finale est enregistrée (juste) et l’examen passe seul à la question suivante', last and last['ok'] == 1 and ('Question %d sur 10' % (n + 2)) in pg.locator('.page').inner_text())
            check('pendant l’examen : aucune correction affichée', pg.locator('.ar-fb').count() == 0)
            changed = True; seen.append(t); n += 1
            continue
        answer_current(e, right=(n != 2)); seen.append(t)
        advance(pg); n += 1
    check('un exercice à choix rencontré pour tester le changement de réponse', changed)
    pg.wait_for_timeout(600)
    res = pg.locator('.page').inner_text()
    check('résultat : 18/20 (9 bonnes réponses sur 10), réussi', '18' in pg.locator('.ar-result__note').inner_text() and 'Réussi' in res and '9 bonnes réponses sur 10' in norm(pg.locator('.ar-result').inner_text()), pg.locator('.ar-result').inner_text().replace('\n', ' | ') if pg.locator('.ar-result').count() else res[:100])
    check('résultat : la correction, question par question (1 fausse)', pg.locator('.ar-corr__i').count() == 10 and pg.locator('.ar-corr__i.is-ko').count() == 1)
    check('pas d’oral au chapitre 1', 'Oral' not in pg.locator('.ar-result').inner_text())
    e.shot('AR7-resultat')
    rec = e.js("() => [...window.__QR.Store.mem.ar_exam.values()].filter((x) => x && x.exam === 'c1')")
    check('note enregistrée (examen, note, 10 questions, erreurs)', len(rec) == 1 and rec[0]['score'] == 18 and rec[0]['n'] == 10 and rec[0]['passed'] and len(rec[0]['wrong']) == 1, rec[:1])
    # résultat réussi : enchaîner sur le chapitre suivant, ou refaire le même
    acts = norm(pg.locator('.ar-actions').inner_text())
    check('résultat réussi : « Enchaîner : examen du chapitre 2 » en premier, « Réviser mon erreur », « Refaire un examen du chapitre 1 »', pg.locator('.ar-actions .btn--primary[data-act="ar-exam-chain"][data-x="c2"]').count() == 1 and 'Réviser mon erreur' in acts and pg.locator('[data-act="ar-exam-chain"][data-x="c1"]').count() == 1, acts.replace('\n', ' | '))
    # enchaîner : un autre examen du chapitre 1, tout de suite (même longueur, sans annonce)
    pg.click('[data-act="ar-exam-chain"][data-x="c1"]'); pg.wait_for_timeout(500)
    keys2 = e.js("() => window.__AR.Ex.cur.secs.flatMap((s) => s.items).map((i) => i.key)")
    same = len(set(keys1) & set(keys2))
    check('enchaîner : la 1re question tout de suite (sans annonce), 10 questions, d’autres que le 1er essai', 'Question 1 sur 10' in pg.locator('.page').inner_text() and pg.locator('[data-act="ar-exam-go"]').count() == 0 and len(keys2) == 10 and same < 8, f'{same} questions en commun sur 10')
    run_items(e, wrong_at=(0, 1, 2))
    pg.wait_for_timeout(500)
    check('2e essai 7 sur 10 = 14/20 : « Pas encore », « Enchaîner un autre examen », « Réviser mes 3 erreurs »', '14' in pg.locator('.ar-result__note').inner_text() and 'Pas encore' in pg.locator('.ar-result').inner_text() and 'Enchaîner un autre examen' in norm(pg.locator('.ar-actions').inner_text()) and 'Réviser mes 3 erreurs' in norm(pg.locator('.ar-actions').inner_text()), norm(pg.locator('.ar-actions').inner_text()).replace('\n', ' | '))
    check('évolution : courbe des notes dès le 2e essai', pg.locator('.ar-result .ar-spark').count() == 1)
    wrongk = e.js("() => window.__AR.Ex.cur.secs.flatMap((s) => s.items).filter((i) => !i.done || i.done.ok < 1).map((i) => i.key)")
    e.shot('AR7b-resultat-enchainer')
    # réviser les erreurs de cet examen : les mêmes éléments, corrigés tout de suite
    pg.click('[data-act="ar-exam-review"]'); pg.wait_for_timeout(600)
    rk = e.js("() => window.__AR.Run.set.items.map((i) => i.key)")
    check('« Réviser mes erreurs » : seulement les 3 éléments ratés (2 fois chacun), avec la correction', 'Réviser mes erreurs' in pg.locator('.page').inner_text() and len(rk) == 6 and set(rk) <= set(wrongk) and set(wrongk) <= set(rk), (wrongk, rk))
    run_items(e)
    check('révision terminée', pg.locator('.ar-done').count() == 1)
    pg.click('.ar-done [data-act="back"]'); pg.wait_for_timeout(300)
    for _ in range(3):
        if pg.locator('[data-act="back"]').count(): pg.click('[data-act="back"]'); pg.wait_for_timeout(250)
    # 15 questions, depuis Examens blancs (annonce, choix)
    pg.click('[data-act="ar-view"][data-v="exams"]'); pg.wait_for_timeout(500)
    pg.locator('.ar-excard [data-act="ar-exam"][data-x="c1"]').click(); pg.wait_for_timeout(500)
    pg.click('[data-act="ar-exam-len"][data-n="15"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(300)
    check('15 questions : barre « Question 1 sur 15 »', 'Question 1 sur 15' in pg.locator('.page').inner_text())
    run_items(e, wrong_at=(0, 1, 2, 3))
    pg.wait_for_timeout(500)
    check('3e essai 11 sur 15 = 14,5/20 : « Pas encore »', '14,5' in pg.locator('.ar-result__note').inner_text() and 'Pas encore' in pg.locator('.ar-result').inner_text() and '11 bonnes réponses sur 15' in norm(pg.locator('.ar-result').inner_text()), pg.locator('.ar-result').inner_text().replace('\n', ' | '))
    pg.click('[data-act="ar-exam-close"]'); pg.wait_for_timeout(300)
    for _ in range(3):
        if pg.locator('[data-act="back"]').count(): pg.click('[data-act="back"]'); pg.wait_for_timeout(250)
    # Examens blancs : tous visibles d'un coup
    pg.click('[data-act="ar-view"][data-v="exams"]'); pg.wait_for_timeout(500)
    check('Examens blancs : les 10 chapitres et l’examen final, tous ouverts', pg.locator('.ar-excard').count() == 11 and pg.locator('.ar-excard [data-act="ar-exam"]').count() == 11)
    card = pg.locator('.ar-excard').first.inner_text()
    check('carte du chapitre 1 : meilleure note 18/20, 3 essais, « Refaire un examen similaire »', '18/20' in card and '3 essais' in card and 'Refaire un examen similaire' in card, card.replace('\n', ' | '))
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
            idx = e.js("() => window.__AR.Ex.cur.i")
            pg.fill('input[data-ar-kbin]', ans); pg.click('[data-act="ar-kb-ok"]'); pg.wait_for_timeout(300)
            ok = e.js("(k) => { const e = window.__AR.Ex.cur; const d = e.secs.flatMap((x) => x.items)[k].done; return d ? d.ok : null; }", idx)
            check('réponse tapée au clavier du téléphone : juste, puis question suivante', ok == 1 and e.js("() => window.__AR.Ex.cur.i") == idx + 1, ok)
            break
        answer_current(e); advance(pg); n += 1
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
