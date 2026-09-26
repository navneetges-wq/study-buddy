#!/usr/bin/env python3
"""Lockin brand mark generator.

The mark: a focus ring left open, with the accent dot as the piece that closes
it. Both elements already existed in the app — the ring favicon and the 10px
brand dot — this puts them to one job.

The wordmark: LOCKIN set in Eczar Bold (wght 700, SIL OFL) and converted to
outlines by typeset.py, so the logo never depends on the font being installed.
Everything runs heavy: the ring carries a stroke weighted to sit against Eczar's
bold stems rather than beside them.
"""
import json, math, os

ACCENT    = "#7c8cff"
INK_DARK  = "#e8eaf0"
INK_LIGHT = "#12151b"

# ---- grid ------------------------------------------------------------------
CAP    = 100.0                     # cap height; everything derives from this
GLYPHS = json.load(open("fonts/lockin-outlines.json"))
FUPM   = GLYPHS["capHeight"]       # 650 font units to the cap
FS     = CAP / FUPM                # font unit -> grid scale
TRACK  = 40.0                      # letterspacing, font units per gap

# ---- the mark --------------------------------------------------------------
# Local 64-unit grid. Bold cut: heavy ring, dot scaled up to match.
M_R, M_SW, M_DR = 24.0, 13.5, 7.5
F_R, F_SW, F_DR = 22.0, 15.0, 7.0  # favicon cut, heavier still

def f(v):
    s = f"{v:.2f}".rstrip('0').rstrip('.')
    return "0" if s in ("-0", "") else s

def _cy(sw, dr):                   # centre the mark vertically in its box
    return 32 - (sw/2 - dr)/2

def mark(ink, accent, r=M_R, sw=M_SW, dr=M_DR, clear=1.8, cx=32.0):
    """Open ring + the dot that closes it.

    The gap is solved from the dot outward, not guessed: its chord has to clear
    both round caps, the dot itself, and `clear` units of air either side. The
    dot stays wider than the stroke so it reads as a separate piece dropping
    into place rather than as the head of a spinner.
    """
    cy    = _cy(sw, dr)
    chord = sw + dr*2 + clear*2
    g     = math.degrees(math.asin(min(chord / (2*r), 0.95)))
    a1, a2 = math.radians(-90 + g), math.radians(-90 - g)
    x1, y1 = cx + r*math.cos(a1), cy + r*math.sin(a1)
    x2, y2 = cx + r*math.cos(a2), cy + r*math.sin(a2)
    return (f'<path d="M{f(x1)} {f(y1)} A{f(r)} {f(r)} 0 1 1 {f(x2)} {f(y2)}" '
            f'fill="none" stroke="{ink}" stroke-width="{f(sw)}" stroke-linecap="round"/>'
            f'<circle cx="{f(cx)}" cy="{f(cy-r)}" r="{f(dr)}" fill="{accent}" stroke="none"/>')

def mark_box(r=M_R, sw=M_SW, dr=M_DR):
    """Visual bounds in local units: (top, bottom, half-width)."""
    cy = _cy(sw, dr)
    return cy - r - dr, cy + r + sw/2, r + sw/2

def mark_placed(ink, accent, height, x, mid, **kw):
    """Drop the mark into the wordmark grid at `height`, centred on `mid`."""
    r  = kw.get("r", M_R); sw = kw.get("sw", M_SW); dr = kw.get("dr", M_DR)
    t, b, hw = mark_box(r, sw, dr)
    s  = height / (b - t)
    tx = x - (32 - hw) * s
    ty = mid - height/2 - t*s
    return (f'<g transform="translate({f(tx)} {f(ty)}) scale({f(s)})">'
            f'{mark(ink, accent, r, sw, dr, kw.get("clear", 1.8))}</g>'), hw*2*s

