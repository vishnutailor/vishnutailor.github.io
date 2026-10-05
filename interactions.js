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
    const lens = stage.querySelector('.glass-lens');
    const heading = stage.querySelector('h1');
    const copy = document.createElement('div');
    copy.className = 'lens-copy';
    copy.textContent = heading.textContent;
    lens.appendChild(copy);
    let active = false;
    let frame;
    const place = (x, y) => {
      const width = lens.offsetWidth;
      const height = lens.offsetHeight;
      const scale = 1.45;
      const rect = heading.getBoundingClientRect();
      const parent = stage.getBoundingClientRect();
      lens.style.left = `${x}px`;
      lens.style.top = `${y}px`;
      copy.style.width = `${rect.width}px`;
      copy.style.height = `${rect.height}px`;
      copy.style.font = getComputedStyle(heading).font;
      copy.style.letterSpacing = getComputedStyle(heading).letterSpacing;
      copy.style.transform = `translate(${width / 2 - (x - rect.left + parent.left) * scale}px, ${height / 2 - (y - rect.top + parent.top) * scale}px) scale(${scale})`;
    };
    const track = event => {
      active = true;
      const rect = stage.getBoundingClientRect();
      place(event.clientX - rect.left, event.clientY - rect.top);
    };
    stage.addEventListener('pointermove', track);
    stage.addEventListener('pointerdown', track);
    stage.addEventListener('pointerleave', () => { active = false; });
    stage.addEventListener('pointerup', event => {
      if (event.pointerType !== 'mouse') active = false;
    });
    const animate = time => {
      if (!active) {
        const rect = heading.getBoundingClientRect();
        const parent = stage.getBoundingClientRect();
        place(stage.clientWidth * (.5 + .28 * Math.sin(time / 2100)), rect.top - parent.top + rect.height / 2 + 8 * Math.sin(time / 1300));
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
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
