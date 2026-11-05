# Lockin — notes for Claude

Lockin is a free focus timer that counts every time you look away (tab leaves + logged distractions), with hands-free
voice control, study-with-a-friend duels, focus sounds, plans and a session "autopsy". Owner: Navneet (non-technical).
Plain HTML/CSS/JS, no build step, no backend. Everything is saved in the browser (localStorage key `lockin.v1`).

## Live links
- App: https://navneetges-wq.github.io/study-buddy/ (index.html — keep it there: room invite links point at it)
- Landing: https://navneetges-wq.github.io/study-buddy/landing.html
- GitHub: https://github.com/navneetges-wq/study-buddy — **pushing to main deploys** (GitHub Pages, ~1 min)
- Discord: https://discord.gg/kxqSxHcb

## Layout
- `index.html`, `styles.css`, `js/` (store, ambience, services, progress, together, voice-control, app) — the app.
  The polish layer is at the end of styles.css. Word of the day stays hidden in full-screen focus until "More".
- `landing.html`, `landing.css`, `js/landing.js` (+ `js/ink.js`, `js/hover.js`) — the landing page, "your hour, honestly":
  WebGL smoke-ring hero, an hour scrubbed by scroll, hands-free (the key feature: live mic try-it using
  `VoiceControl.parse`), live "times you looked away" counter, focus lens, duel race, printed receipt, film, lock ring.
- `brand/film/` — the 30s film "One hour" (film.html → render.cjs → sound.py → encode/webify; README there).
  Web copy: `media/lockin-film.mp4` + poster.
- `mac/` — the native Mac app (Swift + WKWebView, no Xcode): `./build.sh` → `mac/build/Lockin.app` + zip.
  bridge.js swaps in native speech, voice, notifications, clipboard, app-switch "looked away", menu-bar timer.
  The app bundles its own copy of the web files: rebuild it after changing the app. Installed at ~/Applications/Lockin.app.

## How to talk to the owner
- Simple English, short, no jargon. Show results, not process. When they say "don't ask me anything", just do it.
- Budget ₹0. Look: night #0b0d11, indigo #7c8cff, red #e07b7b for drift, Manrope + JetBrains Mono, one ring as the motif.
  Minimal copy, visual over text. They dislike lag, clutter and AI-looking effects (rolling numbers, glitch/decode text).
- Never invent stats. Sample numbers must be labelled; real numbers come from the visitor's own localStorage.

## Working rules
- Bump `?v=` on css/js in the HTML after changing them (browsers cache hard). Tell the owner Cmd+Shift+R.
- Check layouts at desktop and phone width (no sideways scroll). The browser pane goes stale at emulated sizes —
  headless Playwright screenshots work (`~/.claude/skills/gstack/node_modules/playwright`, add
  `--use-angle=swiftshader` for WebGL). An element fully hidden by clip-path never triggers IntersectionObserver.
- Keep the working tree's unrelated changes (deleted brand files, lockin-launch folders) out of commits unless asked.

# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/scrape`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.
