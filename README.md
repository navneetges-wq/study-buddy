# Study Buddy

**Plan less. Focus better. Understand how you study.**

You don't tell Study Buddy *what* you're studying. It learns *how* you study — when you're
sharpest, how long you last before you drift, what pulls you away, and how often you come back.

Plain HTML, CSS and JavaScript. No frameworks, no build step, no backend.

---

## The three required behaviours

| Requirement | Where it lives in the app |
|---|---|
| **Gets something from the internet** | Daily quote from the DummyJSON Quotes API, and live conditions from the Open-Meteo weather + geocoding APIs (drives Rainy Focus Mode / Night Focus Mode) |
| **Remembers something** | Every session, plan, reflection, mood, streak and setting is kept in `localStorage` and survives refresh — an in-flight session is even restored after an accidental reload |
| **Does something because time has passed** | The focus timer and break timer, scheduled-session reminders that fire when their time arrives, missed-plan expiry, countdown to your daily goal, day-by-day streaks and the 60-second voice-journal window |

## What it does

- **Focus timer** — start, pause, extend by 5, finish early, or let it complete itself.
- **Automatic distraction detection** — the Page Visibility API notices when you leave the
  tab, and the time away is counted separately from the time you actually focused.
- **Manual distraction log** — phone, daydreaming, people, tired, hungry, other.
- **Session Autopsy** — planned vs actual focus, tab switches, time distracted, focus score.
- **One-minute voice journal** — speak your reflection after a session; speech-to-text saves it.
- **Voice planner** — "Study for 40 minutes at 8 PM" becomes a scheduled session.
- **Reminders** — an in-app banner plus a browser notification when a planned session is due.
- **Focus Fingerprint** — average session, best study period, when focus usually drops, your
  most common distraction, most productive day. Appears after 3 sessions.
- **Focus sounds** — rain, waves, café, night, lo-fi, white and brown noise, all generated
  live with the Web Audio API (nothing to download).
- **"I have X minutes"** — type 35, get Focus 25 → Break 5 → Focus 5, ready to run.
- **"Just start"** — a 5, 10 or 15 minute commitment, and an offer to continue when it ends.
- **Streaks and comebacks** — a normal streak, plus a Comeback Badge for returning after a gap.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8811
```

Then visit http://localhost:8811.

Speech recognition and notifications need `https://` or `localhost` — they are silently
skipped elsewhere, and every voice feature has a typed fallback. Speech recognition works in
Chrome and Edge; Firefox has none, so the journal falls back to the textarea.

## Files

```
index.html        markup for the four views and the autopsy dialog
styles.css        theming (the palette shifts with weather and time of day)
js/store.js       localStorage, scoring, analytics, streaks, Focus Fingerprint
js/ambience.js    Web Audio focus sounds and the end-of-session chime
js/services.js    quotes API, weather API, speech recognition, voice-command parser
js/app.js         session engine, timers, reminders and rendering
```

## Privacy

Everything stays in your browser. No account, no server, no analytics. "Erase all my data"
in the footer clears it. The only outbound requests are the quote and weather APIs.
