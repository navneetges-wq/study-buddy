#!/usr/bin/env python3
"""Instance Eczar at Bold and convert LOCKIN to real vector outlines.

A logo must not depend on a font being installed, so the letters are converted
to paths here rather than left as live <text>.
"""
import json
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

VF   = "fonts/Eczar[wght].ttf"
WORD = "LOCKIN"

src = TTFont(VF)
axes = {a.axisTag: (a.minValue, a.defaultValue, a.maxValue) for a in src["fvar"].axes}
upem = src["head"].unitsPerEm
print(f"unitsPerEm={upem}  axes={axes}")

inst = instantiateVariableFont(TTFont(VF), {"wght": 700}, inplace=False, updateFontNames=True)
inst.save("fonts/Eczar-Bold.ttf")
print("wrote fonts/Eczar-Bold.ttf")

gs, cmap = inst.getGlyphSet(), inst.getBestCmap()
hmtx = inst["hmtx"]
os2, head = inst["OS/2"], inst["head"]
print(f"capHeight={getattr(os2,'sCapHeight',None)}  asc={os2.sTypoAscender} desc={os2.sTypoDescender}")

# Lay the word out on the baseline, flipping font-space Y (up) to SVG Y (down).
# Each glyph is emitted at the origin with its advance, so tracking and
# per-pair kerning stay under our control in build.py.
paths = []
for ch in WORD:
    gname = cmap[ord(ch)]
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}")
    gs[gname].draw(TransformPen(pen, Transform(1, 0, 0, -1, 0, 0)))
    paths.append({"ch": ch, "d": pen.getCommands(), "adv": hmtx[gname][0]})

print("advances:", {p["ch"]: p["adv"] for p in paths})
json.dump({"upem": upem, "capHeight": getattr(os2, "sCapHeight", None),
           "glyphs": paths}, open("fonts/lockin-outlines.json", "w"))
print(f"wrote fonts/lockin-outlines.json  ({len(paths)} glyph paths)")
