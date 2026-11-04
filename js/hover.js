/* ------------------------------------------------------------------
   hover.js — buttons swell, lean towards the cursor and carry a light
   spot; cards tilt slightly and lift; dark panels get one soft light
   that follows the mouse. The page sets which elements take part via
   data-hover-* on <body> (the app keeps it to buttons only).
   Off on touch screens and for people who prefer less motion.
-------------------------------------------------------------------*/
(() => {
  if (matchMedia('(pointer: coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const d = document.body.dataset;
  const pick = (key, fallback) => (key in d ? d[key] : fallback);   // an empty attribute switches that kind off
  const BUTTONS = pick('hoverButtons', '.btn, .nav-cta');
  const CARDS = pick('hoverCards', '.feature');
  const PANELS = pick('hoverPanels', '.lp-main, .l-demo');
  const ANY = [BUTTONS, CARDS].filter(Boolean).join(', ');
  let active = null, frame = 0, lastEvent = null;

  const reset = (el) => {
    el.classList.remove('is-hot');
    for (const v of ['--tx', '--ty', '--rx', '--ry']) el.style.removeProperty(v);
  };

  const update = () => {
    frame = 0;
    const e = lastEvent;
    const target = e && e.target instanceof Element ? e.target : null;

    const panel = target && PANELS ? target.closest(PANELS) : null;
    if (PANELS) document.querySelectorAll('.is-lit').forEach((p) => { if (p !== panel) p.classList.remove('is-lit'); });
    if (panel) {
      const pr = panel.getBoundingClientRect();
      panel.style.setProperty('--px', `${e.clientX - pr.left}px`);
      panel.style.setProperty('--py', `${e.clientY - pr.top}px`);
      panel.classList.add('is-lit');
    }

    const el = target && ANY ? target.closest(ANY) : null;
    if (active && active !== el) { reset(active); active = null; }
    if (!el || el.disabled) return;
    active = el;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const dx = x / r.width - 0.5, dy = y / r.height - 0.5;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);
    if (BUTTONS && el.matches(BUTTONS)) {
      el.style.setProperty('--tx', `${dx * 10}px`);
      el.style.setProperty('--ty', `${dy * 8}px`);
    } else {
      el.style.setProperty('--rx', `${(-dy * 5).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(dx * 6).toFixed(2)}deg`);
      el.style.setProperty('--tx', `${(dx * 8).toFixed(1)}px`);
      el.style.setProperty('--ty', `${(dy * 6).toFixed(1)}px`);
    }
    el.classList.add('is-hot');
  };

  addEventListener('pointermove', (e) => { lastEvent = e; if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  document.addEventListener('pointerleave', () => { if (active) reset(active); active = null; document.querySelectorAll('.is-lit').forEach((p) => p.classList.remove('is-lit')); });
  addEventListener('scroll', () => { if (active) { reset(active); active = null; } }, { passive: true });
})();
