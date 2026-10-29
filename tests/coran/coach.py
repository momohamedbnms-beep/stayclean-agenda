"""« Lire et écrire l'arabe » : le coach. Il lit les réponses (historique fictif injecté) et dit :
- les lettres confondues (avec l'explication de la banque : famille de lettres) ;
- ce qui est raté souvent / en ce moment (un élément réussi deux fois de suite sort de la liste) ;
- où c'est difficile, où c'est facile (par type d'exercice) ; aujourd'hui (fait, pas encore avancé) ; l'évolution des notes ;
puis révision ciblée (seulement ce qui est raté), deux lettres à distinguer, examen de mes points faibles (noté, ne compte
pas pour un chapitre), et ce que le coach retient d'un examen (lettre mise à la place de la bonne). Aucun service réel."""
from qa import *
import sys
from ar_helpers import answer_current, advance, SEED, TODAY

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def norm(s): return (s or '').replace(' ', ' ').replace(' ', ' ')

def run_items(e, wrong_at=(), limit=40):
    pg = e.page; n = 0
    while pg.locator('.ar-ex').count() and n < limit:
        answer_current(e, right=(n not in wrong_at)); advance(pg); n += 1
    return n

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    e.js("(d) => window.__QR.setToday(d)", TODAY)
    pg.click('.nav__tab[data-tab="arabe"]'); pg.wait_for_timeout(900)
    empty = norm(pg.locator('#tab-arabe .ar-coach').inner_text()) if pg.locator('#tab-arabe .ar-coach').count() else ''
    check('sans réponse : la carte du coach dit ce qu’il fera (pas de chiffres inventés)', 'Dès tes premières réponses' in empty and pg.locator('#tab-arabe .ar-coach [data-act="ar-coach-review"]').count() == 0, empty)
    e.js(SEED); pg.wait_for_timeout(700)
    card = norm(pg.locator('#tab-arabe .ar-coach').inner_text())
    check('carte : « Tu confonds ح (ḥā’) et خ (khā’) : 4 fois »', 'Tu confonds' in card and 'ح' in card and 'خ' in card and '4 fois' in card, card[:300])
    check('carte : ce qui revient souvent ou à travailler (dictée)', 'Revient souvent' in card or 'À travailler' in card, card[:300])
    check('carte : « Facile pour toi : lire une syllabe (100 %) »', 'Facile pour toi' in card and 'lire une syllabe' in card and '100 %' in card, card[:300])
    check('carte : aujourd’hui (1 examen 15,5/20, réponses du jour)', 'Aujourd’hui' in card and '15,5/20' in card and 'réponses' in card, card[-200:])
    check('carte : « Réviser mes erreurs » et « Tout voir »', pg.locator('#tab-arabe .ar-coach [data-act="ar-coach-review"]').count() == 1 and pg.locator('#tab-arabe .ar-coach [data-page="ar-coach"]').count() == 1)
    e.shot('CO1-carte')
    # la page « Mon coach »
    pg.click('#tab-arabe .ar-coach [data-page="ar-coach"]'); pg.wait_for_timeout(700)
    page = norm(pg.locator('.page').inner_text())
    check('page : combien de réponses et d’examens il a lus', 'Il lit tes' in page and '4 examens' in page, page[:200])
    check('aujourd’hui : fait (1 examen, réponses) et ratés du jour', 'Fait :' in page and 'Raté aujourd’hui' in page, page[:600])
    check('aujourd’hui : ce qui n’a pas avancé (étape 2 du chapitre 2)', 'n’a pas encore avancé aujourd’hui' in page and 'chapitre 2' in page)
    pairs = norm(pg.locator('.ar-csec[data-anchor="pairs"]').inner_text()) if pg.locator('.ar-csec[data-anchor="pairs"]').count() else ''
    check('lettres confondues : ح et خ, avec la règle de la banque (« ح aucun point, خ un point dessus »)', 'ح aucun point' in pairs and 'خ un point dessus' in pairs, pairs[:300])
    weak = norm(pg.locator('.ar-csec[data-anchor="weak"]').inner_text())
    check('ce que tu rates souvent : le nom de ح, raté 2 fois sur 2, revient souvent', 'le nom de ح' in weak and 'Raté 2 fois sur 2' in weak, weak[:400])
    check('un élément réussi deux fois de suite sort de la liste (les points de ب)', 'les points de ب' not in weak)
    check('dictée : « écrire … sous la dictée » avec l’écriture du mot', 'sous la dictée' in weak and 'خَتَمَ' in weak)
    types = norm(pg.locator('.ar-csec[data-anchor="types"]').inner_text())
    check('où tu as du mal : la dictée (en %) ; où c’est facile : lire une syllabe', 'Dictée' in types and 'Lire une syllabe' in types and '%' in types, types[:300])
    exs = norm(pg.locator('.ar-csec[data-anchor="exams"]').inner_text())
    check('tes examens : « Examen du chapitre 2 : 12 → 14,5 → 15,5. Ça monte. »', 'Examen du chapitre 2 : 12 → 14,5 → 15,5' in exs and 'Ça monte' in exs, exs)
    errs = norm(pg.locator('.ar-csec[data-anchor="errs"]').inner_text()) if pg.locator('.ar-csec[data-anchor="errs"]').count() else ''
    check('d’où viennent tes erreurs : points, ordre des lettres', 'point' in errs and 'ordre' in errs, errs)
    e.shot('CO2-page', full=True)
    # Examens blancs : l'examen de mes points faibles
    weak_keys = set(e.js("() => window.__AR.coachData().weak.map((r) => r.key)"))
    for _ in range(3):
        if pg.locator('.page [data-act="back"]').count(): pg.click('.page [data-act="back"]'); pg.wait_for_timeout(250)
    pg.click('[data-act="ar-view"][data-v="exams"]'); pg.wait_for_timeout(500)
    check('Examens blancs : « Examen de mes points faibles » en premier', 'Examen de mes points faibles' in norm(pg.locator('#tab-arabe .ar-excard').first.inner_text()))
    pos0 = e.js("() => window.__AR.position().c.id")
    pg.click('#tab-arabe [data-act="ar-exam"][data-x="faibles"]'); pg.wait_for_timeout(600)
    intro = norm(pg.locator('.page').inner_text())
    check('annonce : « Préparé par ton coach », « Mes points faibles », ne compte pas pour un chapitre', 'Préparé par ton coach' in intro and 'Mes points faibles' in intro and 'ne compte pas' in intro, intro[:300])
    e.shot('CO3-examen-faibles')
    fk = e.js("() => window.__AR.Ex.cur.secs.flatMap((s) => s.items).map((i) => i.key)")
    check('examen de mes points faibles : 10 questions, tirées de ce qui est raté', len(fk) == 10 and len(set(fk) & weak_keys) >= 3, fk)
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(300)
    run_items(e, wrong_at=(0, 1, 2)); pg.wait_for_timeout(600)
    check('résultat : 14/20 (7 sur 10), examen enregistré comme « points faibles »', pg.locator('.ar-result').count() == 1 and '14' in pg.locator('.ar-result__note').inner_text() and e.js("() => window.__AR.examState('faibles').tries") == 1)
    check('il ne change pas « Où j’en suis » (ne compte pas pour un chapitre)', e.js("() => window.__AR.position().c.id") == pos0)
    acts = norm(pg.locator('.ar-actions').inner_text())
    check('résultat : « Enchaîner : un autre examen de mes points faibles »', 'un autre examen de mes points faibles' in acts, acts)
    pg.click('[data-act="ar-exam-close"]'); pg.wait_for_timeout(400)
    pg.click('[data-act="ar-view"][data-v="study"]'); pg.wait_for_timeout(400)
    pg.click('#tab-arabe .ar-coach [data-page="ar-coach"]'); pg.wait_for_timeout(600)
    # réviser mes erreurs : seulement ce qui est raté
    weak_keys = set(e.js("() => window.__AR.coachData().weak.map((r) => r.key)"))
    pg.click('.page [data-act="ar-coach-review"]'); pg.wait_for_timeout(600)
    keys = e.js("() => window.__AR.Run.set.items.map((i) => i.key)")
    check('révision ciblée : seulement des éléments ratés, aucune auto-évaluation', keys and set(keys) <= weak_keys and not e.js("() => window.__AR.Run.set.items.some((i) => i.grade === 'self')"), (keys, sorted(weak_keys)))
    n = run_items(e)
    check('révision ciblée : terminée', pg.locator('.ar-done').count() == 1 and n == len(keys))
    pg.click('.ar-done [data-act="back"]'); pg.wait_for_timeout(400)
    # deux lettres à distinguer
    pg.locator('.ar-csec[data-anchor="pairs"] [data-act="ar-coach-pair"]').first.click(); pg.wait_for_timeout(600)
    it = e.js("() => window.__AR.Run.set.items.map((i) => ({ t: i.t, ans: i.ans, ch: (i.ch || []).map((c) => String(c.v)) }))")
    both = [x for x in it if x['ch']]
    check('ح et خ : questions sur les deux lettres, chaque choix propose les deux', len(it) >= 6 and all('ha_' in x['ch'] and 'kha' in x['ch'] for x in both), it[:3])
    run_items(e); pg.click('.ar-done [data-act="back"]'); pg.wait_for_timeout(400)
    for _ in range(3):
        if pg.locator('.page [data-act="back"]').count(): pg.click('.page [data-act="back"]'); pg.wait_for_timeout(250)
    # M'entraîner : le coach à la place de l'ancien journal
    pg.click('[data-act="ar-view"][data-v="train"]'); pg.wait_for_timeout(500)
    nweak = e.js("() => window.__AR.coachData().weak.length")
    check('M’entraîner : « Mon coach » en tête, « Réviser mes erreurs » tant qu’il reste des erreurs, plus d’ancien journal', pg.locator('#tab-arabe [data-page="ar-coach"]').count() == 1 and pg.locator('#tab-arabe [data-act="ar-coach-review"]').count() == (1 if nweak else 0) and pg.locator('#tab-arabe [data-page="ar-errors"]').count() == 0, nweak)
    # un examen de chapitre avec des erreurs : ce que le coach retient
    pg.click('[data-act="ar-view"][data-v="exams"]'); pg.wait_for_timeout(500)
    pg.locator('#tab-arabe [data-act="ar-exam"][data-x="c3"]').first.click(); pg.wait_for_timeout(500)
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(300)
    n = 0; wrong_v = None
    while pg.locator('.ar-ex').count() and n < 15:
        info = e.js("() => { const e = window.__AR.Ex.cur; const it = e.secs.flatMap((x) => x.items)[e.i]; return it ? { t: it.t, key: it.key, ch: (it.ch || []).map((c) => String(c.v)), ans: String(it.ans) } : null; }")
        if info and info['t'] in ('nom', 'lettre', 'forme') and wrong_v is None:
            wrong_v = next(x for x in info['ch'] if x != info['ans'])
            pg.locator('.ar-ex [data-act="ar-pick"][data-v="%s"]' % wrong_v).first.click(); pg.click('.ar-ex [data-act="ar-validate"]'); pg.wait_for_timeout(300)
            n += 1; continue
        answer_current(e, right=(n != 1)); advance(pg); n += 1
    pg.wait_for_timeout(600)
    cx = norm(pg.locator('.ar-cexam').inner_text()) if pg.locator('.ar-cexam').count() else ''
    check('résultat : « Ce que ton coach retient » avec les éléments ratés et leur explication', 'Ce que ton coach retient' in cx and pg.locator('.ar-cexam .ar-cex li').count() >= 1, cx[:300])
    if wrong_v:
        check('lettre confondue : « tu as mis … » (la lettre choisie à la place)', 'tu as mis' in cx, cx[:300])
        att = e.js("(v) => [...window.__QR.Store.mem.ar_att.values()].filter((a) => a.mode === 'exam' && a.v === v).length", wrong_v)
        check('la réponse donnée est gardée dans le journal (pour repérer les confusions)', att >= 1, att)
    e.shot('CO4-resultat-coach', full=True)
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
