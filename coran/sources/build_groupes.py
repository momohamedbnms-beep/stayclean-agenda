#!/usr/bin/env python3
"""Groupes de mémorisation : 8 groupes par juz (240 en tout), pour « Mémoriser » et « Mes progrès ».

Base : les quarts de hizb (rub' al-hizb, marqués ۞ dans le Mushaf de Médine) de Tanzil Quran Metadata 1.0
(coran/sources/raw/tanzil-quran-data.js, tableau HizbQaurter). Ajustement pour apprendre : quand un quart commence
au milieu d'une sourate courte ou moyenne (1 200 mots au plus), la limite est déplacée au début de cette sourate
ou de la suivante (la plus proche), à condition que les deux groupes voisins gardent au moins 170 mots ; une limite
de juz ne bouge jamais. Les longues sourates gardent les limites des quarts.

Mots : comptés sur le texte Tanzil de l'appli (coran/data/s/), sans la basmala placée en tête du verset 1 et sans
les signes de pause isolés. Ils servent à pondérer le pourcentage « connu » (un long verset compte plus qu'un court).

Sortie : coran/data/groupes.json
  vw      mots par verset, pour chaque sourate (pour les sourates partiellement connues)
  groups  240 groupes : j (juz), k (1 à 8 dans le juz), r (morceaux [sourate, premier verset, dernier verset]),
          w (mots), n (versets), q (début du quart d'origine)
  juz     30 juz : w (mots), a (premier verset [sourate, verset]), g (indices des 8 groupes),
          debut (ses deux premiers mots, copiés du texte Tanzil)
  path    ordre proposé : Al-Fatiha, puis le juz 30 du dernier groupe au premier (sourates courtes d'abord),
          puis les juz 29 à 1, chacun dans l'ordre du mushaf (groupe 1 à 8)
Contrôles : 6 236 versets couverts une seule fois, dans l'ordre, groupes non vides, 8 par juz, débuts de juz
identiques aux métadonnées (index.json), total des mots = somme des sourates de index.json."""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = os.path.join(ROOT, 'coran', 'sources', 'raw', 'tanzil-quran-data.js')
DATA = os.path.join(ROOT, 'coran', 'data')
LIM_WORDS = 1200
LIM_TXT = f'{LIM_WORDS:,}'.replace(',', '\u00a0')   # « 1 200 »
MIN_WORDS = 170
PAUSE_ONLY = re.compile(r'^[ۖ-ۭ]+$')


