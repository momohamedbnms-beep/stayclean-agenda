"""Sauvegarde sur le compte avec un FAUX serveur Supabase (en mémoire, dans ce script), plusieurs appareils :
1. table absente → bandeau « reste sur cet appareil » et activation guidée (copier le code, ouvrir Supabase, vérifier) ;
2. table installée → envoi, puis un 2e appareil retrouve la progression ;
3. téléphone et Mac qui ont avancé chacun de leur côté (arabe : étapes, examens ; Coran : statuts, séance guidée)
   → tout est fusionné, rien n'est perdu, même quand les deux envoient en même temps ;
4. appareil sans agenda ni session → « Me connecter » dans Mon Coran (mauvais mot de passe, puis le bon) ;
5. installation ancienne (natures de l'arabe refusées) → le reste part, bandeau « Mettre à jour », puis tout part."""
from qa import *
import sys, json, base64, time, urllib.parse, datetime

# supabase-js réel, servi en local (npm install @supabase/supabase-js@2.117.1 dans tests/coran, ou SBJS=chemin)
SBJS = os.environ.get('SBJS') or os.path.join(QA, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js')
SBJS_BODY = open(SBJS, 'rb').read()
UID = '11111111-2222-3333-4444-555555555555'
REF = 'fakeproj'
URL = f'https://{REF}.supabase.co'
OFFICIAL_REF = 'rgfanwbyzsfjlhwwhudg'   # projet par défaut de l'appli (aucun appel réel : il est redirigé vers le faux serveur)

def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
EXP = int(time.time()) + 3600 * 24
JWT = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': UID, 'exp': EXP, 'role': 'authenticated', 'aud': 'authenticated'}) + '.sig'
USER = {'id': UID, 'email': 'test@example.com', 'aud': 'authenticated', 'role': 'authenticated', 'app_metadata': {}, 'user_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}
SESSION = {'access_token': JWT, 'token_type': 'bearer', 'expires_in': 86400, 'expires_at': EXP, 'refresh_token': 'fake-refresh', 'user': USER}
INIT = """(() => { try {
  localStorage.setItem('stayclean-agenda-v1', JSON.stringify({ settings: { sync: { url: '%s', anonKey: '%s' } } }));
  localStorage.setItem('sb-%s-auth-token', JSON.stringify(%s));
} catch (e) {} })();""" % (URL, 'anon-' + 'x' * 60, REF, json.dumps(SESSION))
CHECK_VIOLATION = {'code': '23514', 'details': None, 'hint': None, 'message': 'new row for relation "qr_items" violates check constraint "qr_items_kind_check"'}

class Fake:
    def __init__(self):
        self.installed = False
        self.kinds = None           # natures acceptées (None = toutes) : installation ancienne si limité
        self.rows = {}
        self.posts = 0
        self.clock = 0
        self.logins = []
    def now(self):
        self.clock += 1
        return (datetime.datetime(2026, 10, 27, 12, 0, 0) + datetime.timedelta(milliseconds=self.clock)).isoformat() + 'Z'
    def handle(self, route):
        req = route.request
        cors = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*', 'content-type': 'application/json'}
        if req.method == 'OPTIONS': return route.fulfill(status=204, headers=cors, body='')
        u = urllib.parse.urlparse(req.url); qs = urllib.parse.parse_qs(u.query)
        if u.path.startswith('/auth/v1/user'): return route.fulfill(status=200, headers=cors, body=json.dumps(USER))
        if u.path.startswith('/auth/v1/token'):
            body = json.loads(req.post_data or '{}')
            if qs.get('grant_type') == ['password']:
                self.logins.append(body.get('email'))
                if body.get('password') != 'bon-mot-de-passe':
                    return route.fulfill(status=400, headers=cors, body=json.dumps({'code': 400, 'error_code': 'invalid_credentials', 'msg': 'Invalid login credentials'}))
            return route.fulfill(status=200, headers=cors, body=json.dumps(SESSION))
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
                if self.kinds is not None and any(r['kind'] not in self.kinds for r in body):
                    return route.fulfill(status=400, headers=cors, body=json.dumps(CHECK_VIOLATION))
                for r in body:
                    assert r['user_id'] == UID
                    self.rows[(r['user_id'], r['kind'], r['id'])] = dict(r, updated_at=self.now())
                self.posts += 1
                return route.fulfill(status=201, headers=cors, body='')
        return route.fulfill(status=404, headers=cors, body='{}')
    def data(self, kind, id_):
        r = self.rows.get((UID, kind, id_)); return r and r['data']

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def norm(s): return (s or '').replace(' ', ' ').replace(' ', ' ')

fake = Fake()
def lib(ctx):
    ctx.route(re.compile(r'https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@2\.117\.1/dist/umd/supabase\.js'),
              lambda r: r.fulfill(status=200, body=SBJS_BODY, headers={'content-type': 'application/javascript', 'access-control-allow-origin': '*'}))
    ctx.route(re.compile(r'https://(fakeproj|%s)\.supabase\.co/.*' % OFFICIAL_REF), fake.handle)
def setup(ctx):       # agenda configuré et connecté sur l'appareil
    ctx.add_init_script(INIT); lib(ctx)
def setup_bare(ctx):  # ni agenda ni session : l'appli utilise le projet officiel (redirigé ici vers le faux serveur)
    lib(ctx)

def sync_text(pg):
    pg.click('.nav__tab[data-tab="progress"]'); pg.wait_for_timeout(400)
    t = pg.locator('#tab-progress .sync-line').inner_text() if pg.locator('#tab-progress .sync-line').count() else ''
    pg.click('.nav__tab[data-tab="learn"]'); pg.wait_for_timeout(200)
    return norm(t)
def state(e): return e.js("() => window.__QR.Sync.state")
def sync(e, ms=1200):
    e.js("() => window.__QR.syncNow()"); e.page.wait_for_timeout(ms)
def ar_units(e, chs):
    return e.js("async (n) => { const A = window.__AR; await A.bank(); return A.B.d.chapters.slice(0, n).flatMap((c) => c.units); }", chs)
def ar_done(e): return e.js("() => Object.keys(window.__AR.st().done || {}).sort()")

with sync_playwright() as p:
    # ---------- 1. Appareil A, table absente : bandeau et activation guidée ----------
    e = Env(p, supabase=setup)
    e.ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE.rstrip('/'))
    pg = e.open(); pg.wait_for_timeout(1500)
    check('table absente → état « not_installed »', state(e) == 'not_installed', state(e))
    t = sync_text(pg)
    check('Mes progrès : « la sauvegarde en ligne n’est pas encore activée »', 'pas encore activée' in t, t)
    ban = norm(pg.locator('#tab-learn .sync-banner').inner_text()) if pg.locator('#tab-learn .sync-banner').count() else ''
    check('Mémoriser : bandeau « Ta progression reste sur cet appareil » avec « L’activer »', 'reste sur cet appareil' in ban and pg.locator('#tab-learn .sync-banner [data-sheet="sync-install"]').count() == 1, ban)
    e.shot('A0-not-installed')
    pg.click('#tab-learn .sync-banner [data-sheet="sync-install"]'); pg.wait_for_timeout(800)
    sheet = norm(pg.locator('#sheets').inner_text())
    check('activation : 4 étapes (copier, ouvrir Supabase, Run, vérifier)', pg.locator('#sheets .inst > li').count() == 4 and 'Run' in sheet and 'C’est fait, vérifier' in sheet, sheet[:200])
    href = pg.locator('#sheets a[href*="supabase.com"]').get_attribute('href')
    check('« Ouvrir Supabase » mène à l’éditeur SQL du bon projet', href == f'https://supabase.com/dashboard/project/{REF}/sql/new', href)
    pg.click('#sheets [data-act="sync-copy-sql"]'); pg.wait_for_timeout(400)
    clip = e.js("() => navigator.clipboard.readText()")
    check('« Copier le code » : le code d’installation est dans le presse-papiers', 'create table if not exists public.qr_items' in clip and 'ar_exam' in clip, clip[:60])
    e.shot('A0b-activation')
    pg.click('#sheets [data-act="sync-check"]'); pg.wait_for_timeout(1500)
    check('vérifier trop tôt : « Pas encore », la feuille reste ouverte', pg.locator('#sheets .inst').count() == 1 and 'Pas encore' in norm(pg.locator('#toasts').inner_text() if pg.locator('#toasts').count() else pg.locator('body').inner_text()))
    # il lance le code dans Supabase
    fake.installed = True
    pg.click('#sheets [data-act="sync-check"]'); pg.wait_for_timeout(2000)
    check('après « Run » : « C’est fait, vérifier » → synchronisé, feuille fermée, bandeau parti', state(e) == 'synced' and pg.locator('#sheets .inst').count() == 0 and pg.locator('#tab-learn .sync-banner').count() == 0, state(e))
    check('compte relié : propriétaire = utilisateur', e.js("() => window.__QR.Store.owner") == UID)
    # « Le vérifier en la récitant » (détail d'Al-Fatiha), puis « Je connais » proposé en fin de séance
    pg.click('#tab-learn .mz-row--fat .mz-row__main'); pg.wait_for_timeout(1200)
    pg.click('.page .self-card [data-page="sura-progress"]'); pg.wait_for_timeout(500)
    pg.click('.page [data-act="known-start"]'); pg.wait_for_timeout(600)
    pg.click('[data-act="recited"]'); pg.wait_for_timeout(200)
    pg.click('.choice[data-r="solo"]'); pg.wait_for_timeout(500)
    pg.click('.sess__acts [data-act="step-continue"]'); pg.wait_for_timeout(400)
    pg.click('.done .mz-offer [data-act="mz-set-sura"][data-s="1"]'); pg.wait_for_timeout(500)
    pg.click('.done .sess__acts [data-act="session-close"]'); pg.wait_for_timeout(2500)
    kinds = sorted(set(k[1] for k in fake.rows))
    check('envoyé sur le compte : prefs, attempt, progress, review', all(k in kinds for k in ('prefs', 'attempt', 'progress', 'review')), kinds)
    check('aucun texte du Coran envoyé', not any(('بِسْمِ' in json.dumps(r['data'], ensure_ascii=False)) for r in fake.rows.values()))
    t = sync_text(pg)
    check('message : sauvegardé sur ton compte', 'Sauvegardé sur ton compte' in t, t)
    e.shot('A1-synced')
    print('ERRORS A', real_errors(e.errors))
    errs_a = real_errors(e.errors)
    e.close()

    # ---------- 2. Appareil B : stockage vide, même compte ----------
    e = Env(p, supabase=setup)
    pg = e.open(); pg.wait_for_timeout(2500)
    check('appareil B : progression retrouvée (séance guidée sur Al-Ikhlas)', 'Al-Ikhlas' in pg.locator('#tab-learn .mz-guided').inner_text(), pg.locator('#tab-learn .mz-guided').inner_text())
    check('appareil B : Où j’en suis = juz 30, groupe 8 (Al-Fatiha connue)', 'groupe 8' in pg.locator('#tab-learn .mz-now').inner_text())
    pg.click('.nav__tab[data-tab="progress"]'); pg.wait_for_timeout(400)
    check('appareil B : Al-Fatiha « Je connais »', 'Je connais' in pg.locator('#tab-progress .mz-fat').inner_text())
    e.shot('B1-progress')
    errs_b = real_errors(e.errors)
    e.close()

    # ---------- 3. Téléphone et Mac, chacun de son côté, puis fusion ----------
    fake.installed = False   # la sauvegarde n'est pas encore activée : chaque appareil garde sa progression
    P = Env(p, supabase=setup); pp = P.open(); pp.wait_for_timeout(1500)
    units3 = ar_units(P, 3)
    P.js("""async (us) => { const Q = window.__QR; const A = window.__AR; await A.bank();
      await Q.put('ar_state', 'main', { v: 2, done: Object.fromEntries(us.map((u) => [u, '2026-10-27'])), seen: Object.fromEntries(us.map((u) => [u, '2026-10-27'])) });
      for (const c of ['c1', 'c2', 'c3']) await Q.put('ar_exam', 'x-' + c, { at: '2026-10-27T20:00:00Z', d: '2026-10-27', exam: c, draw: 'd' + c, score: 18, pts: 9, n: 10, parts: [], oral: null, passed: true, wrong: [] });
      await Q.put('ar_att', 'att-tel', { at: '2026-10-27T20:01:00Z', d: '2026-10-27', t: 'nom', sk: 'nom', u: us[0], lv: 1, key: 'L:jim', ok: 0, g: 'auto', mode: 'train' });
      await Q.loadGroups(); await Q.setStatus([[112, 1, 4]], 'known'); Q.renderAll(); }""", units3)
    pp.wait_for_timeout(600)
    check('téléphone : chapitres 1 à 3 faits, « Où j’en suis » = chapitre 4 (sur le téléphone seulement)', P.js("() => window.__AR.position().c.id") == 'c4' and state(P) == 'not_installed')
    pp.wait_for_timeout(50)
    M = Env(p, supabase=setup); pm = M.open(); pm.wait_for_timeout(1500)
    # sur le Mac : le chapitre 1 repris du début (étape 1 refaite le lendemain) et une séance guidée sur Al-Ikhlas, sans statut
    M.js("""async (u) => { const Q = window.__QR; await window.__AR.bank(); await Q.put('ar_state', 'main', { v: 2, done: { [u]: '2026-10-28' }, seen: { [u]: '2026-10-28' } });
      const p = Q.progressOf(112); p.listened = [1, 2]; p.worked = [1]; p.lastAt = new Date().toISOString(); await Q.put('progress', 's112', p); Q.renderAll(); }""", units3[0])
    pm.wait_for_timeout(500)
    check('Mac : revenu au chapitre 1 (ce que tu as vu)', M.js("() => window.__AR.position().c.id") == 'c1')
    pm.click('.nav__tab[data-tab="arabe"]'); pm.wait_for_timeout(700)
    check('Mac : l’onglet Arabe dit que la progression reste sur cet appareil', 'reste sur cet appareil' in norm(pm.locator('#tab-arabe .sync-banner').inner_text()) if pm.locator('#tab-arabe .sync-banner').count() else False)
    M.shot('M0-mac-avant')
    # il active la sauvegarde ; le téléphone envoie, puis le Mac se synchronise
    fake.installed = True
    sync(P, 1500)
    check('téléphone : tout envoyé (étapes, examens, réponses, statut d’Al-Ikhlas)', state(P) == 'synced' and len((fake.data('ar_state', 'main') or {}).get('done', {})) == len(units3) and fake.data('ar_exam', 'x-c3') and fake.data('ar_att', 'att-tel') and fake.data('progress', 's112'), state(P))
    sync(M, 1500); pm.wait_for_timeout(300)
    check('Mac : « Où j’en suis » = chapitre 4, comme sur le téléphone', M.js("() => window.__AR.position().c.id") == 'c4', M.js("() => window.__AR.position().c && window.__AR.position().c.id"))
    check('Mac : les étapes des chapitres 1 à 3, date la plus ancienne gardée', ar_done(M) == sorted(units3) and M.js("(u) => window.__AR.st().done[u]", units3[0]) == '2026-10-27')
    check('Mac : notes des examens et réponses de l’entraînement retrouvées', M.js("() => window.__AR.examState('c3').passed") and M.js("() => window.__QR.Store.mem.ar_att.has('att-tel')"))
    k112 = M.js("() => ({ known: window.__QR.suraKnown(112), listened: window.__QR.progressOf(112).listened, worked: window.__QR.progressOf(112).worked })")
    check('Mac : Al-Ikhlas « Je connais » (choix du téléphone) ET la séance guidée du Mac gardée', k112['known'] and k112['listened'] == [1, 2] and k112['worked'] == [1], k112)
    check('Mac : plus de bandeau, synchronisé', state(M) == 'synced' and pm.locator('#tab-arabe .sync-banner').count() == 0, state(M))
    M.shot('M1-mac-apres')
    sync(P, 1500)
    k112p = P.js("() => ({ known: window.__QR.suraKnown(112), listened: window.__QR.progressOf(112).listened })")
    check('téléphone : reçoit la séance guidée du Mac, garde ses statuts et ses étapes', k112p['known'] and k112p['listened'] == [1, 2] and ar_done(P) == sorted(units3), k112p)
    # les deux avancent en même temps (sans s'être synchronisés entre-temps) : rien ne se perd
    u4 = ar_units(P, 4)[len(units3):]
    M.js("async (u) => { const A = window.__AR; const d = Object.assign({}, A.st().done, { [u]: '2026-10-29' }); await window.__QR.put('ar_state', 'main', Object.assign(A.st(), { done: d })); }", u4[0])
    P.js("async (u) => { const A = window.__AR; const d = Object.assign({}, A.st().done, { [u]: '2026-10-29' }); await window.__QR.put('ar_state', 'main', Object.assign(A.st(), { done: d })); }", u4[1])
    pm.wait_for_timeout(1500); pp.wait_for_timeout(300)   # chacun envoie de son côté : le dernier écrase la ligne du compte
    sync(M, 1200); sync(P, 1200); sync(M, 1200)
    want = sorted(units3 + u4[:2])
    check('envois simultanés : les deux appareils finissent avec les étapes des deux', ar_done(M) == want and ar_done(P) == want, (len(ar_done(M)), len(ar_done(P)), len(want)))
    check('envois simultanés : le compte aussi', sorted((fake.data('ar_state', 'main') or {}).get('done', {}).keys()) == want)
    # « Pas encore » choisi sur le Mac (plus récent) l'emporte sur le téléphone
    M.js("async () => { await window.__QR.setStatus([[112, 1, 4]], 'none'); }"); pm.wait_for_timeout(1500)
    sync(P, 1200)
    check('statut changé ensuite sur le Mac (« Pas encore ») : le téléphone suit', not P.js("() => window.__QR.suraKnown(112)") and P.js("() => window.__QR.progressOf(112).listened") == [1, 2])
    errs_pm = real_errors(P.errors) + real_errors(M.errors)
    P.close(); M.close()

    # ---------- 4. Appareil sans agenda ni session : « Me connecter » dans Mon Coran ----------
    e = Env(p, supabase=setup_bare)
    pg = e.open(); pg.wait_for_timeout(1500)
    check('sans agenda ni session : état « signedout »', state(e) == 'signedout', state(e))
    e.js("async () => { await window.__QR.loadGroups(); await window.__QR.setStatus([[1, 1, 7]], 'known'); window.__QR.renderAll(); }"); pg.wait_for_timeout(400)
    ban = norm(pg.locator('#tab-learn .sync-banner').inner_text()) if pg.locator('#tab-learn .sync-banner').count() else ''
    check('bandeau : « Ta progression reste sur cet appareil » + « Me connecter »', 'reste sur cet appareil' in ban and 'Me connecter' in ban, ban)
    e.shot('N0-signedout')
    pg.click('#tab-learn .sync-banner [data-sheet="account"]'); pg.wait_for_timeout(500)
    check('feuille de connexion : e-mail, mot de passe, « Me connecter »', pg.locator('#accEmail').count() == 1 and pg.locator('#accPass[type="password"]').count() == 1 and pg.locator('#sheets button[type="submit"]').count() == 1)
    pg.fill('#accEmail', 'test@example.com'); pg.fill('#accPass', 'mauvais'); pg.click('#sheets button[type="submit"]'); pg.wait_for_timeout(1200)
    err = norm(pg.locator('#sheets [role="alert"]').inner_text()) if pg.locator('#sheets [role="alert"]').count() else ''
    check('mauvais mot de passe : « E-mail ou mot de passe incorrect », e-mail gardé', 'mot de passe incorrect' in err and pg.locator('#accEmail').input_value() == 'test@example.com', err)
    e.shot('N1-mauvais-mot-de-passe')
    pg.fill('#accPass', 'bon-mot-de-passe'); pg.click('#sheets button[type="submit"]'); pg.wait_for_timeout(2500)
    check('bon mot de passe : connecté, synchronisé, feuille fermée', state(e) == 'synced' and pg.locator('#accEmail').count() == 0, state(e))
    check('session enregistrée pour le projet de l’agenda (commune à l’agenda)', e.js("(r) => !!localStorage.getItem('sb-' + r + '-auth-token')", OFFICIAL_REF))
    pg.click('.nav__tab[data-tab="arabe"]'); pg.wait_for_timeout(700)
    check('après connexion : l’arabe reprend où tu en es (chapitre 4)', 'Chapitre 4' in pg.locator('#tab-arabe .ar-now').inner_text(), pg.locator('#tab-arabe .ar-now').inner_text()[:80])
    check('ce qui avait été fait ici sans compte (Al-Fatiha) est ajouté au compte', (fake.data('progress', 's1') or {}).get('kv') == [[1, 7]], fake.data('progress', 's1'))
    e.shot('N2-connecte')
    errs_n = real_errors(e.errors)
    e.close()

    # ---------- 5. Installation ancienne : les natures de l'arabe sont refusées ----------
    fake.kinds = {'prefs', 'pos', 'fav', 'attempt', 'progress', 'review'}
    e = Env(p, supabase=setup)
    pg = e.open(); pg.wait_for_timeout(2000)
    e.js("""async () => { const Q = window.__QR; await Q.put('ar_att', 'att-ancienne', { at: '2026-10-29T08:00:00Z', d: '2026-10-29', t: 'nom', sk: 'nom', lv: 1, key: 'L:ba', ok: 1, g: 'auto', mode: 'train' });
      await Q.loadGroups(); await Q.setStatus([[113, 1, 5]], 'known'); }""")
    pg.wait_for_timeout(2500)
    check('installation ancienne : le Coran part quand même, l’arabe attend (« outdated »)', state(e) == 'outdated' and (fake.data('progress', 's113') or {}).get('kv') == [[1, 5]] and not fake.data('ar_att', 'att-ancienne'), state(e))
    pg.click('.nav__tab[data-tab="arabe"]'); pg.wait_for_timeout(600)
    ban = norm(pg.locator('#tab-arabe .sync-banner').inner_text()) if pg.locator('#tab-arabe .sync-banner').count() else ''
    check('bandeau : « Ta progression en arabe reste sur cet appareil » + « Mettre à jour »', 'en arabe reste sur cet appareil' in ban and 'Mettre à jour' in ban, ban)
    e.shot('O0-outdated')
    pg.click('#tab-arabe .sync-banner [data-sheet="sync-install"]'); pg.wait_for_timeout(600)
    check('feuille : « Mettre à jour la sauvegarde en ligne »', 'Mettre à jour la sauvegarde en ligne' in pg.locator('#sheets').inner_text())
    fake.kinds = None   # il relance le code dans Supabase
    pg.click('#sheets [data-act="sync-check"]'); pg.wait_for_timeout(2000)
    check('après mise à jour : tout est envoyé, plus de bandeau', state(e) == 'synced' and fake.data('ar_att', 'att-ancienne') and pg.locator('#tab-arabe .sync-banner').count() == 0, state(e))
    errs_o = real_errors(e.errors)
    e.close()

    allerr = errs_a + errs_b + errs_pm + errs_n + errs_o
    print('ERRORS', allerr)
    check('aucune erreur JavaScript', not allerr, allerr[:3])

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
