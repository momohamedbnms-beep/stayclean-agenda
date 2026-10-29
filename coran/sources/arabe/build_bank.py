#!/usr/bin/env python3
"""Construit la banque de contenus vérifiés de « Lire et écrire l'arabe » (coran/data/arabe/banque.json).

Rien n'est inventé :
- les lettres et signes viennent de lettres.py (références citées) ;
- les MOTS viennent tous du texte coranique Tanzil (Uthmani, Hafs) déjà présent dans l'appli, avec leur
  emplacement exact (sourate, verset, rang du mot) et leur audio : récitation pédagogique d'Al-Husary
  (« Al-Mu'allim », EveryAyah), mot isolé grâce aux repères quran-align (CC BY 4.0) ;
- l'écriture « pédagogique » d'un mot n'est produite que par des équivalences d'écriture sûres entre le
  mushaf et l'écriture usuelle (alif waṣla → alif ; yā' sans points → yā' ; alif maqṣūra marqué) ; tout
  mot dont l'écriture du mushaf diffère autrement (petit alif, petits signes, madda…) est écarté des
  niveaux 2 à 4 et réservé au passage vers le mushaf (niveau 5) ;
- la transcription latine est calculée par règles à partir des voyelles écrites (tests en bas du fichier).

Usage : python3 build_bank.py  (écrit coran/data/arabe/banque.json et affiche les contrôles)
"""
import json, os, re, sys, hashlib, unicodedata
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lettres as L  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'coran', 'data', 'arabe', 'banque.json')
SIGN = re.compile(r'^[ۖ-ۜ۞۩]+$')
FOLDER = 'Husary_Muallim_128kbps'

FATHA, KASRA, DAMMA, SUKUN, SHADDA = 'َ', 'ِ', 'ُ', 'ْ', 'ّ'
FATHATAN, KASRATAN, DAMMATAN = 'ً', 'ٍ', 'ٌ'
SHORT = {FATHA: 'a', KASRA: 'i', DAMMA: 'u'}
TANWIN = {FATHATAN: 'an', KASRATAN: 'in', DAMMATAN: 'un'}
HARAKAT = set([FATHA, KASRA, DAMMA, SUKUN, SHADDA, FATHATAN, KASRATAN, DAMMATAN])
WASLA, DAGGER, MADDA, HAMZA_ABOVE = 'ٱ', 'ٰ', 'ٓ', 'ٔ'
BASE = {l[1]: l for l in L.LETTERS}
CONS = {  # transcription des consonnes
    'ء': 'ʾ', 'أ': 'ʾ', 'إ': 'ʾ', 'ؤ': 'ʾ', 'ئ': 'ʾ', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'ḥ', 'خ': 'kh',
    'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 'ṣ', 'ض': 'ḍ', 'ط': 'ṭ', 'ظ': 'ẓ', 'ع': 'ʿ',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y', 'ة': 't',
}
SUN = set('تثدذرزسشصضطظلن')
LETTERS_OK = set('ءأإؤئآابتثجحخدذرزسشصضطظعغفقكلمنهوية' + 'ى')
ALLOWED_UTH = (LETTERS_OK - {'آ'}) | HARAKAT | {WASLA, DAGGER}


def pedagogical(tok):
    """Écriture usuelle d'un mot du mushaf, ou None si l'équivalence n'est pas sûre.
    Renvoie la forme de travail où l'alif waṣla reste ٱ (muet en liaison) ; l'affichage remplace ٱ par ا."""
    if any(c not in ALLOWED_UTH for c in tok):
        return None
    s = tok
    if s.startswith('ءَا'):
        s = 'آ' + s[3:]                        # hamza + fatḥa + alif du mushaf = alif madda de l'écriture usuelle
    if s.endswith('ى' + DAGGER):
        s = s[:-1]                              # alif maqṣūra marqué du petit alif : ى usuel (lu « â »)
    if DAGGER in s:
        return None                             # petit alif ailleurs : l'écriture usuelle ajoute un alif → écarté
    u = units(s)
    if not u or SHADDA in u[0][1]:
        return None                             # shadda initiale = assimilation avec le mot précédent (liaison)
    out = []
    n = len(u)
    for i, (c, m) in enumerate(u):
        last = i == n - 1
        prev = u[i - 1] if i else None
        if c == 'ى':
            if last and not m and prev and FATHA in prev[1]:
                out.append(('ى', m)); continue  # alif maqṣūra (lu « â » ; s'abrège devant une liaison)
            if last and not m and prev and FATHATAN in prev[1]:
                out.append(('ى', m)); continue  # muet après tanwīn (hudan)
            c = 'ي'                             # yā' sans points du mushaf
        bare = not m
        if bare and c not in 'اىٱآ' and c in CONS:
            is_madd = (c == 'و' and prev and DAMMA in prev[1]) or (c == 'ي' and prev and KASRA in prev[1])
            sun_lam = c == 'ل' and prev and prev[0] in 'ٱا' and i + 1 < n and SHADDA in u[i + 1][1]
            if not is_madd and not sun_lam and c != 'ة':
                m = [SUKUN]                     # consonne nue du mushaf (assimilation, dissimulation) : sukūn de l'écriture usuelle
        out.append((c, m))
    return ''.join(c + ''.join(m) for c, m in out)


