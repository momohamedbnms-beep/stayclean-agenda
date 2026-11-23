# -*- coding: utf-8 -*-
"""Moteur de pictogrammes : bonhomme articulé (vue de profil ou de face) + matériel.
Unités « corps » : y vers le haut, sol à y = 0. Rendu en SVG (classes CSS pour les couleurs)."""
import math

HEAD_R, NECK = 0.58, 0.84
TORSO, UARM, FARM = 2.55, 1.45, 1.35
THIGH, SHIN, FOOT = 2.05, 2.0, 0.8
W_UNITS, ASPECT = 11.6, 1.15
PX = 20.0
ANK = 0.3                       # hauteur de cheville pied à plat
_UID = 0
HIP0 = ANK + SHIN + THIGH       # 4.35 debout
SH0 = HIP0 + TORSO              # 6.90


def _f(v):
    return f"{v:.3f}".rstrip("0").rstrip(".")


def vec(deg, l=1.0):
    """deg mesuré depuis la verticale, + = vers l'avant (+x)."""
    r = math.radians(deg)
    return (l * math.sin(r), l * math.cos(r))


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def ik(a, c, l1, l2, bend=1):
    ax, ay = a
    dx, dy = c[0] - ax, c[1] - ay
    d = math.hypot(dx, dy) or 1e-6
    mx = l1 + l2 - 1e-3
    if d > mx:
        dx, dy, d = dx * mx / d, dy * mx / d, mx
    mn = abs(l1 - l2) + 1e-3
    if d < mn:
        dx, dy, d = dx * mn / d, dy * mn / d, mn
    al = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, l1 * l1 - al * al))
    ux, uy = dx / d, dy / d
    return (ax + al * ux - bend * h * uy, ay + al * uy + bend * h * ux), (ax + dx, ay + dy)


def straight(sh, ankle):
    """Corps gainé en ligne droite entre l'épaule et la cheville -> (hanche, inclinaison)."""
    dx, dy = sh[0] - ankle[0], sh[1] - ankle[1]
    d = math.hypot(dx, dy)
    ux, uy = dx / d, dy / d
    return (ankle[0] + ux * (THIGH + SHIN), ankle[1] + uy * (THIGH + SHIN)), math.degrees(math.atan2(ux, uy))


