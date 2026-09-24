# Lockin

**Your partner in deep work.**

**Live app: https://navneetges-wq.github.io/study-buddy/**

You don't tell Lockin *what* you're working on. It learns *how* you work — when you're
sharpest, how long you last before you drift, what pulls you away, and how often you come back.

Plain HTML, CSS and JavaScript. No frameworks, no build step, no backend.

---

## The three required behaviours

| Requirement | Where it lives in the app |
|---|---|
| **Gets something from the internet** | Daily quote from the DummyJSON Quotes API, and live conditions from the Open-Meteo weather + geocoding APIs (drives Rainy Focus Mode / Night Focus Mode) |
| **Remembers something** | Every session, plan, reflection, mood, streak and setting is kept in `localStorage` and survives refresh — an in-flight session is even restored after an accidental reload |
| **Does something because time has passed** | The focus timer and break timer, scheduled-session reminders that fire when their time arrives, shared rooms that start
themselves when the clock reaches the time in the link, missed-plan expiry, countdown to your daily goal, day-by-day streaks and the 60-second voice-journal window |

## Study with a friend

Start a session, send the link, and two people study the same window. Nothing is hosted
anywhere: the invite link carries the room id, the host's name, an absolute start time and a
duration, so both browsers count down off the same wall clock and begin on their own.

Three layers, each useful without the ones below it:

| Layer | How it works | Works when |
|---|---|---|
| **Synced timer** | start time + duration encoded in the invite link | always, no network at all |
| **Live partner stats** | `BroadcastChannel` | same browser, two tabs |
| **Live partner stats** | a WebRTC data channel, peer to peer | across devices: send one link, paste the one reply |
| **Duel result** | a short result link you send back when you finish | always, across devices |

While a room is running you see your partner's focused time, time away, tab leaves and
distraction count, with a dot that turns red the moment they leave their tab, plus a running
"you're 4m ahead" line. You can nudge them, which flashes their page and chimes.

When both sides finish, the **Focus Duel** settles: higher focus score wins, the result goes
into a permanent head-to-head record (`3W 1L 0D` against each friend), and a rematch is one
button away.

### Connecting across devices

**Create room + live link** gives you one link to send. Your friend opens it, taps Join, and
their browser immediately hands them a reply link. You paste that reply once and you are
connected. Two messages, no server, and the tab that made the link must stay open until the
reply arrives — the connection offer lives in memory and dies with a reload.

**Private link (timer only)** is the alternative: a short link holding nothing but a room id, a
name, a timestamp and a duration. You still start and finish together; you just don't see each
other's numbers.

The difference matters because a live link carries ICE candidates, which include your network
address. That is how two browsers find each other without a server, but it means the link
should go to your study partner and nobody else. The app labels it every time it shows one.

Routing uses Google's public STUN server. On a symmetric NAT (some mobile networks) the direct
connection can fail; the synced timer and the end-of-session result links keep working
regardless, so the duel still settles.

## Design

Minimalist on purpose. One accent colour, flat surfaces, hairline borders, a single centred
column so nothing can fall out of alignment, and no decorative icons competing with the timer.

A preloader states the name and the promise — *Lockin · Your partner in deep work.* — then gets
out of the way after two seconds.

The moment a session starts, the app enters **full-screen focus**: the header, tabs, quote and
every other card disappear, leaving only the countdown, your live numbers and the distraction
log. Press Escape or the ⤢ button to bring the rest back without stopping the clock. Everything
secondary — daily goal, focus sounds, hands-free, notifications, your data — lives in a settings
drawer instead of cluttering the screen you stare at while working.

## Hands-free

It is the most distinctive thing Lockin does, so it is not buried in a menu. There is a mic
button in the header that is styled unlike every other chip, a prompt above the timer until
you have discovered it, a control in the focus-card tray, and the `M` key. The listening bar
stays on screen during full-screen focus — that is precisely when you do not want to reach for
a keyboard.


Turn on hands-free and the whole app answers to your voice. One click to allow the
microphone — no browser lets a page open the mic without it — and after that nothing needs
touching. The permission is remembered per origin, so on your next visit it arms itself.

    "Lockin, start 45 minutes"        "Lockin, how long left"
    "Lockin, pause"                   "Lockin, how am I doing"
    "Lockin, add five minutes"        "Lockin, what is my streak"
    "Lockin, I got distracted by my phone"
    "Lockin, play rain"               "Lockin, create a room"
    "Lockin, I have 35 minutes"       "Lockin, show insights"

