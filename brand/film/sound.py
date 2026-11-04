# sound.py — the Lockin film soundtrack, synthesised from scratch (no samples, no copyright).
# Reads cues.json (written by render.cjs) and writes audio.wav:   python3 sound.py
# Music: warm pad intro → a ticking clock with a low pulse while the hour runs → sparse piano for the reveal →
#        a soft lo-fi groove (kick, brushed snare, swung hats, electric-piano chords, sine bass) → a gentle outro.
# Effects: clock ticks, phone buzzes, soft hits, a "lock" for the logo, chimes, clicks, pops, keys, whips, swooshes.
# Effect synths are shared with the premortem films.
import json, sys, numpy as np, wave

SR = 48000
v = sys.argv[1] if len(sys.argv) > 1 else "5"
spec = json.load(open("cues.json"))
DUR = spec["duration"] + 1.2
N = int(DUR * SR)
BPM = spec["bpm"]; BEAT = 60 / BPM
MUSIC = spec.get("music") or [{"a": 0, "b": spec["duration"], "kind": "groove"}]
rng = np.random.default_rng(11)
dryL = np.zeros(N); dryR = np.zeros(N); revL = np.zeros(N); revR = np.zeros(N)
mus = np.zeros(N); musRev = np.zeros(N)
T = lambda d: np.arange(int(d * SR)) / SR

def put(buf, sig, t, g=1.0):
    i = int(round(t * SR))
    if i < 0: sig = sig[-i:]; i = 0
    if i >= len(buf) or len(sig) == 0: return
    n = min(len(sig), len(buf) - i); buf[i:i + n] += sig[:n] * g

def fx(sig, t, g=1.0, pan=0.0, send=0.25):
    gl, gr = g * np.sqrt(0.5 * (1 - pan)) * 1.414, g * np.sqrt(0.5 * (1 + pan)) * 1.414
    if sig.ndim == 2:
        put(dryL, sig[0], t, g); put(dryR, sig[1], t, g); put(revL, sig[0], t, g * send); put(revR, sig[1], t, g * send)
    else:
        put(dryL, sig, t, gl); put(dryR, sig, t, gr); put(revL, sig, t, gl * send); put(revR, sig, t, gr * send)

# ---------- filters (FFT based, zero phase) ----------
def spec_filter(x, fn):
    n = 1 << int(np.ceil(np.log2(len(x) + 1)))
    X = np.fft.rfft(x, n); f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(X * fn(f), n)[: len(x)]
