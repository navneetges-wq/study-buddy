/* ------------------------------------------------------------------
   progress.js — the part that makes you want to come back:
   XP, focus levels and achievements. All derived from real sessions.
-------------------------------------------------------------------*/
const Progress = (function () {

  const LEVELS = [
    { at: 0,     name: 'Drifter',    icon: '🌫️' },
    { at: 100,   name: 'Starter',    icon: '🌱' },
    { at: 250,   name: 'Settler',    icon: '🪴' },
    { at: 500,   name: 'Focused',    icon: '🎯' },
    { at: 900,   name: 'Locked In',  icon: '🔒' },
    { at: 1500,  name: 'Deep Diver', icon: '🤿' },
    { at: 2400,  name: 'Flow State', icon: '🌊' },
    { at: 3600,  name: 'Monk Mode',  icon: '🧘' },
    { at: 5200,  name: 'Ascetic',    icon: '🏔️' },
    { at: 7200,  name: 'Study Sage', icon: '🦉' }
  ];

  function level(xp) {
    let i = 0;
    for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k].at) i = k;
    const cur = LEVELS[i];
    const next = LEVELS[i + 1] || null;
    const span = next ? next.at - cur.at : 1;
    return {
      n: i + 1, name: cur.name, icon: cur.icon, xp,
      floor: cur.at, ceil: next ? next.at : null,
      toNext: next ? next.at - xp : 0,
      pct: next ? Math.min(100, Math.round(((xp - cur.at) / span) * 100)) : 100,
      nextName: next ? next.name : 'the top'
    };
  }

  /** What a finished session is worth, and why. */
  function scoreSession(sess, opts) {
    opts = opts || {};
    const mins = sess.focusedMs / 60000;
    const lines = [];
    let xp = mins;
    lines.push([`${Math.round(mins)} focused min`, Math.round(mins)]);

    if (sess.completed) { const b = mins * 0.5; xp += b; lines.push(['went the full distance', Math.round(b)]); }
    if (!sess.tabSwitches && mins >= 10) { const b = mins * 0.25; xp += b; lines.push(['never left the tab', Math.round(b)]); }
    if (opts.coStudy) { xp += 20; lines.push(['studied with a friend', 20]); }
    if (opts.duelWin) { xp += 10; lines.push(['won the duel', 10]); }
    const sb = Math.min(30, (opts.streak || 0) * 2);
    if (sb) { xp += sb; lines.push([`${opts.streak}-day streak`, sb]); }

    return { xp: Math.max(1, Math.round(xp)), lines };
  }

  function award(sess, opts) {
    const st = Store.state;
    const before = level(st.progress.xp);
    const got = scoreSession(sess, opts);
    st.progress.xp += got.xp;
    Store.save();
    const after = level(st.progress.xp);
    return { ...got, levelUp: after.n > before.n ? after : null, level: after };
  }

  /* ----------------------------- achievements ----------------------------- */
  const ACHIEVEMENTS = [
    { id: 'first',     icon: '🌱', title: 'First Steps',   desc: 'Finish your first session',
      test: s => s.sessions.length >= 1 },
    { id: 'clean',     icon: '🧼', title: 'Untouchable',   desc: 'A 15+ minute session without leaving the tab',
      test: s => s.sessions.some(x => !x.tabSwitches && x.focusedMs >= 15 * 60000) },
    { id: 'marathon',  icon: '🏃', title: 'Marathon',      desc: 'Focus for 60 minutes in one session',
      test: s => s.sessions.some(x => x.focusedMs >= 60 * 60000) },
    { id: 'century',   icon: '💯', title: 'Century',       desc: '100 minutes of focus in a single day',
      test: s => Object.values(s.days).some(v => v >= 100 * 60000) },
    { id: 'earlybird', icon: '🌅', title: 'Early Bird',    desc: 'Start a session before 7am',
      test: s => s.sessions.some(x => new Date(x.startedAt).getHours() < 7) },
    { id: 'nightowl',  icon: '🦉', title: 'Night Owl',     desc: 'Start a session after 11pm',
      test: s => s.sessions.some(x => new Date(x.startedAt).getHours() >= 23) },
    { id: 'streak3',   icon: '🔥', title: 'Warming Up',    desc: 'Study 3 days in a row',
      test: () => Store.streak().current >= 3 },
    { id: 'streak7',   icon: '🔥', title: 'Ablaze',        desc: 'Study 7 days in a row',
      test: () => Store.streak().current >= 7 },
    { id: 'comeback',  icon: '🏅', title: 'Comeback',      desc: 'Return after 2+ days away and study 15 minutes',
      test: () => Store.streak().comebackEarned },
    { id: 'reflector', icon: '🎙️', title: 'Reflector',     desc: 'Record 5 voice journals',
      test: s => s.sessions.filter(x => x.journal && x.journal.text).length >= 5 },
    { id: 'honest',    icon: '📵', title: 'Self-Aware',    desc: 'Log 10 distractions by hand',
      test: s => s.sessions.reduce((a, x) => a + (x.distractions || []).filter(d => d.type !== 'tab').length, 0) >= 10 },
    { id: 'deepweek',  icon: '📚', title: 'Deep Week',     desc: '5 hours of focus in 7 days',
      test: () => Store.last7().reduce((a, d) => a + d.ms, 0) >= 5 * 3600000 },
    { id: 'duelist',   icon: '⚔️', title: 'Duelist',       desc: 'Finish your first session with a friend',
      test: s => s.duels.length >= 1 },
    { id: 'rival',     icon: '👑', title: 'Rival',         desc: 'Win 5 focus duels',
      test: s => s.duels.filter(d => d.result === 'win').length >= 5 },
    { id: 'squad',     icon: '🤝', title: 'Squad',         desc: 'Study with a friend 3 days in a row',
      test: () => Store.coStreak() >= 3 }
  ];

  /** Returns the achievements unlocked by whatever just happened. */
  function check() {
    const st = Store.state;
    const fresh = [];
    ACHIEVEMENTS.forEach(a => {
      if (st.progress.achievements[a.id]) return;
      let ok = false;
      try { ok = a.test(st); } catch (e) { ok = false; }
      if (ok) { st.progress.achievements[a.id] = Date.now(); fresh.push(a); }
    });
    if (fresh.length) Store.save();
    return fresh;
  }

  const all = () => ACHIEVEMENTS.map(a => ({ ...a, at: Store.state.progress.achievements[a.id] || null }));

  return { level, award, scoreSession, check, all, LEVELS, ACHIEVEMENTS };
})();
