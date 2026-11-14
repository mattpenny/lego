
/* ---- content registry (pure data — safe for the deterministic sim) ----
   Imports must sit OUTSIDE the IIFE: ES module imports are only legal at
   module top level. The IIFE below closes over these bindings. The single-
   file phone build therefore needs a bundle/inline step (npm run single:build).

   NOTHING below this line hard-codes a hero, figure, enemy, boss, item,
   prop, map or upgrade number. Every one of them is traced back to its own
   descriptor file under src/content/. See CONTENT-GUIDE.md section 6. */
import {
  RULES, REGISTRY, SIM_CONTENT, contentSummary, assertRegistry,
  HEROES, HERO_COSTS, HERO_SLASH_TIPS, HERO_MAGIC, HERO_ATTACK, HERO_AIM_ASSIST, HERO_SLASH_TINTS, HERO_STATS, heroName, safeHero,
  FIGURES, FIGURE_INK, TINTS, FIGURE_SCALES,
  ENEMY_CFG, ENEMY_CAPS, WAVE_RULES, FILL_POOL, FILL_POOLS, SCHEDULED_ELITES, OPENER_KIND,
  ENEMIES,
  BOSS_CFG, BOSS_PHASE2, BOSS_NAMES, BOSSES, BOSS_CFG_BY_CHAPTER,
  ITEM_DROPS, HEAL_CFG, POTION_CFG, ELITE_KINDS, GEM_SCORE,
  PROPS, PLACE_RADII, BLOCK_R, BLOCK_FALLBACK_R,
  WALL_KIND, WALL_HALF_LENGTH, WALL_RADIUS, POND_PAD, FENCE_RADIUS, TORCH_RADIUS,
  PALETTES, MAP_CONFIGS, EVENT_PACKS,
  UPGRADE_LIST,
} from './content/index.js';

/* Account progression client (Phase M2): session, API calls, the
   versioned account stat derivation and the co-op progression
   snapshot/digest. View-layer only — the sim consumes just the
   derived block via hero `mods`, inserted before tick 0. */
import {
  PROGRESSION_VERSION, ECONOMY_VERSION, ACCOUNT_GAINS,
  zeroBlock, accountStats, profileBlock, profileSnapshot, guestSnapshot,
  sanitizeSnapshot, snapshotBlock, rosterDigest,
  loadSession, saveSession, clearSession,
  apiRegister, apiLogin, apiLogout, apiReset, apiProfile, apiErrorText,
  apiHealth, apiSubmitRun, apiUpgradeEquipment, upgradeCostFor,
  apiSetEmail, apiResetEmailRequest, apiResetEmailConfirm, emailLooksValid,
} from './account.js';

/* Fail loudly at boot on an invalid content descriptor. A missing figure,
   a dangling cross-reference or a missing spawn entry would otherwise
   render an invisible character or silently never appear. */
assertRegistry(REGISTRY);

/* Chapter count is DERIVED from the map registry (chapters 4-6 expansion,
   2026-11-14). Adding a file to src/content/maps/ and one line to its
   index.js extends progression, the boss HUD, the armoury star list and
   the victory screen automatically — no hard-coded chapter cap below. */
const CHAPTER_COUNT = MAP_CONFIGS.length;
const CHAPTER_IDS = Array.from({ length: CHAPTER_COUNT }, (_, i) => i + 1);

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
  MeshPhysicalMaterial, PMREMGenerator, PCFSoftShadowMap,
  InstancedMesh, SkinnedMesh, Skeleton, Bone, Group, Object3D, Vector2, Vector3,
  Matrix4, Quaternion, Euler, BoxGeometry, CylinderGeometry, SphereGeometry,
  ConeGeometry, CircleGeometry, PlaneGeometry, DodecahedronGeometry, RingGeometry,
  BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, BufferAttribute,
  CanvasTexture, RepeatWrapping, SRGBColorSpace, AdditiveBlending, DoubleSide,
  BackSide, FrontSide, Points, PointsMaterial, MathUtils, ACESFilmicToneMapping };

const FIXED = 1/60;
/* STEP_HZ — steps per REAL second (Matt, 2026-11-14). The game runs
   66 steps per wall-clock second while every step still simulates
   FIXED (1/60) of game time, so play is 10% faster than real time
   and combat timers (tick counts) are untouched. Two consumers:
   PACE_DT — the wall seconds that buy one step in frame()'s solo
   accumulator and in netFrame()'s session accumulator;
   SCHED_DT — the schedule-seconds the wave clock (waveLeft /
   spawnTimer) drains per step, so the chapter schedule keeps its
   REAL-time marks: boss at step 180*66 = 11880, events at 90 s,
   fill from-times in seconds. */
