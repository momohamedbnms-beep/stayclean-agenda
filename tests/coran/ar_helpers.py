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


# Historique fictif pour les tests du coach (réponses, examens, étapes)
TODAY = '2026-10-29'
SEED = """async () => {
  const Q = window.__QR; const A = window.__AR; await A.bank();
  const att = async (id, d, t, key, ok, extra) => Q.put('ar_att', id, Object.assign({ at: d + 'T10:' + String(id.length).padStart(2, '0') + ':00Z', d, t, sk: 'rec', u: 'u2a', lv: 1, key, ok, g: 'auto', mode: 'train' }, extra || {}));
  let k = 0; const id = () => 'seed' + String(++k).padStart(3, '0');
  // ح pris pour خ (3 fois, sur 2 jours) ; خ pris pour ح (1 fois) ; à corriger : la confusion revient
  await att(id(), '2026-10-27', 'nom', 'L:ha_:nom', 0, { v: 'kha', err: 'point' });
  await att(id(), '2026-10-28', 'nom', 'L:ha_:nom', 0, { v: 'kha', err: 'point' });
  await att(id(), '2026-10-29', 'forme', 'L:ha_:milieu', 0, { v: 'kha', err: 'point', sk: 'lie' });
  await att(id(), '2026-10-28', 'lettre', 'L:kha:ch', 0, { v: 'ha_', err: 'point' });
  // dictée : ratée deux fois
  await att(id(), '2026-10-27', 'k_dictee', 'W:94b27c80:kd', 0, { v: 'حتم', err: 'ordre', sk: 'ecr', lv: 2 });
  await att(id(), '2026-10-28', 'k_dictee', 'W:94b27c80:kd', 0, { v: 'ختن', err: 'ordre', sk: 'ecr', lv: 2 });
  await att(id(), '2026-10-28', 'k_dictee', 'W:2dd4b5ac:kd', 0.5, { v: 'ومن', err: 'ordre', sk: 'ecr', lv: 2 });
  await att(id(), '2026-10-28', 'k_dictee', 'W:44073530:kd', 1, { sk: 'ecr', lv: 2 });
  await att(id(), '2026-10-28', 'k_dictee', 'W:44073530:kd', 0, { v: 'دهب', err: 'ordre', sk: 'ecr', lv: 2 });
  // les points de ب : ratés une fois, puis réussis deux fois de suite → acquis
  await att(id(), '2026-10-27', 'points', 'L:ba:pts', 0, { v: '2', err: 'point', lv: 0 });
  await att(id(), '2026-10-28', 'points', 'L:ba:pts', 1, { lv: 0 });
  await att(id(), '2026-10-29', 'points', 'L:ba:pts', 1, { lv: 0 });
  // syllabes : toujours justes (facile)
  for (const s of ['ba:fatha', 'ta:kasra', 'tha:damma', 'nun:fatha', 'ya:kasra', 'ba:damma', 'ta:fatha', 'tha:kasra', 'nun:damma', 'ya:fatha'])
    await att(id(), '2026-10-28', 'syllabe', 'S:' + s, 1, { sk: 'voy', lv: 2 });
  // aujourd'hui : quelques réponses
  await att(id(), '2026-10-29', 'syllabe', 'S:ba:kasra', 1, { sk: 'voy', lv: 2 });
  await att(id(), '2026-10-29', 'syllabe', 'S:ta:damma', 1, { sk: 'voy', lv: 2 });
  // chapitre 1 réussi ; examens du chapitre 2 : 12, 14,5, puis 15,5 aujourd'hui (pas encore réussi)
  const ex = (eid, d, score, x) => Q.put('ar_exam', eid, { at: d + 'T11:00:00Z', d, exam: x || 'c2', draw: eid, score, pts: score / 2, n: 10, parts: [], passed: score >= 16, wrong: [] });
  await ex('e0', '2026-10-26', 17, 'c1'); await ex('e1', '2026-10-27', 12); await ex('e2', '2026-10-28', 14.5); await ex('e3', '2026-10-29', 15.5);
  // étapes : chapitre 1 fait, chapitre 2 commencé hier
  await Q.put('ar_state', 'main', { v: 2, done: { u0a: '2026-10-26', u0b: '2026-10-26', u0c: '2026-10-26', u1a: '2026-10-28' }, seen: {} });
  Q.renderAll(); }"""
