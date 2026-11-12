/* =====================================================================
   PART 4 — UI / INPUT / MAIN LOOP / VERIFICATION HOOKS
   ===================================================================== */
setupPickupMeshes(); setupVFX(); buildMapMeshes(SIM);

const BOSS_NAMES=['ASHEN WARDEN','GRAVE SOVEREIGN','MAGMA TYRANT'];
const UI={tiltX:0,tiltY:0,stickActive:false,stickId:null,attack:false,atkBuf:0,
          rollLatch:false,upgradeLatch:-1,keys:Object.create(null)};
/* A tap shorter than one rendered frame used to vanish between two sim steps
   (very common on a phone at 30-45 fps). Every press now also arms a short
   buffer, so the swing is guaranteed to start even if pointerup lands first. */
const ATK_BUFFER=0.25;
const INPUT_LOG={pointerdown:0,pointermove:0,pointerup:0,touch:0,keydown:0,attackPress:0,rollPress:0};
let overlayKey='';

function esc(t){ return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function resize(){
  const w=innerWidth,h=innerHeight;
  renderer.setSize(w,h);
  camera.aspect=w/Math.max(1,h);
  camera.fov=clamp(58/Math.max(1,camera.aspect/2.1),46,68);
  camera.updateProjectionMatrix();
  const u=clamp(Math.min(w/844,h/390),0.78,1.1);
  document.documentElement.style.setProperty('--u',u.toFixed(3));
}
addEventListener('resize',resize); resize();

/* ---------- virtual joystick: REAL pointer events ---------- */
const stickZone=$('stickZone'),stick=$('stick'),knob=$('stickKnob');
function tiltFrom(ev){
  const r=stick.getBoundingClientRect();
  const cx=r.left+r.width/2,cy=r.top+r.height/2;
  const rad=r.width/2;
  let dx=(ev.clientX-cx)/rad, dy=(ev.clientY-cy)/rad;
  const m=Math.sqrt(dx*dx+dy*dy);
  if(m>1){dx/=m;dy/=m;}
  /* SCREEN space: +tiltX = finger to the right, +tiltY = finger up.
     The ONE conversion to WORLD space lives in readInput() below, so the
     joystick and the keyboard can never disagree about left/right. */
  UI.tiltX=dx; UI.tiltY=-dy;
  knob.style.transform='translate('+(dx*rad*0.62)+'px,'+(dy*rad*0.62)+'px)';
}
function resetTilt(){ UI.tiltX=0;UI.tiltY=0;UI.stickActive=false;UI.stickId=null;
  knob.style.transform='translate(0,0)'; }
stickZone.addEventListener('pointerdown',e=>{
  if(UI.stickActive)return;
  e.preventDefault(); UI.stickActive=true;UI.stickId=e.pointerId;
  if(e.pointerType==='touch')INPUT_LOG.touch++;
  INPUT_LOG.pointerdown++;
  try{stickZone.setPointerCapture(e.pointerId);}catch(err){}
  Audio.init(); tiltFrom(e);
});
stickZone.addEventListener('pointermove',e=>{
  if(!UI.stickActive||e.pointerId!==UI.stickId)return;
  e.preventDefault();INPUT_LOG.pointermove++;tiltFrom(e);
});
function stickEnd(e){
  if(!UI.stickActive||e.pointerId!==UI.stickId)return;
  e.preventDefault();INPUT_LOG.pointerup++;resetTilt();
}
stickZone.addEventListener('pointerup',stickEnd);
stickZone.addEventListener('pointercancel',stickEnd);
stickZone.addEventListener('lostpointercapture',()=>{ if(UI.stickActive)resetTilt(); });

/* ---------- ONE big ATTACK, ONE big ROLL ---------- */
/* Mobile hardening. Pointer events are the primary path, but some WebViews
   only deliver touch/mouse events, a pointerup can be lost when the app
   switcher steals the finger, and a very short tap can vanish between two
   frames. Every path funnels into pressAction() with a duplicate guard, and
   every release path clears the held state, so a button can neither double-
   fire nor stay dead. */
const BTN_PTR={btnAttack:new Set(),btnRoll:new Set()};
const BTN_LAST={btnAttack:-1e9,btnRoll:-1e9};
const PTR_AT={btnAttack:-1e9,btnRoll:-1e9};   // last pointerdown per button
let LAST_TOUCH=-1e9;
function pressAction(id){
  const now=performance.now();
  if(now-BTN_LAST[id]<45)return;           // same physical tap seen twice
  BTN_LAST[id]=now;
  $(id).classList.add('press');
  if(id==='btnRoll'){UI.rollLatch=true;INPUT_LOG.rollPress++;}
  else{UI.attack=true;UI.atkBuf=ATK_BUFFER;INPUT_LOG.attackPress++;}
  INPUT_LOG.pointerdown++;
  Audio.init();
}
function releaseAction(id,pid){
  const set=BTN_PTR[id];if(!set)return;
  if(pid!==undefined){ if(set.delete(pid))INPUT_LOG.pointerup++; }
  if(!set.size){$(id).classList.remove('press');if(id==='btnAttack')UI.attack=false;}
}
function forceRelease(id){
  BTN_PTR[id].clear();
  $(id).classList.remove('press');
  if(id==='btnAttack')UI.attack=false;
}
function bindButton(id){
  const el=$(id),set=BTN_PTR[id];
  const down=e=>{
    if(e.type==='pointerdown'){
      PTR_AT[id]=performance.now();
    }else{
      /* Browsers fire pointerdown BEFORE touchstart/mousedown for the same
         finger; if the pointer path already took this gesture, every compat
         event for it must be ignored or one tap becomes two swings. */
      if(performance.now()-PTR_AT[id]<700)return;
      if(e.type==='touchstart')LAST_TOUCH=performance.now();
      if(e.type==='mousedown' && performance.now()-LAST_TOUCH<800)return;
    }
    if(e.cancelable)e.preventDefault();
    if(e.pointerId!==undefined)set.add(e.pointerId);
    if(e.pointerType==='touch')INPUT_LOG.touch++;
    pressAction(id);
  };
  el.addEventListener('pointerdown',down);
  el.addEventListener('touchstart',down,{passive:false});
  el.addEventListener('mousedown',down);
  // last-resort path for engines that only surface a click
  el.addEventListener('click',e=>{
    e.preventDefault();
    if(performance.now()-PTR_AT[id]<700)return;
    if(performance.now()-BTN_LAST[id]<700)return;
    pressAction(id); releaseAction(id,'click');
  });
  const up=e=>{ if(e.cancelable)e.preventDefault(); releaseAction(id,e.pointerId); };
  el.addEventListener('pointerup',up);
  el.addEventListener('pointercancel',up);
  el.addEventListener('touchend',up);
  el.addEventListener('touchcancel',up);
  el.addEventListener('mouseup',up);
  el.addEventListener('mouseleave',up);
}
addEventListener('pointerup',e=>{releaseAction('btnAttack',e.pointerId);releaseAction('btnRoll',e.pointerId);});
addEventListener('pointercancel',e=>{releaseAction('btnAttack',e.pointerId);releaseAction('btnRoll',e.pointerId);});
/* All fingers up: no pointer can still be holding a button. */
addEventListener('touchend',()=>{forceRelease('btnAttack');forceRelease('btnRoll');});
addEventListener('touchcancel',()=>{forceRelease('btnAttack');forceRelease('btnRoll');});
addEventListener('mouseup',()=>{forceRelease('btnAttack');forceRelease('btnRoll');});
bindButton('btnAttack'); bindButton('btnRoll');

/* ---------- fullscreen / mute ---------- */
$('btnFs').addEventListener('pointerdown',e=>{
  e.preventDefault();Audio.init();
  const d=document.documentElement;
  if(!document.fullscreenElement){
    const lock=()=>{ try{ const o=screen.orientation;
      if(o&&o.lock){ const q=o.lock('landscape'); if(q&&q.catch)q.catch(()=>{}); }
    }catch(err){} };
    const p=d.requestFullscreen?d.requestFullscreen():Promise.resolve();
    if(p&&p.then)p.then(lock).catch(()=>{}); else lock();
  }else{ if(document.exitFullscreen)document.exitFullscreen(); }
});
$('btnMute').addEventListener('pointerdown',e=>{
  e.preventDefault();Audio.init();
  const m=Audio.toggle();$('btnMute').innerHTML=m?'&#128263;':'&#9835;';
});

/* ---------- keyboard ---------- */
const GAME_KEYS=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','j','k','shift','p','m','f','enter']);
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if(GAME_KEYS.has(k))e.preventDefault();
  if(!UI.keys[k]){
    INPUT_LOG.keydown++;
    if(k==='shift'||k==='k'){UI.rollLatch=true;INPUT_LOG.rollPress++;}
    if(k===' '||k==='j')UI.atkBuf=ATK_BUFFER;
    if(k==='enter'&&SIM.phase==='title')startRun();
    if(k==='m'){Audio.init();const m=Audio.toggle();$('btnMute').innerHTML=m?'&#128263;':'&#9835;';}
    if(k==='f'){const d=document.documentElement;
      if(d.requestFullscreen){const q=d.requestFullscreen();if(q&&q.catch)q.catch(()=>{});}}
    if(k==='p'){ if(SIM.phase==='play'||SIM.phase==='boss'){SIM.paused=true;SIM.phase='paused';}
                 else if(SIM.phase==='paused'){SIM.phase=SIM.boss?'boss':'play';SIM.paused=false;} }
  }
  UI.keys[k]=true;
  Audio.init();
});
addEventListener('keyup',e=>{UI.keys[e.key.toLowerCase()]=false;});
addEventListener('blur',()=>{UI.keys=Object.create(null);UI.attack=false;resetTilt();});