def display(w):
    return w.replace(WASLA, 'ا')


def units(word):
    """Découpe en lettres porteuses + signes : [(lettre, [signes])]"""
    res = []
    for c in word:
        if c in HARAKAT:
            if not res:
                return None
            res[-1][1].append(c)
        else:
            res.append([c, []])
    return res


def translit(word):
    """Transcription latine d'un mot entièrement vocalisé (forme de travail : ٱ = alif de liaison muet)."""
    u = units(word)
    if not u:
        return None
    u = [list(x) for x in u]
    out = []
    pre = ''
    # préfixe d'une lettre (wa-, fa-, bi-, li-, ka-) devant un alif de liaison
    if len(u) >= 3 and u[0][0] in 'وفبلك' and len(u[0][1]) == 1 and u[0][1][0] in SHORT and u[1][0] == WASLA:
        pre = CONS[u[0][0]] + SHORT[u[0][1][0]]
        u = u[1:]
    n = len(u)
    i = 0
    no_double = -1
    if u[0][0] == WASLA:
        if u[0][1]:
            return None
        if n >= 3 and u[1][0] == 'ل':
            lam_m = u[1][1]
            nxt = u[2]
            vows = [x for x in lam_m if x in SHORT]
            if not lam_m and SHADDA in nxt[1] and nxt[0] in SUN:
                out.append((pre or 'a') + CONS[nxt[0]] + '-')      # ash-shamsi / wash-shamsi
                no_double = 2
            elif lam_m == [SUKUN]:
                out.append((pre or 'a') + 'l-')                     # al-ḥamdu / wal-ḥamdu
            elif SHADDA in lam_m and len(vows) == 1 and len(lam_m) == 2:
                out.append((pre or 'a') + 'l-l' + SHORT[vows[0]])   # al-ladhī / wal-ladhīna
            else:
                return None
            i = 2
        else:
            if not pre:
                return None                                         # waṣla initiale hors article : lecture variable, écartée
            out.append(pre)                                         # waṣla muette après un préfixe (wa-shhad)
            i = 1
    elif pre:
        return None
    while i < n:
        c, m = u[i]
        prev = u[i - 1] if i > 0 else None
        last = i == n - 1
        if c == 'ا':
            if prev and FATHA in prev[1] and not m:
                out.append('ā'); i += 1; continue                  # â (remplace le a bref déjà écrit)
            if prev and FATHATAN in prev[1] and not m and last:
                i += 1; continue                                    # alif muet du tanwīn fatḥ
            if prev and prev[0] == 'و' and not prev[1] and last and i >= 2 and DAMMA in u[i - 2][1]:
                i += 1; continue                                    # alif muet après le wāw du pluriel
            return None
        if c == 'آ':
            out.append('ā' if i == 0 else 'ʾā'); i += 1; continue
        if c == 'ى':
            if last and prev and FATHA in prev[1] and not m:
                out.append('ā'); i += 1; continue
            if last and prev and FATHATAN in prev[1] and not m:
                i += 1; continue
            return None
        if c in ('و', 'ي') and not m and prev:
            if c == 'و' and DAMMA in prev[1]:
                out.append('ū'); i += 1; continue
            if c == 'ي' and KASRA in prev[1]:
                out.append('ī'); i += 1; continue
        if c not in CONS:
            return None
        cons = CONS[c]
        if c in 'أإ' and i == 0 and not out:
            cons = ''                                               # attaque de voyelle en début de mot : non notée
        if c == 'ة' and not m:
            return None
        if SHADDA in m and i != no_double:
            out.append(cons + cons)
        else:
            out.append(cons)
        vow = [x for x in m if x != SHADDA]
        if len(vow) > 1:
            return None
        if vow:
            v = vow[0]
            if v in SHORT:
                out.append(SHORT[v])
            elif v in TANWIN:
                out.append(TANWIN[v])
        elif not last:
            return None
        i += 1
    s = ''.join(out)
    return s.replace('aā', 'ā').replace('iī', 'ī').replace('uū', 'ū')