class Scene:
    def __init__(self, cx=0.0, y0=-1.0, floor=True, w=W_UNITS):
        self.cx, self.y0, self.w, self.h, self.floor = cx, y0, w, w / ASPECT, floor
        self.L = {k: [] for k in ("back", "ghost", "far", "body", "near", "front")}

    # ---- primitives ----
    def line(self, layer, p1, p2, w, cls):
        self.L[layer].append(f'<path d="M{_f(p1[0])} {_f(p1[1])}L{_f(p2[0])} {_f(p2[1])}" class="s {cls}" stroke-width="{_f(w)}"/>')

    def poly(self, layer, pts, w, cls, close=False):
        d = "M" + "L".join(f"{_f(x)} {_f(y)}" for x, y in pts) + ("Z" if close else "")
        self.L[layer].append(f'<path d="{d}" class="s {cls}" stroke-width="{_f(w)}"/>')

    def fillpoly(self, layer, pts, cls):
        d = "M" + "L".join(f"{_f(x)} {_f(y)}" for x, y in pts) + "Z"
        self.L[layer].append(f'<path d="{d}" class="f {cls}"/>')

    def circle(self, layer, c, r, cls):
        self.L[layer].append(f'<circle cx="{_f(c[0])}" cy="{_f(c[1])}" r="{_f(r)}" class="f {cls}"/>')

    def ring(self, layer, c, r, w, cls):
        self.L[layer].append(f'<circle cx="{_f(c[0])}" cy="{_f(c[1])}" r="{_f(r)}" class="s {cls}" stroke-width="{_f(w)}"/>')

    def rect(self, layer, x, y, w, h, r, cls):
        self.L[layer].append(f'<rect x="{_f(x)}" y="{_f(y)}" width="{_f(w)}" height="{_f(h)}" rx="{_f(r)}" class="f {cls}"/>')

    def raw(self, layer, s):
        self.L[layer].append(s)

    # ---- matériel ----
    def bar(self, p, layer="front"):
        self.circle(layer, p, 0.26, "e")
        self.circle(layer, p, 0.1, "bg")

    def db(self, p, layer="front", r=0.46):
        """Haltère vu en bout."""
        self.circle(layer, p, r, "e")
        self.circle(layer, p, r * 0.36, "bg")

    def db_side(self, p, ang=0.0, layer="front", l=1.25):
        """Haltère vu de côté (poignée + 2 disques)."""
        c, s = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        hx, hy = c * l / 2, s * l / 2
        self.line(layer, (p[0] - hx, p[1] - hy), (p[0] + hx, p[1] + hy), 0.16, "e")
        for k in (-1, 1):
            cx, cy = p[0] + k * hx * 0.78, p[1] + k * hy * 0.78
            self.line(layer, (cx + s * 0.3, cy - c * 0.3), (cx - s * 0.3, cy + c * 0.3), 0.42, "e")

    def arrow(self, p1, p2, layer="front", w=0.2):
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        d = math.hypot(dx, dy)
        ux, uy = dx / d, dy / d
        hl, hw = 0.62, 0.42
        base = (p2[0] - ux * hl, p2[1] - uy * hl)
        self.line(layer, p1, base, w, "a")
        self.fillpoly(layer, [p2, (base[0] - uy * hw, base[1] + ux * hw), (base[0] + uy * hw, base[1] - ux * hw)], "a")

    # ---- bonhomme de profil ----
    def side(self, hip, lean=0.0, head=0.0, hN=None, hF=None, eN=-1, eF=None, elN=None, elF=None,
             fN=None, fF=None, kN=1, kF=None, tN=0.0, tF=None, sh=None):
        global _UID
        sh = sh or add(hip, vec(lean, TORSO))
        tdir = math.degrees(math.atan2(sh[0] - hip[0], sh[1] - hip[1]))
        hc = add(sh, vec(tdir + head, NECK))
        eF = eN if eF is None else eF
        kF = kN if kF is None else kF
        tF = tN if tF is None else tF
        P = lambda pts: "M" + "L".join(f"{_f(x)} {_f(y)}" for x, y in pts)

        def arm_pts(hand, bend, elbow):
            if elbow is None:
                elbow, hand = ik(sh, hand, UARM, FARM, bend)
            return elbow, hand

        def leg_pts(ankle, bend, toe):
            knee, ankle = ik(hip, ankle, THIGH, SHIN, bend)
            r = math.radians(toe)
            return knee, ankle, (ankle[0] + FOOT * math.cos(r), ankle[1] + FOOT * math.sin(r))

        def draw_arm(layer, el, hd, cls):
            self.line(layer, sh, el, 0.54, cls)
            self.line(layer, el, hd, 0.45, cls)
            self.circle(layer, hd, 0.28, cls)

        def draw_leg(layer, kn, an, toe, cls):
            self.line(layer, hip, kn, 0.76, cls)
            self.line(layer, kn, an, 0.6, cls)
            self.line(layer, an, toe, 0.44, cls)

        if hF is not None and hF != hN:
            draw_arm("far", *arm_pts(hF, eF, elF), "far")
        if fF is not None and fF != fN:
            draw_leg("far", *leg_pts(fF, kF, tF), "far")
        # torse (capsule évasée) + cou + tête
        dx, dy = sh[0] - hip[0], sh[1] - hip[1]
        d = math.hypot(dx, dy)
        nx, ny = -dy / d, dx / d
        rs, rh = 0.52, 0.43
        tors = [(sh[0] + nx * rs, sh[1] + ny * rs), (sh[0] - nx * rs, sh[1] - ny * rs),
                (hip[0] - nx * rh, hip[1] - ny * rh), (hip[0] + nx * rh, hip[1] + ny * rh)]
        self.fillpoly("body", tors, "g")
        self.circle("body", sh, rs, "g")
        self.circle("body", hip, rh, "g")
        self.line("body", sh, hc, 0.42, "g")
        self.circle("body", hc, HEAD_R, "g")
        W = '#fff'
        sil = [f'<path d="{P(tors)}Z" fill="{W}"/>',
               f'<circle cx="{_f(sh[0])}" cy="{_f(sh[1])}" r="{rs}" fill="{W}"/>',
               f'<circle cx="{_f(hip[0])}" cy="{_f(hip[1])}" r="{rh}" fill="{W}"/>',
               f'<circle cx="{_f(hc[0])}" cy="{_f(hc[1])}" r="{HEAD_R}" fill="{W}"/>']
        x0, y0 = self.cx - self.w / 2, self.y0
        box = f'maskUnits="userSpaceOnUse" x="{_f(x0)}" y="{_f(y0)}" width="{_f(self.w)}" height="{_f(self.h)}"'
        rc = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'
        if fN is not None:
            kn, an, toe = leg_pts(fN, kN, tN)
            _UID += 1
            self.raw("near", f'<mask id="m{_UID}" {box}>{"".join(sil)}</mask>')
            self.raw("near", f'<path d="{P([hip, kn, an])}" class="s bgs" stroke-width="1.0" mask="url(#m{_UID})"/>')
            self.circle("near", hip, rh - 0.02, "g")
            draw_leg("near", kn, an, toe, "g")
            sil.append(f'<path d="{P([hip, kn, an, toe])}" {rc} stroke="{W}" stroke-width="0.7"/>')
        if hN is not None:
            el, hd = arm_pts(hN, eN, elN)
            _UID += 1
            self.raw("near", f'<mask id="m{_UID}" {box}>{"".join(sil)}</mask>')
            self.raw("near", f'<path d="{P([sh, el, hd])}" class="s bgs" stroke-width="0.8" mask="url(#m{_UID})"/>')
            self.circle("near", sh, 0.36, "g")
            draw_arm("near", el, hd, "g")
        return {"sh": sh, "hip": hip, "head": hc}

    # ---- bonhomme de face ----
    def frontfig(self, hipc, hL, hR, eL=1, eR=-1, fL=None, fR=None, shy=None):
        x, y = hipc
        shy = shy if shy is not None else y + TORSO
        sL, sR = (x - 1.02, shy), (x + 1.02, shy)
        pL, pR = (x - 0.5, y), (x + 0.5, y)
        fL = fL or (x - 0.62, y - THIGH - SHIN)
        fR = fR or (x + 0.62, y - THIGH - SHIN)
        for hp, ft in ((pL, fL), (pR, fR)):
            knee, ft = ik(hp, ft, THIGH, SHIN, 1)
            self.line("near", hp, knee, 0.76, "g")
            self.line("near", knee, ft, 0.6, "g")
            self.line("near", ft, (ft[0] + (0.22 if ft[0] > x else -0.22), ft[1] - 0.02), 0.44, "g")
        self.L["body"].append('<path d="M%s %sL%s %sL%s %sL%sZ" class="f g sj" stroke-width="0.62"/>' % (
            _f(sL[0] + 0.2), _f(sL[1] - 0.12), _f(sR[0] - 0.2), _f(sR[1] - 0.12), _f(pR[0] - 0.05), _f(pR[1] + 0.2),
            f"{_f(pL[0] + 0.05)} {_f(pL[1] + 0.2)}"))
        hc = (x, shy + NECK + 0.08)
        self.line("body", (x, shy), hc, 0.42, "g")
        self.circle("body", hc, HEAD_R, "g")
        for s, hd, b in ((sL, hL, eL), (sR, hR, eR)):
            el, hd = ik(s, hd, UARM, FARM, b)
            self.line("near", s, el, 0.54, "g")
            self.line("near", el, hd, 0.45, "g")
            self.circle("near", hd, 0.28, "g")
        return {"sL": sL, "sR": sR}

    # ---- rendu ----
    def svg(self, cls="pic", num=None):
        Wp, Hp = self.w * PX, self.h * PX
        ox, oy = Wp / 2 - self.cx * PX, Hp + self.y0 * PX
        x0 = self.cx - self.w / 2
        g = []
        if self.floor and self.y0 < 0:
            g.append(f'<rect x="{_f(x0)}" y="{_f(self.y0)}" width="{_f(self.w)}" height="{_f(-self.y0)}" class="f gr"/>')
        g += self.L["back"]
        if self.L["ghost"]:
            g.append('<g class="ghost">' + "".join(self.L["ghost"]) + "</g>")
        for k in ("far", "body", "near", "front"):
            g += self.L[k]
        badge = ""
        if num is not None:
            badge = (f'<circle cx="21" cy="21" r="14" class="f nb"/>'
                     f'<text x="21" y="27" text-anchor="middle" class="nt">{num}</text>')
        return (f'<svg class="{cls}" viewBox="0 0 {_f(Wp)} {_f(Hp)}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
                f'<rect width="{_f(Wp)}" height="{_f(Hp)}" class="f bg"/>'
                f'<g transform="translate({_f(ox)} {_f(oy)}) scale({PX} -{PX})">{"".join(g)}</g>{badge}</svg>')


