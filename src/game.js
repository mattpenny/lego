
/* ---- content registry (pure data — safe for the deterministic sim) ----
   Imports must sit OUTSIDE the IIFE: ES module imports are only legal at
   module top level. The IIFE below closes over these bindings. The single-
   file phone build therefore needs a bundle/inline step (npm run single:build).

   NOTHING below this line hard-codes a hero, figure, enemy, boss, item,
   prop, map or upgrade number. Every one of them is traced back to its own
   descriptor file under src/content/. See CONTENT-GUIDE.md section 6. */
import {
  RULES, REGISTRY, SIM_CONTENT, contentSummary, assertRegistry,
  HEROES, HERO_COSTS, HERO_SLASH_TIPS, heroName, safeHero,
  FIGURES, FIGURE_INK, TINTS, FIGURE_SCALES,
  ENEMY_CFG, ENEMY_CAPS, WAVE_RULES, FILL_POOL, SCHEDULED_ELITES, OPENER_KIND,
  ENEMIES,
  BOSS_CFG, BOSS_PHASE2, BOSS_NAMES,
  ITEM_DROPS, HEAL_CFG, POTION_CFG, ELITE_KINDS, GEM_SCORE,
  PROPS, PLACE_RADII, BLOCK_R, BLOCK_FALLBACK_R,
  WALL_KIND, WALL_HALF_LENGTH, WALL_RADIUS, POND_PAD, FENCE_RADIUS, TORCH_RADIUS,
  PALETTES, MAP_CONFIGS, EVENT_PACKS,
  UPGRADE_LIST,
} from './content/index.js';

/* Fail loudly at boot on an invalid content descriptor. A missing figure,
   a dangling cross-reference or a missing spawn entry would otherwise
   render an invisible character or silently never appear. */
assertRegistry(REGISTRY);

