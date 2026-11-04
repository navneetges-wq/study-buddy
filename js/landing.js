/* ------------------------------------------------------------------
   landing.js — the Lockin landing page.
   The hero runs a real session on this page and counts the visitor's
   own tab leaves. "What you get" shows the visitor's real numbers when
   this browser already has Lockin sessions. Everything else is scroll
   motion: progress line, word-by-word headlines, cards tilting into
   place, a ticker, a pinned "how it works" and a growing final CTA.
-------------------------------------------------------------------*/
(() => {
const $ = (id) => document.getElementById(id);
const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const msShort = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`; };

/* ======================= hero: a live session on this page ======================= */
const PLANNED = 25 * 60 * 1000, RING = 326.7;
const live = { focused: 0, away: 0, tabs: 0, last: Date.now(), leftAt: 0 };
const pageTitle = document.title;

function paintLive() {
  $('lp-time').textContent = mmss(PLANNED - live.focused);
  $('lp-focus').textContent = msShort(live.focused);
  $('lp-away').textContent = msShort(live.away);
  $('lp-alive-t').textContent = msShort(live.focused);
  $('lp-fill').style.strokeDashoffset = String(RING * Math.min(1, live.focused / PLANNED));
}
function tick() {
  const now = Date.now(), dt = now - live.last;
  live.last = now;
  if (document.hidden) { if (live.leftAt) live.away += dt; } else   // opened in a background tab isn't "looking away" live.focused = Math.min(PLANNED, live.focused + dt);
  if (!document.hidden) paintLive();
}
setInterval(tick, 250);
paintLive();

document.addEventListener('visibilitychange', () => {
  tick();
  const state = $('lp-state');
  if (document.hidden) {
    live.tabs++;
    live.leftAt = Date.now();
    document.title = '● Lockin is counting… come back';
    state.classList.add('away'); state.lastChild.textContent = 'Away';
    return;
  }
  document.title = pageTitle;
  state.classList.remove('away'); state.lastChild.textContent = 'Focusing';
  const gone = Date.now() - live.leftAt;
  const tabs = $('lp-tabs');
  tabs.textContent = live.tabs;
  tabs.classList.remove('bump'); void tabs.offsetWidth; tabs.classList.add('bump');
  $('lp-dead-t').textContent = `Gone for ${mmss(gone)}`;
  $('lp-dead-p').textContent = `Logged. That's ${live.tabs} tab leave${live.tabs === 1 ? '' : 's'}.`;
  const dead = $('lp-dead');
  dead.classList.remove('flash'); void dead.offsetWidth; dead.classList.add('flash');
  $('lp-try').innerHTML = `<b>Caught you.</b> Lockin notices every one — imagine a whole session.`;
  const main = $('lp-main');
  main.classList.add('caught');
  setTimeout(() => main.classList.remove('caught'), 1800);
  paintLive();
});

/* ======================= the visitor's own numbers, if any ======================= */
const PULL = { tab: 'Tab leaves', phone: 'Phone', daydream: 'Daydreams', people: 'People', tired: 'Tired', hungry: 'Hungry', other: 'Other' };
let mine = null;
try {
  const s = JSON.parse(localStorage.getItem('lockin.v1') || 'null');
  if (s && Array.isArray(s.sessions) && s.sessions.length) mine = s;
} catch (e) { /* private mode or nothing saved */ }

if (mine) {
  const list = mine.sessions;
  const focused = list.reduce((a, x) => a + (x.focusedMs || 0), 0);
  const hrs = focused >= 3600000 ? `${(focused / 3600000).toFixed(1)} h` : `${Math.round(focused / 60000)} min`;
  $('l-proof').textContent = `Welcome back · ${list.length} session${list.length === 1 ? '' : 's'}, ${hrs} focused`;
  $('hero-cta').textContent = 'Back to focusing →';

  const scored = list.filter((x) => typeof x.score === 'number');
  if (scored.length) {
    const avg = Math.round(scored.reduce((a, x) => a + x.score, 0) / scored.length);
    $('v-score-n').dataset.n = avg;
    $('v-score-ring').dataset.k = (avg / 100).toFixed(2);
    $('v-score-c').textContent = `your average · ${scored.length} session${scored.length === 1 ? '' : 's'}`;
  }
  const counts = {};
  list.forEach((x) => (x.distractions || []).forEach((dd) => { counts[dd.type] = (counts[dd.type] || 0) + 1; }));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) {
    $('v-pull-n').textContent = PULL[top[0][0]] || 'Other';
    $('v-pull-c').textContent = `your #1 pull · ${top[0][1]} time${top[0][1] === 1 ? '' : 's'}`;
    $('v-pull-bars').innerHTML = top.map(([, n]) => `<span><em data-w="${Math.round((100 * n) / top[0][1])}"></em></span>`).join('');
  }
  $('get-pill').textContent = 'What you get · yours';
  const note = $('get-note');
  note.textContent = 'Score and #1 pull are your real numbers, read from this browser. Nothing was sent anywhere.';
  note.classList.add('yours');
}

