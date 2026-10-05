(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.querySelector('.name-stage');
  if (stage && !reduced && window.matchMedia('(pointer: fine)').matches) {
    stage.addEventListener('pointermove', event => {
      const bounds = stage.getBoundingClientRect();
      stage.style.setProperty('--lens-x', `${event.clientX - bounds.left}px`);
      stage.style.setProperty('--lens-y', `${event.clientY - bounds.top}px`);
    });
    stage.addEventListener('pointerleave', () => {
      stage.style.removeProperty('--lens-x');
      stage.style.removeProperty('--lens-y');
    });
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
