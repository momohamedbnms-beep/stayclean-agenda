#!/usr/bin/env python3
"""Fiches A4 « Lire et écrire l'arabe » : une fiche par notion, en version couleur et économique (encre),
plus un cahier par niveau (toutes les fiches du niveau dans un seul PDF).

Contenu : coran/data/arabe/banque.json (lettres, signes, mots du Coran en écriture pédagogique, passages)
et le texte Tanzil de l'appli (coran/data/s/) pour les passages. Aucun texte arabe n'est écrit ici à la main :
les lettres viennent de la banque et leurs formes (début, milieu, fin) sont produites par la police (Amiri Quran)
à l'aide de jointures invisibles. Les modèles à repasser sont la lettre de la police en gris, sans animation :
ce n'est pas le geste manuscrit et la fiche le dit. Aucune fiche ne contient de QR code ni de lien inventé.

Sortie : coran/fiches/*.pdf, *.png (image de la fiche), vignettes *.webp et fiches.json.
Contrôles : chaque fiche tient sur une page A4 (nombre de pages vérifié dans le PDF), polices intégrées.

Usage : python3 build_fiches.py   (nécessite Playwright + Chromium, pypdf, Pillow)"""
import hashlib, html, json, os, sys
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'coran', 'fiches')
FONTS = os.path.join(ROOT, 'coran', 'fonts')
BANK = json.load(open(os.path.join(ROOT, 'coran', 'data', 'arabe', 'banque.json'), encoding='utf-8'))
ZWJ = '‍'
HARAKAT = set('ًٌٍَُِّْٰٕٓٔ')
L = {l['id']: l for l in BANK['letters']}
BYCH = {l['ch']: l for l in BANK['letters']}
WORDS = BANK['words']
W = {w['id']: w for w in WORDS}
UNITS = {u['id']: dict(u, lv=lv['n']) for lv in BANK['levels'] for u in lv['units']}
LEVEL = {lv['n']: lv for lv in BANK['levels']}
L0 = ['alif', 'ba', 'ta', 'tha', 'dal', 'dhal', 'ra', 'zay', 'waw', 'nun', 'ya']
POS = [('seule', 'seule'), ('debut', 'au début'), ('milieu', 'au milieu'), ('fin', 'à la fin')]
e = lambda s: html.escape(str(s), quote=True)
ar = lambda t, cls='': f'<span class="ar {cls}" lang="ar" dir="rtl">{e(t)}</span>'
AR_RUN = __import__('re').compile(r'([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)')
MARKS_ONLY = __import__('re').compile(r'^[\u064B-\u065F\u0670\u06D6-\u06ED]+$')
tx = lambda t: AR_RUN.sub(lambda m: '<bdi class="ar" lang="ar">' + ('ـ' + m.group(1) if MARKS_ONLY.match(m.group(1)) else m.group(1)) + '</bdi>', e(t))   # texte français : chaque mot arabe isolé
ex_word = lambda ex: __import__('re').sub(r' (?=[\u06D6-\u06DC])', '', ex['uth'])   # signe de pause collé au mot


def form(ch, pos):
    joins = BYCH[ch]['lie'] if ch in BYCH else True
    if pos == 'debut':
        return ch + ZWJ if joins else ch
    if pos == 'milieu':
        return ZWJ + ch + ZWJ if joins else ZWJ + ch
    if pos == 'fin':
        return ZWJ + ch
    return ch


def base_letters(t):
    out = []
    for c in t:
        if c in HARAKAT:
            continue
        if c in 'أإآٱ':
            out.append('ا')
        elif 'ء' <= c <= 'ي':
            out.append(c)
    return out


def spread(xs, n):
    """n éléments répartis régulièrement dans la liste (sélection reproductible, variée)."""
    if len(xs) <= n:
        return list(xs)
    step = len(xs) / n
    return [xs[int(i * step)] for i in range(n)]


def verse(s, a):
    d = json.load(open(os.path.join(ROOT, 'coran', 'data', 's', '%03d.json' % s), encoding='utf-8'))
    toks = d['ar'][a - 1].split(' ')
    if a == 1 and d['bsm']:
        toks = toks[d['bsm']:]
    return ' '.join(toks)


def sura_name(s):
    idx = json.load(open(os.path.join(ROOT, 'coran', 'data', 'index.json'), encoding='utf-8'))
    for m in idx['suras']:
        if m['n'] == s:
            return m['name']
    return 'Sourate %d' % s