/* ======================= ticker: things you can say ======================= */
const SAY = [
  ['Lockin, start 45 minutes', 'starts a session'],
  ['Lockin, I got distracted by my phone', 'logs it'],
  ['Lockin, how am I doing', 'reads your numbers aloud'],
  ['Lockin, add five minutes', 'extends it'],
  ['Lockin, play rain', 'focus sound on'],
  ['Lockin, I have 35 minutes', 'shapes the time'],
  ['Lockin, plan 40 minutes at 8pm', 'schedules it'],
  ['Lockin, how long left', 'tells you'],
  ['Lockin, take a five minute break', 'starts a break'],
  ['Lockin, nudge', 'pokes your study partner'],
];
const track = $('l-ticker');
const items = SAY.map(([say, does]) => `<span><i></i><b>“${esc(say)}”</b><em>${esc(does)}</em></span>`).join('');
track.innerHTML = items + items;   // twice, so it loops seamlessly

/* ======================= scroll reveals ======================= */
function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
          else { const w = document.createElement('span'); w.className = 'w'; w.style.setProperty('--i', i++); w.textContent = part; frag.appendChild(w); }
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el); el.classList.add('split');
}
// children of a grid tilt up one after another; classes come off afterwards so hover still works
function revealChildren(box) {
  const kids = [...box.children];
  kids.forEach((k, i) => { k.classList.add('st'); k.style.setProperty('--i', i); });
  requestAnimationFrame(() => requestAnimationFrame(() => kids.forEach((k) => k.classList.add('st-in'))));
  setTimeout(() => kids.forEach((k) => k.classList.remove('st', 'st-in')), 1000 + kids.length * 90);
}
function countUp(el) {
  const n = +el.dataset.n, t0 = performance.now();
  const step = (now) => { const k = clamp01((now - t0) / 1300); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function playViz() {
  document.querySelectorAll('.l-viz').forEach((v) => v.classList.add('on'));
  document.querySelectorAll('.l-viz [data-w]').forEach((e) => (e.style.width = e.dataset.w + '%'));
  document.querySelectorAll('.l-viz [data-h]').forEach((e) => (e.style.height = e.dataset.h + '%'));
  const ring = $('v-score-ring');
  ring.style.strokeDashoffset = String(213.6 * (1 - +ring.dataset.k));
  const n = $('v-score-n');
  if (STILL) n.textContent = n.dataset.n; else countUp(n);
}

const gets = document.querySelector('.l-gets');
if (!STILL && 'IntersectionObserver' in window) {
  const sections = document.querySelectorAll('.shell > section:not(.l-hero), .l-pin, .footer');
  const rise = new IntersectionObserver((list) => list.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); rise.unobserve(x.target); } }), { threshold: 0.08 });
  sections.forEach((s) => { s.classList.add('l-rise'); rise.observe(s); });

  const heads = [...document.querySelectorAll('.l-hero h1, .h-section, .l-final h2')];
  heads.forEach(splitWords);
  const grids = [...document.querySelectorAll('.features, .l-gets, .l-feats, .l-who, .l-rules, .l-faq')];
  grids.forEach((g) => [...g.children].forEach((k) => k.classList.add('st')));
  const seen = new IntersectionObserver((list) => list.forEach((x) => {
    if (!x.isIntersecting) return;
    const el = x.target; seen.unobserve(el);
    if (el.classList.contains('split')) el.classList.add('in');
    else { revealChildren(el); if (el === gets) setTimeout(playViz, 450); }
  }), { threshold: 0.18 });
  heads.concat(grids).forEach((el) => seen.observe(el));
} else {
  document.querySelectorAll('mark.l-mark').forEach((m) => m.classList.add('in'));
  playViz();
}

