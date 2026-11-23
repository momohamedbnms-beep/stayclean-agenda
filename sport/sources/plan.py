# -*- coding: utf-8 -*-
"""Données du plan : dates, trajectoire, menu calculé, séances. Source unique pour le PDF et le suivi."""
from datetime import date, timedelta

START = date(2026, 11, 23)          # lundi, semaine 1
WEEKS = 17
WEDDING = date(2027, 3, 22)
RAMADAN = (date(2027, 2, 8), date(2027, 3, 8))   # dates attendues, à confirmer (observation de la lune)
W0, GOAL = 104.0, 87.0
HEIGHT_CM, AGE = 184, 24

MOIS = ["janv.", "fév.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
MOISL = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def wk_start(n):
    return START + timedelta(days=7 * (n - 1))


def wk_end(n):
    return wk_start(n) + timedelta(days=6)


def fd(d):
    return f"{d.day}{'er' if d.day == 1 else ''} {MOIS[d.month - 1]}"


def fdl(d):
    return f"{d.day}{'er' if d.day == 1 else ''} {MOISL[d.month - 1]}"


def fr(x, d=0):
    s = f"{x:,.{d}f}".replace(",", " ").replace(".", ",")
    return s


# ---- Trajectoire (poids en fin de semaine) ----
STEPS = {
    "mid":  [1.8, 1.2] + [0.95] * 9 + [0.7] * 4 + [0.85] * 2,
    "fast": [2.2, 1.4] + [1.05] * 9 + [0.8] * 4 + [0.95] * 2,
    "slow": [1.4, 1.0] + [0.80] * 9 + [0.55] * 4 + [0.70] * 2,
}


def traj(kind="mid"):
    out, w = [W0], W0
    for s in STEPS[kind]:
        w -= s
        out.append(round(w, 2))
    return out


ACTS = [
    (1, "Décollage", 1, 2, "Une série de moins partout, tapis 15 min."),
    (2, "La machine", 3, 11, "Le programme complet."),
    (3, "Ramadan", 12, 15, "Quatre séances courtes."),
    (4, "Final", 16, 17, "Programme complet, jusqu’au mariage."),
]

# ---- Aliments : pour 100 g -> kcal, protéines, glucides, lipides, fibres ----
FOODS = {
    "flocons": ("Flocons d’avoine", 372, 13.5, 58.7, 7.0, 10.0),
    "skyr": ("Skyr nature", 63, 11.0, 3.9, 0.2, 0.0),
    "whey": ("Whey", 400, 80.0, 6.7, 5.0, 0.0),
    "banane": ("Banane", 89, 1.1, 22.8, 0.3, 2.6),
    "noix": ("Noix", 654, 15.2, 13.7, 65.2, 6.7),
    "poulet": ("Blanc de poulet", 110, 23.0, 0.0, 1.5, 0.0),
    "riz": ("Riz basmati", 355, 7.5, 78.0, 0.9, 1.3),
    "legumes": ("Légumes surgelés", 35, 2.2, 5.0, 0.3, 2.8),
    "huile": ("Huile d’olive", 884, 0.0, 0.0, 100.0, 0.0),
    "pomme": ("Pomme", 52, 0.3, 13.8, 0.2, 2.4),
    "dattes": ("Dattes", 282, 2.5, 65.0, 0.4, 8.0),
}
MEALS = {
    "bol": [("flocons", 80), ("skyr", 300), ("whey", 30), ("banane", 120), ("noix", 25)],
    "assiette": [("poulet", 300), ("riz", 90), ("legumes", 400), ("huile", 15)],
    "shake": [("whey", 30), ("pomme", 150)],
}


def tot(items):
    k = p = c = f = fb = 0.0
    for fid, g in items:
        _, a, b, cc, d, e = FOODS[fid]
        r = g / 100
        k += a * r; p += b * r; c += cc * r; f += d * r; fb += e * r
    return dict(kcal=k, p=p, c=c, f=f, fib=fb)


DAY = [x for m in ("bol", "assiette", "shake") for x in MEALS[m]]
RAMADAN_DAY = MEALS["bol"] + [("poulet", 300), ("riz", 70), ("legumes", 400), ("huile", 15), ("dattes", 24), ("skyr", 200)]
SOUPE_KCAL = 150   # 1 bol de soupe légère : estimation


def shopping(days=7):
    q = {}
    for fid, g in DAY:
        q[fid] = q.get(fid, 0) + g * days
    return q


if __name__ == "__main__":
    for m, it in MEALS.items():
        t = tot(it)
        print(m, {k: round(v, 1) for k, v in t.items()})
    t = tot(DAY)
    print("JOUR", {k: round(v, 1) for k, v in t.items()}, "kcal macros", round(t["p"] * 4 + t["c"] * 4 + t["f"] * 9))
    r = tot(RAMADAN_DAY)
    print("RAMADAN", {k: round(v, 1) for k, v in r.items()}, "+ soupe", SOUPE_KCAL, "=", round(r["kcal"] + SOUPE_KCAL))
    print("courses", shopping())
    for k in STEPS:
        tj = traj(k)
        print(k, [tj[i] for i in (0, 1, 2, 4, 8, 11, 15, 17)])
    print("fin S17", wk_end(17), "| S12", wk_start(12), "| S15 fin", wk_end(15), "| S4 fin", wk_end(4), "| S11 fin", wk_end(11))
    bmr = lambda w: 10 * w + 6.25 * HEIGHT_CM - 5 * AGE + 5
    for w in (104, 95, 88):
        print(w, "BMR", round(bmr(w)), "x1.5", round(bmr(w) * 1.5), "x1.4", round(bmr(w) * 1.4))
    # tapis incliné : équation de marche ACSM, kcal nettes par minute
    for sp, gr in ((4.5, .06), (5, .08), (5, .10), (5.5, .12)):
        v = sp * 1000 / 60
        vo2 = 0.1 * v + 1.8 * v * gr
        print(f"tapis {sp} km/h {int(gr*100)} % : {vo2 * 104 / 1000 * 5:.1f} kcal/min nettes à 104 kg")