CSS = """
@font-face { font-family: "Amiri Quran"; src: url("%(fonts)s/amiri-quran-arabic-400-normal.woff2") format("woff2"); }
@font-face { font-family: "Rubik"; font-weight: 300 900; src: url("%(fonts)s/rubik-latin-wght-normal.woff2") format("woff2"); unicode-range: U+0000-00FF, U+2000-206F, U+20AC; }
@font-face { font-family: "Rubik"; font-weight: 300 900; src: url("%(fonts)s/rubik-latin-ext-wght-normal.woff2") format("woff2"); unicode-range: U+0100-02FF, U+1E00-1EFF, U+2020; }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: "Rubik", "Amiri Quran", sans-serif; color: #172C24; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.sheet { width: 210mm; height: 297mm; padding: 12mm 14mm 10mm; display: flex; flex-direction: column; overflow: hidden; page-break-after: always; break-after: page; position: relative; background: #fff; }
.sheet:last-child { page-break-after: auto; break-after: auto; }
.ar { font-family: "Amiri Quran", serif; font-weight: 400; unicode-bidi: isolate; }
.hd { display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 2mm 6mm; padding-bottom: 3mm; margin-bottom: 3mm; border-bottom: 0.6mm solid var(--rule); }
.hd__k { font-size: 9pt; color: var(--accent); font-weight: 600; letter-spacing: .02em; grid-column: 1 / -1; }
.hd__t { margin: 0; font-size: 19pt; line-height: 1.15; font-weight: 700; }
.hd__t .ar { font-size: 20pt; font-weight: 400; line-height: 1.3; }
.hd__who { font-size: 9pt; color: #555; white-space: nowrap; }
.body { flex: 1; display: flex; flex-direction: column; gap: 3mm; min-height: 0; }
.ft { margin-top: 2mm; padding-top: 1.6mm; border-top: 0.3mm solid #ccc; font-size: 7.2pt; color: #666; line-height: 1.35; display: flex; justify-content: space-between; gap: 6mm; }
.box { border-radius: 3mm; padding: 2.4mm 4mm; background: var(--panel); border: var(--panel-border); }
.box p { margin: 0 0 1.5mm; font-size: 10pt; line-height: 1.45; }
.box p:last-child { margin: 0; }
.k { font-weight: 700; color: var(--accent); }
h2 { margin: 0 0 1.5mm; font-size: 11.5pt; color: var(--accent); }
.consigne { font-size: 10.5pt; font-weight: 600; margin: 0 0 2mm; }
.consigne .n { display: inline-block; width: 5.5mm; height: 5.5mm; border-radius: 50%%; background: var(--accent); color: #fff; text-align: center; line-height: 5.5mm; font-size: 8.5pt; margin-inline-end: 2mm; }
.letter { display: grid; grid-template-columns: 24mm 1fr; gap: 0 5mm; padding: 1.3mm 0; border-bottom: 0.3mm dashed #c9c9c9; break-inside: avoid; }
.letter:last-child { border-bottom: 0; }
.letter__big { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1mm; border-radius: 3mm; background: var(--paper); border: 0.4mm solid var(--frame); padding: 1mm 0 2mm; }
.letter__big .ar { font-size: 36pt; line-height: 1.35; display: block; padding-bottom: .4em; }
.letter__big small { font-size: 8.5pt; color: #444; line-height: 1; }
.letter__main { display: flex; flex-direction: column; gap: 1.4mm; min-width: 0; }
.letter__head { font-size: 9.2pt; line-height: 1.3; }
.letter__head b { font-size: 11pt; }
.letter__head .ar { font-size: 13pt; }
.letter__head .son { color: #444; }
.letter__ex { font-size: 8.6pt; color: #444; }
.letter__ex .ar { font-size: 14pt; color: #172C24; }
.forms { display: flex; gap: 2mm; direction: rtl; }
.forms div { flex: 1; text-align: center; border: 0.3mm solid #d5d5d5; border-radius: 2mm; padding: 0 1mm 0.8mm; direction: ltr; }
.forms .ar { font-size: 16pt; line-height: 1.3; display: block; margin-top: -.3em; padding-bottom: .75em; }
.forms small { display: block; font-size: 7.2pt; line-height: 1.1; color: #555; }
.trace { display: flex; gap: 1.5mm; direction: rtl; align-items: flex-end; }
.trace > span { flex: 1; text-align: center; border-bottom: 0.4mm solid #999; height: 11mm; display: flex; align-items: flex-end; justify-content: center; }
.trace .ar { font-size: 21pt; line-height: 1.15; color: transparent; -webkit-text-stroke: 0.25mm var(--trace); }
.small .letter__big .ar { font-size: 30pt; }
.small .letter { padding: 1.6mm 0; }
.small .letter__main { gap: 1.2mm; }
.words { display: flex; flex-wrap: wrap; gap: 2mm 3mm; direction: rtl; }
.words .w { display: inline-flex; flex-direction: column; align-items: center; padding: 0 3mm 1mm; border-radius: 2mm; border: 0.3mm solid #d8d8d8; direction: ltr; }
.words .w .ar { font-size: 20pt; line-height: 1.9; }
.words .w small { font-size: 7.8pt; color: #555; }
.grid { display: grid; gap: 2mm; direction: rtl; }
.cell { border: 0.3mm solid #cfcfcf; border-radius: 2mm; text-align: center; padding: 0 1mm 1.2mm; direction: ltr; }
.cell .ar { font-size: 22pt; line-height: 1.95; display: block; }
.cell .line { display: block; height: 5mm; border-bottom: 0.3mm solid #aaa; margin: 0 2mm; }
.cell small { display: block; font-size: 7.8pt; color: #555; }
.lines { display: grid; gap: 0; }
.lines div { height: 13mm; border-bottom: 0.35mm solid #9a9a9a; position: relative; }
.lines div::after { content: ""; position: absolute; left: 0; right: 0; top: 4.5mm; border-top: 0.2mm dotted #bbb; }
.key { margin-top: auto; font-size: 7.8pt; color: #555; border-top: 0.3mm dashed #bbb; padding-top: 1.5mm; line-height: 1.45; }
.key b { color: #333; }
table.t { width: 100%%; border-collapse: collapse; font-size: 9.5pt; }
table.t th, table.t td { border: 0.3mm solid #d0d0d0; padding: 1.2mm 2mm; vertical-align: middle; text-align: start; }
table.t th { background: var(--panel); font-weight: 600; }
table.t td .ar { font-size: 17pt; line-height: 2.25; }
table.t td small { color: #555; font-size: 7.5pt; }
.passage { border-radius: 3mm; background: var(--paper); border: 0.4mm solid var(--frame); padding: 2mm 5mm; }
.passage p { margin: 0; font-family: "Amiri Quran", serif; font-size: 21pt; line-height: 2.05; text-align: right; direction: rtl; }
.passage small { display: block; font-size: 8pt; color: #555; margin-top: 1mm; }
.check { display: flex; gap: 6mm; font-size: 9.5pt; flex-wrap: wrap; }
.check span::before { content: ""; display: inline-block; width: 3.6mm; height: 3.6mm; border: 0.35mm solid #666; border-radius: 0.8mm; margin-inline-end: 1.5mm; vertical-align: -0.6mm; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
.couleur { --accent: #145A43; --rule: #2F8F66; --panel: #E7F4EB; --panel-border: 0; --paper: #FFFDF7; --frame: #D9C79E; --trace: #9DB8AA; }
.eco { --accent: #111; --rule: #333; --panel: #fff; --panel-border: 0.3mm solid #999; --paper: #fff; --frame: #888; --trace: #9a9a9a; }
.eco .consigne .n { background: #fff; color: #111; border: 0.3mm solid #111; line-height: 5mm; }
"""


