"""Voix principale (Al-Luhaidan, un fichier par sourate) : suivi par verset lu sur la position réelle de l'audio,
basmala, vitesse, déplacement, défilement suspendu par le geste, voix de secours annoncée, mot à mot (Al-Husary).
Audio et repères d'essai (aucun service réel) : un fichier de 12 s et des repères fictifs pour la sourate 112."""
from qa import *
import io, math, struct, sys, wave

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def make_wav(seconds, rate=8000):
    buf = io.BytesIO()
    w = wave.open(buf, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    frames = bytearray()
    for i in range(int(seconds * rate)):
        v = int(6000 * math.sin(2 * math.pi * 220 * i / rate)) if (i // rate) % 2 == 0 else 0
        frames += struct.pack('<h', v)
    w.writeframes(bytes(frames)); w.close()
    return buf.getvalue()

WAV = make_wav(12)
TIMING = {'format': 1, 'reciter': 'luhaidan', 's': {
    '112': {'ok': True, 'bytes': len(WAV), 'dur': 12, 'intro': [500, 2800], 'v': [[3000, 5000], [5200, 7000], [7200, 9000], [9200, 11500]]},
    # limite 3 (entre les versets 3 et 4) non confirmée : versets 3 et 4 surlignés ensemble, jamais isolés avec cette voix
    '114': {'ok': True, 'bytes': len(WAV), 'dur': 12, 'intro': [500, 2800], 'u': [3],
            'v': [[3000, 4500], [4700, 6000], [6200, 7600], [7800, 9000], [9200, 10400], [10600, 11800]]}}}

def routes(ctx):
    ctx.route(re.compile(r'.*/coran/data/timing/luhaidan\.json.*'), lambda r: r.fulfill(status=200, body=json.dumps(TIMING), headers={'content-type': 'application/json'}))
    ctx.route(re.compile(r'https://cdn\.mp3quran\.net/audio/muhammad-luhaidan/.*'), lambda r: fulfill_media(r, WAV))

with sync_playwright() as p:
    e = Env(p)
    routes(e.ctx)
    pg = e.open(reciter=None)
    check('voix principale par défaut : Al-Luhaidan', e.js("() => window.__QR.reciterId()") == 'luhaidan', e.js("() => window.__QR.reciterId()"))
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(300)
    pg.fill('#readSearch', '112'); pg.wait_for_timeout(250)
    pg.click('#readList .srow[data-s="112"]'); pg.wait_for_timeout(1200)
    # lecture continue depuis le début : basmala puis versets
    pg.click('[data-act="reader-play"]'); pg.wait_for_timeout(1500)
    bar = pg.locator('#player').inner_text()
    check('lecteur : nom réel de la voix + suivi par verset', 'Mohamed Al-Luhaidan' in bar and 'suivi par verset' in bar, bar.replace('\n', ' | '))
    check('basmala surlignée au début', pg.locator('[data-vk="b:112"].is-active').count() == 1)
    e.js("() => { const el = window.__QR.Player.el; el.currentTime = 5.6; }"); pg.wait_for_timeout(500)
    check('déplacement à 5,6 s → verset 2 actif', pg.locator('.page [data-vk="112:2"].is-active').count() == 1, e.js("() => [...document.querySelectorAll('[data-vk].is-active')].map(x => x.dataset.vk)"))
    check('pas de mot surligné (aucun repère mot à mot pour cette voix)', pg.locator('.w.is-now').count() == 0)
    pg.click('[data-act="player-rate"]'); pg.wait_for_timeout(300)
    check('vitesse 0,75 appliquée à l’audio', abs(e.js("() => window.__QR.Player.el.playbackRate") - 0.75) < 0.01)
    e.js("() => { const el = window.__QR.Player.el; el.currentTime = 9.6; }"); pg.wait_for_timeout(500)
    check('après changement de vitesse et déplacement : verset 4 actif', pg.locator('.page [data-vk="112:4"].is-active').count() == 1)
    # geste de l'utilisateur pendant la récitation : le défilement automatique se suspend
    e.js("() => { const el = window.__QR.Player.el; el.currentTime = 3.1; }"); pg.wait_for_timeout(300)
    pg.mouse.move(195, 420); pg.mouse.wheel(0, -300); pg.wait_for_timeout(400)
    check('défilement manuel : bouton « Revenir à la récitation »', pg.locator('[data-act="follow-resume"]').count() == 1)
    check('audio toujours en cours après le geste', e.js("() => window.__QR.Player.state") in ('playing', 'loading'), e.js("() => window.__QR.Player.state"))
    pg.click('[data-act="follow-resume"]'); pg.wait_for_timeout(500)
    check('« Revenir à la récitation » : bouton retiré', pg.locator('[data-act="follow-resume"]').count() == 0)
    pg.click('[data-act="player-toggle"]'); pg.wait_for_timeout(300)
    check('pause : le verset reste surligné', e.js("() => window.__QR.Player.state") == 'paused' and pg.locator('.page [data-vk].is-active').count() >= 1)
    pg.click('[data-act="player-stop"]'); pg.wait_for_timeout(300)
    # répétition d'un verset : joue seulement ses bornes
    pg.click('.vnum[data-a="3"]'); pg.wait_for_timeout(300)
    pg.locator('[data-act="repeat-verse"]').first.click(); pg.wait_for_timeout(1200)
    t = e.js("() => window.__QR.Player.el.currentTime")
    check('répétition du verset 3 : lecture dans ses bornes (7,2 s → 9 s)', 7.0 <= t <= 9.4, t)
    pg.click('[data-act="player-stop"]'); pg.wait_for_timeout(300)
    # sourate sans repères vérifiés : verset isolé lu par une autre voix, annoncé, nom affiché exact
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    pg.fill('#readSearch', '113'); pg.wait_for_timeout(250)
    pg.click('#readList .srow[data-s="113"]'); pg.wait_for_timeout(1200)
    pg.click('.vnum[data-a="2"]'); pg.wait_for_timeout(300)
    pg.locator('[data-act="repeat-verse"]').first.click(); pg.wait_for_timeout(1500)
    toast = pg.locator('#toasts').inner_text()
    bar = pg.locator('#player').inner_text()
    check('voix de secours annoncée (pas de remplacement silencieux)', 'pas de repères de versets vérifiés' in toast, toast)
    check('nom affiché = voix entendue (Al-Husary)', 'Mahmoud Khalil Al-Husary' in bar, bar.replace('\n', ' | '))
    check('fichier joué : Al-Husary (EveryAyah)', any('everyayah.com/data/Husary_64kbps/113002' in u for u in e.audio_requests), e.audio_requests[-2:])
    pg.click('[data-act="player-stop"]'); pg.wait_for_timeout(300)
    # mot à mot avec une voix qui a des repères quran-align
    e.js("() => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { reciter: 'husary', reciterV2: true }))"); pg.wait_for_timeout(300)
    pg.click('.vnum[data-a="1"]'); pg.wait_for_timeout(300)
    pg.locator('[data-act="repeat-verse"]').first.click(); pg.wait_for_timeout(700)
    e.js("() => { const el = window.__QR.Player.el; el.pause(); el.currentTime = 0.85; }"); pg.wait_for_timeout(400)
    check('Al-Husary : mot en cours surligné (repères quran-align)', pg.locator('.page [data-vk="113:1"] .w.is-now').count() >= 1, e.js("() => document.querySelectorAll('.w.is-now').length"))
    e.shot('L1-mot-a-mot')
    pg.click('[data-act="player-stop"]'); pg.wait_for_timeout(300)
    # limite non confirmée : versets regroupés
    e.js("() => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { reciter: 'luhaidan', reciterV2: true }))"); pg.wait_for_timeout(300)
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    pg.fill('#readSearch', '114'); pg.wait_for_timeout(250)
    pg.click('#readList .srow[data-s="114"]'); pg.wait_for_timeout(1200)
    pg.click('[data-act="reader-play"]'); pg.wait_for_timeout(1200)
    e.js("() => { const el = window.__QR.Player.el; el.currentTime = 6.5; }"); pg.wait_for_timeout(500)
    act = e.js("() => [...document.querySelectorAll('.page [data-vk].is-active')].map(x => x.dataset.vk)")
    check('limite incertaine : versets 3 et 4 surlignés ensemble', '114:3' in act and '114:4' in act and len(act) == 2, act)
    bar = pg.locator('#player').inner_text()
    check('lecteur : « versets 3 et 4 »', 'versets 3 et 4' in bar, bar.replace('\n', ' | '))
    e.js("() => window.__QR.Player.el.pause()"); pg.wait_for_timeout(300)
    pg.locator('.page [data-vk="114:3"]').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    e.shot('L2-groupe')
    e.js("() => window.__QR.Player.el.play()"); pg.wait_for_timeout(300)
    e.js("() => { const el = window.__QR.Player.el; el.currentTime = 5.0; }"); pg.wait_for_timeout(500)
    act = e.js("() => [...document.querySelectorAll('.page [data-vk].is-active')].map(x => x.dataset.vk)")
    check('limite confirmée : verset 2 seul', act == ['114:2'], act)
    pg.click('[data-act="player-stop"]'); pg.wait_for_timeout(300)
    pg.click('.vnum[data-a="2"]'); pg.wait_for_timeout(300)
    n0 = len(e.audio_requests)
    pg.locator('[data-act="repeat-verse"]').first.click(); pg.wait_for_timeout(1200)
    t = e.js("() => window.__QR.Player.el.currentTime")
    bar = pg.locator('#player').inner_text()
    check('verset 2 (limites sûres) : Al-Luhaidan, dans ses bornes', 'Mohamed Al-Luhaidan' in bar and 4.4 <= t <= 6.3, [t, bar.replace('\n', ' | ')])
    pg.click('[data-act="player-stop"]'); pg.wait_for_timeout(300)
    pg.click('.vnum[data-a="4"]'); pg.wait_for_timeout(300)
    pg.locator('[data-act="repeat-verse"]').first.click(); pg.wait_for_timeout(1500)
    toast = pg.locator('#toasts').inner_text(); bar = pg.locator('#player').inner_text()
    check('verset 4 (limite incertaine) : voix de secours annoncée', 'pas assez sûre' in toast and 'verset 4' in toast, toast)
    check('verset 4 : nom affiché = Al-Husary, fichier Al-Husary', 'Mahmoud Khalil Al-Husary' in bar and any('Husary_64kbps/114004' in u for u in e.audio_requests[n0:]), [bar.replace('\n', ' | '), e.audio_requests[n0:][-2:]])
    pg.click('[data-act="player-stop"]'); pg.wait_for_timeout(300)
    # « Écouter à partir d'ici » au verset 4 : la limite 3/4 n'est pas sûre → départ au verset 3, même voix, annoncé
    pg.click('.vnum[data-a="4"]'); pg.wait_for_timeout(300)
    pg.locator('[data-act="play-from"]').first.click(); pg.wait_for_timeout(1300)
    toast = pg.locator('#toasts').inner_text(); bar = pg.locator('#player').inner_text()
    t = e.js("() => window.__QR.Player.el.currentTime")
    check('à partir du verset 4 : départ annoncé au verset 3, voix Al-Luhaidan', 'à partir du verset 3' in toast and 'Mohamed Al-Luhaidan' in bar and 6.0 <= t <= 7.9, [toast, t])
    pg.click('[data-act="player-stop"]'); pg.wait_for_timeout(300)
    print('ERRORS', real_errors(e.errors))
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
