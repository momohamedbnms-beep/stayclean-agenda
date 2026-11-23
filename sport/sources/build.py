# -*- coding: utf-8 -*-
"""Assemble le dossier « Opération 87 » en HTML puis en PDF (Chromium)."""
import re, os, sys, asyncio, random
import fig, plan
from css import CSS
from plan import fd, fdl, fr, wk_start, wk_end, tot, MEALS, FOODS

ROOT = os.path.dirname(os.path.abspath(__file__))
ICONS = ROOT + "/node_modules/@phosphor-icons/core/assets/fill/"
TRACKER_URL = os.environ.get("TRACKER_URL", "")
OUT = os.environ.get("OUT", "/mnt/user-data/outputs/Operation-87_Programme-Mohamed.pdf")
PN = 0
_ic = {}


def icon(name, cls=""):
    if name not in _ic:
        s = open(f"{ICONS}{name}-fill.svg").read()
        _ic[name] = s[s.index(">") + 1: s.rindex("</svg>")]
    return f'<svg class="ic {cls}" viewBox="0 0 256 256" aria-hidden="true">{_ic[name]}</svg>'


def pic(key, i=0, num=None):
    return fig.SCENES[key][i]().svg(num=num)


NB, NNB = " ", " "
UNITS = r"kg|g|kcal|min|s|h|%|km/h|L|ml|m|pas|cm|semaines|semaine|séries|série|tours|jours|jour|reps|répétitions|mois|fois|séances|boîtes|dattes|€|°C"


def fix(t):
    t = t.replace("'", "’")
    t = re.sub(r" ([;!?])", NNB + r"\1", t)
    t = re.sub(r" :", NB + ":", t)
    t = re.sub(r"(\d) (\d{3})(?!\d)", r"\1" + NNB + r"\2", t)
    t = re.sub(r"(\d) (" + UNITS + r")(?![\w/])", r"\1" + NB + r"\2", t)
    t = t.replace(" × ", NB + "×" + NB).replace("≈ ", "≈" + NB).replace(" →", NB + "→")
    t = re.sub(r"\b(S|J|p\.) ?(\d)", lambda m: m.group(1) + ("" if m.group(1) in "SJ" else NB) + m.group(2), t)
    return t


def typo(html):
    return re.sub(r">([^<>]+)<", lambda m: ">" + fix(m.group(1)) + "<", html)


TEAM = {
    "Ilyas": ("Préparateur physique", "#2b50e8", "Séances A et B. Le gras part, le muscle reste."),
    "Maya": ("Calisthénie", "#1c2f9c", "Du rowing australien à ta première traction, sans élastique."),
    "Idriss": ("Cardio", "#e8650a", "Tapis incliné, nage, 10 000 pas."),
    "Salma": ("Diététicienne du sport", "#0b7d51", "2 000 kcal, 180 g de protéines, 2 repas et 1 shake."),
    "Hamza": ("Chef de préparation", "#0b6b47", "Deux fois 45 min de cuisine par semaine, rien d’autre."),
    "Karim": ("Sommeil et récupération", "#6b3fd4", "7 h 30 par nuit. Semaine allégée quand il le faut."),
    "Imane": ("Ramadan", "#2a1b6b", "Même plan, autres horaires."),
    "Léa": ("Coach caméra", "#d92d57", "Posture, épaules, jour J."),
    "Naïm": ("Suivi et chiffres", "#0a7f8a", "Pesée, moyenne, ajustements."),
    "Adam": ("Direction artistique", "#191741", "Ce dossier : une idée par page."),
}


def by(*names):
    av = "".join(f'<span class="av" style="--avc:{TEAM[n][1]}">{n[0]}</span>' for n in names)
    who = " et ".join(f"<b>{n}</b>" for n in names)
    return f'<div class="by">{av}<span>&nbsp;avec {who}</span></div>'


def X(s):
    return s.replace(" × ", '<span class="tx">×</span>').replace("× ", '<span class="tx">×</span>')


def page(ch, body, title=None, kick="", lede="", who=None, deco="", cls="", h1cls="", mini=False, mcls=""):
    global PN
    PN += 1
    hd = ""
    if title:
        d = f'<div class="deco">{deco}</div>' if deco else ""
        b = by(*who) if who else ""
        k = f'<div class="kick"><span class="kt">{kick}</span>{b}</div>' if (kick or b) else ""
        l = f'<p class="lede">{lede}</p>' if lede else ""
        hd = (f'<div class="clap"></div><header class="hd{" mini" if mini else ""}">{d}{k}'
              f'<h1 class="{h1cls}">{title}</h1>{l}</header>')
    return (f'<section class="page ch-{ch} {cls}" data-p="{PN}">{hd}<main class="{mcls}">{body}</main>'
            f'<footer><span class="ft">Opération 87</span><span class="pn">{PN}</span></footer></section>')


def tag(t):
    return f'<span class="tag">{t}</span>'


def li(ic, html, cls=""):
    return f'<div class="li {cls}">{icon(ic)}<div>{html}</div></div>'


# ------------------------------------------------------------------ illustrations
def il_bowl():
    rnd = random.Random(11)
    oats = ""
    for _ in range(46):
        a, r = rnd.uniform(0, 6.283), rnd.uniform(0, 70)
        import math
        x, y = 100 + r * math.cos(a), 100 + r * math.sin(a)
        oats += f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="5.4" ry="2.7" transform="rotate({rnd.randint(0,180)} {x:.1f} {y:.1f})" fill="#e2c995"/>'
    ban = "".join(f'<g transform="translate({x} {y})"><circle r="15" fill="#ffe7a0" stroke="#efc552" stroke-width="3"/>'
                  f'<circle r="2" cx="-3" cy="-2" fill="#d2a23c"/><circle r="2" cx="3.4" cy="-1" fill="#d2a23c"/><circle r="2" cy="3.6" fill="#d2a23c"/></g>'
                  for x, y in [(62, 70), (92, 54), (124, 62), (70, 104), (100, 88)])
    nuts = "".join(f'<path transform="translate({x} {y}) rotate({a})" d="M-9 0c0-7 6-9 10-7s9 2 9 8-6 8-10 7-9-2-9-8z" fill="#9b6b3b"/>'
                   f'<path transform="translate({x} {y}) rotate({a})" d="M-4-1q5 3 9 0" stroke="#7a4f27" stroke-width="2" fill="none"/>'
                   for x, y, a in [(126, 108, 20), (104, 128, -30), (138, 132, 60), (76, 138, 10), (118, 150, -10)])
    return (f'<svg class="il" viewBox="0 0 200 200"><circle cx="100" cy="100" r="95" fill="#fff" stroke="#191741" stroke-width="6"/>'
            f'<circle cx="100" cy="100" r="79" fill="#f7ecd2"/>{oats}{ban}{nuts}</svg>')


def il_plate(labels=False, cls="il"):
    rnd = random.Random(5)
    import math
    veg = ""
    for _ in range(30):
        a, r = rnd.uniform(math.pi / 2, 3 * math.pi / 2), rnd.uniform(14, 70)
        x, y = 100 + r * math.cos(a), 100 + r * math.sin(a)
        if x > 92:
            continue
        veg += rnd.choice([f'<circle cx="{x:.0f}" cy="{y:.0f}" r="5.5" fill="#2f9c5b"/>',
                           f'<circle cx="{x:.0f}" cy="{y:.0f}" r="4" fill="#ff9d3b"/>',
                           f'<circle cx="{x:.0f}" cy="{y:.0f}" r="7.5" fill="#1f8349"/>'])
    rice = ""
    for _ in range(40):
        x, y = rnd.uniform(108, 170), rnd.uniform(108, 170)
        if (x - 100) ** 2 + (y - 100) ** 2 > 70 ** 2:
            continue
        rice += f'<ellipse cx="{x:.0f}" cy="{y:.0f}" rx="4.4" ry="1.9" transform="rotate({rnd.randint(0,180)} {x:.0f} {y:.0f})" fill="#e4d6ae"/>'
    grill = "".join(f'<path d="M{118+i*13} 40 L{108+i*13} 92" stroke="#b9743a" stroke-width="5" stroke-linecap="round"/>' for i in range(4))
    lab = ""
    if labels:
        lab = ('<text x="56" y="110" text-anchor="middle" font-family="Anton" font-size="34" fill="#fff">½</text>'
               '<text x="138" y="76" text-anchor="middle" font-family="Anton" font-size="27" fill="#191741">¼</text>'
               '<text x="138" y="150" text-anchor="middle" font-family="Anton" font-size="27" fill="#191741">¼</text>')
    return (f'<svg class="{cls}" viewBox="0 0 200 200"><circle cx="100" cy="100" r="95" fill="#fff" stroke="#191741" stroke-width="6"/>'
            f'<clipPath id="pc{labels}"><circle cx="100" cy="100" r="79"/></clipPath><g clip-path="url(#pc{labels})">'
            f'<rect x="20" y="20" width="80" height="160" fill="#63c183"/><rect x="100" y="20" width="80" height="80" fill="#f1bd8a"/>'
            f'<rect x="100" y="100" width="80" height="80" fill="#fbf4df"/>{veg}{grill}{rice}'
            f'<path d="M100 20V180M100 100H180" stroke="#fff" stroke-width="5"/></g>{lab}</svg>')


