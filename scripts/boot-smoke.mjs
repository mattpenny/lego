#!/usr/bin/env node
/* =====================================================================
   boot-smoke.mjs — prove src/game.js resolves AND boots without a browser.

   CONTENT-GUIDE.md section 5.1 requires "the page loads with zero console
   errors; a run starts". We cannot open a real phone here, but we can run
   the real ES module graph in Node with engine/DOM stubs. That catches the
   failures a syntax check misses: a bad import path, a missing named export,
   an assertRegistry() failure, or a top-level ReferenceError.

   The stubs are deliberately inert: nothing is rendered, requestAnimationFrame
   never calls back, and no audio is created. We only assert that the IIFE
   finished and left window.__GAME behind.
   ===================================================================== */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Universal inert object: every property is another inert callable object,
   every call returns one, every `new` returns one. */
function stub(label) {
  const target = function () {};
  target.__stub = label;
  const cache = new Map();
  return new Proxy(target, {
    get(t, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === Symbol.iterator) return undefined;
      if (prop === 'then') return undefined;         // never look like a Promise
      if (prop === '__stub' || prop === 'name' || prop === 'length') return t[prop];
      if (cache.has(prop)) return cache.get(prop);
      const child = stub(`${label}.${String(prop)}`);
      cache.set(prop, child);
      return child;
    },
    set(t, prop, value) { t[prop] = value; cache.delete(prop); return true; },
    has() { return true; },
    apply() { return stub(`${label}()`); },
    construct() { return stub(`new ${label}`); },
  });
}

const engineNames = [
  'WebGLRenderer', 'Scene', 'Color', 'Fog', 'PerspectiveCamera',
  'HemisphereLight', 'DirectionalLight', 'AmbientLight', 'Mesh',
  'MeshLambertMaterial', 'MeshBasicMaterial', 'InstancedMesh', 'SkinnedMesh',
  'Skeleton', 'Bone', 'Group', 'Object3D', 'Vector2', 'Vector3', 'Matrix4',
  'Quaternion', 'Euler', 'BoxGeometry', 'CylinderGeometry', 'SphereGeometry',
  'ConeGeometry', 'CircleGeometry', 'PlaneGeometry', 'DodecahedronGeometry',
  'RingGeometry', 'BufferGeometry', 'Float32BufferAttribute',
  'Uint16BufferAttribute', 'InstancedBufferAttribute', 'BufferAttribute', 'CanvasTexture',
  'RepeatWrapping', 'SRGBColorSpace', 'AdditiveBlending', 'DoubleSide',
  'BackSide', 'FrontSide', 'Points', 'PointsMaterial', 'MathUtils',
  'ACESFilmicToneMapping',
];
/* src/game.js collects these as bare globals into `const T = {...}`. They must
   be inert constructors: `class extends Function` evaluates its constructor
   args as JS source, which turned `{antialias:false}` into "[object Object]"
   and threw a SyntaxError. A Proxy around a plain function keeps both calls
   and `new` harmless, and caches static lookups (MathUtils.lerp, constants). */
function engineStub(name) {
  const cache = new Map();
  const ctor = function () { return stub(`new ${name}`); };
  return new Proxy(ctor, {
    get(t, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === Symbol.iterator) return undefined;
      if (prop === 'then') return undefined;
      if (prop === '__stub' || prop === 'name' || prop === 'length' || prop === 'prototype') return t[prop];
      if (!cache.has(prop)) cache.set(prop, stub(`${name}.${String(prop)}`));
      return cache.get(prop);
    },
    has() { return true; },
    apply() { return stub(`${name}()`); },
    construct() { return stub(`new ${name}`); },
  });
}
for (const n of engineNames) defineGlobal(n, engineStub(n));

/* Node 22 ships a getter-only `navigator` (and an experimental getter-only
   `localStorage`). Plain assignment throws "Cannot set property … which has
   only a getter", so redefine those descriptors instead of assigning. */
function defineGlobal(name, value) {
  const d = Object.getOwnPropertyDescriptor(globalThis, name);
  if (d && !d.writable && !d.set && d.get) {
    Object.defineProperty(globalThis, name, {
      value, writable: true, configurable: true, enumerable: d.enumerable,
    });
  } else {
    globalThis[name] = value;
  }
}

const element = () => stub('element');
const documentStub = {
  getElementById: () => element(),
  createElement: () => element(),
  addEventListener() {},
  body: element(),
  documentElement: element(),
};
defineGlobal('document', documentStub);
defineGlobal('window', globalThis);
defineGlobal('innerWidth', 1280);
defineGlobal('innerHeight', 720);
defineGlobal('devicePixelRatio', 1);
defineGlobal('requestAnimationFrame', () => 0);   // do NOT run the frame loop
defineGlobal('cancelAnimationFrame', () => {});
defineGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
defineGlobal('navigator', { userAgent: 'node', maxTouchPoints: 0 });
defineGlobal('addEventListener', () => {});
defineGlobal('AudioContext', class {});
defineGlobal('webkitAudioContext', class {});

