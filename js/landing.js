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
    setTimeout(() => { swap.classList.add('struck'); redPulse = 1; }, 1500);
    setTimeout(() => swap.classList.add('swapped'), 2200);
  }));
})();

/* ---------- hero: a billowing smoke ring (WebGL) ----------
   The ring is the hour: indigo smoke for focus, red wisps for the minutes that drifted away.
   It billows in on load, flares red when "an hour." is struck out, and parts around the cursor.
   Drawn at a reduced resolution (smoke is soft anyway) and only while the hero is on screen. */
let redPulse = 0;
(() => {
  const cv = $('billow');
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) { cv.remove(); return; }
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision mediump float;
  uniform vec2 uRes; uniform float uT, uIn, uRed; uniform vec2 uM;
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
  float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}
  void main(){
    vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
    vec2 dm=p-uM; p+=normalize(dm+1e-4)*.07*exp(-dot(dm,dm)*9.);
    vec2 q=vec2(fbm(p*1.6+vec2(0.,uT*.06)),fbm(p*1.6+vec2(5.2,1.3)-uT*.05));
    vec2 w=p+.13*(q-.5);
    float r=length(w); vec2 ca=w/max(r,1e-4);
    float fit=min(1.,uRes.x/uRes.y*1.05);   // on tall phone screens the ring shrinks to fit the width
    float R=mix(.24,.47,uIn)*fit;
    float d=r-R-.06*(fbm(ca*1.3+uT*.07)-.5);
    float th=(.026+.05*fbm(ca*2.1-uT*.05+3.))*mix(.7,1.,fit);
    float ring=exp(-d*d/(th*th));
    float tex=.4+.95*fbm(w*3.3+vec2(uT*.08,-uT*.06));
    float smoke=fbm(w*2.1+q*1.7+uT*.035)*exp(-abs(d)*4.5)*.6;
    float dens=(ring*tex+smoke)*uIn;
    float c1=cos(uT*.06),s1=sin(uT*.06); vec2 cr=mat2(c1,-s1,s1,c1)*ca;
    float rm=smoothstep(.5,.7,fbm(cr*1.7+q*.8+2.))*(.6+.6*uRed);
    vec3 ind=vec3(.45,.52,1.),vio=vec3(.66,.56,1.),red=vec3(.95,.42,.45);
    vec3 col=mix(mix(ind,vio,fbm(w*1.4+uT*.02)),red,clamp(rm,0.,1.));
    vec3 bg=vec3(.043,.051,.067)+ind*.04*fbm(p*1.3+uT*.02);
    vec3 c=bg+(col*dens*.78+col*pow(ring,6.)*.12*uIn)*mix(.5,1.,fit*fit);
    gl_FragColor=vec4(c,1.);
  }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { cv.remove(); return; }
  const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.remove(); return; }
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (k) => gl.getUniformLocation(pr, k);
  const uRes = U('uRes'), uT = U('uT'), uIn = U('uIn'), uRed = U('uRed'), uM = U('uM');
  document.body.classList.add('gl');
  const SCALE = 0.6;
  let W = 0, Hh = 0;
  const size = () => { const r = cv.getBoundingClientRect(); W = Math.max(2, Math.round(r.width * SCALE)); Hh = Math.max(2, Math.round(r.height * SCALE)); cv.width = W; cv.height = Hh; gl.viewport(0, 0, W, Hh); };
  size(); addEventListener('resize', size);
  const m = { x: 9, y: 9 }, mt = { x: 9, y: 9 };                         // far away until the mouse arrives
  hero.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); mt.x = (e.clientX - r.left - r.width / 2) / r.height; mt.y = -(e.clientY - r.top - r.height / 2) / r.height; }, { passive: true });
  hero.addEventListener('pointerleave', () => { mt.x = 9; mt.y = 9; });
  let on = true, t0 = performance.now();
  const frame = (now) => {
    const t = (now - t0) / 1000;
    m.x += (mt.x - m.x) * 0.08; m.y += (mt.y - m.y) * 0.08;
    redPulse *= 0.985;
    gl.uniform2f(uRes, W, Hh); gl.uniform1f(uT, STILL ? 12 : t + 12); gl.uniform1f(uIn, STILL ? 1 : ease(clamp01(t / 2.2)));
    gl.uniform1f(uRed, redPulse); gl.uniform2f(uM, m.x, m.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (on && !STILL) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { const was = on; on = e[0].isIntersecting; if (on && !was && !STILL) requestAnimationFrame(frame); }).observe(hero);
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
let lensMoved = false, lensGrow = 0, wanderOn = false;
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
  let travelled = 0, lx = null, ly = null;
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || lensGrow > 0.02) return;
    const r = stage.getBoundingClientRect();
    if (lx !== null) travelled += Math.hypot(e.clientX - lx, e.clientY - ly);
    lx = e.clientX; ly = e.clientY;
    if (travelled > 60 && !lensMoved) { lensMoved = true; stage.classList.add('moved'); }
    if (!lensMoved) return;
    stage.style.setProperty('--x', `${((e.clientX - r.left) / r.width * 100).toFixed(2)}%`);
    stage.style.setProperty('--y', `${((e.clientY - r.top) / r.height * 100).toFixed(2)}%`);
  }, { passive: true });
  if (TOUCH) $('lens-tip-t').textContent = 'Keep scrolling — find the calm';
  // until the visitor moves the mouse, the lens wanders on its own, so it is obviously alive
  let t0 = performance.now();
  const wander = (now) => {
    if (!wanderOn) return;
    if (!lensMoved && lensGrow <= 0.02 && !STILL) {
      const t = (now - t0) / 1000;
      stage.style.setProperty('--x', `${(50 + 16 * Math.sin(t * 0.55)).toFixed(2)}%`);
      stage.style.setProperty('--y', `${(46 + 9 * Math.sin(t * 0.9 + 1)).toFixed(2)}%`);
    }
    requestAnimationFrame(wander);
  };
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { const was = wanderOn; wanderOn = e[0].isIntersecting; if (wanderOn && !was) requestAnimationFrame(wander); }).observe(stage);
})();
let lastR = -1;
function paintLens(k) {
  const full = Math.hypot(innerWidth, innerHeight);
  lensGrow = ease(clamp01((k - 0.5) / 0.42));
  const base = TOUCH ? Math.min(innerWidth * 0.44, 190) : 210;
  const r = Math.round(base + (full - base) * lensGrow);
  if (r === lastR) return; lastR = r;
  stage.style.setProperty('--r', `${r}px`);
  stage.style.setProperty('--ro', (1 - lensGrow).toFixed(3));
  if (lensGrow > 0.02) { stage.style.setProperty('--x', '50%'); stage.style.setProperty('--y', '50%'); }
  stage.classList.toggle('grown', lensGrow > 0.6);
}