22 commands in all, listed inside the app under *What can I say?*. Questions are answered out
loud, so you can keep your eyes on the book.

When a session ends, hands-free reads the autopsy back to you, starts the 60-second reflection
by itself, and waits for your mood — *"it was good"* — then files the whole thing. From
"Lockin, start 45 minutes" to a saved session with a spoken journal, nothing is clicked.

A wake word is required by default so that reading aloud, a lecture in the background or a
conversation can't fire commands by accident. You can switch it off for bare commands.

### What to know before relying on it

- **Chrome or Edge.** The Web Speech API doesn't exist in Firefox, and Safari's version is
  unreliable for continuous listening. The app detects this and says so.
- **Chrome sends the audio to Google's servers** to transcribe it. That is how the browser API
  works, not a choice this app makes — but if you're studying somewhere sensitive, it's worth
  knowing. Everything else in ally stays on your machine.
- **Recognition stops while the tab is in the background.** Browsers suspend the mic there,
  which matters in this app specifically, since leaving the tab is the thing it measures. You
  can't say "resume" from another tab.
- **A typed command box** sits next to the microphone button and runs the same grammar, so
  every command is usable in any browser, with or without a mic.
- The app talks back with speech synthesis. If that fails — no voices installed, muted device —
  the command still runs; only the spoken reply is lost.

### Getting the voice right

Speech recognition is confidently wrong in predictable ways, so the parser expects that rather
than demanding a clean transcript:

- Chrome is asked for **five** guesses per phrase, and the first one that means something wins.
  Its top guess is frequently not its best.
- Common mishearings are repaired before matching: *paws/pose* → pause, *finnish* → finish,
  *star/stat* → start, *brake* → break, *ad five* → add five, *low fi* → lo-fi.
- Spoken numbers become digits, including compounds — "forty five" → 45.
- Filler words are stripped, and if a stray word survives at the front ("so then start 25
  minutes") the parser shaves words off and retries.
- A long spoken reply no longer deafens the app; the ignore-window is capped at six seconds and
  clears the moment speaking actually stops.

Turning hands-free on is silent — no pop-up and no announcement. The bar just says it is
listening.

## What it does

- **Focus timer** — start, pause, extend by 5, finish early, or let it complete itself.
- **Automatic distraction detection** — the Page Visibility API notices when you leave the
  tab, and the time away is counted separately from the time you actually focused.
- **Manual distraction log** — phone, daydreaming, people, tired, hungry, other.
- **Session Autopsy** — planned vs actual focus, tab switches, time distracted, focus score.
- **One-minute voice journal** — speak your reflection after a session; speech-to-text saves it.
- **Voice planner** — "Study for 40 minutes at 8 PM" becomes a scheduled session.
- **Hands-free mode** — 22 spoken commands, spoken answers, and an autopsy that interviews you.
- **Reminders** — an in-app banner plus a browser notification when a planned session is due.
- **Focus Fingerprint** — average session, best study period, when focus usually drops, your
  most common distraction, most productive day. Appears after 3 sessions.
- **Focus sounds** — rain, waves, café, night, lo-fi, white and brown noise, all generated
  live with the Web Audio API (nothing to download).
- **"I have X minutes"** — type 35, get Focus 25 → Break 5 → Focus 5, ready to run.
- **"Just start"** — a 5, 10 or 15 minute commitment, and an offer to continue when it ends.
- **Streaks and comebacks** — a normal streak, plus a Comeback Badge for returning after a gap.
- **Focus levels** — XP for focused minutes, finishing what you planned, clean sessions with no
  tab leaves, keeping a streak and studying with someone. Ten levels, Drifter to Study Sage.
- **15 achievements** — Untouchable, Marathon, Night Owl, Deep Week, Duelist, Rival and more.

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
js/progress.js    XP, focus levels and achievements
js/together.js    rooms, invite/result links, BroadcastChannel and WebRTC transports
js/voice-control.js  always-on speech recognition, the command grammar, spoken replies
js/app.js         session engine, timers, reminders and rendering
```

## Privacy

Everything stays in your browser. No account, no server, no analytics. "Erase all my data"
in the footer clears it. The only outbound requests are the quote and weather APIs, plus a STUN
lookup if you turn on live co-study. Nothing about a shared session passes through a server: the
timer is arithmetic on a timestamp in a URL, and live stats go straight between the two browsers
over an encrypted data channel.
