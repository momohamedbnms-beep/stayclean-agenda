from qa import *
import re
with sync_playwright() as p:
    e = Env(p)
    pg = e.open()
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(300)
    n = e.js("() => document.querySelectorAll('#readList .srow').length")
    print('sourates listées :', n)
    res = e.js("""async () => { const Q = window.__QR; let total = 0, bad = [];
      for (let s = 1; s <= 114; s++) { try { const r = await fetch('coran/data/s/' + String(s).padStart(3,'0') + '.json'); const d = await r.json();
        const m = Q.Content.index.suras[s-1]; if (d.ar.length !== m.ayas || d.tl.length !== m.ayas || d.fr.length !== m.ayas) bad.push(s); total += d.ar.length; } catch (e) { bad.push(s + ':' + e.message); } }
      return { total, bad } }""")
    print('versets :', res)
    e.close()
    # texte indisponible (hors ligne, rien en cache) : message honnête + Réessayer
    e = Env(p)
    pg = e.open()
    pg.click('.nav__tab[data-tab="read"]'); pg.wait_for_timeout(300)
    e.ctx.set_offline(True); pg.wait_for_timeout(200)
    pg.click('#readList .srow[data-s="18"]'); pg.wait_for_timeout(2500)
    txt = pg.locator('#pages .page').inner_text()
    print('message :', txt.replace('\n', ' | ')[:220])
    e.shot('90-text-offline')
    e.ctx.set_offline(False); pg.wait_for_timeout(300)
    pg.click('[data-act="reader-retry"]'); pg.wait_for_timeout(2000)
    print('après Réessayer, verset 18:1 affiché :', pg.locator('#v-18-1').count() == 1)
    # une sourate déjà ouverte reste lisible hors ligne
    pg.click('#pages [data-act="back"]'); pg.wait_for_timeout(300)
    e.ctx.set_offline(True); pg.wait_for_timeout(200)
    pg.click('#readList .srow[data-s="18"]'); pg.wait_for_timeout(1500)
    print('hors ligne, sourate déjà ouverte affichée :', pg.locator('#v-18-1').count() == 1)
    print('ERRORS', real_errors(e.errors))
    e.close()
