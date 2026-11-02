"""« Mémoriser » sourate par sourate : le bilan en chiffres (connues, en cours, à réviser), les trois listes
(À réviser, Connues, À apprendre) avec ✓ pour cocher, la fiche d'une sourate, ta sourate en cours avec un objectif
en jours, « Je la connais » qui passe à la suivante, les révisions espacées (« Récitée »), changer la date et le
rythme, une autre sourate (en parties quand elle est longue), la page « Conseils et hadiths », fusion entre
appareils, résumé pour l'agenda.
Dates simulées (__QR.setToday), données fictives, aucun service réel."""
from qa import *
import sys, json, re

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def norm(s):
    return (s or '').replace('\u202f', ' ').replace('\u00a0', ' ')

def st(e, s): return e.js(f"() => window.__QR.surahState({s})")
def cu(e): return e.js("() => { const c = window.__QR.curUnit(); return { kind: c.kind, r: c.r || null, g: c.g || null }; }")
def goal(e, s): return e.js(f"() => {{ const p = window.__QR.Store.mem.progress.get('s{s}'); return p && p.goal ? p.goal : null; }}")
def prog(e, s): return e.js(f"() => window.__QR.Store.mem.progress.get('s{s}') || null")
def gdays(e, r): return e.js(f"() => window.__QR.goalDays(window.__QR.todoW({json.dumps(r)}))")
def day(e, iso):
    e.js("(d) => window.__QR.setToday(d)", iso); e.page.wait_for_timeout(450)
def moment(pg): return norm(pg.locator('#tab-learn .mz-moment').inner_text())
def undo(pg):
    pg.click('#toasts [data-act="toast-action"]'); pg.wait_for_timeout(600)
def toast(pg): return norm(pg.locator('#toasts').inner_text())
def nums(e): return e.js("() => [...document.querySelectorAll('#tab-learn .mz-num b')].map((b) => Number(b.textContent))")
def tabs(e): return e.js("() => Object.fromEntries([...document.querySelectorAll('#tab-learn .mz-tabs__b')].map((b) => [b.dataset.tab, Number(b.querySelector('b').textContent)]))")
def tab_on(e): return e.js("() => { const b = document.querySelector('#tab-learn .mz-tabs__b.is-on'); return b ? b.dataset.tab : null; }")
def rows(e): return e.js("() => [...document.querySelectorAll('#tab-learn .mz-list .mz-li__main')].map((b) => Number(b.dataset.s))")
def row(pg, s): return norm(pg.locator(f'#tab-learn .mz-li:has(.mz-li__main[data-s="{s}"])').inner_text())
def is_cur(pg, s): return 'is-cur' in (pg.locator(f'#tab-learn .mz-li:has(.mz-li__main[data-s="{s}"])').get_attribute('class') or '')
def lists(pg): return norm(pg.locator('#tab-learn .mz-lists').inner_text())
def go_tab(pg, k):
    pg.click(f'#tab-learn .mz-tabs__b[data-tab="{k}"]'); pg.wait_for_timeout(400)
def sheet_of(pg, s):
    pg.click(f'#tab-learn .mz-li__main[data-s="{s}"]'); pg.wait_for_timeout(450)
    return norm(pg.locator('#sheets .sheet').last.inner_text())
