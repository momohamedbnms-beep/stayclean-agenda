"""Banc d'essai Mon Coran (Playwright). Données fictives, aucun service réel."""
import os, json, time, re
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8765/'
QA = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(QA, 'shots')
os.makedirs(SHOTS, exist_ok=True)
TONE = open(os.path.join(QA, 'tone.wav'), 'rb').read()

def fulfill_media(route, body, ctype='audio/wav'):
    """Réponse média avec prise en charge des plages (Range) : indispensable pour se déplacer dans l'audio."""
    h = {'content-type': ctype, 'access-control-allow-origin': '*', 'accept-ranges': 'bytes'}
    rg = route.request.headers.get('range')
    if route.request.method == 'HEAD':
        h['content-length'] = str(len(body)); route.fulfill(status=200, body='', headers=h); return
    m = re.match(r'bytes=(\d*)-(\d*)', rg or '')
    if m and (m.group(1) or m.group(2)):
        a = int(m.group(1)) if m.group(1) else len(body) - int(m.group(2))
        b = int(m.group(2)) if (m.group(2) and m.group(1)) else len(body) - 1
        b = min(b, len(body) - 1)
        h['content-range'] = 'bytes %d-%d/%d' % (a, b, len(body))
        route.fulfill(status=206, body=body[a:b + 1], headers=h); return
    route.fulfill(status=200, body=body, headers=h)

class Env:
    def __init__(self, p, viewport=(390, 844), dark=False, audio_ok=True, supabase=None, offline_audio=False, reduced=False, fake_mic=False):
        args = ['--autoplay-policy=no-user-gesture-required']
        if fake_mic:
            args += ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
        self.browser = p.chromium.launch(args=args)
        self.ctx = self.browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]}, device_scale_factor=2,
                                            color_scheme='dark' if dark else 'light', locale='fr-BE', timezone_id='Europe/Brussels',
                                            reduced_motion='reduce' if reduced else 'no-preference')
        self.errors = []
        self.audio_requests = []
        self.audio_ok = audio_ok
        def audio_route(route):
            self.audio_requests.append(route.request.url)
            if not self.audio_ok:
                route.abort('internetdisconnected'); return
            fulfill_media(route, TONE)
        self.ctx.route(re.compile(r'https://everyayah\.com/.*'), audio_route)
        self.ctx.route(re.compile(r'https://cdn\.mp3quran\.net/.*'), audio_route)
        self.ctx.route(re.compile(r'https://www\.mp3quran\.net/api/.*'), lambda r: r.fulfill(status=200, body='[]', headers={'content-type': 'application/json', 'access-control-allow-origin': '*'}))
        if supabase is None:
            self.ctx.route(re.compile(r'https://cdn\.jsdelivr\.net/.*'), lambda r: r.abort())
        else:
            supabase(self.ctx)
        self.page = self.ctx.new_page()
        self.page.on('console', lambda m: self.errors.append('console:' + m.text) if m.type == 'error' else None)
        self.page.on('pageerror', lambda e: self.errors.append('pageerror:' + str(e)))

    def open(self, path='coran.html', skip_minutes=True, reciter='husary'):
        self.page.goto(BASE + path)
        self.page.wait_for_function('window.__QR && window.__QR.Content.index !== null', timeout=15000)
        self.page.wait_for_timeout(700)
        if reciter:
            # les tests généraux utilisent une voix « un fichier par verset » (sons d'essai) ; la voix principale a son propre test
            self.page.evaluate("(r) => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { reciter: r, reciterV2: true }))", reciter)
            self.page.wait_for_timeout(150)
        if skip_minutes and self.page.locator('[data-act="minutes-save"]').count():
            self.page.click('[data-act="minutes-save"]')
            self.page.wait_for_timeout(300)
        return self.page

    def shot(self, name, full=False):
        self.page.wait_for_timeout(250)
        self.page.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=full)

    def js(self, code, arg=None):
        return self.page.evaluate(code, arg)

    def close(self):
        self.ctx.close(); self.browser.close()

def real_errors(errs):
    # le script Supabase est volontairement bloqué dans les tests sans compte
    return [e for e in errs if 'cdn.jsdelivr.net' not in e and 'ERR_FAILED' not in e and 'Failed to load resource' not in e]
