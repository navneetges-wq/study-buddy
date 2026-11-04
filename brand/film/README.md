# Lockin film — "One hour"

30-second 16:9 film for the landing page. One rule: everything happens on one ring
(Lockin's dial, which is also its logo). The web copy lives at `media/lockin-film.mp4`,
the poster at `media/lockin-film-poster.jpg`.

Story: an empty ring → an hour plays out in six seconds, every drift turns the ring red
(phone, one quick tab, daydream, phone again, group chat) → "It felt like an hour." /
"You focused for 31 minutes." → the ring opens at the top and the dot drops in: the logo →
the product (leave the tab, log the pull, the autopsy) → hands-free, duels, focus sounds →
end card.

Rebuild (needs Playwright from gstack, numpy, macOS):

    python3 -m http.server 8767 &                 # from this folder
    node render.cjs                               # frames/ + cues.json
    python3 sound.py                              # audio.wav (synthesised, no samples)
    afconvert -f m4af -d aac -b 256000 audio.wav audio.m4a
    swiftc -O encode.swift -o encode && ./encode frames 30 audio.m4a lockin-film-30s.mp4
    swift webify.swift lockin-film-30s.mp4 ../../media/lockin-film.mp4 3200 ../../media/lockin-film-poster.jpg 12.4

Check a few frames first with `node render.cjs 30 "5,11.8,14.6"` (writes test_*.jpg).