def lpf(x, fc, order=2): return spec_filter(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))
def hpf(x, fc, order=2): return spec_filter(x, lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order)))
def bpf(x, fc, q=1.0): return spec_filter(x, lambda f: 1 / np.sqrt(1 + (q * (f / fc - fc / np.maximum(f, 1e-3))) ** 2))
def sweep(x, f0, f1, kind="lp", q=1.5, blocks=24):
    # time-varying filter by overlap-add of short blocks, each filtered at its own frequency
    n = len(x); hop = max(256, n // blocks); win = np.hanning(hop * 2); out = np.zeros(n + hop * 2)
    xs = np.concatenate([x, np.zeros(hop * 2)])
    for s in range(0, n, hop):
        seg = xs[s:s + hop * 2] * win; u = s / max(1, n)
        fc = f0 * (f1 / f0) ** u
        seg = lpf(seg, fc) if kind == "lp" else bpf(seg, fc, q) if kind == "bp" else hpf(seg, fc)
        out[s:s + hop * 2] += seg
    return out[:n]
def env(n, a=0.005, d=0.2):
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
def adsr(n, a, r):
    t = np.arange(n) / SR; return np.minimum(1, t / max(a, 1e-4)) * np.minimum(1, (n / SR - t) / max(r, 1e-4))
def sine_glide(d, f0, f1, curve=6):
    t = T(d); f = f1 + (f0 - f1) * np.exp(-t * curve); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def saw(f, t): return 2 * ((f * t) % 1) - 1
def noise(d): return rng.standard_normal(int(d * SR))

# ---------- sound effects ----------
def heart():
    out = np.zeros(int(0.6 * SR))
    for off, g, f in ((0, 1.0, 62), (0.17, 0.75, 52)):
        s = sine_glide(0.3, f * 1.8, f, 18) * env(int(0.3 * SR), 0.004, 0.07) * g
        put(out, s, off)
    out += lpf(noise(0.6), 180) * env(len(out), 0.002, 0.03) * 0.6
    return np.tanh(out * 1.6) * 0.95
def beep(f=1000):
    t = T(0.13); s = (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(4 * np.pi * f * t)) * adsr(len(t), 0.004, 0.02)
    return s * 0.26
def flat(d=1.6):
    t = T(d); s = (np.sin(2 * np.pi * 1000 * t) + 0.18 * np.sin(4 * np.pi * 1000 * t)) * adsr(len(t), 0.004, 0.3)
    return s * 0.2
def drone(d=2.6):
    t = T(d); s = sum(np.sin(2 * np.pi * f * t + np.sin(2 * np.pi * 0.3 * t) * 0.4) * g for f, g in ((55, 1), (82.4, .5), (110, .3)))
    air = lpf(noise(d), 500) * 0.25
    return (s * 0.25 + air) * adsr(len(t), 1.2, 0.4) * 0.6
def boom():
    d = 2.6; sub = sine_glide(d, 120, 32, 4) * env(int(d * SR), 0.002, 0.9)
    crack = hpf(noise(d), 900) * env(int(d * SR), 0.0005, 0.03) * 0.7
    body = lpf(noise(d), 300) * env(int(d * SR), 0.002, 0.25) * 0.9
    return np.tanh((sub * 1.2 + crack + body) * 1.4) * 0.9
def braam():
    d = 2.4; t = T(d); s = np.zeros(len(t))
    for f in (55, 55.4, 54.6, 110, 110.6, 82.4, 164.8):
        s += saw(f, t + rng.uniform(0, 1))
    s = lpf(s, 700)
    grow = 0.8 + 0.2 * np.sin(2 * np.pi * 7 * t)
    return np.tanh(s * 0.25 * grow) * adsr(len(t), 0.05, 1.2) * 0.75
def glitch():
    d = 0.42; out = np.zeros(int(d * SR)); pos = 0
    while pos < len(out):
        L = int(rng.uniform(0.015, 0.05) * SR); kind = rng.integers(0, 3); t = np.arange(L) / SR
        if kind == 0: seg = np.sign(np.sin(2 * np.pi * rng.uniform(200, 2400) * t)) * 0.4
        elif kind == 1: seg = np.round(rng.standard_normal(L) * 3) / 3 * 0.35
        else: seg = np.sin(2 * np.pi * rng.uniform(60, 180) * t) * 0.6
        seg *= adsr(L, 0.001, 0.002); out[pos:pos + L] += seg[: len(out) - pos]; pos += L + int(rng.uniform(0, 0.02) * SR)
    return out * 0.7
def key():
    d = 0.06; clk = hpf(noise(d), 2500) * env(int(d * SR), 0.0003, 0.004) * 0.6
    body = np.sin(2 * np.pi * rng.uniform(170, 230) * T(d)) * env(int(d * SR), 0.0005, 0.012) * 0.5
    return (clk + body) * rng.uniform(0.55, 0.85)
def click():
    d = 0.08; return (hpf(noise(d), 1800) * env(int(d * SR), 0.0002, 0.005) * 0.8 + np.sin(2 * np.pi * 1600 * T(d)) * env(int(d * SR), 0.0005, 0.01) * 0.3)
def zip_():
    d = 0.55; t = T(d); u = t / d
    tone = np.sin(2 * np.pi * np.cumsum(1500 * (1 - u) ** 2 + 260) / SR) * 0.25
    air = sweep(noise(d), 600, 6000, "bp", 2.0) * 0.8
    s = (tone + air) * np.sin(np.pi * u) ** 1.5
    return np.stack([s * (1 - u) ** 0.5, s * u ** 0.5]) * 1.1
def slam():
    d = 1.8; n = int(d * SR)
    sub = sine_glide(d, 160, 40, 9) * env(n, 0.001, 0.35)
    snap = hpf(noise(d), 1200) * env(n, 0.0003, 0.02) * 0.9
    t = T(d); metal = sum(np.sin(2 * np.pi * f * t) * g * np.exp(-t * dcy) for f, g, dcy in ((327, 1, 5), (509, .7, 7), (811, .5, 9), (1243, .3, 12)))
    return np.tanh((sub * 1.1 + snap + metal * 0.18) * 1.5) * 0.9
def drop():
    d = 1.6; return np.tanh(sine_glide(d, 95, 26, 2.2) * env(int(d * SR), 0.003, 0.7) * 1.6) * 0.9
def reverse(d=0.6):
    t = T(d); s = sum(np.sin(2 * np.pi * f * t) for f in (220, 277.2, 329.6, 440)) * 0.15 + lpf(noise(d), 3000) * 0.5
    return s * (t / d) ** 3
def data():
    out = np.zeros(int(0.5 * SR))
    for i, semi in enumerate((0, 3, 7, 10, 12, 15, 19, 24)):
        f = 880 * 2 ** (semi / 12); t = T(0.04)
        s = np.sign(np.sin(2 * np.pi * f * t)) * 0.3 * env(len(t), 0.001, 0.015)
        put(out, s, i * 0.035)
    return out * 0.45
def datarun(d=1.8):
    out = np.zeros(int(d * SR)); tt = 0.0; i = 0
    while tt < d:
        f = 1200 + 900 * hashf(i); t = T(0.02); s = np.sin(2 * np.pi * f * t) * env(len(t), 0.0005, 0.006) * 0.25
        put(out, s, tt); tt += 0.03 + 0.09 * (tt / d) ** 2; i += 1
    return out * 0.7
def hashf(i): x = np.sin(i * 12.9898) * 43758.5453; return x - np.floor(x)
def pass_():
    d = 0.5; t = T(d); u = t / d
    s = sweep(noise(d), 900, 3500, "bp", 1.2) * np.exp(-((u - 0.45) ** 2) / 0.03)
    return s * 0.55
def stone():
    d = 1.2; n = int(d * SR)
    thud = sine_glide(d, 110, 38, 14) * env(n, 0.001, 0.16)
    body = lpf(noise(d), 350) * env(n, 0.001, 0.08) * 1.1
    crumble = np.zeros(n)
    for j in range(26):
        tj = 0.03 + rng.uniform(0, 0.45) * (j / 26) ** 0.7; L = int(0.012 * SR)
        g = hpf(rng.standard_normal(L), 1500) * env(L, 0.0003, 0.004) * rng.uniform(0.1, 0.35) * (1 - tj / 0.6)
        put(crumble, g, tj)
    return np.tanh((thud * 1.2 + body + crumble) * 1.4) * 0.85
def hit():
    d = 1.0; n = int(d * SR); return np.tanh((sine_glide(d, 140, 50, 10) * env(n, 0.001, 0.2) + lpf(noise(d), 1200) * env(n, 0.001, 0.04)) * 1.3) * 0.7
def whip():
    d = 0.32; t = T(d); u = t / d; s = sweep(noise(d), 7000, 600, "bp", 1.4) * np.sin(np.pi * u) ** 2
    return np.stack([s * (1 - u), s * u]) * 1.6
def swoosh(up=0):
    d = 0.5; t = T(d); u = t / d
    s = sweep(noise(d), 400 if up else 3000, 3000 if up else 400, "bp", 1.0) * np.sin(np.pi * u) ** 2
    return s * 0.85
def swipe():
    d = 0.35; t = T(d); u = t / d; return sweep(noise(d), 500, 5000, "bp", 2.0) * np.sin(np.pi * u) ** 1.5 * 0.5
def pop():
    t = T(0.14); f = 500 + 900 * (t / 0.14)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.05) * 0.4