def features(word):
    """Ce que le mot exige de savoir lire (forme de travail, ٱ = alif de liaison)."""
    u = units(word)
    f = set()
    letters = set()
    for idx, (c, m) in enumerate(u):
        letters.add('ا' if c == WASLA else c)
        prev = u[idx - 1] if idx else None
        if c in 'ءأإؤئآ':
            f.add('hamza')
        if c == 'آ':
            f.add('madda')
        if c == 'ة':
            f.add('ta_marbuta')
        if c == 'ى':
            f.add('alif_maqsura')
        if c == WASLA:
            f.add('wasla')
        if c == 'ا' and prev and FATHA in prev[1]:
            f.add('long_a')
        if c in 'وي' and not m and prev:
            if (c == 'و' and DAMMA in prev[1]) or (c == 'ي' and KASRA in prev[1]):
                f.add('long_u' if c == 'و' else 'long_i')
        if SUKUN in m:
            f.add('sukun')
        if SHADDA in m:
            f.add('shadda')
        if any(t in m for t in TANWIN):
            f.add('tanwin')
        if c == 'ل' and idx + 1 < len(u) and u[idx + 1][0] in 'اأإآ':
            f.add('lam_alif')
    # article (avec ou sans préfixe d'une lettre)
    for k in (0, 1):
        if len(u) >= k + 3 and u[k][0] == WASLA and u[k + 1][0] == 'ل':
            if SHADDA in u[k + 1][1]:
                f.add('relatif')                 # الَّذِي، الَّتِي، الَّذِينَ : un seul lām doublé (écriture particulière)
            else:
                f.add('article_sun' if SHADDA in u[k + 2][1] and not u[k + 1][1] else 'article_moon')
    return sorted(f), sorted(letters)


def level_of(word, feats):
    u = units(word)
    only_short = all((len([x for x in m if x in SHORT]) == 1 and len(m) == 1) for c, m in u)
    if only_short and not set(feats) and all(c in BASE and c != 'ا' for c, m in u):
        return 2
    allowed3 = {'sukun', 'shadda', 'tanwin', 'long_a', 'long_i', 'long_u'}
    if set(feats) <= allowed3 and all((c in BASE) for c, m in u):
        return 3
    return 4


def load_quran():
    data = {}
    for s in range(1, 115):
        d = json.load(open(os.path.join(ROOT, 'coran', 'data', 's', '%03d.json' % s), encoding='utf-8'))
        t = json.load(open(os.path.join(ROOT, 'coran', 'data', 'timing', FOLDER, '%03d.json' % s), encoding='utf-8'))
        data[s] = (d, t)
    return data


def tokens_of(d, a):
    toks = d['ar'][a - 1].split(' ')
    if a == 1 and d['bsm']:
        toks = toks[d['bsm']:]
    return toks


def main():
    Q = load_quran()
    words = {}        # écriture pédagogique → entrée (première occurrence avec un audio net)
    occ = Counter()
    rejected = Counter()
    for s in range(1, 115):
        d, t = Q[s]
        for a in range(1, len(d['ar']) + 1):
            toks = tokens_of(d, a)
            segs = t['v'][a - 1]
            single = {g[0]: (g[2], g[3]) for g in segs if g[1] - g[0] == 1}
            k = -1
            for ti, tok in enumerate(toks):
                if SIGN.match(tok):
                    continue
                k += 1
                ped = pedagogical(tok)
                if not ped:
                    rejected['écriture du mushaf différente ou liaison'] += 1
                    continue
                if 'لله' in ped.replace(SHADDA, '').replace(FATHA, '').replace(KASRA, '').replace(DAMMA, ''):
                    rejected['nom divin (lecture particulière)'] += 1
                    continue
                tr = translit(ped)
                if not tr:
                    rejected['transcription non sûre'] += 1
                    continue
                key = display(ped)
                occ[key] += 1
                if key in words:
                    continue
                if k not in single:
                    rejected['pas de repère audio mot seul'] += 1
                    continue
                t0, t1 = single[k]
                if t1 - t0 < 250:
                    rejected['audio trop court'] += 1
                    continue
                feats, letters = features(ped)
                nxt_pause = ti + 1 < len(toks) and SIGN.match(toks[ti + 1]) is not None
                words[key] = {
                    'ar': key, 'uth': tok, 'tr': tr, 'loc': [s, a, k], 'clip': [max(0, t0 - 40), t1 + 60],
                    'f': feats, 'l': letters, 'lv': level_of(ped, feats), 'n': len([c for c in key if c not in HARAKAT]),
                    'edge': (k == 0) or nxt_pause or (k == len([x for x in toks if not SIGN.match(x)]) - 1),
                }
    for w in words.values():
        w['occ'] = occ[w['ar']]
    print('mots retenus :', len(words), '· rejets :', dict(rejected))
    by_lv = Counter(w['lv'] for w in words.values())
    print('par niveau :', dict(by_lv))
    return words


