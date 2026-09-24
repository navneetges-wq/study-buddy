/* ------------------------------------------------------------------
   services.js — the outside world: quotes API, weather API,
   speech recognition, notifications, and the voice command parser.
-------------------------------------------------------------------*/

/* ============================ QUOTES ============================ */
const Quotes = (function () {
  const fallback = [
    { text: "It always seems impossible until it's done.", author: 'Nelson Mandela' },
    { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
    { text: 'Small daily improvements are the key to staggering long-term results.', author: 'Robin Sharma' },
    { text: 'You do not rise to the level of your goals, you fall to the level of your systems.', author: 'James Clear' },
    { text: 'Concentration is the secret of strength.', author: 'Ralph Waldo Emerson' },
    { text: 'Amateurs sit and wait for inspiration. The rest of us just get up and go to work.', author: 'Stephen King' },
    { text: 'Nothing will work unless you do.', author: 'Maya Angelou' },
    { text: 'Study without desire spoils the memory, and it retains nothing that it takes in.', author: 'Leonardo da Vinci' }
  ];

  async function fetchRemote() {
    const res = await fetch('https://dummyjson.com/quotes/random', { cache: 'no-store' });
    if (!res.ok) throw new Error('quote http ' + res.status);
    const j = await res.json();
    if (!j.quote) throw new Error('unexpected quote shape');
    return { text: j.quote, author: j.author || 'Unknown' };
  }

  /** Today's quote, cached for the day. force=true always fetches a new one. */
  async function today(force = false) {
    const st = Store.state;
    const key = Store.dayKey();
    if (!force && st.quote && st.quote.date === key) return { ...st.quote, cached: true };
    try {
      const q = await fetchRemote();
      st.quote = { ...q, date: key }; Store.save();
      return q;
    } catch (e) {
      console.warn('Quote API unavailable, using the built-in shelf.', e);
      const q = fallback[Math.floor(Math.random() * fallback.length)];
      if (!st.quote || st.quote.date !== key) { st.quote = { ...q, date: key }; Store.save(); }
      return { ...q, offline: true };
    }
  }
  return { today };
})();

/* ============================ WEATHER ============================ */
const Weather = (function () {
  // Open-Meteo WMO weather codes, grouped into the moods the app cares about
  const CODES = {
    0: ['Clear sky', '☀️', 'clear'], 1: ['Mainly clear', '🌤️', 'clear'],
    2: ['Partly cloudy', '⛅', 'cloud'], 3: ['Overcast', '☁️', 'cloud'],
    45: ['Fog', '🌫️', 'cloud'], 48: ['Rime fog', '🌫️', 'cloud'],
    51: ['Light drizzle', '🌦️', 'rain'], 53: ['Drizzle', '🌦️', 'rain'], 55: ['Heavy drizzle', '🌧️', 'rain'],
    56: ['Freezing drizzle', '🌧️', 'rain'], 57: ['Freezing drizzle', '🌧️', 'rain'],
    61: ['Light rain', '🌦️', 'rain'], 63: ['Rain', '🌧️', 'rain'], 65: ['Heavy rain', '🌧️', 'rain'],
    66: ['Freezing rain', '🌧️', 'rain'], 67: ['Freezing rain', '🌧️', 'rain'],
    71: ['Light snow', '🌨️', 'snow'], 73: ['Snow', '🌨️', 'snow'], 75: ['Heavy snow', '❄️', 'snow'],
    77: ['Snow grains', '🌨️', 'snow'],
    80: ['Rain showers', '🌦️', 'rain'], 81: ['Rain showers', '🌧️', 'rain'], 82: ['Violent showers', '⛈️', 'rain'],
    85: ['Snow showers', '🌨️', 'snow'], 86: ['Snow showers', '❄️', 'snow'],
    95: ['Thunderstorm', '⛈️', 'rain'], 96: ['Thunderstorm', '⛈️', 'rain'], 99: ['Thunderstorm', '⛈️', 'rain']
  };

  async function geocode(name) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('geocode http ' + r.status);
    const j = await r.json();
    if (!j.results || !j.results.length) throw new Error('No place called “' + name + '”');
    const p = j.results[0];
    return { name: [p.name, p.country_code].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude };
  }

  async function current(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
                `&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('weather http ' + r.status);
    const j = await r.json();
    const c = j.current;
    const [label, emoji, mood] = CODES[c.weather_code] || ['Weather', '🌡️', 'cloud'];
    return {
      temp: Math.round(c.temperature_2m),
      isDay: c.is_day === 1,
      label, emoji,
      mood: c.is_day === 1 ? mood : 'night',
      rainy: mood === 'rain'
    };
  }
  return { geocode, current };
})();

/* ============================ SPEECH ============================ */
const Speech = (function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = !!SR;
  let rec = null;

  /**
   * listen({continuous, onPartial, onFinal, onEnd, onError})
   * Returns a stop() handle. Falls back to onError('unsupported').
   */
  function listen(opts) {
    if (!supported) { opts.onError && opts.onError('unsupported'); return { stop() {} }; }
    stop();
    rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = !!opts.continuous;
    rec.interimResults = true;
    let finalText = '';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + ' '; else interim += t;
      }
      opts.onPartial && opts.onPartial((finalText + interim).trim());
    };
    rec.onerror = (e) => opts.onError && opts.onError(e.error || 'error');
    rec.onend = () => {
      opts.onFinal && opts.onFinal(finalText.trim());
      opts.onEnd && opts.onEnd();
      rec = null;
    };
    try { rec.start(); } catch (e) { opts.onError && opts.onError('start-failed'); }
    return { stop };
  }

  function stop() { if (rec) { try { rec.stop(); } catch (e) {} } }
  return { supported, listen, stop };
})();

/* ==================== VOICE COMMAND PARSER ==================== */
/**
 * Turns "study for 40 minutes at 8 pm" into {durationMin, at, note}.
 * Understands: minutes/hours, "half an hour", "at 8pm", "at 20:30",
 * "in 2 hours", "now", "tonight", spoken numbers.
 */
const Parser = (function () {
  const WORDS = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
    eleven:11,twelve:12,fifteen:15,twenty:20,'twenty five':25,thirty:30,forty:40,'forty five':45,
    fifty:50,sixty:60,ninety:90 };

  function words2digits(s) {
    let out = s;
    Object.keys(WORDS).sort((a, b) => b.length - a.length)
      .forEach(w => { out = out.replace(new RegExp('\\b' + w + '\\b', 'g'), WORDS[w]); });
    return out;
  }

  function parse(raw) {
    if (!raw) return null;
    const s = words2digits(raw.toLowerCase().replace(/[,.!?]/g, ' ')).replace(/\s+/g, ' ').trim();

    /* "in 2 hours" is when to start, not how long to study — pull it out first
       so it can't be mistaken for a duration. */
    const rel = s.match(/\bin\s+(\d+(?:\.\d+)?)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/);
    const d = rel ? s.replace(rel[0], ' ') : s;

    /* ---- duration ---- */
    let durationMin = null;
    if (/half an hour|half hour/.test(d)) durationMin = 30;
    const hr = d.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
    const mn = d.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
    if (hr || mn) durationMin = Math.round((hr ? parseFloat(hr[1]) * 60 : 0) + (mn ? parseInt(mn[1], 10) : 0));
    if (!durationMin && /\ban hour\b/.test(d)) durationMin = 60;
    if (!durationMin) {
      const bare = d.match(/(?:study|focus|session|for)\s+(\d{1,3})\b(?!\s*(?::|am|pm|o'?clock))/);
      if (bare) durationMin = parseInt(bare[1], 10);
    }
    if (!durationMin) durationMin = 25;
    durationMin = Math.max(1, Math.min(240, durationMin));

    /* ---- start time ---- */
    const now = new Date();
    let at = null;

    if (rel) {
      const n = parseFloat(rel[1]);
      at = new Date(now.getTime() + n * (/^h/.test(rel[2]) ? 3600000 : 60000));
    }

    if (!at) {
      const m = s.match(/(?:at|by|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
      if (m) {
        let h = parseInt(m[1], 10);
        const min = m[2] ? parseInt(m[2], 10) : 0;
        const ap = m[3];
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
        if (!ap) {
          // "at 8" in the evening almost always means 8pm; nudge sensibly
          if (h <= 7) h += 12;
          if (/tonight|evening|night/.test(s) && h < 12) h += 12;
        }
        at = new Date(now); at.setHours(h, min, 0, 0);
      }
    }

    if (!at && /\bnow\b|right away|straight away/.test(s)) at = new Date(now.getTime() + 60000);

    if (!at) {                              // no time given → next 5-minute mark
      at = new Date(now.getTime() + 5 * 60000);
      at.setSeconds(0, 0);
    }
    if (/tomorrow/.test(s)) at.setDate(at.getDate() + 1);
    else if (at.getTime() < now.getTime() - 60000) at.setDate(at.getDate() + 1); // already past → tomorrow

    return { durationMin, at: at.getTime(), heard: raw.trim() };
  }
  return { parse };
})();

/* ============================ NOTIFY ============================ */
const Notify = (function () {
  const supported = 'Notification' in window;
  const state = () => supported ? Notification.permission : 'unsupported';
  async function ask() {
    if (!supported) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try { return await Notification.requestPermission(); } catch (e) { return 'denied'; }
  }
  function push(title, body) {
    if (!supported || Notification.permission !== 'granted') return false;
    try { new Notification(title, { body, icon: undefined, tag: 'ally' }); return true; }
    catch (e) { return false; }
  }
  return { supported, state, ask, push };
})();