def riser(d=1.5):
    t = T(d); u = t / d
    air = sweep(noise(d), 300, 9000, "bp", 1.2) * u ** 2
    tone = sum(np.sin(2 * np.pi * np.cumsum(f0 * 2 ** (2 * u)) / SR) for f0 in (220, 330)) * 0.12 * u ** 2
    return (air * 0.9 + tone)
def lock():
    d = 2.2; t = T(d)
    ring = sum(np.sin(2 * np.pi * f * t) * g * np.exp(-t * dcy) for f, g, dcy in ((1046.5, 1, 2.5), (1568, .6, 3), (2093, .4, 4), (3136, .2, 6)))
    snap = hpf(noise(d), 3000) * env(len(t), 0.0003, 0.01)
    h = np.zeros(len(t)); hh = hit(); h[: len(hh)] = hh
    return ring * 0.22 + snap * 0.5 + h * 0.6
def flip():
    d = 0.18; s = bpf(noise(d), 3200, 1.0) * (env(int(d * SR), 0.0005, 0.01) + np.roll(env(int(d * SR), 0.0005, 0.012), int(0.05 * SR)) * 0.7)
    return s * 0.6
def stamp():
    d = 0.5; n = int(d * SR)
    return np.tanh((sine_glide(d, 220, 90, 25) * env(n, 0.001, 0.05) + bpf(noise(d), 900, 0.8) * env(n, 0.0005, 0.02)) * 1.6) * 0.8