let LAST_IN={mx:0,my:0,sx:0,sy:0};
function readInput(){
  // Screen-space input from BOTH devices: +sx = RIGHT on screen, +sy = UP on screen.
  let sx=UI.tiltX,sy=UI.tiltY;
  if(!UI.stickActive){
    const k=UI.keys;
    sx=(k['d']||k['arrowright']?1:0)-(k['a']||k['arrowleft']?1:0);
    sy=(k['w']||k['arrowup']?1:0)-(k['s']||k['arrowdown']?1:0);
    const m=Math.sqrt(sx*sx+sy*sy); if(m>1){sx/=m;sy/=m;}
  }
  /* ONE screen -> world conversion, shared by joystick and keyboard.
     The camera sits behind the hero at -Z and looks toward +Z, so its right
     vector is world -X: SCREEN-RIGHT = world -X, SCREEN-UP = world +Z.
     Feeding +sx straight into world X was the left/right swap. */
  const mx=-sx, my=sy;
  LAST_IN.mx=mx;LAST_IN.my=my;LAST_IN.sx=sx;LAST_IN.sy=sy;
  // held button OR a buffered tap; the buffer drains one fixed step at a time
  let atk=UI.attack||!!UI.keys[' ']||!!UI.keys['j'];
  if(UI.atkBuf>0){ atk=true; UI.atkBuf=Math.max(0,UI.atkBuf-FIXED); }
  const inp={mx,my,attack:atk,
    roll:UI.rollLatch,upgrade:UI.upgradeLatch};
  UI.rollLatch=false;UI.upgradeLatch=-1;      // edge-triggered, consumed once
  return inp;
}

