/*
 * Vishnu Tailor — black-and-white real footage -> centered particle circle
 * -> expanding two-sided wave revealing the existing one-page portfolio.
 * Page copy, section IDs, image filenames, and links are not modified here.
 */
(() => {
  'use strict';

  const canvas = document.getElementById('transition-canvas');
  const ctx = canvas && canvas.getContext('2d', { alpha: true });
  const circleScreen = document.getElementById('circle-screen');
  const enterButton = document.getElementById('enter-circle');
  const circleDisc = document.querySelector('.circle-disc');
  const skipButton = document.getElementById('skip-intro');
  const website = document.getElementById('website');
  const stage = document.getElementById('section-stage');
  const tabs = Array.from(document.querySelectorAll('.section-tab'));
  const panes = new Map(Array.from(document.querySelectorAll('.section-pane'))
    .map(el => [el.id.replace('panel-', ''), el]));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VIDEO_SOURCE = 'neymar-bw.mp4';
  const FILM_W = 640;
  const FILM_H = 360;
  const VIDEO_SPEED = 0.90;       // The same gently slowed pace as the previous site.
  const GATHER_SECONDS = 2.50;   // Film dissolves into dots, then dots reach the circle.
  const WAVE_SECONDS = 2.85;     // The clicked circle opens across both sides.

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = 1;
  let phase = 'film';
  let raf = 0;
  let startAt = 0;
  let hasStartedFilm = false;
  let activeSection = null;
  let particleDots = [];
  let gatherOrigin = { x: width / 2, y: height / 2, radius: 46 };
  let wave = null;

  const video = document.createElement('video');
  video.src = VIDEO_SOURCE;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.playbackRate = VIDEO_SPEED;
  video.setAttribute('aria-hidden', 'true');

  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = FILM_W;
  frameCanvas.height = FILM_H;
  const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });

  // A very narrow feather removes the hard edges of a 16:9 video rectangle.
  // There are no added borders, stadium drawings, or colored overlays.
  const edgeMask = document.createElement('canvas');
  edgeMask.width = FILM_W;
  edgeMask.height = FILM_H;
  const edgeCtx = edgeMask.getContext('2d');
  if (edgeCtx) {
    const mask = edgeCtx.createImageData(FILM_W, FILM_H);
    function smooth(v) { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); }
    for (let y = 0; y < FILM_H; y++) {
      const vy = Math.min(smooth(y / 20), smooth((FILM_H - y - 1) / 20));
      for (let x = 0; x < FILM_W; x++) {
        const vx = Math.min(smooth(x / 27), smooth((FILM_W - x - 1) / 27));
        const i = (y * FILM_W + x) * 4;
        mask.data[i] = mask.data[i + 1] = mask.data[i + 2] = 255;
        mask.data[i + 3] = Math.round(vx * vy * 255);
      }
    }
    edgeCtx.putImageData(mask, 0, 0);
  }

  function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }
  function ease(v) { const t = clamp(v); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function noise(n) { const a = Math.sin(n * 127.1 + 36.771) * 43758.5453; return a - Math.floor(a); }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    if (!ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (phase === 'ready' || phase === 'circle') ctx.clearRect(0, 0, width, height);
  }
  resize();
  window.addEventListener('resize', () => {
    resize();
    if (activeSection) stage.style.height = `${panes.get(activeSection).scrollHeight}px`;
  }, { passive: true });

  function filmBox() {
    const scale = Math.min(width * .80 / FILM_W, height * .65 / FILM_H, 1.85);
    const w = FILM_W * scale;
    const h = FILM_H * scale;
    return { x: (width - w) / 2, y: (height - h) / 2, w, h, scale };
  }

  function paintVideoFrame() {
    if (!frameCtx || video.readyState < 2) return false;
    frameCtx.clearRect(0, 0, FILM_W, FILM_H);
    frameCtx.globalCompositeOperation = 'source-over';
    frameCtx.drawImage(video, 0, 0, FILM_W, FILM_H);
    if (edgeCtx) {
      frameCtx.globalCompositeOperation = 'destination-in';
      frameCtx.drawImage(edgeMask, 0, 0);
      frameCtx.globalCompositeOperation = 'source-over';
    }
    return true;
  }

  function drawStill(alpha = 1) {
    if (!ctx) return;
    const box = filmBox();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(frameCanvas, box.x, box.y, box.w, box.h);
    ctx.restore();
  }

  function filmFrame() {
    if (phase !== 'film' || !ctx) return;
    if (paintVideoFrame()) {
      ctx.clearRect(0, 0, width, height);
      drawStill();
    }
    if (video.ended || (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime >= video.duration - .025)) {
      beginGather();
      return;
    }
    raf = requestAnimationFrame(filmFrame);
  }

  function circleGeometry() {
    // This MUST match the real button's white disc, including on small screens.
    const r = circleDisc.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.width / 2 };
  }

  function sampleLastFrame() {
    const points = [];
    const { data } = frameCtx.getImageData(0, 0, FILM_W, FILM_H);
    const box = filmBox();
    const gap = 5;
    for (let y = 1; y < FILM_H; y += gap) {
      for (let x = 1; x < FILM_W; x += gap) {
        const idx = (y * FILM_W + x) * 4;
        const level = data[idx];
        const alpha = data[idx + 3];
        if (level < 26 || alpha < 42) continue;
        // Moderately light pixels become particles. Brighter details carry more weight.
        const acceptance = .32 + .68 * Math.pow(level / 255, .65);
        if (noise(x * 11.13 + y * 29.37) > acceptance) continue;
        points.push({
          x: box.x + x * box.scale,
          y: box.y + y * box.scale,
          r: clamp(box.scale * .75, .75, 1.28),
          alpha: clamp(level / 210, .54, 1)
        });
      }
    }
    return points;
  }

  function beginGather() {
    if (phase !== 'film') return;
    phase = 'gather';
    cancelAnimationFrame(raf);
    video.pause();
    skipButton.classList.add('is-hidden');
    if (!paintVideoFrame()) { showCircle(); return; }
    circleScreen.hidden = false; // CSS hides the circle until the particles arrive.
    circleScreen.style.pointerEvents = 'none';
    gatherOrigin = circleGeometry();
    const samples = sampleLastFrame();
    if (!samples.length) { showCircle(); return; }
    const phi = 2.399963229728653; // Golden angle fills the entire circle evenly.
    particleDots = samples.map((p, i) => {
      const a = i * phi;
      const finalRad = (gatherOrigin.radius - 1.5) * Math.sqrt((i + .5) / samples.length);
      const dx = p.x - gatherOrigin.x;
      const dy = p.y - gatherOrigin.y;
      const direction = Math.atan2(dy, dx) + (noise(i * .77) - .5) * .4;
      const drift = 24 + 45 * noise(i + 400);
      return { ...p,
        ex: p.x + Math.cos(direction) * drift,
        ey: p.y + Math.sin(direction) * drift,
        tx: gatherOrigin.x + Math.cos(a) * finalRad,
        ty: gatherOrigin.y + Math.sin(a) * finalRad
      };
    });
    startAt = performance.now();
    raf = requestAnimationFrame(gatherFrame);
  }

  function gatherFrame(now) {
    if (phase !== 'gather' || !ctx) return;
    const t = clamp((now - startAt) / (1000 * GATHER_SECONDS));
    ctx.clearRect(0, 0, width, height);
    // No freeze: the last image immediately separates into a field of particles.
    if (t < .23) drawStill(1 - ease(t / .23));
    const scatter = ease(t / .32);
    const converge = ease((t - .12) / .88);
    ctx.fillStyle = '#fff';
    const formationOpacity = ease(t / .22);
    for (const p of particleDots) {
      const ex = lerp(p.x, p.ex, scatter);
      const ey = lerp(p.y, p.ey, scatter);
      const x = lerp(ex, p.tx, converge);
      const y = lerp(ey, p.ty, converge);
      ctx.globalAlpha = p.alpha * formationOpacity + converge * (1 - p.alpha);
      const radius = lerp(p.r, 1.35, converge);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (t >= 1) { showCircle(); return; }
    raf = requestAnimationFrame(gatherFrame);
  }

  function showCircle() {
    if (phase === 'ready' || phase === 'wave') return;
    cancelAnimationFrame(raf);
    phase = 'circle';
    video.pause();
    skipButton.classList.add('is-hidden');
    skipButton.hidden = true;
    circleScreen.hidden = false;
    enterButton.classList.remove('exiting');
    requestAnimationFrame(() => {
      enterButton.classList.add('is-visible');
      circleScreen.style.pointerEvents = 'auto';
      setTimeout(() => { if (phase === 'circle' && ctx) ctx.clearRect(0, 0, width, height); }, 280);
    });
  }

  function startWave() {
    if (phase !== 'circle') return;
    phase = 'wave';
    circleScreen.style.pointerEvents = 'none';
    enterButton.classList.add('exiting');
    const origin = circleGeometry();
    const box = website.getBoundingClientRect();
    const relativeX = origin.x - box.left;
    const relativeY = origin.y - box.top;
    const horizontal = Math.max(relativeX, box.width - relativeX) + 44;
    const vertical = Math.max(relativeY, box.height - relativeY) + 52;
    wave = { origin, relativeX, relativeY, horizontal, vertical };
    website.classList.add('is-wave');
    website.style.clipPath = `ellipse(0px 0px at ${relativeX}px ${relativeY}px)`;
    startAt = performance.now();
    raf = requestAnimationFrame(waveFrame);
  }

  function waveFrame(now) {
    if (phase !== 'wave' || !ctx || !wave) return;
    const t = clamp((now - startAt) / (1000 * WAVE_SECONDS));
    const spreadX = ease(t);
    // Horizontal sides expand just ahead of the vertical wave, as requested.
    const spreadY = ease((t - .08) / .92);
    const rx = lerp(wave.origin.radius, wave.horizontal, spreadX);
    const ry = lerp(wave.origin.radius, wave.vertical, spreadY);
    website.style.clipPath = `ellipse(${rx}px ${ry}px at ${wave.relativeX}px ${wave.relativeY}px)`;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    const fade = Math.pow(1 - t, 1.1);
    const { x, y } = wave.origin;
    // Two quiet concentric waves instead of an explosive particle scatter.
    ctx.strokeStyle = `rgba(255,255,255,${.68 * fade})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${.22 * fade})`;
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(1,rx - 18), Math.max(1,ry - 13), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 110; i++) {
      const angle = i * 2.399963229728653;
      const jitter = (noise(i + 80) - .5) * 13;
      const px = x + (rx + jitter) * Math.cos(angle);
      const py = y + (ry + jitter) * Math.sin(angle);
      ctx.globalAlpha = (.12 + .5 * noise(i + 600)) * fade;
      ctx.beginPath(); ctx.arc(px, py, .75 + noise(i + 201) * .6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (t >= 1) { finishWave(); return; }
    raf = requestAnimationFrame(waveFrame);
  }

  function finishWave() {
    cancelAnimationFrame(raf);
    phase = 'ready';
    website.classList.remove('is-wave');
    website.classList.add('is-ready');
    website.style.clipPath = 'none';
    website.removeAttribute('aria-hidden');
    circleScreen.hidden = true;
    skipButton.hidden = true;
    ctx.clearRect(0, 0, width, height);
  }

  function goToSection(id) {
    const next = panes.get(id);
    if (!next || id === activeSection) return;
    const previous = activeSection ? panes.get(activeSection) : null;
    if (previous) { previous.classList.remove('is-visible'); previous.hidden = true; }
    next.hidden = false;
    activeSection = id;
    tabs.forEach(tab => {
      const selected = tab.dataset.section === id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    const measured = next.scrollHeight;
    requestAnimationFrame(() => {
      stage.style.height = `${measured}px`;
      requestAnimationFrame(() => next.classList.add('is-visible'));
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => goToSection(tab.dataset.section));
    tab.addEventListener('keydown', event => {
      let target = index;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = tabs.length - 1;
      else return;
      event.preventDefault();
      goToSection(tabs[target].dataset.section);
      tabs[target].focus();
    });
  });

  enterButton.addEventListener('click', () => {
    if (reducedMotion || !ctx) {
      phase = 'wave';
      website.classList.add('is-ready');
      website.removeAttribute('aria-hidden');
      circleScreen.hidden = true;
      phase = 'ready';
    } else startWave();
  });
  skipButton.addEventListener('click', () => {
    if (phase === 'film' || phase === 'gather') showCircle();
  });

  if (reducedMotion || !ctx || !frameCtx) {
    showCircle();
    return;
  }
  video.addEventListener('ended', beginGather);
  video.addEventListener('error', () => { if (phase === 'film') showCircle(); });
  video.addEventListener('loadeddata', () => {
    if (phase !== 'film' || hasStartedFilm) return;
    hasStartedFilm = true;
    video.playbackRate = VIDEO_SPEED;
    video.play().then(() => {
      if (phase === 'film') raf = requestAnimationFrame(filmFrame);
    }).catch(() => { if (phase === 'film') showCircle(); });
  }, { once: true });
  // Fallback if a browser never supplies a playable frame.
  setTimeout(() => { if (phase === 'film' && !hasStartedFilm) showCircle(); }, 5000);
  video.load();
})();