def zap():
    d = 0.28; t = T(d); f = 300 + 200 * np.sin(2 * np.pi * 37 * t) + rng.uniform(-60, 60)
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * env(len(t), 0.001, 0.08)
    return hpf(s, 400) * 0.18
def ding():
    out = np.zeros(int(1.4 * SR))
    for k, f in enumerate((1318.5, 1760)):
        t = T(1.2); put(out, np.sin(2 * np.pi * f * t) * np.exp(-t * 4) * np.minimum(1, t / 0.003) * 0.18, k * 0.07)
    return out
def sparkle():
    out = np.zeros(int(2.5 * SR))
    for i, semi in enumerate((0, 4, 7, 12, 16, 19, 24, 28)):
        f = 1046.5 * 2 ** (semi / 12); t = T(1.4)
        put(out, np.sin(2 * np.pi * f * t) * np.exp(-t * 3.5) * np.minimum(1, t / 0.002) * 0.12, i * 0.045)
    return out
def chime():
    t = T(3.4); s = np.zeros(len(t))
    for f, g in ((523.25, 1), (659.25, .7), (783.99, .6), (1046.5, .45), (1568, .2)):
        s += np.sin(2 * np.pi * f * t) * g * np.exp(-t * (1.1 + f / 2500))
    return s * np.minimum(1, t / 0.004) * 0.2
def shine():
    d = 1.0; t = T(d); u = t / d
    s = sweep(noise(d), 5000, 11000, "bp", 3.0) * np.sin(np.pi * u) ** 2 * 0.35
    return s + np.sin(2 * np.pi * 2637 * t) * np.exp(-t * 3) * 0.05


def tick():
    d = 0.06; n = int(d * SR)
    return (bpf(noise(d), 3800, 2.0) * env(n, 0.0003, 0.006) * 0.9 + np.sin(2 * np.pi * 2400 * T(d)) * env(n, 0.0004, 0.008) * 0.25) * 0.5
def buzz():
    d = 0.62; t = T(d); gate = ((t < 0.22) | ((t > 0.32) & (t < 0.54))).astype(float)
    gate = lpf(gate, 60)
    s = np.sign(np.sin(2 * np.pi * 148 * t)) * 0.5 + np.sin(2 * np.pi * 296 * t) * 0.3
    return lpf(s, 900) * gate * 0.55
def low():
    d = 1.6; t = T(d); return np.sin(2 * np.pi * 46 * t) * adsr(len(t), 0.05, 1.2) * 0.6

FX = {"heart": heart, "beep": beep, "flat": flat, "drone": drone, "boom": boom, "braam": braam, "glitch": glitch, "key": key,
      "click": click, "zip": zip_, "slam": slam, "drop": drop, "reverse": reverse, "data": data, "datarun": datarun, "pass": pass_,
      "stone": stone, "hit": hit, "whip": whip, "swoosh": swoosh, "swipe": swipe, "pop": pop, "riser": riser, "lock": lock,
      "flip": flip, "stamp": stamp, "zap": zap, "ding": ding, "sparkle": sparkle, "chime": chime, "shine": shine, "tick": tick, "buzz": buzz, "low": low}
GAIN = {"heart": 1.0, "beep": 0.8, "flat": 0.8, "drone": 0.9, "boom": 1.0, "braam": 0.8, "glitch": 0.55, "key": 0.45, "click": 0.6,
        "zip": 0.8, "slam": 1.0, "drop": 0.9, "reverse": 0.7, "data": 0.5, "datarun": 0.5, "pass": 0.5, "stone": 0.85, "hit": 0.8,
        "whip": 0.8, "swoosh": 0.6, "swipe": 0.45, "pop": 0.5, "riser": 0.6, "lock": 0.8, "flip": 0.6, "stamp": 0.8, "zap": 0.45,
        "ding": 0.6, "sparkle": 0.7, "chime": 0.9, "shine": 0.6, "tick": 0.7, "buzz": 0.9, "low": 0.8}
