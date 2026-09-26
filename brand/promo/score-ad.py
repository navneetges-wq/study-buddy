#!/usr/bin/env python3
"""Synthesise the advertisement's score, cut to ad.js's own beats.

No samples and no library. The arrangement thins out almost to nothing for the
hands-free segment: when the picture goes dark to show you don't need the screen,
the music gets out of the way so the voice lines carry it.
"""
import numpy as np, wave, struct

SR, DUR = 48000, 30.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N); SEND = np.zeros(N)      # dry L/R + reverb send

def idx(t): return int(t * SR)
def env(n, a, d, p=2.0):
    """attack/decay envelope, p shapes the decay curve"""
    a_n = max(1, int(a * SR)); d_n = max(1, n - a_n)
    return np.concatenate([np.linspace(0, 1, a_n), (1 - np.linspace(0, 1, d_n)) ** p])[:n]

def osc(f, n, kind='sine', detune=0.0):
    t = np.arange(n) / SR
    ph = 2 * np.pi * (f * t if np.isscalar(f) else np.cumsum(f) / SR)
    s = np.sin(ph)
    if kind == 'tri': s = 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == 'saw': s = 2 * ((f * t) % 1.0) - 1 if np.isscalar(f) else s
    if detune:
        ph2 = 2 * np.pi * (f * (1 + detune)) * t
        s = 0.6 * s + 0.4 * np.sin(ph2)
    return s

def spectral(sig, lo=0, hi=20000, tilt=0.0):
    """shape noise in the frequency domain — cheap and fast, no scipy here"""
    S = np.fft.rfft(sig); fr = np.fft.rfftfreq(len(sig), 1 / SR)
    m = ((fr >= lo) & (fr <= hi)).astype(float)
    m *= np.exp(-tilt * fr / 1000.0)
    m = np.convolve(m, np.ones(9) / 9, mode='same')            # soften edges
    return np.fft.irfft(S * m, n=len(sig))

def place(sig, t, amp=1.0, pan=0.0, send=0.0):
    i = idx(t); n = min(len(sig), N - i)
    if n <= 0: return
    s = sig[:n] * amp
    L[i:i+n] += s * np.sqrt((1 - pan) / 2 + 0.5)
    R[i:i+n] += s * np.sqrt((1 + pan) / 2 + 0.5)
    if send: SEND[i:i+n] += s * send

# ---- voices ---------------------------------------------------------------
def pad(freqs, t, dur, amp=0.1, send=0.35, detune=0.004):
    n = idx(dur)
    e = np.minimum(np.linspace(0, 1, n) * 6, 1) * np.minimum((1 - np.linspace(0, 1, n)) * 6, 1)
    for k, f in enumerate(freqs):
        v = osc(f, n, 'sine', detune * (1 + k)) + 0.25 * osc(f * 2, n)
        place(v * e, t, amp / (1 + k * 0.45), pan=(-0.3 if k % 2 else 0.3), send=send)

def thump(t, f0=140, f1=42, dur=0.7, amp=0.9, send=0.3):
    n = idx(dur); f = np.linspace(f0, f1, n)
    place(osc(f, n) * env(n, 0.002, dur, 3.2), t, amp, send=send)

def click(t, f=2200, dur=0.05, amp=0.35, pan=0.0, send=0.15):
    n = idx(dur)
    place((osc(f, n) * 0.6 + spectral(np.random.default_rng(int(t*1e4)).normal(0, .3, n), 1200, 9000)) *
          env(n, 0.001, dur, 4.0), t, amp, pan, send)

def blip(t, f, dur=0.16, amp=0.3, pan=0.0, send=0.35, kind='sine'):
    n = idx(dur)
    place(osc(f, n, kind) * env(n, 0.004, dur, 3.0), t, amp, pan, send)

def bell(t, f, dur=2.2, amp=0.22, pan=0.0, send=0.6):
    n = idx(dur); s = np.zeros(n)
    for h, a in ((1, 1), (2.01, .42), (3.02, .22), (4.7, .1)):
        s += a * osc(f * h, n) * env(n, 0.003, dur, 1.6 + h * 0.5)
    place(s / 1.7, t, amp, pan, send)

def whoosh(t, dur=0.9, amp=0.3, rev=False, send=0.45):
    n = idx(dur); rng = np.random.default_rng(int(t * 997))
    s = spectral(rng.normal(0, 1, n), 200, 7000, tilt=0.06)
    e = env(n, dur * 0.85, dur * 0.15, 1.2) if rev else env(n, 0.02, dur, 2.2)
    place(s * e, t, amp, pan=-0.5, send=send); place(s[::-1] * e, t, amp, pan=0.5, send=send)

def buzz(t, dur=0.8, amp=0.3, f=68):
    n = idx(dur)
    s = osc(f, n, 'saw' if False else 'tri') * (1 + 0.5 * np.sin(2 * np.pi * 17 * np.arange(n) / SR))
    place(s * env(n, 0.01, dur, 2.0), t, amp, send=0.25)

# ============================ the score ====================================
# S1 BRAND 0–3.0 — state the product, fast and confident
thump(0.10, 200, 46, 0.9, 0.85)
bell(0.14, 880, 2.4, 0.19)
pad([110, 164.81, 220], 0.15, 3.0, amp=0.105)
bell(0.82, 1318.5, 1.8, 0.09, pan=0.25)
for t in np.arange(1.0, 2.9, 0.48): click(float(t), 1700, 0.04, 0.085, send=0.2)

