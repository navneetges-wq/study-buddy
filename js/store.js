/* ------------------------------------------------------------------
   store.js — everything Lockin remembers, plus the maths it does
   with those memories. All persistence is localStorage.
-------------------------------------------------------------------*/
const Store = (function () {
  const KEY = 'lockin.v1';
  const ACTIVE_KEY = 'lockin.active';
  /* The app has been renamed twice; carry old saves forward either way. */
  const LEGACY = [['ally.v1', 'ally.active'], ['studybuddy.v1', 'studybuddy.active']];

  const defaults = () => ({
    version: 1,
    sessions: [],          // completed sessions
    planned: [],           // scheduled sessions
    days: {},              // 'YYYY-MM-DD' -> focused ms
    settings: {
      dailyGoalMin: 60,
      lastDurationMin: 25,
      breakMin: 5,
      ambience: 'lofi',
      soundChosen: false,    // false = still on the default, so a new default applies
      volume: 0.5,
      autoAmbience: true,
      reminderLeadMin: 5,
      place: null          // {name, lat, lon}
    },
    quote: null,           // {date, text, author}
    word: null,            // {date, word, part, definition, …} — word of the day
    lastOpenedDay: null,
    progress: { xp: 0, achievements: {} },
    friends: {},           // name key -> head-to-head record
    duels: [],             // finished co-study sessions
    room: null             // the room you're currently in, so a refresh keeps you in it
  });

  let s = read();

  function read() {
    const base = defaults();
    try {
      /* One-time migration so nobody loses their history to a rename. */
      if (!localStorage.getItem(KEY)) {
        for (const [oldKey, oldActive] of LEGACY) {
          const found = localStorage.getItem(oldKey);
          if (!found) continue;
          localStorage.setItem(KEY, found);
          const a = localStorage.getItem(oldActive);
          if (a) localStorage.setItem(ACTIVE_KEY, a);
          localStorage.removeItem(oldKey); localStorage.removeItem(oldActive);
          break;
        }
      }
      const raw = localStorage.getItem(KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      const merged = { ...base.settings, ...(saved.settings || {}) };
      /* Anyone who never picked a sound follows the current default, rather
         than being stuck with whatever the default was on the day they
         first opened the app. */
      if (!merged.soundChosen) merged.ambience = base.settings.ambience;

      return {
        ...base, ...saved,
        settings: merged,
        progress: { ...base.progress, ...(saved.progress || {}),
                    achievements: (saved.progress && saved.progress.achievements) || {} },
        days: saved.days || {},
        sessions: saved.sessions || [],
        planned: saved.planned || [],
        friends: saved.friends || {},
        duels: saved.duels || []
      };
    } catch (e) {
      console.warn('Could not read saved data, starting fresh.', e);
      return base;
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); }
    catch (e) { console.warn('Could not save.', e); }
  }

  /* ---------------- dates ---------------- */
  const dayKey = (ts = Date.now()) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const dayStart = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  const DAY = 86400000;

  /* ---------------- writing ---------------- */
  function addSession(sess) {
    s.sessions.push(sess);
    const k = dayKey(sess.startedAt);
    s.days[k] = (s.days[k] || 0) + sess.focusedMs;
    save();
    return sess;
  }
  function updateSession(id, patch) {
    const i = s.sessions.findIndex(x => x.id === id);
    if (i > -1) { s.sessions[i] = { ...s.sessions[i], ...patch }; save(); }
    return s.sessions[i];
  }
  function addPlanned(at, durationMin) {
    const p = { id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6),
                at, durationMin, status: 'pending', leadNotified: false, dueNotified: false };
    s.planned.push(p); s.planned.sort((a, b) => a.at - b.at); save();
    return p;
  }
  function setPlanned(id, patch) {
    const p = s.planned.find(x => x.id === id);
    if (p) { Object.assign(p, patch); save(); }
    return p;
  }
  function removePlanned(id) { s.planned = s.planned.filter(p => p.id !== id); save(); }
  function set(path, value) { s.settings[path] = value; save(); }

  function wipe() { localStorage.removeItem(KEY); localStorage.removeItem(ACTIVE_KEY); s = defaults(); }

  /* ------------- active session survival across refresh ------------- */
  function saveActive(a) {
    try { a ? localStorage.setItem(ACTIVE_KEY, JSON.stringify(a)) : localStorage.removeItem(ACTIVE_KEY); }
    catch (e) { /* ignore */ }
  }
  function readActive() {
    try { const r = localStorage.getItem(ACTIVE_KEY); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }

  /* ---------------- scoring ---------------- */
  function scoreOf(sess) {
    const completion = Math.min(1, sess.focusedMs / Math.max(1, sess.plannedMs));
    const ratio = sess.focusedMs / Math.max(1, sess.focusedMs + sess.awayMs);
    const manual = (sess.distractions || []).filter(d => d.type !== 'tab').length;
    return Math.max(0, Math.min(100, Math.round(100 * (0.55 * completion + 0.45 * ratio) - 3 * manual)));
  }

  /* ---------------- reading / analytics ---------------- */
  const todayMs = () => s.days[dayKey()] || 0;

  function sessionsSince(ms) { return s.sessions.filter(x => x.startedAt >= Date.now() - ms); }

  function totals() {
    const all = s.sessions;
    const focused = all.reduce((a, x) => a + x.focusedMs, 0);
    const longest = all.reduce((a, x) => Math.max(a, x.focusedMs), 0);
    const away = all.reduce((a, x) => a + x.awayMs, 0);
    const tabs = all.reduce((a, x) => a + (x.tabSwitches || 0), 0);
    const daysStudied = Object.values(s.days).filter(v => v >= 60000).length;
    // consistency: how many of the last 14 days had study time
    let hit = 0;
    for (let i = 0; i < 14; i++) if ((s.days[dayKey(Date.now() - i * DAY)] || 0) >= 60000) hit++;
    const avgScore = all.length ? Math.round(all.reduce((a, x) => a + (x.score || 0), 0) / all.length) : 0;
    return {
      count: all.length, focused, longest, away, tabs, daysStudied,
      avg: all.length ? focused / all.length : 0,
      consistency: Math.round((hit / 14) * 100),
      avgScore, today: todayMs()
    };
  }

  function last7() {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const k = dayKey(Date.now() - i * DAY);
      out.push({ key: k, ms: s.days[k] || 0, date: new Date(dayStart(k)) });
    }
    return out;
  }

  /** All distraction events (tab switches included) within a window. */
  function distractionSplit(windowMs = 7 * DAY) {
    const counts = {};
    sessionsSince(windowMs).forEach(sess => (sess.distractions || []).forEach(d => {
      counts[d.type] = (counts[d.type] || 0) + 1;
    }));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return {
      total,
      rows: Object.entries(counts)
        .map(([type, n]) => ({ type, n, pct: total ? Math.round((n / total) * 100) : 0 }))
        .sort((a, b) => b.n - a.n)
    };
  }

  /** Streak, computed from the day map so it survives any gap. */
  function streak() {
    const today = dayKey();
    const has = k => (s.days[k] || 0) >= 60000;
    let current = 0;
    let cursor = has(today) ? Date.now() : Date.now() - DAY;
    while (has(dayKey(cursor))) { current++; cursor -= DAY; }

    // longest run ever
    const keys = Object.keys(s.days).filter(k => s.days[k] >= 60000).sort();
    let longest = 0, run = 0, prev = null;
    keys.forEach(k => {
      run = (prev && dayStart(k) - dayStart(prev) === DAY) ? run + 1 : 1;
      longest = Math.max(longest, run); prev = k;
    });

    // days since the previous study day (ignoring today)
    let gap = null;
    for (let i = 1; i <= 60; i++) {
      if (has(dayKey(Date.now() - i * DAY))) { gap = i; break; }
    }
    const comebackEarned = gap !== null && gap >= 2 && todayMs() >= 15 * 60000;
    const comebackOffer = gap !== null && gap >= 2 && !comebackEarned;
    return { current, longest, gap, studiedToday: has(today), comebackEarned, comebackOffer };
  }

  /* --------------------------- studying together --------------------------- */
  const friendKey = n => String(n || 'friend').trim().toLowerCase().slice(0, 24) || 'friend';

  /** Files a finished head-to-head and updates the running record. */
  function recordDuel(partnerName, mine, theirs) {
    const key = friendKey(partnerName);
    const result = mine.score > theirs.score ? 'win' : mine.score < theirs.score ? 'loss' : 'draw';
    const f = s.friends[key] || { name: partnerName, wins: 0, losses: 0, draws: 0, duels: 0, together: 0, days: [] };
    f.name = partnerName || f.name;
    f.duels++;
    f[result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws']++;
    f.together += mine.focusedMs;
    f.lastAt = Date.now();
    const today = dayKey();
    if (!f.days.includes(today)) f.days.push(today);
    f.days = f.days.slice(-90);
    s.friends[key] = f;
    s.duels.push({ at: Date.now(), partner: partnerName, result, mine, theirs });
    s.duels = s.duels.slice(-60);
    save();
    return { result, record: f };
  }

  const friends = () => Object.values(s.friends).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));

  /** Days in a row with at least one session studied alongside someone. */
  function coStreak() {
    const all = new Set();
    Object.values(s.friends).forEach(f => (f.days || []).forEach(d => all.add(d)));
    if (!all.size) return 0;
    let n = 0, cursor = all.has(dayKey()) ? Date.now() : Date.now() - DAY;
    while (all.has(dayKey(cursor))) { n++; cursor -= DAY; }
    return n;
  }

  function setRoom(r) { s.room = r; save(); }

  /** The Focus Fingerprint: what your sessions say about how you study. */
  function fingerprint() {
    const all = s.sessions.filter(x => x.kind !== 'break');
    if (all.length < 3) return { ready: false, have: all.length, need: 3 };

    const avg = all.reduce((a, x) => a + x.focusedMs, 0) / all.length;

    const periods = { Morning: [5, 11], Afternoon: [12, 16], Evening: [17, 21], Night: [22, 4] };
    const bucket = h => h >= 5 && h <= 11 ? 'Morning' : h >= 12 && h <= 16 ? 'Afternoon'
                    : h >= 17 && h <= 21 ? 'Evening' : 'Night';
    const byPeriod = {};
    all.forEach(x => {
      const b = bucket(new Date(x.startedAt).getHours());
      (byPeriod[b] = byPeriod[b] || { ms: 0, score: 0, n: 0 });
      byPeriod[b].ms += x.focusedMs; byPeriod[b].score += x.score || 0; byPeriod[b].n++;
    });
    const bestPeriod = Object.entries(byPeriod)
      .sort((a, b) => (b[1].score / b[1].n) - (a[1].score / a[1].n) || b[1].ms - a[1].ms)[0];

    const drops = all.map(x => x.firstDistractionAt).filter(v => typeof v === 'number');
    const dropAfter = drops.length ? drops.reduce((a, b) => a + b, 0) / drops.length : null;

    const split = distractionSplit(365 * DAY);
    const topDist = split.rows[0] || null;

    const avgAway = all.reduce((a, x) => a + x.awayMs, 0) / all.length;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const byDow = {};
    all.forEach(x => {
      const d = new Date(x.startedAt).getDay();
      byDow[d] = (byDow[d] || 0) + x.focusedMs;
    });
    const bestDow = Object.entries(byDow).sort((a, b) => b[1] - a[1])[0];

    const completed = all.filter(x => x.focusedMs >= x.plannedMs * 0.95).length;

    return {
      ready: true, n: all.length, avg,
      bestPeriod: bestPeriod ? bestPeriod[0] : '—',
      dropAfter, topDistraction: topDist, avgAway,
      bestDay: bestDow ? dayNames[bestDow[0]] : '—',
      finishRate: Math.round((completed / all.length) * 100),
      periods
    };
  }

  return {
    get state() { return s; },
    save, set, dayKey, dayStart, DAY,
    addSession, updateSession, addPlanned, setPlanned, removePlanned,
    saveActive, readActive, wipe,
    scoreOf, totals, last7, distractionSplit, streak, fingerprint, todayMs,
    recordDuel, friends, coStreak, setRoom, friendKey
  };
})();
