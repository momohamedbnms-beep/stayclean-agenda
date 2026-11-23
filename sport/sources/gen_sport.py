# -*- coding: utf-8 -*-
"""Génère sport/data.js (programme, repas, pictogrammes) et sport/pics.css pour l'appli « Mon Programme »
de StayClean Agenda. Source unique : program.py (séances), plan.py (repas), fig.py (pictogrammes)."""
import json, os, shutil, sys
import fig, plan, program as P

REPO = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/stayclean-agenda"
OUT = os.path.join(REPO, "sport")
os.makedirs(os.path.join(OUT, "sources"), exist_ok=True)

keys = set()
for s in P.SESSIONS:
    keys.add(s["pic"])
    for e in s["ex"] + ([s["fin"]] if s.get("fin") else []):
        keys.add(e["k"])
    for k, _, _ in s.get("abs", []):
        keys.add(k)
keys |= {"walk", "treadmill", "run", "rope", "crunch", "legraise", "climber", "plank"}
pics = {k: fig.COMBO[k]().svg() for k in sorted(keys)}

def tot(items):
    t = plan.tot(items)
    return {k: round(t[k]) for k in ("kcal", "p", "c", "f", "fib")}

FOODS_FR = {"flocons": "flocons d’avoine", "skyr": "skyr nature", "whey": "whey", "banane": "banane", "noix": "noix",
            "poulet": "blanc de poulet", "riz": "riz basmati", "legumes": "légumes", "huile": "huile d’olive", "pomme": "pomme",
            "dattes": "dattes"}
def items(lst):
    out = []
    for name, g in lst:
        q = {"banane": "1", "pomme": "1"}.get(name, f"{g} g")
        out.append([q, FOODS_FR.get(name, name)])
    return out

data = {
    "sessions": P.SESSIONS,
    "rest": P.REST,
    "vest": P.VEST,
    "totale": P.TOTALE_LEVELS,
    "marks": {k: [v[0], v[1]] for k, v in P.MARKS.items()},
    "ramadanOrder": P.RAMADAN_ORDER,
    "ramadan": ["2027-02-08", "2027-03-09"],
    "steps": plan.STEPS["mid"],
    "meals": [
        {"id": "bol", "name": "Le bol", "when": "10 h 30", "items": items(plan.MEALS["bol"]) + [["5 g", "créatine"]], "tot": tot(plan.MEALS["bol"]),
         "prep": "Flocons + 200 ml d’eau chaude, 2 min. Skyr et whey, tu mélanges. Banane et noix dessus."},
        {"id": "shake", "name": "Le shake", "when": "juste après la séance", "items": items(plan.MEALS["shake"]) + [["300 ml", "eau"]], "tot": tot(plan.MEALS["shake"]),
         "prep": "Jour sans séance : à 14 h."},
        {"id": "assiette", "name": "L’assiette", "when": "17 h 30", "items": items(plan.MEALS["assiette"]), "tot": tot(plan.MEALS["assiette"]),
         "prep": "Poulet au four ou à la poêle, épices à volonté. L’huile se mesure à la cuillère. Riz : 90 g sec = 270 g cuit."},
    ],
    "day": tot(plan.DAY),
}
js = ("/* Généré par sport/sources/gen_sport.py — ne pas modifier à la main. */\n"
      "window.SP_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
      "window.SP_PICS = " + json.dumps(pics, ensure_ascii=False, separators=(",", ":")) + ";\n")
open(os.path.join(OUT, "data.js"), "w").write(js)
open(os.path.join(OUT, "pics.css"), "w").write("/* Généré par sport/sources/gen_sport.py */\n" + fig.PIC_CSS + "\n")
HERE = os.path.dirname(os.path.abspath(__file__))
for f in ("fig.py", "plan.py", "program.py", "gen_sport.py"):
    dst = os.path.join(OUT, "sources", f)
    if os.path.abspath(dst) != os.path.join(HERE, f):
        shutil.copy(os.path.join(HERE, f), dst)
print("data.js: %.0f Ko, %d pictogrammes, journée %s" % (len(js) / 1024, len(pics), data["day"]))
