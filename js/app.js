/* ------------------------------------------------------------------
   app.js — the session engine and everything on screen.
-------------------------------------------------------------------*/
(function () {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const CIRC = 540.35;                    // 2πr for the progress dial (r = 86)
const MIN = 60000;

const DISTRACTIONS = {
  tab:      { emoji: '', label: 'Left the tab' },
  phone:    { emoji: '', label: 'Phone' },
  daydream: { emoji: '', label: 'Daydreaming' },
  people:   { emoji: '', label: 'People' },
  tired:    { emoji: '', label: 'Tired' },
  hungry:   { emoji: '', label: 'Hungry' },
  other:    { emoji: '', label: 'Other' }
};
const MOODS = { great: 'Great', good: 'Good', ok: 'OK', rough: 'Rough', bad: 'Bad' };

/* ------------------------------ helpers ------------------------------ */
const pad = n => String(n).padStart(2, '0');
function fmtClock(ms) {
  ms = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(ms / 3600), m = Math.floor((ms % 3600) / 60), s = ms % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function fmtDur(ms) {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}
const fmtShort = ms => {
  const m = Math.round(ms / MIN);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
function fmtWhen(ts) {
  const d = new Date(ts), now = new Date();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString();
  if (sameDay) return `Today ${time}`;
  if (tomorrow) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} ${time}`;
}
function fmtAgo(ms) {
  const abs = Math.abs(ms), m = Math.round(abs / MIN);
  if (m < 1) return 'less than a minute';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------ banners ------------------------------ */
const BOOT_AT = Date.now();
const QUIET_MS = 7000;          // the first view should be calm, not a pile of pop-ups

function banner(opts) {
  const slot = $('#banner-slot');
  if (opts.id && $(`[data-bid="${opts.id}"]`)) return;
  /* Anything that wants to speak up during the opening seconds waits its
     turn, unless the user's own click caused it. */
  if (!opts.force && Date.now() - BOOT_AT < QUIET_MS) return;
  const el = document.createElement('div');
  el.className = 'banner' + (opts.kind === 'info' ? ' info' : '');
  if (opts.id) el.dataset.bid = opts.id;
  el.innerHTML = `<span>${opts.html || esc(opts.text)}</span><span class="acts"></span>`;
  const acts = $('.acts', el);
  (opts.actions || []).forEach(a => {
    const b = document.createElement('button');
    b.textContent = a.label;
    b.onclick = () => { a.fn && a.fn(); el.remove(); };
    acts.appendChild(b);
  });
  const x = document.createElement('button');
  x.textContent = '✕'; x.title = 'Dismiss'; x.onclick = () => el.remove();
  acts.appendChild(x);
  slot.appendChild(el);
  if (opts.timeout) setTimeout(() => el.remove(), opts.timeout);
}
const toast = (text, kind) => banner({ text, kind: kind || 'info', timeout: 5000 });

/* ============================ SESSION ENGINE ============================ */
let A = null;        // active focus session
let brk = null;      // active break {endsAt, totalMs}
let queue = [];      // blocks from "I have X minutes"
let queueDone = 0;
let pendingSession = null;   // the session shown in the autopsy modal

function newSession(plannedMs, kind, planId) {
  return {
    id: 's' + Date.now() + Math.random().toString(36).slice(2, 6),
    kind: kind || 'focus',
    planId: planId || null,
    plannedMs,
    startedAt: Date.now(),
    focusedMs: 0,
    awayMs: 0,
    tabSwitches: 0,
    distractions: [],
    firstDistractionAt: null,
    paused: false,
    lastAt: Date.now()
  };
}

function startFocus(minutes, kind, planId) {
  if (A) return;
  if (brk) endBreak(true);
  const ms = Math.max(1, Math.round(minutes)) * MIN;
  A = newSession(ms, kind, planId);
  const r = Store.state.room;                     // a session started inside the room window is a co-session
  if (r && Date.now() >= r.startAt - 90000 && Date.now() < r.startAt + r.durationMin * MIN) A.roomId = r.id;
  Store.saveActive(A);
  Store.set('lastDurationMin', Math.round(minutes));
  if (Store.state.settings.autoAmbience && !Ambience.playing) {
    Ambience.play(Store.state.settings.ambience);
    paintSound();
  }
  if (planId) Store.setPlanned(planId, { status: 'started' });
  zenOff = false;                      // every new session opens in full-screen focus
  renderTimer(); renderPlanLists();
}

function togglePause() {
  if (!A) return;
  A.paused = !A.paused;
  if (!A.paused) zenOff = false;               // pressing resume goes back to full-screen focus
  A.lastAt = Date.now();
  Store.saveActive(A);
  renderTimer();
}

function extend(minutes) {
  if (!A) return;
  A.plannedMs += minutes * MIN;
  Store.saveActive(A);
  toast(`Added ${minutes} minutes. New target: ${fmtShort(A.plannedMs)}.`);
  renderTimer();
}

function logDistraction(type) {
  if (!A) return;
  A.distractions.push({ type, at: Date.now() });
  if (A.firstDistractionAt === null) A.firstDistractionAt = A.focusedMs;
  Store.saveActive(A);
  renderTimer();
}

function discard(skipConfirm) {
  if (!A) return;
  if (!skipConfirm && !confirm('Discard this session? Nothing will be saved.')) return;
  A = null; Store.saveActive(null);
  leaveZen();
  renderTimer();
}

function finish(auto) {
  if (!A) return;
  const s = A; A = null; Store.saveActive(null);
  leaveZen();
  const record = {
    id: s.id, kind: s.kind, plannedMs: s.plannedMs,
    startedAt: s.startedAt, endedAt: Date.now(),
    focusedMs: Math.round(s.focusedMs), awayMs: Math.round(s.awayMs),
    tabSwitches: s.tabSwitches, distractions: s.distractions,
    firstDistractionAt: s.firstDistractionAt,
    completed: s.focusedMs >= s.plannedMs * 0.95,
    roomId: s.roomId || null,
    mood: null, journal: null
  };
  record.score = Store.scoreOf(record);
  Store.addSession(record);
  if (s.planId) Store.setPlanned(s.planId, { status: 'done' });

  const gained = Progress.award(record, { coStudy: !!record.roomId, streak: Store.streak().current });
  lastGain = gained;
  if (record.roomId) reportToRoom(record);
  Ambience.chime(true);
  if (auto) Notify.push('Session complete', `${fmtDur(record.focusedMs)} of focus. Time for your reflection.`);
  openAutopsy(record);
  renderAll();
}

/* ------------------------------- breaks ------------------------------- */
function startBreak(minutes) {
  brk = { endsAt: Date.now() + minutes * MIN, totalMs: minutes * MIN };
  renderTimer();
}
function endBreak(silent) {
  brk = null;
  leaveZen();
  if (!silent) {
    Ambience.chime(false);
    Notify.push('Break over', 'Ready for the next block?');
  }
  const next = nextQueueBlock();
  if (next && next.type === 'focus') {
    toast(`Break done — starting your ${next.min} minute block.`);
    startFocus(next.min, 'focus');
  }
  renderTimer();
}

function nextQueueBlock() {
  if (queueDone >= queue.length) { queue = []; queueDone = 0; return null; }
  return queue[queueDone++];
}

/* ------------------------------- ticking ------------------------------- */
let saveCounter = 0;
function tick() {
  const now = Date.now();
  if (A) {
    const delta = Math.max(0, Math.min(now - A.lastAt, 5000));  // ignore huge jumps (sleep)
    A.lastAt = now;
    if (!A.paused) {
      if (document.hidden) A.awayMs += delta; else A.focusedMs += delta;
    }
    if (A.focusedMs >= A.plannedMs) { finish(true); return; }
    if (++saveCounter % 8 === 0) Store.saveActive(A);
  }
  if (brk && now >= brk.endsAt) { endBreak(false); return; }
  renderTimer();
}

document.addEventListener('visibilitychange', () => {
  if (!A || A.paused) return;
  if (document.hidden) {
    A.tabSwitches++;
    A.distractions.push({ type: 'tab', at: Date.now() });
    if (A.firstDistractionAt === null) A.firstDistractionAt = A.focusedMs;
    Store.saveActive(A);
  } else {
    A.lastAt = Date.now();
    renderTimer();
  }
});

/* ============================== RENDERING ============================== */
let zenOff = false;                    // the user chose to leave full-screen focus
function syncZen() {
  if (A || brk) document.body.classList.toggle('focus-mode', !zenOff);
}
function leaveZen() { zenOff = false; document.body.classList.remove('focus-mode'); }

function renderTimer() {
  const state = $('#focus-state'), sub = $('#dial-sub'), time = $('#dial-time');
  syncZen();
  const running = !!A, onBreak = !!brk;

  $('#setup-row').hidden = running || onBreak;
  $('#btn-start').hidden = running || onBreak;
  $('#btn-pause').hidden = !running;
  $('#btn-extend').hidden = !running;
  $('#btn-finish').hidden = !running;
  $('#btn-cancel').hidden = !running;
  $('#btn-skip-break').hidden = !onBreak;
  $('#live-stats').hidden = !running;
  $('#distract-row').hidden = !running;

  if (running) {
    const remaining = Math.max(0, A.plannedMs - A.focusedMs);
    time.textContent = fmtClock(remaining);
    $('#dial-prog').style.strokeDashoffset = CIRC * (1 - Math.min(1, A.focusedMs / A.plannedMs));
    $('#focus-title').textContent = A.kind === 'micro' ? 'Just-start session' : 'Focus session';
    if (A.paused) { state.textContent = 'Paused'; state.className = 'pill paused'; sub.textContent = 'paused — the clock is waiting'; }
    else if (document.hidden) { state.textContent = 'Away'; state.className = 'pill away'; sub.textContent = 'you left the tab'; }
    else { state.textContent = 'Focusing'; state.className = 'pill live'; sub.textContent = `of ${fmtShort(A.plannedMs)} planned`; }
    $('#btn-pause').textContent = A.paused ? 'Resume' : 'Pause';
    $('#live-focus').textContent = fmtDur(A.focusedMs);
    $('#live-away').textContent = fmtDur(A.awayMs);
    $('#live-tabs').textContent = A.tabSwitches;
    $('#live-dist').textContent = A.distractions.filter(d => d.type !== 'tab').length;
  } else if (onBreak) {
    const remaining = Math.max(0, brk.endsAt - Date.now());
    time.textContent = fmtClock(remaining);
    $('#dial-prog').style.strokeDashoffset = CIRC * (remaining / brk.totalMs);
    $('#focus-title').textContent = 'Break';
    state.textContent = 'Break'; state.className = 'pill';
    sub.textContent = 'stand up, look out a window';
  } else {
    const mins = currentDuration();
    time.textContent = fmtClock(mins * MIN);
    $('#dial-prog').style.strokeDashoffset = CIRC;
    $('#focus-title').textContent = 'Focus session';
    state.textContent = 'Idle'; state.className = 'pill';
    sub.textContent = 'ready when you are';
  }
  renderQueue();
}

let queueSig = '';
function renderQueue() {
  const row = $('#queue-row');
  const sig = queue.map(b => b.type + b.min).join(',') + '@' + queueDone;
  if (sig === queueSig) return;                 // the timer ticks 4x a second; this doesn't
  queueSig = sig;
  if (!queue.length) { row.hidden = true; row.innerHTML = ''; return; }
  row.hidden = false;
  row.innerHTML = '<span class="k">Your plan</span>' + queue.map((b, i) => {
    const cls = i < queueDone - 1 ? 'done' : i === queueDone - 1 ? 'now' : '';
    return `<span class="qstep ${cls}">${b.type === 'break' ? 'Break' : 'Focus'} ${b.min}m</span>`;
  }).join('');
}

function currentDuration() {
  const v = parseInt($('#duration-input').value, 10);
  return Number.isFinite(v) && v > 0 ? Math.min(240, v) : 25;
}

/* ------------------------------ chips / goal ------------------------------ */
function renderChips() {
  const st = Store.streak();
  $('#chip-streak').textContent = `${st.current} day${st.current === 1 ? '' : 's'} streak`;
  const goal = Store.state.settings.dailyGoalMin;
  const today = Store.todayMs();
  $('#chip-goal').textContent = `${Math.round(today / MIN)} / ${goal}m`;
  const pct = Math.min(100, (today / (goal * MIN)) * 100);
  $('#goal-bar').style.width = pct + '%';
  $('#goal-text').textContent = today >= goal * MIN
    ? `Goal met — ${fmtDur(today)} today. Anything more is a bonus.`
    : `${fmtDur(today)} done · ${fmtShort(goal * MIN - today)} to go today.`;
}

/* ------------------------------ plan lists ------------------------------ */
function renderPlanLists() {
  const now = Date.now();
  const all = Store.state.planned.slice().sort((a, b) => a.at - b.at);
  const upcoming = all.filter(p => p.status === 'pending' || p.status === 'started');
  const past = all.filter(p => p.status === 'done' || p.status === 'missed').reverse().slice(0, 12);

  $('#upcoming-list').innerHTML = upcoming.length ? upcoming.map(p => {
    const due = now >= p.at;
    return `<div class="item ${due ? 'due' : ''}">
      <div class="main">
        <span class="when">${fmtWhen(p.at)} · ${p.durationMin} min</span>
        <span class="sub">${due ? 'due now' : 'in ' + fmtAgo(p.at - now)}${p.status === 'started' ? ' · started' : ''}</span>
      </div>
      <div class="acts">
        <button class="btn small" data-start-plan="${p.id}">▶ Start</button>
        <button class="btn small" data-snooze="${p.id}">+10 min</button>
        <button class="btn small danger-ghost" data-del-plan="${p.id}">Remove</button>
      </div></div>`;
  }).join('') : `<p class="empty">Nothing planned yet. Add a time above, or just say it out loud.</p>`;

  $('#past-list').innerHTML = past.length ? past.map(p => `
    <div class="item ${p.status}">
      <div class="main">
        <span class="when">${fmtWhen(p.at)} · ${p.durationMin} min</span>
        <span class="sub">${p.status === 'done' ? '✅ completed' : '⏭️ missed'}</span>
      </div>
      <div class="acts"><button class="btn small danger-ghost" data-del-plan="${p.id}">Remove</button></div>
    </div>`).join('') : `<p class="empty">Your finished and missed plans will collect here.</p>`;
}

/* ------------------------------- insights ------------------------------- */
function renderInsights() {
  const t = Store.totals();
  $('#stat-grid').innerHTML = [
    ['Total focused', fmtShort(t.focused)],
    ['Sessions', t.count],
    ['Average session', t.count ? fmtShort(t.avg) : '—'],
    ['Longest session', t.count ? fmtShort(t.longest) : '—'],
    ['Avg focus score', t.count ? t.avgScore + '%' : '—'],
    ['Consistency (14d)', t.consistency + '%'],
    ['Time away', fmtShort(t.away)],
    ['Tab switches', t.tabs]
  ].map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`).join('');

  const week = Store.last7();
  const goalMs = Store.state.settings.dailyGoalMin * MIN;
  const max = Math.max(goalMs, ...week.map(d => d.ms), 1);
  $('#chart').innerHTML = week.map(d => {
    const h = Math.round((d.ms / max) * 100);
    return `<div class="col">
      <span class="val">${d.ms ? Math.round(d.ms / MIN) + 'm' : '·'}</span>
      <div class="stack"><div class="fill" style="height:${h}%"></div></div>
      <span class="lbl">${d.date.toLocaleDateString([], { weekday: 'short' })}</span>
    </div>`;
  }).join('');

  const f = Store.fingerprint();
  $('#fingerprint').innerHTML = f.ready ? `
    <p class="muted">Built from your last ${f.n} sessions — it sharpens every time you study.</p>
    <div class="fp-grid">
      ${fp('Average session', fmtShort(f.avg))}
      ${fp('Best study period', f.bestPeriod)}
      ${fp('Focus usually drops after', f.dropAfter ? fmtShort(f.dropAfter) : 'no drop yet 👏')}
      ${fp('Most common distraction', f.topDistraction
            ? `${DISTRACTIONS[f.topDistraction.type]?.emoji || '•'} ${DISTRACTIONS[f.topDistraction.type]?.label || f.topDistraction.type}`
            : 'none logged')}
      ${fp('Average time away', fmtShort(f.avgAway))}
      ${fp('Most productive day', f.bestDay)}
      ${fp('Sessions finished in full', f.finishRate + '%')}
    </div>` : `
    <p class="muted">Study ${f.need - f.have} more session${f.need - f.have === 1 ? '' : 's'} and Lockin
    will have enough to describe how you focus — when you're sharpest, how long you last, what pulls you away.</p>`;

  const split = Store.distractionSplit();
  $('#distract-breakdown').innerHTML = split.total ? `
    <p class="headline">Your biggest distraction this week:
      <b>${DISTRACTIONS[split.rows[0].type]?.label || split.rows[0].type}
      — ${split.rows[0].pct}%</b></p>
    ${split.rows.map(r => `<div class="dbar">
      <div class="top"><span>${DISTRACTIONS[r.type]?.label || r.type}</span>
      <span>${r.n} × · ${r.pct}%</span></div>
      <div class="track"><div class="ffill" style="width:${r.pct}%"></div></div>
    </div>`).join('')}` : `<p class="empty">No distractions recorded in the last 7 days. Either you're locked in, or you haven't studied yet.</p>`;

  const st = Store.streak();
  $('#streak-box').innerHTML = `
    <div class="big-streak">${st.current} day${st.current === 1 ? '' : 's'}</div>
    <p class="muted">Longest run: ${st.longest} day${st.longest === 1 ? '' : 's'} ·
      ${st.studiedToday ? 'today is already counted' : 'today is not counted yet'}</p>
    ${st.comebackEarned ? `<p class="headline">🏅 Comeback badge earned — you came back after ${st.gap} days off and put in 15+ minutes.</p>` : ''}
    ${st.comebackOffer ? `<p class="headline">Welcome back. You haven't studied for ${st.gap} days.
      Complete just 15 minutes today to earn a Comeback Badge.</p>` : ''}`;
}
const fp = (k, v) => `<div class="fp"><span>${k}</span><b>${v}</b></div>`;

/* -------------------------------- journal -------------------------------- */
function renderHistory() {
  const list = Store.state.sessions.slice().reverse();
  $('#journal-count').textContent = list.length ? `${list.length} session${list.length === 1 ? '' : 's'}` : '';
  $('#history-list').innerHTML = list.length ? list.map(s => {
    const manual = (s.distractions || []).filter(d => d.type !== 'tab');
    const scoreCls = s.score >= 80 ? 'good' : s.score >= 55 ? 'warn' : 'bad';
    return `<div class="item" style="flex-direction:column;align-items:stretch">
      <div class="row between" style="margin:0">
        <div class="main">
          <span class="when">${fmtWhen(s.startedAt)}</span>
          <span class="sub">planned ${fmtShort(s.plannedMs)} · focused ${fmtDur(s.focusedMs)} · away ${fmtDur(s.awayMs)}</span>
        </div>
        <div class="acts">
          <span class="tag ${scoreCls}">${s.score}% focus</span>
          ${s.mood ? `<span class="tag">${MOODS[s.mood] || s.mood}</span>` : ''}
          <span class="tag">${s.tabSwitches} tab leaves</span>
          ${s.journal ? '<span class="tag good">journal</span>' : ''}
        </div>
      </div>
      ${manual.length ? `<div class="row" style="gap:6px">${manual.map(d =>
        `<span class="tag">${DISTRACTIONS[d.type]?.label || d.type}</span>`).join('')}</div>` : ''}
      ${s.journal && s.journal.text ? `<div class="jtext">${esc(s.journal.text)}</div>` : ''}
    </div>`;
  }).join('') : `<p class="empty">No sessions yet. Finish one and its autopsy, mood and reflection land here.</p>`;
}

function renderAll() {
  renderChips(); renderPlanLists(); renderInsights(); renderHistory();
  renderProgress(); renderTogether(); renderPartner(); renderTimer();
}

/* ============================ AUTOPSY MODAL ============================ */
let recHandle = null, recTimer = null, recLeft = 60;

function openAutopsy(s) {
  pendingSession = s;
  const manual = s.distractions.filter(d => d.type !== 'tab').length;
  $('#autopsy-grid').innerHTML = [
    ['Planned', fmtShort(s.plannedMs)],
    ['Actual focus', fmtDur(s.focusedMs)],
    ['Tab switches', s.tabSwitches],
    ['Time distracted', fmtDur(s.awayMs)],
    ['Distractions logged', manual],
    ['Focus score', s.score + '%']
  ].map(([k, v], i) => `<div class="ap ${k === 'Focus score' ? 'score' : ''}"><span>${k}</span><b>${v}</b></div>`).join('');

  $$('#moods .mchip').forEach(b => b.classList.remove('is-on'));
  $('#journal-text').value = '';
  $('#rec-timer').textContent = '60s';
  $('#rec-hint').textContent = Speech.supported
    ? '60 seconds — how did your session go?'
    : 'Speech recognition isn’t available in this browser — type your reflection instead.';
  $('#rec-btn').hidden = !Speech.supported;

  if (lastGain) {
    $('#autopsy-grid').insertAdjacentHTML('beforeend',
      `<div class="ap score"><span>XP earned</span><b>+${lastGain.xp}</b></div>`);
  }

  const next = $('#autopsy-next');
  const upcoming = queueDone < queue.length ? queue[queueDone] : null;
  if (s.kind === 'micro') {
    next.innerHTML = `You're already focused. Keep the momentum?
      <button class="btn small" id="continue-15">Continue 15 more minutes</button>`;
  } else if (upcoming) {
    next.innerHTML = `Next in your plan: <b>${upcoming.type === 'break' ? 'break' : 'focus'} ${upcoming.min} min</b> — starts when you save.`;
  } else {
    next.innerHTML = `<button class="btn small" id="take-break">Take a ${Store.state.settings.breakMin} minute break</button>`;
  }
  $('#autopsy').hidden = false;

  if (VoiceControl.on) {                       // hands-free: read the verdict, then listen
    const mins = Math.round(s.focusedMs / 60000);
    VoiceControl.say(
      `Session complete. ${mins} minute${mins === 1 ? '' : 's'} focused, focus score ${s.score} percent, ` +
      `${s.tabSwitches} tab leave${s.tabSwitches === 1 ? '' : 's'}. How did it go?`,
      { then: startVoiceJournal });
  }
}

function closeAutopsy(startNext) {
  stopRecording();
  $('#autopsy').hidden = true;
  pendingSession = null;
  celebrate();
  if (startNext !== false) {
    const nxt = nextQueueBlock();
    if (nxt) nxt.type === 'break' ? startBreak(nxt.min) : startFocus(nxt.min, 'focus');
  }
  renderAll();
}

function saveAutopsy() {
  if (pendingSession) {
    const text = $('#journal-text').value.trim();
    Store.updateSession(pendingSession.id, {
      mood: pendingSession.mood || null,
      journal: text ? { text, at: Date.now() } : null
    });
  }
  closeAutopsy(true);
}

function startRecording() {
  if (VoiceControl.on) { startVoiceJournal(); return; }
  if (!Speech.supported) return;
  recLeft = 60;
  $('#rec-btn').classList.add('rec');
  $('#rec-btn').textContent = 'Stop';
  $('#rec-timer').textContent = recLeft + 's';
  recTimer = setInterval(() => {
    recLeft--;
    $('#rec-timer').textContent = Math.max(0, recLeft) + 's';
    if (recLeft <= 0) stopRecording();
  }, 1000);
  recHandle = Speech.listen({
    continuous: true,
    onPartial: t => { $('#journal-text').value = t; },
    onError: e => {
      $('#rec-hint').textContent = e === 'not-allowed'
        ? 'Microphone permission was blocked — type your reflection instead.'
        : 'Voice capture stopped (' + e + '). You can type instead.';
      stopRecording();
    },
    onEnd: () => stopRecording(true)
  });
}

function stopRecording(fromEnd) {
  if (VoiceControl.state().dictating) VoiceControl.endDictation();
  if (recTimer) { clearInterval(recTimer); recTimer = null; }
  if (recHandle && !fromEnd) { Speech.stop(); }
  recHandle = null;
  const b = $('#rec-btn');
  if (b) { b.classList.remove('rec'); b.textContent = 'Start reflection'; }
}

/* ============================== WEATHER ============================== */
async function refreshWeather(place) {
  const st = Store.state.settings;
  const p = place || st.place;
  if (!p) return;
  try {
    const w = await Weather.current(p.lat, p.lon);
    lastWeather = { ...w, place: p.name };
    document.documentElement.dataset.mode = w.mood;
    $('#chip-weather').textContent = `${w.temp}° ${p.name}`;
    $('#chip-weather').title = `${w.label} — ${w.mood === 'night' ? 'Night Focus Mode' : w.rainy ? 'Rainy Focus Mode' : 'Focus Mode'}`;
    /* The palette already shifts for rain and night. No announcement needed. */
  } catch (e) {
    console.warn('Weather unavailable', e);
    $('#chip-weather').textContent = 'Weather unavailable';
  }
}

async function askLocation() {
  const answer = prompt('Which city are you studying in?\n(Leave empty to use your device location)', Store.state.settings.place?.name || '');
  if (answer === null) return;
  if (answer.trim()) {
    try {
      const p = await Weather.geocode(answer.trim());
      Store.set('place', p);
      refreshWeather(p);
    } catch (e) { toast(e.message || 'Could not find that place.'); }
    return;
  }
  if (!navigator.geolocation) { toast('This browser has no location access — type a city name instead.'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const p = { name: 'My location', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) };
      Store.set('place', p); refreshWeather(p);
    },
    () => toast('Location was blocked — type a city name instead.')
  );
}

/* ---------------- night mode even without weather ---------------- */
function applyTimeMode() {
  if (Store.state.settings.place) return;          // weather owns the mode
  const h = new Date().getHours();
  document.documentElement.dataset.mode = (h >= 21 || h < 6) ? 'night' : 'default';
}

/* ============================== REMINDERS ============================== */
function checkReminders() {
  const now = Date.now();
  const lead = Store.state.settings.reminderLeadMin * MIN;
  let changed = false;
  Store.state.planned.forEach(p => {
    if (p.status !== 'pending') return;
    if (!p.leadNotified && now >= p.at - lead && now < p.at) {
      p.leadNotified = true; changed = true;
      banner({ id: 'lead' + p.id, force: true,
        text: `Your ${p.durationMin} minute session starts in ${fmtAgo(p.at - now)}. Wrap up what you're doing.` });
      Notify.push('Session coming up', `${p.durationMin} minutes, starting in ${fmtAgo(p.at - now)}.`);
    }
    if (!p.dueNotified && now >= p.at) {
      p.dueNotified = true; changed = true;
      Ambience.chime(true);
      Notify.push('Time to focus', `Your ${p.durationMin} minute session is due now.`);
      banner({
        id: 'due' + p.id, force: true,
        text: `It's time — ${p.durationMin} minute session.`,
        actions: [
          { label: 'Start now', fn: () => { startFocus(p.durationMin, 'focus', p.id); switchView('today'); } },
          { label: 'Snooze 10m', fn: () => { Store.setPlanned(p.id, { at: p.at + 10 * MIN, dueNotified: false, leadNotified: false }); renderPlanLists(); } }
        ]
      });
    }
    if (now > p.at + 30 * MIN) { p.status = 'missed'; changed = true; }
  });
  if (changed) { Store.save(); renderPlanLists(); }
}

/* ============================ "I HAVE X MINUTES" ============================ */
function shapeTime(total) {
  const blocks = [];
  let left = Math.max(5, Math.min(300, total));
  if (left <= 20) { blocks.push({ type: 'focus', min: left }); return blocks; }
  const focusLen = left >= 60 ? 45 : 25;
  const breakLen = left >= 60 ? 8 : 5;
  while (left > 0) {
    if (left <= focusLen + 4) { blocks.push({ type: 'focus', min: left }); break; }
    blocks.push({ type: 'focus', min: focusLen });
    left -= focusLen;
    if (left <= breakLen + 4) { blocks.push({ type: 'focus', min: left }); break; }
    blocks.push({ type: 'break', min: breakLen });
    left -= breakLen;
  }
  return blocks;
}

function previewPlan(total) {
  const blocks = shapeTime(total);
  const box = $('#have-plan');
  box.hidden = false;
  box.innerHTML = blocks.map(b => `<span class="qstep">${b.type === 'break' ? 'Break' : 'Focus'} ${b.min}m</span>`)
    .join('<span class="muted">→</span>') + `<button class="btn small primary" id="start-shaped">Start this plan</button>`;
  $('#start-shaped').onclick = () => {
    queue = blocks; queueDone = 0;
    const first = nextQueueBlock();
    startFocus(first.min, 'focus');
    box.hidden = true;
  };
}

/* ============================ PROGRESSION ============================ */
let lastGain = null;

function celebrate() {
  if (lastGain) {
    banner({ kind: 'info', timeout: 9000,
      html: `<b>+${lastGain.xp} XP</b> — ${lastGain.lines.map(l => esc(l[0])).join(' · ')}` });
    if (lastGain.levelUp) {
      Ambience.chime(true);
      banner({ kind: 'info', timeout: 14000,
        html: `${lastGain.levelUp.icon} <b>Level ${lastGain.levelUp.n} — ${esc(lastGain.levelUp.name)}</b>` +
              (lastGain.levelUp.ceil ? ` · ${lastGain.levelUp.toNext} XP to ${esc(lastGain.levelUp.nextName)}` : '') });
    }
    lastGain = null;
  }
  Progress.check().forEach(a => banner({ kind: 'info', timeout: 13000,
    html: `${a.icon} <b>Achievement unlocked — ${esc(a.title)}</b> · ${esc(a.desc)}` }));
  renderProgress();
}

function renderProgress() {
  const lv = Progress.level(Store.state.progress.xp);
  $('#chip-level').textContent = `Lv ${lv.n}`;
  $('#chip-level').title = `${lv.name} — ${lv.xp} XP`;
  $('#level-xp').textContent = lv.xp + ' XP';
  $('#level-box').innerHTML = `
    <div class="lvl-top">
      <div>
        <div class="lvl-name">Level ${lv.n} · ${esc(lv.name)}</div>
        <div class="lvl-sub">${lv.ceil ? `${lv.toNext} XP to ${esc(lv.nextName)}` : 'Top of the ladder. Nothing left to climb.'}</div>
      </div>
    </div>
    <div class="xp-bar"><div class="xp-fill" style="width:${lv.pct}%"></div></div>
    <p class="muted">XP comes from focused minutes, finishing what you planned, never leaving the tab,
      keeping a streak alive and studying alongside someone.</p>`;

  const list = Progress.all();
  $('#ach-count').textContent = `${list.filter(a => a.at).length} / ${list.length} unlocked`;
  $('#ach-grid').innerHTML = list.map(a => `
    <div class="ach ${a.at ? 'got' : ''}" title="${a.at ? 'Unlocked ' + fmtWhen(a.at) : 'Locked'}">
      <div class="ico">${a.icon}</div><b>${esc(a.title)}</b><span>${esc(a.desc)}</span>
    </div>`).join('');
}

/* ============================== ROOMS ============================== */
const roomHandlers = {
  onPeer: m => {
    const r = Store.state.room;
    if (r && m.name && !r.partnerName) { r.partnerName = m.name; Store.save(); renderRoomCard(); }
    renderPartner();
  },
  onStatus: () => { renderPartner(); renderRoomCard(); },
  onLive: () => { pendingReply = null; renderRoomCard(); toast('Live channel open — you can see each other now.'); },
  onNudge: m => {
    document.body.classList.add('nudged');
    setTimeout(() => document.body.classList.remove('nudged'), 1400);
    Ambience.chime(true);
    toast(`${m.name || 'Your friend'} nudged you. Back to it.`);
  },
  onDone: m => {
    const r = Store.state.room;
    if (!r || !m.summary) return;
    r.theirs = { ...m.summary, name: m.name || r.partnerName };
    r.partnerName = r.partnerName || m.name;
    Store.save();
    toast(`${r.partnerName || 'Your friend'} finished their session.`);
    tryDuel();
  }
};

let pendingReply = null;      // the guest's answer link, waiting to be sent back

function enterRoom(room, myName, offer) {
  Store.set('myName', myName);
  Store.setRoom({
    id: room.id, host: room.host, role: room.role,
    partnerName: room.role === 'guest' ? room.host : (room.partnerName || null),
    myName, startAt: room.startAt, durationMin: room.durationMin,
    started: false, mine: null, theirs: null, done: false,
    invite: Together.inviteLink(room)
  });
  Together.join(Store.state.room, myName, roomHandlers);
  $('#join-card').hidden = true;
  renderAll();

  /* The invite carried the host's live-sync offer, so answer it right away
     and hand the guest a single link to send back. */
  if (offer) {
    Together.answerLiveInvite({ d: offer })
      .then(reply => {
        pendingReply = reply;
        $('#reply-to').textContent = room.host || 'your friend';
        $('#reply-link').textContent = reply;
        renderRoomCard();
        copyText(reply, 'Reply link');
        banner({ kind: 'info', timeout: 15000,
          text: `Joined. Send the reply link back to ${room.host} so you can see each other's stats — it's on your clipboard.` });
      })
      .catch(e => toast('Could not set up live stats: ' + e.message));
  }
}

function leaveRoom(quiet) {
  pendingReply = null;
  Together.leave();
  Store.setRoom(null);
  if (!quiet) toast('Left the room. Your session history keeps everything you already did.');
  renderAll();
}

function reportToRoom(record) {
  const r = Store.state.room;
  if (!r || record.roomId !== r.id) return;
  r.mine = {
    focusedMs: record.focusedMs, awayMs: record.awayMs, tabSwitches: record.tabSwitches,
    distractions: (record.distractions || []).filter(d => d.type !== 'tab').length,
    score: record.score
  };
  Store.save();
  Together.finish(r.mine);
  tryDuel();
}

function tryDuel() {
  const r = Store.state.room;
  if (!r || !r.mine || !r.theirs || r.done) return;
  r.done = true;
  r.partnerName = r.theirs.name || r.partnerName || 'Your friend';
  Store.save();
  const res = Store.recordDuel(r.partnerName, r.mine, r.theirs);
  if (res.result === 'win') { Store.state.progress.xp += 15; Store.save(); }
  showDuel(r, res);
  renderAll();
}

function showDuel(r, res) {
  const side = (title, s, win) => `
    <div class="duel-side ${win ? 'win' : ''}">
      <h3>${win ? '★ ' : ''}${esc(title)}</h3>
      <div class="big">${s.score}%</div>
      <div class="line"><span>Focused</span><b>${fmtDur(s.focusedMs)}</b></div>
      <div class="line"><span>Away</span><b>${fmtDur(s.awayMs)}</b></div>
      <div class="line"><span>Tab leaves</span><b>${s.tabSwitches}</b></div>
      <div class="line"><span>Distractions</span><b>${s.distractions}</b></div>
    </div>`;
  const win = res.result === 'win', loss = res.result === 'loss';
  $('#duel-title').textContent = win ? 'You won the duel' : loss ? 'They took this one' : 'Dead level';
  $('#duel-body').innerHTML = `
    <p class="muted">${win ? 'You kept your eyes on the page longer than they did.'
      : loss ? `${esc(r.partnerName)} held focus better this time. Rematch?`
      : 'Identical focus scores. Statistically suspicious.'}</p>
    <div class="duel-row">
      ${side(r.myName || 'You', r.mine, win)}
      <div class="duel-vs">vs</div>
      ${side(r.partnerName || 'Your friend', r.theirs, loss)}
    </div>${win ? '<p class="muted">+15 XP for the win.</p>' : ''}`;
  const rec = res.record;
  $('#duel-record').innerHTML = `Against ${esc(rec.name)}: <b>${rec.wins}W ${rec.losses}L ${rec.draws}D</b>`;
  $('#duel-modal').hidden = false;
}

/* --------------------------- room rendering --------------------------- */
function renderRoomCard() {
  const r = Store.state.room;
  $('#room-live').hidden = !r;
  $('#room-make').hidden = !!r;
  if (!r) return;
  const now = Date.now(), endAt = r.startAt + r.durationMin * MIN;
  const phase = now < r.startAt ? 'starts in ' + fmtClock(r.startAt - now)
              : now < endAt ? fmtClock(endAt - now) + ' left'
              : r.mine ? 'finished' : 'window closed';
  const st = Together.status();
  $('#room-partner').textContent = r.partnerName || 'a friend';
  $('#room-status').textContent = st.live ? 'live' : st.linked ? 'linked' : 'solo';
  $('#room-status').className = 'pill ' + (st.live || st.linked ? 'live' : '');
  $('#room-grid').innerHTML = [
    ['Session', phase],
    ['Length', r.durationMin + ' min'],
    ['You', esc(r.myName || 'You')],
    ['Partner', esc(r.partnerName || 'unnamed so far')]
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('#room-result-copy').hidden = !r.mine;
  $('#room-rematch').hidden = !(r.done || (now > endAt && r.mine));

  $('#live-pill').textContent = st.live ? 'connected' : st.linked ? 'same browser' : 'not connected';
  $('#live-pill').className = 'pill ' + (st.live ? 'live' : '');
  $('#live-reply').hidden = !pendingReply || st.live;
  $('#live-host').hidden = !!pendingReply || st.live;
}

function renderRivals() {
  const fr = Store.friends();
  const cs = Store.coStreak();
  $('#co-streak').textContent = cs ? `${cs}-day co-study streak` : '';
  $('#rivals').innerHTML = fr.length ? fr.map(f => `
    <div class="rival">
      <div class="who">
        <b>${esc(f.name)}</b>
        <span class="sub">${f.duels} duel${f.duels === 1 ? '' : 's'} · ${fmtShort(f.together)} studied side by side</span>
      </div>
      <div class="wl"><span class="w">${f.wins}</span><i>W</i> <span class="l">${f.losses}</span><i>L</i> ${f.draws}<i>D</i></div>
    </div>`).join('') : `<p class="empty">No rivals yet. Create a room, send the link, and the first duel writes itself here.</p>`;

  const d = Store.state.duels.slice().reverse().slice(0, 10);
  $('#duel-list').innerHTML = d.length ? d.map(x => `
    <div class="item">
      <div class="main">
        <span class="when">${x.result === 'win' ? 'Beat' : x.result === 'loss' ? 'Lost to' : 'Drew with'} ${esc(x.partner)}</span>
        <span class="sub">${fmtWhen(x.at)} · you ${x.mine.score}% vs them ${x.theirs.score}%</span>
      </div>
      <div class="acts">
        <span class="tag ${x.result === 'win' ? 'good' : x.result === 'loss' ? 'bad' : ''}">${x.result}</span>
        <span class="tag">${x.mine.tabSwitches} v ${x.theirs.tabSwitches} tab leaves</span>
      </div>
    </div>`).join('') : `<p class="empty">Finished duels land here with the full head-to-head.</p>`;
}

const renderTogether = () => { renderRoomCard(); renderRivals(); };

function renderPartner() {
  const r = Store.state.room, panel = $('#partner-panel');
  if (!r) { panel.hidden = true; return; }
  panel.hidden = false;
  const st = Together.status(), p = st.peer;
  $('#partner-name').textContent = r.partnerName || (p && p.name) || 'Your friend';
  const dot = $('#partner-dot');
  const state = $('#partner-state');

  if (p && !st.stale && p.waiting) {                 // joined, not studying yet
    dot.className = 'pdot on';
    state.textContent = p.done ? 'finished' : 'here, waiting';
    state.className = 'pill live';
    $('#nudge-btn').hidden = false;
    $('#partner-stats').innerHTML = p.done
      ? `<div><span class="k">Their session</span><b>done</b></div>`
      : `<div><span class="k">Status</span><b>Ready</b></div>`;
    $('#partner-lead').className = 'lead';
    $('#partner-lead').innerHTML = p.done
      ? `They have finished. Your result settles the duel.`
      : `<b>${esc(r.partnerName || p.name || 'Your friend')}</b> is in the room. Both timers start at
         ${new Date(r.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
    return;
  }

  if (!p || st.stale) {
    dot.className = 'pdot';
    state.textContent = st.linked ? 'no signal' : 'not connected';
    state.className = 'pill';
    $('#partner-stats').innerHTML =
      `<div><span class="k">Live stats</span><b>—</b></div>`;
    $('#partner-lead').textContent = st.stale
      ? 'Their page went quiet — they may have closed the tab.'
      : st.linked
        ? 'Connected. Waiting for their first update.'
        : 'Their timer runs off the same clock as yours, so you still start and finish together. ' +
          'To see their live numbers, swap live-sync links on the Together tab.';
    $('#nudge-btn').hidden = !st.linked;
    return;
  }
  dot.className = 'pdot ' + (p.hidden ? 'away' : 'on');
  state.textContent = p.paused ? 'paused' : p.hidden ? 'left the tab' : 'focusing';
  state.className = 'pill ' + (p.paused ? 'paused' : p.hidden ? 'away' : 'live');
  $('#nudge-btn').hidden = false;
  $('#partner-stats').innerHTML = [
    ['Focused', fmtDur(p.focusedMs || 0)],
    ['Away', fmtDur(p.awayMs || 0)],
    ['Tab leaves', p.tabSwitches || 0],
    ['Distractions', p.distractions || 0]
  ].map(([k, v]) => `<div><span class="k">${k}</span><b>${v}</b></div>`).join('');

  if (A) {
    const diff = A.focusedMs - (p.focusedMs || 0);
    const lead = $('#partner-lead');
    if (Math.abs(diff) < 20000) { lead.className = 'lead'; lead.innerHTML = `Neck and neck. <b>${fmtDur(Math.abs(diff))}</b> between you.`; }
    else if (diff > 0) { lead.className = 'lead ahead'; lead.innerHTML = `You're <b>${fmtDur(diff)}</b> ahead.`; }
    else { lead.className = 'lead behind'; lead.innerHTML = `You're <b>${fmtDur(-diff)}</b> behind. ${p.hidden ? 'They just left the tab though.' : ''}`; }
  } else {
    /* They are working and you are not. This is the whole point of the feature. */
    const lead = $('#partner-lead');
    lead.className = 'lead behind';
    lead.innerHTML = p.hidden
      ? `<b>${esc(r.partnerName || p.name || 'They')}</b> stepped away — you haven't started at all.`
      : `<b>${esc(r.partnerName || p.name || 'They')}</b> is ${fmtDur(p.focusedMs || 0)} in. You haven't started.`;
  }
}

/* ---------------------------- room heartbeat ---------------------------- */
let roomBeat = 0;
function roomTick() {
  const r = Store.state.room;
  if (!r) return;
  const now = Date.now(), endAt = r.startAt + r.durationMin * MIN;

  if (!r.started && now >= r.startAt && now < endAt && !A && !brk) {
    r.started = true; Store.save();
    const remaining = Math.max(1, Math.round((endAt - now) / MIN));
    Ambience.chime(true);
    Notify.push('Your room is starting', `${r.partnerName || 'Your friend'} is starting at the same moment.`);
    banner({ kind: 'info', timeout: 8000,
      text: `Room started — ${remaining} minutes alongside ${r.partnerName || 'your friend'}.` });
    startFocus(remaining, 'focus');
  }

  /* Presence is not the same thing as a running session: a friend who has
     joined but is waiting for the start time must still show up. */
  if (++roomBeat % 2 === 0) {
    if (A && A.roomId === r.id) {
      Together.publish({
        waiting: false,
        focusedMs: Math.round(A.focusedMs), awayMs: Math.round(A.awayMs),
        tabSwitches: A.tabSwitches, distractions: A.distractions.filter(d => d.type !== 'tab').length,
        paused: A.paused, hidden: document.hidden
      });
    } else {
      Together.publish({ waiting: true, startAt: r.startAt, done: !!r.mine });
    }
  }

  if (now > endAt + 86400000) leaveRoom(true);   // a day later nobody is coming back; drop it
  renderRoomCard(); renderPartner();
}

/* ----------------------------- link plumbing ----------------------------- */
async function copyText(text, what) {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied to your clipboard.`); }
  catch (e) { prompt('Copy this link:', text); }
}

function showJoinCard(room, offer) {
  const now = Date.now(), endAt = room.startAt + room.durationMin * MIN;
  if (now > endAt) {
    banner({ text: `${room.host}'s session has already finished. Start a fresh room and send them a link back.` });
    switchView('together');
    return;
  }
  $('#join-card').hidden = false;
  $('#join-name').value = Store.state.settings.myName || '';
  const late = now > room.startAt;
  $('#join-text').innerHTML = late
    ? `<b>${esc(room.host)}</b> is already studying — ${fmtClock(endAt - now)} left of a ${room.durationMin} minute session. Join and your timer picks up the remainder.`
    : `<b>${esc(room.host)}</b> invited you to a <b>${room.durationMin} minute</b> session starting in <b>${fmtClock(room.startAt - now)}</b>. Both timers begin on their own.`;
  $('#join-accept').onclick = () => enterRoom(room, ($('#join-name').value || 'Guest').trim().slice(0, 24), offer);
  $('#join-decline').onclick = () => { $('#join-card').hidden = true; };
  switchView('together');
}

function applyResultLink(res) {
  const r = Store.state.room;
  if (!r || r.id !== res.room) {
    toast('That result belongs to a different room, so there was nothing to compare it with.');
    return;
  }
  r.theirs = { ...res, name: res.name };
  r.partnerName = res.name || r.partnerName;
  Store.save();
  tryDuel();
  if (!r.mine) toast(`${res.name}'s result is saved. Finish your own session to settle the duel.`);
}

/* ============================== SHELL CHROME ============================== */
function hidePreloader() {
  const pre = $('#preloader');
  if (!pre) return;
  pre.classList.add('done');
  setTimeout(() => pre.remove(), 700);
}

function openDrawer() { $('#drawer').hidden = false; $('#drawer-back').hidden = false; }
function closeDrawer() { $('#drawer').hidden = true; $('#drawer-back').hidden = true; }

function wireShell() {
  $('#open-settings').onclick = openDrawer;
  $('#quick-settings').onclick = openDrawer;
  $('#close-settings').onclick = closeDrawer;
  $('#drawer-back').onclick = closeDrawer;

  $('#focus-expand').onclick = () => {
    if (A || brk) { zenOff = !zenOff; syncZen(); }
    else document.body.classList.toggle('focus-mode');
  };

  $('#quick-sound').onclick = () => {
    if (Ambience.playing) Ambience.stop(); else Ambience.play(Store.state.settings.ambience);
    paintSound();
  };
  $('#quick-voice').onclick = () => VoiceControl.on ? voiceOff() : voiceOn();
  $('#mic-btn').onclick = () => VoiceControl.on ? voiceOff() : voiceOn();
  $('#promo-voice').onclick = voiceOn;
  $('#promo-hide').onclick = () => { Store.set('promoHidden', true); renderVoice(VoiceControl.state()); };

  document.addEventListener('keydown', e => {
    if ((e.key === 'm' || e.key === 'M') && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)
        && $('#autopsy').hidden && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      VoiceControl.on ? voiceOff() : voiceOn();
      return;
    }
    if (e.key !== 'Escape') return;
    if (!$('#drawer').hidden) closeDrawer();
    else if (document.body.classList.contains('focus-mode')) { zenOff = true; syncZen(); document.body.classList.remove('focus-mode'); }
  });
}

