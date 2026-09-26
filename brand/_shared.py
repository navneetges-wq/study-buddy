#!/usr/bin/env python3
"""Generate the A4 flyer (Task 2) and the 1200x700 blog banner (Task 3).

Both lead on the same claim — Lockin watches, then tells you the truth — so the
hero visual is the Session Autopsy, not a countdown dial. A dial would say
"time's up", which is the thing the headline argues against.

Authored as self-contained HTML: Eczar Bold embedded as base64, logo and QR
inlined as vector, so they render identically anywhere and rasterise cleanly.
"""
import base64, re, os

B = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
FONT = B("fonts/Eczar-Bold.ttf")
def svg_uri(p): return "data:image/svg+xml;base64," + B(p)
QR_D = re.search(r'<path d="([^"]+)"', open("print/qr.svg").read()).group(1)

PALETTE = """
  --bg:#0b0d11; --surface:#13161d; --line:rgba(255,255,255,.09);
  --line2:rgba(255,255,255,.16); --text:#e8eaf0; --dim:#9aa1af;
  --faint:#6d7483; --accent:#7c8cff; --bad:#e07b7b;
"""
FACE = (f"@font-face{{font-family:'Eczar';src:url(data:font/ttf;base64,{FONT})"
        " format('truetype');font-weight:700;font-style:normal;font-display:block}")
SANS = ('ui-sans-serif,system-ui,-apple-system,"Helvetica Neue",Inter,Roboto,'
        'Arial,sans-serif')

def ghost_ring(size, op=".042"):
    return f'''<svg class="ghost" viewBox="0 0 100 100" width="{size}" height="{size}"
     style="opacity:{op}">
  <path d="M74.09 22.72 A28 28 0 1 1 25.91 22.72" fill="none" stroke="var(--text)"
        stroke-width="14" stroke-linecap="round"/>
  <circle cx="50" cy="22" r="9.5" fill="var(--accent)"/></svg>'''

def qr(size, ink="#0b0d11", bg="#e8eaf0"):
    return (f'<svg viewBox="-1.6 -1.6 36.2 36.2" width="{size}" height="{size}">'
            f'<rect x="-1.6" y="-1.6" width="36.2" height="36.2" rx="2" fill="{bg}"/>'
            f'<path d="{QR_D}" fill="{ink}"/></svg>')

def voicebar(label, cmd, reply, cls=""):
    """The app's listening bar, caught mid-exchange. Demonstrates hands-free
    instead of describing it."""
    return f'''<div class="voice {cls}">
  <div class="vmic"><span class="vhalo"></span><span class="vdot"></span></div>
  <div class="vbody">
    <div class="vlabel">{label}</div>
    <div class="vcmd">&ldquo;{cmd}&rdquo;</div>
    <div class="vreply"><i>&#8618;</i> {reply}</div>
  </div>
</div>'''

AUTOPSY_ROWS = [("Planned", "45m", ""), ("Actually focused", "38m 12s", ""),
                ("Tab leaves", "6", "bad"), ("Time away", "4m 31s", "bad"),
                ("Distractions logged", "3", "bad")]

def autopsy(cls=""):
    rows = "".join(
        f'<div class="ar"><span>{k}</span><b class="{c}">{v}</b></div>'
        for k, v, c in AUTOPSY_ROWS)
    return f'''<div class="autopsy {cls}">
  <div class="ahd">Session autopsy</div>
  <div class="ascore"><b class="eczar">82</b><span>/100<em>focus score</em></span></div>
  <div class="arows">{rows}</div>
</div>'''

CARD_CSS = """
.autopsy{background:var(--surface);border:1px solid var(--line);border-radius:14px}
.ahd{color:var(--faint);text-transform:uppercase;border-bottom:1px solid var(--line)}
.ascore{display:flex;align-items:baseline;gap:.6em}
.ascore b{color:var(--accent);line-height:.9;letter-spacing:-.03em}
.ascore span{color:var(--faint)}
.ascore em{display:block;font-style:normal;text-transform:uppercase;letter-spacing:.14em}
.ar{display:flex;justify-content:space-between;align-items:baseline;
border-top:1px solid var(--line)}
.ar span{color:var(--dim)}
.ar b{color:var(--text);font-weight:600;font-variant-numeric:tabular-nums}
.ar b.bad{color:var(--bad)}
.eczar{font-family:'Eczar',Georgia,serif;font-weight:700}

.voice{display:flex;align-items:center;background:var(--surface);
border:1px solid var(--accent);border-radius:14px}
.vmic{position:relative;flex:none;display:grid;place-items:center}
.vhalo{position:absolute;border-radius:50%;background:var(--accent);opacity:.20}
.vdot{border-radius:50%;background:var(--accent);display:block}
.vlabel{color:var(--accent);text-transform:uppercase;letter-spacing:.16em}
.vcmd{color:var(--text);letter-spacing:-.012em}
.vreply{color:var(--dim)}
.vreply i{color:var(--accent);font-style:normal}
"""

