#!/usr/bin/env python3
"""Rasterise the SVG kit to transparent PNGs via headless Chrome."""
import os, re, subprocess, tempfile, shutil

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC, DST = "svg", "png"
os.makedirs(DST, exist_ok=True)

def dims(path):
    s = open(path).read()
    m = re.search(r'viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"', s)
    return float(m.group(3)), float(m.group(4))

def render(svg, out, w, h):
    svg_abs = os.path.abspath(svg)
    html = (f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
            f'html,body{{margin:0;padding:0;background:transparent}}'
            f'img{{display:block;width:{w}px;height:{h}px}}</style></head>'
            f'<body><img src="file://{svg_abs}"></body></html>')
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as fh:
        fh.write(html); tmp = fh.name
    r = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", "--default-background-color=00000000",
        f"--window-size={w},{h}", f"--screenshot={os.path.abspath(out)}",
        "--allow-file-access-from-files", f"file://{tmp}"],
        capture_output=True, text=True, timeout=90)
    os.unlink(tmp)
    if not os.path.exists(out):
        raise SystemExit(f"FAILED {out}\n{r.stderr[-800:]}")
    return os.path.getsize(out)

jobs = []
for s in (16, 32, 48, 64, 128, 180, 256, 512, 1024):
    src = "lockin-favicon.svg" if s <= 48 else "lockin-icon.svg"
    jobs.append((src, f"lockin-icon-{s}.png", s, s))
for name in ("lockin-lockup-dark", "lockin-lockup-light", "lockin-lockup-white",
             "lockin-lockup-o-dark", "lockin-lockup-o-light"):
    w, h = dims(f"{SRC}/{name}.svg")
    for px in (800, 2400):
        jobs.append((f"{name}.svg", f"{name}-{px}.png", px, round(px*h/w)))

total = 0
for src, out, w, h in jobs:
    n = render(os.path.join(SRC, src), os.path.join(DST, out), w, h)
    total += n
    print(f"  {out:34s} {w}x{h:<6} {n/1024:6.1f} KB")
print(f"\n{len(jobs)} PNGs, {total/1024:.0f} KB total")
