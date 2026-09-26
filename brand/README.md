# LOCKIN — brand kit

A focus ring left open, and the accent dot as the piece that closes it, set against
LOCKIN in Eczar Bold. Everything runs heavy.

Both mark elements were already in the app doing nothing in particular — a plain ring
as the favicon, a 10px accent dot in the header. The mark makes them one statement:
the ring is the session, open and unfinished; the dot is what completes it.

The gap isn't eyeballed. It's solved from the dot outward (`mark()` in `build.py`),
wide enough to clear both round caps, the dot itself, and a set margin of air either
side — change the dot and the gap re-solves. The dot stays wider than the stroke, which
is what stops it reading as the head of a loading spinner. The ring's stroke is 28% of
its own diameter so it carries the same weight as Eczar's bold stems.

Open `brand-sheet.html` for the full identity sheet — self-contained, works anywhere.
`concepts.html` is the earlier exploration of four directions, kept as a record.

## Typography

LOCKIN is set in **Eczar Bold** (weight 700, v2.000) by **Vaibhav Singh** at Rosetta
Type Foundry, under the SIL Open Font License. Caps, tracked 40/1000 em.

In the logo files the letters are **converted to outlines**, so the artwork never
depends on the font being installed. The font ships in `fonts/` with its licence, and
is installed to `~/Library/Fonts` so you can set matching headlines in Photoshop
(delete `Eczar-Bold.ttf` and `Eczar[wght].ttf` from there to undo).

## Files

| Path | Use |
|---|---|
| `svg/lockin-lockup-dark.svg` | **Primary** — mark + LOCKIN, dark backgrounds |
| `svg/lockin-lockup-light.svg` | Primary, light backgrounds |
| `svg/lockin-lockup-white.svg` / `-black.svg` | One-colour reverse / print |
| `svg/lockin-lockup-o-*.svg` | Alternative lockup — the mark *is* the O |
| `svg/lockin-icon.svg` | App icon / square mark |
| `svg/lockin-favicon.svg` | Heavier cut for 16–48px |
| `svg/*-mode-{rain,night,clear,snow,cloud}.svg` | Focus-mode accent variants |
| `png/lockin-icon-{16…1024}.png` | Favicons, app icons — transparent |
| `png/lockin-lockup-*-{800,2400}.png` | Slides, flyer, banner — transparent |
| `fonts/Eczar-Bold.ttf`, `fonts/OFL.txt` | Eczar Bold instance + licence |

## Working files

```bash
python3 typeset.py   # instance Eczar at wght 700, re-extract LOCKIN outlines
python3 build.py     # regenerate all SVGs
python3 export.py    # re-rasterise the PNGs (headless Chrome, transparent)
```

`typeset.py` instances the variable font and converts the glyphs to paths;
`build.py` lays them out and draws the mark. Tracking, stroke weight, gap geometry
and the mark/wordmark ratio are all constants at the top of `build.py`.

## Opening in Photoshop

SVG is the editable vector master. In Photoshop:

- **File → Place Embedded** keeps it a **vector Smart Object** — scales with no loss,
  double-click to reopen for editing. Use this.
- **File → Open** rasterises it; the dialog asks for size, so set 2000px+.
- For path-level editing, the SVG opens fully editable in Illustrator or Figma.

## Specs

- Accent (the dot) `#7C8CFF` · Ink on dark `#E8EAF0` · Ink on light `#12151B` · Canvas `#0B0D11`
- Mark at 1.16× cap height, gap to wordmark 0.30× cap height
- Clear space: one dot diameter all round
- Minimum size: primary lockup 120px wide, O lockup 150px, mark 16px (favicon cut)
- Never rotate the gap off 12 o'clock, never animate the dot around the ring, never thin the ring

## Still to do for the assignment

Task 1 (logo) is done. Task 2 (A4 flyer, CMYK) and Task 3 (1200×700 blog banner, RGB)
build on this kit and are not started yet.

---

# Task 2 & 3 — the campaign set

Three campaigns, each with a **matched A4 flyer and 1200×700 banner**, built from one
skeleton so they read as a family rather than three unrelated posters. All six share
the palette, the Eczar Bold headline, the card language, the ghost ring and the
footer — only the angle changes.

| | Angle | Headline | Hero visual |
|---|---|---|---|
| **01** | It watches, then tells you the truth | *It counts every time you looked away.* | Session Autopsy card |
| **02** | Social pressure that actually works | *One link. Two timers. One winner.* | Focus Duel head-to-head |
| **03** | Run it without touching anything | *22 commands. No keyboard.* | Voice command list |

Each flyer carries every element the brief asks for — logo and name, headline, key
features, a graphic, and a call to action (QR + URL). Each banner carries app
identity, headline and a relevant visual.

Every campaign leads on one hook and supports it with a second as a live band rather
than a bullet: 01 pairs the autopsy with hands-free, 02 pairs the duel with Nudge,
03 pairs the commands with the end-of-session interview. Where numbers appear twice
on a page they agree — the spoken reply on flyer 01 quotes the same figures as the
autopsy card beside it.

## Brand compliance

- The accent lands on **one element only** — the dot, the score, or the live badge.
  Never on the ring, never on body copy.
- The logo is placed as supplied vector at a fixed size, above the 120px minimum,
  with clear space beyond the required one dot diameter.
- The gap stays at 12 o'clock and nothing animates around the ring.
- The countdown dial was deliberately dropped as a hero visual: a dial says
  "time's up", which is what campaign 01's headline argues against.

## Deliverables — `print/`

Per campaign, where `NN` is `01-autopsy`, `02-duel` or `03-handsfree`:

| File | Spec | Use |
|---|---|---|
| `lockin-flyer-NN-A4.pdf` | vector, true A4 | **Send this to a printer** |
| `lockin-flyer-NN-A4-300dpi.png` | 2481×3509, RGB, 300 dpi | Screen, slides, submission |
| `lockin-flyer-NN-A4-CMYK-300dpi.tiff` | 2481×3509, **CMYK**, 300 dpi | The brief's CMYK requirement |
| `lockin-banner-NN-1200x700.png` | 1200×700, RGB | The banner as specified |
| `lockin-banner-NN-2400x1400@2x.png` | 2400×1400, RGB | Retina / crops |

`print/qr.svg` is the vector QR to the live app used in every flyer footer.

**The CMYK TIFFs are ~33 MB each (100 MB total) and are gitignored.** They're on disk
for printing and submission, and `python3 render.py` regenerates them in seconds — they
would bloat the repo for no reason.

## Rebuilding

```bash
python3 layout.py   # regenerate all six HTML pages
python3 render.py   # rasterise every deliverable
```

`_shared.py` holds the palette, the reusable components (autopsy card, duel card,
command list, listening bar, ghost ring, QR) and the `CAMPAIGNS` list — all the copy
lives there. `layout.py` holds the two page skeletons. Adding a fourth campaign means
appending one dict.

Each page is self-contained: Eczar Bold embedded as base64, logo and QR inlined as
vector. No assets need to sit beside them.

## Notes on print

- **The flyers are dark, edge to edge.** That's the brand, but it's heavy ink coverage.
  Ask your print shop; on cheap digital presses large dark fields can band or scuff.
- **The accent shifts in CMYK.** `#7C8CFF` is a saturated blue-violet outside the CMYK
  gamut, so the converted TIFFs read slightly duller than screen. That's inherent to
  print. If your printer wants a specific profile (FOGRA, SWOP), reconvert from the RGB
  PNG in Photoshop with theirs rather than using the Generic CMYK profile used here.
- `print-color-adjust: exact` is set, without which Chrome silently drops the dark
  background when printing to PDF.
