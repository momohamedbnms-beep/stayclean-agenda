"""« Lire et écrire l'arabe », chapitres 6 à 10 et à-côtés : entraînement (lecture, écoute, signes, mushaf, passages,
fluidité), enregistrer sa lecture (gardé sur l'appareil), fiches PDF par chapitre (servies, version économique,
impression), photos de feuilles supprimables, et examens sans partie orale : même avec une clé Gemini dans l'agenda,
aucune voix n'est demandée ni envoyée ; l'écoute se fait par dictée (l'appli dit le mot, on l'écrit). Aucun service réel."""
from qa import *
import sys, json, re, struct, zlib
from ar_helpers import answer_current, advance

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def png_bytes(w=40, h=30):
    raw = b''.join(b'\x00' + bytes([200, 230, 210]) * w for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

def norm(s):
    return (s or '').replace('\u00a0', ' ').replace('\u202f', ' ')

def run_items(e, limit=40, wrong_at=()):
    pg = e.page; seen = []; n = 0
    while pg.locator('.ar-ex').count() and n < limit:
        if pg.locator('.ar-ex .loading').count(): pg.wait_for_timeout(400)
        t = answer_current(e, right=(n not in wrong_at)); seen.append(t)
        advance(pg); n += 1
    return seen

def forced(e, lv, unit, types, title='Test'):
    """Lance une série précise (exercice d'un type donné) par le crochet de test."""
    e.js("""async ([lv, unit, types, title]) => { const A = window.__AR; await A.bank();
      A.startRun({ kind: 'train', title, items: A.makeSet({ lv, unit: A.B.units.get(unit), n: 1, types, seed: 'test:' + types.join('+'), mode: 'train' }) }); }""", [lv, unit, types, title])
    e.page.wait_for_timeout(700)

gem = {'calls': [], 'mode': 'ok'}
def gemini(route):
    req = route.request; body = json.loads(req.post_data or '{}')
    parts = body['contents'][0]['parts']; txt = parts[1]['text']
    gem['calls'].append({'url': req.url, 'mime': parts[0]['inline_data']['mime_type'], 'n': len(parts[0]['inline_data']['data'])})
    if gem['mode'] == 'key':
        route.fulfill(status=403, body=json.dumps({'error': {'code': 403, 'status': 'PERMISSION_DENIED', 'message': 'API_KEY_INVALID'}}), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'}); return
    m = re.search(r'en arabe ([^)]+)\)', txt) or re.search(r'le mot arabe « (.+?) »', txt)
    heard = m.group(1) if m else ''
    res = {'entendu': heard, 'juste': True, 'remarque': 'Bien prononcé.'}
    route.fulfill(status=200, body=json.dumps({'candidates': [{'content': {'parts': [{'text': json.dumps(res, ensure_ascii=False)}]}, 'finishReason': 'STOP'}]}), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})

def exam_written(e, ch, length=None):
    """Ouvre l'examen d'un chapitre depuis « Examens blancs » (10 questions par défaut, ou length) et répond à tout (juste)."""
    pg = e.page
    pg.locator('[data-act="ar-exam"][data-x="%s"]' % ch).first.click(); pg.wait_for_timeout(600)
    if length: pg.click('[data-act="ar-exam-len"][data-n="%d"]' % length); pg.wait_for_timeout(300)
    pg.click('[data-act="ar-exam-go"]'); pg.wait_for_timeout(300)
    n = 0
    while pg.locator('.ar-ex').count() and not pg.locator('.ar-oral').count() and n < 25:
        answer_current(e); advance(pg); n += 1
    pg.wait_for_timeout(600)
    return n

with sync_playwright() as p:
    e = Env(p, fake_mic=True)
    e.ctx.grant_permissions(['microphone'], origin=BASE.rstrip('/'))
    e.ctx.route(re.compile(r'https://generativelanguage\.googleapis\.com/.*'), gemini)
    pg = e.open()
    pg.click('.nav__tab[data-tab="arabe"]'); pg.wait_for_timeout(800)
    # --- données de la version précédente (niveaux, examens de niveau) : gardées, ignorées sans erreur ---
    e.js("""async () => { await window.__QR.put('ar_state', 'main', { v: 1, level: 2, unit: 'u2a', seen: { u0a: '2026-10-27', u1a: '2026-10-27' }, levels: { 0: { pass: { date: '2026-10-27', series: 'A' } } } });
      await window.__QR.put('ar_exam', 'ancien1', { at: '2026-10-27T10:00:00Z', d: '2026-10-27', lv: 0, kind: 'niveau', series: 'A', parts: [{ comp: 'lettres', titre: 'Lettres', n: 5, note: 18 }], passed: true }); }""")
    for v in ('exams', 'train', 'sheets', 'study'):
        pg.click(f'[data-act="ar-view"][data-v="{v}"]'); pg.wait_for_timeout(400)
    check('ancienne version : Étudier repart du chapitre 1, examens sans note, sans erreur', 'Chapitre 1' in pg.locator('.ar-now').inner_text() and not real_errors(e.errors), real_errors(e.errors)[:2])
    pg.click('[data-act="ar-view"][data-v="exams"]'); pg.wait_for_timeout(300)
    check('ancienne version : les 11 examens sans essai compté', pg.locator('.ar-excard').count() == 11 and pg.locator('.ar-excard__res').count() == 0)
    # --- entraînement, chapitres 6 à 10 ---
    pg.click('[data-act="ar-view"][data-v="train"]'); pg.wait_for_timeout(500)
    check('M’entraîner : les 10 chapitres, « Tout réviser », journal des erreurs', pg.locator('.ar-chap[data-act="ar-train-ch"]').count() == 10 and pg.locator('[data-act="ar-train-mix"]').count() == 1 and pg.locator('[data-act="ar-open"][data-page="ar-errors"]').count() == 1)
    e.shot('AN-entrainement')
    seen = {}
    for ch in ('c6', 'c7', 'c8', 'c9', 'c10'):
        pg.click('.ar-chap[data-act="ar-train-ch"][data-ch="%s"]' % ch); pg.wait_for_timeout(700)
        if ch == 'c9': e.shot('AN-mushaf')
        seen[ch] = set(x for x in run_items(e) if x)
        check(f'chapitre {ch[1:]} : série de 10 terminée', pg.locator('.ar-done').count() == 1 and pg.locator('.ar-done__list li').count() == 10, sorted(seen[ch]))
        pg.click('.ar-done [data-act="back"]'); pg.wait_for_timeout(400)
    check('chapitre 6 : syllabes (choix et clavier)', bool(seen['c6'] & {'syllabe', 'k_syllabe'}), seen['c6'])
    check('chapitre 7 : signes, écoute, lecture ou dictée', len(seen['c7'] & {'signe', 'ecoute', 'lecture', 'k_dictee', 'voix'}) >= 2, seen['c7'])
    check('chapitre 8 : mots (article, formes particulières, lecture, écoute)', len(seen['c8'] & {'article', 'special', 'lecture', 'ecoute', 'compose', 'k_dictee'}) >= 2, seen['c8'])
    check('chapitre 9 : signes du mushaf', 'mushaf' in seen['c9'], seen['c9'])
    check('chapitre 10 : lecture et écoute de versets', len(seen['c10'] & {'lecture', 'ecoute', 'fluidite', 'passage'}) >= 2, seen['c10'])
    pr = pg.locator('.ar-chap[data-ch="c6"] small').inner_text()
    check('M’entraîner : % de réussite affiché par chapitre', '% de réussite' in pr, pr)
    # --- lecture à voix haute : enregistrer, réécouter, garder (sur l'appareil) ---
    forced(e, 3, 'u3a', ['voix'], 'Lecture à voix haute')
    check('lecture à voix haute : « Enregistrer ma lecture » et « rien n’est envoyé »', pg.locator('.ar-ex [data-act="ar-rec-start"]').count() == 1 and 'rien n’est envoyé' in pg.locator('.ar-rec').inner_text())
    pg.click('.ar-ex [data-act="ar-rec-start"]'); pg.wait_for_timeout(1400)
    check('enregistrement en cours', pg.locator('[data-act="ar-rec-stop"]').count() == 1)
    pg.click('[data-act="ar-rec-stop"]'); pg.wait_for_timeout(800)
    check('réécouter et garder proposés', pg.locator('[data-act="ar-rec-play"]').count() == 1 and pg.locator('[data-act="ar-rec-keep"]').count() == 1)
    pg.click('[data-act="ar-rec-keep"]'); pg.wait_for_timeout(600)
    kept = e.js("async () => { const db = await new Promise((r) => { const q = indexedDB.open('mon-coran'); q.onsuccess = () => r(q.result); }); return await new Promise((r) => { const out = []; const c = db.transaction('kv').objectStore('kv').openCursor(); c.onsuccess = () => { const x = c.result; if (x) { if (String(x.key).includes('|ar-keep|')) out.push(x.value.kind); x.continue(); } else r(out); }; }); }")
    check('enregistrement gardé sur l’appareil seulement', 'voix' in kept, kept)
    e.shot('AN-enregistrement')
    run_items(e)
    pg.click('.ar-done [data-act="back"]'); pg.wait_for_timeout(300)
    # --- passage : texte du verset (Tanzil) ---
    forced(e, 5, 'u5d', ['passage'], 'Passage')
    check('passage : le verset est affiché avec sa référence', pg.locator('.ar-passage p[lang="ar"]').count() == 1 and 'verset' in pg.locator('.ar-passage figcaption').inner_text())
    run_items(e); pg.click('.ar-done [data-act="back"]'); pg.wait_for_timeout(300)
    # --- fluidité : groupes, réécoute, chrono, bilan ---
    forced(e, 6, 'u6a', ['fluidite'], 'Fluidité')
    check('fluidité : lecture par petits groupes', pg.locator('.ar-groups li').count() >= 1 and pg.locator('.ar-flu-steps li').count() == 4)
    run_items(e)
    flu = e.js("() => [...window.__QR.Store.mem.ar_att.values()].filter((a) => a.t === 'fluidite')")
    check('fluidité : temps de lecture enregistré', bool(flu) and all(a.get('secs') for a in flu), [a.get('secs') for a in flu])
    pg.click('.ar-done [data-act="back"]'); pg.wait_for_timeout(300)
    # --- fiches PDF ---
    pg.click('[data-act="ar-view"][data-v="sheets"]'); pg.wait_for_timeout(900)
    check('Fiches PDF : un bloc par chapitre (10), celui en cours ouvert', pg.locator('details.ar-fich').count() == 10 and pg.locator('details.ar-fich[open]').count() == 1)
    first = pg.locator('details.ar-fich[open]')
    acts = first.locator('.ar-fiche.is-rev .ar-fiche__acts').inner_text()
    check('fiche de révision : Voir, Télécharger le PDF, Télécharger en image, Imprimer', all(x in acts for x in ('Voir', 'Télécharger le PDF', 'Télécharger en image', 'Imprimer')), acts.replace('\n', ' | '))
    check('chapitre ouvert : fiches d’exercices et le chapitre en un seul PDF', first.locator('.ar-fiche-list .ar-fiche').count() >= 1 and first.locator('a.link-row').count() == 1)
    e.shot('AN-fiches')
    hrefs = e.js("() => [...new Set([...document.querySelectorAll('.ar-fich a')].map((a) => a.getAttribute('href')))]")
    ok = e.js("async (hs) => { const out = []; for (const h of hs) { const r = await fetch(h, { method: 'HEAD' }); out.push([h, r.status, r.headers.get('content-type')]); } return out; }", hrefs)
    bad = [x for x in ok if x[1] != 200]
    check('tous les fichiers des fiches sont servis (PDF et images)', len(ok) >= 80 and not bad, (len(ok), bad[:3]))
    check('un PDF par chapitre (révision + exercices)', len([h for h in hrefs if re.search(r'chapitre-\d+-', h or '')]) == 10, [h for h in hrefs if 'chapitre-' in (h or '')][:3])
    pg.click('[data-act="ar-fiche-ver"][data-v="eco"]'); pg.wait_for_timeout(300)
    hs2 = e.js("() => [...document.querySelectorAll('.ar-fich a')].map((a) => a.getAttribute('href'))")
    check('version économique : liens vers les fichiers « eco »', hs2 and all('eco' in h for h in hs2), [h for h in hs2 if 'eco' not in h][:3])
    pg.click('[data-act="ar-fiche-ver"][data-v="couleur"]'); pg.wait_for_timeout(300)
    pg.locator('details.ar-fich[open] .ar-fiche.is-rev [data-act="ar-print"]').click(); pg.wait_for_timeout(600)
    check('Imprimer : la fiche est chargée pour l’impression', e.js("() => !!document.getElementById('ar-print-frame')"))
    # fiches d'un chapitre depuis sa page
    pg.click('[data-act="ar-view"][data-v="study"]'); pg.wait_for_timeout(400)
    pg.click('.ar-chap[data-ch="c9"]'); pg.wait_for_timeout(500)
    pg.click('[data-act="ar-sheets-ch"]'); pg.wait_for_timeout(600)
    check('fiches du chapitre 9 seulement, depuis sa page', pg.locator('details.ar-fich').count() == 1 and 'Chapitre 9' in pg.locator('details.ar-fich summary').inner_text())
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300); pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    # --- écrits, photos et enregistrements : sur l'appareil, supprimables ---
    pg.click('[data-act="ar-view"][data-v="sheets"]'); pg.wait_for_timeout(500)
    pg.click('[data-act="ar-open"][data-page="ar-kept"]'); pg.wait_for_timeout(500)
    pg.set_input_files('input[data-ar-photo]', files=[{'name': 'feuille.png', 'mimeType': 'image/png', 'buffer': png_bytes()}]); pg.wait_for_timeout(800)
    check('photo de feuille et enregistrement gardés sur le téléphone', pg.locator('.ar-kept li img').count() == 1 and pg.locator('.ar-kept li audio').count() == 1)
    e.shot('AN-ecrits')
    pg.click('[data-act="ar-kept-clear"]'); pg.wait_for_timeout(800)
    check('tout supprimer : plus rien sur l’appareil', pg.locator('.ar-kept li').count() == 0)
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    # --- examens : plus de partie orale (même avec une clé Gemini dans l'agenda) ; l'écoute se fait par dictée ---
    e.js("() => { localStorage.setItem('stayclean-agenda-v1', JSON.stringify({ settings: { geminiKey: 'cle-de-test' } })); }")
    pg.click('[data-act="ar-view"][data-v="study"]'); pg.wait_for_timeout(200)
    pg.click('[data-act="ar-view"][data-v="exams"]'); pg.wait_for_timeout(500)
    tab = norm(pg.locator('#tab-arabe').inner_text())
    check('Examens blancs : plus aucune partie orale annoncée', 'oral' not in tab.lower() and 'Gemini' not in tab, tab[:200])
    pg.locator('[data-act="ar-exam"][data-x="c7"]').first.click(); pg.wait_for_timeout(500)
    intro = norm(pg.locator('.page').inner_text())
    check('annonce : pas de ligne « Partie orale », dictée au programme', 'oral' not in intro.lower() and 'Dictée' in intro, intro[:240].replace('\n', ' | '))
    pg.click('[data-act="back"]'); pg.wait_for_timeout(300)
    n = exam_written(e, 'c7', 15)
    check('après les 15 questions écrites : le résultat, directement (aucun oral)', n == 15 and pg.locator('.ar-result').count() == 1 and pg.locator('[data-act="ar-oral-ok"]').count() == 0 and pg.locator('.ar-oral').count() == 0)
    rec = e.js("() => [...window.__QR.Store.mem.ar_exam.values()].filter((x) => x && x.exam === 'c7')")
    check('note enregistrée sans oral, 15 questions', rec and rec[0]['n'] == 15 and 'oral' not in rec[0] and rec[0]['score'] == 20, rec[:1])
    e.shot('AN-examen-sans-oral')
    pg.click('[data-act="ar-exam-close"]'); pg.wait_for_timeout(300)
    n8 = exam_written(e, 'c8', 10)
    check('examen de 10 questions : résultat direct', n8 == 10 and pg.locator('.ar-result').count() == 1)
    check('aucune voix envoyée, aucun service extérieur appelé (Gemini jamais appelé)', not gem['calls'], len(gem['calls']))
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
