"""« Mémoriser » sourate par sourate : ta sourate du moment avec un objectif en jours, « Je la connais » qui passe à la
suivante, « Mes sourates » à cocher, « Ensuite », « Réviser », changer la date et le rythme, une autre sourate (en
parties quand elle est longue), conseils et hadiths, fusion entre appareils, résumé pour l'agenda.
Dates simulées (__QR.setToday), données fictives, aucun service réel."""
from qa import *
import sys, json, re

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def norm(s):
    return (s or '').replace(' ', ' ').replace(' ', ' ')

def st(e, s): return e.js(f"() => window.__QR.surahState({s})")
def cu(e): return e.js("() => { const c = window.__QR.curUnit(); return { kind: c.kind, r: c.r || null, g: c.g || null }; }")
def goal(e, s): return e.js(f"() => {{ const p = window.__QR.Store.mem.progress.get('s{s}'); return p && p.goal ? p.goal : null; }}")
def day(e, iso):
    e.js("(d) => window.__QR.setToday(d)", iso); e.page.wait_for_timeout(450)
def moment(pg): return norm(pg.locator('#tab-learn .mz-moment').inner_text())
def undo(pg):
    pg.click('#toasts [data-act="toast-action"]'); pg.wait_for_timeout(600)

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    day(e, '2026-11-02')   # lundi
    home = norm(pg.locator('#tab-learn').inner_text())
    # --- premier lancement ---
    check('titre et principe : sourate par sourate, rien ne change tout seul', 'Mémoriser le Coran' in home and 'Sourate par sourate' in home and 'rien ne change tout seul' in home)
    check('aucune durée en minutes ni « un peu chaque jour »', not re.search(r'\d\s*min\b|minutes|Environ|chaque jour', home), re.findall(r'.{20}(?:min|Environ|chaque jour).{20}', home)[:3])
    check('rien de coché : « D’abord, coche ce que tu connais déjà »', pg.locator('#tab-learn .mz-setup [data-page="mz-suras"]').count() == 1)
    c = cu(e)
    check('sourate proposée : Al-Fatiha (parcours), sans objectif', c['kind'] == 'next' and c['r'] == [1, 1, 7], c)
    m = moment(pg)
    check('carte : « Prochaine sourate », nom arabe, objectif proposé de 5 jours, « Commencer » et « Je la connais déjà »',
          'Prochaine sourate' in m and 'Al-Fatiha' in m and pg.locator('#tab-learn .mz-moment__ar').inner_text().strip() == 'الفاتحة'
          and 'Objectif proposé : 5 jours' in m and pg.locator('#tab-learn .mz-moment [data-act="mz-start"]').count() == 1 and 'Je la connais déjà' in m, m[:200])
    nx = e.js("() => [...document.querySelectorAll('#tab-learn .mz-next__r')].map((b) => Number(b.dataset.s))")
    check('« Ensuite » : An-Nas, Al-Falaq, Al-Ikhlas (de la fin du Coran vers le début)', nx == [114, 113, 112], nx)
    adv = norm(pg.locator('#tab-learn .mz-advice').inner_text())
    check('conseils ouverts au début : ordre, objectifs, enseignants, 5 hadiths avec références',
          pg.locator('#tab-learn details.mz-advice[open]').count() == 1 and pg.locator('#tab-learn .mz-hadiths li').count() == 5
          and all(x in adv for x in ('n° 5027', 'n° 798', 'n° 4937', 'n° 5033', 'n° 791', 'n° 6464', 'n° 783', 'n° 23482', 'n° 756', 'n° 394')), adv[:120])
    check('conseils : « aucun hadith n’impose d’ordre » et pas l’avis d’un imam', 'Aucun hadith n’impose d’ordre' in adv and 'ni les conseils d’un imam ni une fatwa' in adv)
    check('exemples d’objectifs calculés (Ad-Dhuha 7 jours, Al-Layl 2 semaines, An-Naba 1 mois)', 'Ad-Dhuha (11 versets) en 7 jours' in adv and 'Al-Layl (21 versets) en 2 semaines' in adv and 'An-Naba (40 versets) en 1 mois' in adv, adv[adv.find('Au rythme'):adv.find('Au rythme') + 160])
    e.shot('SS1-depart')
    # --- longues sourates : parties d'environ un mois au rythme normal ---
    parts = e.js("() => ({ mulk: window.__QR.suraUnits(67), baqara: window.__QR.suraUnits(2).length, naba: window.__QR.suraUnits(78), path: window.__QR.pathFlat().length })")
    check('découpage : Al-Mulk en 2 parties (1–16, 17–30), An-Naba entière, Al-Baqara en parties', parts['mulk'] == [[67, 1, 16], [67, 17, 30]] and parts['naba'] == [[78, 1, 40]] and parts['baqara'] > 20, parts)
    mx = e.js("() => { const Q = window.__QR; let mx = 0; for (const r of Q.pathFlat()) { const g = Q.Groups.pre[r[0]]; const w = g[r[2]] - g[r[1] - 1]; if (w > mx) mx = w; } return mx; }")
    check('parties d’environ un mois de travail, coupées sur les versets (≤ 220 mots)', mx <= 220, mx)
    # --- Mes sourates : cocher ---
    pg.click('#tab-learn .mz-setup [data-page="mz-suras"]'); pg.wait_for_timeout(600)
    check('« Mes sourates » : 3 sections, juz ʿAmma ouvert (38), les autres repliées', pg.locator('.page details.mz-ks').count() == 3
          and pg.locator('.page details.mz-ks[data-keep="mzs-amma"][open] .mz-k').count() == 38 and pg.locator('.page details.mz-ks[open]').count() == 1)
    for s in (1, 114, 113, 112, 111, 110):
        pg.click(f'.page .mz-k[data-s="{s}"]'); pg.wait_for_timeout(250)
    check('6 sourates cochées → « Je connais »', all(st(e, s) == 'known' for s in (1, 114, 113, 112, 111, 110)) and pg.locator('.page .mz-k.is-on').count() == 6
          and '6 sourates connues sur 114' in norm(pg.locator('.page .mz-kcount').inner_text()))
    check('case cochée : aria-pressed', pg.locator('.page .mz-k[data-s="112"]').get_attribute('aria-pressed') == 'true')
    check('message avec « Annuler »', 'Je connais' in pg.locator('#toasts').inner_text() and pg.locator('#toasts [data-act="toast-action"]').count() == 1)
    pg.click('.page .mz-k[data-s="110"]'); pg.wait_for_timeout(300)
    check('toucher encore : décochée (« Pas encore »)', st(e, 110) == 'none')
    pg.click('.page .mz-k[data-s="110"]'); pg.wait_for_timeout(300)
    pg.click('.page details.mz-ks[data-keep="mzs-j29"] summary'); pg.wait_for_timeout(250)
    pg.click('.page .mz-k[data-s="67"]'); pg.wait_for_timeout(350)
    check('section « Juz 29 » ouverte : elle le reste après avoir coché', pg.locator('.page details.mz-ks[data-keep="mzs-j29"][open]').count() == 1 and st(e, 67) == 'known')
    undo(pg)
    check('« Annuler » : Al-Mulk décochée', st(e, 67) == 'none')
    e.shot('SS2-mes-sourates')
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(500)
    # --- la prochaine : Al-Kafirun ---
    c = cu(e)
    check('sourate proposée : Al-Kafirun (109), la suivante dans l’ordre', c['kind'] == 'next' and c['r'] == [109, 1, 6], c)
    check('plus de carte « D’abord » ; ligne « Les sourates que je connais : 6 sur 114 »', pg.locator('#tab-learn .mz-setup').count() == 0 and '6 sourates sur 114' in norm(pg.locator('#tab-learn .mz-mine-row').inner_text()))
    check('conseils repliés une fois des sourates cochées', pg.locator('#tab-learn details.mz-advice[open]').count() == 0)
    # --- Commencer ---
    pg.click('#tab-learn .mz-moment [data-act="mz-start"]'); pg.wait_for_timeout(600)
    g = goal(e, 109)
    check('« Commencer » : objectif du lundi 2 au vendredi 6 novembre (5 jours, le premier compte), « J’apprends », séance guidée sur cette sourate',
          g and g['start'] == '2026-11-02' and g['days'] == 5 and g['a1'] == 1 and g['a2'] == 6 and st(e, 109) == 'learning' and e.js("() => window.__QR.prefs().current") == 109
          and e.js("() => window.__QR.goalDue(window.__QR.activeGoal().g)") == '2026-11-06', g)
    check('message : « c’est parti, objectif vendredi »', 'c’est parti, objectif vendredi' in norm(pg.locator('#toasts').inner_text()), pg.locator('#toasts').inner_text())
    undo(pg)
    check('« Annuler » : plus d’objectif, « Pas encore »', cu(e)['kind'] == 'next' and st(e, 109) == 'none')
    pg.click('#tab-learn .mz-moment [data-act="mz-start"]'); pg.wait_for_timeout(600)
    m = moment(pg)
    check('carte : « Ta sourate du moment », jour 1 sur 5, 5 pastilles', 'Ta sourate du moment' in m and 'Jour 1 sur 5' in m and pg.locator('#tab-learn .mz-days li').count() == 5 and pg.locator('#tab-learn .mz-days li.is-today').count() == 1, m[:160])
    check('séance guidée (barre du bas) : sur Al-Kafirun', 'Al-Kafirun' in pg.locator('#tab-learn .mz-guided').inner_text(), pg.locator('#tab-learn .mz-guided').inner_text())
    day(e, '2026-11-04')
    m = moment(pg)
    check('mercredi : « Objectif vendredi », jour 3 sur 5 (2 pastilles passées)', 'Objectif vendredi' in m and 'Jour 3 sur 5' in m and pg.locator('#tab-learn .mz-days li.is-past').count() == 2, m[:200])
    # --- changer la date, le rythme ---
    pg.click('#tab-learn .mz-moment [data-sheet="mz-goal"]'); pg.wait_for_timeout(500)
    sh = norm(pg.locator('.sheet').inner_text())
    check('feuille « Ton objectif » : date, ±, rythme (3 choix avec durée pour cette sourate)', '6 novembre 2026' in sh and 'dans 2 jours' in sh and pg.locator('.sheet [data-act="mz-goal-step"]').count() == 3 and pg.locator('.sheet [data-k="pace"]').count() == 3, sh[:200])
    pg.click('.sheet [data-act="mz-goal-step"][data-d="1"]'); pg.wait_for_timeout(300)
    check('+1 jour → 7 novembre', e.js("() => window.__QR.goalDue(window.__QR.activeGoal().g)") == '2026-11-07')
    pg.click('.sheet [data-act="mz-goal-step"][data-d="7"]'); pg.wait_for_timeout(300)
    check('+1 semaine → 14 novembre', e.js("() => window.__QR.goalDue(window.__QR.activeGoal().g)") == '2026-11-14')
    pg.click('.sheet [data-act="mz-goal-step"][data-d="-1"]'); pg.wait_for_timeout(300)
    check('−1 jour → 13 novembre', e.js("() => window.__QR.goalDue(window.__QR.activeGoal().g)") == '2026-11-13')
    pg.click('.sheet [data-act="mz-goal-set"]'); pg.wait_for_timeout(300)
    check('« 5 jours à partir d’aujourd’hui » (objectif proposé) → 8 novembre (mercredi + 4)', e.js("() => window.__QR.goalDue(window.__QR.activeGoal().g)") == '2026-11-08')
    pg.click('.sheet [data-k="pace"][data-v="doux"]'); pg.wait_for_timeout(300)
    check('rythme « Tranquille » : enregistré, objectifs suivants plus longs (Al-Kawthar 3 jours au lieu de 2)', e.js("() => window.__QR.prefs().pace") == 'doux' and e.js("() => window.__QR.goalDays(10)") == 3 and pg.locator('.sheet [data-k="pace"][data-v="doux"][aria-pressed="true"]').count() == 1)
    e.shot('SS3-objectif')
    pg.click('.sheet [data-k="pace"][data-v="normal"]'); pg.wait_for_timeout(300)
    pg.click('.sheet [data-act="sheet-close"]'); pg.wait_for_timeout(300)
    # --- objectif dépassé ---
    day(e, '2026-11-12')
    m = moment(pg)
    check('jeudi 12 : « Objectif dépassé de 4 jours », sans reproche', 'Objectif dépassé de 4 jours' in m and 'Prends le temps qu’il faut' in m and pg.locator('#tab-learn .mz-moment__goal.is-late').count() == 1, m[:220])
    pg.click('#tab-learn .mz-moment [data-sheet="mz-goal"]'); pg.wait_for_timeout(400)
    check('dépassé : « − » désactivé', pg.locator('.sheet [data-act="mz-goal-step"][data-d="-1"]').is_disabled())
    pg.click('.sheet [data-act="mz-goal-step"][data-d="1"]'); pg.wait_for_timeout(300)
    check('dépassé : « + » → demain (13 novembre)', e.js("() => window.__QR.goalDue(window.__QR.activeGoal().g)") == '2026-11-13')
    pg.click('.sheet [data-act="sheet-close"]'); pg.wait_for_timeout(300)
    # --- « Je la connais » : la suivante commence ---
    pg.click('#tab-learn .mz-moment [data-act="mz-cur-known"]'); pg.wait_for_timeout(700)
    t = norm(pg.locator('#toasts').inner_text())
    g109 = goal(e, 109); c = cu(e)
    check('« Je la connais » : Al-Kafirun connue, objectif atteint', st(e, 109) == 'known' and g109 and g109.get('end') == '2026-11-12' and not g109.get('cancel'), g109)
    check('la suivante commence : Al-Kawthar, objectif de 2 jours', c['kind'] == 'goal' and c['r'] == [108, 1, 3] and c['g']['days'] == 2 and st(e, 108) == 'learning' and e.js("() => window.__QR.prefs().current") == 108, c)
    check('message : apprise en 11 jours, ensuite Al-Kawthar (2 jours : objectif demain)', 'Apprise en 11 jours' in t and 'Ensuite : Al-Kawthar, objectif demain' in t, t)
    undo(pg)
    c = cu(e)
    check('« Annuler » : Al-Kafirun redevient la sourate du moment (objectif gardé), Al-Kawthar comme avant', c['kind'] == 'goal' and c['r'] == [109, 1, 6] and st(e, 109) == 'learning' and st(e, 108) == 'none' and not goal(e, 108) and e.js("() => window.__QR.prefs().current") == 109, c)
    pg.click('#tab-learn .mz-moment [data-act="mz-cur-known"]'); pg.wait_for_timeout(700)
    nx = e.js("() => [...document.querySelectorAll('#tab-learn .mz-next__r')].map((b) => Number(b.dataset.s))")
    check('« Ensuite » : Al-Ma’un, Quraish, Al-Fil', nx == [107, 106, 105], nx)
    proj = norm(pg.locator('#tab-learn .mz-next__proj').inner_text()) if pg.locator('#tab-learn .mz-next__proj').count() else ''
    check('projection : « À ce rythme, tout le juz ʿAmma vers … »', proj.startswith('À ce rythme, tout le juz ʿAmma vers'), proj)
    e.shot('SS4-suivante')
    # --- Réviser ---
    rv = e.js("() => [...document.querySelectorAll('#tab-learn .mz-rev__r [data-act=\"mz-rev\"]')].map((b) => Number(b.dataset.s))")
    check('« Réviser » : 3 sourates, les plus anciennement cochées d’abord (Al-Fatiha, An-Nas, Al-Falaq)', rv == [1, 114, 113], rv)
    pg.click('#tab-learn .mz-rev__r [data-act="mz-rev"][data-s="1"]'); pg.wait_for_timeout(500)
    rv2 = e.js("() => [...document.querySelectorAll('#tab-learn .mz-rev__r [data-act=\"mz-rev\"]')].map((b) => Number(b.dataset.s))")
    check('« Récitée » : Al-Fatiha révisée aujourd’hui, elle passe en dernier', e.js("() => window.__QR.Store.mem.progress.get('s1').rev") == '2026-11-12' and rv2 == [114, 113, 112] and st(e, 1) == 'known', rv2)
    undo(pg)
    check('« Annuler » : révision effacée', not e.js("() => window.__QR.Store.mem.progress.get('s1').rev"))
    day(e, '2026-11-13')
    m = moment(pg)
    check('vendredi 13 (Al-Kawthar, 2 jours) : « Objectif aujourd’hui », jour 2 sur 2 : le dernier', 'Objectif aujourd’hui' in m and 'Jour 2 sur 2 : le dernier' in m, m[:200])
    pg.click('#tab-learn .mz-rev__r [data-act="mz-rev"][data-s="114"]'); pg.wait_for_timeout(400)
    day(e, '2026-11-20')
    rv3 = e.js("() => [...document.querySelectorAll('#tab-learn .mz-rev__r [data-act=\"mz-rev\"]')].map((b) => Number(b.dataset.s))")
    check('une semaine plus tard : An-Nas (récitée le 13) laisse la place à Al-Fatiha, Al-Falaq, Al-Ikhlas', rv3 == [1, 113, 112], rv3)
    check('libellés : « Cochée il y a 18 jours »', 'Cochée il y a 18 jours' in norm(pg.locator('#tab-learn .mz-rev').inner_text()))
    # --- une autre sourate (longue, en parties) ---
    pg.click('#tab-learn .mz-moment [data-sheet="mz-pick"]'); pg.wait_for_timeout(500)
    opts = e.js("() => [...document.querySelectorAll('.sheet [data-act=\"mz-start\"]')].map((b) => Number(b.dataset.s))")
    check('« Autre sourate » : ni les sourates connues ni celle du moment', 108 not in opts and 1 not in opts and 109 not in opts and 67 in opts and len(opts) == 114 - 8, len(opts))
    pg.click('.sheet [data-act="mz-start"][data-s="67"]'); pg.wait_for_timeout(700)
    c = cu(e); g108 = goal(e, 108)
    check('Al-Mulk devient la sourate du moment : partie 1 sur 2 (versets 1 à 16)', c['kind'] == 'goal' and c['r'] == [67, 1, 16] and 'partie 1 sur 2' in moment(pg), c)
    check('Al-Kawthar mise de côté : objectif annulé, toujours « J’apprends »', g108 and g108.get('cancel') and st(e, 108) == 'learning', g108)
    nx = e.js("() => [...document.querySelectorAll('#tab-learn .mz-next__r')].map((b) => [Number(b.dataset.s), Number(b.dataset.a)])")
    check('« Ensuite » : la partie 2 d’Al-Mulk, puis le parcours (Al-Kawthar)', nx[:2] == [[67, 17], [108, 1]], nx)
    e.shot('SS5-al-mulk')
    pg.click('#tab-learn .mz-moment [data-act="mz-cur-known"]'); pg.wait_for_timeout(700)
    c = cu(e)
    check('partie 1 connue → la partie 2 commence (même sourate d’abord)', c['kind'] == 'goal' and c['r'] == [67, 17, 30] and st(e, 67) == 'learning' and e.js("() => window.__QR.unitStat([[67, 1, 16]]).st") == 'known', c)
    # « Je connais » depuis le lecteur : même effet sur ta sourate du moment
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(400)
    pg.fill('#readSearch', '67'); pg.wait_for_timeout(250)
    pg.click('#readList .srow[data-s="67"]'); pg.wait_for_timeout(1300)
    pg.locator('.page .self-card [data-act="mz-set-sura"][data-st="known"]').click(); pg.wait_for_timeout(700)
    c = cu(e)
    check('« Je connais » depuis le lecteur : Al-Mulk connue, retour au parcours (Al-Kawthar)', st(e, 67) == 'known' and c['kind'] == 'goal' and c['r'] == [108, 1, 3], c)
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    pg.click('.nav__tab[data-tab="learn"]'); pg.wait_for_timeout(500)
    # --- « Pas encore » sur la sourate du moment : l'objectif est annulé ---
    e.js("() => window.__QR.setStatus([[108, 1, 3]], 'none')"); pg.wait_for_timeout(400)
    c = cu(e)
    check('« Pas encore » : objectif annulé, la carte propose Al-Kawthar sans objectif', c['kind'] == 'next' and c['r'] == [108, 1, 3] and goal(e, 108).get('cancel'), c)
    # --- « Je la connais déjà » sur la prochaine : pas d'objectif lancé d'office ---
    pg.click('#tab-learn .mz-moment [data-act="mz-cur-known"]'); pg.wait_for_timeout(600)
    c = cu(e)
    check('« Je la connais déjà » : Al-Kawthar connue, la suivante proposée sans objectif', st(e, 108) == 'known' and c['kind'] == 'next' and c['r'] == [107, 1, 7], c)
    # --- par juz et par groupes : toujours là ---
    pg.click('#tab-learn [data-page="mz-path"]'); pg.wait_for_timeout(500)
    order = e.js("() => [...document.querySelectorAll('.page .mz-path [data-act=\"mz-juz\"]')].map((b) => Number(b.dataset.j))")
    check('« Par juz et par groupes » : Al-Fatiha puis juz 30 → 1', pg.locator('.page .mz-row--fat').count() == 1 and order == list(range(30, 0, -1)), order[:4])
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    # --- résumé pour la carte de l'agenda ---
    pg.click('#tab-learn .mz-moment [data-act="mz-start"]'); pg.wait_for_timeout(600)
    e.js("() => window.__QR.renderAll()"); pg.wait_for_timeout(1200)
    sm = json.loads(e.js("() => localStorage.getItem('qr.summary.v1')"))
    check('résumé pour l’agenda : sourate en cours et date de l’objectif', sm.get('v') == 2 and sm.get('name') == 'Al-Ma\'un' and sm.get('learning') is True and sm.get('due') == e.js("() => window.__QR.goalDue(window.__QR.activeGoal().g)"), sm)
    # --- fusion entre appareils : l'objectif le plus récent compte, le reste est gardé ---
    mg = e.js("""() => { const M = window.__QR.MERGE.progress;
      const a = { s: 93, lastAt: '2026-11-03T10:00:00Z', kv: [], lr: [[1, 11]], stAt: 100, goal: { a1: 1, a2: 11, start: '2026-11-01', days: 7, at: 100 }, listened: [1], worked: [], solo: [] };
      const b = { s: 93, lastAt: '2026-11-04T10:00:00Z', kv: [], lr: [[1, 11]], stAt: 100, goal: { a1: 1, a2: 11, start: '2026-11-01', days: 14, at: 200 }, listened: [2], worked: [], solo: [], rev: '2026-11-04' };
      const c = { s: 93, lastAt: '2026-11-05T10:00:00Z', kv: [], lr: [[1, 11]], stAt: 100, listened: [], worked: [], solo: [] };
      return { ab: M(a, b, 1, 2).goal.days, ba: M(b, a, 2, 1).goal.days, ac: !!M(a, c, 1, 2).goal, lis: M(a, b, 1, 2).listened, none: 'goal' in M(c, c, 1, 2) }; }""")
    check('fusion : objectif le plus récent (14 jours) dans les deux sens ; un appareil sans objectif ne l’efface pas', mg['ab'] == 14 and mg['ba'] == 14 and mg['ac'] and mg['lis'] == [1, 2] and not mg['none'], mg)
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
