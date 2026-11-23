"""Mon Programme (sport.html, « Le Camp ») — banc d'essai Playwright. Données fictives, faux serveur Supabase en mémoire.
1. Lien ami (?ami=1, téléphone sans agenda) : profil, séance du jour, séries cochées, charges retenues, rotation sur
   plusieurs jours (le jour de la semaine ne compte pas), repos après J6, aucune requête vers un serveur ;
   l'icône de l'écran d'accueil (sans « ?ami=1 ») retrouve tout.
2. Depuis l'agenda (compte relié) : pesées partagées avec Mes Calories (kind « weights »), programme dans
   settings/sport, un 2e appareil retrouve la séance ; la ligne settings/main de Mes Calories n'est jamais touchée.
3. Accueil de l'agenda : la carte MON PROGRAMME remplace MES CALORIES, aller-retour avec flèche, résumé sur la carte.
Lancer : python3 -m http.server 8765 (racine du dépôt), puis python3 tests/sport/test_sport.py"""
import os, re, json, time, base64, datetime, urllib.parse
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SP_BASE', 'http://127.0.0.1:8765/')
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, 'shots'); os.makedirs(SHOTS, exist_ok=True)
SBJS = os.environ.get('SBJS') or os.path.join(HERE, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js')
SBJS_BODY = open(SBJS, 'rb').read()
UID = '11111111-2222-3333-4444-555555555555'
REF = 'fakeproj'; URL = f'https://{REF}.supabase.co'
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
EXP = int(time.time()) + 86400
JWT = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'exp': EXP, 'role': 'authenticated', 'aud': 'authenticated'}) + '.sig'
USER = {'id': UID, 'email': 'test@example.com', 'aud': 'authenticated', 'role': 'authenticated', 'app_metadata': {}, 'user_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}
SESSION = {'access_token': JWT, 'token_type': 'bearer', 'expires_in': 86400, 'expires_at': EXP, 'refresh_token': 'r', 'user': USER}
AGENDA = """(() => { try {
  localStorage.setItem('stayclean-agenda-v1', JSON.stringify({ settings: { sync: { url: '%s', anonKey: '%s' } }, cpt: { profil: { prenom: 'Mohamed' } } }));
  localStorage.setItem('sb-%s-auth-token', JSON.stringify(%s));
} catch (e) {} })();""" % (URL, 'anon-' + 'x' * 60, REF, json.dumps(SESSION))
def day(d): return "window.__SP_TODAY = '%s';" % d

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond))); print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

class Fake:
    def __init__(self):
        self.rows = {}; self.clock = 0; self.hits = 0; self.posts = []
    def now(self):
        self.clock += 1; return (datetime.datetime(2026, 11, 23, 12) + datetime.timedelta(milliseconds=self.clock)).isoformat() + 'Z'
    def put(self, kind, id_, data, deleted=False):
        self.rows[(UID, kind, id_)] = {'user_id': UID, 'kind': kind, 'id': id_, 'data': data, 'deleted': deleted, 'updated_at': self.now()}
    def handle(self, route):
        self.hits += 1
        req = route.request
        cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*', 'content-type': 'application/json'}
        if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors, body='')
        u = urllib.parse.urlparse(req.url); qs = urllib.parse.parse_qs(u.query)
        if u.path.startswith('/auth/v1/user'): return route.fulfill(status=200, headers=cors, body=json.dumps(USER))
        if u.path.startswith('/auth/v1/token'): return route.fulfill(status=200, headers=cors, body=json.dumps(SESSION))
        if u.path.startswith('/rest/v1/cal_items'):
            if req.method == 'GET':
                out = [r for r in self.rows.values() if r['user_id'] == UID]
                for f in ('kind', 'id'):
                    v = qs.get(f)
                    if v: out = [r for r in out if r[f] == v[0][3:]]
                assert qs.get('user_id') == ['eq.' + UID], qs
                return route.fulfill(status=200, headers=cors, body=json.dumps([{k: r[k] for k in ('kind', 'id', 'data', 'deleted', 'updated_at')} for r in out]))
            if req.method == 'POST':
                body = json.loads(req.post_data or '[]'); body = body if isinstance(body, list) else [body]
                for r in body:
                    assert r['user_id'] == UID and r['kind'] in ('meals', 'weights', 'settings'), r
                    self.put(r['kind'], r['id'], r['data'], r.get('deleted', False)); self.posts.append((r['kind'], r['id']))
                return route.fulfill(status=201, headers=cors, body='')
        return route.fulfill(status=404, headers=cors, body='{}')
    def data(self, kind, id_):
        r = self.rows.get((UID, kind, id_)); return r and r['data']