/* ---------- overlays ---------- */
function setOverlay(key,kick,title,sub,body,cards,btns,credits){
  overlayKey=key;
  $('ovKick').textContent=kick;$('ovTitle').textContent=title;$('ovSub').textContent=sub;
  $('ovBody').innerHTML=body||'';
  const cw=$('cards');cw.innerHTML='';
  (cards||[]).forEach((c,i)=>{
    const el=document.createElement('div');el.className='card';
    el.innerHTML='<div class="ic">'+esc(c.ic)+'</div><div class="nm">'+esc(c.name)+
                 '</div><div class="ds">'+esc(c.ds)+'</div>';
    el.addEventListener('click',()=>{UI.upgradeLatch=i;Audio.init();});
    cw.appendChild(el);
  });
  const bw=$('ovBtns');bw.innerHTML='';
  (btns||[]).forEach(b=>{
    const el=document.createElement('button');
    el.className='bigbtn'+(b.ghost?' ghost':'');el.textContent=b.label;
    el.addEventListener('click',b.fn);bw.appendChild(el);
  });
  $('credits').innerHTML=credits||'';
  $('overlay').classList.add('on');
}
function hideOverlay(){overlayKey='';$('overlay').classList.remove('on');}
const CREDITS_HTML='three.js r170 &mdash; MIT, &copy; 2010-2024 three.js authors (vendored inline). '+
  'Mesh2Motion-style humanoid rig + animation clips &mdash; CC0 1.0, authored procedurally in this file. '+
  'No third-party model, texture, font or audio files. All terrain, gear, VFX and music are generated in code. Zero network requests.';

