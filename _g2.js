/* =====================================================================
   PART 2 — DETERMINISTIC SIMULATION
   simStep() is the ONLY writer of sim state. It consumes (input, FIXED).
   No Date.now/Math.random/render/audio/VFX calls below this line.
   ===================================================================== */
let SIM = newSim(0x51A7E);
let EV = [];                     // cosmetic event queue — NOT sim state
function emit(type, d){
  /* The payload often carries a 'type' (brute/runner/ranger/boss). Keep the
     EVENT name authoritative, otherwise 'hit'/'kill'/'splat' get relabelled
     to the unit name and the cosmetic consumer never sees them. */
  const e=Object.assign({},d||{});
  if(d&&Object.prototype.hasOwnProperty.call(d,'type'))e.unit=d.type;
  e.type=type;
  EV.push(e);
}

function normInput(i){
  i=i||{};
  return { mx:clamp(i.mx||0,-1,1), my:clamp(i.my||0,-1,1),
           attack:!!i.attack, roll:!!i.roll,
           upgrade:(typeof i.upgrade==='number'?i.upgrade:-1) };
}
function stopSteps(ms){ return Math.round(ms*60/1000); }
function addHitStop(s,ms){ s.hitStop=Math.max(s.hitStop,stopSteps(ms)); }

/* Push a body out of one solid disc and drop the inward velocity component,
   so it SLIDES along the surface instead of sticking. */
function pushOut(e,cx,cz,rr){
  const ox=e.x-cx, oz=e.z-cz, d2=ox*ox+oz*oz;
  if(d2>=rr*rr || d2<=1e-9)return;
  const dd=Math.sqrt(d2), nx=ox/dd, nz=oz/dd, push=rr-dd;
  e.x+=nx*push; e.z+=nz*push;
  const dot=e.vx*nx+e.vz*nz;             // remove inward component => slide
  if(dot<0){ e.vx-=dot*nx; e.vz-=dot*nz; }
}
function moveWithCollision(s,e,dx,dz,radius){
  e.x+=dx; e.z+=dz;
  const d=Math.sqrt(e.x*e.x+e.z*e.z);
  if(d>ARENA_R){ const k=ARENA_R/d; e.x*=k; e.z*=k; }   // visible hills start here
  const cs=s.map.colliders;
  for(let pass=0;pass<2;pass++){
    for(let i=0;i<cs.length;i++){
      const c=cs[i];
      if(c.seg){                        // capsule: fence runs, castle walls
        const sx=c.bx-c.ax, sz=c.bz-c.az, L2=sx*sx+sz*sz;
        let t=L2>1e-9?((e.x-c.ax)*sx+(e.z-c.az)*sz)/L2:0;
        t=t<0?0:(t>1?1:t);
        pushOut(e,c.ax+sx*t,c.az+sz*t,c.r+radius);
      }else{                            // disc: pond, trees, rocks, pillars, props
        pushOut(e,c.x,c.z,c.r+radius);
      }
    }
  }
}

function hurtHero(s,dmg,kind){
  const h=s.hero;
  if(h.invuln>0 || s.phase==='dead' || s.phase==='clear')return false;
  h.hp=Math.max(0,h.hp-dmg);
  h.state='hurt'; h.st=0; h.invuln=0.45;
  emit('hurt',{x:h.x,z:h.z,dmg,kind});
  FXSHAKE(0.55);
  if(kind==='boss')addHitStop(s,CFG.hitStopMs.bossSlam);
  if(h.hp<=0){ s.phase='dead'; emit('death',{x:h.x,z:h.z}); }
  return true;
}

function killEnemy(s,e){
  if(e.dead)return;
  e.dead=true;
  s.kills++; s.score+=CFG.enemy[e.type].score;
  s.gems.push({id:s.nextId++,x:e.x,z:e.z,v:1});
  if(rnd(s)<CFG.heal.chance)s.heals.push({id:s.nextId++,x:e.x+0.35,z:e.z-0.25});
  if(s.up.siphon>0)s.hero.hp=Math.min(s.hero.maxHp,s.hero.hp+3*s.up.siphon);
  emit('kill',{x:e.x,z:e.z,type:e.type});
  emit('splat',{x:e.x,z:e.z,type:e.type});
  addHitStop(s,CFG.hitStopMs.kill);
  FXSHAKE(0.30);
}

