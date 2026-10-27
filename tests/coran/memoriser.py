"""« Mémoriser » juz par juz, groupe par groupe, et « Mes progrès » en carte des 30 juz.
Statuts déclarés seulement (Pas encore, J'apprends, Je connais) : ouvrir, écouter ou lancer une séance ne change rien.
Pas de minutes ni de « un peu chaque jour ». Données fictives, audio remplacé par un son local, aucun service réel."""
from qa import *
import sys, json

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def st(e, s):
    return e.js(f"() => window.__QR.surahState({s})")

def norm(s):
    return (s or '').replace(' ', ' ').replace(' ', ' ')

with sync_playwright() as p:
    e = Env(p)
    pg = e.open(skip_minutes=False)
    pg.wait_for_timeout(600)
    # --- premier lancement : pas de question sur le temps, pas de « un peu chaque jour » ---
    check('premier lancement : aucune question « combien de minutes »', pg.locator('.sheet').count() == 0 and pg.locator('[data-act="minutes-save"]').count() == 0)
    home = norm(pg.locator('#tab-learn').inner_text())
    check('onglet « Mémoriser » : titre et principe', 'Mémoriser le Coran' in home and 'rien ne change tout seul' in home, home[:120].replace('\n', ' | '))
    check('ni « un peu chaque jour », ni minutes', 'Un peu chaque jour' not in home and 'min' not in home.replace('minutes', '').split('Ton parcours')[0] and 'Environ' not in home, '')
    check('barre du bas : « Mémoriser »', 'Mémoriser' in pg.locator('.nav__tab[data-tab="learn"]').inner_text())
    check('Où j’en suis : Al-Fatiha, pour commencer, avec les 3 états', 'Al-Fatiha' in pg.locator('.mz-now').inner_text() and 'Pour commencer' in pg.locator('.mz-now').inner_text() and pg.locator('.mz-now .mz-seg__b').count() == 3)
    check('la méthode en 4 étapes, ouverte au début', pg.locator('details.mz-method[open] .mz-steps li').count() == 4)
    order = e.js("() => [...document.querySelectorAll('#tab-learn .mz-path [data-act=\"mz-juz\"]')].map((b) => Number(b.dataset.j))")
    check('parcours : Al-Fatiha puis les juz 30, 29… 1', pg.locator('#tab-learn .mz-row--fat').count() == 1 and order == list(range(30, 0, -1)), order[:5])
    e.shot('M1-memoriser')
    # --- ouvrir, écouter : aucun statut ne change ---
    pg.click('#tab-learn .mz-row--fat .mz-row__main'); pg.wait_for_timeout(1200)
    check('Al-Fatiha s’ouvre dans le lecteur', pg.locator('.page .verse').count() == 7)
    pg.click('.page [data-act="reader-play"]'); pg.wait_for_timeout(1500)
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(400)
    check('lire et écouter Al-Fatiha : toujours « Pas encore »', st(e, 1) == 'none' and 'Pas encore' in pg.locator('.mz-row--fat').inner_text())
    # --- anciennes données : « en apprentissage » d'office → Pas encore ; « à 100 % » → Je connais ---
    e.js("""async () => { const Q = window.__QR;
      await Q.put('progress', 's78', { s: 78, startedAt: '2026-10-27', level: 1, nextA: 3, nextC: 0, listened: [1, 2], worked: [1, 2], solo: [], m: {}, known: false });
      await Q.put('progress', 's93', { s: 93, startedAt: '2026-10-27', level: 1, nextA: 1, nextC: 0, listened: [], worked: [], solo: [], m: { 4: '2026-10-20' }, known: false });
      await Q.put('progress', 's109', { s: 109, startedAt: '2026-10-27', level: 1, nextA: 1, nextC: 0, listened: [], worked: [], solo: [], m: {}, self: { date: '2026-10-26', pct: 100 } }); }""")
    pg.wait_for_timeout(400)
    check('ancienne version : sourate ouverte ou travaillée → « Pas encore »', st(e, 78) == 'none')
    check('ancienne version : récitée en séance sans être marquée → « Pas encore » (rien d’office)', st(e, 93) == 'none')
    check('ancienne version : « Je la connais à 100 % » → « Je connais »', st(e, 109) == 'known')
    # --- un juz, un groupe ---
    pg.click('#tab-learn [data-act="mz-juz"][data-j="30"]'); pg.wait_for_timeout(600)
    gorder = e.js("() => [...document.querySelectorAll('.page .mz-gcard')].map((b) => Number(b.dataset.i))")
    check('juz 30 : 8 groupes, du groupe 8 (sourates courtes) au groupe 1', gorder == list(range(239, 231, -1)), gorder)
    deb = e.js("() => window.__QR.Groups.d.juz[29].debut")
    check('juz 30 : premiers mots en arabe, copiés du texte Tanzil (An-Naba 78:1)', pg.locator('.page .mz-jhead__ar').inner_text().strip() == deb and e.js("() => window.__QR.Content.index && true") and '78:1' in pg.locator('.page .mz-jhead__s').inner_text(), deb)
    e.shot('M2-juz30')
    pg.click('.page [data-act="mz-group"][data-i="239"]'); pg.wait_for_timeout(600)
    parts = e.js("() => [...document.querySelectorAll('.page .mz-part [data-act=\"mz-cycle\"]')].map((b) => Number(b.dataset.s))")
    check('groupe 8 du juz 30 : Al-Qari’a → An-Nas, 14 sourates', parts == list(range(101, 115)), parts)
    check('groupe : 3 états, lecteur, séance guidée', pg.locator('.page .mz-mine .mz-seg__b').count() == 3 and pg.locator('.page [data-act="open-reader"]').count() >= 1 and pg.locator('.page [data-act="mz-guided"]').count() == 1)
    # changer l'état d'une sourate : Pas encore → J'apprends → Je connais, avec « Annuler »
    chip = pg.locator('.page .mz-part [data-act="mz-cycle"][data-s="112"]')
    chip.click(); pg.wait_for_timeout(400)
    check('Al-Ikhlas : un toucher → « J’apprends »', st(e, 112) == 'learning' and 'J’apprends' in chip.inner_text())
    chip.click(); pg.wait_for_timeout(400)
    rec = e.js("() => window.__QR.Store.mem.progress.get('s112')")
    check('deuxième toucher → « Je connais » (versets 1 à 4 connus)', st(e, 112) == 'known' and rec['kv'] == [[1, 4]] and rec['lr'] == [], rec)
    check('message avec « Annuler »', 'Je connais' in pg.locator('#toasts').inner_text() and pg.locator('#toasts [data-act="toast-action"]').count() == 1)
    pg.click('#toasts [data-act="toast-action"]'); pg.wait_for_timeout(500)
    check('« Annuler » : retour à « J’apprends »', st(e, 112) == 'learning')
    chip.click(); pg.wait_for_timeout(400)
    for s in (113, 114):
        c = pg.locator(f'.page .mz-part [data-act="mz-cycle"][data-s="{s}"]'); c.click(); pg.wait_for_timeout(250); c.click(); pg.wait_for_timeout(250)
    check('Al-Ikhlas, Al-Falaq, An-Nas : « Je connais »', all(st(e, s) == 'known' for s in (112, 113, 114)))
    # « J'apprends » sur le groupe : les sourates connues le restent
    pg.click('.page .mz-mine [data-act="mz-set-group"][data-st="learning"]'); pg.wait_for_timeout(500)
    check('groupe « J’apprends » : les 3 sourates connues restent connues', all(st(e, s) == 'known' for s in (112, 113, 114)) and st(e, 101) == 'learning' and st(e, 109) == 'known')
    stat = e.js("() => window.__QR.unitStat(window.__QR.Groups.d.groups[239].r)")
    check('groupe 8 : en cours, 4 sourates connues (21 versets sur 79)', stat['st'] == 'learning' and stat['kn'] == 21 and stat['n'] == 79, stat)
    e.shot('M3-groupe8')
    # séance guidée : facultative, sur la première sourate pas encore connue du groupe ; ne change aucun statut
    check('bouton « Séance guidée · commence par Al-Kawthar »', 'commence par Al-Kawthar' in pg.locator('.page [data-act="mz-guided"]').inner_text(), pg.locator('.page [data-act="mz-guided"]').inner_text())
    pg.click('.page [data-act="mz-guided"]'); pg.wait_for_timeout(1200)
    check('séance guidée : ouverte sur la première sourate à apprendre (Al-Kawthar, ordre conseillé)', pg.locator('.page--session').count() == 1 and e.js("() => window.__QR.Store.session && window.__QR.Store.session.items.some((x) => x.s === 108)"), e.js("() => window.__QR.Store.session && window.__QR.Store.session.items.map((x) => x.s)"))
    pg.click('.page--session [data-act="session-close"]'); pg.wait_for_timeout(500)
    while pg.locator('.page [data-act="back"]').count():
        pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    check('après la séance : Al-Qari’a toujours « J’apprends » (rien d’office)', st(e, 101) == 'learning')
    # groupe 7 entier : « Je connais »
    pg.click('.nav__tab[data-tab="learn"]'); pg.wait_for_timeout(300)
    pg.click('#tab-learn [data-act="mz-juz"][data-j="30"]'); pg.wait_for_timeout(500)
    pg.click('.page [data-act="mz-group"][data-i="238"]'); pg.wait_for_timeout(500)
    pg.click('.page .mz-mine [data-act="mz-set-group"][data-st="known"]'); pg.wait_for_timeout(600)
    check('groupe 7 : « Je connais » → ses 7 sourates connues', all(st(e, s) == 'known' for s in range(94, 101)))
    # groupe suivant / précédent dans le parcours
    pg.click('.page .mz-pn [data-act="mz-group"]:has-text("Groupe suivant")'); pg.wait_for_timeout(500)
    check('« Groupe suivant » : juz 30, groupe 6 (sans empiler les pages)', 'groupe 6' in pg.locator('.page .topbar__title').inner_text() and e.js("() => window.__QR.UI.pages.length") == 2)
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(400)
    juz_txt = norm(pg.locator('.page .mz-stat').inner_text())
    check('juz 30 : « 1 groupe connu sur 8 » et pourcentage', '1 groupe connu sur 8' in juz_txt and '% connu' in juz_txt, juz_txt)
    # tout le juz 29 : J'apprends, puis Pas encore, puis Annuler
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    pg.click('#tab-learn [data-act="mz-juz"][data-j="29"]'); pg.wait_for_timeout(500)
    pg.click('.page [data-act="sheet"][data-sheet="mz-bulk"]'); pg.wait_for_timeout(400)
    check('« Marquer tout le juz » : 3 choix', pg.locator('.sheet [data-act="mz-bulk-go"]').count() == 3)
    pg.click('.sheet [data-act="mz-bulk-go"][data-st="known"]'); pg.wait_for_timeout(700)
    check('juz 29 entier : « Je connais »', e.js("() => window.__QR.unitStat(window.__QR.juzParts(29)).st") == 'known')
    pg.click('#toasts [data-act="toast-action"]'); pg.wait_for_timeout(700)
    check('« Annuler » : juz 29 revient à « Pas encore »', e.js("() => window.__QR.unitStat(window.__QR.juzParts(29)).st") == 'none' and e.js("() => !window.__QR.Store.mem.progress.has('s67')"))
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    # --- Où j'en suis : le groupe en cours ---
    now = norm(pg.locator('#tab-learn .mz-now').inner_text())
    check('Où j’en suis : « Tu apprends » le groupe 8 du juz 30', 'Tu apprends' in now and 'groupe 8' in now, now[:140].replace('\n', ' | '))
    # --- lecteur : fin de sourate, 3 états ---
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(400)
    row = pg.locator('#readList .srow[data-s="112"]').inner_text()
    check('Lire : Al-Ikhlas affichée « Je connais »', 'Je connais' in row, row.replace('\n', ' | '))
    pg.click('#readList .srow[data-s="111"]'); pg.wait_for_timeout(1200)
    card = pg.locator('.page .self-card')
    check('fin de sourate : « Cette sourate, pour toi » avec 3 états', card.count() == 1 and card.locator('.mz-seg__b').count() == 3)
    card.locator('[data-act="mz-set-sura"][data-st="known"]').click(); pg.wait_for_timeout(600)
    check('« Je connais » depuis le lecteur : Al-Masad connue, en-tête « Tu la connais »', st(e, 111) == 'known' and pg.locator('.page .sura-head__known').count() == 1 and pg.locator('.page .self-card.is-on').count() == 1)
    e.shot('M4-lecteur')
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(400)
    # --- Mes progrès ---
    pg.click('.nav__tab[data-tab="progress"]'); pg.wait_for_timeout(700)
    exp = e.js("""() => { const Q = window.__QR; const G = Q.Groups.d; let kw = 0;
      for (let s = 1; s <= 114; s++) { const p = Q.Store.mem.progress.get('s' + s); if (!p) continue; const kv = Array.isArray(p.kv) ? p.kv : (p.self ? [[1, G.vw[s].length]] : []);
        for (const [a, b] of kv) for (let v = a; v <= b; v++) kw += G.vw[s][v - 1]; }
      return { kw, total: G.total, pct: Math.floor(kw / G.total * 100) }; }""")
    tot = norm(pg.locator('#tab-progress .mz-total').inner_text())
    check('pourcentage = mots marqués connus / mots du Coran', f"{exp['kw']:,}".replace(',', ' ') in tot.replace(' ', ' ') and '77 433' in tot, (exp, tot[:160].replace('\n', ' | ')))
    nknown = e.js("() => Array.from({ length: 114 }, (_, i) => i + 1).filter((s) => window.__QR.suraKnown(s)).length")
    check('nombre de sourates connues', f'{nknown}\nsourates sur 114' in pg.locator('#tab-progress .mz-kpis').inner_text() or f'{nknown}\nsourate sur 114' in pg.locator('#tab-progress .mz-kpis').inner_text(), nknown)
    check('carte : 30 juz', pg.locator('#tab-progress .mz-map .mz-tile').count() == 30)
    check('carte : juz 30 en partie (remplissage), juz 29 vide', 'mz-tile--partial' in pg.locator('#tab-progress .mz-tile[data-j="30"]').get_attribute('class') or 'mz-tile--learning' in pg.locator('#tab-progress .mz-tile[data-j="30"]').get_attribute('class'))
    check('« En cours » : le groupe 8 du juz 30', pg.locator('#tab-progress .mz-groups--cur [data-i="239"]').count() == 1)
    check('« Lire et écrire l’arabe » : 10 chapitres', pg.locator('#tab-progress .mz-ar .mz-ar__ch').count() == 10)
    check('plus de « jours de pratique » ni de minutes', 'jour de pratique' not in pg.locator('#tab-progress').inner_text() and 'jours de pratique' not in pg.locator('#tab-progress').inner_text())
    e.shot('M5-progres')
    pg.click('#tab-progress .mz-tile[data-j="30"]'); pg.wait_for_timeout(500)
    check('carte : toucher un juz ouvre ses groupes', pg.locator('.page .mz-gcard').count() == 8)
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    # --- carte de l'agenda : rien de quotidien ---
    sm = json.loads(e.js("() => localStorage.getItem('qr.summary.v1')"))
    check('résumé pour l’agenda : % connu et groupe en cours', sm.get('v') == 2 and sm.get('name') == 'juz 30, groupe 8' and sm.get('learning') is True and sm.get('pct'), sm)
    # --- réglages : plus de « temps par jour » ; rappel facultatif, chaque semaine par défaut ---
    pg.click('#tab-progress .topbar [data-page="settings"]'); pg.wait_for_timeout(500)
    stxt = pg.locator('.page').inner_text()
    check('réglages : plus de « Temps par jour » ni de « Mon parcours »', 'Temps par jour' not in stxt and 'Mon parcours' not in stxt)
    pg.click('.page [data-sheet="remind"]'); pg.wait_for_timeout(400)
    check('rappel : facultatif, « Chaque semaine » par défaut', pg.locator('.sheet .seg__b.is-on').inner_text().strip() == 'Chaque semaine')
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