function wireTogether() {
  const makeRoom = async withLive => {
    const name = ($('#room-name').value || Store.state.settings.myName || 'Me').trim().slice(0, 24);
    const room = Together.makeRoom({
      name,
      durationMin: parseInt($('#room-dur').value, 10) || 45,
      startInMin: parseInt($('#room-lead').value, 10) || 5
    });
    enterRoom(room, name);

    let link = Store.state.room.invite;
    if (withLive) {
      try {
        $('#invite-hint').hidden = false;
        $('#invite-hint').textContent = 'Building your live link…';
        const offer = await Together.createOffer();
        link = Together.inviteLink(room, offer);
        Store.state.room.invite = link; Store.save();
        $('#live-warn').hidden = false;
      } catch (e) {
        toast('Live stats are unavailable in this browser — the synced timer still works.');
      }
    }
    $('#invite-box').hidden = false; $('#invite-hint').hidden = false;
    $('#invite-link').textContent = link;
    $('#invite-hint').textContent = withLive
      ? 'Send that one link. They join, and their browser sends you a reply link to paste below. Keep this tab open.'
      : 'Send that to your friend. When the clock hits the start time, both sides begin automatically.';
    copyText(link, 'Invite link');
    renderRoomCard();
  };
  $('#room-create').onclick = () => makeRoom(false);
  $('#room-create-live').onclick = () => makeRoom(true);
  $('#invite-copy').onclick = () => copyText($('#invite-link').textContent, 'Invite link');
  $('#room-invite-copy').onclick = () => Store.state.room && copyText(Store.state.room.invite, 'Invite link');
  $('#room-leave').onclick = () => { if (confirm('Leave this room?')) leaveRoom(); };
  $('#room-rematch').onclick = () => {
    const old = Store.state.room;
    if (!old) return;
    const name = old.myName || 'Me';
    const room = Together.makeRoom({ name, durationMin: old.durationMin, startInMin: 3 });
    const partner = old.partnerName;
    leaveRoom(true);
    enterRoom(room, name);
    Store.state.room.partnerName = partner; Store.save();
    copyText(Store.state.room.invite, 'Rematch link');
    toast(`Rematch set up — send the link to ${partner || 'your friend'}. Starts in 3 minutes.`);
    renderAll();
  };
  $('#room-result-copy').onclick = () => {
    const r = Store.state.room;
    if (r && r.mine) copyText(Together.resultLink(r, r.myName || 'Your friend', r.mine), 'Result link');
  };
  $('#nudge-btn').onclick = () => { Together.nudge(); toast('Nudge sent.'); };

  $('#live-create').onclick = async () => {
    try {
      $('#live-state').textContent = 'gathering network routes…';
      const link = await Together.createLiveInvite();
      $('#live-box').hidden = false; $('#live-warn').hidden = false;
      $('#live-link').textContent = link;
      $('#live-state').textContent = 'Send this, then paste their reply below. Keep this tab open.';
      copyText(link, 'Live link');
    } catch (e) { $('#live-state').textContent = e.message; }
  };
  $('#live-copy').onclick = () => copyText($('#live-link').textContent, 'Live link');
  $('#reply-copy').onclick = () => copyText($('#reply-link').textContent, 'Reply link');

  $('#live-connect').onclick = async () => {
    const text = $('#live-paste-input').value.trim();
    if (!text) { $('#live-state').textContent = 'Paste the link they sent you first.'; return; }
    try {
      const payload = Together.readLiveLink(text);
      if (payload.k === 'o') {                       // they sent an offer: answer it
        $('#live-state').textContent = 'building your reply…';
        const reply = await Together.answerLiveInvite(payload);
        pendingReply = reply;
        $('#reply-to').textContent = payload.n || 'your friend';
        $('#reply-link').textContent = reply;
        renderRoomCard();
        copyText(reply, 'Reply link');
      } else {                                       // they answered ours: finish the handshake
        await Together.completeLive(payload);
        $('#live-state').textContent = 'connecting…';
        $('#live-paste-input').value = '';
      }
    } catch (e) { $('#live-state').textContent = e.message; }
  };

  $('#duel-close').onclick = () => { $('#duel-modal').hidden = true; };
  $('#duel-ok').onclick = () => { $('#duel-modal').hidden = true; };
}

