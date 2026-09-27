#!/usr/bin/env python3
"""
build-photos.py — swap Lockin onto the devices in the four lifestyle photos.

Each entry lists the display's four corners, clockwise from its top-left, in
pixels of the original photo. Which screen goes where follows the photo: the
devices already showing a big clock get a running session, the ones showing a
music player get the branded landing screen.

    python3 build-photos.py        # writes out/
"""
import os
import shutil
import screenswap as s

PHOTOS = s.PHOTOS

JOBS = [
    dict(
        photo='photo-neon.png', out='lockin-neon.png',
        screens=[
            # laptop, replacing the oversized 11:08 clock
            dict(render='running-1280.png',
                 quad=[(77, 1113), (349, 1071), (384, 1288), (94, 1309)],
                 crop=(285, 55, 1000, 560), brightness=1.50, lift=16, glow=0.40),
        ],
    ),
    dict(
        photo='photo-citynight.jpg', out='lockin-citynight.jpg',
        screens=[
            # laptop — bottom edge runs lower than it looks; short of it and
            # the original dock survives as a strip of coloured icons
            dict(render='landing-1280.png',
                 quad=[(283, 487), (442, 485), (447, 592), (280, 594)],
                 # stop above the session-length chips so the crop ends clean
                 crop=(340, 55, 920, 405), brightness=1.45, lift=14, glow=0.30),
            # the flip-clock tablet
            dict(render='running-1280.png',
                 quad=[(531, 519), (662, 533), (657, 608), (520, 602)],
                 crop=(400, 70, 880, 380), brightness=1.42, lift=12, glow=0.34),
        ],
    ),
    dict(
        photo='photo-lofi.jpg', out='lockin-lofi.jpg',
        screens=[
            # read off a coordinate grid: the display runs further right and
            # lower than it looks, and its left edge is not as far out
            dict(render='landing-1280.png',
                 quad=[(272, 590), (463, 617), (457, 760), (265, 731)],
                 crop=(300, 55, 980, 525), brightness=1.45, lift=14,
                 warmth=(1.04, 1.0, 0.96), glow=0.34),
        ],
    ),
    dict(
        photo='photo-rain.jpg', out='lockin-rain.jpg',
        screens=[
            dict(render='landing-1280.png',
                 quad=[(244, 474), (469, 471), (469, 638), (240, 638)],
                 crop=(310, 50, 970, 535), brightness=1.45, lift=14,
                 warmth=(1.03, 1.0, 0.97), glow=0.32),
        ],
    ),
]


def run():
    for job in JOBS:
        src = job['photo']
        tmp = None
        for i, sc in enumerate(job['screens']):
            last = (i == len(job['screens']) - 1)
            s.swap(src, sc['render'], sc['quad'], job['out'],
                   crop=sc.get('crop'), brightness=sc.get('brightness', 1.0),
                   lift=sc.get('lift', 0), warmth=sc.get('warmth'),
                   glow=sc.get('glow', 0.0))
            if not last:
                # feed the part-finished image back in for the next screen
                tmp = '_chain' + os.path.splitext(job['out'])[1]
                shutil.copy(os.path.join(s.OUT, job['out']),
                            os.path.join(PHOTOS, tmp))
                src = tmp
        if tmp:
            os.remove(os.path.join(PHOTOS, tmp))


if __name__ == '__main__':
    run()
