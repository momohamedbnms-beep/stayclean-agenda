"""Mon Programme v2 (sport.html, « Le Camp » : le coach) — banc d'essai Playwright. Données fictives, faux Supabase en mémoire.
1. Lien ami (?ami=Isaac, téléphone sans agenda) : prénom prérempli, tableau des 6, « Déjà faite hier » barre J1 (croix rouge),
   GO sur J2 → coach série par série → fin → J2 barrée ; aucune requête serveur ; l'icône sans « ?ami » retrouve tout.
2. Coach : charge proposée (+ le pas si « facile » la dernière fois), ressenti enregistré, record, minuteur.
3. Semaine bouclée (6/6) puis tableau neuf ; le jour de la semaine ne compte pas.
4. Ancien format (v1, charges « J1:0 ») migré.
5. Depuis l'agenda (compte) : pesées partagées avec Mes Calories, programme dans settings/sport, 2e appareil, settings/main intact.
6. Accueil de l'agenda : carte MON PROGRAMME, aller-retour, résumé.
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
QUIET = "(() => { try { const s = JSON.parse(localStorage.getItem('sp.state.v1') || 'null'); if (!s) localStorage.setItem('sp.state.v1', JSON.stringify({ prefs: { voice: false } })); } catch (e) {} })();"
def day(d): return "window.__SP_TODAY = '%s';" % d

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond))); print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

class Fake:
    def __init__(self): self.rows = {}; self.clock = 0
    def now(self):
        self.clock += 1; return (datetime.datetime(2026, 11, 23, 12) + datetime.timedelta(milliseconds=self.clock)).isoformat() + 'Z'
    def put(self, kind, id_, data, deleted=False):
        self.rows[(UID, kind, id_)] = {'user_id': UID, 'kind': kind, 'id': id_, 'data': data, 'deleted': deleted, 'updated_at': self.now()}
    def handle(self, route):
        req = route.request
        cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*', 'content-type': 'application/json'}
        if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors, body='')
        u = urllib.parse.urlparse(req.url); qs = urllib.parse.parse_qs(u.query)
        if u.path.startswith('/auth/v1/user'): return route.fulfill(status=200, headers=cors, body=json.dumps(USER))
        if u.path.startswith('/auth/v1/token'): return route.fulfill(status=200, headers=cors, body=json.dumps(SESSION))
        if u.path.startswith('/rest/v1/cal_items'):
            if req.method == 'GET':
                assert qs.get('user_id') == ['eq.' + UID], qs
                out = [r for r in self.rows.values() if r['user_id'] == UID]
                for f in ('kind', 'id'):
                    v = qs.get(f)
                    if v: out = [r for r in out if r[f] == v[0][3:]]
                return route.fulfill(status=200, headers=cors, body=json.dumps([{k: r[k] for k in ('kind', 'id', 'data', 'deleted', 'updated_at')} for r in out]))
            if req.method == 'POST':
                body = json.loads(req.post_data or '[]'); body = body if isinstance(body, list) else [body]
                for r in body:
                    assert r['user_id'] == UID and r['kind'] in ('meals', 'weights', 'settings'), r
                    self.put(r['kind'], r['id'], r['data'], r.get('deleted', False))
                return route.fulfill(status=201, headers=cors, body='')
        return route.fulfill(status=404, headers=cors, body='{}')
    def data(self, kind, id_):
        r = self.rows.get((UID, kind, id_)); return r and r['data']

def env(p, init=(), fake=None):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='fr-BE', timezone_id='Europe/Brussels')
    errs = []; net = []
    for s in (QUIET,) + tuple(init): ctx.add_init_script(s)
    ctx.route(re.compile(r'https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2\.117\.1/dist/umd/supabase\.js'),
              lambda r: r.fulfill(status=200, body=SBJS_BODY, headers={'content-type': 'application/javascript', 'access-control-allow-origin': '*'}))
    def sb(route):
        net.append(route.request.url)
        return fake.handle(route) if fake else route.abort()
    ctx.route(re.compile(r'https://[a-z0-9]+\.supabase\.co/.*'), sb)
    pg = ctx.new_page()
    pg.on('dialog', lambda d: d.accept())
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'status of 404' not in m.text and 'ERR_FAILED' not in m.text else None)
    return b, ctx, pg, errs, net

def shot(pg, name, full=False): pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=full)
def txt(pg, sel): return pg.locator(sel).first.text_content() if pg.locator(sel).count() else ''
def st(pg): return pg.evaluate("() => window.__SP.curStep().t")
def run_session(pg, feel='ok'):
    """Fait toute la séance : FAIT sur les séries, ressenti, saute les minuteurs."""
    for _ in range(400):
        if pg.locator('.endv').count(): return True
        t = st(pg)
        if t == 'set': pg.click('[data-act=p-done]')
        elif t == 'feel': pg.click(f'[data-act=feel][data-v={feel}]')
        elif t == 'hold': pg.click('[data-act=p-hold]'); pg.wait_for_timeout(1100); pg.click('[data-act=p-stop]')
        else: pg.click('[data-act=p-skip]')
        pg.wait_for_timeout(40)
    return False
def tiles(pg): return str(pg.evaluate("() => [...document.querySelectorAll('.tile')].map(t => (t.className.includes('done') ? 'X' : (t.className.includes('next') ? '>' : '.')))"))

with sync_playwright() as p:
    # ---------- 1. Isaac : lien ami, pas d'agenda, pas de compte ----------
    b, ctx, pg, errs, net = env(p, init=[day('2026-11-23')])
    pg.goto(BASE + 'sport.html?ami=Isaac'); pg.wait_for_timeout(800)
    check('ami : profil d’abord, prénom Isaac prérempli', pg.locator('[data-form=profile] [name=name]').input_value() == 'Isaac')
    check('ami : aucun lien vers l’agenda, Mes Calories ni partage', pg.locator('[data-act=go-agenda]').count() == 0 and pg.locator('a[href="calories.html"]').count() == 0 and pg.locator('[data-act=share]').count() == 0)
    f = pg.locator('[data-form=profile]')
    f.locator('[name=startKg]').fill('114'); f.locator('[name=goalKg]').fill('95'); f.locator('[name=heightCm]').fill('182'); f.locator('[name=age]').fill('27')
    f.locator('button[type=submit]').click(); pg.wait_for_timeout(500)
    check('tableau : 6 séances, J1 en GO', pg.locator('.tile').count() == 6 and txt(pg, '.tile.next .tn') == '1', tiles(pg))
    shot(pg, '01-ami-tableau', True)
    pg.click('.tile >> nth=0'); pg.wait_for_timeout(300)
    check('aperçu J1 : la liste des exos et « Déjà faite ? »', pg.locator('.sheet .row').count() >= 8 and pg.locator('[data-act=mark]').count() == 2)
    shot(pg, '02-apercu-j1')
    pg.click('[data-act=mark][data-d="2026-11-22"]'); pg.wait_for_timeout(600)
    check('« Déjà faite hier » : J1 barrée d’une croix rouge, J2 en GO, 1/6', pg.locator('.tile.done .cross').count() == 1 and txt(pg, '.tile.next .tn') == '2' and txt(pg, '.cnt').startswith('1'), tiles(pg))
    check('… avec « ✓ hier » sur la case', '✓ hier' in txt(pg, '.tile.done'))
    shot(pg, '03-j1-barree', True)
    pg.click('.cta[data-act=go]'); pg.wait_for_timeout(400)
    check('GO J2 : le coach s’ouvre sur l’échauffement', pg.locator('#player').is_visible() and st(pg) == 'steady' and 'ÉCHAUFFEMENT' in txt(pg, '.pmeta'))
    pg.click('[data-act=p-skip]'); pg.wait_for_timeout(250)
    check('1re série : RAMEUR 250 m, SÉRIE 1/5 (semaine 1 : une série de moins), EXPLOSIF', '250 m' in txt(pg, '.big') and '1/5' in txt(pg, '.setn').replace(' ', '') and 'EXPLOSIF' in txt(pg, '.badges'), txt(pg, '.setn'))
    shot(pg, '04-coach-serie')
    pg.click('[data-act=p-done]'); pg.wait_for_timeout(300)
    check('après la série : REPOS ≈ 1:30 avec la suite affichée', st(pg) == 'rest' and txt(pg, '#pt-big') in ('1:30', '1:29') and 'Série 2/5' in txt(pg, '.nextc'), txt(pg, '#pt-big'))
    shot(pg, '05-coach-repos')
    pg.reload(); pg.wait_for_timeout(600)
    check('appli fermée pendant la séance : « REPRENDRE · J2 »', 'REPRENDRE' in txt(pg, '.cta'))
    pg.click('[data-act=resume]'); pg.wait_for_timeout(300)
    check('… on reprend au même endroit (repos du rameur)', st(pg) == 'rest')
    ok = run_session(pg)
    check('séance menée jusqu’au bout : écran « J2 BOUCLÉE »', ok and 'J2 BOUCLÉE' in txt(pg, '.endv h1'))
    shot(pg, '06-coach-fin')
    pg.click('[data-act=p-close]'); pg.wait_for_timeout(400)
    check('retour : J1 et J2 barrées, J3 en GO, 2/6', pg.locator('.tile.done').count() == 2 and txt(pg, '.tile.next .tn') == '3' and txt(pg, '.cnt').startswith('2'), tiles(pg))
    pg.click('.nav__tab[data-tab=weight]'); pg.wait_for_timeout(200)
    for _ in range(4): pg.click('[data-act="w-"]')
    pg.click('[data-act=save-w]'); pg.wait_for_timeout(300)
    check('poids d’Isaac : 114 − 0,4 = 113,6 enregistré sur son téléphone', '113,6' in txt(pg, '.wl-list'))
    shot(pg, '07-ami-poids', True)
    pg.click('.nav__tab[data-tab=food]'); pg.wait_for_timeout(200); shot(pg, '08-ami-assiette', True)
    check('assiette : 3 repas illustrés', pg.locator('.meal svg').count() >= 3)
    ctx.add_init_script(day('2026-11-24')); pg.goto(BASE + 'sport.html'); pg.wait_for_timeout(500)   # icône d'accueil, sans ?ami
    check('icône sans « ?ami » le lendemain : tout est là (2/6, J3 en GO)', 'Isaac' in txt(pg, '#top') and pg.locator('.tile.done').count() == 2 and txt(pg, '.tile.next .tn') == '3')
    check('ami : aucune requête vers un serveur', not net, net[:2])
    check('ami : rien écrit pour la carte de l’agenda', pg.evaluate("() => localStorage.getItem('sp.summary.v1')") is None)
    check('ami : aucune erreur JavaScript', not errs, errs)
    b.close()

    # ---------- 2. Charges, ressenti, records ; 3. semaine bouclée ; 4. migration v1 ----------
    V1 = {'v': 1, 'profile': {'name': 'Mohamed', 'startKg': 106, 'goalKg': 87, 'startDate': '2026-11-23', 'heightCm': 184, 'age': 24}, 'profileAt': 1,
          'log': {}, 'loads': {'J1:0': {'kg': 20, 'at': 1}}, 'weights': {}, 'dirtyW': {}, 'dirtyDoc': False, 'active': None, 'prefs': {'voice': False}}
    b, ctx, pg, errs, net = env(p, init=["if (!sessionStorage.getItem('seeded')) { localStorage.setItem('sp.state.v1', %s); sessionStorage.setItem('seeded', '1'); }" % json.dumps(json.dumps(V1)), day('2026-12-14')])
    pg.goto(BASE + 'sport.html?ami=1'); pg.wait_for_timeout(500)
    check('migration v1 : la charge « J1:0 » devient « J1:incline »', pg.evaluate("() => window.__SP.S.loads['J1:incline'] && window.__SP.S.loads['J1:incline'].kg") == 20)
    pg.click('.cta[data-act=go]'); pg.wait_for_timeout(300); pg.click('[data-act=p-skip]'); pg.wait_for_timeout(200)
    check('semaine 4 : développé incliné 5 séries, 20 kg proposés', '1/5' in txt(pg, '.setn').replace(' ', '') and txt(pg, '.kg b') == '20', txt(pg, '.kg b'))
    pg.click('[data-act="kg+"]'); pg.wait_for_timeout(100)
    check('« + » ajoute 2 kg (haltères)', txt(pg, '.kg b') == '22')
    ok = run_session(pg, feel='facile')
    check('fin : record 🏆 développé incliné 22 kg', ok and 'Développé incliné 22 kg' in txt(pg, '.recs'), txt(pg, '.recs'))
    pg.click('[data-act=p-close]'); pg.wait_for_timeout(200)
    pg.evaluate("""() => { const S = window.__SP.S; ['J2','J3','J4','J5','J6'].forEach((sid, i) => { const d = ['2026-12-15','2026-12-16','2026-12-18','2026-12-19','2026-12-21'][i];
      S.log['t' + i] = { id: 't' + i, date: d, sid, done: true, at: Date.parse(d) }; }); localStorage.setItem('sp.state.v1', JSON.stringify(S)); }""")
    ctx.add_init_script(day('2026-12-21')); pg.goto(BASE + 'sport.html?ami=1'); pg.wait_for_timeout(400)
    check('6/6 le jour même : « Semaine bouclée », tout barré', pg.locator('.tile.done').count() == 6 and 'Semaine bouclée' in txt(pg, '.bravo'))
    shot(pg, '10-semaine-bouclee', True)
    ctx.add_init_script(day('2026-12-23')); pg.goto(BASE + 'sport.html?ami=1'); pg.wait_for_timeout(400)
    check('2 jours plus tard (repos pris quand il veut) : tableau neuf, J1 en GO, 0/6', pg.locator('.tile.done').count() == 0 and txt(pg, '.tile.next .tn') == '1' and txt(pg, '.cnt').startswith('0'))
    pg.click('.cta[data-act=go]'); pg.wait_for_timeout(300); pg.click('[data-act=p-skip]'); pg.wait_for_timeout(200)
    check('« facile » la dernière fois → 24 kg proposés (+2) et le message ▲', txt(pg, '.kg b') == '24' and '▲' in txt(pg, '.pm'), txt(pg, '.kg b'))
    shot(pg, '11-charge-montee')
    check('aucune erreur JavaScript (charges, semaine)', not errs, errs)
    b.close()

    # ---------- 5. Mohamed, depuis l'agenda ----------
    fake = Fake()
    fake.put('weights', 'w-2026-11-20', {'id': 'w-2026-11-20', 'date': '2026-11-20', 'kg': 106.4, 'at': '2026-11-20T07:00:00Z'})
    fake.put('settings', 'main', {'target': 2000, 'startKg': 104, 'goalKg': 87})
    b, ctx, pg, errs, net = env(p, init=[AGENDA, day('2026-11-23'), "sessionStorage.setItem('sp.from','agenda');"], fake=fake)
    pg.goto(BASE + 'sport.html'); pg.wait_for_timeout(1500)
    check('compte : programme de Mohamed sans profil à créer, point vert « synchronisé »', pg.locator('[data-form=profile]').count() == 0 and 'Mohamed' in txt(pg, '#top') and pg.locator('.dot-sync.sync').count() == 1)
    check('compte : flèche retour vers l’agenda', pg.locator('[data-act=go-agenda]').count() == 1)
    shot(pg, '20-compte-tableau', True)
    pg.click('.tile >> nth=0'); pg.wait_for_timeout(200); pg.click('[data-act=mark][data-d="2026-11-22"]'); pg.wait_for_timeout(1800)
    doc = fake.data('settings', 'sport') or {}
    check('J1 barrée « hier » envoyée dans settings/sport', any(e.get('sid') == 'J1' and e.get('manual') and e.get('date') == '2026-11-22' for e in (doc.get('log') or {}).values()))
    pg.click('.nav__tab[data-tab=weight]'); pg.wait_for_timeout(200)
    check('pesée de Mes Calories retrouvée (106,4)', '106,4' in txt(pg, '.wl-list'))
    for _ in range(5): pg.click('[data-act="w-"]')
    pg.click('[data-act=save-w]'); pg.wait_for_timeout(1800)
    check('pesée envoyée (kind weights, même format que Mes Calories)', (fake.data('weights', 'w-2026-11-23') or {}).get('kg') == 105.9, fake.data('weights', 'w-2026-11-23'))
    check('settings/main de Mes Calories intact', fake.data('settings', 'main') == {'target': 2000, 'startKg': 104, 'goalKg': 87})
    pg.click('[data-act=profile]'); pg.wait_for_timeout(200)
    check('profil : « Envoyer le programme à un ami »', pg.locator('[data-act=share]').count() == 1)
    check('aucune erreur JavaScript (compte)', not errs, errs)
    b.close()
    b, ctx, pg, errs, net = env(p, init=[AGENDA, day('2026-11-24')], fake=fake)
    pg.goto(BASE + 'sport.html'); pg.wait_for_timeout(1500)
    check('2e appareil : J1 barrée, J2 en GO, pesée du 23 retrouvée', pg.locator('.tile.done').count() == 1 and txt(pg, '.tile.next .tn') == '2' and pg.evaluate("() => window.__SP.S.weights['2026-11-23'].kg") == 105.9)
    check('aucune erreur JavaScript (2e appareil)', not errs, errs)
    b.close()

    # ---------- 6. Accueil de l'agenda ----------
    b, ctx, pg, errs, net = env(p)
    pg.goto(BASE + 'index.html'); pg.wait_for_timeout(2500)
    cards = pg.evaluate("() => [...document.querySelectorAll('.pcard .tt')].map(x => x.textContent)")
    check('accueil : MON PROGRAMME à la place de MES CALORIES', cards == ['STAYCLEAN', 'COMPTA', 'MA PAPERASSE', 'MON PROGRAMME', 'MON CORAN'], cards)
    pg.click('.pcard.sp'); pg.wait_for_url('**/sport.html', timeout=10000); pg.wait_for_timeout(800)
    if pg.locator('[data-form=profile]').count():
        f = pg.locator('[data-form=profile]'); f.locator('[name=name]').fill('Mohamed'); f.locator('[name=startKg]').fill('106'); f.locator('[name=goalKg]').fill('87')
        f.locator('[name=heightCm]').fill('184'); f.locator('[name=age]').fill('24'); f.locator('button[type=submit]').click(); pg.wait_for_timeout(300)
    check('la carte ouvre Mon Programme, flèche retour', pg.locator('[data-act=go-agenda]').count() == 1)
    pg.click('[data-act=go-agenda]'); pg.wait_for_timeout(2000)
    pill = pg.evaluate("() => { const c = document.querySelector('.pcard.sp .pst'); return c ? c.textContent : null }")
    check('retour à l’agenda : la carte montre 0/6 et la prochaine séance', pill and '0/6' in pill and 'J1' in pill, pill)
    check('agenda : aucune erreur JavaScript', not [x for x in errs if x.startswith('pageerror')], errs)
    b.close()

bad = [n for n, ok in checks if not ok]
print('\n%d/%d OK' % (len(checks) - len(bad), len(checks)))
if bad: print('ÉCHECS :', bad); raise SystemExit(1)
