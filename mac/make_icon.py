# make_icon.py — the macOS app icon: Lockin's mark on a dark rounded tile, at every size iconutil wants.
import os, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter
here = os.path.dirname(os.path.abspath(__file__))
mark = Image.open(os.path.join(here, "..", "brand", "png", "lockin-icon-1024.png")).convert("RGBA")
S = 1024
tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
# Apple's grid: an 824px rounded square centred on the 1024 canvas
box = (100, 100, 924, 924)
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle((100, 118, 924, 942), 185, fill=(0, 0, 0, 120))
tile.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
grad = Image.new("RGBA", (S, S))
for y in range(S):
    k = y / S
    grad.paste((int(26 - 10 * k), int(30 - 11 * k), int(44 - 16 * k), 255), (0, y, S, y + 1))
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse((260, 220, 764, 724), fill=(124, 140, 255, 70))
grad.alpha_composite(glow.filter(ImageFilter.GaussianBlur(120)))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle(box, 185, fill=255)
bg.paste(grad, (0, 0), mask)
ImageDraw.Draw(bg).rounded_rectangle(box, 185, outline=(255, 255, 255, 30), width=3)
tile.alpha_composite(bg)
m = mark.resize((540, 540), Image.LANCZOS)
tile.alpha_composite(m, ((S - 540) // 2, (S - 540) // 2 + 6))
out = os.path.join(sys.argv[1] if len(sys.argv) > 1 else here, "Lockin.iconset")
os.makedirs(out, exist_ok=True)
for size in (16, 32, 128, 256, 512):
    tile.resize((size, size), Image.LANCZOS).save(os.path.join(out, f"icon_{size}x{size}.png"))
    tile.resize((size * 2, size * 2), Image.LANCZOS).save(os.path.join(out, f"icon_{size}x{size}@2x.png"))
subprocess.run(["iconutil", "-c", "icns", out, "-o", os.path.join(os.path.dirname(out), "Lockin.icns")], check=True)
tile.save(os.path.join(os.path.dirname(out), "icon-1024.png"))