# =====================================================================
#  SCÈNES
# =====================================================================
def row(top):
    s = Scene(cx=3.1)
    bar, ank = (1.95, 4.25), (6.75, 0.36)
    s.line("back", (1.95, 0), (1.95, 5.7), 0.26, "e2")
    s.line("back", (1.15, 0.09), (2.75, 0.09), 0.18, "e2")
    sh = (1.09, 3.72) if top else (0.36, 2.0)
    hip, lean = straight(sh, ank)
    s.side(hip, lean, head=6, hN=bar, eN=-1, fN=ank, kN=1, tN=72)
    s.bar(bar)
    return s


def pushup(low):
    s = Scene(cx=2.95)
    ank, hand = (6.27, 0.74), (0.0, 0.24)
    sh = (-0.32, 1.12) if low else (0.05, 2.95)
    hip, lean = straight(sh, ank)
    if low:
        s.side(hip, lean, head=-14, hN=(0.3, 0.26), elN=(0.82, 1.84), fN=ank, kN=1, tN=-76)
    else:
        s.side(hip, lean, head=-14, hN=hand, eN=1, fN=ank, kN=1, tN=-76)
    return s


def pulldown(down):
    s = Scene(cx=1.25)
    s.line("back", (3.75, 0), (3.75, 8.7), 0.28, "e2")
    s.line("back", (3.75, 8.7), (0.1, 8.7), 0.22, "e2")
    s.line("back", (0.35, 0), (0.35, 1.8), 0.24, "e2")
    s.line("back", (-0.55, 1.78), (1.25, 1.78), 0.36, "e")
    s.line("back", (2.2, 3.02), (3.75, 3.02), 0.16, "e2")
    s.line("front", (1.05, 3.02), (2.25, 3.02), 0.34, "e")
    hip, ank = (0.0, 2.3), (2.05, ANK)
    if down:
        bar = (0.02, 5.32)
        s.side(hip, -15, head=10, hN=bar, eN=-1, fN=ank, kN=1)
    else:
        bar = (0.3, 7.5)
        s.side(hip, -7, head=4, hN=bar, eN=-1, fN=ank, kN=1)
    s.line("back", (0.3, 8.7), bar, 0.07, "e")
    s.circle("back", (0.3, 8.7), 0.24, "e2")
    s.bar(bar)
    return s