/* --- named exports the game imports must actually exist --------------- */
const content = await import('../src/content/index.js');
for (const name of [
  'HEROES', 'HERO_COSTS', 'HERO_SLASH_TIPS', 'REGISTRY', 'SIM_CONTENT',
  'RULES', 'FIGURES', 'TINTS', 'FIGURE_SCALES',
  'ENEMIES', 'ENEMY_CFG', 'ENEMY_CAPS', 'WAVE_RULES', 'FILL_POOL',
  'SCHEDULED_ELITES', 'OPENER_KIND',
  'BOSSES', 'BOSS_NAMES', 'BOSS_CFG', 'BOSS_PHASE2',
  'ITEMS', 'ITEM_DROPS', 'HEAL_CFG', 'POTION_CFG', 'ELITE_KINDS',
  'PROPS', 'MAPS', 'PALETTES', 'MAP_CONFIGS', 'EVENT_PACKS',
  'UPGRADES', 'UPGRADE_LIST', 'UPGRADE_IDS',
  'assertRegistry', 'validateRegistry', 'heroName', 'safeHero',
]) {
  if (!(name in content)) throw new Error(`content registry missing export "${name}"`);
}
content.assertRegistry(content.REGISTRY);
const vr = content.validateRegistry(content.REGISTRY);
if (vr.errors.length) throw new Error('registry validation failed: ' + vr.errors.join('; '));

/* --- boot the real module --------------------------------------------- */
await import('../src/game.js');

const G = globalThis.__GAME;
if (!G) throw new Error('window.__GAME was not installed — the IIFE did not finish');
if (typeof G.digest !== 'function') throw new Error('window.__GAME.digest is missing');

/* --- cross-check the recorded baseline -------------------------------- */
const baseline = JSON.parse(readFileSync(resolve(ROOT, 'scripts/content-baseline.json'), 'utf8'));
const d1 = G.digest();
if (d1 !== baseline.checks.fresh)
  throw new Error(`fresh digest ${d1} != baseline ${baseline.checks.fresh}`);
if (G.CFG.net.build !== baseline.build)
  throw new Error(`net build ${G.CFG.net.build} != baseline ${baseline.build}`);

/* --- the registry must be CONSUMED at boot, not merely imported ------- */
const live = G.CFG.meta.heroCosts;
const expected = content.HERO_COSTS;
const norm = (o) => JSON.stringify(Object.entries(o).sort());
if (!live || typeof live !== 'object')
  throw new Error('CFG.meta.heroCosts is missing');
if (norm(live) !== norm(expected))
  throw new Error('CFG.meta.heroCosts does not match the hero registry at boot');
if (content.safeHero(G.meta.heroSkin) !== G.meta.heroSkin)
  throw new Error(`default meta heroSkin "${G.meta.heroSkin}" is not a registry id`);

/* --- full registry is CONSUMED, not just imported --------------------- */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
if (!same(G.CFG.enemy, content.ENEMY_CFG))
  throw new Error('CFG.enemy is not derived from the enemy descriptors');
if (!same(G.CFG.caps, content.ENEMY_CAPS))
  throw new Error('CFG.caps is not derived from the enemy descriptors');
if (!same(G.CFG.wave, content.WAVE_RULES))
  throw new Error('CFG.wave is not derived from the enemy descriptors');
if (!same(G.CFG.heal, content.HEAL_CFG))
  throw new Error('CFG.heal is not derived from the heal descriptor');
if (!same(G.CFG.boss, content.BOSS_CFG) || !same(G.CFG.boss2, content.BOSS_PHASE2))
  throw new Error('CFG.boss / boss2 are not derived from the boss descriptors');
if (!same(G.CFG.events.pack, content.EVENT_PACKS))
  throw new Error('CFG.events.pack is not derived from the map descriptors');
if (!same(G.CFG.meta.tracks, content.RULES.meta.tracks))
  throw new Error('Armoury tracks are not derived from RULES.meta');
if (G.SLASH_TIP && !same(G.SLASH_TIP, content.HERO_SLASH_TIPS))
  throw new Error('SLASH_TIP is not derived from the hero descriptors');

/* --- "a run starts" (CONTENT-GUIDE.md 5.1) --------------------------- */
G.reset(0x51A7E, 'play');
for (let i = 0; i < 120; i++) G.step({});
if (G.sim.players !== 1) throw new Error('solo run did not create one hero');
if (G.heroes().length !== 1) throw new Error('solo run exposes exactly one hero');
if (G.sim.heroes[0].hp <= 0) throw new Error('hero died on an idle 120-step run');

console.log('boot OK — module graph resolved, assertRegistry passed, IIFE finished');
console.log(`  fresh digest ${d1} (matches baseline)`);
console.log(`  net build ${G.CFG.net.build} (no bump needed)`);
console.log(`  hero registry consumed: ${Object.keys(live).length} priced skins, default "${G.meta.heroSkin}"`);
console.log(`  120 idle steps OK — ${G.heroes().length} hero, ${G.sim.heroes[0].hp} HP`);
