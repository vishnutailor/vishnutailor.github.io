/*
 * Vishnu Tailor — wave-only opening.
 * No Neymar footage, no click-to-enter screen, no video requests.
 * Full-screen organic ripple reveals the original compact one-page website.
 */
(() => {
  'use strict';

  const canvas = document.getElementById('transition-canvas');
  const website = document.getElementById('website');
  const stage = document.getElementById('section-stage');
  const tabs = [...document.querySelectorAll('.section-tab')];
  const panes = new Map([...document.querySelectorAll('.section-pane')]
    .map(element => [element.id.replace('panel-', ''), element]));
  if (!website || !stage) return;

  let active = null;
  let frame = 0;

  function changeSection(id, immediate = false) {
    const pane = panes.get(id);
    if (!pane || (active === id && !immediate)) return;

    if (active && panes.has(active)) {
      const previous = panes.get(active);
      previous.classList.remove('is-visible');
      previous.hidden = true;
    }

    pane.hidden = false;
    active = id;
    tabs.forEach(tab => {
      const chosen = tab.dataset.section === id;
      tab.setAttribute('aria-selected', String(chosen));
      tab.tabIndex = chosen ? 0 : -1;
    });

    if (immediate) {
      stage.style.transition = 'none';
      pane.style.transition = 'none';
      pane.classList.add('is-visible');
      stage.style.height = `${pane.scrollHeight}px`;
      // Restore transitions only after the initial layout is committed.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        stage.style.transition = '';
        pane.style.transition = '';
      }));
    } else {
      requestAnimationFrame(() => {
        stage.style.height = `${pane.scrollHeight}px`;
        requestAnimationFrame(() => pane.classList.add('is-visible'));
      });
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => changeSection(tab.dataset.section));
    tab.addEventListener('keydown', event => {
      let nextIndex;
      switch (event.key) {
        case 'ArrowRight': nextIndex = (index + 1) % tabs.length; break;
        case 'ArrowLeft': nextIndex = (index + tabs.length - 1) % tabs.length; break;
        case 'Home': nextIndex = 0; break;
        case 'End': nextIndex = tabs.length - 1; break;
        default: return;
      }
      event.preventDefault();
      const next = tabs[nextIndex];
      changeSection(next.dataset.section);
      next.focus();
    });
  });

  // The visitor can read who you are as soon as the wave passes.
  changeSection('about', true);

  window.addEventListener('resize', () => {
    if (active) stage.style.height = `${panes.get(active).scrollHeight}px`;
  }, {passive:true});

  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (canvas) canvas.remove();
    return;
  }
  const ctx = canvas.getContext('2d', {alpha:true});
  if (!ctx) { canvas.remove(); return; }

  const WAVE_SECONDS = 2.45;
  let w = 0, h = 0, pixelRatio = 1;
  let startTime = 0;
  let completed = false;
  document.body.classList.add('wave-active');

  function resizeCanvas() {
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * pixelRatio);
    canvas.height = Math.round(h * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    // This only changes after the canvas is actually filled black.
    canvas.style.background = 'transparent';
  }

  function ease(t) { return t * t * (3 - 2 * t); }
  function clamp(t) { return Math.min(1, Math.max(0, t)); }
  function shape(radius, time, amplitude, phaseOffset = 0) {
    const midX = w * .5;
    const midY = h * .5;
    const steps = 260;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      // Two gently interfering waves, not a rigid oval/circle.
      const crest = Math.sin(angle * 7 - time * 12 + phaseOffset) * amplitude;
      const swell = Math.sin(angle * 11 + time * 7 + phaseOffset * .7) * amplitude * .33;
      const r = Math.max(0, radius + crest + swell);
      const x = midX + r * Math.cos(angle);
      const y = midY + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function finish() {
    if (completed) return;
    completed = true;
    cancelAnimationFrame(frame);
    document.body.classList.remove('wave-active');
    canvas.remove();
    window.removeEventListener('resize', resizeCanvas);
  }

  function render(now) {
    if (completed) return;
    try {
      if (!startTime) startTime = now;
      const t = clamp((now - startTime) / (WAVE_SECONDS * 1000));
      const p = ease(t);
      const radiusToCorners = Math.hypot(w * .5, h * .5) + 105;
      const r = 5 + radiusToCorners * p;
      const amp = Math.min(r * .11, 14 + 12 * (1 - t));

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      // Transparent opening exposes the actual website beneath the canvas.
      ctx.globalCompositeOperation = 'destination-out';
      shape(r, t, amp);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
      const fade = Math.pow(1 - t, .63);
      // A cluster of water-like crests continues expanding to the screen corners.
      ctx.strokeStyle = `rgba(255,255,255,${.68 * fade})`;
      ctx.lineWidth = 1.3;
      shape(r, t, amp);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.23 * fade})`;
      ctx.lineWidth = 1;
      shape(Math.max(0, r - 23), t, amp * .78, 1.4);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${.12 * fade})`;
      shape(Math.max(0, r - 48), t, amp * .55, 2.1);
      ctx.stroke();

      if (t >= 1) { finish(); return; }
      frame = requestAnimationFrame(render);
    } catch (error) {
      // An animation failure must never hide the portfolio.
      finish();
    }
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, {passive:true});
  frame = requestAnimationFrame(render);
  window.setTimeout(finish, WAVE_SECONDS * 1000 + 1000);
})();
