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
  if (stage) {
    const heading = stage.querySelector('h1');
    const canvas = document.createElement('canvas');
    canvas.className = 'sand-name';
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    if (context) {
      stage.appendChild(canvas);
      let grains = [], pointer = null, frame = 0, width = 0, height = 0;
      const colors = ['#eadfc9', '#d6bd94', '#f2e7d2', '#bda079'];
      const draw = () => {
        frame = 0;
        context.clearRect(0, 0, width, height);
        let moving = false;
        const radius = Math.min(100, width * .2);
        grains.forEach(grain => {
          const dx = pointer ? grain.homeX - pointer.x : 0;
          const dy = pointer ? grain.homeY - pointer.y : 0;
          const distance = Math.hypot(dx, dy);
          const influence = pointer ? Math.max(0, 1 - distance / radius) : 0;
          const spread = influence * influence * 48;
          const angle = distance > .1 ? Math.atan2(dy, dx) : grain.angle;
          const targetX = grain.homeX + Math.cos(angle) * spread;
          const targetY = grain.homeY + Math.sin(angle) * spread;
          grain.x += (targetX - grain.x) * .16;
          grain.y += (targetY - grain.y) * .16;
          if (Math.abs(targetX - grain.x) + Math.abs(targetY - grain.y) > .08) moving = true;
          context.fillStyle = colors[grain.color];
          context.fillRect(grain.x, grain.y, grain.size, grain.size);
        });
        if (moving) frame = requestAnimationFrame(draw);
      };
      const queue = () => { if (!frame) frame = requestAnimationFrame(draw); };
      const build = () => {
        width = stage.clientWidth;
        height = stage.clientHeight;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        const mask = document.createElement('canvas');
        mask.width = width; mask.height = height;
        const ink = mask.getContext('2d', {willReadFrequently: true});
        let size = Math.min(104, width * .13);
        ink.font = `600 ${size}px "Courier New", monospace`;
        const text = heading.textContent.trim();
        const available = width - 32;
        if (ink.measureText(text).width > available) size *= available / ink.measureText(text).width;
        ink.font = `600 ${size}px "Courier New", monospace`;
        ink.textAlign = 'center'; ink.textBaseline = 'middle'; ink.fillStyle = '#fff';
        ink.fillText(text, width / 2, height / 2);
        const pixels = ink.getImageData(0, 0, width, height).data;
        grains = [];
        const step = width < 500 ? 1.6 : 2;
        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            if (pixels[(Math.floor(y) * width + Math.floor(x)) * 4 + 3] < 100) continue;
            const homeX = x + (Math.random() - .5) * .7;
            const homeY = y + (Math.random() - .5) * .7;
            grains.push({homeX, homeY, x: homeX, y: homeY, size: .7 + Math.random() * .8, color: Math.floor(Math.random() * colors.length), angle: Math.random() * Math.PI * 2});
          }
        }
        stage.classList.add('sand-ready');
        queue();
      };
      if (!reduced) {
        stage.addEventListener('pointermove', event => {
          const rect = stage.getBoundingClientRect();
          pointer = {x: event.clientX - rect.left, y: event.clientY - rect.top};
          queue();
        });
        const reset = () => { pointer = null; queue(); };
        stage.addEventListener('pointerleave', reset);
        stage.addEventListener('pointercancel', reset);
        stage.addEventListener('pointerup', event => { if (event.pointerType === 'touch') reset(); });
        window.addEventListener('blur', reset);
      }
      build();
      if ('ResizeObserver' in window) new ResizeObserver(build).observe(stage);
      else window.addEventListener('resize', build);
      window.addEventListener('pagehide', () => cancelAnimationFrame(frame));
    }
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

