"""Banc d'essai Mon Coran (Playwright). Données fictives, aucun service réel."""
import os, json, time, re
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8765/'
QA = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(QA, 'shots')
os.makedirs(SHOTS, exist_ok=True)
TONE = open(os.path.join(QA, 'tone.wav'), 'rb').read()

class Env:
    def __init__(self, p, viewport=(390, 844), dark=False, audio_ok=True, supabase=None, offline_audio=False, reduced=False):
        self.browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
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
            route.fulfill(status=200, body=TONE, headers={'content-type': 'audio/wav', 'access-control-allow-origin': '*'})
        self.ctx.route(re.compile(r'https://everyayah\.com/.*'), audio_route)
        if supabase is None:
            self.ctx.route(re.compile(r'https://cdn\.jsdelivr\.net/.*'), lambda r: r.abort())
        else:
            supabase(self.ctx)
        self.page = self.ctx.new_page()
        self.page.on('console', lambda m: self.errors.append('console:' + m.text) if m.type == 'error' else None)
        self.page.on('pageerror', lambda e: self.errors.append('pageerror:' + str(e)))

    def open(self, path='coran.html', skip_minutes=True):
        self.page.goto(BASE + path)
        self.page.wait_for_function('window.__QR && window.__QR.Content.index !== null', timeout=15000)
        self.page.wait_for_timeout(700)
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