FR_PUNCT = __import__('re').compile(r' ([;:!?»])')
TEXT_RUN = __import__('re').compile(r'(^|>)([^<]+)')


def fr_nb(html_text):
    """Typographie française : espace insécable avant ; : ! ? » et après « (texte entre les balises seulement)."""
    return TEXT_RUN.sub(lambda m: m.group(1) + FR_PUNCT.sub('\u00a0\\1', m.group(2)).replace('« ', '«\u00a0'), html_text)


def page(sid, lvn, title_html, body, eco, note=''):
    lv = LEVEL[lvn]
    ver = 'économique (encre)' if eco else 'couleur'
    return f"""<section class="sheet">
  <header class="hd"><div class="hd__k">Lire et écrire l’arabe · Niveau {lvn} — {e(lv['nom'])}</div>
    <h1 class="hd__t">{title_html}</h1><div class="hd__who">Prénom : …………………… Date : ……………</div></header>
  <div class="body">{body}</div>
  <footer class="ft"><span>Mon Coran · fiche {e(sid)} · version {ver}{(' · ' + e(note)) if note else ''}</span><span>Lettres : police Amiri Quran (formes produites par la police, pas un tracé manuscrit). Mots : texte coranique Tanzil, écriture adaptée. Fiche non relue par un enseignant.</span></footer>
</section>"""