/**
 * Acts on an invite / result / live link in the address bar.
 *
 * This runs on load AND on hashchange: if your friend already has Study
 * Lockin open, tapping an invite link only changes the hash — the browser
 * reuses the tab and never reloads, so a load-only handler would sit there
 * doing nothing while both of you wondered why it wasn't connecting.
 */
function handleHash() {
  const hash = Together.readHash();
  if (!hash) return;
  Together.clearHash();
  const r = Store.state.room;

  if (hash.kind === 'join') {
    if (r && r.id === hash.room.id) {
      switchView('together');
      toast("You're already in that room.");
    } else if (r && !r.done && Date.now() < r.startAt + r.durationMin * MIN) {
      switchView('together');
      banner({
        text: `${hash.room.host} invited you to another room. Leave your current one to join it?`,
        actions: [{ label: 'Leave and join', fn: () => { leaveRoom(true); showJoinCard(hash.room, hash.offer); } }]
      });
    } else {
      if (r) leaveRoom(true);
      showJoinCard(hash.room, hash.offer);
    }
  } else if (hash.kind === 'result') {
    applyResultLink(hash.result);
    switchView('together');
  } else if (hash.kind === 'live') {
    switchView('together');
    if (hash.payload.k === 'o') {
      Together.answerLiveInvite(hash.payload).then(reply => {
        pendingReply = reply;
        $('#reply-to').textContent = hash.payload.n || 'your friend';
        $('#reply-link').textContent = reply;
        renderRoomCard();
        copyText(reply, 'Reply link');
      }).catch(e => toast(e.message));
    } else {
      Together.completeLive(hash.payload).catch(e => toast(e.message));
    }
  }
}

