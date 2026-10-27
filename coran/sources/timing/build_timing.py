#!/usr/bin/env python3
"""Repères mot à mot « quran-align » (Collin Fair, CC BY 4.0) pour les fichiers EveryAyah exacts.

Source : coran/sources/raw/quran-align-data-2016-11-24.zip (copie verbatim de la publication GitHub
https://github.com/cpfair/quran-align/releases/tag/release-2016-11-24).

Chaque segment : [mot_début, mot_fin (exclu), début_ms, fin_ms] dans le fichier audio du verset.
Les « mots » sont ceux du texte Tanzil Uthmani séparé par des espaces, sans les marques de pause :
c'est exactement notre découpage (jetons arabes hors marques de pause, basmala d'en-tête retirée).

Contrôles : tri, bornes, chevauchements, couverture (mots repérés seuls, en groupe, absents).
Aucune valeur n'est inventée : un mot sans repère reste sans repère.
"""
import hashlib, json, os, re, sys, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ZIP = os.path.join(ROOT, 'coran', 'sources', 'raw', 'quran-align-data-2016-11-24.zip')
ZIP_SHA = '5eeb045d8a7895208c94d2d7ec243567f8f550728835411527c4ffa1e789c9b7'
OUT = os.path.join(ROOT, 'coran', 'data', 'timing')
SIGN = re.compile(r'^[ۖ-ۜ۞۩]+$')
RECITERS = ['Husary_64kbps', 'Husary_Muallim_128kbps', 'Minshawy_Murattal_128kbps', 'Alafasy_128kbps']


def fail(msg):
    print('ERREUR :', msg); sys.exit(1)


def tokens_of(d, a):
    toks = d['ar'][a - 1].split(' ')
    if a == 1 and d['bsm']:
        toks = toks[d['bsm']:]
    return toks


def main():
    h = hashlib.sha256(open(ZIP, 'rb').read()).hexdigest()
    if h != ZIP_SHA:
        fail('empreinte du zip quran-align inattendue : ' + h)
    z = zipfile.ZipFile(ZIP)
    suras = {s: json.load(open(os.path.join(ROOT, 'coran', 'data', 's', '%03d.json' % s), encoding='utf-8')) for s in range(1, 115)}
    index = {'format': 1, 'source': {
        'titre': 'quran-align — repères mot à mot (Collin Fair)',
        'url': 'https://github.com/cpfair/quran-align/releases/tag/release-2016-11-24',
        'licence': 'CC BY 4.0', 'zip_sha256': ZIP_SHA,
        'qualite': "Comparaison publiée par l'auteur avec une méthode indépendante (ElMohafez) : écart moyen < 73 ms, écart-type moyen 139 ms ; 98,5 à 99,9 % des mots segmentés individuellement.",
    }, 'reciters': {}}
    for rec in RECITERS:
        data = json.loads(z.read(rec + '.json'))
        by = {}
        for e in data:
            by[(e['surah'], e['ayah'])] = e
        if len(by) != 6236:
            fail('%s : %d versets au lieu de 6236' % (rec, len(by)))
        os.makedirs(os.path.join(OUT, rec), exist_ok=True)
        tot = {'words': 0, 'single': 0, 'group': 0, 'missing': 0, 'verses_full': 0, 'verses': 0, 'degenerate': 0}
        per_sura = {}
        for s in range(1, 115):
            d = suras[s]
            verses = []
            st = {'words': 0, 'single': 0, 'group': 0, 'missing': 0}
            for a in range(1, len(d['ar']) + 1):
                toks = tokens_of(d, a)
                widx = []  # indice de mot (hors marques de pause) pour chaque jeton, ou None
                k = 0
                for t in toks:
                    if SIGN.match(t):
                        widx.append(None)
                    else:
                        widx.append(k); k += 1
                n = k
                e = by[(s, a)]
                segs = sorted(e['segments'], key=lambda g: (g[2], g[0]))
                mx = max([int(g[1]) for g in segs] or [0])
                # Très rarement, la numérotation de quran-align compte aussi les marques de pause :
                # on le détecte (indice maximal = nombre total de jetons) et on convertit ; sinon le verset reste sans repère.
                if mx <= n:
                    mode = 'mots'
                elif mx <= len(toks):
                    mode = 'jetons'; tot['verses_tokens'] = tot.get('verses_tokens', 0) + 1
                else:
                    mode = None; tot['verses_skipped'] = tot.get('verses_skipped', 0) + 1
                clean = []
                covered = [0] * n
                last_end = -1
                for g in (segs if mode else []):
                    w0, w1, t0, t1 = [int(x) for x in g]
                    if mode == 'jetons':
                        ws = [widx[i] for i in range(w0, w1) if widx[i] is not None]
                        if not ws:
                            continue
                        w0, w1 = ws[0], ws[-1] + 1
                    if not (0 <= w0 < w1 <= n):
                        fail('%s %d:%d segment hors bornes %r (mots : %d)' % (rec, s, a, g, n))
                    if not (0 <= t0 < t1):
                        tot['degenerate'] = tot.get('degenerate', 0) + 1  # durée nulle : ce mot reste sans repère
                        continue
                    if t0 < last_end:
                        # léger chevauchement entre deux mots : on démarre le mot à la fin du précédent
                        if last_end - t0 > 400:
                            fail('%s %d:%d chevauchement important %r (fin précédente %d)' % (rec, s, a, g, last_end))
                        tot['clipped'] = tot.get('clipped', 0) + 1
                        t0 = last_end
                        if t0 >= t1:
                            tot['degenerate'] = tot.get('degenerate', 0) + 1
                            continue
                    last_end = max(last_end, t1)
                    for i in range(w0, w1):
                        if w1 - w0 == 1:
                            covered[i] = 1
                        elif covered[i] != 1:
                            covered[i] = 2
                    clean.append([w0, w1, t0, t1])
                single = sum(1 for c in covered if c == 1)
                group = sum(1 for c in covered if c == 2)
                miss = n - single - group
                st['words'] += n; st['single'] += single; st['group'] += group; st['missing'] += miss
                tot['verses'] += 1
                if miss == 0:
                    tot['verses_full'] += 1
                verses.append(clean)
            for k in st:
                tot[k] += st[k]
            per_sura[s] = {'mots': st['words'], 'seuls': st['single'], 'groupe': st['group'], 'absents': st['missing']}
            with open(os.path.join(OUT, rec, '%03d.json' % s), 'w', encoding='utf-8') as f:
                json.dump({'f': rec, 's': s, 'v': verses}, f, separators=(',', ':'))
        index['reciters'][rec] = {'total': tot, 'sourates': per_sura}
        print('%-28s mots %6d · seuls %5.1f %% · en groupe %4.1f %% · sans repère %4.2f %% · versets complets %d/%d' % (
            rec, tot['words'], 100 * tot['single'] / tot['words'], 100 * tot['group'] / tot['words'],
            100 * tot['missing'] / tot['words'], tot['verses_full'], tot['verses']) + ' · durée nulle écartés : %d · versets numérotés avec marques : %d · versets écartés : %d · débuts recalés : %d' % (tot['degenerate'], tot.get('verses_tokens', 0), tot.get('verses_skipped', 0), tot.get('clipped', 0)))
    with open(os.path.join(OUT, 'quran-align.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, separators=(',', ':'))
    print('OK')


if __name__ == '__main__':
    main()
