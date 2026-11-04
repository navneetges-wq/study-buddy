/* ------------------------------------------------------------------
   landing.js — "your hour, honestly".
   The whole page is a session: the nav HUD and the "try it" scene count
   the visitor's real time here and every time they leave the tab.
   Scenes: the hero's strike-through, an hour scrubbed by scroll, a focus
   lens over a field of notifications, live voice commands, a duel race,
   a printed autopsy (the visitor's own last session when there is one),
   the film, a ring that locks shut, and a final ring that closes.
-------------------------------------------------------------------*/
(() => {
const $ = (id) => document.getElementById(id);
const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOUCH = matchMedia('(pointer: coarse)').matches;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const SVGNS = 'http://www.w3.org/2000/svg';
const inView = (el, cb, threshold = 0.3) => {
  if (!('IntersectionObserver' in window)) return cb();
  const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { io.disconnect(); cb(); } }, { threshold });
  io.observe(el);
};
// progress of a tall section through the viewport: 0 when its top reaches the top, 1 when its bottom reaches the bottom
const through = (el) => { const r = el.getBoundingClientRect(); return clamp01(-r.top / Math.max(1, r.height - innerHeight)); };

/* ======================= the page is a session ======================= */
const S = { here: 0, away: 0, tabs: 0, longest: 0, last: Date.now(), leftAt: 0 };
const pageTitle = document.title;
function paintSession() {
  $('hud-time').textContent = mmss(S.here);
  $('try-focus').textContent = mmss(S.here);
  $('try-away').textContent = mmss(S.away);
  $('try-ring').style.strokeDashoffset = String(854.5 * (1 - ((S.here / 1000) % 60) / 60));
}
setInterval(() => {
  const now = Date.now(), dt = now - S.last; S.last = now;
  if (document.hidden) { if (S.leftAt) S.away += dt; } else { S.here += dt; paintSession(); }
}, 250);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { S.tabs++; S.leftAt = Date.now(); document.title = '● Lockin is counting… come back'; return; }
  document.title = pageTitle;
  const gone = Date.now() - S.leftAt;
  S.longest = Math.max(S.longest, gone);
  $('hud-tabs').textContent = S.tabs;
  const n = $('try-n'); n.textContent = S.tabs; n.classList.remove('bump'); void n.offsetWidth; n.classList.add('bump');
  $('try-long').textContent = mmss(S.longest);
  $('try-line').innerHTML = `<b>Gone for ${mmss(gone)}.</b> ${S.tabs === 1 ? 'Lockin would have logged that.' : `That's ${S.tabs}. Imagine a whole session.`}`;
  const hud = $('hud'); hud.classList.remove('caught'); void hud.offsetWidth; hud.classList.add('caught');
  paintSession();
});

/* ======================= the hour: five drifts, 29 minutes lost ======================= */
const DRIFT = [
  { s: 8, len: 4, label: 'Phone' }, { s: 17, len: 9, label: 'One quick tab' }, { s: 31, len: 3, label: 'Daydream' },
  { s: 40, len: 6, label: 'Phone again' }, { s: 49, len: 7, label: 'Group chat' },
];
const isDrift = (m) => DRIFT.find((d) => m >= d.s && m < d.s + d.len);
const focusedBy = (m) => m - DRIFT.reduce((a, d) => a + Math.max(0, Math.min(m - d.s, d.len)), 0);
// ring segments for minutes 0→m as SVG circles (stroke-dash arcs), focus indigo and drift red
function segs(g, cx, cy, r, m) {
  const L = 2 * Math.PI * r, edges = [0, ...DRIFT.flatMap((d) => [d.s, d.s + d.len]), 60].filter((x) => x < m).concat([m]);
  let html = '';
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i], b = edges[i + 1]; if (b - a <= 0.001) continue;
    const red = !!isDrift((a + b) / 2);
    html += `<circle class="seg ${red ? 'd' : 'f'}" cx="${cx}" cy="${cy}" r="${r}" transform="rotate(-90 ${cx} ${cy})" stroke-dasharray="${((b - a) / 60 * L).toFixed(2)} ${L.toFixed(2)}" stroke-dashoffset="${(-a / 60 * L).toFixed(2)}"/>`;
  }
  g.innerHTML = html;
}