def env(p, init=(), fake=None, block_net=False):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='fr-BE', timezone_id='Europe/Brussels')
    errs = []; net = []
    for s in init: ctx.add_init_script(s)
    ctx.route(re.compile(r'https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2\.117\.1/dist/umd/supabase\.js'),
              lambda r: r.fulfill(status=200, body=SBJS_BODY, headers={'content-type': 'application/javascript', 'access-control-allow-origin': '*'}))
    def sb(route):
        net.append(route.request.url)
        if fake: return fake.handle(route)
        return route.abort()
    ctx.route(re.compile(r'https://[a-z0-9]+\.supabase\.co/.*'), sb)
    ctx.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), lambda r: r.abort())
    pg = ctx.new_page()
    pg.on('dialog', lambda d: d.accept())
    pg.on('response', lambda r: errs.append('404:' + r.url) if r.status == 404 and 'supabase.co' not in r.url else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'fonts' not in m.text and 'ERR_FAILED' not in m.text and 'status of 404' not in m.text else None)
    return b, ctx, pg, errs, net

def shot(pg, name, full=False): pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=full)
def txt(pg, sel): return pg.locator(sel).text_content() if pg.locator(sel).count() else ''   # texte réel (sans majuscules CSS)
def S(pg): return pg.evaluate('() => JSON.parse(JSON.stringify(window.__SP.S))')