def il_shake():
    return ('<svg class="il" viewBox="0 0 200 200"><rect x="30" y="52" width="70" height="132" rx="13" fill="#d4f0e2" stroke="#191741" stroke-width="6"/>'
            '<path d="M33 112h64v58a11 11 0 0 1-11 11H44a11 11 0 0 1-11-11z" fill="#efd3ae"/>'
            '<rect x="24" y="30" width="82" height="26" rx="8" fill="#191741"/><rect x="52" y="14" width="26" height="20" rx="6" fill="#191741"/>'
            '<path d="M44 84h18M44 98h12" stroke="#191741" stroke-width="5" stroke-linecap="round"/>'
            '<circle cx="150" cy="140" r="37" fill="#e5484d" stroke="#191741" stroke-width="6"/>'
            '<path d="M150 106c0-12 5-20 12-24" stroke="#191741" stroke-width="6" fill="none" stroke-linecap="round"/>'
            '<path d="M158 92c9-13 24-11 30-7-6 12-20 15-30 7z" fill="#2f9c5b" stroke="#191741" stroke-width="5" stroke-linejoin="round"/>'
            '<path d="M133 128q4-10 12-11" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/></svg>')


def il_moon():
    return ('<svg class="moon" viewBox="0 0 100 100"><mask id="mm"><rect width="100" height="100" fill="#fff"/><circle cx="62" cy="40" r="34" fill="#000"/></mask>'
            '<circle cx="46" cy="50" r="40" fill="#f5b93a" mask="url(#mm)"/>'
            '<path d="M78 22l2.6 6.4 6.4 2.6-6.4 2.6L78 40l-2.6-6.4L69 31l6.4-2.6z" fill="#f5b93a"/>'
            '<circle cx="90" cy="54" r="2.4" fill="#f5b93a"/><circle cx="70" cy="64" r="1.8" fill="#f5b93a"/></svg>')


# ------------------------------------------------------------------ graphique de trajectoire
def chart():
    W, H = 560, 322
    x0, x1, yb, yt = 40, 542, 270, 26
    X_ = lambda w: x0 + (x1 - x0) * w / 17
    Y = lambda kg: yb - (yb - yt) * (kg - 84) / (106 - 84)
    mid, fast, slow = plan.traj("mid"), plan.traj("fast"), plan.traj("slow")
    g = []
    g.append(f'<rect x="{X_(11):.1f}" y="{yt}" width="{X_(15)-X_(11):.1f}" height="{yb-yt}" fill="#efe9fc"/>')
    RAM = f'<text x="{(X_(11)+X_(15))/2:.1f}" y="{Y(102.3):.1f}" text-anchor="middle" style="fill:#5a3fb0;font-weight:700">Ramadan</text>'
    for kg in (85, 90, 95, 100, 105):
        g.append(f'<line x1="{x0}" x2="{x1}" y1="{Y(kg):.1f}" y2="{Y(kg):.1f}" stroke="#e2e5f4" stroke-width="1"/>')
        g.append(f'<text x="{x0-7}" y="{Y(kg)+4.5:.1f}" text-anchor="end">{kg}</text>')
    g.append(RAM)
    band = " ".join(f"{X_(i):.1f},{Y(v):.1f}" for i, v in enumerate(slow)) + " " + " ".join(
        f"{X_(i):.1f},{Y(v):.1f}" for i, v in reversed(list(enumerate(fast))))
    g.append(f'<polygon points="{band}" fill="#2b50e8" opacity=".13"/>')
    g.append(f'<line x1="{x0}" x2="{x1}" y1="{Y(87):.1f}" y2="{Y(87):.1f}" stroke="#ff5a4e" stroke-width="1.5"/>')
    g.append(f'<text x="{x0+6}" y="{Y(87)+16:.1f}" style="fill:#c2362b;font-weight:800">objectif 87 kg</text>')
    g.append('<polyline points="' + " ".join(f"{X_(i):.1f},{Y(v):.1f}" for i, v in enumerate(mid)) +
             '" fill="none" stroke="#2b50e8" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>')
    from datetime import date
    for d, lab in ((date(2026, 12, 1), "déc."), (date(2027, 1, 1), "janv."), (date(2027, 2, 1), "fév."), (date(2027, 3, 1), "mars")):
        w = (d - plan.START).days / 7
        g.append(f'<line x1="{X_(w):.1f}" x2="{X_(w):.1f}" y1="{yb}" y2="{yb+6}" stroke="#aeb3d3" stroke-width="1"/>')
        g.append(f'<text x="{X_(w)+4:.1f}" y="{yb+21}">{lab}</text>')
    g.append(f'<line x1="{x0}" x2="{x1}" y1="{yb}" y2="{yb}" stroke="#aeb3d3" stroke-width="1"/>')
    g.append(f'<text x="{x0}" y="{yb+40}" style="font-weight:700;fill:#191741">23 novembre</text>')
    g.append(f'<text x="{x1}" y="{yb+40}" text-anchor="end" style="font-weight:700;fill:#191741">22 mars</text>')
    for w, lab in ((0, "104"), (4, "99"), (11, "92,5"), (15, "89,5"), (17, "88")):
        v = mid[w]
        g.append(f'<circle cx="{X_(w):.1f}" cy="{Y(v):.1f}" r="6.5" fill="#2b50e8" stroke="#fff" stroke-width="2.5"/>')
        anchor = "start" if w == 0 else ("end" if w == 17 else "middle")
        dx = 9 if w == 0 else (2 if w == 17 else 10)
        yy = Y(v) + 26 if w == 17 else Y(v) - 13
        g.append(f'<text class="v" x="{X_(w)+dx:.1f}" y="{yy:.1f}" text-anchor="{anchor}">{lab} kg</text>')
    return f'<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Trajectoire cible du poids, de 104 kg à environ 88 kg en 17 semaines">{"".join(g)}</svg>'


def paliers():
    P = [("menu actuel", 2000), ("S18–19", 2150), ("S20–21", 2300), ("S22–23", 2450), ("S24–25", 2600), ("entretien", 2750)]
    W, H, yb = 560, 150, 118
    g = [f'<line x1="20" x2="540" y1="{yb}" y2="{yb}" stroke="#aeb3d3" stroke-width="1"/>']
    for i, (lab, v) in enumerate(P):
        cx = 62 + i * 87
        h = v / 2750 * 84
        col = "#0a7f8a" if i else "#9fb1b4"
        g.append(f'<path d="M{cx-12} {yb}V{yb-h+4}a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4V{yb}z" fill="{col}"/>')
        g.append(f'<text class="v" x="{cx}" y="{yb-h-7:.0f}" text-anchor="middle">{fr(v)}</text>')
        g.append(f'<text x="{cx}" y="{yb+17}" text-anchor="middle">{lab}</text>')
    return f'<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Paliers de calories après le mariage, de 2 000 à environ 2 750 kcal">{"".join(g)}</svg>'


