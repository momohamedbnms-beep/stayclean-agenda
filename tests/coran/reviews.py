"""Révisions espacées, jalons 4–6, « je la connais déjà », révisions groupées, reprise après « À retravailler »,
versets difficiles, erreurs audio. Dates simulées via __QR.setToday ; aucune donnée réelle."""
from qa import *
import sys, datetime

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

from zoneinfo import ZoneInfo
T0 = datetime.datetime.now(ZoneInfo("Europe/Brussels")).date()
def day(n): return (T0 + datetime.timedelta(days=n)).isoformat()

def step(pg): return pg.evaluate("() => window.__QR.Store.session && window.__QR.Store.session.step")
def set_day(e, n):
    e.js(f"() => window.__QR.setToday('{day(n)}')"); e.page.wait_for_timeout(350)
def recite_full(e, result='solo'):
    pg = e.page
    pg.click('[data-act="session-start"]'); pg.wait_for_timeout(600)
    assert step(pg) == 'recite', step(pg)
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(200)
    pg.click(f'.choice[data-r="{result}"]'); pg.wait_for_timeout(500)
def finish(e):
    pg = e.page
    while e.js("() => window.__QR.Store.session && !window.__QR.Store.session.done"):
        st = step(pg)
        if st in ('after', 'link-after', 'link-intro'): pg.click('.sess__acts [data-act="step-continue"]')
        else: break
        pg.wait_for_timeout(300)
    if pg.locator('.done [data-act="session-close"]').count():
        pg.click('.done .sess__acts [data-act="session-close"]'); pg.wait_for_timeout(400)
    elif pg.locator('#pages .sess__top [data-act="session-close"]').count():
        pg.click('#pages .sess__top [data-act="session-close"]'); pg.wait_for_timeout(400)
def prog(e, s): return e.js(f"() => {{ const p = window.__QR.progressOf({s}); window.__QR.refreshMilestones(p); return p }}")
def rev(e, rid): return e.js(f"() => window.__QR.Store.mem.review.get('{rid}') || null")

