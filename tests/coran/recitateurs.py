"""Récitateurs : Maher Al-Muaiqly et les voix les plus aimées des auditeurs (fichiers verset par verset d'EveryAyah),
choix dans les réglages par groupes, ▶ pour écouter chaque voix, verset exact avec chaque voix, mot à mot quand
quran-align publie les repères (contrôle de tous les fichiers), sources et droits.
Audio remplacé par un son d'essai local : aucun service réel."""
from qa import *
import sys, json

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

ROOT = os.path.abspath(os.path.join(QA, '..', '..'))
NEW = {'maher': 'MaherAlMuaiqly128kbps', 'shuraim': 'Saood_ash-Shuraym_128kbps', 'abdulbasit': 'Abdul_Basit_Murattal_64kbps',
       'abdulbasit_mujawwad': 'Abdul_Basit_Mujawwad_128kbps', 'minshawi_mujawwad': 'Minshawy_Mujawwad_192kbps',
       'sudais': 'Abdurrahmaan_As-Sudais_192kbps', 'ayyub': 'Muhammad_Ayyoub_128kbps', 'qatami': 'Nasser_Alqatami_128kbps',
       'shatri': 'Abu_Bakr_Ash-Shaatree_128kbps', 'ajmi': 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net'}
WORDS = ['shuraim', 'abdulbasit', 'abdulbasit_mujawwad', 'minshawi_mujawwad', 'sudais', 'shatri']

# --- repères mot à mot : tous les fichiers des voix ajoutées, contrôlés hors navigateur ---
ayas = {s: len(json.load(open(os.path.join(ROOT, 'coran', 'data', 's', '%03d.json' % s), encoding='utf-8'))['ar']) for s in range(1, 115)}
bad = []
for rid in WORDS:
    folder = NEW[rid]
    for s in range(1, 115):
        f = os.path.join(ROOT, 'coran', 'data', 'timing', folder, '%03d.json' % s)
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception as ex:
            bad.append((folder, s, 'absent')); continue
        if d.get('f') != folder or d.get('s') != s or len(d.get('v', [])) != ayas[s]:
            bad.append((folder, s, 'forme')); continue
        for a, segs in enumerate(d['v'], 1):
            last = -1
            for w0, w1, t0, t1 in segs:
                if not (0 <= w0 < w1 and 0 <= t0 < t1 and t0 >= last):
                    bad.append((folder, s, a)); break
                last = t1
check('repères mot à mot des 6 voix ajoutées : 114 sourates chacune, versets complets, segments ordonnés', not bad, bad[:5])
idx = json.load(open(os.path.join(ROOT, 'coran', 'data', 'timing', 'quran-align.json'), encoding='utf-8'))
cov = {NEW[r]: 100 * idx['reciters'][NEW[r]]['total']['single'] / idx['reciters'][NEW[r]]['total']['words'] for r in WORDS}
check('couverture mot par mot ≥ 97 % pour chaque voix ajoutée', all(v >= 97 for v in cov.values()), {k: round(v, 1) for k, v in cov.items()})

with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    R = e.js("() => Object.fromEntries(Object.entries(window.__QR.RECITERS).map(([k, r]) => [k, { folder: r.folder || null, kind: r.kind, sync: r.sync, group: r.group, note: r.note || '' }]))")
    check('16 voix : 10 ajoutées, dossiers EveryAyah exacts', len(R) == 16 and all(R[k]['folder'] == f and R[k]['kind'] == 'ayah' for k, f in NEW.items()), {k: R.get(k, {}).get('folder') for k in NEW})
    check('Maher Al-Muaiqly, Muhammad Ayyub, Nasser Al-Qatami, Ahmed Al-Ajmi : suivi par verset (pas de mot à mot inventé)', all(R[k]['sync'] == 'ayah' for k in ('maher', 'ayyub', 'qatami', 'ajmi')))
    check('les 6 voix dont quran-align publie les repères : suivi mot à mot', all(R[k]['sync'] == 'words' for k in WORDS))
    check('chaque voix a sa phrase (ce qu’en disent les auditeurs)', all(len(v['note']) > 20 for v in R.values()), [k for k, v in R.items() if len(v['note']) <= 20])
    # --- réglages : groupes, choisir, écouter ---
    pg.click('[data-act="open-page"][data-page="settings"]'); pg.wait_for_timeout(600)
    pg.locator('#set-reciter').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    heads = e.js("() => [...document.querySelectorAll('.page .rc-h')].map((h) => h.textContent.trim())")
    check('trois groupes : voix principale, les plus aimées, pour apprendre la prononciation', heads == ['Voix principale', 'Les voix les plus aimées', 'Pour apprendre la prononciation'], heads)
    order = e.js("() => [...document.querySelectorAll('.page .rc__pick')].map((b) => b.dataset.v)")
    check('Maher Al-Muaiqly en tête des voix les plus aimées', order[:3] == ['luhaidan', 'maher', 'dossari'] and len(order) == 16, order[:4])
    check('chaque voix : une ligne pour la choisir et ▶ pour l’écouter', pg.locator('.page .rc__play').count() == 16 and pg.locator('.page .rc__pick[aria-checked="true"]').count() == 1)
    row = pg.locator('.page .rc:has(.rc__pick[data-v="maher"])').inner_text()
    check('ligne de Maher : imam de La Mecque, voix chaude et posée, suivi par verset', 'Maher Al-Muaiqly' in row and 'La Mecque' in row and 'suivi par verset' in row, row.replace('\n', ' | '))
    check('mujawwad indiqué (Abdul Basit, Al-Minshawi)', 'mujawwad' in pg.locator('.page .rc:has(.rc__pick[data-v="abdulbasit_mujawwad"])').inner_text() and 'mujawwad' in pg.locator('.page .rc:has(.rc__pick[data-v="minshawi_mujawwad"])').inner_text())
    e.shot('RC1-voix')
    n0 = len(e.audio_requests)
    pg.click('.page .rc__play[data-rid="maher"]'); pg.wait_for_timeout(900)
    req = e.audio_requests[n0:]
    check('▶ Maher : début d’Al-Fatiha avec sa voix (MaherAlMuaiqly128kbps/001001)', any('everyayah.com/data/MaherAlMuaiqly128kbps/001001.mp3' in u for u in req), req[:3])
    check('le bouton montre que ça joue (Arrêter)', pg.locator('.page .rc__play[data-rid="maher"].is-playing').count() == 1 and 'Arrêter' in (pg.locator('.page .rc__play[data-rid="maher"]').get_attribute('aria-label') or ''))
    check('écouter ne change pas la voix choisie', e.js("() => window.__QR.reciterId()") == 'husary')
    n1 = len(e.audio_requests)
    pg.click('.page .rc__play[data-rid="qatami"]'); pg.wait_for_timeout(900)
    check('▶ une autre voix : la première s’arrête, Al-Qatami joue', any('Nasser_Alqatami_128kbps/001001.mp3' in u for u in e.audio_requests[n1:]) and pg.locator('.page .rc__play.is-playing').count() == 1
          and pg.locator('.page .rc__play[data-rid="qatami"].is-playing').count() == 1)
    pg.click('.page .rc__play[data-rid="qatami"]'); pg.wait_for_timeout(400)
    check('toucher encore : arrêt', e.js("() => window.__QR.Player.state") == 'idle' and pg.locator('.page .rc__play.is-playing').count() == 0, e.js("() => window.__QR.Player.state"))
    pg.click('.page .rc__pick[data-v="maher"]'); pg.wait_for_timeout(400)
    check('choisir Maher : enregistré pour toute l’appli', e.js("() => window.__QR.reciterId()") == 'maher' and pg.locator('.page .rc__pick[data-v="maher"][aria-checked="true"]').count() == 1)
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(400)
    # --- lecteur : verset exact avec Maher ---
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(300)
    pg.fill('#readSearch', '112'); pg.wait_for_timeout(250)
    pg.click('#readList .srow[data-s="112"]'); pg.wait_for_timeout(1200)
    n2 = len(e.audio_requests)
    pg.click('.vnum[data-a="2"]'); pg.wait_for_timeout(300)
    pg.locator('[data-act="repeat-verse"]').first.click(); pg.wait_for_timeout(1200)
    bar = pg.locator('#player').inner_text()
    check('lecteur, Al-Ikhlas verset 2 : fichier de Maher, nom affiché « Maher Al-Muaiqly »', any('MaherAlMuaiqly128kbps/112002.mp3' in u for u in e.audio_requests[n2:]) and 'Maher Al-Muaiqly' in bar, (e.audio_requests[n2:][:2], bar.replace('\n', ' | ')))
    hl = e.js("() => { const el = document.querySelector('.page .is-reciting, .page .verse.is-on, .page [data-hl]'); return el ? (el.id || el.className) : null; }")
    check('verset surligné : le 2', e.js("() => window.__QR.Player.cur && window.__QR.Player.cur.a") == 2, hl)
    check('pas de mot surligné ni de repères cherchés pour Maher', e.js("() => window.__QR.Player.run && window.__QR.Player.run.words") is None
          and not e.js("() => performance.getEntriesByType('resource').some((r) => r.name.includes('timing/MaherAlMuaiqly'))"))
    pg.click('[data-act="player-stop"]'); pg.wait_for_timeout(300)
    # --- mot à mot avec Al-Shuraim ---
    e.js("() => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { reciter: 'shuraim', reciterV2: true }))"); pg.wait_for_timeout(300)
    n3 = len(e.audio_requests)
    pg.click('.vnum[data-a="2"]'); pg.wait_for_timeout(300)
    pg.locator('[data-act="repeat-verse"]').first.click(); pg.wait_for_timeout(1200)
    words = e.js("() => window.__QR.Player.run && window.__QR.Player.run.words")
    check('Al-Shuraim : fichier Saood_ash-Shuraym_128kbps/112002, repères mot à mot chargés (2 mots)', any('Saood_ash-Shuraym_128kbps/112002.mp3' in u for u in e.audio_requests[n3:]) and isinstance(words, list) and len(words) >= 1, (e.audio_requests[n3:][:1], words))
    pg.click('[data-act="player-stop"]'); pg.wait_for_timeout(300)
    pg.click('.page [data-act="back"]'); pg.wait_for_timeout(300)
    # --- sources et droits ---
    pg.click('.nav__tab[data-tab="learn"]'); pg.wait_for_timeout(300)
    pg.click('[data-act="open-page"][data-page="settings"]'); pg.wait_for_timeout(500)
    pg.click('.page [data-act="open-page"][data-page="sources"]'); pg.wait_for_timeout(600)
    src = pg.locator('#pages .page').last.inner_text()
    check('sources : les nouvelles voix (EveryAyah), le choix d’après les avis, le mot à mot et le suivi par verset expliqués',
          all(x in src for x in ('Maher Al-Muaiqly', 'Saoud Al-Shuraim', 'Abdul Basit', 'Nasser Al-Qatami', 'Ahmed Al-Ajmi', 'Le choix des voix', 'r/islam', 'Par verset, Maher Al-Muaiqly')), src[:200])
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()
    # --- écrans : nuit et papier, sans débordement ---
    for amb in ('nuit', 'papier'):
        e = Env(p, dark=(amb == 'nuit'))
        pg = e.open()
        e.js("(a) => window.__QR.put('prefs', 'main', Object.assign({}, window.__QR.prefs(), { ambiance: a }))", amb); pg.wait_for_timeout(300)
        pg.click('[data-act="open-page"][data-page="settings"]'); pg.wait_for_timeout(600)
        pg.locator('#set-reciter').scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        e.shot(f'RC2-voix-{amb}')
        over = e.js("() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('.page .rc, .page .rc *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).map((el) => el.className).slice(0, 3); }")
        check(f'{amb} : liste des voix sans débordement', not over, over)
        check(f'{amb} : aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
        e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
