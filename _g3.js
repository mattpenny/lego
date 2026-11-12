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
const amb  = new T.AmbientLight(0xffffff,0.22);
scene.add(hemi,sun,amb);

const dummy = new T.Object3D();
const _v = new T.Vector3();
let mapGroup = new T.Group(); scene.add(mapGroup);
let skyMesh=null, groundMesh=null;

/* ---------- procedural ground texture ---------- */
function groundTexture(ch){
  const P=PALETTES[ch-1], R=mkRng(4400+ch*313);
  const c=document.createElement('canvas'); c.width=c.height=512;
  const g=c.getContext('2d');
  g.fillStyle=P.ground; g.fillRect(0,0,512,512);
  // mottling
  for(let i=0;i<1500;i++){
    const x=R()*512,y=R()*512,r=2+R()*15;
    g.fillStyle=R()<0.5?P.ground2:'rgba(0,0,0,0.055)';
    g.globalAlpha=0.10+R()*0.16;
    g.beginPath();g.ellipse(x,y,r,r*(0.5+R()*0.7),R()*3,0,TAU);g.fill();
  }
  g.globalAlpha=1;
  // winding path
  g.lineCap='round';g.lineJoin='round';
  g.strokeStyle=P.path;g.globalAlpha=0.78;g.lineWidth=44;
  g.beginPath();g.moveTo(-30,410);
  g.bezierCurveTo(120,360,150,250,250,250);
  g.bezierCurveTo(360,250,360,120,540,60);g.stroke();
  g.globalAlpha=0.30;g.lineWidth=20;g.strokeStyle='rgba(255,255,255,.25)';g.stroke();
  g.globalAlpha=1;
  // speckles / cracks
  for(let i=0;i<900;i++){
    const x=R()*512,y=R()*512;
    g.fillStyle=ch===3&&R()<0.35?'rgba(255,110,40,.45)':R()<0.5?'rgba(255,255,255,.10)':'rgba(0,0,0,.14)';
    g.fillRect(x,y,1+R()*3,1+R()*2);
  }
  if(ch===3){
    g.strokeStyle='rgba(255,105,35,.55)';g.lineWidth=2;g.globalAlpha=.8;
    for(let i=0;i<26;i++){
      const x=R()*512,y=R()*512;g.beginPath();g.moveTo(x,y);
      for(let k=0;k<4;k++)g.lineTo(x+(R()-0.5)*70,y+(R()-0.5)*70);g.stroke();
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
  const P=PALETTES[ch-1];
  scene.background=new T.Color(P.sky);
  scene.fog=new T.Fog(P.fog,48,150);
  hemi.color.setHex(P.hemi); hemi.intensity=P.amb;
  sun.color.setHex(P.light); sun.intensity=ch===3?1.05:1.25;
  if(!skyMesh){
    const g=new T.SphereGeometry(190,16,12);
    const cols=[]; const pos=g.getAttribute('position');
    for(let i=0;i<pos.count;i++){
      const y=pos.getY(i)/190;
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
    const y=skyMesh.geometry.getAttribute('position').getY(i)/190;
    const t=clamp((y+0.25)/1.1,0,1);
    col.setXYZ(i,lerp(low.r*0.55,top.r*0.42,t),lerp(low.g*0.55,top.g*0.42,t),lerp(low.b*0.55,top.b*0.42,t));
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
  const ch=sim.chapter,P=PALETTES[ch-1],d=sim.map;
  setSky(ch);
  const gt=groundTexture(ch);
  groundMesh=new T.Mesh(new T.PlaneGeometry(150,150),new T.MeshLambertMaterial({map:gt}));
  groundMesh.rotation.x=-Math.PI/2; groundMesh.position.y=-0.02;
  mapGroup.add(groundMesh);
  // pond
  const pond=new T.Mesh(new T.CircleGeometry(d.pond.r,28),
    new T.MeshLambertMaterial({color:P.pond,transparent:true,opacity:ch===3?0.92:0.82,
      emissive:ch===3?0xff4a10:0x000000,emissiveIntensity:ch===3?0.7:0}));
  pond.rotation.x=-Math.PI/2; pond.position.set(d.pond.x,0.015,d.pond.z);
  mapGroup.add(pond);
  const rim=new T.Mesh(new T.RingGeometry(d.pond.r,d.pond.r+0.35,28),
    new T.MeshLambertMaterial({color:ch===3?0x3a2420:0x4a5140,side:T.DoubleSide}));
  rim.rotation.x=-Math.PI/2;rim.position.set(d.pond.x,0.02,d.pond.z);mapGroup.add(rim);

  const cTree=new T.Color(P.tree),cTrunk=new T.Color(P.trunk),
        cRock=new T.Color(P.rock),cHill=new T.Color(P.hill);
  // tree trunks
  inst(new T.CylinderGeometry(0.5,0.62,1,6),MAT(0xffffff),d.trunk,(o,p)=>{
    o.position.set(p.x,1.55*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(0.55*p.s,3.1*p.s,0.55*p.s);
  },()=>cTrunk);
  // canopies / dead branches / burnt crowns
  inst(new T.ConeGeometry(0.5,1,7),MAT(0xffffff),d.canopy,(o,p)=>{
    const dead=p.kind===1, burnt=p.kind===2;
    // Canopy lifted so the hero can walk UNDER the leaves up to the trunk.
    o.position.set(p.x,(dead?3.4:4.4)*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set((dead?1.5:2.5)*p.s,(dead?1.6:3.2)*p.s,(dead?1.5:2.5)*p.s);
  },p=>p.kind===2?new T.Color(0x30201e):(p.kind===1?new T.Color(0x354034):cTree));
  // rocks
  inst(new T.DodecahedronGeometry(0.5,0),MAT(0xffffff),d.rock,(o,p)=>{
    o.position.set(p.x,0.46*p.s,p.z);o.rotation.set(p.rot*0.2,p.rot,p.rot*0.3);
    o.scale.set(1.7*p.s,1.1*p.s,1.5*p.s);
  },()=>cRock);
  // pillars (physical blockers)
  inst(new T.CylinderGeometry(0.5,0.55,1,8),MAT(0xffffff),d.pillar,(o,p)=>{
    o.position.set(p.x,1.7*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(1.05*p.s,3.4*p.s,1.05*p.s);
  },()=>cRock);
  // fence posts + rails
  inst(new T.BoxGeometry(1,1,1),MAT(ch===2?0x30363a:0x6a5236),d.post,(o,p)=>{
    o.position.set(p.x,0.55*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(0.18,1.1*p.s,0.18);
  });
  inst(new T.BoxGeometry(1,1,1),MAT(ch===2?0x343a3e:0x70583a),d.post,(o,p)=>{
    o.position.set(p.x,0.80*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(0.09,0.09,1.5);
  });
  // gravestones
  inst(new T.BoxGeometry(1,1,1),MAT(0x737a74),d.stone,(o,p)=>{
    o.position.set(p.x,0.42*p.s,p.z);o.rotation.set(0,p.rot,0);
    o.scale.set(0.62*p.s,0.85*p.s,0.17*p.s);
  });
  // mountains / hills — the VISIBLE edge of the map
  inst(new T.DodecahedronGeometry(0.5,0),MAT(0xffffff),d.hill,(o,p)=>{
    o.position.set(p.x,p.s*0.32,p.z);o.rotation.set(0.15,p.rot,0.1);
    o.scale.set(p.s,p.s*1.35,p.s*0.85);
  },()=>cHill);
  // landmark blocks
  inst(new T.BoxGeometry(1,1,1),MAT(ch===3?0x3a2b2c:0x6d6a5c),d.block,(o,p)=>{
    let sx=3,sy=7,sz=3,y=3.5;
    if(p.kind===1){sx=2.2;sy=2.0;sz=2.2;y=1.0;}
    if(p.kind===2){sx=5;sy=3.2;sz=4;y=1.6;}
    if(p.kind===3){sx=0.8;sy=2.3;sz=0.8;y=1.15;}
    if(p.kind===4){sx=5.4;sy=5.0;sz=1.3;y=2.5;}
    if(p.kind===5){sx=7;sy=10;sz=7;y=5;}
    o.position.set(p.x,y,p.z);o.rotation.set(0,p.rot,0);o.scale.set(sx,sy,sz);
  });
  // torches / braziers
  inst(new T.CylinderGeometry(0.5,0.5,1,6),MAT(0x3a2c26),d.torch,(o,p)=>{
    o.position.set(p.x,0.8*p.s,p.z);o.rotation.set(0,0,0);o.scale.set(0.18,1.6*p.s,0.18);
  });
  inst(new T.SphereGeometry(0.5,7,5),
    new T.MeshBasicMaterial({color:ch===3?0xff7a28:0xffc46a}),d.torch,(o,p)=>{
    o.position.set(p.x,1.65*p.s,p.z);o.rotation.set(0,0,0);o.scale.setScalar(0.38*p.s);
  });
  // lava pools
  inst(new T.CircleGeometry(1,14),new T.MeshBasicMaterial({color:0xff5a18,transparent:true,opacity:.9,
    side:T.DoubleSide,depthWrite:false}),d.lava,(o,p)=>{
    o.position.set(p.x,0.03,p.z);o.rotation.set(-Math.PI/2,0,p.rot);o.scale.setScalar(p.s);
  });
  // pond reeds
  inst(new T.ConeGeometry(0.5,1,5),MAT(ch===1?0x4b7a3c:0x4a5a48),d.reeds,(o,p)=>{
    o.position.set(p.x,0.42*p.s,p.z);o.rotation.set(0,p.rot,0);o.scale.set(0.25,0.9*p.s,0.25);
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
const TINTS={
  /* hero = blue lion knight: cobalt plastic, gold trim, silver steel, red cape */
  hero:   {armor:[0.030,0.100,0.420],trim:[0.720,0.420,0.055],metal:[0.460,0.500,0.560],
           cloth:[0.400,0.020,0.025],skin:[0.950,0.720,0.100],blade:[0.660,0.700,0.780],
           dark:[0.100,0.110,0.140],glow:[0.350,0.700,1.000]},
  brute:  {armor:[0.36,0.13,0.09],trim:[0.20,0.08,0.06],cloth:[0.27,0.10,0.07],
           skin:[0.92,0.58,0.16],blade:[0.48,0.27,0.21],dark:[0.15,0.07,0.06],glow:[0.85,0.25,0.12]},
  runner: {armor:[0.22,0.31,0.25],trim:[0.15,0.21,0.17],cloth:[0.17,0.24,0.20],
           skin:[0.72,0.86,0.40],blade:[0.52,0.58,0.50],dark:[0.09,0.13,0.11],glow:[0.55,0.82,0.42]},
  ranger: {armor:[0.30,0.15,0.47],trim:[0.18,0.09,0.30],cloth:[0.22,0.10,0.36],
           skin:[0.82,0.70,0.98],blade:[0.62,0.40,0.82],dark:[0.11,0.06,0.18],glow:[0.78,0.36,1.00]},
  /* --- wave additions: kettle-helm soldier, hooded archer, robed caster, plate knight --- */
  soldier:{armor:[0.200,0.205,0.215],trim:[0.330,0.345,0.365],cloth:[0.420,0.030,0.030],
           skin:[0.960,0.780,0.160],blade:[0.520,0.560,0.600],dark:[0.080,0.080,0.090],
           glow:[1.000,0.450,0.180]},
  archer: {armor:[0.200,0.110,0.050],trim:[0.440,0.290,0.120],cloth:[0.090,0.215,0.110],
           skin:[0.950,0.760,0.140],blade:[0.310,0.200,0.075],dark:[0.070,0.055,0.035],
           glow:[0.300,0.900,0.350]},
  sorcerer:{armor:[0.045,0.035,0.060],trim:[0.300,0.280,0.360],cloth:[0.120,0.060,0.220],
           skin:[0.720,0.680,0.620],blade:[0.180,0.120,0.070],dark:[0.020,0.020,0.030],
           glow:[0.650,0.300,1.000]},
  knight: {armor:[0.300,0.320,0.350],trim:[0.620,0.420,0.100],cloth:[0.320,0.030,0.040],
           skin:[0.920,0.750,0.150],blade:[0.700,0.740,0.800],dark:[0.090,0.090,0.100],
           glow:[0.950,0.800,0.400]},
  /* boss = blackened plate with silver scrollwork, maroon cape, ember glow */
  boss:   {armor:[0.035,0.033,0.032],trim:[0.240,0.245,0.260],metal:[0.300,0.310,0.330],
           cloth:[0.170,0.015,0.020],skin:[0.900,0.680,0.100],blade:[0.025,0.025,0.030],
           dark:[0.012,0.012,0.015],glow:[0.950,0.200,0.050]}
};
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
function rigParts(kind){
  const c=TINTS[kind], P=[];
  const add=(j,g,off,sc,col,rot)=>P.push({j,g,o:off,s:sc,c:col,r:rot||[0,0,0]});
  const INK=[0.05,0.05,0.07];

  /* ===================================================================
     HERO — the blue lion knight: silver helmet with a red horsehair
     crest, cobalt torso/legs printed with a gold lion, red cape, round
     shield and a straight silver sword. Same bricks and same 13 joints,
     so every existing clip still drives it unchanged.
     =================================================================== */
  if(kind==='hero'){
    /* ---- hips: cobalt pelvis, dark sockets ---- */
    add(0,'box',[0, 0.01,0],[0.58,0.22,0.34],c.armor);
    add(0,'box',[0,-0.12,0],[0.50,0.09,0.29],c.dark);
    add(0,'cyl12',[ 0.25,-0.02,0],[0.09,0.07,0.09],c.dark,[0,0,Math.PI/2]);
    add(0,'cyl12',[-0.25,-0.02,0],[0.09,0.07,0.09],c.dark,[0,0,Math.PI/2]);

    /* ---- torso: cobalt bricks, silver collar and belt, gold lion ---- */
    add(1,'box',[0, 0.10,0],[0.60,0.28,0.38],c.armor);
    add(1,'box',[0, 0.36,0],[0.84,0.30,0.44],c.armor);
    add(1,'box',[0, 0.535,0],[0.90,0.06,0.46],c.metal);         // collar plate
    add(1,'box',[0,-0.020,0],[0.62,0.085,0.40],c.metal);        // belt
    add(1,'box',[0,-0.020,0.212],[0.15,0.075,0.03],c.trim);     // buckle
    add(1,'box',[0, 0.290,0.228],[0.44,0.320,0.02],c.armor);    // print panel
    /* gold lion rampant: body, head, foreleg, hind leg, upright tail */
    add(1,'box',[ 0.000,0.300,0.248],[0.200,0.150,0.02],c.trim);
    add(1,'box',[ 0.070,0.400,0.248],[0.100,0.100,0.02],c.trim);
    add(1,'box',[ 0.050,0.195,0.248],[0.050,0.140,0.02],c.trim);
    add(1,'box',[-0.060,0.200,0.248],[0.050,0.120,0.02],c.trim);
    add(1,'box',[-0.095,0.360,0.248],[0.030,0.080,0.02],c.trim);
    add(1,'box',[0, 0.18,-0.235],[0.56,0.74,0.05],c.cloth,[0.10,0,0]); // cape
    add(1,'cyl12',[0,0.575,0],[0.30,0.08,0.30],c.skin);         // neck

    /* ---- head: yellow face under a domed silver helm with a red crest ---- */
    add(2,'cyl12',[0, 0.13,0],[0.66,0.44,0.66],c.skin);
    add(2,'box',[ 0.115,0.145,0.300],[0.075,0.075,0.03],INK);   // eyes
    add(2,'box',[-0.115,0.145,0.300],[0.075,0.075,0.03],INK);
    add(2,'box',[0, 0.030,0.336],[0.150,0.026,0.02],INK);       // smile
    add(2,'box',[ 0.085,0.053,0.336],[0.030,0.026,0.02],INK);
    add(2,'box',[-0.085,0.053,0.336],[0.030,0.026,0.02],INK);
    add(2,'cyl12',[0, 0.280,0],[0.69,0.160,0.69],c.metal);      // helm skirt
    add(2,'sph',[0, 0.380,0],[0.69,0.300,0.69],c.metal);        // helm crown
    add(2,'cyl12',[0, 0.196,0],[0.72,0.055,0.72],c.metal);      // brim
    add(2,'box',[0, 0.040,-0.322],[0.46,0.140,0.055],c.metal);  // neck guard
    /* red crest, front to back */
    add(2,'box',[0, 0.600,0.070],[0.095,0.190,0.290],c.cloth,[0.25,0,0]);
    add(2,'box',[0, 0.685,-0.055],[0.095,0.210,0.200],c.cloth,[0.75,0,0]);
    add(2,'box',[0, 0.640,-0.215],[0.095,0.230,0.150],c.cloth,[1.25,0,0]);
    add(2,'box',[0, 0.490,-0.320],[0.085,0.210,0.120],c.cloth,[1.60,0,0]);

    /* ---- left arm: cobalt sleeve, round shield with gold lion ---- */
    add(3,'cyl12',[0, 0.03,0],[0.36,0.18,0.36],c.armor);        // pauldron
    add(3,'box',[0,-0.20,0],[0.22,0.44,0.24],c.armor);
    add(4,'box',[0,-0.17,0],[0.20,0.34,0.22],c.armor);
    add(5,'cyl12',[0,-0.04,0],[0.26,0.12,0.26],c.skin,[Math.PI/2,0,0]);
    add(5,'box',[0,-0.12,0.05],[0.10,0.11,0.14],c.skin);        // fingers
    /* shield: gold rim, cobalt field, gold lion, centre boss */
    add(5,'cyl12',[0.05,-0.140,0.160],[0.72,0.090,0.72],c.trim,[Math.PI/2,0,0]);
    add(5,'cyl12',[0.05,-0.140,0.196],[0.60,0.090,0.60],c.armor,[Math.PI/2,0,0]);
    add(5,'box',[ 0.100,-0.140,0.245],[0.15,0.115,0.02],c.trim);
    add(5,'box',[ 0.162,-0.053,0.245],[0.07,0.070,0.02],c.trim);
    add(5,'box',[ 0.142,-0.225,0.245],[0.04,0.100,0.02],c.trim);
    add(5,'box',[ 0.048,-0.215,0.245],[0.04,0.085,0.02],c.trim);
    add(5,'cyl12',[0.05,-0.140,0.246],[0.09,0.03,0.09],c.metal,[Math.PI/2,0,0]);

    /* ---- right arm: cobalt sleeve, straight silver sword ---- */
    add(6,'cyl12',[0, 0.03,0],[0.36,0.18,0.36],c.armor);
    add(6,'box',[0,-0.20,0],[0.22,0.44,0.24],c.armor);
    add(7,'box',[0,-0.17,0],[0.20,0.34,0.22],c.armor);
    add(8,'cyl12',[0,-0.04,0],[0.26,0.12,0.26],c.skin,[Math.PI/2,0,0]);
    add(8,'box',[0,-0.12,0.05],[0.10,0.11,0.14],c.skin);
    add(8,'cyl',[0,-0.030,0],[0.10,0.24,0.10],c.dark);          // grip
    add(8,'cyl12',[0,-0.170,0],[0.11,0.05,0.11],c.trim);        // pommel collar
    add(8,'box',[0,-0.190,0],[0.44,0.070,0.13],c.trim);         // crossguard
    add(8,'box',[0,-0.450,0],[0.16,0.500,0.05],c.blade);        // blade
    add(8,'cone',[0,-0.745,0],[0.16,0.130,0.05],c.blade,[Math.PI,0,0]);
    add(8,'box',[0,-0.450,0.028],[0.03,0.460,0.012],c.dark);    // fuller

    /* ---- legs: cobalt thigh/shin/foot, dark knee joint ---- */
    add(9, 'box',[0,-0.23,0],[0.30,0.50,0.34],c.armor);
    add(10,'box',[0,-0.20,0],[0.27,0.42,0.31],c.armor);
    add(10,'box',[0,-0.42,0.09],[0.31,0.15,0.46],c.armor);
    add(11,'box',[0,-0.23,0],[0.30,0.50,0.34],c.armor);
    add(12,'box',[0,-0.20,0],[0.27,0.42,0.31],c.armor);
    add(12,'box',[0,-0.42,0.09],[0.31,0.15,0.46],c.armor);

    return P;
  }

  /* ===================================================================
     BOSS — the horned black knight: blackened plate with silver
     scrollwork, yellow face under an angular helm, swept horns, maroon
     cape and a jagged greatsword.
     =================================================================== */
  if(kind==='boss'){
    /* ---- hips: plate skirt with a small skull buckle ---- */
    add(0,'box',[0, 0.01,0],[0.60,0.24,0.36],c.armor);
    add(0,'box',[0,-0.110,0],[0.54,0.10,0.31],c.trim);
    add(0,'box',[0, 0.020,0.190],[0.22,0.150,0.03],c.trim);
    add(0,'box',[ 0.055,0.045,0.208],[0.05,0.045,0.02],c.dark);
    add(0,'box',[-0.055,0.045,0.208],[0.05,0.045,0.02],c.dark);

    /* ---- torso: layered black plate, silver trim, skull breastplate ---- */
    add(1,'box',[0, 0.10,0],[0.62,0.30,0.40],c.armor);
    add(1,'box',[0, 0.36,0],[0.86,0.32,0.46],c.armor);
    add(1,'box',[0, 0.535,0],[0.92,0.07,0.48],c.trim);          // collar
    add(1,'box',[0, 0.30,0.233],[0.46,0.28,0.02],c.dark);       // inset
    add(1,'box',[ 0.150,0.335,0.244],[0.05,0.22,0.02],c.trim,[0,0, 0.30]);
    add(1,'box',[-0.150,0.335,0.244],[0.05,0.22,0.02],c.trim,[0,0,-0.30]);
    add(1,'box',[0, 0.300,0.250],[0.17,0.140,0.03],c.trim);     // skull
    add(1,'box',[ 0.042,0.318,0.268],[0.05,0.05,0.02],c.dark);
    add(1,'box',[-0.042,0.318,0.268],[0.05,0.05,0.02],c.dark);
    add(1,'box',[0, 0.235,0.266],[0.10,0.035,0.02],c.dark);     // jaw line
    add(1,'box',[0, 0.18,-0.238],[0.58,0.76,0.05],c.cloth,[0.10,0,0]); // cape
    add(1,'cyl12',[0,0.575,0],[0.30,0.08,0.30],c.skin);         // neck

    /* ---- head: yellow face, black helm, swept horns ---- */
    add(2,'cyl12',[0, 0.13,0],[0.66,0.44,0.66],c.skin);
    add(2,'box',[ 0.115,0.150,0.305],[0.085,0.060,0.03],INK);   // eyes
    add(2,'box',[-0.115,0.150,0.305],[0.085,0.060,0.03],INK);
    add(2,'box',[ 0.120,0.208,0.307],[0.150,0.034,0.03],INK,[0,0,-0.42]); // angry brow
    add(2,'box',[-0.120,0.208,0.307],[0.150,0.034,0.03],INK,[0,0, 0.42]);
    add(2,'box',[0, 0.018,0.305],[0.130,0.030,0.02],INK);       // frown
    add(2,'box',[ 0.072,0.036,0.305],[0.030,0.030,0.02],INK);
    add(2,'box',[-0.072,0.036,0.305],[0.030,0.030,0.02],INK);
    add(2,'box',[0, 0.420,0.000],[0.76,0.230,0.76],c.armor);    // crown
    add(2,'box',[0, 0.240,-0.250],[0.72,0.300,0.30],c.armor);   // back of helm
    add(2,'box',[0, 0.250,0.300],[0.74,0.100,0.12],c.armor);    // brow band
    add(2,'box',[0, 0.340,0.315],[0.20,0.220,0.05],c.trim);     // nasal ridge
    add(2,'box',[ 0.330,0.090,0.020],[0.060,0.280,0.340],c.armor); // cheek plates
    add(2,'box',[-0.330,0.090,0.020],[0.060,0.280,0.340],c.armor);
    add(2,'box',[ 0.335,0.135,0.315],[0.050,0.300,0.030],c.trim);   // face frame
    add(2,'box',[-0.335,0.135,0.315],[0.050,0.300,0.030],c.trim);
    add(2,'box',[0, 0.270,0.315],[0.72,0.050,0.030],c.trim);
    add(2,'cone',[ 0.330,0.470,0.020],[0.26,0.40,0.26],c.armor,[0,0,-0.45]); // horns
    add(2,'cone',[ 0.455,0.690,0.000],[0.20,0.32,0.20],c.armor,[0,0,-0.75]);
    add(2,'cone',[ 0.600,0.860,-0.030],[0.15,0.26,0.15],c.armor,[0,0,-0.15]);
    add(2,'cone',[-0.330,0.470,0.020],[0.26,0.40,0.26],c.armor,[0,0, 0.45]);
    add(2,'cone',[-0.455,0.690,0.000],[0.20,0.32,0.20],c.armor,[0,0, 0.75]);
    add(2,'cone',[-0.600,0.860,-0.030],[0.15,0.26,0.15],c.armor,[0,0, 0.15]);

    /* ---- left arm: spiked pauldron, plate, bare C-clamp hand ---- */
    add(3,'cyl12',[0, 0.05,0],[0.40,0.24,0.40],c.armor);
    add(3,'box',[0, 0.14,0],[0.46,0.08,0.46],c.trim);           // pauldron rim
    add(3,'cone',[ 0.20,0.24,0.00],[0.10,0.26,0.10],c.trim,[0,0,-0.55]);
    add(3,'cone',[ 0.08,0.26,-0.16],[0.09,0.22,0.09],c.trim,[0.45,0,-0.25]);
    add(3,'box',[0,-0.20,0],[0.24,0.44,0.26],c.armor);
    add(4,'box',[0,-0.17,0],[0.22,0.34,0.24],c.armor);
    add(4,'box',[0,-0.14,0.13],[0.20,0.14,0.03],c.trim);        // vambrace plate
    add(5,'cyl12',[0,-0.04,0],[0.26,0.12,0.26],c.skin,[Math.PI/2,0,0]);
    add(5,'box',[0,-0.12,0.05],[0.10,0.11,0.14],c.skin);

    /* ---- right arm: spiked pauldron, jawed greatsword ---- */
    add(6,'cyl12',[0, 0.05,0],[0.40,0.24,0.40],c.armor);
    add(6,'box',[0, 0.14,0],[0.46,0.08,0.46],c.trim);
    add(6,'cone',[-0.20,0.24,0.00],[0.10,0.26,0.10],c.trim,[0,0, 0.55]);
    add(6,'cone',[-0.08,0.26,-0.16],[0.09,0.22,0.09],c.trim,[0.45,0,0.25]);
    add(6,'box',[0,-0.20,0],[0.24,0.44,0.26],c.armor);
    add(7,'box',[0,-0.17,0],[0.22,0.34,0.24],c.armor);
    add(8,'cyl12',[0,-0.04,0],[0.26,0.12,0.26],c.skin,[Math.PI/2,0,0]);
    add(8,'box',[0,-0.12,0.05],[0.10,0.11,0.14],c.skin);
    add(8,'cyl',[0,-0.030,0],[0.11,0.26,0.11],c.dark);          // grip
    add(8,'box',[0,-0.190,0],[0.50,0.090,0.16],c.trim);         // guard
    add(8,'box',[0,-0.190,0.070],[0.16,0.130,0.03],c.armor);    // guard boss
    add(8,'box',[0,-0.460,0],[0.22,0.520,0.07],c.blade);        // blade
    add(8,'box',[ 0.150,-0.400,0],[0.09,0.170,0.05],c.blade,[0,0, 0.55]);
    add(8,'box',[-0.150,-0.400,0],[0.09,0.170,0.05],c.blade,[0,0,-0.55]);
    add(8,'box',[ 0.130,-0.580,0],[0.07,0.140,0.05],c.blade,[0,0, 0.70]);
    add(8,'box',[-0.130,-0.580,0],[0.07,0.140,0.05],c.blade,[0,0,-0.70]);
    add(8,'cone',[0,-0.760,0],[0.22,0.160,0.07],c.blade,[Math.PI,0,0]);
    add(8,'box',[0,-0.460,0.040],[0.045,0.480,0.012],c.glow);   // ember channel

    /* ---- legs: black plate, silver knee/shin, sabatons ---- */
    add(9, 'box',[0,-0.23,0],[0.32,0.52,0.36],c.armor);
    add(10,'box',[0,-0.20,0],[0.29,0.44,0.33],c.armor);
    add(10,'box',[0,-0.300,0.175],[0.24,0.140,0.03],c.trim);    // shin plate
    add(10,'box',[0,-0.420,0.100],[0.33,0.160,0.48],c.trim);    // sabaton
    add(11,'box',[0,-0.23,0],[0.32,0.52,0.36],c.armor);
    add(12,'box',[0,-0.20,0],[0.29,0.44,0.33],c.armor);
    add(12,'box',[0,-0.300,0.175],[0.24,0.140,0.03],c.trim);
    add(12,'box',[0,-0.420,0.100],[0.33,0.160,0.48],c.trim);

    return P;
  }

  /* ---- shared brick body for every remaining kind ---- */
  bodyParts(add,c,INK);

  /* ---- classic loadout: round shield + short sword (brute/runner/ranger) ---- */
  if(kind==='brute'||kind==='runner'||kind==='ranger'){
    add(5,'box',[0.02,-0.10,0.14],[0.52,0.60,0.09],c.armor,[0.10,0,0]);
    add(5,'box',[0.02,-0.10,0.20],[0.13,0.38,0.04],c.trim);
    add(8,'cyl',[0,-0.02,0],[0.10,0.22,0.10],c.dark);
    add(8,'box',[0,-0.16,0],[0.40,0.075,0.12],c.trim);
    add(8,'box',[0,-0.44,0],[0.15,0.52,0.05],c.blade);
    add(8,'cone',[0,-0.74,0],[0.15,0.12,0.05],c.blade,[Math.PI,0,0]);
    add(8,'box',[0,-0.44,0.03],[0.04,0.50,0.012],c.glow);
    return P;
  }

  /* ---- SOLDIER: kettle helm, chainmail, red scarf, spear + small shield ---- */
  if(kind==='soldier'){
    add(1,'box',[0, 0.300,0.232],[0.34,0.26,0.02],c.trim);      // chainmail print
    add(1,'box',[0, 0.380,0.246],[0.34,0.03,0.02],c.dark);      // mail rows
    add(1,'box',[0, 0.320,0.246],[0.34,0.03,0.02],c.dark);
    add(1,'box',[0, 0.260,0.246],[0.34,0.03,0.02],c.dark);
    add(1,'box',[0, 0.545,0],[0.88,0.10,0.50],c.cloth);         // red scarf
    add(1,'box',[0, 0.30,-0.245],[0.24,0.42,0.05],c.cloth,[0.12,0,0]); // scarf tail
    /* kettle helm: wide brim + low dome */
    add(2,'cyl12',[0, 0.300,0],[0.70,0.17,0.70],c.trim);
    add(2,'sph',[0, 0.395,0],[0.66,0.20,0.66],c.trim);
    add(2,'cyl12',[0, 0.215,0],[0.84,0.045,0.84],c.trim);       // brim
    add(2,'box',[0, 0.215,0.345],[0.55,0.04,0.05],c.trim);      // brim lip
    /* spear in the right hand: butt near the floor, head above the shoulder */
    add(8,'cyl',[0, 0.100,0],[0.055,1.70,0.055],c.blade);
    add(8,'box',[0, 0.980,0],[0.14,0.06,0.06],c.dark);
    add(8,'cone',[0, 1.090,0],[0.10,0.26,0.10],c.trim);
    /* small round shield on the left hand */
    add(5,'cyl12',[0.02,-0.115,0.150],[0.58,0.085,0.58],c.trim,[Math.PI/2,0,0]);
    add(5,'cyl12',[0.02,-0.115,0.185],[0.50,0.085,0.50],c.armor,[Math.PI/2,0,0]);
    add(5,'cyl12',[0.02,-0.115,0.230],[0.10,0.04,0.10],c.dark,[Math.PI/2,0,0]);
    return P;
  }

  /* ---- ARCHER: hood, quiver, bow ---- */
  if(kind==='archer'){
    add(1,'box',[0, 0.300,0.232],[0.30,0.24,0.02],c.trim);      // leather chest
    add(1,'box',[0, 0.360,0.246],[0.30,0.03,0.02],c.dark);
    /* hood: shell over the skull, face left open */
    add(2,'cyl12',[0, 0.330,0],[0.72,0.34,0.72],c.cloth);
    add(2,'box',[0, 0.240,0.300],[0.64,0.06,0.12],c.cloth,[0.18,0,0]);  // brow
    add(2,'box',[0, 0.180,-0.300],[0.62,0.42,0.20],c.cloth);            // cowl back
    add(2,'cyl12',[ 0.335,0.110,0.030],[0.10,0.30,0.10],c.cloth);       // hood sides
    add(2,'cyl12',[-0.335,0.110,0.030],[0.10,0.30,0.10],c.cloth);
    /* quiver + arrows on the back */
    add(1,'cyl12',[-0.18,0.360,-0.320],[0.16,0.62,0.16],c.blade,[0.22,0,0.18]);
    add(1,'cyl',[-0.23,0.700,-0.400],[0.035,0.22,0.035],c.dark);
    add(1,'cyl',[-0.18,0.700,-0.390],[0.035,0.22,0.035],c.dark);
    add(1,'cyl',[-0.13,0.700,-0.380],[0.035,0.22,0.035],c.dark);
    /* bow held out in the left hand */
    add(5,'box',[0.02,-0.100,0.230],[0.05,0.66,0.05],c.blade);
    add(5,'box',[0.02,0.245,0.265],[0.05,0.20,0.05],c.blade,[0.55,0,0]);
    add(5,'box',[0.02,-0.445,0.265],[0.05,0.20,0.05],c.blade,[-0.55,0,0]);
    add(5,'box',[0.02,-0.100,0.205],[0.02,0.70,0.012],c.trim);  // string
    add(8,'cyl',[0,-0.030,0],[0.07,0.20,0.07],c.cloth);         // gloved grip hand
    return P;
  }

  /* ---- SORCERER: pointed hat, robe, orb staff ---- */
  if(kind==='sorcerer'){
    add(1,'box',[0, 0.300,0.232],[0.30,0.24,0.02],c.trim);      // rune plate
    add(1,'box',[0, 0.300,0.246],[0.10,0.16,0.02],c.glow);
    /* robe: skirt over the hips and legs */
    add(0,'box',[0, 0.010,0],[0.64,0.42,0.42],c.armor);
    add(0,'box',[0,-0.300,0],[0.72,0.34,0.48],c.armor);
    add(0,'box',[0,-0.470,0],[0.78,0.10,0.52],c.trim);          // hem
    add(1,'box',[0, 0.300,-0.240],[0.30,0.50,0.05],c.armor,[0.10,0,0]); // cape
    /* pointed hat */
    add(2,'cyl12',[0, 0.245,0],[0.90,0.05,0.90],c.armor);       // brim
    add(2,'cone',[0, 0.470,0],[0.62,0.52,0.62],c.armor,[0,0.25,0]);
    add(2,'cyl12',[0, 0.285,0],[0.66,0.07,0.66],c.trim);        // hat band
    /* orb staff in the right hand */
    add(8,'cyl',[0, 0.050,0],[0.055,1.55,0.055],c.blade);
    add(8,'cyl12',[0, 0.860,0],[0.12,0.10,0.12],c.trim);        // claw
    add(8,'sph',[0, 1.010,0],[0.44,0.44,0.44],c.glow);          // orb
    add(8,'box',[0, 1.010,0],[0.14,0.50,0.14],c.glow);          // glow core
    return P;
  }

  /* ---- KNIGHT: great helm, plate, red crest, sword + heater shield ---- */
  if(kind==='knight'){
    add(1,'box',[0, 0.300,0.233],[0.34,0.30,0.02],c.cloth);     // tabard
    add(1,'box',[0, 0.320,0.246],[0.14,0.14,0.02],c.trim);      // emblem
    add(1,'box',[0, 0.545,0],[0.90,0.07,0.48],c.trim);          // gorget
    /* great helm: box shell, visor slit, red crest */
    add(2,'box',[0, 0.320,0.000],[0.74,0.44,0.74],c.armor);
    add(2,'box',[0, 0.165,0.330],[0.56,0.055,0.06],c.dark);     // visor slit
    add(2,'box',[0, 0.030,0.330],[0.30,0.035,0.04],c.dark);     // breath holes
    add(2,'box',[0, 0.560,0.000],[0.10,0.34,0.52],c.cloth,[0.16,0,0]); // crest
    add(2,'box',[0, 0.470,0.330],[0.12,0.10,0.05],c.trim);
    /* pauldrons */
    add(3,'cyl12',[0, 0.055,0],[0.42,0.16,0.42],c.armor);
    add(6,'cyl12',[0, 0.055,0],[0.42,0.16,0.42],c.armor);
    /* heater-ish shield on the left: steel rim + red face + emblem */
    add(5,'cyl12',[0.03,-0.140,0.150],[0.78,0.10,0.78],c.trim,[Math.PI/2,0,0]);
    add(5,'cyl12',[0.03,-0.140,0.195],[0.66,0.10,0.66],c.cloth,[Math.PI/2,0,0]);
    add(5,'box',[0.03,-0.140,0.248],[0.16,0.16,0.02],c.trim,[0,0,0.79]);
    add(5,'cyl12',[0.03,-0.140,0.252],[0.12,0.04,0.12],c.trim,[Math.PI/2,0,0]);
    /* longsword in the right hand */
    add(8,'cyl',[0,-0.030,0],[0.10,0.24,0.10],c.dark);
    add(8,'cyl12',[0,-0.175,0],[0.11,0.05,0.11],c.trim);
    add(8,'box',[0,-0.195,0],[0.46,0.070,0.13],c.trim);
    add(8,'box',[0,-0.490,0],[0.17,0.56,0.05],c.blade);
    add(8,'cone',[0,-0.810,0],[0.17,0.13,0.05],c.blade,[Math.PI,0,0]);
    add(8,'box',[0,-0.490,0.028],[0.03,0.52,0.012],c.trim);
    /* greaves */
    add(10,'box',[0,-0.300,0.170],[0.26,0.14,0.03],c.trim);
    add(12,'box',[0,-0.300,0.170],[0.26,0.14,0.03],c.trim);
    return P;
  }

  return P;
}

/* The shared moulded body: pelvis, torso, head, C-clamp arms, brick legs. */
function bodyParts(add,c,INK){
  /* ---- hips: moulded pelvis brick with two leg sockets ---- */
  add(0,'box',[0, 0.01,0],[0.58,0.22,0.34],c.armor);
  add(0,'box',[0,-0.12,0],[0.50,0.09,0.29],c.dark);
  add(0,'cyl12',[ 0.25,-0.02,0],[0.09,0.07,0.09],c.dark,[0,0,Math.PI/2]);
  add(0,'cyl12',[-0.25,-0.02,0],[0.09,0.07,0.09],c.dark,[0,0,Math.PI/2]);

  /* ---- torso: two stacked bricks, wider at the shoulders ---- */
  add(1,'box',[0, 0.10,0],[0.60,0.28,0.38],c.armor);
  add(1,'box',[0, 0.36,0],[0.84,0.30,0.44],c.armor);
  add(1,'box',[0, 0.535,0],[0.90,0.06,0.46],c.trim);          // collar plate
  add(1,'box',[0, 0.30,0.225],[0.24,0.22,0.03],c.trim);       // printed chest
  add(1,'box',[0, 0.30,0.243],[0.10,0.10,0.02],c.glow);
  add(1,'box',[0, 0.18,-0.235],[0.56,0.74,0.05],c.cloth,[0.10,0,0]); // cape
  add(1,'cyl12',[0,0.575,0],[0.30,0.08,0.30],c.skin);         // neck

  /* ---- head: cylinder + top stud + printed face ---- */
  add(2,'cyl12',[0, 0.13,0],[0.66,0.44,0.66],c.skin);
  add(2,'cyl12',[0, 0.375,0],[0.32,0.09,0.32],c.skin);        // stud
  add(2,'box',[ 0.115,0.16,0.305],[0.075,0.075,0.03],INK);    // eyes
  add(2,'box',[-0.115,0.16,0.305],[0.075,0.075,0.03],INK);
  add(2,'box',[0, 0.035,0.305],[0.19,0.032,0.02],INK);        // mouth

  /* ---- left arm: shoulder brick, C-clamp hand ---- */
  add(3,'cyl12',[0, 0.03,0],[0.34,0.20,0.34],c.armor);
  add(3,'box',[0,-0.20,0],[0.22,0.44,0.24],c.armor);
  add(4,'box',[0,-0.17,0],[0.20,0.34,0.22],c.armor);
  add(5,'cyl12',[0,-0.04,0],[0.26,0.12,0.26],c.skin,[Math.PI/2,0,0]);
  add(5,'box',[0,-0.12,0.05],[0.10,0.11,0.14],c.skin);        // fingers

  /* ---- right arm: shoulder brick, C-clamp hand ---- */
  add(6,'cyl12',[0, 0.03,0],[0.34,0.20,0.34],c.armor);
  add(6,'box',[0,-0.20,0],[0.22,0.44,0.24],c.armor);
  add(7,'box',[0,-0.17,0],[0.20,0.34,0.22],c.armor);
  add(8,'cyl12',[0,-0.04,0],[0.26,0.12,0.26],c.skin,[Math.PI/2,0,0]);
  add(8,'box',[0,-0.12,0.05],[0.10,0.11,0.14],c.skin);

  /* ---- legs: brick thigh, shin and a flat moulded foot ---- */
  add(9, 'box',[0,-0.23,0],[0.30,0.50,0.34],c.armor);
  add(10,'box',[0,-0.20,0],[0.27,0.42,0.31],c.dark);
  add(10,'box',[0,-0.42,0.09],[0.31,0.15,0.46],c.armor);
  add(11,'box',[0,-0.23,0],[0.30,0.50,0.34],c.armor);
  add(12,'box',[0,-0.20,0],[0.27,0.42,0.31],c.dark);
  add(12,'box',[0,-0.42,0.09],[0.31,0.15,0.46],c.armor);
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
  if(kind==='boss')mesh.scale.setScalar(1.65);
  else if(kind==='brute')mesh.scale.setScalar(1.18);
  else if(kind==='runner')mesh.scale.setScalar(0.90);
  else if(kind==='knight')mesh.scale.setScalar(1.28);
  else if(kind==='soldier')mesh.scale.setScalar(1.00);
  else if(kind==='archer')mesh.scale.setScalar(0.95);
  else if(kind==='sorcerer')mesh.scale.setScalar(1.02);
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
  if(st==='telegraph')return (kind==='ranger'||kind==='archer'||kind==='sorcerer')?'cast':'telegraph';
  if(st==='chargeTele')return 'charge';
  if(st==='charge')return 'run';
  if(st==='recovery'||st==='recover'||st==='slamTele')return 'telegraph';
  if(st==='run'||st==='approach'||st==='chase')return speed>0.45?'run':'idle';
  return 'idle';
}
function syncViews(s,dt){
  const seen=new Set();
  const h=s.hero;
  let hv=VIEWS.get(0); if(!hv)hv=makeView('hero',0);
  seen.add(0);
  const hs=h.hp<=0?'dead':h.state;
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
    if(id!==0&&!seen.has(id)){ scene.remove(v.mesh); v.mesh.material.dispose(); VIEWS.delete(id); }
  }
}

/* ---------- gems / heal orbs / projectiles (cosmetic instancing) ---------- */
let gemMesh=null,healMesh=null,projMesh=null,shadowMesh=null;
function setupPickupMeshes(){
  gemMesh=new T.InstancedMesh(new T.DodecahedronGeometry(0.24,0),
    new T.MeshLambertMaterial({color:0x49c8ff,emissive:0x0d4c78}),64);
  healMesh=new T.InstancedMesh(new T.SphereGeometry(0.26,8,6),
    new T.MeshLambertMaterial({color:0x55e08a,emissive:0x0f5c2a}),32);
  projMesh=new T.InstancedMesh(new T.SphereGeometry(0.34,8,6),
    new T.MeshBasicMaterial({color:0xc46bff}),24);
  shadowMesh=new T.InstancedMesh(new T.CircleGeometry(1,14),
    new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28,depthWrite:false}),CFG.maxEntities);
  for(const m of [gemMesh,healMesh,projMesh,shadowMesh]){m.frustumCulled=false;m.count=0;scene.add(m);}
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
  for(const p of s.projectiles){ if(n>=24)break;
    dummy.position.set(p.x,1.0,p.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(p.r/0.34);
    dummy.updateMatrix();projMesh.setMatrixAt(n++,dummy.matrix); }
  projMesh.count=n;projMesh.instanceMatrix.needsUpdate=true;
  // blob shadows: hero + enemies + boss, one draw call
  n=0;
  const put=(x,z,r)=>{ if(n>=CFG.maxEntities)return;
    dummy.position.set(x,0.025,z);dummy.rotation.set(-Math.PI/2,0,0);
    dummy.scale.set(r, r, 1);dummy.updateMatrix();shadowMesh.setMatrixAt(n++,dummy.matrix); };
  put(s.hero.x,s.hero.z,0.55);
  for(const e of s.enemies)put(e.x,e.z,0.5);
  if(s.boss&&s.boss.hp>0)put(s.boss.x,s.boss.z,1.25);
  shadowMesh.count=n;shadowMesh.instanceMatrix.needsUpdate=true;
}

/* ---------- VFX: particles, splatters, floating numbers, shake ---------- */
const PMAX=380;
let parts=null,pPos=null,pCol=null,pVel=null,pLife=null,pHead=0;
let splatMesh=null,splats=[];
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
  splatMesh=new T.InstancedMesh(new T.CircleGeometry(1,10),
    new T.MeshBasicMaterial({color:0x5c1714,transparent:true,opacity:0.5,depthWrite:false}),48);
  splatMesh.frustumCulled=false;splatMesh.count=0;scene.add(splatMesh);
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
function splatAt(x,z,type){
  splats.push({x,z,t:0,s:0.6+CRNG()*0.6});
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
    dummy.position.set(s.x,0.03,s.z);dummy.rotation.set(-Math.PI/2,0,0);
    dummy.scale.set(s.s*(0.6+f*0.7),s.s*(0.6+f*0.7),1);
    dummy.updateMatrix();splatMesh.setMatrixAt(n++,dummy.matrix);
  }
  splatMesh.count=n;splatMesh.instanceMatrix.needsUpdate=true;
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
function consumeEvents(){
  for(let i=0;i<EV.length;i++){
    const e=EV[i];
    switch(e.type){
      case 'swing': Audio.whoosh(); break;
      case 'hit': {
        const col=e.unit==='boss'?[1,.45,.2]:[1,.55,.35];
        burst(e.x,e.y||1.4,e.z,col,e.crit?14:9,e.crit?4.4:3.1);
        damageNumber(e.x,(e.y||1.4)+0.35,e.z,(e.crit?'✦ ':'')+e.dmg,e.crit);
        Audio.hit(e.crit);break; }
      case 'kill': burst(e.x,1.2,e.z,TINTS[e.unit]?TINTS[e.unit].glow:[1,.5,.3],16,4.2);
        Audio.kill();break;
      case 'splat': splatAt(e.x,e.z,e.unit);break;
      case 'cancel': burst(e.x,1.7,e.z,[0.5,0.9,1],8,2.2);break;
      case 'hurt': burst(e.x,1.3,e.z,[1,.2,.18],12,3.4);Audio.hurt();break;
      case 'heal': damageNumber(e.x,1.5,e.z,'+'+e.amount,false);burst(e.x,1,e.z,[.3,1,.5],10,2.2);break;
      case 'gem': Audio.gem();break;
      case 'roll': Audio.whoosh(0.7); burst(e.x,0.30,e.z,[0.80,0.74,0.60],7,1.7); break;
      case 'shot': Audio.shot();burst(e.x,1.4,e.z,[.8,.4,1],8,2.0);break;
      case 'projBlast': {
        const r=e.r||1.5;
        burst(e.x,0.9,e.z,[.75,.45,1],Math.round(10+r*6),2.4+r*1.6);
        splatAt(e.x,e.z,'sorcerer');break; }
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