SEND = {"boom": 0.5, "braam": 0.45, "slam": 0.45, "chime": 0.6, "sparkle": 0.6, "ding": 0.5, "lock": 0.5, "stone": 0.3, "heart": 0.15, "beep": 0.35, "flat": 0.3, "hit": 0.35, "drop": 0.2}

for c in spec["cues"]:
    s, t = c["s"], c["t"]
    f = FX.get(s)
    if not f: continue
    if s in ("flat", "drone", "riser", "reverse", "datarun") and "len" in c: sig = f(c["len"])
    elif s == "beep" and "f" in c: sig = f(c["f"])
    elif s == "swoosh": sig = f(c.get("up", 0))
    else: sig = f()
    start = t - (c.get("len", 0.6) if s == "reverse" else 0)
    pan = c.get("pan", {"key": rng.uniform(-0.25, 0.25), "stone": rng.uniform(-0.35, 0.35), "zap": rng.uniform(-0.4, 0.4), "ding": rng.uniform(-0.3, 0.3), "flip": rng.uniform(-0.3, 0.3)}.get(s, 0.0))
    fx(sig, start, GAIN.get(s, 0.7) * c.get("g", 1), pan, SEND.get(s, 0.2))

# ---------- music: a warm lo-fi score ----------
CHORDS = [[-4, 0, 3, 7], [-5, -2, 2, 5], [-7, -4, 0, 3], [3, 7, 10, 14]]   # Fmaj7 Em7 Dm7 Cmaj7 (semitones from A3)
MELODY = [7, 5, 3, 0, 3, 5, 7, 10]
def section(t):
    for m in MUSIC:
        if m["a"] <= t < m["b"]: return m
    return None
def hz(semi, octave=3): return 55.0 * 2 ** (octave - 1) * 2 ** (semi / 12)
def epiano(f, d=1.6, vel=1.0):                     # soft electric piano: sine + bell partial, slow tremolo
    t = T(d); s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 6) + 0.12 * np.sin(2 * np.pi * 7 * f * t) * np.exp(-t * 14)
    s *= np.exp(-t * 1.4) * (1 + 0.12 * np.sin(2 * np.pi * 4.5 * t)) * np.minimum(1, t / 0.004) * np.minimum(1, (d - t) / 0.1)
    return lpf(s, 3000) * 0.13 * vel
def warm_pad(freqs, d, bright=900):
    t = T(d); s = np.zeros(len(t))
    for f in freqs:
        for det in (-0.3, 0.3):
            ph = rng.uniform(0, 6.28); s += np.sin(2 * np.pi * (f + det) * t + ph) * 0.7 + np.sin(2 * np.pi * 2 * (f + det) * t + ph) * 0.15
    return lpf(s, bright) * adsr(len(t), min(0.8, d / 3), min(0.9, d / 3)) * 0.032
def sub(f, d):
    t = T(d); return np.sin(2 * np.pi * f * t) * adsr(len(t), 0.02, 0.2) * 0.3
def kick():
    d = 0.4; n = int(d * SR); return np.tanh(sine_glide(d, 120, 48, 22) * env(n, 0.002, 0.12) * 1.5) * 0.55
def snare():
    d = 0.3; n = int(d * SR); return (bpf(noise(d), 2200, 0.7) * env(n, 0.003, 0.07) * 0.5 + np.sin(2 * np.pi * 190 * T(d)) * env(n, 0.001, 0.03) * 0.2) * 0.55
def hat(open_=False):
    d = 0.2 if open_ else 0.06; n = int(d * SR); return hpf(noise(d), 7000) * env(n, 0.001, 0.05 if open_ else 0.012) * 0.16
def vinyl(d):
    out = lpf(noise(d), 4000) * 0.004
    for i in range(int(d * 6)):
        put(out, hpf(noise(0.004), 2000) * env(int(0.004 * SR), 0.0002, 0.001) * rng.uniform(0.02, 0.08), rng.uniform(0, d))
    return out

