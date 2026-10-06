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


/* Two miniature, shaded cities revealed by falling sand. */
(() => {
  const desktop = matchMedia('(min-width: 1100px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'side-sand';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  document.body.appendChild(canvas);
  let width = 0, height = 0, strip = 0, frame = 0, last = 0, elapsed = 0;
  let grains = [];
  const poly = (points, fill, stroke) => {
    ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) {ctx.strokeStyle = stroke; ctx.lineWidth = .6; ctx.stroke();}
  };
  const building = (x, y, w, h, depth, seed, night) => {
    poly([[x,y],[x+w,y],[x+w,y-h],[x,y-h]], '#594631', '#ab8e60');
    poly([[x+w,y],[x+w+depth,y-depth*.6],[x+w+depth,y-h-depth*.6],[x+w,y-h]], '#302b24', '#7c694d');
    poly([[x,y-h],[x+depth,y-h-depth*.6],[x+w+depth,y-h-depth*.6],[x+w,y-h]], '#9e8258', '#c3a477');
    for(let row=0;row<Math.floor((h-8)/10);row++) for(let col=0;col<Math.floor((w-5)/7);col++) {
      const lit = ((row*7+col*11+seed)%5)<3;
      ctx.fillStyle = lit && night ? '#e5c88b' : '#332d25';
      ctx.fillRect(x+4+col*7,y-h+6+row*10,3,4);
    }
    for(let row=0;row<Math.floor((h-8)/12);row++) {
      ctx.fillStyle = row%3===seed%3 && night ? '#bba16d' : '#181b1b';
      ctx.fillRect(x+w+3,y-h+7+row*12,2,4);
    }
    if(seed%3===0) {ctx.strokeStyle='#bea37a';ctx.beginPath();ctx.moveTo(x+w*.55,y-h-2);ctx.lineTo(x+w*.55,y-h-14);ctx.stroke();}
  };
  const city = (side, progress) => {
    ctx.save(); ctx.translate(side ? width-strip : 0,0);
    ctx.beginPath();ctx.rect(0,height*(1-progress),strip,height*progress);ctx.clip();
    const center = strip*.5;
    // A winding vertical avenue links elevated neighborhood terraces.
    ctx.strokeStyle='#232624';ctx.lineWidth=16;ctx.beginPath();ctx.moveTo(center,height);ctx.lineTo(center-9,height*.7);ctx.lineTo(center+7,height*.4);ctx.lineTo(center-5,0);ctx.stroke();
    ctx.strokeStyle='#ab916258';ctx.lineWidth=1;ctx.setLineDash([4,9]);ctx.stroke();ctx.setLineDash([]);
    const levels = Math.ceil(height/145);
    for(let level=levels-1;level>=0;level--) {
      const base=height-25-level*145;
      const top=base-14;
      poly([[8,base],[strip-18,base-16],[strip-4,base-4],[22,base+12]],'#202422','#5d5844');
      ctx.strokeStyle='#ac94645c';ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(16,base+1);ctx.lineTo(strip-10,base-10);ctx.stroke();ctx.setLineDash([]);
      const w=Math.max(19,strip*.19);
      const h1=side ? 58+(level*17)%53 : 28+(level*13)%37;
      const h2=side ? 75+(level*19)%44 : 45+(level*11)%30;
      building(12,top,w,h1,8,level+side*3,elapsed>5);
      building(strip-w-20,top-9,w,h2,9,level+2+side*7,elapsed>5);
      if(!side) building(15+w+10,top+10,w*.8,25+(level*9)%20,6,level+4,true);
      // Street lamps and tiny cars on each cross street.
      ctx.strokeStyle='#8e7956';ctx.beginPath();ctx.moveTo(strip-9,base-5);ctx.lineTo(strip-9,base-17);ctx.stroke();
      ctx.fillStyle='#edd6a4';ctx.fillRect(strip-11,base-18,4,2);
      for(let car=0;car<2;car++) {
        const t=(elapsed*(.05+car*.012)+level*.23+car*.47)%1;
        const x=16+t*(strip-32), y=base+2-t*12+car*4;
        ctx.fillStyle=car ? '#b3b8a5':'#c04532';ctx.fillRect(x,y,7,3);
        ctx.fillStyle='#f4ddb0';ctx.fillRect(x+6,y,1,2);
      }
    }
    // Cars travelling along the main avenue.
    for(let i=0;i<5;i++) {
      const y=(height+ i*height/5-elapsed*19)%height;
      ctx.fillStyle=i%2?'#b9b6a0':'#c3583e';ctx.fillRect(center-2,y,3,7);
      ctx.fillStyle='#f3dcad';ctx.fillRect(center-2,y,3,1);
    }
    ctx.restore();
  };
  const resize = () => {
    width=innerWidth;height=innerHeight;
    const bounds=document.querySelector('.wrap').getBoundingClientRect();
    strip=Math.min(145,Math.max(95,bounds.left-12));
    const ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=width*ratio;canvas.height=height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);
    grains=Array.from({length:180},(_,i)=>({side:i%2,x:8+Math.random()*(strip-16),y:Math.random()*height,speed:45+Math.random()*65,size:.8+Math.random()*1.3}));
  };
  const paint = () => {
    ctx.clearRect(0,0,width,height);
    const progress=reduced.matches ? 1 : Math.min(1,.06+elapsed/55);
    city(0,progress);city(1,progress);
    if(!reduced.matches) grains.forEach(g=>{
      const floor=height*(1-progress);
      if(g.y>floor+10) g.y=-Math.random()*150;
      ctx.fillStyle='rgba(234,213,173,.6)';
      ctx.fillRect((g.side?width-strip:0)+g.x,g.y,g.size,g.size*1.6);
    });
  };
  const tick = time => {
    frame=0;if(document.hidden||!desktop.matches)return;
    const dt=Math.min((time-(last||time))/1000,.05);last=time;elapsed+=dt;
    grains.forEach(g=>g.y+=g.speed*dt);paint();
    frame=requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(frame);frame=0;last=0;canvas.hidden=!desktop.matches;
    if(!desktop.matches||document.hidden)return;
    resize();paint();if(!reduced.matches)frame=requestAnimationFrame(tick);
  };
  desktop.addEventListener('change',sync);reduced.addEventListener('change',sync);
  addEventListener('resize',sync);document.addEventListener('visibilitychange',sync);
  addEventListener('pagehide',()=>cancelAnimationFrame(frame));sync();
})();
