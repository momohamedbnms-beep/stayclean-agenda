#!/usr/bin/env python3
"""Mon Coran — construit les fichiers de l'appli (coran/data/) à partir des sources brutes.

Aucun texte n'est écrit à la main ici : chaque verset, translittération, traduction et note
vient tel quel d'un fichier de coran/sources/raw/ dont l'empreinte SHA-256 est vérifiée.

    python3 coran/sources/build.py          # depuis la racine du dépôt

Le script s'arrête au moindre écart (empreinte, nombre de versets, numérotation, notes).
"""
import hashlib
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, 'coran', 'sources', 'raw')
OUT = os.path.join(ROOT, 'coran', 'data')
SOURCES = json.load(open(os.path.join(ROOT, 'coran', 'sources', 'SOURCES.json'), encoding='utf-8'))


def fail(msg):
    print('ERREUR :', msg)
    sys.exit(1)


def read_raw(key):
    src = SOURCES['files'][key]
    path = os.path.join(RAW, src['file'])
    b = open(path, 'rb').read()
    h = hashlib.sha256(b).hexdigest()
    if h != src['sha256']:
        fail(f'{src["file"]} : empreinte {h} ≠ {src["sha256"]}')
    return b.decode('utf-8')


# ---------- Tanzil : texte arabe (Uthmani, Hafs) ----------
quran_txt = read_raw('quran')
lines = quran_txt.split('\n')
copyright_block = '\n'.join(l for l in lines if l.startswith('#')).strip()
if 'Tanzil Quran Text (Uthmani, Version 1.1)' not in copyright_block:
    fail('bloc de copyright Tanzil introuvable ou version inattendue')
AR = {}
for l in lines:
    if not l or l.startswith('#'):
        continue
    s, a, t = l.split('|', 2)
    AR[(int(s), int(a))] = t
if len(AR) != 6236:
    fail(f'{len(AR)} versets arabes au lieu de 6236')

# ---------- Tanzil : métadonnées (sourates, juz, pages du mushaf de Médine) ----------
meta_js = read_raw('meta')


def js_block(name):
    m = re.search(r'QuranData\.' + name + r' = \[(.*?)\n\];', meta_js, re.S)
    if not m:
        fail('bloc ' + name + ' absent des métadonnées')
    return m.group(1)


SURA_META = re.findall(r"\[(\d+), (\d+), (\d+), (\d+), '([^']*)', \"([^\"]*)\", '([^']*)', '(\w+)'\]", js_block('Sura'))
if len(SURA_META) != 114:
    fail('métadonnées : 114 sourates attendues')
JUZ = [tuple(map(int, x)) for x in re.findall(r'\[(\d+), (\d+)\]', js_block('Juz'))]
PAGES = [tuple(map(int, x)) for x in re.findall(r'\[(\d+), (\d+)\]', js_block('Page'))]
SAJDA = [(int(a), int(b), c) for a, b, c in re.findall(r"\[(\d+), (\d+), '(\w+)'\]", js_block('Sajda'))]
# Juz et Page se terminent par une borne de fin [115, 1]
if JUZ[-1] != (115, 1) or len(JUZ) != 31:
    fail(f'juz : {len(JUZ)} bornes')
if PAGES[-1] != (115, 1) or len(PAGES) != 605:
    fail(f'pages : {len(PAGES)} bornes')
JUZ, PAGES = JUZ[:-1], PAGES[:-1]

ayas_count = {i + 1: int(r[1]) for i, r in enumerate(SURA_META)}
for s in range(1, 115):
    got = sum(1 for (ss, _) in AR if ss == s)
    if got != ayas_count[s]:
        fail(f'sourate {s} : {got} versets, métadonnées {ayas_count[s]}')
    for a in range(1, ayas_count[s] + 1):
        if (s, a) not in AR:
            fail(f'verset {s}:{a} manquant')

ORDER = [(s, a) for s in range(1, 115) for a in range(1, ayas_count[s] + 1)]
INDEX = {k: i for i, k in enumerate(ORDER)}


def assign(bounds):
    out = {}
    starts = [INDEX[b] for b in bounds]
    if starts != sorted(starts) or starts[0] != 0:
        fail('bornes non croissantes')
    starts.append(len(ORDER))
    for n in range(len(bounds)):
        for i in range(starts[n], starts[n + 1]):
            out[ORDER[i]] = n + 1
    return out


PAGE_OF = assign(PAGES)
JUZ_OF = assign(JUZ)
if PAGE_OF[(114, 6)] != 604 or JUZ_OF[(78, 1)] != 30 or JUZ_OF[(77, 50)] != 29:
    fail('contrôle pages/juz')