function startRun(){
  SIM=newSim(0x51A7E); SIM.phase='play';
  buildMapMeshes(SIM); resetTilt();UI.attack=false;UI.rollLatch=false;
  hideOverlay();Audio.init();
}
function syncOverlay(){
  const s=SIM,key=s.phase+(s.phase==='levelup'?s.level:'')+(s.phase==='clear'?s.chapter:'');
  if(key===overlayKey)return;
  if(s.phase==='title'){
    setOverlay(key,'A SINGLE FILE · NO NETWORK · NO ASSETS','AETHERBLADE',
      '3D ARENA SURVIVOR — 3 CHAPTERS',
      '<div><span class="k">LEFT STICK</span> move &nbsp;·&nbsp; <span class="k">ATTACK</span> 3.2 m / 130&deg; sword &nbsp;·&nbsp; <span class="k">ROLL</span> 3.5 m i-frames</div>'+
      '<div>Survive <span class="k">3:00</span> per chapter, then kill the boss. Collect XP gems, pick upgrades, carry them forward.</div>'+
      '<div>Keyboard: <span class="k">WASD</span> move &nbsp; <span class="k">SPACE / J</span> attack &nbsp; <span class="k">SHIFT / K</span> roll.</div>',
      null,[{label:'START RUN',fn:startRun}],CREDITS_HTML);
  }else if(s.phase==='levelup'){
    const cards=s.choices.map(id=>UPGRADES.find(u=>u.id===id)).filter(Boolean);
    setOverlay(key,'LEVEL '+s.level,'CHOOSE AN UPGRADE','The arena is paused.',
      '<div style="text-align:center">Upgrades and score carry across all three chapters.</div>',
      cards,null,'');
  }else if(s.phase==='clear'){
    setOverlay(key,'CHAPTER '+s.chapter,'CHAPTER CLEARED',
      s.chapter<3?'NEXT: '+PALETTES[s.chapter].name:'THE ECLIPSE IS BROKEN',
      '<div style="text-align:center">Score '+s.score+' &nbsp;·&nbsp; Kills '+s.kills+' &nbsp;·&nbsp; HP '+Math.round(s.hero.hp)+'</div>',
      null,null,'');
  }else if(s.phase==='dead'){
    setOverlay(key,'RUN ENDED','YOU FELL','CHAPTER '+s.chapter,
      '<div style="text-align:center">Score '+s.score+' &nbsp;·&nbsp; Kills '+s.kills+' &nbsp;·&nbsp; Level '+s.level+'</div>',
      null,[{label:'RETRY',fn:startRun}],'');
  }else if(s.phase==='victory'){
    setOverlay(key,'ALL THREE CHAPTERS CLEARED','VICTORY','AETHERBLADE',
      '<div style="text-align:center">Final score '+s.score+' &nbsp;·&nbsp; '+s.kills+' kills &nbsp;·&nbsp; Level '+s.level+'</div>',
      null,[{label:'PLAY AGAIN',fn:startRun}],CREDITS_HTML);
  }else if(s.phase==='paused'){
    setOverlay(key,'PAUSED','PAUSED','P TO RESUME','',null,
      [{label:'RESUME',fn:()=>{SIM.phase=SIM.boss?'boss':'play';SIM.paused=false;hideOverlay();}}],'');
  }else hideOverlay();
}

