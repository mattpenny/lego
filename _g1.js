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

/* ---- exact combat spec numbers. Do not "improve" these. ---- */
const CFG = {
  fixed: FIXED,
  waveSeconds: 180,
  hero: {
    hp:100, runSpeed:6.2, walkSpeed:3.1,
    runTilt:0.55,            // full run from 55% joystick tilt (LINEAR, never squared)
    accelTau:20,             // ~0.15 s to near-top speed
    stopTau:34,              // crisp stop
    swingDur:0.625, hitAt:0.25, // hit at 40% of 0.625 s
    swingCd:0.5, range:3.2, arcDeg:130, lunge:0.65,
    rollDur:0.45, rollDist:3.5, rollCd:1.0,
    dmg:34
  },
  enemy: {
    telegraph:0.55, strikeRange:1.8, strikeArcDeg:120, recovery:0.5,
    brute:{hp:76, speed:2.35, dmg:18, radius:0.62, score:120},
    runner:{hp:42, speed:4.65, dmg:10, radius:0.40, score:100},
    ranger:{hp:38, speed:3.25, dmg:13, radius:0.42, score:160,
            minRange:7, maxRange:11, volley:2.3, projSpeed:10.5, projR:0.38},
    /* ---- wave additions: numbers below are the spec, not tuning knobs ----
       soldier  : spear reach 2.2 m (brute needs 1.8), two sword hits to kill
       archer   : fast, weak arrows; holds further back than the ranger
       sorcerer : slow fragile caster, 0.95 s charge, 10 dmg + 1.5 m splash
       knight   : armoured mini-boss, 5 sword hits, uninterruptible wind-up */
    soldier:{hp:52,  speed:2.15, dmg:14, radius:0.46, score:110,
             reach:2.2, arcDeg:110, tele:0.50, recovery:0.42, cd:0.55},
    archer: {hp:34,  speed:3.55, dmg:8,  radius:0.40, score:150,
             minRange:9, maxRange:13, volley:1.5, projSpeed:14.0, projR:0.30,
             tele:0.42, recovery:0.38},
    sorcerer:{hp:60, speed:2.10, dmg:10, radius:0.50, score:240,
             minRange:8.5, maxRange:13.5, volley:3.6, projSpeed:7.5, projR:0.52,
             splash:1.5, tele:0.95, recovery:0.55},
    knight: {hp:168, speed:2.60, dmg:20, radius:0.66, score:320,
             reach:2.0, arcDeg:120, tele:0.95, recovery:0.60, cd:0.70, poise:true}
  },
  caps:{ enemies:8, rangers:3, archers:2, sorcerers:1, knights:1 },
  /* Wave director schedule: `from` gates first appearance, `cap` is the
     per-type alive limit, `w` the fill weight once unlocked. The 8-alive
     cap is global and applies to all seven kinds together. */
  wave:{ soldier:{from:0,  cap:4, w:34},
         archer: {from:30, cap:2, w:18},
         sorcerer:{from:100,cap:1, w:0,  every:45},
         knight: {from:130,cap:1, w:0,  every:35} },

  heal:{ chance:0.30, amount:20 },
  boss:{ hp:300, spawnMin:26, spawnMax:30, speed:7.4, chargeSpeed:16.0,
         chargeTele:0.7, chargeDur:0.55, chargeCd:3.0, chargeRange:6.5,
         slamTele:0.55, slamRange:2.3, slamDmg:22, chargeDmg:20,
         radius:1.15, score:1500 },
  hitStopMs:{ hit:80, kill:120, bossSlam:150, bossKill:250 },
  maxEntities:16
};

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
   ===================================================================== */
const PALETTES = [
  { name:'GRASSLAND', sky:0x7fa6c8, fog:0x86a488, ground:'#40672f', ground2:'#4d7436',
    path:'#a8925f', pond:0x3f86a6, tree:0x2f6a32, trunk:0x5a432c, rock:0x77796e,
    hill:0x5b6152, accent:0xffd98a, light:0xfff0d0, hemi:0xbcd8ff, amb:0.85 },
  { name:'GRAVEYARD FOREST', sky:0x394a62, fog:0x3b4a4a, ground:'#28382f', ground2:'#314035',
    path:'#6a6a61', pond:0x2f5f5c, tree:0x2b3a30, trunk:0x3b332c, rock:0x636b66,
    hill:0x454c4a, accent:0xa8d8c8, light:0xbcd0ff, hemi:0x7f9bc0, amb:0.70 },
  { name:'VOLCANO CASTLE', sky:0x542a2c, fog:0x5a3029, ground:'#2b2228', ground2:'#37282a',
    path:'#4c3a34', pond:0xff5a1e, tree:0x3a2622, trunk:0x2c2020, rock:0x4a3a3a,
    hill:0x3b2b2b, accent:0xff8a3c, light:0xffb070, hemi:0xa05a50, amb:0.72 }
];

