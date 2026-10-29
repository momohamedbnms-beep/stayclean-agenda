"""Aide commune aux tests « Lire et écrire l'arabe » : répondre à l'exercice affiché (choisir, puis valider)."""

MARKS = set('ًٌٍَُِّْ')


def kb_keys(ans, marks):
    """Touches à taper sur le clavier de l'appli pour écrire « ans » (signes du mushaf ignorés, ٱ et ٰ → ا)."""
    out = []
    for c in ans:
        if c in 'ٱٰ':
            out.append('ا')
        elif 'ۖ' <= c <= 'ۭ' or c in 'ـ‌‍':
            continue
        elif c in MARKS:
            if marks:
                out.append(c)
        elif c == ' ':
            out.append(' ')
        else:
            out.append(c)
    return out


def answer_current(e, right=True, self_v='1'):
    """Répond à l'exercice affiché (bonne réponse si right) ; renvoie le type."""
    pg = e.page
    t = e.js("""() => { const t = window.__QR.UI.pages[window.__QR.UI.pages.length - 1]; const A = window.__AR;
      const src = t && t.props && t.props.src; let it = null;
      if (src === 'train') it = A.Run.set.items[A.Run.set.i];
      else if (src === 'exam') { const e = A.Ex.cur; it = e.secs.flatMap((x) => x.items)[e.i]; }
      return it ? { t: it.t, ans: it.ans == null ? null : String(it.ans), target: it.target || null, done: !!it.done, kb: !!it.kb, marks: !!it.marks, cmp: it.cmp || null, ch: (it.ch || []).map((c) => String(c.v)) } : null; }""")
    if not t:
        return None
    if t['ch']:
        v = t['ans'] if right else next(x for x in t['ch'] if x != t['ans'])
        pg.locator('.ar-ex [data-act="ar-pick"][data-v="%s"]' % v.replace('"', '\\"')).first.click()
        pg.click('.ar-ex [data-act="ar-validate"]')   # attend que « Valider » soit actif (réponse choisie)
    elif t['kb']:
        if pg.locator('input[data-ar-kbin]').count():
            pg.fill('input[data-ar-kbin]', t['ans'] if right else 'ب')
        else:
            keys = kb_keys(t['ans'], t['marks']) if right else ['ب', 'ب']
            if not right and t['ans'] == 'بب':
                keys = ['ت']
            for k in keys:
                pg.locator('.ar-kb [data-act="ar-kb"][data-c="%s"]' % k).first.click()
        pg.click('.ar-ex [data-act="ar-kb-ok"]')
    elif t['t'] == 'compose':
        letters = t['target'] if right else list(reversed(t['target']))
        for ch in letters:
            pg.locator('.ar-ex [data-act="ar-tile"][data-ch="%s"]' % ch).first.click()
        pg.click('.ar-ex [data-act="ar-compose-check"]')
    elif t['t'] == 'trace':
        box = pg.locator('.ar-canvas__c').bounding_box()
        if box:
            pg.mouse.move(box['x'] + 40, box['y'] + 40); pg.mouse.down(); pg.mouse.move(box['x'] + 140, box['y'] + 90, steps=6); pg.mouse.up()
        pg.click('.ar-ex [data-act="ar-self"][data-v="%s"]' % self_v)
    elif t['t'] in ('voix', 'passage'):
        pg.wait_for_timeout(300)
        pg.click('.ar-ex [data-act="ar-self"][data-v="%s"]' % self_v)
    elif t['t'] == 'fluidite':
        pg.click('[data-act="ar-flu"][data-step="1"]'); pg.wait_for_timeout(150)
        pg.click('[data-act="ar-flu"][data-step="2"]'); pg.wait_for_timeout(150)
        pg.click('[data-act="ar-chrono"][data-v="start"]'); pg.wait_for_timeout(1100)
        pg.click('[data-act="ar-chrono"][data-v="stop"]'); pg.wait_for_timeout(150)
        for k in ('juste', 'fluide', 'suite'):
            pg.click('[data-act="ar-crit"][data-k="%s"]' % k); pg.wait_for_timeout(80)
        pg.click('[data-act="ar-crit-ok"]')
    pg.wait_for_timeout(150)
    return t['t']


def advance(pg):
    """Après une réponse : « Continuer » à l'entraînement ; en examen, l'appli passe seule à la question suivante."""
    pg.wait_for_timeout(120)
    if pg.locator('.ar-ex [data-act="ar-next"]').count():
        pg.click('.ar-ex [data-act="ar-next"]')
    pg.wait_for_timeout(120)