/* ---------- HUD ---------- */
function fmtTime(t){
  t=Math.max(0,t);const m=Math.floor(t/60),ss=Math.floor(t%60);
  return m+':'+String(ss).padStart(2,'0');
}
function updateHUD(){
  const s=SIM,h=s.hero;
  $('hpFill').style.width=(100*h.hp/h.maxHp).toFixed(1)+'%';
  $('hpNum').textContent=Math.round(h.hp)+' / '+h.maxHp;
  $('scoreTxt').textContent='SCORE '+s.score;
  $('lvTxt').textContent='LV '+s.level;
  $('xpFill').style.width=(100*s.xp/s.xpNeed).toFixed(1)+'%';
  const bossPhase=(s.phase==='boss'||!!s.boss);
  $('timerLab').textContent=bossPhase?'BOSS FIGHT':'BOSS ARRIVES IN';
  $('timerVal').textContent=bossPhase?'NOW':fmtTime(s.waveLeft);
  const b=s.boss,showBoss=!!b&&b.hp>0;
  $('bossWrap').classList.toggle('on',showBoss);
  if(showBoss){
    $('bossName').textContent=BOSS_NAMES[s.chapter-1];
    $('bossFill').style.width=(100*b.hp/b.maxHp).toFixed(1)+'%';
  }
  // off-camera boss arrow
  const arrow=$('bossArrow');
  if(showBoss){
    _v.set(b.x,2.0,b.z).project(camera);
    const behind=_v.z>1;
    const off=behind||Math.abs(_v.x)>0.92||Math.abs(_v.y)>0.86;
    if(off){
      let px=_v.x,py=_v.y;
      if(behind){px=-px;py=-py;}
      const m=Math.max(Math.abs(px),Math.abs(py))||1;
      px/=m;py/=m;
      const sx=innerWidth/2+px*innerWidth*0.40;
      const sy=innerHeight/2-py*innerHeight*0.36;
      const ang=Math.atan2(-py,px)*180/Math.PI+90;
      arrow.style.display='block';
      arrow.style.left=sx+'px';arrow.style.top=sy+'px';
      arrow.style.transform='translate(-50%,-50%) rotate('+ang+'deg)';
    }else arrow.style.display='none';
  }else arrow.style.display='none';
}
function updateCamera(dt){
  const s=SIM,h=s.hero;
  const tx=h.x,ty=1.15,tz=h.z+2.4;
  camera.position.x=lerp(camera.position.x,tx,Math.min(1,dt*6));
  camera.position.y=lerp(camera.position.y,9.4*camZoom,Math.min(1,dt*6));
  camera.position.z=lerp(camera.position.z,tz-13.2*camZoom,Math.min(1,dt*6));
  const sh=SHAKE;
  if(sh>0){camera.position.x+=(CRNG()-0.5)*sh*0.55;
           camera.position.y+=(CRNG()-0.5)*sh*0.35;
           camera.position.z+=(CRNG()-0.5)*sh*0.55;}
  camera.lookAt(tx,ty,tz);
}
let RTIME=0,lastNow=performance.now(),acc=0,frameCount=0,lastCalls=0;
let lastChapter=SIM.chapter,camZoom=0.86;
function frame(now){
  const dt=Math.min(0.1,(now-lastNow)/1000);lastNow=now;RTIME+=dt;
  acc+=dt;
  let steps=0;
  while(acc>=FIXED&&steps<6){simStep(readInput());acc-=FIXED;steps++;}
  consumeEvents();
  const s=SIM;
  if(s.chapter!==lastChapter){lastChapter=s.chapter;buildMapMeshes(s);}
  syncViews(s,dt);
  updatePickupMeshes(s,RTIME);
  updateVFX(dt,RTIME);
  Audio.setIntensity(Math.min(1,s.enemies.length/7+(s.boss?0.55:0)+s.chapter*0.05));
  updateCamera(dt);
  syncOverlay();
  updateHUD();
  renderer.render(scene,camera);
  lastCalls=renderer.info.render.calls;
  frameCount++;
  requestAnimationFrame(frame);
}

