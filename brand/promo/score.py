#!/usr/bin/env python3
"""Synthesise the promo's score, cut to the film's own beats.

No samples and no library — everything is generated: drones, a clock pulse that
doubles when the session starts and cuts dead at the autopsy, dissonant blips on
each tab leave, and one big hit on the snap at 5s.
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
# S1 DRIFT — unsettled: low A with a minor-2nd rub that never resolves
pad([55, 58.27], 0.0, 5.3, amp=0.052, send=0.5)
for k, t in enumerate(np.arange(0.9, 4.2, 0.62)):
    blip(t, 1480 + (k % 3) * 190, 0.09, 0.032, pan=(-1) ** k * 0.6, send=0.5)
for k, t in enumerate([2.15, 2.75, 3.35, 3.85]):                 # distractions
    blip(t, [932, 1245, 1108, 1480][k], 0.20, 0.095, pan=(-1) ** k * 0.55, kind='tri')
whoosh(3.95, 1.05, 0.20)                                          # ring closing in
n = idx(1.0); place(osc(np.linspace(110, 440, n), n) * env(n, .9, .1, 1.0), 4.0, 0.10, send=0.4)

# 5.0 — THE SNAP
thump(4.98, 190, 38, 1.1, amp=1.0, send=0.42)
click(4.98, 3000, 0.07, 0.42)
bell(5.02, 880, 2.6, 0.16, send=0.7)

# S2 LOCKED IN — it resolves: A minor
pad([110, 164.81, 220], 5.15, 3.3, amp=0.10)
bell(6.52, 440, 2.4, 0.13)
for t in np.arange(5.8, 8.2, 0.8): click(t, 1600, 0.04, 0.10, send=0.2)   # clock, 75bpm

# S3 SESSION — pulse doubles, six tab leaves cut across it
pad([110, 164.81, 220, 329.63], 8.2, 4.9, amp=0.095)
for t in np.arange(8.4, 13.0, 0.4): click(t, 1750, 0.035, 0.11, send=0.18)
for k, t in enumerate([9.5, 10.0, 10.45, 10.95, 11.4, 11.85]):
    blip(t, 415.3 * (1 + k * 0.012), 0.22, 0.26, pan=(-1) ** k * 0.5, kind='tri')  # tritone
    click(t, 2600, 0.03, 0.14, pan=(-1) ** k * 0.5)

# S4 AUTOPSY — the pulse stops dead. F major, reflective.
pad([87.31, 174.61, 261.63], 13.05, 5.4, amp=0.10, send=0.5)
thump(13.0, 120, 44, 0.9, 0.55)
cnt = np.geomspace(0.035, 0.11, 26)                                # score counting up
for k, d in enumerate(cnt): click(13.85 + float(np.sum(cnt[:k])) * 4.2, 2400, 0.022, 0.07, send=0.1)
for i in range(5): click(14.6 + i * 0.16, 1400, 0.05, 0.13, pan=-0.2, send=0.2)
whoosh(16.28, 0.5, 0.20)                                           # the strike
bell(16.95, 587.33, 2.6, 0.15)

# S5 HANDS-FREE — open C, airy
pad([130.81, 196, 261.63, 392], 18.4, 4.7, amp=0.09, send=0.55)
bell(18.45, 659.25, 2.8, 0.16, pan=0.2)
rng = np.random.default_rng(7)
for t in np.arange(19.15, 20.2, 0.052): click(float(t), 3100, 0.015, 0.032, pan=float(rng.uniform(-.4, .4)), send=0.08)
for t in np.arange(20.55, 21.8, 0.048): click(float(t), 2500, 0.015, 0.028, pan=float(rng.uniform(-.4, .4)), send=0.08)
blip(21.9, 523.25, 0.5, 0.13, send=0.5); blip(22.05, 659.25, 0.7, 0.11, send=0.5)

# S6 DUEL — driving. A minor into E.
pad([110, 164.81, 261.63], 23.0, 2.2, amp=0.10)
pad([82.41, 164.81, 246.94], 25.2, 2.3, amp=0.10)
whoosh(22.95, 0.7, 0.28)
for k, t in enumerate(np.arange(23.3, 27.3, 0.3)):
    click(float(t), 1900, 0.035, 0.13 if k % 2 == 0 else 0.08, pan=(-1) ** k * 0.45, send=0.15)
    if k % 4 == 0: thump(float(t), 130, 48, 0.35, 0.34)
buzz(25.08, 0.85, 0.26)                                            # partner left their tab
blip(25.1, 311.13, 0.5, 0.16, pan=0.6, kind='tri')
thump(26.5, 200, 52, 0.8, 0.7); click(26.5, 2800, 0.05, 0.3)       # 4 – 2 stamps

# S7 CLOSE — converge and resolve
whoosh(27.35, 0.85, 0.26, rev=True)
pad([110, 164.81, 220, 329.63], 27.9, 2.1, amp=0.125, send=0.45)
thump(28.15, 170, 40, 1.0, 0.75)
bell(28.42, 880, 2.6, 0.2); bell(28.52, 1318.5, 2.2, 0.10, pan=0.25)

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

with wave.open('score.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T.reshape(-1) * 32767).astype('<i2').tobytes())
print(f"score.wav  {DUR:.0f}s  peak {20*np.log10(np.abs(mix).max()):.1f} dBFS")