def incline(up):
    s = Scene(cx=1.0)
    hip = (1.0, 2.25)
    lean = -55
    d = vec(lean)
    n = (d[1], -d[0])            # vers le dossier (derrière le dos)
    sh = add(hip, vec(lean, TORSO))
    off = 0.62
    b1 = (hip[0] - n[0] * off * -1 - 0, hip[1])
    back1 = (hip[0] + (-n[0]) * off - d[0] * 0.25, hip[1] + (-n[1]) * off - d[1] * 0.25)
    back2 = (sh[0] + (-n[0]) * off + d[0] * 1.15, sh[1] + (-n[1]) * off + d[1] * 1.15)
    s.line("back", back1, back2, 0.4, "e")
    s.line("back", (0.75, 1.7), (2.3, 1.7), 0.38, "e")
    s.line("back", (-0.9, 0), (-0.9, 2.9), 0.22, "e2")
    s.line("back", (1.85, 0), (1.85, 1.6), 0.22, "e2")
    s.line("back", (-1.5, 0.09), (2.5, 0.09), 0.18, "e2")
    ank = (3.3, ANK)
    if up:
        hand = (sh[0] + 0.5, sh[1] + 2.72)
        s.side(hip, lean, head=0, hN=hand, eN=1, fN=ank, kN=1)
    else:
        el = (sh[0] + 0.62, sh[1] - 0.72)
        hand = (sh[0] + 0.82, sh[1] + 0.58)
        s.side(hip, lean, head=0, hN=hand, elN=el, fN=ank, kN=1)
    s.db(hand)
    return s


def lateral(up):
    s = Scene(cx=0.0)
    if up:
        hl, hr = (-3.76, 6.78), (3.76, 6.78)
    else:
        hl, hr = (-1.42, 4.2), (1.42, 4.2)
    s.frontfig((0, HIP0), hl, hr, eL=1, eR=-1)
    s.db(hl)
    s.db(hr)
    return s


def curl(start=False):
    s = Scene(cx=0.25)
    hand = (0.42, 4.14) if start else (0.98, 6.42)
    s.side((0, HIP0), 0, hN=hand, eN=-1, fN=(0, ANK))
    s.db(hand)
    if not start:
        s.arrow((1.75, 4.75), (1.75, 6.25))
    return s


def pushdown(start=False):
    s = Scene(cx=0.55)
    s.line("back", (2.7, 0), (2.7, 8.7), 0.28, "e2")
    s.line("back", (2.7, 8.7), (0.75, 8.7), 0.22, "e2")
    hand = (1.02, 5.72) if start else (0.72, 4.42)
    s.line("back", (0.95, 8.7), hand, 0.07, "e")
    s.circle("back", (0.95, 8.7), 0.24, "e2")
    s.side((-0.25, HIP0), 7, head=-4, hN=hand, eN=-1, fN=(-0.25, ANK))
    s.line("front", (hand[0] - 0.05, hand[1] + 0.35), (hand[0] + 0.05, hand[1] - 0.35), 0.2, "e")
    if not start:
        s.arrow((1.75, 6.2), (1.75, 4.7))
    return s


def _rig(s, bar):
    s.line("back", (3.3, 0), (3.3, bar[1] + 0.45), 0.28, "e2")
    s.line("back", (3.3, bar[1]), bar, 0.22, "e2")
    s.line("back", (2.5, 0.09), (4.1, 0.09), 0.18, "e2")


def hang(top=False, knees=False):
    s = Scene(cx=0.9, y0=-0.4)
    d = -0.5
    bar = (0.35, 8.3 + d)
    _rig(s, bar)
    if top:
        sh = (-0.22, 8.12 + d)
        hip = (0.05, sh[1] - TORSO)
        s.side(hip, head=14, sh=sh, hN=bar, eN=-1, fN=(-1.3, sh[1] - TORSO - 1.5), kN=1, tN=-35)
    else:
        sh = (0.35, 5.56 + d)
        hip = (0.4, 3.02 + d)
        if knees:
            s.side(hip, sh=sh, head=6, hN=bar, eN=-1, fN=(2.35, 1.35 + d), kN=1, tN=-8)
        else:
            s.side(hip, sh=sh, head=6, hN=bar, eN=-1, fN=(-1.15, 1.62 + d), kN=1, tN=-35)
    s.bar(bar)
    return s


