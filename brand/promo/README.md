# Lockin — 30s promo film

**`lockin-promo-1080p.mp4`** — 1920×1080, H.264 + AAC stereo, 30s, 30fps, 7.6 MB.
`lockin-promo-silent.mp4` is the video-only master, kept as the mux input.

## The idea

The mark is the character. Nothing else appears in the first five seconds.

A loose dot is distraction. A dot snapped into the ring's gap is focus. That single
reading carries the whole film, so "lock in" is *shown* rather than captioned:

| | Scene | What the mark does |
|---|---|---|
| 0–5.2s | **Drift** | One accent dot alone in the dark, wandering, trailing. Faint type: *11:48pm. Chapter 4, page 2.* Distractions surface where the dot is heading — *just one reel*, *quick reply*. Then a ring assembles and the dot **snaps** into its gap with a shockwave. |
| 5.2–8.2s | **Locked in** | The mark settles, shrinks, and LOCKIN sets beneath it. |
| 8.2–13s | **The session** | The ring becomes the countdown. It fills to 38:12 — and red ticks fire around its edge, one per tab leave, counting to 6. |
| 13–18.4s | **Autopsy** | The card assembles, the score counts to 82, rows land one by one. *Most timers tell you ~~time's up~~.* / **Lockin tells you what happened.** |
| 18.4–23s | **Hands-free** | Voice rings radiate out of the mark. *"Lockin, how am I doing?"* types in; the reply answers with the same numbers the card showed. |
| 23–27.4s | **Duel** | The mark splits in two and races. Aisha's ring goes red — *left their tab* — and her score stalls. 4 – 2. |
| 27.4–30s | **Close** | The two marks converge back into one. Wordmark, URL, and the dot pulses once. |

Deliberately unlike the reference: it opens in darkness on a moving object rather than
on a typographic statement, the palette is the site's own (`#0b0d11` / `#7c8cff` /
`#e8eaf0`), there is no mascot, and no UI screen recording — every frame is drawn from
the brand's own geometry.

It also keeps the brand rule that mattered most here: **the dot never rides around the
ring.** It sits at 12 o'clock or it is loose in the dark. The sweeping arc is the
session dial, which is a different element.

## The score

Synthesised from scratch in `score.py` — no samples, no library. It is cut to the
film's own beats rather than laid under it:

| | |
|---|---|
| **Drift** | A low A with a minor-2nd rub that never resolves — the unease is in the tuning. Each distraction word gets its own dissonant blip. |
| **The snap** | The loudest moment in the whole 30s: a pitch-dropping thump, a click and a bell, with a 21 dB jump from the drift that precedes it. |
| **Locked in** | The rub disappears and it resolves to A minor. A clock tick starts at 75bpm. |
| **Session** | The tick doubles to every 0.4s. The six tab leaves cut across it on a tritone — deliberately the wrong note. |
| **Autopsy** | The pulse **stops dead** on the cut. Silence, then F major. Counting ticks track the score climbing to 82. |
| **Hands-free** | Open C, airy, with soft key-clicks under the typing. |
| **Duel** | Driving eighths, A minor into E. A detuned buzz when Aisha leaves her tab. |
| **Close** | Converging whoosh, resolve to A minor, two bells. |

Reverb is FFT convolution against a decaying-noise impulse on a send bus. Master is
soft-clipped and peaks at −1.0 dBFS.

I can't hear it, so I verified it structurally instead — per-window RMS against the
film's cue times. The loudest 0.25s window in the file lands at **5.00s**, which is the
snap, and the autopsy silence measures quieter than the session pulse before it.

## How it was made

No ffmpeg on this machine, so the pipeline is built from what macOS has:

```bash
python3 capture.py 8743 <framesDir> &            # serve + receive frames
open http://127.0.0.1:8743/promo.html            # scrub it
open http://127.0.0.1:8743/promo.html?export=1   # render 900 frames
./mkvideo <framesDir> lockin-promo-silent.mp4 30 1920 1080
python3 score.py                                 # synthesise score.wav
afconvert -f m4af -d aac -b 192000 score.wav score.m4a
./muxav lockin-promo-silent.mp4 score.m4a lockin-promo-1080p.mp4
```

