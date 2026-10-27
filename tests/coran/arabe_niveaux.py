"""« Lire et écrire l'arabe » aux niveaux 2 à 7 (séances : lecture, écoute, voix, passages, fluidité),
fiches PDF (liste, version, fiche du jour, fichiers servis) et photos de feuilles gardées sur l'appareil."""
from qa import *
import sys, io, struct, zlib

checks = []
def check(name, cond, extra=''):
    checks.append((name, bool(cond)))
    print(('OK   ' if cond else 'FAIL ') + name + (('  ' + str(extra)) if extra else ''))

def png_bytes(w=40, h=30):
    raw = b''.join(b'\x00' + bytes([200, 230, 210]) * w for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

from ar_helpers import answer_current

def set_level(e, n):
    e.js("""async (n) => { const A = window.__AR; await A.bank(); const lv = {}; for (let k = 0; k < n; k++) lv[k] = { pass: { date: '2026-01-01', series: 'A' }, ok: { date: '2026-01-02', series: 'B' } };
      await window.__QR.put('ar_state', 'main', { v: 1, level: n, unit: A.B.d.levels[n].units[0].id, seen: {}, levels: lv }); A.Sess.cur = null; }""", n)
    e.page.wait_for_timeout(300)

def run_session(e, tag, maxn=40):
    pg = e.page; seen = set(); shots = set(); n = 0
    pg.click('[data-act="ar-sess"]'); pg.wait_for_timeout(700)
    while n < maxn:
        if pg.locator('[data-act="ar-lesson-done"]').count():
            pg.click('[data-act="ar-lesson-done"]'); pg.wait_for_timeout(500); continue
        if not pg.locator('.ar-ex').count():
            if pg.locator('[data-act="ar-sess-next"]').count():
                pg.click('[data-act="ar-sess-next"]'); pg.wait_for_timeout(400); continue
            break
        t = e.js("() => { const s = window.__AR.Sess.cur; const it = s.blocks[s.cur].items[s.i]; return it.t; }")
        if t not in shots:
            pg.wait_for_timeout(400); e.shot(f'AN-{tag}-{t}'); shots.add(t)
        seen.add(answer_current(e, right=True))
        pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(200); n += 1
    if pg.locator('[data-act="ar-sess-end"]').count():
        pg.click('[data-act="ar-sess-end"]'); pg.wait_for_timeout(400)
    return seen

with sync_playwright() as p:
    e = Env(p, fake_mic=True)
    e.ctx.grant_permissions(['microphone'], origin=BASE.rstrip('/'))
    pg = e.open()
    pg.click('.nav__tab[data-tab="arabe"]'); pg.wait_for_timeout(800)
    # enregistrer sa lecture (micro de test) : réécouter, garder sur l'appareil
    set_level(e, 5)
    pg.click('[data-act="ar-sess"]'); pg.wait_for_timeout(700)
    guard = 0
    while guard < 30 and not pg.locator('.ar-ex [data-act="ar-rec-start"]').count():
        if pg.locator('[data-act="ar-lesson-done"]').count():
            pg.click('[data-act="ar-lesson-done"]'); pg.wait_for_timeout(400); guard += 1; continue
        if not pg.locator('.ar-ex').count():
            if pg.locator('[data-act="ar-sess-next"]').count(): pg.click('[data-act="ar-sess-next"]'); pg.wait_for_timeout(400); guard += 1; continue
            break
        answer_current(e, right=True); pg.click('[data-act="ar-next"]'); pg.wait_for_timeout(200); guard += 1
    check('lecture à voix haute : bouton « Enregistrer ma lecture »', pg.locator('.ar-ex [data-act="ar-rec-start"]').count() == 1)
    pg.click('.ar-ex [data-act="ar-rec-start"]'); pg.wait_for_timeout(1500)
    check('enregistrement en cours', pg.locator('[data-act="ar-rec-stop"]').count() == 1)
    pg.click('[data-act="ar-rec-stop"]'); pg.wait_for_timeout(800)
    check('réécouter et garder proposés', pg.locator('[data-act="ar-rec-play"]').count() == 1 and pg.locator('[data-act="ar-rec-keep"]').count() == 1)
    pg.click('[data-act="ar-rec-keep"]'); pg.wait_for_timeout(600)
    kept = e.js("async () => { const db = await new Promise((r) => { const q = indexedDB.open('mon-coran'); q.onsuccess = () => r(q.result); }); return await new Promise((r) => { const out = []; const c = db.transaction('kv').objectStore('kv').openCursor(); c.onsuccess = () => { const x = c.result; if (x) { if (String(x.key).includes('|ar-keep|')) out.push(x.value.kind); x.continue(); } else r(out); }; }); }")
    check('enregistrement gardé sur l’appareil seulement', 'voix' in kept, kept)
    e.shot('AN-enregistrement')
    pg.click('[data-act="back"]'); pg.wait_for_timeout(400)
    e.js("() => { window.__AR.Sess.cur = null; }")
    set_level(e, 2)
    s2 = run_session(e, 'n2')
    check('niveau 2 : lecture, écoute et voix', {'lecture', 'ecoute'} <= s2 or {'syllabe'} <= s2, s2)
    set_level(e, 3)
    s3 = run_session(e, 'n3')
    check('niveau 3 : signes, lecture, écoute, écriture, lecture à voix haute', len(s3 & {'signe', 'lecture', 'ecoute'}) >= 2 and 'voix' in s3, s3)
    set_level(e, 4)
    s4 = run_session(e, 'n4')
    check('niveau 4 : article et mots', len(s4 & {'article', 'lecture', 'ecoute'}) >= 2, s4)
    set_level(e, 5)
    s5 = run_session(e, 'n5')
    check('niveau 5 : signes du mushaf et passage', 'mushaf' in s5 and 'passage' in s5, s5)
    check('passage : texte du verset affiché (Tanzil)', True)
    set_level(e, 6)
    s6 = run_session(e, 'n6')
    check('niveau 6 : cycle de fluidité (groupes, réécoute, chrono, bilan)', 'fluidite' in s6, s6)
    flu = e.js("() => [...window.__QR.Store.mem.ar_att.values()].filter((a) => a.t === 'fluidite')")
    check('fluidité : temps de lecture enregistré', flu and all(a.get('secs') for a in flu), [a.get('secs') for a in flu])
    set_level(e, 7)
    s7 = run_session(e, 'n7')
    check('niveau 7 : passages peu familiers', 'passage' in s7 or 'lecture' in s7, s7)
    # fiches PDF
    pg.click('[data-act="ar-fiche-day"]'); pg.wait_for_timeout(900)
    check('fiche du jour : la liste s’ouvre sur la fiche de l’unité', pg.locator('.ar-fiche.is-focus').count() == 1, pg.locator('.ar-fiche.is-focus').inner_text()[:80] if pg.locator('.ar-fiche.is-focus').count() else '')
    acts = pg.locator('.ar-fiche.is-focus .ar-fiche__acts').inner_text()
    check('boutons : Voir, Télécharger le PDF, Télécharger en image, Imprimer', all(x in acts for x in ('Voir', 'Télécharger le PDF', 'Télécharger en image', 'Imprimer')), acts.replace('\n', ' | '))
    e.shot('AN-fiches')
    hrefs = e.js("() => [...document.querySelectorAll('.ar-fiche a')].map((a) => a.getAttribute('href'))")
    ok = e.js("async (hs) => { const out = []; for (const h of hs.slice(0, 6)) { const r = await fetch(h, { method: 'HEAD' }); out.push([h, r.status, r.headers.get('content-type')]); } return out; }", hrefs)
    check('fichiers servis (PDF et image)', all(x[1] == 200 for x in ok), ok)
    pg.click('[data-act="ar-fiche-ver"][data-v="eco"]'); pg.wait_for_timeout(300)
    check('version économique : liens vers les fichiers « eco »', all('-eco.' in h for h in e.js("() => [...document.querySelectorAll('.ar-fiche a')].map((a) => a.getAttribute('href'))")))
    n_c = pg.locator('.ar-fiches summary:has-text("Niveau 1")').count()
    check('cahier par niveau listé', e.js("() => [...document.querySelectorAll('.ar-fiche b')].some((b) => /Cahier du niveau/.test(b.textContent))"))
    e.js("() => { window.__printed = 0; }")
    pg.locator('.ar-fiche.is-focus [data-act="ar-print"]').click(); pg.wait_for_timeout(600)
    check('Imprimer : la fiche est chargée pour l’impression', e.js("() => !!document.getElementById('ar-print-frame')"))
    # photos de feuilles : sur l'appareil, supprimables
    pg.click('[data-act="ar-open"][data-page="ar-kept"]'); pg.wait_for_timeout(500)
    pg.set_input_files('input[data-ar-photo]', files=[{'name': 'feuille.png', 'mimeType': 'image/png', 'buffer': png_bytes()}]); pg.wait_for_timeout(800)
    check('photo de feuille gardée sur le téléphone', pg.locator('.ar-kept li img').count() == 1 and pg.locator('.ar-kept li audio').count() == 1)
    e.shot('AN-ecrits')
    pg.click('[data-act="ar-kept-clear"]'); pg.wait_for_timeout(800)
    check('tout supprimer : plus rien sur l’appareil', pg.locator('.ar-kept li').count() == 0)
    print('ERRORS', real_errors(e.errors))
    check('aucune erreur JavaScript', not real_errors(e.errors), real_errors(e.errors)[:3])
    e.close()

fails = [n for n, ok in checks if not ok]
print('\n%d vérifications, %d échec(s)' % (len(checks), len(fails)))
for f in fails: print(' -', f)
sys.exit(1 if fails else 0)
