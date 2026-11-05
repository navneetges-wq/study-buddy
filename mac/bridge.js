/* ------------------------------------------------------------------
   bridge.js — runs before Lockin's own scripts inside the Mac app.
   It swaps a few browser features for native macOS ones, so the web
   app works unchanged:
     · "looked away" = Lockin stopped being the app in front (not just a tab)
     · hands-free speech uses macOS speech recognition (on-device when it can)
     · spoken answers use the macOS voice
     · reminders are real macOS notifications
     · copy goes to the Mac clipboard
     · invite links point at the public web app, so friends can open them
-------------------------------------------------------------------*/
(() => {
  const post = (m) => { try { window.webkit.messageHandlers.lockin.postMessage(m); } catch (e) { /* not in the app */ } };
  const define = (obj, key, value) => { try { Object.defineProperty(obj, key, { configurable: true, writable: true, value }); } catch (e) { /* leave it */ } };
  window.LOCKIN_APP = true;
  window.LOCKIN_PUBLIC_URL = 'https://navneetges-wq.github.io/study-buddy/';

  /* ---------- visibility: the app tells us when Lockin is not in front ---------- */
  let hidden = false;
  try {
    Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => hidden });
    Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') });
  } catch (e) { /* keep the browser's own */ }
  // WebKit's own visibility events would double-count, so only ours get through
  document.addEventListener('visibilitychange', (e) => { if (e.isTrusted) e.stopImmediatePropagation(); }, true);
  window.__lockinSetHidden = (h) => { h = !!h; if (h === hidden) return; hidden = h; document.dispatchEvent(new Event('visibilitychange')); };

  /* ---------- speech recognition → macOS ---------- */
  let nextRec = 0;
  const recs = {};
  class NativeRecognition {
    constructor() {
      this.id = ++nextRec; this.lang = navigator.language || 'en-US';
      this.continuous = false; this.interimResults = false; this.maxAlternatives = 1;
      this.onresult = this.onerror = this.onend = this.onstart = null;
      recs[this.id] = this;
    }
    start() { recs[this.id] = this; post({ cmd: 'listen', id: this.id, lang: this.lang, continuous: !!this.continuous, interim: !!this.interimResults }); }
    stop() { post({ cmd: 'unlisten', id: this.id }); }
    abort() { this.stop(); }
    addEventListener(type, fn) { this['on' + type] = fn; }
  }
  window.__lockinSpeech = ({ id, type, data }) => {
    const r = recs[id];
    if (!r) return;
    if (type === 'start') r.onstart && r.onstart({});
    else if (type === 'result') {
      const alts = data.alts.map((t) => ({ transcript: t, confidence: 0.9 }));
      const res = Object.assign(alts, { isFinal: !!data.final, item: (i) => alts[i] });
      const results = Object.assign([res], { item: (i) => (i === 0 ? res : undefined) });
      r.onresult && r.onresult({ resultIndex: 0, results });
    } else if (type === 'error') r.onerror && r.onerror({ error: data });
    else if (type === 'end') { delete recs[id]; r.onend && r.onend({}); }
  };
  define(window, 'SpeechRecognition', NativeRecognition);
  define(window, 'webkitSpeechRecognition', NativeRecognition);

  /* ---------- speaking → the macOS voice ---------- */
  let nextUtt = 0;
  const utts = {};
  class Utterance {
    constructor(text) { this.text = text || ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.lang = ''; this.onend = this.onerror = this.onstart = null; }
  }
  const synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    speak(u) {
      const id = ++nextUtt; utts[id] = u;
      if ((window.__lockinQuiet || 0) > Date.now()) { setTimeout(() => window.__lockinTTS({ id, type: 'end' }), 0); return; }   // menu-bar commands stay silent
      synth.speaking = true;
      post({ cmd: 'say', id, text: String(u.text), rate: +u.rate || 1 });
    },
    cancel() { post({ cmd: 'hush' }); },
    pause() {}, resume() {}, getVoices() { return []; }, addEventListener() {}, removeEventListener() {},
  };
  window.__lockinTTS = ({ id, type }) => {
    const u = utts[id];
    if (!u) return;
    if (type === 'end') { delete utts[id]; synth.speaking = Object.keys(utts).length > 0; u.onend && u.onend({}); }
  };
  define(window, 'speechSynthesis', synth);
  define(window, 'SpeechSynthesisUtterance', Utterance);

  /* ---------- reminders → macOS notifications ---------- */
  let perm = 'default';
  class NativeNotification {
    constructor(title, opts) { post({ cmd: 'notify', title: String(title || 'Lockin'), body: String((opts && opts.body) || '') }); }
    close() {}
    static get permission() { return perm; }
    static requestPermission() {
      return new Promise((res) => { window.__lockinPerm = (p) => { perm = p; res(p); }; post({ cmd: 'notifyPermission' }); });
    }
  }
  window.__lockinSetPerm = (p) => { perm = p; };
  define(window, 'Notification', NativeNotification);

  /* ---------- copy → the Mac clipboard ---------- */
  try {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: (t) => { post({ cmd: 'copy', text: String(t) }); return Promise.resolve(); },
      readText: () => Promise.resolve(''),
    } });
  } catch (e) { /* keep the browser's own */ }

  /* ---------- the menu bar runs commands through the app's own command grammar ---------- */
  window.__lockinCommand = (text) => {
    window.__lockinQuiet = Date.now() + 1500;
    try { VoiceControl.simulate(text); } catch (e) { /* app not ready */ }
  };

  /* ---------- tell the menu bar what the timer says, once a second ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);
    setInterval(() => {
      const pause = $('btn-pause');
      post({ cmd: 'status', time: ($('dial-time') || {}).textContent || '', state: ($('focus-state') || {}).textContent || '',
        running: !!(pause && !pause.hidden), paused: !!(pause && !pause.hidden && /resume/i.test(pause.textContent)) });
    }, 1000);
  });
})();