# ---------- Basmala : en tête du verset 1 dans le texte Tanzil (sourates 2 à 114 sauf 9) ----------
BASMALA = AR[(1, 1)].split(' ')
# Variante présente telle quelle dans le texte source (sourates 95 et 97) : chadda sur le ba.
# Écrite en points de code pour éviter toute ambiguïté de saisie.
BASMALA_SHADDA_BA = 'بِّسْمِ'
basmala_tokens = {}
for s in range(2, 115):
    toks = AR[(s, 1)].split(' ')
    head = toks[:4]
    is_b = head[1:] == BASMALA[1:] and head[0] in (BASMALA[0], BASMALA_SHADDA_BA)
    if s == 9:
        if is_b:
            fail('la sourate 9 ne doit pas commencer par la basmala')
        continue
    if not is_b or len(toks) < 5:
        fail(f'basmala attendue en tête de {s}:1')
    basmala_tokens[s] = 4

# ---------- Tanzil : translittération (en.transliteration) ----------
tl_txt = read_raw('translit')
TL = {}
tl_header = '\n'.join(l for l in tl_txt.split('\n') if l.startswith('#')).strip()
for l in tl_txt.split('\n'):
    if not l or l.startswith('#'):
        continue
    s, a, t = l.split('|', 2)
    TL[(int(s), int(a))] = t
if set(TL) != set(AR):
    fail('translittération : versets différents du texte arabe')
for k, t in TL.items():
    stack = []
    for m in re.finditer(r'<(/?)([a-zA-Z]+)>', t):
        tag = m.group(2).lower()
        if tag not in ('u', 'b', 'i', 'strong'):
            fail(f'balise inattendue {tag} en {k}')
        if m.group(1):
            if not stack or stack.pop() != tag:
                fail(f'balises mal fermées en {k}')
        else:
            stack.append(tag)
    if stack:
        fail(f'balises non fermées en {k}')

# ---------- QuranEnc : traduction française (Rachid Maach) ----------
qe = json.loads(read_raw('translation'))
info = qe['list']
if info.get('key') != 'french_rashid':
    fail('traduction inattendue')
FR, FN = {}, {}
for s_key, rows in qe['suras'].items():
    for r in rows:
        k = (int(r['sura']), int(r['aya']))
        FR[k] = r['translation']
        FN[k] = r['footnotes']
if set(FR) != set(AR):
    fail('traduction : versets différents du texte arabe')
for k in FR:
    marks = sorted(re.findall(r'\[(\d+)\]', FR[k]))
    notes = sorted(re.findall(r'^\[(\d+)\]', FN[k], re.M))
    if marks != notes:
        fail(f'notes du traducteur incohérentes en {k}')
    if not FR[k].strip():
        fail(f'traduction vide en {k}')

# ---------- Wikipédia : noms des sourates en français ----------
wp = json.loads(read_raw('names'))
rows = wp['wikitext'].split('\n|-')[1:]
if len(rows) != 114:
    fail('liste Wikipédia : 114 lignes attendues')
NAMES = {}
for row in rows:
    cells = [c.strip() for c in row.strip().lstrip('|').strip().split('||')]
    n, nv = int(cells[0]), int(cells[1])
    if nv != ayas_count[n]:
        fail(f'Wikipédia : sourate {n} {nv} versets ≠ {ayas_count[n]}')
    fr_cell = re.sub(r'^align="[a-z]+"\s*\|', '', cells[5]).strip()
    link = re.search(r'\[\[([^\]|]+)(?:\|([^\]]*))?\]\]', fr_cell)
    shown = re.sub(r'\[\[([^\]|]+)\|([^\]]*)\]\]', r'\2', fr_cell)
    shown = re.sub(r'\[\[([^\]|]+)\]\]', r'\1', shown)
    variants = [v.strip() for v in shown.split(',') if v.strip()]
    canon = re.sub(r'\s*\(sourate\)$', '', wp['resolved'][link.group(1)])
    wtl = re.sub(r'^align="[a-z]+"\s*\|', '', cells[7]).strip()
    NAMES[n] = {'name': canon, 'frAll': variants, 'wtl': wtl}