function damageEnemy(s,e,dmg,crit){
  if(e.dead)return;
  // My hit CANCELS an enemy attack during its wind-up — except a knight, whose
  // wind-up is unstoppable (the trade: it is longer and fully telegraphed).
  const poise=CFG.enemy[e.type]&&CFG.enemy[e.type].poise;
  if(!poise && (e.state==='telegraph'||e.state==='strike')){
    e.state='chase'; e.timer=0; e.cd=0.55; e.cancelFlash=1;
    emit('cancel',{x:e.x,z:e.z});
  }
  e.hp-=dmg; e.hitFlash=1;
  emit('hit',{x:e.x,z:e.z,y:1.35,dmg:Math.round(dmg),crit,type:e.type});
  addHitStop(s,CFG.hitStopMs.hit);
  FXSHAKE(crit?0.34:0.20);
  if(e.hp<=0)killEnemy(s,e);
}

function damageBoss(s,b,dmg,crit){
  if(b.hp<=0)return;
  b.hp=Math.max(0,b.hp-dmg); b.hitFlash=1;   // NOT interrupted: no state change
  emit('hit',{x:b.x,z:b.z,y:2.4,dmg:Math.round(dmg),crit,type:'boss'});
  addHitStop(s,CFG.hitStopMs.hit);
  FXSHAKE(0.28);
  if(s.bossHits===0)s.bossFirstHitTick=s.tick;
  s.bossHits++;
  if(b.hp<=0){
    s.score+=CFG.boss.score;
    emit('bossDeath',{x:b.x,z:b.z});
    addHitStop(s,CFG.hitStopMs.bossKill);
    FXSHAKE(1.0);
    s.phase='clear'; s.chapterClearTimer=1.6;
  }
}

function doHeroHit(s,st){
  const h=s.hero;
  const fx=Math.sin(h.yaw), fz=Math.cos(h.yaw);
  const cosHalf=Math.cos(st.arc*0.5);
  for(let i=0;i<s.enemies.length;i++){
    const e=s.enemies[i]; if(e.dead)continue;
    const dx=e.x-h.x, dz=e.z-h.z, d=Math.sqrt(dx*dx+dz*dz);
    if(d>st.range+CFG.enemy[e.type].radius)continue;
    if(d>0.001 && (dx*fx+dz*fz)/d < cosHalf)continue;
    const crit=rnd(s)<st.crit;
    damageEnemy(s,e,st.dmg*(crit?1.7:1),crit);
  }
  const b=s.boss;
  if(b && b.hp>0){
    const dx=b.x-h.x, dz=b.z-h.z, d=Math.sqrt(dx*dx+dz*dz);
    if(d<=st.range+CFG.boss.radius && (d<0.001||(dx*fx+dz*fz)/d>=cosHalf)){
      const crit=rnd(s)<st.crit;
      damageBoss(s,b,st.dmg*(crit?1.7:1),crit);
    }
  }
}

function startRoll(s,inp,st){
  const h=s.hero;
  if(h.rollCd>0||h.state==='roll')return;
  let dx=inp.mx, dz=inp.my;
  const m=Math.sqrt(dx*dx+dz*dz);
  if(m<0.08){ dx=Math.sin(h.yaw); dz=Math.cos(h.yaw); }
  else { dx/=m; dz/=m; h.yaw=Math.atan2(dx,dz); }
  h.state='roll'; h.st=0; h.invuln=CFG.hero.rollDur;
  h.rollCd=st.rollCd;
  h.rollX=dx; h.rollZ=dz;
  h.atkCd=0; h.hitDone=true;      // roll CANCELS an attack
  emit('roll',{x:h.x,z:h.z});
}