/* ---------- verification hooks (read-only except explicit test helpers) ---------- */
window.__GAME={
  CFG, PALETTES, UPGRADES, CLIPS,
  get sim(){return SIM;},
  get input(){return {mx:LAST_IN.mx,my:LAST_IN.my,sx:LAST_IN.sx,sy:LAST_IN.sy,
    tiltX:UI.tiltX,tiltY:UI.tiltY,attack:UI.attack,stickActive:UI.stickActive};},
  // read-only projection of a WORLD point through the live camera (for direction QA)
  projectWorld(x,y,z){const v=new T.Vector3(x,y||0,z).project(camera);
    return {x:v.x,y:v.y,z:v.z};},
  get log(){return Object.assign({},INPUT_LOG);},
  get calls(){return lastCalls;},
  get frames(){return frameCount;},
  get anim(){ const out=[]; for(const [id,v] of VIEWS)out.push({id,clip:v.anim.cur,prev:v.anim.prev,
    blend:+v.anim.blend.toFixed(4),weightSum:v.anim.weightSum,bone0:v.bones[3].rotation.z});
    return out; },
  animWeight(){ let mn=1; for(const v of VIEWS.values())mn=Math.min(mn,v.anim.weightSum); return mn; },
  digest(){return simDigest(SIM);},
  step(inp){simStep(normInput(inp));return simDigest(SIM);},
  reset(seed,phase){SIM=newSim((seed>>>0)||0x51A7E);if(phase)SIM.phase=phase;buildMapMeshes(SIM);
    hideOverlay();return simDigest(SIM);},
  runHeadless,
  uiRects(){ const r={}; for(const id of ['stick','btnAttack','btnRoll','btnMute','btnFs',
      'hpWrap','timer','bossWrap','stickZone','actZone']){
      const b=$(id).getBoundingClientRect();r[id]={x:b.x,y:b.y,w:b.width,h:b.height,
        cx:b.x+b.width/2,cy:b.y+b.height/2}; } return r; },
  heroPose(){ const v=VIEWS.get(0); if(!v)return null;
    return {rx:+v.mesh.rotation.x.toFixed(4),ry:+v.mesh.rotation.y.toFixed(4),
      rz:+v.mesh.rotation.z.toFixed(4),y:+v.mesh.position.y.toFixed(4),
      x:+v.mesh.position.x.toFixed(4),z:+v.mesh.position.z.toFixed(4),
      s:+v.mesh.scale.x.toFixed(4),order:v.mesh.rotation.order}; },
  hero(){ const h=SIM.hero;return {x:h.x,z:h.z,hp:h.hp,state:h.state,st:h.st,
    speed:Math.sqrt(h.vx*h.vx+h.vz*h.vz),vx:h.vx,vz:h.vz,yaw:h.yaw,
    invuln:h.invuln,atkCd:h.atkCd,rollCd:h.rollCd}; },
  bossDistance(){const b=SIM.boss;if(!b)return -1;
    return Math.sqrt((b.x-SIM.hero.x)**2+(b.z-SIM.hero.z)**2);},
  spawnBossNow(){SIM.enemies=[];SIM.projectiles=[];SIM.waveLeft=0;SIM.phase='play';
    spawnBoss(SIM);return this.bossDistance();},
  setHero(x,z,hp){SIM.hero.x=x;SIM.hero.z=z;SIM.hero.vx=0;SIM.hero.vz=0;
    if(hp!==undefined)SIM.hero.hp=hp;},
  setZoom(v){camZoom=clamp(v,0.35,2);},
  setChapter(n){SIM.chapter=clamp(n|0,1,3);SIM.map=buildMapData(SIM.chapter);
    buildMapMeshes(SIM);lastChapter=SIM.chapter;return SIM.chapter;},
  spawnTestEnemy(type,x,z,state){const e=makeEnemy(SIM,type,x,z,0.6);
    if(state){e.state=state;e.timer=0.55;e.lockYaw=e.yaw;}return e.id;},
  clearEnemies(){SIM.enemies=[];SIM.projectiles=[];SIM.boss=null;},
  bossName(){return BOSS_NAMES[SIM.chapter-1];},
  clearViews(){for(const [id,v] of VIEWS){scene.remove(v.mesh);v.mesh.material.dispose();}VIEWS.clear();},
  stopAudio(){Audio.stop();},
  get muted(){return Audio.muted;},
  get audioReady(){return Audio.ready;},
  get EV(){return EV.slice();}
};

/* kick off — title screen first; START is a real pointer/keyboard action */
requestAnimationFrame(frame);
})();
