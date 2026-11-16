/*
  Neymar 2015 goal -> monochrome stipple -> particle assembly of ORIGINAL website.
  Does not replace or rewrite any portfolio content.

  Real-video mode uses an original-bitstream (stream-copy), coach-free cut.
  Graphics and dot renderer are unchanged from V5, no colors are drawn.
  The clip plays at 0.84x and ends on Neymar's hand-to-head celebration before the coach.
  Particles move on the next animation frame; there is no freeze or hold.
  Missing/unavailable clips fall back to the original soccer illustration.
*/
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root.classList.contains('intro-active')) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) { root.classList.remove('intro-active'); return; }
  const CFG = {
    source: 'neymar-original-quality-no-coach-v7.mp4',
    playbackRate: 0.84,
    videoEndSecond: 8.36,       // Last Neymar celebration frame; video contains no coach
    playOnlyOncePerTab: true,
    storySeconds: 8.36 / 0.84, // fallback illustration / timing only
    blastSeconds: 1.25,        // dots expand immediately, without a frozen frame
    assembleSeconds: 4.65,     // outline, name, and interior construct in stages
    revealSeconds: 1.15,
    videoWaitMs: 1800
  };
  const W0 = 960, H0 = 540;
  // The video timestamp determines the transition, not an estimated timer.
  // This prevents a frozen frame while the wall-clock catches up.
  const storyEnd = CFG.storySeconds;

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
  let raf = 0, began = 0, finished = false, frameData = null, particles = [], targets = {};
  let clipReady = false, useClip = false, clipStart = 0, lastVideoSeconds = 0;
  let assembleStarted = false, revealStarted = false;
  let transitionStartedAt = null;

  // The original website DOM is untouched. Dots land on geometric anchors
  // measured from its REAL layout. Three groups assemble separately so the
  // frame, name, and navigation are genuinely built on screen.
  const addLine = (a, x1, y1, x2, y2, step=5) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x2-x1, y2-y1) / step));
    for (let i=0;i<=n;i++) a.push({x:x1+(x2-x1)*i/n, y:y1+(y2-y1)*i/n});
  };
  const addRect = (a,r,step=5) => {
    addLine(a,r.left,r.top,r.right,r.top,step);
    addLine(a,r.right,r.top,r.right,r.bottom,step);
    addLine(a,r.right,r.bottom,r.left,r.bottom,step);
    addLine(a,r.left,r.bottom,r.left,r.top,step);
  };
  let mainRect=null;
  let detailLines=[];
  function makeTargets() {
    const frame=[], name=[], details=[];
    const wrap = document.querySelector('.wrap');
    if (!wrap) return {frame:[{x:vw/2,y:vh/2}], name:[], details:[]};
    const r = wrap.getBoundingClientRect();
    mainRect={left:r.left,top:r.top,right:r.right,bottom:Math.min(r.bottom,vh)};
    addRect(frame,mainRect,4.5);
    detailLines=[];
    document.querySelectorAll('.hero-bottom, .section-title, footer').forEach(el => {
      const b=el.getBoundingClientRect();
      if(b.top<r.top+10 || b.top>mainRect.bottom-18) return;
      const p={x1:Math.max(b.left,mainRect.left+16),y:b.top,x2:Math.min(b.right,mainRect.right-16)};
      if(p.x2>p.x1+30) {
        detailLines.push(p);
        addLine(details,p.x1,p.y,p.x2,p.y,4.5);
      }
    });
    const dock=document.querySelector('nav.dock-panel');
    if(dock){
      const d=dock.getBoundingClientRect();
      if(d.bottom<=vh && d.top>=0) {
        addRect(details,d,5);
        dock.querySelectorAll('.dock-item').forEach(item=>addRect(details,item.getBoundingClientRect(),7));
      }
    }
    // Mask the actual visible heading, not an unrelated replacement heading.
    const h1=document.querySelector('.name-stage h1');
    if(h1) {
      const b=h1.getBoundingClientRect();
      const s=window.getComputedStyle(h1);
      const ratio=0.7;
      const mask=document.createElement('canvas');
      mask.width=Math.max(1,Math.ceil(b.width*ratio));
      mask.height=Math.max(1,Math.ceil(b.height*ratio));
      const m=mask.getContext('2d',{willReadFrequently:true});
      m.scale(ratio,ratio);
      m.fillStyle='#fff';m.textAlign='center';m.textBaseline='middle';
      m.font=`${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      const title=h1.textContent.trim();
      m.fillText(title,b.width/2,b.height/2,b.width-4);
      const ink=m.getImageData(0,0,mask.width,mask.height).data;
      for(let y=0;y<mask.height;y+=3) for(let x=0;x<mask.width;x+=3) {
        if(ink[(y*mask.width+x)*4+3]>100) name.push({x:b.left+x/ratio,y:b.top+y/ratio});
      }
    }
    return {frame, name:name.length?name:frame, details:details.length?details:frame};
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
    // Keep the source RGB only for player/pitch separation; output is white dots.
    sc.drawImage(video,sx,sy,sw,sh,0,0,W0,H0);
    lastVideoSeconds=video.currentTime;
    // Do not pause here. The animation loop transitions on this same frame.
  }

  function drawDots(t, remember=false) {
    if (useClip) drawVideo(t); else drawOriginalGoal(t);
    const im = sc.getImageData(0, 0, W0, H0).data;
    frameData = [];
    ctx.fillStyle = '#000';ctx.fillRect(0, 0, vw, vh);

    // Bright, truly monochrome microdots. The source RGB is used only to
    // identify players against the grass. No colors appear in the result.
    const increment = vw < 580 ? 3 : 2.7;
    let count=0;
    for(let fy=1;fy<H0-4;fy+=increment){
      const y=Math.floor(fy);
      for(let fx=1;fx<W0-4;fx+=increment){
        const x=Math.floor(fx);
        const i=(y*W0+x)*4;
        const r=im[i],g=im[i+1],b=im[i+2];
        const v=.299*r+.587*g+.114*b;
        const ir=(y*W0+(x+3))*4, id=((y+3)*W0+x)*4;
        const vr=.299*im[ir]+.587*im[ir+1]+.114*im[ir+2];
        const vd=.299*im[id]+.587*im[id+1]+.114*im[id+2];
        const detail=Math.min(255,Math.abs(v-vr)+Math.abs(v-vd));
        const grass=useClip && g>r*1.13 && g>b*1.20 && g>44 && r<169;
        const barca=useClip && b>g*1.09 && r>g*1.08 && b>37 && r>36 && g<130;
        const yellow=useClip && r>105 && g>99 && b<Math.min(r,g)*.85;
        const skin=useClip && r>77 && r>g*1.12 && r>b*1.21 && g>=b*.86;
        const keeper=useClip && b>g*1.13 && r>g*1.04 && b>83 && r>69;
        const player=barca||yellow||skin||keeper;
        const rand=hash(x*31+y*97);
        // Thin, dim pitch dots; high visibility for kits, silhouettes and ball.
        // Draw sparse grass texture so the field stays legible, not pitch black.
        if(grass && detail<26 && rand>.28) continue;
        if(grass && detail>=26 && rand>.85) continue;
        if(!grass && !player && detail<21 && v<53 && rand>.29) continue;
        if(!grass && !player && detail<50 && rand>.40) continue;
        const alpha=player?1:grass?Math.min(.72,.30+detail/200):Math.min(.88,.44+v/590+detail/580);
        const radius=player?Math.min(1.53,Math.max(.85,scale*1.19))
          :grass?Math.max(.54,scale*.68)
          :Math.max(.78,Math.min(1.32,scale*1.04));
        const jitter=(hash(x*5+y*11)-.5)*.22;
        const rx=ox+(fx+jitter)*scale,ry=oy+(fy+jitter)*scale;
        ctx.globalAlpha=alpha;
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(rx,ry,radius,0,Math.PI*2);ctx.fill();
        // Capture plenty of visible dots to reconstruct the website shape.
        if(remember && count<20000 && !grass && rand>.34) {
          frameData.push({x:rx,y:ry,size:radius,alpha,seed:hash(x+y*997)});
          count++;
        }
      }
    }
    ctx.globalAlpha=1;
  }

  function createParticles(){
    if(!frameData?.length) drawDots(storyEnd-.04,true);
    const sets=[targets.frame||[],targets.name||[],targets.details||[]];
    const cursors=[0,0,0];
    particles=frameData.map((p,i)=>{
      // Frame -> lettering -> interior. Dots arrive in three separate waves.
      const group=i%10<4?0:i%10<7?1:2;
      const set=sets[group].length?sets[group]:[{x:vw/2,y:vh/2}];
      const index=(cursors[group]*13)%set.length;
      cursors[group]++;
      const dest=set[index];
      const angle=Math.atan2(p.y-vh/2,p.x-vw/2)+(p.seed-.5)*.6;
      const distance=Math.max(vw,vh)*(.09+.25*p.seed);
      return {...p,group, ex:p.x+Math.cos(angle)*distance,ey:p.y+Math.sin(angle)*distance,
        dx:dest.x,dy:dest.y};
    });
  }

  function solidifyFrame(k){
    if(!mainRect) return;
    const r=mainRect;
    // Border appears *after* particles reach it, tracing all four edges.
    const p=ease((k-.38)/.33);
    if(p<=0)return;
    const w=r.right-r.left,h=r.bottom-r.top,L=2*(w+h);
    ctx.save();ctx.lineWidth=1.15;ctx.strokeStyle=`rgba(242,242,242,${Math.min(.88,p*.88)})`;
    ctx.setLineDash([L,L]);ctx.lineDashOffset=L*(1-p);
    ctx.beginPath();ctx.moveTo(r.left,r.top);ctx.lineTo(r.right,r.top);
    ctx.lineTo(r.right,r.bottom);ctx.lineTo(r.left,r.bottom);ctx.closePath();ctx.stroke();
    ctx.restore();
  }

  function solidifyDetails(k){
    const q=ease((k-.76)/.22);
    if(q<=0)return;
    ctx.save();ctx.lineWidth=.8;ctx.strokeStyle=`rgba(226,226,226,${q*.64})`;
    for(const line of detailLines){
      ctx.beginPath();ctx.moveTo(line.x1,line.y);ctx.lineTo(lerp(line.x1,line.x2,q),line.y);ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles(mode,k){
    ctx.fillStyle='#000';ctx.fillRect(0,0,vw,vh);
    ctx.fillStyle='#fff';
    const smooth=ease(k);
    for(const p of particles){
      let x,y,alpha,radius;
      if(mode==='blast'){
        x=lerp(p.x,p.ex,smooth);y=lerp(p.y,p.ey,smooth);
        alpha=.94;radius=Math.max(.85,p.size*1.05);
      } else {
        // Stagger the construction in three clear, overlapping stages.
        const starts=[0,.24,.48], ends=[.61,.84,.99];
        const progress=ease((k-starts[p.group])/(ends[p.group]-starts[p.group]));
        x=lerp(p.ex,p.dx,progress);y=lerp(p.ey,p.dy,progress);
        alpha=.8+progress*.2;radius=Math.max(.79,p.size*(1-.20*progress));
      }
      ctx.globalAlpha=alpha;
      ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
    if(mode==='assemble'){
      solidifyFrame(k);
      solidifyDetails(k);
    }
  }

  let video=null;
  async function prepareClip(){
    // Fallback is ALWAYS available. No video is downloaded from YouTube.
    video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';
    video.src=CFG.source;
    video.defaultPlaybackRate = CFG.playbackRate;
    video.playbackRate = CFG.playbackRate;
    video.setAttribute('aria-hidden','true');
    const ready=new Promise(resolve=>{
      video.addEventListener('loadeddata',()=>resolve(true),{once:true});
      video.addEventListener('error',()=>resolve(false),{once:true});
      setTimeout(()=>resolve(false),CFG.videoWaitMs);
    });
    video.load();
    const success=await ready;
    if(success && !finished){
      try {
        // Some browsers reset playbackRate during source initialization.
        video.playbackRate = CFG.playbackRate;
        await video.play();
        clipReady=true;useClip=true;
      } catch(err){useClip=false;}
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
    if(finished) return;
    if(!began) began=now;

    if(transitionStartedAt === null) {
      const elapsed=(now-began)/1000;
      // Follow actual footage time in the coach-free video, even if
      // the browser decodes video a little late or plays at a different rate.
      const clipEnded = useClip && video && video.readyState >= 2
        ? (video.currentTime >= CFG.videoEndSecond || video.ended)
        : elapsed >= CFG.storySeconds;
      drawDots(elapsed, clipEnded);

      if(clipEnded) {
        // The last video frame becomes the source of the burst. No freeze.
        createParticles();
        transitionStartedAt=now;
        if(video) video.pause();
        drawParticles('blast',0);
      }
    } else {
      const elapsed=(now-transitionStartedAt)/1000;
      const blastEnd=CFG.blastSeconds;
      const assembleEnd=blastEnd+CFG.assembleSeconds;
      const revealEnd=assembleEnd+CFG.revealSeconds;

      if(elapsed < blastEnd) {
        drawParticles('blast', elapsed/CFG.blastSeconds);
      } else if(elapsed < assembleEnd) {
        drawParticles('assemble', (elapsed-blastEnd)/CFG.assembleSeconds);
        if(!assembleStarted) assembleStarted=true;
      } else if(elapsed < revealEnd) {
        drawParticles('assemble', 1);
        if(!revealStarted) {
          revealStarted=true;
          root.classList.add('intro-revealing');
          layer.classList.add('is-fading');
        }
      } else {
        complete();
        return;
      }
    }
    raf=requestAnimationFrame(tick);
  }

  resize();
  // A clip can be provided later without editing the portfolio HTML.
  prepareClip().finally(()=>{ if(!finished) raf=requestAnimationFrame(tick); });
  // Fail-safe: an unexpected browser error must never trap someone on a blank overlay.
  window.setTimeout(()=>{if(!finished)complete();},31000);
})();