function updateHero(s,inp,dt){
  const h=s.hero, st=heroStats(s);
  h.atkCd=Math.max(0,h.atkCd-dt);
  h.rollCd=Math.max(0,h.rollCd-dt);
  h.invuln=Math.max(0,h.invuln-dt);
  h.hitFlash=Math.max(0,(h.hitFlash||0)-dt*4);

  if(inp.roll)startRoll(s,inp,st);

  if(h.state==='roll'){
    const step=CFG.hero.rollDist/CFG.hero.rollDur;
    h.vx=h.rollX*step; h.vz=h.rollZ*step;
    h.st+=dt;
    if(h.st>=CFG.hero.rollDur){ h.state='idle'; h.st=0; h.vx=0; h.vz=0; h.invuln=0; }
  }else{
    // LINEAR tilt -> speed. Full run from 55% tilt. Never squared.
    const mag=Math.sqrt(inp.mx*inp.mx+inp.my*inp.my);
    const tilt=Math.min(1,mag);
    const target=st.speed*Math.min(1,tilt/CFG.hero.runTilt);
    let tx=0,tz=0;
    if(tilt>0.001){ tx=inp.mx/mag; tz=inp.my/mag; }
    const k=1-Math.exp(-(target>0?CFG.hero.accelTau:CFG.hero.stopTau)*dt);
    h.vx+=(tx*target-h.vx)*k;
    h.vz+=(tz*target-h.vz)*k;

    // swing: 0.625 s, hit at 40% (0.25 s), 0.5 s cooldown
    if(h.state==='attack'){
      h.st+=dt;
      if(!h.hitDone && h.st>=CFG.hero.hitAt){ h.hitDone=true; doHeroHit(s,st); }
      if(h.st>=CFG.hero.swingDur){ h.state='idle'; h.st=0; }
    }
    if(h.state==='hurt'){
      h.st+=dt; if(h.st>=0.24){h.state='idle';h.st=0;}
    }
    if(inp.attack && h.atkCd<=0 && h.state!=='hurt' && h.state!=='attack'){
      h.state='attack'; h.st=0; h.hitDone=false; h.atkCd=st.swingCd;
      h.attackId++;
      h.lungeX=Math.sin(h.yaw)*CFG.hero.lunge;
      h.lungeZ=Math.cos(h.yaw)*CFG.hero.lunge;
      emit('swing',{x:h.x,z:h.z});
    }
    if(tilt>0.08 && h.state!=='attack' && h.state!=='hurt')h.yaw=Math.atan2(tx,tz);
    if(h.state==='idle'||h.state==='run')h.state=(Math.sqrt(h.vx*h.vx+h.vz*h.vz)>0.5?'run':'idle');
  }
  // small forward lunge during the first 40% of the swing
  let lx=0,lz=0;
  if(h.state==='attack'&&h.st<CFG.hero.hitAt){ lx=h.lungeX*2.2; lz=h.lungeZ*2.2; }
  moveWithCollision(s,h,(h.vx+lx)*dt,(h.vz+lz)*dt,HERO_R);
}

function startTelegraph(e,kind){
  e.lockYaw=e.yaw;                    // FACING LOCKS at wind-up start
  const cfg=CFG.enemy[e.type];
  e.state='telegraph'; e.timer=(cfg&&cfg.tele)||CFG.enemy.telegraph; e.attackKind=kind;
}

function strikeEnemy(s,e){
  const C=CFG.enemy, cfg=C[e.type], h=s.hero;
  if(e.attackKind==='cast'){
    const fx=Math.sin(e.lockYaw), fz=Math.cos(e.lockYaw);
    if(cfg.splash){
      /* SORCERER: the bolt is aimed at where the hero STOOD at cast time and
         detonates there, so sidestepping beats it; standing near the landing
         point still hurts (splash), and a roll still eats it. */
      const dx=h.x-e.x, dz=h.z-e.z, m=Math.sqrt(dx*dx+dz*dz)||1;
      s.projectiles.push({id:s.nextId++,unit:e.type,x:e.x+fx*0.8,z:e.z+fz*0.8,
        vx:dx/m*cfg.projSpeed,vz:dz/m*cfg.projSpeed,tx:h.x,tz:h.z,lob:1,
        life:3.2,dmg:cfg.dmg,r:cfg.projR,splash:cfg.splash});
    }else{
      s.projectiles.push({id:s.nextId++,unit:e.type,x:e.x+fx*0.8,z:e.z+fz*0.8,
        vx:fx*cfg.projSpeed,vz:fz*cfg.projSpeed,
        life:2.6,dmg:cfg.dmg,r:cfg.projR});
    }
    emit('shot',{x:e.x,z:e.z,unit:e.type});
    return;
  }
  // melee: only lands within REACH and the frontal arc AT STRIKE MOMENT
  const reach=cfg.reach||C.strikeRange, arcDeg=cfg.arcDeg||C.strikeArcDeg;
  const dx=h.x-e.x, dz=h.z-e.z, d=Math.sqrt(dx*dx+dz*dz);
  let landed=false;
  if(d<=reach){
    const fx=Math.sin(e.lockYaw), fz=Math.cos(e.lockYaw);
    if(d<0.001 || (dx*fx+dz*fz)/d>=Math.cos(arcDeg*0.5*DEG))landed=true;
  }
  if(landed)hurtHero(s,cfg.dmg,e.type);
  emit('enemyStrike',{x:e.x,z:e.z,landed,type:e.type});
}

