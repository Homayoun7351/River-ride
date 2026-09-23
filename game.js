(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;

  const W = canvas.width, H = canvas.height;
  const keys = Object.create(null);
  let running = false, gameOver = false, last = 0, time = 0;
  let score = 0, fuel = 100, hi = Number(localStorage.getItem("riverRideHi") || 0);
  let speed = 55, scroll = 0, spawnTimer = 0, bridgeTimer = 12, fuelTimer = 7;
  let river = [], enemies = [], bullets = [], enemyBullets = [], particles = [], pickups = [], bridges = [];
  const player = { x: W/2, y: H-55, w: 11, h: 15, inv: 0 };

  const $ = id => document.getElementById(id);
  $("hi").textContent = String(hi).padStart(6,"0");

  function resetRiver() {
    river = [];
    let center = W/2, width = Math.min(118,W-40);
    for (let y=0;y<=10000;y+=4) {
      center += (Math.random()-.5)*5;
      center = Math.max(38, Math.min(W-38, center));
      width += (Math.random()-.5)*3;
      width = Math.max(78, Math.min(122,width));
      river.push({y, c:center, w:width});
    }
  }
  resetRiver();

  function riverAt(y) {
    const i = Math.max(0, Math.min(river.length-1, Math.floor(y/4)));
    return river[i] || river[river.length-1];
  }
  function makeSegment() {
    const lastR = river[river.length-1];
    let c = lastR.c + (Math.random()-.5)*8;
    c = Math.max(30, Math.min(W-30,c));
    let w = Math.max(76, Math.min(122,lastR.w + (Math.random()-.5)*5));
    river.push({y:lastR.y+4,c,w});
    river.shift();
  }
  function updateRiver(dt) {
    // Keep the river path stable. The water itself animates via the scroll value.
    // This avoids shifting the whole path every frame and keeps the game responsive.
  }

  function rand(a,b){ return a + Math.random()*(b-a); }
  function rectHit(a,b){ return Math.abs(a.x-b.x)*2 < a.w+b.w && Math.abs(a.y-b.y)*2 < a.h+b.h; }

  function sound(type) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!sound.ac) sound.ac = new AC();
      const ac = sound.ac, o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      const now = ac.currentTime;
      if(type==="fire"){o.type="square";o.frequency.setValueAtTime(480,now);o.frequency.exponentialRampToValueAtTime(120,now+.07);g.gain.setValueAtTime(.045,now);g.gain.exponentialRampToValueAtTime(.001,now+.08);}
      if(type==="hit"){o.type="sawtooth";o.frequency.setValueAtTime(180,now);o.frequency.exponentialRampToValueAtTime(45,now+.28);g.gain.setValueAtTime(.08,now);g.gain.exponentialRampToValueAtTime(.001,now+.3);}
      if(type==="pickup"){o.type="square";o.frequency.setValueAtTime(330,now);o.frequency.setValueAtTime(520,now+.08);g.gain.setValueAtTime(.06,now);g.gain.exponentialRampToValueAtTime(.001,now+.18);}
      if(type==="bridge"){o.type="square";o.frequency.setValueAtTime(110,now);o.frequency.setValueAtTime(70,now+.2);g.gain.setValueAtTime(.05,now);g.gain.exponentialRampToValueAtTime(.001,now+.25);}
      if(type==="start"){o.type="square";o.frequency.setValueAtTime(220,now);o.frequency.setValueAtTime(440,now+.12);o.frequency.setValueAtTime(660,now+.24);g.gain.setValueAtTime(.05,now);g.gain.exponentialRampToValueAtTime(.001,now+.4);}
      o.start(now); o.stop(now+.45);
    } catch(e) {}
  }

  function explosion(x,y,big=false){
    sound("hit");
    for(let i=0;i<(big?26:12);i++){
      const a=rand(0,Math.PI*2), s=rand(18,70);
      particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.25,.7),max:.7,size:big?rand(1,3):1});
    }
  }
  const attackerNames=["عمه","فی فی","فافا","معراج","احمد"];
  function addEnemy(type){
    const r=riverAt(-scroll-10);
    const margin=10;
    const x=rand(r.c-r.w/2+margin,r.c+r.w/2-margin);
    enemies.push({type,x,y:-16,name:attackerNames[Math.floor(Math.random()*attackerNames.length)],w:type==="jet"?30:28,h:type==="jet"?18:20,vy:type==="jet"?rand(45,70):rand(22,40),phase:rand(0,9),dead:false});
  }
  function addFuel(){
    const r=riverAt(-10);
    pickups.push({type:"fuel",x:rand(r.c-r.w/2+12,r.c+r.w/2-12),y:-8,w:9,h:9});
  }
  function addBridge(){
    const r=riverAt(-10);
    bridges.push({y:-10,c:r.c,w:r.w,h:7});
    sound("bridge");
  }
  function fire(){
    if(!running) return;
    bullets.push({x:player.x,y:player.y-9,w:2,h:6,vy:-190});
    sound("fire");
  }
  function enemyFire(e){
    if(!running || e.y<8 || e.y>H-20) return;
    enemyBullets.push({x:e.x,y:e.y+10,w:4,h:9,vy:rand(75,115),life:3});
    sound("fire");
  }

  function startGame(){
    if(document.documentElement.requestFullscreen){
      document.documentElement.requestFullscreen().catch(()=>{});
    }
    if(screen.orientation && screen.orientation.lock){
      screen.orientation.lock("portrait").catch(()=>{});
    }
    running=true; gameOver=false; score=0; fuel=100; speed=55; scroll=0;
    spawnTimer=0; bridgeTimer=rand(12,18); fuelTimer=rand(5,9);
    enemies=[];bullets=[];enemyBullets=[];particles=[];pickups=[];bridges=[];
    player.x=W/2; player.y=H-55; player.inv=1.5;
    resetRiver();
    $("overlay").classList.add("hidden");
    sound("start");
  }

  function endGame(){
    running=false; gameOver=true;
    if(score>hi){hi=score;localStorage.setItem("riverRideHi",hi);}
    $("hi").textContent=String(hi).padStart(6,"0");
    $("overlay").innerHTML='<div class="title">پایان بازی</div><div class="subtitle">امتیاز: '+String(score).padStart(6,"0")+'</div><button id="start">بازی دوباره</button><div class="help">کلیدهای جهت‌دار یا WASD · فاصله برای شلیک</div>';
    $("overlay").classList.remove("hidden");
    $("start").onclick=startGame;
  }

  function damage(){
    if(player.inv>0)return;
    explosion(player.x,player.y,true);
    player.inv=2;
    fuel=Math.max(0,fuel-25);
    if(fuel<=0) endGame();
  }

  function update(dt){
    time+=dt;
    if(!running){
      scroll+=dt*10;
      updateRiver(dt*.35);
      return;
    }
    player.inv=Math.max(0,player.inv-dt);
    const left=keys.ArrowLeft||keys.a, right=keys.ArrowRight||keys.d;
    const up=keys.ArrowUp||keys.w, down=keys.ArrowDown||keys.s;
    if(left)player.x-=85*dt;
    if(right)player.x+=85*dt;
    if(up)player.y-=75*dt;
    if(down)player.y+=75*dt;
    if(touchTargetX!==null){
      const k=Math.min(1,dt*20);
      player.x += (touchTargetX-player.x)*k;
      player.y += (touchTargetY-player.y)*k;
    }
    player.x=Math.max(5,Math.min(W-5,player.x));
    player.y=Math.max(28,Math.min(H-12,player.y));

    const r=riverAt(player.y-scroll);
    if(player.x < r.c-r.w/2+5 || player.x > r.c+r.w/2-5) {
      speed=Math.max(35,speed-35*dt);
      fuel=Math.max(0,fuel-7*dt);
      if(Math.random()<dt*4) particles.push({x:player.x,y:player.y+8,vx:rand(-10,10),vy:rand(5,25),life:.2,max:.2,size:1});
    } else {
      speed=Math.min(72,speed+5*dt);
    }

    updateRiver(dt);
    scroll += speed*dt;

    fuel-=1.65*dt;
    if(fuel<=0){fuel=0;endGame();return;}

    spawnTimer-=dt;
    if(spawnTimer<=0){
      const n=Math.random()<.18?2:1;
      for(let i=0;i<n;i++) addEnemy(Math.random()<.25?"jet":(Math.random()<.55?"boat":"heli"));
      spawnTimer=rand(1.4,2.7)*Math.max(.65,1-score/18000);
    }
    fuelTimer-=dt;
    if(fuelTimer<=0){addFuel();fuelTimer=rand(7,13);}
    bridgeTimer-=dt;
    if(bridgeTimer<=0){addBridge();bridgeTimer=rand(14,22);}

    for(const b of bullets)b.y+=b.vy*dt;
    bullets=bullets.filter(b=>b.y>-10);

    for(const e of enemies){
      e.y += (e.vy+speed*.35)*dt;
      e.phase+=dt*3;
      if(!e.dead && Math.random()<dt*(e.type==="jet"?0.42:e.type==="heli"?0.28:0.18)) enemyFire(e);
      if(e.type==="jet") e.x += Math.sin(e.phase)*18*dt;
      if(e.type==="heli") e.x += Math.sin(e.phase)*8*dt;
      if(rectHit(player,e)) damage();
      for(const b of bullets){
        if(!e.dead&&rectHit(b,e)){
          e.dead=true;b.y=-20;score += e.type==="jet"?200:e.type==="heli"?150:100;explosion(e.x,e.y);
        }
      }
    }
    enemies=enemies.filter(e=>!e.dead&&e.y<H+20);

    for(const b of enemyBullets){
      b.y+=b.vy*dt;b.life-=dt;
      if(rectHit(player,b)){damage();b.life=0;explosion(b.x,b.y);}
    }
    enemyBullets=enemyBullets.filter(b=>b.life>0&&b.y<H+15);

    for(const p of pickups){
      p.y+=(speed*.8)*dt;
      if(rectHit(player,p)){fuel=Math.min(100,fuel+32);score+=50;explosion(p.x,p.y);sound("pickup");p.y=999;}
    }
    pickups=pickups.filter(p=>p.y<H+15);

    for(const br of bridges){
      br.y+=speed*dt;
      if(Math.abs(br.y-player.y)<8 && Math.abs(player.x-br.c)<br.w/2) damage();
    }
    bridges=bridges.filter(b=>b.y<H+12);

    for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=30*dt;p.life-=dt;}
    particles=particles.filter(p=>p.life>0);

    score += Math.floor(dt*10);
    $("score").textContent=String(score).padStart(6,"0");
    $("fuel").textContent=String(Math.ceil(fuel)).padStart(3,"0");
  }

  function drawPixelPlane(x,y){
    ctx.fillStyle="#f0f0d0";
    ctx.fillRect(x-1,y-9,2,17);ctx.fillRect(x-5,y-3,10,4);ctx.fillRect(x-3,y+4,6,3);
    ctx.fillStyle="#d04030";ctx.fillRect(x-1,y-7,2,5);ctx.fillRect(x-2,y+6,4,2);
  }
  function drawEnemy(e){
    ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y));
    const isAmme=e.name==="عمه";
    const w=isAmme?44:(e.type==="jet"?30:28), h=isAmme?28:(e.type==="jet"?18:20);
    ctx.fillStyle="#151716";
    ctx.strokeStyle="#ddd5a5";ctx.lineWidth=2;
    if(isAmme){
      ctx.beginPath();ctx.moveTo(-22,7);ctx.lineTo(-13,-7);ctx.lineTo(-5,-4);ctx.lineTo(0,-12);ctx.lineTo(5,-4);ctx.lineTo(13,-7);ctx.lineTo(22,7);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="#6b4430";ctx.fillRect(-8,-2,16,5);
    } else if(e.type==="boat"){
      ctx.beginPath();ctx.moveTo(-14,6);ctx.lineTo(-10,-6);ctx.lineTo(8,-6);ctx.lineTo(14,6);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="#315f64";ctx.fillRect(-7,-3,14,4);ctx.fillStyle="#b9a45e";ctx.fillRect(-2,-11,4,5);
    } else if(e.type==="heli"){
      ctx.beginPath();ctx.moveTo(-13,2);ctx.lineTo(-7,-6);ctx.lineTo(7,-6);ctx.lineTo(13,2);ctx.lineTo(7,7);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="#30352e";ctx.fillRect(-17,-9,34,2);ctx.fillRect(-2,-12,4,4);
    } else {
      ctx.beginPath();ctx.moveTo(-15,7);ctx.lineTo(-5,2);ctx.lineTo(-10,-8);ctx.lineTo(-2,-6);ctx.lineTo(0,-11);ctx.lineTo(2,-6);ctx.lineTo(10,-8);ctx.lineTo(5,2);ctx.lineTo(15,7);ctx.lineTo(4,5);ctx.lineTo(0,9);ctx.lineTo(-4,5);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="#30352e";ctx.fillRect(-3,-3,6,9);
    }
    ctx.fillStyle="#f5f0d0";ctx.font="bold 8px Tahoma,Arial,sans-serif";
    ctx.textAlign="center";ctx.textBaseline="middle";ctx.direction="rtl";ctx.fillText(e.name,0,0);
    ctx.restore();
  }
  function drawFuel(p){
    const x=Math.round(p.x), y=Math.round(p.y);
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle="#e0d59c";ctx.fillRect(-7,-9,14,18);
    ctx.fillStyle="#8b6b3e";ctx.fillRect(-5,-11,10,3);ctx.fillRect(5,-8,4,5);
    ctx.fillStyle="#a8322a";ctx.fillRect(-4,-5,8,10);
    ctx.fillStyle="#eee8bd";ctx.fillRect(-2,-3,4,6);
    ctx.fillStyle="#f5f0d0";ctx.font="bold 5px Tahoma,Arial,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.direction="rtl";ctx.fillText("بنزین",0,13);
    ctx.restore();
  }
  function drawRiver(){
    ctx.fillStyle="#b8a96c";ctx.fillRect(0,0,W,H);
    for(let y=0;y<H;y+=4){
      const r=riverAt(y-scroll), l=Math.floor(r.c-r.w/2), rr=Math.ceil(r.c+r.w/2);
      ctx.fillStyle="#274f5a";ctx.fillRect(l,y,rr-l,4);
      ctx.fillStyle="#315f64";
      const wave=((y+Math.floor(scroll))>>2)%2;
      if(wave){ctx.fillRect(l+6,y+1,7,1);ctx.fillRect(rr-14,y+2,6,1);}
      ctx.fillStyle="#8e8352";ctx.fillRect(l-2,y,2,4);ctx.fillRect(rr,y,2,4);
    }
  }
  function drawBridge(b){
    const l=b.c-b.w/2, r=b.c+b.w/2;
    ctx.fillStyle="#8b6b3e";ctx.fillRect(l,b.y,r-l,6);
    ctx.fillStyle="#24231d";for(let x=l;x<r;x+=7)ctx.fillRect(x,b.y,3,6);
    ctx.fillStyle="#d6c98f";ctx.fillRect(l-2,b.y-2,2,10);ctx.fillRect(r,b.y-2,2,10);
  }
  function draw(){
    drawRiver();
    for(const b of bridges)drawBridge(b);
    for(const p of pickups)drawFuel(p);
    for(const e of enemies)drawEnemy(e);
    ctx.fillStyle="#fff1b0";
    for(const b of bullets)ctx.fillRect(Math.round(b.x),Math.round(b.y),b.w,b.h);
    for(const b of enemyBullets){
      ctx.fillStyle="#e63b22";ctx.fillRect(Math.round(b.x)-2,Math.round(b.y)-4,4,7);
      ctx.fillStyle="#ffd34d";ctx.fillRect(Math.round(b.x)-1,Math.round(b.y)-6,2,4);
    }
    for(const p of particles){
      ctx.globalAlpha=Math.max(0,p.life/p.max);
      ctx.fillStyle=p.size>2?"#eee0a0":"#c43a2d";
      ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);
    }
    ctx.globalAlpha=1;
    if(running && (player.inv<=0 || Math.floor(time*12)%2===0))drawPixelPlane(Math.round(player.x),Math.round(player.y));
    if(running){
      ctx.fillStyle="rgba(0,0,0,.35)";ctx.fillRect(5,5,90,8);
      ctx.fillStyle="#ded49d";ctx.fillRect(6,6,Math.max(0,88*fuel/100),6);
    }
  }

  function loop(t){
    const dt=Math.min(.033,(t-last)/1000||0);last=t;
    update(dt);draw();requestAnimationFrame(loop);
  }

  function setKey(k,v){keys[k]=v;}
  window.addEventListener("keydown",e=>{
    if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," ","w","a","s","d"].includes(e.key))e.preventDefault();
    if(e.key===" "&&!e.repeat)fire();
    setKey(e.key,true);
  });
  window.addEventListener("keyup",e=>setKey(e.key,false));

  $("start").onclick=startGame;
  const fireBtn=$("fire");
  fireBtn.addEventListener("pointerdown",e=>{e.preventDefault();fire();});
  document.querySelectorAll("[data-key]").forEach(btn=>{
    const k=btn.dataset.key;
    btn.addEventListener("pointerdown",e=>{e.preventDefault();setKey(k,true);});
    btn.addEventListener("pointerup",e=>{e.preventDefault();setKey(k,false);});
    btn.addEventListener("pointercancel",()=>setKey(k,false));
    btn.addEventListener("pointerleave",()=>setKey(k,false));
  });
  let touchId=null, touchTargetX=null, touchTargetY=null;
  canvas.addEventListener("pointerdown",e=>{
    if(!running)return;
    touchId=e.pointerId;
    canvas.setPointerCapture(touchId);
    const r=canvas.getBoundingClientRect();
    touchTargetX=(e.clientX-r.left)/r.width*W;
    touchTargetY=(e.clientY-r.top)/r.height*H;
    e.preventDefault();
  });
  canvas.addEventListener("pointermove",e=>{
    if(e.pointerId!==touchId||!running)return;
    const r=canvas.getBoundingClientRect();
    touchTargetX=Math.max(0,Math.min(W,(e.clientX-r.left)/r.width*W));
    touchTargetY=Math.max(0,Math.min(H,(e.clientY-r.top)/r.height*H));
    e.preventDefault();
  });
  canvas.addEventListener("pointerup",e=>{
    if(e.pointerId===touchId){touchId=null;touchTargetX=null;touchTargetY=null;}
  });
  canvas.addEventListener("pointercancel",e=>{
    if(e.pointerId===touchId){touchId=null;touchTargetX=null;touchTargetY=null;}
  });
  const joystick=document.getElementById("joystick");
  if(joystick){
    const knob=joystick.querySelector(".joy-knob");
    let joyPointer=null;
    const updateJoy=e=>{
      const r=joystick.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      let dx=e.clientX-cx, dy=e.clientY-cy;
      const max=r.width*.34;
      const dist=Math.hypot(dx,dy);
      if(dist>max){dx=dx/dist*max;dy=dy/dist*max;}
      knob.style.transform=`translate(${dx}px,${dy}px)`;
      const nx=dx/max, ny=dy/max;
      keys.ArrowLeft=nx<-.18; keys.ArrowRight=nx>.18;
      keys.ArrowUp=ny<-.18; keys.ArrowDown=ny>.18;
    };
    const releaseJoy=()=>{
      joyPointer=null;
      keys.ArrowLeft=keys.ArrowRight=keys.ArrowUp=keys.ArrowDown=false;
      knob.style.transform="translate(0,0)";
    };
    joystick.addEventListener("pointerdown",e=>{
      e.preventDefault(); joyPointer=e.pointerId;
      joystick.setPointerCapture(joyPointer); updateJoy(e);
    });
    joystick.addEventListener("pointermove",e=>{
      if(e.pointerId===joyPointer){e.preventDefault();updateJoy(e);}
    });
    joystick.addEventListener("pointerup",releaseJoy);
    joystick.addEventListener("pointercancel",releaseJoy);
  }

  $("score").textContent="000000";$("fuel").textContent="100";$("hi").textContent=String(hi).padStart(6,"0");
  requestAnimationFrame(loop);
})();