with sync_playwright() as p:
    # ---------- 1. L'ami : lien ?ami=1, pas d'agenda, pas de compte ----------
    b, ctx, pg, errs, net = env(p, init=[day('2026-11-24')])
    pg.goto(BASE + 'sport.html?ami=1'); pg.wait_for_timeout(800)
    check('ami : le profil s’ouvre d’abord', pg.locator('[data-form="profile"]').count() == 1)
    check('ami : aucun lien vers l’agenda ni vers Mes Calories', pg.locator('[data-act="go-agenda"]').count() == 0 and pg.locator('a[href="calories.html"]').count() == 0)
    shot(pg, '01-ami-profil')
    f = pg.locator('[data-form="profile"]')
    f.locator('[name=name]').fill('Yassine'); f.locator('[name=startKg]').fill('114'); f.locator('[name=goalKg]').fill('95')
    f.locator('[name=heightCm]').fill('182'); f.locator('[name=age]').fill('27'); f.locator('[name=startDate]').fill('2026-11-24')
    f.locator('button[type=submit]').click(); pg.wait_for_timeout(400)
    hero = txt(pg, '#tab-today .hero')
    check('ami : séance du jour J1 et bouton « Je m’entraîne »', 'J1' in hero and 'Je m’entraîne aujourd’hui' in hero, hero[:120])
    shot(pg, '02-ami-aujourdhui', full=True)
    pg.click('[data-act="start"]'); pg.wait_for_timeout(400)
    check('séance ouverte : semaine 1 → une série de moins (5 × 5–6 devient 4)', '4' in pg.locator('.ex').first.locator('.dose').inner_text() and pg.locator('.ex').first.locator('.dot').count() == 4,
          pg.locator('.ex').first.locator('.dose').inner_text())
    pg.locator('.ex').first.locator('input[data-kg]').fill('22,5')
    pg.locator('.ex').first.locator('.dot').nth(0).click(); pg.wait_for_timeout(300)
    check('minuteur de repos lancé après une série (2 min 30)', pg.locator('#timer').is_visible() and '2:2' in txt(pg, '#timer') or '2:3' in txt(pg, '#timer'), txt(pg, '#timer'))
    for k in range(1, 4): pg.locator('.ex').first.locator('.dot').nth(k).click(); pg.wait_for_timeout(80)
    check('exercice complet : 4 séries cochées', pg.locator('.ex').first.locator('.dot.on').count() == 4)
    shot(pg, '03-ami-seance')
    pg.reload(); pg.wait_for_timeout(600)
    check('séance en cours retrouvée après fermeture (Reprendre)', 'Reprendre' in txt(pg, '#tab-today .hero'))
    pg.click('[data-act="resume"]'); pg.wait_for_timeout(300)
    check('… avec ses séries et sa charge', pg.locator('.ex').first.locator('.dot.on').count() == 4 and pg.locator('.ex').first.locator('input[data-kg]').input_value() == '22,5')
    pg.click('[data-act="finish"]'); pg.wait_for_timeout(500)
    check('séance terminée : « ✓ J1 faite », demain J2', '✓ J1 faite' in txt(pg, '#tab-today .hero') and 'J2' in txt(pg, '#tab-today .hero'), txt(pg, '#tab-today .hero')[:100])
    # jour suivant : J2 ; puis on saute un jour, la rotation continue
    ctx.add_init_script(day('2026-11-25')); pg.goto(BASE + 'sport.html?ami=1'); pg.wait_for_timeout(500)
    check('lendemain : J2 proposée', 'J2' in txt(pg, '#tab-today .hero') and 'Je m’entraîne' in txt(pg, '#tab-today .hero'))
    pg.click('[data-act="start"]'); pg.wait_for_timeout(200); pg.click('[data-act="finish"]'); pg.wait_for_timeout(300)
    ctx.add_init_script(day('2026-11-28')); pg.goto(BASE + 'sport.html?ami=1'); pg.wait_for_timeout(500)
    check('trois jours sans séance : on reprend où on s’était arrêté (J3)', 'J3' in txt(pg, '#tab-today .hero'), txt(pg, '#tab-today .hero')[:60])
    # J1 retient la charge : on refait un cycle complet par l'état, puis on vérifie « La dernière fois »
    pg.evaluate("""() => { const S = window.__SP.S; const add = (d, sid) => { S.log['t-' + d] = { id: 't-' + d, date: d, sid, done: true, at: Date.parse(d) }; };
      add('2026-11-28', 'J3'); add('2026-11-29', 'J4'); add('2026-11-30', 'J5'); add('2026-12-01', 'J6');
      localStorage.setItem('sp.state.v1', JSON.stringify(S)); }""")
    ctx.add_init_script(day('2026-12-02')); pg.goto(BASE + 'sport.html?ami=1'); pg.wait_for_timeout(500)
    check('après J6 : repos le lendemain', 'Repos' in txt(pg, '#tab-today .hero'))
    shot(pg, '04-ami-repos')
    ctx.add_init_script(day('2026-12-03')); pg.goto(BASE + 'sport.html'); pg.wait_for_timeout(500)   # icône de l'écran d'accueil (sans ?ami)
    check('icône d’accueil sans « ?ami=1 » : tout est là, on repart sur J1', 'J1' in txt(pg, '#tab-today .hero') and 'Yassine' in txt(pg, '#top'), txt(pg, '#tab-today .hero')[:60])
    pg.click('[data-act="start"]'); pg.wait_for_timeout(300)
    check('J1 : « La dernière fois : 22,5 kg » au développé incliné', 'La dernière fois : 22,5 kg' in pg.locator('.ex').first.inner_text())
    pg.click('[data-act="close"]'); pg.wait_for_timeout(200)
    pg.click('.nav__tab[data-tab="weight"]'); pg.wait_for_timeout(200)
    pg.fill('#wIn', '112,8'); pg.click('[data-act="save-w"]'); pg.wait_for_timeout(300)
    check('pesée enregistrée et courbe affichée', '112,8' in txt(pg, '#tab-weight') and pg.locator('svg.chart').count() == 1)
    shot(pg, '05-ami-poids', full=True)
    pg.click('.nav__tab[data-tab="food"]'); pg.wait_for_timeout(200)
    check('assiette : cible calculée pour son profil et menu fixe', 'kcal par jour' in txt(pg, '#tab-food') and 'Le bol' in txt(pg, '#tab-food'))
    shot(pg, '06-ami-assiette', full=True)
    pg.click('.nav__tab[data-tab="plan"]'); pg.wait_for_timeout(200); shot(pg, '07-programme', full=True)
    check('ami : aucune requête vers un serveur Supabase', not net, net[:3])
    check('ami : aucune lecture de l’agenda (pas de résumé écrit pour la carte)', pg.evaluate("() => localStorage.getItem('sp.summary.v1')") is None)
    check('ami : aucune erreur JavaScript', not errs, errs)
    b.close()

    # ---------- 2. Mohamed, depuis l'agenda : compte relié ----------
    fake = Fake()
    fake.put('weights', 'w-2026-11-20', {'id': 'w-2026-11-20', 'date': '2026-11-20', 'kg': 106.4, 'at': '2026-11-20T07:00:00Z'})
    fake.put('settings', 'main', {'target': 2000, 'startKg': 104, 'goalKg': 87})
    b, ctx, pg, errs, net = env(p, init=[AGENDA, day('2026-11-23'), "sessionStorage.setItem('sp.from','agenda');"], fake=fake)
    pg.goto(BASE + 'sport.html'); pg.wait_for_timeout(1500)
    check('compte : pas de profil à créer (programme de Mohamed, 106 kg)', pg.locator('[data-form="profile"]').count() == 0 and 'Mohamed' in txt(pg, '#top'))
    check('compte : « Synchronisé avec ton compte » et flèche vers l’agenda', 'Synchronisé' in txt(pg, '#top') and pg.locator('[data-act="go-agenda"]').count() == 1, txt(pg, '#top'))
    shot(pg, '10-compte-aujourdhui', full=True)
    pg.click('.nav__tab[data-tab="weight"]'); pg.wait_for_timeout(200)
    check('pesée de Mes Calories retrouvée (106,4 kg)', '106,4' in txt(pg, '#tab-weight'))
    pg.fill('#wIn', '105,9'); pg.click('[data-act="save-w"]'); pg.wait_for_timeout(1800)
    check('pesée envoyée dans cal_items (kind weights, même format que Mes Calories)', (fake.data('weights', 'w-2026-11-23') or {}).get('kg') == 105.9, fake.data('weights', 'w-2026-11-23'))
    pg.click('.nav__tab[data-tab="today"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="start"]'); pg.wait_for_timeout(300)
    pg.locator('.ex').first.locator('input[data-kg]').fill('24')
    pg.locator('.ex').first.locator('.dot').nth(0).click(); pg.click('[data-act="finish"]'); pg.wait_for_timeout(1800)
    doc = fake.data('settings', 'sport') or {}
    check('séance envoyée dans settings/sport (J1 faite, charge 24 kg)', any(e.get('sid') == 'J1' and e.get('done') for e in (doc.get('log') or {}).values()) and (doc.get('loads') or {}).get('J1:0', {}).get('kg') == 24, list((doc.get('log') or {}).values())[:1])
    check('settings/main de Mes Calories intact', fake.data('settings', 'main') == {'target': 2000, 'startKg': 104, 'goalKg': 87})
    pg.click('[data-act="go-agenda"]'); pg.wait_for_timeout(300)
    check('aucune erreur JavaScript (compte)', not errs, errs)
    b.close()
    # 2e appareil (Mac) : retrouve la séance et les pesées
    b, ctx, pg, errs, net = env(p, init=[AGENDA, day('2026-11-24')], fake=fake)
    pg.goto(BASE + 'sport.html'); pg.wait_for_timeout(1500)
    check('2e appareil : J1 faite hier → J2 proposée aujourd’hui', 'J2' in txt(pg, '#tab-today .hero'), txt(pg, '#tab-today .hero')[:80])
    pg.click('.nav__tab[data-tab="weight"]'); pg.wait_for_timeout(200)
    check('2e appareil : pesée du 23 retrouvée', '105,9' in txt(pg, '#tab-weight'))
    check('aucune erreur JavaScript (2e appareil)', not errs, errs)
    b.close()

    # ---------- 3. L'accueil de l'agenda ----------
    b, ctx, pg, errs, net = env(p)
    pg.goto(BASE + 'index.html'); pg.wait_for_timeout(2500)
    cards = pg.evaluate("() => [...document.querySelectorAll('.pcard .tt')].map(x => x.textContent)")
    check('accueil : MON PROGRAMME à la place de MES CALORIES', cards == ['STAYCLEAN', 'COMPTA', 'MA PAPERASSE', 'MON PROGRAMME', 'MON CORAN'], cards)
    shot(pg, '20-agenda-accueil')
    pg.click('.pcard.sp'); pg.wait_for_url('**/sport.html', timeout=10000); pg.wait_for_timeout(800)
    check('la carte ouvre Mon Programme, avec la flèche retour', pg.locator('[data-act="go-agenda"]').count() == 1)
    if pg.locator('[data-form="profile"]').count():
        f = pg.locator('[data-form="profile"]'); f.locator('[name=name]').fill('Mohamed'); f.locator('[name=startKg]').fill('106'); f.locator('[name=goalKg]').fill('87')
        f.locator('[name=heightCm]').fill('184'); f.locator('[name=age]').fill('24'); f.locator('button[type=submit]').click(); pg.wait_for_timeout(300)
    pg.click('[data-act="go-agenda"]'); pg.wait_for_timeout(2000)
    pill = pg.evaluate("() => { const c = document.querySelector('.pcard.sp .pst'); return c ? c.textContent : null }")
    check('retour à l’agenda : la carte affiche la prochaine séance', pill and 'J1' in pill, pill)
    shot(pg, '21-agenda-carte')
    check('agenda : aucune erreur JavaScript', not [x for x in errs if x.startswith('pageerror')], errs)
    b.close()

bad = [n for n, ok in checks if not ok]
print('\n%d/%d OK' % (len(checks) - len(bad), len(checks)))
if bad: print('ÉCHECS :', bad); raise SystemExit(1)
