/*
 * Vishnu Tailor — one-page film → circle → typographic portfolio.
 * The source film is a preprocessed, coach-free outline of the actual goal.
 * There is deliberately no full-frame dot filter or video rectangle.
 */
(() => {
  'use strict';

  const canvas = document.getElementById('transition-canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  const circleScreen = document.getElementById('circle-screen');
  const enterButton = document.getElementById('enter-circle');
  const skipButton = document.getElementById('skip-intro');
  const website = document.getElementById('website');
  const stage = document.getElementById('section-stage');
  const tabs = [...document.querySelectorAll('.section-tab')];
  const panes = new Map([...document.querySelectorAll('.section-pane')].map(el => [el.id.replace('panel-', ''), el]));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FILM_WIDTH = 640;
  const FILM_HEIGHT = 360;
  const VIDEO_SPEED = 0.90; // Deliberately slightly slower than the original recording.
  const GATHER_SECONDS = 2.05;
  const CONSTRUCTION_SECONDS = 5.3; // The website is assembled gradually, not flashed on screen.
  const FONT_SAMPLE_GAP = 2;

  let width = window.innerWidth;
  let height = window.innerHeight;
  let deviceScale = 1;
  let frameRequest = 0;
  let phase = 'film';
  let filmDots = [];
  let gatheredDots = [];
  let buildDots = [];
  let stateStart = 0;
  let filmStarted = false;
  let activeSection = null;

  const frameBuffer = document.createElement('canvas');
  frameBuffer.width = FILM_WIDTH;
  frameBuffer.height = FILM_HEIGHT;
  const frameCtx = frameBuffer.getContext('2d', { willReadFrequently: true });
  const video = document.createElement('video');
  video.src = 'neymar-outline.mp4';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.playbackRate = VIDEO_SPEED;
  video.setAttribute('aria-hidden', 'true');

  function clamp(v, min = 0, max = 1) { return Math.max(min, Math.min(max, v)); }
  function ease(v) { const u = clamp(v); return u * u * (3 - 2 * u); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function random(index) { const x = Math.sin(index * 127.1 + 37.17) * 43758.5453; return x - Math.floor(x); }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    deviceScale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * deviceScale);
    canvas.height = Math.round(height * deviceScale);
    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    if (phase === 'circle' || phase === 'ready') ctx.clearRect(0, 0, width, height);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  function drawFilm() {
    if (video.readyState < 2 || !frameCtx) return;
    frameCtx.clearRect(0, 0, FILM_WIDTH, FILM_HEIGHT);
    frameCtx.drawImage(video, 0, 0, FILM_WIDTH, FILM_HEIGHT);
    const pixels = frameCtx.getImageData(0, 0, FILM_WIDTH, FILM_HEIGHT).data;
    const scale = Math.min(width * .92 / FILM_WIDTH, height * .79 / FILM_HEIGHT, 1.95);
    const offsetX = (width - FILM_WIDTH * scale) / 2;
    const offsetY = (height - FILM_HEIGHT * scale) / 2;
    const dotRadius = clamp(.58 * scale, .55, 1.22);
    const fresh = [];
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';

    // Convert only the isolated white SUBJECT outlines to microdots.
    // The black source contains no pitch, crowds, sponsors, or broadcast box.
    for (let y = 0; y < FILM_HEIGHT - 1; y += 2) {
      for (let x = 0; x < FILM_WIDTH - 1; x += 2) {
        const i = (y * FILM_WIDTH + x) * 4;
        const j = i + 4;
        const k = i + FILM_WIDTH * 4;
        const l = k + 4;
        const value = Math.max(pixels[i], pixels[j], pixels[k], pixels[l]);
        if (value < 90) continue;
        const fx = offsetX + (x + 1) * scale;
        const fy = offsetY + (y + 1) * scale;
        ctx.globalAlpha = clamp(value / 215, .66, 1);
        ctx.beginPath();
        ctx.arc(fx, fy, dotRadius, 0, Math.PI * 2);
        ctx.fill();
        fresh.push({ x: fx, y: fy, r: dotRadius });
      }
    }
    ctx.globalAlpha = 1;
    filmDots = fresh;
  }

  function filmFrame() {
    if (phase !== 'film') return;
    drawFilm();
    // Rely on media time rather than an independent timer. This prevents
    // a frozen last frame when a browser decodes more slowly than expected.
    if (video.ended || (Number.isFinite(video.duration) && video.duration > 0 && video.currentTime >= video.duration - .032)) {
      beginGather();
      return;
    }
    frameRequest = requestAnimationFrame(filmFrame);
  }

  function beginGather() {
    if (phase !== 'film') return;
    phase = 'gather';
    video.pause();
    skipButton.classList.add('is-hidden');
    if (!filmDots.length) {
      // Never leave visitors trapped on a blank screen if video decoding fails.
      showCircle();
      return;
    }
    stateStart = performance.now();
    gatheredDots = filmDots.map((dot, index) => {
      const turn = index * 2.399963229728653;
      const dist = Math.sqrt((index + .5) / filmDots.length) * 47;
      const ox = Math.cos(turn) * dist;
      const oy = Math.sin(turn) * dist;
      const a = Math.atan2(dot.y - height / 2, dot.x - width / 2);
      const extra = 28 + 90 * random(index + 701);
      return { ...dot,
        mx: dot.x + Math.cos(a) * extra,
        my: dot.y + Math.sin(a) * extra,
        tx: width / 2 + ox,
        ty: height / 2 + oy,
        seed: index
      };
    });
    frameRequest = requestAnimationFrame(gatherFrame);
  }

  function gatherFrame(now) {
    if (phase !== 'gather') return;
    const t = clamp((now - stateStart) / 1000 / GATHER_SECONDS);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#ffffff';
    for (const point of gatheredDots) {
      const out = ease(t / .25);
      const inward = ease((t - .18) / .82);
      const x = lerp(lerp(point.x, point.mx, out), point.tx, inward);
      const y = lerp(lerp(point.y, point.my, out), point.ty, inward);
      const r = lerp(point.r, 1.15, inward);
      ctx.globalAlpha = .9;
      ctx.beginPath();ctx.arc(x, y, r, 0, Math.PI * 2);ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (t >= 1) { showCircle(); return; }
    frameRequest = requestAnimationFrame(gatherFrame);
  }

  function showCircle() {
    cancelAnimationFrame(frameRequest);
    phase = 'circle';
    skipButton.classList.add('is-hidden');
    skipButton.hidden = true;
    circleScreen.hidden = false;
    // The CSS circle overlaps the completed dot cluster before it replaces it.
    requestAnimationFrame(() => {
      enterButton.classList.add('is-visible');
      setTimeout(() => ctx.clearRect(0, 0, width, height), 380);
    });
  }

  function textTargets(element, group, underline = false) {
    const list = [];
    const node = [...element.childNodes].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
    if (!node) return list;
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return list;
    const mask = document.createElement('canvas');
    const bw = Math.max(1, Math.ceil(box.width + 10));
    const bh = Math.max(1, Math.ceil(box.height + 16));
    mask.width = bw; mask.height = bh;
    const ink = mask.getContext('2d', { willReadFrequently: true });
    const style = getComputedStyle(element);
    ink.fillStyle = '#fff';
    ink.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    ink.textBaseline = 'alphabetic';
    const text = node.textContent.trim();
    ink.fillText(text, 5, 5 + box.height * .82);
    if (underline) ink.fillRect(5, 5 + box.height * .94, box.width, 1);
    const pix = ink.getImageData(0, 0, bw, bh).data;
    for (let y = 0; y < bh; y += FONT_SAMPLE_GAP) {
      for (let x = 0; x < bw; x += FONT_SAMPLE_GAP) {
        if (pix[(y * bw + x) * 4 + 3] < 105) continue;
        list.push({ x: box.left - 5 + x, y: box.top - 5 + y, group });
      }
    }
    return list;
  }

  function lineTargets(element, group) {
    const r = element.getBoundingClientRect();
    const out = [];
    for (let x = r.left; x <= r.right; x += 2.3) out.push({ x, y: r.top + r.height / 2, group });
    return out;
  }

  function constructionTargets() {
    // Read the REAL positions of the final DOM. The text is genuine Times New Roman,
    // and no screenshot or substitute website is used during the transition.
    const a = [];
    a.push(...textTargets(document.querySelector('.masthead h1'), 0));
    a.push(...textTargets(document.querySelector('.subtitle'), 1));
    for (const b of tabs) a.push(...textTargets(b, 2, true));
    a.push(...lineTargets(document.querySelector('.lower-rule'), 3));
    for (const link of document.querySelectorAll('.contact-links a')) a.push(...textTargets(link, 4));
    return a;
  }

  function startConstruction() {
    if (phase !== 'circle') return;
    phase = 'building';
    circleScreen.style.pointerEvents = 'none';
    enterButton.classList.add('exiting');
    website.classList.add('is-constructing');
    website.style.visibility = 'visible';
    const targets = constructionTargets();
    if (!targets.length) { finishConstruction(); return; }
    buildDots = targets.map((p, index) => {
      const theta = index * 2.399963229728653;
      const radius = 48 * Math.sqrt((index + .5) / targets.length);
      const mx = width / 2 + Math.cos(theta) * (145 + 175 * random(index + 11));
      const my = height / 2 + Math.sin(theta) * (105 + 150 * random(index + 31));
      return { ...p,
        sx: width / 2 + Math.cos(theta) * radius,
        sy: height / 2 + Math.sin(theta) * radius,
        mx, my
      };
    });
    stateStart = performance.now();
    frameRequest = requestAnimationFrame(constructionFrame);
  }

  function constructionFrame(now) {
    if (phase !== 'building') return;
    const elapsed = (now - stateStart) / 1000;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    for (const p of buildDots) {
      const blast = ease(elapsed / .8);
      // The name arrives first, then the subtitle, tabs, rule and footer.
      const delay = [.55, 1.17, 1.85, 2.55, 3.0][p.group];
      const duration = [1.45, 1.55, 1.65, 1.45, 1.45][p.group];
      const arrive = ease((elapsed - delay) / duration);
      const x = lerp(lerp(p.sx, p.mx, blast), p.x, arrive);
      const y = lerp(lerp(p.sy, p.my, blast), p.y, arrive);
      ctx.globalAlpha = .82 + arrive * .18;
      const r = lerp(1.15, .93, arrive);
      ctx.beginPath();ctx.arc(x, y, r, 0, Math.PI * 2);ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (elapsed > 4.48 && !website.classList.contains('is-ready')) {
      website.classList.add('is-ready');
      website.removeAttribute('aria-hidden');
    }
    if (elapsed >= CONSTRUCTION_SECONDS) { finishConstruction(); return; }
    frameRequest = requestAnimationFrame(constructionFrame);
  }

  function finishConstruction() {
    phase = 'ready';
    website.classList.add('is-ready');
    website.classList.remove('is-constructing');
    website.removeAttribute('aria-hidden');
    circleScreen.hidden = true;
    ctx.clearRect(0, 0, width, height);
    skipButton.hidden = true;
  }

  function goToSection(id) {
    const next = panes.get(id);
    if (!next || id === activeSection) return;
    const previous = activeSection && panes.get(activeSection);
    if (previous) {
      previous.classList.remove('is-visible');
      previous.hidden = true;
    }
    next.hidden = false;
    activeSection = id;
    tabs.forEach(button => {
      const selected = button.dataset.section === id;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    const targetHeight = next.scrollHeight;
    requestAnimationFrame(() => {
      stage.style.height = `${targetHeight}px`;
      requestAnimationFrame(() => next.classList.add('is-visible'));
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => goToSection(tab.dataset.section));
    tab.addEventListener('keydown', event => {
      let destination = index;
      if (event.key === 'ArrowRight') destination = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') destination = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') destination = 0;
      else if (event.key === 'End') destination = tabs.length - 1;
      else return;
      event.preventDefault();
      goToSection(tabs[destination].dataset.section);
      tabs[destination].focus();
    });
  });
  window.addEventListener('resize', () => {
    if (activeSection) stage.style.height = `${panes.get(activeSection).scrollHeight}px`;
  }, { passive: true });

  enterButton.addEventListener('click', startConstruction);
  skipButton.addEventListener('click', () => {
    video.pause();
    if (phase === 'film') showCircle();
    else if (phase === 'gather') showCircle();
  });

  if (reducedMotion || !ctx || !frameCtx) {
    phase = 'circle';
    showCircle();
    return;
  }

  video.addEventListener('ended', beginGather);
  video.addEventListener('error', () => {
    if (phase === 'film') showCircle();
  });
  video.addEventListener('loadeddata', () => {
    if (phase !== 'film' || filmStarted) return;
    filmStarted = true;
    video.playbackRate = VIDEO_SPEED;
    video.play().then(() => {
      if (phase === 'film') frameRequest = requestAnimationFrame(filmFrame);
    }).catch(() => {
      if (phase === 'film') showCircle();
    });
  }, { once: true });
  video.load();
})();