def sheet_acts(e): return e.js("() => [...document.querySelectorAll('#sheets .sheet .opts .opt')].map((b) => b.dataset.act)")
def sheets_open(e): return e.js("() => document.querySelectorAll('#sheets .sheet:not(.is-closing)').length")
def close_sheet(pg):
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    day(e, '2026-11-02')   # lundi
    home = norm(pg.locator('#tab-learn').inner_text())
    # --- premier lancement ---
    check('titre et principe : « Coche ce que tu connais : l’appli te dit quoi apprendre et quoi réviser »', 'Mémoriser le Coran' in home and 'Coche ce que tu connais : l’appli te dit quoi apprendre et quoi réviser.' in home)
    check('aucune durée en minutes ni « un peu chaque jour »', not re.search(r'\d\s*min\b|minutes|Environ|chaque jour', home), re.findall(r'.{20}(?:min|Environ|chaque jour).{20}', home)[:3])
    check('bilan : 0 connue, 0 en cours, 0 à réviser ; juz ʿAmma 0 sur 38, tout le Coran 0 sur 114', nums(e) == [0, 0, 0]
          and 'Juz ʿAmma (avec Al-Fatiha) : 0 sur 38' in home and 'Tout le Coran : 0 sourates sur 114' in home, nums(e))
    check('listes : « À apprendre » ouverte d’office (rien de coché), compteurs 0 / 0 / 114', tab_on(e) == 'todo' and tabs(e) == {'rev': 0, 'known': 0, 'todo': 114}, (tab_on(e), tabs(e)))
    r0 = rows(e)
    check('« À apprendre » : les 12 premières dans l’ordre (Al-Fatiha, An-Nas, Al-Falaq…), puis « Afficher les 102 autres »',
          r0 == [1, 114, 113, 112, 111, 110, 109, 108, 107, 106, 105, 104] and 'Afficher les 102 autres sourates' in home, r0)
    check('Al-Fatiha surlignée : « Prochaine sourate · 7 versets », un ✓ par ligne pour cocher', 'Prochaine sourate · 7 versets' in row(pg, 1) and is_cur(pg, 1) and pg.locator('#tab-learn .mz-tick').count() == 12)
    n114 = gdays(e, [114, 1, 6])
    check('chaque ligne donne un objectif d’après la longueur (An-Nas : « 6 versets · ≈ N jours »)', f'6 versets · ≈ {n114} jours' in row(pg, 114), (n114, row(pg, 114)))
    c = cu(e)
    check('sourate proposée : Al-Fatiha (parcours), sans objectif', c['kind'] == 'next' and c['r'] == [1, 1, 7], c)
    m = moment(pg)
    check('carte : « Prochaine sourate », nom arabe, objectif proposé de 5 jours, « Commencer » et « Je la connais déjà »',
          'Prochaine sourate' in m and 'Al-Fatiha' in m and pg.locator('#tab-learn .mz-moment__ar').inner_text().strip() == 'الفاتحة'
          and 'Objectif proposé : 5 jours' in m and pg.locator('#tab-learn .mz-moment [data-act="mz-start"]').count() == 1 and 'Je la connais déjà' in m, m[:200])
    go_tab(pg, 'rev')
    check('« À réviser » vide au départ : dit d’abord de cocher', 'Rien à réviser aujourd’hui.' in lists(pg) and 'Coche d’abord' in lists(pg), lists(pg)[:160])
    go_tab(pg, 'known')
    check('« Connues » vide au départ : explique le ✓', 'Aucune sourate cochée pour l’instant.' in lists(pg), lists(pg)[:160])
    e.shot('SS1-depart')
    # --- Conseils et hadiths (page à part) ---
    pg.click('#tab-learn [data-page="mz-conseils"]'); pg.wait_for_timeout(500)
    adv = norm(pg.locator('#pages .page').last.inner_text())
    check('« Conseils et hadiths » : ordre, objectifs, révisions, méthode en 4 étapes, 5 hadiths avec références',
          pg.locator('.page .mz-hadiths li').count() == 5 and pg.locator('.page .mz-steps--page li').count() == 4 and 'Les révisions' in adv
          and all(x in adv for x in ('n° 5027', 'n° 798', 'n° 4937', 'n° 5033', 'n° 791', 'n° 6464', 'n° 783', 'n° 23482', 'n° 756', 'n° 394')), adv[:120])
    check('conseils : « aucun hadith n’impose d’ordre » et pas l’avis d’un imam', 'Aucun hadith n’impose d’ordre' in adv and 'ni les conseils d’un imam ni une fatwa' in adv)
    check('exemples d’objectifs calculés (Ad-Dhuha 7 jours, Al-Layl 2 semaines, An-Naba 1 mois)', 'Ad-Dhuha (11 versets) en 7 jours' in adv and 'Al-Layl (21 versets) en 2 semaines' in adv and 'An-Naba (40 versets) en 1 mois' in adv, adv[adv.find('Au rythme'):adv.find('Au rythme') + 160])
    check('révisions expliquées : le lendemain, 3 jours, 1 semaine, 2 semaines, chaque mois', 'revient le lendemain, puis après 3 jours, 1 semaine, 2 semaines, puis chaque mois' in adv)
    e.shot('SS1b-conseils')
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(400)
    # --- longues sourates : parties d'environ un mois au rythme normal ---
    parts = e.js("() => ({ mulk: window.__QR.suraUnits(67), baqara: window.__QR.suraUnits(2).length, naba: window.__QR.suraUnits(78), path: window.__QR.pathFlat().length })")
    check('découpage : Al-Mulk en 2 parties (1–16, 17–30), An-Naba entière, Al-Baqara en parties', parts['mulk'] == [[67, 1, 16], [67, 17, 30]] and parts['naba'] == [[78, 1, 40]] and parts['baqara'] > 20, parts)
    mx = e.js("() => { const Q = window.__QR; let mx = 0; for (const r of Q.pathFlat()) { const g = Q.Groups.pre[r[0]]; const w = g[r[2]] - g[r[1] - 1]; if (w > mx) mx = w; } return mx; }")
    check('parties d’environ un mois de travail, coupées sur les versets (≤ 220 mots)', mx <= 220, mx)
    # --- cocher ce que je connais déjà (✓ dans « À apprendre ») ---
    go_tab(pg, 'todo')
    for s in (1, 114, 113, 112, 111, 110):
        pg.click(f'#tab-learn .mz-tick[data-s="{s}"]'); pg.wait_for_timeout(300)
    check('6 sourates cochées → « Je connais »', all(st(e, s) == 'known' for s in (1, 114, 113, 112, 111, 110)), [st(e, s) for s in (1, 114, 113, 112, 111, 110)])
    check('message avec « Annuler »', 'Je connais' in toast(pg) and pg.locator('#toasts [data-act="toast-action"]').count() == 1, toast(pg))
    check('l’onglet reste « À apprendre » ; les cochées en sortent (Al-Kafirun en tête)', tab_on(e) == 'todo' and rows(e)[:3] == [109, 108, 107], rows(e)[:4])
    check('bilan : 6 connues ; compteurs 0 / 6 / 108 ; juz ʿAmma 6 sur 38', nums(e)[0] == 6 and tabs(e) == {'rev': 0, 'known': 6, 'todo': 108}
          and 'Juz ʿAmma (avec Al-Fatiha) : 6 sur 38' in norm(pg.locator('#tab-learn .mz-bilan').inner_text()), (nums(e), tabs(e)))
    # retirer depuis « Connues » (fiche de la sourate), puis la recocher
    pg.click('#tab-learn .mz-num--known'); pg.wait_for_timeout(500)
    check('toucher « connues » dans le bilan ouvre la liste « Connues », dans l’ordre', tab_on(e) == 'known' and rows(e) == [1, 114, 113, 112, 111, 110], rows(e))
    check('ligne : « Connue depuis le 2 novembre · révision le 9 novembre »', 'Connue depuis le 2 novembre · révision le 9 novembre' in row(pg, 110), row(pg, 110))
    sh = sheet_of(pg, 110)
    check('fiche d’une sourate connue : depuis quand, pas encore récitée ; Récitée, Écouter, « Je ne la connais plus »',
          'An-Nasr · sourate 110' in sh and 'Connue depuis le 2 novembre · pas encore récitée · prochaine révision le 9 novembre' in sh
          and sheet_acts(e) == ['mz-rev', 'mz-open', 'mz-know'] and 'Je ne la connais plus' in sh, (sh[:220], sheet_acts(e)))
    pg.click('#sheets .sheet [data-act="mz-know"]'); pg.wait_for_timeout(600)
    check('« Je ne la connais plus » : An-Nasr décochée, fiche fermée', st(e, 110) == 'none' and sheets_open(e) == 0 and rows(e) == [1, 114, 113, 112, 111], (st(e, 110), sheets_open(e), rows(e)))
    go_tab(pg, 'todo')
    pg.click('#tab-learn .mz-tick[data-s="110"]'); pg.wait_for_timeout(300)
    # Al-Mulk : plus loin dans la liste
    pg.click('#tab-learn [data-act="mz-all"]'); pg.wait_for_timeout(400)
    check('« Afficher les autres » : les 108 sourates à apprendre', len(rows(e)) == 108 and pg.locator('#tab-learn [data-act="mz-all"]').count() == 0, len(rows(e)))
    pg.click('#tab-learn .mz-tick[data-s="67"]'); pg.wait_for_timeout(400)
    check('Al-Mulk cochée (liste complète gardée)', st(e, 67) == 'known' and 67 not in rows(e) and len(rows(e)) == 107)
    undo(pg)
    check('« Annuler » : Al-Mulk décochée', st(e, 67) == 'none' and 67 in rows(e))
    e.shot('SS2-cochees')
    # --- la prochaine : Al-Kafirun ---
    c = cu(e)
    check('sourate proposée : Al-Kafirun (109), la suivante dans l’ordre', c['kind'] == 'next' and c['r'] == [109, 1, 6], c)
    go_tab(pg, 'rev')
    check('« À réviser » : rien aujourd’hui, prochaine révision annoncée (Al-Fatiha, le 9 novembre)', 'Rien à réviser aujourd’hui.' in lists(pg) and 'Prochaine révision : Al-Fatiha, le 9 novembre.' in lists(pg), lists(pg)[:200])
    # --- Commencer ---
    pg.click('#tab-learn .mz-moment [data-act="mz-start"]'); pg.wait_for_timeout(600)
    g = goal(e, 109)
    check('« Commencer » : objectif du lundi 2 au vendredi 6 novembre (5 jours, le premier compte), « J’apprends », séance guidée sur cette sourate',
          g and g['start'] == '2026-11-02' and g['days'] == 5 and g['a1'] == 1 and g['a2'] == 6 and st(e, 109) == 'learning' and e.js("() => window.__QR.prefs().current") == 109
          and e.js("() => window.__QR.goalDue(window.__QR.activeGoal().g)") == '2026-11-06', g)
    check('message : « c’est parti, objectif vendredi »', 'c’est parti, objectif vendredi' in toast(pg), toast(pg))
    undo(pg)
    check('« Annuler » : plus d’objectif, « Pas encore »', cu(e)['kind'] == 'next' and st(e, 109) == 'none')
    pg.click('#tab-learn .mz-moment [data-act="mz-start"]'); pg.wait_for_timeout(600)
    m = moment(pg)
    check('carte : « En cours », jour 1 sur 5, 5 pastilles', m.startswith('En cours') and 'Jour 1 sur 5' in m and pg.locator('#tab-learn .mz-days li').count() == 5 and pg.locator('#tab-learn .mz-days li.is-today').count() == 1, m[:160])
    check('bilan : 6 connues, 1 en cours, 0 à réviser', nums(e) == [6, 1, 0], nums(e))
    go_tab(pg, 'todo')
    check('« À apprendre » : Al-Kafirun en tête, surlignée « En cours · objectif vendredi »', rows(e)[0] == 109 and 'En cours · objectif vendredi' in row(pg, 109) and is_cur(pg, 109), row(pg, 109))
    check('séance guidée (en bas) : sur Al-Kafirun', 'Al-Kafirun' in pg.locator('#tab-learn .mz-guided').inner_text(), pg.locator('#tab-learn .mz-guided').inner_text())
    sh = sheet_of(pg, 109)
    check('fiche de la sourate en cours : « Commencée aujourd’hui · objectif vendredi » ; Étudier, « Je la connais »', 'Commencée aujourd’hui · objectif vendredi' in sh and sheet_acts(e) == ['mz-open', 'mz-cur-known'], (sh[:200], sheet_acts(e)))
    close_sheet(pg)
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
    t = toast(pg)
    g109 = goal(e, 109); c = cu(e)
    check('« Je la connais » : Al-Kafirun connue, objectif atteint', st(e, 109) == 'known' and g109 and g109.get('end') == '2026-11-12' and not g109.get('cancel'), g109)
    check('la suivante commence : Al-Kawthar, objectif de 2 jours', c['kind'] == 'goal' and c['r'] == [108, 1, 3] and c['g']['days'] == 2 and st(e, 108) == 'learning' and e.js("() => window.__QR.prefs().current") == 108, c)
    check('message : apprise en 11 jours, ensuite Al-Kawthar (2 jours : objectif demain)', 'Apprise en 11 jours' in t and 'Ensuite : Al-Kawthar, objectif demain' in t, t)
    undo(pg)
    c = cu(e)
    check('« Annuler » : Al-Kafirun redevient la sourate en cours (objectif gardé), Al-Kawthar comme avant', c['kind'] == 'goal' and c['r'] == [109, 1, 6] and st(e, 109) == 'learning' and st(e, 108) == 'none' and not goal(e, 108) and e.js("() => window.__QR.prefs().current") == 109, c)
    pg.click('#tab-learn .mz-moment [data-act="mz-cur-known"]'); pg.wait_for_timeout(700)
    go_tab(pg, 'todo')
    check('« À apprendre » : Al-Kawthar (en cours, objectif demain), puis Al-Ma’un, Quraish, Al-Fil', rows(e)[:4] == [108, 107, 106, 105] and 'En cours · objectif demain' in row(pg, 108), (rows(e)[:4], row(pg, 108)))
    proj = norm(pg.locator('#tab-learn .mz-next__proj').inner_text()) if pg.locator('#tab-learn .mz-next__proj').count() else ''
    check('projection sous la liste : « À ce rythme, tout le juz ʿAmma vers … »', proj.startswith('À ce rythme, tout le juz ʿAmma vers'), proj)
    e.shot('SS4-suivante')
    # --- Réviser ---
    check('bilan : 7 connues (Al-Kafirun comprise), 1 en cours, 6 à réviser', nums(e) == [7, 1, 6], nums(e))
    pg.click('#tab-learn .mz-num--rev'); pg.wait_for_timeout(500)
    check('toucher « à réviser » ouvre la liste : les 6 cochées le 2 (révision au bout d’une semaine), dans l’ordre ; pas Al-Kafirun, apprise aujourd’hui',
          tab_on(e) == 'rev' and rows(e) == [1, 114, 113, 112, 111, 110], rows(e))
    check('ligne : « Pas encore récitée » et un bouton « Récitée » par sourate', 'Pas encore récitée' in row(pg, 1) and pg.locator('#tab-learn .mz-li [data-act="mz-rev"]').count() == 6, row(pg, 1))
    e.shot('SS5-reviser')
    pg.click('#tab-learn .mz-li [data-act="mz-rev"][data-s="1"]'); pg.wait_for_timeout(500)
    p1 = prog(e, 1)
    check('« Récitée » : Al-Fatiha notée aujourd’hui (1 fois), elle sort de la liste', p1.get('rev') == '2026-11-12' and p1.get('revN') == 1 and p1.get('revAt') and rows(e) == [114, 113, 112, 111, 110] and st(e, 1) == 'known', (p1.get('rev'), p1.get('revN'), rows(e)))
    check('message : « récitée. Prochaine révision le 26 novembre » (2 semaines)', 'Al-Fatiha : récitée. Prochaine révision le 26 novembre.' in toast(pg), toast(pg))
    undo(pg)
    p1 = prog(e, 1)
    check('« Annuler » : révision effacée, Al-Fatiha revient dans la liste', not p1.get('rev') and not p1.get('revN') and rows(e) == [1, 114, 113, 112, 111, 110], (p1.get('rev'), rows(e)))
    sh = sheet_of(pg, 114)
    check('fiche (à réviser) : « à réviser maintenant », « Je l’ai récitée » en premier', 'à réviser maintenant' in sh and sheet_acts(e)[:1] == ['mz-rev'], sh[:200])
    pg.click('#sheets .sheet [data-act="mz-rev"]'); pg.wait_for_timeout(600)
    check('« Je l’ai récitée » depuis la fiche : An-Nas notée, fiche fermée', prog(e, 114).get('rev') == '2026-11-12' and sheets_open(e) == 0 and 114 not in rows(e), (prog(e, 114).get('rev'), sheets_open(e)))
    go_tab(pg, 'known')
    sh = sheet_of(pg, 114)
    check('fiche (connues) : « récitée 1 fois, la dernière aujourd’hui », « Déjà notée aujourd’hui »', 'récitée 1 fois, la dernière aujourd’hui' in sh and 'Déjà notée aujourd’hui' in sh, sh[:220])
    pg.click('#sheets .sheet [data-act="mz-rev"]'); pg.wait_for_timeout(600)
    check('deux fois le même jour : compte une seule fois', prog(e, 114).get('revN') == 1)
    check('« Connues » : An-Nas « révision le 26 novembre », Al-Kafirun « Apprise le 12 novembre · révision demain »',
          'révision le 26 novembre' in row(pg, 114) and 'Apprise le 12 novembre · révision demain' in row(pg, 109), (row(pg, 114), row(pg, 109)))
    day(e, '2026-11-13')
    m = moment(pg)
    check('vendredi 13 (Al-Kawthar, 2 jours) : « Objectif aujourd’hui », jour 2 sur 2 : le dernier', 'Objectif aujourd’hui' in m and 'Jour 2 sur 2 : le dernier' in m, m[:200])
    go_tab(pg, 'rev')
    check('vendredi 13 : Al-Kafirun (« Apprise hier ») revient, en dernier', rows(e) == [1, 113, 112, 111, 110, 109] and 'Apprise hier' in row(pg, 109), (rows(e), row(pg, 109)))
    pg.click('#tab-learn .mz-li [data-act="mz-rev"][data-s="109"]'); pg.wait_for_timeout(500)
    check('Al-Kafirun récitée : prochaine révision lundi (3 jours)', 'Al-Kafirun : récitée. Prochaine révision lundi.' in toast(pg), toast(pg))
    day(e, '2026-11-20')
    check('une semaine plus tard : les cochées le 2 (sauf An-Nas, récitée le 12), puis Al-Kafirun', rows(e) == [1, 113, 112, 111, 110, 109], rows(e))
    check('libellé : « Récitée il y a 7 jours »', 'Récitée il y a 7 jours' in row(pg, 109), row(pg, 109))
    go_tab(pg, 'known')
    check('« Connues » : An-Nas « révision jeudi » (le 26)', 'révision jeudi' in row(pg, 114), row(pg, 114))
    # recocher une sourate déjà connue (ex. tout un juz) ne change pas « Connue depuis »
    e.js("() => window.__QR.setStatus(window.__QR.suraParts(113), 'known')"); pg.wait_for_timeout(300)
    check('recocher Al-Falaq (déjà connue) : « Connue depuis le 2 novembre » gardé', prog(e, 113).get('kvAt') == '2026-11-02', prog(e, 113).get('kvAt'))
    # --- une autre sourate (longue, en parties) ---
    pg.click('#tab-learn .mz-moment [data-sheet="mz-pick"]'); pg.wait_for_timeout(500)
    opts = e.js("() => [...document.querySelectorAll('.sheet [data-act=\"mz-start\"]')].map((b) => Number(b.dataset.s))")
    check('« Autre sourate » : ni les sourates connues ni celle en cours', 108 not in opts and 1 not in opts and 109 not in opts and 67 in opts and len(opts) == 114 - 8, len(opts))
    pg.click('.sheet [data-act="mz-start"][data-s="67"]'); pg.wait_for_timeout(700)
    c = cu(e); g108 = goal(e, 108)
    check('Al-Mulk devient la sourate en cours : partie 1 sur 2 (versets 1 à 16)', c['kind'] == 'goal' and c['r'] == [67, 1, 16] and 'partie 1 sur 2' in moment(pg), c)
    check('Al-Kawthar mise de côté : objectif annulé, toujours « J’apprends »', g108 and g108.get('cancel') and st(e, 108) == 'learning', g108)
    go_tab(pg, 'todo')
    check('bilan : 2 en cours ; « À apprendre » : Al-Kawthar « Commencée », Al-Mulk surlignée « En cours »', nums(e)[1] == 2 and 'Commencée' in row(pg, 108) and 'En cours · objectif' in row(pg, 67) and is_cur(pg, 67),
          (nums(e), row(pg, 108), row(pg, 67)))
    e.shot('SS6-al-mulk')
    pg.click('#tab-learn .mz-moment [data-act="mz-cur-known"]'); pg.wait_for_timeout(700)
    c = cu(e)
    check('partie 1 connue → la partie 2 commence (même sourate d’abord)', c['kind'] == 'goal' and c['r'] == [67, 17, 30] and st(e, 67) == 'learning' and e.js("() => window.__QR.unitStat([[67, 1, 16]]).st") == 'known', c)
    check('« À apprendre » : Al-Mulk toujours en cours (partie 2)', 'En cours · objectif' in row(pg, 67) and is_cur(pg, 67), row(pg, 67))
    # « Je connais » depuis le lecteur : même effet sur ta sourate en cours
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(400)
    pg.fill('#readSearch', '67'); pg.wait_for_timeout(250)
    pg.click('#readList .srow[data-s="67"]'); pg.wait_for_timeout(1300)
    pg.locator('.page .self-card [data-act="mz-set-sura"][data-st="known"]').click(); pg.wait_for_timeout(700)
    c = cu(e)
    check('« Je connais » depuis le lecteur : Al-Mulk connue, retour au parcours (Al-Kawthar)', st(e, 67) == 'known' and c['kind'] == 'goal' and c['r'] == [108, 1, 3], c)
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    pg.click('.nav__tab[data-tab="learn"]'); pg.wait_for_timeout(500)
    go_tab(pg, 'known')
    check('« Connues » : Al-Mulk « Apprise le 20 novembre »', 'Apprise le 20 novembre' in row(pg, 67), row(pg, 67))
    # --- « Pas encore » sur la sourate en cours : l'objectif est annulé ---
    e.js("() => window.__QR.setStatus([[108, 1, 3]], 'none')"); pg.wait_for_timeout(400)
    c = cu(e)
    check('« Pas encore » : objectif annulé, la carte propose Al-Kawthar sans objectif', c['kind'] == 'next' and c['r'] == [108, 1, 3] and goal(e, 108).get('cancel'), c)
    # --- « Je la connais déjà » sur la prochaine : pas d'objectif lancé d'office ---
    pg.click('#tab-learn .mz-moment [data-act="mz-cur-known"]'); pg.wait_for_timeout(600)
    c = cu(e)
    check('« Je la connais déjà » : Al-Kawthar connue, la suivante proposée sans objectif', st(e, 108) == 'known' and c['kind'] == 'next' and c['r'] == [107, 1, 7], c)
    # --- fiche d'une sourate pas encore apprise : commencer, cocher, écouter ---
    go_tab(pg, 'todo')
    n106 = gdays(e, [106, 1, 4])
    sh = sheet_of(pg, 106)
    check('fiche (à apprendre) : « Pas encore apprise · objectif proposé : N jours » ; Commencer, Je la connais déjà, Écouter',
          f'Pas encore apprise · objectif proposé : {n106} jours' in sh and sheet_acts(e) == ['mz-start', 'mz-know', 'mz-open'], (sh[:200], sheet_acts(e)))
    pg.click('#sheets .sheet [data-act="mz-open"]'); pg.wait_for_timeout(1300)
    check('« L’écouter et la lire » : Quraish s’ouvre dans le lecteur (4 versets), fiche fermée', pg.locator('.page .verse').count() == 4 and sheets_open(e) == 0)
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(400)
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
    # « Commencer cette sourate » depuis sa fiche : elle devient la sourate en cours
    sheet_of(pg, 106)
    pg.click('#sheets .sheet [data-act="mz-start"]'); pg.wait_for_timeout(700)
    c = cu(e)
    check('« Commencer cette sourate » (fiche) : Quraish en cours, Al-Ma’un mise de côté', c['kind'] == 'goal' and c['r'] == [106, 1, 4] and goal(e, 107).get('cancel') and sheets_open(e) == 0, c)
    # retirée puis recochée plus tard : « Connue depuis » le jour où elle est recochée (et non plus « Apprise »)
    day(e, '2026-11-25')
    e.js("async () => { const Q = window.__QR; await Q.setStatus(Q.suraParts(67), 'none'); await Q.setStatus(Q.suraParts(67), 'known'); }"); pg.wait_for_timeout(400)
    go_tab(pg, 'known')
    check('Al-Mulk retirée puis recochée le 25 : « Connue depuis le 25 novembre »', 'Connue depuis le 25 novembre' in row(pg, 67), row(pg, 67))
    # --- fusion entre appareils : l'objectif le plus récent compte, le reste est gardé ---
    mg = e.js("""() => { const M = window.__QR.MERGE.progress;
      const a = { s: 93, lastAt: '2026-11-03T10:00:00Z', kv: [], lr: [[1, 11]], stAt: 100, goal: { a1: 1, a2: 11, start: '2026-11-01', days: 7, at: 100 }, listened: [1], worked: [], solo: [] };
      const b = { s: 93, lastAt: '2026-11-04T10:00:00Z', kv: [], lr: [[1, 11]], stAt: 100, goal: { a1: 1, a2: 11, start: '2026-11-01', days: 14, at: 200 }, listened: [2], worked: [], solo: [], rev: '2026-11-04' };
      const c = { s: 93, lastAt: '2026-11-05T10:00:00Z', kv: [], lr: [[1, 11]], stAt: 100, listened: [], worked: [], solo: [] };
      return { ab: M(a, b, 1, 2).goal.days, ba: M(b, a, 2, 1).goal.days, ac: !!M(a, c, 1, 2).goal, lis: M(a, b, 1, 2).listened, none: 'goal' in M(c, c, 1, 2) }; }""")
    check('fusion : objectif le plus récent (14 jours) dans les deux sens ; un appareil sans objectif ne l’efface pas', mg['ab'] == 14 and mg['ba'] == 14 and mg['ac'] and mg['lis'] == [1, 2] and not mg['none'], mg)
    mr = e.js("""() => { const M = window.__QR.MERGE.progress;
      // téléphone : « Récitée » le 4 ; Mac : Al-Ikhlas écoutée plus tard (version plus récente), sans cette révision
      const tel = { s: 112, lastAt: '2026-11-04T08:00:00Z', kv: [[1, 4]], stAt: 50, rev: '2026-11-04', revN: 2, revAt: 300, listened: [], worked: [], solo: [] };
      const mac = { s: 112, lastAt: '2026-11-04T09:00:00Z', kv: [[1, 4]], stAt: 50, rev: '2026-10-20', revN: 1, revAt: 200, listened: [3], worked: [], solo: [] };
      // « Annuler » sur le Mac après coup (révision retirée) : l'emporte sur la version récitée
      const undo = { s: 112, lastAt: '2026-11-04T07:00:00Z', kv: [[1, 4]], stAt: 50, revAt: 400, listened: [], worked: [], solo: [] };
      const m1 = M(tel, mac, 1, 2); const m2 = M(mac, tel, 2, 1); const m3 = M(tel, undo, 1, 2);
      return { r1: [m1.rev, m1.revN, m1.listened], r2: [m2.rev, m2.revN], r3: ['rev' in m3, 'revN' in m3] }; }""")
    check('fusion des révisions : la dernière « Récitée » gagne même si l’autre appareil a touché la sourate après ; « Annuler » aussi',
          mr['r1'] == ['2026-11-04', 2, [3]] and mr['r2'] == ['2026-11-04', 2] and mr['r3'] == [False, False], mr)
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