def consigne(n, t):
    return f'<p class="consigne"><span class="n">{n}</span>{e(t)}</p>'


def word_box(w, tr=True):
    return f'<span class="w">{ar(w["ar"])}{f"<small>{e(w[chr(116)+chr(114)])}</small>" if tr else ""}</span>'


def key(items):
    return '<div class="key"><b>Corrigé</b> (à cacher pendant l’exercice) : ' + ' · '.join(items) + '</div>'


# ---------- Fiches ----------
def sheet_sens():
    known = {L[i]['ch'] for i in L0}
    ws = [w for w in WORDS if w['lv'] == 2 and 3 <= w['n'] <= 4 and all(c in known for c in base_letters(w['ar']))]
    ws = spread(ws, 8)
    rows = ''.join(f'<div class="cell">{ar(w["ar"])}<small>lettres dans l’ordre de lecture :</small><span class="line"></span></div>' for w in ws)
    body = f"""<div class="box"><p><span class="k">De droite à gauche.</span> {tx(UNITS['u0a']['comprendre'])}</p></div>
      {consigne(1, 'Pour chaque mot, écris ses lettres dans l’ordre où on les lit (la première est tout à droite).')}
      <div class="grid" style="grid-template-columns: repeat(2, 1fr)">{rows}</div>
      {consigne(2, 'Entoure la première lettre de chaque mot ci-dessus.')}
      {key([f'{ar(w["ar"])} = {" ".join(ar(c) for c in base_letters(w["ar"]))}' for w in ws])}"""
    return 'u0a', 0, 'Le sens de lecture', body


def sheet_parties():
    ids = ['ba', 'ta', 'tha', 'nun', 'ya', 'jim', 'kha', 'dhal', 'zay', 'shin', 'fa', 'qaf']
    cells = ''.join(f'<div class="cell">{ar(L[i]["ch"])}<small>points : ___ · dessus / dessous</small></div>' for i in ids)
    sg = [s for s in BANK['signs'] if s['id'] in ('fatha', 'kasra', 'damma')]
    body = f"""<div class="box"><p>{tx(UNITS['u0b']['comprendre'])}</p></div>
      {consigne(1, 'Combien de points ? Dessus ou dessous ? Complète sous chaque lettre.')}
      <div class="grid" style="grid-template-columns: repeat(4, 1fr)">{cells}</div>
      {consigne(2, 'Les voyelles brèves sont des signes, pas des lettres. Repasse chaque signe en couleur.')}
      <div class="grid" style="grid-template-columns: repeat(3, 1fr)">{''.join(f'<div class="cell">{ar("ب" + s["ch"])}<small>{e(s["nom"])} : « {e(s["son"])} »</small></div>' for s in sg)}</div>
      {key([f'{ar(L[i]["ch"])} {L[i]["pts"][0]} {"" if not L[i]["pts"][0] else e(L[i]["pts"][1])}' for i in ids])}"""
    return 'u0b', 0, 'Lettre, points et signes', body


def sheet_liaisons():
    non = BANK['nonJoining']
    ws = [w for w in WORDS if w['lv'] == 2 and w['n'] == 3 and any(c in non for c in base_letters(w['ar']))]
    ws = spread(ws, 10)
    body = f"""<div class="box"><p>{tx(UNITS['u0c']['comprendre'])}</p></div>
      <div class="words" style="justify-content:center">{''.join(f'<span class="w">{ar(c)}<small>{e(BYCH[c]["nom"])}</small></span>' for c in non)}</div>
      {consigne(1, 'Entoure, dans chaque mot, la lettre qui ne s’attache pas à la suivante.')}
      <div class="words">{''.join(word_box(w, False) for w in ws)}</div>
      {consigne(2, 'Recopie ces six lettres deux fois.')}
      <div class="trace">{''.join(f'<span>{ar(c)}</span>' for c in non)}</div>
      <div class="lines"><div></div><div></div></div>
      {key([f'{ar(w["ar"])} : {" ".join(ar(c) for c in base_letters(w["ar"]) if c in non)}' for w in ws])}"""
    return 'u0c', 0, 'Les lettres qui ne s’attachent pas', body


