#!/usr/bin/env python3
"""
screenswap.py — put a real Lockin screen onto the device in a photograph.

The screen render is perspective-warped onto the four corners of the device's
display, then blended so it keeps the photograph's own light. Nothing is
regenerated: the photo is untouched outside the screen quad.

Corners are listed clockwise from the top-left of the display, in pixels of
the original photo.
"""
from PIL import Image, ImageFilter, ImageEnhance
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = os.path.join(HERE, 'photos')
SCREENS = os.path.join(HERE, 'screens')
OUT = os.path.join(HERE, 'out')


def solve(a, b):
    """Gaussian elimination for the 8 perspective coefficients (no numpy)."""
    n = len(a)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[piv][col]) < 1e-12:
            raise ValueError('degenerate quad')
        m[col], m[piv] = m[piv], m[col]
        pv = m[col][col]
        m[col] = [v / pv for v in m[col]]
        for r in range(n):
            if r == col:
                continue
            f = m[r][col]
            if f:
                m[r] = [v - f * w for v, w in zip(m[r], m[col])]
    return [m[i][n] for i in range(n)]


def coeffs(dest, src):
    """Image.transform maps destination -> source, so solve in that direction."""
    a, b = [], []
    for (dx, dy), (sx, sy) in zip(dest, src):
        a.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]); b.append(sx)
        a.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]); b.append(sy)
    return solve(a, b)


def sheen(size, quad_h):
    """A faint top-down gradient: glass catches a little of the room."""
    g = Image.new('L', (1, 64))
    for y in range(64):
        g.putpixel((0, y), int(26 * (1 - y / 63) ** 1.6))
    return g.resize(size, Image.BICUBIC)


def swap(photo_name, screen_name, quad, out_name,
         brightness=1.0, lift=0, warmth=None, glow=0.0, crop=None):
    photo = Image.open(os.path.join(PHOTOS, photo_name)).convert('RGB')
    screen = Image.open(os.path.join(SCREENS, screen_name)).convert('RGB')

    # crop to the part of the interface worth reading at this size
    if crop:
        screen = screen.crop(crop)

    # a lit screen at night is brighter than everything around it, and its
    # blacks sit well above true black
    if brightness != 1.0:
        screen = ImageEnhance.Brightness(screen).enhance(brightness)
    if lift:
        screen = screen.point(lambda v: min(255, v + lift))
    if warmth:
        r, g, b = screen.split()
        r = r.point(lambda v: min(255, int(v * warmth[0])))
        g = g.point(lambda v: min(255, int(v * warmth[1])))
        b = b.point(lambda v: min(255, int(v * warmth[2])))
        screen = Image.merge('RGB', (r, g, b))

    # glass sheen, applied in the screen's own space so it warps with it
    screen = Image.composite(
        Image.new('RGB', screen.size, (255, 255, 255)), screen,
        sheen(screen.size, screen.size[1]).point(lambda v: v))

    w, h = screen.size
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    c = coeffs(quad, src)

    warped = screen.transform(photo.size, Image.PERSPECTIVE, c, Image.BICUBIC)
    mask = Image.new('L', (w, h), 255).transform(
        photo.size, Image.PERSPECTIVE, c, Image.BICUBIC)
    mask = mask.filter(ImageFilter.GaussianBlur(0.6))     # kill the jaggies

    out = photo.copy()

    # a dark screen still throws a little light onto its own bezel
    if glow:
        halo = Image.new('RGB', photo.size, (0, 0, 0))
        halo.paste(warped, (0, 0), mask)
        halo = halo.filter(ImageFilter.GaussianBlur(18))
        out = Image.blend(out, Image.eval(halo, lambda v: v).convert('RGB'), 0)
        out = Image.composite(
            Image.blend(out, halo, glow), out,
            mask.filter(ImageFilter.GaussianBlur(22)))

    out.paste(warped, (0, 0), mask)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, out_name)
    out.save(path, quality=95)
    print('wrote', path, out.size)
    return path