def fold(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.lower().replace('’', "'").replace('ʿ', '').replace('ʾ', '')
    s = re.sub(r"^(al|an|ar|as|ash|at|ad|az|ach)[-\s]", '', s)
    return re.sub(r"[^a-z]", '', s)


def subtitle(n):
    """Premier titre français qui n'est pas la simple reprise du nom translittéré."""
    nm = fold(NAMES[n]['name'])
    for v in NAMES[n]['frAll']:
        if fold(v) != nm and fold(v) != fold(NAMES[n]['wtl']):
            return v[0].upper() + v[1:]
    return ''


PAUSE_MARKS = 'ۖۗۘۙۚۛۜ'


def word_count(t):
    return sum(1 for w in t.split(' ') if w and not all(c in PAUSE_MARKS + '۩۞' for c in w))


# ---------- Écriture ----------
os.makedirs(os.path.join(OUT, 's'), exist_ok=True)
NOTICE = {
    'arabe': {
        'source': 'Tanzil Project — https://tanzil.net',
        'edition': 'Tanzil Quran Text (Uthmani, Version 1.1), lecture de Hafs selon ʿĀṣim, numérotation koufie (6236 versets)',
        'options': 'marques de pause, signes de prosternation, tatweel sous les alifs suscrits ; sans signes de rub el-hizb',
        'copyright': copyright_block,
        'basmala': 'Dans le texte source, la basmala ouvre le verset 1 des sourates 2 à 114 (sauf 9). '
                   'Le texte est conservé tel quel ; l\'appli affiche ces 4 premiers mots comme titre de la sourate.',
    },
    'traduction': {
        'titre': info.get('title'), 'traducteur': 'Rachid Maach (' + info.get('description', '') + ')',
        'cle': info.get('key'), 'version': info.get('version'), 'derniere_mise_a_jour_unix': info.get('last_update'),
        'source': 'QuranEnc.com — https://quranenc.com/fr/browse/french_rashid',
        'conditions': 'Texte et notes reproduits sans modification, avec le nom du traducteur, la source et le numéro de version (conditions d\'utilisation de QuranEnc).',
    },
    'translitteration': {
        'source': 'Tanzil Project — https://tanzil.net/trans/en.transliteration',
        'entete': tl_header,
        'convention': 'Translittération anglaise (2010) avec balisage d\'origine : <u> son propre à l\'arabe ou voyelle longue, '
                      '<i> distingue certaines lettres, <b>/<strong> lettres écrites mais non prononcées.',
        'conditions': 'Traductions Tanzil : usage non commercial uniquement.',
    },
}

suras_index = []
for i, r in enumerate(SURA_META):
    s = i + 1
    n = ayas_count[s]
    keys = [(s, a) for a in range(1, n + 1)]
    pages = [PAGE_OF[k] for k in keys]
    juzs = [JUZ_OF[k] for k in keys]
    data = {
        'n': s,
        'bsm': basmala_tokens.get(s, 0),
        'ar': [AR[k] for k in keys],
        'tl': [TL[k] for k in keys],
        'fr': [FR[k] for k in keys],
        'fn': [FN[k] for k in keys],
        'pg': pages,
        'jz': juzs,
        'notice': NOTICE,
    }
    with open(os.path.join(OUT, 's', f'{s:03d}.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    words = sum(word_count(AR[k]) for k in keys) - (4 if basmala_tokens.get(s) else 0)
    suras_index.append({
        'n': s, 'ar': r[4], 'tn': r[5], 'name': NAMES[s]['name'], 'sub': subtitle(s), 'frAll': NAMES[s]['frAll'],
        'wtl': NAMES[s]['wtl'], 'ayas': n, 'type': r[7], 'order': int(r[2]),
        'p1': pages[0], 'p2': pages[-1], 'j1': juzs[0], 'j2': juzs[-1], 'words': words,
    })

index = {
    'format': 1,
    'sources': SOURCES['files'],
    'notice': {
        'arabe': NOTICE['arabe'],
        'traduction': NOTICE['traduction'],
        'translitteration': {k: v for k, v in NOTICE['translitteration'].items()},
        'noms': {
            'source': 'Wikipédia en français, Modèle:Palette Sourate/liste, révision ' + str(wp['revid']) + ' (' + wp['timestamp'] + ')',
            'lien': 'https://fr.wikipedia.org/w/index.php?title=Mod%C3%A8le:Palette_Sourate/liste&oldid=' + str(wp['revid']),
            'licence': 'CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/deed.fr',
            'modifications': 'Extraction des titres français et des titres d\'articles (sans « (sourate) »).',
        },
        'metadonnees': {
            'source': 'Tanzil Quran Metadata 1.0 — https://tanzil.net/docs/quran_metadata (CC BY 3.0)',
            'pages': 'Pages du Mushaf de Médine (604 pages) telles que définies par ces métadonnées.',
        },
    },
    'suras': suras_index,
    'juz': [{'n': i + 1, 's': s, 'a': a} for i, (s, a) in enumerate(JUZ)],
    'pages': [[s, a] for (s, a) in PAGES],
    'sajda': [{'s': s, 'a': a, 'type': t} for (s, a, t) in SAJDA],
}
with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, separators=(',', ':'))

print('OK : 114 sourates, 6236 versets, 604 pages, 30 juz')