def sheet_letters(uid):
    u = UNITS[uid]
    ls = [L[i] for i in u['letters']]
    small = len(ls) > 4
    blocks = []
    for l in ls:
        lbls = dict(POS) if l['lie'] else {'seule': 'seule', 'debut': 'au début (= seule)', 'milieu': 'au milieu (= fin)', 'fin': 'à la fin'}
        forms = ''.join(f'<div>{ar(form(l["ch"], p))}<small>{e(lbls[p])}</small></div>' for p, _ in POS)
        ex = [W[i] for i in l['ex'][:2] if i in W]
        trace = ''.join(f'<span>{ar(l["ch"])}</span>' for _ in range(5)) + ''.join('<span></span>' for _ in range(3))
        note = ''
        exs = (' · '.join(f'{ar(w["ar"])} ({e(w["tr"])})' for w in ex)) if ex and not small else ''
        blocks.append(f"""<div class="letter">
            <div class="letter__big">{ar(l['ch'])}<small>{e(l['nom'])}</small></div>
            <div class="letter__main">
              <div class="letter__head"><b>{e(l['nom'])}</b> {ar(l['ar'])} — <span class="son">{tx(l['son'])}</span>{note}</div>
              <div class="forms">{forms}</div>
              <div class="trace">{trace}</div>
              {f'<div class="letter__ex">Dans le Coran : {exs}</div>' if exs else ''}
            </div>
          </div>""")
    body = f"""<div class="box"><p>{tx(u['comprendre'])}</p></div>
      {consigne(1, 'Repasse les lettres grises, puis écris-les seul dans les cases vides, de droite à gauche.')}
      <div class="{'small' if small else ''}">{''.join(blocks)}</div>"""
    return uid, 1, ar(u['titre']), body


def sheet_voyelles():
    ids = ['ba', 'ta', 'nun', 'mim', 'lam', 'kaf', 'sin', 'dal', 'ra', 'fa']
    sg = [s for s in BANK['signs'] if s['id'] in ('fatha', 'kasra', 'damma')]
    cells = ''.join(f'<div class="cell">{ar(L[i]["ch"] + s["ch"])}<span class="line"></span></div>' for i in ids for s in sg)
    cons = lambda l: l['tr'].split(' / ')[0]
    body = f"""<div class="box">{''.join(f'<p><span class="k">{e(s["nom"])}</span> {ar("ب" + s["ch"])} : {tx(s["role"])}</p>' for s in sg)}</div>
      {consigne(1, 'Lis chaque syllabe à voix haute, puis écris sa lecture en lettres latines (ex. « ba »).')}
      <div class="grid" style="grid-template-columns: repeat(6, 1fr)">{cells}</div>
      {key([f'{ar(L[i]["ch"] + s["ch"])} {e(cons(L[i]) + s["son"])}' for i in ids[:6] for s in sg] + ['…'])}"""
    return 'u2abc', 2, 'Fatḥa, kasra, ḍamma', body


def word_sheet(sid, lvn, title, intro, ws, n_lines=3, extra=''):
    body = f"""<div class="box">{intro}</div>{extra}
      {consigne(1, 'Lis chaque mot à voix haute. Vérifie ensuite avec le corrigé, puis écoute-le dans l’appli.')}
      <div class="words">{''.join(word_box(w, False) for w in ws)}</div>
      {consigne(2, 'Recopie quatre mots de ton choix, en entier, de droite à gauche.')}
      <div class="lines">{''.join('<div></div>' for _ in range(n_lines))}</div>
      {key([f'{ar(w["ar"])} {e(w["tr"])}' for w in ws])}"""
    return sid, lvn, title, body


def sheet_mots2():
    ws = spread([w for w in WORDS if w['lv'] == 2 and w['n'] <= 4], 18)
    u = UNITS['u2d']
    return word_sheet('u2d', 2, e(u['titre']), f'<p>{tx(u["comprendre"])}</p>', ws, 3)


FEAT = {'u3a': ['long_a', 'long_i', 'long_u'], 'u3b': ['sukun'], 'u3c': ['shadda'], 'u3d': ['tanwin']}


def sheet_signes(uid):
    u = UNITS[uid]
    fs = FEAT[uid]
    ws = spread([w for w in WORDS if w['lv'] == 3 and any(f in w['f'] for f in fs) and w['n'] <= 6], 16)
    sg = [s for s in BANK['signs'] if s['id'] in u['signs']]
    intro = f'<p>{tx(u["comprendre"])}</p>' + ''.join(f'<p><span class="k">{e(s["nom"])}</span> {ar("ب" + s["ch"])} : {tx(s["role"])}</p>' for s in sg)
    return word_sheet(uid, 3, e(u['titre']), intro, ws, 3)