# ---- wordmark --------------------------------------------------------------
def wordmark(ink, accent, o_is_mark=False):
    """LOCKIN in outlines. Optionally the O is replaced by the mark."""
    parts, x = [], 0.0
    for g in GLYPHS["glyphs"]:
        if o_is_mark and g["ch"] == "O":
            body, w = mark_placed(ink, accent, CAP*1.09, x, CAP/2, clear=1.4)
            parts.append(body)
            x += w + TRACK*FS
            continue
        parts.append(f'<g transform="translate({f(x)} {f(CAP)}) scale({f(FS)})">'
                     f'<path d="{g["d"]}"/></g>')
        x += (g["adv"] + TRACK) * FS
    return f'<g fill="{ink}" stroke="none">{"".join(parts)}</g>', x - TRACK*FS

# ---- documents -------------------------------------------------------------
PAD = 22.0

def _svg(x0, y0, w, h, body, title="Lockin"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{f(x0)} {f(y0)} {f(w)} {f(h)}" width="{f(w)}" height="{f(h)}" '
            f'role="img" aria-label="{title}">\n  <title>{title}</title>\n'
            f'  {body}\n</svg>\n')

def lockup(ink, accent):
    """Primary: the mark to the left of LOCKIN."""
    MH  = CAP * 1.16
    m, mw = mark_placed(ink, accent, MH, 0.0, CAP/2)
    gap = CAP * 0.30
    wm, ww = wordmark(ink, accent)
    body = m + f'<g transform="translate({f(mw+gap)} 0)">{wm}</g>'
    total, top = mw + gap + ww, CAP/2 - MH/2
    return _svg(-PAD, top-PAD, total+PAD*2, MH+PAD*2, body)

def lockup_o(ink, accent):
    """Alternative: the mark IS the O."""
    wm, ww = wordmark(ink, accent, o_is_mark=True)
    mh  = CAP * 1.09
    top = CAP/2 - mh/2
    return _svg(-PAD, top-PAD, ww+PAD*2, mh+PAD*2, wm)

def icon_svg(ink, accent, favicon=False):
    r, sw, dr = (F_R, F_SW, F_DR) if favicon else (M_R, M_SW, M_DR)
    return _svg(0, 0, 64, 64, mark(ink, accent, r, sw, dr))

OUT = "svg"; os.makedirs(OUT, exist_ok=True)
files = {
  "lockin-lockup-dark.svg"    : lockup(INK_DARK,  ACCENT),
  "lockin-lockup-light.svg"   : lockup(INK_LIGHT, ACCENT),
  "lockin-lockup-white.svg"   : lockup("#ffffff", "#ffffff"),
  "lockin-lockup-black.svg"   : lockup("#000000", "#000000"),
  "lockin-lockup-o-dark.svg"  : lockup_o(INK_DARK,  ACCENT),
  "lockin-lockup-o-light.svg" : lockup_o(INK_LIGHT, ACCENT),
  "lockin-lockup-o-white.svg" : lockup_o("#ffffff", "#ffffff"),
  "lockin-icon.svg"           : icon_svg(INK_DARK,  ACCENT),
  "lockin-icon-light.svg"     : icon_svg(INK_LIGHT, ACCENT),
  "lockin-icon-white.svg"     : icon_svg("#ffffff", "#ffffff"),
  "lockin-favicon.svg"        : icon_svg(INK_DARK,  ACCENT, favicon=True),
  # app variants: ink follows the page's text colour, the dot follows --accent,
  # so the logo re-tints itself with the focus mode
  "lockin-lockup-app.svg"     : lockup("currentColor", "var(--accent)"),
  "lockin-icon-app.svg"       : icon_svg("currentColor", "var(--accent)"),
}
MODES = {"rain":"#63a8e8", "night":"#9b8cff", "clear":"#e8b063",
         "snow":"#a9cfe8", "cloud":"#8d99b0"}
for mode, hexv in MODES.items():
    files[f"lockin-icon-mode-{mode}.svg"]   = icon_svg(INK_DARK, hexv)
    files[f"lockin-lockup-mode-{mode}.svg"] = lockup(INK_DARK, hexv)

for n, d in files.items(): open(os.path.join(OUT, n), "w").write(d)
print(f"wrote {len(files)} svg files -> {OUT}/")