def letter_names(Q):
    """Noms de lettres récités seuls dans le Coran (lettres isolées en ouverture de sourate)."""
    out = {}
    for s, a, ch, lid in [(38, 1, 'صٓ', 'sad'), (50, 1, 'قٓ', 'qaf'), (68, 1, 'نٓ', 'nun')]:
        d, t = Q[s]
        toks = tokens_of(d, a)
        assert toks[0] == ch, (s, a, toks[0])
        seg = [g for g in t['v'][a - 1] if g[0] == 0 and g[1] == 1]
        if seg:
            out[lid] = {'loc': [s, a, 0], 'clip': [max(0, seg[0][2] - 40), seg[0][3] + 80], 'uth': ch}
    return out


def pick(words, pred, n, key):
    pool = [w for w in words if pred(w)]
    pool.sort(key=key)
    return pool[:n]


def build(words, Q):
    import programme as P
    ws = list(words.values())
    rank = lambda w: (-min(w['occ'], 30), not w['edge'], w['n'], w['loc'])   # fréquent, net, court
    chosen = {}
    def add(lst):
        for w in lst:
            chosen[w['ar']] = w
    # niveau 2 : voyelles brèves seules, mots courts
    add(pick(ws, lambda w: w['lv'] == 2 and w['n'] <= 5, 320, rank))
    # niveau 3 : par signe, et couverture de chaque lettre
    for feat in ['long_a', 'long_i', 'long_u', 'sukun', 'shadda', 'tanwin']:
        add(pick(ws, lambda w, f=feat: w['lv'] == 3 and f in w['f'] and w['n'] <= 6, 90, rank))
    # niveau 4 : formes particulières
    for feat in ['article_moon', 'article_sun', 'hamza', 'ta_marbuta', 'alif_maqsura', 'lam_alif', 'wasla', 'madda']:
        add(pick(ws, lambda w, f=feat: w['lv'] == 4 and f in w['f'] and w['n'] <= 7, 80, rank))
    # exemples par lettre (mot qui commence par la lettre, niveau 2 ou 3, court)
    ex = {}
    for lid, ch, *_ in L.LETTERS:
        cands = [w for w in ws if w['lv'] in (2, 3) and w['n'] <= 5 and display_first(w['ar']) == ch]
        if len(cands) < 4:
            cands += [w for w in ws if w['lv'] in (2, 3) and w['n'] <= 5 and ch in w['l'] and w not in cands]
        cands.sort(key=rank)
        ex[lid] = [w['ar'] for w in cands[:6]]
        add(cands[:6])
    # identifiants stables
    out_words = sorted(chosen.values(), key=lambda w: (w['lv'], w['loc']))
    ids = {}
    for w in out_words:
        h = hashlib.sha1(w['ar'].encode('utf-8')).hexdigest()[:8]
        w['id'] = h
        ids[w['ar']] = h
    # lettres
    names = letter_names(Q)
    letters = []
    for lid, ch, fr, ar, tr, ipa, son, dots, joins, fam in L.LETTERS:
        letters.append({'id': lid, 'ch': ch, 'nom': fr, 'ar': ar, 'tr': tr, 'api': ipa, 'son': son,
                        'pts': [dots[0], dots[1]], 'lie': joins, 'fam': fam, 'ex': [ids[x] for x in ex[lid]],
                        'nomAudio': names.get(lid)})
    # passages (niveaux 5 à 7) : versets entiers, texte et audio de l'appli (Al-Husary Al-Mu'allim, mot à mot)
    passages = []
    for s in range(1, 115):
        d, t = Q[s]
        for a in range(1, len(d['ar']) + 1):
            toks = tokens_of(d, a)
            nw = len([x for x in toks if not SIGN.match(x)])
            marks = sorted({k for k, cs in MARKS.items() if any(c in ''.join(toks) for c in cs)})
            stops = sorted({c for c in ''.join(toks) if c in 'ۖۗۘۙۚۛ'})
            if 4 <= nw <= 16 and s != 1:          # Al-Fatiha : déjà connue, jamais « passage peu familier »
                lv = 5 if s >= 78 else (6 if s >= 50 else 7)
                passages.append({'s': s, 'a': a, 'n': nw, 'm': marks, 'p': stops, 'lv': lv})
    # garder un nombre raisonnable : tous les versets courts du juz' 30, échantillon régulier ailleurs
    keep = [p for p in passages if p['lv'] == 5]
    keep += [p for i, p in enumerate([p for p in passages if p['lv'] == 6]) if i % 3 == 0]
    keep += [p for i, p in enumerate([p for p in passages if p['lv'] == 7]) if i % 12 == 0]
    # exemples réels de chaque signe du mushaf et de chaque signe de pause (premier mot qui le porte,
    # en commençant par le juz' 30) : le mot est montré tel quel, dans l'écriture du mushaf
    mx = {}
    marks = {m['id']: m['ch'] for m in L.MUSHAF}
    marks.update({m['id']: m['ch'] for m in L.STOPS})
    order = list(range(78, 115)) + list(range(1, 78))
    for mid, ch in marks.items():
        for s in order:
            d, t = Q[s]
            found = None
            for a in range(1, len(d['ar']) + 1):
                toks = tokens_of(d, a)
                for i, tok in enumerate(toks):
                    if ch in tok:
                        if SIGN.match(tok) and i:          # signe de pause : un jeton à part, montré avec le mot qui précède
                            found = {'s': s, 'a': a, 'uth': toks[i - 1] + ' ' + tok}
                        elif not SIGN.match(tok):
                            found = {'s': s, 'a': a, 'uth': tok}
                        if found:
                            break
                if found:
                    break
            if found:
                mx[mid] = found
                break
    bank = {
        'format': 1, 'version': BANK_VERSION,
        'audio': {'folder': FOLDER, 'base': 'https://everyayah.com/data/' + FOLDER + '/', 'recitateur': 'Mahmoud Khalil Al-Husary',
                  'style': 'récitation pédagogique « Al-Mu’allim »', 'source': 'EveryAyah', 'reperes': 'quran-align (CC BY 4.0)'},
        'sources': L.SOURCES,
        'letters': letters, 'families': L.FAMILIES, 'close': [list(x) for x in L.CLOSE_SOUNDS], 'nonJoining': L.NON_JOINING,
        'special': L.SPECIAL, 'signs': L.SIGNS, 'mushaf': L.MUSHAF, 'stops': L.STOPS, 'mx': mx,
        'words': [{k: w[k] for k in ('id', 'ar', 'tr', 'loc', 'clip', 'lv', 'f', 'l', 'n', 'edge', 'uth')} for w in out_words],
        'passages': keep,
        'skills': P.SKILLS, 'errors': P.ERRORS, 'levels': P.LEVELS, 'parts': P.PARTS, 'chapters': P.CHAPTERS,
        'chExams': P.CHAPTER_EXAMS, 'validation': P.VALIDATION,
    }
    return bank