FEATURES = [
    ("Focus Fingerprint",
     "It learns your shape — your best hour of the day, how many minutes before your "
     "attention breaks, and what pulls you away most."),
    ("Comeback streak",
     "Broke a 14-day run? Most apps punish you. Lockin invites you back — fifteen "
     "minutes today earns a Comeback Badge."),
    ("Focus Duel",
     "One link, no account. Both timers start the same second. Highest focus score "
     "takes it, and it goes on a permanent record — You vs Aisha, 4–2."),
    ("One-minute voice journal",
     "Speak for sixty seconds when a session ends. Weeks later, read exactly why that "
     "Tuesday fell apart."),
]
TRUST = [("No account", "No sign-up, no email. Open the link and it works."),
         ("No server", "Your data never leaves your computer. One button erases everything."),
         ("No install", "It's a web page. Free, instant, nothing to download.")]


# ---- additional hero visuals ----------------------------------------------
def duel(cls=""):
    """Head-to-head, mid-session. The red dot is the partner having left their tab."""
    return f'''<div class="autopsy duel {cls}">
  <div class="ahd">Focus duel <em>live</em></div>
  <div class="dgrid">
    <div class="dp">
      <span class="dn">You</span><b class="eczar">82</b>
      <span class="dm">38m focused</span><span class="dm">6 tab leaves</span>
    </div>
    <div class="dp">
      <span class="dn">Aisha <i class="away"></i></span><b class="eczar">74</b>
      <span class="dm">31m focused</span><span class="dm bad">11 tab leaves</span>
    </div>
  </div>
  <div class="drec"><span>Head to head</span><b>4 &ndash; 2</b></div>
</div>'''

COMMANDS = ["start 45 minutes", "pause", "resume", "add ten minutes",
            "log a distraction", "how am I doing", "finish"]

def commands(cls=""):
    rows = "".join(f'<div class="c">&ldquo;{c}&rdquo;</div>' for c in COMMANDS)
    return f'''<div class="autopsy cmds {cls}">
  <div class="ahd">Voice commands <em>22</em></div>
  <div class="clist">{rows}<div class="c more">&hellip; and fifteen more</div></div>
</div>'''

EXTRA_CSS = """
.duel .dgrid{display:flex}
.duel .dp{flex:1;display:flex;flex-direction:column}
.duel .dp+.dp{border-left:1px solid var(--line)}
.duel .dn{color:var(--dim);display:flex;align-items:center;gap:.5em}
.duel .dn i.away{border-radius:50%;background:var(--bad);display:inline-block}
.duel .dp b{color:var(--accent);line-height:.9;letter-spacing:-.03em}
.duel .dm{color:var(--faint)}
.duel .dm.bad{color:var(--bad)}
.duel .drec{display:flex;justify-content:space-between;align-items:baseline;
border-top:1px solid var(--line)}
.duel .drec span{color:var(--dim)}
.duel .drec b{color:var(--text);font-weight:600}
.ahd{display:flex;justify-content:space-between;align-items:center;gap:1em}
.ahd em{font-style:normal;color:var(--accent);letter-spacing:.14em}
.cmds .c{color:var(--text);border-top:1px solid var(--line)}
.cmds .c:first-child{border-top:0}
.cmds .c.more{color:var(--faint)}
"""