# ------------------------------------------------------------------ pages
def p_cover():
    global PN
    PN += 1
    strip = "".join(pic(k, i) for k, i in (("row", 1), ("pushup", 0), ("goblet", 1), ("treadmill", 0), ("hang", 1)))
    return f'''<section class="page cover" data-p="1">
<div class="clap"></div>
<div class="cv-top"><span>Dossier de préparation physique</span><span>{fdl(plan.START)} 2026 → {fdl(plan.WEDDING)} 2027</span></div>
<div class="cv-title"><div class="op an">Opération</div>
<div class="n87 an">87<span class="from">départ<b>104 kg</b></span><span class="kg">kg</span></div></div>
<div class="strip ch-film">{strip}</div>
<div class="cv-name an">Mohamed Benmoussa</div>
<div class="cv-role">dans le rôle de l’athlète</div>
<div class="cv-stats"><div><b>17 semaines</b><span>quatre actes, une seule routine</span></div>
<div><b>3 séances</b><span>à connaître par cœur : A, B, C</span></div>
<div><b>2 repas + 1 shake</b><span>les mêmes tous les jours</span></div></div>
<div class="billing"><small>un plan en</small> 4 actes <small>avec</small> Ilyas Maya Idriss Salma Hamza Karim Imane Léa Naïm Adam
<small>force</small> calisthénie <small>cardio</small> cantine <small>ramadan</small> jour J</div>
<div class="clap"></div></section>'''


def p_pitch():
    T = [("#0b7d51", "#fff", "fork-knife", "2 000", "kcal par jour, repos compris"),
         ("#d92d57", "#fff", "egg", "180 g", "de protéines, pour garder le muscle"),
         ("#ffc531", "#191741", "bowl-food", "2 + 1", "deux repas et un shake, toujours les mêmes"),
         ("#2b50e8", "#fff", "barbell", "6 jours", "actifs : 4 muscu, 1 circuit, 1 nage"),
         ("#ff8a1f", "#191741", "sneaker-move", "10 000", "pas par jour, tapis compris"),
         ("#2a1b6b", "#fff", "moon-stars", "7 h 30", "de sommeil, au minimum")]
    tiles = "".join(f'<div class="tile" style="--tc:{c};--to:{o}">{icon(ic)}<b>{n}</b><span>{t}</span></div>' for c, o, ic, n, t in T)
    body = (f'<div class="tiles">{tiles}</div>'
            f'<div class="banner">{icon("target")}<div>Résultat visé : <b>−1 kg par semaine</b> en moyenne. Le gras part, le muscle reste.</div></div>')
    return page("night", body, "Le pitch", "Tout le plan en six chiffres",
                "Tu les appliques tous les jours, sans réfléchir. Le reste du dossier explique comment.", deco=icon("film-slate"))


def p_scenario():
    cps = [("#2b50e8", fd(wk_end(4)), "≈ 99", "1 mois"), ("#2b50e8", fd(wk_end(11)), "≈ 92,5", "2 mois et demi : ton ancien meilleur physique"),
           ("#d92d57", fd(wk_end(15)), "≈ 89,5", "3 mois et demi : le rôle"), ("#f5b93a", fd(plan.WEDDING), "≈ 88", "le mariage")]
    c = "".join(f'<div class="cp" style="--cc:{col}"><small>{d}</small><b>{k} kg</b><span>{t}</span></div>' for col, d, k, t in cps)
    body = (chart() + f'<div class="cps">{c}</div>'
            '<div class="card"><p class="h3">Pourquoi pas 15 kg en 2 mois et demi ?</p>'
            '<p class="small" style="margin-top:1.4mm">Ça ferait 1,4 kg par semaine. À ce rythme tu perds du muscle avec le gras : plus léger, mais mou à l’image. '
            'Chez des sportifs suivis, perdre 0,7 % du poids par semaine a mieux préservé le muscle et la force que 1,4 %. Ton plan tourne autour de 0,9 %.</p></div>'
            '<p class="small mute">Zone bleue : là où tu dois te trouver si tu suis le plan. Les deux premières semaines descendent plus vite : c’est surtout de l’eau.</p>')
    return page("night", body, "Le scénario", "17 semaines, du 23 novembre au 22 mars",
                "104 kg aujourd’hui. Autour de 88 kg le jour du mariage, 87 si tu ne rates presque rien.", who=("Naïm",))


def p_cast():
    m = "".join(f'<div class="mem" style="--avc:{c}"><div class="A">{n[0]}</div><div><b>{n}</b><i>{r}</i><span>{l}</span></div></div>'
                for n, (r, c, l) in TEAM.items())
    body = (f'<div class="cast">{m}</div>'
            '<p class="small mute">Dix spécialités, un seul plan. Équipe imaginée par Claude pour ce dossier : ces prénoms ne sont pas de vraies personnes.</p>')
    return page("night", body, "Le casting", "Ton équipe de préparation", "Chacun a un rôle. Tu retrouves leur nom en haut des pages qu’ils ont écrites.",
                deco=icon("users-three"))


def p_week():
    R = [("Lundi", "#2b50e8", "#fff", "A", "Séance A, haut du corps", "puis tapis incliné 25 min", "75 min"),
         ("Mardi", "#1c2f9c", "#fff", "B", "Séance B, bas du corps et abdos", "puis tapis incliné 20 min", "70 min"),
         ("Mercredi", "#0a7f8a", "#fff", icon("person-simple-swim"), "Nage", "30 à 40 min, sans forcer", "40 min"),
         ("Jeudi", "#2b50e8", "#fff", "A", "Séance A, haut du corps", "puis tapis incliné 25 min", "75 min"),
         ("Vendredi", "#1c2f9c", "#fff", "B", "Séance B, bas du corps et abdos", "puis tapis incliné 20 min", "70 min"),
         ("Samedi", "#ff8a1f", "#191741", "C", "Séance C, circuit athlète", "puis tapis incliné 20 min", "55 min"),
         ("Dimanche", "#eceefb", "#191741", icon("person-simple-walk"), "Repos", "marche, famille, 10 000 pas", "")]
    rows = "".join(f'<div class="wkr"><div class="d">{d}</div><div class="b" style="--bc:{c};--bo:{o}"><div class="L">{L}</div>'
                   f'<div class="t"><b>{t}</b><span>{s}</span></div></div><div class="m">{m}</div></div>' for d, c, o, L, t, s, m in R)
    acts = "".join(f'<div class="act"><small>Acte {n}, S{a} à S{b}</small><b>{nm}</b><span>{fd(wk_start(a))} → {fd(wk_end(b))}</span><em>{ds}</em></div>'
                   for n, nm, a, b, ds in plan.ACTS)
    body = (f'<div class="wk">{rows}</div><div class="acts">{acts}</div>'
            + '<div class="g2">' + li("sneaker-move", "<b>Chaque jour : 10 000 pas.</b> Le tapis compte dedans.")
            + li("arrows-clockwise", "<b>Séance ratée ?</b> Tu la fais le lendemain. Jamais deux le même jour.") + "</div>")
    return page("night", body, "Le plan de tournage", "La même semaine, 17 fois",
                "Six jours actifs, un jour de repos. Tu ne changes rien d’une semaine à l’autre.", h1cls="s", deco=icon("calendar-check"))


def p_day():
    R = [("7:30", "", "#ffc531", "#191741", "scales", "Réveil", "Pesée, 500 ml d’eau, café ou thé sans sucre."),
         ("10:30", "", "#0b7d51", "#fff", "bowl-food", "Repas 1 : le bol", "Flocons, skyr, whey, banane, noix. La créatine avec."),
         ("12–16 h", "au choix", "#2b50e8", "#fff", "barbell", "La séance", "Le créneau que tu veux. Shake et pomme juste après."),
         ("17:30", "", "#0b7d51", "#fff", "fork-knife", "Repas 2 : l’assiette", "Poulet, riz, légumes. 500 ml d’eau avant."),
         ("20:30", "", "#ff8a1f", "#191741", "person-simple-walk", "Marche", "15 à 20 min s’il te manque des pas."),
         ("23:00", "", "#2a1b6b", "#fff", "moon-stars", "Écrans coupés", "Au lit à 23 h 30 : 7 h 30 de sommeil minimum.")]
    rows = "".join(f'<div class="tlr"><div class="h">{h}<small>{s}</small></div><div class="dot" style="--dc:{c};--do:{o}">{icon(ic)}</div>'
                   f'<div class="x"><b>{t}</b><span>{x}</span></div></div>' for h, s, c, o, ic, t, x in R)
    body = (f'<div class="tl">{rows}</div>'
            f'<div class="banner">{icon("clock")}<div>Jour sans séance : le shake et la pomme à <b>14 h</b>. Rien d’autre ne bouge.</div></div>')
    return page("night", body, "La journée type", "Six rendez-vous par jour",
                "Les heures peuvent glisser. L’ordre ne change pas.", who=("Karim", "Salma"), deco=icon("sun-horizon"))