function buildMapData(chapter){
  const R = mkRng(9701 + chapter*7919);
  const d = { chapter, colliders:[], trunk:[], canopy:[], rock:[], pillar:[], post:[],
              fence:[], stone:[], hill:[], block:[], torch:[], lava:[], reeds:[],
              pond:{x:chapter===1?-15:chapter===2?17:-19, z:chapter===1?14:chapter===2?-16:12, r:chapter===3?4.6:5.2},
              landmark:{x:chapter===1?-20:chapter===2?18:20, z:-18} };
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
  const isForest=chapter===2, isVolcano=chapter===3;
  const trees = chapter===1?38:chapter===2?34:12;
  // Trunk-sized colliders: the hero stops at the bark instead of an invisible
  // wall a metre out, and can still walk under the canopy.
  tryPlace(trees, 7, 37, 2.6, 0.50, (x,z,i)=>{
    const s=0.8+R()*0.7;
    d.trunk.push({x,z,s,rot:R()*TAU});
    d.canopy.push({x,z,s:s*(isForest?1.0:1.25),rot:R()*TAU,
      kind:isForest?1:isVolcano?2:0});
  });
  tryPlace(chapter===3?30:24, 6, 38, 1.9, 1.0, (x,z)=>{
    d.rock.push({x,z,s:0.55+R()*1.0,rot:R()*TAU});
  });
  tryPlace(chapter===3?18:chapter===2?12:8, 9, 36, 2.2, 0.70, (x,z)=>{
    d.pillar.push({x,z,s:0.8+R()*0.7,rot:R()*TAU});
  });
  if(chapter===2){
    tryPlace(30, 6, 36, 1.2, 0.38, (x,z)=>{
      d.stone.push({x,z,s:0.8+R()*0.5,rot:(R()-0.5)*0.5});
    });
  }
  // fence runs: posts + rails, and a matching SEGMENT collider for the whole run
  for(let f=0;f<6;f++){
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
  for(let i=0;i<64;i++){
    const a=i/64*TAU + (R()-0.5)*0.04;
    const rr=45+R()*6, s=6+R()*8;
    d.hill.push({x:Math.cos(a)*rr, z:Math.sin(a)*rr, s, rot:R()*TAU});
  }
  // landmark + dressing blocks
  const L=d.landmark;
  if(chapter===1){
    d.block.push({x:L.x,z:L.z,s:1,rot:0,kind:0});       // windmill tower
    for(let i=0;i<4;i++)d.block.push({x:L.x+(i-1.5)*2.4,z:L.z+7,s:0.45,rot:0,kind:1});
  }else if(chapter===2){
    d.block.push({x:L.x,z:L.z,s:1,rot:0,kind:2});       // crypt
    for(let i=0;i<4;i++)d.block.push({x:L.x+(i%2?2.6:-2.6),z:L.z+(i<2?3.4:-3.4),s:0.8,rot:0,kind:3});
  }else{
    for(let i=0;i<6;i++)d.block.push({x:L.x+Math.cos(i/6*TAU)*6,z:L.z+Math.sin(i/6*TAU)*6,s:1,rot:i/6*TAU,kind:4});
    d.block.push({x:L.x,z:L.z,s:1,rot:0,kind:5});       // keep
  }
  // torches / lava pools
  for(let i=0;i<12;i++){
    const a=R()*TAU, rr=8+R()*28;
    d.torch.push({x:Math.cos(a)*rr,z:Math.sin(a)*rr,s:0.8+R()*0.5,rot:R()*TAU});
  }
  if(isVolcano){
    for(let i=0;i<9;i++){
      const a=R()*TAU, rr=8+R()*30;
      d.lava.push({x:Math.cos(a)*rr,z:Math.sin(a)*rr,s:1.2+R()*2.1,rot:R()*TAU});
    }
  }
  // pond reeds
  for(let i=0;i<18;i++){
    const a=R()*TAU, rr=d.pond.r+0.4+R()*1.1;
    d.reeds.push({x:d.pond.x+Math.cos(a)*rr,z:d.pond.z+Math.sin(a)*rr,s:0.6+R()*0.7,rot:R()*TAU});
  }

  /* ---- SOLID PROPS ----------------------------------------------------
     Everything that LOOKS solid must stop the hero (and the enemies).
     Trees / rocks / pillars got their colliders from tryPlace(); the pond,
     buildings, gravestones, fence runs and torches are added here. Radii
     follow the visible footprint so there is no invisible wall.
     A collider with seg:1 is a capsule from (ax,az) to (bx,bz). */
  colliders.push({x:d.pond.x,z:d.pond.z,r:d.pond.r+0.10});        // water is solid
  const BLOCK_R=[1.7,1.2,2.7,0.55,2.7,3.7];
  for(let i=0;i<d.block.length;i++){
    const b=d.block[i];
    if(b.kind===4){                     // castle wall = long thin box, not a disc
      const hx=Math.cos(b.rot)*2.7, hz=-Math.sin(b.rot)*2.7;
      colliders.push({seg:1,ax:b.x-hx,az:b.z-hz,bx:b.x+hx,bz:b.z+hz,r:0.70});
    }else{
      colliders.push({x:b.x,z:b.z,r:BLOCK_R[b.kind]||1.5});
    }
  }
  for(let i=0;i<d.fence.length;i++){
    const f=d.fence[i];
    colliders.push({seg:1,ax:f.ax,az:f.az,bx:f.bx,bz:f.bz,r:0.16});
  }
  // (gravestones already got a collider from tryPlace, so they are not repeated here)
  for(let i=0;i<d.torch.length;i++){
    const t=d.torch[i];
    colliders.push({x:t.x,z:t.z,r:0.24});
  }
  return d;
}

/* ---- upgrades ---- */
const UPGRADES = [
  {id:'hide',  ic:'♥', name:'IRON HIDE',   ds:'+25 max HP and heal 25.', apply(s){ s.hero.maxHp+=25; s.hero.hp=Math.min(s.hero.maxHp,s.hero.hp+25); }},
  {id:'edge',  ic:'⚔', name:'HONED EDGE',  ds:'+20% sword damage.',       apply(s){ s.up.edge++; }},
  {id:'tempo', ic:'»', name:'QUICK TEMPO', ds:'-12% attack cooldown.',    apply(s){ s.up.tempo++; }},
  {id:'reach', ic:'↗', name:'LONG REACH',  ds:'+0.5 m range, +10° arc.',  apply(s){ s.up.reach++; }},
  {id:'boots', ic:'⇢', name:'SWIFT BOOTS', ds:'+8% move speed.',          apply(s){ s.up.boots++; }},
  {id:'reflex',ic:'↺', name:'REFLEXES',    ds:'-20% roll cooldown.',      apply(s){ s.up.reflex++; }},
  {id:'magnet',ic:'◈', name:'GEM MAGNET',  ds:'+0.9 m pickup radius.',    apply(s){ s.up.magnet++; }},
  {id:'crit',  ic:'✦', name:'KEEN EYE',    ds:'+15% critical chance.',    apply(s){ s.up.crit++; }},
  {id:'siphon',ic:'✚', name:'BLOOD SIPHON',ds:'Heal 3 HP on every kill.', apply(s){ s.up.siphon++; }}
];
function heroStats(s){
  const u=s.up, C=CFG.hero;
  return {
    speed:C.runSpeed*Math.pow(1.08,u.boots),
    dmg:C.dmg*Math.pow(1.20,u.edge),
    swingCd:C.swingCd*Math.pow(0.88,u.tempo),
    range:C.range+0.5*u.reach,
    arc:(C.arcDeg+10*u.reach)*DEG,
    rollCd:C.rollCd*Math.pow(0.80,u.reflex),
    pickup:1.65+0.9*u.magnet,
    crit:0.05+0.15*u.crit
  };
}

/* ---- fresh deterministic simulation ---- */
function newSim(seed){
  const s={
    seed:seed>>>0, rng:(seed>>>0)||0x9e3779b9, rngCalls:0, tick:0,
    phase:'title', chapter:1, map:null,
    waveLeft:CFG.waveSeconds, bossSpawned:false, bossHits:0,
    hero:{ x:0,z:0,yaw:0,vx:0,vz:0,hp:100,maxHp:100,
           state:'idle', st:0, atkCd:0, rollCd:0, invuln:0,
           hitDone:false, attackId:0, rollX:0, rollZ:0,
           lungeX:0, lungeZ:0, lastHitTick:-999 },
    enemies:[], projectiles:[], gems:[], heals:[], boss:null,
    nextId:1, score:0, kills:0, level:1, xp:0, xpNeed:8,
    up:{edge:0,tempo:0,reach:0,boots:0,reflex:0,magnet:0,crit:0,siphon:0},
    choices:[], hitStop:0, spawnTimer:1.2, chapterClearTimer:0,
    events:[], bossFirstHitTick:-1, bossSpawnTick:-1,
    knightNextAt:0, sorcererNextAt:0
  };
  s.map=buildMapData(1);
  return s;
}
