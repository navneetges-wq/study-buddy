/* ------------------------------------------------------------------
   ambience.js — focus sounds, generated live with the Web Audio API
   (nothing to download, nothing to buffer, never the same twice).
-------------------------------------------------------------------*/
const Ambience = (function () {
  let ctx = null, master = null, bus = null;
  let sources = [], timers = [], playing = null, volume = 0.5;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume * 0.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function noiseBuffer(kind) {
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (kind === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function noise(kind, destination, gain) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(kind);
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(destination);
    src.start();
    sources.push(src);
    return g;
  }

  const filter = (type, freq, q) => {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (q) f.Q.value = q;
    return f;
  };

  function every(minMs, maxMs, fn) {
    const tick = () => {
      fn();
      timers.push(setTimeout(tick, minMs + Math.random() * (maxMs - minMs)));
    };
    timers.push(setTimeout(tick, minMs + Math.random() * (maxMs - minMs)));
  }

  /** short decaying tone — used for drips, clinks, chirps */
  function ping(freq, dur, gain, type = 'sine', dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(dest || bus);
    o.start(); o.stop(ctx.currentTime + dur + 0.05);
  }

  const builders = {
    rain() {
      const lp = filter('lowpass', 5200), hp = filter('highpass', 380);
      lp.connect(hp).connect(bus);
      const g = noise('white', lp, 0.42);
      // a slow breath in the downpour so it never sounds like flat static
      const swell = ctx.createOscillator(), sg = ctx.createGain();
      swell.frequency.value = 0.07; sg.gain.value = 0.09;
      swell.connect(sg).connect(g.gain);
      swell.start(); sources.push(swell);
      every(220, 1400, () => ping(900 + Math.random() * 1600, 0.12, 0.05, 'sine'));
    },
    waves() {
      const lp = filter('lowpass', 700);
      lp.connect(bus);
      const g = noise('white', lp, 0.0);
      // slow swell in and out, like a tide
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 0.085; lg.gain.value = 0.3;
      g.gain.value = 0.34;
      lfo.connect(lg).connect(g.gain);
      lfo.start(); sources.push(lfo);
    },
    cafe() {
      const lp = filter('lowpass', 900);
      lp.connect(bus);
      noise('brown', lp, 0.5);
      every(500, 2600, () => {            // murmur
        const b = filter('bandpass', 300 + Math.random() * 900, 3);
        b.connect(bus);
        const g = noise('white', b, 0.0);
        const now = ctx.currentTime;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.09, now + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      });
      every(4000, 13000, () => ping(1500 + Math.random() * 900, 0.35, 0.045, 'triangle')); // cup clink
    },
    night() {
      const lp = filter('lowpass', 320);
      lp.connect(bus);
      noise('brown', lp, 0.4);
      every(600, 2200, () => {            // crickets
        const base = 3800 + Math.random() * 900;
        for (let i = 0; i < 3; i++) {
          timers.push(setTimeout(() => ping(base, 0.05, 0.035, 'square'), i * 90));
        }
      });
    },
    lofi() {
      const lp = filter('lowpass', 1100);
      lp.connect(bus);
      // vinyl crackle
      const hp = filter('highpass', 2000);
      hp.connect(bus);
      noise('white', hp, 0.022);
      // slow chord loop (Am7 – Fmaj7 – Cmaj7 – G)
      const chords = [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6],
                      [196, 261.6, 329.6, 392], [196, 246.9, 293.7, 392]];
      let i = 0;
      const playChord = () => {
        const notes = chords[i++ % chords.length];
        notes.forEach((f, n) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = f * (n === 0 ? 0.5 : 1);
          o.detune.value = (Math.random() * 8) - 4;
          const t = ctx.currentTime;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.045, t + 0.9);
          g.gain.linearRampToValueAtTime(0.03, t + 2.6);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
          o.connect(g).connect(lp);
          o.start(); o.stop(t + 4.4);
        });
      };
      playChord();
      const id = setInterval(playChord, 4000);
      timers.push({ interval: id });
    },
    white() { const lp = filter('lowpass', 9000); lp.connect(bus); noise('white', lp, 0.33); },
    brown() { const lp = filter('lowpass', 1400); lp.connect(bus); noise('brown', lp, 0.55); }
  };

  function stop() {
    timers.forEach(t => (t && t.interval) ? clearInterval(t.interval) : clearTimeout(t));
    timers = [];
    sources.forEach(s => { try { s.stop(); } catch (e) {} });
    sources = [];
    if (bus) { try { bus.disconnect(); } catch (e) {} bus = null; }
    playing = null;
  }

  function play(name) {
    if (!ensure()) return false;
    stop();
    if (!builders[name]) return false;
    bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(master);
    builders[name]();
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2); // fade in
    playing = name;
    return true;
  }

  function setVolume(v) {
    volume = v;
    if (master) master.gain.setTargetAtTime(v * 0.6, ctx.currentTime, 0.1);
  }

  /** A gentle three-note chime when a session or break ends. */
  function chime(up = true) {
    if (!ensure()) return;
    const notes = up ? [523.25, 659.25, 783.99] : [783.99, 659.25, 523.25];
    notes.forEach((f, i) => setTimeout(() => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g).connect(master);
      o.start(); o.stop(t + 1.2);
    }, i * 160));
  }

  return { play, stop, setVolume, chime, get playing() { return playing; },
           get supported() { return !!(window.AudioContext || window.webkitAudioContext); } };
})();