def sheet_l4(uid):
    u = UNITS[uid]
    fs = u['feat'].split('|')
    ws = spread([w for w in WORDS if w['lv'] == 4 and any(f in w['f'] for f in fs) and w['n'] <= 7], 14)
    extra = ''
    if uid in ('u4a', 'u4b'):
        moon = [c for c in 'ابجحخعغفقكمهوي']
        sun = [c for c in 'تثدذرزسشصضطظلن']
        extra = f"""<table class="t"><tr><th>Lettres lunaires : le ل se prononce</th><td>{ar(' '.join(moon))}</td></tr>
          <tr><th>Lettres solaires : le ل ne se prononce pas</th><td>{ar(' '.join(sun))}</td></tr></table>"""
        ws = spread([w for w in WORDS if w['lv'] == 4 and ('article_sun' in w['f'] or 'article_moon' in w['f']) and w['n'] <= 7], 14)
        body = f"""<div class="box"><p>{tx(UNITS['u4a']['comprendre'])}</p><p>{tx(UNITS['u4b']['comprendre'])}</p></div>{extra}
          {consigne(1, 'Lis chaque mot. Écris L (lunaire, le ل se prononce) ou S (solaire) dessous.')}
          <div class="grid" style="grid-template-columns: repeat(4, 1fr)">{''.join(f'<div class="cell">{ar(w["ar"])}<span class="line"></span></div>' for w in ws)}</div>
          {key([f'{ar(w["ar"])} {"S" if "article_sun" in w["f"] else "L"} ({e(w["tr"])})' for w in ws])}"""
        return 'u4ab', 4, 'L’article : lettres lunaires et solaires', body
    sp = {'u4c': ['hamza', 'hamza_alif_haut', 'hamza_alif_bas', 'hamza_waw', 'hamza_ya'], 'u4d': ['ta_marbuta', 'alif_maqsura'], 'u4e': ['lam_alif'], 'u4f': []}[uid]
    rows = ''.join(f'<p><span class="k">{e(x["nom"])}</span> {ar(x["ch"])} : {tx(x["role"])}</p>' for x in BANK['special'] if x['id'] in sp)
    return word_sheet(uid, 4, e(u['titre']), f'<p>{tx(u["comprendre"])}</p>{rows}', ws, 2)


def sheet_mushaf():
    u = UNITS['u5a']
    rows = []
    for m in BANK['mushaf']:
        ex = BANK['mx'].get(m['id'])
        ref = f'<br><small>{e(sura_name(ex["s"]))} {ex["s"]}:{ex["a"]}</small>' if ex else ''
        rows.append(f'<tr><td style="text-align:center">{ar(ex_word(ex)) if ex else ar("ـ" + m["ch"])}{ref}</td><td><b>{e(m["nom"])}</b><br>{tx(m["role"])}</td></tr>')
    body = f"""<div class="box"><p>{tx(u['comprendre'])}</p></div>
      <table class="t"><tr><th style="width:42mm">Exemple du mushaf</th><th>Signe et lecture</th></tr>{''.join(rows)}</table>
      {consigne(1, 'Dans chaque exemple, repère le signe et lis le mot à voix haute ; vérifie avec l’audio dans l’appli.')}"""
    return 'u5a', 5, 'Du manuel au mushaf', body


def sheet_pauses():
    u = UNITS['u5b']
    rows = ''.join(f'<tr><td style="text-align:center">{ar(ex_word(BANK["mx"][s["id"]])) if s["id"] in BANK["mx"] else ar("ـ" + s["ch"])}</td><td><b>{e(s["nom"])}</b><br>{tx(s["role"])}</td></tr>' for s in BANK['stops'])
    ps = [p for p in BANK['passages'] if p['lv'] == 5 and p['p']]
    ps = spread(ps, 2)
    pas = ''.join(f'<div class="passage"><p>{e(verse(p["s"], p["a"]))}</p><small>{e(sura_name(p["s"]))} {p["s"]}:{p["a"]} — entoure les signes de pause</small></div>' for p in ps)
    body = f"""<div class="box"><p>{tx(u['comprendre'])}</p></div>
      <table class="t"><tr><th style="width:28mm">Signe</th><th>Sens</th></tr>{rows}</table>
      {consigne(1, 'Lis ces versets en respectant les arrêts. Entoure chaque signe de pause.')}
      {pas}"""
    return 'u5b', 5, 'Les signes de pause', body


