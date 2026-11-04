// render.cjs — capture every frame of film.html with headless Chrome.
// Usage (from this folder): python3 -m http.server 8767 &  then  node render.cjs [fps] [onlyTimes]
const { chromium } = require(process.env.HOME + "/.claude/skills/gstack/node_modules/playwright");
const fs = require("fs");
(async () => {
  const fps = +(process.argv[2] || 30), only = process.argv[3];
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  pg.on("pageerror", (e) => console.log("PAGEERR", e.message));
  await pg.goto("http://localhost:8767/film.html");
  await pg.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
  const { DURATION, CUES, BPM, MOOD, MUSIC } = await pg.evaluate(() => ({ DURATION, CUES, BPM, MOOD, MUSIC }));
  fs.writeFileSync("cues.json", JSON.stringify({ duration: DURATION, bpm: BPM, mood: MOOD, music: MUSIC, cues: CUES }));
  const out = "frames"; fs.mkdirSync(out, { recursive: true });
  const times = only ? only.split(",").map(Number) : Array.from({ length: Math.round(DURATION * fps) }, (_, i) => i / fps);
  let n = 0;
  for (const t of times) {
    await pg.evaluate((t) => renderAt(t), t);
    await pg.screenshot({ path: only ? `test_${t}.jpg` : `${out}/${String(n).padStart(5, "0")}.jpg`, type: "jpeg", quality: 92 });
    n++;
    if (!only && n % 150 === 0) console.log(`${n}/${times.length}`);
  }
  await b.close();
  console.log("done", n);
})();