def goblet(low):
    s = Scene(cx=0.15)
    ank = (0.2, ANK)
    if low:
        hip = (-1.02, 2.28)
        r = s.side(hip, 27, head=-20, hN=(1.12, 4.3), eN=-1, fN=ank, kN=1)
        c = (1.14, 4.52)
    else:
        hip = (0.1, HIP0)
        r = s.side(hip, 0, hN=(0.98, 6.62), eN=-1, fN=ank, kN=1)
        c = (1.0, 6.5)
    s.line("front", (c[0], c[1] - 0.45), (c[0], c[1] + 0.45), 0.2, "e")
    s.line("front", (c[0] - 0.28, c[1] + 0.52), (c[0] + 0.28, c[1] + 0.52), 0.4, "e")
    s.line("front", (c[0] - 0.28, c[1] - 0.52), (c[0] + 0.28, c[1] - 0.52), 0.4, "e")
    return s


def rdl(low):
    s = Scene(cx=0.45)
    ank = (0.0, ANK)
    if low:
        hip = (-0.78, 4.05)
        r = s.side(hip, 62, head=-28, hN=(1.3, 2.52), eN=-1, fN=ank, kN=1)
        s.db((1.3, 2.52))
    else:
        hip = (0.0, HIP0)
        s.side(hip, 0, hN=(0.42, 4.14), eN=-1, fN=ank, kN=1)
        s.db((0.42, 4.14))
    return s


def lunge(low):
    s = Scene(cx=-0.75)
    if low:
        hip = (-1.15, 2.5)
        hand = (-0.95, 2.3)
        s.side(hip, 5, hN=hand, eN=-1, fN=(0.7, ANK), fF=(-3.3, 0.78), kN=1, kF=1, tN=0, tF=-72)
    else:
        hip = (-0.6, HIP0)
        hand = (-0.45, 4.14)
        s.side(hip, 0, hN=hand, eN=-1, fN=(-0.6, ANK), kN=1)
    s.db_side((hand[0], hand[1] - 0.12), 0, l=1.1)
    return s


def legcurl(flexed):
    s = Scene(cx=1.35)
    hip = (0.0, 2.95)
    knee = (2.05, 2.95)
    s.line("back", (-0.5, 2.42), (1.9, 2.42), 0.36, "e")
    s.line("back", (-0.62, 2.55), (-1.42, 5.5), 0.36, "e")
    s.line("back", (0.7, 0), (0.7, 2.3), 0.26, "e2")
    s.line("back", (-0.4, 0.09), (2.6, 0.09), 0.18, "e2")
    ank = (1.45, 1.05) if flexed else (3.98, 2.42)
    pad = (ank[0] - 0.62, ank[1] - 0.2) if flexed else (ank[0] - 0.1, ank[1] - 0.66)
    s.line("back", (2.05, 2.45), pad, 0.14, "e2")
    s.side(hip, -15, head=10, hN=(0.55, 2.55), eN=-1, fN=ank, kN=1, tN=40 if flexed else 62)
    s.line("front", (1.25, 3.56), (2.2, 3.56), 0.3, "e")
    s.circle("front", pad, 0.36, "e")
    return s


def calf(up):
    s = Scene(cx=0.55)
    s.rect("back", 0.4, 0, 2.3, 0.42, 0.08, "e")
    s.line("back", (2.2, 0.4), (2.2, 5.3), 0.2, "e2")
    lift = 0.5 if up else 0.0
    ank = (0.02, 0.36 + lift)
    hip = (0.12, ank[1] + SHIN + THIGH - 0.01)
    s.side(hip, 2, hN=(2.05, 5.2), eN=-1, fN=ank, kN=1, tN=-30 if up else 16)
    s.arrow((-1.7, 3.2), (-1.7, 4.9)) if up else None
    return s


def plank():
    s = Scene(cx=2.75)
    sh, ank = (0.0, 1.76), (6.52, 0.74)
    hip, lean = straight(sh, ank)
    s.side(hip, lean, head=-12, hN=(-1.33, 0.26), elN=(0.0, 0.3), fN=ank, kN=1, tN=-76)
    return s


def rower(finish):
    s = Scene(cx=3.0)
    s.line("back", (-1.4, 0.42), (5.6, 0.42), 0.24, "e2")
    s.line("back", (-1.2, 0), (-1.2, 0.42), 0.2, "e2")
    s.ring("back", (6.15, 1.5), 1.2, 0.26, "e")
    s.circle("back", (6.15, 1.5), 0.3, "e")
    s.line("back", (4.55, 0.5), (4.95, 1.9), 0.3, "e")
    ank = (4.45, 1.12)
    if finish:
        hip = (0.45, 1.5)
        hand = (0.95, 3.1)
        s.side(hip, -20, head=14, hN=hand, eN=-1, fN=ank, kN=1, tN=62)
    else:
        hip = (2.45, 1.5)
        hand = (5.1, 3.0)
        s.side(hip, 22, head=-12, hN=hand, eN=-1, fN=ank, kN=1, tN=62)
    s.rect("back", hip[0] - 0.55, 0.62, 1.1, 0.36, 0.1, "e")
    s.line("back", hand, (5.6, 2.45), 0.07, "e")
    s.line("front", (hand[0], hand[1] - 0.36), (hand[0], hand[1] + 0.36), 0.2, "e")
    return s