const STEP_HZ = 66;
const PACE_DT = 1/STEP_HZ;
const SCHED_DT = 1/STEP_HZ;
const TAU = Math.PI*2;
const DEG = Math.PI/180;
const ARENA_R = 40;          // movement boundary; rocky hills begin right here
const HERO_R = 0.42;
const BANNER_R = 0.5;        // banner entity body radius (hero hit tests)

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
  /* THEME COLLIDERS — `map.theme` geometry is view-only, but anything with
     a `cr` field (the caldera mesa, cinder cones, basalt columns) must
     also stop the hero. Mirror those radii into SIM before tryPlace() so
     the seeded scatter naturally avoids the mountain. buildMapMeshes()
     reads the geometry straight from MAP_CONFIGS; the theme arrays
     themselves never enter sim state beyond these collider discs. */
  if(M.theme){
    for(const k of ['mesas','cones','columns'])
      for(const t of (M.theme[k]||[]))
        if(typeof t.cr==='number') colliders.push({x:t.x,z:t.z,r:t.cr});
  }
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
  if(Array.isArray(M.landmarkBlocks)){
    /* Explicit set-piece: chapters 4-6 compose their own landmark out of
       block shapes. Coordinates are RELATIVE to map.landmark, and the
       SOLID PROPS pass below gives every one of them a collider. */
    for(const b of M.landmarkBlocks)
      d.block.push({x:L.x+(b.x||0),z:L.z+(b.z||0),s:b.s||1,rot:b.rot||0,kind:b.kind|0});
  }else if(M.landmarkStyle==='windmill'){
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

  /* ---- HAND-PLACED THEMED DRESSING (map.extra) ------------------------
     Chapters 4-6 add explicit placements on top of the seeded scatter:
     ice colonnades, forge chimneys, grave rows, banner lines. Entries are
     ABSOLUTE world coords. Shallow-copy each one so nothing can mutate
     the deep-frozen content registry. Solid families get the same
     collider radius their randomly-placed twins use, so no decoration is
     accidentally walk-through. `block` colliders come from the SOLID
     PROPS pass below, which runs after this injection. */
  if(M.extra){
    for(const k of ['block','rock','pillar','stone','torch','lava','hill','reeds','trunk','canopy'])
      if(Array.isArray(M.extra[k])&&Array.isArray(d[k]))
        for(const p of M.extra[k]) d[k].push(Object.assign({},p));
    for(const [k,r] of [['rock',PLACE_RADII.rock],['pillar',PLACE_RADII.pillar],
                        ['stone',PLACE_RADII.stone],['trunk',PLACE_RADII.trunk]])
      for(const p of (M.extra[k]||[])) colliders.push({x:p.x,z:p.z,r});
    for(const p of (M.extra.torch||[])) colliders.push({x:p.x,z:p.z,r:TORCH_RADIUS});
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
    /* fence:1 marks a LOW fence run (AB-NET-15 part (f)): the boss
       ignores these colliders outright — a fence must never trap it —
       while heroes and ordinary enemies still collide with them. */
    colliders.push({seg:1,fence:1,ax:f.ax,az:f.az,bx:f.bx,bz:f.bz,r:FENCE_RADIUS});
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
  /* Per-hero BALANCE multipliers (hero descriptor `stats` block ->
     HERO_STATS, hashed in SIM_CONTENT). Composition rule: each
     multiplier applies to the BASE stat FIRST — damage is rounded ONCE,
     here, with Math.round — and only then do the existing upgrade
     curves and additive meta mods compose on top, exactly as before.
     A hero with no stats block (lion, all class skins) is x1.0 in every
     field and bit-identical to the pre-balance game: round(34 x 1)=34,
     and multiplying by 1.0 is exact. */
  const hs=(h&&HERO_STATS[h.heroId])||null;
  const dmgMul=hs&&hs.dmgMul!==undefined?hs.dmgMul:1;
  const spdMul=hs&&hs.speedMul!==undefined?hs.speedMul:1;
  const rdMul =hs&&hs.rollDistMul!==undefined?hs.rollDistMul:1;
  const rcMul =hs&&hs.rollCdMul!==undefined?hs.rollCdMul:1;
  return {
    speed:C.runSpeed*spdMul*Math.pow(1.08,u.boots)+md.spd,
    dmg:Math.round(C.dmg*dmgMul)*Math.pow(1.20,u.edge)+md.dmg,
    swingCd:C.swingCd*Math.pow(0.88,u.tempo),
    range:C.range+0.5*u.reach,
    arc:(C.arcDeg+10*u.reach)*DEG,
    rollCd:C.rollCd*rcMul*Math.pow(0.80,u.reflex),
    rollDist:C.rollDist*rdMul,
    pickup:1.65+0.9*u.magnet,
    /* Account block (M2): md.crit is the Helm contribution, added to
       the base 5% BEFORE the in-run Keen Eye curve — the plan section
       6 composition. Zero for every pre-account path, bit-identical. */
    crit:0.05+(md.crit||0)+0.15*u.crit
  };
}

/* ---- fresh deterministic simulation ---- */
/* Hero spawn formation by roster size. The N=1 (0,0) and N=2 (±1.4)
   rows are the pre-4P positions, byte-for-byte; N=3/4 add the two
   vertical slots. Used at run start AND at chapter transitions. */
function heroSpawnPos(i,n){
  if(n<=1)return [0,0];
  if(i===0)return [-1.4,0];
  if(i===1)return [1.4,0];
  if(i===2)return [0,1.7];
  return [0,-1.7];
}
function mkHero(i,n){
  const sp=heroSpawnPos(i,n);
  return { x:sp[0], z:sp[1], yaw:0, vx:0, vz:0,
           hp:CFG.hero.hp, maxHp:CFG.hero.hp,
           state:'idle', st:0, atkCd:0, rollCd:0, invuln:0,
           hitDone:false, attackId:0, rollX:0, rollZ:0,
           lungeX:0, lungeZ:0, lastHitTick:-999, hitFlash:0,
           downed:false, mods:{hp:0,dmg:0,spd:0,crit:0,magicDmg:0},
           /* Which hero (skin) this player runs — cosmetic for the five
              classic skins, but two skins carry a SIGNATURE MAGIC
              (HERO_MAGIC), so the id is sim state: set from the player's
              own selection at run start and hashed by simDigest, so a
              mismatched pairing desyncs loudly instead of silently
              freezing on one screen only. */
           heroId:'hero' };
}
/* spawn anchor: first living hero (heroes[0] in solo — identical behaviour) */
function anchorHero(s){
  for(const h of s.heroes)if(!h.downed)return h;
  return s.heroes[0];
}
/* The boss sim for THIS chapter: a boss descriptor with its own cfg
   (the Emerald Drake) overrides the shared warlord numbers; chapters
   without one fall back to CFG.boss. Derived in bosses/index.js. */
function bossCfgOf(s){ return BOSS_CFG_BY_CHAPTER[s.chapter]||CFG.boss; }
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
    enemies:[], projectiles:[], arrows:[], gems:[], heals:[], bosses:[],
    banners:[],
    nextId:1, score:0, kills:0, level:1, xp:0, xpNeed:8,
    up:{edge:0,tempo:0,reach:0,boots:0,reflex:0,magnet:0,crit:0,siphon:0},
    choices:[], pickWait:0, hitStop:0, spawnTimer:1.2, chapterClearTimer:0,
    events:[], bossFirstHitTick:-1, bossSpawnTick:-1,
    knightNextAt:0, sorcererNextAt:0,
    magic:0, potions:[], eventDone:false, eventQueue:[],
    mods:{hp:0,dmg:0,spd:0,crit:0,magicDmg:0}
  };
  s.players=(players>=1&&players<=4)?(players|0):1;
  /* Player-count difficulty scaling (RULES.playerScaling, in
     SIM_CONTENT): the row is a pure function of the roster size locked
     at run start, so every client derives identical numbers from the
     handshake alone. N=1 is exactly the pre-scaling game (all 1.0). */
  const SC=CFG.playerScaling[s.players]||CFG.playerScaling[1];
  s.hpScale=SC.hpMul; s.dmgScale=SC.dmgMul; s.aliveCap=SC.aliveCap;
  for(let i=0;i<s.players;i++)s.heroes.push(mkHero(i,s.players));
  Object.defineProperty(s,'hero',{enumerable:true,
    get(){ return this.heroes[0]; }, set(v){ this.heroes[0]=v; }});
  /* Boss LIST: one entry for most chapters, TWO for a twin chapter
     (descriptor twinFigure — chapter 4's ogres). All sim logic iterates
     s.bosses; `s.boss` remains as a compat alias for the FIRST boss so
     view-layer call sites (pause restore, HUD presence, test hooks)
     keep their single-boss reading. Assigning null clears the list. */
  Object.defineProperty(s,'boss',{enumerable:true,
    get(){ return this.bosses[0]||null; },
    set(v){ if(v==null)this.bosses.length=0; else if(this.bosses[0]!==v)this.bosses[0]=v; }});
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
function moveWithCollision(s,e,dx,dz,radius,opts){
  e.x+=dx; e.z+=dz;
  const d=Math.sqrt(e.x*e.x+e.z*e.z);
  if(d>ARENA_R){ const k=ARENA_R/d; e.x*=k; e.z*=k; }   // visible hills start here
  const cs=s.map.colliders;
  for(let pass=0;pass<2;pass++){
    for(let i=0;i<cs.length;i++){
      const c=cs[i];
      /* AB-NET-15 (f)/(g): the boss skips fence colliders; a charging
         drake (cfg.chargeThru) skips every collider. The arena clamp
         above always applies. Heroes/enemies pass no opts. */
      if(opts&&(opts.skipAll||(opts.skipFence&&c.fence)))continue;
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

/* AB-NET-15 (f) — anti-trap steering helpers. Radial steering plus
   positional push-out has an equilibrium: a chaser aimed at a collider's
   centre (or perpendicular to a fence run) is pushed back exactly as
   fast as it advances and never slides anywhere, because its velocity
   is re-aimed radially every step. The watchdog in updateEnemies /
   updateBoss therefore measures PROGRESS: an entity that intends to
   close (or flee) but neither closes nor actually moves for 40 steps
   gets a tangential DETOUR toward the more open side; a closing
   detour persists until the straight path to its target is clear
   (a timed burst would expire back into the same equilibrium), while
   a fleeing detour is a short 55-step slide.
   All state lives on the entity (sim state); every input is sim state,
   so lockstep peers compute identical detours. */
function ptSegDist(px,pz,ax,az,bx,bz){
  const sx=bx-ax, sz=bz-az, L2=sx*sx+sz*sz;
  let t=L2>1e-9?((px-ax)*sx+(pz-az)*sz)/L2:0;
  t=t<0?0:(t>1?1:t);
  const ox=px-(ax+sx*t), oz=pz-(az+sz*t);
  return Math.sqrt(ox*ox+oz*oz);
}
function segsCross(ax,az,bx,bz,cx,cz,dx,dz){
  const d1=(dx-cx)*(az-cz)-(dz-cz)*(ax-cx), d2=(dx-cx)*(bz-cz)-(dz-cz)*(bx-cx);
  const d3=(bx-ax)*(cz-az)-(bz-az)*(cx-ax), d4=(bx-ax)*(dz-az)-(bz-az)*(dx-ax);
  return ((d1>0)!==(d2>0))&&((d3>0)!==(d4>0));
}
function segSegDist(ax,az,bx,bz,cx,cz,dx,dz){
  if(segsCross(ax,az,bx,bz,cx,cz,dx,dz))return 0;
  return Math.min(ptSegDist(ax,az,cx,cz,dx,dz),ptSegDist(bx,bz,cx,cz,dx,dz),
                  ptSegDist(cx,cz,ax,az,bx,bz),ptSegDist(dx,dz,ax,az,bx,bz));
}
/* Is the straight line from (x0,z0) to (tx,tz) free of colliders for a
   body of the given radius? skipFence mirrors the boss's fence rule. */
function pathClear(s,x0,z0,tx,tz,radius,skipFence){
  const cs=s.map.colliders;
  for(let i=0;i<cs.length;i++){
    const c=cs[i];
    if(skipFence&&c.fence)continue;
    if(c.seg){ if(segSegDist(x0,z0,tx,tz,c.ax,c.az,c.bx,c.bz)<c.r+radius)return false; }
    else if(ptSegDist(c.x,c.z,x0,z0,tx,tz)<c.r+radius)return false;
  }
  return true;
}
/* Choose the detour side (+1/-1 around the target direction ux,uz):
   probe a step to each side and prefer the larger collider clearance;
   when the binding collider is a segment, prefer the side whose probe
   is closer to a segment END (the gap is there). Parity of the entity
   id breaks exact ties, deterministically. */
function pickDetourSide(s,e,ux,uz,radius){
  const tx=-uz, tz=ux, cs=s.map.colliders;
  let bestS=(e.id%2)?1:-1, bestScore=-Infinity;
  for(const S of [1,-1]){
    const px=e.x+tx*S*(radius+1.0), pz=e.z+tz*S*(radius+1.0);
    let clear=Infinity, endD=0;
    for(let i=0;i<cs.length;i++){
      const c=cs[i];
      let dd, ed=0;
      if(c.seg){ dd=ptSegDist(px,pz,c.ax,c.az,c.bx,c.bz)-c.r;
        ed=Math.min(Math.hypot(px-c.ax,pz-c.az),Math.hypot(px-c.bx,pz-c.bz)); }
      else dd=Math.hypot(px-c.x,pz-c.z)-c.r;
      if(dd<clear){ clear=dd; endD=ed; }
    }
    const score=clear*1000-endD;
    if(score>bestScore+1e-9){ bestScore=score; bestS=S; }
  }
  return bestS;
}

/* Shared death/downed resolution for every damage source. In co-op a
   fallen hero is DOWNED while a partner still stands (revived next
   chapter); solo, or with no partner standing, the run is over. */
function resolveHeroDeath(s,h){
  const other=s.heroes.find(o=>o!==h&&!o.downed);
  if(s.players>1&&other){ h.downed=true; h.state='down'; h.st=0; h.vx=0; h.vz=0;
    emit('down',{x:h.x,z:h.z}); }
  else { s.phase='dead'; emit('death',{x:h.x,z:h.z}); }
}

function hurtHero(s,h,dmg,kind){
  if(!h||h.downed)return false;
  if(h.invuln>0 || s.phase==='dead' || s.phase==='clear')return false;
  h.hp=Math.max(0,h.hp-dmg);
  h.state='hurt'; h.st=0; h.invuln=0.45;
  emit('hurt',{x:h.x,z:h.z,dmg,kind});
  emit('shake',{v:0.55});
  if(kind==='boss')addHitStop(s,CFG.hitStopMs.bossSlam);
  if(h.hp<=0)resolveHeroDeath(s,h);
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
  /* FURY — third phase, once per boss at <=15% HP: approach speed
     stacks another x1.15 and attack tempo rises x1.15 (see the tempo
     rule in updateBoss). The flag is sim state and is hashed. */
  if(!b.furious&&b.hp>0&&b.hp<=CFG.boss2.fury.hpFrac*b.maxHp){
    b.furious=true; emit('fury',{x:b.x,z:b.z});
  }
  if(b.hp<=0){
    s.score+=bossCfgOf(s).score;
    emit('bossDeath',{x:b.x,z:b.z});
    addHitStop(s,CFG.hitStopMs.bossKill);
    emit('shake',{v:1.0});
    /* Twin chapters field two bosses: the chapter clears only when
       EVERY boss is dead — killing one ogre leaves the other fighting. */
    if(s.bosses.every(x=>x.hp<=0)){ s.phase='clear'; s.chapterClearTimer=1.6; }
  }
}

/* The banner entity (heraldic-banner-knight): a hero damage target
   that is neither enemy nor boss — no score, no drops, no kill count.
   It takes damage through the same hit path (hit-stop + floating
   number via the 'hit' event) and is swept by updateBanners once its
   HP is gone, so its heal zone ends the same step-cycle everywhere. */
function damageBanner(s,bn,dmg,crit){
  if(bn.hp<=0)return;
  bn.hp=Math.max(0,bn.hp-dmg); bn.hitFlash=1;
  emit('hit',{x:bn.x,z:bn.z,y:1.2,dmg:Math.round(dmg),crit,type:'banner'});
  addHitStop(s,CFG.hitStopMs.hit);
  emit('shake',{v:0.20});
  if(bn.hp<=0)emit('bannerDown',{x:bn.x,z:bn.z});
}

/* Signature magic, applied to one SURVIVOR of the blast (damage always
   lands first — see castMagic). `t` is an enemy or the boss; `radius` is
   that target's own body radius, used only by the earthquake clamp.
   FROST: the freeze is stored as a whole number of sim steps
   (seconds x 60) so its duration is exact and float-free; the frozen
   entity's update is skipped entirely, which pauses its move / attack /
   telegraph / charge / breath timers where they stand. Re-freezing
   takes the max, never a sum and never a shorten.
   EARTH: instant radial displacement away from the caster, clamped so
   the target's centre never leaves ARENA_R - radius. A target standing
   exactly on the caster is pushed along the caster's facing. */
function applyMagicSig(s,h,sig,t,radius,isBoss){
  if(sig.kind==='frost'){
    const steps=Math.round((isBoss?sig.bossFreezeSec:sig.freezeSec)*60);
    t.frozen=Math.max(t.frozen||0,steps);
  }else if(sig.kind==='earth'){
    let dx=t.x-h.x, dz=t.z-h.z, d=Math.sqrt(dx*dx+dz*dz);
    if(d<0.001){ dx=Math.sin(h.yaw); dz=Math.cos(h.yaw); d=1; }
    const push=isBoss?sig.bossPush:sig.push;
    t.x+=dx/d*push; t.z+=dz/d*push; t.vx=0; t.vz=0;
    const dd=Math.sqrt(t.x*t.x+t.z*t.z), lim=ARENA_R-radius;
    if(dd>lim){ const k=lim/dd; t.x*=k; t.z*=k; }
  }
}

function castMagic(s,h){
  if(s.magic<CFG.magic.cost)return;
  if(s.phase!=='play'&&s.phase!=='boss')return;
  s.magic-=CFG.magic.cost;
  const R=CFG.magic.radius;
  /* The CASTER's own hero decides the signature (in co-op each player's
     selected hero); skins without one keep the plain blast. */
  const sig=HERO_MAGIC[h.heroId]||null;
  /* The CASTER's account block feeds the blast (Charm, plan section
     6): 60 + P.magicDmg. Zero for guests/legacy — bit-identical.
     FIRE CRESCENT (the ANSUM signature skin): a fire signature scales
     the blast instead of adding control — (60 + mods) x dmgMul, so a
     plain account casts for exactly 96. dmgMul is content data, hashed
     by SIM_CONTENT, so the damage stays deterministic. */
  const blast=(CFG.magic.dmg+((h.mods&&h.mods.magicDmg)||0))*((sig&&sig.dmgMul)||1);
  for(let i=0;i<s.enemies.length;i++){
    const e=s.enemies[i]; if(e.dead)continue;
    const rr=R+CFG.enemy[e.type].radius;
    if(dist2(e.x,e.z,h.x,h.z)<=rr*rr){ emit('bolt',{x:e.x,z:e.z}); damageEnemy(s,e,blast,false);
      if(sig&&!e.dead)applyMagicSig(s,h,sig,e,CFG.enemy[e.type].radius,false); }
  }
  for(const b of s.bosses){
    if(b.hp<=0)continue;
    const rr=R+bossCfgOf(s).radius;
    if(dist2(b.x,b.z,h.x,h.z)<=rr*rr){ emit('bolt',{x:b.x,z:b.z,boss:1}); damageBoss(s,b,blast,false);
      if(sig&&b.hp>0)applyMagicSig(s,h,sig,b,bossCfgOf(s).radius,true); }
  }
  emit('magic',{x:h.x,z:h.z,r:R,sig:sig?sig.kind:''});
  if(sig&&sig.kind==='earth')emit('shake',{v:0.9});
  if(sig&&sig.kind==='fire')emit('shake',{v:0.7});
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
  for(const b of s.bosses){
    if(b.hp<=0)continue;
    const dx=b.x-h.x, dz=b.z-h.z, d=Math.sqrt(dx*dx+dz*dz);
    const br=bossCfgOf(s).radius;
    if(d<=st.range+br && inArc(dx,dz,d,br)){
      const crit=rnd(s)<st.crit;
      damageBoss(s,b,st.dmg*(crit?1.7:1),crit);
    }
  }
  /* Banners are hero targets too: destroying the knight's banner is
     the clean counter to its heal zone (archery pack, AB-NET-20). */
  for(const bn of s.banners){
    if(bn.hp<=0)continue;
    const dx=bn.x-h.x, dz=bn.z-h.z, d=Math.sqrt(dx*dx+dz*dz);
    if(d>st.range+BANNER_R)continue;
    if(!inArc(dx,dz,d,BANNER_R))continue;
    const crit=rnd(s)<st.crit;
    damageBanner(s,bn,st.dmg*(crit?1.7:1),crit);
  }
}

/* RANGED HERO ATTACK (hero descriptor `attack` block → HERO_ATTACK).
   The arrow leaves at the exact step the sword hit would land
   (h.st >= CFG.hero.hitAt), from the hero's centre, and flies straight:
   no tracking, no gravity, no piercing — the first body on its path
   takes the hit through the SAME damageEnemy/damageBoss pipeline a
   sword uses (same damage stat, same crit roll at hit time, same
   wind-up interrupt, same kill drops). AIM ASSIST, fixed at release:
   the nearest enemy/boss whose centre is within the descriptor's cone
   of the hero's facing (and within range + its radius) donates its
   direction; otherwise the arrow flies along facing. A hero with an
   `aimAssist` block (HERO_AIM_ASSIST — today only Penny) selects in
   the narrower coneDeg cone instead, and with lead on she aims at the
   chosen target's INTERCEPT point: its position plus its current
   velocity times the arrow's travel time (refined once). No tracking
   after release — a target that changes direction still dodges her. */
function fireArrow(s,h,st,atk){
  let fx=Math.sin(h.yaw), fz=Math.cos(h.yaw);
  const aa=HERO_AIM_ASSIST[h.heroId]||null;
  const cosAim=Math.cos(((aa?aa.coneDeg:atk.aimDeg)||25)*DEG);
  let bd=Infinity;
  const consider=(tx,tz,tr,vx,vz)=>{
    const dx=tx-h.x, dz=tz-h.z, d=Math.sqrt(dx*dx+dz*dz);
    if(d<1e-6 || d>atk.range+tr)return;
    if((dx*fx+dz*fz)/d<cosAim)return;
    if(d<bd){
      bd=d;
      let ax=dx, az=dz;
      if(aa&&aa.lead&&(vx||vz)){
        let t=d/atk.speed;
        ax=dx+vx*t; az=dz+vz*t;
        t=Math.sqrt(ax*ax+az*az)/atk.speed;
        ax=dx+vx*t; az=dz+vz*t;
      }
      const ad=Math.sqrt(ax*ax+az*az);
      if(ad>1e-6){ fx=ax/ad; fz=az/ad; } else { fx=dx/d; fz=dz/d; }
    }
  };
  for(let i=0;i<s.enemies.length;i++){
    const e=s.enemies[i]; if(e.dead)continue;
    consider(e.x,e.z,CFG.enemy[e.type].radius,e.vx,e.vz);
  }
  for(const b of s.bosses)
    if(b.hp>0)consider(b.x,b.z,bossCfgOf(s).radius,b.vx,b.vz);
  s.arrows.push({id:s.nextId++, x:h.x, z:h.z,
    vx:fx*atk.speed, vz:fz*atk.speed,
    dmg:st.dmg, critP:st.crit, r:atk.r||0.25, dist:0, max:atk.range});
  emit('arrowFire',{x:h.x,z:h.z});
}

/* Arrow flight: per step, test the TRAVELLED SEGMENT against every
   enemy body and the boss body (circle vs segment, radius + arrow
   radius), so a 26 m/s arrow cannot tunnel through a target at 60 Hz.
   The earliest crossing along the segment wins; ties resolve in scan
   order (enemies in array order, then the boss) — fully deterministic. */
function updateArrows(s,dt){
  if(!s.arrows.length)return;
  const out=[];
  for(let i=0;i<s.arrows.length;i++){
    const a=s.arrows[i];
    const spd=Math.sqrt(a.vx*a.vx+a.vz*a.vz);
    const stepLen=spd*dt;
    const go=Math.min(stepLen, a.max-a.dist);      // never fly past max range
    const segX=a.vx/spd*go, segZ=a.vz/spd*go;      // this step's segment delta
    let hitT=Infinity, hitE=null, hitB=null, hitBn=null;
    const testBody=(tx,tz,tr)=>{
      const rr=tr+a.r;
      const ox=a.x-tx, oz=a.z-tz;
      const bq=ox*segX+oz*segZ, cq=ox*ox+oz*oz-rr*rr, aq=go*go;
      let t;
      if(cq<=0)t=0;                              // segment starts inside the body
      else{
        if(aq<1e-12 || bq>=0)return -1;
        const disc=bq*bq-aq*cq;
        if(disc<0)return -1;
        t=(-bq-Math.sqrt(disc))/aq;
        if(t<0||t>1)return -1;
      }
      return t;
    };
    for(let j=0;j<s.enemies.length;j++){
      const e=s.enemies[j]; if(e.dead)continue;
      const t=testBody(e.x,e.z,CFG.enemy[e.type].radius);
      if(t>=0&&t<hitT){ hitT=t; hitE=e; hitB=null; }
    }
    for(const b of s.bosses){
      if(b.hp<=0)continue;
      const t=testBody(b.x,b.z,bossCfgOf(s).radius);
      if(t>=0&&t<hitT){ hitT=t; hitE=null; hitB=b; hitBn=null; }
    }
    /* Banners block arrows like any other body — Penny can shoot the
       banner down (archery pack, AB-NET-20). Scanned last, so an exact
       tie goes to the enemy/boss in front of it. */
    for(const bn of s.banners){
      if(bn.hp<=0)continue;
      const t=testBody(bn.x,bn.z,BANNER_R);
      if(t>=0&&t<hitT){ hitT=t; hitE=null; hitB=null; hitBn=bn; }
    }
    if(hitE||hitB||hitBn){
      const crit=rnd(s)<a.critP;
      if(hitB)damageBoss(s,hitB,a.dmg*(crit?1.7:1),crit);
      else if(hitBn)damageBanner(s,hitBn,a.dmg*(crit?1.7:1),crit);
      else damageEnemy(s,hitE,a.dmg*(crit?1.7:1),crit);
      continue;                                  // first hit only — the arrow dies
    }
    a.x+=segX; a.z+=segZ; a.dist+=go;
    if(a.dist<a.max-1e-9 && a.x*a.x+a.z*a.z<(ARENA_R+3)*(ARENA_R+3))out.push(a);
  }
  s.arrows=out;
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
    const step=st.rollDist/CFG.hero.rollDur;
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

    // swing: 0.625 s, hit at 40% (0.25 s), 0.5 s cooldown.
    // A hero with a ranged `attack` block (HERO_ATTACK) fires an arrow at
    // the SAME hit moment instead of testing the melee arc — identical
    // input, wind-up and cadence; only the delivery differs.
    const atk=HERO_ATTACK[h.heroId]||null;
    if(h.state==='attack'){
      h.st+=dt;
      if(!h.hitDone && h.st>=CFG.hero.hitAt){ h.hitDone=true;
        if(atk&&atk.kind==='arrow')fireArrow(s,h,st,atk);
        else doHeroHit(s,h,st); }
      if(h.st>=CFG.hero.swingDur){ h.state='idle'; h.st=0; }
    }
    if(h.state==='hurt'){
      h.st+=dt; if(h.st>=0.24){h.state='idle';h.st=0;}
    }
    if(inp.attack && h.atkCd<=0 && h.state!=='hurt' && (h.state!=='attack' || h.hitDone)){
      h.state='attack'; h.st=0; h.hitDone=false; h.atkCd=st.swingCd;
      h.attackId++;
      /* The forward lunge is melee-only: a bow hero holds her ground. */
      h.lungeX=atk?0:Math.sin(h.yaw)*CFG.hero.lunge;
      h.lungeZ=atk?0:Math.cos(h.yaw)*CFG.hero.lunge;
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
        life:3.2,dmg:Math.round(cfg.dmg*s.dmgScale),r:cfg.projR,splash:cfg.splash});
    }else{
      s.projectiles.push({id:s.nextId++,unit:e.type,x:e.x+fx*0.8,z:e.z+fz*0.8,
        vx:fx*cfg.projSpeed,vz:fz*cfg.projSpeed,
        life:2.6,dmg:Math.round(cfg.dmg*s.dmgScale),r:cfg.projR});
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
  if(landed)hurtHero(s,h,Math.round(cfg.dmg*s.dmgScale),e.type);
  emit('enemyStrike',{x:e.x,z:e.z,landed,type:e.type});
}

function updateEnemies(s,dt){
  const C=CFG.enemy;
  for(let i=0;i<s.enemies.length;i++){
    const e=s.enemies[i]; if(e.dead)continue;
    const cfg=C[e.type];
    e.hitFlash=Math.max(0,(e.hitFlash||0)-dt*4);
    e.cancelFlash=Math.max(0,(e.cancelFlash||0)-dt*3);
    /* FROZEN (Frost Nova): the whole update is skipped — no movement, no
       attack, and state/timer/cd do not advance, so a telegraph or
       wind-up resumes exactly where it froze. The entity can still be
       hit and killed (damage functions never consult this timer). */
    if((e.frozen||0)>0){ e.frozen--; e.vx=0; e.vz=0; continue; }
    e.cd=Math.max(0,(e.cd||0)-dt);
    if(e.volCd!==undefined)e.volCd=Math.max(0,e.volCd-dt);
    if(e.banCd!==undefined)e.banCd=Math.max(0,e.banCd-dt);
    const h=nearestHero(s,e.x,e.z); e.tgt=h;
    const dx=h.x-e.x, dz=h.z-e.z, d=Math.sqrt(dx*dx+dz*dz)||0.001;
    let vx=0,vz=0;
    if(e.state==='chase'){
      e.yaw=Math.atan2(dx,dz);
      let wantMode=0;
      /* Elite signatures take the action slot when their cooldown is
         ready — the boss priority rule one level down (archery pack,
         AB-NET-20). The Marked Volley snapshots the target hero's
         position NOW: the fixed ring is where he stood when the
         telegraph began, which is what makes sidestepping it fair.
         The banner plant additionally requires no living banner of
         this knight's own (one alive per elite). */
      let signed=false;
      if(cfg.volleyDmg!==undefined && e.volCd<=0 && d<=cfg.volleyRange){
        e.volX=h.x; e.volZ=h.z; e.lockYaw=e.yaw;
        e.state='volleyTele'; e.timer=cfg.volleyTele; e.volCd=cfg.volleyCd;
        emit('eliteWindup',{x:e.volX,z:e.volZ,r:cfg.volleyRadius,kind:'volley'});
        signed=true;
      }else if(cfg.bannerHp!==undefined && e.banCd<=0 && d<=cfg.bannerRange
               && !s.banners.some(bn=>bn.owner===e.id&&bn.hp>0)){
        e.lockYaw=e.yaw;
        e.state='plantTele'; e.timer=cfg.bannerTele;
        signed=true;
      }
      if(!signed){
      if(cfg.minRange){                                   // archer / sorcerer / ranger
        if(d<cfg.minRange){ const fs=cfg.fleeSpeed||cfg.speed; vx=-dx/d*fs; vz=-dz/d*fs; wantMode=-1; }
        else if(d>cfg.maxRange){ vx=dx/d*cfg.speed*0.85; vz=dz/d*cfg.speed*0.85; wantMode=1; }
        else { vx=-dz/d*cfg.speed*0.36; vz=dx/d*cfg.speed*0.36; }
        if(e.cd<=0 && d<=cfg.maxRange+1.5)startTelegraph(e,'cast');
      }else{                                              // melee, per-type reach
        const reach=cfg.reach||C.strikeRange;
        const stand=Math.max(1.45,reach-0.35);
        if(d>stand){ vx=dx/d*cfg.speed; vz=dz/d*cfg.speed; wantMode=1; }
        if(d<=reach-0.1 && e.cd<=0)startTelegraph(e,'melee');
      }
      }
      /* (f) stuck watchdog + detour (see the helpers' header). Progress
         is judged against LAST step's intent (e.wantMode) and LAST
         step's distance (e.lastD); a step only counts as stuck when the
         enemy also barely MOVED, so a kiting hero never arms it. A
         CLOSING detour is not a fixed burst — expiring back into radial
         steering would just re-wedge the enemy at the same equilibrium
         point — it persists until the straight path to the hero is
         clear or the enemy is close enough to commit, with a stall
         flip if the detour itself wedges, and a 900-step hard cap. A
         FLEEING detour stays a short 55-step slide. */
      if(e.lastD>=0){
        /* disp = movement during the last completed step: watchX/Z are
           snapshotted HERE (pre-move) each chase step, so the next
           step's watchdog sees exactly one step of travel. */
        const disp=Math.sqrt((e.x-e.watchX)*(e.x-e.watchX)+(e.z-e.watchZ)*(e.z-e.watchZ));
        const prog=(e.lastD-d)*(e.wantMode||0);
        if(prog>0.03)e.stuckT=0;
        else if(e.wantMode&&disp<cfg.speed*FIXED*0.35)e.stuckT++;
        if(e.detourT>0&&e.stuckT>=40){ e.detourS=-e.detourS; e.stuckT=0; }
      }
      e.watchX=e.x; e.watchZ=e.z;
      if(e.detourT>0)e.detourT--;
      if(e.stuckT>=40&&e.detourT<=0){
        e.detourT=(wantMode<0)?55:900; e.stuckT=0;
        e.detourS=pickDetourSide(s,e,dx/d,dz/d,cfg.radius);
      }
      if(e.detourT>0){
        const commit=cfg.minRange?cfg.maxRange+1.5:(cfg.reach||C.strikeRange)+0.6;
        if(d<=commit||pathClear(s,e.x,e.z,h.x,h.z,cfg.radius,false))e.detourT=0;
        else { vx=-dz/d*cfg.speed*e.detourS; vz=dx/d*cfg.speed*e.detourS; e.yaw=Math.atan2(vx,vz); }
      }
      e.wantMode=wantMode;
    }else if(e.state==='telegraph'){
      e.timer-=dt;                                  // yaw stays locked
      if(e.timer<=0){ e.state='strike'; e.timer=0; }
    }else if(e.state==='strike'){
      strikeEnemy(s,e);
      e.state='recovery'; e.timer=cfg.recovery||C.recovery;
    }else if(e.state==='recovery'){
      e.timer-=dt;
      if(e.timer<=0){ e.state='chase'; e.cd=cfg.minRange?cfg.volley*0.45:0.35; }
    }else if(e.state==='volleyTele'){
      /* MARKED VOLLEY telegraph: stationary, facing locked, the fixed
         warning ring already on the ground at the snapped centre
         (eliteWindup). Not a 'telegraph' state — hero hits do not
         cancel a zone mark, exactly as boss telegraphs cannot be
         cancelled; the counter is movement, not interruption. */
      e.timer-=dt; e.yaw=e.lockYaw;
      if(e.timer<=0){ e.state='volleyStrike'; e.timer=cfg.volleyActive; }
    }else if(e.state==='volleyStrike'){
      /* The 0.2 s strike window: a hero inside the ring takes the one
         tick — hurtHero's own invulnerability (roll i-frames, the
         post-hit grace) gates repeats within the window. Exits into
         the captain's normal recovery, the pack's punish window. */
      e.timer-=dt;
      for(const t of s.heroes){
        if(t.downed)continue;
        const td=Math.sqrt((t.x-e.volX)*(t.x-e.volX)+(t.z-e.volZ)*(t.z-e.volZ));
        if(td<=cfg.volleyRadius)hurtHero(s,t,Math.round(cfg.volleyDmg*s.dmgScale),e.type);
      }
      if(e.timer<=0){ e.state='recovery'; e.timer=cfg.recovery||C.recovery; }
    }else if(e.state==='plantTele'){
      /* BANNER plant telegraph: stationary, facing locked. */
      e.timer-=dt; e.yaw=e.lockYaw;
      if(e.timer<=0){
        s.banners.push({id:s.nextId++,kind:e.type,owner:e.id,x:e.x,z:e.z,
          hp:cfg.bannerHp,maxHp:cfg.bannerHp,zone:cfg.bannerZone,
          dur:cfg.bannerDur,t:0,healAcc:0,hitFlash:0});
        e.banCd=cfg.bannerCd;               // 12 s FROM PLANT (pack rule)
        e.state='chase'; e.cd=0.35;
        emit('bannerPlant',{x:e.x,z:e.z});
      }
    }
    e.vx=vx; e.vz=vz;
    moveWithCollision(s,e,vx*dt,vz*dt,cfg.radius);
    /* (f) watchdog bookkeeping for the next step (all states, so a
       returning chaser starts from a fresh baseline). */
    e.lastD=d;
    if(e.state!=='chase')e.wantMode=0;
  }
  // compact dead bodies (views are driven by cosmetic events)
  if(s.enemies.some(e=>e.dead))s.enemies=s.enemies.filter(e=>!e.dead);
}

/* Banner entities (heraldic-banner-knight, archery pack AB-NET-20).
   A planted banner heals TRASH enemies inside its zone: +1 HP per
   healTick (0.2 s) — the pack's 5 HP/s expressed as an integer
   accumulator, so heals land on exact ticks. Elites are never healed
   (the knight is one, so it cannot heal itself) and bosses are not
   enemies. The banner is swept the step its HP is gone or its
   duration ends, so destruction by hero attacks stops the heal from
   the next update onward, identically on every client. */
function updateBanners(s,dt){
  if(!s.banners.length)return;
  const out=[];
  for(const bn of s.banners){
    if(bn.hp>0){
      bn.t+=dt;
      bn.hitFlash=Math.max(0,(bn.hitFlash||0)-dt*4);
      if(bn.t<bn.dur){
        const bc=CFG.enemy[bn.kind];
        bn.healAcc+=dt;
        let guard=0;
        while(bn.healAcc>=bc.bannerHealTick&&guard++<8){
          bn.healAcc-=bc.bannerHealTick;
          const amt=Math.round(bc.bannerHealPerSec*bc.bannerHealTick);
          let healed=false;
          for(const e of s.enemies){
            if(e.dead||e.hp>=e.maxHp)continue;
            if((ENEMIES[e.type]||{}).elite)continue;
            const dx=e.x-bn.x, dz=e.z-bn.z;
            if(dx*dx+dz*dz<=bn.zone*bn.zone){ e.hp=Math.min(e.maxHp,e.hp+amt); healed=true; }
          }
          if(healed)emit('bannerHeal',{x:bn.x,z:bn.z});
        }
      }
    }
    if(bn.hp>0&&bn.t<bn.dur)out.push(bn);
    else if(bn.hp>0)emit('bannerEnd',{x:bn.x,z:bn.z});
  }
  s.banners=out;
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

/* One fire-breath damage tick (Emerald Drake). The cone starts at the
   dragon's HEAD (headDist ahead of the body centre along the LOCKED
   facing) and widens at halfAngleDeg. Unlike hurtHero() this does NOT
   set the post-hit 0.45 s invulnerability — ticks land every tickEvery
   seconds by design (full exposure = (dur/tickEvery) x tickDmg). The
   only immunity is the roll: a hero mid-roll is i-framed, exactly the
   game's dodge rule. A hero behind or beside the dragon fails the cone
   dot test and takes nothing. */
function breathDamage(s,b,B){
  const BR=B.breath;
  /* cfg.dmgMul scales the tick ONCE (rounded per tick, never
     accumulated): tickDmg 9 x 1.1 = 10 per 0.2 s tick. The player-count
     damage scale then rounds that result once more (two-stage, the
     same composition as slam/charge): at N=1 both stages are identity. */
  const tickDmg=Math.round(Math.round(BR.tickDmg*(B.dmgMul||1))*s.dmgScale);
  const fx=Math.sin(b.lockYaw), fz=Math.cos(b.lockYaw);
  const hx=b.x+fx*BR.headDist, hz=b.z+fz*BR.headDist;
  const cosHalf=Math.cos(BR.halfAngleDeg*DEG);
  for(const h of s.heroes){
    if(h.downed||h.hp<=0)continue;
    if(h.state==='roll')continue;                    // roll i-frames
    const dx=h.x-hx, dz=h.z-hz;
    const d=Math.sqrt(dx*dx+dz*dz);
    if(d>BR.range+HERO_R)continue;
    if(d>0.001 && (dx*fx+dz*fz)/d<cosHalf)continue;   // outside the cone
    h.hp=Math.max(0,h.hp-tickDmg);
    b.pursuit=0;                                      // a hit landed: no ramp
    emit('hit',{x:h.x,z:h.z,y:1.5,dmg:tickDmg,crit:false,type:'boss'});
    if(h.hp<=0)resolveHeroDeath(s,h);
  }
}

function updateBoss(s,b,dt){
  if(!b||b.hp<=0)return;
  const B=bossCfgOf(s);
  /* FURY tempo: telegraph durations and cooldowns that START while
     the boss is furious are divided by tempoMul (attack speed +15%).
     A timer already running when fury triggers keeps the duration it
     started with — the divisor is read here, at assignment time only.
     Breath tickEvery/duration and charge duration/speed are NOT
     tempo-scaled: per-breath damage is unchanged, the boss simply
     cycles to its next attack sooner. */
  const tempo=b.furious?CFG.boss2.fury.tempoMul:1;
  /* FROZEN (Frost Nova, half duration on bosses): everything pauses —
     cooldowns, pursuit ramp, telegraph/charge/breath timers — and the
     boss does not move. It can still be hit and killed while frozen. */
  if((b.frozen||0)>0){ b.frozen--; b.hitFlash=Math.max(0,(b.hitFlash||0)-dt*4); b.vx=0; b.vz=0; return; }
  b.hitFlash=Math.max(0,(b.hitFlash||0)-dt*4);
  b.cd=Math.max(0,b.cd-dt); b.slamCd=Math.max(0,b.slamCd-dt);
  b.spinCd=Math.max(0,(b.spinCd||0)-dt); b.superCd=Math.max(0,(b.superCd||0)-dt);
  if(B.breath)b.brCd=Math.max(0,(b.brCd||0)-dt);
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
    /* (f) stuck watchdog + detour, same rule as the enemies (and the
       boss additionally ignores fence colliders outright — see the
       moveWithCollision call below). While detouring the boss does not
       start attacks: it slides along the blocker until the straight
       path to the hero is clear (fences never block its path check —
       it walks through them). */
    if(b.lastD>=0){
      const disp=Math.sqrt((b.x-b.watchX)*(b.x-b.watchX)+(b.z-b.watchZ)*(b.z-b.watchZ));
      const prog=(b.lastD-d)*(b.wantMode||0);
      if(prog>0.03)b.stuckT=0;
      else if(b.wantMode&&disp<B.speed*FIXED*0.35)b.stuckT++;
      if(b.detourT>0&&b.stuckT>=40){ b.detourS=-b.detourS; b.stuckT=0; }
    }
    b.watchX=b.x; b.watchZ=b.z;
    if(b.detourT>0)b.detourT--;
    if(b.stuckT>=40&&b.detourT<=0){
      b.detourT=900; b.stuckT=0;
      b.detourS=pickDetourSide(s,b,dx/d,dz/d,B.radius);
    }
    if(b.detourT>0&&pathClear(s,b.x,b.z,h.x,h.z,B.radius,true))b.detourT=0;
    b.wantMode=d>stopDist?1:0;
    const sp=(B.speed+boost)*(b.enraged?CFG.boss2.speedMul:1)*(b.furious?CFG.boss2.fury.speedMul:1);
    if(b.detourT>0){
      if(d>stopDist){ mvx=-dz/d*sp*b.detourS; mvz=dx/d*sp*b.detourS; b.yaw=Math.atan2(mvx,mvz); }
    }else{
    if(d>stopDist){ mvx=dx/d*sp; mvz=dz/d*sp; }
    if(B.breath && b.brCd<=0 && d>=B.breath.minRange && d<=B.breath.maxRange){
      /* Fire breath wins the mid-range slot when it is ready; the facing
         LOCKS here, at telegraph start, so a sidestep during the 0.8 s
         wind-up genuinely avoids the cone (locked-facing dodge rule). */
      b.lockYaw=b.yaw; b.state='breathTele'; b.timer=B.breath.tele/tempo;
      mvx=0;mvz=0;
      emit('bossTelegraph',{x:b.x,z:b.z,kind:'BREATH'});
    }else if(B.superRange && d<=B.superRange && b.superCd<=0){
      /* Super slam (Spiked Ogre): the longest telegraph in the game, and
         the only boss attack that damages a CIRCLE rather than an arc —
         the dodge is "leave the ring", not "step sideways". The fixed
         warning ring (bossWindup) shows exactly where it lands. */
      b.lockYaw=b.yaw; b.state='superTele'; b.timer=B.superTele/tempo;
      mvx=0;mvz=0;
      emit('bossTelegraph',{x:b.x,z:b.z,kind:'SLAM'});
      emit('bossWindup',{x:b.x,z:b.z,r:B.superRange,kind:'super'});
    }else if(B.spinRange && d<=B.spinRange && b.spinCd<=0){
      /* 360-degree spin (Spiked Ogre): no facing lock matters, the
         whole circle is hit. */
      b.lockYaw=b.yaw; b.state='spinTele'; b.timer=B.spinTele/tempo;
      mvx=0;mvz=0;
      emit('bossTelegraph',{x:b.x,z:b.z,kind:'SPIN'});
      emit('bossWindup',{x:b.x,z:b.z,r:B.spinRange,kind:'spin'});
    }else if(d>B.chargeRange && b.cd<=0){
      b.lockYaw=b.yaw; b.state='chargeTele'; b.timer=B.chargeTele/tempo;
      mvx=0;mvz=0;
      emit('bossTelegraph',{x:b.x,z:b.z,kind:'CHARGE'});
    }else if(d<=B.slamRange && b.slamCd<=0){
      b.lockYaw=b.yaw; b.state='slamTele'; b.timer=B.slamTele/tempo;
      mvx=0;mvz=0;                     // freeze AT the wind-up start so the slam lands
      emit('bossTelegraph',{x:b.x,z:b.z,kind:'SLAM'});
    }
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
      if(hurtHero(s,h,Math.round(Math.round(B.chargeDmg*(B.dmgMul||1))*s.dmgScale),'boss'))emit('bossSlam',{x:h.x,z:h.z});
    }
    if(b.timer<=0){ b.state='recover'; b.timer=0.75; b.cd=B.chargeCd/tempo; b.slamCd=0.7/tempo; b.chargeHit=false; }
  }else if(b.state==='slamTele'){
    b.timer-=dt;
    // A lunging wind-up: the boss keeps closing (but never crosses) the hero,
    // so the slam actually lands on a moving target instead of expiring in air.
    if(d>stopDist){ const sp=(B.speed+boost)*(b.enraged?CFG.boss2.speedMul:1)*(b.furious?CFG.boss2.fury.speedMul:1); mvx=dx/d*sp; mvz=dz/d*sp; }
    if(b.timer<=0){
      b.state='slam'; b.timer=0.35;
      const ddx=h.x-b.x, ddz=h.z-b.z, dd=Math.sqrt(ddx*ddx+ddz*ddz)||0.001;
      // Point-blank always counts as in-arc: a centred slam cannot "miss"
      // just because the boss stepped past the hero on the previous tick.
      const inArc=dd<1.2 || (ddx*Math.sin(b.lockYaw)+ddz*Math.cos(b.lockYaw))/dd>=Math.cos(70*DEG);
      if(dd<=B.slamRange && inArc){
        b.pursuit=0;
        if(hurtHero(s,h,Math.round(Math.round((B.slamDmg+(b.enraged?CFG.boss2.slamBonus:0))*(B.dmgMul||1))*s.dmgScale),'boss'))emit('bossSlam',{x:h.x,z:h.z});
      }
      emit('bossSlamFx',{x:b.x,z:b.z});
    }
  }else if(b.state==='slam'){
    b.timer-=dt; if(b.timer<=0){ b.state='recover'; b.timer=0.55; b.slamCd=1.1/tempo; }
  }else if(b.state==='superTele'){
    /* Stationary, club raised, facing frozen. Creeps forward very
       slowly so the slam still lands on a hero who only backs off a
       step (the pack's super/spin telegraph behaviour). */
    b.timer-=dt; b.yaw=b.lockYaw;
    if(d>stopDist){ const sp=B.speed*0.45; mvx=dx/d*sp; mvz=dz/d*sp; }
    if(b.timer<=0){
      b.state='superSlam'; b.timer=B.superDur||0.45; b.superHit=false;
      emit('bossSuperSlam',{x:b.x,z:b.z,r:B.superRange});
    }
  }else if(b.state==='superSlam'){
    /* One damage tick, applied on the first step of the impact.
       Circular: no arc test, no facing requirement — anything inside
       the ring is hit, which is what makes it different from every
       other boss slam. Damage pipeline matches the normal slam
       (enrage bonus, cfg dmgMul, player-count scale, rounded once). */
    b.timer-=dt;
    if(!b.superHit){
      b.superHit=true;
      let any=false;
      for(let i=0;i<s.heroes.length;i++){
        const t=s.heroes[i];
        const td=Math.sqrt((t.x-b.x)*(t.x-b.x)+(t.z-b.z)*(t.z-b.z));
        if(td<=B.superRange && hurtHero(s,t,Math.round(Math.round((B.superDmg+(b.enraged?CFG.boss2.slamBonus:0))*(B.dmgMul||1))*s.dmgScale),'boss'))any=true;
      }
      if(any)emit('bossSlam',{x:b.x,z:b.z});
      emit('bossDust',{x:b.x,z:b.z,r:B.superRange});
      emit('shake',{v:0.95});
    }
    if(b.timer<=0){ b.state='recover'; b.timer=0.7; b.superCd=B.superCd/tempo; b.slamCd=0.6/tempo; }
  }else if(b.state==='spinTele'){
    b.timer-=dt; b.yaw=b.lockYaw;
    if(d>stopDist){ const sp=B.speed*0.45; mvx=dx/d*sp; mvz=dz/d*sp; }
    if(b.timer<=0){
      b.state='spin'; b.timer=B.spinDur||0.55; b.spinHit=false; b.spinAngle=0;
      emit('bossSpinStart',{x:b.x,z:b.z,r:B.spinRange});
    }
  }else if(b.state==='spin'){
    /* One full revolution. `spinAngle` drives the view only; the damage
       is a single tick at mid-spin so the hit reads as the club
       sweeping past. Same damage pipeline as the super slam. */
    const sdur=B.spinDur||0.55;
    b.timer-=dt;
    b.spinAngle=(1-Math.max(0,b.timer)/sdur)*Math.PI*2;
    if(!b.spinHit && b.timer<=sdur*0.55){
      b.spinHit=true;
      for(let i=0;i<s.heroes.length;i++){
        const t=s.heroes[i];
        const td=Math.sqrt((t.x-b.x)*(t.x-b.x)+(t.z-b.z)*(t.z-b.z));
        if(td<=B.spinRange)hurtHero(s,t,Math.round(Math.round((B.spinDmg+(b.enraged?CFG.boss2.slamBonus:0))*(B.dmgMul||1))*s.dmgScale),'boss');
      }
      emit('bossSpinHit',{x:b.x,z:b.z,r:B.spinRange});
    }
    if(b.timer<=0){ b.state='recover'; b.timer=0.5; b.spinCd=B.spinCd/tempo; b.slamCd=0.7/tempo; }
  }else if(b.state==='breathTele'){
    /* Stationary, head rearing, facing frozen at lockYaw. */
    b.timer-=dt; b.yaw=b.lockYaw;
    if(b.timer<=0){
      b.state='breath';
      /* Seed the tick accumulator with one step: 1/60 summed in floats
         lands a hair under each 0.2 boundary, which would push every
         tick one step late and eat the final tick of the 1.2 s breath
         (5 ticks land instead of the designed 6). Seeded, ticks land at
         steps 12/24/36/48/60/72 = 6 ticks phase 1, 7 in phase 2. */
      b.brTick=dt;
      b.timer=b.summoned?B.breath.p2Dur:B.breath.dur;   // phase 2 breathes longer
      emit('breathStart',{x:b.x,z:b.z,yaw:b.lockYaw});
    }
  }else if(b.state==='breath'){
    /* Stationary while breathing; damage ticks on a fixed accumulator
       so both co-op peers land identical ticks on identical steps. */
    b.yaw=b.lockYaw; b.timer-=dt; b.brTick+=dt;
    while(b.brTick>=B.breath.tickEvery){
      b.brTick-=B.breath.tickEvery;
      breathDamage(s,b,B);
    }
    if(b.timer<=0){
      b.state='recover'; b.timer=0.6;
      b.brCd=(b.summoned?B.breath.p2Cd:B.breath.cd)/tempo;  // phase 2 cools down faster; fury tempo on top
    }
  }else if(b.state==='recover'){
    b.timer-=dt; if(b.timer<=0)b.state='approach';
  }
  b.vx=mvx; b.vz=mvz;
  /* (f): the boss ignores fence-kind colliders in every state.
     (g): a charging drake (cfg.chargeThru) ignores ALL colliders —
     the arena clamp inside moveWithCollision still applies. */
  moveWithCollision(s,b,mvx*dt,mvz*dt,B.radius,
    (b.state==='charge'&&B.chargeThru)?{skipAll:true}:{skipFence:true});
  /* (f) watchdog bookkeeping for the next step. */
  b.lastD=d;
  if(b.state!=='approach')b.wantMode=0;
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
  s.choices=[]; s.pickWait=0; s.phase=s.resume||'play';
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
        s.resume=s.phase; s.phase='levelup'; s.choices=pickChoices(s); s.pickWait=0;
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
  if(aliveN>=s.aliveCap)return true;   // event holds this slot; spawn when one frees
  const t=s.eventQueue.shift(), a=rnd(s)*TAU, rr=rndR(s,17,29);
  const ah=anchorHero(s); let x=ah.x+Math.sin(a)*rr, z=ah.z+Math.cos(a)*rr;
  const dd=Math.sqrt(x*x+z*z);
  if(dd>ARENA_R-2){ x*=(ARENA_R-2)/dd; z*=(ARENA_R-2)/dd; }
  makeEnemy(s,t,x,z,rndR(s,0.2,1.1)); emit('spawn',{x,z,type:t});
  return true;
}
function spawnEnemy(s){
  const alive=s.enemies.filter(e=>!e.dead);
  if(alive.length>=s.aliveCap)return;          // ONE global alive cap (8/8/10/12 by roster size)
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
    /* The fill pool is derived from the enemy descriptors (FILL_POOL),
       with per-chapter overrides where a map descriptor carries them
       (FILL_POOLS — today only chapter 1). ORDER IS LOAD-BEARING:
       it fixes how the weighted roll below consumes sim.rng. */
    const pool=[];
    for(const f of FILL_POOLS[s.chapter]||FILL_POOL){
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
  const shp=Math.round(C.hp*s.hpScale);   // player-count HP scaling (spawn-time, one round)
  const e={id:s.nextId++,type,x,z,yaw:Math.atan2(anchorHero(s).x-x,anchorHero(s).z-z),
    lockYaw:0,hp:shp,maxHp:shp,state:'chase',timer:0,cd:cd||0.5,
    slamCd:0,attackKind:'melee',vx:0,vz:0,hitFlash:0,cancelFlash:0,dead:false,frozen:0,
    stuckT:0,detourT:0,detourS:1,lastD:-1,wantMode:0,watchX:x,watchZ:z};
  /* Elite signature state (archery pack, AB-NET-20) — only kinds whose
     cfg carries the blocks get the fields, so every other kind's digest
     line and memory shape stay exactly as before. Cooldowns start
     READY: the trigger conditions (hero in range) gate the first use,
     and the pack's cadence numbers describe the cycle from there. */
  if(C.volleyDmg!==undefined){ e.volCd=0; e.volX=0; e.volZ=0; }
  if(C.bannerHp!==undefined){ e.banCd=0; }
  s.enemies.push(e);return e;
}
function spawnBoss(s){
  const ah=anchorHero(s);
  const BC=bossCfgOf(s);
  const BD=BOSSES[s.chapter]||{};
  /* One boss for most chapters; a descriptor carrying `twinFigure`
     fields TWO of the same boss in different colours (chapter 4's
     Spiked Ogres — Matt, 2026-11-14). The twin sweeps from the opposite
     side of the arena and consumes its own spawn rolls; single-boss
     chapters consume the rng exactly as before. */
  const figs=[BD.figure||'boss']; if(BD.twinFigure)figs.push(BD.twinFigure);
  /* AB-NET-13 (Matt): the field does NOT clear when the boss arrives.
     Enemies already spawned stay — current HP, current state — and keep
     fighting alongside the boss; wave spawning has already stopped
     (the spawn block only runs in phase 'play'). In-flight projectiles
     still clear: they are transient, not field enemies. Chapter advance
     (phase 'clear') still resets the field as before. */
  s.projectiles=[];
  const bhp=Math.round(BC.hp*s.hpScale);   // bosses share the enemy HP scaling rule (applied per boss)
  s.bosses=[];
  let fx=0, fz=0;
  figs.forEach((fig,bi)=>{
    const a0=rnd(s)*TAU+(bi?Math.PI:0), rr=rndR(s,BC.spawnMin,BC.spawnMax);
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
    if(bi===0){ fx=x; fz=z; }
    s.bosses.push({id:s.nextId++,fig,x,z,yaw:Math.atan2(ah.x-x,ah.z-z),lockYaw:0,
      hp:bhp,maxHp:bhp,state:'approach',timer:0,cd:2.2,slamCd:0,
      chargeVX:0,chargeVZ:0,chargeHit:false,pursuit:0,hitFlash:0,vx:0,vz:0,frozen:0,
      stuckT:0,detourT:0,detourS:1,lastD:-1,wantMode:0,watchX:x,watchZ:z,
      spinCd:0,superCd:0,spinAngle:0,spinHit:false,superHit:false,
      brCd:BC.breath?BC.breath.firstCd:0,brTick:0});
  });
  s.bossSpawned=true; s.bossSpawnTick=s.tick; s.phase='boss';
  emit('bossSpawn',{x:fx,z:fz,dist:Math.sqrt((fx-ah.x)*(fx-ah.x)+(fz-ah.z)*(fz-ah.z))});
}
function simStep(raw){
  const s=SIM;
  /* Input routing: a co-op frame is {p1,p2}; anything else is the solo
     input, applied to the (single) hero through the same code path. */
  let inps;
  if(raw&&raw.list){ inps=s.heroes.map((h,i)=>normInput(raw.list[i])); }
  else if(raw&&raw.p1){ inps=[normInput(raw.p1),normInput(raw.p2)]; }
  else { const one=normInput(raw); inps=s.heroes.map(()=>one); }
  const inp=inps[0];
  if(s.hitStop>0){ s.hitStop--; return; }         // frozen world, deterministic step consumed
  if(s.phase==='levelup'){
    /* Only the designated picker stamps a choice (the net layer locks
       every other player's frames to -1, as it always has for the 2P
       guest), so scanning in roster order finds exactly that choice.
       Solo/harness frames behave as before: hero 0's frame is the
       only one that ever carries one. */
    const pick=inps.find(x=>x.upgrade>=0);
    if(pick)applyUpgrade(s,pick.upgrade);
    else if(s.players>1){
      /* Safety net (AB-NET-16): a co-op run can never sit on this
         screen forever — a downed or idle picker once soft-locked a
         real run (Matt, 2026-11-14). The wait is counted HERE, in
         sim steps, from identical state on every client, so the
         auto-pick (the first offered upgrade) lands on the same tick
         everywhere. Solo is exempt: one player, nobody held hostage. */
      s.pickWait++;
      if(s.pickWait>=CFG.pickTimeoutSteps)applyUpgrade(s,0);
    }
    return;
  }
  if(s.phase==='clear'){
    s.chapterClearTimer-=FIXED;
    if(s.chapterClearTimer<=0){
      if(s.chapter<CHAPTER_COUNT){
        s.chapter++; s.map=buildMapData(s.chapter);
        s.waveLeft=CFG.waveSeconds; s.bossSpawned=false; s.boss=null;
        s.enemies=[]; s.projectiles=[]; s.arrows=[]; s.gems=[]; s.heals=[]; s.potions=[];
        s.banners=[];
        s.eventDone=false; s.eventQueue=[];
        s.heroes.forEach((h,i)=>{
          const sp=heroSpawnPos(i,s.players);
          h.x=sp[0]; h.z=sp[1]; h.vx=0; h.vz=0;
          if(h.state==='gone'){
            /* A player whose slot was removed after the resume window
               lapsed stays OUT of the run: no revive, no heal. */
            h.st=0;
          }else{
            h.state='idle'; h.st=0;
            if(h.downed){ h.downed=false; h.hp=Math.round(h.maxHp*0.5); }
            else h.hp=Math.min(h.maxHp,h.hp+30);
          }
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
    s.waveLeft-=SCHED_DT;
    s.spawnTimer-=SCHED_DT;
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
  updateBanners(s,FIXED);
  updateProjectiles(s,FIXED);
  updateArrows(s,FIXED);
  for(const b of s.bosses)updateBoss(s,b,FIXED);
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
    put(h.heroId||'hero');
  }
  /* Account-block extensions (crit / magicDmg from Helm / Charm) are
     hashed ONLY when some hero actually carries them — the same
     conditional-hash discipline as hero arrows below. Every shipped
     scenario runs zero blocks, so its digest stream is untouched;
     when an equipped account plays, the fields are full sim state
     (crit feeds damage rolls, magicDmg feeds castMagic) and hashed
     like everything else. */
  if(s.heroes.some(h=>(h.mods.crit||0)!==0||(h.mods.magicDmg||0)!==0)){
    put('X'+s.heroes.length);
    for(const h of s.heroes){ put((h.mods.crit||0).toFixed(4)); put(h.mods.magicDmg||0); }
  }
  put('E'+s.enemies.length);
  for(const e of s.enemies){ for(const v of [e.id,e.x,e.z,e.yaw,e.lockYaw,e.hp,e.timer,e.cd,e.state==='telegraph'?1:0,e.vx,e.vz])put(q(v)); put(e.state); put(e.attackKind||''); put(e.frozen||0);
    /* Elite signature state (AB-NET-20) is hashed CONDITIONALLY — only
       kinds carrying the fields emit them, so every pre-existing
       kind's line is byte-identical to before. The volley ring centre
       is hashed at the standard q() precision: it is the damage zone,
       and a peer disagreement about it is a desync by definition. */
    if(e.volCd!==undefined){ put(q(e.volCd)); put(q(e.volX)); put(q(e.volZ)); }
    if(e.banCd!==undefined)put(q(e.banCd)); }
  /* Banners: hashed only while any exist (the hero-arrow discipline),
     so runs and scenarios without a banner knight keep their stream. */
  if(s.banners.length){
    put('BN'+s.banners.length);
    for(const bn of s.banners)for(const v of [bn.id,bn.x,bn.z,bn.hp,bn.owner,bn.t,bn.healAcc])put(q(v));
  }
  put('P'+s.projectiles.length);
  for(const p of s.projectiles)for(const v of [p.id,p.x,p.z,p.vx,p.vz,p.life,p.tx||0,p.tz||0])put(q(v));
  /* Hero arrows are hashed ONLY while any are in flight. Every shipped
     digest scenario runs the default (melee) hero, whose arrow list is
     always empty — hashing unconditionally would move those baselines
     for a state that never occurs in them. When an archer IS playing,
     her arrows are full sim state and hashed like projectiles. */
  if(s.arrows.length){
    put('A'+s.arrows.length);
    for(const a of s.arrows)for(const v of [a.id,a.x,a.z,a.vx,a.vz,a.dist])put(q(v));
  }
  put('G'+s.gems.length);for(const g of s.gems)for(const v of [g.id,g.x,g.z])put(q(v));
  put('H'+s.heals.length);for(const o of s.heals)for(const v of [o.id,o.x,o.z])put(q(v));
  /* Boss line: count, then per boss the full state — including the
     spin/super fields (hashed like the pack specified, so a twin ogre's
     telegraph timers can never drift between co-op peers) and the
     figure each boss wears (twin assignment is sim state). */
  put('B'+s.bosses.length);
  for(const b of s.bosses){ for(const v of [b.x,b.z,b.yaw,b.lockYaw,b.hp,b.timer,b.cd,b.slamCd,b.pursuit||0,b.state==='charge'?1:0,b.brCd||0,b.brTick||0,b.spinCd||0,b.superCd||0,b.spinHit?1:0,b.superHit?1:0])put(q(v)); put(b.state); put(b.fig||''); put(b.enraged?1:0); put(b.summoned?1:0); put(b.furious?1:0); put(b.frozen||0); }
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

/* ---------- renderer & graphics quality ---------- */
/* Graphics quality — view-only and per-device, stored in localStorage
   key 'ab_gfx' ('high' = HD, anything else = SD). DEFAULT IS SD, and SD
   is exactly the renderer this game shipped with: Lambert materials
   everywhere, no shadow maps, no environment map, antialias off,
   pixelRatio capped at 1.25 — the proven phone path, kept as the
   default for every existing player. HD (opt-in via the #btnGfx HUD
   toggle) swaps prop/character materials to clearcoat physical (glossy
   ABS plastic), adds a procedural PMREM studio environment, hero-
   following PCFSoft shadows and a pixelRatio cap of 2. Nothing here is
   read by the sim: digests and the net stamp do not move, and HD/SD
   players pair freely in co-op. The setting is read BEFORE the
   renderer is created because antialias is a creation-time choice. */
let GFX_HIGH=false;
try{ GFX_HIGH=localStorage.getItem('ab_gfx')==='high'; }catch(e){}
const renderer = new T.WebGLRenderer({antialias:GFX_HIGH,powerPreference:'high-performance',alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,GFX_HIGH?2:1.25));
renderer.setSize(innerWidth,innerHeight);
$('stage').appendChild(renderer.domElement);
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(58,innerWidth/innerHeight,0.1,260);
const hemi = new T.HemisphereLight(0xbcd8ff,0x30251f,1.0);
const sun  = new T.DirectionalLight(0xfff0d0,1.25); sun.position.set(28,46,18);
const amb  = new T.AmbientLight(0xffffff,0.30);
scene.add(hemi,sun,amb);
scene.add(sun.target);   // the HD shadow-follow rig aims the sun; inert in SD

/* HD shadow rig: one 2048 PCFSoft map whose camera box (±30 m — a
   tighter box than the whole arena, for texel density) follows the
   local hero via updateSunFollow() in the frame loop. Configured
   unconditionally; with castShadow off (SD) none of it costs anything. */
if(GFX_HIGH){ renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap; }
sun.castShadow=GFX_HIGH;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{near:5,far:120,left:-30,right:30,top:30,bottom:-30});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.03;

/* Procedural studio environment (HD only) — two bright panels PMREM'd
   into an environment map; zero external HDRI files. Built lazily so an
   SD boot pays nothing, and SD never assigns scene.environment at all. */
let gfxEnvTex=null;
function ensureStudioEnv(){
  if(gfxEnvTex)return gfxEnvTex;
  const pmrem=new T.PMREMGenerator(renderer);
  const envScene=new T.Scene();
  envScene.background=new T.Color(0x28364a);
  const panelTop=new T.Mesh(new T.PlaneGeometry(30,30),
    new T.MeshBasicMaterial({color:0xfff8ee,side:T.DoubleSide}));
  panelTop.position.set(0,18,0); panelTop.rotation.x=Math.PI/2;
  const panelRim=new T.Mesh(new T.PlaneGeometry(24,14),
    new T.MeshBasicMaterial({color:0x8cc4ff,side:T.DoubleSide}));
  panelRim.position.set(-16,8,-14); panelRim.lookAt(0,0,0);
  envScene.add(panelTop,panelRim);
  gfxEnvTex=pmrem.fromScene(envScene,0.04).texture;
  pmrem.dispose();
  return gfxEnvTex;
}
if(GFX_HIGH){ scene.environment=ensureStudioEnv(); scene.environmentIntensity=0.5; }

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
  // speckles / cracks — texStyle is a PALETTE flag, not a chapter number:
  // 'grass' | 'ash' | 'snow' | 'mud' | 'caldera'. Chapters 1-3 keep their
  // exact original look because their palettes name the style they always
  // used implicitly ('grass', 'grass', 'ash').
  const TS=P.texStyle||'grass';
  for(let i=0;i<900;i++){
    const x=R()*S,y=R()*S;
    g.fillStyle=TS==='caldera'&&R()<0.42?'rgba(255,150,70,.40)':
                TS==='ash'&&R()<0.35?'rgba(255,110,40,.45)':
                TS==='snow'&&R()<0.45?'rgba(255,255,255,.55)':
                TS==='mud'&&R()<0.30?'rgba(24,20,14,.30)':
                R()<0.5?'rgba(255,255,255,.10)':'rgba(0,0,0,.14)';
    g.fillRect(x,y,1+R()*3,1+R()*2);
  }
  if(TS==='caldera'){
    /* Radial cooling cracks around the hot centre — reads as a cooled
       lava sheet rather than random squiggles. */
    const cx=S*0.5,cy=S*0.5;
    for(let i=0;i<58;i++){
      const a=R()*TAU, r0=(8+R()*46)*S/512, r1=r0+(70+R()*170)*S/512;
      g.strokeStyle=R()<0.34?'rgba(255,128,44,.62)':'rgba(12,9,9,.55)';
      g.lineWidth=(1+R()*3)*S/512;g.globalAlpha=.78;
      g.beginPath();g.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0);
      g.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);g.stroke();
    }
    g.globalAlpha=.22;
    for(let i=1;i<=5;i++){
      g.strokeStyle='rgba(0,0,0,.7)';g.lineWidth=(2+R()*3)*S/512;
      g.beginPath();g.arc(cx,cy,(48+i*46)*S/512,0,TAU);g.stroke();
    }
    for(let i=0;i<620;i++){
      const x=R()*S,y=R()*S;
      g.fillStyle=R()<0.22?'rgba(255,158,78,.34)':'rgba(196,186,176,.10)';
      g.fillRect(x,y,1+R()*2,1+R()*2);
    }
    g.globalAlpha=1;
  }else if(TS==='ash'){
    g.strokeStyle='rgba(255,105,35,.55)';g.lineWidth=2*S/512;g.globalAlpha=.8;
    for(let i=0;i<26;i++){
      const x=R()*S,y=R()*S;g.beginPath();g.moveTo(x,y);
      for(let k=0;k<4;k++)g.lineTo(x+(R()-0.5)*70*S/512,y+(R()-0.5)*70*S/512);g.stroke();
    }
    g.globalAlpha=1;
  }else if(TS==='snow'){
    // wind-swept drift strokes and cold blue shadow creases (FROSTFALL)
    for(let i=0;i<40;i++){
      const x=R()*S,y=R()*S,len=(18+R()*46)*S/512;
      g.strokeStyle=R()<0.5?'rgba(255,255,255,.42)':'rgba(120,160,190,.20)';
      g.lineWidth=(2+R()*4)*S/512;g.globalAlpha=.7;
      g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+len*0.5,y-6*S/512,x+len,y);g.stroke();
    }
    g.globalAlpha=1;
  }else if(TS==='mud'){
    // cart ruts and churned earth (DARK AGE SIEGE)
    for(let i=0;i<34;i++){
      const x=R()*S,y=R()*S,len=(14+R()*38)*S/512;
      g.strokeStyle=R()<0.5?'rgba(20,18,12,.28)':'rgba(150,130,95,.16)';
      g.lineWidth=(2+R()*3)*S/512;g.globalAlpha=.65;
      g.beginPath();g.moveTo(x,y);g.lineTo(x+len,y+(R()-0.5)*12*S/512);g.stroke();
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
  sun.color.setHex(P.light); sun.intensity=P.sunIntensity;
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
  if(GFX_HIGH){ m.receiveShadow=true;
    // emissive decals / glow / flames (MeshBasicMaterial) never cast —
    // a solid shadow from a transparent glow disc would read as a scorch mark
    if(!mat.isMeshBasicMaterial)m.castShadow=true; }
  mapGroup.add(m); return m;
}
/* Prop materials: Lambert in SD (the shipped look); glossy clearcoat
   physical in HD. Caller opts win over the HD defaults. */
const MAT=(color,opts)=>GFX_HIGH
  ? new T.MeshPhysicalMaterial(Object.assign({color,roughness:0.26,metalness:0.0,clearcoat:0.35,clearcoatRoughness:0.12},opts||{}))
  : new T.MeshLambertMaterial(Object.assign({color},opts||{}));
/* Character materials (the three rig builders, the brick pickups, the
   arrows): same SD/HD split, slightly glossier clearcoat. The class is
   chosen when the material is BUILT — a live #btnGfx toggle re-skins
   everything built afterwards (new spawns, the next chapter's map, the
   reopened picker); the rest follows on next load. */
const CHARMAT=(opts)=>GFX_HIGH
  ? new T.MeshPhysicalMaterial(Object.assign({roughness:0.24,metalness:0.0,clearcoat:0.42,clearcoatRoughness:0.10},opts||{}))
  : new T.MeshLambertMaterial(opts||{});

function buildMapMeshes(sim){
  disposeGroup(mapGroup);
  mapGroup=new T.Group(); scene.add(mapGroup);
  const ch=sim.chapter,P=PALETTES[ch-1],d=sim.map,V=PROPS;
  setSky(ch);
  const gt=groundTexture(ch);
  groundMesh=new T.Mesh(new T.PlaneGeometry(V.ground.view.width,V.ground.view.height),
    new T.MeshLambertMaterial({map:gt}));
  groundMesh.rotation.x=-Math.PI/2; groundMesh.position.y=-0.02;
  groundMesh.receiveShadow=GFX_HIGH;
  mapGroup.add(groundMesh);

  /* ---- pond + rim: src/content/props/pond.js ---- */
  const PW=V.pond.view;
  const lavaWater=!!P.lavaWater;   // palette flag, not a chapter number
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
    const dead=p.kind===1, burnt=p.kind===2, snow=p.kind===3;
    const sc=dead?CV.scaleDead:(snow?CV.scaleSnow:CV.scaleNormal);
    const lift=dead?CV.liftDead:(snow?CV.liftSnow:CV.liftNormal);
    o.position.set(p.x,lift*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(sc[0]*p.s,sc[1]*p.s,sc[2]*p.s);
  },p=>p.kind===3?new T.Color(CV.snowColor):
       (p.kind===2?new T.Color(CV.burntColor):
       (p.kind===1?new T.Color(CV.deadColor):cTree)));
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

  /* ---- THEME GEOMETRY -------------------------------------------------
     An optional per-chapter silhouette vocabulary (chapter 5's caldera).
     Deliberately VIEW-ONLY: it reads MAP_CONFIGS (content) directly and
     never touches sim.map — only the `cr` collider radii were mirrored
     into the sim by buildMapData(). A chapter with no `theme` renders
     exactly as before. Each family is one instanced draw call. */
  const TH=(MAP_CONFIGS[ch-1]||{}).theme;
  if(TH){
    /* Shield-caldera mesas: base radius r, flat top radius 0.52r, height
       h. A WIDE low cone reads as a caldera from the follow camera; a
       tall narrow one just occludes the arena. */
    if(TH.mesas&&TH.mesas.length)
      inst(new T.CylinderGeometry(0.26,0.5,1,9),MAT(TH.coneColor),TH.mesas,(o,p)=>{
        o.position.set(p.x,p.y,p.z);o.rotation.set(0,p.rot,0);
        o.scale.set(p.r*2,p.h,p.r*2);
      });
    if(TH.cones&&TH.cones.length)
      inst(new T.ConeGeometry(0.5,1,6),MAT(TH.coneColor),TH.cones,(o,p)=>{
        o.position.set(p.x,p.h/2,p.z);o.rotation.set(0,p.rot,0);
        o.scale.set(p.r*2,p.h,p.r*2);
      });
    /* Horizon ring, in its own lighter haze colour — at the caldera's
       near-black the skyline read as a wall. */
    if(TH.skyline&&TH.skyline.length)
      inst(new T.ConeGeometry(0.5,1,6),MAT(TH.skylineColor||TH.coneColor),TH.skyline,(o,p)=>{
        o.position.set(p.x,p.h/2,p.z);o.rotation.set(0,p.rot,0);
        o.scale.set(p.r*2,p.h,p.r*2);
      });
    // Dark crater rims, drawn BEFORE the glow so the lip frames the lava.
    if(TH.rims&&TH.rims.length)
      inst(new T.RingGeometry(0.78,1,20),MAT(TH.rimColor||TH.coneColor),TH.rims,(o,p)=>{
        o.position.set(p.x,p.y,p.z);o.rotation.set(-Math.PI/2,0,p.rot);o.scale.setScalar(p.r);
      });
    // Glowing crater caps, laid flat on the mesa tops.
    if(TH.craters&&TH.craters.length)
      inst(new T.CircleGeometry(1,20),new T.MeshBasicMaterial({color:TH.glow,
        side:T.DoubleSide,transparent:true,opacity:0.95,depthWrite:false}),TH.craters,(o,p)=>{
        o.position.set(p.x,p.y,p.z);o.rotation.set(-Math.PI/2,0,p.rot);o.scale.setScalar(p.r);
      });
    /* Lava channels: a wide dim additive glow first, then the bright
       narrow core. A black border made them read as taped-on beams. */
    if(TH.ribbons&&TH.ribbons.length){
      inst(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({color:TH.riverColor,
        transparent:true,opacity:0.34,depthWrite:false}),TH.ribbons,(o,p)=>{
        o.position.set(p.x,0.04,p.z);o.rotation.set(0,p.rot,0);
        o.scale.set(p.w*2.6,0.08,p.len*1.01);
      });
      inst(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({color:TH.glow}),TH.ribbons,(o,p)=>{
        o.position.set(p.x,0.07,p.z);o.rotation.set(0,p.rot,0);
        o.scale.set(p.w,0.10,p.len);
      });
    }
    // Solid hexagonal basalt columns (colliders mirrored in buildMapData).
    if(TH.columns&&TH.columns.length)
      inst(new T.CylinderGeometry(0.5,0.5,1,6),MAT(TH.columnColor),TH.columns,(o,p)=>{
        o.position.set(p.x,p.h/2,p.z);o.rotation.set(0,p.rot,0);
        o.scale.set(p.r*2,p.h,p.r*2);
      });
    // Floating embers + ash plume.
    if(TH.embers&&TH.embers.length)
      inst(new T.SphereGeometry(1,6,4),new T.MeshBasicMaterial({color:TH.emberColor,
        transparent:true,opacity:0.85,depthWrite:false}),TH.embers,(o,p)=>{
        o.position.set(p.x,p.y,p.z);o.scale.setScalar(p.s);
      });
  }
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
  /* HAMMER SLAM (the Earth Dwarf, 'Matt'): same 0.625 s envelope and the
     same hit key at t=0.25 as the sword swing, but the motion is a
     two-handed OVERHEAD slam in the pitch plane — no spine yaw, no
     across-body z. The weapon arm (6/7/8) hauls the hammer high behind
     the head by t=0.13 (joint 6 x -2.55: up and back over the crown),
     the left arm (3/4) comes up with it as if gripping the haft, the
     spine leans back; then everything pitches forward into the hit key
     (spine +0.40, hips +0.24 crouch, arm +0.95) and recovers. View-only:
     clip choice keys on heroId in syncViews; sim timing is untouched. */
  hammer: CLIP(0.625,false,[
    {t:0,    p:pose({1:[-0.06,0,0],3:[-0.30,0,0.15],4:[-0.30,0,0],6:[-0.70,0,-0.10],7:[-0.50,0,0],8:[0.25,0,0]})},
    {t:0.13, p:pose({0:[-0.05,0,0],1:[-0.22,0,0],2:[-0.14,0,0],3:[-2.00,0,0.55],4:[-0.55,0,0],6:[-2.55,0,-0.12],7:[-0.85,0,0],8:[0.55,0,0],9:[0.08,0,0],11:[-0.08,0,0]})},
    {t:0.25, p:pose({0:[0.24,0,0],1:[0.40,0,0],2:[0.16,0,0],3:[0.60,0,0.30],4:[-0.25,0,0],6:[0.95,0,0.05],7:[-0.12,0,0],8:[-0.30,0,0],9:[-0.28,0,0],10:[0.30,0,0],11:[0.20,0,0],12:[0.10,0,0]})},
    {t:0.44, p:pose({0:[0.10,0,0],1:[0.16,0,0],3:[0.15,0,0.25],4:[-0.15,0,0],6:[0.35,0,0],7:[-0.45,0,0],8:[-0.10,0,0]})},
    {t:0.625,p:pose({})}
  ]),
  /* GROUND SLAM (the Earth Dwarf's Earthquake cast): a one-shot 0.9 s
     overhead slam, deliberately NOT the attack swing — a bigger, slower
     raise (weapon arm to -2.90 behind the crown by t=0.20, spine leaned
     back -0.32), the hammer driven to the ground at the t=0.34 IMPACT
     key (arm +1.32, spine +0.58, deep hip/knee crouch), a brief hold at
     the bottom (t=0.52), then recover. View-only: the 'magic' event
     starts it on the caster's view (see dwarfEarthCast / syncViews) and
     the earthquake ring + dust fire at SLAM_IMPACT_T, synced to the
     impact key. Sim cast timing/damage/knockback are untouched. */
  groundslam: CLIP(0.9,false,[
    {t:0,    p:pose({1:[-0.06,0,0],3:[-0.30,0,0.15],4:[-0.30,0,0],6:[-0.70,0,-0.10],7:[-0.50,0,0],8:[0.25,0,0]})},
    {t:0.20, p:pose({0:[-0.08,0,0],1:[-0.32,0,0],2:[-0.20,0,0],3:[-2.35,0,0.50],4:[-0.65,0,0],6:[-2.90,0,-0.10],7:[-0.95,0,0],8:[0.60,0,0],9:[0.10,0,0],11:[-0.10,0,0]})},
    {t:0.34, p:pose({0:[0.36,0,0],1:[0.58,0,0],2:[0.24,0,0],3:[0.85,0,0.28],4:[-0.18,0,0],6:[1.32,0,0.04],7:[-0.05,0,0],8:[-0.38,0,0],9:[-0.58,0,0],10:[0.72,0,0],11:[-0.50,0,0],12:[0.64,0,0]})},
    {t:0.52, p:pose({0:[0.30,0,0],1:[0.50,0,0],2:[0.20,0,0],3:[0.70,0,0.26],4:[-0.22,0,0],6:[1.20,0,0.04],7:[-0.14,0,0],8:[-0.30,0,0],9:[-0.48,0,0],10:[0.62,0,0],11:[-0.42,0,0],12:[0.55,0,0]})},
    {t:0.90, p:pose({})}
  ]),
  /* BOW SHOT (ranged heroes): same 0.625 s envelope as the sword swing.
     The bow arm (3/4/5) holds the bow up toward facing for the whole
     clip; the draw arm (6/7/8) pulls the string to the cheek during the
     wind-up and snaps forward at t=0.25 — the exact frame the sim
     releases the arrow. */
  shoot: CLIP(0.625,false,[
    {t:0,    p:pose({1:[-0.04,-0.28,0],2:[0,-0.15,0],3:[-1.50,0,0.10],4:[-0.10,0,0],6:[-0.55,0,-0.55],7:[-2.05,0,0]})},
    {t:0.25, p:pose({1:[0.02,0.06,0],2:[0,0,0],3:[-1.52,0,0.08],4:[-0.04,0,0],6:[-1.15,0,-0.15],7:[-0.35,0,0]})},
    {t:0.44, p:pose({1:[0,0,0],3:[-1.30,0,0.12],4:[-0.08,0,0],6:[-0.70,0,-0.20],7:[-0.50,0,0]})},
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
/* Hero-select live preview: a standalone figure view (id 'hsel') that lives
   in VIEWS only while the picker is open. syncViews must not reap it, and
   it is removed before any run starts. View-only — no sim entity. */
const HSEL_ID='hsel';
let hselView=null, hselSpin=0;
function makeView(kind,id){
  const bones=JOINTS.map(j=>{ const b=new T.Bone(); b.position.set(j.o[0],j.o[1],j.o[2]); return b; });
  JOINTS.forEach((j,i)=>{ if(j.p>=0)bones[j.p].add(bones[i]); });
  const mesh=new T.SkinnedMesh(rigGeometry(kind),CHARMAT({vertexColors:true}));
  mesh.add(bones[0]); mesh.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(bones));
  mesh.frustumCulled=false;
  mesh.castShadow=GFX_HIGH;
  // YXZ: yaw first, then pitch about the YAWED X axis -> a true forward somersault
  mesh.rotation.order='YXZ';
  // View scale comes from the figure descriptor (src/content/figures/<id>.js).
  mesh.scale.setScalar(FIGURE_SCALES[kind]||1);
  scene.add(mesh);
  const v={kind,id,mesh,bones,baseScale:mesh.scale.x,slamT:-1,
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
  const pB=sampleClip(CLIPS[a.cur]||CLIPS.idle,(a.cur==='attack'||a.cur==='shoot'||a.cur==='hammer'||a.cur==='groundslam')?stateTime:a.t);
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
  if(st==='attack'||st==='strike'||st==='slam'||st==='spin'||st==='superSlam')return 'attack';
  if(st==='hurt')return 'hurt';
  if(st==='dead')return 'death';
  if(st==='telegraph')return (ENEMIES[kind]&&ENEMIES[kind].cls==='ranged')?'cast':'telegraph';
  if(st==='chargeTele')return 'charge';
  if(st==='charge')return 'run';
  if(st==='recovery'||st==='recover'||st==='slamTele'||st==='spinTele'||st==='superTele')return 'telegraph';
  if(st==='volleyTele'||st==='plantTele')return 'telegraph';   // elite signature wind-ups (AB-NET-20)
  if(st==='volleyStrike')return 'attack';
  if(st==='run'||st==='approach'||st==='chase')return speed>0.45?'run':'idle';
  return 'idle';
}
function syncViews(s,dt){
  const seen=new Set();
  for(let hi=0;hi<s.heroes.length;hi++){
    const h=s.heroes[hi];
    if(h.state==='gone')continue;   // removed player: no view (reaped via seen)
    const vid=hi===0?0:-hi;
    let hv=VIEWS.get(vid);
    const skin=safeHero(HERO_SKINS[hi]);  // unknown id from an old save/peer -> default figure
    if(hv&&hv.kind!==skin){ scene.remove(hv.mesh); hv.mesh.material.dispose(); VIEWS.delete(vid); hv=null; }
    if(!hv)hv=makeView(skin,vid);
    seen.add(vid);
    const hs=h.downed?'dead':(h.hp<=0?'dead':h.state);
    let hClip=clipFor('hero',hs,Math.sqrt(h.vx*h.vx+h.vz*h.vz));
    /* A ranged hero (HERO_ATTACK) shoots: swap the sword clip for the
       bow-shot clip while her sim state is 'attack'. */
    if(hs==='attack'&&(HERO_ATTACK[h.heroId]||{}).kind==='arrow')hClip='shoot';
    /* The Earth Dwarf swings his hammer OVERHEAD, not with the sword
       slash pose: swap in the hammer clip while his sim state is
       'attack'. Same envelope, same hit frame — view layer only. */
    if(hs==='attack'&&h.heroId==='dwarf')hClip='hammer';
    /* EARTHQUAKE CAST (view-only): a pending ground slam — started by
       the 'magic' event in consumeEvents (dwarfEarthCast) — overrides
       the state clip until it has played out, sampled on its own clock
       exactly like attack/hammer are sampled on sim state time. */
    if(hv.slamT>=0){
      hv.slamT+=dt;
      if(hs==='dead'||hv.slamT>CLIPS.groundslam.dur)hv.slamT=-1;
      else hClip='groundslam';
    }
    setClip(hv,hClip,hClip==='groundslam'?hv.slamT:(h.state==='attack'?h.st:undefined));
    updateAnim(hv,dt,hClip==='groundslam'?hv.slamT:(h.state==='attack'?h.st:0));
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
    let v=VIEWS.get(e.id);
    /* Same kind guard the hero and boss loops carry: entity ids restart
       with a fresh sim (test-hook resets, co-op resume replay), and a
       stale view under a recycled id must never be reused — a custom
       boss's stub bones crash updateAnim, a standard view would silently
       draw the wrong figure. */
    if(v&&v.kind!==e.type){ scene.remove(v.mesh); if(v.dispose)v.dispose(); else v.mesh.material.dispose(); VIEWS.delete(e.id); v=null; }
    if(!v)v=makeView(e.type,e.id);
    /* Frozen figures hold their pose: clip time does not advance and a
       moving state reads as idle (the ice shell sells the rest). */
    const frz=(e.frozen||0)>0;
    const clip=clipFor(e.type,e.state,frz?0:Math.sqrt(e.vx*e.vx+e.vz*e.vz));
    setClip(v,clip);
    updateAnim(v,frz?0:dt,0);
    v.mesh.position.set(e.x,0,e.z); v.mesh.rotation.y=e.yaw;
  }
  for(const b of s.bosses){
    if(b.hp<=0)continue;
    seen.add(b.id);
    /* The boss FIGURE is per-chapter content (bosses/<id>.js), carried
       on the boss itself at spawn: chapter 2 wears the humanoid warlord
       rig; chapter 1's Emerald Drake and chapter 3's Iron Lancer are
       custom-rendered quadrupeds, each with its own view + procedural
       animation; chapter 4 fields two standard-rig ogres in different
       hides. (The pack's bug #1 lived here: a hard-coded 'boss' figure
       made every standard-rig boss draw the generic warlord.) */
    const bfig=b.fig||(BOSSES[s.chapter]||{}).figure||'boss';
    let v=VIEWS.get(b.id);
    if(v&&v.kind!==bfig){ scene.remove(v.mesh); if(v.dispose)v.dispose(); else v.mesh.material.dispose(); VIEWS.delete(b.id); v=null; }
    const bCustom=FIGURES[bfig]&&FIGURES[bfig].custom;
    const bfrz=(b.frozen||0)>0;
    if(bCustom==='dragon'){
      if(!v)v=makeDragonView(b.id,b);
      updateDragonView(v,b,bfrz?0:dt);
    }else if(bCustom==='knightMount'){
      if(!v)v=makeKnightMountView(b.id,b);
      updateKnightMountView(v,b,bfrz?0:dt);
    }else{
      if(!v)v=makeView(bfig,b.id);
      setClip(v,clipFor(bfig,b.state,bfrz?0:(b.state==='approach'?8:10)));
      updateAnim(v,bfrz?0:dt,0);
      v.mesh.position.set(b.x,0,b.z); v.mesh.rotation.y=b.yaw;
    }
  }
  if(hselView)seen.add(HSEL_ID);   // hero-select preview survives the reap while open
  for(const [id,v] of VIEWS){
    if(!seen.has(id)){ scene.remove(v.mesh); if(v.dispose)v.dispose(); else v.mesh.material.dispose(); VIEWS.delete(id); }
  }
  syncBannerViews(s);
}

/* ---------- banner views (heraldic-banner-knight, AB-NET-20) --------
   A planted banner is a static dressing entity, not a rig: pole,
   crimson cloth, gold finial, and its heal zone drawn on the ground
   as a gold rim over a faint green disc — green reads "healing" at
   gameplay distance, and the rim is exactly the sim's zone radius.
   Views key on the banner's sim id and reap when it leaves s.banners
   (destroyed, expired, or chapter change), mirroring the VIEWS reap. */
const BANNER_VIEWS=new Map();
function makeBannerView(bn){
  const g=new T.Group();
  const pole=new T.Mesh(new T.CylinderGeometry(0.045,0.045,1.9,8),MAT(0x2a2a30));
  pole.position.y=0.95; pole.frustumCulled=false;
  const cloth=new T.Mesh(new T.BoxGeometry(0.62,0.78,0.04),
    new T.MeshLambertMaterial({color:0xae211e}));
  cloth.position.set(0.34,1.44,0); cloth.frustumCulled=false;
  const finial=new T.Mesh(new T.SphereGeometry(0.09,10,8),MAT(0xdea832));
  finial.position.y=1.96; finial.frustumCulled=false;
  const rim=new T.Mesh(new T.RingGeometry(0.965,1.0,56),
    new T.MeshBasicMaterial({color:0xffd76a,transparent:true,opacity:0.55,
      side:T.DoubleSide,depthWrite:false,fog:false}));
  rim.rotation.x=-Math.PI/2; rim.position.y=0.07; rim.scale.set(bn.zone,bn.zone,1);
  rim.frustumCulled=false;
  const disc=new T.Mesh(new T.CircleGeometry(1,48),
    new T.MeshBasicMaterial({color:0x51ff7a,transparent:true,opacity:0.07,
      side:T.DoubleSide,depthWrite:false,fog:false}));
  disc.rotation.x=-Math.PI/2; disc.position.y=0.05; disc.scale.set(bn.zone,bn.zone,1);
  disc.frustumCulled=false;
  g.add(pole,cloth,finial,rim,disc);
  scene.add(g);
  return {mesh:g,cloth};
}
function syncBannerViews(s){
  const seen=new Set();
  for(const bn of s.banners){
    if(bn.hp<=0)continue;
    seen.add(bn.id);
    let v=BANNER_VIEWS.get(bn.id);
    if(!v){ v=makeBannerView(bn); BANNER_VIEWS.set(bn.id,v); }
    v.mesh.position.set(bn.x,0,bn.z);
    v.cloth.material.color.setHex(bn.hitFlash>0.3?0xff7a68:0xae211e);
  }
  for(const [id,v] of BANNER_VIEWS){
    if(!seen.has(id)){
      scene.remove(v.mesh);
      v.mesh.traverse(o=>{ if(o.geometry)o.geometry.dispose(); if(o.material)o.material.dispose(); });
      BANNER_VIEWS.delete(id);
    }
  }
}

/* =====================================================================
   EMERALD DRAKE — custom boss view (figure descriptor figures/dragon.js,
   `custom: 'dragon'`). A quadruped cannot ride the 13-joint humanoid
   rig, so the dragon is a hierarchy of merged-geometry groups — body,
   neck, head, jaw, two wings, a 3-segment tail, four legs — animated
   procedurally below. VIEW ONLY: it reads sim boss state and writes
   nothing. All colours come from TINTS.dragon; geometry is owned by
   this builder, exactly as the descriptor contract states.
   ===================================================================== */
function dGeo(parts){
  const pos=[],nor=[],col=[],idx=[];
  for(const p of parts){
    const g=prim(p.g).clone();
    const r=p.r||[0,0,0];
    const m=new T.Matrix4().makeRotationFromEuler(new T.Euler(r[0],r[1],r[2]));
    m.scale(new T.Vector3(p.s[0],p.s[1],p.s[2]));
    m.setPosition(p.o[0],p.o[1],p.o[2]);
    g.applyMatrix4(m);
    const pa=g.getAttribute('position'),na=g.getAttribute('normal'),ia=g.getIndex();
    const base=pos.length/3;
    for(let i=0;i<pa.count;i++){
      pos.push(pa.getX(i),pa.getY(i),pa.getZ(i));
      nor.push(na.getX(i),na.getY(i),na.getZ(i));
      col.push(p.c[0],p.c[1],p.c[2]);
    }
    if(ia)for(let i=0;i<ia.count;i++)idx.push(base+ia.getX(i));
    else for(let i=0;i<pa.count;i++)idx.push(base+i);
    g.dispose();
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('normal',new T.Float32BufferAttribute(nor,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(col,3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}
const dP=(g,o,s,c,r)=>({g,o,s,c,r});
function dragonBodyParts(TN){
  const A=TN.armor,L=TN.trim,R=TN.cloth;
  return [
    dP('box',[0,1.52,-1.15],[1.35,1.05,1.45],A),
    dP('box',[0,1.58,-0.05],[1.52,1.20,1.50],A),
    dP('box',[0,1.62,0.95],[1.42,1.15,1.30],A),
    dP('box',[0,1.02,-1.10],[1.05,0.30,1.30],L),
    dP('box',[0,1.00,-0.05],[1.15,0.32,1.40],L),
    dP('box',[0,1.05,0.95],[1.08,0.30,1.20],L),
    dP('sph',[0.60,1.78,1.00],[0.62,0.55,0.62],A),
    dP('sph',[-0.60,1.78,1.00],[0.62,0.55,0.62],A),
    dP('sph',[0.58,1.68,-1.25],[0.60,0.55,0.60],A),
    dP('sph',[-0.58,1.68,-1.25],[0.60,0.55,0.60],A),
    dP('cone',[0,2.28,-1.55],[0.30,0.42,0.30],R),
    dP('cone',[0,2.38,-0.75],[0.34,0.50,0.34],R),
    dP('cone',[0,2.42,0.05],[0.36,0.52,0.36],R),
    dP('cone',[0,2.40,0.80],[0.32,0.46,0.32],R),
    dP('box',[0,1.85,1.50],[1.00,0.80,0.60],A,[-0.30,0,0]),
  ];
}
function dragonNeckParts(TN){
  const A=TN.armor,L=TN.trim,R=TN.cloth;
  return [
    dP('box',[0,0.18,0.28],[0.80,0.72,0.95],A,[-0.50,0,0]),
    dP('box',[0,0.52,0.62],[0.70,0.64,0.85],A,[-0.30,0,0]),
    dP('sph',[0,0.02,0.62],[0.50,0.42,0.30],L),
    dP('sph',[0,0.38,0.90],[0.44,0.38,0.28],L),
    dP('cone',[0,0.35,-0.05],[0.20,0.34,0.20],R),
    dP('cone',[0,0.68,0.30],[0.17,0.30,0.17],R),
  ];
}
function dragonHeadParts(TN){
  const A=TN.armor,C=TN.skin,D=TN.dark,G=TN.glow;
  const teeth=[];
  for(const tx of [-0.15,-0.05,0.05,0.15])
    teeth.push(dP('cone',[tx,-0.20,0.62],[0.05,0.12,0.05],C,[Math.PI,0,0]));
  return [
    dP('box',[0,0.06,0.02],[0.68,0.56,0.72],A),
    dP('box',[0,-0.04,0.52],[0.46,0.30,0.55],A),
    dP('cone',[0,0.14,0.72],[0.12,0.26,0.12],C,[0.50,0,0]),
    dP('box',[0.20,0.22,0.30],[0.26,0.12,0.20],D),
    dP('box',[-0.20,0.22,0.30],[0.26,0.12,0.20],D),
    dP('sph',[0.21,0.10,0.37],[0.11,0.11,0.11],G),
    dP('sph',[-0.21,0.10,0.37],[0.11,0.11,0.11],G),
    dP('cone',[0.26,0.34,-0.12],[0.17,0.66,0.17],C,[-1.05,0,-0.25]),
    dP('cone',[-0.26,0.34,-0.12],[0.17,0.66,0.17],C,[-1.05,0,0.25]),
    dP('cone',[0.33,0.16,-0.18],[0.12,0.40,0.12],C,[-0.85,0,-0.40]),
    dP('cone',[-0.33,0.16,-0.18],[0.12,0.40,0.12],C,[-0.85,0,0.40]),
    dP('cone',[0.36,-0.02,0.05],[0.12,0.30,0.12],C,[0,0,-1.20]),
    dP('cone',[-0.36,-0.02,0.05],[0.12,0.30,0.12],C,[0,0,1.20]),
    ...teeth,
  ];
}
function dragonJawParts(TN){
  const A=TN.armor,C=TN.skin;
  const teeth=[];
  for(const tx of [-0.13,-0.04,0.05,0.14])
    teeth.push(dP('cone',[tx,0.06,0.50],[0.045,0.10,0.045],C));
  return [
    dP('box',[0,-0.03,0.30],[0.42,0.13,0.62],A),
    dP('cone',[0,-0.06,0.62],[0.10,0.18,0.10],C,[0.40,0,0]),
    ...teeth,
  ];
}
function dragonWingParts(TN,side){
  const R=TN.cloth,K=TN.blade,A=TN.armor;
  const parts=[dP('sph',[0.10*side,0.05,0],[0.50,0.40,0.60],A)];
  /* spars: thin boxes from the root toward each tip direction */
  const spars=[[2.95,0.15,-0.50,0.10],[2.60,0.10,-1.75,0.08],[2.00,0.05,-2.60,0.07],[1.15,0.00,-3.10,0.06]];
  for(const [tx,ty,tz,w] of spars){
    const len=Math.sqrt(tx*tx+tz*tz);
    parts.push(dP('box',[tx*side/2,ty/2,tz/2],[len,w,w],K,[0,Math.atan2(-tz,tx*side),0]));
  }
  /* membrane panels fanning between the spars */
  parts.push(dP('box',[1.55*side,0.02,-1.05],[2.20,0.045,1.50],R,[0,side*0.42,0]));
  parts.push(dP('box',[1.25*side,0.00,-1.95],[1.80,0.045,1.35],R,[0,side*0.72,0]));
  parts.push(dP('box',[0.85*side,-0.02,-2.60],[1.30,0.045,1.00],R,[0,side*1.00,0]));
  return parts;
}
function dragonTailParts(TN,i){
  const A=TN.armor,L=TN.trim,R=TN.cloth;
  const W=[0.60,0.44,0.30][i], LEN=[1.15,1.00,0.95][i];
  const parts=[
    dP('box',[0,0,-LEN/2+0.08],[W,W*0.82,LEN],A),
    dP('box',[0,-W*0.42,-LEN/2+0.08],[W*0.7,0.16,LEN*0.9],L),
    dP('cone',[0,W*0.55,-LEN*0.40],[W*0.42,0.34,W*0.42],R),
  ];
  if(i===2)parts.push(dP('cone',[0,0.05,-LEN-0.18],[0.34,0.55,0.12],R,[-1.35,0,0]));
  return parts;
}
function dragonLegParts(TN){
  const A=TN.armor,D=TN.dark,C=TN.skin;
  return [
    dP('box',[0,-0.32,0],[0.36,0.68,0.42],A),
    dP('sph',[0,-0.62,0.03],[0.34,0.30,0.34],D),
    dP('box',[0,-0.88,0],[0.29,0.50,0.33],A),
    dP('box',[0,-1.16,0.09],[0.40,0.15,0.60],D),
    dP('cone',[0.12,-1.18,0.42],[0.09,0.22,0.09],C,[1.25,0,0]),
    dP('cone',[-0.12,-1.18,0.42],[0.09,0.22,0.09],C,[1.25,0,0]),
    dP('cone',[0,-1.18,0.46],[0.09,0.22,0.09],C,[1.25,0,0]),
  ];
}
function dragonChestParts(TN){
  const WOOD=[0.42,0.29,0.15], WOOD2=[0.34,0.22,0.11], M=TN.metal;
  return [
    dP('box',[0,0.31,0],[1.25,0.62,0.78],WOOD),
    dP('box',[0,0.74,-0.10],[1.29,0.26,0.80],WOOD2,[-0.35,0,0]),
    dP('box',[0.38,0.34,0],[0.12,0.68,0.82],M),
    dP('box',[-0.38,0.34,0],[0.12,0.68,0.82],M),
    dP('box',[0,0.40,0.41],[0.20,0.24,0.06],M),
    dP('cone',[0.55,0.17,0.70],[0.50,0.35,0.50],M),
    dP('cyl',[0.95,0.05,0.55],[0.22,0.07,0.22],M),
    dP('cyl',[0.80,0.05,0.85],[0.22,0.07,0.22],M),
    dP('cyl',[-0.85,0.05,0.65],[0.22,0.07,0.22],M),
  ];
}
function makeDragonView(id,b){
  const TN=TINTS.dragon;
  const mat=CHARMAT({vertexColors:true});
  const root=new T.Group(); root.rotation.order='YXZ';
  root.scale.setScalar(FIGURE_SCALES.dragon||1);   // descriptor meshScale (x1.3 boss size buff)
  const torsoG=new T.Group(); root.add(torsoG);
  torsoG.add(new T.Mesh(dGeo(dragonBodyParts(TN)),mat));
  const neckG=new T.Group(); neckG.position.set(0,1.80,1.35); torsoG.add(neckG);
  neckG.add(new T.Mesh(dGeo(dragonNeckParts(TN)),mat));
  const headG=new T.Group(); headG.position.set(0,0.82,0.92); neckG.add(headG);
  headG.add(new T.Mesh(dGeo(dragonHeadParts(TN)),mat));
  const jawG=new T.Group(); jawG.position.set(0,-0.20,0.12); headG.add(jawG);
  jawG.add(new T.Mesh(dGeo(dragonJawParts(TN)),mat));
  const wingL=new T.Group(); wingL.position.set(-0.50,2.02,0.50); torsoG.add(wingL);
  wingL.add(new T.Mesh(dGeo(dragonWingParts(TN,-1)),mat));
  const wingR=new T.Group(); wingR.position.set(0.50,2.02,0.50); torsoG.add(wingR);
  wingR.add(new T.Mesh(dGeo(dragonWingParts(TN,1)),mat));
  const tailG=[]; let tailParent=torsoG;
  for(let i=0;i<3;i++){
    const g=new T.Group();
    g.position.set(0,i===0?1.50:0.02,i===0?-1.80:(i===1?-1.08:-0.93));
    g.add(new T.Mesh(dGeo(dragonTailParts(TN,i)),mat));
    tailParent.add(g); tailG.push(g); tailParent=g;
  }
  const legGeo=dGeo(dragonLegParts(TN));
  const legs=[];
  for(const [lx,lz] of [[-0.68,0.92],[0.68,0.92],[-0.66,-1.22],[0.66,-1.22]]){
    const g=new T.Group(); g.position.set(lx,1.34,lz);
    g.add(new T.Mesh(legGeo,mat)); root.add(g); legs.push(g);
  }
  scene.add(root);
  /* The drake's hoard: a treasure chest just OUTSIDE the arena edge,
     behind the spawn point. Pure decoration — no collider, and heroes
     can never reach it, so it can never block a fight. */
  const chest=new T.Group();
  chest.add(new T.Mesh(dGeo(dragonChestParts(TN)),mat));
  const cd=Math.sqrt(b.x*b.x+b.z*b.z)||1;
  chest.position.set(b.x/cd*(ARENA_R+1.5),0.35,b.z/cd*(ARENA_R+1.5));
  chest.rotation.y=Math.atan2(-b.x,-b.z);
  scene.add(chest);
  // HD: the whole drake (and its hoard) casts; the breath-flame kit
  // below is additive Basic and is created after this, so it never casts
  root.traverse(o=>{ if(o.isMesh)o.castShadow=GFX_HIGH; });
  chest.traverse(o=>{ if(o.isMesh)o.castShadow=GFX_HIGH; });
  /* Breath flame kit (pooled, scene-level): two additive cones + mouth
     glow + ground scorch. Driven per-frame from sim state; invisible
     unless the dragon is telegraphing or breathing. */
  const mkFlame=(rt,rb,col)=>{
    const g=new T.CylinderGeometry(rt,rb,9.5,12,1,true);
    g.rotateX(Math.PI/2); g.translate(0,0,4.75);
    const m=new T.Mesh(g,new T.MeshBasicMaterial({color:col,transparent:true,
      opacity:0,blending:T.AdditiveBlending,side:T.DoubleSide,depthWrite:false}));
    m.visible=false; m.frustumCulled=false; scene.add(m); return m;
  };
  const flameOuter=mkFlame(4.43,0.30,0xff5a14);
  const flameInner=mkFlame(2.30,0.16,0xffc46b);
  const glow=new T.Mesh(new T.SphereGeometry(0.30,10,8),
    new T.MeshBasicMaterial({color:0xff7a26,transparent:true,opacity:0.9,
      blending:T.AdditiveBlending,depthWrite:false}));
  glow.visible=false; glow.frustumCulled=false; scene.add(glow);
  const scorchGeo=new T.CircleGeometry(3.3,18); scorchGeo.rotateX(-Math.PI/2);
  const scorch=new T.Mesh(scorchGeo,new T.MeshBasicMaterial({color:0xff4400,
    transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}));
  scorch.visible=false; scorch.frustumCulled=false; scene.add(scorch);
  const D={ t:0, trot:0, legAmp:0, spread:0.15, neckX:0, jaw:0,
    torsoG, neckG, headG, jawG, wingL, wingR, tailG, legs, mat, chest,
    flame:{outer:flameOuter, inner:flameInner, glow, scorch} };
  const v={ kind:'dragon', id, mesh:root, dragon:D, baseScale:FIGURE_SCALES.dragon||1,
    anim:{cur:'dragon',prev:null,t:0,prevT:0,blend:1,weightSum:1},
    bones:JOINTS.map(()=>({rotation:{x:0,y:0,z:0}})),
    dispose(){
      scene.remove(chest);
      for(const m of [flameOuter,flameInner,glow,scorch]){ scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
      root.traverse(o=>{ if(o.geometry)o.geometry.dispose(); });
      chest.traverse(o=>{ if(o.geometry)o.geometry.dispose(); });
      mat.dispose();
    } };
  VIEWS.set(id,v);
  return v;
}

/* Procedural dragon animation — reads sim boss state only (position,
   yaw, velocity, state string, hitFlash), so lockstep guests see the
   same breath because they simulate the same state. */
function updateDragonView(v,b,dt){
  const D=v.dragon; D.t+=dt;
  const root=v.mesh;
  root.position.set(b.x,0,b.z); root.rotation.y=b.yaw;
  const sp=Math.sqrt(b.vx*b.vx+b.vz*b.vz);
  const moving=clamp(sp/6,0,1);
  D.trot+=dt*(2.5+sp*2.0);
  D.legAmp+=((moving>0.05?1:0)-D.legAmp)*Math.min(1,dt*7);
  const legOffs=[0,Math.PI,Math.PI,0];      // diagonal gait pairs
  for(let i=0;i<4;i++)
    D.legs[i].rotation.x=Math.sin(D.trot+legOffs[i])*0.50*D.legAmp;
  /* wings: idle folded sway; spread wide + flap hard for charge and the
     breath telegraph; steady beat while breathing */
  let spreadT=0.12,flapF=1.6,flapA=0.10;
  if(b.state==='charge'||b.state==='chargeTele'){ spreadT=0.62; flapF=10.0; flapA=0.30; }
  else if(b.state==='breathTele'){ spreadT=0.85; flapF=3.0; flapA=0.16; }
  else if(b.state==='breath'){ spreadT=0.55; flapF=6.0; flapA=0.22; }
  else if(moving>0.05){ spreadT=0.34; flapF=4.5; flapA=0.26; }
  D.spread+=(spreadT-D.spread)*Math.min(1,dt*5);
  const flap=Math.sin(D.t*flapF)*flapA;
  D.wingR.rotation.z= 0.18+D.spread+flap;
  D.wingL.rotation.z=-(0.18+D.spread+flap);
  /* neck / head / jaw: idle bob; rear up on the telegraph; level and
     open wide while the flame is out */
  let neckT=-0.05+Math.sin(D.t*1.8)*0.035, jawT=0.04+Math.sin(D.t*2.3)*0.02;
  if(b.state==='breathTele'){ neckT=-0.40; jawT=0.30; }
  else if(b.state==='breath'){ neckT=0.14; jawT=0.55; }
  else if(b.state==='charge'){ neckT=0.18; jawT=0.25; }
  D.neckX+=(neckT-D.neckX)*Math.min(1,dt*6);
  D.jaw+=(jawT-D.jaw)*Math.min(1,dt*8);
  D.neckG.rotation.x=D.neckX;
  D.headG.rotation.x=D.neckX*0.5+Math.sin(D.t*1.8+0.6)*0.03;
  D.jawG.rotation.x=D.jaw;
  /* tail sway with per-segment phase lag */
  for(let i=0;i<3;i++)
    D.tailG[i].rotation.y=Math.sin(D.t*2.3-i*0.75)*(0.13+0.10*moving);
  /* body breathing / trot bob + the shared hit flash */
  D.torsoG.position.y=Math.sin(D.t*2.1)*0.035+Math.abs(Math.sin(D.trot))*0.05*D.legAmp;
  const hf=b.hitFlash||0;
  D.mat.emissive.setRGB(0.50*hf,0.14*hf,0.05*hf);
  updateDragonFlame(D,b);
}
function updateDragonFlame(D,b){
  const F=D.flame;
  const BC=BOSS_CFG_BY_CHAPTER[SIM.chapter], BR=BC&&BC.breath;
  const breathing=b.state==='breath', tele=b.state==='breathTele';
  if(!BR||(!breathing&&!tele)){
    F.outer.visible=F.inner.visible=F.glow.visible=F.scorch.visible=false;
    return;
  }
  const yaw=b.lockYaw;
  const fx=Math.sin(yaw), fz=Math.cos(yaw);
  const hx=b.x+fx*BR.headDist, hz=b.z+fz*BR.headDist;   // the mouth (cfg headDist), world space
  const mouthY=3.19;   // old 2.45 x 1.3 boss size buff — the scaled head height
  F.glow.visible=true;
  F.glow.position.set(hx,mouthY,hz);
  F.glow.scale.setScalar(tele?0.9+0.35*Math.abs(Math.sin(D.t*7)):1.25);
  if(!breathing){ F.outer.visible=F.inner.visible=F.scorch.visible=false; return; }
  F.outer.visible=F.inner.visible=F.scorch.visible=true;
  F.outer.position.set(hx,mouthY,hz); F.outer.rotation.y=yaw;
  F.inner.position.set(hx,mouthY,hz); F.inner.rotation.y=yaw;
  const fl=0.85+0.30*Math.sin(D.t*43)+0.12*Math.sin(D.t*91);
  const flLen=BR.range/9.5;   // flame visual tracks the damage cone length (geometry built 9.5 long)
  F.outer.scale.set(fl,fl,flLen); F.inner.scale.set(fl*0.95,fl*0.95,flLen);
  F.outer.material.opacity=0.34; F.inner.material.opacity=0.50;
  F.scorch.position.set(b.x+fx*(BR.headDist+BR.range*0.5),0.06,b.z+fz*(BR.headDist+BR.range*0.5));
  F.scorch.material.opacity=0.26+0.06*Math.sin(D.t*37);
}

/* =====================================================================
   THE IRON LANCER — custom boss view (figure descriptor
   figures/knight-mount.js, `custom: 'knightMount'`). A horse and rider
   cannot ride the 13-joint humanoid rig, so the lancer is a hierarchy
   of merged-geometry groups — horse body, neck, head, tail, four legs,
   and a rider whose sword arm and plume are separate groups — animated
   procedurally below. VIEW ONLY: it reads sim boss state and writes
   nothing. All colours come from TINTS['knight-mount']; geometry is
   owned by this builder, exactly as the descriptor contract states.
   Local axes match the dragon: +Z is forward.
   ===================================================================== */
function knightHorseParts(TN){
  const H=TN.cloth,B=TN.trim,D=TN.dark;
  return [
    dP('box',[0,1.32,0],[0.66,0.66,1.75],H),               // barrel
    dP('sph',[0,1.30,0.82],[0.60,0.60,0.55],H),            // chest
    dP('sph',[0,1.34,-0.82],[0.62,0.62,0.58],H),           // rump
    dP('box',[0,1.50,-0.05],[0.78,0.44,0.58],B),           // blue saddle cloth
    dP('box',[0,1.70,-0.05],[0.56,0.10,0.62],D),           // saddle
    dP('box',[0,1.28,0.16],[0.70,0.55,0.10],D),            // girth strap
    dP('box',[0,1.34,0.80],[0.56,0.30,0.10],D,[0.30,0,0]), // breastcollar
  ];
}
function knightNeckParts(TN){
  const H=TN.cloth,M=TN.skin;
  return [
    dP('box',[0,0,0.30],[0.36,0.55,0.82],H),
    dP('box',[0,0.30,0.02],[0.10,0.24,0.55],M),            // mane, upper neck
    dP('box',[0,0.33,0.42],[0.10,0.20,0.32],M),            // mane, lower neck
  ];
}
function knightHeadParts(TN){
  const H=TN.cloth,M=TN.skin,D=TN.dark,S=TN.armor;
  return [
    dP('box',[0,0.02,0.05],[0.30,0.34,0.38],H),            // skull
    dP('box',[0,-0.06,0.34],[0.22,0.24,0.38],H),           // muzzle
    dP('box',[0,-0.01,0.40],[0.26,0.08,0.10],D),           // noseband
    dP('box',[0,0.13,0.14],[0.33,0.06,0.32],S,[0.25,0,0]), // silver chanfron plate
    dP('cone',[0.09,0.30,-0.06],[0.09,0.24,0.09],H),       // ears
    dP('cone',[-0.09,0.30,-0.06],[0.09,0.24,0.09],H),
    dP('box',[0,0.26,0.12],[0.17,0.10,0.24],M),            // forelock
    dP('sph',[0.135,0.06,0.18],[0.05,0.05,0.05],D),        // eyes
    dP('sph',[-0.135,0.06,0.18],[0.05,0.05,0.05],D),
  ];
}
function knightTailParts(TN){
  const M=TN.skin;
  return [
    dP('box',[0,-0.16,-0.12],[0.16,0.44,0.14],M,[0.35,0,0]),
    dP('box',[0,-0.50,-0.22],[0.13,0.46,0.11],M,[0.22,0,0]),
  ];
}
function knightLegParts(TN){
  const H=TN.cloth,G=TN.glow,D=TN.dark;
  return [
    dP('box',[0,-0.28,0],[0.17,0.58,0.20],H),              // upper leg (brown)
    dP('sph',[0,-0.56,0],[0.15,0.15,0.15],H),              // knee / hock
    dP('box',[0,-0.85,0],[0.13,0.44,0.15],G),              // white lower leg
    dP('box',[0,-1.11,0.02],[0.16,0.12,0.20],D),           // hoof
  ];
}
function knightRiderParts(TN){
  const S=TN.armor,B=TN.trim,D=TN.dark,MT=TN.metal,G=TN.glow;
  return [
    dP('box',[0,0.06,0],[0.40,0.16,0.34],MT),              // hips / mail skirt
    dP('box',[0.30,-0.28,0.10],[0.15,0.62,0.17],S,[0.15,0,0.10]),   // legs in stirrups
    dP('box',[-0.30,-0.28,0.10],[0.15,0.62,0.17],S,[0.15,0,-0.10]),
    dP('box',[0.34,-0.62,0.24],[0.14,0.12,0.30],MT),       // sabatons (pointed boots)
    dP('box',[-0.34,-0.62,0.24],[0.14,0.12,0.30],MT),
    dP('box',[0,0.42,0],[0.46,0.55,0.30],B),               // blue tabard torso
    dP('box',[0,0.46,0.165],[0.15,0.21,0.03],G,[0,0,Math.PI/4]),  // griffin: diamond body
    dP('box',[0.135,0.53,0.165],[0.14,0.05,0.03],G,[0,0,0.50]),   // griffin: wings
    dP('box',[-0.135,0.53,0.165],[0.14,0.05,0.03],G,[0,0,-0.50]),
    dP('sph',[0,0.615,0.165],[0.05,0.05,0.03],G),          // griffin: head
    dP('box',[0,0.15,0],[0.48,0.08,0.32],D),               // belt
    dP('sph',[0.30,0.63,0],[0.20,0.18,0.20],S),            // pauldrons
    dP('sph',[-0.30,0.63,0],[0.20,0.18,0.20],S),
    dP('box',[-0.34,0.32,0.12],[0.13,0.42,0.13],S,[0.50,0,0.15]),  // left arm to the reins
    dP('sph',[-0.37,0.13,0.30],[0.11,0.11,0.11],MT),       // left gauntlet
    dP('box',[0,0.03,0.58],[0.04,0.03,0.82],D,[0.30,0,0]), // rein strap toward the bit
    dP('cyl',[0,0.88,0],[0.31,0.34,0.31],S),               // great helm
    dP('box',[0,0.73,0],[0.37,0.05,0.37],MT),              // helm brim
    dP('box',[0,0.86,0.145],[0.20,0.045,0.03],D),          // visor slit
    dP('box',[0,0.79,0.155],[0.05,0.17,0.03],S),           // nose guard
    dP('box',[0,1.07,0],[0.08,0.06,0.30],MT),              // crown ridge (plume socket)
  ];
}
function knightPlumeParts(TN){
  const B=TN.trim;
  return [
    dP('box',[0,0.10,-0.05],[0.09,0.26,0.15],B,[-0.25,0,0]),
    dP('box',[0,0.25,-0.14],[0.08,0.24,0.13],B,[-0.55,0,0]),
    dP('cone',[0,0.38,-0.26],[0.09,0.26,0.09],B,[-1.10,0,0]),
  ];
}
function knightArmParts(TN){
  const S=TN.armor,MT=TN.metal,W=TN.blade;
  return [
    dP('box',[0,-0.16,0],[0.13,0.36,0.13],S),              // upper arm
    dP('sph',[0,-0.35,0],[0.11,0.11,0.11],MT),             // elbow cop
    dP('box',[0,-0.51,0.02],[0.11,0.30,0.11],S),           // forearm
    dP('sph',[0,-0.68,0.03],[0.10,0.10,0.10],MT),          // gauntlet
    dP('box',[0,-0.73,0.03],[0.32,0.045,0.06],MT),         // crossguard
    dP('box',[0,-1.32,0.03],[0.055,1.12,0.016],W),         // long sword blade
    dP('cone',[0,-1.95,0.03],[0.055,0.15,0.016],W,[Math.PI,0,0]), // tip
  ];
}
function makeKnightMountView(id,b){
  const TN=TINTS['knight-mount'];
  const mat=CHARMAT({vertexColors:true});
  const root=new T.Group(); root.rotation.order='YXZ';
  root.scale.setScalar(FIGURE_SCALES['knight-mount']||1);   // descriptor meshScale (x1.5 boss size, AB-NET-19)
  const bodyG=new T.Group(); root.add(bodyG);
  bodyG.add(new T.Mesh(dGeo(knightHorseParts(TN)),mat));
  const neckG=new T.Group(); neckG.position.set(0,1.52,0.78); bodyG.add(neckG);
  neckG.add(new T.Mesh(dGeo(knightNeckParts(TN)),mat));
  const headG=new T.Group(); headG.position.set(0,0.14,0.70); neckG.add(headG);
  headG.add(new T.Mesh(dGeo(knightHeadParts(TN)),mat));
  const tailG=new T.Group(); tailG.position.set(0,1.50,-0.92); bodyG.add(tailG);
  tailG.add(new T.Mesh(dGeo(knightTailParts(TN)),mat));
  const riderG=new T.Group(); riderG.position.set(0,1.66,-0.02); bodyG.add(riderG);
  riderG.add(new T.Mesh(dGeo(knightRiderParts(TN)),mat));
  const plumeG=new T.Group(); plumeG.position.set(0,1.08,-0.02); riderG.add(plumeG);
  plumeG.add(new T.Mesh(dGeo(knightPlumeParts(TN)),mat));
  const armG=new T.Group(); armG.position.set(0.34,0.60,0.02); riderG.add(armG);
  armG.add(new T.Mesh(dGeo(knightArmParts(TN)),mat));
  const legGeo=dGeo(knightLegParts(TN));
  const legs=[];
  for(const [lx,lz] of [[-0.27,0.60],[0.27,0.60],[-0.27,-0.60],[0.27,-0.60]]){
    const g=new T.Group(); g.position.set(lx,1.18,lz);
    g.add(new T.Mesh(legGeo,mat)); root.add(g); legs.push(g);
  }
  scene.add(root);
  root.traverse(o=>{ if(o.isMesh)o.castShadow=GFX_HIGH; });
  const D={ t:0, phase:0, amp:0, armX:-0.55, lean:0, neckX:-0.55,
    bodyG, neckG, headG, tailG, riderG, plumeG, armG, legs, mat };
  const v={ kind:'knight-mount', id, mesh:root, knight:D, baseScale:FIGURE_SCALES['knight-mount']||1,
    anim:{cur:'knightMount',prev:null,t:0,prevT:0,blend:1,weightSum:1},
    bones:JOINTS.map(()=>({rotation:{x:0,y:0,z:0}})),
    dispose(){
      root.traverse(o=>{ if(o.geometry)o.geometry.dispose(); });
      mat.dispose();
    } };
  VIEWS.set(id,v);
  return v;
}

/* Procedural knight-mount animation — reads sim boss state only
   (position, yaw, velocity, state string, hitFlash), so lockstep
   guests see the same gallop because they simulate the same state. */
function updateKnightMountView(v,b,dt){
  const D=v.knight; D.t+=dt;
  const root=v.mesh;
  root.position.set(b.x,0,b.z); root.rotation.y=b.yaw;
  const sp=Math.sqrt(b.vx*b.vx+b.vz*b.vz);
  const moving=clamp(sp/7,0,1);
  D.phase+=dt*(5+sp*1.05);
  D.amp+=((moving>0.05?1:0)-D.amp)*Math.min(1,dt*6);
  /* gallop: diagonal pairs (FL+HR, FR+HL) with a gathered offset */
  const legOffs=[0,Math.PI,Math.PI,0.4];
  for(let i=0;i<4;i++)
    D.legs[i].rotation.x=Math.sin(D.phase+legOffs[i])*0.55*D.amp;
  if(D.amp<0.25){
    /* idle pawing: the near foreleg scrapes the ground in slow pulses */
    const p=Math.max(0,Math.sin(D.t*0.8)); 
    D.legs[1].rotation.x=-(p*p*p)*0.45;
  }
  /* body: suspension bob + pitch over the stride, idle breathing */
  D.bodyG.position.y=Math.abs(Math.sin(D.phase))*0.075*D.amp+Math.sin(D.t*1.7)*0.015;
  D.bodyG.rotation.x=Math.sin(D.phase+0.6)*0.05*D.amp;
  /* neck/head: nod against the stride; head up on the charge
     telegraph, stretched low in the charge */
  let neckT=-0.55+Math.sin(D.phase+1.1)*0.07*D.amp;
  if(b.state==='chargeTele')neckT=-0.38;
  else if(b.state==='charge')neckT=-0.68;
  D.neckX+=(neckT-D.neckX)*Math.min(1,dt*6);
  D.neckG.rotation.x=D.neckX;
  D.headG.rotation.x=-D.neckX*0.55+Math.sin(D.t*1.9+0.5)*0.03;
  /* tail flows behind the stride; plume streams with speed */
  D.tailG.rotation.x=0.10+Math.sin(D.phase-0.7)*0.14*D.amp;
  D.tailG.rotation.y=Math.sin(D.t*1.9)*0.10;
  D.plumeG.rotation.x=-clamp(sp/19,0,1)*0.55+Math.sin(D.phase)*0.08*D.amp+Math.sin(D.t*3.1)*0.04;
  /* rider lean: sits back as the horse gathers, drives forward in the
     charge and through the sword sweep */
  let leanT=-0.04-clamp(sp/19,0,1)*0.10;
  if(b.state==='chargeTele')leanT=0.10;
  else if(b.state==='charge')leanT=-0.30;
  else if(b.state==='slamTele')leanT=-0.10;
  else if(b.state==='slam')leanT=-0.32;
  D.lean+=(leanT-D.lean)*Math.min(1,dt*7);
  D.riderG.rotation.x=D.lean;
  /* sword arm: couched in the charge, raised high on both telegraphs,
     chopped down through the slam */
  let armT=-0.55+Math.sin(D.t*2.2)*0.03, armRate=6;
  if(b.state==='chargeTele')armT=-2.55;
  else if(b.state==='charge')armT=-1.30;
  else if(b.state==='slamTele')armT=-2.20;
  else if(b.state==='slam'){ armT=0.55; armRate=16; }
  else if(b.state==='recover')armT=-0.90;
  D.armX+=(armT-D.armX)*Math.min(1,dt*armRate);
  D.armG.rotation.x=D.armX;
  /* shared hit flash */
  const hf=b.hitFlash||0;
  D.mat.emissive.setRGB(0.45*hf,0.42*hf,0.40*hf);
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
    CHARMAT({vertexColors:true,emissive:0x2a0508}),32);
  projMesh=new T.InstancedMesh(new T.SphereGeometry(0.34,8,6),
    new T.MeshBasicMaterial({color:0xc46bff}),24);
  shadowMesh=new T.InstancedMesh(new T.CircleGeometry(1,14),
    new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28,depthWrite:false}),CFG.maxEntities);
  potionMesh=new T.InstancedMesh(brickGeo('magic'),
    CHARMAT({vertexColors:true,emissive:0x120a2e}),16);
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
  // blob shadows: hero + enemies + boss, one draw call. SD only — in HD
  // the real shadow map grounds the characters, and a blob under a cast
  // shadow would double-darken (and hide the cast shadow in captures).
  n=0;
  const put=(x,z,r)=>{ if(n>=CFG.maxEntities)return;
    dummy.position.set(x,0.025,z);dummy.rotation.set(-Math.PI/2,0,0);
    dummy.scale.set(r, r, 1);dummy.updateMatrix();shadowMesh.setMatrixAt(n++,dummy.matrix); };
  if(!GFX_HIGH){
    for(const h of s.heroes)put(h.x,h.z,0.55);
    for(const e of s.enemies)put(e.x,e.z,0.5);
    for(const bn of s.banners)if(bn.hp>0)put(bn.x,bn.z,0.5);
    for(const b of s.bosses)if(b.hp>0){ const bf=b.fig||(BOSSES[s.chapter]||{}).figure;
      put(b.x,b.z,(FIGURES[bf]&&FIGURES[bf].custom)?3.055:1.625); }  // blob shadow x1.3 with the boss size buff
  }
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
  setupSlashFX(); setupArrowFX();
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
   hit test never reads this geometry.
   The palette is a parameter: the default call reproduces the original
   luminous blue-white EXACTLY; a hero with a descriptor `slashTint`
   (HERO_SLASH_TINTS — the dwarf's pale red) gets the same geometry with
   its core/rim colours baked in, rim rows dimmed to 36% like the
   default's. Geometry, timing and brightness envelope never change. */
function crescentGeo(core,rim){
  const C=core||[0.92,0.97,1.0];
  const R=rim?rim.map(v=>v*0.36):[0.30,0.42,0.66];
  const SEG=26, SPAN=96*DEG, RC=2.02, HW=0.055;
  const pos=[], col=[], idx=[];
  for(let i=0;i<=SEG;i++){
    const u=i/SEG, a=(u-0.5)*SPAN, w=Math.pow(Math.sin(Math.PI*u),0.6);
    const sa=Math.sin(a), ca=Math.cos(a);
    const rI=RC-HW*w, rM=RC, rO=RC+HW*w;
    pos.push(sa*rI,0,ca*rI, sa*rM,0,ca*rM, sa*rO,0,ca*rO);
    col.push(R[0],R[1],R[2], C[0],C[1],C[2], R[0],R[1],R[2]);
  }
  for(let i=0;i<SEG;i++){ const b=i*3;
    idx.push(b,b+3,b+1, b+1,b+3,b+4, b+1,b+4,b+2, b+2,b+4,b+5); }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(col,3));
  geo.setIndex(idx);
  return geo;
}
let slashMeshes=null, trailMesh=null, trailPos=null, trailCol=null;
let slashDummy=null;
const slashSlots=[];
/* Which crescent mesh a hero's swings draw into: 'default' for the
   luminous original, or the hero's own id when its descriptor carries
   a slashTint (the dwarf's pale-red hammer arc). */
function slashKeyFor(heroId){ return HERO_SLASH_TINTS[heroId]?heroId:'default'; }
const swingSeen=[{id:-1},{id:-1},{id:-1},{id:-1}];   // per-hero attackId tracking (slash FX), up to 4 heroes
const TRAIL_N=30;
let trailPts=[], trailFade=0;
/* One weapon-tip anchor per playable skin, derived from the hero registry.
   Adding a skin file automatically adds its tip here; the lookup below
   still falls back to the default hero tip for an unknown kind. */
const SLASH_TIP = HERO_SLASH_TIPS;
const _tipV=new T.Vector3(), _baseV=new T.Vector3(), _dirV=new T.Vector3(), _innV=new T.Vector3();
function setupSlashFX(){
  slashDummy=new T.Object3D(); slashDummy.rotation.order='YXZ';
  /* One InstancedMesh per crescent palette: the default luminous one,
     plus one per hero slashTint in the registry (today: the dwarf). */
  slashMeshes=[];
  const mkMesh=(key,geo)=>{
    const m=new T.InstancedMesh(geo,
      new T.MeshBasicMaterial({vertexColors:true,transparent:true,
        blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}),6);
    m.frustumCulled=false; m.visible=false;
    slashDummy.position.set(0,-50,0); slashDummy.scale.setScalar(0.001);
    slashDummy.rotation.set(0,0,0); slashDummy.updateMatrix();
    for(let i=0;i<6;i++){ m.setMatrixAt(i,slashDummy.matrix); m.setColorAt(i,_splatCol.setRGB(0,0,0)); }
    m.instanceMatrix.needsUpdate=true;
    scene.add(m);
    slashMeshes.push({key,mesh:m});
  };
  mkMesh('default',crescentGeo());
  for(const hid of Object.keys(HERO_SLASH_TINTS)){
    const t=HERO_SLASH_TINTS[hid];
    mkMesh(hid,crescentGeo(t.core,t.rim));
  }
  for(let i=0;i<6;i++)slashSlots.push({on:false,id:-1,yaw:0,dir:1,age:9,hi:0,mk:'default'});
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
  if(!slashMeshes)return;
  /* crescents: tracked per hero into the shared slot pool. A RANGED
     hero (HERO_ATTACK) never activates a slot — she has no blade arc —
     and never starts a weapon trail. */
  for(let hi=0;hi<s.heroes.length;hi++){
    const h=s.heroes[hi], seenS=swingSeen[hi];
    if(h.attackId<seenS.id)seenS.id=h.attackId;      // resync after reset
    if(h.state==='attack'&&h.attackId!==seenS.id){
      seenS.id=h.attackId;
      if((HERO_ATTACK[h.heroId]||{}).kind==='arrow')continue;
      const sl=slashSlots.find(x=>!x.on)||slashSlots[0];
      sl.on=true; sl.id=h.attackId; sl.hi=hi; sl.yaw=h.yaw; sl.mk=slashKeyFor(h.heroId);
      sl.dir=(h.attackId%2===0)?1:-1; sl.age=h.st;   // alternate fore/backhand
      if(hi===LOCAL_IDX){ trailPts.length=0; trailFade=1; }
    }
  }
  /* slot lifetimes + transforms (palette-independent) */
  for(let i=0;i<6;i++){
    const sl=slashSlots[i];
    const h=sl.on?s.heroes[sl.hi]:null;
    if(sl.on){
      if(h&&sl.id===h.attackId&&h.state==='attack')sl.age=h.st;
      else sl.age+=dt*3.2;                           // swing ended: run clock out
      if(sl.age>0.52)sl.on=false;
    }
    if(!sl.on||!h){
      sl.b=0; sl.px=0; sl.py=-50; sl.pz=0; sl.rx=0; sl.ry=0; sl.rz=0; sl.sc=0.001;
    }else{
      const t=sl.age, q=clamp(t/0.30,0,1), qe=1-(1-q)*(1-q);
      const sweep=sl.dir*(0.92-1.84*qe);              // +53 deg -> -53 deg
      sl.b=0;
      if(t>0.03)sl.b=0.50*Math.min(1,(t-0.03)/0.10);  // peak covers hitAt 0.25 s
      if(t>0.27)sl.b=0.50*Math.max(0,1-(t-0.27)/0.20);
      sl.px=h.x; sl.py=1.06; sl.pz=h.z;
      if(sl.mk==='dwarf'){
        /* The dwarf's crescent rides his OVERHEAD hammer arc: the flat
           arc is pitched up into the vertical facing plane (rotation
           order YXZ — yaw to facing first, then pitch about the yawed
           X) and its centre sweeps from up-behind-the-head (-100 deg)
           to down-forward (+49 deg) across the same q envelope, so the
           pale-orange arc crests over him and lands with the hit step,
           exactly where the hammer head travels. Colour, brightness
           envelope and timing are the shared ones above. */
        sl.ry=sl.yaw; sl.rz=0; sl.rx=-1.75+2.60*qe;
      }else{
        sl.rx=0; sl.ry=sl.yaw+sweep; sl.rz=sl.dir*0.30;
      }
      sl.sc=0.92+0.14*qe;
    }
  }
  /* write each slot into ITS palette's mesh; hide it in all others */
  for(const e of slashMeshes){
    let any=false;
    for(let i=0;i<6;i++){
      const sl=slashSlots[i], live=sl.on&&sl.mk===e.key;
      if(live)any=true;
      slashDummy.position.set(live?sl.px:0,live?sl.py:-50,live?sl.pz:0);
      slashDummy.rotation.set(live?(sl.rx||0):0,live?sl.ry:0,live?sl.rz:0);
      slashDummy.scale.setScalar(live?sl.sc:0.001); slashDummy.scale.y=1;
      slashDummy.updateMatrix();
      e.mesh.setMatrixAt(i,slashDummy.matrix);
      e.mesh.setColorAt(i,_splatCol.setRGB(live?(sl.b||0):0,live?(sl.b||0):0,live?(sl.b||0):0));
    }
    e.mesh.instanceMatrix.needsUpdate=true;
    if(e.mesh.instanceColor)e.mesh.instanceColor.needsUpdate=true;
    e.mesh.visible=any;
  }
  /* --- blade trail: ribbon for the LOCAL hero's weapon only --- */
  const h=localHero(s), hv=VIEWS.get(LOCAL_IDX===0?0:-LOCAL_IDX);
  const swinging=h.state==='attack'&&h.st<=0.46&&hv&&(HERO_ATTACK[h.heroId]||{}).kind!=='arrow';
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

/* ---------- hero arrows (cosmetic only) ----------
   Pooled meshes for the sim's hero arrows (s.arrows): a PALE shaft,
   bright steel head and vivid frost-cyan crossed fletching (one merged
   vertex-coloured geometry), oriented along the velocity, plus a long
   additive tracer streak trailing behind each one. Sized for phone
   readability (Matt: the first version read too small/thin in flight).
   FINAL shipped scale, after capture checks at 844x390: shaft 0.13 m
   thick (the original was 0.045 — ~2.9x), head r 0.15, fletching
   0.42 m wide in vivid frost cyan, overall length ~1.19 m (1.28x),
   pale near-white shaft, and a 0.26 x 1.6 m additive frost-cyan
   tracer streak (0x7fe3ff, 0.60 opacity) trailing it — the cyan
   streak is what carries the read at 11 m and over pale sand, where
   the white shaft alone washes out. Pure presentation — the sim's
   segment hit test (body + 0.25) never reads these. */
const ARROW_POOL=12;
let arrowMeshes=[], arrowTrailMeshes=[];
function arrowGeo(){
  const head=new T.ConeGeometry(0.15,0.28,8); head.rotateX(Math.PI/2);
  return mergeParts([
    {geo:new T.BoxGeometry(0.13,0.13,0.95),x:0,y:0,z:0,c:[0.96,0.94,0.88]},
    {geo:head,x:0,y:0,z:0.575,c:[0.90,0.94,1.00]},
    {geo:new T.BoxGeometry(0.42,0.035,0.24),x:0,y:0,z:-0.36,c:[0.20,0.80,1.00]},
    {geo:new T.BoxGeometry(0.035,0.42,0.24),x:0,y:0,z:-0.36,c:[0.20,0.80,1.00]},
  ]);
}
function setupArrowFX(){
  const geo=arrowGeo();
  const tGeo=new T.PlaneGeometry(0.26,1.6); tGeo.rotateX(-Math.PI/2);
  for(let i=0;i<ARROW_POOL;i++){
    const m=new T.Mesh(geo,CHARMAT({vertexColors:true}));
    m.frustumCulled=false; m.visible=false; scene.add(m); arrowMeshes.push(m);
    const tr=new T.Mesh(tGeo,new T.MeshBasicMaterial({color:0x7fe3ff,transparent:true,
      opacity:0.60,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));
    tr.frustumCulled=false; tr.visible=false; scene.add(tr); arrowTrailMeshes.push(tr);
  }
}
function updateArrowFX(s){
  let n=0;
  for(const a of s.arrows){
    if(n>=ARROW_POOL)break;
    const yaw=Math.atan2(a.vx,a.vz);
    const m=arrowMeshes[n], tr=arrowTrailMeshes[n];
    m.visible=true; m.position.set(a.x,1.12,a.z); m.rotation.set(0,yaw,0);
    tr.visible=true;
    tr.position.set(a.x-Math.sin(yaw)*1.28,1.12,a.z-Math.cos(yaw)*1.28);
    tr.rotation.set(0,yaw,0);
    n++;
  }
  for(let i=n;i<ARROW_POOL;i++){ arrowMeshes[i].visible=false; arrowTrailMeshes[i].visible=false; }
}

/* ---------- magic lightning (cosmetic only) ----------
   Pooled jagged bolts that drop out of the sky onto every target a magic
   cast actually hit. Driven by the sim's 'bolt' events, which both co-op
   clients emit identically because they run the same deterministic sim —
   so a guest's cast strikes the same targets on the host's screen too.
   Each bolt is ONE mesh (crossed jagged ribbons, bright core + violet
   sheath, pre-generated geometry variants); the pool is invisible and
   costs no draw calls between casts. */
const BOLT_POOL=16, BOLT_LIFE=1.0;
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
    /* ~1 s of presence (Matt, 2026-11-14): strike in fast, hold at
       full strength, then fade across the last 40% — no hard cut. */
    const env=u<0.08?u/0.08:(u>0.6?Math.pow(Math.max(0,1-(u-0.6)/0.4),0.7):1);
    boltMeshes[i].material.opacity=0.92*env;
    boltMeshes[i].visible=sl.t<BOLT_LIFE;
  }
}

/* ---------- signature-magic FX (cosmetic only) ----------
   Expanding ground rings for Frost Nova / Earthquake casts (fired from
   the sim's 'magic' event, whose payload now carries the caster's
   signature kind) and pooled translucent ice shells that encase frozen
   figures for exactly as long as their sim frozen timer runs. The view
   only READS sim state here; it writes nothing back. */
const RING_POOL=4, RING_LIFE=1.0, RING_EXPAND=0.5;
let sigRingMeshes=[], sigRingState=[];
function setupRings(){
  for(let i=0;i<RING_POOL;i++){
    const m=new T.Mesh(new T.RingGeometry(0.90,1.0,56),
      new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,
        side:T.DoubleSide,depthWrite:false,fog:false}));
    m.rotation.x=-Math.PI/2; m.position.y=0.07; m.visible=false; m.frustumCulled=false;
    scene.add(m); sigRingMeshes.push(m); sigRingState.push({t:9,maxR:14});
  }
}
function fireRing(x,z,hex,maxR){
  let idx=sigRingState.findIndex(r=>r.t>=RING_LIFE);
  if(idx<0)idx=0;
  sigRingState[idx].t=0; sigRingState[idx].maxR=maxR;
  const m=sigRingMeshes[idx];
  m.material.color.setHex(hex);
  m.position.x=x; m.position.z=z; m.visible=true;
}
function updateRings(dt){
  for(let i=0;i<RING_POOL;i++){
    const st=sigRingState[i];
    if(st.t>=RING_LIFE){ sigRingMeshes[i].visible=false; continue; }
    st.t+=dt;
    const u=Math.min(1,st.t/RING_LIFE);
    /* Full expansion on the old 0.5 s schedule, then the ring HOLDS
       its radius and fades across the last 40% of a ~1 s life. */
    const ue=Math.min(1,st.t/RING_EXPAND), ease=1-(1-ue)*(1-ue);
    const r=Math.max(0.05,st.maxR*ease);
    sigRingMeshes[i].scale.set(r,r,r);
    sigRingMeshes[i].material.opacity=0.85*(u>0.6?Math.pow(Math.max(0,1-(u-0.6)/0.4),0.7):1);
    sigRingMeshes[i].visible=st.t<RING_LIFE;
  }
}
/* ---------- boss danger rings (cosmetic only; ported from the pack) --
   A filled translucent disc plus a bright rim, held at a FIXED radius
   and pulsing for the length of a boss wind-up. The expanding fireRing
   above is wrong for this: a telegraph has to show exactly where the
   damage will land, so the radius must not grow. Used by the Spiked
   Ogre's 360-degree spin and its super slam. Pool is 6 (not the pack's
   2): chapter 4 fields TWO ogres whose telegraphs can overlap, and an
   event captain's Marked Volley (AB-NET-20) draws from the same pool. */
const WARN_POOL=6, WARN_LIFE=1.1;
let warnMeshes=[], warnState=[];
function setupWarnRings(){
  for(let i=0;i<WARN_POOL;i++){
    const g=new T.Group();
    const disc=new T.Mesh(new T.CircleGeometry(1,48),
      new T.MeshBasicMaterial({color:0xff3b18,transparent:true,opacity:0.16,
        side:T.DoubleSide,depthWrite:false,fog:false}));
    disc.rotation.x=-Math.PI/2; disc.position.y=0.05;
    const rim=new T.Mesh(new T.RingGeometry(0.94,1.0,64),
      new T.MeshBasicMaterial({color:0xff6a26,transparent:true,opacity:0.85,
        side:T.DoubleSide,depthWrite:false,fog:false}));
    rim.rotation.x=-Math.PI/2; rim.position.y=0.07;
    g.add(disc); g.add(rim);
    g.visible=false; g.frustumCulled=false;
    scene.add(g); warnMeshes.push(g); warnState.push({t:9,r:1,life:WARN_LIFE});
  }
}
function fireWarn(x,z,r,life){
  let idx=warnState.findIndex(s=>s.t>=s.life);
  if(idx<0)idx=0;
  const st=warnState[idx];
  st.t=0; st.r=r; st.life=life||WARN_LIFE;
  const g=warnMeshes[idx];
  g.position.set(x,0,z); g.scale.set(r,r,1); g.visible=true;
}
function updateWarnRings(dt,time){
  for(let i=0;i<WARN_POOL;i++){
    const st=warnState[i], g=warnMeshes[i];
    if(st.t>=st.life){ g.visible=false; continue; }
    st.t+=dt;
    const u=Math.min(1,st.t/st.life);
    const pulse=0.55+0.45*Math.sin(time*22);
    g.children[0].material.opacity=0.10+0.14*pulse;
    g.children[1].material.opacity=(0.55+0.45*pulse)*(1-u*0.55);
    g.visible=st.t<st.life;
  }
}
/* Dust kicked out of the ground: particles seeded ON a circle and
   pushed outward, rather than from a single point like burst(). */
function dustRing(x,z,r,color,n,power){
  for(let i=0;i<n;i++){
    const k=pHead++%PMAX;
    const a=(i/n)*TAU+CRNG()*0.3, rr=r*(0.30+CRNG()*0.70);
    pPos[k*3]=x+Math.cos(a)*rr; pPos[k*3+1]=0.12+CRNG()*0.35; pPos[k*3+2]=z+Math.sin(a)*rr;
    const sp=power*(0.45+CRNG()*0.85);
    pVel[k*3]=Math.cos(a)*sp; pVel[k*3+1]=0.7+CRNG()*2.0; pVel[k*3+2]=Math.sin(a)*sp;
    pCol[k*3]=color[0];pCol[k*3+1]=color[1];pCol[k*3+2]=color[2];
    pLife[k]=0.60+CRNG()*0.60;
  }
}
/* ---------- dwarf earthquake FX (cosmetic only) ----------
   The Earth Dwarf's cast is a GROUND SLAM, not a sparkle: the 'magic'
   event (sig 'earth') starts the one-shot groundslam clip on the
   caster's view (syncViews reads v.slamT) and queues the impact here.
   SLAM_IMPACT_T later — the frame the hammer head lands — a dusty
   shockwave ring expands toward the blast radius over QUAKE_EXPAND
   with a dust disc under it, then holds and fades out across the
   rest of QUAKE_LIFE (~1 s total), with dust bursts at the impact
   point in front of him. Pure view state: the sim's blast, knockback and shake are
   untouched, and every other hero's cast keeps the generic treatment
   in consumeEvents. */
const QUAKE_POOL=3, QUAKE_LIFE=1.0, QUAKE_EXPAND=0.45, SLAM_IMPACT_T=0.34, QUAKE_SHAKE=0.5;
let quakeMeshes=[], quakeState=[], quakePending=[];
function setupQuakes(){
  for(let i=0;i<QUAKE_POOL;i++){
    const ring=new T.Mesh(new T.RingGeometry(0.90,1.0,64),
      new T.MeshBasicMaterial({color:0xc2611a,transparent:true,opacity:0,
        side:T.DoubleSide,depthWrite:false,fog:false}));
    ring.rotation.x=-Math.PI/2; ring.position.y=0.07; ring.visible=false; ring.frustumCulled=false;
    const disc=new T.Mesh(new T.CircleGeometry(1,48),
      new T.MeshBasicMaterial({color:0x8f6a38,transparent:true,opacity:0,
        side:T.DoubleSide,depthWrite:false,fog:false}));
    disc.rotation.x=-Math.PI/2; disc.position.y=0.05; disc.visible=false; disc.frustumCulled=false;
    scene.add(ring); scene.add(disc);
    quakeMeshes.push({ring,disc}); quakeState.push({t:9,maxR:14});
  }
}
function fireQuake(x,z,maxR){
  let idx=quakeState.findIndex(q=>q.t>=QUAKE_LIFE);
  if(idx<0)idx=0;
  quakeState[idx].t=0; quakeState[idx].maxR=maxR;
  const m=quakeMeshes[idx];
  m.ring.position.x=x; m.ring.position.z=z; m.ring.visible=true;
  m.disc.position.x=x; m.disc.position.z=z; m.disc.visible=true;
}
function dwarfEarthCast(e){
  /* The caster is the hero whose signature is 'earth' (only the Earth
     Dwarf has one). In co-op, match the nearest such hero to the event
     position — the event carries the caster's cast-time position. */
  let best=-1,bd=Infinity,yaw=0;
  for(let hi=0;hi<SIM.heroes.length;hi++){
    const h=SIM.heroes[hi];
    if(((HERO_MAGIC[h.heroId]||{}).kind)!=='earth')continue;
    const d=(h.x-e.x)*(h.x-e.x)+(h.z-e.z)*(h.z-e.z);
    if(d<bd){bd=d;best=hi;yaw=h.yaw;}
  }
  if(best>=0){
    const v=VIEWS.get(best===0?0:-best);
    if(v)v.slamT=0;
  }
  quakePending.push({x:e.x,z:e.z,
    ix:e.x+Math.sin(yaw)*0.9, iz:e.z+Math.cos(yaw)*0.9,
    r:e.r||CFG.magic.radius, t:-SLAM_IMPACT_T});
}
function updateQuakes(dt){
  for(let i=quakePending.length-1;i>=0;i--){
    const q=quakePending[i]; q.t+=dt;
    if(q.t<0)continue;
    quakePending.splice(i,1);
    fireQuake(q.x,q.z,q.r);
    burst(q.ix,0.5,q.iz,[.66,.47,.26],40,8.5);
    burst(q.ix,0.25,q.iz,[.48,.34,.19],26,6.0);
    FXSHAKE(QUAKE_SHAKE);
  }
  for(let i=0;i<QUAKE_POOL;i++){
    const st=quakeState[i], m=quakeMeshes[i];
    if(st.t>=QUAKE_LIFE){ m.ring.visible=false; m.disc.visible=false; continue; }
    st.t+=dt;
    const u=Math.min(1,st.t/QUAKE_LIFE);
    /* Expansion keeps the old 0.45 s punch; ring and disc then hold
       and fade across the last 40% of a ~1 s life (Matt, 2026-11-14). */
    const ue=Math.min(1,st.t/QUAKE_EXPAND), ease=1-(1-ue)*(1-ue)*(1-ue);
    const fade=u>0.6?Math.pow(Math.max(0,1-(u-0.6)/0.4),0.7):1;
    const r=Math.max(0.05,st.maxR*ease);
    m.ring.scale.set(r,r,r);
    m.ring.material.opacity=0.95*fade;
    const dr=Math.max(0.05,st.maxR*0.5*ease);
    m.disc.scale.set(dr,dr,dr);
    m.disc.material.opacity=0.38*fade;
    m.ring.visible=st.t<QUAKE_LIFE; m.disc.visible=st.t<QUAKE_LIFE;
  }
}
const ICE_POOL=18;
let iceShells=[];
function setupIce(){
  const mat=new T.MeshLambertMaterial({color:0xbfe4ff,transparent:true,opacity:0.40,
    emissive:0x2c5d7d,depthWrite:false});
  const matTip=new T.MeshLambertMaterial({color:0xe4f6ff,transparent:true,opacity:0.55,
    emissive:0x3d7396,depthWrite:false});
  for(let i=0;i<ICE_POOL;i++){
    const g=new T.Group();
    const box=new T.Mesh(new T.BoxGeometry(1.5,2.1,1.5),mat); box.position.y=1.05; g.add(box);
    for(let k=0;k<3;k++){
      const cone=new T.Mesh(new T.ConeGeometry(0.30,0.85,5),matTip);
      cone.position.set((k-1)*0.42,2.45,((k%2)?0.30:-0.28)); cone.rotation.z=(k-1)*0.22;
      g.add(cone);
    }
    g.visible=false; scene.add(g); iceShells.push(g);
  }
}
function syncIceShells(s){
  let n=0;
  const use=(x,z,yaw,rad,tall)=>{
    if(n>=ICE_POOL)return;
    const g=iceShells[n++];
    g.position.set(x,0,z); g.rotation.y=yaw;
    g.scale.set(rad*1.85,tall,rad*1.85);
    g.visible=true;
  };
  for(const e of s.enemies)if((e.frozen||0)>0)use(e.x,e.z,e.yaw,CFG.enemy[e.type].radius,1);
  for(const b of s.bosses)if((b.frozen||0)>0)use(b.x,b.z,b.yaw,bossCfgOf(s).radius,1.885);  // tall x1.3 with the boss size buff (width follows radius)
  for(let i=n;i<ICE_POOL;i++)iceShells[i].visible=false;
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
        /* M3 run tracking: elite kills (the registry ELITE_KINDS —
           sorcerer/knight, the scheduled-elite kinds) feed the Aether
           Shard formula. View-layer counting only; the sim's own
           counters and hash never see this. */
        if(RUN&&ELITE_KINDS.indexOf(e.unit)>=0)RUN.eliteKills++;
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
      /* --- Spiked Ogre: fixed danger rings, dust, 360-degree sweep --- */
      case 'bossWindup': fireWarn(e.x,e.z,e.r,e.kind==='super'?1.05:0.85);
        Audio.whoosh(0.9);break;
      /* --- Archery elites (AB-NET-20): the captain's fixed volley ring
         reuses the boss danger-ring pool verbatim; banner events are
         dust + a soft chime of particles at plant, a burst on fall. --- */
      case 'eliteWindup': fireWarn(e.x,e.z,e.r,0.9); Audio.whoosh(0.9);break;
      case 'bannerPlant': dustRing(e.x,e.z,1.1,[0.85,0.66,0.20],12,2.6); Audio.whoosh(0.8);break;
      case 'bannerDown': burst(e.x,0.9,e.z,[0.85,0.25,0.2],18,4.2); Audio.kill();break;
      case 'bannerEnd': burst(e.x,0.7,e.z,[0.6,0.55,0.45],8,2.2);break;
      case 'bannerHeal': break;   // the zone ring on the banner view carries the read
      case 'bossSuperSlam': {
        fireRing(e.x,e.z,0xff8a2a,e.r*1.15);
        fireWarn(e.x,e.z,e.r,0.28);
        burst(e.x,0.45,e.z,[1,.55,.22],30,6.5);
        Audio.whoosh(1.4);break; }
      case 'bossDust': {
        /* two-tone dust: pale grit rising, dark soil thrown outward */
        dustRing(e.x,e.z,e.r,[0.62,0.55,0.44],34,4.2);
        dustRing(e.x,e.z,e.r*0.75,[0.40,0.33,0.25],20,6.0);
        break; }
      case 'bossSpinStart': fireWarn(e.x,e.z,e.r,0.85);Audio.whoosh(1.1);break;
      case 'bossSpinHit': {
        fireRing(e.x,e.z,0xffb060,e.r);
        dustRing(e.x,e.z,e.r*0.92,[0.58,0.52,0.42],22,5.2);
        break; }
      case 'bossDeath': burst(e.x,2.2,e.z,[1,.6,.2],34,6.5);Audio.kill();break;
      case 'death': Audio.death();break;
      case 'levelup': Audio.level();break;
      case 'upgrade': break;
      case 'chapter': Audio.level();break;
      case 'victory': Audio.level();break;
      case 'event': showBanner('\u26A0 ELITE INCOMING \u26A0',2600); Audio.boss(); break;
      case 'enrage': showBanner('\u2620 '+BOSS_NAMES[SIM.chapter-1]+' RAGES \u2620',2600); Audio.boss(); break;
      case 'fury': showBanner('\u2620 '+BOSS_NAMES[SIM.chapter-1]+' IS FURIOUS \u2620',2600);
        { const fl=$('flash'); fl.style.transition='none'; fl.style.background='#ff2a1a'; fl.style.opacity='0.45';
          requestAnimationFrame(()=>{ fl.style.transition='opacity .5s'; fl.style.opacity='0'; });
          setTimeout(()=>{ fl.style.background=''; },700); }
        Audio.boss(); break;
      case 'bossTelegraph': if(e.kind==='BREATH')Audio.whoosh(0.8); break;
      case 'breathStart': Audio.boss(); break;
      case 'summon': burst(e.x,1.6,e.z,[1,.5,.2],18,4.0); break;
      case 'potion': damageNumber(e.x,1.5,e.z,'+MAGIC',false); burst(e.x,1,e.z,[.77,.42,1],10,2.2); Audio.gem(); break;
      case 'bolt': fireBolt(e.x,e.z,e.boss); burst(e.x,1.15,e.z,[.72,.62,1],10,2.8); break;
      case 'magic': {
        if(e.sig==='frost'){ burst(e.x,1.2,e.z,[.72,.90,1],46,7.0); burst(e.x,0.5,e.z,[.85,.96,1],30,9.0);
          fireRing(e.x,e.z,0x9fd9ff,e.r||14); }
        else if(e.sig==='earth'){ dwarfEarthCast(e); }  /* ground slam + deferred quake (updateQuakes) */
        else if(e.sig==='fire'){ burst(e.x,1.1,e.z,[1,.52,.16],52,8.0); burst(e.x,0.5,e.z,[1,.78,.32],34,10.5);
          dustRing(e.x,e.z,(e.r||14)*0.55,[.55,.35,.20],20,6.0);
          fireRing(e.x,e.z,0xff7a24,e.r||14); }
        else { burst(e.x,1.2,e.z,[.77,.42,1],46,7.0); burst(e.x,0.5,e.z,[.9,.7,1],30,9.0); }
        const fl=$('flash'); fl.style.transition='none'; fl.style.opacity='0.5';
        requestAnimationFrame(()=>{ fl.style.transition='opacity .95s'; fl.style.opacity='0'; });
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
setupPickupMeshes(); setupVFX(); setupRings(); setupWarnRings(); setupIce(); setupQuakes(); buildMapMeshes(SIM);

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

/* ---------- graphics quality toggle (HD/SD, see the renderer block) -- */
function syncGfxButton(){ const b=$('btnGfx'); if(!b)return;
  b.textContent=GFX_HIGH?'HD':'SD'; b.classList.toggle('low',!GFX_HIGH); }
$('btnGfx').addEventListener('pointerdown',e=>{
  e.preventDefault();Audio.init();
  GFX_HIGH=!GFX_HIGH;
  try{ localStorage.setItem('ab_gfx',GFX_HIGH?'high':'low'); }catch(err){}
  syncGfxButton();
  /* Applied live (safe mid-run): pixel ratio, the shadow map switch,
     the sun's cast flag and the environment intensity — plus a FULL
     material refresh, because shadow/env state is compiled into every
     material's program (refreshing only physical materials would leave
     the Lambert ground/water/crowds in the old state). Material CLASS
     (Lambert vs physical) and antialias are creation-time: they follow
     the saved setting on the next load / next material build. The page
     is never reloaded from here. */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,GFX_HIGH?2:1.25));
  renderer.shadowMap.enabled=GFX_HIGH;
  sun.castShadow=GFX_HIGH;
  if(GFX_HIGH){ scene.environment=ensureStudioEnv(); scene.environmentIntensity=0.5; }
  else{ scene.environment=null; scene.environmentIntensity=0; }
  scene.traverse(o=>{ if(o.material){ const ms=Array.isArray(o.material)?o.material:[o.material];
    ms.forEach(m=>{ m.needsUpdate=true; }); } });
});
syncGfxButton();

/* ---------- armoury modal wiring ---------- */
$('armClose').addEventListener('click',()=>{closeArmoury();});
$('armoury').addEventListener('pointerdown',e=>{if(e.target===$('armoury'))closeArmoury();});

/* ---------- hero select modal wiring ---------- */
$('hselBack').addEventListener('click',()=>{closeHeroSelect();});
$('hsel').addEventListener('pointerdown',e=>{if(e.target===$('hsel'))closeHeroSelect();});

/* ---------- keyboard ---------- */
const GAME_KEYS=new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','j','k','shift','p','m','f','g','enter']);
/* Typing in a form field must never feed the game. The handler below
   preventDefaults every GAME_KEYS key, which deletes those characters
   from any text field it is not told about (it once knew only
   #coopInput, so the account form lost w/a/s/d/j/k/p/m/f/g/space/
   enter as typed) — and its side effects (attack/roll/magic latches,
   mute, fullscreen, pause) would fire mid-typing. ONE central guard
   covers every current and future field: account inputs, the room
   code, anything editable. The keyup handler stays UNguarded on
   purpose: it only clears UI.keys, and a movement key released over a
   field must still stop the hero — swallowing it would stick keys. */
function isFormTarget(e){
  const t=e&&e.target;
  if(!t||t===window||t===document)return false;
  const tag=t.tagName;
  return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||t.isContentEditable===true;
}
addEventListener('keydown',e=>{
  if(isFormTarget(e))return;
  const k=e.key.toLowerCase();
  if(GAME_KEYS.has(k))e.preventDefault();
  if(!UI.keys[k]){
    INPUT_LOG.keydown++;
    if(k==='shift'||k==='k'){UI.rollLatch=true;INPUT_LOG.rollPress++;}
    if(k===' '||k==='j')UI.atkBuf=ATK_BUFFER;
    if(k==='g'){UI.magicLatch=true;INPUT_LOG.magicPress++;}
    if(k==='enter'&&SIM.phase==='title'){ if(hselOpen)confirmHeroSelect(); else openHeroSelect('solo'); }
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
  'No third-party model, texture, font or audio files. All terrain, gear, VFX and music are generated in code. '+
  'The game files themselves are fetched once and make no asset requests; optional account sign-in and co-op play use the network.';

/* ---------- meta progression (localStorage, view-layer only) ---------- */
const META_KEY='aetherblade-meta-v1';
function loadMeta(){
  try{ const m=JSON.parse(localStorage.getItem(META_KEY));
    if(m&&m.v===1&&m.tracks&&m.heroes){
      /* Old saves predate chapters 4-6; backfill their star/best slots so
         the armoury never renders "undefined" for the new chapters. The
         save key and shape are unchanged — this is a pure default-fill. */
      m.best=m.best||{}; m.cleared=m.cleared||{};
      /* Pre-hints saves carry no hints object; updateHints() would throw
         inside the render loop and freeze the game (pack crash fix). */
      m.hints=m.hints||{};
      for(const c of CHAPTER_IDS){
        if(m.best[c]===undefined)m.best[c]=0;
        if(m.cleared[c]===undefined)m.cleared[c]=false;
      }
      return m;
    } }catch(e){}
  return {v:1,gold:0,tracks:{hp:0,dmg:0,spd:0},heroes:{},heroSkin:'hero',
          best:Object.fromEntries(CHAPTER_IDS.map(c=>[c,0])),bestTotal:0,
          cleared:Object.fromEntries(CHAPTER_IDS.map(c=>[c,false])),hints:{},rev:0};
}
let META=loadMeta();
let HERO_SKIN=safeHero(META.heroSkin);
let HERO_SKINS=[HERO_SKIN];   // per-player hero skins (index = player number)
let LOCAL_IDX=0;              // hero the camera / HUD / hints follow
function localHero(s){ return s.heroes[LOCAL_IDX]||s.heroes[0]; }
let SETTLED={ch:{},ended:false};
function saveMeta(){ try{ localStorage.setItem(META_KEY,JSON.stringify(META)); }catch(e){} }

/* ---------- account progression (Phase M2, server profile) ----------
   ACCT is the view-layer account state. 'account' means a session
   token exists AND the profile was fetched from the API: runs then
   derive their permanent stat block from the profile (plan section
   6) instead of the local tracks. Every other state plays exactly
   the pre-account game: local tracks, local gold — the guest/demo
   path, unchanged. API failure NEVER blocks play (plan section 8):
   it only means the account block is unavailable for that visit. */
let ACCT={ state:'guest', user:null, profile:null, block:zeroBlock(),
           notice:'', stale:false, rev:0, scope:null, runSaveFailed:false };
function acctChanged(){ ACCT.rev++; armouryRev=-1; }
function acctSetAccount(user,profile){
  ACCT.state='account'; ACCT.user=user||null; ACCT.profile=profile||null;
  ACCT.block=profileBlock(profile); ACCT.notice=''; ACCT.stale=false;
  acctChanged();
  acctRefreshScope();
}
function acctSetGuest(notice,stale){
  ACCT.state='guest'; ACCT.user=null; ACCT.profile=null; ACCT.block=zeroBlock();
  ACCT.notice=notice||''; ACCT.stale=!!stale; acctChanged();
}
/* The permanent block a SOLO run starts with: the account block when
   signed in, the legacy local tracks otherwise. */
function runBlock(){
  if(ACCT.state==='account')return Object.assign({},ACCT.block);
  return { hp:META.tracks.hp*CFG.meta.hpPer, dmg:META.tracks.dmg*CFG.meta.dmgPer,
           spd:META.tracks.spd*CFG.meta.spdPer, crit:0, magicDmg:0 };
}
function profileOwns(k){
  return ACCT.state==='account'&&ACCT.profile&&Array.isArray(ACCT.profile.heroes)&&
    ACCT.profile.heroes.indexOf(k)>=0;
}
/* Account-level-gated skins (descriptor `accountLevel` — today only the
   ANSUM signature skin): unlocked by the signed-in account's LEVEL, the
   profile being the source of truth. Never sold for gold; guests (and
   signed-out / below-level accounts) never qualify. */
function levelGateMet(k){
  const need=(HEROES[k]||{}).accountLevel;
  return need!==undefined&&ACCT.state==='account'&&ACCT.profile&&
    (ACCT.profile.level||0)>=need;
}
/* The skin a run/snapshot actually uses: a level-gated skin whose gate
   is not currently met falls back to the default hero, so a selection
   made while logged in can never smuggle the skin into guest play. */
function activeSkin(){
  const k=safeHero(META.heroSkin);
  if((HEROES[k]||{}).accountLevel!==undefined&&!levelGateMet(k))return 'hero';
  return k;
}
/* Boot: a stored session re-fetches its profile. 401 clears the dead
   session; a transport failure keeps the token (retryable) but plays
   as guest — rewards are online-only in v1 (plan section 8). */
async function acctBoot(){
  acctRefreshScope();
  const sess=loadSession();
  if(!sess){ acctSetGuest(''); return; }
  ACCT.state='checking'; acctChanged();
  try{
    const r=await apiProfile(sess.token);
    if(r.status===200&&r.body){ acctSetAccount(r.body.user,r.body.profile); return; }
    if(r.status===401){ clearSession(); acctSetGuest('SESSION EXPIRED — PLAYING AS GUEST'); return; }
    acctSetGuest('ACCOUNT UNAVAILABLE — PLAYING AS GUEST',true);
  }catch(e){ acctSetGuest('ACCOUNT UNAVAILABLE — PLAYING AS GUEST',true); }
}
async function acctLogout(){
  const sess=loadSession();
  if(sess){ try{ await apiLogout(sess.token); }catch(e){ /* revoke is best-effort */ } }
  clearSession(); acctSetGuest('');
  showBanner('LOGGED OUT',1600);
}
/* The public snapshot this player carries into a co-op handshake. */
function mySnapshot(){
  const skin=activeSkin();
  if(ACCT.state==='account'&&ACCT.profile)
    return profileSnapshot(ACCT.profile,ACCT.user,skin);
  return guestSnapshot(skin);
}

/* ---------- server progression (Phase M3) ----------
   Active only when signed in AND the API's /health reports scope
   'M3'. Until the API is redeployed with M3 the live Worker answers
   'M1' and everything in this section stays inert: signed-in play is
   exactly the M2 behaviour, local crediting included. That ordering
   is deliberate — the game ships first, the API catches up, and the
   mode switches itself on when the health scope flips. */
function serverProgression(){ return ACCT.state==='account'&&ACCT.scope==='M3'; }
async function acctRefreshScope(){
  try{
    const r=await apiHealth();
    if(r.status===200&&r.body&&typeof r.body.scope==='string'&&ACCT.scope!==r.body.scope){
      ACCT.scope=r.body.scope; acctChanged();
    }
  }catch(e){ /* scope unknown -> M2 behaviour, the safe default */ }
}

/* Run tracking for submissions. RUN lives entirely in the view
   layer: the id is generated at run start (co-op: by the host and
   shared through the start payload, so every participant claims the
   same run under their own account), elite kills are counted from
   the sim's kill events as the view consumes them, and the payload
   is rebuilt from the sim's cumulative counters at each settlement
   point — chapter checkpoints first, the final outcome last. The
   server recomputes entitlement from these counters; a failed send
   keeps the payload in RUN.pending for the Armoury retry and never
   blocks play (plan sections 3 + 8). */
let RUN=null;
function newRunId(){
  try{ if(window.crypto&&crypto.randomUUID)return crypto.randomUUID(); }catch(e){}
  return 'run-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12)+
         '-'+Math.random().toString(36).slice(2,12);
}
function runBegin(id,mode,heroId){
  RUN={ id:id||null, mode:mode||'solo', heroId:heroId||'hero',
        eliteKills:0, chapterScores:{}, pending:[] };
  ACCT.runSaveFailed=false;
}
function runPayload(stage,chaptersCleared,victory){
  const s=SIM;
  const p={ clientRunId:RUN.id, stage, mode:RUN.mode, heroId:RUN.heroId,
    build:CFG.net.build, economyVersion:ECONOMY_VERSION,
    score:s.score, kills:s.kills, eliteKills:RUN.eliteKills,
    chaptersCleared, victory:!!victory,
    durationSec:Math.floor(s.tick/60), simTicks:s.tick,
    chapterScores:Object.assign({},RUN.chapterScores) };
  if(RUN.mode==='coop')p.partyRunId=RUN.id;
  return p;
}
function runSubmit(stage,chaptersCleared,victory){
  if(!serverProgression()||!RUN||!RUN.id)return;
  const payload=runPayload(stage,chaptersCleared,victory);
  RUN.pending=RUN.pending.filter(x=>x.stage!==stage);
  RUN.pending.push(payload);
  acctSendRun(payload);
}
async function acctSendRun(payload){
  const sess=loadSession(); if(!sess)return;
  try{
    const r=await apiSubmitRun(sess.token,payload);
    if(r.status===200&&r.body){
      if(RUN)RUN.pending=RUN.pending.filter(x=>x.stage!==payload.stage);
      if(r.body.profile)acctSetAccount(ACCT.user,r.body.profile);
      if(ACCT.runSaveFailed&&!(RUN&&RUN.pending.length)){ ACCT.runSaveFailed=false; }
      acctChanged();
      return;
    }
    if(r.status===401){ clearSession(); acctSetGuest('SESSION EXPIRED — PLAYING AS GUEST'); return; }
  }catch(e){ /* transport failure: the payload stays pending */ }
  ACCT.runSaveFailed=true; acctChanged();
}
function runRetryPending(){
  if(!RUN||!RUN.pending.length)return;
  for(const p of RUN.pending.slice())acctSendRun(p);
}
function buyTrack(id){
  const lv=META.tracks[id]; if(lv>=CFG.meta.steps)return;
  const c=CFG.meta.costs[lv]; if(META.gold<c)return;
  META.gold-=c; META.tracks[id]++; META.rev++; saveMeta(); Audio.init();
}
function heroBtn(k){
  if((HEROES[k]||{}).accountLevel!==undefined){
    /* Level-gated signature skin: selection only, and only while the
       signed-in account meets the level — there is no gold price. */
    if(!levelGateMet(k))return;
    META.heroSkin=(META.heroSkin===k?'hero':k);
    META.rev++; saveMeta(); Audio.init();
    return;
  }
  if(!META.heroes[k]&&profileOwns(k)){
    /* Owned on the account profile: selection only — the purchase
       branch below is for local (guest) unlocks. */
    META.heroSkin=(META.heroSkin===k?'hero':k);
    META.rev++; saveMeta(); Audio.init();
    return;
  }
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
/* M3: one equipment upgrade, charged by the server. The button
   shows the server's price for the NEXT level (the cost table is
   shared data in account.js); the response profile re-renders the
   whole hall, so what you see is always the server's truth. */
let acctSpendBusy=false;
function equipBtn(sl){
  const p=ACCT.profile||{};
  const lv=(p.equipment&&p.equipment[sl.api])||0;
  if(lv>=10)return {label:sl.label+' \u00B7 LV 10/10 \u00B7 MAX',fn:()=>{}};
  const cost=upgradeCostFor(lv+1);
  const gain=sl.key==='helm'?('+1% '+sl.stat):('+'+acctFmtN(sl.per)+' '+sl.stat);
  return {label:sl.label+' '+gain+' \u00B7 LV '+lv+'/10 \u00B7 '+cost.gold+' G + '+cost.shards+' \u25C6',
    fn:()=>acctUpgrade(sl)};
}
async function acctUpgrade(sl){
  if(acctSpendBusy||!serverProgression())return;
  const sess=loadSession(); if(!sess)return;
  acctSpendBusy=true;
  try{
    const r=await apiUpgradeEquipment(sess.token,sl.api,newRunId());
    if(r.status===200&&r.body&&r.body.profile){
      acctSetAccount(ACCT.user,r.body.profile);
      showBanner(sl.label+' \u2192 LV '+(r.body.level||''),1600);
    }else{
      showBanner(apiErrorText(r,'Upgrade failed — nothing was charged.'),2400);
    }
  }catch(e){ showBanner('Could not reach the account service — upgrade not charged.',2400); }
  acctSpendBusy=false; armouryRev=-1; renderArmoury();
}
function metaButtons(){
  /* In server progression mode the five equipment buttons replace
     the local legacy tracks (plan section 5: convert, don't
     duplicate). Guests — and signed-in play while the API is still
     pre-M3 — keep the local tracks exactly as before. Track labels,
     per-step values and button order come from src/content/rules.js
     -> RULES.meta.tracks. */
  const bs=serverProgression()
    ? ACCOUNT_GAINS.slots.map(equipBtn)
    : CFG.meta.tracks.map(trackBtn);
  /* Generated from the hero registry: a new <id>.js in content/heroes/
     automatically gets an UNLOCK/USE button. The old hard-coded four-id
     list silently hid any newly added skin. */
  for(const k of Object.keys(HEROES)){
    if(HEROES[k].default)continue;      // the free default hero is never sold
    const nm=heroLabel(k);
    if(HEROES[k].accountLevel!==undefined){
      /* Level-gated skin: shows its requirement while locked, never a
         gold price (it is not purchasable). */
      if(levelGateMet(k))bs.push({label:(META.heroSkin===k?'\u2713 HERO: ':'USE HERO: ')+nm+' (ACCOUNT LV '+HEROES[k].accountLevel+')',fn:()=>heroBtn(k)});
      else bs.push({label:'\u{1F512} HERO: '+nm+' \u00B7 ACCOUNT LV '+HEROES[k].accountLevel,fn:()=>{ showBanner('UNLOCKS AT ACCOUNT LEVEL '+HEROES[k].accountLevel+' \u2014 LOG IN AND LEVEL UP',2600); }});
    }
    else if(META.heroes[k]||profileOwns(k))bs.push({label:(META.heroSkin===k?'\u2713 HERO: ':'USE HERO: ')+nm+(profileOwns(k)&&!META.heroes[k]?' (ACCOUNT)':''),fn:()=>heroBtn(k)});
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
function acctFmtN(n){ return n%1===0?String(n|0):String(+n.toFixed(2)); }
function armouryAccountHTML(){
  if(ACCT.state==='checking')
    return '<div class="acctpanel"><div>CHECKING ACCOUNT\u2026</div></div>';
  if(ACCT.state!=='account'||!ACCT.profile)
    return '<div class="acctpanel"><div>NOT LOGGED IN \u2014 the Armoury below is your local guest progression. '+
      'Log in from the landing to play on your account: account level and equipment replace the local tracks in your runs.</div></div>';
  const p=ACCT.profile, u=ACCT.user||{};
  const xpLine=p.nextLevelXp==null
    ? 'ACCOUNT LV '+p.level+' \u2014 MAX LEVEL \u00B7 '+p.xp+' XP'
    : 'ACCOUNT LV '+p.level+' \u00B7 XP '+p.xpIntoCurrentLevel+' / '+p.nextLevelXp+' TO LV '+(p.level+1);
  const eq=ACCOUNT_GAINS.slots.map(sl=>{
    const lv=(p.equipment&&p.equipment[sl.api])||0;
    const gain=sl.key==='helm'?('+'+lv+'% '+sl.stat):('+'+acctFmtN(sl.per*lv)+' '+sl.stat);
    return sl.label+' LV '+lv+' <span class="k">'+gain+'</span>';
  }).join(' &nbsp;\u00B7&nbsp; ');
  const emailLine=u.email
    ? '<div>EMAIL <span class="k">'+esc(u.email)+'</span></div>'
    : '<div>NO EMAIL ON FILE \u2014 add one from the account panel (landing \u2192 account) so you can reset a forgotten password by email.</div>';
  let tail;
  if(serverProgression()){
    tail='<div>Your runs earn on this account and are saved by the server as you clear chapters. '
      +'All three heroes are open to your account. Upgrade equipment with the buttons below \u2014 '
      +'the server charges your account gold and shards.</div>';
    if(ACCT.runSaveFailed)
      tail+='<div class="cstat">LAST RUN COULD NOT BE SAVED \u2014 check your connection, then use RETRY RUN SAVE below.</div>';
  }else{
    tail='<div>Your runs use this account block. Equipment upgrades and hero unlocks move server-side in the next account update; the local hall below still serves guest play.</div>';
  }
  return '<div class="acctpanel">'+
    '<div>\u269C <span class="k">'+esc(u.username||'')+'</span> &nbsp;\u00B7&nbsp; '+xpLine+'</div>'+
    '<div>\u{1FA99} GOLD <span class="k">'+p.gold+'</span> &nbsp;\u00B7&nbsp; \u25C6 AETHER SHARDS <span class="k">'+p.shards+'</span></div>'+
    '<div>EQUIPMENT \u2014 '+eq+'</div>'+
    emailLine+
    tail+
  '</div>';
}
function armouryBodyHTML(){
  return armouryAccountHTML()+
  '<div>\u{1FA99} GOLD <span class="k">'+META.gold+'</span> &nbsp;\u00B7&nbsp; BEST '+META.bestTotal+
    ' &nbsp;\u00B7&nbsp; '+CHAPTER_IDS.map(c=>(META.cleared[c]?'\u2605':'\u2606')+' CH'+c+(META.best[c]?' \u00B7 '+META.best[c]:'')).join(' &nbsp; ')+
    ' &nbsp;\u00B7&nbsp; HERO: '+esc(heroLabel(safeHero(META.heroSkin)))+'</div>'+
  '<div>Spend gold below: permanent upgrades and hero skins carry across every run. Magic: fill the meter with kills, then unleash 60 damage on everything near.</div>';
}
function renderArmoury(){
  if(!armouryOpen)return;
  const rk=META.rev+':'+ACCT.rev;
  if(armouryRev===rk)return;
  armouryRev=rk;
  $('armBody').innerHTML=armouryBodyHTML();
  const bs=metaButtons();
  if(ACCT.runSaveFailed&&RUN&&RUN.pending&&RUN.pending.length)
    bs.unshift({label:'RETRY RUN SAVE',fn:()=>{ runRetryPending(); }});
  if(ACCT.state==='account')
    bs.unshift({label:'LOG OUT \u00B7 '+((ACCT.user&&ACCT.user.username)||''),fn:()=>{ acctLogout(); }});
  fillBtns($('armBtns'),bs);
}

/* ---------- account modal: login / register / recovery reset ----------
   The landing's LOG IN / REGISTER button opens this. Registration
   ends on the recovery-code view: the code is shown ONCE, big, with
   an explicit I-SAVED-IT step before the player proceeds (plan
   section 2). A password reset likewise surfaces the REPLACEMENT
   code before returning to the login view. */
let acctOpen=false, acctView='login', acctErr='', acctBusy=false,
    acctRecovery=null, acctRecoveryKind='', acctFormUser='', acctFormEmail='', acctRev='';
function openAccount(view){
  if(SIM.phase!=='title')return;
  closeArmoury(); closeCoop();
  acctOpen=true; acctErr=''; acctBusy=false;
  acctView=ACCT.state==='account'?'account':(view||'login');
  acctRev='';
  $('acct').classList.add('on');
  renderAccount(); Audio.init();
}
function closeAccount(){
  if(!acctOpen)return;
  acctOpen=false; acctRev='';
  $('acct').classList.remove('on');
  if(SIM.phase==='title'){ hideOverlay(); syncOverlay(); }
}
function acctNav(view){ acctView=view; acctErr=''; acctRev=''; renderAccount(); }
function acctFail(msg){ acctBusy=false; acctErr=msg; acctRev=''; renderAccount(); }
async function acctDoLogin(){
  if(acctBusy)return;
  const u=$('acctUser').value.trim(), p=$('acctPass').value;
  acctFormUser=u; acctBusy=true; acctErr=''; acctRev=''; renderAccount();
  try{
    const r=await apiLogin(u,p);
    if(r.status===200&&r.body&&r.body.token){
      saveSession(r.body.token,r.body.expiresAt);
      acctSetAccount(r.body.user,r.body.profile);
      acctBusy=false; closeAccount();
      showBanner('WELCOME BACK, '+((r.body.user&&r.body.user.username)||''),2000);
      return;
    }
    acctFail(apiErrorText(r,'Login failed.'));
  }catch(e){ acctFail('Could not reach the account service. Check your connection \u2014 or keep playing as guest.'); }
}
async function acctDoRegister(){
  if(acctBusy)return;
  const u=$('acctUser').value.trim(), p=$('acctPass').value,
        em=$('acctEmail')?$('acctEmail').value.trim():'';
  acctFormUser=u; acctFormEmail=em;
  if(!emailLooksValid(em)){ acctErr='Enter a valid email address \u2014 it is how you reset a forgotten password.'; acctRev=''; renderAccount(); return; }
  acctBusy=true; acctErr=''; acctRev=''; renderAccount();
  try{
    const r=await apiRegister(u,p,em);
    if(r.status===201&&r.body&&r.body.token){
      saveSession(r.body.token,r.body.expiresAt);
      acctSetAccount(r.body.user,r.body.profile);
      acctRecovery=r.body.recoveryCode||''; acctRecoveryKind='register';
      acctBusy=false; acctView='recovery'; acctRev=''; renderAccount();
      return;
    }
    acctFail(apiErrorText(r,'Registration failed.'));
  }catch(e){ acctFail('Could not reach the account service. Check your connection \u2014 or keep playing as guest.'); }
}
async function acctDoReset(){
  if(acctBusy)return;
  const u=$('acctUser').value.trim(), c=$('acctCode').value.trim(), p=$('acctPass').value;
  acctFormUser=u; acctBusy=true; acctErr=''; acctRev=''; renderAccount();
  try{
    const r=await apiReset(u,c,p);
    if(r.status===200&&r.body){
      clearSession();            // the server revoked every session, ours included
      acctSetGuest('');
      acctRecovery=r.body.recoveryCode||''; acctRecoveryKind='reset';
      acctBusy=false; acctView='recovery'; acctRev=''; renderAccount();
      return;
    }
    acctFail(apiErrorText(r,'Reset failed.'));
  }catch(e){ acctFail('Could not reach the account service. Check your connection \u2014 or keep playing as guest.'); }
}
function acctRecoveryDone(){
  const kind=acctRecoveryKind;
  acctRecovery=null; acctRecoveryKind='';
  if(kind==='reset'){ acctView='login'; acctErr=''; acctRev=''; renderAccount(); }
  else closeAccount();
}
/* Reset by email, step 1: username + email -> 6-digit code. The API
   answers the same for matched and unmatched pairs; only
   EMAIL_NOT_CONFIGURED is surfaced, plainly, with the recovery-code
   path as the way through (the Worker has no mail key yet). */
async function acctDoEmailRequest(){
  if(acctBusy)return;
  const u=$('acctUser').value.trim(), em=$('acctEmail').value.trim();
  acctFormUser=u; acctFormEmail=em;
  if(!emailLooksValid(em)){ acctErr='Enter the email address on the account.'; acctRev=''; renderAccount(); return; }
  acctBusy=true; acctErr=''; acctRev=''; renderAccount();
  try{
    const r=await apiResetEmailRequest(u,em);
    if(r.status===200){ acctBusy=false; acctView='resetEmailCode'; acctRev=''; renderAccount(); return; }
    if(r.body&&r.body.error&&r.body.error.code==='EMAIL_NOT_CONFIGURED'){
      acctBusy=false; acctView='reset';
      acctErr='Email reset is not switched on yet \u2014 use your recovery code below.';
      acctRev=''; renderAccount(); return;
    }
    acctFail(apiErrorText(r,'Could not request a reset code.'));
  }catch(e){ acctFail('Could not reach the account service. Check your connection \u2014 or keep playing as guest.'); }
}
/* Reset by email, step 2: code + new password. Success mirrors the
   recovery-code reset: every session is revoked and a REPLACEMENT
   recovery code is shown once. */
async function acctDoEmailConfirm(){
  if(acctBusy)return;
  const c=$('acctMailCode').value.trim(), p=$('acctPass').value;
  acctBusy=true; acctErr=''; acctRev=''; renderAccount();
  try{
    const r=await apiResetEmailConfirm(acctFormUser,c,p);
    if(r.status===200&&r.body){
      clearSession();
      acctSetGuest('');
      acctRecovery=r.body.recoveryCode||''; acctRecoveryKind='reset';
      acctBusy=false; acctView='recovery'; acctRev=''; renderAccount();
      return;
    }
    acctFail(apiErrorText(r,'Reset failed.'));
  }catch(e){ acctFail('Could not reach the account service. Check your connection \u2014 or keep playing as guest.'); }
}
/* Signed-in: add/replace the account email (accounts registered
   before email existed have none on file). */
async function acctDoSetEmail(){
  if(acctBusy)return;
  const em=$('acctEmail')?$('acctEmail').value.trim():'';
  acctFormEmail=em;
  if(!emailLooksValid(em)){ acctErr='Enter a valid email address.'; acctRev=''; renderAccount(); return; }
  const sess=loadSession(); if(!sess)return;
  acctBusy=true; acctErr=''; acctRev=''; renderAccount();
  try{
    const r=await apiSetEmail(sess.token,em);
    if(r.status===200&&r.body){ acctSetAccount(r.body.user,r.body.profile); acctBusy=false; acctRev=''; renderAccount(); return; }
    if(r.status===401){ clearSession(); acctSetGuest('SESSION EXPIRED \u2014 PLAYING AS GUEST'); acctBusy=false; acctView='login'; acctRev=''; renderAccount(); return; }
    acctFail(apiErrorText(r,'Could not save the email.'));
  }catch(e){ acctFail('Could not reach the account service.'); }
}
function renderAccount(){
  if(!acctOpen)return;
  const key=acctView+'|'+acctErr+'|'+(acctBusy?1:0)+'|'+ACCT.state+'|'+ACCT.rev;
  if(key===acctRev)return;
  acctRev=key;
  const title=$('acctTitle'), body=$('acctBody'), bw=$('acctBtns'), cb=$('acctClose');
  const err=acctErr?'<div class="cstat">'+esc(acctErr)+'</div>':'';
  const userIn='<input class="acctIn" id="acctUser" placeholder="USERNAME" autocomplete="off" spellcheck="false" value="'+esc(acctFormUser)+'">';
  const passIn='<input class="acctIn" id="acctPass" type="password" placeholder="PASSWORD" autocomplete="off">';
  const emailIn='<input class="acctIn" id="acctEmail" type="email" placeholder="EMAIL" autocomplete="off" spellcheck="false" value="'+esc(acctFormEmail)+'">';
  const busy=acctBusy?'<div class="cstat">WORKING\u2026</div>':'';
  let btns=[], closeLabel='CLOSE';
  if(acctView==='login'){
    title.textContent='LOG IN';
    body.innerHTML='<div>Your account carries your level, gold, shards and equipment across devices.</div>'+
      userIn+passIn+err+busy;
    btns=[{label:acctBusy?'WORKING\u2026':'LOG IN',fn:acctDoLogin},
          {label:'NO ACCOUNT? REGISTER',fn:()=>acctNav('register'),ghost:true},
          {label:'FORGOT PASSWORD',fn:()=>acctNav('reset'),ghost:true}];
  }else if(acctView==='register'){
    title.textContent='REGISTER';
    body.innerHTML='<div>Username: 3\u201316 letters, numbers or underscores. Password: at least 8 characters. '+
      'Email is required \u2014 it is how you reset a forgotten password.</div>'+
      userIn+emailIn+passIn+
      '<div class="acctwarn">You will be shown ONE recovery code. Save it outside the game: '+
      'if you lose both your password and that code, there is no self-service way back in.</div>'+err+busy;
    btns=[{label:acctBusy?'WORKING\u2026':'CREATE ACCOUNT',fn:acctDoRegister},
          {label:'BACK TO LOGIN',fn:()=>acctNav('login'),ghost:true}];
  }else if(acctView==='reset'){
    title.textContent='RESET PASSWORD';
    body.innerHTML='<div>Enter your username, the recovery code from registration, and a new password. '+
      'Resetting signs out every device and issues a NEW recovery code.</div>'+
      userIn+'<input class="acctIn" id="acctCode" placeholder="RECOVERY CODE" autocomplete="off" spellcheck="false">'+passIn+err+busy;
    btns=[{label:acctBusy?'WORKING\u2026':'RESET PASSWORD',fn:acctDoReset},
          {label:'NO CODE? RESET BY EMAIL',fn:()=>acctNav('resetEmail'),ghost:true},
          {label:'BACK TO LOGIN',fn:()=>acctNav('login'),ghost:true}];
  }else if(acctView==='resetEmail'){
    title.textContent='RESET BY EMAIL';
    body.innerHTML='<div>Enter your username and the email on the account. If they match an account, '+
      'a 6-digit reset code is emailed to it (15 minutes, one use).</div>'+
      userIn+emailIn+err+busy;
    btns=[{label:acctBusy?'WORKING\u2026':'SEND RESET CODE',fn:acctDoEmailRequest},
          {label:'USE RECOVERY CODE INSTEAD',fn:()=>acctNav('reset'),ghost:true},
          {label:'BACK TO LOGIN',fn:()=>acctNav('login'),ghost:true}];
  }else if(acctView==='resetEmailCode'){
    title.textContent='ENTER YOUR RESET CODE';
    body.innerHTML='<div>If that username and email match an account, a code is on its way to <span class="k">'+
      esc(acctFormEmail)+'</span>. Enter it with a new password. Resetting signs out every device and issues a NEW recovery code.</div>'+
      '<input class="acctIn" id="acctMailCode" placeholder="6-DIGIT CODE" autocomplete="off" spellcheck="false" inputmode="numeric">'+passIn+err+busy;
    btns=[{label:acctBusy?'WORKING\u2026':'RESET PASSWORD',fn:acctDoEmailConfirm},
          {label:'BACK',fn:()=>acctNav('resetEmail'),ghost:true}];
  }else if(acctView==='recovery'){
    title.textContent='SAVE YOUR RECOVERY CODE';
    body.innerHTML=(acctRecoveryKind==='reset'
      ? '<div>Password reset. Your recovery code has been REPLACED \u2014 the old one no longer works. Save the new code, then log in with your new password.</div>'
      : '<div>Account created. This code is shown ONCE \u2014 it is the only way back in if you forget your password. Save it outside the game.</div>')+
      '<div class="acctCode">'+esc(acctRecovery||'')+'</div>'+err;
    btns=[{label:'I SAVED MY CODE',fn:acctRecoveryDone}];
    closeLabel='';           // the save step is the way out — no accidental skip
  }else{ /* account */
    title.textContent='ACCOUNT';
    const p=ACCT.profile||{}, u=ACCT.user||{};
    let emailBlock;
    if(u.email){
      emailBlock='<div>EMAIL <span class="k">'+esc(u.email)+'</span> \u2014 password resets by email go here.</div>'+emailIn+
        '<div>Enter a different address above to replace it.</div>';
      btns=[{label:acctBusy?'WORKING\u2026':'UPDATE EMAIL',fn:acctDoSetEmail}];
    }else{
      emailBlock='<div>NO EMAIL ON FILE. Add one so a forgotten password can be reset by email '+
        '(the recovery code stays as the other way back in).</div>'+emailIn;
      btns=[{label:acctBusy?'WORKING\u2026':'ADD EMAIL',fn:acctDoSetEmail}];
    }
    body.innerHTML='<div>\u269C <span class="k">'+esc(u.username||'')+'</span> \u00B7 ACCOUNT LV '+(p.level||1)+
      ' \u00B7 \u{1FA99} '+(p.gold||0)+' \u00B7 \u25C6 '+(p.shards||0)+'</div>'+
      '<div>Your runs use your account stat block. Full details live in the Armoury.</div>'+
      emailBlock+err+busy;
    btns.push({label:'LOG OUT',fn:()=>{ acctLogout(); acctNav('login'); },ghost:true});
  }
  $('acctBody').innerHTML=body.innerHTML;
  fillBtns(bw,btns);
  cb.style.display=closeLabel?'':'none';
  cb.textContent=closeLabel||'CLOSE';
  cb.onclick=closeLabel?closeAccount:null;
}

/* ---------- hero select: the pre-run picker (landing -> pick -> run) ----
   Exactly three identity heroes are offered here; the class skins stay in
   the Armoury. Confirming writes META.heroSkin through the same save the
   Armoury uses (key aetherblade-meta-v1) ONLY when an identity card was
   actually picked (or an identity is already worn): an Armoury-selected
   skin survives a plain confirm, otherwise skins could never be played.
   An unlock goes through heroBtn()'s purchase, then selects immediately.
   View/flow only — no sim input. */
const HSEL_HEROES=['hero','frostarcher','dwarf'];
let hselOpen=false, hselMode='solo', hselKind='hero', hselRev='';
/* Whether the player actually tapped an identity card this visit.
   Without it, confirming the picker overwrote an Armoury-selected
   class/signature skin with the default identity — the skin could be
   bought and selected yet never reach a run (pre-existing flow bug,
   measured 2026-11-14 with the knight skin; ANSUM made it matter). */
let hselPicked=false;
function hselOwned(k){ return !!HEROES[k].default||!!META.heroes[k]||profileOwns(k); }
function hselCost(k){ return CFG.meta.heroCosts[k]||0; }
function hselNum(n){ return n%1===0?String(n|0):String(n); }
function heroAbilityText(k){
  const m=HERO_MAGIC[k];
  if(!m)return 'ARCANE BLAST \u2014 the standard magic';
  if(m.kind==='frost')return 'FROST NOVA \u2014 freezes enemies '+hselNum(m.freezeSec)+' s, boss '+hselNum(m.bossFreezeSec)+' s';
  if(m.kind==='earth')return 'EARTHQUAKE \u2014 knocks enemies back '+m.push+' m, boss '+m.bossPush+' m';
  if(m.kind==='fire')return 'FIRE CRESCENT \u2014 the blast hits for '+Math.round(CFG.magic.dmg*(m.dmgMul||1))+' dmg';
  return 'SIGNATURE MAGIC';
}
/* The one-line tradeoff shown under the ability — read from the hero
   descriptor's `trait`, so the card can never drift from the content. */
function heroTraitText(k){ return (HEROES[k]&&HEROES[k].trait)||''; }
function heroRoleText(k){ return (HEROES[k]&&HEROES[k].role)||''; }
/* Name + class for one-line surfaces (Armoury): "Penny · ARCHER".
   Heroes without a role (the class skins) render as just their name. */
function heroLabel(k){ const r=heroRoleText(k); const n=heroName(k); return r?n+' \u00B7 '+r:n; }
function spawnHeroPreview(kind){
  removeHeroPreview();
  hselView=makeView(kind,HSEL_ID);
  hselSpin=-0.6;   // open on a front three-quarter view, then drift around
  const h=SIM.heroes[0];
  hselView.mesh.position.set(h?h.x:0,0,(h?h.z:0)+1.2);
  hselView.mesh.visible=true;
}
function removeHeroPreview(){
  if(!hselView)return;
  scene.remove(hselView.mesh);
  if(hselView.dispose)hselView.dispose(); else hselView.mesh.material.dispose();
  VIEWS.delete(HSEL_ID); hselView=null;
}
function updateHeroPreview(dt){
  if(!hselOpen||!hselView)return;
  hselSpin+=dt*0.3;
  updateAnim(hselView,dt,0);
  /* facing set after the pose pass, the same order syncViews uses for the
     sim hero views: PI faces the figure toward the menu camera */
  hselView.mesh.rotation.y=Math.PI+hselSpin;   // start facing camera, slow turn
}
function openHeroSelect(mode){
  if(SIM.phase!=='title')return;
  hselMode=(mode==='coop')?'coop':'solo';
  const cur=safeHero(META.heroSkin);
  hselKind=HSEL_HEROES.includes(cur)?cur:'hero';
  hselPicked=false;
  hselOpen=true; hselRev='';
  $('hsel').classList.add('on');
  spawnHeroPreview(hselKind);
  renderHeroSelect();
  Audio.init();
}
function closeHeroSelect(){
  if(!hselOpen)return;
  hselOpen=false; hselRev='';
  removeHeroPreview();
  $('hsel').classList.remove('on');
  if(SIM.phase==='title'){ hideOverlay(); syncOverlay(); }  // restore the landing
}
function pickHeroCard(k){
  if(!HSEL_HEROES.includes(k))return;
  hselKind=k; hselPicked=true; hselRev='';
  spawnHeroPreview(k);
  renderHeroSelect();
  Audio.init();
}
function unlockHeroFromSelect(){
  const k=hselKind;
  if(hselOwned(k)||META.gold<hselCost(k))return;
  heroBtn(k);                        // the existing purchase: gold, flag, save
  if(!META.heroes[k])return;         // purchase refused — nothing changed
  META.heroSkin=k; META.rev++; saveMeta();   // unlock selects immediately
  hselRev=''; renderHeroSelect();
}
function confirmHeroSelect(){
  if(!hselOpen||!hselOwned(hselKind))return;
  /* The picker chooses among the three IDENTITY heroes; a skin chosen
     in the Armoury (class skin, or the level-gated ANSUM signature) is
     kept unless the player actually picked an identity card here, or
     already wears an identity (the highlighted card is then theirs). */
  if((hselPicked||HSEL_HEROES.includes(safeHero(META.heroSkin)))&&META.heroSkin!==hselKind){
    META.heroSkin=hselKind; META.rev++; saveMeta(); }
  const mode=hselMode;
  closeHeroSelect();
  if(mode==='coop')openCoop(); else startRun();
}
function renderHeroSelect(){
  if(!hselOpen)return;
  /* the landing stays hidden behind the sheet while the picker is open */
  $('overlay').classList.remove('on');
  const owned=hselOwned(hselKind), cost=hselCost(hselKind);
  const key=hselKind+'|'+hselMode+'|'+META.gold+'|'+META.rev+'|'+ACCT.rev+'|'+(owned?1:0);
  if(key===hselRev)return;
  hselRev=key;
  const cw=$('hselCards'); cw.innerHTML='';
  for(const k of HSEL_HEROES){
    const el=document.createElement('div');
    el.className='hcard'+(k===hselKind?' sel':'')+(hselOwned(k)?'':' locked');
    const st=k===hselKind?'SELECTED':(hselOwned(k)?'SELECT':'\u{1F512} '+hselCost(k)+' G');
    el.innerHTML='<div class="hnm">'+esc(heroName(k))+'</div>'+
      (heroRoleText(k)?'<div class="hrl">'+esc(heroRoleText(k))+'</div>':'')+
      '<div class="hds">'+esc(heroAbilityText(k))+'</div>'+
      '<div class="htr">'+esc(heroTraitText(k))+'</div>'+
      '<div class="hst">'+st+'</div>';
    el.addEventListener('click',()=>pickHeroCard(k));
    cw.appendChild(el);
  }
  $('hselGold').innerHTML='\u{1FA99} GOLD <span class="k">'+
    ((serverProgression()&&ACCT.profile)?ACCT.profile.gold:META.gold)+'</span>';
  const bw=$('hselBtns'); bw.innerHTML='';
  const b=document.createElement('button');
  b.className='bigbtn';
  if(owned){
    b.textContent=hselMode==='coop'?'CONTINUE TO CO-OP \u2192':'\u2694 BEGIN RUN';
    b.addEventListener('click',confirmHeroSelect);
  }else if(META.gold>=cost){
    b.textContent='UNLOCK \u00B7 '+cost+' G';
    b.addEventListener('click',unlockHeroFromSelect);
  }else{
    b.textContent='NEED '+(cost-META.gold)+' G MORE';
    b.disabled=true;
  }
  bw.appendChild(b);
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
  if(hselOpen)closeHeroSelect();   // the preview never leaks into a run
  runBegin(newRunId(),'solo',activeSkin());
  SIM=newSim(0x51A7E); SIM.phase='play';
  SIM.mods=runBlock();
  SIM.heroes[0].mods=Object.assign({},SIM.mods);
  SIM.hero.maxHp=CFG.hero.hp+SIM.mods.hp; SIM.hero.hp=SIM.hero.maxHp;
  HERO_SKIN=activeSkin();
  SIM.heroes[0].heroId=HERO_SKIN;
  HERO_SKINS=[HERO_SKIN]; LOCAL_IDX=0;
  const hv0=VIEWS.get(0);
  if(hv0&&hv0.kind!==HERO_SKIN){ scene.remove(hv0.mesh); hv0.mesh.material.dispose(); VIEWS.delete(0); }
  SETTLED={ch:{},ended:false};
  buildMapMeshes(SIM); resetTilt();UI.attack=false;UI.rollLatch=false;UI.magicLatch=false;
  hideOverlay();Audio.init();
}
function acctChipHTML(){
  if(ACCT.state==='checking')return '<div>CHECKING ACCOUNT\u2026</div>';
  if(ACCT.state==='account'&&ACCT.profile){
    const p=ACCT.profile;
    return '<div>\u269C <span class="k">'+esc((ACCT.user&&ACCT.user.username)||'')+'</span>'+
      ' \u00B7 ACCOUNT LV '+p.level+' \u00B7 \u{1FA99} '+p.gold+' \u00B7 \u25C6 '+p.shards+'</div>';
  }
  if(ACCT.notice)return '<div>'+esc(ACCT.notice)+'</div>';
  return '<div>PLAYING AS GUEST \u2014 no progression earned. Log in to level up, earn gold and upgrade equipment.</div>';
}
function syncOverlay(){
  const s=SIM,key=s.phase+(s.phase==='levelup'?s.level:'')+(s.phase==='clear'?s.chapter:'')+(s.phase==='title'?'m'+META.rev+'a'+ACCT.rev:'');
  if(key===overlayKey)return;
  if(s.phase==='title'){
    const btns=[{label:'\u2694 START RUN',fn:()=>openHeroSelect('solo'),prime:true},
       {label:'\u{1F465} CO-OP',fn:()=>openHeroSelect('coop'),ghost:true}];
    if(ACCT.state!=='account'){
      if(ACCT.stale)btns.push({label:'RETRY ACCOUNT',fn:()=>{ acctBoot(); },ghost:true});
      btns.push({label:ACCT.state==='checking'?'ACCOUNT\u2026':'LOG IN / REGISTER',fn:()=>openAccount('login'),ghost:true});
    }else{
      /* Signed in: the account panel (email, session) stays reachable. */
      btns.push({label:'ACCOUNT',fn:()=>openAccount('account'),ghost:true});
    }
    btns.push({label:'ARMOURY',fn:openArmoury,ghost:true});
    setOverlay(key,'','ANSUMBLADE','',acctChipHTML(),null,btns,'');
  }else if(s.phase==='levelup'){
    const cards=s.choices.map(id=>UPGRADES.find(u=>u.id===id)).filter(Boolean);
    let pickNote='The arena is paused.';
    if(NET&&NET.active){
      /* One caption rule for every party size, naming the ACTUAL
         picker (the pre-AB-NET-16 2P text hard-coded "The host is
         choosing" — wrong, and a dead end, whenever the host was
         downed and picking had passed to a guest). */
      const pk=netPickerSlot(NET); NET.pickerSlot=pk;
      pickNote=(NET.mySlot===pk)?'You are choosing for the party.':('P'+(pk+1)+' is choosing for the party.');
    }
    setOverlay(key,'LEVEL '+s.level,'CHOOSE AN UPGRADE',pickNote,
      '<div style="text-align:center">Upgrades and score carry across all '+CHAPTER_COUNT+' chapters.</div>',
      cards,null,'');
  }else if(s.phase==='clear'){
    if(!SETTLED.ch[s.chapter]){ SETTLED.ch[s.chapter]=true;
      if(RUN)RUN.chapterScores[s.chapter]=s.score;
      if(serverProgression()){
        /* M3: the chapter checkpoint is credited by the SERVER; the
           local save keeps only the records (cleared flag + bests). */
        META.cleared[s.chapter]=true;
        if(s.score>(META.best[s.chapter]||0))META.best[s.chapter]=s.score;
        if(s.score>META.bestTotal)META.bestTotal=s.score; saveMeta();
        runSubmit('chapter-'+s.chapter,s.chapter,false);
      }else{
        META.gold+=CFG.meta.clearBonus; META.cleared[s.chapter]=true;
        if(s.score>(META.best[s.chapter]||0))META.best[s.chapter]=s.score;
        if(s.score>META.bestTotal)META.bestTotal=s.score; saveMeta(); } }
    setOverlay(key,'CHAPTER '+s.chapter,'CHAPTER CLEARED',
      s.chapter<CHAPTER_COUNT?'NEXT: '+PALETTES[s.chapter].name:'THE ECLIPSE IS BROKEN',
      '<div style="text-align:center">Score '+s.score+' &nbsp;·&nbsp; Kills '+s.kills+' &nbsp;·&nbsp; HP '+Math.round(localHero(s).hp)+'</div>',
      null,null,'');
  }else if(s.phase==='dead'){
    if(!SETTLED.ended){ SETTLED.ended=true;
      if(serverProgression()){
        if(s.score>META.bestTotal)META.bestTotal=s.score; saveMeta();
        runSubmit('death',Object.keys(SETTLED.ch).length,false);
      }else{
        META.gold+=Math.floor(s.score/CFG.meta.scoreGoldDivisor);
        if(s.score>META.bestTotal)META.bestTotal=s.score; saveMeta(); } }
    setOverlay(key,'RUN ENDED','YOU FELL','CHAPTER '+s.chapter,
      '<div style="text-align:center">Score '+s.score+' &nbsp;·&nbsp; Kills '+s.kills+' &nbsp;·&nbsp; Level '+s.level+'</div>',
      null,(NET&&NET.active)?[{label:'END RUN',fn:()=>netTeardown(true)}]:[{label:'RETRY',fn:startRun}],'');
  }else if(s.phase==='victory'){
    if(!SETTLED.ended){ SETTLED.ended=true;
      if(serverProgression()){
        if(s.score>META.bestTotal)META.bestTotal=s.score; saveMeta();
        runSubmit('victory',CHAPTER_COUNT,true);
      }else{
        META.gold+=Math.floor(s.score/CFG.meta.scoreGoldDivisor)+CFG.meta.victoryBonus;
        if(s.score>META.bestTotal)META.bestTotal=s.score; saveMeta(); } }
    setOverlay(key,'ALL '+CHAPTER_COUNT+' CHAPTERS CLEARED','VICTORY','ANSUMBLADE',
      '<div style="text-align:center">Final score '+s.score+' &nbsp;·&nbsp; '+s.kills+' kills &nbsp;·&nbsp; Level '+s.level+'</div>',
      null,(NET&&NET.active)?[{label:'END RUN',fn:()=>netTeardown(true)}]:[{label:'PLAY AGAIN',fn:startRun}],CREDITS_HTML);
  }else if(s.phase==='paused'){
    setOverlay(key,'PAUSED','PAUSED','P TO RESUME','',null,
      [{label:'RESUME',fn:()=>{SIM.phase=SIM.boss?'boss':'play';SIM.paused=false;hideOverlay();}}],'');
  }else hideOverlay();
}


/* =====================================================================
   CO-OP — up to 4-player online lockstep, Dragon Alley rules, relay
   transport. One deterministic sim, N heroes in roster (slot) order;
   slot 0 = host. Transport is the WSS room forwarder (the deployed
   Dragon Alley worker): one room per 6-char code, per-slot sid-based
   60 s reservation (&sid=…&resume=1), a clean {"type":"bye"} frees the
   slot at once. Relay v6 gives AB rooms 4 slots and stamps every
   forwarded message with the sender's slot (`from`); on the v5 relay
   the same code runs a 2-player room exactly as before (no slot
   events, sender = the other player). 3–4 players require v6.
   NAMESPACE: AETHERBLADE codes ALWAYS carry '0' as the 2nd character
   (e.g. K0PXQ2). Dragon Alley's code alphabet has no 0/1, so a Dragon
   Alley session can never hold one of our codes; and the hello
   handshake (game tag + build string) refuses any peer that is not
   this build — a build mismatch shows VERSION MISMATCH instead of
   desyncing later.
   LOBBY: guests hello with their hero snapshot; the host broadcasts
   the roster; the host STARTs with 2–4 present and the roster locks
   (no mid-run joins). The start message carries seed + the agreed
   roster, so every client derives the same sim — including the
   player-count difficulty row (RULES.playerScaling, keyed by roster
   size) — before tick 0.
   LOCKSTEP: fixed 60 ticks/s, per-tick frames {t,mx,my,atk,rol,mag,upg}
   (move quantized int8), input delay 6, a tick runs only when EVERY
   roster frame exists, inputs sampled in EVERY state (the v16
   lesson), digest checkpoint exchange every 600 ticks compared
   across ALL players; a mismatch is a hard stop.
   RESUME: all sides freeze at the drop; the rejoin (same sid, worker
   grace window) triggers an executed-step exchange, everyone rebuilds
   the sim from the seed and REPLAYS the exchanged input log to the
   agreed tick, then re-runs the 6-tick input-delay runway with empty
   frames. No state serialization — determinism is the snapshot.
   DROPS (3–4P): past the window the remaining players agree a removal
   step (min of their first-missing steps for that slot) and the hero
   is removed there on every client; the run continues, and level-up
   picking passes to the lowest-numbered remaining player. In 2P the
   legacy flow is unchanged: past the window the remaining player may
   finish solo (partner hero despawns, XP stays).
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
/* The handshake carries the public progression SNAPSHOT (plan
   section 6), never derived mods and never balances/tokens: each
   client derives every player's stat block locally via
   snapshotBlock() from the agreed snapshot, so identical snapshots
   give bit-identical heroes. Guests carry the explicit zero
   snapshot. (Pre-M2 the raw {hp,dmg,spd} block crossed the wire;
   AB-NET-14 pairings only form between same-build clients, so the
   payload change needs no compat path.) */
function netMySnap(){ const skin=activeSkin();
  return {skin, snap:mySnapshot()}; }
function netPlayerBlock(p){
  if(p&&p.snap)return snapshotBlock(p.snap);
  if(p&&p.mods)return { hp:p.mods.hp||0, dmg:p.mods.dmg||0, spd:p.mods.spd||0, crit:0, magicDmg:0 };
  return zeroBlock();
}
function newNetSession(role,code){
  return { role, myIdx:role==='host'?0:1, code, sid:netNewSid(),
    mySlot:role==='host'?0:1, slotSeen:false,
    ws:null, send:null, active:false, started:false, startAt:0, seed:0,
    step:0, nextSend:0, recs:[{},{},{},{}], hashMine:{}, hashTheirs:{},
    lobby:{}, players:null, pickerSlot:0,
    droppedSlots:{}, removed:{}, removedApplied:{}, pendingDrop:null,
    execWait:null, bannerTxt:'', bannerUntil:0, removedSelf:false,
    desync:false, dropped:false, dropAt:0, retryAt:0, attempts:0,
    partnerLeft:false, selfLeft:false, closing:false, status:'menu', tries:0,
    lastStepAt:0 };
}
/* The sender's relay slot: relay v6 stamps `from` on every forwarded
   game message. On the v5 relay there is no stamp — the sender is
   simply "the other player", which is exact for a 2-player room. */
function netSenderSlot(sess,m){
  if(m&&typeof m.from==='number')return m.from;
  if(sess.players&&sess.players.length===2)
    return sess.players[1-sess.myIdx].slot;
  return sess.role==='host'?1:0;
}
function netSlotIdx(sess,slot){
  if(!sess.players)return -1;
  for(let i=0;i<sess.players.length;i++)if(sess.players[i].slot===slot)return i;
  return -1;
}
/* The level-up picker: the lowest-numbered REMAINING player who is
   still STANDING. Removed slots are out of the run (the AB-NET-9 drop
   rule); downed heroes are spectating and must not hold the party on
   the upgrade screen — before AB-NET-16 a downed host stayed picker,
   the living guest's taps were silently discarded, and the run hung
   forever (Matt, 2026-11-14). Derived from the sim's downed flags, so
   every client computes the same picker from the same state; the
   stamp gate in netSample only decides whose latch may ride a frame —
   the frames themselves stay the shared truth, so a derivation caught
   mid-transition can delay a pick a few ticks, never desync it. If
   every remaining player is downed the run is ending anyway: fall
   back to the lowest remaining slot, the pre-fix answer. */
function netPickerSlot(sess){
  if(!sess.players)return 0;
  let best=0,found=false,fallback=0,fbFound=false;
  for(const p of sess.players){
    if(sess.removed[p.slot]!=null)continue;
    if(!fbFound||p.slot<fallback){ fallback=p.slot; fbFound=true; }
    const idx=netSlotIdx(sess,p.slot);
    const h=idx>=0?SIM.heroes[idx]:null;
    if(h&&h.downed)continue;
    if(!found||p.slot<best){ best=p.slot; found=true; }
  }
  return found?best:fallback;
}
function netRemovedList(sess){
  return Object.keys(sess.removed).map(k=>({slot:+k,step:sess.removed[k]}));
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
    else if(sess.role==='host'&&!sess.started){
      sess.lobby[0]=netMySnap(); sess.status='waiting'; netSendRoster(sess);
    }
  };
  ws.onmessage=ev=>{
    if(sess!==NET||sess.ws!==ws)return;
    let m; try{ m=JSON.parse(ev.data); }catch(e){ return; }
    if(m&&m.type==='__relay')netRelayEvent(sess,m);
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
  const mine=netMySnap();
  sess.send({type:'hello',game:'aetherblade',build:CFG.net.build,code:sess.code,
    sid:sess.sid,slot:sess.mySlot,skin:mine.skin,snap:mine.snap,name:'P'+(sess.mySlot+1)});
}
function netSendRoster(sess){
  if(sess.role!=='host')return;
  const players=Object.keys(sess.lobby).map(Number).sort((a,b)=>a-b)
    .map(sl=>({slot:sl,skin:sess.lobby[sl].skin,snap:sess.lobby[sl].snap}));
  sess.send({type:'roster',players});
}
function netRelayEvent(sess,m){
  const ev=m.event;
  if(ev==='slot'){
    sess.mySlot=m.slot; sess.slotSeen=true;
    /* v6 tells the reclaimer its own slot: that is my cue to start the
       resume exchange (v5 has no slot event; there the returner is
       woken by 'paired' / the peers' resume messages instead). */
    if(sess.dropped&&sess.started)netBroadcastResume(sess);
  }
  else if(ev==='guest-joined'){ if(sess.role==='host'&&!sess.started)sess.status='paired'; }
  else if(ev==='peer-joined'){ /* lobby data itself arrives via hello/roster */ }
  else if(ev==='paired'){
    if(sess.role==='guest'&&!sess.started){ netSendHello(sess); sess.status='finding'; }
    else if(sess.started&&sess.dropped)netBroadcastResume(sess);
  }
  else if(ev==='peer-resumed'){
    if(sess.started){
      let slot=(typeof m.slot==='number')?m.slot:null;
      if(slot==null&&sess.players&&sess.players.length===2)
        slot=sess.players[1-sess.myIdx].slot;         // v5 carries no slot
      if(slot!=null)netOnPeerResumed(sess,slot);
    }else if(sess.role==='guest'){ netSendHello(sess); }
  }
  else if(ev==='peer-left'){
    netOnPeerGone(sess,(typeof m.slot==='number')?m.slot:null,false);
  }
  else if(ev==='waiting-host'){ if(!sess.started)sess.status='waitinghost';
    else if(sess.dropped)sess.status='resuming'; }
  else if(ev==='no-host'){ if(!sess.started)sess.status='nohost'; }
  else if(ev==='room-full'){ if(!sess.started)sess.status='full'; }
  else if(ev==='room-taken'){
    if(sess.role==='host'&&!sess.started&&sess.tries<8){
      sess.tries++; sess.code=netNewCode(); sess.closing=false;
      if(sess.ws){ const w=sess.ws; sess.ws=null; try{ w.close(); }catch(e){} }
      netConnect(sess,false);
    }else if(!sess.started){ sess.status='failed'; }
  }
}
/* A room member's socket is gone (ctl peer-left, or their clean bye).
   Pre-start this is lobby bookkeeping; post-start it feeds the drop /
   removal machinery (2-player rooms keep the exact legacy flow). */
function netOnPeerGone(sess,slot,viaBye){
  if(!sess.started){
    if(sess.role==='host'){
      if(slot==null){ for(const k of Object.keys(sess.lobby))if(+k!==0)delete sess.lobby[k]; }
      else if(sess.lobby[slot])delete sess.lobby[slot];
      sess.status=Object.keys(sess.lobby).length>1?'paired':'waiting';
      netSendRoster(sess);
    }else if(slot==null||slot===0){ sess.status='nohost'; }
    return;
  }
  if(slot==null){
    if(sess.players&&sess.players.length===2)slot=sess.players[1-sess.myIdx].slot;
    else return;
  }
  if(slot===sess.mySlot||sess.removed[slot]!=null)return;
  if(!sess.players||sess.players.length<=2){
    /* Legacy 2P flow, unchanged: a bye ends it now; a drop holds the
       slot for the grace window, then PARTNER LEFT. */
    if(viaBye){
      if(!sess.partnerLeft){ sess.partnerLeft=true; sess.dropped=false; sess.status='left'; openCoop(); }
    }else if(!sess.dropped&&!sess.partnerLeft){
      sess.dropped=true; sess.dropAt=performance.now(); sess.attempts=0;
      sess.status='dropped'; openCoop();
    }
    return;
  }
  if(!sess.droppedSlots[slot])sess.droppedSlots[slot]={at:performance.now(),bye:!!viaBye};
  if(viaBye)netStartDrop(sess,slot);   // a clean leave skips the grace wait
}
/* A dropped member reclaimed its slot inside the window: restart the
   deterministic-replay resync with an exec exchange among everyone
   still in the run. */
function netOnPeerResumed(sess,slot){
  if(sess.desync||sess.partnerLeft||sess.removedSelf)return;
  if(sess.removed[slot]!=null)return;              // already out of the run
  if(sess.droppedSlots[slot])delete sess.droppedSlots[slot];
  if(sess.pendingDrop&&sess.pendingDrop.slot===slot)sess.pendingDrop=null;
  netBroadcastResume(sess);
}
function netBroadcastResume(sess){
  if(!sess.execWait)sess.execWait={reports:{}};
  sess.execWait.reports[sess.mySlot]=sess.step;
  sess.send({type:'resume',exec:sess.step,rm:netRemovedList(sess)});
  netTryResume(sess);
}
function netAdoptRemoved(sess,list){
  if(!Array.isArray(list))return;
  for(const r of list){
    if(!r||typeof r.slot!=='number'||typeof r.step!=='number')continue;
    if(r.slot===sess.mySlot&&sess.started){
      /* I was dropped past the window and removed while away. */
      sess.removedSelf=true; sess.dropped=false; sess.execWait=null;
      sess.status='removed'; openCoop(); return;
    }
    if(sess.removed[r.slot]==null)sess.removed[r.slot]=r.step;
  }
  sess.pickerSlot=netPickerSlot(sess);
}
function netOnMsg(sess,m){
  if(!m||!m.type)return;
  if(m.type==='hello'){
    if(sess.role!=='host'||sess.started)return;
    if(m.game!=='aetherblade'||m.code!==sess.code)return;   // not our game: ignore
    const slot=netSenderSlot(sess,m);
    if(m.build!==CFG.net.build){
      sess.send({type:'reject',why:'VERSION MISMATCH',to:slot}); sess.status='mismatch'; return;
    }
    const snap=sanitizeSnapshot(m.snap);
    if(snap.progressionVersion!==PROGRESSION_VERSION||snap.economyVersion!==ECONOMY_VERSION){
      sess.send({type:'reject',why:'VERSION MISMATCH',to:slot}); sess.status='mismatch'; return;
    }
    sess.lobby[slot]={skin:m.skin||snap.heroId||'hero',snap};
    sess.status='paired';
    netSendRoster(sess);
  }
  else if(m.type==='roster'){
    if(sess.role!=='guest'||sess.started||!Array.isArray(m.players))return;
    sess.lobby={};
    for(const p of m.players)
      sess.lobby[p.slot]={skin:p.skin||'hero',snap:sanitizeSnapshot(p.snap)};
    if(sess.lobby[sess.mySlot]||sess.lobby[1])sess.status='lobby';
  }
  else if(m.type==='start'){
    if(sess.role!=='guest'||sess.started||sess.startPending)return;
    if(m.build!==CFG.net.build||typeof m.seed!=='number'||
       !Array.isArray(m.players)||m.players.length<2||m.players.length>4){
      sess.status='mismatch'; return;      // not an AETHERBLADE host payload
    }
    netAcceptStart(sess,m);
  }
  else if(m.type==='reject'){
    if(m.to!=null&&m.to!==sess.mySlot)return;   // addressed to another guest
    if(!sess.started)sess.status='mismatch';
  }
  else if(m.type==='input'){
    if(!sess.players)return;
    const idx=netSlotIdx(sess,netSenderSlot(sess,m));
    if(idx<0)return;
    if(m.f&&typeof m.f.t==='number')sess.recs[idx][m.f.t]=m.f;
  }
  else if(m.type==='hash'){
    const slot=netSenderSlot(sess,m);
    sess.hashTheirs[m.tick+':'+slot]=m.h;
    netCheckDesync(m.tick);
  }
  else if(m.type==='resume'||m.type==='resumeAck'){
    if(!sess.started||sess.desync||sess.partnerLeft)return;
    const slot=netSenderSlot(sess,m);
    netAdoptRemoved(sess,m.rm);
    if(sess.removedSelf)return;
    if(sess.removed[slot]!=null)return;          // a removed player's reports don't count
    if(!sess.execWait)sess.execWait={reports:{}};
    if(sess.execWait.reports[sess.mySlot]==null)
      sess.execWait.reports[sess.mySlot]=sess.step;
    sess.execWait.reports[slot]=m.exec;
    if(m.type==='resume')
      sess.send({type:'resumeAck',exec:sess.step,rm:netRemovedList(sess)});
    netTryResume(sess);
  }
  else if(m.type==='drop'){
    if(!sess.started||!sess.players||sess.players.length<=2)return;
    const from=netSenderSlot(sess,m), slot=m.slot;
    if(typeof slot!=='number'||sess.removed[slot]!=null||slot===sess.mySlot)return;
    if(!sess.pendingDrop||sess.pendingDrop.slot!==slot){
      sess.pendingDrop={slot,reports:{}};
      sess.pendingDrop.reports[sess.mySlot]=netFirstMissing(sess,slot);
      sess.send({type:'drop',slot,fm:sess.pendingDrop.reports[sess.mySlot]});
    }
    if(typeof m.fm==='number')sess.pendingDrop.reports[from]=m.fm;
    netTryFinishDrop(sess);
  }
  else if(m.type==='dropFinal'){
    if(!sess.started||!sess.players||sess.players.length<=2)return;
    if(typeof m.slot!=='number'||typeof m.step!=='number')return;
    if(sess.removed[m.slot]==null){
      sess.removed[m.slot]=m.step;
      if(sess.pendingDrop&&sess.pendingDrop.slot===m.slot)sess.pendingDrop=null;
      delete sess.droppedSlots[m.slot];
      sess.pickerSlot=netPickerSlot(sess);
    }
  }
  else if(m.type==='bye'){
    netOnPeerGone(sess,netSenderSlot(sess,m),true);
  }
}
/* Guest side of START: sanitise the roster, verify every snapshot's
   progression/economy version, then verify the host's progression
   digest against a locally recomputed one (snapshot + derived block
   per player, plan section 6). Only then does the start apply — a
   mismatch is the same hard refusal as a build mismatch. */
async function netAcceptStart(sess,m){
  sess.startPending=true;
  try{
    const players=m.players.map(p=>({slot:p.slot,skin:p.skin||'hero',
      snap:sanitizeSnapshot(p.snap)})).sort((a,b)=>a.slot-b.slot);
    for(const p of players){
      if(p.snap.progressionVersion!==PROGRESSION_VERSION||p.snap.economyVersion!==ECONOMY_VERSION){
        sess.status='mismatch'; return;
      }
    }
    const digest=await rosterDigest(players);
    if(!m.pdigest||digest!==m.pdigest){ sess.status='mismatch'; return; }
    if(sess!==NET||sess.started)return;
    sess.players=players;
    sess.myIdx=netSlotIdx(sess,sess.mySlot);
    if(sess.myIdx<0){ sess.status='mismatch'; return; }
    sess.seed=m.seed>>>0;
    sess.runId=(typeof m.runId==='string'&&m.runId)?m.runId:null;
    sess.pickerSlot=netPickerSlot(sess);
    sess.status='starting'; sess.startAt=performance.now()+1200;
  }finally{ sess.startPending=false; }
}
async function hostStartRun(){
  const sess=NET;
  if(!sess||sess.role!=='host'||sess.started)return;
  const slots=Object.keys(sess.lobby).map(Number).sort((a,b)=>a-b);
  if(slots.length<2||slots.length>4)return;
  sess.players=slots.map(sl=>({slot:sl,skin:sess.lobby[sl].skin,snap:sess.lobby[sl].snap}));
  sess.myIdx=0;
  sess.seed=(((Date.now()^((performance.now()*1000)|0))>>>0)||0x51A7E);
  sess.runId=newRunId();   // M3: the party's shared run id (host-generated)
  sess.pickerSlot=netPickerSlot(sess);
  const pdigest=await rosterDigest(sess.players);
  if(sess!==NET||sess.started)return;
  sess.send({type:'start',seed:sess.seed,build:CFG.net.build,players:sess.players,pdigest,runId:sess.runId});
  sess.status='starting'; sess.startAt=performance.now()+1200;
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
  const sess=NET; if(!sess||sess.desync||!sess.players)return;
  const mine=sess.hashMine[t]; if(!mine)return;
  for(const p of sess.players){
    if(p.slot===sess.mySlot)continue;
    if(sess.removed[p.slot]!=null)continue;
    if(sess.droppedSlots[p.slot])return;      // resync resets hashes anyway
    const th=sess.hashTheirs[t+':'+p.slot];
    if(!th)return;                            // still waiting on this peer
    if(th!==mine){
      sess.desync=true; sess.active=false; sess.status='desync';
      try{ sess.send({type:'bye'}); }catch(e){}
      openCoop(); return;
    }
  }
}
function netSample(){
  const sess=NET; if(!sess||!sess.active||sess.dropped)return;
  /* The picker is derived live: downed state changes inside sim steps,
     with no net event to mirror it on (removals have one; downs don't). */
  sess.pickerSlot=netPickerSlot(sess);
  const recs=sess.recs[sess.myIdx];
  let first=true;
  while(sess.nextSend<=sess.step+CFG.net.delay){
    const t=sess.nextSend++;
    const inp=readCoopInput(first); first=false;
    const f={t,mx:Math.round(clamp(inp.mx,-1,1)*127),my:Math.round(clamp(inp.my,-1,1)*127),
      atk:inp.attack?1:0,rol:inp.roll?1:0,mag:inp.magic?1:0,
      upg:(sess.mySlot===sess.pickerSlot?inp.upgrade:-1)};
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
/* The frame a roster index contributes at tick t: a removed player's
   frames are empty by protocol rule from its removal step on. */
function netFrameFor(sess,idx,t){
  const slot=sess.players[idx].slot;
  if(sess.removed[slot]!=null&&t>=sess.removed[slot])return netEmptyFrame(t);
  return sess.recs[idx][t];
}
function applyRemovalToSim(sess,slot){
  const idx=netSlotIdx(sess,slot); if(idx<0)return;
  const h=SIM.heroes[idx]; if(!h)return;
  h.state='gone'; h.downed=true; h.hp=0; h.vx=0; h.vz=0; h.st=0;
}
function netApplyRemovalsAt(sess,t,live){
  if(!sess.players)return;
  for(const p of sess.players){
    if(sess.removed[p.slot]===t&&!sess.removedApplied[p.slot]){
      sess.removedApplied[p.slot]=1;
      applyRemovalToSim(sess,p.slot);
      if(live&&sess.players.length>2){
        sess.bannerTxt='P'+(p.slot+1)+' LEFT THE RUN';
        sess.bannerUntil=performance.now()+4000;
      }
    }
  }
}
function netStepOnce(){
  const sess=NET; if(!sess||!sess.players)return false;
  netApplyRemovalsAt(sess,sess.step,true);
  const list=[];
  for(let i=0;i<sess.players.length;i++){
    const f=netFrameFor(sess,i,sess.step);
    if(!f)return false;
    list.push(netFrameInput(f));
  }
  simStep({list});
  sess.step++;
  sess.lastStepAt=performance.now();
  if(sess.step%CFG.net.checkpoint===0){
    const h=simDigest(SIM);
    sess.hashMine[sess.step]=h;
    sess.send({type:'hash',tick:sess.step,h,rm:netRemovedList(sess)});
    netCheckDesync(sess.step);
  }
  return true;
}
function netFrame(now,dt){
  const sess=NET; if(!sess)return;
  if(sess.desync||sess.partnerLeft||sess.removedSelf)return;   // frozen end states
  if(sess.startAt){
    if(now<sess.startAt)return;
    sess.startAt=0; startCoopRun(sess.seed);
  }
  if(!sess.active)return;
  netDropTick(now);
  if(sess.dropped){ sess.acc=0; netReconnectTick(now); return; }
  /* Wall-clock pacing (2026-11-14): steps are BOUGHT with real time at
     STEP_HZ per second, exactly like the solo accumulator in frame().
     The old interleaved sample/step loop was gated only by input-frame
     availability, and the gate fed itself — each peer's sampler refills
     the delay runway, so one rAF advanced as many steps as the link
     allowed (~178 steps/s measured at matched 60 Hz pages, >=5x on
     Matt's phones over the real relay). Sampling still runs every
     frame so the runway stays full; a step runs only when the clock
     has paid for it; unpaid time is capped at 0.25 s so a stalled
     frame catches up a bounded amount but the game can NEVER run
     faster than the clock. */
  sess.acc=Math.min(0.25,(sess.acc||0)+(dt||0));
  netSample();
  while(sess.acc>=PACE_DT){
    if(!netStepOnce())break;
    sess.acc-=PACE_DT;
  }
}
/* Per-slot grace bookkeeping for 3–4 player runs: when a dropped slot's
   resume window lapses (or it left cleanly), the remaining players
   negotiate the removal step. */
function netDropTick(now){
  const sess=NET; if(!sess||!sess.players||sess.players.length<=2)return;
  for(const k of Object.keys(sess.droppedSlots)){
    const slot=+k;
    if(sess.removed[slot]!=null){ delete sess.droppedSlots[k]; continue; }
    const d=sess.droppedSlots[k];
    if(sess.ws&&!sess.dropped&&(d.bye||now-d.at>NET_GRACE_MS))netStartDrop(sess,slot);
  }
}
function netFirstMissing(sess,slot){
  const idx=netSlotIdx(sess,slot); if(idx<0)return sess.step;
  const r=sess.recs[idx]; let t=0; while(r[t])t++;
  return t;
}
function netStartDrop(sess,slot){
  if(sess.removed[slot]!=null)return;
  if(sess.pendingDrop){ if(sess.pendingDrop.slot!==slot)return; }
  else{
    sess.pendingDrop={slot,reports:{}};
    sess.pendingDrop.reports[sess.mySlot]=netFirstMissing(sess,slot);
    sess.send({type:'drop',slot,fm:sess.pendingDrop.reports[sess.mySlot]});
  }
  netTryFinishDrop(sess);
}
function netTryFinishDrop(sess){
  const pd=sess.pendingDrop; if(!pd)return;
  /* Participants: everyone still in the run except the dropped slot —
     connected, not removed, and not dropped themselves. Their
     first-missing steps are identical by construction (the relay fans
     every frame out to all of them); R is the min for safety. */
  const need=sess.players.filter(p=>p.slot!==pd.slot&&
    sess.removed[p.slot]==null&&!sess.droppedSlots[p.slot]&&
    !(p.slot===sess.mySlot&&sess.dropped)).map(p=>p.slot);
  if(!need.length)return;
  for(const sl of need)if(typeof pd.reports[sl]!=='number')return;
  let R=Infinity; for(const sl of need)R=Math.min(R,pd.reports[sl]);
  sess.removed[pd.slot]=R;
  sess.pendingDrop=null;
  delete sess.droppedSlots[pd.slot];
  sess.pickerSlot=netPickerSlot(sess);
  sess.send({type:'dropFinal',slot:pd.slot,step:R});
}
function netReconnectTick(now){
  const sess=NET; if(!sess||!sess.dropped)return;
  if(now-sess.dropAt>NET_GRACE_MS){
    /* My own window lapsed (2P: the partner's did) — the run is over
       for this client; in a 3–4P room the party removes my hero and
       plays on without me. */
    sess.partnerLeft=true; sess.dropped=false; sess.status='left';
    sess.selfLeft=!!(sess.players&&sess.players.length>2);
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
  const w=sess.execWait; if(!w||!sess.players)return;
  const need=sess.players.filter(p=>sess.removed[p.slot]==null&&
    !sess.droppedSlots[p.slot]).map(p=>p.slot);
  if(!need.length)return;
  for(const sl of need)if(typeof w.reports[sl]!=='number')return;
  let T=Infinity; for(const sl of need)T=Math.min(T,w.reports[sl]);
  sess.execWait=null;
  netResync(sess,T);
}
function netResync(sess,T){
  const seed=sess.seed, players=sess.players;
  SIM=newSim(seed>>>0,players.length); SIM.phase='play';
  players.forEach((p,i)=>{ const h=SIM.heroes[i];
    h.mods=netPlayerBlock(p);
    h.maxHp=CFG.hero.hp+h.mods.hp; h.hp=h.maxHp; h.heroId=safeHero(p.skin); });
  SIM.mods=netPlayerBlock(players[0]);
  HERO_SKINS=players.map(p=>p.skin); LOCAL_IDX=sess.myIdx;
  sess.removedApplied={};
  for(let t=0;t<T;t++){
    netApplyRemovalsAt(sess,t,false);
    const list=[]; let ok=true;
    for(let i=0;i<players.length;i++){
      const f=netFrameFor(sess,i,t);
      if(!f){ ok=false; break; }
      list.push(netFrameInput(f));
    }
    if(!ok)break;
    simStep({list});
  }
  EV.length=0;                                   // replay is silent
  /* trim everything past T, re-run the delay runway on empty frames */
  for(let i=0;i<players.length;i++){
    const r=sess.recs[i];
    for(const k of Object.keys(r))if(+k>=T)delete r[k];
  }
  for(let t=0;t<CFG.net.delay;t++)
    for(let i=0;i<players.length;i++)sess.recs[i][T+t]=netEmptyFrame(T+t);
  sess.step=T; sess.acc=0; sess.nextSend=T+CFG.net.delay;
  sess.hashMine={}; sess.hashTheirs={};
  sess.dropped=false; sess.droppedSlots={}; sess.pendingDrop=null;
  sess.lastStepAt=performance.now(); sess.status='playing';
  buildMapMeshes(SIM);
  closeCoop();
}
function startCoopRun(seed){
  if(hselOpen)closeHeroSelect();   // defensive: picker is closed before the lobby anyway
  const sess=NET; if(!sess||!sess.players)return;
  SIM=newSim(seed>>>0,sess.players.length); SIM.phase='play';
  sess.players.forEach((p,i)=>{ const h=SIM.heroes[i];
    h.mods=netPlayerBlock(p);
    h.maxHp=CFG.hero.hp+h.mods.hp; h.hp=h.maxHp; h.heroId=safeHero(p.skin); });
  SIM.mods=netPlayerBlock(sess.players[0]);
  HERO_SKINS=sess.players.map(p=>p.skin);
  LOCAL_IDX=sess.myIdx;
  SETTLED={ch:{},ended:false};
  runBegin(sess.runId,'coop',safeHero((sess.players[sess.myIdx]||{}).skin||'hero'));
  sess.step=0; sess.acc=0; sess.hashMine={}; sess.hashTheirs={};
  sess.removed={}; sess.removedApplied={}; sess.droppedSlots={};
  sess.pendingDrop=null; sess.execWait=null;
  sess.pickerSlot=netPickerSlot(sess);
  /* Keep remote frames that arrived before the local start fired — a
     peer's sampler legitimately runs one delay-window ahead of us
     (the 2P rule, now per roster index). The runway ticks themselves
     are empty frames by protocol definition. */
  for(let t=0;t<CFG.net.delay;t++)
    for(let i=0;i<sess.players.length;i++)sess.recs[i][t]=netEmptyFrame(t);
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
    SIM=newSim(0x51A7E); LOCAL_IDX=0; HERO_SKINS=[activeSkin()];
    buildMapMeshes(SIM);
  }
  closeCoop();
}
function netContinueSolo(){
  const sess=NET; if(!sess||!sess.players||sess.players.length!==2)return;
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
function rosterHTML(sess){
  const rows=[];
  const slots=sess.players? sess.players.map(p=>p.slot)
    : Object.keys(sess.lobby).map(Number).sort((a,b)=>a-b);
  for(const sl of slots){
    const snap=sess.players? sess.players.find(p=>p.slot===sl) : sess.lobby[sl];
    if(!snap)continue;
    let state='';
    if(sess.started)
      state=sess.removed[sl]!=null?' · LEFT':(sess.droppedSlots[sl]?' · RECONNECTING…':' · IN RUN');
    else state=' · READY';
    const who=snap.snap?(' · '+esc(snap.snap.displayName)+
      (snap.snap.displayName==='GUEST'?'':' · LV '+snap.snap.accountLevel)):'';
    rows.push('<div>P'+(sl+1)+' · '+esc(heroLabel(snap.skin))+who+(sl===sess.mySlot?' · YOU':'')+state+'</div>');
  }
  return rows.length?('<div class="croster">'+rows.join('')+'</div>'):'';
}
function renderCoop(){
  if(!coopOpen)return;
  const sess=NET;
  let key='menu', body='', btns=null, join=false, closeLabel='CLOSE', closeFn=null;
  const st=sess?sess.status:'menu';
  if(!sess||st==='menu'){
    key='menu';
    body='<div>Up to four blades, one arena. Host a room, or join a friend&#39;s.</div>'+
      '<div>All players need the <span class="k">same build</span> — co-op is lockstep.</div>'+
      (coopFlashMsg?'<div class="cstat">'+esc(coopFlashMsg)+'</div>':'');
    btns=[{label:'CREATE ROOM',fn:()=>{ coopFlashMsg=''; coopCreate(); }}];
    join=true; closeLabel='CLOSE'; closeFn=()=>closeCoop();
  }else if(sess.desync){
    key='desync';
    body='<div class="cstat">CONNECTION DESYNC — RUN ENDED</div>'+
      '<div>The blades drifted apart. Nothing was settled.</div>';
    btns=[{label:'END RUN',fn:()=>netTeardown(true)}];
    closeLabel='';
  }else if(sess.removedSelf){
    key='removed';
    body='<div class="cstat">YOU WERE REMOVED</div>'+
      '<div>Your slot&#39;s window lapsed while you were away, and the party continued the run without your hero.</div>';
    btns=[{label:'END RUN',fn:()=>netTeardown(true)}];
    closeLabel='';
  }else if(sess.partnerLeft){
    key='left';
    if(sess.selfLeft){
      body='<div class="cstat">CONNECTION LOST</div>'+
        '<div>Your slot&#39;s window lapsed — the party continued the run without your hero.</div>';
      btns=[{label:'END RUN',fn:()=>netTeardown(true)}];
    }else{
      body='<div class="cstat">PARTNER LEFT</div>'+
        '<div>Your partner&#39;s slot has closed. The arena keeps what you earned together.</div>';
      const lh=SIM.heroes[sess.myIdx];
      btns=[];
      if(lh&&!lh.downed)btns.push({label:'CONTINUE SOLO',fn:netContinueSolo});
      btns.push({label:'END RUN',fn:()=>netTeardown(true)});
    }
    closeLabel='';
  }else if(sess.dropped){
    const left=Math.max(0,Math.ceil((NET_GRACE_MS-(performance.now()-sess.dropAt))/1000));
    key='dropped'+left;
    body='<div class="cstat">CONNECTION LOST</div>'+
      ((sess.players&&sess.players.length>2)
        ? '<div>The sim is paused. Your slot is held for <span class="k">'+left+' s</span> — rejoining resumes the run in sync. If the window lapses, the party continues without your hero.</div>'
        : '<div>The sim is paused. Your partner&#39;s slot is held for <span class="k">'+left+' s</span> — rejoining resumes the run in sync.</div>');
    btns=[{label:'END RUN',fn:()=>netTeardown(true)}];
    closeLabel='';
  }else if(st==='mismatch'){
    key='mismatch';
    body='<div class="cstat">VERSION MISMATCH</div>'+
      '<div>All players need the same ANSUMBLADE build to play together.</div>';
    btns=[{label:'BACK',fn:()=>{ netTeardown(false); }}];
    closeLabel='CLOSE'; closeFn=()=>{ netTeardown(false); closeCoop(); };
  }else if(st==='nohost'||st==='full'||st==='failed'){
    key=st;
    body='<div class="cstat">'+(st==='nohost'?'ROOM NOT FOUND':st==='full'?'ROOM IS FULL':'CONNECTION FAILED')+'</div>'+
      '<div>Check the code and try again.</div>'+
      (st==='full'?'<div>If your party is only two, a full room can also mean the relay has not been upgraded yet — 3–4 player rooms need the current relay.</div>':'');
    btns=[{label:'BACK',fn:()=>{ netTeardown(false); }}];
    closeLabel='CLOSE'; closeFn=()=>{ netTeardown(false); closeCoop(); };
  }else if(sess.role==='host'&&!sess.started){
    const nLobby=Object.keys(sess.lobby).length;
    key='host'+st+sess.code+Object.keys(sess.lobby).sort().join(',')+(st==='starting'?'S':'');
    body='<div>Share this code with your party (2–4 players):</div>'+
      '<div class="ccode">'+esc(sess.code)+'</div>'+
      rosterHTML(sess)+
      '<div class="cstat">'+(st==='starting'?'STARTING…':st==='connecting'?'CONNECTING…':nLobby>=2?'READY — START WHEN YOUR PARTY IS SET':'WAITING FOR PLAYERS…')+'</div>';
    btns=[];
    if(nLobby>=2&&st!=='starting')btns.push({label:'START RUN · '+nLobby+' PLAYERS',fn:()=>hostStartRun()});
    closeLabel='CANCEL'; closeFn=()=>{ netTeardown(false); closeCoop(); };
  }else if(sess.role==='guest'&&!sess.started){
    key='guest'+st+sess.code+Object.keys(sess.lobby).sort().join(',')+(st==='starting'?'S':'');
    body='<div>Room <span class="k">'+esc(sess.code)+'</span></div>'+
      rosterHTML(sess)+
      '<div class="cstat">'+(st==='starting'?'PAIRED — STARTING…':st==='connecting'?'CONNECTING…':st==='waitinghost'?'WAITING FOR HOST…':'WAITING FOR HOST TO START…')+'</div>';
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
  const TAGS=['tagP1','tagP2','tagP3','tagP4'];
  const TAGCOLORS=['#ffd24a','#54e0ff','#ff7ad9','#9dff57'];
  stat.style.display=inRun?'flex':'none';
  const bn=$('netBanner');
  if(!inRun){ bn.style.display='none';
    for(const id of TAGS)$(id).style.display='none'; }
  if(ringMeshes)for(const m of ringMeshes)m.visible=false;
  if(!inRun)return;
  const dot=$('netDot'), txt=$('netTxt');
  if(sess.desync){ dot.className='bad'; txt.textContent='DESYNC'; }
  else if(sess.partnerLeft){ dot.className='bad';
    txt.textContent=(sess.players&&sess.players.length>2)?'PLAYER LEFT':'PARTNER LEFT'; }
  else if(sess.dropped){ dot.className='warn'; txt.textContent='RECONNECTING…'; }
  else{
    dot.className='';
    const parts=[];
    SIM.heroes.forEach((h,i)=>{
      if(i===sess.myIdx)return;
      const sl=(sess.players&&sess.players[i])?sess.players[i].slot:i;
      parts.push('P'+(sl+1)+((sess.removed&&sess.removed[sl]!=null)?' LEFT':
        (h.downed?' DOWN':' ♥ '+Math.max(0,Math.round(h.hp)))));
    });
    txt.textContent=parts.join(' · ');
  }
  let banner='';
  if(sess.bannerUntil&&performance.now()<sess.bannerUntil)banner=sess.bannerTxt;
  else{
    const anyDropped=sess.dropped||
      (sess.players&&sess.players.some(p=>sess.droppedSlots[p.slot]));
    const waiting=sess.active&&!anyDropped&&
      (performance.now()-sess.lastStepAt>CFG.net.stallMs)&&
      (SIM.phase==='play'||SIM.phase==='boss'||SIM.phase==='levelup'||SIM.phase==='clear');
    if(waiting)banner='WAITING FOR PLAYER…';
  }
  bn.style.display=banner?'block':'none';
  if(banner)bn.textContent=banner;
  /* hero ground rings: P1 gold, P2 cyan, P3 rose, P4 lime */
  if(!ringMeshes){
    ringMeshes=[0xffd24a,0x3fd2ff,0xff7ad9,0x9dff57].map(c=>{
      const m=new T.Mesh(new T.RingGeometry(0.52,0.68,28),
        new T.MeshBasicMaterial({color:c,transparent:true,opacity:0.85,
          depthWrite:false,side:T.DoubleSide}));
      m.rotation.x=-Math.PI/2; m.visible=false; scene.add(m); return m;
    });
  }
  if(SIM.players>1&&SIM.phase!=='title'){
    for(let i=0;i<SIM.heroes.length&&i<4;i++){
      const h=SIM.heroes[i]; if(!h)continue;
      if(h.state==='gone'){ ringMeshes[i].visible=false; continue; }
      ringMeshes[i].visible=true;
      ringMeshes[i].position.set(h.x,0.03,h.z);
    }
    for(let i=0;i<SIM.heroes.length&&i<4;i++){
      const h=SIM.heroes[i], el=$(TAGS[i]);
      if(!h||h.state==='gone'){ el.style.display='none'; continue; }
      _v.set(h.x,2.35,h.z).project(camera);
      if(_v.z<1&&Math.abs(_v.x)<1.05&&Math.abs(_v.y)<1.05){
        el.style.display='block';
        el.style.left=((_v.x*0.5+0.5)*innerWidth)+'px';
        el.style.top=((-_v.y*0.5+0.5)*innerHeight)+'px';
        el.style.color=TAGCOLORS[i];
      }else el.style.display='none';
    }
  }else{
    for(const id of TAGS)$(id).style.display='none';
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
  /* Twin chapters: the bar AGGREGATES every boss's HP (sum over sum),
     so it reads as one fight — killing one of the two ogres takes it to
     ~half instead of emptying it. The arrow tracks the nearest living
     boss. Single-boss chapters are the same numbers as before. */
  const liveBosses=s.bosses.filter(x=>x.hp>0), showBoss=liveBosses.length>0;
  const b=showBoss?liveBosses.reduce((a,c)=>
    ((c.x-h.x)*(c.x-h.x)+(c.z-h.z)*(c.z-h.z)<(a.x-h.x)*(a.x-h.x)+(a.z-h.z)*(a.z-h.z)?c:a)):null;
  $('bossWrap').classList.toggle('on',showBoss);
  if(showBoss){
    let hpSum=0,mxSum=0; for(const x of s.bosses){ hpSum+=Math.max(0,x.hp); mxSum+=x.maxHp; }
    $('bossName').textContent=BOSS_NAMES[s.chapter-1]+(s.bosses.length>1?' \u00D7 '+s.bosses.length:'');
    $('bossFill').style.width=(100*hpSum/mxSum).toFixed(1)+'%';
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
  /* hero select open: portrait framing on the preview figure (view-only;
     the follow camera resumes by its normal lerp when the picker closes) */
  if(hselOpen&&hselView){
    const p=hselView.mesh.position,k=Math.min(1,dt*6);
    camera.position.x=lerp(camera.position.x,p.x,k);
    camera.position.y=lerp(camera.position.y,1.8,k);
    camera.position.z=lerp(camera.position.z,p.z-4.4,k);
    camera.lookAt(p.x,0.55,p.z);
    return;
  }
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
/* HD shadow-follow: keep the sun — and with it the ±30 m shadow camera —
   centred on the focus character (the hero-select figure while the
   picker is open, else the local hero), snapped to 0.5 m steps so the
   shadow texels don't swim as the hero moves. The (28,46,18) offset is
   preserved exactly, so the light DIRECTION never changes: Lambert
   shading is identical wherever the rig sits, and SD never calls this. */
function updateSunFollow(){
  let fx=0,fz=0;
  if(hselOpen&&hselView){ fx=hselView.mesh.position.x; fz=hselView.mesh.position.z; }
  else{ const h=localHero(SIM); fx=h.x; fz=h.z; }
  fx=Math.round(fx*2)/2; fz=Math.round(fz*2)/2;
  sun.position.set(fx+28,46,fz+18);
  sun.target.position.set(fx,0,fz);
  sun.target.updateMatrixWorld();
}
let RTIME=0,lastNow=performance.now(),acc=0,frameCount=0,lastCalls=0;
let lastChapter=SIM.chapter,camZoom=0.86;
function frame(now){
  const dt=Math.min(0.1,(now-lastNow)/1000);lastNow=now;RTIME+=dt;
  acc+=dt;
  let steps=0;
  if(NET&&(NET.started||NET.startAt)){ netFrame(now,dt); acc=0; }
  else{ while(acc>=PACE_DT&&steps<6){simStep(readInput());acc-=PACE_DT;steps++;} }
  consumeEvents();
  const s=SIM;
  if(s.chapter!==lastChapter){lastChapter=s.chapter;buildMapMeshes(s);}
  syncViews(s,dt);
  updateHeroPreview(dt);
  updateSlashFX(s,dt); updateArrowFX(s);
  updateBolts(dt);
  updateRings(dt);
  updateWarnRings(dt,RTIME);
  updateQuakes(dt);
  syncIceShells(s);
  updatePickupMeshes(s,RTIME);
  updateVFX(dt,RTIME);
  Audio.setIntensity(Math.min(1,s.enemies.length/7+(s.boss?0.55:0)+s.chapter*0.05));
  updateCamera(dt);
  if(GFX_HIGH)updateSunFollow();
  syncOverlay(); renderArmoury(); renderCoop(); renderHeroSelect(); renderAccount(); updateNetUI();
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
  REGISTRY, SIM_CONTENT, contentSummary, HERO_ATTACK, HERO_AIM_ASSIST, HERO_STATS, HERO_SLASH_TINTS,
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
  uiRects(){ const r={}; for(const id of ['stick','btnAttack','btnRoll','btnMute','btnFs','btnGfx',
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
  setChapter(n){SIM.chapter=clamp(n|0,1,CHAPTER_COUNT);SIM.map=buildMapData(SIM.chapter);
    buildMapMeshes(SIM);lastChapter=SIM.chapter;return SIM.chapter;},
  spawnTestEnemy(type,x,z,state){const e=makeEnemy(SIM,type,x,z,0.6);
    if(state){e.state=state;e.timer=0.55;e.lockYaw=e.yaw;}return e.id;},
  clearEnemies(){SIM.enemies=[];SIM.projectiles=[];SIM.arrows=[];SIM.boss=null;},
  bossName(){return BOSS_NAMES[SIM.chapter-1];},
  clearViews(){for(const [id,v] of VIEWS){scene.remove(v.mesh);if(v.dispose)v.dispose();else v.mesh.material.dispose();}VIEWS.clear();},
  drawCalls(){return renderer.info.render.calls;},
  stopAudio(){Audio.stop();},
  get meta(){return META;},
  get net(){ const n=NET; return n?{active:n.active,role:n.role,code:n.code,step:n.step,
    started:n.started,desync:n.desync,dropped:n.dropped,partnerLeft:n.partnerLeft,
    removedSelf:n.removedSelf,selfLeft:n.selfLeft,mySlot:n.mySlot,myIdx:n.myIdx,
    pickerSlot:n.pickerSlot,removed:n.removed,
    droppedSlots:Object.keys(n.droppedSlots).map(Number),
    lobby:Object.keys(n.lobby||{}).map(Number),
    status:n.status,nextSend:n.nextSend,recs:n.recs?n.recs.map(r=>Object.keys(r).map(Number).sort((a,b)=>a-b)):null,
    players:n.players?n.players.map(p=>({slot:p.slot,skin:p.skin,snap:p.snap||null,mods:netPlayerBlock(p)})):null}:null; },
  get account(){ return {state:ACCT.state,user:ACCT.user,profile:ACCT.profile,
    block:Object.assign({},ACCT.block),notice:ACCT.notice,stale:ACCT.stale,
    scope:ACCT.scope,serverProgression:serverProgression(),runSaveFailed:ACCT.runSaveFailed,
    run:RUN?{id:RUN.id,mode:RUN.mode,eliteKills:RUN.eliteKills,pending:RUN.pending.map(p=>p.stage)}:null}; },
  accountBoot(){ return acctBoot(); },
  accountLogout(){ return acctLogout(); },
  netCreate(code){ return coopCreate(code); },
  netStart(){ hostStartRun(); },
  netDrop(){ const n=NET; if(n&&n.ws){ const w=n.ws; n.ws=null;
    try{ w.close(); }catch(e){} netOnSocketDown(n); } },
  netHold(v){ if(NET)NET.holdReconnect=!!v; },
  get netHashes(){ const n=NET; if(!n)return null;
    const mt=Object.keys(n.hashMine).map(Number);
    const last=mt.length?Math.max(...mt):0;
    const bySlot={};
    if(n.players)for(const p of n.players){
      if(p.slot===n.mySlot)continue;
      bySlot[p.slot]=n.hashTheirs[last+':'+p.slot]||null;
    }
    const otherP=n.players?n.players.find(p=>p.slot!==n.mySlot):null;
    const other=otherP?otherP.slot:null;
    return {mine:mt.length,theirs:Object.keys(n.hashTheirs).length,
      lastMine:last?n.hashMine[last]:null,
      lastTheirs:other!=null?bySlot[other]:null,bySlot,last}; },
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

/* kick off — title screen first; START is a real pointer/keyboard action.
   Account boot rides along: a stored session re-fetches its profile in
   the background and the landing chip updates when it lands; play is
   never blocked on it. */
acctBoot();
requestAnimationFrame(frame);
})();



/* -- phase-1 module glue (the ONLY edit vs the single-file build) --
   src/main.js loads this file as an ES module; the IIFE above is untouched. */
export {};