MARKS = {'wasla': 'ٱ', 'dagger': 'ٰ', 'small_waw': 'ۥ', 'small_ya': 'ۦ', 'zero': '۟', 'rect_zero': '۠',
         'madd': 'ٓ', 'iqlab': 'ۭۢ'}
BANK_VERSION = '20261029a'


def display_first(w):
    for c in w:
        if c not in HARAKAT:
            return {'أ': 'ا', 'إ': 'ا', 'آ': 'ا'}.get(c, c)
    return ''


def check(bank):
    """Contrôles : couverture des lettres et des notions, cohérence des mots."""
    errs = []
    lw = {w['id']: w for w in bank['words']}
    for m in bank['mushaf'] + bank['stops']:
        if m['id'] not in bank['mx']:
            errs.append('signe %s : aucun exemple dans le texte' % m['id'])
    for l in bank['letters']:
        if len(l['ex']) < 3:
            errs.append('lettre %s : moins de 3 exemples' % l['id'])
        for wid in l['ex']:
            if wid not in lw:
                errs.append('exemple manquant ' + wid)
    units = [u['id'] for lv in bank['levels'] for u in lv['units']]
    in_ch = [u for c in bank['chapters'] for u in c['units']]
    if sorted(units) != sorted(in_ch):
        errs.append('chapitres : unités manquantes ou en double')
    for k, secs in bank['chExams'].items():
        n = sum(x['n'] for x in secs)
        if n != (30 if k == 'final' else 20):
            errs.append('examen %s : %d questions' % (k, n))
    for feat in ['long_a', 'long_i', 'long_u', 'sukun', 'shadda', 'tanwin', 'article_moon', 'article_sun', 'hamza', 'ta_marbuta', 'alif_maqsura', 'lam_alif', 'wasla']:
        n = len([w for w in bank['words'] if feat in w['f']])
        if n < 40:
            errs.append('notion %s : %d mots seulement' % (feat, n))
    for w in bank['words']:
        if translit(w['ar'].replace('ا', 'ا')) is None and 'wasla' not in w['f']:
            pass
        if w['clip'][1] - w['clip'][0] < 300:
            errs.append('audio court ' + w['ar'])
    return errs