def farmer():
    s = Scene(cx=0.0)
    hip = (0.0, 4.28)
    hN, hF = (0.3, 4.2), (0.0, 4.2)
    s.side(hip, 3, hN=hN, hF=hF, eN=-1, fN=(1.25, 0.36), fF=(-1.35, 0.62), kN=1, kF=1, tN=18, tF=-42)
    s.db_side(hN, 0)
    s.db_side((hF[0] - 0.45, hF[1] + 0.02), 0, layer="far")
    s.arrow((2.6, 5.2), (4.4, 5.2))
    return s


def walk():
    s = Scene(cx=0.3)
    hip = (0.0, 4.28)
    s.side(hip, 4, hN=(-0.75, 4.45), hF=(1.05, 4.7), eN=-1, eF=-1, fN=(1.25, 0.36), fF=(-1.35, 0.62),
           kN=1, kF=1, tN=18, tF=-42)
    s.arrow((2.6, 5.2), (4.4, 5.2))
    return s


def treadmill():
    s = Scene(cx=0.55)
    sl = 0.18
    y = lambda x: 0.3 + (x + 2.7) * sl
    s.line("back", (-2.7, y(-2.7)), (3.3, y(3.3)), 0.34, "e")
    s.line("back", (-2.5, 0), (-2.5, y(-2.5) - 0.1), 0.22, "e2")
    s.line("back", (3.1, 0), (3.1, y(3.1) - 0.1), 0.22, "e2")
    s.line("back", (3.2, y(3.2)), (3.95, 5.4), 0.24, "e2")
    s.line("back", (3.95, 5.4), (2.9, 5.25), 0.3, "e")
    hip = (0.35, 5.08)
    fN, fF = (1.5, y(1.5) + 0.42), (-0.85, y(-0.85) + 0.66)
    s.side(hip, 9, head=-6, hN=(-0.5, 4.85), hF=(1.7, 5.7), eN=-1, eF=-1, fN=fN, fF=fF, kN=1, kF=1, tN=14, tF=-38)
    return s


def swim():
    s = Scene(cx=0.75, floor=False)
    hip = (-0.6, 3.92)
    r = s.side(hip, 87, head=-10, hN=(4.6, 3.75), hF=(3.1, 4.7), elF=(2.1, 5.45), eN=1,
               fN=(-4.55, 3.55), fF=(-4.4, 4.3), kN=1, kF=1, tN=176, tF=168)
    wave = "M-6 3.72 " + " ".join(f"q0.5 0.34 1 0 t1 0" for _ in range(7))
    s.raw("back", f'<path d="M-6 -1.2H7.6V3.72 {"".join(f"q-0.5 0.34 -1 0 t-1 0 " for _ in range(7))}Z" class="f w"/>')
    s.raw("front", f'<path d="{wave}" class="s e" stroke-width="0.14"/>')
    return s


def hero():
    """Bonhomme de face, bras levés (couverture)."""
    s = Scene(cx=0.0, floor=False)
    s.frontfig((0, HIP0), (-2.5, 8.15), (2.5, 8.15), eL=1, eR=-1)
    return s


def rope():
    """Corde à sauter, de face : pieds décollés, la corde passe dessous."""
    s = Scene(cx=0.0, y0=-1.1)
    j = 0.62
    hl, hr = (-2.3, 4.72 + j), (2.3, 4.72 + j)
    s.frontfig((0, HIP0 + j), hl, hr, eL=1, eR=-1, fL=(-0.4, ANK + j), fR=(0.4, ANK + j))
    s.raw("back", '<ellipse cx="0" cy="-0.3" rx="1.5" ry="0.17" class="f bg"/>')
    s.raw("back", f'<path d="M{_f(hl[0] - 0.3)} {_f(hl[1] - 0.2)}C-3.5 2.6 -2.2 0.28 0 0.28S3.5 2.6 {_f(hr[0] + 0.3)} {_f(hr[1] - 0.2)}" class="s e" stroke-width="0.17"/>')
    for h, k in ((hl, -1), (hr, 1)):
        s.line("front", (h[0] - k * 0.12, h[1] + 0.1), (h[0] + k * 0.4, h[1] - 0.26), 0.3, "e")
    for x in (-1.25, 1.25):
        s.line("back", (x, 0.95), (x, 0.35), 0.12, "far")
    return s


def crunch(up):
    s = Scene(cx=1.95)
    hip, ank = (2.3, 0.47), (4.75, ANK)
    lean = -52 if up else -88
    hd = 12 if up else 2
    sh = add(hip, vec(lean, TORSO))
    if not up:
        sh = (sh[0], 0.56)
    hc = add(sh, vec(lean + hd, NECK))
    s.side(hip, lean, head=hd, sh=sh, hN=(hc[0] + 0.05, hc[1] + 0.3), eN=-1, fN=ank, kN=1, tN=0)
    return s