/* ---------- hero: the strike-through, and the hour drawn around it ---------- */
const hero = $('hero'), swap = $('swap');
(() => {
  const g = $('hero-arcs'), r = 270, L = 2 * Math.PI * r;
  const edges = [0, ...DRIFT.flatMap((d) => [d.s, d.s + d.len]), 60];
  let html = '';
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i], b = edges[i + 1], red = !!isDrift((a + b) / 2), len = (b - a) / 60 * L;
    html += `<circle class="seg ${red ? 'd' : 'f'}" cx="300" cy="300" r="${r}" stroke-dasharray="${STILL ? len.toFixed(1) : 0} ${L.toFixed(1)}" stroke-dashoffset="${(-a / 60 * L).toFixed(1)}" data-d="${len.toFixed(1)} ${L.toFixed(1)}" style="transition-delay:${(0.4 + a / 60 * 1.6).toFixed(2)}s"/>`;
  }
  g.innerHTML = html;
  // each piece grows from nothing to its length, one after another round the hour
  requestAnimationFrame(() => requestAnimationFrame(() => {
    hero.classList.add('ready');
    g.querySelectorAll('.seg').forEach((c) => (c.style.strokeDasharray = c.dataset.d));
    if (STILL) { swap.classList.add('struck', 'swapped'); return; }
    setTimeout(() => swap.classList.add('struck'), 1500);
    setTimeout(() => swap.classList.add('swapped'), 2200);
  }));
})();

/* ---------- the hour, scrubbed by scroll ---------- */
const hourSec = $('hour'), hourDial = document.querySelector('.hour-dial');
(() => {
  let t = '';
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2, big = i % 5 === 0, r1 = 262, r2 = r1 + (big ? 14 : 7);
    t += `<line x1="${(300 + Math.cos(a) * r1).toFixed(1)}" y1="${(300 + Math.sin(a) * r1).toFixed(1)}" x2="${(300 + Math.cos(a) * r2).toFixed(1)}" y2="${(300 + Math.sin(a) * r2).toFixed(1)}" stroke="#fff" stroke-opacity="${big ? 0.25 : 0.1}" stroke-width="${big ? 3 : 2}" stroke-linecap="round"/>`;
  }
  $('hour-ticks').innerHTML = t;
  $('ledger').innerHTML = DRIFT.map((d) => `<li><time>${String(d.s).padStart(2, '0')}:00</time><b>✕ ${d.label}</b><em>−${d.len} min</em></li>`).join('');
})();
const ledger = [...$('ledger').children];
let lastM = -1;
function paintHour(m) {
  if (Math.abs(m - lastM) < 0.02) return; lastM = m;
  segs($('hour-arcs'), 300, 300, 240, m);
  const a = (m / 60) * Math.PI * 2 - Math.PI / 2, head = $('hour-head');
  head.setAttribute('cx', (300 + Math.cos(a) * 240).toFixed(1)); head.setAttribute('cy', (300 + Math.sin(a) * 240).toFixed(1));
  $('hour-clock').textContent = mmss((60 - m) * 60000);
  const d = m > 0 && m < 60 ? isDrift(m) : null;
  hourDial.classList.toggle('away', !!d);
  $('hour-state').textContent = m <= 0 ? 'scroll to start' : m >= 60 ? 'the hour is up' : d ? `● ${d.label}` : 'focused';
  $('hour-focus').textContent = Math.floor(focusedBy(m));
  ledger.forEach((li, i) => li.classList.toggle('on', m >= DRIFT[i].s));
}