def ex(n, name, dose, rest, cue, key, nums=(1, 2)):
    sc = fig.SCENES[key]
    if len(sc) == 2:
        frames = pic(key, 0, nums[0]) + pic(key, 1, nums[1])
    else:
        frames = pic(key, 0) + f'<div class="chrono"><div>{icon("timer")}{dose.split(" × ")[-1]}</div></div>'
    return (f'<div class="ex"><div class="pics">{frames}</div><div><div class="nm"><span class="no">{n}</span><h3>{name}</h3></div>'
            f'<div class="dose">{X(dose)}</div><div class="rest">{icon("timer")} repos {rest}</div><p class="cue">{cue}</p></div></div>')


def fin(mn, txt):
    return (f'<div class="fin">{pic("treadmill")}<div><b>Tapis incliné <em>{mn} min</em></b>'
            f'<span>{txt}</span></div></div>')


def p_a1():
    body = (f'<div class="sw">{icon("fire")}<div><b>Échauffement, 5 min :</b> rameur facile, 10 rotations d’épaules, une série légère du premier exercice.</div></div>'
            + ex(1, "Rowing australien", "4 × 8 à 12", "90 s", "Corps gainé, poitrine à la barre. Trop facile ? Descends la barre.", "row")
            + ex(2, "Pompes", "4 × 8 à 15", "90 s", "Poitrine près du sol. Trop dur ? Mains sur un banc.", "pushup")
            + ex(3, "Tirage vertical", "3 × 10 à 12", "75 s", "Tire les coudes vers les hanches, sans te balancer.", "pulldown")
            + ex(4, "Développé incliné haltères", "3 × 8 à 12", "90 s", "Descends en 2 secondes, pousse fort.", "incline"))
    return page("train", body, "Séance A", tag("Lundi") + tag("Jeudi") + "&nbsp; 45 à 50 min, puis le tapis",
                "Haut du corps : dos, pectoraux, épaules, bras. Ce que la caméra voit en premier.", who=("Ilyas", "Maya"), deco="A")


def p_a2():
    body = (ex(5, "Élévations latérales", "3 × 12 à 15", "60 s", "Haltères légers, sans élan. C’est ce qui élargit les épaules.", "lateral")
            + ex(6, "Curl, puis triceps poulie", "3 × 12 à 15", "60 s", "Les deux à la suite, puis tu te reposes.", "arms", ("a", "b"))
            + ex(7, "Suspension à la barre", "3 × 20 à 40 s", "60 s", "Dès la semaine 5 : 3 × 3 descentes lentes de 5 secondes.", "hang")
            + fin(25, "Tu dois pouvoir parler. Réglages semaine par semaine à la page du cardio.")
            + f'<div class="prog">{icon("chart-line-up")}<div><b>La règle pour progresser</b><span>Toutes les séries en haut de la fourchette ? La fois suivante : '
              '+1 à 2 kg aux haltères, +2,5 à 5 kg aux machines. Garde toujours 1 à 2 répétitions en réserve.</span></div></div>')
    return page("train", body, "Séance A, la suite", "", "", deco="A", mini=True, mcls="big")


def p_b1():
    body = (f'<div class="sw">{icon("fire")}<div><b>Échauffement, 5 min :</b> vélo facile, 10 squats à vide, 10 ponts fessiers.</div></div>'
            + ex(1, "Goblet squat", "4 × 10 à 12", "2 min", "Haltère contre la poitrine, dos droit. Ou presse à cuisses.", "goblet")
            + ex(2, "Soulevé jambes tendues", "3 × 10 à 12", "2 min", "Fesses en arrière, dos plat, haltères le long des jambes.", "rdl")
            + ex(3, "Fentes arrière", "3 × 10 par jambe", "90 s", "Grand pas en arrière, genou avant au-dessus du pied.", "lunge")
            + ex(4, "Leg curl", "3 × 12 à 15", "60 s", "Assis ou allongé. Remonte lentement, en 3 secondes.", "legcurl"))
    return page("train", body, "Séance B", tag("Mardi") + tag("Vendredi") + "&nbsp; 45 à 50 min, puis le tapis",
                "Bas du corps et abdos. Les grosses masses musculaires : c’est là que tu dépenses le plus.", who=("Ilyas",), deco="B")


def p_b2():
    body = (ex(5, "Mollets debout", "3 × 12 à 15", "45 s", "Sur une marche. Une seconde de pause en haut.", "calf")
            + ex(6, "Relevés de genoux suspendu", "3 × 8 à 12", "60 s", "Sans balancer. Trop dur ? Sur la chaise romaine.", "kneeraise")
            + ex(7, "Planche", "3 × 30 à 45 s", "45 s", "Fessiers serrés, bassin droit. Respire.", "plank")
            + fin(20, "Après les jambes, garde une pente plus douce si besoin.")
            + f'<div class="prog">{icon("lightbulb")}<div><b>Les abdos ne font pas fondre le ventre</b><span>Ils le rendent solide. '
              'Le gras du ventre part avec le déficit, souvent en dernier : c’est normal, continue.</span></div></div>')
    return page("train", body, "Séance B, la suite", "", "", deco="B", mini=True, mcls="big")


def p_c():
    S = [("rower", 0, "Rameur", "250 m"), ("pushup", 1, "Pompes", "× 10"), ("row", 1, "Rowing australien", "× 10"),
         ("goblet", 1, "Goblet squat", "× 12"), ("farmer", 0, "Marche du fermier", "30 m")]
    st = "".join(f'<div class="st">{pic(k, i, n + 1)}<b>{nm}</b><i>{X(d)}</i></div>' for n, (k, i, nm, d) in enumerate(S))
    body = (f'<div class="x5"><div class="big">5<small>tours</small></div><div><p class="h2">Cinq tours, dans l’ordre</p>'
            '<p class="small" style="margin-top:1mm">90 secondes de repos à la fin de chaque tour. Rythme soutenu, gestes propres. Semaines 1 et 2 : trois tours.</p></div></div>'
            f'<div class="loop">{st}</div>'
            + '<div class="g2">'
            + li("barbell", "<b>Marche du fermier :</b> deux haltères lourds, dos droit, tu marches 30 m.")
            + li("heartbeat", "<b>Le bon rythme :</b> essoufflé, mais capable de dire une phrase courte.") + "</div>"
            + fin(20, "Ou 30 min de marche dehors. Le samedi, c’est toi qui choisis.")
            + f'<div class="prog">{icon("chart-line-up")}<div><b>Pour progresser</b><span>Haltères plus lourds au squat et au fermier, '
              'puis 12 pompes et 12 rowings par tour. Jamais plus de cinq tours.</span></div></div>')
    return page("train", body, "Séance C", tag("Samedi") + "&nbsp; 30 min, puis le tapis",
                "Le circuit athlète : tout le corps, le cœur qui monte. C’est la séance qui te fait bouger comme un sportif.", who=("Ilyas", "Idriss"), deco="C")


def p_cardio():
    tb = ('<table class="tb"><tr><th>Semaines</th><th>Pente</th><th>Vitesse</th><th>Durée</th></tr>'
          '<tr><td>S1 et S2</td><td><b>6 %</b></td><td>4,5 km/h</td><td><b>15 min</b></td></tr>'
          '<tr><td>S3 à S6</td><td><b>8 à 10 %</b></td><td>5 km/h</td><td><b>25 min</b></td></tr>'
          '<tr><td>S7 à S11</td><td><b>10 à 12 %</b></td><td>5 à 5,5 km/h</td><td><b>30 min</b></td></tr>'
          '<tr><td>Ramadan</td><td colspan="3">marche à plat, 20 à 30 min après l’iftar</td></tr>'
          '<tr><td>S16 et S17</td><td><b>10 à 12 %</b></td><td>5 à 5,5 km/h</td><td><b>30 min</b></td></tr></table>')
    body = (f'<div class="row" style="align-items:center"><div style="flex:0 0 35mm">{pic("treadmill")}</div><div class="grow">{tb}</div></div>'
            + '<div class="g2">' + li("smiley", "<b>Tu dois pouvoir parler.</b> Si tu ne peux plus, ralentis.")
            + li("hand-fist", "<b>Ne tiens pas les barres.</b> Si tu t’accroches, baisse la pente.") + "</div>"
            + f'<div class="banner">{icon("flame")}<div>À ton poids, 25 min de tapis incliné : <b>≈ 250 à 300 kcal</b> (estimation).</div></div>'
            + f'<div class="duo">{pic("swim")}<div><p class="h2">Nage, le mercredi</p><p class="small" style="margin-top:.8mm">30 à 40 min. Quatre longueurs, 30 s de pause, tu répètes. Zéro choc pour les genoux.</p></div></div>'
            + f'<div class="duo">{pic("walk")}<div><p class="h2">10 000 pas par jour</p><p class="small" style="margin-top:.8mm">8 000 les deux premières semaines, puis 10 000. Ton téléphone les compte déjà.</p></div></div>')
    return page("cardio", body, "Le cardio", "Tous les jours, jamais violent",
                "De la marche en pente plutôt que de la course : tu brûles beaucoup, tes genoux restent tranquilles, tu récupères vite.", who=("Idriss",),
                deco=icon("heartbeat"), mcls="tight")


