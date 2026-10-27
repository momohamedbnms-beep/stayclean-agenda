#!/usr/bin/env python3
"""Réassemble une archive de résultats bruts transmise depuis l'onglet de calcul en morceaux
« DTWCHUNK|étiquette|i|n|base64|END » (sorties d'outil enregistrées), vérifie l'empreinte SHA-256 du
fichier gzip annoncée par l'onglet, puis l'écrit.

Usage : python3 reassemble_dtw.py dossier_sorties étiquette sha256_attendu fichier_sortie.json.gz"""
import base64, glob, hashlib, json, os, sys

src, tag, want, dest = sys.argv[1:5]
chunks = {}
for f in glob.glob(os.path.join(src, '*.txt')):
    try:
        d = json.load(open(f, encoding='utf-8'))
        t = d[0]['text']
        val, _ = json.JSONDecoder().raw_decode(t)
    except Exception:
        continue
    if not isinstance(val, str) or not val.startswith('DTWCHUNK|' + tag + '|'):
        continue
    _, _, i, n, payload = val.split('|', 4)
    assert payload.endswith('|END'), f
    chunks[int(i)] = (int(n), payload[:-4])
if not chunks:
    sys.exit('aucun morceau pour ' + tag)
n = next(iter(chunks.values()))[0]
missing = [i for i in range(n) if i not in chunks]
if missing:
    sys.exit('morceaux manquants : %s' % missing)
gz = base64.b64decode(''.join(chunks[i][1] for i in range(n)))
h = hashlib.sha256(gz).hexdigest()
if h != want:
    sys.exit('empreinte différente : %s' % h)
open(dest, 'wb').write(gz)
print('OK', dest, len(gz), 'octets', h)