function updateEnemies(s,dt){
  const C=CFG.enemy, h=s.hero;
  for(let i=0;i<s.enemies.length;i++){
    const e=s.enemies[i]; if(e.dead)continue;
    const cfg=C[e.type];
    e.hitFlash=Math.max(0,(e.hitFlash||0)-dt*4);
    e.cancelFlash=Math.max(0,(e.cancelFlash||0)-dt*3);
    e.cd=Math.max(0,(e.cd||0)-dt);
    const dx=h.x-e.x, dz=h.z-e.z, d=Math.sqrt(dx*dx+dz*dz)||0.001;
    let vx=0,vz=0;
    if(e.state==='chase'){
      e.yaw=Math.atan2(dx,dz);
      if(cfg.minRange){                                   // archer / sorcerer / ranger
        if(d<cfg.minRange){ vx=-dx/d*cfg.speed; vz=-dz/d*cfg.speed; }
        else if(d>cfg.maxRange){ vx=dx/d*cfg.speed*0.85; vz=dz/d*cfg.speed*0.85; }
        else { vx=-dz/d*cfg.speed*0.36; vz=dx/d*cfg.speed*0.36; }
        if(e.cd<=0 && d<=cfg.maxRange+1.5)startTelegraph(e,'cast');
      }else{                                              // melee, per-type reach
        const reach=cfg.reach||C.strikeRange;
        const stand=Math.max(1.45,reach-0.35);
        if(d>stand){ vx=dx/d*cfg.speed; vz=dz/d*cfg.speed; }
        if(d<=reach-0.1 && e.cd<=0)startTelegraph(e,'melee');
      }
    }else if(e.state==='telegraph'){
      e.timer-=dt;                                  // yaw stays locked
      if(e.timer<=0){ e.state='strike'; e.timer=0; }
    }else if(e.state==='strike'){
      strikeEnemy(s,e);
      e.state='recovery'; e.timer=cfg.recovery||C.recovery;
    }else if(e.state==='recovery'){
      e.timer-=dt;
      if(e.timer<=0){ e.state='chase'; e.cd=cfg.minRange?cfg.volley*0.45:0.35; }
    }
    e.vx=vx; e.vz=vz;
    moveWithCollision(s,e,vx*dt,vz*dt,cfg.radius);
  }
  // compact dead bodies (views are driven by cosmetic events)
  if(s.enemies.some(e=>e.dead))s.enemies=s.enemies.filter(e=>!e.dead);
}

function updateProjectiles(s,dt){
  const h=s.hero, out=[];
  for(let i=0;i<s.projectiles.length;i++){
    const p=s.projectiles[i];
    p.x+=p.vx*dt; p.z+=p.vz*dt; p.life-=dt;
    const dx=h.x-p.x, dz=h.z-p.z, rr=p.r+HERO_R;
    let land=(dx*dx+dz*dz<=rr*rr);
    if(!land && p.lob){
      const gx=p.x-p.tx, gz=p.z-p.tz;
      const step=Math.sqrt(p.vx*p.vx+p.vz*p.vz)*dt;
      if(gx*gx+gz*gz<=step*step || p.life<=0){ p.x=p.tx; p.z=p.tz; land=true; }
    }
    if(land){
      if(p.splash){
        emit('projBlast',{x:p.x,z:p.z,r:p.splash});
        const hd=Math.sqrt((h.x-p.x)*(h.x-p.x)+(h.z-p.z)*(h.z-p.z));
        if(hd<=p.splash){
          if(h.invuln<=0){ hurtHero(s,p.dmg,p.unit); emit('projHit',{x:h.x,z:h.z}); }
          else emit('projDodged',{x:h.x,z:h.z});
        }
      }else{
        if(h.invuln<=0){ hurtHero(s,p.dmg,p.unit); emit('projHit',{x:p.x,z:p.z}); }
        else emit('projDodged',{x:p.x,z:p.z});
      }
      continue;
    }
    if(p.life>0 && p.x*p.x+p.z*p.z<(ARENA_R+3)*(ARENA_R+3))out.push(p);
  }
  s.projectiles=out;
}