# S2 HANDS-FREE 3.0–11.2 — the picture goes dark, so the music steps back
whoosh(2.98, 0.6, 0.24)
pad([82.41, 123.47], 3.1, 8.1, amp=0.055, send=0.6)          # just a bed, very low
bell(3.30, 659.25, 2.4, 0.13, pan=0.15)                       # mic arms
for t, f in ((4.28, 523.25), (5.48, 392.0), (6.88, 523.25), (7.78, 392.0)):
    blip(t, f, 0.22, 0.10, send=0.45)                         # one cue per spoken line
rng = np.random.default_rng(11)
for a, b in ((4.35, 5.2), (5.55, 6.1), (6.95, 7.5), (7.85, 8.7)):
    for t in np.arange(a, b, 0.055):
        click(float(t), 2900, 0.014, 0.022, pan=float(rng.uniform(-.35, .35)), send=0.06)
thump(8.98, 150, 44, 0.8, 0.5)                                # the claim lands
bell(9.04, 587.33, 2.8, 0.15, send=0.65)
pad([110, 164.81, 261.63], 9.0, 2.2, amp=0.085)

# S3 AUTOPSY 11.2–17.6 — rhythm returns
whoosh(11.15, 0.5, 0.22)
thump(11.38, 130, 46, 0.8, 0.6)
pad([87.31, 174.61, 261.63], 11.4, 6.1, amp=0.10, send=0.5)
cnt = np.geomspace(0.030, 0.10, 24)
for k, d in enumerate(cnt): click(12.15 + float(np.sum(cnt[:k])) * 4.6, 2400, 0.022, 0.07, send=0.1)
for i in range(5): click(13.0 + i * 0.15, 1400, 0.05, 0.12, pan=-0.2, send=0.2)
blip(14.42, 329.63, 0.45, 0.13, send=0.5)
bell(15.62, 659.25, 2.6, 0.16)

# S4 DUEL 17.6–23.8 — driving, with a knock when the link lands
whoosh(17.55, 0.7, 0.26)
pad([110, 164.81, 261.63], 17.7, 3.4, amp=0.10)
pad([82.41, 164.81, 246.94], 21.1, 2.7, amp=0.10)
click(18.95, 2100, 0.06, 0.26, send=0.3)                      # link received
for k, t in enumerate(np.arange(19.2, 23.4, 0.3)):
    click(float(t), 1900, 0.035, 0.13 if k % 2 == 0 else 0.075, pan=(-1) ** k * 0.45, send=0.15)
    if k % 4 == 0: thump(float(t), 130, 48, 0.35, 0.32)
buzz(21.18, 0.85, 0.25)                                       # partner left their tab
blip(21.2, 311.13, 0.5, 0.15, pan=0.6, kind='tri')
thump(22.90, 200, 52, 0.8, 0.66); click(22.90, 2800, 0.05, 0.28)

# S5 QUICKFIRE 23.8–27.2 — one hit per card, five in a row
pad([110, 164.81, 220], 23.85, 3.4, amp=0.09)
for i in range(5):
    t = 23.95 + i * 0.56
    thump(t, 165, 50, 0.3, 0.42)
    blip(t, [523.25, 587.33, 659.25, 698.46, 783.99][i], 0.26, 0.13,
         pan=(-1) ** i * 0.35, send=0.4)

# S6 CTA 27.2–30 — resolve
whoosh(27.15, 0.7, 0.24, rev=True)
pad([110, 164.81, 220, 329.63], 27.3, 2.6, amp=0.125, send=0.45)
thump(27.55, 175, 40, 1.0, 0.8)
bell(27.62, 880, 2.7, 0.2); bell(27.74, 1318.5, 2.3, 0.10, pan=0.25)
# ---- reverb (FFT convolution with a decaying-noise impulse) ---------------
ir_n = idx(1.5); rng = np.random.default_rng(3)
ir = rng.normal(0, 1, ir_n) * np.exp(-np.linspace(0, 7.5, ir_n))
ir[:idx(0.012)] = 0
ir = spectral(ir, 120, 6500, tilt=0.05); ir /= np.abs(ir).sum() / 2.2
size = 1 << (N + ir_n - 1).bit_length()
wet = np.fft.irfft(np.fft.rfft(SEND, size) * np.fft.rfft(ir, size), size)[:N]
L += wet * 0.55; R += np.roll(wet, 420) * 0.55                     # slight decorrelation

# ---- master: gentle fades, soft clip, normalise ---------------------------
for buf in (L, R):
    buf[:idx(0.05)] *= np.linspace(0, 1, idx(0.05))
    buf[idx(29.55):] *= np.linspace(1, 0, N - idx(29.55))
mix = np.stack([L, R])
mix = np.tanh(mix * 1.25) / 1.25
mix *= 0.89 / max(np.abs(mix).max(), 1e-9)

with wave.open('score-ad.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T.reshape(-1) * 32767).astype('<i2').tobytes())
print(f"score-ad.wav  {DUR:.0f}s  peak {20*np.log10(np.abs(mix).max()):.1f} dBFS")