def main():
    src = open(RAW, encoding='utf-8').read()
    i = src.index('HizbQaurter = ['); j = src.index('];', i)
    q = [tuple(map(int, x)) for x in re.findall(r'\[(\d+),\s*(\d+)\]', src[i:j])]
    assert len(q) == 241 and q[0] == (1, 1) and q[-1] == (115, 1), 'HizbQaurter inattendu'
    idx = json.load(open(os.path.join(DATA, 'index.json'), encoding='utf-8'))
    S = {m['n']: m for m in idx['suras']}
    vw = {}
    for n in range(1, 115):
        d = json.load(open(os.path.join(DATA, 's', '%03d.json' % n), encoding='utf-8'))
        arr = []
        for k, v in enumerate(d['ar']):
            toks = v.split(' ')
            if k == 0 and d['bsm']:
                toks = toks[d['bsm']:]
            arr.append(len([t for t in toks if t and not PAUSE_ONLY.match(t)]))
        assert len(arr) == S[n]['ayas'], n
        vw[n] = arr

    def nxt(p):
        s, v = p
        return (s + 1, 1) if v + 1 > len(vw[s]) else (s, v + 1)

    def words(a, b):
        t, p = 0, a
        while p < b and p[0] <= 114:
            t += vw[p[0]][p[1] - 1]; p = nxt(p)
        return t

    b = list(q)
    for k in range(1, 240):
        s, a = q[k]
        if a == 1 or k % 8 == 0 or sum(vw[s]) > LIM_WORDS:
            continue
        before, after = words((s, 1), (s, a)), words((s, a), (s + 1, 1))
        for cand in sorted([(s, 1), (s + 1, 1)], key=lambda c: before if c == (s, 1) else after):
            lo, hi = b[k - 1], b[k + 1]
            if lo < cand < hi and words(lo, cand) >= MIN_WORDS and words(cand, hi) >= MIN_WORDS:
                b[k] = cand
                break

    groups = []
    for k in range(240):
        a, z = b[k], b[k + 1]
        parts, p = [], a
        while p < z and p[0] <= 114:
            s = p[0]; last = len(vw[s]) if z[0] > s else z[1] - 1
            parts.append([s, p[1], last]); p = (s + 1, 1)
        g = {'j': k // 8 + 1, 'k': k % 8 + 1, 'r': parts, 'w': words(a, z), 'n': sum(x[2] - x[1] + 1 for x in parts), 'q': list(q[k])}
        assert g['n'] > 0 and g['w'] > 0
        groups.append(g)
    # contrôles
    seen = []
    for g in groups:
        for s, a1, a2 in g['r']:
            seen += [(s, a) for a in range(a1, a2 + 1)]
    assert len(seen) == 6236 and len(set(seen)) == 6236 and seen == sorted(seen), 'couverture'
    total = sum(g['w'] for g in groups)
    assert total == sum(m['words'] for m in idx['suras']), 'mots'
    for jz in idx['juz']:
        g = groups[(jz['n'] - 1) * 8]
        assert (g['r'][0][0], g['r'][0][1]) == (jz['s'], jz['a']), ('début du juz', jz)
    def debut(s, a):
        """Les deux premiers mots du verset, tels quels dans le texte Tanzil (sans la basmala du verset 1)."""
        d = json.load(open(os.path.join(DATA, 's', '%03d.json' % s), encoding='utf-8'))
        toks = d['ar'][a - 1].split(' ')
        if a == 1 and d['bsm']:
            toks = toks[d['bsm']:]
        return ' '.join([t for t in toks if t and not PAUSE_ONLY.match(t)][:2])
    juz = [{'n': n, 'w': sum(groups[x]['w'] for x in range((n - 1) * 8, n * 8)), 'a': groups[(n - 1) * 8]['r'][0][:2], 'g': list(range((n - 1) * 8, n * 8)),
            'debut': debut(*groups[(n - 1) * 8]['r'][0][:2])} for n in range(1, 31)]
    path = [{'t': 'sura', 's': 1}] + [{'t': 'g', 'i': x} for x in reversed(range(29 * 8, 30 * 8))] + [{'t': 'g', 'i': x} for n in range(29, 0, -1) for x in range((n - 1) * 8, n * 8)]
    moved = [(g['j'], g['k'], g['q'], g['r'][0][:2]) for g in groups if tuple(g['q']) != tuple(g['r'][0][:2])]
    out = {'format': 1,
           'source': 'Quarts de hizb : Tanzil Quran Metadata 1.0 (HizbQaurter, CC BY 3.0). Mots comptés sur le texte Tanzil Uthmani 1.1 de l’appli, sans la basmala du verset 1 ni les signes de pause.',
           'regle': f'8 groupes par juz, calés sur les quarts de hizb (۞). Dans une sourate de {LIM_TXT} mots au plus, une limite tombant au milieu de la sourate est déplacée au début de cette sourate ou de la suivante (la plus proche), si les deux groupes voisins gardent au moins {MIN_WORDS} mots ; les limites de juz ne bougent jamais.',
           'total': total, 'vw': {str(n): vw[n] for n in range(1, 115)}, 'groups': groups, 'juz': juz, 'path': path}
    p = os.path.join(DATA, 'groupes.json')
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{len(groups)} groupes, {total} mots, {len(moved)} limites déplacées au début d’une sourate ; {os.path.getsize(p) / 1024:.0f} Ko')
    for m in moved:
        print('  juz %d, groupe %d : %s:%s → %s:%s' % (m[0], m[1], m[2][0], m[2][1], m[3][0], m[3][1]))


if __name__ == '__main__':
    main()