def sheet_passages(lvn, sid, title, intro, n=3, log=False):
    ps = spread([p for p in BANK['passages'] if p['lv'] == lvn and p['n'] <= 12], n)
    pas = ''.join(f'<div class="passage"><p>{e(verse(p["s"], p["a"]))}</p><small>{e(sura_name(p["s"]))} {p["s"]}:{p["a"]}</small></div>' for p in ps)
    crit = '<div class="check"><span>Tous les mots justes</span><span>Peu d’hésitations</span><span>Sans reprendre en arrière</span><span>Arrêts respectés</span></div>'
    table = ''
    if log:
        table = '<table class="t"><tr><th>Date</th><th>Temps de lecture</th><th>Mots justes</th><th>Hésitations</th><th>Continuité</th></tr>' + ''.join('<tr><td style="height:9mm"></td><td></td><td></td><td></td><td></td></tr>' for _ in range(5)) + '</table>'
    body = f"""<div class="box"><p>{tx(intro)}</p></div>
      {consigne(1, 'Lis chaque passage par petits groupes, écoute-le dans l’appli, puis relis-le d’une traite.')}
      {pas}
      {consigne(2, 'Ton bilan (auto-évaluation) :')}{crit}{table}"""
    return sid, lvn, title, body


def sheets():
    out = [sheet_sens(), sheet_parties(), sheet_liaisons()]
    out += [sheet_letters(u['id']) for u in LEVEL[1]['units']]
    out += [sheet_voyelles(), sheet_mots2()]
    out += [sheet_signes(u) for u in ('u3a', 'u3b', 'u3c', 'u3d')]
    out += [sheet_l4('u4a')] + [sheet_l4(u) for u in ('u4c', 'u4d', 'u4e', 'u4f')]
    out += [sheet_mushaf(), sheet_pauses(),
            sheet_passages(5, 'u5d', 'Lire un passage avec ses arrêts', UNITS['u5d']['comprendre'], 3)]
    out += [sheet_passages(6, 'u6a', 'Cycle de fluidité', UNITS['u6a']['comprendre'], 2, log=True)]
    out += [sheet_passages(7, 'u7a', 'Passages peu familiers', UNITS['u7a']['comprendre'], 3)]
    return out


DESC = {
    'u0a': 'Lire de droite à gauche : écrire les lettres dans l’ordre.', 'u0b': 'Compter les points, repérer les signes.',
    'u0c': 'Les six lettres qui ne s’attachent pas.', 'u2abc': '30 syllabes à lire et transcrire.', 'u2d': 'Mots courts à lire et recopier.',
    'u4ab': 'Classer des mots : lunaire ou solaire.', 'u5a': 'Les signes du mushaf avec un exemple.', 'u5b': 'Signes de pause et deux versets.',
    'u5d': 'Trois passages à lire avec leurs arrêts.', 'u6a': 'Deux passages et un carnet de lecture sur 5 jours.', 'u7a': 'Trois passages peu familiers et ton bilan.',
}


def unit_of(sid):
    return {'u2abc': 'u2a', 'u4ab': 'u4a'}.get(sid, sid)


