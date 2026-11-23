# -*- coding: utf-8 -*-
"""Génère sport/data.js et sport/pics.css pour l'appli « Mon Programme » (Le Camp) de StayClean Agenda.
Source unique : program.py (séances, aussi utilisé par le PDF), plan.py (repas), fig.py (dessins),
build.py facultatif (illustrations des repas).
La séance est « compilée » en exercices structurés : mode (reps, distance, chrono, maintien, durée, circuit),
séries, repos, intensité (lourd, contrôlé, explosif…), charge oui/non et pas d'augmentation."""
import json, os, re, shutil, sys
import fig, plan, program as P

REPO = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/stayclean-agenda"
OUT = os.path.join(REPO, "sport")
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(OUT, "sources"), exist_ok=True)

# ---------- dessins : deux images par mouvement (départ, effort) pour l'animation ----------
def frame(s):
    s.L["front"] = [x for x in s.L["front"] if 'class="s a"' not in x and 'class="f a"' not in x]
    s.L["back"] = [x for x in s.L["back"] if 'class="s a"' not in x and 'class="f a"' not in x]
    return s.svg()

F = fig
TWO = {
    "row": (lambda: F.row(False), lambda: F.row(True)), "pushup": (lambda: F.pushup(False), lambda: F.pushup(True)),
    "pulldown": (lambda: F.pulldown(False), lambda: F.pulldown(True)), "incline": (lambda: F.incline(False), lambda: F.incline(True)),
    "lateral": (lambda: F.lateral(False), lambda: F.lateral(True)), "curl": (lambda: F.curl(True), lambda: F.curl(False)),
    "pushdown": (lambda: F.pushdown(True), lambda: F.pushdown(False)), "goblet": (lambda: F.goblet(False), lambda: F.goblet(True)),
    "rdl": (lambda: F.rdl(False), lambda: F.rdl(True)), "lunge": (lambda: F.lunge(False), lambda: F.lunge(True)),
    "legcurl": (lambda: F.legcurl(False), lambda: F.legcurl(True)), "calf": (lambda: F.calf(False), lambda: F.calf(True)),
    "kneeraise": (lambda: F.hang(False), lambda: F.hang(False, knees=True)), "rower": (lambda: F.rower(False), lambda: F.rower(True)),
    "press": (lambda: F.press(False), lambda: F.press(True)), "swing": (lambda: F.swing(False), lambda: F.swing(True)),
    "slam": (lambda: F.slam(False), lambda: F.slam(True)), "crunch": (lambda: F.crunch(False), lambda: F.crunch(True)),
    "legraise": (lambda: F.legraise(False), lambda: F.legraise(True)), "hang": (lambda: F.hang(False), lambda: F.hang(True)),
}
ONE = {"plank": F.plank, "farmer": F.farmer, "sled": F.sled, "vest": F.vest, "ropes": F.ropes, "swim": F.swim, "walk": F.walk,
       "treadmill": F.treadmill, "run": F.run, "rope": F.rope, "climber": F.climber}

