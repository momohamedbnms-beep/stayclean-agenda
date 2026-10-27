"""Sauvegarde sur le compte avec un FAUX serveur Supabase (en mémoire, dans ce script) :
table absente → message clair ; table installée → envoi, puis un 2e appareil retrouve la progression."""
from qa import *
import sys, json, base64, time, urllib.parse, datetime

# supabase-js réel, servi en local (npm install @supabase/supabase-js@2.117.1 dans tests/coran, ou SBJS=chemin)
SBJS = os.environ.get('SBJS') or os.path.join(QA, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js')
SBJS_BODY = open(SBJS, 'rb').read()
UID = '11111111-2222-3333-4444-555555555555'
REF = 'fakeproj'
URL = f'https://{REF}.supabase.co'

def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
EXP = int(time.time()) + 3600 * 24
JWT = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'exp': EXP, 'role': 'authenticated', 'aud': 'authenticated'}) + '.sig'
USER = {'id': UID, 'email': 'test@example.com', 'aud': 'authenticated', 'role': 'authenticated', 'app_metadata': {}, 'user_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}
SESSION = {'access_token': JWT, 'token_type': 'bearer', 'expires_in': 86400, 'expires_at': EXP, 'refresh_token': 'fake-refresh', 'user': USER}
INIT = """(() => { try {
  localStorage.setItem('stayclean-agenda-v1', JSON.stringify({ settings: { sync: { url: '%s', anonKey: '%s' } } }));
  localStorage.setItem('sb-%s-auth-token', JSON.stringify(%s));
} catch (e) {} })();""" % (URL, 'anon-' + 'x' * 60, REF, json.dumps(SESSION))

class Fake:
    def __init__(self):
        self.installed = False
        self.rows = {}
        self.posts = 0
        self.clock = 0
    def now(self):
        self.clock += 1
        return (datetime.datetime(2026, 10, 27, 12, 0, 0) + datetime.timedelta(milliseconds=self.clock)).isoformat() + 'Z'
    def handle(self, route):
        req = route.request
        cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*', 'content-type': 'application/json'}
        if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors, body='')
        u = urllib.parse.urlparse(req.url); qs = urllib.parse.parse_qs(u.query)
        if u.path.startswith('/auth/v1/user'): return route.fulfill(status=200, headers=cors, body=json.dumps(USER))
        if u.path.startswith('/auth/v1/token'): return route.fulfill(status=200, headers=cors, body=json.dumps(SESSION))
        if u.path.startswith('/rest/v1/qr_items'):
            if not self.installed:
                return route.fulfill(status=404, headers=cors, body=json.dumps({'code': 'PGRST205', 'details': None, 'hint': None, 'message': "Could not find the table 'public.qr_items' in the schema cache"}))
            if req.method == 'GET':
                out = [r for r in self.rows.values() if r['user_id'] == UID]
                if qs.get('deleted') == ['eq.false']: out = [r for r in out if not r['deleted']]
                g = qs.get('updated_at')
                if g and g[0].startswith('gte.'): out = [r for r in out if r['updated_at'] >= g[0][4:]]
                out.sort(key=lambda r: r['updated_at'])
                off = int(qs.get('offset', ['0'])[0]); lim = int(qs.get('limit', ['1000'])[0])
                out = out[off:off + lim]
                return route.fulfill(status=200, headers=cors, body=json.dumps([{k: r[k] for k in ('kind', 'id', 'data', 'deleted', 'updated_at')} for r in out]))
            if req.method == 'POST':
                body = json.loads(req.post_data or '[]'); body = body if isinstance(body, list) else [body]
                for r in body:
                    assert r['user_id'] == UID
                    self.rows[(r['user_id'], r['kind'], r['id'])] = dict(r, updated_at=self.now())
                self.posts += 1
                return route.fulfill(status=201, headers=cors, body='')
        return route.fulfill(status=404, headers=cors, body='{}')

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

fake = Fake()
def setup(ctx):
    ctx.add_init_script(INIT)
    ctx.route(re.compile(r'https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2\.117\.1/dist/umd/supabase\.js'),
              lambda r: r.fulfill(status=200, body=SBJS_BODY, headers={'content-type': 'application/javascript', 'access-control-allow-origin': '*'}))
    ctx.route(re.compile(r'https://fakeproj\.supabase\.co/.*'), fake.handle)

def sync_text(pg):
    pg.click('.nav__tab[data-tab="progress"]'); pg.wait_for_timeout(400)
    t = pg.locator('#tab-progress .sync-line').inner_text() if pg.locator('#tab-progress .sync-line').count() else ''
    pg.click('.nav__tab[data-tab="learn"]'); pg.wait_for_timeout(200)
    return t

with sync_playwright() as p:
    # Appareil A, table absente
    e = Env(p, supabase=setup)
    pg = e.open(); pg.wait_for_timeout(1500)
    st = e.js("() => window.__QR.Sync.state")
    check('table absente → état « not_installed »', st == 'not_installed', st)
    t = sync_text(pg)
    check('message : sauvegarde en ligne pas encore installée', 'pas encore installée' in t, t)
    e.shot('A0-not-installed')
    # on installe la table (comme après avoir lancé supabase/mon-coran.sql), puis on recharge
    fake.installed = True
    pg.reload(); pg.wait_for_function('window.__QR && window.__QR.Content.index !== null'); pg.wait_for_timeout(2000)
    st = e.js("() => window.__QR.Sync.state")
    check('table installée → « synced »', st == 'synced', st)
    check('compte relié : propriétaire = utilisateur', e.js("() => window.__QR.Store.owner") == UID)
    pg.click('[data-act="known-start"]'); pg.wait_for_timeout(600)
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(200)
    pg.click('.choice[data-r="solo"]'); pg.wait_for_timeout(500)
    pg.click('.sess__acts [data-act="step-continue"]'); pg.wait_for_timeout(400)
    pg.click('.done .sess__acts [data-act="session-close"]'); pg.wait_for_timeout(2500)
    kinds = sorted(set(k[1] for k in fake.rows))
    check('envoyé sur le compte : prefs, attempt, progress, review', all(k in kinds for k in ('prefs', 'attempt', 'progress', 'review')), kinds)
    check('aucun texte du Coran envoyé', not any(('بِسْمِ' in json.dumps(r['data'], ensure_ascii=False)) for r in fake.rows.values()))
    t = sync_text(pg)
    check('message : sauvegardé sur ton compte', 'Sauvegardé sur ton compte' in t, t)
    e.shot('A1-synced')
    print('ERRORS A', real_errors(e.errors))
    e.close()
    # Appareil B : stockage vide, même compte
    e = Env(p, supabase=setup)
    pg = e.open(); pg.wait_for_timeout(2500)
    check('appareil B : progression retrouvée (Al-Ikhlas proposée)', 'Al-Ikhlas' in pg.locator('.today__name').inner_text(), pg.locator('.today__name').inner_text())
    pg.click('.nav__tab[data-tab="progress"]'); pg.wait_for_timeout(400)
    txt = pg.locator('#tab-progress').inner_text()
    check('appareil B : Al-Fatiha « Mémorisée — auto-évaluation »', 'Mémorisée — auto-évaluation' in txt)
    e.shot('B1-progress')
    print('ERRORS B', real_errors(e.errors))
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