def write(bank):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(bank, f, ensure_ascii=False, separators=(',', ':'))
    print('écrit', OUT, os.path.getsize(OUT) // 1024, 'Ko ·', len(bank['words']), 'mots ·', len(bank['passages']), 'passages')


# ---------- Tests de la transcription (exemples vérifiables) ----------
TESTS = {
    'خَلَقَ': 'khalaqa', 'كَتَبَ': 'kataba', 'قُلْ': 'qul', 'رَبِّ': 'rabbi', 'كَانَ': 'kāna', 'يَوْمَ': 'yawma',
    'نُورٌ': 'nūrun', 'كَثِيرًا': 'kathīran', 'ٱلْحَمْدُ': 'al-ḥamdu', 'ٱلشَّمْسِ': 'ash-shamsi', 'ٱلرَّحِيمِ': 'ar-raḥīmi',
    'مُوسَى': 'mūsā', 'عَلَى': 'ʿalā', 'رَحْمَةً': 'raḥmatan', 'أَحَدٌ': 'aḥadun', 'شَيْءٍ': 'shayʾin', 'كَفَرُوا': 'kafarū',
    'هُدًى': 'hudan', 'فِي': 'fī', 'ٱلَّذِي': 'al-ladhī', 'وَٱلَّذِينَ': 'wal-ladhīna', 'وَٱلشَّمْسِ': 'wash-shamsi',
    'وَٱلْفَتْحُ': 'wal-fatḥu', 'وَٱشْهَدْ': 'washhad', 'بِٱلْقِسْطِ': 'bil-qisṭi', 'آمَنُوا': 'āmanū', 'مِنْ': 'min',
}
# Conversions mushaf → écriture usuelle (exemples réels du texte Tanzil)
PED_TESTS = {
    'مِن': 'مِنْ', 'عَلَىٰ': 'عَلَى', 'فِى': 'فِي', 'شَىْءٍ': 'شَيْءٍ', 'إِلَى': 'إِلَى', 'ءَامَنُوا': 'آمَنُوا',
    'يَنصُرُ': 'يَنْصُرُ', 'ٱلشَّمْسِ': 'ٱلشَّمْسِ', 'هُدًى': 'هُدًى', 'مِّنَ': None, 'ٱلرَّحْمَـٰنِ': None,
}

if __name__ == '__main__':
    bad = 0
    for w, exp in PED_TESTS.items():
        got = pedagogical(w)
        if got != exp:
            bad += 1
            print('ÉCHEC écriture usuelle', w, '→', got, '(attendu', str(exp) + ')')
    for w, exp in TESTS.items():
        got = translit(w)
        if got != exp:
            bad += 1
            print('ÉCHEC transcription', w, '→', got, '(attendu', exp + ')')
    if bad:
        sys.exit(1)
    print('écriture usuelle : %d tests OK · transcriptions : %d tests OK' % (len(PED_TESTS), len(TESTS)))
    W = main()
    bank = build(W, load_quran())
    errs = check(bank)
    for e in errs:
        print('CONTRÔLE :', e)
    if errs:
        sys.exit(1)
    write(bank)