def p_pull():
    L = [("row", 0, "Rowing australien, barre à la poitrine", "4 × 12", "Le corps incliné à 45°. C’est ton point de départ."),
         ("row", 1, "Barre à hauteur de hanches", "4 × 10", "Plus tu es à l’horizontale, plus c’est lourd."),
         ("hang", 0, "Pieds sur un banc + suspension", "4 × 8, puis 3 × 40 s", "Tes mains et tes épaules s’habituent à ton poids."),
         ("hang", 1, "Descentes lentes", "3 × 3 à 5", "Monte avec un step, descends en 5 secondes. Pas avant la semaine 5."),
         ("hang", 1, "Première traction", "5 × 1, puis 3 × 3", "Menton au-dessus de la barre, sans élan.")]
    lv = "".join(f'<div class="lv"><div class="n">{n + 1}</div>{pic(k, i)}<div><b>{t}</b><i>{X(d)}</i><span>{x}</span></div></div>'
                 for n, (k, i, t, d, x) in enumerate(L))
    body = (f'<div class="lad">{lv}</div>'
            f'<div class="banner">{icon("trend-down")}<div>Sans élastique. Chaque kilo perdu, c’est <b>un kilo de moins à tirer</b> : la barre se rapproche toute seule.</div></div>'
            f'<div class="prog">{icon("hand-fist")}<div><b>Pareil pour les pompes</b><span>Mains sur un banc, puis au sol, puis 4 × 15 au sol, puis pieds surélevés. '
            'Tu passes au niveau suivant quand le haut de la fourchette est propre.</span></div></div>')
    return page("train", body, "Objectif traction", "Cinq niveaux, dans l’ordre",
                "Tu valides un niveau quand toutes les séries passent proprement. Tu le travailles en séance A.",
                who=("Maya",), h1cls="s", deco=icon("stairs"))


def meal_card(il, name, when, key, prep, extra=""):
    t = tot(MEALS[key])
    unit = {"banane": "1", "pomme": "1"}
    ing = "".join(f'<span><b>{unit.get(f, str(g) + " g")}</b> {FOODS[f][0].lower()}</span>' for f, g in MEALS[key])
    return (f'<div class="meal">{il}<div><div class="hh"><b>{name}</b><i>{when}</i></div><div class="ing">{ing}</div>'
            f'<p class="k">{fr(round(t["kcal"], -1))} kcal, {fr(t["p"])} g de protéines{extra}</p><p class="pp">{prep}</p></div></div>')


def p_food():
    t = tot(plan.DAY)
    body = (meal_card(il_bowl(), "Le bol", "vers 10 h 30", "bol",
                      "Flocons + 200 ml d’eau chaude, 2 min. Skyr et whey, tu mélanges. Banane et noix dessus.")
            + meal_card(il_plate(), "L’assiette", "vers 17 h 30", "assiette",
                        "Poids crus. 90 g de riz sec = 270 g cuit. L’huile : une cuillère à soupe, mesurée.")
            + meal_card(il_shake(), "Le shake", "après la séance", "shake", "Whey dans 300 ml d’eau, et la pomme à croquer.")
            + f'<div class="tot"><div><b>{fr(round(t["kcal"], -1))}</b><span>kcal</span></div><div><b>{fr(t["p"])} g</b><span>protéines</span></div>'
              f'<div><b>{fr(t["c"])} g</b><span>glucides</span></div><div><b>{fr(t["f"])} g</b><span>lipides</span></div><div><b>{fr(t["fib"])} g</b><span>fibres</span></div></div>'
            + '<p class="small mute">Valeurs moyennes, calculées sur ces portions. Tout se pèse cru.</p>')
    return page("food", body, "La cantine", "Le menu fixe, tous les jours, repos compris",
                "Deux repas et un shake. Tu pèses, tu manges.", who=("Salma",), deco=icon("fork-knife"), mcls="tight")


def p_swap():
    P = [("300 g", "Dinde", "escalope, poids cru"), ("300 g", "Bœuf haché 5 %", "huile : 2 c. à café seulement"),
         ("380 g", "Poisson blanc", "cabillaud, colin"), ("250 g", "Saumon", "sans huile, 1 à 2 fois par semaine")]
    C = [("400 g", "Pommes de terre", "poids cru"), ("90 g", "Pâtes", "poids sec"), ("90 g", "Semoule", "poids sec"), ("120 g", "Pain", "≈ une demi-baguette")]
    g = lambda L: '<div class="g4">' + "".join(f'<div class="sw2"><b>{a}</b><i>{b}</i><span>{c}</span></div>' for a, b, c in L) + "</div>"
    ep = "".join(f"<span>{x}</span>" for x in ("ras-el-hanout", "paprika", "cumin", "ail", "citron", "harissa", "moutarde", "sauce soja", "herbes", "vinaigre", "cornichons"))
    body = ('<p class="h2">À la place des 300 g de poulet</p>' + g(P)
            + '<p class="h2" style="margin-top:1mm">À la place des 90 g de riz</p>' + g(C)
            + f'<p class="h2" style="margin-top:1mm">À volonté</p><div class="chips">{ep}</div>'
            + li("jar", "<b>Sauce maison :</b> 2 cuillères à soupe de skyr, citron, ail, herbes.")
            + '<div class="card"><p class="h3">Ce que tu bois</p><div class="lis" style="margin-top:2mm">'
            + li("drop", "<b>2,5 à 3 L d’eau</b> par jour. Café et thé sans sucre, sodas zéro si tu veux.")
            + li("prohibit", "<b>Aucune calorie liquide :</b> ni jus, ni soda, ni thé sucré.", "no") + "</div></div>")
    return page("food", body, "Les variantes", "Même assiette, autre goût",
                "Tu gardes la structure. Tu changes la protéine, le féculent ou les épices, jamais les quantités.", who=("Salma",), deco=icon("arrows-clockwise"))


def p_shop():
    q = plan.shopping(7)
    kg = lambda g: (fr(g / 1000, 2).rstrip("0").rstrip(",") + " kg") if g >= 1000 else f"{g} g"
    rows = [("Blanc de poulet halal", kg(q["poulet"])), ("Skyr nature", kg(q["skyr"])), ("Légumes surgelés, mélange", kg(q["legumes"])),
            ("Riz basmati", kg(q["riz"])), ("Flocons d’avoine", kg(q["flocons"])), ("Whey, certifiée halal", kg(q["whey"])),
            ("Noix", kg(q["noix"])), ("Bananes", "7"), ("Pommes", "7"), ("Huile d’olive", f"≈ {round(q['huile'] / 0.91 / 10) * 10} ml"),
            ("Créatine monohydrate", "35 g")]
    shop = '<table class="shop">' + "".join(f"<tr><td>{a}</td><td>{b}</td></tr>" for a, b in rows) + "</table>"
    S = [("Dimanche : 1,2 kg de poulet au four", "200 °C, épices, 20 à 25 min. Tu remplis 4 boîtes : lundi à jeudi."),
         ("Pendant la cuisson", "Riz pour 2 jours, légumes à la poêle avec l’huile mesurée."),
         ("Jeudi : 900 g de poulet", "3 boîtes, de vendredi à dimanche. Même méthode.")]
    steps = "".join(f'<div class="stp"><div class="n">{i + 1}</div><div><b>{a}</b><span>{b}</span></div></div>' for i, (a, b) in enumerate(S))
    body = ('<div class="g2" style="align-items:start">'
            f'<div class="card"><p class="h2">Pour 7 jours</p><div style="margin-top:2mm">{shop}</div></div>'
            f'<div class="col"><p class="h2">Deux fois 45 min</p><div class="steps">{steps}</div>'
            '<p class="small mute">Pèse le poulet cru, puis partage le plat cuit en parts égales.</p></div></div>'
            '<div class="card"><p class="h3">Conservation</p><div class="lis" style="margin-top:2mm">'
            + li("snowflake", "<b>La 4ᵉ boîte au congélateur :</b> un plat cuit se garde 3 jours au frigo.")
            + li("timer", "<b>Riz :</b> refroidi vite, mangé le lendemain au plus tard. Sinon, congèle des portions de 270 g cuit.")
            + li("bowl-food", "<b>Le bol</b> se fait en 3 minutes : rien à préparer d’avance.") + "</div></div>")
    return page("food", body, "Courses et cuisine", "Une liste, deux sessions",
                "Tu cuisines le dimanche et le jeudi. Les autres jours, tu réchauffes.", who=("Hamza",), h1cls="s", deco=icon("shopping-cart"))