/* ---------- the focus lens ---------- */
const lensSec = $('lens'), stage = $('lens-stage');
(() => {
  const PINGS = [
    ['Group chat', '14 new messages', '#3fae86', '#'], ['Calendar', 'Meeting in 10 minutes', '#e0a04f', '▦'], ['Delivery', 'Your order is on the way', '#e07b7b', '◆'],
    ['Video', 'New upload you might like', '#d0555a', '▶'], ['Email', 'You have 6 unread', '#5d8ee8', '@'], ['Game', 'Your energy is full!', '#9b6cf0', '★'],
    ['News', 'Breaking: you won’t believe…', '#c9c9c9', 'N'], ['Photos', 'Someone liked your post', '#e56fa0', '♥'], ['Sale', '50% off ends tonight', '#e0b563', '%'],
    ['Messages', 'Mom: call me when free', '#3fae86', '✉'], ['Reminder', 'Reply to Sam', '#7c8cff', '!'], ['Music', 'Your weekly mix is ready', '#5ec9a0', '♪'],
    ['Group chat', 'Sam: did you see this?', '#3fae86', '#'], ['Shopping', 'Back in stock', '#e07b7b', '◆'], ['Stream', 'Live now', '#d0555a', '●'], ['Email', 'Re: re: re: notes', '#5d8ee8', '@'],
  ];
  const spots = [[6, 12], [62, 8], [80, 22], [18, 30], [72, 40], [4, 52], [40, 18], [84, 60], [22, 70], [58, 74], [10, 86], [70, 88], [44, 86], [88, 8], [30, 50], [64, 56]];
  $('noise').innerHTML = PINGS.map(([t, s, c, ic], i) => {
    const [x, y] = spots[i];
    return `<div class="ping" style="left:${x}%;top:${y}%;--d:${7 + (i % 5) * 1.7}s;--dl:-${(i * 1.3) % 6}s;--mx2:${(i % 2 ? -1 : 1) * (10 + (i % 4) * 6)}px;--my2:${(i % 3 ? -1 : 1) * (12 + (i % 5) * 4)}px;--rt:${(i % 2 ? -1 : 1) * 1.5}deg"><i style="background:${c}">${ic}</i><div><b>${t}</b><span>${s}</span></div></div>`;
  }).join('');
  let px = 0.5, py = 0.5, hasPointer = false;
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = stage.getBoundingClientRect(); px = (e.clientX - r.left) / r.width; py = (e.clientY - r.top) / r.height; hasPointer = true;
    stage.style.setProperty('--x', `${(px * 100).toFixed(2)}%`); stage.style.setProperty('--y', `${(py * 100).toFixed(2)}%`);
  }, { passive: true });
  if (TOUCH) $('lens-eyebrow').textContent = 'Keep scrolling';
})();
let lastR = -1;
function paintLens(k) {
  // the lens starts small, then grows until focus fills the screen
  const full = Math.hypot(innerWidth, innerHeight);
  const grow = ease(clamp01((k - 0.45) / 0.45));
  const base = TOUCH ? Math.min(innerWidth * 0.42, 170) : 160;
  const r = Math.round(base + (full - base) * grow);
  if (r === lastR) return; lastR = r;
  stage.style.setProperty('--r', `${r}px`);
  stage.style.setProperty('--ro', (1 - grow).toFixed(3));
  if (grow > 0.02) { stage.style.setProperty('--x', `${50}%`); stage.style.setProperty('--y', `${50}%`); }
  $('lens-eyebrow').textContent = grow > 0.6 ? 'Focus is a spotlight. Lockin keeps it on.' : TOUCH ? 'Keep scrolling' : 'Move your cursor';
}

/* ---------- say it ---------- */
(() => {
  const LINES = [
    ['“Lockin, start 45 minutes.”', '→ Starting 45 minutes. Go.'],
    ['“I got distracted by my phone.”', '→ Logged: phone, at 14 minutes.'],
    ['“How am I doing?”', '→ 22 minutes focused, one tab leave.'],
    ['“Add five minutes.”', '→ Done. 9 minutes left.'],
    ['“Play rain.”', '→ Rain is on.'],
  ];
  const text = $('say-text'), reply = $('say-reply'), wave = $('wave');
  wave.innerHTML = Array.from({ length: 34 }, () => '<i></i>').join('');
  const bars = [...wave.children];
  let talking = false, on = false;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function loop() {
    for (let i = 0; ; i = (i + 1) % LINES.length) {
      const [say, ans] = LINES[i];
      talking = true;
      for (let c = 1; c <= say.length; c++) { text.textContent = say.slice(0, c); await sleep(38); }
      talking = false;
      await sleep(350); reply.textContent = ans; reply.classList.add('on');
      await sleep(1900); reply.classList.remove('on');
      for (let c = say.length; c >= 0; c -= 2) { text.textContent = say.slice(0, c); await sleep(12); }
      await sleep(300);
    }
  }
  function waveLoop(t) {
    bars.forEach((b, j) => {
      const h = talking ? 14 + 86 * Math.abs(Math.sin(j * 0.7 + t / 90)) * (0.35 + 0.65 * Math.abs(Math.sin(j * 1.9 + t / 230))) : 8 + 6 * Math.abs(Math.sin(j * 0.5 + t / 600));
      b.style.height = `${h.toFixed(0)}px`;
    });
    if (on) requestAnimationFrame(waveLoop);
  }
  if (STILL) { text.textContent = LINES[0][0]; reply.textContent = LINES[0][1]; reply.classList.add('on'); return; }
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { const was = on; on = e[0].isIntersecting; if (on && !was) requestAnimationFrame(waveLoop); }).observe($('say'));
  inView($('say'), loop, 0.4);
})();