(function(){ 'use strict';
/* =====================================================================
   AETHERBLADE — 3D ARENA SURVIVOR
   Single self-contained HTML. All art/audio generated in code.
   CREDITS / LICENSES (no files are fetched, ever):
     * three.js r170 — MIT, Copyright 2010-2024 three.js authors. Vendored
       inline from the user's own prototype backup (D:/3d/spike3d.prototype.bak).
     * Mesh2Motion-style humanoid rig + animation clips — our OWN procedural
       joint hierarchy and keyframe clips authored in code, released CC0 1.0.
       No third-party model, texture, font or audio asset is embedded.
     * Everything else (terrain, props, characters, VFX, music) is procedural.
   ===================================================================== */

const T = { WebGLRenderer, Scene, Color, Fog, PerspectiveCamera, HemisphereLight,
  DirectionalLight, AmbientLight, Mesh, MeshLambertMaterial, MeshBasicMaterial,
  InstancedMesh, SkinnedMesh, Skeleton, Bone, Group, Object3D, Vector2, Vector3,
  Matrix4, Quaternion, Euler, BoxGeometry, CylinderGeometry, SphereGeometry,
  ConeGeometry, CircleGeometry, PlaneGeometry, DodecahedronGeometry, RingGeometry,
  BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, BufferAttribute,
  CanvasTexture, RepeatWrapping, SRGBColorSpace, AdditiveBlending, DoubleSide,
  BackSide, FrontSide, Points, PointsMaterial, MathUtils, ACESFilmicToneMapping };

const FIXED = 1/60;
const TAU = Math.PI*2;
const DEG = Math.PI/180;
const ARENA_R = 40;          // movement boundary; rocky hills begin right here
const HERO_R = 0.42;

/* ---- exact combat spec numbers, ALL DERIVED FROM THE CONTENT REGISTRY.
   RULES holds the cross-cutting global tuning (src/content/rules.js);
   every per-kind / per-item / per-map number comes from its own file.
   Do not "improve" these: changing one moves simDigest() and desyncs co-op. */
const CFG = Object.assign({}, RULES, {
  fixed: FIXED,
  enemy: ENEMY_CFG,            // melee defaults + one entry per enemy descriptor
  caps: ENEMY_CAPS,            // global 8-alive cap + per-kind caps
  wave: WAVE_RULES,            // scheduled elite / fill-pool gating
  heal: HEAL_CFG,              // src/content/items/heal.js
  magic: Object.assign({}, RULES.magic, {
    potionChance: POTION_CFG.chance,
    potionGain: POTION_CFG.gain,
  }),
  events: { at: RULES.eventAt, pack: EVENT_PACKS },
  boss: BOSS_CFG,              // src/content/enemies/bosses/shared.js
  boss2: BOSS_PHASE2,
  meta: Object.assign({}, RULES.meta, { heroCosts: HERO_COSTS }),
});

/* ---- deterministic integer RNG (xorshift32). Sim owns ONE state. ---- */
function nextU32(x){
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return x >>> 0;
}
function rnd(s){ s.rng = nextU32(s.rng); s.rngCalls++; return s.rng / 4294967296; }
function rndR(s,a,b){ return a + (b-a)*rnd(s); }
function rndI(s,n){ return Math.floor(rnd(s)*n); }
/* Cosmetic-only RNG. Never touches sim.rng and never writes sim state. */
function mkRng(seed){ let x=(seed>>>0)||1; return function(){ x=nextU32(x); return x/4294967296; }; }

const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const dist2=(ax,az,bx,bz)=>(ax-bx)*(ax-bx)+(az-bz)*(az-bz);
function angDiff(a,b){ let d=(a-b)%TAU; if(d>Math.PI)d-=TAU; if(d<-Math.PI)d+=TAU; return d; }

/* =====================================================================
   MAP DATA — pure deterministic function of chapter index. It lives in
   SIM state because colliders affect movement; render only READS it.
   PALETTES, MAP_CONFIGS and every collider radius come from
   src/content/maps/<chapter>.js and src/content/props/<id>.js.
   ===================================================================== */
function buildMapData(chapter){
  const M = MAP_CONFIGS[chapter-1] || MAP_CONFIGS[0];
  const R = mkRng(M.seed);
  const d = { chapter, colliders:[], trunk:[], canopy:[], rock:[], pillar:[], post:[],
              fence:[], stone:[], hill:[], block:[], torch:[], lava:[], reeds:[],
              pond:{x:M.pond.x, z:M.pond.z, r:M.pond.r},
              landmark:{x:M.landmark.x, z:M.landmark.z} };
  const colliders = d.colliders;
  function tryPlace(count, minR, maxR, minGap, bodyR, cb){
    let placed=0, guard=0;
    while(placed<count && guard++<count*30){
      const a=R()*TAU, rr=minR+(maxR-minR)*Math.sqrt(R());
      const x=Math.cos(a)*rr, z=Math.sin(a)*rr;
      if(Math.abs(x-d.pond.x)<d.pond.r+2 && Math.abs(z-d.pond.z)<d.pond.r+2) continue;
      let ok=true;
      for(let i=0;i<colliders.length;i++){
        const c=colliders[i];
        if(dist2(x,z,c.x,c.z) < (minGap+c.r)*(minGap+c.r)){ok=false;break;}
      }
      if(!ok)continue;
      colliders.push({x,z,r:bodyR});
      cb(x,z,placed++);
    }
  }
  // Trunk-sized colliders: the hero stops at the bark instead of an invisible
  // wall a metre out, and can still walk under the canopy.
  tryPlace(M.trees, 7, 37, 2.6, PLACE_RADII.trunk, (x,z,i)=>{
    const s=0.8+R()*0.7;
    d.trunk.push({x,z,s,rot:R()*TAU});
    d.canopy.push({x,z,s:s*M.canopyScale,rot:R()*TAU, kind:M.canopyKind});
  });
  tryPlace(M.rocks, 6, 38, 1.9, PLACE_RADII.rock, (x,z)=>{
    d.rock.push({x,z,s:0.55+R()*1.0,rot:R()*TAU});
  });
  tryPlace(M.pillars, 9, 36, 2.2, PLACE_RADII.pillar, (x,z)=>{
    d.pillar.push({x,z,s:0.8+R()*0.7,rot:R()*TAU});
  });
  if(M.stones){
    tryPlace(M.stones, 6, 36, 1.2, PLACE_RADII.stone, (x,z)=>{
      d.stone.push({x,z,s:0.8+R()*0.5,rot:(R()-0.5)*0.5});
    });
  }
  // fence runs: posts + rails, and a matching SEGMENT collider for the whole run
  for(let f=0;f<M.fenceRuns;f++){
    const a=R()*TAU, rr=12+R()*22, cx=Math.cos(a)*rr, cz=Math.sin(a)*rr;
    const dir=R()*TAU, len=6+R()*7, n=Math.max(3,Math.floor(len/1.4));
    for(let i=0;i<n;i++){
      const t=(i/(n-1)-0.5)*len;
      d.post.push({x:cx+Math.cos(dir)*t, z:cz+Math.sin(dir)*t, s:0.9+R()*0.35, rot:dir});
    }
    const hx=Math.cos(dir)*len*0.5, hz=Math.sin(dir)*len*0.5;
    d.fence.push({ax:cx-hx,az:cz-hz,bx:cx+hx,bz:cz+hz});
  }
  // visible terrain edge: a continuous ring of rocky hills / mountains
  for(let i=0;i<M.hills;i++){
    const a=i/M.hills*TAU + (R()-0.5)*0.04;
    const rr=45+R()*6, s=6+R()*8;
    d.hill.push({x:Math.cos(a)*rr, z:Math.sin(a)*rr, s, rot:R()*TAU});
  }
  // landmark + dressing blocks (style comes from the chapter map descriptor)
  const L=d.landmark;
  if(M.landmarkStyle==='windmill'){
    d.block.push({x:L.x,z:L.z,s:1,rot:0,kind:0});       // windmill tower
    for(let i=0;i<4;i++)d.block.push({x:L.x+(i-1.5)*2.4,z:L.z+7,s:0.45,rot:0,kind:1});
  }else if(M.landmarkStyle==='crypt'){
    d.block.push({x:L.x,z:L.z,s:1,rot:0,kind:2});       // crypt
    for(let i=0;i<4;i++)d.block.push({x:L.x+(i%2?2.6:-2.6),z:L.z+(i<2?3.4:-3.4),s:0.8,rot:0,kind:3});
  }else{
    for(let i=0;i<6;i++)d.block.push({x:L.x+Math.cos(i/6*TAU)*6,z:L.z+Math.sin(i/6*TAU)*6,s:1,rot:i/6*TAU,kind:4});
    d.block.push({x:L.x,z:L.z,s:1,rot:0,kind:5});       // keep
  }
  // torches / lava pools / pond reeds
  for(let i=0;i<M.torches;i++){
    const a=R()*TAU, rr=8+R()*28;
    d.torch.push({x:Math.cos(a)*rr,z:Math.sin(a)*rr,s:0.8+R()*0.5,rot:R()*TAU});
  }
  for(let i=0;i<M.lavaPools;i++){
    const a=R()*TAU, rr=8+R()*30;
    d.lava.push({x:Math.cos(a)*rr,z:Math.sin(a)*rr,s:1.2+R()*2.1,rot:R()*TAU});
  }
  for(let i=0;i<M.reeds;i++){
    const a=R()*TAU, rr=d.pond.r+0.4+R()*1.1;
    d.reeds.push({x:d.pond.x+Math.cos(a)*rr,z:d.pond.z+Math.sin(a)*rr,s:0.6+R()*0.7,rot:R()*TAU});
  }

  /* ---- SOLID PROPS ----------------------------------------------------
     Everything that LOOKS solid must stop the hero (and the enemies).
     Trees / rocks / pillars got their colliders from tryPlace(); the pond,
     buildings, gravestones, fence runs and torches are added here. Radii
     follow the visible footprint so there is no invisible wall.
     A collider with seg:1 is a capsule from (ax,az) to (bx,bz). */
  colliders.push({x:d.pond.x,z:d.pond.z,r:d.pond.r+POND_PAD});      // water is solid
  for(let i=0;i<d.block.length;i++){
    const b=d.block[i];
    if(b.kind===WALL_KIND){             // castle wall = long thin box, not a disc
      const hx=Math.cos(b.rot)*WALL_HALF_LENGTH, hz=-Math.sin(b.rot)*WALL_HALF_LENGTH;
      colliders.push({seg:1,ax:b.x-hx,az:b.z-hz,bx:b.x+hx,bz:b.z+hz,r:WALL_RADIUS});
    }else{
      colliders.push({x:b.x,z:b.z,r:BLOCK_R[b.kind]||BLOCK_FALLBACK_R});
    }
  }
  for(let i=0;i<d.fence.length;i++){
    const f=d.fence[i];
    colliders.push({seg:1,ax:f.ax,az:f.az,bx:f.bx,bz:f.bz,r:FENCE_RADIUS});
  }
  // (gravestones already got a collider from tryPlace, so they are not repeated here)
  for(let i=0;i<d.torch.length;i++){
    const t=d.torch[i];
    colliders.push({x:t.x,z:t.z,r:TORCH_RADIUS});
  }
  return d;
}

/* ---- level-up cards: one descriptor file per card (src/content/upgrades/) ----
   ORDER IS LOAD-BEARING. pickChoices() rolls rndI(s, UPGRADES.length) over
   this array; reordering the descriptors changes which cards appear and
   therefore moves simDigest() and desyncs co-op. */
const UPGRADES = UPGRADE_LIST;
function heroStats(s,h){
  const u=s.up, C=CFG.hero;
  const md=(h&&h.mods)||s.mods||{hp:0,dmg:0,spd:0};
  return {
    speed:C.runSpeed*Math.pow(1.08,u.boots)+md.spd,
    dmg:C.dmg*Math.pow(1.20,u.edge)+md.dmg,
    swingCd:C.swingCd*Math.pow(0.88,u.tempo),
    range:C.range+0.5*u.reach,
    arc:(C.arcDeg+10*u.reach)*DEG,
    rollCd:C.rollCd*Math.pow(0.80,u.reflex),
    pickup:1.65+0.9*u.magnet,
    crit:0.05+0.15*u.crit
  };
}

/* ---- fresh deterministic simulation ---- */
function mkHero(i,two){
  return { x:two?(i===1?1.4:-1.4):0, z:0, yaw:0, vx:0, vz:0,
           hp:CFG.hero.hp, maxHp:CFG.hero.hp,
           state:'idle', st:0, atkCd:0, rollCd:0, invuln:0,
           hitDone:false, attackId:0, rollX:0, rollZ:0,
           lungeX:0, lungeZ:0, lastHitTick:-999, hitFlash:0,
           downed:false, mods:{hp:0,dmg:0,spd:0} };
}
/* spawn anchor: first living hero (heroes[0] in solo — identical behaviour) */
function anchorHero(s){
  for(const h of s.heroes)if(!h.downed)return h;
  return s.heroes[0];
}
/* nearest living hero to (x,z); deterministic index-order tie-break */
function nearestHero(s,x,z){
  let best=null,bd=Infinity;
  for(const h of s.heroes){
    if(h.downed)continue;
    const d=(h.x-x)*(h.x-x)+(h.z-z)*(h.z-z);
    if(d<bd){ bd=d; best=h; }
  }
  return best||s.heroes[0];
}
function newSim(seed,players){
  const s={
    seed:seed>>>0, rng:(seed>>>0)||0x9e3779b9, rngCalls:0, tick:0,
    phase:'title', chapter:1, map:null,
    waveLeft:CFG.waveSeconds, bossSpawned:false, bossHits:0,
    heroes:[], players:1, resume:null,
    enemies:[], projectiles:[], gems:[], heals:[], boss:null,
    nextId:1, score:0, kills:0, level:1, xp:0, xpNeed:8,
    up:{edge:0,tempo:0,reach:0,boots:0,reflex:0,magnet:0,crit:0,siphon:0},
    choices:[], hitStop:0, spawnTimer:1.2, chapterClearTimer:0,
    events:[], bossFirstHitTick:-1, bossSpawnTick:-1,
    knightNextAt:0, sorcererNextAt:0,
    magic:0, potions:[], eventDone:false, eventQueue:[],
    mods:{hp:0,dmg:0,spd:0}
  };
  s.players=(players===2)?2:1;
  for(let i=0;i<s.players;i++)s.heroes.push(mkHero(i,s.players===2));
  Object.defineProperty(s,'hero',{enumerable:true,
    get(){ return this.heroes[0]; }, set(v){ this.heroes[0]=v; }});
  s.map=buildMapData(1);
  return s;
}

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
           attack:!!i.attack, roll:!!i.roll, magic:!!i.magic,
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

function hurtHero(s,h,dmg,kind){
  if(!h||h.downed)return false;
  if(h.invuln>0 || s.phase==='dead' || s.phase==='clear')return false;
  h.hp=Math.max(0,h.hp-dmg);
  h.state='hurt'; h.st=0; h.invuln=0.45;
  emit('hurt',{x:h.x,z:h.z,dmg,kind});
  emit('shake',{v:0.55});
  if(kind==='boss')addHitStop(s,CFG.hitStopMs.bossSlam);
  if(h.hp<=0){
    const other=s.heroes.find(o=>o!==h&&!o.downed);
    if(s.players>1&&other){ h.downed=true; h.state='down'; h.st=0; h.vx=0; h.vz=0;
      emit('down',{x:h.x,z:h.z}); }
    else { s.phase='dead'; emit('death',{x:h.x,z:h.z}); }
  }
  return true;
}

function killEnemy(s,e){
  if(e.dead)return;
  e.dead=true;
  s.kills++; s.score+=CFG.enemy[e.type].score;
  s.magic=Math.min(CFG.magic.cost,s.magic+CFG.magic.perKill);
  /* Drop table: src/content/items/{gem,heal,potion}.js. Offsets, gem value
     and the elite-kind list all live in descriptors. RNG call ORDER is
     unchanged (heal roll always, potion roll only for elite kinds). */
  const GD=ITEM_DROPS.gem, HD=ITEM_DROPS.heal, PD=ITEM_DROPS.potion;
  s.gems.push({id:s.nextId++,x:e.x+GD.offset[0],z:e.z+GD.offset[1],v:GD.xp});
  if(rnd(s)<HD.chance)s.heals.push({id:s.nextId++,x:e.x+HD.offset[0],z:e.z+HD.offset[1]});
  if(ELITE_KINDS.includes(e.type)&&rnd(s)<PD.chance)
    s.potions.push({id:s.nextId++,x:e.x+PD.offset[0],z:e.z+PD.offset[1]});
  if(s.up.siphon>0)for(const hh of s.heroes)if(!hh.downed)hh.hp=Math.min(hh.maxHp,hh.hp+3*s.up.siphon);
  emit('kill',{x:e.x,z:e.z,type:e.type});
  emit('splat',{x:e.x,z:e.z,type:e.type});
  addHitStop(s,CFG.hitStopMs.kill);
  emit('shake',{v:0.30});
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
  emit('shake',{v:crit?0.34:0.20});
  if(e.hp<=0)killEnemy(s,e);
}

function damageBoss(s,b,dmg,crit){
  if(b.hp<=0)return;
  b.hp=Math.max(0,b.hp-dmg); b.hitFlash=1;   // NOT interrupted: no state change
  emit('hit',{x:b.x,z:b.z,y:2.4,dmg:Math.round(dmg),crit,type:'boss'});
  addHitStop(s,CFG.hitStopMs.hit);
  emit('shake',{v:0.28});
  if(s.bossHits===0)s.bossFirstHitTick=s.tick;
  s.bossHits++;
  if(!b.summoned&&b.hp>0&&b.hp<=CFG.boss2.summonAt*b.maxHp){
    b.summoned=true;
    for(let i=0;i<CFG.boss2.summonCount;i++)
      makeEnemy(s,CFG.boss2.summonKind,b.x+(i?2.1:-2.1),b.z+(i?-1.2:1.2),0.8);
    emit('summon',{x:b.x,z:b.z});
  }
  if(!b.enraged&&b.hp>0&&b.hp<=CFG.boss2.hpFrac*b.maxHp){
    b.enraged=true; emit('enrage',{x:b.x,z:b.z});
  }
  if(b.hp<=0){
    s.score+=CFG.boss.score;
    emit('bossDeath',{x:b.x,z:b.z});
    addHitStop(s,CFG.hitStopMs.bossKill);
    emit('shake',{v:1.0});
    s.phase='clear'; s.chapterClearTimer=1.6;
  }
}

function castMagic(s,h){
  if(s.magic<CFG.magic.cost)return;
  if(s.phase!=='play'&&s.phase!=='boss')return;
  s.magic-=CFG.magic.cost;
  const R=CFG.magic.radius;
  for(let i=0;i<s.enemies.length;i++){
    const e=s.enemies[i]; if(e.dead)continue;
    const rr=R+CFG.enemy[e.type].radius;
    if(dist2(e.x,e.z,h.x,h.z)<=rr*rr){ emit('bolt',{x:e.x,z:e.z}); damageEnemy(s,e,CFG.magic.dmg,false); }
  }
  const b=s.boss;
  if(b&&b.hp>0){ const rr=R+CFG.boss.radius;
    if(dist2(b.x,b.z,h.x,h.z)<=rr*rr){ emit('bolt',{x:b.x,z:b.z,boss:1}); damageBoss(s,b,CFG.magic.dmg,false); } }
  emit('magic',{x:h.x,z:h.z,r:R});
  addHitStop(s,CFG.magic.stopMs);
}

function doHeroHit(s,h,st){
  const fx=Math.sin(h.yaw), fz=Math.cos(h.yaw);
  const arcHalf=st.arc*0.5;
  /* The arc test uses the enemy's BODY, not just its centre: a target is
     hit when its body circle reaches into the swing sector. The centre
     cone widens by the half-angle the body subtends, asin(r/d), and a
     body in contact with the hero (d <= r + HERO_R) is point-blank and
     always counts. There is no hero/enemy body collision, so enemies
     routinely end up beside or inside the hero, where the old centre-only
     test left a dead zone and very close enemies could not be hurt. */
  const inArc=(dx,dz,d,r)=>{
    if(d<=r+HERO_R)return true;
    if(d<=0.001)return true;
    return (dx*fx+dz*fz)/d >= Math.cos(arcHalf+Math.asin(Math.min(1,r/d)));
  };
  for(let i=0;i<s.enemies.length;i++){
    const e=s.enemies[i]; if(e.dead)continue;
    const dx=e.x-h.x, dz=e.z-h.z, d=Math.sqrt(dx*dx+dz*dz);
    if(d>st.range+CFG.enemy[e.type].radius)continue;
    if(!inArc(dx,dz,d,CFG.enemy[e.type].radius))continue;
    const crit=rnd(s)<st.crit;
    damageEnemy(s,e,st.dmg*(crit?1.7:1),crit);
  }
  const b=s.boss;
  if(b && b.hp>0){
    const dx=b.x-h.x, dz=b.z-h.z, d=Math.sqrt(dx*dx+dz*dz);
    if(d<=st.range+CFG.boss.radius && inArc(dx,dz,d,CFG.boss.radius)){
      const crit=rnd(s)<st.crit;
      damageBoss(s,b,st.dmg*(crit?1.7:1),crit);
    }
  }
}

function startRoll(s,h,inp,st){
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

function updateHero(s,h,inp,dt){
  if(h.downed){ h.vx=0; h.vz=0; return; }
  const st=heroStats(s,h);
  h.atkCd=Math.max(0,h.atkCd-dt);
  h.rollCd=Math.max(0,h.rollCd-dt);
  h.invuln=Math.max(0,h.invuln-dt);
  h.hitFlash=Math.max(0,(h.hitFlash||0)-dt*4);

  if(inp.roll)startRoll(s,h,inp,st);

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
      if(!h.hitDone && h.st>=CFG.hero.hitAt){ h.hitDone=true; doHeroHit(s,h,st); }
      if(h.st>=CFG.hero.swingDur){ h.state='idle'; h.st=0; }
    }
    if(h.state==='hurt'){
      h.st+=dt; if(h.st>=0.24){h.state='idle';h.st=0;}
    }
    if(inp.attack && h.atkCd<=0 && h.state!=='hurt' && (h.state!=='attack' || h.hitDone)){
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
  const C=CFG.enemy, cfg=C[e.type];
  const h=(e.tgt&&!e.tgt.downed)?e.tgt:nearestHero(s,e.x,e.z);
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
  if(landed)hurtHero(s,h,cfg.dmg,e.type);
  emit('enemyStrike',{x:e.x,z:e.z,landed,type:e.type});
}

function updateEnemies(s,dt){
  const C=CFG.enemy;
  for(let i=0;i<s.enemies.length;i++){
    const e=s.enemies[i]; if(e.dead)continue;
    const cfg=C[e.type];
    e.hitFlash=Math.max(0,(e.hitFlash||0)-dt*4);
    e.cancelFlash=Math.max(0,(e.cancelFlash||0)-dt*3);
    e.cd=Math.max(0,(e.cd||0)-dt);
    const h=nearestHero(s,e.x,e.z); e.tgt=h;
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
  const out=[];
  for(let i=0;i<s.projectiles.length;i++){
    const p=s.projectiles[i];
    p.x+=p.vx*dt; p.z+=p.vz*dt; p.life-=dt;
    let hitH=null;
    for(const hh of s.heroes){ if(hh.downed)continue;
      const dx=hh.x-p.x, dz=hh.z-p.z, rr=p.r+HERO_R;
      if(dx*dx+dz*dz<=rr*rr){ hitH=hh; break; } }
    let land=!!hitH;
    if(!land && p.lob){
      const gx=p.x-p.tx, gz=p.z-p.tz;
      const step=Math.sqrt(p.vx*p.vx+p.vz*p.vz)*dt;
      if(gx*gx+gz*gz<=step*step || p.life<=0){ p.x=p.tx; p.z=p.tz; land=true; }
    }
    if(land){
      if(p.splash){
        emit('projBlast',{x:p.x,z:p.z,r:p.splash,type:p.unit});
        for(const hh of s.heroes){ if(hh.downed)continue;
          const hd=Math.sqrt((hh.x-p.x)*(hh.x-p.x)+(hh.z-p.z)*(hh.z-p.z));
          if(hd<=p.splash){
            if(hh.invuln<=0){ hurtHero(s,hh,p.dmg,p.unit); emit('projHit',{x:hh.x,z:hh.z}); }
            else emit('projDodged',{x:hh.x,z:hh.z});
          } }
      }else if(hitH){
        if(hitH.invuln<=0){ hurtHero(s,hitH,p.dmg,p.unit); emit('projHit',{x:p.x,z:p.z}); }
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
  const B=CFG.boss;
  b.hitFlash=Math.max(0,(b.hitFlash||0)-dt*4);
  b.cd=Math.max(0,b.cd-dt); b.slamCd=Math.max(0,b.slamCd-dt);
  const h=nearestHero(s,b.x,b.z);
  const dx=h.x-b.x, dz=h.z-b.z, d=Math.sqrt(dx*dx+dz*dz)||0.001;
  // A long chase with no hit ramps the pursuit speed so a fleeing hero is
  // caught inside ~30 s even when a telegraphed charge is sidestepped.
  b.pursuit=(b.pursuit||0)+dt;
  const boost=b.pursuit>12?Math.min(2.4,(b.pursuit-12)*0.28):0;
  let mvx=0,mvz=0;
  const stopDist=B.radius+HERO_R+0.30;
  if(b.state==='approach'){
    b.yaw=Math.atan2(dx,dz);
    if(d>stopDist){ const sp=(B.speed+boost)*(b.enraged?CFG.boss2.speedMul:1); mvx=dx/d*sp; mvz=dz/d*sp; }
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
      if(hurtHero(s,h,B.chargeDmg,'boss'))emit('bossSlam',{x:h.x,z:h.z});
    }
    if(b.timer<=0){ b.state='recover'; b.timer=0.75; b.cd=B.chargeCd; b.slamCd=0.7; b.chargeHit=false; }
  }else if(b.state==='slamTele'){
    b.timer-=dt;
    // A lunging wind-up: the boss keeps closing (but never crosses) the hero,
    // so the slam actually lands on a moving target instead of expiring in air.
    if(d>stopDist){ const sp=(B.speed+boost)*(b.enraged?CFG.boss2.speedMul:1); mvx=dx/d*sp; mvz=dz/d*sp; }
    if(b.timer<=0){
      b.state='slam'; b.timer=0.35;
      const ddx=h.x-b.x, ddz=h.z-b.z, dd=Math.sqrt(ddx*ddx+ddz*ddz)||0.001;
      // Point-blank always counts as in-arc: a centred slam cannot "miss"
      // just because the boss stepped past the hero on the previous tick.
      const inArc=dd<1.2 || (ddx*Math.sin(b.lockYaw)+ddz*Math.cos(b.lockYaw))/dd>=Math.cos(70*DEG);
      if(dd<=B.slamRange && inArc){
        b.pursuit=0;
        if(hurtHero(s,h,B.slamDmg+(b.enraged?CFG.boss2.slamBonus:0),'boss'))emit('bossSlam',{x:h.x,z:h.z});
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
  const st=heroStats(s), pr=st.pickup, pr2=pr*pr;
  const gems=[];
  for(let i=0;i<s.gems.length;i++){
    const g=s.gems[i];
    if(s.heroes.some(hh=>!hh.downed&&dist2(hh.x,hh.z,g.x,g.z)<=pr2)){
      s.xp+=g.v; s.score+=GEM_SCORE; emit('gem',{x:g.x,z:g.z});
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
    const hh=s.heroes.find(q=>!q.downed&&dist2(q.x,q.z,o.x,o.z)<=pr2);
    if(hh){
      hh.hp=Math.min(hh.maxHp,hh.hp+CFG.heal.amount);
      emit('heal',{x:o.x,z:o.z,amount:CFG.heal.amount});
    }else heals.push(o);
  }
  s.heals=heals;
  const pots=[];
  for(let i=0;i<s.potions.length;i++){
    const o=s.potions[i];
    if(s.heroes.some(hh=>!hh.downed&&dist2(hh.x,hh.z,o.x,o.z)<=pr2)){
      s.magic=Math.min(CFG.magic.cost,s.magic+CFG.magic.potionGain);
      emit('potion',{x:o.x,z:o.z});
    }else pots.push(o);
  }
  s.potions=pots;
}

function aliveByType(s){
  const m={};
  for(let i=0;i<s.enemies.length;i++){ const e=s.enemies[i]; if(!e.dead)m[e.type]=(m[e.type]||0)+1; }
  return m;
}
function spawnEventNext(s){
  if(!s.eventQueue||!s.eventQueue.length)return false;
  let aliveN=0; for(const e of s.enemies)if(!e.dead)aliveN++;
  if(aliveN>=CFG.caps.enemies)return true;   // event holds this slot; spawn when one frees
  const t=s.eventQueue.shift(), a=rnd(s)*TAU, rr=rndR(s,17,29);
  const ah=anchorHero(s); let x=ah.x+Math.sin(a)*rr, z=ah.z+Math.cos(a)*rr;
  const dd=Math.sqrt(x*x+z*z);
  if(dd>ARENA_R-2){ x*=(ARENA_R-2)/dd; z*=(ARENA_R-2)/dd; }
  makeEnemy(s,t,x,z,rndR(s,0.2,1.1)); emit('spawn',{x,z,type:t});
  return true;
}
function spawnEnemy(s){
  const alive=s.enemies.filter(e=>!e.dead);
  if(alive.length>=CFG.caps.enemies)return;          // ONE global 8-alive cap
  const by=aliveByType(s);
  const elapsed=CFG.waveSeconds-s.waveLeft;
  const W=CFG.wave, CAP=CFG.caps;
  /* Per-kind alive caps now come from each enemy descriptor
     (src/content/enemies/<kind>.js -> ENEMY_CAPS). No plural aliases and
     no hard-coded kind list any more. W[t].cap stays as a fallback. */
  const capOf=t=>CAP[t]!==undefined?CAP[t]:(W[t]?W[t].cap:99);
  let type=null;
  /* ---- 1. scheduled elites: one at a time, each on its own clock.
     The list (and its priority order) comes from the enemy descriptors'
     `wave.every` entries — no hard-coded knight-then-sorcerer if/else. ---- */
  for(const k of SCHEDULED_ELITES){
    const w=W[k];
    if(elapsed>=w.from && !(by[k]||0) && elapsed>=(s[k+'NextAt']||0)){
      type=k; s[k+'NextAt']=elapsed+w.every; break;
    }
  }
  /* ---- 2. weighted fill: only unlocked types, never over their cap ---- */
  if(!type){
    /* FILL_POOL is derived from the enemy descriptors. ORDER IS LOAD-BEARING:
       it fixes how the weighted roll below consumes sim.rng. */
    const pool=[];
    for(const f of FILL_POOL){
      if(elapsed<f.from)continue;
      if((by[f.kind]||0)>=capOf(f.kind))continue;
      pool.push({t:f.kind,w:f.weight+elapsed*f.ramp});
    }
    if(!pool.length)return;                        // every kind at its cap
    let total=0; for(const p of pool)total+=p.w;
    let roll=rnd(s)*total;
    type=pool[pool.length-1].t;
    for(const p of pool){ roll-=p.w; if(roll<0){ type=p.t; break; } }
    /* The descriptor flagged `opensFight` always spawns first. */
    if(s.kills===0 && elapsed<3 && !(by[OPENER_KIND]||0))type=OPENER_KIND;
  }
  const a=rnd(s)*TAU, rr=rndR(s,17,29);
  const ah=anchorHero(s); let x=ah.x+Math.sin(a)*rr, z=ah.z+Math.cos(a)*rr;
  const d=Math.sqrt(x*x+z*z);
  if(d>ARENA_R-2){ x*=(ARENA_R-2)/d; z*=(ARENA_R-2)/d; }
  makeEnemy(s,type,x,z,rndR(s,0.2,1.1));
  emit('spawn',{x,z,type});
}
function makeEnemy(s,type,x,z,cd){
  const C=CFG.enemy[type];
  const e={id:s.nextId++,type,x,z,yaw:Math.atan2(anchorHero(s).x-x,anchorHero(s).z-z),
    lockYaw:0,hp:C.hp,maxHp:C.hp,state:'chase',timer:0,cd:cd||0.5,
    slamCd:0,attackKind:'melee',vx:0,vz:0,hitFlash:0,cancelFlash:0,dead:false};
  s.enemies.push(e);return e;
}
function spawnBoss(s){
  const ah=anchorHero(s);
  const a0=rnd(s)*TAU, rr=rndR(s,CFG.boss.spawnMin,CFG.boss.spawnMax);
  /* Keep the spawn inside the arena WITHOUT shortening the required 26-30 m
     gap. Sweep directions until one fits; an inward direction always exists
     for a 40 m arena and a hero anywhere inside it. */
  let x=0,z=0,ok=false;
  for(let t=0;t<24;t++){
    const a=a0+t*(TAU/24);
    x=ah.x+Math.sin(a)*rr; z=ah.z+Math.cos(a)*rr;
    if(Math.sqrt(x*x+z*z)<=ARENA_R-3){ ok=true; break; }
  }
  if(!ok){
    const hr=Math.sqrt(ah.x*ah.x+ah.z*ah.z)||1;
    x=ah.x-ah.x/hr*rr; z=ah.z-ah.z/hr*rr;
  }
  s.enemies=[]; s.projectiles=[];
  s.boss={id:s.nextId++,x,z,yaw:Math.atan2(ah.x-x,ah.z-z),lockYaw:0,
    hp:CFG.boss.hp,maxHp:CFG.boss.hp,state:'approach',timer:0,cd:2.2,slamCd:0,
    chargeVX:0,chargeVZ:0,chargeHit:false,pursuit:0,hitFlash:0,vx:0,vz:0};
  s.bossSpawned=true; s.bossSpawnTick=s.tick; s.phase='boss';
  emit('bossSpawn',{x,z,dist:Math.sqrt((x-ah.x)*(x-ah.x)+(z-ah.z)*(z-ah.z))});
}
function simStep(raw){
  const s=SIM;
  /* Input routing: a co-op frame is {p1,p2}; anything else is the solo
     input, applied to the (single) hero through the same code path. */
  let inps;
  if(raw&&raw.p1){ inps=[normInput(raw.p1),normInput(raw.p2)]; }
  else { const one=normInput(raw); inps=s.heroes.map(()=>one); }
  const inp=inps[0];
  if(s.hitStop>0){ s.hitStop--; return; }         // frozen world, deterministic step consumed
  if(s.phase==='levelup'){ if(inp.upgrade>=0)applyUpgrade(s,inp.upgrade); return; }
  if(s.phase==='clear'){
    s.chapterClearTimer-=FIXED;
    if(s.chapterClearTimer<=0){
      if(s.chapter<3){
        s.chapter++; s.map=buildMapData(s.chapter);
        s.waveLeft=CFG.waveSeconds; s.bossSpawned=false; s.boss=null;
        s.enemies=[]; s.projectiles=[]; s.gems=[]; s.heals=[]; s.potions=[];
        s.eventDone=false; s.eventQueue=[];
        s.heroes.forEach((h,i)=>{
          h.x=s.players>1?(i===1?1.4:-1.4):0; h.z=0; h.vx=0; h.vz=0;
          h.state='idle'; h.st=0;
          if(h.downed){ h.downed=false; h.hp=Math.round(h.maxHp*0.5); }
          else h.hp=Math.min(h.maxHp,h.hp+30);
        });
        s.spawnTimer=1.0;
        s.phase='play'; emit('chapter',{chapter:s.chapter});
      }else{ s.phase='victory'; emit('victory',{}); }
    }
    return;
  }
  if(s.phase!=='play'&&s.phase!=='boss')return;
  s.tick++;
  for(let i=0;i<s.heroes.length;i++)updateHero(s,s.heroes[i],inps[i],FIXED);
  for(let i=0;i<s.heroes.length;i++)
    if(inps[i].magic&&!s.heroes[i].downed)castMagic(s,s.heroes[i]);

  if(s.phase==='play'){
    s.waveLeft-=FIXED;
    s.spawnTimer-=FIXED;
    if(s.spawnTimer<=0){
      const elapsed=CFG.waveSeconds-s.waveLeft;
      s.spawnTimer=Math.max(0.42,2.35-elapsed*0.0075);
      if(!spawnEventNext(s))spawnEnemy(s);
    }
    if(s.waveLeft<=0){ s.waveLeft=0; spawnBoss(s); }
    const elx=CFG.waveSeconds-s.waveLeft;
    if(!s.eventDone&&elx>=CFG.events.at){
      s.eventDone=true; s.eventQueue=CFG.events.pack[s.chapter].slice();
      emit('event',{chapter:s.chapter});
    }
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
  put(s.waveLeft.toFixed(4));put(s.hitStop);put(s.score);put(s.kills);put(s.magic);put(s.level);
  put(s.xp);put(s.xpNeed);put(s.nextId);put(s.spawnTimer.toFixed(4));
  put('N'+s.players);
  for(const h of s.heroes){
    for(const v of [h.x,h.z,h.yaw,h.vx,h.vz,h.hp,h.maxHp,h.st,h.atkCd,h.rollCd,h.invuln,h.state==='roll'?1:0])put(q(v));
    put(h.state);put(h.hitDone?1:0);put(h.attackId);put(h.downed?1:0);
    put(h.mods.hp);put(h.mods.dmg);put(h.mods.spd.toFixed(3));
  }
  put('E'+s.enemies.length);
  for(const e of s.enemies){ for(const v of [e.id,e.x,e.z,e.yaw,e.lockYaw,e.hp,e.timer,e.cd,e.state==='telegraph'?1:0,e.vx,e.vz])put(q(v)); put(e.state); put(e.attackKind||''); }
  put('P'+s.projectiles.length);
  for(const p of s.projectiles)for(const v of [p.id,p.x,p.z,p.vx,p.vz,p.life,p.tx||0,p.tz||0])put(q(v));
  put('G'+s.gems.length);for(const g of s.gems)for(const v of [g.id,g.x,g.z])put(q(v));
  put('H'+s.heals.length);for(const o of s.heals)for(const v of [o.id,o.x,o.z])put(q(v));
  if(s.boss){const b=s.boss;put('B1');for(const v of [b.x,b.z,b.yaw,b.lockYaw,b.hp,b.timer,b.cd,b.slamCd,b.pursuit||0,b.state==='charge'?1:0])put(q(v));put(b.state);put(b.enraged?1:0);put(b.summoned?1:0);}
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

/* =====================================================================
   PART 3 — RENDER + COSMETICS + AUDIO
   INVARIANT: nothing in this part assigns to SIM or any sim sub-object.
   It only READS sim. Cosmetic randomness uses its own RNG.
   ===================================================================== */
const $ = id => document.getElementById(id);
const CRNG = mkRng(0xC05BED);                 // cosmetic-only
let SHAKE = 0;
function FXSHAKE(v){ SHAKE=Math.min(1.4,SHAKE+v); }

/* ---------- renderer ---------- */
const renderer = new T.WebGLRenderer({antialias:false,powerPreference:'high-performance',alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
renderer.setSize(innerWidth,innerHeight);
$('stage').appendChild(renderer.domElement);
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(58,innerWidth/innerHeight,0.1,260);
const hemi = new T.HemisphereLight(0xbcd8ff,0x30251f,1.0);
const sun  = new T.DirectionalLight(0xfff0d0,1.25); sun.position.set(28,46,18);
const amb  = new T.AmbientLight(0xffffff,0.30);
scene.add(hemi,sun,amb);

const dummy = new T.Object3D();
const _v = new T.Vector3();
let mapGroup = new T.Group(); scene.add(mapGroup);
let skyMesh=null, groundMesh=null;

/* ---------- procedural ground texture ---------- */
function groundTexture(ch){
  const P=PALETTES[ch-1], G=PROPS.ground.view, S=G.textureSize;
  const R=mkRng(G.textureSeedBase+ch*G.textureSeedStep);
  const c=document.createElement('canvas'); c.width=c.height=S;
  const g=c.getContext('2d');
  g.fillStyle=P.ground; g.fillRect(0,0,S,S);
  // mottling
  for(let i=0;i<1500;i++){
    const x=R()*S,y=R()*S,r=2+R()*15;
    g.fillStyle=R()<0.5?P.ground2:'rgba(0,0,0,0.055)';
    g.globalAlpha=0.10+R()*0.16;
    g.beginPath();g.ellipse(x,y,r,r*(0.5+R()*0.7),R()*3,0,TAU);g.fill();
  }
  g.globalAlpha=1;
  // winding path — normalised against the texture size
  g.lineCap='round';g.lineJoin='round';
  g.strokeStyle=P.path;g.globalAlpha=0.78;g.lineWidth=44*S/512;
  g.beginPath();g.moveTo(-30*S/512,410*S/512);
  g.bezierCurveTo(120*S/512,360*S/512,150*S/512,250*S/512,250*S/512,250*S/512);
  g.bezierCurveTo(360*S/512,250*S/512,360*S/512,120*S/512,540*S/512,60*S/512);g.stroke();
  g.globalAlpha=0.30;g.lineWidth=20*S/512;g.strokeStyle='rgba(255,255,255,.25)';g.stroke();
  g.globalAlpha=1;
  // speckles / cracks
  for(let i=0;i<900;i++){
    const x=R()*S,y=R()*S;
    g.fillStyle=ch===3&&R()<0.35?'rgba(255,110,40,.45)':R()<0.5?'rgba(255,255,255,.10)':'rgba(0,0,0,.14)';
    g.fillRect(x,y,1+R()*3,1+R()*2);
  }
  if(ch===3){
    g.strokeStyle='rgba(255,105,35,.55)';g.lineWidth=2*S/512;g.globalAlpha=.8;
    for(let i=0;i<26;i++){
      const x=R()*S,y=R()*S;g.beginPath();g.moveTo(x,y);
      for(let k=0;k<4;k++)g.lineTo(x+(R()-0.5)*70*S/512,y+(R()-0.5)*70*S/512);g.stroke();
    }
    g.globalAlpha=1;
  }
  const t=new T.CanvasTexture(c);
  t.colorSpace=T.SRGBColorSpace;
  t.anisotropy=1;
  return t;
}

/* ---------- sky dome ---------- */
function setSky(ch){
  const P=PALETTES[ch-1], K=PROPS.sky.view, RAD=K.radius;
  scene.background=new T.Color(P.sky);
  scene.fog=new T.Fog(P.fog,K.fogNear,K.fogFar);
  hemi.color.setHex(P.hemi); hemi.intensity=P.amb;
  sun.color.setHex(P.light); sun.intensity=ch===3?1.30:1.45;
  if(!skyMesh){
    const g=new T.SphereGeometry(RAD,K.widthSegments,K.heightSegments);
    const cols=[]; const pos=g.getAttribute('position');
    for(let i=0;i<pos.count;i++){
      const y=pos.getY(i)/RAD;
      const t=clamp((y+0.12)/0.8,0,1);
      cols.push(lerp(0.16,0.05,t),lerp(0.20,0.09,t),lerp(0.28,0.18,t));
    }
    g.setAttribute('color',new T.Float32BufferAttribute(cols,3));
    skyMesh=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false}));
    scene.add(skyMesh);
  }
  const top=new T.Color(P.sky), low=new T.Color(P.fog);
  const col=skyMesh.geometry.getAttribute('color');
  for(let i=0;i<col.count;i++){
    const y=skyMesh.geometry.getAttribute('position').getY(i)/RAD;
    const t=clamp((y+0.25)/1.1,0,1);
    col.setXYZ(i,lerp(low.r*0.80,top.r*0.68,t),lerp(low.g*0.80,top.g*0.68,t),lerp(low.b*0.80,top.b*0.68,t));
  }
  col.needsUpdate=true;
}

function disposeGroup(gr){
  gr.traverse(o=>{ if(o.geometry)o.geometry.dispose();
    if(o.material){ const ms=Array.isArray(o.material)?o.material:[o.material];
      ms.forEach(m=>{ if(m.map)m.map.dispose(); m.dispose(); }); } });
  scene.remove(gr);
}

function inst(geo,mat,arr,fn,colorFn){
  if(!arr||!arr.length)return null;
  const m=new T.InstancedMesh(geo,mat,arr.length);
  m.frustumCulled=false;
  for(let i=0;i<arr.length;i++){
    fn(dummy,arr[i],i);
    dummy.updateMatrix(); m.setMatrixAt(i,dummy.matrix);
    if(colorFn)m.setColorAt(i,colorFn(arr[i],i));
  }
  m.instanceMatrix.needsUpdate=true;
  if(m.instanceColor)m.instanceColor.needsUpdate=true;
  mapGroup.add(m); return m;
}
const MAT=(color,opts)=>new T.MeshLambertMaterial(Object.assign({color},opts||{}));

function buildMapMeshes(sim){
  disposeGroup(mapGroup);
  mapGroup=new T.Group(); scene.add(mapGroup);
  const ch=sim.chapter,P=PALETTES[ch-1],d=sim.map,V=PROPS;
  setSky(ch);
  const gt=groundTexture(ch);
  groundMesh=new T.Mesh(new T.PlaneGeometry(V.ground.view.width,V.ground.view.height),
    new T.MeshLambertMaterial({map:gt}));
  groundMesh.rotation.x=-Math.PI/2; groundMesh.position.y=-0.02;
  mapGroup.add(groundMesh);

  /* ---- pond + rim: src/content/props/pond.js ---- */
  const PW=V.pond.view;
  const lavaWater=ch===3;
  const pond=new T.Mesh(new T.CircleGeometry(d.pond.r,PW.segments),
    new T.MeshLambertMaterial({color:P.pond,transparent:true,opacity:PW.opacityByChapter[ch],
      emissive:lavaWater?PW.emissiveColor:0x000000,
      emissiveIntensity:lavaWater?PW.emissiveIntensity:0}));
  pond.rotation.x=-Math.PI/2; pond.position.set(d.pond.x,0.015,d.pond.z);
  mapGroup.add(pond);
  const rim=new T.Mesh(new T.RingGeometry(d.pond.r,d.pond.r+PW.rim,PW.segments),
    new T.MeshLambertMaterial({color:PW.rimColorByChapter[ch],side:T.DoubleSide}));
  rim.rotation.x=-Math.PI/2;rim.position.set(d.pond.x,0.02,d.pond.z);mapGroup.add(rim);

  const cTree=new T.Color(P.tree),cTrunk=new T.Color(P.trunk),
        cRock=new T.Color(P.rock),cHill=new T.Color(P.hill);
  /* ---- tree trunks ---- */
  const TV=V.trunk.view;
  inst(new T.CylinderGeometry(TV.radiusTop,TV.radiusBottom,1,TV.segments),MAT(0xffffff),d.trunk,(o,p)=>{
    o.position.set(p.x,TV.offsetY*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(TV.scale[0]*p.s,TV.scale[1]*p.s,TV.scale[2]*p.s);
  },()=>cTrunk);
  /* ---- canopies / dead branches / burnt crowns ---- */
  const CV=V.canopy.view;
  inst(new T.ConeGeometry(0.5,1,CV.segments),MAT(0xffffff),d.canopy,(o,p)=>{
    const dead=p.kind===1, burnt=p.kind===2;
    const sc=dead?CV.scaleDead:CV.scaleNormal;
    o.position.set(p.x,(dead?CV.liftDead:CV.liftNormal)*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(sc[0]*p.s,sc[1]*p.s,sc[2]*p.s);
  },p=>p.kind===2?new T.Color(CV.burntColor):(p.kind===1?new T.Color(CV.deadColor):cTree));
  /* ---- rocks ---- */
  const RV=V.rock.view;
  inst(new T.DodecahedronGeometry(0.5,0),MAT(0xffffff),d.rock,(o,p)=>{
    o.position.set(p.x,RV.offsetY*p.s,p.z);o.rotation.set(p.rot*0.2,p.rot,p.rot*0.3);
    o.scale.set(RV.scale[0]*p.s,RV.scale[1]*p.s,RV.scale[2]*p.s);
  },()=>cRock);
  /* ---- pillars (physical blockers) ---- */
  const LV=V.pillar.view;
  inst(new T.CylinderGeometry(LV.radiusTop,LV.radiusBottom,1,LV.segments),MAT(0xffffff),d.pillar,(o,p)=>{
    o.position.set(p.x,LV.offsetY*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(LV.scale[0]*p.s,LV.scale[1]*p.s,LV.scale[2]*p.s);
  },()=>cRock);
  /* ---- fence posts + rails ---- */
  const FV=V.fence.view;
  inst(new T.BoxGeometry(1,1,1),MAT(FV.postColorByChapter[ch]),d.post,(o,p)=>{
    o.position.set(p.x,FV.postOffsetY*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(FV.postScale[0],FV.postScale[1]*p.s,FV.postScale[2]);
  });
  inst(new T.BoxGeometry(1,1,1),MAT(FV.railColorByChapter[ch]),d.post,(o,p)=>{
    o.position.set(p.x,FV.railOffsetY*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(FV.railScale[0],FV.railScale[1],FV.railScale[2]);
  });
  /* ---- gravestones ---- */
  const SV=V.stone.view;
  inst(new T.BoxGeometry(1,1,1),MAT(SV.color),d.stone,(o,p)=>{
    o.position.set(p.x,SV.offsetY*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(SV.scale[0]*p.s,SV.scale[1]*p.s,SV.scale[2]*p.s);
  });
  /* ---- mountains / hills — the VISIBLE edge of the map ---- */
  const HV=V.hill.view;
  inst(new T.DodecahedronGeometry(0.5,0),MAT(0xffffff),d.hill,(o,p)=>{
    o.position.set(p.x,p.s*HV.offsetY,p.z);
    o.rotation.set(HV.rotation[0],p.rot,HV.rotation[2]);
    o.scale.set(p.s*HV.scale[0],p.s*HV.scale[1],p.s*HV.scale[2]);
  },()=>cHill);
  /* ---- landmark blocks ---- */
  const BV=V.block.view;
  inst(new T.BoxGeometry(1,1,1),MAT(BV.colorByChapter[ch]),d.block,(o,p)=>{
    const q=BV.shapes[p.kind]||BV.shapes[0];
    o.position.set(p.x,q[3],p.z);o.rotation.set(0,p.rot,0);o.scale.set(q[0],q[1],q[2]);
  });
  /* ---- torches / braziers ---- */
  const WV=V.torch.view;
  inst(new T.CylinderGeometry(WV.radius,WV.radius,1,WV.segments),MAT(WV.color),d.torch,(o,p)=>{
    o.position.set(p.x,WV.postOffsetY*p.s,p.z);o.rotation.set(0,0,0);
    o.scale.set(WV.postScale[0],WV.postScale[1]*p.s,WV.postScale[2]);
  });
  inst(new T.SphereGeometry(WV.flameRadius,WV.flameSegments[0],WV.flameSegments[1]),
    new T.MeshBasicMaterial({color:WV.flameColorByChapter[ch]}),d.torch,(o,p)=>{
    o.position.set(p.x,WV.flameOffsetY*p.s,p.z);o.rotation.set(0,0,0);o.scale.setScalar(WV.flameScale*p.s);
  });
  /* ---- lava pools ---- */
  const AV=V.lava.view;
  inst(new T.CircleGeometry(1,AV.segments),new T.MeshBasicMaterial({color:AV.color,transparent:true,opacity:AV.opacity,
    side:T.DoubleSide,depthWrite:false}),d.lava,(o,p)=>{
    o.position.set(p.x,0.03,p.z);o.rotation.set(-Math.PI/2,0,p.rot);o.scale.setScalar(p.s);
  });
  /* ---- pond reeds ---- */
  const RD=V.reeds.view;
  inst(new T.ConeGeometry(0.5,1,RD.segments),MAT(RD.colorByChapter[ch]),d.reeds,(o,p)=>{
    o.position.set(p.x,RD.offsetY*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(RD.scale[0],RD.scale[1]*p.s,RD.scale[2]);
  });
}

/* =====================================================================
   Mesh2Motion-style 13-joint rigid-skinned humanoid.
   One merged BufferGeometry + Skeleton => ONE draw call per character.
   ===================================================================== */
const JOINTS=[
  {n:'hips',      p:-1,o:[0,0.95,0]},
  {n:'spine',     p:0, o:[0,0.28,0]},
  {n:'head',      p:1, o:[0,0.58,0]},
  {n:'upperArmL', p:1, o:[0.34,0.34,0]},
  {n:'lowerArmL', p:3, o:[0,-0.42,0]},
  {n:'handL',     p:4, o:[0,-0.36,0]},
  {n:'upperArmR', p:1, o:[-0.34,0.34,0]},
  {n:'lowerArmR', p:6, o:[0,-0.42,0]},
  {n:'handR',     p:7, o:[0,-0.36,0]},
  {n:'thighL',    p:0, o:[0.16,-0.12,0]},
  {n:'shinL',     p:9, o:[0,-0.46,0]},
  {n:'thighR',    p:0, o:[-0.16,-0.12,0]},
  {n:'shinR',     p:11,o:[0,-0.46,0]}
];
const ORIG=[]; JOINTS.forEach((j,i)=>{const b=j.p>=0?ORIG[j.p]:[0,0,0];
  ORIG.push([b[0]+j.o[0],b[1]+j.o[1],b[2]+j.o[2]]);});

/* Brick-minifigure palette: every unit has a moulded "skin" head/hands colour
   (classic ABS yellow for the hero) plus its own torso/leg plastic colour. */
const GEO_CACHE={};
function prim(kind){
  if(GEO_CACHE[kind])return GEO_CACHE[kind];
  const g=kind==='box'?new T.BoxGeometry(1,1,1)
    :kind==='sph'?new T.SphereGeometry(0.5,8,6)
    :kind==='cyl'?new T.CylinderGeometry(0.5,0.5,1,8)
    :kind==='cyl12'?new T.CylinderGeometry(0.5,0.5,1,12)
    :kind==='cone'?new T.ConeGeometry(0.5,1,8)
    :new T.BoxGeometry(1,1,1);
  GEO_CACHE[kind]=g;return g;
}
/* ---------------------------------------------------------------------
   BRICK MINIFIGURE (LEGO-style, our own original geometry).
   Same 13 joints as before so every clip still drives it, but the body is
   rebuilt from moulded bricks: a cylindrical head with a top stud and a
   printed face, a stepped trapezoid torso, C-clamp hands and flat feet.
   Nothing is a third-party asset — it is all boxes/cylinders in code.
   --------------------------------------------------------------------- */
/* ---- FIGURE GEOMETRY — now pure data in src/content/figures/<id>.js ----
   Each figure descriptor owns its palette AND its complete moulded part list
   (extracted verbatim from the legacy rig by scripts/extract-figures.mjs).
   A part's `c` is a tint-slot name; 'INK' is the shared face-print colour.
   Adding a visual character design = one descriptor + one barrel line. */
function rigParts(kind){
  const f=FIGURES[kind]||FIGURES.hero, tint=f.tint;
  return f.parts.map(p=>({
    j:p.j, g:p.g, o:p.o, s:p.s, r:p.r||[0,0,0],
    c:p.c==='INK'?FIGURE_INK:(tint[p.c]||tint.armor),
  }));
}
const RIG_GEO={};
function rigGeometry(kind){
  if(RIG_GEO[kind])return RIG_GEO[kind];
  const P=rigParts(kind),pos=[],nor=[],col=[],si=[],sw=[],idx=[];
  const c=new T.Color();
  for(let k=0;k<P.length;k++){
    const p=P[k],g=prim(p.g).clone();
    const o=ORIG[p.j];
    const m=new T.Matrix4().makeRotationFromEuler(new T.Euler(p.r[0],p.r[1],p.r[2]));
    m.scale(new T.Vector3(p.s[0],p.s[1],p.s[2]));
    m.setPosition(o[0]+p.o[0],o[1]+p.o[1],o[2]+p.o[2]);
    g.applyMatrix4(m);
    const pa=g.getAttribute('position'),na=g.getAttribute('normal'),ia=g.getIndex();
    const base=pos.length/3;
    for(let i=0;i<pa.count;i++){
      pos.push(pa.getX(i),pa.getY(i),pa.getZ(i));
      nor.push(na.getX(i),na.getY(i),na.getZ(i));
      col.push(p.c[0],p.c[1],p.c[2]);
      si.push(p.j,0,0,0); sw.push(1,0,0,0);
    }
    if(ia)for(let i=0;i<ia.count;i++)idx.push(base+ia.getX(i));
    else for(let i=0;i<pa.count;i++)idx.push(base+i);
    g.dispose();
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(col,3));
  geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));
  geo.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  RIG_GEO[kind]=geo;
  return geo;
}
const CROSSFADE=0.15;
const BASE=[
  [0,0,0],[0,0,0],[0,0,0],
  [0.10,0,0.30],[-0.30,0,0],[0,0,0],
  [0.10,0,-0.30],[-0.30,0,0],[0,0,0],
  [-0.05,0,0.04],[0.09,0,0],
  [-0.05,0,-0.04],[0.09,0,0]
];
function pose(over){ const a=BASE.map(v=>v.slice()); for(const k in over)a[k]=over[k].slice(); return a; }
function CLIP(dur,loop,keys){ return {dur,loop,keys}; }
const CLIPS={
  idle: CLIP(1.4,true,[
    {t:0,   p:pose({1:[-0.02,0,0],2:[0.02,0,0],3:[0.10,0,0.30],6:[0.10,0,-0.30]})},
    {t:0.70,p:pose({1:[0.025,0,0],2:[-0.02,0,0],3:[0.13,0,0.32],6:[0.13,0,-0.32]})},
    {t:1.40,p:pose({1:[-0.02,0,0],2:[0.02,0,0],3:[0.10,0,0.30],6:[0.10,0,-0.30]})}
  ]),
  run: CLIP(0.52,true,[
    {t:0,   p:pose({0:[0.10,0,0],1:[0.16,0,0],3:[-0.75,0,0.18],4:[-0.45,0,0],
                    6:[0.72,0,-0.18],7:[-0.30,0,0],9:[-0.70,0,0],10:[0.42,0,0],
                    11:[0.70,0,0],12:[0.20,0,0]})},
    {t:0.26,p:pose({0:[-0.10,0,0],1:[0.16,0,0],3:[0.72,0,0.18],4:[-0.30,0,0],
                    6:[-0.75,0,-0.18],7:[-0.45,0,0],9:[0.70,0,0],10:[0.20,0,0],
                    11:[-0.70,0,0],12:[0.42,0,0]})},
    {t:0.52,p:pose({0:[0.10,0,0],1:[0.16,0,0],3:[-0.75,0,0.18],4:[-0.45,0,0],
                    6:[0.72,0,-0.18],7:[-0.30,0,0],9:[-0.70,0,0],10:[0.42,0,0],
                    11:[0.70,0,0],12:[0.20,0,0]})}
  ]),
  attack: CLIP(0.625,false,[
    {t:0,    p:pose({1:[-0.10,-0.32,0],2:[0.05,0.15,0],6:[-1.35,0,-0.35],7:[-0.75,0,0],8:[0.3,0,0]})},
    {t:0.25, p:pose({1:[0.14,0.45,0],2:[-0.05,-0.10,0],6:[0.85,0,0.85],7:[-0.20,0,0],8:[-0.55,0,0],9:[-0.20,0,0],11:[0.16,0,0]})},
    {t:0.44, p:pose({1:[0.20,0.28,0],6:[0.35,0,0.30],7:[-0.55,0,0],8:[-0.30,0,0]})},
    {t:0.625,p:pose({})}
  ]),
  /* TUCK: chin down, knees to chest, heels to the seat, arms hugging in.
     The somersault itself is the mesh pitch in syncViews(); this clip only
     curls the body into a ball so the rotation reads as a roll. */
  roll: CLIP(0.45,false,[
    {t:0,   p:pose({1:[0.50,0,0],2:[0.40,0,0],
                    3:[1.05,0,0.22],4:[1.05,0,0],6:[1.05,0,-0.22],7:[1.05,0,0],
                    9:[-1.45,0,0],10:[1.85,0,0],11:[-1.45,0,0],12:[1.85,0,0]})},
    {t:0.20,p:pose({1:[0.62,0,0],2:[0.52,0,0],
                    3:[1.30,0,0.18],4:[1.25,0,0],6:[1.30,0,-0.18],7:[1.25,0,0],
                    9:[-1.62,0,0],10:[2.02,0,0],11:[-1.62,0,0],12:[2.02,0,0]})},
    {t:0.45,p:pose({})}
  ]),
  hurt: CLIP(0.30,false,[
    {t:0,   p:pose({0:[-0.15,0,0],1:[-0.35,0,0],2:[-0.25,0,0],3:[-0.5,0,0.5],6:[-0.5,0,-0.5]})},
    {t:0.30,p:pose({})}
  ]),
  death: CLIP(0.85,false,[
    {t:0,   p:pose({})},
    {t:0.35,p:pose({0:[-0.8,0,0],1:[-0.9,0,0],2:[0.5,0,0],3:[-1.2,0,0.7],6:[-1.2,0,-0.7],9:[-0.9,0,0],11:[-0.9,0,0]})},
    {t:0.85,p:pose({0:[-1.45,0,0],1:[-1.25,0,0],2:[0.7,0,0],3:[-1.5,0,0.9],6:[-1.5,0,-0.9],9:[-1.2,0,0],10:[0.5,0,0],11:[-1.2,0,0],12:[0.5,0,0]})}
  ]),
  telegraph: CLIP(0.55,false,[
    {t:0,   p:pose({1:[-0.12,-0.20,0],6:[-1.15,0,-0.30],7:[-0.65,0,0]})},
    {t:0.55,p:pose({1:[-0.22,-0.34,0],6:[-1.65,0,-0.28],7:[-0.85,0,0],9:[-0.18,0,0],11:[0.18,0,0]})}
  ]),
  cast: CLIP(0.55,false,[
    {t:0,   p:pose({3:[-1.1,0,0.2],6:[-1.1,0,-0.2]})},
    {t:0.55,p:pose({3:[-1.55,0,0.12],4:[-0.3,0,0],6:[-1.55,0,-0.12],7:[-0.3,0,0],1:[-0.08,0,0]})}
  ]),
  charge: CLIP(0.70,false,[
    {t:0,   p:pose({1:[0.25,0,0],3:[-0.5,0,0.3],6:[-0.5,0,-0.3],9:[-0.3,0,0],11:[0.2,0,0]})},
    {t:0.70,p:pose({1:[0.42,0,0],3:[-0.9,0,0.25],6:[-0.9,0,-0.25],9:[-0.5,0,0],11:[0.35,0,0]})}
  ])
};
function sampleClip(clip,t){
  const d=clip.dur, tt=clip.loop?((t%d)+d)%d:Math.min(d,Math.max(0,t));
  const ks=clip.keys;
  let i=0; while(i<ks.length-2 && ks[i+1].t<tt)i++;
  const a=ks[i],b=ks[i+1];
  const f=b.t>a.t?clamp((tt-a.t)/(b.t-a.t),0,1):0;
  const out=new Array(13);
  for(let j=0;j<13;j++){
    const A=a.p[j],B=b.p[j];
    out[j]=[lerp(A[0],B[0],f),lerp(A[1],B[1],f),lerp(A[2],B[2],f)];
  }
  return out;
}
const VIEWS=new Map();
function makeView(kind,id){
  const bones=JOINTS.map(j=>{ const b=new T.Bone(); b.position.set(j.o[0],j.o[1],j.o[2]); return b; });
  JOINTS.forEach((j,i)=>{ if(j.p>=0)bones[j.p].add(bones[i]); });
  const mesh=new T.SkinnedMesh(rigGeometry(kind),
    new T.MeshLambertMaterial({vertexColors:true}));
  mesh.add(bones[0]); mesh.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(bones));
  mesh.frustumCulled=false;
  // YXZ: yaw first, then pitch about the YAWED X axis -> a true forward somersault
  mesh.rotation.order='YXZ';
  // View scale comes from the figure descriptor (src/content/figures/<id>.js).
  mesh.scale.setScalar(FIGURE_SCALES[kind]||1);
  scene.add(mesh);
  const v={kind,id,mesh,bones,baseScale:mesh.scale.x,
    anim:{cur:'idle',prev:null,t:0,prevT:0,blend:1,weightSum:1},lastClip:'idle'};
  VIEWS.set(id,v);
  return v;
}
function setClip(v,name,t){
  const a=v.anim;
  if(a.cur===name)return;
  if(a.blend<1){ a.prev=a.cur; a.prevT=a.t; }   // chain a new fade from the current blend
  else { a.prev=a.cur; a.prevT=a.t; }
  a.cur=name; a.t=t||0; a.blend=0;
}
function updateAnim(v,dt,stateTime){
  const a=v.anim;
  a.t+=dt; a.prevT+=dt;
  a.blend=Math.min(1,a.blend+dt/CROSSFADE);
  const pB=sampleClip(CLIPS[a.cur]||CLIPS.idle,a.cur==='attack'?stateTime:a.t);
  const wA=a.prev?1-a.blend:0, wB=1-wA;
  const pA=a.prev?sampleClip(CLIPS[a.prev]||CLIPS.idle,a.prevT):null;
  a.weightSum=wA+wB;                       // EXACTLY 1.0 by construction
  for(let j=0;j<13;j++){
    const B=pB[j], A=pA?pA[j]:B;
    v.bones[j].rotation.set(A[0]*wA+B[0]*wB,A[1]*wA+B[1]*wB,A[2]*wA+B[2]*wB);
  }
  if(a.blend>=1)a.prev=null;
}
function clipFor(kind,st,speed){
  if(st==='roll')return 'roll';
  if(st==='attack'||st==='strike'||st==='slam')return 'attack';
  if(st==='hurt')return 'hurt';
  if(st==='dead')return 'death';
  if(st==='telegraph')return (ENEMIES[kind]&&ENEMIES[kind].cls==='ranged')?'cast':'telegraph';
  if(st==='chargeTele')return 'charge';
  if(st==='charge')return 'run';
  if(st==='recovery'||st==='recover'||st==='slamTele')return 'telegraph';
  if(st==='run'||st==='approach'||st==='chase')return speed>0.45?'run':'idle';
  return 'idle';
}
function syncViews(s,dt){
  const seen=new Set();
  for(let hi=0;hi<s.heroes.length;hi++){
    const h=s.heroes[hi], vid=hi===0?0:-1;
    let hv=VIEWS.get(vid);
    const skin=safeHero(HERO_SKINS[hi]);  // unknown id from an old save/peer -> default figure
    if(hv&&hv.kind!==skin){ scene.remove(hv.mesh); hv.mesh.material.dispose(); VIEWS.delete(vid); hv=null; }
    if(!hv)hv=makeView(skin,vid);
    seen.add(vid);
    const hs=h.downed?'dead':(h.hp<=0?'dead':h.state);
    const hClip=clipFor('hero',hs,Math.sqrt(h.vx*h.vx+h.vz*h.vz));
    setClip(hv,hClip,h.state==='attack'?h.st:undefined);
    updateAnim(hv,dt,h.state==='attack'?h.st:0);
    /* ROLL = a real forward somersault, not a dash. The mesh pitches a full
       360 deg about its own (yawed) X axis while the position is compensated
       so the body rotates around its centre of mass instead of its feet. */
    let rx=0,ry=0,rz=0,pitch=0,rollScale=1;
    if(h.state==='roll'&&h.hp>0){
      const p=clamp(h.st/CFG.hero.rollDur,0,1);
      pitch=p*TAU;
      const cy=0.72;                            // tucked centre of mass
      ry=cy-cy*Math.cos(pitch);
      const f=cy*Math.sin(pitch);
      rx=-Math.sin(h.yaw)*f; rz=-Math.cos(h.yaw)*f;
      rollScale=0.80;                           // ball up so the head clears the ground
    }
    hv.mesh.position.set(h.x+rx,ry,h.z+rz);
    hv.mesh.rotation.set(pitch,h.yaw,0);
    hv.mesh.scale.setScalar(hv.baseScale*rollScale);
    hv.mesh.visible=(s.phase!=='title');
  }
  for(let i=0;i<s.enemies.length;i++){
    const e=s.enemies[i]; seen.add(e.id);
    let v=VIEWS.get(e.id); if(!v)v=makeView(e.type,e.id);
    const clip=clipFor(e.type,e.state,Math.sqrt(e.vx*e.vx+e.vz*e.vz));
    setClip(v,clip);
    updateAnim(v,dt,0);
    v.mesh.position.set(e.x,0,e.z); v.mesh.rotation.y=e.yaw;
  }
  if(s.boss&&s.boss.hp>0){
    const b=s.boss; seen.add(b.id);
    let v=VIEWS.get(b.id); if(!v)v=makeView('boss',b.id);
    setClip(v,clipFor('boss',b.state,b.state==='approach'?8:10));
    updateAnim(v,dt,0);
    v.mesh.position.set(b.x,0,b.z); v.mesh.rotation.y=b.yaw;
  }
  for(const [id,v] of VIEWS){
    if(!seen.has(id)){ scene.remove(v.mesh); v.mesh.material.dispose(); VIEWS.delete(id); }
  }
}

/* ---------- gems / heal orbs / projectiles (cosmetic instancing) ---------- */
let gemMesh=null,healMesh=null,projMesh=null,shadowMesh=null,potionMesh=null;
/* LEGO-brick pickups: merged box/cylinder parts with per-vertex colours,
   so each pickup type stays ONE instanced draw call. Rectangular body,
   four raised studs, and an emblem on the top face — white cross for
   health, pale 4-point star for magic — readable at gameplay distance. */
function mergeParts(parts){
  const pos=[],nor=[],col=[],idx=[];
  const m4=new T.Matrix4(), r4=new T.Matrix4(), v=new T.Vector3();
  for(const p of parts){
    const g=p.geo, base=pos.length/3;
    r4.makeRotationY(p.ry||0);
    m4.copy(r4); m4.setPosition(p.x||0,p.y||0,p.z||0);
    const pa=g.getAttribute('position'), na=g.getAttribute('normal');
    for(let i=0;i<pa.count;i++){
      v.fromBufferAttribute(pa,i).applyMatrix4(m4); pos.push(v.x,v.y,v.z);
      v.fromBufferAttribute(na,i).applyMatrix4(r4).normalize(); nor.push(v.x,v.y,v.z);
      col.push(p.c[0],p.c[1],p.c[2]);
    }
    const ia=g.getIndex();
    for(let i=0;i<ia.count;i++)idx.push(base+ia.getX(i));
  }
  const out=new T.BufferGeometry();
  out.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  out.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
  out.setAttribute('color',new T.Float32BufferAttribute(col,3));
  out.setIndex(idx);
  return out;
}
function brickGeo(kind){
  const heal=kind==='heal';
  const body=heal?[0.80,0.07,0.08]:[0.40,0.17,0.88];
  const stud=heal?[0.88,0.13,0.14]:[0.54,0.32,0.98];
  const emb =heal?[0.96,0.96,0.96]:[0.88,0.94,1.00];
  const parts=[{geo:new T.BoxGeometry(0.68,0.30,0.52),x:0,y:0,z:0,c:body}];
  for(const sx of [-0.19,0.19])for(const sz of [-0.15,0.15])
    parts.push({geo:new T.CylinderGeometry(0.08,0.08,0.09,10),x:sx,y:0.195,z:sz,c:stud});
  if(heal){
    parts.push({geo:new T.BoxGeometry(0.14,0.03,0.40),x:0,y:0.165,z:0,c:emb});
    parts.push({geo:new T.BoxGeometry(0.52,0.03,0.14),x:0,y:0.165,z:0,c:emb});
  }else{
    parts.push({geo:new T.BoxGeometry(0.42,0.03,0.13),x:0,y:0.165,z:0,ry: Math.PI/4,c:emb});
    parts.push({geo:new T.BoxGeometry(0.42,0.03,0.13),x:0,y:0.165,z:0,ry:-Math.PI/4,c:emb});
  }
  return mergeParts(parts);
}
function setupPickupMeshes(){
  gemMesh=new T.InstancedMesh(new T.DodecahedronGeometry(0.24,0),
    new T.MeshLambertMaterial({color:0x49c8ff,emissive:0x0d4c78}),64);
  healMesh=new T.InstancedMesh(brickGeo('heal'),
    new T.MeshLambertMaterial({vertexColors:true,emissive:0x2a0508}),32);
  projMesh=new T.InstancedMesh(new T.SphereGeometry(0.34,8,6),
    new T.MeshBasicMaterial({color:0xc46bff}),24);
  shadowMesh=new T.InstancedMesh(new T.CircleGeometry(1,14),
    new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28,depthWrite:false}),CFG.maxEntities);
  potionMesh=new T.InstancedMesh(brickGeo('magic'),
    new T.MeshLambertMaterial({vertexColors:true,emissive:0x120a2e}),16);
  for(const m of [gemMesh,healMesh,projMesh,shadowMesh,potionMesh]){m.frustumCulled=false;m.count=0;scene.add(m);}
}
function updatePickupMeshes(s,time){
  let n=0;
  for(const g of s.gems){ if(n>=64)break;
    dummy.position.set(g.x,0.42+Math.sin(time*3+g.x)*0.08,g.z);
    dummy.rotation.set(0,time*1.6+g.z,0);dummy.scale.setScalar(1);
    dummy.updateMatrix();gemMesh.setMatrixAt(n++,dummy.matrix); }
  gemMesh.count=n;gemMesh.instanceMatrix.needsUpdate=true;
  n=0;
  for(const o of s.heals){ if(n>=32)break;
    dummy.position.set(o.x,0.45+Math.sin(time*4+o.z)*0.08,o.z);
    dummy.rotation.set(0,0,0);dummy.scale.setScalar(1);
    dummy.updateMatrix();healMesh.setMatrixAt(n++,dummy.matrix); }
  healMesh.count=n;healMesh.instanceMatrix.needsUpdate=true;
  n=0;
  for(const o of s.potions){ if(n>=16)break;
    dummy.position.set(o.x,0.5+Math.sin(time*4.6+o.x)*0.09,o.z);
    dummy.rotation.set(0,time*2.2+o.z,0);dummy.scale.setScalar(1);
    dummy.updateMatrix();potionMesh.setMatrixAt(n++,dummy.matrix); }
  potionMesh.count=n;potionMesh.instanceMatrix.needsUpdate=true;
  n=0;
  for(const p of s.projectiles){ if(n>=24)break;
    dummy.position.set(p.x,1.0,p.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(p.r/0.34);
    dummy.updateMatrix();projMesh.setMatrixAt(n++,dummy.matrix); }
  projMesh.count=n;projMesh.instanceMatrix.needsUpdate=true;
  // blob shadows: hero + enemies + boss, one draw call
  n=0;
  const put=(x,z,r)=>{ if(n>=CFG.maxEntities)return;
    dummy.position.set(x,0.025,z);dummy.rotation.set(-Math.PI/2,0,0);
    dummy.scale.set(r, r, 1);dummy.updateMatrix();shadowMesh.setMatrixAt(n++,dummy.matrix); };
  for(const h of s.heroes)put(h.x,h.z,0.55);
  for(const e of s.enemies)put(e.x,e.z,0.5);
  if(s.boss&&s.boss.hp>0)put(s.boss.x,s.boss.z,1.25);
  shadowMesh.count=n;shadowMesh.instanceMatrix.needsUpdate=true;
}

/* ---------- VFX: particles, splatters, floating numbers, shake ---------- */
const PMAX=380;
let parts=null,pPos=null,pCol=null,pVel=null,pLife=null,pHead=0;
let splatMesh=null,splats=[];
const splatCells=new Float32Array(48);
const _splatCol=new T.Color();
let nums=[];
function setupVFX(){
  const g=new T.BufferGeometry();
  pPos=new Float32Array(PMAX*3);pCol=new Float32Array(PMAX*3);
  pVel=new Float32Array(PMAX*3);pLife=new Float32Array(PMAX);
  for(let i=0;i<PMAX;i++)pPos[i*3+1]=-999;
  g.setAttribute('position',new T.BufferAttribute(pPos,3));
  g.setAttribute('color',new T.BufferAttribute(pCol,3));
  parts=new T.Points(g,new T.PointsMaterial({size:0.22,vertexColors:true,transparent:true,
    opacity:0.95,depthWrite:false,blending:T.AdditiveBlending,sizeAttenuation:true}));
  parts.frustumCulled=false;scene.add(parts);
  splatMesh=new T.InstancedMesh(new T.PlaneGeometry(2,2),
    new T.MeshBasicMaterial({map:splatAtlasTex(),transparent:true,opacity:0.62,depthWrite:false}),48);
  splatMesh.geometry.setAttribute('aCell',new InstancedBufferAttribute(splatCells,1));
  splatMesh.material.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader
      .replace('#include <common>','#include <common>\nattribute float aCell;\nvarying float vCell;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvCell=aCell;');
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <common>','#include <common>\nvarying float vCell;')
      .replace('#include <map_fragment>','#ifdef USE_MAP\n\tvec4 sampledDiffuseColor = texture2D( map, vMapUv*0.5 + vec2(mod(vCell,2.0),1.0-floor(vCell/2.0))*0.5 );\n\tdiffuseColor *= sampledDiffuseColor;\n#endif');
  };
  splatMesh.frustumCulled=false;splatMesh.count=0;scene.add(splatMesh);
  for(let i=0;i<48;i++)splatMesh.setColorAt(i,_splatCol.setRGB(1,1,1));
  setupSlashFX();
  setupBolts();
}
function burst(x,y,z,color,n,power){
  for(let i=0;i<n;i++){
    const k=pHead++%PMAX;
    pPos[k*3]=x;pPos[k*3+1]=y;pPos[k*3+2]=z;
    const a=CRNG()*TAU,sp=power*(0.4+CRNG()*0.9);
    pVel[k*3]=Math.cos(a)*sp;pVel[k*3+1]=1.2+CRNG()*3.4;pVel[k*3+2]=Math.sin(a)*sp;
    pCol[k*3]=color[0];pCol[k*3+1]=color[1];pCol[k*3+2]=color[2];
    pLife[k]=0.45+CRNG()*0.45;
  }
}
function splatAt(x,z,type,dir){
  splats.push({x,z,t:0,s:0.8+CRNG()*0.6,cell:(CRNG()*4)|0,tint:splatTint(type),
    rot:(dir===undefined?CRNG()*TAU:dir-Math.PI/2+(CRNG()-0.5)*0.5)});
  if(splats.length>48)splats.shift();
}
function damageNumber(x,y,z,text,crit){
  const el=document.createElement('div');
  el.className='dnum';el.textContent=text;
  el.style.color=crit?'#ffd257':'#ff8b72';
  $('nums').appendChild(el);
  nums.push({el,x,y,z,t:0,life:0.85,vy:1.5,dx:(CRNG()-0.5)*0.6,dz:(CRNG()-0.5)*0.6});
}
function updateVFX(dt,time){
  for(let i=0;i<PMAX;i++){
    if(pLife[i]<=0)continue;
    pLife[i]-=dt;
    if(pLife[i]<=0){pPos[i*3+1]=-999;continue;}
    pPos[i*3]+=pVel[i*3]*dt;pPos[i*3+1]+=pVel[i*3+1]*dt;pPos[i*3+2]+=pVel[i*3+2]*dt;
    pVel[i*3+1]-=9.8*dt;
    const f=Math.min(1,pLife[i]*2);
    pCol[i*3]*=0.985;pCol[i*3+1]*=0.985;pCol[i*3+2]*=0.985;
  }
  parts.geometry.getAttribute('position').needsUpdate=true;
  parts.geometry.getAttribute('color').needsUpdate=true;
  let n=0;
  for(const s of splats){
    s.t+=dt;const f=1-s.t/6;if(f<=0)continue;
    const k=0.6+f*0.7;
    dummy.position.set(s.x,0.03,s.z);dummy.rotation.set(-Math.PI/2,0,s.rot);
    dummy.scale.set(s.s*1.38*k,s.s*0.92*k,1);
    dummy.updateMatrix();splatMesh.setMatrixAt(n,dummy.matrix);
    splatCells[n]=s.cell;_splatCol.setRGB(s.tint[0],s.tint[1],s.tint[2]);
    splatMesh.setColorAt(n,_splatCol);n++;
  }
  splatMesh.count=n;splatMesh.instanceMatrix.needsUpdate=true;
  splatMesh.geometry.getAttribute('aCell').needsUpdate=true;
  if(splatMesh.instanceColor)splatMesh.instanceColor.needsUpdate=true;
  if(splats.length&&splats[0].t>6)splats=splats.filter(s=>s.t<=6);
  for(let i=nums.length-1;i>=0;i--){
    const q=nums[i];q.t+=dt;
    if(q.t>=q.life){q.el.remove();nums.splice(i,1);continue;}
    q.y+=q.vy*dt;q.x+=q.dx*dt;q.z+=q.dz*dt;q.vy-=2.2*dt;
    _v.set(q.x,q.y,q.z).project(camera);
    const sx=(_v.x*0.5+0.5)*innerWidth, sy=(-_v.y*0.5+0.5)*innerHeight;
    q.el.style.transform='translate('+sx+'px,'+sy+'px) scale('+(1+q.t*0.3)+')';
    q.el.style.opacity=String(1-q.t/q.life);
  }
  SHAKE=Math.max(0,SHAKE-dt*2.6);
}
/* ---------- splash marks + sword slash FX (cosmetic only) ---------- */
function splatTint(type){
  const t=(TINTS[type]&&TINTS[type].glow)||[1,0.5,0.3];
  return [0.20+0.34*t[0], 0.05+0.12*t[1], 0.045+0.15*t[2]];
}
/* 4 irregular water-splash designs in a 2x2 canvas atlas: a smoothed
   random-radius blob, tapered droplet streaks fanned toward +u (the blow
   direction after instance rotation) and satellite droplets. Drawn white;
   the per-instance colour supplies the enemy-tinted juice colour. */
function splatAtlasTex(){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=512;
  const g=cv.getContext('2d'), R=mkRng(0x591A7);
  for(let cell=0;cell<4;cell++){
    const cx=(cell%2)*256+128, cy=((cell/2)|0)*256+128;
    const NP=14, pts=[];
    for(let i=0;i<NP;i++){
      const a=i/NP*TAU, r=40+R()*26;
      pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r*0.85]);
    }
    g.fillStyle='rgba(255,255,255,0.95)';
    g.beginPath();
    for(let i=0;i<NP;i++){
      const p=pts[i], q=pts[(i+1)%NP], mx=(p[0]+q[0])/2, my=(p[1]+q[1])/2;
      if(i===0)g.moveTo(mx,my); else g.quadraticCurveTo(p[0],p[1],mx,my);
    }
    g.closePath(); g.fill();
    g.fillStyle='rgba(255,255,255,0.75)';
    g.beginPath(); g.ellipse(cx,cy,26+R()*10,20+R()*8,R()*TAU,0,TAU); g.fill();
    g.strokeStyle='rgba(255,255,255,0.88)'; g.lineCap='round';
    for(let sN=0;sN<10;sN++){
      const a=sN<7?(R()-0.5)*3.4:(R()-0.5)*TAU;
      const r0=30+R()*22, r1=r0+36+R()*34;
      g.lineWidth=4.5+R()*5.5;
      g.beginPath();
      g.moveTo(cx+Math.cos(a)*r0, cy+Math.sin(a)*r0*0.85);
      g.lineTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1*0.85);
      g.stroke();
    }
    const nd=6+((R()*5)|0);
    for(let dN=0;dN<nd;dN++){
      const a=R()*TAU, d=78+R()*28, r=4+R()*7;
      g.fillStyle='rgba(255,255,255,0.92)';
      g.beginPath(); g.ellipse(cx+Math.cos(a)*d, cy+Math.sin(a)*d*0.85, r, r*0.8, a, 0, TAU); g.fill();
    }
  }
  return new T.CanvasTexture(cv);
}
/* Slash edge: a SLIM luminous arc line (no filled crescent surface)
   built in the XZ plane, facing +Z. 3 rows (dim rim -> bright core ->
   dim rim) so one additive InstancedMesh with per-instance brightness
   does the whole effect in a single draw call. Visual only — the sim's
   hit test never reads this geometry. */
function crescentGeo(){
  const SEG=26, SPAN=96*DEG, RC=2.02, HW=0.055;
  const pos=[], col=[], idx=[];
  for(let i=0;i<=SEG;i++){
    const u=i/SEG, a=(u-0.5)*SPAN, w=Math.pow(Math.sin(Math.PI*u),0.6);
    const sa=Math.sin(a), ca=Math.cos(a);
    const rI=RC-HW*w, rM=RC, rO=RC+HW*w;
    pos.push(sa*rI,0,ca*rI, sa*rM,0,ca*rM, sa*rO,0,ca*rO);
    col.push(0.30,0.42,0.66, 0.92,0.97,1.0, 0.30,0.42,0.66);
  }
  for(let i=0;i<SEG;i++){ const b=i*3;
    idx.push(b,b+3,b+1, b+1,b+3,b+4, b+1,b+4,b+2, b+2,b+4,b+5); }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(col,3));
  geo.setIndex(idx);
  return geo;
}
let slashMesh=null, trailMesh=null, trailPos=null, trailCol=null;
let slashDummy=null;
const slashSlots=[];
const swingSeen=[{id:-1},{id:-1}];   // per-hero attackId tracking (slash FX)
const TRAIL_N=30;
let trailPts=[], trailFade=0;
/* One weapon-tip anchor per playable skin, derived from the hero registry.
   Adding a skin file automatically adds its tip here; the lookup below
   still falls back to the default hero tip for an unknown kind. */
const SLASH_TIP = HERO_SLASH_TIPS;
const _tipV=new T.Vector3(), _baseV=new T.Vector3(), _dirV=new T.Vector3(), _innV=new T.Vector3();
function setupSlashFX(){
  slashDummy=new T.Object3D(); slashDummy.rotation.order='YXZ';
  slashMesh=new T.InstancedMesh(crescentGeo(),
    new T.MeshBasicMaterial({vertexColors:true,transparent:true,
      blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}),6);
  slashMesh.frustumCulled=false;
  for(let i=0;i<6;i++){
    slashSlots.push({on:false,id:-1,yaw:0,dir:1,age:9,hi:0});
    slashDummy.position.set(0,-50,0); slashDummy.scale.setScalar(0.001);
    slashDummy.rotation.set(0,0,0); slashDummy.updateMatrix();
    slashMesh.setMatrixAt(i,slashDummy.matrix);
    slashMesh.setColorAt(i,_splatCol.setRGB(0,0,0));
  }
  slashMesh.instanceMatrix.needsUpdate=true;
  scene.add(slashMesh);
  trailPos=new Float32Array(TRAIL_N*6); trailCol=new Float32Array(TRAIL_N*6);
  for(let i=0;i<TRAIL_N;i++)trailPos[i*6+1]=-50,trailPos[i*6+4]=-50;
  const tg=new T.BufferGeometry();
  tg.setAttribute('position',new T.BufferAttribute(trailPos,3));
  tg.setAttribute('color',new T.BufferAttribute(trailCol,3));
  const tidx=[];
  for(let i=0;i<TRAIL_N-1;i++){ const b=i*2;
    tidx.push(b,b+1,b+2, b+1,b+3,b+2); }
  tg.setIndex(tidx);
  trailMesh=new T.Mesh(tg,new T.MeshBasicMaterial({vertexColors:true,transparent:true,
    blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
  trailMesh.frustumCulled=false;
  scene.add(trailMesh);
}
/* Drives ONLY from sim state the view already reads (hero.state/st/attackId)
   plus the posed hero skeleton: zero sim writes, digest-safe. */
function updateSlashFX(s,dt){
  if(!slashMesh)return;
  /* crescents: tracked per hero into the shared slot pool */
  for(let hi=0;hi<s.heroes.length;hi++){
    const h=s.heroes[hi], seenS=swingSeen[hi];
    if(h.attackId<seenS.id)seenS.id=h.attackId;      // resync after reset
    if(h.state==='attack'&&h.attackId!==seenS.id){
      seenS.id=h.attackId;
      const sl=slashSlots.find(x=>!x.on)||slashSlots[0];
      sl.on=true; sl.id=h.attackId; sl.hi=hi; sl.yaw=h.yaw;
      sl.dir=(h.attackId%2===0)?1:-1; sl.age=h.st;   // alternate fore/backhand
      if(hi===LOCAL_IDX){ trailPts.length=0; trailFade=1; }
    }
  }
  for(let i=0;i<6;i++){
    const sl=slashSlots[i];
    const h=sl.on?s.heroes[sl.hi]:null;
    if(sl.on){
      if(h&&sl.id===h.attackId&&h.state==='attack')sl.age=h.st;
      else sl.age+=dt*3.2;                           // swing ended: run clock out
      if(sl.age>0.52)sl.on=false;
    }
    if(!sl.on||!h){
      sl.b=0;
      slashDummy.position.set(0,-50,0); slashDummy.scale.setScalar(0.001);
      slashDummy.rotation.set(0,0,0);
    }else{
      const t=sl.age, q=clamp(t/0.30,0,1), qe=1-(1-q)*(1-q);
      const sweep=sl.dir*(0.92-1.84*qe);              // +53 deg -> -53 deg
      sl.b=0;
      if(t>0.03)sl.b=0.50*Math.min(1,(t-0.03)/0.10);  // peak covers hitAt 0.25 s
      if(t>0.27)sl.b=0.50*Math.max(0,1-(t-0.27)/0.20);
      slashDummy.position.set(h.x,1.06,h.z);
      slashDummy.rotation.set(0,sl.yaw+sweep,sl.dir*0.30);
      const sc=0.92+0.14*qe; slashDummy.scale.set(sc,1,sc);
    }
    slashDummy.updateMatrix();
    slashMesh.setMatrixAt(i,slashDummy.matrix);
    slashMesh.setColorAt(i,_splatCol.setRGB(sl.b||0,sl.b||0,sl.b||0));
  }
  slashMesh.instanceMatrix.needsUpdate=true;
  if(slashMesh.instanceColor)slashMesh.instanceColor.needsUpdate=true;
  slashMesh.visible=slashSlots.some(sl=>sl.on);
  /* --- blade trail: ribbon for the LOCAL hero's weapon only --- */
  const h=localHero(s), hv=VIEWS.get(LOCAL_IDX===0?0:-1);
  const swinging=h.state==='attack'&&h.st<=0.46&&hv;
  if(swinging){
    hv.mesh.updateMatrixWorld(true);
    const tip=SLASH_TIP[hv.kind]||SLASH_TIP.hero, bone=hv.bones[tip.b];
    _tipV.set(tip.o[0],tip.o[1],tip.o[2]).applyMatrix4(bone.matrixWorld);
    bone.getWorldPosition(_baseV);
    _dirV.copy(_tipV).sub(_baseV);
    const L=_dirV.length()||1; _dirV.divideScalar(L);
    _innV.copy(_tipV).addScaledVector(_dirV,-Math.min(0.40,L*0.45));
    const last=trailPts[trailPts.length-1];
    if(last){
      for(let j=1;j<=3;j++){
        const f=j/3;
        trailPts.push({tip:last.tip.clone().lerp(_tipV,f), inn:last.inn.clone().lerp(_innV,f)});
      }
    }else trailPts.push({tip:_tipV.clone(), inn:_innV.clone()});
    while(trailPts.length>TRAIL_N)trailPts.shift();
    trailFade=1;
  }else if(trailPts.length){
    trailFade=Math.max(0,trailFade-dt*6);
    if(trailFade<=0)trailPts.length=0;
  }
  const n=trailPts.length;
  for(let i=0;i<TRAIL_N;i++){
    const p=n?trailPts[Math.min(i,n-1)]:null;
    trailPos[i*6]=p?p.tip.x:0; trailPos[i*6+1]=p?p.tip.y:-50; trailPos[i*6+2]=p?p.tip.z:0;
    trailPos[i*6+3]=p?p.inn.x:0; trailPos[i*6+4]=p?p.inn.y:-50; trailPos[i*6+5]=p?p.inn.z:0;
    let b=0;
    if(n>1)b=Math.pow(Math.min(i,n-1)/(n-1),1.5)*trailFade;
    trailCol[i*6]=b*0.50; trailCol[i*6+1]=b*0.58; trailCol[i*6+2]=b*0.66;
    trailCol[i*6+3]=b*0.13; trailCol[i*6+4]=b*0.18; trailCol[i*6+5]=b*0.28;
  }
  trailMesh.geometry.getAttribute('position').needsUpdate=true;
  trailMesh.geometry.getAttribute('color').needsUpdate=true;
  trailMesh.visible=trailPts.length>0;
}

/* ---------- magic lightning (cosmetic only) ----------
   Pooled jagged bolts that drop out of the sky onto every target a magic
   cast actually hit. Driven by the sim's 'bolt' events, which both co-op
   clients emit identically because they run the same deterministic sim —
   so a guest's cast strikes the same targets on the host's screen too.
   Each bolt is ONE mesh (crossed jagged ribbons, bright core + violet
   sheath, pre-generated geometry variants); the pool is invisible and
   costs no draw calls between casts. */
const BOLT_POOL=12, BOLT_LIFE=0.24;
let boltMeshes=[], boltState=[];
function boltGeo(variant){
  const SEG=6, pos=[], col=[], idx=[];
  const R=mkRng(0xB017+variant*77);
  const pts=[[0,8.4,0]];
  for(let i=1;i<SEG;i++){
    const t=i/SEG;
    pts.push([(R()-0.5)*1.15*(1-t*0.75), 8.4-7.3*t, (R()-0.5)*1.15*(1-t*0.75)]);
  }
  pts.push([0,1.1,0]);
  for(const pa of [0,Math.PI/2]){
    const ca=Math.cos(pa), sa=Math.sin(pa), base=pos.length/3;
    for(let i=0;i<pts.length;i++){
      const p=pts[i], t=i/(pts.length-1), w=0.17*(1-t*0.55), wc=w*0.38;
      pos.push(p[0]-ca*w,p[1],p[2]-sa*w, p[0]+ca*w,p[1],p[2]+sa*w);
      col.push(0.45,0.38,1.00, 0.45,0.38,1.00);
      pos.push(p[0]-ca*wc,p[1],p[2]-sa*wc, p[0]+ca*wc,p[1],p[2]+sa*wc);
      col.push(0.93,0.96,1.00, 0.93,0.96,1.00);
      if(i>0){ const q=base+(i-1)*4;
        idx.push(q,q+4,q+1, q+1,q+4,q+5, q+2,q+6,q+3, q+3,q+6,q+7); }
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new T.Float32BufferAttribute(col,3));
  g.setIndex(idx);
  return g;
}
function setupBolts(){
  for(let i=0;i<BOLT_POOL;i++){
    const m=new T.Mesh(boltGeo(i%4),
      new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0,
        blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false}));
    m.frustumCulled=false; m.visible=false; scene.add(m);
    boltMeshes.push(m); boltState.push({t:9});
  }
}
function fireBolt(x,z,big){
  let idx=boltState.findIndex(b=>b.t>=BOLT_LIFE);
  if(idx<0)idx=0;
  boltState[idx].t=0;
  const m=boltMeshes[idx];
  m.position.set(x,0,z); m.rotation.y=CRNG()*Math.PI;
  m.scale.setScalar(big?1.45:1);
  m.visible=true;
}
function updateBolts(dt){
  for(let i=0;i<BOLT_POOL;i++){
    const sl=boltState[i];
    if(sl.t>=BOLT_LIFE){ boltMeshes[i].visible=false; continue; }
    sl.t+=dt;
    const u=Math.min(1,sl.t/BOLT_LIFE);
    boltMeshes[i].material.opacity=0.92*(u<0.16?u/0.16:Math.max(0,1-(u-0.16)/0.84));
    boltMeshes[i].visible=sl.t<BOLT_LIFE;
  }
}

function consumeEvents(){
  for(let i=0;i<EV.length;i++){
    const e=EV[i];
    switch(e.type){
      /* Camera shake used to call the render-layer FXSHAKE() directly from
         PART 2. The sim now only emits a cosmetic event; the view applies it
         here. EV is drained by runHeadless() and never hashed by simDigest,
         so the deterministic baseline is unchanged. */
      case 'shake': FXSHAKE(e.v); break;
      case 'swing': Audio.whoosh(); break;
      case 'hit': {
        const col=e.unit==='boss'?[1,.45,.2]:[1,.55,.35];
        burst(e.x,e.y||1.4,e.z,col,e.crit?14:9,e.crit?4.4:3.1);
        damageNumber(e.x,(e.y||1.4)+0.35,e.z,(e.crit?'✦ ':'')+e.dmg,e.crit);
        Audio.hit(e.crit);break; }
      case 'kill': burst(e.x,1.2,e.z,TINTS[e.unit]?TINTS[e.unit].glow:[1,.5,.3],16,4.2);
        Audio.kill();break;
      case 'splat': splatAt(e.x,e.z,e.unit,SIM.hero.yaw);break;
      case 'cancel': burst(e.x,1.7,e.z,[0.5,0.9,1],8,2.2);break;
      case 'hurt': burst(e.x,1.3,e.z,[1,.2,.18],12,3.4);Audio.hurt();break;
      case 'heal': damageNumber(e.x,1.5,e.z,'+'+e.amount,false);burst(e.x,1,e.z,[.3,1,.5],10,2.2);break;
      case 'gem': Audio.gem();break;
      case 'roll': Audio.whoosh(0.7); burst(e.x,0.30,e.z,[0.80,0.74,0.60],7,1.7); break;
      case 'shot': Audio.shot();burst(e.x,1.4,e.z,[.8,.4,1],8,2.0);break;
      case 'projBlast': {
        const r=e.r||1.5;
        burst(e.x,0.9,e.z,[.75,.45,1],Math.round(10+r*6),2.4+r*1.6);
        splatAt(e.x,e.z,e.unit||'sorcerer',SIM.hero.yaw);break; }
      case 'bossSpawn': Audio.boss();break;
      case 'bossCharge': Audio.whoosh(1.3);break;
      case 'bossSlam': burst(e.x,0.6,e.z,[1,.4,.15],22,5.5);break;
      case 'bossSlamFx': burst(e.x,0.4,e.z,[1,.5,.2],18,5.0);break;
      case 'bossDeath': burst(e.x,2.2,e.z,[1,.6,.2],34,6.5);Audio.kill();break;
      case 'death': Audio.death();break;
      case 'levelup': Audio.level();break;
      case 'upgrade': break;
      case 'chapter': Audio.level();break;
      case 'victory': Audio.level();break;
      case 'event': showBanner('\u26A0 ELITE INCOMING \u26A0',2600); Audio.boss(); break;
      case 'enrage': showBanner('\u2620 THE WARDEN RAGES \u2620',2600); Audio.boss(); break;
      case 'summon': burst(e.x,1.6,e.z,[1,.5,.2],18,4.0); break;
      case 'potion': damageNumber(e.x,1.5,e.z,'+MAGIC',false); burst(e.x,1,e.z,[.77,.42,1],10,2.2); Audio.gem(); break;
      case 'bolt': fireBolt(e.x,e.z,e.boss); burst(e.x,1.15,e.z,[.72,.62,1],10,2.8); break;
      case 'magic': { burst(e.x,1.2,e.z,[.77,.42,1],46,7.0); burst(e.x,0.5,e.z,[.9,.7,1],30,9.0);
        const fl=$('flash'); fl.style.transition='none'; fl.style.opacity='0.5';
        requestAnimationFrame(()=>{ fl.style.transition='opacity .45s'; fl.style.opacity='0'; });
        Audio.level(); break; }
    }
  }
  EV.length=0;                      // drains a cosmetic buffer, never sim state
}

/* ---------- WebAudio: 100% synthesized ---------- */
const Audio=(function(){
  let ac=null,master=null,noiseBuf=null,muted=false,timer=null,next=0,step=0,intensity=0;
  function init(){
    if(ac)return true;
    try{
      const C=window.AudioContext||window.webkitAudioContext; if(!C)return false;
      ac=new C(); master=ac.createGain(); master.gain.value=muted?0:0.42;
      master.connect(ac.destination);
      noiseBuf=ac.createBuffer(1,44100,44100);
      const ch=noiseBuf.getChannelData(0);
      let seed=1234567;
      for(let i=0;i<44100;i++){ seed=nextU32(seed); ch[i]=(seed/2147483648)-1; }
      next=ac.currentTime+0.05;
      timer=setInterval(schedule,25);
      return true;
    }catch(e){ return false; }
  }
  function env(g,t,a,d,peak){ g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002,peak),t+a);
    g.gain.exponentialRampToValueAtTime(0.0001,t+a+d); }
  function tone(f0,f1,dur,type,peak,when){
    if(!ac)return; const t=when||ac.currentTime;
    const o=ac.createOscillator(),g=ac.createGain();
    o.type=type||'sine';o.frequency.setValueAtTime(f0,t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
    env(g,t,0.008,dur,peak);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+0.05);
  }
  function noise(dur,f0,f1,peak,q,when){
    if(!ac||!noiseBuf)return;const t=when||ac.currentTime;
    const s=ac.createBufferSource();s.buffer=noiseBuf;
    const f=ac.createBiquadFilter();f.type='bandpass';f.Q.value=q||1.1;
    f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(Math.max(60,f1),t+dur);
    const g=ac.createGain();env(g,t,0.006,dur,peak);
    s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur+0.04);
  }
  // war-drum battle loop with an intensity knob (0..1)
  function schedule(){
    if(!ac||ac.state!=='running')return;
    const bpm=78+intensity*54, beat=60/bpm/2;
    while(next<ac.currentTime+0.16){
      const t=next;
      if(step%4===0){ tone(105,42,0.24,'sine',0.52,t); noise(0.07,220,90,0.14,0.8,t); }
      if(step%4===2 && intensity>0.28)tone(150,78,0.18,'triangle',0.26,t);
      if(step%8===6)tone(190,110,0.14,'triangle',0.20,t);
      if(intensity>0.62 && step%2===1)noise(0.045,6500,3000,0.055,0.7,t);
      if(step%16===0)tone(55,44,0.9,'sine',0.14,t);
      step++;next+=beat;
    }
  }
  return {
    init, get ready(){return !!ac;}, get muted(){return muted;},
    setIntensity(v){intensity=clamp(v,0,1);},
    toggle(){muted=!muted;if(master)master.gain.value=muted?0:0.42;return muted;},
    whoosh(k){ if(!init())return;noise(0.17,1500*(k||1),260,0.19*(k||1),0.8); },
    hit(crit){ if(!init())return; tone(150,52,0.13,'sine',0.45);noise(0.09,900,180,0.24,0.9);
      if(crit)tone(880,1320,0.16,'triangle',0.16); },
    kill(){ if(!init())return;tone(230,60,0.28,'sawtooth',0.22); },
    hurt(){ if(!init())return;tone(260,95,0.24,'sawtooth',0.30);noise(0.12,500,120,0.18,0.7); },
    death(){ if(!init())return;tone(330,45,0.85,'sawtooth',0.30); },
    gem(){ if(!init())return;tone(760,1180,0.10,'sine',0.16); },
    shot(){ if(!init())return;noise(0.13,2100,600,0.14,1.4); },
    boss(){ if(!init())return;tone(110,55,0.9,'sawtooth',0.34);tone(220,110,0.9,'triangle',0.18); },
    level(){ if(!init())return;[0,0.09,0.18].forEach((d,i)=>tone(440*(1+i*0.25),660*(1+i*0.25),0.20,'triangle',0.18,ac.currentTime+d)); },
    stop(){ if(timer)clearInterval(timer); }
  };
})();

/* =====================================================================
   PART 4 — UI / INPUT / MAIN LOOP / VERIFICATION HOOKS
   ===================================================================== */
setupPickupMeshes(); setupVFX(); buildMapMeshes(SIM);

/* BOSS_NAMES is derived from src/content/enemies/bosses/*.js (chapter order). */
const UI={tiltX:0,tiltY:0,stickActive:false,stickId:null,attack:false,atkBuf:0,
          rollLatch:false,magicLatch:false,upgradeLatch:-1,keys:Object.create(null)};
/* A tap shorter than one rendered frame used to vanish between two sim steps
   (very common on a phone at 30-45 fps). Every press now also arms a short
   buffer, so the swing is guaranteed to start even if pointerup lands first. */
const ATK_BUFFER=0.25;
const INPUT_LOG={pointerdown:0,pointermove:0,pointerup:0,touch:0,keydown:0,attackPress:0,rollPress:0,magicPress:0};
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
   frames. Proven binding (phone-playtested line): pointerdown registers the
   press FIRST, before any cosmetic work; a window-level pointerup releases.
   No compat-event layers, no dedupe windows, no force-release on other
   fingers lifting -- those ate real inputs. */
const BTN_PTR={btnAttack:new Set(),btnRoll:new Set()};
function bindButton(id,isRoll){
  const el=$(id),set=BTN_PTR[id];
  el.addEventListener('pointerdown',e=>{
    e.preventDefault();
    // Register the press FIRST, before any cosmetic work, so a dropped audio
    // context or a slow frame can never swallow the input.
    set.add(e.pointerId);el.classList.add('press');
    if(isRoll){UI.rollLatch=true;INPUT_LOG.rollPress++;}
    else{UI.attack=true;UI.atkBuf=ATK_BUFFER;INPUT_LOG.attackPress++;}
    if(e.pointerType==='touch')INPUT_LOG.touch++;
    INPUT_LOG.pointerdown++;
    Audio.init();
  });
  const up=e=>{e.preventDefault();INPUT_LOG.pointerup++;buttonRelease(id,e.pointerId);};
  el.addEventListener('pointerup',up);
  el.addEventListener('pointercancel',up);
}
function buttonRelease(id,pid){
  const set=BTN_PTR[id];if(!set)return;
  set.delete(pid);
  if(!set.size){$(id).classList.remove('press');if(id==='btnAttack')UI.attack=false;}
}
addEventListener('pointerup',e=>{buttonRelease('btnAttack',e.pointerId);buttonRelease('btnRoll',e.pointerId);});
addEventListener('pointercancel',e=>{buttonRelease('btnAttack',e.pointerId);buttonRelease('btnRoll',e.pointerId);});
bindButton('btnAttack',false); bindButton('btnRoll',true);
BTN_PTR.btnMagic=new Set();
(function(){
  const el=$('btnMagic'),set=BTN_PTR.btnMagic;
  el.addEventListener('pointerdown',e=>{
    e.preventDefault();
    set.add(e.pointerId);el.classList.add('press');
    UI.magicLatch=true;INPUT_LOG.magicPress++;INPUT_LOG.pointerdown++;
    if(e.pointerType==='touch')INPUT_LOG.touch++;
    Audio.init();
  });
  const up=e=>{e.preventDefault();buttonRelease('btnMagic',e.pointerId);};
  el.addEventListener('pointerup',up);
  el.addEventListener('pointercancel',up);
  addEventListener('pointerup',e=>{buttonRelease('btnMagic',e.pointerId);});
  addEventListener('pointercancel',e=>{buttonRelease('btnMagic',e.pointerId);});
})();

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

/* ---------- armoury modal wiring ---------- */
$('armClose').addEventListener('click',()=>{closeArmoury();});
$('armoury').addEventListener('pointerdown',e=>{if(e.target===$('armoury'))closeArmoury();});

/* ---------- keyboard ---------- */
const GAME_KEYS=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','j','k','shift','p','m','f','g','enter']);
addEventListener('keydown',e=>{
  if(e.target&&e.target.id==='coopInput')return;
  const k=e.key.toLowerCase();
  if(GAME_KEYS.has(k))e.preventDefault();
  if(!UI.keys[k]){
    INPUT_LOG.keydown++;
    if(k==='shift'||k==='k'){UI.rollLatch=true;INPUT_LOG.rollPress++;}
    if(k===' '||k==='j')UI.atkBuf=ATK_BUFFER;
    if(k==='g'){UI.magicLatch=true;INPUT_LOG.magicPress++;}
    if(k==='enter'&&SIM.phase==='title')startRun();
    if(k==='m'){Audio.init();const m=Audio.toggle();$('btnMute').innerHTML=m?'&#128263;':'&#9835;';}
    if(k==='f'){const d=document.documentElement;
      if(d.requestFullscreen){const q=d.requestFullscreen();if(q&&q.catch)q.catch(()=>{});}}
    if(k==='p'&&!(NET&&NET.active)){ if(SIM.phase==='play'||SIM.phase==='boss'){SIM.paused=true;SIM.phase='paused';}
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
    roll:UI.rollLatch,magic:UI.magicLatch,upgrade:UI.upgradeLatch};
  UI.rollLatch=false;UI.magicLatch=false;UI.upgradeLatch=-1;      // edge-triggered, consumed once
  return inp;
}

/* ---------- overlays ---------- */
function fillBtns(bw,btns){
  bw.innerHTML='';
  (btns||[]).forEach(b=>{
    const el=document.createElement('button');
    el.className='bigbtn'+(b.ghost?' ghost':'')+(b.prime?' prime':'');el.textContent=b.label;
    el.addEventListener('click',b.fn);bw.appendChild(el);
  });
}
function setOverlay(key,kick,title,sub,body,cards,btns,credits){
  overlayKey=key;
  $('overlay').classList.toggle('landing',key.indexOf('title')===0);
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
  fillBtns($('ovBtns'),btns);
  $('credits').innerHTML=credits||'';
  $('overlay').classList.add('on');
}
function hideOverlay(){overlayKey='';$('overlay').classList.remove('on');closeArmoury();}
const CREDITS_HTML='three.js r170 &mdash; MIT, &copy; 2010-2024 three.js authors (vendored inline). '+
  'Mesh2Motion-style humanoid rig + animation clips &mdash; CC0 1.0, authored procedurally in this file. '+
  'No third-party model, texture, font or audio files. All terrain, gear, VFX and music are generated in code. Zero network requests.';

/* ---------- meta progression (localStorage, view-layer only) ---------- */
const META_KEY='aetherblade-meta-v1';
function loadMeta(){
  try{ const m=JSON.parse(localStorage.getItem(META_KEY));
    if(m&&m.v===1&&m.tracks&&m.heroes)return m; }catch(e){}
  return {v:1,gold:0,tracks:{hp:0,dmg:0,spd:0},heroes:{},heroSkin:'hero',
          best:{1:0,2:0,3:0},bestTotal:0,cleared:{1:false,2:false,3:false},hints:{},rev:0};
}
let META=loadMeta();
let HERO_SKIN=safeHero(META.heroSkin);
let HERO_SKINS=[HERO_SKIN];   // per-player hero skins (index = player number)
let LOCAL_IDX=0;              // hero the camera / HUD / hints follow
function localHero(s){ return s.heroes[LOCAL_IDX]||s.heroes[0]; }
let SETTLED={ch:{},ended:false};
function saveMeta(){ try{ localStorage.setItem(META_KEY,JSON.stringify(META)); }catch(e){} }
function buyTrack(id){
  const lv=META.tracks[id]; if(lv>=CFG.meta.steps)return;
  const c=CFG.meta.costs[lv]; if(META.gold<c)return;
  META.gold-=c; META.tracks[id]++; META.rev++; saveMeta(); Audio.init();
}
function heroBtn(k){
  if(!META.heroes[k]){
    const c=CFG.meta.heroCosts[k]; if(META.gold<c)return;
    META.gold-=c; META.heroes[k]=true; META.rev++; saveMeta(); Audio.init();
    return;   // purchase only -- selection is a separate tap
  }
  META.heroSkin=(META.heroSkin===k?'hero':k);
  META.rev++; saveMeta(); Audio.init();
}
function trackBtn(t){
  const lv=META.tracks[t.id], max=CFG.meta.steps;
  if(lv>=max)return {label:t.name+' · LV '+max+'/'+max+' · MAX',fn:()=>{}};
  return {label:t.name+' +'+t.per+' · LV '+lv+'/'+max+' · '+CFG.meta.costs[lv]+' G',fn:()=>buyTrack(t.id)};
}
function metaButtons(){
  /* Track labels, per-step values and button order all come from
     src/content/rules.js -> RULES.meta.tracks. */
  const bs=CFG.meta.tracks.map(trackBtn);
  /* Generated from the hero registry: a new <id>.js in content/heroes/
     automatically gets an UNLOCK/USE button. The old hard-coded four-id
     list silently hid any newly added skin. */
  for(const k of Object.keys(HEROES)){
    if(HEROES[k].default)continue;      // the free default hero is never sold
    const nm=heroName(k);
    if(META.heroes[k])bs.push({label:(META.heroSkin===k?'\u2713 HERO: ':'USE HERO: ')+nm,fn:()=>heroBtn(k)});
    else bs.push({label:'UNLOCK HERO: '+nm+' \u00B7 '+CFG.meta.heroCosts[k]+' G',fn:()=>heroBtn(k)});
  }
  return bs;
}
/* ---------- armoury: the meta hall, opened from the landing page ---------- */
let armouryOpen=false,armouryRev=-1;
function openArmoury(){ armouryOpen=true; armouryRev=-1;
  $('armoury').classList.add('on'); renderArmoury(); Audio.init(); }
function closeArmoury(){ armouryOpen=false;
  const a=$('armoury'); if(a)a.classList.remove('on'); }
function armouryBodyHTML(){
  return '<div>\u{1FA99} GOLD <span class="k">'+META.gold+'</span> &nbsp;\u00B7&nbsp; BEST '+META.bestTotal+
    ' &nbsp;\u00B7&nbsp; '+[1,2,3].map(c=>(META.cleared[c]?'\u2605':'\u2606')+' CH'+c+(META.best[c]?' \u00B7 '+META.best[c]:'')).join(' &nbsp; ')+
    ' &nbsp;\u00B7&nbsp; HERO: '+esc(heroName(safeHero(META.heroSkin)))+'</div>'+
  '<div>Spend gold below: permanent upgrades and hero skins carry across every run. Magic: fill the meter with kills, then unleash 60 damage on everything near.</div>';
}
function renderArmoury(){
  if(!armouryOpen||armouryRev===META.rev)return;
  armouryRev=META.rev;
  $('armBody').innerHTML=armouryBodyHTML();
  fillBtns($('armBtns'),metaButtons());
}
let bannerTimer=0;
function showBanner(txt,ms){
  const el=$('banner'); if(!el)return;
  el.textContent=txt; el.style.opacity='1';
  clearTimeout(bannerTimer);
  bannerTimer=setTimeout(()=>{ el.style.opacity='0'; },ms||2500);
}
let hintShown=null;
function setHint(txt){
  if(txt===hintShown)return; hintShown=txt;
  const el=$('hint2'); if(!el)return;
  el.textContent=txt||''; el.style.opacity=txt?'1':'0';
}
function updateHints(){
  const s=SIM;
  if(s.phase!=='play'&&s.phase!=='boss'){ setHint(null); return; }
  const h=localHero(s);
  if(!META.hints.move&&Math.sqrt(h.vx*h.vx+h.vz*h.vz)>1.2){ META.hints.move=true; saveMeta(); }
  if(!META.hints.attack&&h.state==='attack'){ META.hints.attack=true; saveMeta(); }
  if(!META.hints.roll&&h.state==='roll'){ META.hints.roll=true; saveMeta(); }
  let want=null;
  if(!META.hints.move)want='\u27E8 DRAG LEFT SIDE TO MOVE \u27E9';
  else if(!META.hints.attack&&s.enemies.some(e=>!e.dead&&dist2(e.x,e.z,h.x,h.z)<49))want='TAP ATTACK!';
  else if(!META.hints.roll&&s.enemies.some(e=>!e.dead&&e.state==='telegraph'))want='ROLL TO DODGE!';
  setHint(want);
}

function startRun(){
  SIM=newSim(0x51A7E); SIM.phase='play';
  SIM.mods={hp:META.tracks.hp*CFG.meta.hpPer, dmg:META.tracks.dmg*CFG.meta.dmgPer, spd:META.tracks.spd*CFG.meta.spdPer};
  SIM.heroes[0].mods={hp:SIM.mods.hp,dmg:SIM.mods.dmg,spd:SIM.mods.spd};
  SIM.hero.maxHp=CFG.hero.hp+SIM.mods.hp; SIM.hero.hp=SIM.hero.maxHp;
  HERO_SKIN=safeHero(META.heroSkin);
  HERO_SKINS=[HERO_SKIN]; LOCAL_IDX=0;
  const hv0=VIEWS.get(0);
  if(hv0&&hv0.kind!==HERO_SKIN){ scene.remove(hv0.mesh); hv0.mesh.material.dispose(); VIEWS.delete(0); }
  SETTLED={ch:{},ended:false};
  buildMapMeshes(SIM); resetTilt();UI.attack=false;UI.rollLatch=false;UI.magicLatch=false;
  hideOverlay();Audio.init();
}
function syncOverlay(){
  const s=SIM,key=s.phase+(s.phase==='levelup'?s.level:'')+(s.phase==='clear'?s.chapter:'')+(s.phase==='title'?'m'+META.rev:'');
  if(key===overlayKey)return;
  if(s.phase==='title'){
    setOverlay(key,'','AETHERBLADE','','',null,
      [{label:'\u2694 START RUN',fn:startRun,prime:true},
       {label:'\u{1F465} CO-OP',fn:openCoop,ghost:true},
       {label:'ARMOURY',fn:openArmoury,ghost:true}],'');
  }else if(s.phase==='levelup'){
    const cards=s.choices.map(id=>UPGRADES.find(u=>u.id===id)).filter(Boolean);
    setOverlay(key,'LEVEL '+s.level,'CHOOSE AN UPGRADE',(NET&&NET.active&&NET.role==='guest')?'The host is choosing for the party.':'The arena is paused.',
      '<div style="text-align:center">Upgrades and score carry across all three chapters.</div>',
      cards,null,'');
  }else if(s.phase==='clear'){
    if(!SETTLED.ch[s.chapter]){ SETTLED.ch[s.chapter]=true;
      META.gold+=CFG.meta.clearBonus; META.cleared[s.chapter]=true;
      if(s.score>(META.best[s.chapter]||0))META.best[s.chapter]=s.score;
      if(s.score>META.bestTotal)META.bestTotal=s.score; saveMeta(); }
    setOverlay(key,'CHAPTER '+s.chapter,'CHAPTER CLEARED',
      s.chapter<3?'NEXT: '+PALETTES[s.chapter].name:'THE ECLIPSE IS BROKEN',
      '<div style="text-align:center">Score '+s.score+' &nbsp;·&nbsp; Kills '+s.kills+' &nbsp;·&nbsp; HP '+Math.round(localHero(s).hp)+'</div>',
      null,null,'');
  }else if(s.phase==='dead'){
    if(!SETTLED.ended){ SETTLED.ended=true;
      META.gold+=Math.floor(s.score/CFG.meta.scoreGoldDivisor);
      if(s.score>META.bestTotal)META.bestTotal=s.score; saveMeta(); }
    setOverlay(key,'RUN ENDED','YOU FELL','CHAPTER '+s.chapter,
      '<div style="text-align:center">Score '+s.score+' &nbsp;·&nbsp; Kills '+s.kills+' &nbsp;·&nbsp; Level '+s.level+'</div>',
      null,(NET&&NET.active)?[{label:'END RUN',fn:()=>netTeardown(true)}]:[{label:'RETRY',fn:startRun}],'');
  }else if(s.phase==='victory'){
    if(!SETTLED.ended){ SETTLED.ended=true;
      META.gold+=Math.floor(s.score/CFG.meta.scoreGoldDivisor)+CFG.meta.victoryBonus;
      if(s.score>META.bestTotal)META.bestTotal=s.score; saveMeta(); }
    setOverlay(key,'ALL THREE CHAPTERS CLEARED','VICTORY','AETHERBLADE',
      '<div style="text-align:center">Final score '+s.score+' &nbsp;·&nbsp; '+s.kills+' kills &nbsp;·&nbsp; Level '+s.level+'</div>',
      null,(NET&&NET.active)?[{label:'END RUN',fn:()=>netTeardown(true)}]:[{label:'PLAY AGAIN',fn:startRun}],CREDITS_HTML);
  }else if(s.phase==='paused'){
    setOverlay(key,'PAUSED','PAUSED','P TO RESUME','',null,
      [{label:'RESUME',fn:()=>{SIM.phase=SIM.boss?'boss':'play';SIM.paused=false;hideOverlay();}}],'');
  }else hideOverlay();
}


/* =====================================================================
   CO-OP — 2-player online lockstep, Dragon Alley rules, relay transport.
   One deterministic sim, two heroes; P1 = host, P2 = guest. Transport is
   the WSS room forwarder (the deployed Dragon Alley worker): one room per
   6-char code, sid-based 60 s slot reservation (&sid=…&resume=1), a clean
   {"type":"bye"} frees the code at once.
   NAMESPACE: AETHERBLADE codes ALWAYS carry '0' as the 2nd character
   (e.g. K0PXQ2). Dragon Alley's code alphabet has no 0/1, so a Dragon
   Alley session can never hold one of our codes; and the hello handshake
   (game tag + build string) refuses any peer that is not this build —
   a build mismatch shows VERSION MISMATCH instead of desyncing later.
   LOCKSTEP: fixed 60 ticks/s, per-tick frames {t,mx,my,atk,rol,mag,upg}
   (move quantized int8), input delay 6, a tick runs only when BOTH frames
   exist, inputs sampled in EVERY state (the v16 lesson), digest
   checkpoint exchange every 600 ticks; a mismatch is a hard stop.
   RESUME: both sides freeze at the drop; the rejoin (same sid, worker
   grace window) exchanges executed-step counts, both rebuild the sim
   from the seed and REPLAY the exchanged input log to the agreed tick,
   then re-run the 6-tick input-delay runway with empty frames. No state
   serialization — determinism is the snapshot. Past the window the
   remaining player may finish solo (partner hero despawns, XP stays).
   ===================================================================== */
let NET=null;
const NET_ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const RELAY_URL=(()=>{ try{
    const q=new URLSearchParams(location.search).get('relay');
    if(q)return q;
    const ls=localStorage.getItem('aetherblade-relay');
    if(ls)return ls;
  }catch(e){} return CFG.net.relay; })();
const NET_GRACE_MS=(()=>{ try{
    const q=parseInt(new URLSearchParams(location.search).get('netgrace'),10);
    if(q>0)return q;
  }catch(e){} return CFG.net.graceMs; })();
function netNewSid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-5); }
function netNewCode(){
  const r=()=>NET_ALPHABET[Math.floor(Math.random()*NET_ALPHABET.length)];
  return r()+'0'+r()+r()+r()+r();        // 2nd char is always '0' — see namespace note
}
function netEmptyFrame(t){ return {t,mx:0,my:0,atk:0,rol:0,mag:0,upg:-1}; }
function netFrameInput(f){ return {mx:f.mx/127,my:f.my/127,attack:!!f.atk,
  roll:!!f.rol,magic:!!f.mag,upgrade:(typeof f.upg==='number'?f.upg:-1)}; }
function netMods(){ return { hp:META.tracks.hp*CFG.meta.hpPer,
  dmg:META.tracks.dmg*CFG.meta.dmgPer, spd:META.tracks.spd*CFG.meta.spdPer }; }
function newNetSession(role,code){
  return { role, myIdx:role==='host'?0:1, code, sid:netNewSid(),
    ws:null, send:null, active:false, started:false, startAt:0, seed:0,
    step:0, nextSend:0, recs:[{},{}], hashMine:{}, hashTheirs:{},
    players:null, desync:false, dropped:false, dropAt:0, retryAt:0, attempts:0,
    partnerLeft:false, closing:false, status:'menu', tries:0,
    resumeExec:-1, resumeAck:-1, lastStepAt:0 };
}
function netConnect(sess,resume){
  const url=RELAY_URL+'?room='+encodeURIComponent(sess.code)+'&role='+sess.role+
    '&sid='+encodeURIComponent(sess.sid)+(resume?'&resume=1':'');
  const ws=new WebSocket(url);
  sess.ws=ws;
  sess.send=o=>{ if(ws.readyState===1){ try{ ws.send(JSON.stringify(o)); }catch(e){} } };
  ws.onopen=()=>{
    if(sess!==NET)return;
    if(sess.dropped){ sess.status='resuming'; }
    else if(sess.role==='guest'&&!sess.started){ netSendHello(sess); sess.status='finding'; }
    else if(sess.role==='host'&&!sess.started){ sess.status='waiting'; }
  };
  ws.onmessage=ev=>{
    if(sess!==NET||sess.ws!==ws)return;
    let m; try{ m=JSON.parse(ev.data); }catch(e){ return; }
    if(m&&m.type==='__relay')netRelayEvent(sess,m.event);
    else netOnMsg(sess,m);
  };
  ws.onclose=()=>{
    if(sess!==NET||sess.ws!==ws)return;
    sess.ws=null;
    if(sess.closing)return;
    netOnSocketDown(sess);
  };
  ws.onerror=()=>{ try{ ws.close(); }catch(e){} };
}
function netSendHello(sess){
  sess.send({type:'hello',game:'aetherblade',build:CFG.net.build,code:sess.code,
    sid:sess.sid,skin:safeHero(META.heroSkin),mods:netMods(),name:'P2'});
}
function netRelayEvent(sess,ev){
  if(ev==='guest-joined'){ if(sess.role==='host'&&!sess.started)sess.status='paired'; }
  else if(ev==='peer-resumed'){
    if(sess.dropped&&sess.started){ sess.send({type:'resume',exec:sess.step}); }
  }
  else if(ev==='peer-left'){
    if(sess.started&&!sess.dropped&&!sess.partnerLeft){
      sess.dropped=true; sess.dropAt=performance.now(); sess.attempts=0;
      sess.status='dropped'; openCoop();
    }else if(!sess.started){ sess.status=sess.role==='host'?'waiting':'nohost'; }
  }
  else if(ev==='waiting-host'){ if(!sess.started)sess.status='waitinghost';
    else if(sess.dropped)sess.status='resuming'; }
  else if(ev==='no-host'){
    if(!sess.started){ sess.status='nohost'; }
  }
  else if(ev==='room-full'){ if(!sess.started)sess.status='full'; }
  else if(ev==='room-taken'){
    if(sess.role==='host'&&!sess.started&&sess.tries<8){
      sess.tries++; sess.code=netNewCode(); sess.closing=false;
      if(sess.ws){ const w=sess.ws; sess.ws=null; try{ w.close(); }catch(e){} }
      netConnect(sess,false);
    }else if(!sess.started){ sess.status='failed'; }
  }
}
function netOnMsg(sess,m){
  if(!m||!m.type)return;
  if(m.type==='hello'){
    if(sess.role!=='host'||sess.started)return;
    if(m.game!=='aetherblade'||m.code!==sess.code)return;   // not our game: ignore
    if(m.build!==CFG.net.build){
      sess.send({type:'reject',why:'VERSION MISMATCH'}); sess.status='mismatch'; return;
    }
    sess.players=[{skin:safeHero(META.heroSkin),mods:netMods()},
                  {skin:m.skin||'hero',mods:m.mods||{hp:0,dmg:0,spd:0}}];
    sess.seed=(((Date.now()^((performance.now()*1000)|0))>>>0)||0x51A7E);
    sess.send({type:'start',seed:sess.seed,skin:sess.players[0].skin,mods:sess.players[0].mods});
    sess.status='starting'; sess.startAt=performance.now()+1200;
  }
  else if(m.type==='start'){
    if(sess.role!=='guest'||sess.started)return;
    if(typeof m.seed!=='number'||!m.mods||typeof m.mods.hp!=='number'){
      sess.status='mismatch'; return;      // not an AETHERBLADE host payload
    }
    sess.players=[{skin:m.skin||'hero',mods:m.mods},
                  {skin:safeHero(META.heroSkin),mods:netMods()}];
    sess.seed=m.seed>>>0;
    sess.status='starting'; sess.startAt=performance.now()+1200;
  }
  else if(m.type==='reject'){ if(!sess.started)sess.status='mismatch'; }
  else if(m.type==='input'){
    if(m.f&&typeof m.f.t==='number')sess.recs[1-sess.myIdx][m.f.t]=m.f;
  }
  else if(m.type==='hash'){
    sess.hashTheirs[m.tick]=m.h; netCheckDesync(m.tick);
  }
  else if(m.type==='resume'){
    if(!sess.dropped)return;
    sess.resumeExec=m.exec;
    sess.send({type:'resumeAck',exec:sess.step});
    netTryResume(sess);
  }
  else if(m.type==='resumeAck'){
    if(!sess.dropped)return;
    sess.resumeAck=m.exec; netTryResume(sess);
  }
  else if(m.type==='bye'){
    if(sess.started&&!sess.partnerLeft){
      sess.partnerLeft=true; sess.dropped=false; sess.status='left'; openCoop();
    }else if(!sess.started){ sess.status=sess.role==='host'?'waiting':'nohost'; }
  }
}
function netOnSocketDown(sess){
  if(sess.started){
    if(!sess.dropped){
      sess.dropped=true; sess.dropAt=performance.now(); sess.attempts=0;
      sess.retryAt=performance.now()+700; sess.status='dropped'; openCoop();
    }else{
      sess.retryAt=performance.now()+[1500,3000,5000,8000][Math.min(3,sess.attempts)];
    }
  }else if(sess.status!=='mismatch'&&sess.status!=='nohost'&&sess.status!=='full'){
    sess.status='failed';
  }
}
function netCheckDesync(t){
  const sess=NET; if(!sess||sess.desync)return;
  const a=sess.hashMine[t], b=sess.hashTheirs[t];
  if(a&&b&&a!==b){
    sess.desync=true; sess.active=false; sess.status='desync';
    try{ sess.send({type:'bye'}); }catch(e){}
    openCoop();
  }
}
function netSample(){
  const sess=NET; if(!sess||!sess.active||sess.dropped)return;
  const recs=sess.recs[sess.myIdx];
  let first=true;
  while(sess.nextSend<=sess.step+CFG.net.delay){
    const t=sess.nextSend++;
    const inp=readCoopInput(first); first=false;
    const f={t,mx:Math.round(clamp(inp.mx,-1,1)*127),my:Math.round(clamp(inp.my,-1,1)*127),
      atk:inp.attack?1:0,rol:inp.roll?1:0,mag:inp.magic?1:0,
      upg:(sess.role==='host'?inp.upgrade:-1)};
    recs[t]=f;
    sess.send({type:'input',f});
  }
}
function readCoopInput(first){
  // same screen->world conversion as readInput(); edge latches ride the
  // FIRST frame stamped in a call, exactly like the Dragon Alley sampler
  let sx=UI.tiltX,sy=UI.tiltY;
  if(!UI.stickActive){
    const k=UI.keys;
    sx=(k['d']||k['arrowright']?1:0)-(k['a']||k['arrowleft']?1:0);
    sy=(k['w']||k['arrowup']?1:0)-(k['s']||k['arrowdown']?1:0);
    const m=Math.sqrt(sx*sx+sy*sy); if(m>1){sx/=m;sy/=m;}
  }
  const mx=-sx, my=sy;
  LAST_IN.mx=mx;LAST_IN.my=my;LAST_IN.sx=sx;LAST_IN.sy=sy;
  let atk=UI.attack||!!UI.keys[' ']||!!UI.keys['j'];
  if(UI.atkBuf>0){ atk=true; if(first)UI.atkBuf=Math.max(0,UI.atkBuf-FIXED); }
  const inp={mx,my,attack:atk,
    roll:!!(first&&UI.rollLatch), magic:!!(first&&UI.magicLatch),
    upgrade:first?UI.upgradeLatch:-1};
  if(first){ UI.rollLatch=false; UI.magicLatch=false; UI.upgradeLatch=-1; }
  return inp;
}
function netStepOnce(){
  const sess=NET;
  const a=sess.recs[0][sess.step], b=sess.recs[1][sess.step];
  if(!a||!b)return false;
  simStep({p1:netFrameInput(a),p2:netFrameInput(b)});
  sess.step++;
  sess.lastStepAt=performance.now();
  if(sess.step%CFG.net.checkpoint===0){
    const h=simDigest(SIM);
    sess.hashMine[sess.step]=h;
    sess.send({type:'hash',tick:sess.step,h});
    netCheckDesync(sess.step);
  }
  return true;
}
function netFrame(now){
  const sess=NET; if(!sess)return;
  if(sess.desync||sess.partnerLeft)return;              // frozen end states
  if(sess.dropped){ netReconnectTick(now); return; }
  if(sess.startAt){
    if(now<sess.startAt)return;
    sess.startAt=0; startCoopRun(sess.seed);
  }
  if(!sess.active)return;
  /* Interleaved sample/step: frames are produced by the real sampler and
     consumed by the real sim; on a fast link the pair advances several
     delay-windows per rAF, on phones it naturally runs at frame rate. */
  for(let it=0;it<4;it++){
    netSample();
    let progressed=false, guard=0;
    while(guard<64&&netStepOnce()){ progressed=true; guard++; }
    if(!progressed)break;
  }
}
function netReconnectTick(now){
  const sess=NET; if(!sess||!sess.dropped)return;
  if(now-sess.dropAt>NET_GRACE_MS){
    sess.partnerLeft=true; sess.dropped=false; sess.status='left';
    if(sess.ws){ const w=sess.ws; sess.ws=null; try{ w.close(); }catch(e){} }
    openCoop(); return;
  }
  if(!sess.ws&&now>=sess.retryAt&&!sess.holdReconnect){
    sess.attempts++;
    sess.retryAt=now+[700,1500,3000,5000,8000][Math.min(4,sess.attempts)];
    netConnect(sess,true);
  }
}
function netTryResume(sess){
  if(sess.resumeExec<0||sess.resumeAck<0)return;
  const T=Math.min(sess.step,sess.resumeExec);
  netResync(sess,T);
}
function netResync(sess,T){
  const seed=sess.seed, players=sess.players;
  SIM=newSim(seed>>>0,2); SIM.phase='play';
  players.forEach((p,i)=>{ const h=SIM.heroes[i];
    h.mods={hp:p.mods.hp||0,dmg:p.mods.dmg||0,spd:p.mods.spd||0};
    h.maxHp=CFG.hero.hp+h.mods.hp; h.hp=h.maxHp; });
  SIM.mods={hp:players[0].mods.hp,dmg:players[0].mods.dmg,spd:players[0].mods.spd};
  HERO_SKINS=[players[0].skin,players[1].skin]; LOCAL_IDX=sess.myIdx;
  for(let t=0;t<T;t++){
    const a=sess.recs[0][t], b=sess.recs[1][t];
    if(!a||!b)break;
    simStep({p1:netFrameInput(a),p2:netFrameInput(b)});
  }
  EV.length=0;                                   // replay is silent
  /* trim everything past T, re-run the delay runway on empty frames */
  for(const k of Object.keys(sess.recs[0]))if(+k>=T)delete sess.recs[0][k];
  for(const k of Object.keys(sess.recs[1]))if(+k>=T)delete sess.recs[1][k];
  for(let t=0;t<CFG.net.delay;t++){
    sess.recs[0][T+t]=netEmptyFrame(T+t); sess.recs[1][T+t]=netEmptyFrame(T+t);
  }
  sess.step=T; sess.nextSend=T+CFG.net.delay;
  sess.hashMine={}; sess.hashTheirs={};
  sess.resumeExec=-1; sess.resumeAck=-1;
  sess.dropped=false; sess.lastStepAt=performance.now(); sess.status='playing';
  buildMapMeshes(SIM);
  closeCoop();
}
function startCoopRun(seed){
  const sess=NET; if(!sess||!sess.players)return;
  SIM=newSim(seed>>>0,2); SIM.phase='play';
  sess.players.forEach((p,i)=>{ const h=SIM.heroes[i];
    h.mods={hp:p.mods.hp||0,dmg:p.mods.dmg||0,spd:p.mods.spd||0};
    h.maxHp=CFG.hero.hp+h.mods.hp; h.hp=h.maxHp; });
  SIM.mods={hp:sess.players[0].mods.hp,dmg:sess.players[0].mods.dmg,spd:sess.players[0].mods.spd};
  HERO_SKINS=[sess.players[0].skin,sess.players[1].skin];
  LOCAL_IDX=sess.myIdx;
  SETTLED={ch:{},ended:false};
  sess.step=0; sess.hashMine={}; sess.hashTheirs={};
  /* keep remote frames that arrived before the local start fired — the
     peer's sampler legitimately runs one delay-window ahead of us */
  for(let t=0;t<CFG.net.delay;t++){
    sess.recs[0][t]=netEmptyFrame(t); sess.recs[1][t]=netEmptyFrame(t);
  }
  sess.nextSend=CFG.net.delay;
  sess.started=true; sess.active=true; sess.status='playing';
  sess.lastStepAt=performance.now();
  buildMapMeshes(SIM); resetTilt();
  UI.attack=false; UI.rollLatch=false; UI.magicLatch=false;
  closeCoop(); hideOverlay(); Audio.init();
}
function netTeardown(toTitle){
  const sess=NET; if(!sess)return;
  sess.closing=true;
  if(sess.ws){ try{ sess.send({type:'bye'}); }catch(e){}
    try{ sess.ws.close(); }catch(e){} sess.ws=null; }
  NET=null;
  if(toTitle){
    SIM=newSim(0x51A7E); LOCAL_IDX=0; HERO_SKINS=[safeHero(META.heroSkin)];
    buildMapMeshes(SIM);
  }
  closeCoop();
}
function netContinueSolo(){
  const sess=NET; if(!sess)return;
  const lh=SIM.heroes[sess.myIdx];
  if(!lh||lh.downed)return;
  const skin=safeHero(HERO_SKINS[sess.myIdx]);
  const vid=sess.myIdx===0?-1:0;
  SIM.heroes=[lh]; SIM.players=1; LOCAL_IDX=0; HERO_SKINS=[skin];
  const v=VIEWS.get(vid);
  if(v){ scene.remove(v.mesh); v.mesh.material.dispose(); VIEWS.delete(vid); }
  netTeardown(false);
}

/* ---------- co-op modal + net HUD ---------- */
let coopOpen=false, coopRev='';
function openCoop(){ coopOpen=true; coopRev='';
  const c=$('coop'); if(c)c.classList.add('on'); Audio.init(); renderCoop(); }
function closeCoop(){ coopOpen=false; coopRev='';
  const c=$('coop'); if(c)c.classList.remove('on'); }
function coopCreate(code){
  if(NET)netTeardown(false);
  const sess=newNetSession('host',
    (typeof code==='string'&&/^[A-Z0-9]{6}$/.test(code))?code:netNewCode());
  NET=sess; sess.status='connecting';
  netConnect(sess,false);
  openCoop();
  return sess.code;
}
function coopJoin(){
  const code=($('coopInput').value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
  if(code.length!==6){ coopFlash('ENTER THE 6-CHARACTER CODE'); return null; }
  if(NET)netTeardown(false);
  const sess=newNetSession('guest',code);
  NET=sess; sess.status='connecting';
  netConnect(sess,false);
  openCoop();
  return code;
}
let coopFlashMsg='';
function coopFlash(msg){ coopFlashMsg=msg; coopRev=''; renderCoop(); }
function coopButtons(list){ fillBtns($('coopBtns'),list); }
function renderCoop(){
  if(!coopOpen)return;
  const sess=NET;
  let key='menu', body='', btns=null, join=false, closeLabel='CLOSE', closeFn=null;
  const st=sess?sess.status:'menu';
  if(!sess||st==='menu'){
    key='menu';
    body='<div>Two blades, one arena. Host a room, or join a friend&#39;s.</div>'+
      '<div>Both players need the <span class="k">same build</span> — co-op is lockstep.</div>'+
      (coopFlashMsg?'<div class="cstat">'+esc(coopFlashMsg)+'</div>':'');
    btns=[{label:'CREATE ROOM',fn:()=>{ coopFlashMsg=''; coopCreate(); }}];
    join=true; closeLabel='CLOSE'; closeFn=()=>closeCoop();
  }else if(sess.desync){
    key='desync';
    body='<div class="cstat">CONNECTION DESYNC — RUN ENDED</div>'+
      '<div>The two blades drifted apart. Nothing was settled.</div>';
    btns=[{label:'END RUN',fn:()=>netTeardown(true)}];
    closeLabel=''; 
  }else if(sess.partnerLeft){
    key='left';
    body='<div class="cstat">PARTNER LEFT</div>'+
      '<div>Your partner&#39;s slot has closed. The arena keeps what you earned together.</div>';
    const lh=SIM.heroes[sess.myIdx];
    btns=[];
    if(lh&&!lh.downed)btns.push({label:'CONTINUE SOLO',fn:netContinueSolo});
    btns.push({label:'END RUN',fn:()=>netTeardown(true)});
    closeLabel='';
  }else if(sess.dropped){
    const left=Math.max(0,Math.ceil((NET_GRACE_MS-(performance.now()-sess.dropAt))/1000));
    key='dropped'+left;
    body='<div class="cstat">CONNECTION LOST</div>'+
      '<div>The sim is paused. Your partner&#39;s slot is held for <span class="k">'+left+' s</span> — rejoining resumes the run in sync.</div>';
    btns=[{label:'END RUN',fn:()=>netTeardown(true)}];
    closeLabel='';
  }else if(st==='mismatch'){
    key='mismatch';
    body='<div class="cstat">VERSION MISMATCH</div>'+
      '<div>Both players need the same AETHERBLADE build to play together.</div>';
    btns=[{label:'BACK',fn:()=>{ netTeardown(false); }}];
    closeLabel='CLOSE'; closeFn=()=>{ netTeardown(false); closeCoop(); };
  }else if(st==='nohost'||st==='full'||st==='failed'){
    key=st;
    body='<div class="cstat">'+(st==='nohost'?'ROOM NOT FOUND':st==='full'?'ROOM IS FULL':'CONNECTION FAILED')+'</div>'+
      '<div>Check the code and try again.</div>';
    btns=[{label:'BACK',fn:()=>{ netTeardown(false); }}];
    closeLabel='CLOSE'; closeFn=()=>{ netTeardown(false); closeCoop(); };
  }else if(sess.role==='host'&&!sess.started){
    key='host'+st+sess.code;
    body='<div>Share this code with your partner:</div>'+
      '<div class="ccode">'+esc(sess.code)+'</div>'+
      '<div class="cstat">'+(st==='connecting'?'CONNECTING…':st==='paired'?'PARTNER FOUND…':st==='starting'?'PAIRED — STARTING…':'WAITING FOR PARTNER…')+'</div>';
    btns=[]; closeLabel='CANCEL'; closeFn=()=>{ netTeardown(false); closeCoop(); };
  }else if(sess.role==='guest'&&!sess.started){
    key='guest'+st+sess.code;
    body='<div>Room <span class="k">'+esc(sess.code)+'</span></div>'+
      '<div class="cstat">'+(st==='connecting'?'CONNECTING…':st==='waitinghost'?'WAITING FOR HOST…':st==='starting'?'PAIRED — STARTING…':'FINDING HOST…')+'</div>';
    btns=[]; closeLabel='CANCEL'; closeFn=()=>{ netTeardown(false); closeCoop(); };
  }else{
    key='playing'; body=''; btns=[]; closeLabel='';
  }
  if(key===coopRev)return;
  coopRev=key;
  $('coopBody').innerHTML=body;
  $('coopJoin').classList.toggle('on',join);
  coopButtons(btns||[]);
  const cb=$('coopClose');
  cb.style.display=closeLabel?'':'none';
  cb.textContent=closeLabel||'CANCEL';
  cb.onclick=closeFn||null;
}
let ringMeshes=null;
function updateNetUI(){
  const stat=$('netStat'); if(!stat)return;
  const sess=NET;
  const inRun=!!(sess&&sess.started);
  stat.style.display=inRun?'flex':'none';
  const bn=$('netBanner');
  if(!inRun){ bn.style.display='none';
    $('tagP1').style.display='none'; $('tagP2').style.display='none'; }
  if(ringMeshes)for(const m of ringMeshes)m.visible=false;
  if(!inRun)return;
  const dot=$('netDot'), txt=$('netTxt');
  if(sess.desync){ dot.className='bad'; txt.textContent='DESYNC'; }
  else if(sess.partnerLeft){ dot.className='bad'; txt.textContent='PARTNER LEFT'; }
  else if(sess.dropped){ dot.className='warn'; txt.textContent='RECONNECTING…'; }
  else{
    dot.className='';
    const rp=SIM.heroes[1-sess.myIdx];
    txt.textContent='P'+(2-sess.myIdx)+(rp?(rp.downed?' DOWN':' \u2665 '+Math.max(0,Math.round(rp.hp))):'');
  }
  const waiting=sess.active&&!sess.dropped&&
    (performance.now()-sess.lastStepAt>CFG.net.stallMs)&&
    (SIM.phase==='play'||SIM.phase==='boss'||SIM.phase==='levelup'||SIM.phase==='clear');
  bn.style.display=waiting?'block':'none';
  if(waiting)bn.textContent='WAITING FOR PLAYER\u2026';
  /* hero ground rings: P1 gold, P2 cyan */
  if(!ringMeshes){
    ringMeshes=[0xffd24a,0x3fd2ff].map(c=>{
      const m=new T.Mesh(new T.RingGeometry(0.52,0.68,28),
        new T.MeshBasicMaterial({color:c,transparent:true,opacity:0.85,
          depthWrite:false,side:T.DoubleSide}));
      m.rotation.x=-Math.PI/2; m.visible=false; scene.add(m); return m;
    });
  }
  if(SIM.players>1&&SIM.phase!=='title'){
    for(let i=0;i<2;i++){
      const h=SIM.heroes[i]; if(!h)continue;
      ringMeshes[i].visible=true;
      ringMeshes[i].position.set(h.x,0.03,h.z);
    }
    for(let i=0;i<2;i++){
      const h=SIM.heroes[i], el=$(i===0?'tagP1':'tagP2');
      if(!h){ el.style.display='none'; continue; }
      _v.set(h.x,2.35,h.z).project(camera);
      if(_v.z<1&&Math.abs(_v.x)<1.05&&Math.abs(_v.y)<1.05){
        el.style.display='block';
        el.style.left=((_v.x*0.5+0.5)*innerWidth)+'px';
        el.style.top=((-_v.y*0.5+0.5)*innerHeight)+'px';
        el.style.color=i===0?'#ffd24a':'#54e0ff';
      }else el.style.display='none';
    }
  }else{
    $('tagP1').style.display='none'; $('tagP2').style.display='none';
  }
}
$('coopClose').addEventListener('click',()=>{});
$('coopJoinBtn').addEventListener('click',()=>{ coopFlashMsg=''; coopJoin(); });
$('coopInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'){ coopFlashMsg=''; coopJoin(); }
  e.stopPropagation();
});
$('coop').addEventListener('pointerdown',e=>{
  if(e.target===$('coop')&&NET&&!NET.started){ netTeardown(false); closeCoop(); }
  else if(e.target===$('coop')&&!NET)closeCoop();
});

/* ---------- HUD ---------- */
function fmtTime(t){
  t=Math.max(0,t);const m=Math.floor(t/60),ss=Math.floor(t%60);
  return m+':'+String(ss).padStart(2,'0');
}
function updateHUD(){
  const s=SIM,h=localHero(s);
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
  const bm=$('btnMagic');
  if(bm){ $('magicFill').style.transform='scaleX('+(s.magic/CFG.magic.cost).toFixed(3)+')';
    $('magicTxt').textContent=s.magic+' / '+CFG.magic.cost;
    bm.classList.toggle('ready',s.magic>=CFG.magic.cost); }
}
function updateCamera(dt){
  const s=SIM,h=localHero(s);
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
  if(NET&&(NET.started||NET.startAt)){ netFrame(now); acc=0; }
  else{ while(acc>=FIXED&&steps<6){simStep(readInput());acc-=FIXED;steps++;} }
  consumeEvents();
  const s=SIM;
  if(s.chapter!==lastChapter){lastChapter=s.chapter;buildMapMeshes(s);}
  syncViews(s,dt);
  updateSlashFX(s,dt);
  updateBolts(dt);
  updatePickupMeshes(s,RTIME);
  updateVFX(dt,RTIME);
  Audio.setIntensity(Math.min(1,s.enemies.length/7+(s.boss?0.55:0)+s.chapter*0.05));
  updateCamera(dt);
  syncOverlay(); renderArmoury(); renderCoop(); updateNetUI();
  updateHUD(); updateHints();
  renderer.render(scene,camera);
  lastCalls=renderer.info.render.calls;
  frameCount++;
  requestAnimationFrame(frame);
}

/* ---------- verification hooks (read-only except explicit test helpers) ---------- */
window.__GAME={
  CFG, PALETTES, UPGRADES, CLIPS, BOSS_NAMES, SLASH_TIP,
  /* Read-only handles for QA / tooling: every content table is traceable at
     runtime, not just at build time. REGISTRY is deep-frozen by the schema. */
  REGISTRY, SIM_CONTENT, contentSummary,
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
      'hpWrap','timer','bossWrap','stickZone','actZone','btnMagic']){
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
  get meta(){return META;},
  get net(){ const n=NET; return n?{active:n.active,role:n.role,code:n.code,step:n.step,
    started:n.started,desync:n.desync,dropped:n.dropped,partnerLeft:n.partnerLeft,
    status:n.status,nextSend:n.nextSend,recs:n.recs?n.recs.map(r=>Object.keys(r).map(Number).sort((a,b)=>a-b)):null,
    players:n.players?n.players.map(p=>({skin:p.skin,mods:p.mods})):null}:null; },
  netCreate(code){ return coopCreate(code); },
  netDrop(){ const n=NET; if(n&&n.ws){ const w=n.ws; n.ws=null;
    try{ w.close(); }catch(e){} netOnSocketDown(n); } },
  netHold(v){ if(NET)NET.holdReconnect=!!v; },
  get netHashes(){ const n=NET; return n?{mine:Object.keys(n.hashMine).length,
    theirs:Object.keys(n.hashTheirs).length,
    lastMine:n.hashMine[Math.max(0,...Object.keys(n.hashMine).map(Number))],
    lastTheirs:n.hashTheirs[Math.max(0,...Object.keys(n.hashTheirs).map(Number))]}:null; },
  netJoin(code){ openCoop(); $('coopInput').value=code||''; return coopJoin(); },
  coopStart(seed){ if(NET){ NET.seed=(seed>>>0)||0x51A7E; NET.startAt=performance.now()+50; } },
  heroes(){ return SIM.heroes.map(h=>({x:h.x,z:h.z,hp:h.hp,maxHp:h.maxHp,
    state:h.state,downed:h.downed,mods:h.mods})); },
  setMagic(v){SIM.magic=Math.max(0,Math.min(CFG.magic.cost,v|0));},
  heroKind(){const v=VIEWS.get(0);return v?v.kind:null;},
  get muted(){return Audio.muted;},
  get audioReady(){return Audio.ready;},
  get EV(){return EV.slice();}
};

/* kick off — title screen first; START is a real pointer/keyboard action */
requestAnimationFrame(frame);
})();



/* -- phase-1 module glue (the ONLY edit vs the single-file build) --
   src/main.js loads this file as an ES module; the IIFE above is untouched. */
export {};