function updateBoss(s,dt){
  const b=s.boss; if(!b||b.hp<=0)return;
  const B=CFG.boss, h=s.hero;
  b.hitFlash=Math.max(0,(b.hitFlash||0)-dt*4);
  b.cd=Math.max(0,b.cd-dt); b.slamCd=Math.max(0,b.slamCd-dt);
  const dx=h.x-b.x, dz=h.z-b.z, d=Math.sqrt(dx*dx+dz*dz)||0.001;
  // A long chase with no hit ramps the pursuit speed so a fleeing hero is
  // caught inside ~30 s even when a telegraphed charge is sidestepped.
  b.pursuit=(b.pursuit||0)+dt;
  const boost=b.pursuit>12?Math.min(2.4,(b.pursuit-12)*0.28):0;
  let mvx=0,mvz=0;
  const stopDist=B.radius+HERO_R+0.30;
  if(b.state==='approach'){
    b.yaw=Math.atan2(dx,dz);
    if(d>stopDist){ const sp=B.speed+boost; mvx=dx/d*sp; mvz=dz/d*sp; }
    if(d>B.chargeRange && b.cd<=0){
      b.lockYaw=b.yaw; b.state='chargeTele'; b.timer=B.chargeTele;
      mvx=0;mvz=0;
      emit('bossTelegraph',{x:b.x,z:b.z,kind:'CHARGE'});
    }else if(d<=B.slamRange && b.slamCd<=0){
      b.lockYaw=b.yaw; b.state='slamTele'; b.timer=B.slamTele;
      mvx=0;mvz=0;                     // freeze AT the wind-up start so the slam lands
      emit('bossTelegraph',{x:b.x,z:b.z,kind:'SLAM'});
    }
  }else if(b.state==='chargeTele'){
    b.timer-=dt;
    if(b.timer<=0){
      // charge long enough to actually cover the gap (was fixed 0.55 s = 8.8 m)
      b.state='charge'; b.timer=Math.min(1.5,(d+1.0)/B.chargeSpeed);
      b.chargeVX=Math.sin(b.lockYaw); b.chargeVZ=Math.cos(b.lockYaw);
      emit('bossCharge',{x:b.x,z:b.z});
    }
  }else if(b.state==='charge'){
    // Mild homing: still telegraphed and dodgeable, but it catches a runner.
    const tx=h.x-b.x,tz=h.z-b.z,td=Math.sqrt(tx*tx+tz*tz)||1;
    const wx=tx/td,wz=tz/td,k=Math.min(1,dt*1.9);
    let nx=b.chargeVX+(wx-b.chargeVX)*k, nz=b.chargeVZ+(wz-b.chargeVZ)*k;
    const nm=Math.sqrt(nx*nx+nz*nz)||1;
    b.chargeVX=nx/nm; b.chargeVZ=nz/nm;
    mvx=b.chargeVX*B.chargeSpeed; mvz=b.chargeVZ*B.chargeSpeed;
    b.timer-=dt;
    const dd=Math.sqrt((h.x-b.x)*(h.x-b.x)+(h.z-b.z)*(h.z-b.z));
    if(dd<B.radius+HERO_R+0.55 && !b.chargeHit){
      b.chargeHit=true; b.pursuit=0;
      if(hurtHero(s,B.chargeDmg,'boss'))emit('bossSlam',{x:h.x,z:h.z});
    }
    if(b.timer<=0){ b.state='recover'; b.timer=0.75; b.cd=B.chargeCd; b.slamCd=0.7; b.chargeHit=false; }
  }else if(b.state==='slamTele'){
    b.timer-=dt;
    // A lunging wind-up: the boss keeps closing (but never crosses) the hero,
    // so the slam actually lands on a moving target instead of expiring in air.
    if(d>stopDist){ const sp=B.speed+boost; mvx=dx/d*sp; mvz=dz/d*sp; }
    if(b.timer<=0){
      b.state='slam'; b.timer=0.35;
      const ddx=h.x-b.x, ddz=h.z-b.z, dd=Math.sqrt(ddx*ddx+ddz*ddz)||0.001;
      // Point-blank always counts as in-arc: a centred slam cannot "miss"
      // just because the boss stepped past the hero on the previous tick.
      const inArc=dd<1.2 || (ddx*Math.sin(b.lockYaw)+ddz*Math.cos(b.lockYaw))/dd>=Math.cos(70*DEG);
      if(dd<=B.slamRange && inArc){
        b.pursuit=0;
        if(hurtHero(s,B.slamDmg,'boss'))emit('bossSlam',{x:h.x,z:h.z});
      }
      emit('bossSlamFx',{x:b.x,z:b.z});
    }
  }else if(b.state==='slam'){
    b.timer-=dt; if(b.timer<=0){ b.state='recover'; b.timer=0.55; b.slamCd=1.1; }
  }else if(b.state==='recover'){
    b.timer-=dt; if(b.timer<=0)b.state='approach';
  }
  b.vx=mvx; b.vz=mvz;
  moveWithCollision(s,b,mvx*dt,mvz*dt,B.radius);
  if(s.bossFirstHitTick<0 && d<B.radius+HERO_R+0.8)s.bossFirstHitTick=s.tick;
}

