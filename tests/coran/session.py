"""Parcours complet d'une séance (audio simulé par un bip local, aucune vraie récitation)."""
from qa import *
import sys

def wait_act(pg, sel, timeout=20000):
    pg.wait_for_selector(sel, state='visible', timeout=timeout)

def step(pg):
    return pg.evaluate("() => window.__QR.Store.session && window.__QR.Store.session.step")

def audio_paused(pg):
    return pg.evaluate("() => { const P = window.__QR.Player; return { state: P.state, paused: P.el ? P.el.paused : true, ctx: P.ctx } }")

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    # accueil
    check('accueil : séance guidée (facultative) « Commencer ma séance »', 'Commencer ma séance' in pg.locator('#tab-learn [data-act="session-start"]').inner_text() and 'facultatif' in pg.locator('#tab-learn .mz-guided').inner_text())
    check('accueil : aucune durée imposée (ni « Environ … min », ni minutes)', 'Environ' not in pg.locator('#tab-learn').inner_text() and 'minutes' not in pg.locator('#tab-learn').inner_text())
    e.shot('30-home')
    pg.click('#tab-learn [data-act="session-start"]')
    wait_act(pg, '.page--session')
    pg.wait_for_timeout(500)
    sess = e.js("() => window.__QR.Store.session.items.map(i => [i.type, i.s, i.a1, i.a2])")
    print('items', sess)
    check('séance : étape Écouter', step(pg) == 'listen')
    check('pas de lecture automatique', audio_paused(pg)['state'] in ('idle', None), audio_paused(pg))
    e.shot('31-listen')
    pg.click('.sess__acts [data-act="learn-listen"]')
    pg.wait_for_timeout(300)
    e.shot('32-listen-playing')
    wait_act(pg, '[data-act="step-next"][data-to="repeat"]')
    check('écoute terminée → « À toi de répéter »', True)
    # répéter
    pg.click('[data-act="step-next"][data-to="repeat"]')
    pg.wait_for_timeout(300)
    check('étape Répéter, 3 répétitions par défaut', '0 sur 3 répétitions' in pg.locator('.counter').inner_text(), pg.locator('.counter').inner_text())
    e.shot('33-repeat')
    pg.click('[data-act="repeat-run"]')
    pg.wait_for_selector('.instr--you', timeout=8000)
    check('silence : « À toi de répéter »', 'À toi de répéter' in pg.locator('.instr').inner_text())
    e.shot('34-repeat-gap')
    wait_act(pg, '[data-act="repeat-more"]', timeout=30000)
    check('après 3 cycles : 3 sur 3', '3 sur 3' in pg.locator('.counter').inner_text(), pg.locator('.counter').inner_text())
    e.shot('35-repeat-done')
    # Encore une fois puis arrêt immédiat
    pg.click('[data-act="repeat-more"]')
    pg.wait_for_timeout(400)
    pg.click('[data-act="audio-stop"]')
    pg.wait_for_timeout(200)
    a = audio_paused(pg)
    check('« Arrêter » coupe le son immédiatement', a['paused'] and a['state'] in ('idle', 'stopped'), a)
    # réciter
    btn = pg.locator('[data-act="step-next"][data-to="recite"]').first
    btn.click(); pg.wait_for_timeout(300)
    check('étape Réciter', step(pg) == 'recite')
    hidden = e.js("() => { const ws = [...document.querySelectorAll('.page--session .passage .w:not(.w--sign)')]; return [ws.length, ws.filter(w => w.classList.contains('is-hidden')).length] }")
    check('texte entièrement masqué', hidden[0] > 0 and hidden[0] == hidden[1], hidden)
    check('aucune phonétique ni traduction visible', pg.locator('.page--session .passage .tl, .page--session .passage .fr').count() == 0)
    a = audio_paused(pg)
    check('audio arrêté en récitation', a['paused'], a)
    check('consigne « À toi, sans regarder. »', 'À toi, sans regarder.' in pg.locator('.instr').inner_text())
    e.shot('36-recite')
    pg.click('[data-act="hint"]'); pg.wait_for_timeout(200)
    hidden2 = e.js("() => { const ws = [...document.querySelectorAll('.page--session .passage .w:not(.w--sign)')]; return [ws.length, ws.filter(w => w.classList.contains('is-hidden')).length] }")
    check('un indice révèle un seul mot', hidden2[1] == hidden[1] - 1, hidden2)
    check('mention « aide utilisée »', pg.locator('.page--session .aided').count() == 1)
    e.shot('37-recite-hint')
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(300)
    check('évaluation : « Sans aide » désactivé après un indice', pg.locator('.choice--solo').is_disabled())
    e.shot('38-eval-aided')
    # forcer un clic programmatique sur « Sans aide » : doit quand même compter « avec aide »
    e.js("() => { const b = document.querySelector('.choice--solo'); b.disabled = false; b.click(); }")
    pg.wait_for_timeout(500)
    att = e.js("() => [...window.__QR.Store.mem.attempt.values()].map(x => [x.result, x.aided, x.a1, x.a2])")
    check('tentative enregistrée « avec aide », jamais « sans aide »', att == [['hesitation', True, 1, 1]], att)
    check('étape après : comparer avec la référence', step(pg) == 'after')
    e.shot('39-after')
    rv = e.js("() => Object.fromEntries(window.__QR.Store.mem.review)")
    print('reviews', rv)
    check('passage non réussi sans aide : revu demain, sans étape d’espacement', rv.get('p1:1-1', {}).get('first') is None and rv['p1:1-1']['due'] > e.js("() => new Date().toISOString().slice(0,10)"))
    pg.click('[data-act="step-continue"]'); pg.wait_for_timeout(400)
    # 2e passage : 1:2 sans aide, puis relier
    check('passage suivant (1:2), étape Écouter', step(pg) == 'listen' and e.js("() => window.__QR.Store.session.i") == 1)
    pg.click('.sess__acts [data-act="learn-listen"]'); wait_act(pg, '[data-act="step-next"][data-to="repeat"]')
    pg.click('[data-act="step-next"][data-to="repeat"]'); pg.wait_for_timeout(200)
    pg.click('.sess__acts [data-act="step-next"][data-to="recite"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(200)
    check('« Sans aide » disponible sans indice', not pg.locator('.choice--solo').is_disabled())
    pg.click('.choice--solo'); pg.wait_for_timeout(400)
    rv = e.js("() => window.__QR.Store.mem.review.get('p1:2-2')")
    check('première réussite sans aide → révision J+1', rv and rv['first'] and rv['due'] == e.js("() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('sv-SE', {timeZone:'Europe/Brussels'}) }"), rv)
    pg.click('[data-act="step-continue"]'); pg.wait_for_timeout(300)
    check('étape Relier proposée', step(pg) == 'link-intro')
    e.shot('40-link-intro')
    pg.click('[data-act="link-listen"]'); wait_act(pg, '[data-act="step-next"][data-to="link-recite"]')
    pg.click('[data-act="step-next"][data-to="link-recite"]'); pg.wait_for_timeout(200)
    check('enchaînement masqué (1:1–1:2)', e.js("() => document.querySelectorAll('.page--session .passage .pv').length") == 2)
    e.shot('41-link-recite')
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(200)
    pg.click('.choice--solo'); pg.wait_for_timeout(300)
    check('relier évalué', step(pg) == 'link-after')
    # persistance au milieu de la séance : recharger
    pg.reload(); pg.wait_for_function('window.__QR && window.__QR.Content.index !== null'); pg.wait_for_timeout(800)
    check('après rechargement : « Reprendre ma séance »', 'Reprendre ma séance' in pg.locator('#tab-learn [data-act="session-start"]').inner_text())
    e.shot('42-home-resume')
    pg.click('#tab-learn [data-act="session-start"]'); pg.wait_for_timeout(500)
    check('reprise à la même étape', step(pg) == 'link-after', step(pg))
    pg.click('[data-act="step-continue"]'); pg.wait_for_timeout(300)
    # passages suivants : réciter directement
    guard = 0
    while e.js("() => !window.__QR.Store.session.done") and guard < 60:
        guard += 1
        st = step(pg)
        if st == 'listen':
            pg.click('.sess__acts [data-act="learn-listen"]'); wait_act(pg, '[data-act="step-next"][data-to="repeat"]')
            pg.click('[data-act="step-next"][data-to="repeat"]'); pg.wait_for_timeout(150)
            pg.click('.sess__acts [data-act="step-next"][data-to="recite"]'); pg.wait_for_timeout(150)
        elif st in ('recite', 'link-recite'):
            pg.click('[data-act="recited"]'); pg.wait_for_timeout(150)
        elif st in ('eval', 'link-eval'):
            pg.click('.choice--solo'); pg.wait_for_timeout(300)
        elif st in ('after', 'link-after'):
            pg.click('[data-act="step-continue"]'); pg.wait_for_timeout(300)
        elif st == 'link-intro':
            pg.click('[data-act="step-next"][data-to="link-recite"]'); pg.wait_for_timeout(150)
        else:
            print('étape inattendue', st); break
    check('« Séance terminée »', pg.locator('.done__title').inner_text().strip() == 'Séance terminée')
    e.shot('43-done')
    prog = e.js("() => window.__QR.Store.mem.progress.get('s1')")
    print('progress', {k: prog.get(k) for k in ('worked', 'solo', 'listened', 'nextA', 'level', 'm')})
    check('versets 1–4 travaillés', prog['worked'] == [1, 2, 3, 4])
    check('verset 1 pas « sans aide »', 1 not in prog['solo'])
    pg.click('.done [data-act="session-close"]'); pg.wait_for_timeout(400)
    check('retour à « Mémoriser » : prochaine révision de la séance guidée affichée', 'Prochaine révision' in pg.locator('#tab-learn .mz-guided').inner_text(), pg.locator('#tab-learn .mz-guided').inner_text())
    check('la séance n’a rien marqué d’office : Al-Fatiha « Pas encore »', e.js("() => window.__QR.surahState(1)") == 'none')
    e.shot('44-home-after')
    # le lendemain : révisions d'abord
    tomorrow = e.js("() => { const d = new Date(); d.setDate(d.getDate()+1); return d.toLocaleDateString('sv-SE', {timeZone:'Europe/Brussels'}) }")
    e.js(f"() => window.__QR.setToday('{tomorrow}')"); pg.wait_for_timeout(400)
    check('lendemain : « révision prévue » dans la séance guidée', 'révision prévue' in pg.locator('#tab-learn .mz-guided').inner_text() or 'révisions prévues' in pg.locator('#tab-learn .mz-guided').inner_text(), pg.locator('#tab-learn .mz-guided').inner_text())
    e.shot('45-home-review')
    pg.click('#tab-learn [data-act="session-start"]'); pg.wait_for_timeout(500)
    items = e.js("() => window.__QR.Store.session.items.map(i => i.type)")
    print('items J+1', items)
    check('révisions avant le nouveau', items[0] == 'review' and 'review' not in items[items.index('new'):] if 'new' in items else items[0] == 'review', items)
    check('révision : on commence par réciter', step(pg) == 'recite')
    e.shot('46-review-recite')
    print('ERRORS', real_errors(e.errors))
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