function initTogether() {
  $('#room-name').value = Store.state.settings.myName || '';
  const r = Store.state.room;
  if (r) Together.join(r, r.myName, roomHandlers);

  handleHash();
  window.addEventListener('hashchange', handleHash);
  setInterval(roomTick, 1000);
}

/* ============================== HANDS-FREE ============================== */
let lastWeather = null;
const SAY_LIST = [
  ['Lockin, start 45 minutes', 'begins a focus session'],
  ['Lockin, pause / resume', 'holds the clock and picks it up again'],
  ['Lockin, add five minutes', 'extends the session'],
  ['Lockin, finish', 'ends the session and opens the autopsy'],
  ['Lockin, take a five minute break', 'starts a break'],
  ['Lockin, I got distracted by my phone', 'logs the distraction'],
  ['Lockin, play rain / stop the music', 'controls the focus sound'],
  ['Lockin, louder / quieter', 'nudges the volume'],
  ['Lockin, I have 35 minutes', 'shapes the time into blocks and starts'],
  ['Lockin, plan 40 minutes at 8pm', 'schedules a session for later'],
  ['Lockin, how long left', 'reads out the time remaining'],
  ['Lockin, how am I doing', 'reads out focus, tab leaves, distractions'],
  ['Lockin, what is my streak / level', 'reads out your progress'],
  ['Lockin, read me the quote', 'reads today’s quote aloud'],
  ['Lockin, what is the weather', 'reads the current conditions'],
  ['Lockin, set my goal to 90 minutes', 'changes the daily target'],
  ['Lockin, set my city to Chennai', 'sets the weather location'],
  ['Lockin, create a room', 'starts a co-study room and copies the link'],
  ['Lockin, nudge', 'pokes your study partner'],
  ['Lockin, show insights / journal / plan', 'switches view'],
  ['Lockin, it was good', 'answers the mood question after a session'],
  ['Lockin, stop listening', 'turns hands-free off']
];