function pickChoices(s){
  const pool=UPGRADES.slice(), out=[];
  for(let i=0;i<3 && pool.length;i++)out.push(pool.splice(rndI(s,pool.length),1)[0].id);
  return out;
}
function applyUpgrade(s,idx){
  if(s.phase!=='levelup')return;
  const id=s.choices[idx]; if(!id)return;
  const u=UPGRADES.find(x=>x.id===id); if(u)u.apply(s);
  emit('upgrade',{id,name:u?u.name:''});
  s.choices=[]; s.phase=s.resume||'play';
}
function collectPickups(s){
  const h=s.hero, st=heroStats(s), pr=st.pickup, pr2=pr*pr;
  const gems=[];
  for(let i=0;i<s.gems.length;i++){
    const g=s.gems[i];
    if(dist2(h.x,h.z,g.x,g.z)<=pr2){
      s.xp+=g.v; s.score+=10; emit('gem',{x:g.x,z:g.z});
      if(s.xp>=s.xpNeed){
        s.xp-=s.xpNeed; s.level++; s.xpNeed=8+(s.level-1)*6;
        s.resume=s.phase; s.phase='levelup'; s.choices=pickChoices(s);
        emit('levelup',{level:s.level});
      }
    }else gems.push(g);
  }
  s.gems=gems;
  const heals=[];
  for(let i=0;i<s.heals.length;i++){
    const o=s.heals[i];
    if(dist2(h.x,h.z,o.x,o.z)<=pr2){
      h.hp=Math.min(h.maxHp,h.hp+CFG.heal.amount);
      emit('heal',{x:o.x,z:o.z,amount:CFG.heal.amount});
    }else heals.push(o);
  }
  s.heals=heals;
}