def p_free():
    body = ('<div class="lis">'
            + li("check-circle", "<b>Il remplace l’assiette du soir.</b> Le bol et le shake restent.")
            + li("check-circle", "<b>Une assiette, pas un buffet.</b> Tu manges assis, lentement.")
            + li("check-circle", "<b>Ce que tu veux dedans :</b> tajine, burger, pizza. Sans boisson sucrée.")
            + li("check-circle", "<b>Le lendemain : journée normale.</b> Ni jeûne, ni séance en plus.") + "</div>"
            + f'<div class="banner">{icon("calendar-check")}<div>Choisis ton jour <b>à l’avance</b> : le samedi soir, par exemple. Pas le jour où tu craques.</div></div>'
            + '<div class="card" style="display:grid;grid-template-columns:46mm 1fr;gap:5mm;align-items:center;padding:4.4mm">'
            + il_plate(True, "il2")
            + '<div><p class="h2">Chez ta mère</p><p class="small" style="margin:1mm 0 2.4mm">Les autres soirs où tu manges le plat familial, sers-toi comme ça :</p><div class="lis">'
            + li("carrot", "<b>La moitié en légumes.</b>")
            + li("fire", "<b>Un quart en viande :</b> deux paumes, sans la peau.")
            + li("grains", "<b>Un quart en féculent :</b> un poing de semoule ou un quart de pain. Pas les deux.")
            + "</div></div></div>"
            + '<div class="g2">' + li("drop-half", "<b>Sauce :</b> une louche, en laissant l’huile à la surface du plat.")
            + li("egg", "<b>Peu de viande ?</b> Ajoute 200 g de skyr en dessert.") + "</div>")
    return page("food", body, "Le repas libre", "Un par semaine, prévu au planning",
                "Il fait partie du plan. C’est lui qui te fait tenir 17 semaines sans exploser.", who=("Salma",), deco=icon("pizza"), mcls="big")


def p_props():
    body = ('<div class="big3">'
            f'<div>{icon("jar")}<b>Whey</b><p class="h2" style="color:var(--deep);margin:.6mm 0">60 g par jour</p><span>30 g dans le bol, 30 g dans le shake. Prends-la certifiée halal.</span></div>'
            f'<div>{icon("lightning")}<b>Créatine monohydrate</b><p class="h2" style="color:var(--deep);margin:.6mm 0">5 g par jour</p><span>Tous les jours, avec le bol. Pas de phase de charge.</span></div>'
            f'<div>{icon("sun")}<b>Vitamine D, oméga-3</b><p class="h2" style="color:var(--deep);margin:.6mm 0">à voir</p><span>Hiver belge : demande un dosage à ton médecin. Poisson gras 1 à 2 fois par semaine.</span></div></div>'
            + f'<div class="banner">{icon("scales")}<div>La créatine garde de l’eau <b>dans le muscle</b> : +0,5 à 1,5 kg sur la balance au début. Ce n’est pas du gras.</div></div>'
            + '<p class="h2">Le matériel</p><div class="chips">' + "".join(f"<span>{x}</span>" for x in ("balance de cuisine", "pèse-personne", "mètre ruban", "shaker", "7 boîtes repas")) + "</div>"
            + '<p class="h2" style="margin-top:1mm">Ce que tu n’achètes pas</p><div class="lis">'
            + li("x-circle", "<b>Brûleurs de graisse :</b> de la caféine vendue cher.", "no")
            + li("x-circle", "<b>BCAA, détox, tisanes minceur :</b> aucun effet sur ton gras.", "no")
            + li("x-circle", "<b>Ceinture de sudation :</b> tu perds de l’eau, elle revient.", "no") + "</div>"
            + f'<div class="warn">{icon("first-aid")}<div>Maladie des reins, traitement en cours ou simple doute : <b>avis médical avant la créatine</b>.</div></div>')
    return page("food", body, "Les accessoires", "Deux compléments, cinq objets",
                "Tu peux réussir sans rien acheter d’autre que ça.", who=("Salma",), deco=icon("pill"))


def p_myths():
    M = [("L’eau chaude le matin brûle le gras.", "La température ne change rien. Mais 500 ml d’eau avant chaque repas aident à moins manger."),
         ("Les abdos font fondre le ventre.", "Non. Le ventre fond avec le déficit. Les abdos se verront après."),
         ("Plus tu transpires, plus tu maigris.", "Tu perds de l’eau. Elle revient au premier verre."),
         ("Un seul repas par jour fait maigrir plus vite.", "C’est le total de la journée qui compte. Deux repas tiennent mieux avec 180 g de protéines."),
         ("Il faut un brûleur de graisse.", "Un café avant la séance fait pareil.")]
    rows = "".join(f'<div class="myth"><div class="m">{icon("x-circle")}<span>«{NB}{a}{NB}»</span></div><div class="r">{icon("check-circle")}<span>{b}</span></div></div>' for a, b in M)
    body = ('<div class="colh"><span>On entend</span><span>En vrai</span></div>' + rows
            + '<p class="h2" style="margin-top:1.4mm">Ce que font vraiment les acteurs</p>'
            '<div class="big3">'
            f'<div>{icon("repeat")}<b>Le même menu</b><span>Pesé, répété, sans surprise. C’est ce que tu as page 14.</span></div>'
            f'<div>{icon("mountains")}<b>Du cardio facile</b><span>Presque tous les jours, en plus de la muscu. Pour toi : la marche en pente.</span></div>'
            f'<div>{icon("bed")}<b>Du sommeil</b><span>Dans une étude, dormir 5 h 30 au lieu de 8 h 30 a réduit de 55 % la part de gras perdue.</span></div></div>')
    return page("mind", body, "Les vraies astuces", "Ce qui marche, ce qui ne sert à rien",
                "Pas de secret d’acteur. Des habitudes ennuyeuses, tenues tous les jours.", who=("Léa", "Karim"), h1cls="s", deco=icon("lightbulb"))


def p_ramadan():
    global PN
    PN += 1
    r = tot(plan.RAMADAN_DAY)
    rt = ('<div class="rt">'
          '<div><small>Iftar</small><b>Dattes, eau, soupe</b><span>3 dattes, un grand verre d’eau, un bol de soupe légère.</span></div>'
          '<div><small>Après la prière</small><b>L’assiette</b><span>300 g de poulet, 70 g de riz, 400 g de légumes, l’huile.</span></div>'
          '<div><small>Soirée</small><b>Skyr et créatine</b><span>200 g de skyr. Tu bois 2,5 à 3 L entre l’iftar et le suhoor.</span></div>'
          '<div><small>Suhoor</small><b>Le bol</b><span>Le même que d’habitude, avec 750 ml d’eau.</span></div></div>')
    body = (rt + '<div class="card"><p class="h2">L’entraînement</p><div class="lis" style="margin-top:2.2mm">'
            + li("barbell", "<b>4 séances : A, B, A, B.</b> Trois séries maximum, 2 répétitions en réserve.")
            + li("clock", "<b>Deux créneaux :</b> 1 h avant l’iftar (40 min, léger) ou 1 h 30 après. Après avoir mangé, tu es plus fort.")
            + li("person-simple-walk", "<b>Pas de tapis incliné à jeun.</b> Marche à plat 20 à 30 min après l’iftar.")
            + li("warning", "<b>Vertige ou malaise :</b> tu arrêtes la séance.") + "</div></div>"
            + '<div class="g2">'
            + '<div class="card"><p class="h3" style="color:#f5b93a">Les pièges</p><p class="small" style="margin-top:1mm">Fritures, chebakia, jus sucrés. Une douceur par jour, choisie, pas subie.</p></div>'
            + f'<div class="card"><p class="h3" style="color:#f5b93a">Le total</p><p class="small" style="margin-top:1mm">≈ {fr(round(r["kcal"] + plan.SOUPE_KCAL, -1))} kcal et {fr(r["p"])} g de protéines. Objectif : −0,5 à −0,8 kg par semaine.</p></div></div>'
            + '<p class="small" style="color:#a79fdc">Début attendu le 8 février 2027, fin vers le 8 ou 9 mars : à confirmer selon l’observation de la lune.</p>')
    return (f'<section class="page ch-ramadan ram" data-p="{PN}"><div class="clap"></div>'
            f'<header class="hd" style="background:#1c1250">{il_moon()}<div class="kick"><span class="kt">Acte 3, semaines 12 à 15</span></div><h1>Ramadan</h1>'
            '<p class="lede" style="max-width:88mm">Ton plan est déjà en deux repas. Tu déplaces les horaires, tu gardes les quantités.</p>' + by("Imane") + '</header>'
            f'<main class="big" style="gap:3.1mm">{body}</main><footer><span class="ft">Opération 87</span><span class="pn">{PN}</span></footer></section>')