def legraise(up):
    s = Scene(cx=1.9)
    hip, sh = (2.2, 0.47), (-0.35, 0.56)
    ank = add(hip, vec(12 if up else 74, THIGH + SHIN - 0.02))
    s.side(hip, sh=sh, head=2, hN=(2.5, 0.3), elN=(1.05, 0.34), fN=ank, kN=1, tN=(78 if up else 16))
    return s


def climber():
    s = Scene(cx=2.95)
    ank, hand = (6.27, 0.74), (0.0, 0.24)
    sh = (0.05, 2.95)
    hip, lean = straight(sh, ank)
    s.side(hip, lean, head=-14, hN=hand, eN=1, fN=(3.05, 1.1), kN=-1, tN=-70, fF=ank, kF=1, tF=-76)
    return s


def run():
    """Course sur tapis incliné."""
    s = Scene(cx=0.55)
    sl = 0.18
    y = lambda x: 0.3 + (x + 2.7) * sl
    s.line("back", (-2.7, y(-2.7)), (3.3, y(3.3)), 0.34, "e")
    s.line("back", (-2.5, 0), (-2.5, y(-2.5) - 0.1), 0.22, "e2")
    s.line("back", (3.1, 0), (3.1, y(3.1) - 0.1), 0.22, "e2")
    s.line("back", (3.2, y(3.2)), (3.95, 5.4), 0.24, "e2")
    s.line("back", (3.95, 5.4), (2.9, 5.25), 0.3, "e")
    hip = (0.3, 5.0)
    s.side(hip, 13, head=-8, hN=(0.25, 5.27), elN=(-0.2, 6.52), hF=(2.8, 7.42), elF=(1.85, 6.47),
           fN=(1.9, 2.6), kN=1, tN=-15, fF=(-1.6, 1.3), kF=1, tF=-60)
    for yy, x1, x2 in ((6.6, -3.6, -2.3), (5.2, -3.9, -2.5), (3.8, -3.5, -2.4)):
        s.line("back", (x1, yy), (x2, yy), 0.13, "far")
    return s


def press(up):
    s = Scene(cx=0.0)
    if up:
        hl, hr = (-1.15, 8.45), (1.15, 8.45)
    else:
        hl, hr = (-1.55, 7.25), (1.55, 7.25)
    s.frontfig((0, HIP0), hl, hr, eL=1, eR=-1)
    s.db(hl)
    s.db(hr)
    return s


def kb(s, c, layer="front"):
    s.circle(layer, (c[0], c[1] - 0.25), 0.5, "e")
    s.ring(layer, (c[0], c[1] + 0.25), 0.3, 0.14, "e")


def swing(up):
    s = Scene(cx=0.6)
    ank = (0.0, ANK)
    if up:
        h = (3.05, 6.2)
        s.side((0.0, HIP0), -4, hN=h, eN=-1, fN=ank, kN=1)
    else:
        h = (0.05, 2.75)
        s.side((-1.0, 3.75), 52, head=-25, hN=h, eN=-1, fN=ank, kN=1)
    kb(s, (h[0] + 0.15, h[1] - 0.3))
    return s


def sled():
    s = Scene(cx=0.9)
    s.rect("back", 2.35, 0.0, 2.3, 1.25, 0.15, "e2")
    s.line("back", (2.6, 1.2), (2.85, 4.75), 0.24, "e")
    s.rect("back", 2.9, 1.25, 1.4, 0.45, 0.08, "e")
    hip = (-0.45, 3.65)
    s.side(hip, 55, head=-30, hN=(2.8, 4.7), hF=(2.85, 4.55), eN=-1, eF=-1,
           fN=(0.9, 0.55), kN=1, tN=-10, fF=(-2.4, ANK), kF=1, tF=-35)
    s.arrow((-3.6, 7.0), (-1.8, 7.0))
    return s


def vest():
    s = treadmill()
    s.fillpoly("front", [(-0.05, 5.75), (0.95, 5.62), (1.22, 7.25), (0.22, 7.42)], "e")
    return s


def slam(down):
    s = Scene(cx=0.0)
    if down:
        h = (0.0, 2.6)
        s.side((-0.9, 3.7), 55, head=-25, hN=(1.75, 1.75), eN=-1, fN=(0.0, ANK), kN=1)
        s.circle("front", (1.8, 0.78), 0.75, "e")
    else:
        s.side((0.0, HIP0), -6, hN=(-0.25, 9.5), eN=-1, fN=(0.0, ANK), kN=1)
        s.circle("front", (-0.2, 10.15), 0.75, "e")
    return s


def ropes():
    s = Scene(cx=0.9)
    s.side((-0.4, 3.75), 22, head=-10, hN=(1.4, 4.3), eN=-1, fN=(0.3, ANK), kN=1, fF=(-1.0, ANK), kF=1)
    s.raw("back", '<path d="M1.5 4.3 C2.3 5.3 2.9 3.3 3.6 4.2 S4.9 3.0 5.6 3.3" class="s e" stroke-width="0.26"/>')
    s.raw("back", '<path d="M1.5 4.0 C2.3 3.0 2.9 4.6 3.6 3.5 S4.9 4.1 5.6 3.1" class="s e2" stroke-width="0.22"/>')
    return s


