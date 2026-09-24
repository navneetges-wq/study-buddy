/* ------------------------------------------------------------------
   voice-control.js — hands-free Study Buddy.

   One recognition stream owns the microphone, restarts itself when the
   browser cuts it off, strips a wake word, matches the phrase against a
   grammar and hands an intent to the app. Answers come back as speech, so
   you never have to look at the screen, let alone click.
-------------------------------------------------------------------*/
const VoiceControl = (function () {

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const TTS = window.speechSynthesis;
  const supported = !!SR;

  let rec = null, on = false, suspended = false, dictating = null;
  let restarts = 0, restartAt = 0, watchdog = null, muteUntil = 0;
  let lastFinal = '', lastFinalAt = 0;
  let hooks = {};
  let requireWake = true;

  const WAKE = /^\s*(?:hey\s+|ok(?:ay)?\s+)?(?:study\s+)?(?:buddy|body|buddie|buddy's)[\s,]*/i;

  /* ------------------------------ grammar ------------------------------ */
  /* Order matters: the first rule that matches wins, so put the specific
     phrasings above the loose ones. */
  const NUM = '(\\d{1,3}|a|an|one|two|three|five|ten|fifteen|twenty|twenty five|thirty|forty|forty five|fifty|sixty|ninety)';
  const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, five: 5, ten: 10, fifteen: 15, twenty: 20,
                  'twenty five': 25, thirty: 30, forty: 40, 'forty five': 45, fifty: 50, sixty: 60, ninety: 90 };
  const n = v => (WORDS[String(v).toLowerCase()] !== undefined ? WORDS[String(v).toLowerCase()] : parseInt(v, 10));

  const GRAMMAR = [
    /* --- help & control --- */
    [/^(help|what can i say|commands?|what can you do)/, () => ({ intent: 'help' })],
    [/^(stop listening|voice off|turn off (voice|hands[- ]free)|go to sleep|shut up)/, () => ({ intent: 'voice.off' })],

    /* --- answering the autopsy out loud --- */
    [/^(?:mood\s+)?(?:it was|i felt|felt|mood(?:\s+was)?)\s+(great|good|ok|okay|fine|rough|bad|terrible|awful)/,
      m => ({ intent: 'mood', mood: m[1] })],
    [/^(great|good|okay|ok|rough|bad|terrible)$/, m => ({ intent: 'mood', mood: m[1] })],
    [/^(save|save it|save the session|keep it|log it)$/, () => ({ intent: 'save' })],

    /* --- planning a future session; needs a time or a length, otherwise
           "show me the plan" would book a session --- */
    [/(plan|schedule|remind me)\b.*?(\d|minute|hour|half an hour|tonight|tomorrow|midday|noon)/,
      m => ({ intent: 'plan', phrase: m[0] })],

    /* --- "I have X minutes" --- */
    [new RegExp(`^(?:i(?:'ve| have)?\\s+(?:got|have)?\\s*)${NUM}\\s*(?:minutes?|mins?)`), m => ({ intent: 'shape', min: n(m[1]) })],
    [new RegExp(`^(?:shape|split|break up)\\s+${NUM}\\s*(?:minutes?|mins?)?`), m => ({ intent: 'shape', min: n(m[1]) })],

    /* --- starting --- */
    [new RegExp(`^(?:just start|quick start)(?:\\s+${NUM})?`), m => ({ intent: 'start', min: m[1] ? n(m[1]) : 10, micro: true })],
    [new RegExp(`^(?:start|begin|let'?s go|go|focus|study)(?:\\s+(?:a\\s+)?(?:session|focusing|studying|for))?\\s*(?:for\\s+)?${NUM}\\s*(?:minutes?|mins?|m)\\b`), m => ({ intent: 'start', min: n(m[1]) })],
    [new RegExp(`^${NUM}\\s*(?:minutes?|mins?)\\s*(?:session|please)?$`), m => ({ intent: 'start', min: n(m[1]) })],
    [/^(start|begin|let'?s go|go ahead|start focusing|start the timer|start a session|study now)/, () => ({ intent: 'start' })],

    /* --- running a session --- */
    [/^(pause|hold on|wait|hang on|freeze)/, () => ({ intent: 'pause' })],
    [/^(resume|continue|carry on|unpause|keep going|back)/, () => ({ intent: 'resume' })],
    [new RegExp(`^(?:add|give me|extend|another)\\s*(?:by\\s+)?${NUM}\\s*(?:more\\s+)?(?:minutes?|mins?)`), m => ({ intent: 'extend', min: n(m[1]) })],
    [/^(add (five|5) more|extend|five more minutes|more time)/, () => ({ intent: 'extend', min: 5 })],
    [/^(finish|done|i'?m done|end (the )?session|stop the timer|complete|that'?s it)/, () => ({ intent: 'finish' })],
    [/^(cancel|discard|scrap (it|this)|forget (it|this)|abandon)/, () => ({ intent: 'discard' })],
    [new RegExp(`^(?:take\\s+)?(?:a\\s+)?(?:${NUM}\\s*(?:minutes?|mins?)?\\s*)?break`), m => ({ intent: 'break', min: m[1] ? n(m[1]) : null })],
    [/^(skip (the )?break|no break|back to work)/, () => ({ intent: 'skipbreak' })],

    /* --- distractions --- */
    /* word boundaries matter here: without them "create a room" matches
       "eat" and gets logged as hunger. */
    [/\b(phones?|instagram|whatsapp|notifications?|texting)\b/, () => ({ intent: 'distract', type: 'phone' })],
    [/\b(daydream(ing)?|zoned out|mind wander(ed|ing)?|spacing out|lost focus)\b/, () => ({ intent: 'distract', type: 'daydream' })],
    [/\b(someone|people|interrupted|talking to me|knocked)\b/, () => ({ intent: 'distract', type: 'people' })],
    [/\b(tired|sleepy|exhausted|yawning)\b/, () => ({ intent: 'distract', type: 'tired' })],
    [/\b(hungry|snack|starving|eating)\b/, () => ({ intent: 'distract', type: 'hungry' })],
    [/^(distracted|i'?m distracted|log a distraction|i got distracted)/, () => ({ intent: 'distract', type: 'other' })],

    /* --- sound --- */
    [/^(?:play|put on|start)\s*(?:the|some)?\s*(rain|waves|ocean|caf[eé]|coffee|night|crickets|lo[- ]?fi|music|white noise|brown noise|noise)/,
      m => ({ intent: 'sound', which: m[1] })],
    [/^(stop|kill|turn off) (the )?(music|sound|rain|noise|audio)/, () => ({ intent: 'sound.off' })],
    [/^(louder|volume up|turn it up)/, () => ({ intent: 'volume', delta: +0.15 })],
    [/^(quieter|softer|volume down|turn it down)/, () => ({ intent: 'volume', delta: -0.15 })],

    /* --- co-study --- */
    [/^(create|start|make|open) (a )?(room|study room)|^study with (a )?(friend|someone)/, () => ({ intent: 'room.create' })],
    [/^(nudge|poke|wake them|ping (them|my friend))/, () => ({ intent: 'room.nudge' })],
    [/^(rematch|run it back|again)/, () => ({ intent: 'room.rematch' })],
    [/^(copy|share|send) (the |my )?(invite|link|room link)/, () => ({ intent: 'room.copy' })],

    /* --- questions, answered out loud --- */
    [/(how (long|much time)|time left|how much longer)/, () => ({ intent: 'ask.time' })],
    [/(how am i doing|how'?s it going|my score|focus score|status)/, () => ({ intent: 'ask.status' })],
    [/\bstreaks?\b/, () => ({ intent: 'ask.streak' })],
    [/\b(level|xp|experience points?)\b/, () => ({ intent: 'ask.level' })],
    [/\b(quote|motivat\w*)\b/, () => ({ intent: 'ask.quote' })],
    [/\b(weather|raining|outside)\b/, () => ({ intent: 'ask.weather' })],
    [/(goal|target).*(\d{1,3})|set (my )?goal/, m => ({ intent: 'goal', min: parseInt((m[0].match(/(\d{1,3})/) || [])[1], 10) })],

    /* --- settings & navigation --- */
    [/^(set|change)?\s*(my )?(city|location|where i am)\s*(to|is)?\s*(.+)/, m => ({ intent: 'city', place: (m[5] || '').trim() })],
    [/(show|open|go to|switch to)?\s*(insights?|stats|analytics|numbers)/, () => ({ intent: 'view', view: 'insights' })],
    [/(show|open|go to|switch to)?\s*(journal|history|reflections?)/, () => ({ intent: 'view', view: 'journal' })],
    [/(show|open|go to|switch to)?\s*(plan|planner|schedule)/, () => ({ intent: 'view', view: 'plan' })],
    [/(show|open|go to|switch to)?\s*(together|friends?|rivals?|duels?)/, () => ({ intent: 'view', view: 'together' })],
    [/(show|open|go to|switch to)?\s*(today|home|timer|dashboard)/, () => ({ intent: 'view', view: 'today' })]
  ];

  /** Turns a spoken phrase into an intent, or null when nothing fits. */
  function parse(raw) {
    if (!raw) return null;
    let text = String(raw).toLowerCase().replace(/[.,!?;]/g, ' ').replace(/\s+/g, ' ').trim();
    const woke = WAKE.test(text);
    if (woke) text = text.replace(WAKE, '').trim();
    if (requireWake && !woke) return { intent: null, woke: false, text };
    if (!text) return { intent: 'wake', woke: true, text };
    for (const [re, build] of GRAMMAR) {
      const m = text.match(re);
      if (m) return { ...build(m), woke, text };
    }
    return { intent: null, woke, text, unmatched: true };
  }

  /* ------------------------------ speaking ------------------------------ */
  function say(text, opts) {
    opts = opts || {};
    const vol = Store.state.settings.volume;
    let fired = false;
    /* Whatever happens to the audio, the follow-up action must still run:
       no voices installed, a muted device or a browser that never fires
       onend must not swallow the command. */
    const finish = () => {
      if (fired) return;
      fired = true;
      muteUntil = Date.now() + 350;
      if (Ambience.playing) Ambience.setVolume(vol);
      opts.then && opts.then();
    };
    if (!TTS || !text) { setTimeout(finish, 0); return; }
    const words = text.split(/\s+/).length;
    const budget = Math.min(12000, Math.max(1400, words * 380));
    setTimeout(finish, budget);                                 // safety net
    try {
      TTS.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05; u.pitch = 1;
      if (Ambience.playing) Ambience.setVolume(vol * 0.3);      // duck the rain, don't fight it
      muteUntil = Date.now() + budget;                          // ignore our own voice
      u.onend = finish;
      u.onerror = finish;
      TTS.speak(u);
    } catch (e) { finish(); }
  }

  /* ---------------------------- the mic stream ---------------------------- */
  function build() {
    rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = e => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' '; else interim += t;
      }
      if (Date.now() < muteUntil) return;                       // that was us talking
      const heard = (final || interim).trim();
      hooks.onHeard && hooks.onHeard(heard, !!final);

      if (dictating) {
        dictating.text = (dictating.final + ' ' + (final || interim)).trim();
        if (final) dictating.final = (dictating.final + ' ' + final).trim();
        dictating.onText && dictating.onText(dictating.text);
        if (final && /\b(save|done|finish|that'?s it|stop)\b\s*$/i.test(final.trim())) {
          const d = dictating;
          d.text = d.text.replace(/\b(save|done|finish|that'?s it|stop)\b\s*$/i, '').trim();
          endDictation();
          d.onDone && d.onDone(d.text);
        }
        return;
      }

      if (!final) return;
      const phrase = final.trim();
      if (phrase === lastFinal && Date.now() - lastFinalAt < 3000) return;   // browser echo
      lastFinal = phrase; lastFinalAt = Date.now();
      const parsed = parse(phrase);
      if (!parsed) return;
      if (!parsed.intent && !parsed.woke) return;               // background chatter, ignore
      hooks.onIntent && hooks.onIntent(parsed);
    };

    rec.onerror = e => {
      const err = e.error;
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        on = false;
        hooks.onState && hooks.onState(state());
        hooks.onError && hooks.onError('mic-blocked');
        return;
      }
      if (err === 'audio-capture') { on = false; hooks.onError && hooks.onError('no-mic'); }
      // 'no-speech', 'aborted' and 'network' are routine; onend restarts us
    };

    rec.onend = () => { rec = null; if (on && !suspended) restart(); hooks.onState && hooks.onState(state()); };
    rec.onstart = () => { hooks.onState && hooks.onState(state()); };
  }

  function restart() {
    const now = Date.now();
    restarts = now - restartAt < 1500 ? restarts + 1 : 0;
    restartAt = now;
    const wait = restarts > 4 ? 1500 : 250;                     // back off if the browser is fighting us
    setTimeout(() => { if (on && !suspended && !rec) go(); }, wait);
  }

  function go() {
    if (!supported || rec) return;
    build();
    try { rec.start(); } catch (e) { rec = null; }
    clearInterval(watchdog);
    watchdog = setInterval(() => {                              // some builds go quiet without firing onend
      if (on && !suspended && !rec) go();
    }, 4000);
  }

  function start() {
    if (!supported) return false;
    on = true; suspended = false;
    go();
    hooks.onState && hooks.onState(state());
    return true;
  }

  function stop() {
    on = false; suspended = false;
    clearInterval(watchdog);
    try { rec && rec.stop(); } catch (e) {}
    rec = null;
    try { TTS && TTS.cancel(); } catch (e) {}
    hooks.onState && hooks.onState(state());
  }

  /** Step aside while another part of the app wants the microphone. */
  function suspend() { if (!on) return; suspended = true; try { rec && rec.stop(); } catch (e) {} rec = null; }
  function resume() { if (!on) return; suspended = false; if (!rec) go(); }

  /* --------------------------- free-text dictation --------------------------- */
  function dictate(opts) {
    dictating = { final: '', text: '', onText: opts.onText, onDone: opts.onDone };
    hooks.onState && hooks.onState(state());
    if (opts.limitMs) dictating.timer = setTimeout(() => {
      const d = dictating; endDictation(); d && d.onDone && d.onDone(d.text);
    }, opts.limitMs);
    return dictating;
  }
  function endDictation() {
    if (dictating && dictating.timer) clearTimeout(dictating.timer);
    dictating = null;
    hooks.onState && hooks.onState(state());
  }

  const state = () => ({ supported, on, suspended, listening: !!rec && on && !suspended,
                         dictating: !!dictating, requireWake });

  function init(h) {
    hooks = h || {};
    requireWake = Store.state.settings.wakeWord !== false;
  }
  const setWake = v => { requireWake = !!v; Store.set('wakeWord', !!v); hooks.onState && hooks.onState(state()); };

  /** Run a command as if it had been spoken — used by the typed fallback box. */
  function simulate(text) {
    const parsed = parse(requireWake && !WAKE.test(text) ? 'buddy ' + text : text);
    if (parsed) hooks.onIntent && hooks.onIntent(parsed);
    return parsed;
  }

  return { supported, init, start, stop, suspend, resume, dictate, endDictation,
           say, parse, simulate, state, setWake, get on() { return on; } };
})();