function vbDid(msg, cls) {
  const el = $('#vb-did');
  if (!el) return;
  el.textContent = msg;
  el.className = 'vb-did ' + (cls || 'ok');
}
function voiceSay(text, opts) { vbDid(text); VoiceControl.say(text, opts); }

function voiceOn() {
  if (!VoiceControl.supported) {
    /* Stated where the button is, not thrown across the screen. */
    $('#voice-blurb').textContent = 'Speech recognition needs Chrome or Edge. The typed command box below works everywhere.';
    openDrawer();
    return;
  }
  Store.set('handsFree', true);
  VoiceControl.start();
  vbDid('Listening. Say: Lockin, start 25 minutes.');   // no pop-up, no announcement
}
function voiceOff() {
  Store.set('handsFree', false);
  VoiceControl.stop();
  renderVoice(VoiceControl.state());
}

function renderVoice(st) {
  const bar = $('#voicebar');
  if (!bar) return;

  /* Hands-free is the app's signature, so it gets three homes: a button in
     the header, a prompt on Today until it's discovered, and the tray on
     the focus card (the one that survives full-screen focus). */
  const mic = $('#mic-btn');
  if (mic) {
    mic.className = 'chip mic' + (st.dictating ? ' rec' : st.on ? ' on' : '');
    mic.setAttribute('aria-pressed', st.on ? 'true' : 'false');
    mic.hidden = !st.supported;
    $('#mic-label').textContent = st.dictating ? 'Recording' : st.on ? 'Listening' : 'Hands-free';
  }
  const promo = $('#voice-promo');
  if (promo) promo.hidden = st.on || !st.supported || Store.state.settings.promoHidden === true;
  $('#quick-voice').classList.toggle('on', st.on);

  bar.hidden = !st.on;
  bar.className = 'voicebar' + (st.listening ? ' live' : '') + (st.dictating ? ' dictating' : '');
  document.body.classList.toggle('voice-on', st.on);     // keep the bar off the footer
  $('#voice-pill').textContent = !st.supported ? 'Not supported here'
    : st.dictating ? 'Recording' : st.on ? (st.listening ? 'Listening' : 'Starting…') : 'Off';
  $('#voice-toggle').textContent = st.on ? 'Turn off hands-free' : 'Turn on hands-free';
  $('#quick-voice-state').textContent = st.on ? 'on' : 'off';
  $('#wake-toggle').checked = st.requireWake;
  $('#wake-toggle').checked = st.requireWake;
  if (st.dictating) $('#vb-heard').textContent = 'Recording your reflection — say “done” when you finish.';
}

