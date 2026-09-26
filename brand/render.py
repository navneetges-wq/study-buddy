#!/usr/bin/env python3
"""Rasterise every campaign's flyer and banner to final deliverables.

Flyer  -> vector PDF (true A4), 300 dpi RGB PNG, and a real CMYK TIFF.
Banner -> 1200x700 RGB PNG plus a 2x retina cut.
"""
import os, subprocess
from _shared import CAMPAIGNS

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
CMYK   = "/System/Library/ColorSync/Profiles/Generic CMYK Profile.icc"
OUT    = "print"; os.makedirs(OUT, exist_ok=True)
A = os.path.abspath

def chrome(args, timeout=180):
    return subprocess.run([CHROME, "--headless=new", "--disable-gpu",
                           "--hide-scrollbars", "--allow-file-access-from-files"] + args,
                          capture_output=True, text=True, timeout=timeout)

def shot(html, out, w, h, dsf=1):
    chrome([f"--window-size={w},{h}", f"--force-device-scale-factor={dsf}",
            "--default-background-color=0b0d11ff",
            f"--screenshot={A(out)}", f"file://{A(html)}"])

def pdf(html, out):
    chrome(["--no-pdf-header-footer", "--print-to-pdf-no-header",
            f"--print-to-pdf={A(out)}", f"file://{A(html)}"])

def sips(*a): return subprocess.run(["sips"] + list(a), capture_output=True, text=True)

def info(p):
    o = sips("-g", "pixelWidth", "-g", "pixelHeight", "-g", "space", p).stdout
    d = dict(l.strip().split(": ", 1) for l in o.splitlines() if ": " in l)
    return (f"{d.get('pixelWidth','?')}x{d.get('pixelHeight','?'):<5} "
            f"{d.get('space','?'):5s} {os.path.getsize(p)/1024/1024:5.1f} MB")

total = 0
for c in CAMPAIGNS:
    i = c["id"]
    print(f"— {i} —")
    fh, bh = f"flyer-{i}.html", f"banner-{i}.html"

    p = f"{OUT}/lockin-flyer-{i}-A4.pdf"
    pdf(fh, p); print(f"  {os.path.basename(p):42s} vector A4  {os.path.getsize(p)/1024:5.0f} KB")

    g = f"{OUT}/lockin-flyer-{i}-A4-300dpi.png"
    shot(fh, g, 794, 1123, 3.125)
    sips("-s", "dpiWidth", "300", "-s", "dpiHeight", "300", g)
    print(f"  {os.path.basename(g):42s} {info(g)}")

    t = f"{OUT}/lockin-flyer-{i}-A4-CMYK-300dpi.tiff"
    sips("--matchTo", CMYK, g, "-s", "format", "tiff", "--out", t)
    sips("-s", "dpiWidth", "300", "-s", "dpiHeight", "300", t)
    print(f"  {os.path.basename(t):42s} {info(t)}")

    for name, dsf in ((f"lockin-banner-{i}-1200x700.png", 1),
                      (f"lockin-banner-{i}-2400x1400@2x.png", 2)):
        b = f"{OUT}/{name}"; shot(bh, b, 1200, 700, dsf)
        print(f"  {name:42s} {info(b)}")

    total += sum(os.path.getsize(f"{OUT}/{f}") for f in os.listdir(OUT)) if False else 0

sz = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print(f"\n{len(os.listdir(OUT))} files in {OUT}/  —  {sz/1024/1024:.0f} MB total")