# ---------- séances compilées ----------
NAMES = {
    "Développé incliné haltères": "Développé incliné", "Développé militaire haltères": "Développé militaire",
    "Tirage vertical lourd": "Tirage vertical", "Suspension, puis négatives": "Suspension à la barre",
    "Finisher : marche du fermier lourde": "Marche du fermier", "Rameur, fractionné": "Rameur",
    "Goblet squat lourd ou presse": "Goblet squat", "Soulevé jambes tendues haltères": "Soulevé jambes tendues",
    "Fentes marchées haltères": "Fentes marchées", "Relevés de genoux suspendu": "Relevés de genoux",
    "Finisher : traîneau lourd": "Traîneau lourd", "Kettlebell swing lourd": "Kettlebell swing",
    "Curl, puis triceps poulie": "Curl + triceps", "Marche inclinée, gilet lesté": "Marche lestée",
}
CUES = {
    "Développé incliné haltères": "Descends en 2 s. Pousse fort.", "Rowing australien lesté": "Poitrine à la barre. Corps gainé.",
    "Développé militaire haltères": "Assis, dos calé. Pas de cambrure.", "Tirage vertical lourd": "Coudes vers les hanches. Zéro élan.",
    "Pompes": "Poitrine au sol. Gainé.", "Élévations latérales": "Léger, strict. Sans élan.",
    "Suspension, puis négatives": "Bras tendus, épaules engagées. Dès S5 : descentes lentes de 5 s.",
    "Finisher : marche du fermier lourde": "Les plus lourds que tu tiens 30 m.", "Rameur, fractionné": "Même chrono à chaque 250 m.",
    "Kettlebell swing": "Les hanches claquent. Dos plat.", "Slam ballon": "Écrase le ballon au sol.",
    "Cordes ondulatoires": "À fond. Sans cordes : 8 burpees sans saut.", "Poussée de traîneau": "Bas, bras tendus. Sans traîneau : fermier 30 m.",
    "Planche": "Fessiers serrés. Bassin droit.", "Goblet squat lourd ou presse": "Haltère contre la poitrine. Dos droit.",
    "Soulevé jambes tendues haltères": "Fesses en arrière. Dos plat.", "Fentes marchées haltères": "Grand pas. Genou frôle le sol.",
    "Leg curl": "Remonte en 3 s.", "Mollets debout": "1 s de pause en haut.", "Relevés de genoux suspendu": "Sans balancer.",
    "Finisher : traîneau lourd": "Plus lourd que J2. Sans traîneau : fermier.", "Nage continue": "Tranquille. Trouve ton souffle.",
    "Sprints dans l’eau": "25 m à fond.", "Marche": "Dehors ou sur tapis.", "Kettlebell swing lourd": "Plus lourd que J2.",
    "Rowing australien": "Barre plus basse si c’est facile.", "Fentes arrière": "Buste droit.", "Curl, puis triceps poulie": "Curl puis triceps, sans pause.",
    "Marche inclinée, gilet lesté": "Sans tenir les barres. Tu dois pouvoir parler.",
}
LVL = {
    "Développé incliné haltères": "lourd", "Rowing australien lesté": "lourd", "Développé militaire haltères": "lourd",
    "Tirage vertical lourd": "lourd", "Pompes": "moyen", "Élévations latérales": "controle", "Suspension, puis négatives": "gainage",
    "Finisher : marche du fermier lourde": "lourd", "Rameur, fractionné": "explosif", "Kettlebell swing": "explosif",
    "Slam ballon": "explosif", "Cordes ondulatoires": "explosif", "Poussée de traîneau": "explosif", "Planche": "gainage",
    "Goblet squat lourd ou presse": "lourd", "Soulevé jambes tendues haltères": "lourd", "Fentes marchées haltères": "lourd",
    "Leg curl": "controle", "Mollets debout": "controle", "Relevés de genoux suspendu": "moyen", "Finisher : traîneau lourd": "lourd",
    "Nage continue": "facile", "Sprints dans l’eau": "explosif", "Marche": "facile", "Kettlebell swing lourd": "lourd",
    "Rowing australien": "moyen", "Fentes arrière": "moyen", "Curl, puis triceps poulie": "controle", "Marche inclinée, gilet lesté": "endurance",
}
STEP = {"Élévations latérales": 1, "Curl, puis triceps poulie": 1, "Kettlebell swing": 4, "Kettlebell swing lourd": 4, "Slam ballon": 2,
        "Poussée de traîneau": 10, "Finisher : traîneau lourd": 10, "Finisher : marche du fermier lourde": 2, "Développé incliné haltères": 2,
        "Développé militaire haltères": 2, "Fentes marchées haltères": 2, "Soulevé jambes tendues haltères": 2, "Goblet squat lourd ou presse": 2}
WARM = {"J1": (5, ["Rameur facile", "Épaules", "+ 2 séries légères"]), "J2": (5, ["Corde tranquille"]),
        "J3": (5, ["Vélo facile", "10 squats", "10 ponts fessiers"]), "J4": (3, ["2 longueurs cool"]),
        "J5": (5, ["Corde", "10 swings légers"]), "J6": (5, ["Marche à plat", "Sans gilet"])}
SPECS = {"Nage continue": ["Tranquille"], "Marche": ["Dehors ou tapis"], "Marche inclinée, gilet lesté": ["Pente 10–12 %", "5 km/h"]}

def secs(r):
    if not r or r == "—":
        return 0
    s = 0
    m = re.search(r"(\d+)\s*min", r)
    if m: s += 60 * int(m.group(1))
    m = re.search(r"min\s+(\d+)$", r)
    if m: s += int(m.group(1))
    m = re.search(r"(\d+)\s*s\b", r)
    if m: s += int(m.group(1))
    return s