function aliveByType(s){
  const m={};
  for(let i=0;i<s.enemies.length;i++){ const e=s.enemies[i]; if(!e.dead)m[e.type]=(m[e.type]||0)+1; }
  return m;
}
function spawnEnemy(s){
  const alive=s.enemies.filter(e=>!e.dead);
  if(alive.length>=CFG.caps.enemies)return;          // ONE global 8-alive cap
  const by=aliveByType(s);
  const elapsed=CFG.waveSeconds-s.waveLeft;
  const W=CFG.wave, CAP=CFG.caps;
  const capOf=t=>{
    if(t==='ranger')return CAP.rangers;
    if(t==='archer')return CAP.archers;
    if(t==='sorcerer')return CAP.sorcerers;
    if(t==='knight')return CAP.knights;
    return W[t]?W[t].cap:99;
  };
  let type=null;
  /* ---- 1. scheduled elites: one at a time, on their own clock ---- */
  if(elapsed>=W.knight.from && !(by.knight||0) && elapsed>=(s.knightNextAt||0)){
    type='knight'; s.knightNextAt=elapsed+W.knight.every;
  }else if(elapsed>=W.sorcerer.from && !(by.sorcerer||0) && elapsed>=(s.sorcererNextAt||0)){
    type='sorcerer'; s.sorcererNextAt=elapsed+W.sorcerer.every;
  }
  /* ---- 2. weighted fill: only unlocked types, never over their cap ---- */
  if(!type){
    const pool=[];
    const addT=(t,w)=>{ if((by[t]||0)>=capOf(t))return; pool.push({t,w}); };
    addT('soldier', W.soldier.w);
    addT('brute',   26);
    addT('runner',  22);
    addT('ranger',  18+elapsed*0.05);
    if(elapsed>=W.archer.from)addT('archer', W.archer.w);
    if(!pool.length)return;                        // every kind at its cap
    let total=0; for(const p of pool)total+=p.w;
    let roll=rnd(s)*total;
    type=pool[pool.length-1].t;
    for(const p of pool){ roll-=p.w; if(roll<0){ type=p.t; break; } }
    /* The soldier opens the fight: the very first spawn is always one. */
    if(s.kills===0 && elapsed<3 && !(by.soldier||0))type='soldier';
  }
  const a=rnd(s)*TAU, rr=rndR(s,17,29);
  let x=s.hero.x+Math.sin(a)*rr, z=s.hero.z+Math.cos(a)*rr;
  const d=Math.sqrt(x*x+z*z);
  if(d>ARENA_R-2){ x*=(ARENA_R-2)/d; z*=(ARENA_R-2)/d; }
  makeEnemy(s,type,x,z,rndR(s,0.2,1.1));
  emit('spawn',{x,z,type});
}
function makeEnemy(s,type,x,z,cd){
  const C=CFG.enemy[type];
  const e={id:s.nextId++,type,x,z,yaw:Math.atan2(s.hero.x-x,s.hero.z-z),
    lockYaw:0,hp:C.hp,maxHp:C.hp,state:'chase',timer:0,cd:cd||0.5,
    slamCd:0,attackKind:'melee',vx:0,vz:0,hitFlash:0,cancelFlash:0,dead:false};
  s.enemies.push(e);return e;
}
function spawnBoss(s){
  const a0=rnd(s)*TAU, rr=rndR(s,CFG.boss.spawnMin,CFG.boss.spawnMax);
  /* Keep the spawn inside the arena WITHOUT shortening the required 26-30 m
     gap. Sweep directions until one fits; an inward direction always exists
     for a 40 m arena and a hero anywhere inside it. */
  let x=0,z=0,ok=false;
  for(let t=0;t<24;t++){
    const a=a0+t*(TAU/24);
    x=s.hero.x+Math.sin(a)*rr; z=s.hero.z+Math.cos(a)*rr;
    if(Math.sqrt(x*x+z*z)<=ARENA_R-3){ ok=true; break; }
  }
  if(!ok){
    const hr=Math.sqrt(s.hero.x*s.hero.x+s.hero.z*s.hero.z)||1;
    x=s.hero.x-s.hero.x/hr*rr; z=s.hero.z-s.hero.z/hr*rr;
  }
  s.enemies=[]; s.projectiles=[];
  s.boss={id:s.nextId++,x,z,yaw:Math.atan2(s.hero.x-x,s.hero.z-z),lockYaw:0,
    hp:CFG.boss.hp,maxHp:CFG.boss.hp,state:'approach',timer:0,cd:2.2,slamCd:0,
    chargeVX:0,chargeVZ:0,chargeHit:false,pursuit:0,hitFlash:0,vx:0,vz:0};
  s.bossSpawned=true; s.bossSpawnTick=s.tick; s.phase='boss';
  emit('bossSpawn',{x,z,dist:Math.sqrt((x-s.hero.x)*(x-s.hero.x)+(z-s.hero.z)*(z-s.hero.z))});
}