with sync_playwright() as p:
    # ---------- A. « Je connais déjà Al-Fatiha » puis révisions espacées ----------
    e = Env(p)
    pg = e.open()
    pg.click('[data-act="known-start"]'); pg.wait_for_timeout(700)
    check('connue : on commence par réciter', step(pg) == 'recite')
    check('connue : consigne sourate entière', 'Toute la sourate Al-Fatiha' in pg.locator('.page--session .sub').inner_text())
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(200)
    pg.click('.choice[data-r="solo"]'); pg.wait_for_timeout(500)
    check('connue : message de réussite complète', pg.locator('.notice--ok').count() == 1)
    e.shot('50-known-after')
    pr = prog(e, 1)
    check('jalon 4 daté du jour', pr['m'].get('4') == day(0), pr['m'])
    check('jalons 2 et 3 (sourate entière récitée)', pr['m'].get('2') and pr['m'].get('3'))
    check('jalon 1 non coché sans écoute', not pr['m'].get('1'))
    r = rev(e, 's1')
    check('révision de la sourate à J+1', r and r['due'] == day(1) and r['first'] == day(0), r)
    check('parcours : sourate suivante = Al-Ikhlas', e.js("() => window.__QR.prefs().current") == 112)
    finish(e)
    check('accueil : Al-Ikhlas proposée', 'Al-Ikhlas' in pg.locator('.today__name').inner_text())
    e.shot('51-home-next')
    # Mes progrès
    pg.click('.nav__tab[data-tab="progress"]'); pg.wait_for_timeout(400)
    e.shot('52-progress')
    txt = pg.locator('#tab-progress').inner_text()
    check('Mes progrès : état « Mémorisée — auto-évaluation »', 'Mémorisée — auto-évaluation' in txt)
    pg.click('.nav__tab[data-tab="learn"]'); pg.wait_for_timeout(300)
    # J+1 : révision sans aide → jalon 5
    set_day(e, 1)
    check('J+1 : révision prévue', 'Révision prévue' in pg.locator('.today__label').inner_text())
    check('J+1 : libellé du bouton', pg.locator('[data-act="session-start"]').inner_text().strip() == 'Commencer ma séance')
    recite_full(e, 'solo')
    pr = prog(e, 1); r = rev(e, 's1')
    check('J+1 : jalon 5 = nouvelle récitation le lendemain', pr['m'].get('5') == day(1), pr['m'])
    check('J+1 : prochaine révision à J+3', r['due'] == day(3) and r['stage'] == 1, r)
    finish(e)
    # J+3 : hésitation → rapproche
    set_day(e, 3)
    recite_full(e, 'hesitation')
    r = rev(e, 's1')
    check('J+3 : hésitation → révision rapprochée (J+4)', r['due'] == day(4), r)
    finish(e)
    # J+4 : sans aide → repère J+7 depuis la première réussite
    set_day(e, 4)
    recite_full(e, 'solo')
    r = rev(e, 's1')
    check('J+4 : prochaine à J+7', r['due'] == day(7) and r['stage'] == 2, r)
    finish(e)
    # J+7 : la date seule ne coche rien
    set_day(e, 7)
    pr = prog(e, 1)
    check('J+7 sans récitation : jalon 6 non coché', not pr['m'].get('6'), pr['m'])
    recite_full(e, 'solo')
    pr = prog(e, 1); r = rev(e, 's1')
    check('J+7 : jalon 6 après nouvelle récitation sans aide', pr['m'].get('6') == day(7), pr['m'])
    check('J+7 : prochaine à J+14', r['due'] == day(14), r)
    finish(e)
    # J+14, J+30 puis entretien
    set_day(e, 14); recite_full(e, 'solo'); r = rev(e, 's1'); finish(e)
    check('J+14 : prochaine à J+30', r['due'] == day(30), r)
    set_day(e, 30); recite_full(e, 'solo'); r = rev(e, 's1'); finish(e)
    check('J+30 : entretien (écart ≥ 30 jours)', r['due'] >= day(60), r)
    # À retravailler : la sourate passe « À revoir », sans effacer les jalons
    set_day(e, int((datetime.date.fromisoformat(r['due']) - T0).days))
    recite_full(e, 'rework')
    pr = prog(e, 1); r = rev(e, 's1')
    check('À retravailler : revue le lendemain', r['due'] == (datetime.date.fromisoformat(r['last']['date']) + datetime.timedelta(days=1)).isoformat(), r)
    check('À retravailler : jalons conservés', pr['m'].get('4') and pr['m'].get('5') and pr['m'].get('6'))
    check('choisir les versets difficiles proposé', pg.locator('[data-act="difficult-open"]').count() == 1)
    pg.click('[data-act="difficult-open"]'); pg.wait_for_timeout(300)
    pg.click('.vchip[data-a="2"]'); pg.wait_for_timeout(150)
    pg.click('[data-act="difficult-save"]'); pg.wait_for_timeout(500)
    rd = rev(e, 'p1:2-2')
    check('verset difficile : révision créée pour demain', rd and rd['due'] == (datetime.date.fromisoformat(r['last']['date']) + datetime.timedelta(days=1)).isoformat(), rd)
    nextA_before = prog(e, 1)['nextA']
    check('verset difficile repris tout de suite (écoute)', step(pg) == 'listen')
    pg.click('.sess__acts [data-act="learn-listen"]'); pg.wait_for_selector('[data-act="step-next"][data-to="repeat"]', timeout=15000)
    pg.click('[data-act="step-next"][data-to="repeat"]'); pg.wait_for_timeout(150)
    pg.click('.sess__acts [data-act="step-next"][data-to="recite"]'); pg.wait_for_timeout(150)
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(150)
    pg.click('.choice[data-r="solo"]'); pg.wait_for_timeout(400)
    rd2 = rev(e, 'p1:2-2')
    check('reprise réussie le jour même : la révision reste prévue demain', rd2['due'] == rd['due'] and rd2['last'].get('retry') == 'solo', rd2)
    check('reprise : le pointeur des nouveaux passages ne bouge pas', prog(e, 1)['nextA'] == nextA_before)
    print('ERRORS A', real_errors(e.errors))
    e.close()

    # ---------- B. Révisions groupées + « À retravailler » puis reprise ----------
    e = Env(p)
    pg = e.open()
    # données de test : trois passages d'Al-Ikhlas réussis hier, à revoir aujourd'hui
    e.js(f"""async () => {{
      const Q = window.__QR;
      await Q.put('prefs', 'main', Object.assign({{}}, Q.prefs(), {{ current: 112, minutesAsked: true, minutes: 10 }}));
      await Q.put('progress', 's112', {{ s: 112, startedAt: '{day(-1)}', level: 1, nextA: 4, nextC: 0, listened: [1,2,3], worked: [1,2,3], solo: [1,2,3], chunkSolo: {{}}, chunkWorked: {{}}, m: {{}}, known: false, teacher: null }});
      for (const a of [1,2,3]) await Q.put('review', 'p112:' + a + '-' + a, {{ type: 'passage', s: 112, a1: a, a2: a, c: null, first: '{day(-1)}', stage: 0, interval: 1, due: '{day(0)}', lapses: 0, last: {{ date: '{day(-1)}', result: 'solo' }}, active: true }});
      await Q.put('attempt', 'tseed', {{ at: '{day(-1)}T18:00:00Z', date: '{day(-1)}', s: 112, scope: 'passage', mode: 'learn', a1: 1, a2: 3, result: 'solo', aided: false }});
      Q.renderAll();
    }}""")
    pg.wait_for_timeout(500)
    check('accueil : « Révision prévue »', 'Révision prévue' in pg.locator('.today__label').inner_text())
    pg.click('[data-act="session-start"]'); pg.wait_for_timeout(600)
    items = e.js("() => window.__QR.Store.session.items.map(i => [i.type, i.s, i.a1, i.a2, (i.reviewIds||[]).length])")
    print('items', items)
    check('trois révisions qui se suivent → une seule récitation « Versets 1 à 3 »', items[0] == ['review', 112, 1, 3, 3], items)
    check('révision : on récite d’abord', step(pg) == 'recite')
    e.shot('53-review-group')
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(150)
    pg.click('.choice[data-r="rework"]'); pg.wait_for_timeout(400)
    rs = [rev(e, f'p112:{a}-{a}') for a in (1, 2, 3)]
    check('À retravailler → chaque passage revu demain', all(r['due'] == day(1) for r in rs), [r['due'] for r in rs])
    check('« On le retravaille maintenant » proposé', pg.locator('[data-act="rework-now"]').count() == 1)
    e.shot('54-rework')
    pg.click('[data-act="rework-now"]'); pg.wait_for_timeout(300)
    check('reprise : écoute', step(pg) == 'listen')
    pg.click('.sess__acts [data-act="learn-listen"]'); pg.wait_for_selector('[data-act="step-next"][data-to="repeat"]', timeout=20000)
    pg.click('[data-act="step-next"][data-to="repeat"]'); pg.wait_for_timeout(150)
    check('reprise : 2 répétitions', '0 sur 2' in pg.locator('.counter').inner_text(), pg.locator('.counter').inner_text())
    pg.click('.sess__acts [data-act="step-next"][data-to="recite"]'); pg.wait_for_timeout(150)
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(150)
    pg.click('.choice[data-r="solo"]'); pg.wait_for_timeout(400)
    rs2 = [rev(e, f'p112:{a}-{a}') for a in (1, 2, 3)]
    check('reprise réussie : les révisions restent prévues demain', all(r['due'] == day(1) for r in rs2), [r['due'] for r in rs2])
    check('pas de 2e « On le retravaille »', pg.locator('[data-act="rework-now"]').count() == 0)
    finish(e)
    # le lendemain, réussite → l'espacement reprend
    set_day(e, 1)
    pg.click('[data-act="session-start"]'); pg.wait_for_timeout(600)
    items = e.js("() => window.__QR.Store.session.items.map(i => [i.type, i.s, i.a1, i.a2])")
    check('J+1 : le groupe revient', items[0] == ['review', 112, 1, 3], items)
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(150)
    pg.click('.choice[data-r="solo"]'); pg.wait_for_timeout(400)
    rs3 = [rev(e, f'p112:{a}-{a}') for a in (1, 2, 3)]
    check('J+1 réussi : prochaine révision plus tard (≥ J+2)', all(r['due'] >= day(2) for r in rs3), [(r['due'], r['stage']) for r in rs3])
    print('ERRORS B', real_errors(e.errors))
    e.close()

    # ---------- C. Audio indisponible ----------
    e = Env(p, audio_ok=False)
    pg = e.open()
    pg.click('[data-act="session-start"]'); pg.wait_for_timeout(600)
    pg.click('.sess__acts [data-act="learn-listen"]'); pg.wait_for_timeout(2500)
    txt = pg.locator('.page--session').inner_text()
    check('audio en échec : message clair', pg.locator('.page--session .notice--warn').count() == 1, txt[:300])
    check('audio en échec : « Continuer sans l’audio »', pg.locator('[data-act="step-next"][data-to="repeat"]').count() == 1)
    e.shot('55-audio-error')
    print('message :', pg.locator('.page--session .notice--warn').inner_text())
    print('ERRORS C', real_errors(e.errors))
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