/* --------------------------- the command desk --------------------------- */
function handleIntent(p) {
  if (!p.intent) {
    if (p.woke) {
      vbDid(p.text ? `No command in “${p.text}” — say “help” for the list.` : 'Listening.', 'no');
      VoiceControl.say(p.text ? 'I didn’t catch a command.' : 'Listening.');
    }
    return;
  }
  const SOUNDS = { rain: 'rain', waves: 'waves', ocean: 'waves', 'café': 'cafe', cafe: 'cafe',
                   coffee: 'cafe', night: 'night', crickets: 'night', 'lo-fi': 'lofi', 'lo fi': 'lofi',
                   lofi: 'lofi', music: 'lofi', 'white noise': 'white', 'brown noise': 'brown', noise: 'white' };

  switch (p.intent) {
    case 'wake': voiceSay('Listening.'); break;

    case 'help':
      switchView('today');
      const d = $('.cmds'); if (d) d.open = true;
      voiceSay('You can say: start 25 minutes. pause. resume. add five minutes. finish. ' +
               'take a break. I got distracted by my phone. play rain. how long left. ' +
               'how am I doing. create a room. or show insights. The full list is on screen.');
      break;

    case 'voice.off': voiceSay('Hands-free off.', { then: voiceOff }); break;

    case 'start': {
      if (A) { voiceSay('A session is already running.'); break; }
      const min = p.min || currentDuration();
      switchView('today');
      startFocus(min, p.micro ? 'micro' : 'focus');
      voiceSay(`Starting ${min} minute${min === 1 ? '' : 's'}. Go.`);
      break;
    }
    case 'pause':
      if (A && !A.paused) { togglePause(); voiceSay('Paused.'); }
      else voiceSay(A ? 'Already paused.' : 'Nothing is running.');
      break;
    case 'resume':
      if (A && A.paused) { togglePause(); voiceSay('Back to it.'); }
      else voiceSay(A ? 'Already running.' : 'Nothing to resume.');
      break;
    case 'extend': {
      const m = p.min || 5;
      if (A) { extend(m); voiceSay(`Added ${m} minutes.`); } else voiceSay('No session to extend.');
      break;
    }
    case 'finish':
      if (A) { voiceSay('Wrapping up.'); finish(false); } else voiceSay('Nothing to finish.');
      break;
    case 'discard':
      if (A) { discard(true); voiceSay('Discarded. Nothing saved.'); } else voiceSay('Nothing to discard.');
      break;
    case 'break': {
      const m = p.min || Store.state.settings.breakMin;
      if (A) finish(false);
      startBreak(m);
      voiceSay(`${m} minute break. Stand up.`);
      break;
    }
    case 'skipbreak':
      if (brk) { endBreak(true); voiceSay('Break skipped.'); } else voiceSay('No break running.');
      break;

    case 'distract':
      if (A) {
        logDistraction(p.type);
        voiceSay(`${DISTRACTIONS[p.type].label} logged. Back to it.`);
      } else voiceSay('Log distractions while a session is running.');
      break;

    case 'sound': {
      const key = SOUNDS[p.which] || 'lofi';
      Store.set('ambience', key); Store.set('soundChosen', true);
      Ambience.play(key); paintSound();
      voiceSay(`Playing ${key === 'lofi' ? 'lo-fi' : key}.`);
      break;
    }
    case 'sound.off': Ambience.stop(); paintSound(); voiceSay('Sound off.'); break;
    case 'volume': {
      const v = Math.max(0, Math.min(1, Store.state.settings.volume + p.delta));
      Store.set('volume', v); Ambience.setVolume(v); $('#volume').value = Math.round(v * 100);
      voiceSay(`Volume ${Math.round(v * 100)} percent.`);
      break;
    }

    case 'shape': {
      switchView('today');
      previewPlan(p.min);
      const go = $('#start-shaped');
      voiceSay(`${p.min} minutes. Shaping it into blocks.`, { then: () => go && go.click() });
      break;
    }
    case 'plan': {
      const parsed = Parser.parse(p.phrase);
      Store.addPlanned(parsed.at, parsed.durationMin);
      renderPlanLists();
      voiceSay(`Planned: ${parsed.durationMin} minutes, ${fmtWhen(parsed.at)}.`);
      break;
    }

    case 'room.create': {
      const name = Store.state.settings.myName || 'Me';
      const room = Together.makeRoom({ name, durationMin: currentDuration(), startInMin: 5 });
      enterRoom(room, name);
      copyText(Store.state.room.invite, 'Invite link');
      switchView('together');
      voiceSay(`Room made for ${room.durationMin} minutes, starting in five. The invite link is on your clipboard.`);
      break;
    }
    case 'room.nudge':
      if (Store.state.room) { Together.nudge(); voiceSay('Nudged.'); } else voiceSay('You are not in a room.');
      break;
    case 'room.rematch':
      if (Store.state.room) { $('#room-rematch').click(); } else voiceSay('No room to rematch.');
      break;
    case 'room.copy':
      if (Store.state.room) { copyText(Store.state.room.invite, 'Invite link'); voiceSay('Invite link copied.'); }
      else voiceSay('You are not in a room.');
      break;

    /* ------------------------- questions, answered ------------------------- */
    case 'ask.time':
      if (A) voiceSay(`${fmtDur(Math.max(0, A.plannedMs - A.focusedMs))} left.`);
      else if (brk) voiceSay(`${fmtDur(brk.endsAt - Date.now())} of break left.`);
      else voiceSay('No session running.');
      break;
    case 'ask.status': {
      if (!A) {
        const t = Store.totals();
        voiceSay(`Today you have focused ${fmtShort(Store.todayMs())}. Average focus score ${t.avgScore} percent.`);
        break;
      }
      const away = A.awayMs, manual = A.distractions.filter(x => x.type !== 'tab').length;
      voiceSay(`${fmtDur(A.focusedMs)} focused, ${A.tabSwitches} tab leave${A.tabSwitches === 1 ? '' : 's'}, ` +
               `${fmtDur(away)} away, ${manual} distraction${manual === 1 ? '' : 's'} logged.`);
      break;
    }
    case 'ask.streak': {
      const st = Store.streak();
      voiceSay(st.current
        ? `${st.current} day streak. ${st.studiedToday ? 'Today is counted.' : 'Today is not counted yet.'}`
        : 'No streak yet. Finish a session today to start one.');
      break;
    }
    case 'ask.level': {
      const lv = Progress.level(Store.state.progress.xp);
      voiceSay(`Level ${lv.n}, ${lv.name}. ${lv.xp} XP${lv.ceil ? `, ${lv.toNext} to ${lv.nextName}` : ''}.`);
      break;
    }
    case 'ask.quote':
      voiceSay(`${$('#quote-text').textContent} ${$('#quote-author').textContent}`);
      break;
    case 'ask.weather':
      voiceSay(lastWeather
        ? `${lastWeather.label}, ${lastWeather.temp} degrees in ${lastWeather.place}.`
        : 'No location set. Say: Lockin, set my city to, then the name.');
      break;

    case 'goal': {
      if (!p.min || isNaN(p.min)) { voiceSay('Say it with a number, like: set my goal to ninety minutes.'); break; }
      const v = Math.max(5, Math.min(600, p.min));
      Store.set('dailyGoalMin', v); $('#goal-input').value = v; renderChips(); renderInsights();
      voiceSay(`Daily goal is now ${v} minutes.`);
      break;
    }
    case 'city': {
      const place = (p.place || '').replace(/\b(please|thanks)\b/g, '').trim();
      if (!place) { voiceSay('Which city?'); break; }
      voiceSay(`Looking up ${place}.`);
      Weather.geocode(place)
        .then(loc => { Store.set('place', loc); return refreshWeather(loc); })
        .then(() => voiceSay(lastWeather ? `${lastWeather.label}, ${lastWeather.temp} degrees in ${lastWeather.place}.` : 'Location set.'))
        .catch(e => voiceSay('I could not find that place.'));
      break;
    }

    case 'view':
      switchView(p.view);
      vbDid('Showing ' + p.view);
      break;

    case 'mood': {
      if ($('#autopsy').hidden) { voiceSay('No session to rate right now.'); break; }
      const map = { great: 'great', good: 'good', ok: 'ok', okay: 'ok', fine: 'ok',
                    rough: 'rough', bad: 'bad', terrible: 'bad', awful: 'bad' };
      const chip = $(`#moods .mchip[data-m="${map[p.mood] || 'ok'}"]`);
      if (chip) chip.click();
      voiceSay('Saved.', { then: () => { if (!$('#autopsy').hidden) saveAutopsy(); } });
      break;
    }
    case 'save':
      if (!$('#autopsy').hidden) voiceSay('Saved.', { then: () => { if (!$('#autopsy').hidden) saveAutopsy(); } });
      else voiceSay('Nothing to save.');
      break;

    default: vbDid('Unhandled: ' + p.intent, 'no');
  }
}