- `promo.js` — the film. Every frame is a **pure function of time**, so headless capture
  is exact and reproducible; nothing depends on wall-clock or `requestAnimationFrame`.
- `promo.html` — scrubber (default), `?t=12.5` single frame, `?sheet=1` contact sheet,
  `?export=1` render the sequence.
- `score.py` — the synthesiser. Cue times at the top of each block match `promo.js`.
- `mkvideo.swift` / `muxav.swift` — AVFoundation encoder and muxer. Rebuild with
  `swiftc -O -o mkvideo mkvideo.swift` (same for muxav). Muxing is **passthrough**:
  neither the video nor the audio is re-encoded.
- Frames go to a scratch directory and are deleted after encoding — 900 JPEGs is 56 MB
  and has no business in the repo.

## Known limits

- Editing means editing `promo.js` / `score.py` and re-rendering, not scrubbing a
  timeline. Export, score and mux is about two minutes end to end.
- If you change scene timings in `promo.js`, the score's cue times need the same edit —
  they are duplicated, not shared.
- 1080p only. For a vertical or square social cut, change `W`/`H` at the top of
  `promo.js`, re-export, and pass the new dimensions to `mkvideo`.

---

# The advertisement — `lockin-ad-1080p.mp4`

1920×1080, H.264 + AAC stereo, 30s, 6.1 MB. **Faceless and product-only** — no people,
no mascot, nothing on screen but the app's own interface and geometry.

Where the promo film is a mood piece, this is a feature ad: chapter cards, a progress
hairline along the bottom, and three features given real time each.

| | Scene | |
|---|---|---|
| 0–3s | **Brand** | Mark, name, *a focus timer that answers back.* |
| 3–11.2s | **Hands-free** | **The screen goes black** and stays black. Only the mic ring, a waveform and the spoken lines remain. Two full exchanges play out, then: *Run a whole session without looking at the screen.* |
| 11.2–17.6s | **Session Autopsy** | The card builds, the score counts to 82. *It doesn't say "done". It says what happened.* |
| 17.6–23.8s | **Focus Duel** | The invite link flies across, two panels sync, scores race, one goes red. 4 – 2. |
| 23.8–27.2s | **Quickfire** | Five more features, one hit each, on the beat. |
| 27.2–30s | **CTA** | *Free. No account. Nothing leaves your laptop.* |

The hands-free segment is the centre of the ad, and the idea is that **the screen going
dark is the message**. Taking the picture away is the most direct way to show the app
doesn't need it.

## A note on the accessibility claim

You asked to pitch hands-free as useful for blind users. Before writing that I checked
the implementation: `js/voice-control.js` really does use `SpeechSynthesisUtterance` to
speak back, and carries **about 30 command patterns** — start with a duration, pause,
resume, extend, finish, log a distraction, ask time remaining, mood, journal, sound
control, insights, plan, goal. So your "22 commands" line is conservative, and a session
genuinely can be run start to finish without sight.

**So the ad says "Run a whole session without looking at the screen" — not "built for
blind users."** That is deliberate. The first is a capability claim I verified in your
code. The second is an accessibility claim, and two things aren't established:

- Allowing the microphone the first time still needs a click.
- The rest of the interface — tabs, settings, the plan view — hasn't been tested against
  a screen reader, so "works with VoiceOver" is unverified.

If you want to make the stronger claim, test a full session end-to-end with VoiceOver on
and fix whatever that turns up. It's very likely close. But an untested accessibility
claim in an advert is the kind of thing that rightly gets called out, and the weaker
wording is still a strong hook.

## Rebuilding

```bash
python3 capture.py 8743 <framesDir> &
open "http://127.0.0.1:8743/ad.html"              # scrub  (?t=9.9, ?sheet=1)
open "http://127.0.0.1:8743/ad.html?export=1"     # 900 frames
./mkvideo <framesDir> ad-silent.mp4 30 1920 1080
python3 score-ad.py && afconvert -f m4af -d aac -b 192000 score-ad.wav score-ad.m4a
./muxav ad-silent.mp4 score-ad.m4a lockin-ad-1080p.mp4
```

`ad.js` is the ad, `score-ad.py` its score — the arrangement deliberately thins almost
to nothing under the dark hands-free segment so the voice lines carry it, then the
rhythm returns for the autopsy.