def base_ex(eid, name, pic, lvl, **kw):
    o = {"id": eid, "name": name, "pic": pic, "lvl": lvl, "rest": 0, "rir": 0, "lastMax": False, "kg": False, "step": 0, "cue": "", "sets": 1}
    o.update(kw)
    return o

def compile_ex(sid, e, used):
    d = e["d"]; k = e["k"]
    eid = f"{sid}:{k}"; n = 2
    while eid in used:
        eid = f"{sid}:{k}{n}"; n += 1
    used.add(eid)
    o = base_ex(eid, NAMES.get(e["n"], e["n"]), k, LVL.get(e["n"], "moyen"), rest=secs(e["r"]),
                rir=1 if e.get("m") == "keep1" else (2 if e.get("m") in ("keep", None) else 0),
                lastMax=e.get("m") == "max", kg=bool(e.get("w")), step=STEP.get(e["n"], 2.5), cue=CUES.get(e["n"], e.get("c", "")))
    m = re.match(r"^(\d+)\s*×\s*(.+)$", d)
    if m:
        o["sets"] = int(m.group(1)); rest = m.group(2).strip()
        if e.get("m") == "hold":
            o["mode"] = "hold"; o["target"] = rest
        elif re.search(r"\d\s*m$", rest):
            o["mode"] = "dist"; o["dist"] = rest
        elif re.search(r"\d\s*s$", rest):
            o["mode"] = "timed"; o["sec"] = int(re.match(r"(\d+)", rest).group(1))
        else:
            o["mode"] = "reps"; o["reps"] = rest; o["per"] = "/ jambe" if e.get("x") else ""
    else:
        mm = re.match(r"^(\d+)\s*min", d)
        o["mode"] = "steady"; o["min"] = int(mm.group(1)) if mm else 10
        o["spec"] = SPECS.get(e["n"], []); o["vest"] = k == "vest"
    return o

def compile_session(s):
    used = set(); ex = []; old = []
    for e in s["ex"]:
        o = compile_ex(s["id"], e, used); ex.append(o); old.append(o["id"])
    if s.get("abs"):
        st = []
        for k, nm, q in s["abs"]:
            mt = re.match(r"(\d+)\s*s$", q)
            st.append({"pic": k, "name": nm, "sec": int(mt.group(1))} if mt else {"pic": k, "name": nm, "reps": q})
        ex.append(base_ex(s["id"] + ":abs", "Circuit abdos", "crunch", "gainage", mode="circuit", sets=3, rest=60, stations=st,
                          cue="Sans pause entre les exercices."))
    if s.get("fin"):
        o = compile_ex(s["id"], s["fin"], used); o["id"] = s["id"] + ":fin"; o["fin"] = True; ex.append(o)
    if s.get("totale"):
        ex.append(base_ex(s["id"] + ":tot1", "Corde + abdos", "rope", "explosif", mode="totale", part=1, sets=6, cue="Corde, puis abdos. Sans pause.", tot=True))
        ex.append(base_ex(s["id"] + ":tot2", "Sprints tapis", "run", "explosif", mode="totale", part=2, sets=6, cue="Pente 6 %. Vitesse au bouton, mains sur les barres.", tot=True))
    if s.get("cardio"):
        c = s["cardio"]; t = c["t"].lower(); gil = "gilet" in t; calme = "calme" in t
        ex.append(base_ex(s["id"] + ":cardio", "Tapis lesté" if gil else ("Retour au calme" if calme else "Marche en pente"),
                          "vest" if gil else "treadmill", "endurance", mode="steady", min=int(c["d"].split()[0]),
                          spec=["À plat", "5 km/h"] if calme else ["Pente 10 %", "5 km/h"], vest=gil, cue="Tu dois pouvoir parler.", cardio=True))
    w = WARM[s["id"]]
    return {"id": s["id"], "cls": s["cls"], "color": s["color"], "name": s["name"], "nick": s["nick"], "dur": s["dur"], "pic": s["pic"],
            "warm": {"min": w[0], "spec": w[1]}, "ex": ex, "old": old}

sessions = [compile_session(s) for s in P.SESSIONS]
keys = set()
for s in sessions:
    keys.add(s["pic"])
    for e in s["ex"]:
        keys.add(e["pic"])
        for st in e.get("stations", []):
            keys.add(st["pic"])