/* ------------------ speaking your reflection, hands-free ------------------ */
function startVoiceJournal() {
  if ($('#autopsy').hidden) return;
  const btn = $('#rec-btn');
  btn.classList.add('rec'); btn.textContent = 'Stop';
  let left = 60;
  $('#rec-timer').textContent = left + 's';
  const tick = setInterval(() => { $('#rec-timer').textContent = Math.max(0, --left) + 's'; }, 1000);
  VoiceControl.dictate({
    limitMs: 60000,
    onText: t => { $('#journal-text').value = t; },
    onDone: t => {
      clearInterval(tick);
      btn.classList.remove('rec'); btn.textContent = 'Start reflection';
      $('#journal-text').value = t;
      renderVoice(VoiceControl.state());
      VoiceControl.say(t ? 'Got that. How did it feel — great, good, okay, rough or bad?'
                         : 'Nothing recorded. Say: save, when you are ready.');
    }
  });
  renderVoice(VoiceControl.state());
}

function wireVoice() {
  $('#cmd-grid').innerHTML = SAY_LIST
    .map(([say, does]) => `<div class="cmd"><b>“${esc(say)}”</b><span>${esc(does)}</span></div>`).join('');

  $('#voice-toggle').onclick = () => VoiceControl.on ? voiceOff() : voiceOn();
  $('#voice-off').onclick = voiceOff;
  $('#wake-toggle').onchange = e => VoiceControl.setWake(e.target.checked);
  $('#voice-run').onclick = () => {
    const v = $('#voice-type').value.trim();
    if (!v) return;
    $('#voice-type').value = '';
    $('#vb-heard').textContent = v;
    const parsed = VoiceControl.simulate(v);
    if (!parsed || !parsed.intent) vbDid('I don’t know that one — see “What can I say?”', 'no');
  };
  $('#voice-type').addEventListener('keydown', e => { if (e.key === 'Enter') $('#voice-run').click(); });

  VoiceControl.init({
    onIntent: handleIntent,
    onState: renderVoice,
    onHeard: (text, final) => { $('#vb-heard').textContent = text || 'Listening…'; },
    onGated: p => vbDid(`Heard “${p.text}” — say “Lockin” first, or turn strict mode off in Settings.`, 'no'),
    onError: kind => {
      voiceOff();
      $('#voice-blurb').textContent = kind === 'mic-blocked'
        ? 'Microphone access was blocked. Allow it in the address bar, then turn hands-free on again.'
        : 'No microphone found.';
    }
  });

  if (!VoiceControl.supported) {
    $('#voice-toggle').disabled = true;
    $('#voice-blurb').textContent = 'Speech recognition needs Chrome or Edge. The typed command box below works in every browser.';
  } else if (Store.state.settings.handsFree) {
    VoiceControl.start();          // permission is remembered per origin, so this just works on a return visit
  }
  renderVoice(VoiceControl.state());
}

/* ================================ VIEWS ================================ */
function switchView(name) {
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + name));
  if (name === 'insights') renderInsights();
  if (name === 'journal') renderHistory();
  if (name === 'plan') renderPlanLists();
  if (name === 'together') renderTogether();
}

/* ================================ SOUND ================================ */
function paintSound() {
  const cur = Ambience.playing;
  $$('#sounds .schip').forEach(b => b.classList.toggle('is-on', b.dataset.s === (cur || Store.state.settings.ambience)));
  $('#sound-state').textContent = cur ? 'Playing' : 'Off';
  $('#sound-toggle').textContent = cur ? 'Stop' : 'Play';
  $('#quick-sound-name').textContent = cur ? cur : 'off';
}