function simStep(raw){
  const inp=normInput(raw);
  const s=SIM;
  if(s.hitStop>0){ s.hitStop--; return; }         // frozen world, deterministic step consumed
  if(s.phase==='levelup'){ if(inp.upgrade>=0)applyUpgrade(s,inp.upgrade); return; }
  if(s.phase==='clear'){
    s.chapterClearTimer-=FIXED;
    if(s.chapterClearTimer<=0){
      if(s.chapter<3){
        s.chapter++; s.map=buildMapData(s.chapter);
        s.waveLeft=CFG.waveSeconds; s.bossSpawned=false; s.boss=null;
        s.enemies=[]; s.projectiles=[]; s.gems=[]; s.heals=[];
        s.hero.x=0; s.hero.z=0; s.hero.vx=0; s.hero.vz=0;
        s.hero.hp=Math.min(s.hero.maxHp,s.hero.hp+30);
        s.hero.state='idle'; s.hero.st=0; s.spawnTimer=1.0;
        s.phase='play'; emit('chapter',{chapter:s.chapter});
      }else{ s.phase='victory'; emit('victory',{}); }
    }
    return;
  }
  if(s.phase!=='play'&&s.phase!=='boss')return;
  s.tick++;
  const st=heroStats(s);
  updateHero(s,inp,FIXED);

  if(s.phase==='play'){
    s.waveLeft-=FIXED;
    s.spawnTimer-=FIXED;
    if(s.spawnTimer<=0){
      const elapsed=CFG.waveSeconds-s.waveLeft;
      s.spawnTimer=Math.max(0.42,2.35-elapsed*0.0075);
      spawnEnemy(s);
    }
    if(s.waveLeft<=0){ s.waveLeft=0; spawnBoss(s); }
  }
  updateEnemies(s,FIXED);
  updateProjectiles(s,FIXED);
  if(s.boss)updateBoss(s,FIXED);
  collectPickups(s);
}

/* ---- canonical digest over SIM state only (cosmetics excluded) ---- */
function simDigest(s){
  let h1=0x811c9dc5, h2=0x9e3779b9;
  const put=v=>{ const str=String(v); for(let i=0;i<str.length;i++){
      const c=str.charCodeAt(i);
      h1=Math.imul(h1^c,16777619)>>>0;
      h2=Math.imul(h2^c,2246822519)>>>0;
    } h1=Math.imul(h1^59,16777619)>>>0; h2=Math.imul(h2^59,2246822519)>>>0; };
  const q=v=>(Math.round(v*1000)/1000).toFixed(3);
  put(s.seed);put(s.rng);put(s.rngCalls);put(s.tick);put(s.phase);put(s.chapter);
  put(s.waveLeft.toFixed(4));put(s.hitStop);put(s.score);put(s.kills);put(s.level);
  put(s.xp);put(s.xpNeed);put(s.nextId);put(s.spawnTimer.toFixed(4));
  const h=s.hero;
  for(const v of [h.x,h.z,h.yaw,h.vx,h.vz,h.hp,h.maxHp,h.st,h.atkCd,h.rollCd,h.invuln,h.state==='roll'?1:0])put(q(v));
  put(h.state);put(h.hitDone?1:0);put(h.attackId);
  put('E'+s.enemies.length);
  for(const e of s.enemies)for(const v of [e.id,e.x,e.z,e.yaw,e.lockYaw,e.hp,e.timer,e.cd,e.state==='telegraph'?1:0,e.vx,e.vz])put(q(v));
  put('P'+s.projectiles.length);
  for(const p of s.projectiles)for(const v of [p.id,p.x,p.z,p.vx,p.vz,p.life])put(q(v));
  put('G'+s.gems.length);for(const g of s.gems)for(const v of [g.id,g.x,g.z])put(q(v));
  put('H'+s.heals.length);for(const o of s.heals)for(const v of [o.id,o.x,o.z])put(q(v));
  if(s.boss){const b=s.boss;put('B1');for(const v of [b.x,b.z,b.yaw,b.lockYaw,b.hp,b.timer,b.cd,b.slamCd,b.pursuit||0,b.state==='charge'?1:0])put(q(v));put(b.state);}
  else put('B0');
  for(const k of Object.keys(s.up).sort())put(k+':'+s.up[k]);
  return (h1>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0');
}

/* ---- headless deterministic runner: same simStep, no rendering ---- */
function runHeadless(seed,steps,inputFn,startPhase){
  SIM=newSim(seed>>>0);
  SIM.phase=startPhase||'play';
  EV.length=0;
  for(let i=0;i<steps;i++){
    EV.length=0;                          // cosmetic buffer is drained, never hashed
    simStep(normInput(inputFn(i,SIM)));
  }
  return simDigest(SIM);
}