def p_cut():
    D = [("Tu as craqué ce soir", "Ça arrive", "Demain : bol, séance, assiette. Ni jeûne, ni séance en plus."),
         ("Tu as raté une séance", "Pas grave", "Tu la fais demain et tu décales la semaine d’un jour."),
         ("Toute la semaine a dérapé", "Ça se rattrape", "Tu reprends au prochain repas. Pas lundi, pas le 1er du mois.")]
    rows = "".join(f'<div class="dec"><b>{a}<small>{s}</small></b>{icon("arrow-right")}<span>{b}</span></div>' for a, s, b in D)
    ch = "".join(f"<span>{x}</span>" for x in ("skyr", "pomme", "soupe", "cornichons", "carottes", "thé", "soda zéro"))
    body = ('<div class="rule1"><small>Règle n° 1</small><b>Jamais deux fois de suite</b></div>' + rows
            + f'<div class="banner">{icon("lifebuoy")}<div>Journée impossible ? <b>Le minimum :</b> le bol, 20 min de marche, au lit à l’heure. Tu restes dans le plan.</div></div>'
            + f'<div class="g2"><div class="card"><p class="h3">Faim à 22 h</p><div class="chips" style="margin-top:2mm">{ch}</div></div>'
            '<div class="card"><p class="h3">+1 kg en une nuit</p><p class="small" style="margin-top:1.2mm">C’est de l’eau et du sel, pas du gras. Regarde la moyenne de la semaine.</p></div></div>')
    return page("mind", body, "Coupez ! On la refait", "Quand tu sors du plan",
                "Tu vas craquer, comme tout le monde. Ce qui compte, c’est la prise suivante.", who=("Léa",), h1cls="s", deco=icon("film-slate"), mcls="big")


def p_pilot():
    D = [("−0,7 à −1,2 kg", "par semaine", "Tu ne touches à rien."),
         ("Moins de 0,5 kg", "deux semaines de suite", "Vérifie d’abord tes pesées (riz sec, huile). Ensuite : riz à 50 g, ou 2 000 pas de plus."),
         ("Plus de 1,3 kg", "après la semaine 3", "Ajoute une banane et 20 g de flocons."),
         ("Force en baisse", "et grosse fatigue, deux semaines", "Semaine allégée : une série de moins partout.")]
    rows = "".join(f'<div class="dec"><b>{a}<small>{s}</small></b>{icon("arrow-right")}<span>{b}</span></div>' for a, s, b in D)
    body = (rows + '<div class="g2">'
            '<div class="card"><p class="h3">Le calcul</p><p class="small" style="margin-top:1.2mm">Dépense estimée au départ : ≈ 3 100 kcal par jour. Menu : 2 000. '
            'Écart : ≈ 1 000 kcal, soit ≈ 1 kg par semaine. Elle baisse avec ton poids : la trajectoire en tient compte.</p></div>'
            '<div class="card"><p class="h3">Deux garde-fous</p><p class="small" style="margin-top:1.2mm"><b>Jamais sous 1 800 kcal.</b> '
            f'Et une semaine allégée programmée en semaine 7, du {fd(wk_start(7))} au {fd(wk_end(7))}.</p></div></div>'
            + f'<div class="banner">{icon("camera")}<div>Photos <b>toutes les 4 semaines</b> : même endroit, même lumière, de face, de profil, de dos.</div></div>')
    return page("track", body, "Le pilotage", "Quatre situations, quatre réponses",
                "Tu te pèses chaque matin, au réveil. Tu ne regardes que la moyenne de la semaine.", who=("Naïm",), deco=icon("chart-line"), mcls="big")


def p_track():
    mid = plan.traj("mid")
    rows = ""
    for n in range(1, 18):
        cl = "r" if 12 <= n <= 15 else ""
        rows += (f'<tr class="{cl}"><td>S{n}</td><td>{fd(wk_start(n))} → {fd(wk_end(n))}</td><td class="c">{fr(mid[n], 1)}</td>'
                 '<td class="w"><i></i></td><td class="w"><i></i></td></tr>')
    tb = f'<table class="trk"><tr><th>Sem.</th><th>Dates</th><th>Cible (kg)</th><th>Ta moyenne</th><th>Tour de taille</th></tr>{rows}</table>'
    if TRACKER_URL:
        import segno, io
        buf = io.BytesIO()
        segno.make(TRACKER_URL, error="m").save(buf, kind="svg", scale=4, border=2, xmldecl=False, svgns=True, nl=False)
        qr = buf.getvalue().decode()
        qr = re.sub(r'width="\d+" height="\d+"', "", qr, 1)
        q = (f'<div class="qr">{qr}<div><b>Le suivi automatique</b><span>Tu entres ton poids, la courbe se trace et te dit si tu es dans la zone. '
             f'Scanne, ou ouvre le lien :</span><a href="{TRACKER_URL}">{TRACKER_URL}</a></div></div>')
    else:
        q = ""
    body = tb + q + '<p class="small mute">Lignes violettes : Ramadan. Mesure le tour de taille au nombril, une fois par semaine, le même jour.</p>'
    return page("track", body, "Le suivi", "17 semaines, une ligne chacune", "", who=("Naïm",), deco=icon("ruler"), mini=True)


def p_dday():
    R = [("J−10", "#ffc531", "#191741", "t-shirt", "L’essayage final", "Tu auras changé de taille : pas de retouche du costume avant cette date."),
         ("J−7", "#2b50e8", "#fff", "barbell", "Dernière séance B complète", "Ensuite, les jambes restent légères jusqu’au jour J."),
         ("J−3", "#0b7d51", "#fff", "repeat", "Rien ne change", "Même menu, même sel, même eau. Séances A courtes, deux séries."),
         ("J−1", "#2a1b6b", "#fff", "moon-stars", "Au lit tôt", "Coiffeur et barbe faits. Une vraie nuit vaut mieux que tout le reste."),
         ("Jour J", "#d92d57", "#fff", "camera", "Dix minutes avant", "Deux séries de pompes et de rowing. Épaules basses et en arrière, menton droit.")]
    rows = "".join(f'<div class="tlr"><div class="h">{h}</div><div class="dot" style="--dc:{c};--do:{o}">{icon(ic)}</div>'
                   f'<div class="x"><b>{t}</b><span>{x}</span></div></div>' for h, c, o, ic, t, x in R)
    body = (f'<div class="tl">{rows}</div>'
            f'<div class="warn">{icon("warning")}<div><b>Pas de déshydratation, pas de sauna, pas de journée sans glucides.</b> '
            'L’effet tient quelques heures et tu risques le malaise, devant la caméra ou à ton mariage.</div></div>')
    return page("mind", body, "Jour J", "Tournage et mariage : même protocole",
                "Tu n’inventes rien la dernière semaine. Tu arrives reposé, et le travail des 17 semaines se voit.", who=("Léa",), deco=icon("camera"))