/* ======================= one light scroll loop ======================= */
const bar = document.querySelector('.l-progress span');
const pin = $('how-pin'), steps = [...document.querySelectorAll('.l-steps li')], fill = $('l-steps-fill');
const panes = [...document.querySelectorAll('.l-pane')], miniRing = $('l-mini-ring');
const finalSec = document.querySelector('.l-final'), finalTitle = $('l-final-title');
let stepIdx = -1, lastFinal = -1;

function setStep(idx) {
  if (idx === stepIdx) return;
  stepIdx = idx;
  steps.forEach((s, i) => { s.classList.toggle('on', i <= idx); s.classList.toggle('now', i === idx); });
  panes.forEach((pn, i) => pn.classList.toggle('on', i === idx));
  miniRing.style.strokeDashoffset = idx === 3 ? String(314.2 * (1 - 0.82)) : '314.2';
  fill.style.width = `${((idx + 1) / steps.length) * 100}%`;
}
function onScroll() {
  const y = scrollY, max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  bar.style.transform = `scaleX(${(y / max).toFixed(4)})`;
  if (STILL) return;
  if (innerWidth > 760) {
    const r = pin.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) {
      const k = clamp01(-r.top / Math.max(1, r.height - innerHeight + 92));
      setStep(Math.min(steps.length - 1, Math.floor(k * steps.length * 1.05)));
    }
  }
  const r = finalSec.getBoundingClientRect();
  if (r.top < innerHeight && r.bottom > 0) {
    const k = Math.round(clamp01((innerHeight - r.top) / (innerHeight * 0.75)) * 50) / 50;
    if (k !== lastFinal) { lastFinal = k; finalTitle.style.transform = `scale(${(0.9 + 0.1 * k).toFixed(3)})`; finalTitle.style.opacity = (0.45 + 0.55 * k).toFixed(3); }
  }
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();
if (STILL || innerWidth <= 760) { steps.forEach((s) => s.classList.add('on')); }
if (STILL) setStep(3);

/* the ticker: always drifting while visible; faster (and following your direction) while you scroll */
let tickerX = 0, tickerDir = -1, lastY = -1, lastT = performance.now(), vel = 0, tickerOnScreen = true;
const tickerEl = document.querySelector('.l-ticker');
if ('IntersectionObserver' in window) new IntersectionObserver((e) => (tickerOnScreen = e[0].isIntersecting)).observe(tickerEl);
function tickerLoop(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const y = scrollY;
  if (lastY >= 0) { const v = (y - lastY) / Math.max(dt, 0.001); vel += (v - vel) * 0.25; }
  lastY = y;
  if (tickerOnScreen && !STILL && !document.body.classList.contains('film-on')) {
    if (Math.abs(vel) > 30) tickerDir = vel > 0 ? -1 : 1;
    tickerX += tickerDir * (40 + Math.min(700, Math.abs(vel) * 0.5)) * dt;
    const half = track.scrollWidth / 2;
    if (tickerX <= -half) tickerX += half;
    if (tickerX > 0) tickerX -= half;
    track.style.transform = `translate3d(${tickerX.toFixed(1)}px, 0, 0)`;
  }
  requestAnimationFrame(tickerLoop);
}
requestAnimationFrame(tickerLoop);

/* ======================= the 22-second film ======================= */
const film = $('l-film'), play = $('l-film-play'), filmBox = $('film');
play.addEventListener('click', () => {
  if (!film.getAttribute('src')) film.src = film.dataset.src;
  filmBox.classList.add('playing'); film.controls = true; film.muted = false;
  const p = film.play(); if (p && p.catch) p.catch(() => { filmBox.classList.remove('playing'); film.controls = false; });
});
film.addEventListener('ended', () => { filmBox.classList.remove('playing'); film.controls = false; film.load(); });
film.addEventListener('playing', () => document.body.classList.add('film-on'));
['pause', 'ended', 'emptied'].forEach((ev) => film.addEventListener(ev, () => document.body.classList.remove('film-on')));
if ('IntersectionObserver' in window) new IntersectionObserver((e) => { if (!e[0].isIntersecting && !film.paused) film.pause(); }, { threshold: 0.15 }).observe(film);
})();