nbeats = int(spec["duration"] / BEAT) + 1
SW = BEAT * 0.08                                   # swing on the off-beat 8ths
for b in range(nbeats):
    tb = b * BEAT; m = section(tb + 0.001)
    if m is None: continue
    kind = m["kind"]; bar = b // 4; pos = b % 4
    u = (tb - m["a"]) / max(0.01, m["b"] - m["a"])
    prog = CHORDS[bar % 4]; chord = [hz(s, 3) for s in prog]; root = hz(prog[0], 1)
    first = b == int(np.ceil(m["a"] / BEAT - 1e-6))
    if kind == "intro" and first:
        put(mus, warm_pad([hz(-4, 2), hz(0, 3), hz(7, 3)], m["b"] - m["a"] + 0.6, 600), tb, 1.0); put(musRev, warm_pad([hz(-4, 2), hz(7, 3)], 3.0, 600), tb, 0.7)
    if kind == "tension":
        if first: put(mus, warm_pad([hz(-4, 2), hz(-4, 3), hz(3, 3)], m["b"] - m["a"], 500), tb, 1.1)
        put(mus, sub(hz(-4, 1), BEAT * 0.8), tb, 0.6 + 0.5 * u)
        if u > 0.5: put(mus, kick(), tb, 0.35 + 0.5 * u)
    if kind == "reveal":
        if first: put(mus, warm_pad([hz(s, 3) for s in CHORDS[0]], 2.0, 800), tb + 0.05, 1.0)
        if pos in (0, 2):
            pr = CHORDS[(b // 2) % 4]
            for j, s in enumerate(pr): put(mus, epiano(hz(s, 3), 2.2, 0.7), tb + j * 0.025); put(musRev, epiano(hz(s, 3), 2.2, 0.6), tb + j * 0.025, 0.8)
            put(mus, sub(hz(pr[0], 1), BEAT * 1.8), tb, 0.7)
    if kind in ("groove", "outro"):
        out = kind == "outro"
        if pos == 0 or (pos == 2 and not out): put(mus, kick(), tb, 0.9 if not out else 0.6)
        if pos in (1, 3) and not out: put(mus, snare(), tb, 1.0)
        if not out:
            put(mus, hat(), tb, 1.0); put(mus, hat(pos == 3), tb + BEAT / 2 + SW, 0.8)
        if pos in (0, 2): put(mus, sub(root, BEAT * 1.9), tb, 0.95)
        if pos == 0:
            for j, f in enumerate(chord): put(mus, epiano(f, BEAT * 4, 0.75), tb + j * 0.02); put(musRev, epiano(f, BEAT * 4, 0.6), tb + j * 0.02, 0.7)
            put(mus, warm_pad(chord, BEAT * 4, 900 if not out else 1300), tb, 0.8)
        note = MELODY[b % len(MELODY)]
        if out or pos in (1, 3): put(mus, epiano(hz(note, 4), 1.4, 0.5), tb + BEAT / 2 + SW); put(musRev, epiano(hz(note, 4), 1.4, 0.5), tb + BEAT / 2 + SW, 0.8)
put(mus, vinyl(spec["duration"]), 0, 1.0)

t_all = np.arange(N) / SR
duck = np.ones(N)
for c in spec["cues"]:
    if c["s"] in ("hit", "lock", "low"):
        i = int(c["t"] * SR); n = int(0.4 * SR); seg = duck[i:i + n]
        duck[i:i + n] = np.minimum(seg, 0.5 + 0.5 * np.linspace(0, 1, len(seg)) ** 1.5)
fade_out = np.clip((spec["duration"] + 0.6 - t_all) / 2.8, 0, 1)
mus *= duck * fade_out; musRev *= duck * fade_out

# ---------- reverb (convolution with a synthetic hall) ----------
def ir(seed, rt=2.0):
    r = np.random.default_rng(seed); n = int(rt * SR); t = np.arange(n) / SR
    x = r.standard_normal(n) * np.exp(-t * 6.9 / rt)
    x = lpf(x, 5000); x[: int(0.012 * SR)] = 0
    return x / np.sqrt(np.sum(x ** 2))
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h))))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[: len(x)]
hL, hR = ir(1), ir(2)
wetL = conv(revL + musRev * 0.5, hL) * 0.55; wetR = conv(revR + musRev * 0.5, hR) * 0.55

L = dryL + mus * 0.8 + wetL
R = dryR + mus * 0.8 + wetR
mix = np.stack([L, R], 1)
mix = hpf(mix[:, 0], 28)[:, None] * np.array([1, 0]) + hpf(mix[:, 1], 28)[:, None] * np.array([0, 1])
mix = np.tanh(mix * 1.25) / np.tanh(1.25)
mix /= max(1e-6, np.abs(mix).max()) / 0.9
pcm = (mix * 32767).astype(np.int16)
with wave.open("audio.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", "audio.wav", round(DUR, 1), "s")