def p_after():
    S = [("Dès la semaine 18 : +150 kcal toutes les 2 semaines", "20 g de riz et un fruit à chaque palier, jusqu’à ce que le poids se stabilise. Ton entretien sera autour de 2 700 à 2 900 kcal."),
         ("Tu gardes trois séances", "A, B et C, une fois chacune. Et 8 000 pas par jour."),
         ("Tu gardes la balance", "Deux pesées par semaine, les mêmes jours."),
         ("Une ligne rouge", "2 kg au-dessus de ton poids d’arrivée : deux semaines de menu fixe, et tu redescends.")]
    steps = "".join(f'<div class="stp"><div class="n">{i + 1}</div><div><b>{a}</b><span>{b}</span></div></div>' for i, (a, b) in enumerate(S))
    body = (f'<div class="steps" style="gap:2.8mm">{steps}</div>'
            f'<div class="card" style="background:#fff;border:1.2pt solid var(--hair);padding:2mm 2mm 1mm"><p class="small mute" style="padding:1mm 2mm 0">Calories par jour, palier par palier (estimation : tu t’arrêtes quand le poids ne bouge plus)</p>{paliers()}</div>'
            f'<div class="banner">{icon("trophy")}<div>Tu as déjà perdu 30 kg une fois. Cette fois, <b>la sortie est écrite d’avance</b>.</div></div>'
            '<div class="card"><p class="h3">Et ensuite</p><p class="small" style="margin-top:1.2mm">Un nouveau programme, construit sur tes chiffres : '
            'prise de muscle lente ou dernier affûtage. Reviens avec ta courbe et tes photos.</p></div>')
    return page("track", body, "Après le générique", "Le yo-yo se joue ici",
                "Tu remontes les calories par paliers et tu ne lâches pas la balance.", who=("Salma", "Naïm"), h1cls="s", deco=icon("confetti"), mcls="big")


def p_sources():
    S = [("Garthe et coll., 2011", "Rythme de perte de poids, muscle et force chez des sportifs.", "pubmed.ncbi.nlm.nih.gov/21558571"),
         ("Longland et coll., 2016", "Plus de protéines pendant un déficit avec entraînement intense.", "pubmed.ncbi.nlm.nih.gov/26817506"),
         ("Kreider et coll., 2017", "Position de l’ISSN sur la créatine : efficacité et sécurité.", "pubmed.ncbi.nlm.nih.gov/28615996"),
         ("Nedeltcheva et coll., 2010", "Manque de sommeil et perte de gras pendant un régime.", "pubmed.ncbi.nlm.nih.gov/20921542"),
         ("Triki et coll., 2024", "Musculation avant ou après la rupture du jeûne pendant le Ramadan.", "pubmed.ncbi.nlm.nih.gov/39628468"),
         ("Liu et coll., 2022", "Fenêtre de repas réduite ou simple restriction calorique.", "pubmed.ncbi.nlm.nih.gov/35443107"),
         ("Vispute et coll., 2011", "Exercices d’abdominaux et graisse abdominale.", "pubmed.ncbi.nlm.nih.gov/21804427"),
         ("Dennis et coll., 2010", "500 ml d’eau avant les repas (adultes de 55 à 75 ans).", "pubmed.ncbi.nlm.nih.gov/19661958"),
         ("Steinberg et coll., 2015", "Pesée quotidienne et perte de poids.", "pubmed.ncbi.nlm.nih.gov/25683820")]
    src = "".join(f'<i>{n + 1}</i><div><b>{a}.</b> {b}<a href="https://{u}/">{u}</a></div>' for n, (a, b, u) in enumerate(S))
    body = (f'<p class="h2">Les études derrière le plan</p><div class="src">{src}</div>'
            '<p class="small mute">Dépense énergétique : équation de Mifflin-St Jeor et facteur d’activité. Tapis incliné : équation de marche de l’ACSM. Ce sont des estimations.</p>'
            f'<div class="warn">{icon("stethoscope")}<div><b>Ce dossier n’est pas un avis médical.</b> Avant de démarrer : prise de sang et tension chez ton médecin, '
            'c’est dix minutes. Douleur dans la poitrine, malaise ou vertiges à l’effort : tu arrêtes et tu consultes.</div></div>'
            '<div class="grow"></div>'
            '<p class="small mute">Préparé le 22 novembre 2026 pour Mohamed Benmoussa, 24 ans, 1,84 m, 104 kg. Dates du Ramadan à confirmer.</p>')
    return page("night", body, "Générique", "Sources et précautions", "", deco=icon("film-strip"), mini=True)


PAGES = [p_cover, p_pitch, p_scenario, p_cast, p_week, p_day, p_a1, p_a2, p_b1, p_b2, p_c, p_cardio, p_pull,
         p_food, p_swap, p_shop, p_free, p_props, p_myths, p_ramadan, p_cut, p_pilot, p_track, p_dday, p_after, p_sources]

EXTRA_CSS = """
.wkr .b{min-height:12.4mm}.wk{gap:1.7mm}.trk td{padding:.82mm 1.6mm}
.act em{font-style:normal;font-weight:700;font-size:7.6pt;line-height:1.22;display:block;margin-top:.8mm;color:var(--ink)}
.kick{justify-content:space-between}.kick .kt{display:flex;gap:1.6mm;align-items:center}.kick .by{margin:0}
.tx{font-family:"DM Sans";font-weight:800;font-size:.7em;margin:0 .24em;vertical-align:.1em;letter-spacing:0;display:inline!important;color:inherit!important}
.chart text{font-size:13px}.chart .v{font-size:15px}
.cast{flex:1;align-content:space-between;gap:2mm 5mm;padding:1mm 0 2mm}
.mem{grid-template-columns:14mm 1fr;gap:3.4mm}.mem .A{width:14mm;height:14mm;font-size:20pt}
.mem b{font-size:15.5pt}.mem i{font-size:8.6pt}.mem span{font-size:9pt}
.x5 .big{display:flex;align-items:baseline;gap:2mm}.x5 .big small{font-size:20pt}
.duo{display:grid;grid-template-columns:27mm 1fr;gap:4.4mm;align-items:center;background:var(--tint);border-radius:3.4mm;padding:2.6mm}
.lv{grid-template-columns:8mm 22.5mm 1fr}
.meal{grid-template-columns:27mm 1fr;padding:2.5mm 4.2mm 2.5mm 3mm}.meal .il{width:27mm;height:27mm}.meal .k{margin-top:1.3mm}.meal .pp{margin-top:.6mm}.ing{margin-top:1.4mm}
.myth .m span{font-style:italic}
main.big{gap:4.2mm}main.tight{gap:2.8mm}.big .li{font-size:10.2pt;grid-template-columns:7.6mm 1fr}.big .li .ic{font-size:15.5pt}
.big .small{font-size:9.4pt}.big .lis{gap:3mm}.big .ex .cue{font-size:9pt}.big .dec span{font-size:9.6pt}
.big .stp b{font-size:10.4pt}.big .stp span{font-size:9.4pt}.big .rt span{font-size:8.6pt}.big .tb{font-size:9.6pt}
.src a{display:block}

.hd.mini{padding:4.4mm 10mm 4.2mm}.hd.mini h1{font-size:23pt}.hd.mini .deco{font-size:56pt;right:9mm}.hd.mini .deco .ic{width:17mm;height:17mm}
.il{display:block}.il2{display:block;width:46mm;height:46mm}
.card .li .ic{color:var(--c)}
"""


def build_html():
    global PN
    PN = 0
    body = "".join(typo(p()) for p in PAGES)
    return (f'<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Opération 87 — programme de Mohamed</title>'
            f'<style>{CSS}{fig.PIC_CSS}{EXTRA_CSS}</style></head><body>{body}</body></html>')


async def render(html, out):
    from playwright.async_api import async_playwright
    open(ROOT + "/dossier.html", "w").write(html)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.goto("file://" + ROOT + "/dossier.html")
        await pg.evaluate("document.fonts.ready")
        over = await pg.evaluate("""() => [...document.querySelectorAll('.page')].map(s => {
            const m = s.querySelector('main'); if (!m) return null;
            const kids = [...m.children]; const last = kids[kids.length-1];
            const mb = m.getBoundingClientRect(); const lb = last ? last.getBoundingClientRect() : mb;
            const wide = [...s.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible').length;
            return {p: s.dataset.p, over: Math.round((lb.bottom - mb.bottom) * 10) / 10, free: Math.round((mb.bottom - lb.bottom) / 3.7795)};
        }).filter(Boolean)""")
        for o in over:
            flag = "  <-- DÉBORDE" if o["over"] > 0.5 else ""
            print(f"p{o['p']}: marge libre {o['free']} mm{flag}")
        fonts = await pg.evaluate("[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)")
        await pg.pdf(path=out, prefer_css_page_size=True, print_background=True)
        await b.close()


if __name__ == "__main__":
    html = build_html()
    asyncio.run(render(html, OUT if "--final" in sys.argv else ROOT + "/draft.pdf"))
    print("pages:", PN)
