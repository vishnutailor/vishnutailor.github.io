/*
  Neymar 2015 goal -> monochrome stipple -> particle assembly of ORIGINAL website.
  Does not replace or rewrite any portfolio content.

  Optional, exact-footage mode:
  Put a clip you have permission to use in assets/neymar-goal.mp4.
  Trim it so that the ball crosses the line at VIDEO_GOAL_SECOND.
  With no clip, a complete original animated reconstruction plays instead.
*/
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root.classList.contains('intro-active')) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { root.classList.remove('intro-active'); return; }

  const CFG = {
  source: 'videoplayback.mp4',
  videoGoalSecond: 6.65,
  playOnlyOncePerTab: true,
  storySeconds: 6.65,
  freezeSeconds: 0.38,
  blastSeconds: 0.72,
  assembleSeconds: 1.45,
  revealSeconds: 0.85,
  videoWaitMs: 1000
};
  const W0 = 960, H0 = 540;
  const storyEnd = CFG.storySeconds;
  const freezeEnd = storyEnd + CFG.freezeSeconds;
  const blastEnd = freezeEnd + CFG.blastSeconds;
  const assembleEnd = blastEnd + CFG.assembleSeconds;
  const finishTime = assembleEnd + CFG.revealSeconds;

  const layer = document.createElement('div');
  layer.id = 'neymar-intro';
  layer.setAttribute('role', 'img');
  layer.setAttribute('aria-label', 'A black and white dot animation of Neymar flicking the ball over a defender and scoring. The dots become the website.');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'intro-skip';
  skip.textContent = 'Skip intro';
  layer.append(canvas, skip);
  document.body.appendChild(layer);
  const ctx = canvas.getContext('2d', {alpha: false});
  const scene = document.createElement('canvas');
  scene.width = W0; scene.height = H0;
  const sc = scene.getContext('2d', {willReadFrequently: true});
  if (!ctx || !sc) { root.classList.remove('intro-active'); layer.remove(); return; }
  let vw = 0, vh = 0, dpr = 1, scale = 1, ox = 0, oy = 0;
  let raf = 0, began = 0, finished = false, frameData = null, particles = [], targets = [];
  let clipReady = false, useClip = false, clipStart = 0, lastVideoSeconds = 0;
  let assembleStarted = false, revealStarted = false;

  // The website itself is never re-created. These DOM positions are the
  // destinations for the dots when they become the frame and lettering.
  const addLine = (a, x1, y1, x2, y2, step=7) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x2-x1, y2-y1)/step));
    for(let i=0;i<=n;i++) a.push({x:x1+(x2-x1)*i/n,y:y1+(y2-y1)*i/n});
  };
  function makeTargets() {
    const list = [];
    const wrap = document.querySelector('.wrap');
    if (!wrap) return [{x:vw/2,y:vh/2}];
    const r = wrap.getBoundingClientRect();
    // The entire small website rectangle is traced before it appears.
    addLine(list,r.left,r.top,r.right,r.top,5);
    addLine(list,r.right,r.top,r.right,Math.min(r.bottom,vh),5);
    addLine(list,r.right,Math.min(r.bottom,vh),r.left,Math.min(r.bottom,vh),5);
    addLine(list,r.left,Math.min(r.bottom,vh),r.left,r.top,5);
    document.querySelectorAll('.hero-bottom, .section-title, footer').forEach(el => {
      const b=el.getBoundingClientRect();
      // Do not send particles outside the small scrollable site panel.
      if (b.top<r.top || b.top>Math.min(r.bottom,vh)) return;
      addLine(list,Math.max(b.left,r.left+18),b.top,Math.min(b.right,r.right-18),b.top,5);
    });
    const mask=document.createElement('canvas');
    mask.width=Math.max(1,Math.ceil(vw/2)); mask.height=Math.max(1,Math.ceil(vh/2));
    const m=mask.getContext('2d', {willReadFrequently:true});
    m.scale(.5,.5); m.fillStyle='#fff'; m.textAlign='center';m.textBaseline='middle';
    const title=document.querySelector('.name-stage');
    if (title) {
      const b=title.getBoundingClientRect();
      const fontSize=Math.max(22,Math.min(80,b.width*.115));
      m.font=`700 ${fontSize}px "Courier New", monospace`;
      m.fillText(document.querySelector('.name-stage h1')?.textContent?.trim()||'Vishnu Tailor', b.left+b.width/2,b.top+b.height/2, b.width-20);
    }
    document.querySelectorAll('.section-title').forEach(el=>{
      const b=el.getBoundingClientRect();
      if(b.top>=r.top && b.top<Math.min(r.bottom,vh)) {m.font='700 12px monospace';m.textAlign='left';m.fillText(el.textContent.trim().toUpperCase(),b.left,b.top+7);}
    });
    const pix=m.getImageData(0,0,mask.width,mask.height).data;
    for(let y=0;y<mask.height;y+=2) for(let x=0;x<mask.width;x+=2) {
      if(pix[(y*mask.width+x)*4+3]>110) list.push({x:x*2,y:y*2});
    }
    // A deterministic spread avoids every grain moving in the same direction.
    return list.length?list:[{x:vw/2,y:vh/2}];
  }

  function resize() {
    vw=window.innerWidth; vh=window.innerHeight; dpr=Math.min(devicePixelRatio||1,1.75);
    canvas.width=Math.ceil(vw*dpr);canvas.height=Math.ceil(vh*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    scale=Math.min((vw*.96)/W0,(vh*.80)/H0);
    ox=(vw-W0*scale)/2;oy=(vh-H0*scale)/2;
    targets=makeTargets();
  }
  window.addEventListener('resize', resize, {passive:true});

  function lerp(a,b,t){return a+(b-a)*t;}
  function ease(t){t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);}
  function hash(n){ const s=Math.sin(n*127.1+47.77)*43758.5453;return s-Math.floor(s); }
  function line(x1,y1,x2,y2,c='#fff',w=3) {
    sc.beginPath();sc.strokeStyle=c;sc.lineWidth=w;sc.lineCap='round';sc.moveTo(x1,y1);sc.lineTo(x2,y2);sc.stroke();
  }
  function disc(x,y,r,c='#fff') {sc.beginPath();sc.fillStyle=c;sc.arc(x,y,r,0,Math.PI*2);sc.fill();}

  function drawBackdrop(t) {
    sc.fillStyle='#020202';sc.fillRect(0,0,W0,H0);
    // Elevated stadium and terrace terraces, deliberately low-detail so the
    // dot shading remains the star rather than becoming a cartoon.
    const grd=sc.createLinearGradient(0,65,0,470);
    grd.addColorStop(0,'#202020');grd.addColorStop(.42,'#050505');
    grd.addColorStop(.7,'#343434');grd.addColorStop(1,'#0d0d0d');
    sc.fillStyle=grd;sc.fillRect(0,0,W0,H0);
    sc.fillStyle='#0a0a0a';sc.fillRect(0,0,W0,126);
    for(let k=0;k<790;k++){
      const x=hash(k)*960, y=92+hash(k+900)*176;
      const flicker=.6+.4*Math.sin(t*.6+hash(k+1250)*6.2);
      const a=4+Math.floor(hash(k+800)*37*flicker);
      sc.fillStyle=`rgb(${a},${a},${a})`;sc.fillRect(x,y,2,2);
    }
    sc.fillStyle='#111';sc.fillRect(0,269,960,9);
    sc.fillStyle='#4f4f4f';sc.fillRect(0,278,960,2);
    // Perspective pitch with faint white field markings.
    sc.beginPath();sc.moveTo(0,319);sc.lineTo(960,276);sc.lineTo(960,540);sc.lineTo(0,540);sc.closePath();
    sc.fillStyle='#262626';sc.fill();
    for(let i=0;i<8;i++){
      const x=i*130-60;
      sc.fillStyle=i%2?'#262626':'#2a2a2a';sc.fillRect(x,300,128,240);
    }
    line(0,425,960,346,'#787878',2);
    line(625,281,690,520,'#656565',2);
    line(690,520,960,520,'#656565',2);
    sc.strokeStyle='#555';sc.lineWidth=2;
    sc.beginPath();sc.ellipse(430,455,130,57,-.05,2.5,5.9);sc.stroke();
    // Goal at upper right, distinguishable by its bright dotted posts/net.
    line(782,208,905,193,'#e0e0e0',4);
    line(782,208,782,365,'#e0e0e0',5);
    line(905,193,905,345,'#bcbcbc',4);
    line(782,365,905,345,'#9b9b9b',2);
    line(905,193,930,217,'#aaa',2);
    line(930,217,930,350,'#999',2);
    line(905,345,930,350,'#999',2);
    for(let x=791;x<931;x+=15){line(x,206-(x-782)*.12,x+8,365-(x-782)*.12,'#555',.8);}
    for(let y=225;y<352;y+=14){line(784,y,928,y-14,'#5e5e5e',.8);}
    // Camera-frame seam at top is part of the monochrome scene.
    line(20,17,940,17,'#333',1);
  }

  function drawPerson(x, y, s, pose, shade, number, face=1) {
    sc.save();sc.translate(x,y);sc.scale(face*s,s);
    const motion=Math.sin(pose*1.4);
    // Ground shadow.
    sc.globalAlpha=.45;sc.fillStyle='#050505';sc.beginPath();sc.ellipse(0,4,30,7,0,0,Math.PI*2);sc.fill();sc.globalAlpha=1;
    // Athletic silhouette from filled limbs (sampled to dots afterward).
    sc.strokeStyle=shade;sc.lineWidth=12;sc.lineCap='round';
    sc.beginPath();sc.moveTo(-8,-49);sc.lineTo(-17+10*motion,-23);sc.lineTo(-13+12*motion,0);
    sc.moveTo(8,-50);sc.lineTo(15-15*motion,-24);sc.lineTo(18-8*motion,0);sc.stroke();
    sc.lineWidth=8;
    sc.beginPath();sc.moveTo(-12,-78);sc.lineTo(-26+8*motion,-60);sc.lineTo(-21+9*motion,-43);
    sc.moveTo(12,-78);sc.lineTo(23-8*motion,-63);sc.lineTo(25-3*motion,-51);sc.stroke();
    sc.fillStyle=shade;sc.beginPath();sc.moveTo(-14,-91);sc.lineTo(16,-89);sc.lineTo(18,-48);sc.lineTo(-16,-47);sc.closePath();sc.fill();
    sc.beginPath();sc.ellipse(0,-105,14,17,-.1,0,Math.PI*2);sc.fill();
    // Kit stripes and numbers should read as light/dark dots.
    sc.fillStyle='#121212';sc.fillRect(-4,-87,8,38);
    sc.fillStyle=shade==='#ececec'?'#111':'#fff';sc.font='bold 19px Arial';sc.textAlign='center';sc.fillText(number,0,-63);
    sc.restore();
  }

  function ball(x,y,r=10) {
    disc(x,y,r,'#f4f4f4');
    disc(x-2,y-2,r*.34,'#444');
    disc(x+r*.45,y+r*.3,r*.18,'#666');
  }

  function drawOriginalGoal(t) {
    drawBackdrop(t);
    // Teammate on the left, defender and goalkeeper on the right.
    drawPerson(158,433,.89,.3,'#b6b6b6','9',1);
    drawPerson(530,405,.96,Math.min(2,t)*.6,'#818181','2',-1);
    let px=384, py=428, pose=0;
    if(t<1.45) {px=384+11*ease(t/1.45);pose=2.1+t*1.2;}
    else if(t<3.38) {px=395+154*ease((t-1.45)/1.93);py=428-8*Math.sin((t-1.45)*2);pose=3+t*1.8;}
    else {px=549+11*ease((t-3.38)/1.12);pose=7+(t-3.38)*3.4;}
    drawPerson(px,py,1.18,pose,'#ececec','11', t>2.55?-1:1);
    // Keeper moves after the strike.
    if(t<4.55) drawPerson(808,346,.82,.3,'#ababab','1',-1);
    else {
      sc.save();sc.translate(808+18*ease((t-4.55)/.75),346-26*ease((t-4.55)/.75));
      sc.rotate(-.90*ease((t-4.55)/.75));
      drawPerson(0,0,.82,3.4,'#ababab','1',-1);sc.restore();
    }
    let bx=250,by=405;
    if(t<.85) {const k=ease(t/.85);bx=lerp(250,401,k);by=lerp(404,385,k);}
    else if(t<1.55) {const k=(t-.85)/.70;bx=400+10*k;by=383-3*k;}
    else if(t<3.45) {
      const k=(t-1.55)/1.9;
      bx=lerp(410,572,k);
      by=lerp(380,329,k)-157*Math.sin(Math.PI*k); // unmistakable flick over the defender
    } else if(t<4.46) {const k=(t-3.45)/1.01;bx=572+4*k;by=329+5*k;}
    else {const k=ease((t-4.46)/.85);bx=lerp(579,852,k);by=lerp(331,267,k);}
    if(t>4.45&&t<5.32) {
      for(let j=1;j<8;j++){
        const k=Math.max(0,(t-4.46)/.85-j*.055);
        if(k>0){sc.globalAlpha=.06+.12*(1-j/8);disc(lerp(579,852,ease(k)),lerp(331,267,ease(k)),7,'#fff');}
      }
      sc.globalAlpha=1;
    }
    ball(bx,by,10.6);
    if(t>5.15){const ripple=Math.min(1,(t-5.15)*4);sc.strokeStyle=`rgba(255,255,255,${.5*(1-ripple)})`;sc.lineWidth=4;sc.beginPath();sc.ellipse(856,267,22+ripple*58,25+ripple*55,-.1,0,Math.PI*2);sc.stroke();}
  }

  function drawVideo(t) {
    sc.fillStyle='#000';sc.fillRect(0,0,W0,H0);
    if(!video || video.readyState<2){drawOriginalGoal(t);return;}
    const vr=video.videoWidth/video.videoHeight, sr=W0/H0;
    let sx=0,sy=0,sw=video.videoWidth,sh=video.videoHeight;
    if(vr>sr){sw=sh*sr;sx=(video.videoWidth-sw)/2;}
    else {sh=sw/sr;sy=(video.videoHeight-sh)/2;}
    sc.save();sc.filter='grayscale(1) contrast(1.7) brightness(1.23)';
    sc.drawImage(video,sx,sy,sw,sh,0,0,W0,H0);sc.restore();
    lastVideoSeconds=video.currentTime;
    if(lastVideoSeconds>=CFG.videoGoalSecond){video.pause();}
  }

  function drawDots(t,remember=false) {
    if(useClip) drawVideo(t); else drawOriginalGoal(t);
    const im=sc.getImageData(0,0,W0,H0).data;
    frameData=[];
    ctx.fillStyle='#020202';ctx.fillRect(0,0,vw,vh);
    const increment=6;
    for(let y=0;y<H0;y+=increment){
      for(let x=0;x<W0;x+=increment){
        const i=(y*W0+x)*4;
        const v=im[i]*.3+im[i+1]*.59+im[i+2]*.11;
        const threshold=16+hash(x*7+y*19)*19;
        if(v<threshold) continue;
        const jitter=(hash(x*5+y*11)-.5)*1.5;
        const rx=ox+(x+jitter)*scale,ry=oy+(y+jitter)*scale;
        const alpha=Math.min(1,.27+v/218);
        const radius=Math.max(.65,Math.min(2.8,(.8+v/160)*scale));
        ctx.globalAlpha=alpha;
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(rx,ry,radius,0,Math.PI*2);ctx.fill();
        if(remember && frameData.length<9000 && hash(x*31+y*23)>.34)
          frameData.push({x:rx,y:ry,size:radius,alpha,seed:hash(x+y*997)});
      }
    }
    ctx.globalAlpha=1;
    // Tiny, subtle optical sprocket bars frame the scene on large screens.
    if(vw>650){ctx.strokeStyle='#444';ctx.lineWidth=1;ctx.strokeRect(ox-9,oy-9,W0*scale+18,H0*scale+18);}
  }

  function createParticles() {
    if(!frameData||!frameData.length){drawDots(storyEnd-.04,true);}
    particles=frameData.map((p,i)=>{
      const angle=Math.atan2(p.y-vh/2,p.x-vw/2)+(p.seed-.5)*.9;
      const distance=(Math.max(vw,vh)*(.25+.54*p.seed));
      const tx=targets[(i*29)%targets.length];
      return {...p,ex:p.x+Math.cos(angle)*distance,ey:p.y+Math.sin(angle)*distance,
        dx:tx.x,dy:tx.y};
    });
  }
  function drawParticles(mode,k) {
    ctx.fillStyle='#020202';ctx.fillRect(0,0,vw,vh);
    ctx.fillStyle='#f2f2f2';
    const smooth=ease(k);
    for(let i=0;i<particles.length;i++){
      const p=particles[i];let x,y;
      if(mode==='blast') {x=lerp(p.x,p.ex,smooth);y=lerp(p.y,p.ey,smooth);}
      else {x=lerp(p.ex,p.dx,smooth);y=lerp(p.ey,p.dy,smooth);}
      ctx.globalAlpha=mode==='blast'?1-smooth*.25:(.3+smooth*.7);
      ctx.beginPath();ctx.arc(x,y,mode==='blast'?p.size:p.size*(1-.43*smooth),0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    if(mode==='assemble' && k>.76) {
      const r=document.querySelector('.wrap')?.getBoundingClientRect();
      if(r){ctx.strokeStyle=`rgba(242,242,242,${(k-.76)/.24*.72})`;ctx.lineWidth=1;
        ctx.strokeRect(r.left,r.top,r.width,Math.min(r.height,vh-r.top));}
    }
  }

  let video=null;
  async function prepareClip(){
    // Fallback is ALWAYS available. No video is downloaded from YouTube.
    video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
    video.src=CFG.source;
    video.setAttribute('aria-hidden','true');
    const ready=new Promise(resolve=>{
      video.addEventListener('loadeddata',()=>resolve(true),{once:true});
      video.addEventListener('error',()=>resolve(false),{once:true});
      setTimeout(()=>resolve(false),CFG.videoWaitMs);
    });
    video.load();
    const success=await ready;
    if(success && !finished){
      try {await video.play();clipReady=true;useClip=true;}catch(err){useClip=false;}
    }
  }

  function complete(){
    if(finished)return;finished=true;cancelAnimationFrame(raf);
    try{if(CFG.playOnlyOncePerTab)sessionStorage.setItem('vt-goal-intro','played');}catch(err){}
    if(video) video.pause();
    root.classList.add('intro-revealing');
    layer.classList.add('is-fading');
    window.setTimeout(()=>{
      root.classList.remove('intro-active','intro-revealing');
      layer.remove();
      window.removeEventListener('resize',resize);
    },930);
  }
  skip.addEventListener('click',complete);

  function tick(now){
    if(finished)return;
    if(!began)began=now;
    const t=(now-began)/1000;
    if(t<storyEnd){
      drawDots(t,t>storyEnd-.12);
    } else if(t<freezeEnd){
      drawDots(storyEnd-.04,true);
    } else if(t<blastEnd){
      if(!particles.length)createParticles();
      drawParticles('blast',(t-freezeEnd)/CFG.blastSeconds);
    } else if(t<assembleEnd){
      if(!particles.length)createParticles();
      drawParticles('assemble',(t-blastEnd)/CFG.assembleSeconds);
      if(!assembleStarted){assembleStarted=true;}
    } else if(t<finishTime){
      if(!particles.length)createParticles();
      drawParticles('assemble',1);
      if(!revealStarted){revealStarted=true;root.classList.add('intro-revealing');layer.classList.add('is-fading');}
    } else {complete();return;}
    raf=requestAnimationFrame(tick);
  }
  resize();
  // A clip can be provided later without editing the portfolio HTML.
  prepareClip().finally(()=>{ if(!finished) raf=requestAnimationFrame(tick); });
  // Fail-safe: an unexpected browser error must never trap someone on a blank overlay.
  window.setTimeout(()=>{if(!finished)complete();},18000);
})();
