(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const cursor = document.createElement('div');
    cursor.className = 'circle-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursor);
    document.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
      document.documentElement.classList.add('custom-cursor');
      cursor.classList.add('shown');
      cursor.classList.toggle('over-link', Boolean(event.target.closest('a, button, input, textarea, select, [role="button"]')));
    });
    const hide = () => {
      cursor.classList.remove('shown');
      document.documentElement.classList.remove('custom-cursor');
    };
    document.addEventListener('pointerout', event => { if (!event.relatedTarget) hide(); });
    window.addEventListener('blur', hide);
  }
  const stage = document.querySelector('.name-stage');
  if (stage && !reduced) {
    const heading = stage.querySelector('h1');
    heading.setAttribute('aria-label', heading.textContent);
    const words = heading.textContent.trim().split(/\s+/);
    heading.textContent = '';
    const letters = [];
    words.forEach((word, index) => {
      if (index) heading.appendChild(document.createTextNode(' '));
      const group = document.createElement('span');
      group.className = 'name-word';
      group.setAttribute('aria-hidden', 'true');
      [...word].forEach(character => {
        const cell = document.createElement('span');
        cell.className = 'letter-cell';
        const glyph = document.createElement('span');
        glyph.className = 'name-letter';
        glyph.textContent = character;
        cell.appendChild(glyph);
        group.appendChild(cell);
        letters.push({ cell, glyph });
      });
      heading.appendChild(group);
    });
    let frame = 0;
    let pointer = null;
    const update = () => {
      frame = 0;
      const radius = Math.min(160, stage.clientWidth * .32);
      letters.forEach(({cell, glyph}) => {
        const rect = cell.getBoundingClientRect();
        const dx = pointer ? rect.left + rect.width / 2 - pointer.x : 0;
        const dy = pointer ? rect.top + rect.height / 2 - pointer.y : 0;
        const proximity = pointer ? Math.max(0, 1 - Math.hypot(dx, dy) / radius) : 0;
        const strength = proximity * proximity * (3 - 2 * proximity);
        const push = Math.sign(dx) * strength * 7;
        glyph.style.transform = `translate(${push}px, ${-strength * 9}px) scale(${1 + strength * .22}, ${1 + strength * .42})`;
      });
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    stage.addEventListener('pointermove', event => {
      pointer = {x: event.clientX, y: event.clientY};
      queue();
    });
    const reset = () => { pointer = null; queue(); };
    stage.addEventListener('pointerleave', reset);
    stage.addEventListener('pointercancel', reset);
    stage.addEventListener('pointerup', event => { if (event.pointerType === 'touch') reset(); });
    window.addEventListener('blur', reset);
    window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
  }
  if (!reduced && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.grid > div, .card, .paper-entry').forEach(element => {
      element.classList.add('reveal');
      observer.observe(element);
    });
  }
})();

/* Static-site adaptation of a proximity-magnifying dock. */
(() => {
  const dock = document.querySelector('.dock-panel');
  if (!dock) return;
  const options = { distance: 200, panelHeight: 68, baseItemSize: 50, dockHeight: 256, magnification: 70, spring: { mass: 0.1, stiffness: 150, damping: 12 } };
  const items = [...dock.querySelectorAll('.dock-item')];
  const states = items.map(() => ({ size: options.baseItemSize, velocity: 0, target: options.baseItemSize }));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, last = 0;
  const tick = time => {
    const dt = Math.min((time - (last || time - 16)) / 1000, 0.032);
    last = time;
    let moving = false;
    states.forEach((state, index) => {
      // Small integration steps keep the requested spring stable.
      const steps = Math.max(1, Math.ceil(dt / 0.004));
      const step = dt / steps;
      for (let i = 0; i < steps; i++) {
        const force = options.spring.stiffness * (state.target - state.size) - options.spring.damping * state.velocity;
        state.velocity += force / options.spring.mass * step;
        state.size += state.velocity * step;
      }
      if (Math.abs(state.target - state.size) > 0.02 || Math.abs(state.velocity) > 0.02) moving = true;
      else { state.size = state.target; state.velocity = 0; }
      items[index].style.width = items[index].style.height = state.size + 'px';
    });
    frame = moving ? requestAnimationFrame(tick) : 0;
    if (!moving) last = 0;
  };
  const animate = () => { if (!frame) frame = requestAnimationFrame(tick); };
  dock.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || reduced.matches) return;
    const rect = dock.getBoundingClientRect();
    // Resting centers prevent resizing from changing the proximity calculation.
    const style = getComputedStyle(dock);
    const gap = parseFloat(style.columnGap);
    const total = items.length * options.baseItemSize + (items.length - 1) * gap;
    const start = rect.left + (rect.width - total) / 2;
    states.forEach((state, index) => {
      const center = start + index * (options.baseItemSize + gap) + options.baseItemSize / 2;
      const proximity = Math.max(0, 1 - Math.abs(event.clientX - center) / options.distance);
      state.target = options.baseItemSize + (options.magnification - options.baseItemSize) * proximity;
    });
    animate();
  });
  const reset = () => { states.forEach(state => { state.target = options.baseItemSize; }); animate(); };
  dock.addEventListener('pointerleave', reset);
  dock.addEventListener('focusin', event => {
    if (reduced.matches) return;
    states.forEach((state, index) => { state.target = items[index] === event.target ? options.magnification : options.baseItemSize; });
    animate();
  });
  dock.addEventListener('focusout', reset);
  reduced.addEventListener('change', reset);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; last = 0; });
})();