# ---- campaigns -------------------------------------------------------------
# Three angles on the same product, one skeleton, so they read as a family.
CAMPAIGNS = [
 dict(id="01-autopsy", kicker="Focus companion &middot; Web app",
   h1='IT COUNTS EVERY TIME<br>YOU LOOKED AWAY<span class="a">.</span>',
   deck='<s>Most timers tell you time\'s up.</s> Lockin tells you what happened.',
   hero=autopsy,
   pull="The moment you switch tabs, Lockin notices. You can&rsquo;t lie to it, "
        "because it isn&rsquo;t asking.",
   body="Every escape is counted, and every second away is separated from the time you "
        "<b>actually</b> focused. No session ends with a cheerful &ldquo;done!&rdquo; "
        "&mdash; it ends with the truth.",
   band=("Hands-free &middot; 22 voice commands", "Lockin, how am I doing?",
         "Thirty-eight minutes focused. You&rsquo;ve looked away six times."),
   note="Start, pause, extend, log a distraction, finish &mdash; none of it needs a "
        "keyboard. At the end it reads your score back and starts your reflection "
        "recording itself.",
   feats=[("Focus Fingerprint",
           "It learns your shape \u2014 your best hour of the day, how many minutes before "
           "your attention breaks, and what pulls you away most."),
          ("Comeback streak",
           "Broke a 14-day run? Most apps punish you. Lockin invites you back \u2014 "
           "fifteen minutes today earns a Comeback Badge."),
          ("Focus Duel",
           "One link, no account. Both timers start the same second. Highest focus score "
           "takes it, and it goes on a permanent record \u2014 You vs Aisha, 4\u20132."),
          ("One-minute voice journal",
           "Speak for sixty seconds when a session ends. Weeks later, read exactly why "
           "that Tuesday fell apart.")],
   fh1="12.4mm", bh1="60px", bcard="318px"),

 dict(id="02-duel", kicker="Study together &middot; No account",
   h1='ONE LINK. TWO TIMERS.<br>ONE WINNER<span class="a">.</span>',
   deck='<s>Studying alone is easy to quit.</s> This isn\'t.',
   hero=duel,
   pull="Watch your friend&rsquo;s focus climb in real time &mdash; and see the dot turn "
        "red the instant they leave their tab.",
   body="Send a link. Both timers start the same second and end the same second, and "
        "<b>nobody signs up for anything</b>. They see your numbers too.",
   band=("Nudge", "They&rsquo;ve been away four minutes.",
         "One tap flashes their screen and chimes. Use it the moment you see them drift."),
   note="When both of you finish, the duel settles on focus score and the result goes "
        "into a permanent head-to-head record. A rematch is one button away.",
   feats=[("Live accountability",
           "Their focused time, time away, tab leaves and distraction count, updating "
           "while you work. The dot goes red the second they leave."),
          ("No account, either side",
           "The invite link carries the room and the start time. No sign-up, no server, "
           "nothing to install \u2014 for you or for them."),
          ("Session Autopsy",
           "Both of you get the truth at the end: planned versus actual, tab leaves, "
           "time lost, and a focus score out of 100."),
          ("Hands-free",
           "Say &ldquo;start 45 minutes&rdquo; and it starts. 22 commands, none of them "
           "needing a keyboard.")],
   fh1="12.4mm", bh1="52px", bcard="344px"),

 dict(id="03-handsfree", kicker="Hands-free &middot; Web app",
   h1='22 COMMANDS.<br>NO KEYBOARD<span class="a">.</span>',
   deck='<s>Stop reaching for the mouse.</s> Say it, and it answers out loud.',
   hero=commands,
   pull="Ask &ldquo;how am I doing&rdquo; mid-session and it tells you. Eyes stay on "
        "the book.",
   body="Time focused, times you looked away, distractions logged &mdash; read back to "
        "you out loud. One click to allow the microphone, and after that "
        "<b>nothing needs touching</b>.",
   band=("At the end it interviews you", "That felt rough, I kept checking my phone.",
         "Recorded, transcribed and filed. Zero clicks, start to finish."),
   note="The session ends, it reads your score back, starts your reflection recording on "
        "its own, and asks how it felt. The permission is remembered, so next visit it "
        "arms itself.",
   feats=[("One-minute voice journal",
           "Speak for sixty seconds when a session ends. Weeks later, read exactly why "
           "that Tuesday fell apart."),
          ("Full-screen focus",
           "The moment a session starts the whole interface disappears. The listening "
           "bar stays \u2014 that is precisely when you don\u2019t want a keyboard."),
          ("Session Autopsy",
           "Planned versus actual, tab leaves, time lost, and a focus score out of 100. "
           "It tells you what happened, not that time is up."),
          ("Focus Duel",
           "One link, no account. Both timers start the same second. Highest focus score "
           "takes it \u2014 You vs Aisha, 4\u20132.")],
   fh1="13.4mm", bh1="66px", bcard="318px"),
]
