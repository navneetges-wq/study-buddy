#!/usr/bin/env python3
"""Generate the promotional flyers (Task 2) and blog banners (Task 3).

Three campaigns, one skeleton. Each angle gets a matched A4 flyer and 1200x700
banner so the set reads as a family rather than three unrelated posters:

  01 autopsy    it watches, then tells you the truth
  02 duel       social pressure that actually works
  03 handsfree  run the whole thing without touching anything

Every page carries the required elements — logo and name, headline, features,
a graphic, and a call to action — and obeys the brand guide: the accent lands
only on the dot, the mark is placed as supplied vector, and nothing animates
around the ring.

Authored as self-contained HTML (font base64, logo and QR inlined as vector) so
they render identically anywhere and rasterise cleanly at any resolution.
"""
import os
from _shared import *          # noqa: F401,F403  — palette, components, campaigns

FLYER_CARD_CSS = """
.duel .dp{padding:4mm 4.5mm;gap:1.1mm}
.duel .dn{font-size:3mm}
.duel .dn i.away{width:2.2mm;height:2.2mm}
.duel .dp b{font-size:13.5mm;margin:.6mm 0 1.2mm}
.duel .dm{font-size:2.85mm}
.duel .drec{padding:3.2mm 4.5mm;font-size:3.1mm}
.cmds .clist{padding:0 4.5mm 3.2mm}
.cmds .c{padding:1.85mm 0;font-size:3.1mm}
"""

BANNER_CARD_CSS = """
.duel .dp{padding:18px 20px;gap:5px}
.duel .dn{font-size:13px}
.duel .dn i.away{width:9px;height:9px}
.duel .dp b{font-size:58px;margin:3px 0 6px}
.duel .dm{font-size:12.5px}
.duel .drec{padding:15px 20px;font-size:13px}
.cmds .clist{padding:0 21px 16px}
.cmds .c{padding:10px 0;font-size:13.5px}
"""

def flyer_html(c):
    return f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Lockin — flyer {c['id']}</title><style>
{FACE}{EXTRA_CSS}{FLYER_CARD_CSS}
@page{{size:A4;margin:0}}
:root{{{PALETTE}}}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:210mm;height:297mm}}
body{{background:var(--bg);color:var(--text);font-family:{SANS};
-webkit-font-smoothing:antialiased;overflow:hidden}}
html,body,.page{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.page{{width:210mm;height:297mm;padding:13mm 14mm 10mm;display:flex;
flex-direction:column;position:relative;overflow:hidden}}
.ghost{{position:absolute;right:-40mm;top:118mm;pointer-events:none}}
{CARD_CSS}
header{{display:flex;justify-content:space-between;align-items:center;
padding-bottom:4.5mm;border-bottom:1px solid var(--line);z-index:1}}
header img{{height:9mm;display:block}}
.kicker{{color:var(--dim);font-size:2.6mm;letter-spacing:.2em;text-transform:uppercase}}

.hero{{padding:5mm 0 0;z-index:1}}
h1{{font-size:{c['fh1']};line-height:1.02;letter-spacing:-.018em;max-width:180mm}}
h1 .a{{color:var(--accent)}}
.deck{{margin-top:4mm;max-width:154mm;color:var(--text);font-size:4.2mm;
line-height:1.45;font-weight:600;letter-spacing:-.01em}}
.deck s{{color:var(--dim);text-decoration:none;font-weight:400}}

.mid{{display:flex;gap:8mm;align-items:stretch;padding:4.5mm 0;z-index:1}}
.autopsy{{width:70mm;padding:0;flex:none}}
.ahd{{font-size:2.5mm;letter-spacing:.16em;padding:3.3mm 4.5mm}}
.ascore{{padding:3.8mm 4.5mm 3.2mm}}
.ascore b{{font-size:13.5mm}}
.ascore span{{font-size:3.4mm}}
.ascore em{{font-size:2.4mm;margin-top:.8mm}}
.arows{{padding:0 4.5mm 3.4mm}}
.ar{{padding:2.1mm 0;font-size:3.05mm}}
.lead{{flex:1;display:flex;flex-direction:column;justify-content:center;gap:3.6mm}}
.lead p{{color:var(--dim);font-size:3.3mm;line-height:1.5}}
.lead p b{{color:var(--text);font-weight:600}}
.lead .pull{{font-size:4.6mm;line-height:1.28;color:var(--text);letter-spacing:-.015em}}

.feat{{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--line);z-index:1}}
.f{{padding:3.6mm 5.5mm 3.6mm 0;border-bottom:1px solid var(--line)}}
.f:nth-child(even){{padding-left:6mm;border-left:1px solid var(--line)}}
.f h3{{font-size:4mm;font-weight:600;letter-spacing:-.012em;margin-bottom:1.6mm;
display:flex;align-items:center;gap:2.4mm}}
.f h3::before{{content:"";width:2.2mm;height:2.2mm;border-radius:50%;
background:var(--accent);flex:none}}
.f p{{color:var(--dim);font-size:3mm;line-height:1.45}}

.trust{{display:flex;gap:3.4mm;align-items:center;padding:3mm 0;z-index:1;
color:var(--faint);font-size:3mm}}
.trust b{{color:var(--text);font-weight:600}}
.trust em{{font-style:normal;color:var(--line2)}}

.voice{{padding:4mm 5.4mm;gap:4.6mm;margin:0;z-index:1}}
.vmic{{width:9mm;height:9mm}}
.vhalo{{width:9mm;height:9mm}}
.vdot{{width:3.4mm;height:3.4mm}}
.vlabel{{font-size:2.4mm;margin-bottom:1.4mm}}
.vcmd{{font-size:4.5mm;margin-bottom:1.3mm}}
.vreply{{font-size:3.3mm;line-height:1.45}}
.vnote{{color:var(--faint);font-size:2.75mm;line-height:1.38;margin-top:1.8mm;z-index:1}}