def main():
    os.makedirs(OUT, exist_ok=True)
    css = CSS % {'fonts': 'file://' + FONTS} + 'bdi.ar { font-size: 1.12em; }'
    items = sheets()
    manifest = []
    with sync_playwright() as p:
        br = p.chromium.launch()
        ctx = br.new_context(viewport={'width': 794, 'height': 1123}, device_scale_factor=1.6)
        pg = ctx.new_page()
        overflow = []

        def render(htmlbody, eco, path_pdf=None, path_png=None):
            doc = f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>{css}</style></head><body class="{"eco" if eco else "couleur"}">{fr_nb(htmlbody)}</body></html>'
            tmp = os.path.join(OUT, '_tmp.html')
            open(tmp, 'w', encoding='utf-8').write(doc)
            pg.goto('file://' + tmp)
            pg.evaluate('document.fonts.ready')
            pg.wait_for_timeout(150)
            over = pg.evaluate("[...document.querySelectorAll('.sheet')].map((s) => { const b = s.querySelector('.body'); return Math.max(0, b.scrollHeight - b.clientHeight); })")
            if any(o > 4 for o in over):
                overflow.append((path_pdf or '?', over))
            if path_pdf:
                pg.pdf(path=path_pdf, format='A4', print_background=True, margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
            if path_png:
                pg.screenshot(path=path_png, full_page=False, clip={'x': 0, 'y': 0, 'width': 794, 'height': 1123})
            os.remove(tmp)

        by_level = {}
        problems = []
        for sid, lvn, title_html, body in items:
            entry = {'id': sid, 'lv': lvn, 'unit': unit_of(sid), 'titre': html.unescape(title_html.replace('<span class="ar " lang="ar" dir="rtl">', '').replace('</span>', '')),
                     'desc': DESC.get(sid, 'Lettres à repasser et à écrire, formes selon la place, mots exemples.' if lvn == 1 else 'Mots à lire et à recopier, avec corrigé.')}
            for ver, eco in (('couleur', False), ('eco', True)):
                stem = f'{sid}-{ver}'
                pdf = os.path.join(OUT, stem + '.pdf')
                png = os.path.join(OUT, stem + '.png')
                html_page = page(sid, lvn, title_html, body, eco)
                render(html_page, eco, pdf, png)
                # contrôles : une seule page, polices intégrées
                r = PdfReader(pdf)
                if len(r.pages) != 1:
                    problems.append(f'{stem} : {len(r.pages)} pages')
                fonts = set()
                for pg_ in r.pages:
                    res = pg_.get('/Resources') or {}
                    for f in (res.get('/Font') or {}).values():
                        fonts.add(str(f.get_object().get('/BaseFont')))
                if not any('Amiri' in f for f in fonts):
                    problems.append(f'{stem} : police arabe non intégrée ({fonts})')
                im = Image.open(png).convert('RGB')
                im = im.quantize(colors=48, method=Image.Quantize.MEDIANCUT)
                im.save(png, optimize=True)
                th = Image.open(png).convert('RGB')
                th.thumbnail((240, 340))
                th.save(os.path.join(OUT, stem + '.webp'), quality=72)
                entry[ver] = {'pdf': f'coran/fiches/{stem}.pdf', 'png': f'coran/fiches/{stem}.png', 'thumb': f'coran/fiches/{stem}.webp'}
            manifest.append(entry)
            by_level.setdefault(lvn, []).append((sid, title_html, body))
        # cahier par niveau : toutes les fiches du niveau dans un seul PDF
        cahiers = []
        for lvn, lst in sorted(by_level.items()):
            if len(lst) < 2:
                continue                      # une seule fiche : pas de cahier en double
            entry = {'id': f'cahier-{lvn}', 'lv': lvn, 'unit': None, 'titre': f'Cahier du niveau {lvn}', 'desc': f'Les {len(lst)} fiches du niveau dans un seul PDF.', 'cahier': True}
            for ver, eco in (('couleur', False), ('eco', True)):
                stem = f'cahier-{lvn}-{ver}'
                pdf = os.path.join(OUT, stem + '.pdf')
                render(''.join(page(sid, lvn, t, b, eco) for sid, t, b in lst), eco, pdf, None)
                n = len(PdfReader(pdf).pages)
                if n != len(lst):
                    problems.append(f'{stem} : {n} pages pour {len(lst)} fiches')
                first = next(x for x in manifest if x['lv'] == lvn)
                entry[ver] = {'pdf': f'coran/fiches/{stem}.pdf', 'png': first[ver]['png'], 'thumb': first[ver]['thumb']}
            cahiers.append(entry)
        br.close()
    out = {'format': 1, 'version': BANK['version'],
           'note': 'Fiches produites à partir de la banque de l’appli (lettres, mots du Coran en écriture adaptée, passages Tanzil). Les modèles à repasser sont la lettre de la police en gris : ils ne montrent pas l’ordre des traits. Fiches non relues par un enseignant.',
           'fiches': sorted(cahiers + manifest, key=lambda x: (x['lv'], 0 if x.get('cahier') else 1))}
    json.dump(out, open(os.path.join(OUT, 'fiches.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f'{len(manifest)} fiches × 2 versions + {len(cahiers)} cahiers ; {total / 1e6:.1f} Mo')
    problems += [f'{os.path.basename(pth)} : contenu coupé ({o})' for pth, o in overflow]
    if problems:
        print('PROBLÈMES :'); [print(' -', x) for x in problems]; sys.exit(1)
    print('OK : chaque fiche tient sur une page, police arabe intégrée.')


if __name__ == '__main__':
    main()