def combo(a, b, front=True):
    """Scène b (pleine) avec la silhouette de la scène a en transparence derrière."""
    items = a.L["far"] + a.L["body"] + a.L["near"] + (a.L["front"] if front else [])
    out = []
    for it in items:
        if it.startswith("<mask") or 'class="s bgs"' in it or 'class="s a"' in it or 'class="f a"' in it:
            continue
        out.append(it.replace('class="s far"', 'class="s g"').replace('class="f far"', 'class="f g"'))
    b.L["ghost"] = out
    b.L["front"] = [x for x in b.L["front"] if 'class="s a"' not in x and 'class="f a"' not in x]
    return b


COMBO = {
    "row": lambda: combo(row(False), row(True)),
    "pushup": lambda: combo(pushup(True), pushup(False)),
    "pulldown": lambda: combo(pulldown(False), pulldown(True)),
    "incline": lambda: combo(incline(False), incline(True)),
    "lateral": lambda: combo(lateral(False), lateral(True)),
    "curl": lambda: combo(curl(True), curl(False)),
    "pushdown": lambda: combo(pushdown(True), pushdown(False)),
    "hang": lambda: hang(False),
    "pullup": lambda: combo(hang(False), hang(True)),
    "rowlow": lambda: row(True),
    "top": lambda: hang(True),
    "goblet": lambda: combo(goblet(False), goblet(True)),
    "rdl": lambda: combo(rdl(False), rdl(True)),
    "lunge": lambda: combo(lunge(False), lunge(True)),
    "legcurl": lambda: combo(legcurl(False), legcurl(True)),
    "calf": lambda: combo(calf(False), calf(True)),
    "kneeraise": lambda: combo(hang(False), hang(False, knees=True)),
    "plank": plank,
    "rower": lambda: combo(rower(False), rower(True)),
    "farmer": farmer,
    "treadmill": treadmill,
    "swim": swim,
    "walk": walk,
    "rope": rope,
    "crunch": lambda: combo(crunch(False), crunch(True)),
    "legraise": lambda: combo(legraise(False), legraise(True)),
    "climber": climber,
    "run": run,
    "press": lambda: combo(press(False), press(True)),
    "swing": lambda: combo(swing(False), swing(True)),
    "sled": sled,
    "vest": vest,
    "slam": lambda: combo(slam(False), slam(True), front=False),
    "ropes": ropes,
}

SCENES = {
    "row": [lambda: row(False), lambda: row(True)],
    "pushup": [lambda: pushup(False), lambda: pushup(True)],
    "pulldown": [lambda: pulldown(False), lambda: pulldown(True)],
    "incline": [lambda: incline(False), lambda: incline(True)],
    "lateral": [lambda: lateral(False), lambda: lateral(True)],
    "arms": [curl, pushdown],
    "hang": [lambda: hang(False), lambda: hang(True)],
    "goblet": [lambda: goblet(False), lambda: goblet(True)],
    "rdl": [lambda: rdl(False), lambda: rdl(True)],
    "lunge": [lambda: lunge(False), lambda: lunge(True)],
    "legcurl": [lambda: legcurl(False), lambda: legcurl(True)],
    "calf": [lambda: calf(False), lambda: calf(True)],
    "kneeraise": [lambda: hang(False), lambda: hang(False, knees=True)],
    "plank": [plank],
    "rower": [lambda: rower(False), lambda: rower(True)],
    "farmer": [farmer],
    "treadmill": [treadmill],
    "walk": [walk],
    "swim": [swim],
    "hero": [hero],
}

PIC_CSS = """
.pic{display:block;width:100%;height:auto;border-radius:9px}
.pic .f{stroke:none}.pic .s{fill:none;stroke-linecap:round;stroke-linejoin:round}
.pic .f.g{fill:var(--fig)}.pic .s.g{stroke:var(--fig)}
.pic .f.far{fill:var(--far)}.pic .s.far{stroke:var(--far)}
.pic .f.e{fill:var(--eq)}.pic .s.e{stroke:var(--eq)}
.pic .f.e2{fill:var(--eq2)}.pic .s.e2{stroke:var(--eq2)}
.pic .f.a{fill:var(--arrow)}.pic .s.a{stroke:var(--arrow)}
.pic .f.bg{fill:var(--frame)}.pic .s.bgs{stroke:var(--frame)}.pic .f.gr{fill:var(--ground)}
.pic .f.w{fill:var(--eq);opacity:.28}
.pic .f.nb{fill:var(--fig)}.pic .nt{font:800 17px "DM Sans",sans-serif;fill:var(--frame)}
.pic .sj{stroke:var(--fig);stroke-linejoin:round}
.pic .ghost{opacity:var(--gho,.3)}
"""