/* ================================= WIRING ================================= */
function wire() {
  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (t) switchView(t.dataset.view);
  });

  /* duration presets */
  $$('.dur').forEach(b => b.onclick = () => {
    $$('.dur').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    $('#duration-input').value = b.dataset.dur;
    renderTimer();
  });
  $('#duration-input').oninput = () => {
    $$('.dur').forEach(x => x.classList.toggle('is-on', x.dataset.dur === $('#duration-input').value));
    renderTimer();
  };

  $('#btn-start').onclick = () => startFocus(currentDuration(), 'focus');
  $('#btn-pause').onclick = togglePause;
  $('#btn-extend').onclick = () => extend(5);
  $('#btn-finish').onclick = () => finish(false);
  $('#btn-cancel').onclick = () => discard(false);
  $('#btn-skip-break').onclick = () => endBreak(true);

  $('#distract-row').addEventListener('click', e => {
    const b = e.target.closest('.dchip'); if (!b) return;
    logDistraction(b.dataset.d);
    b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
  });

  /* just start */
  $$('[data-just]').forEach(b => b.onclick = () => startFocus(+b.dataset.just, 'micro'));

  /* I have X minutes */
  $('#have-btn').onclick = () => {
    const v = parseInt($('#have-input').value, 10);
    if (!Number.isFinite(v) || v < 5) { toast('Give me at least 5 minutes to work with.'); return; }
    previewPlan(v);
  };
  $('#have-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('#have-btn').click(); });

  /* sound */
  $('#sounds').addEventListener('click', e => {
    const b = e.target.closest('.schip'); if (!b) return;
    Store.set('ambience', b.dataset.s);
    Store.set('soundChosen', true);          // your pick now outranks the default
    Ambience.play(b.dataset.s);
    paintSound();
  });
  $('#sound-toggle').onclick = () => {
    if (Ambience.playing) Ambience.stop(); else Ambience.play(Store.state.settings.ambience);
    paintSound();
  };
  $('#volume').oninput = e => {
    const v = e.target.value / 100;
    Store.set('volume', v); Ambience.setVolume(v);
  };
  $('#auto-ambience').onchange = e => Store.set('autoAmbience', e.target.checked);

  /* goal */
  $('#goal-input').onchange = e => {
    const v = Math.max(5, Math.min(600, parseInt(e.target.value, 10) || 60));
    e.target.value = v; Store.set('dailyGoalMin', v); renderChips(); renderInsights();
  };

  /* quote */
  $('#quote-refresh').onclick = () => loadQuote(true);

  /* weather */
  $('#chip-weather').onclick = askLocation;

  /* planner */
  $('#plan-add').onclick = () => {
    const when = $('#plan-when').value;
    const dur = parseInt($('#plan-dur').value, 10);
    if (!when) { toast('Pick a date and time first.'); return; }
    if (!Number.isFinite(dur) || dur < 1) { toast('How long should the session be?'); return; }
    const at = new Date(when).getTime();
    if (at < Date.now() - MIN) { toast('That time has already passed.'); return; }
    Store.addPlanned(at, dur);
    renderPlanLists();
    toast(`Planned: ${fmtWhen(at)} for ${dur} minutes.`);
    if (Notify.supported && Notify.state() === 'default') Notify.ask().then(updateNotifState);
  };

  document.addEventListener('click', e => {
    const s = e.target.closest('[data-start-plan]');
    const d = e.target.closest('[data-del-plan]');
    const z = e.target.closest('[data-snooze]');
    if (s) {
      const p = Store.state.planned.find(x => x.id === s.dataset.startPlan);
      if (p) { startFocus(p.durationMin, 'focus', p.id); switchView('today'); }
    }
    if (d) { Store.removePlanned(d.dataset.delPlan); renderPlanLists(); }
    if (z) {
      const p = Store.state.planned.find(x => x.id === z.dataset.snooze);
      if (p) { Store.setPlanned(p.id, { at: p.at + 10 * MIN, leadNotified: false, dueNotified: false }); renderPlanLists(); }
    }
    if (e.target.id === 'continue-15') { closeAutopsy(false); startFocus(15, 'focus'); }
    if (e.target.id === 'take-break') { closeAutopsy(false); startBreak(Store.state.settings.breakMin); }
  });

  /* voice planning */
  $('#plan-voice').onclick = () => {
    const btn = $('#plan-voice'), heard = $('#plan-heard');
    if (!Speech.supported) {
      heard.hidden = false;
      heard.textContent = 'Speech recognition isn’t supported in this browser. Chrome or Edge will do it; meanwhile use the fields above.';
      return;
    }
    btn.classList.add('rec'); btn.textContent = 'Listening…';
    heard.hidden = false; heard.textContent = 'Listening…';
    VoiceControl.suspend();
    Speech.listen({
      onPartial: t => { heard.textContent = '“' + t + '”'; },
      onFinal: t => {
        btn.classList.remove('rec'); btn.textContent = 'Plan by voice';
        VoiceControl.resume();
        if (!t) { heard.textContent = 'Didn’t catch that. Try “study for 40 minutes at 8 PM”.'; return; }
        const parsed = Parser.parse(t);
        Store.addPlanned(parsed.at, parsed.durationMin);
        heard.innerHTML = `Heard “${esc(t)}” → <b>${fmtWhen(parsed.at)}, ${parsed.durationMin} minutes</b>. Added to your plan.`;
        renderPlanLists();
        if (Notify.supported && Notify.state() === 'default') Notify.ask().then(updateNotifState);
      },
      onError: e => {
        btn.classList.remove('rec'); btn.textContent = 'Plan by voice';
        VoiceControl.resume();
        heard.textContent = e === 'not-allowed'
          ? 'Microphone permission was blocked. Use the fields above instead.'
          : 'Voice input failed (' + e + '). Use the fields above instead.';
      }
    });
  };

  /* notifications */
  $('#notif-btn').onclick = () => Notify.ask().then(updateNotifState);

  /* autopsy modal */
  $('#autopsy-close').onclick = () => saveAutopsy();
  $('#autopsy-save').onclick = () => saveAutopsy();
  $('#moods').addEventListener('click', e => {
    const b = e.target.closest('.mchip'); if (!b || !pendingSession) return;
    $$('#moods .mchip').forEach(x => x.classList.remove('is-on'));
    b.classList.add('is-on');
    pendingSession.mood = b.dataset.m;
  });
  $('#rec-btn').onclick = () => recTimer ? stopRecording() : startRecording();
  $('#rec-type').onclick = () => { stopRecording(); $('#journal-text').focus(); };

  wireTogether();
  wireVoice();
  wireShell();

  /* wipe */
  $('#wipe').onclick = () => {
    if (!confirm('Erase every session, plan and setting stored in this browser?')) return;
    Store.wipe(); location.reload();
  };

  /* keyboard: space toggles pause while a session runs */
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && A && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && $('#autopsy').hidden) {
      e.preventDefault(); togglePause();
    }
  });
}

function updateNotifState() {
  const s = Notify.state();
  $('#notif-state').textContent =
    s === 'granted' ? 'Reminders on — you’ll get a notification even in another tab.' :
    s === 'denied' ? 'Notifications blocked; in-app reminders still work.' :
    s === 'unsupported' ? 'This browser has no notifications; in-app reminders still work.' :
    'Off — in-app reminders still work.';
  $('#notif-btn').hidden = s === 'granted' || s === 'unsupported';
}

/* ================================== QUOTE ================================== */
async function loadQuote(force) {
  $('#quote-text').textContent = 'Fetching something worth reading…';
  const q = await Quotes.today(force);
  $('#quote-text').textContent = '“' + q.text + '”';
  $('#quote-author').textContent = '— ' + q.author + (q.offline ? ' · offline shelf' : '');
}

/* =================================== INIT =================================== */
function restoreActive() {
  const saved = Store.readActive();
  if (!saved) return;
  const age = Date.now() - saved.lastAt;
  if (age > 6 * 3600000) { Store.saveActive(null); return; }   // stale, forget it
  A = saved;
  A.lastAt = Date.now();        // time with the page closed isn't counted either way
  A.paused = true;
  zenOff = true;                // reopening the app shouldn't hide the whole interface
  /* No pop-up: the dial already reads "paused — the clock is waiting". */
}

function init() {
  const st = Store.state.settings;
  $('#duration-input').value = st.lastDurationMin;
  $$('.dur').forEach(x => x.classList.toggle('is-on', +x.dataset.dur === st.lastDurationMin));
  $('#goal-input').value = st.dailyGoalMin;
  $('#volume').value = Math.round(st.volume * 100);
  $('#auto-ambience').checked = st.autoAmbience;
  Ambience.setVolume(st.volume);
  paintSound();

  // default plan time: next half hour
  const d = new Date(Date.now() + 30 * MIN);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (d.getTime() < Date.now()) d.setHours(d.getHours() + 1);
  $('#plan-when').value = new Date(d.getTime() - d.getTimezoneOffset() * MIN).toISOString().slice(0, 16);
  $('#plan-dur').value = st.lastDurationMin;

  wire();
  updateNotifState();
  restoreActive();
  initTogether();
  renderAll();
  loadQuote(false);
  applyTimeMode();
  if (st.place) refreshWeather();

  /* Streak and comeback nudges live on the Insights tab, not in the user's
     face the moment the app opens. */

  setTimeout(hidePreloader, 2100);   // long enough to actually read the tagline

  setInterval(tick, 250);
  setInterval(checkReminders, 10000);
  setTimeout(checkReminders, QUIET_MS + 500);      // catch anything the quiet period swallowed
  setInterval(() => { renderChips(); applyTimeMode(); }, 60000);
  setInterval(() => { if (Store.state.settings.place) refreshWeather(); }, 15 * 60000);

  window.addEventListener('beforeunload', e => {
    if (A && !A.paused) { e.preventDefault(); e.returnValue = ''; }
  });
}

document.addEventListener('DOMContentLoaded', init);
})();