keys |= {"rope", "crunch", "legraise", "climber", "plank", "run", "treadmill", "walk", "vest", "rower", "swim"}
frames = {}
for k in sorted(keys):
    if k in TWO:
        frames[k] = [frame(TWO[k][0]()), frame(TWO[k][1]())]
    elif k in ONE:
        frames[k] = [frame(ONE[k]())]
    else:
        frames[k] = [fig.COMBO[k]().svg()]

# ---------- repas (illustrations du PDF) ----------
try:
    sys.path.insert(0, HERE)
    import build
    ILL = {"bol": build.il_bowl(), "assiette": build.il_plate(False), "shake": build.il_shake()}
except Exception:
    ILL = {}

def tot(items):
    t = plan.tot(items)
    return {k: round(t[k]) for k in ("kcal", "p", "c", "f", "fib")}

FOODS_FR = {"flocons": "flocons d’avoine", "skyr": "skyr nature", "whey": "whey", "banane": "banane", "noix": "noix",
            "poulet": "poulet (cru)", "riz": "riz (sec)", "legumes": "légumes", "huile": "huile d’olive", "pomme": "pomme", "dattes": "dattes"}
def items(lst):
    return [[{"banane": "1", "pomme": "1"}.get(n, f"{g} g"), FOODS_FR.get(n, n)] for n, g in lst]

COACH = [  # une phrase ; 1 = seulement pour Mohamed (rôle, mariage)
    ["Pas d’envie ? Pas grave. T’as un plan.", 0], ["Une séance à la fois.", 0], ["Pas parfait. Juste fait.", 0],
    ["La discipline, c’est faire même sans envie.", 0], ["Tu ne négocies pas avec la séance.", 0],
    ["La régularité bat l’intensité.", 0], ["Ce que tu fais aujourd’hui se voit dans 6 semaines.", 0],
    ["Personne ne la fera à ta place.", 0], ["Commence. La motivation arrive après.", 0], ["Le corps suit. La tête décide.", 0],
    ["Le rôle se gagne ici.", 1], ["106 → 87. Un kilo après l’autre.", 1], ["Le jour du mariage se prépare aujourd’hui.", 1],
    ["Un athlète, ça se fabrique. Séance après séance.", 0],
]

data = {
    "sessions": sessions, "vest": P.VEST, "totale": P.TOTALE_LEVELS, "ramadanOrder": P.RAMADAN_ORDER,
    "ramadan": ["2027-02-08", "2027-03-09"], "steps": plan.STEPS["mid"], "coach": COACH,
    "meals": [
        {"id": "bol", "name": "Le bol", "when": "10 h 30", "items": items(plan.MEALS["bol"]) + [["5 g", "créatine"]], "tot": tot(plan.MEALS["bol"]), "svg": ILL.get("bol", "")},
        {"id": "shake", "name": "Le shake", "when": "après la séance", "items": items(plan.MEALS["shake"]) + [["300 ml", "eau"]], "tot": tot(plan.MEALS["shake"]), "svg": ILL.get("shake", "")},
        {"id": "assiette", "name": "L’assiette", "when": "17 h 30", "items": items(plan.MEALS["assiette"]), "tot": tot(plan.MEALS["assiette"]), "svg": ILL.get("assiette", "")},
    ],
    "day": tot(plan.DAY),
}
js = ("/* Généré par sport/sources/gen_sport.py — ne pas modifier à la main. */\n"
      "window.SP_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
      "window.SP_FRAMES = " + json.dumps(frames, ensure_ascii=False, separators=(",", ":")) + ";\n")
open(os.path.join(OUT, "data.js"), "w").write(js)
open(os.path.join(OUT, "pics.css"), "w").write("/* Généré par sport/sources/gen_sport.py */\n" + fig.PIC_CSS + "\n")
for f in ("fig.py", "plan.py", "program.py", "gen_sport.py", "build.py", "css.py"):
    src = os.path.join(HERE, f); dst = os.path.join(OUT, "sources", f)
    if os.path.exists(src) and os.path.abspath(dst) != os.path.abspath(src):
        shutil.copy(src, dst)
print("data.js : %.0f Ko · %d dessins · %d séances · repas illustrés : %s" % (len(js) / 1024, len(frames), len(sessions), bool(ILL)))
for s in sessions:
    print(" ", s["id"], " | ".join(f'{e["name"]} [{e["mode"]} {e.get("sets")}×{e.get("reps") or e.get("dist") or e.get("sec") or e.get("target") or e.get("min")} r{e["rest"]} {e["lvl"]}{" kg" if e["kg"] else ""}]' for e in s["ex"]))