/* ---------- hands-free: a live demo, and a real one you can talk to ---------- */
(() => {
  const DEMO = [
    ['Lockin, start 45 minutes', 'Starting 45 minutes. Go.'],
    ['Lockin, I got distracted by my phone', 'Logged — phone, at 14 minutes.'],
    ['Lockin, how am I doing?', '22 minutes focused, one tab leave. Keep going.'],
    ['Lockin, pause', 'Paused. Say “resume” when you’re back.'],
    ['Lockin, add five minutes', 'Added 5 minutes. 9 to go.'],
    ['Lockin, play rain', 'Rain is on.'],
    ['Lockin, take a five minute break', 'Take five. I’ll call you back.'],
    ['Lockin, I have 35 minutes', 'Shaping 35 minutes into blocks.'],
    ['Lockin, plan 40 minutes at 8pm', 'Planned for 8 PM. I’ll remind you.'],
    ['Lockin, how long left?', '18 minutes left.'],
    ['Lockin, create a room', 'Room created. Invite link copied.'],
    ['Lockin, finish', 'Done. Here’s your autopsy.'],
  ];
  const text = $('say-text'), reply = $('say-reply'), replyT = $('say-reply-t'), state = $('voice-state'), orb = $('orb'), btn = $('orb-btn'), tip = $('orb-tip');
  const cmds = $('cmds');
  cmds.innerHTML = DEMO.map(([s], i) => `<button type="button" data-i="${i}">${s.replace(/^Lockin, /, '')}</button>`).join('');
  const chips = [...cmds.children];
  const setState = (cls, msg) => { state.className = 'voice-state ' + (cls || ''); state.lastChild.textContent = msg; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* the orb: a ring whose edge moves with the voice (synthetic in the demo, the real mic when live) */
  const cv = $('orb-c'), cx = cv.getContext('2d');
  let level = 0, target = 0, mode = 'idle', visible = false, analyser = null, buf = null;
  function drawOrb(now) {
    if (!visible) return;
    const t = now / 1000;
    if (analyser) { analyser.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } target = Math.min(1, Math.sqrt(s / buf.length) * 5); }
    else if (mode === 'talk') target = 0.45 + 0.4 * Math.abs(Math.sin(t * 9)) * Math.abs(Math.sin(t * 3.3 + 1));
    else if (mode === 'reply') target = 0.25 + 0.2 * Math.abs(Math.sin(t * 7));
    else target = 0.05 + 0.04 * Math.sin(t * 1.6);
    level += (target - level) * 0.18;
    const W = cv.width, R = W * 0.33;
    cx.clearRect(0, 0, W, W);
    const col = orb.classList.contains('live') ? [224, 123, 123] : mode === 'reply' ? [94, 201, 160] : [124, 140, 255];
    for (let layer = 0; layer < 3; layer++) {
      cx.beginPath();
      for (let i = 0; i <= 160; i++) {
        const a = (i / 160) * Math.PI * 2;
        const wob = Math.sin(a * 3 + t * 2 + layer) * 0.5 + Math.sin(a * 7 - t * 3.1 + layer * 2) * 0.3 + Math.sin(a * 13 + t * 5) * 0.2;
        const r = R + layer * 10 + wob * (8 + 46 * level) * (1 - layer * 0.25);
        const x = W / 2 + Math.cos(a) * r, y = W / 2 + Math.sin(a) * r;
        i ? cx.lineTo(x, y) : cx.moveTo(x, y);
      }
      cx.closePath();
      cx.strokeStyle = `rgba(${col},${[0.95, 0.45, 0.2][layer]})`;
      cx.lineWidth = [5, 3, 2][layer];
      cx.shadowColor = `rgba(${col},.8)`; cx.shadowBlur = layer ? 0 : 24;
      cx.stroke();
    }
    const g = cx.createRadialGradient(W / 2, W / 2, R * 0.2, W / 2, W / 2, R * 1.4);
    g.addColorStop(0, `rgba(${col},${(0.12 + 0.22 * level).toFixed(3)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.shadowBlur = 0; cx.fillStyle = g; cx.beginPath(); cx.arc(W / 2, W / 2, R * 1.4, 0, Math.PI * 2); cx.fill();
    requestAnimationFrame(drawOrb);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { const was = visible; visible = e[0].isIntersecting; if (visible && !was) requestAnimationFrame(drawOrb); }).observe(orb);
  else { visible = true; requestAnimationFrame(drawOrb); }

  /* the self-playing demo (a click on a chip plays that one) */
  let run = 0, busy = false;
  async function play(i, token) {
    const [say, ans] = DEMO[i];
    chips.forEach((c, j) => c.classList.toggle('on', j === i));
    reply.classList.remove('on'); mode = 'talk';
    for (let c = 1; c <= say.length; c++) { if (token !== run) return; text.textContent = `“${say.slice(0, c)}`; await sleep(36); }
    text.textContent = `“${say}”`; mode = 'idle';
    await sleep(320); if (token !== run) return;
    replyT.textContent = ans; reply.classList.add('on'); mode = 'reply';
    await sleep(1900); if (token !== run) return;
    mode = 'idle';
  }
  async function demo(from = 0) {
    const token = ++run;
    for (let i = from; token === run; i = (i + 1) % DEMO.length) { await play(i, token); if (token !== run) return; await sleep(500); }
  }
  chips.forEach((c) => c.addEventListener('click', () => { if (busy) return; const i = +c.dataset.i; const token = ++run; play(i, token).then(() => { if (token === run) setTimeout(() => token === run && demo((i + 1) % DEMO.length), 2500); }); }));
  if (STILL) { text.textContent = `“${DEMO[0][0]}”`; replyT.textContent = DEMO[0][1]; reply.classList.add('on'); }
  else inView($('voice'), () => demo(0), 0.3);

  /* the real thing: the browser's speech recognition + Lockin's own command grammar (voice-control.js) */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const answer = (p) => {
    const m = p && p.min;
    switch (p && p.intent) {
      case 'start': return `Starting ${m || 25} minutes. Go.`;
      case 'pause': return 'Paused. Say “resume” when you’re back.';
      case 'resume': return 'Back on the clock.';
      case 'extend': return `Added ${m || 5} minutes.`;
      case 'finish': return 'Done. Here’s your autopsy.';
      case 'discard': return 'Session discarded.';
      case 'break': return `Take ${m || 5}. I’ll call you back.`;
      case 'skipbreak': return 'Break skipped. Back to it.';
      case 'distract': return `Logged — ${p.type === 'other' ? 'a distraction' : p.type}.`;
      case 'sound': return `Playing ${p.which}.`;
      case 'sound.off': return 'Sound off.';
      case 'volume': return p.delta > 0 ? 'Louder.' : 'Quieter.';
      case 'shape': return `Shaping ${m} minutes into blocks.`;
      case 'plan': return 'Planned. I’ll remind you.';
      case 'ask.time': return '18 minutes left.';
      case 'ask.status': return '22 minutes focused, one tab leave. Keep going.';
      case 'ask.streak': return 'You’re on a 3-day streak.';
      case 'ask.level': return 'Level 4. 120 XP to the next.';
      case 'ask.quote': return 'You don’t have to be great to start.';
      case 'ask.weather': return 'Clear tonight — a good night to focus.';
      case 'room.create': return 'Room created. Invite link copied.';
      case 'room.nudge': return 'Nudged your partner.';
      case 'goal': return `Daily goal set to ${m} minutes.`;
      case 'mood': return 'Noted. Saved with the session.';
      case 'help': case 'wake': return 'Try: “Lockin, start 45 minutes.”';
      case 'view': return `Opening ${p.view}.`;
      default: return null;
    }
  };
  const speak = (s) => new Promise((done) => {
    try {
      const tts = window.speechSynthesis; if (!tts) return done();
      tts.cancel(); const u = new SpeechSynthesisUtterance(s); u.rate = 1.05; u.onend = done; u.onerror = done; tts.speak(u); setTimeout(done, 6000);
    } catch (e) { done(); }
  });
  let rec = null, stream = null, actx = null;
  const stopMic = () => { try { stream && stream.getTracks().forEach((t) => t.stop()); } catch (e) {} stream = null; analyser = null; try { actx && actx.close(); } catch (e) {} actx = null; };
  const finishLive = (resume = true) => { orb.classList.remove('live'); tip.textContent = 'Tap & speak'; busy = false; stopMic(); if (resume) setTimeout(() => !busy && demo(0), 5000); };
  btn.addEventListener('click', async () => {
    if (busy) { try { rec && rec.stop(); } catch (e) {} return; }
    if (!SR) { setState('', 'Your browser can’t do speech — try Chrome, Edge or Safari.'); return; }
    busy = true; run++; mode = 'idle'; reply.classList.remove('on'); chips.forEach((c) => c.classList.remove('on'));
    text.textContent = ''; orb.classList.add('live'); tip.textContent = 'Listening…';
    setState('live', 'Listening — say “Lockin, start 45 minutes”');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      actx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = actx.createAnalyser(); analyser.fftSize = 1024; buf = new Uint8Array(analyser.fftSize);
      actx.createMediaStreamSource(stream).connect(analyser);
    } catch (e) { stopMic(); }
    rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = true; rec.maxAlternatives = 3; rec.continuous = false;
    let heard = false;
    rec.onresult = async (ev) => {
      const res = ev.results[ev.results.length - 1];
      text.textContent = `“${res[0].transcript.trim()}`;
      if (!res.isFinal) return;
      heard = true; text.textContent = `“${res[0].transcript.trim()}”`;
      const parsed = VoiceControl.parseBest([...res].map((alt) => alt.transcript));
      const said = answer(parsed);
      stopMic(); orb.classList.remove('live');
      replyT.textContent = said || 'Didn’t catch a command — try “Lockin, start 45 minutes.”'; reply.classList.add('on');
      setState('speak', said ? 'Understood — this is how Lockin answers' : 'Not a command I know yet');
      mode = 'reply'; if (said) await speak(said); mode = 'idle';
      setState('', 'Tap the mic to try another');
    };
    rec.onerror = (ev) => {
      const why = { 'not-allowed': 'Microphone blocked — allow it in the address bar to try.', 'service-not-allowed': 'Microphone blocked — allow it in the address bar to try.', 'no-speech': 'Didn’t hear anything — tap and try again.', network: 'Speech needs a connection — try again online.' }[ev.error];
      setState('', why || 'Something went wrong — tap to try again.');
    };
    rec.onend = () => { if (!heard && state.classList.contains('live')) setState('', 'Didn’t hear anything — tap and try again.'); finishLive(); };
    try { rec.start(); } catch (e) { finishLive(); }
  });
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