/* ---------- duel race ---------- */
inView($('duel-rings'), () => {
  const you = $('dr-you'), sam = $('dr-sam'), yn = $('dr-you-n'), sn = $('dr-sam-n'), box = $('dr-sam-box'), L = 540.4, T = 2600, t0 = performance.now();
  const step = (now) => {
    const k = STILL ? 1 : clamp01((now - t0) / T);
    const yk = ease(k), sk = k < 0.42 ? ease(k) * 0.95 : k < 0.62 ? ease(0.42) * 0.95 : 0.95 * ease(0.42) + (1 - 0.95 * ease(0.42)) * ease((k - 0.62) / 0.38);
    you.style.strokeDashoffset = String(L * (1 - 0.82 * yk)); yn.textContent = Math.round(82 * yk);
    sam.style.strokeDashoffset = String(L * (1 - 0.74 * sk)); sn.textContent = Math.round(74 * sk);
    box.classList.toggle('left', k >= 0.42 && k < 0.66);
    if (k < 1) requestAnimationFrame(step); else $('duel-result').classList.add('on');
  };
  requestAnimationFrame(step);
}, 0.5);

/* ---------- the autopsy receipt: your own last session when there is one ---------- */
(() => {
  const LABEL = { phone: 'Phone', daydream: 'Daydream', people: 'People', tired: 'Tired', hungry: 'Hungry', other: 'Other' };
  let lines = [['Planned', '45:00'], ['Focused', '38:12'], ['Away', '6:48', 1], ['Tab leaves', '3', 1], 'gap', ['Phone', '×2', 1], ['Daydream', '×1', 1], ['First drift', '11:04'], ['Mood', 'Good']];
  let score = 82;
  try {
    const s = JSON.parse(localStorage.getItem('lockin.v1') || 'null');
    const last = s && Array.isArray(s.sessions) && s.sessions[s.sessions.length - 1];
    if (last && last.plannedMs) {
      const by = {};
      (last.distractions || []).forEach((d) => { if (d.type !== 'tab') by[d.type] = (by[d.type] || 0) + 1; });
      lines = [['Planned', mmss(last.plannedMs)], ['Focused', mmss(last.focusedMs)], ['Away', mmss(last.awayMs || 0), 1], ['Tab leaves', String(last.tabSwitches || 0), 1], 'gap',
        ...Object.entries(by).map(([k, n]) => [LABEL[k] || 'Other', `×${n}`, 1]),
        ['First drift', last.firstDistractionAt == null ? 'none' : mmss(last.firstDistractionAt)]];
      if (last.mood) lines.push(['Mood', last.mood[0].toUpperCase() + last.mood.slice(1)]);
      score = typeof last.score === 'number' ? last.score : score;
      const d = new Date(last.startedAt || Date.now());
      $('r-kind').textContent = `your last session · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
      const n = s.sessions.length, mins = Math.round(s.sessions.reduce((a, x) => a + (x.focusedMs || 0), 0) / 60000);
      $('proof').textContent = `Welcome back · ${n} session${n === 1 ? '' : 's'}, ${mins} min focused`;
      $('hero-cta').textContent = 'Back to focusing →';
    }
  } catch (e) { /* nothing saved, or storage blocked: keep the sample */ }
  $('r-lines').innerHTML = lines.map((l) => (l === 'gap' ? '<div class="gap"></div>' : `<div class="${l[2] ? 'red' : ''}"><span>${l[0]}</span><span>${l[1]}</span></div>`)).join('');
  inView(document.querySelector('.receipt-wrap'), () => {   // the receipt itself is clipped shut, so watch its slot
    $('receipt').classList.add('printing');
    const el = $('r-score'), t0 = performance.now() + (STILL ? 0 : 1800);
    const step = (now) => { const k = clamp01((now - t0) / 900); el.textContent = Math.round(score * ease(k)); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, 0.35);
})();

/* ---------- film ---------- */
(() => {
  const v = $('film-v'), btn = $('film-play'), box = $('film');
  btn.addEventListener('click', () => {
    if (!v.getAttribute('src')) v.src = v.dataset.src;
    box.classList.add('playing'); v.controls = true; v.muted = false;
    const p = v.play(); if (p && p.catch) p.catch(() => { box.classList.remove('playing'); v.controls = false; });
  });
  v.addEventListener('ended', () => { box.classList.remove('playing'); v.controls = false; v.load(); });
  v.addEventListener('playing', () => document.body.classList.add('film-on'));
  ['pause', 'ended', 'emptied'].forEach((ev) => v.addEventListener(ev, () => document.body.classList.remove('film-on')));
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { if (!e[0].isIntersecting && !v.paused) v.pause(); }, { threshold: 0.15 }).observe(v);
})();

/* ---------- headlines word by word, blocks rise in ---------- */
function splitWords(el) {
  let i = 0;
  const walk = (node) => [...node.childNodes].forEach((n) => {
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
  walk(el); el.classList.add('split');
}
if (!STILL && 'IntersectionObserver' in window) {
  const heads = [...document.querySelectorAll('.split-me, .final-h')];
  heads.forEach(splitWords);
  const blocks = [...document.querySelectorAll('.try-stats, .sub, .also, .vows, .faq-list, .film-frame, .duel-rings, .receipt-wrap, .lock-mark, .say .sub')];
  blocks.forEach((b) => b.classList.add('rise'));
  const io = new IntersectionObserver((list) => list.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: 0.2 });
  heads.concat(blocks).forEach((el) => io.observe(el));
} else document.querySelectorAll('mark').forEach((m) => m.classList.add('in'));

/* ======================= one light scroll loop ======================= */
const hudRing = $('hud-ring'), lockArc = $('lock-arc'), lockDot = $('lock-dot'), lockSec = $('private');
const finalSec = $('final'), finalRing = $('final-ring'), finalH = $('final-h');
let ticking = false;
function onScroll() {
  ticking = false;
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  hudRing.style.strokeDashoffset = String(88 * (1 - scrollY / max));
  if (STILL) { paintHour(60); paintLens(1); return; }
  const near = (el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight * 1.2 && r.bottom > -innerHeight * 0.2; };
  if (near(hourSec)) paintHour(60 * clamp01((through(hourSec) - 0.04) / 0.86));
  if (near(lensSec)) paintLens(through(lensSec));
  if (near(lockSec)) {
    const r = lockSec.getBoundingClientRect(), k = ease(clamp01((innerHeight * 0.85 - r.top) / (innerHeight * 0.6)));
    const g = (86 / 360) * (1 - k), L = 414.7;                       // the logo's gap closes: it locks
    lockArc.style.strokeDasharray = `${(L * (1 - g)).toFixed(1)} ${L}`; lockArc.style.strokeDashoffset = String((-L * g / 2).toFixed(1));
    lockDot.setAttribute('cy', (34 + 66 * k).toFixed(1)); lockDot.setAttribute('r', (14 + 10 * k).toFixed(1));
  }
  if (near(finalSec)) {
    const r = finalSec.getBoundingClientRect(), k = clamp01((innerHeight - r.top) / innerHeight);
    finalRing.style.strokeDashoffset = String(1633.6 * (1 - ease(k)));
    finalH.style.transform = `scale(${(0.86 + 0.14 * ease(k)).toFixed(3)})`;
  }
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener('resize', () => { lastR = -1; onScroll(); });
onScroll();
})();