footer{{margin-top:auto;display:flex;align-items:center;gap:6mm;
border-top:1px solid var(--line2);padding-top:4.4mm;z-index:1}}
footer .cta{{flex:1}}
footer .cta .big{{font-size:6.4mm;letter-spacing:-.02em;line-height:1.1}}
footer .cta .url{{margin-top:2.4mm;color:var(--accent);font-size:3.4mm;word-break:break-all}}
footer .cta .note{{margin-top:1.4mm;color:var(--faint);font-size:2.8mm}}
</style></head><body><div class="page">
  {ghost_ring("96mm")}
  <header>
    <img src="{svg_uri('svg/lockin-lockup-dark.svg')}" alt="LOCKIN">
    <div class="kicker">{c["kicker"]}</div>
  </header>

  <div class="hero">
    <h1 class="eczar">{c["h1"]}</h1>
    <p class="deck">{c["deck"]}</p>
  </div>

  <div class="mid">
    {c['hero']()}
    <div class="lead">
      <p class="pull">{c["pull"]}</p>
      <p>{c["body"]}</p>
    </div>
  </div>

  {voicebar(*c["band"])}
  <p class="vnote">{c["note"]}</p>

  <div class="feat">
    {"".join(f'<div class="f"><h3>{t}</h3><p>{d}</p></div>' for t, d in c["feats"])}
  </div>

  <div class="trust">
    {"<em>/</em>".join(f"<span><b>{t}</b> &mdash; {d}</span>" for t, d in TRUST)}
  </div>

  <footer>
    {qr("28mm")}
    <div class="cta">
      <div class="big eczar">START YOUR FIRST SESSION.</div>
      <div class="url">navneetges-wq.github.io/study-buddy</div>
      <div class="note">Scan it, or open it in any modern browser. Free, and there is
        nothing to sign up for.</div>
    </div>
  </footer>
</div></body></html>
'''



def banner_html(c):
    return f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Lockin — banner {c['id']}</title><style>
{FACE}{EXTRA_CSS}{BANNER_CARD_CSS}
:root{{{PALETTE}}}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{width:1200px;height:700px}}
body{{background:var(--bg);color:var(--text);font-family:{SANS};
-webkit-font-smoothing:antialiased;overflow:hidden}}
.banner{{width:1200px;height:700px;padding:52px 60px;display:flex;
align-items:center;gap:46px;position:relative;overflow:hidden}}
.banner::after{{content:"";position:absolute;inset:0;
background:radial-gradient(720px 420px at 86% 46%,rgba(124,140,255,.14),transparent 68%);
pointer-events:none}}
.ghost{{position:absolute;right:-168px;top:-110px}}
{CARD_CSS}
.left{{flex:1;z-index:1;min-width:0}}
.left img.logo{{height:42px;display:block;margin-bottom:28px}}
h1{{font-size:{c['bh1']};line-height:1.04;letter-spacing:-.022em}}
h1 .a{{color:var(--accent)}}
.deck{{margin-top:20px;max-width:560px;font-size:20px;line-height:1.45;
font-weight:600;letter-spacing:-.01em}}
.deck s{{color:var(--dim);text-decoration:none;font-weight:400}}
.voice{{margin-top:26px;max-width:540px;padding:17px 20px;gap:17px}}
.vmic{{width:34px;height:34px}}
.vhalo{{width:34px;height:34px}}
.vdot{{width:13px;height:13px}}
.vlabel{{font-size:9.5px;margin-bottom:7px}}
.vcmd{{font-size:19px;margin-bottom:6px}}
.vreply{{font-size:13px;line-height:1.4}}
.foot{{margin-top:26px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}}
.foot .url{{color:var(--accent);font-size:15px;font-weight:600;letter-spacing:-.005em}}
.foot .sep{{color:var(--line2);font-size:13px}}
.foot .trust{{color:var(--faint);font-size:13px}}
.right{{z-index:1;flex:none}}
.autopsy{{width:{c['bcard']}}}
.ahd{{font-size:10.5px;letter-spacing:.16em;padding:16px 21px}}
.ascore{{padding:21px 21px 18px}}
.ascore b{{font-size:84px}}
.ascore span{{font-size:13px}}
.ascore em{{font-size:9.5px;margin-top:3px}}
.arows{{padding:0 21px 19px}}
.ar{{padding:12px 0;font-size:13px}}
</style></head><body><div class="banner">
  {ghost_ring("600px", ".05")}
  <div class="left">
    <img class="logo" src="{svg_uri('svg/lockin-lockup-dark.svg')}" alt="LOCKIN">
    <h1 class="eczar">{c["h1"]}</h1>
    <p class="deck">{c["deck"]}</p>
    {voicebar(*c["band"])}
    <div class="foot">
      <span class="url">navneetges-wq.github.io/study-buddy</span>
      <span class="sep">/</span>
      <span class="trust">No account. No server. Nothing leaves your laptop.</span>
    </div>
  </div>
  <div class="right">{c["hero"]()}</div>
</div></body></html>
'''



os.makedirs("print", exist_ok=True)
for c in CAMPAIGNS:
    f, b = f"flyer-{c['id']}.html", f"banner-{c['id']}.html"
    open(f, "w").write(flyer_html(c))
    open(b, "w").write(banner_html(c))
    print(f"  {f:28s} {os.path.getsize(f)/1024:5.0f} KB   "
          f"{b:28s} {os.path.getsize(b)/1024:5.0f} KB")
print(f"{len(CAMPAIGNS)} campaigns x 2 pages")
