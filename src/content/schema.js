/* =====================================================================
   CONTENT SCHEMA — the contract every content descriptor must satisfy.

   Pure data module: NO three.js, NO DOM, NO Math.random, NO Date.now.
   It can therefore be imported by the deterministic sim, by the view,
   by Node tooling (scripts/content-check.mjs) and by the browser at boot
   without any of those consumers changing simulation behaviour.

   Descriptor shape (all types share this envelope):
     id, type, added                     identity / provenance
     cfg / sim  { ... }                  numbers the simulation reads
     view       { ... }                  colours / geometry / scale only
     meta       { ... }                  price, display name, ownership

   The sim/view split is deliberate: simDigest() hashes SIM state only, so
   a change confined to `view` can never move the digest or desync co-op.
   scripts/content-check.mjs additionally hashes SIM_CONTENT, so editing a
   simulation number in a descriptor fails the gate until a new baseline
   is recorded (and the net build stamp is bumped).
   ===================================================================== */

/** Joint indices 0..12 are a stable contract (see src/rig/joints.js). */
export const JOINT_COUNT = 13;

/** The only primitive names rigParts()/rigGeometry() accept. */
export const PRIM_KINDS = Object.freeze(['box', 'sph', 'cyl', 'cyl12', 'cone']);

/** Figure renderers that are NOT the 13-joint rig. Each id names a
    dedicated procedural builder in src/game.js PART 3 (a quadruped like
    the dragon cannot be moulded onto a humanoid skeleton). A figure with
    `custom: '<id>'` carries a tint + meshScale but NO rig parts — its
    builder owns the geometry and its animation. Adding a renderer means
    adding the builder in game.js AND the id here, in the same commit. */
export const CUSTOM_RENDERERS = Object.freeze(['dragon', 'knightMount']);

/** Named plastic colour slots used by TINTS and by part `c` references. */
export const TINT_SLOTS = Object.freeze([
  'armor', 'trim', 'cloth', 'skin', 'blade', 'dark', 'glow', 'metal',
]);

/** Required colour slots for a figure tint. `metal` and `glow` are optional. */
export const REQUIRED_TINT_SLOTS = Object.freeze([
  'armor', 'trim', 'cloth', 'skin', 'blade', 'dark',
]);

/** Every registry table, in manifest order. */
export const CONTENT_TYPES = Object.freeze([
  'HEROES', 'FIGURES', 'ENEMIES', 'BOSSES', 'ITEMS', 'PROPS', 'MAPS', 'UPGRADES',
]);

/**
 * @typedef {Object} Part
 * @property {number} j        joint index 0..12
 * @property {string} g        one of PRIM_KINDS
 * @property {number[]} o      [x,y,z] offset in metres
 * @property {number[]} s      [x,y,z] scale
 * @property {string} c        tint slot name, or 'INK' for the shared face print
 * @property {number[]} [r]    optional [x,y,z] euler rotation
 */

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const k of Object.keys(value)) deepFreeze(value[k]);
  }
  return value;
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isVec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isVec2 = (v) => Array.isArray(v) && v.length === 2 && v.every(isNum);
const isRGB = (v) => Array.isArray(v) && v.length === 3 &&
  v.every((n) => isNum(n) && n >= 0 && n <= 1);
const isId = (v) => typeof v === 'string' && /^[a-z][a-z0-9_-]*$/.test(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isChapters = (v) => Array.isArray(v) && v.length > 0 &&
  v.every((n) => isInt(n) && n >= 1);

function checkTint(tint, where, errors) {
  if (!isObj(tint)) { errors.push(`${where}: tint must be an object`); return; }
  for (const slot of REQUIRED_TINT_SLOTS) {
    if (!isRGB(tint[slot])) errors.push(`${where}: tint.${slot} must be [r,g,b] in 0..1`);
  }
  for (const [slot, val] of Object.entries(tint)) {
    if (!TINT_SLOTS.includes(slot)) errors.push(`${where}: unknown tint slot "${slot}"`);
    else if (!isRGB(val)) errors.push(`${where}: tint.${slot} must be [r,g,b] in 0..1`);
  }
}

function checkParts(parts, tint, where, errors) {
  if (!Array.isArray(parts)) { errors.push(`${where}: parts must be an array`); return; }
  if (!parts.length) errors.push(`${where}: parts must not be empty`);
  parts.forEach((p, i) => {
    const at = `${where}: parts[${i}]`;
    if (!isObj(p)) { errors.push(`${at}: must be an object`); return; }
    if (!isInt(p.j) || p.j < 0 || p.j >= JOINT_COUNT)
      errors.push(`${at}: j must be a joint index 0..${JOINT_COUNT - 1}`);
    if (!PRIM_KINDS.includes(p.g)) errors.push(`${at}: g must be one of ${PRIM_KINDS.join('/')}`);
    if (!isVec3(p.o)) errors.push(`${at}: o must be [x,y,z]`);
    if (!isVec3(p.s)) errors.push(`${at}: s must be [x,y,z]`);
    if (p.c !== 'INK' && !(typeof p.c === 'string' && p.c in (tint || {})))
      errors.push(`${at}: c must name a tint slot or 'INK'`);
    if (p.r !== undefined && !isVec3(p.r)) errors.push(`${at}: r must be [x,y,z]`);
  });
}

function common(d, key, type, where, errors, warnings, keyIsId = true) {
  /* MAPS and BOSSES are keyed by chapter NUMBER, not by descriptor id. */
  if (keyIsId && d.id !== key)
    errors.push(`${where}: id "${d.id}" does not match registry key "${key}"`);
  if (!isId(d.id)) errors.push(`${where}: id must be lowercase alphanumeric`);
  if (d.type !== type) errors.push(`${where}: type must be "${type}"`);
  if (!isDate(d.added)) warnings.push(`${where}: added should be an ISO date`);
}

function checkHero(d, key, errors, warnings) {
  const w = `HEROES.${key}`;
  common(d, key, 'hero', w, errors, warnings);
  if (!isStr(d.displayName)) errors.push(`${w}: displayName is required`);
  if (!isNum(d.price) || d.price < 0) errors.push(`${w}: price must be >= 0`);
  if (d.default !== true && d.price === 0)
    errors.push(`${w}: a free hero must be marked default:true`);
  if (d.default === true && d.price !== 0)
    errors.push(`${w}: the default hero must have price 0`);
  if (!isId(d.figure)) errors.push(`${w}: figure must name a known figure kind`);
  if (!isObj(d.slashTip) || !isInt(d.slashTip.b) ||
      d.slashTip.b < 0 || d.slashTip.b >= JOINT_COUNT || !isVec3(d.slashTip.o))
    errors.push(`${w}: slashTip must be {b: joint 0..12, o: [x,y,z]}`);
  if (d.sim !== undefined)
    errors.push(`${w}: per-hero sim stats are not supported yet (would move the digest)`);
}

function checkFigure(d, key, errors, warnings) {
  const w = `FIGURES.${key}`;
  common(d, key, 'figure', w, errors, warnings);
  if (!isStr(d.displayName)) errors.push(`${w}: displayName is required`);
  checkTint(d.tint, w, errors);
  if (d.custom !== undefined) {
    /* Custom-rendered figure (see CUSTOM_RENDERERS): geometry and
       animation live in its game.js builder, so rig parts are forbidden
       here rather than silently ignored. */
    if (!CUSTOM_RENDERERS.includes(d.custom))
      errors.push(`${w}: custom renderer "${d.custom}" has no builder (see CUSTOM_RENDERERS)`);
    if (d.parts !== undefined && (!Array.isArray(d.parts) || d.parts.length))
      errors.push(`${w}: a custom figure must not carry rig parts (its builder owns the geometry)`);
  } else {
    checkParts(d.parts, d.tint, w, errors);
  }
  if (!isNum(d.meshScale) || d.meshScale <= 0)
    errors.push(`${w}: meshScale must be > 0`);
}

function checkEnemy(d, key, errors, warnings) {
  const w = `ENEMIES.${key}`;
  common(d, key, 'enemy', w, errors, warnings);
  if (d.kind !== key) errors.push(`${w}: kind "${d.kind}" does not match registry key`);
  if (!['melee', 'ranged'].includes(d.cls)) errors.push(`${w}: cls must be melee|ranged`);
  if (!isObj(d.cfg)) errors.push(`${w}: cfg is required`);
  else {
    for (const f of ['hp', 'speed', 'dmg', 'radius', 'score'])
      if (!isNum(d.cfg[f])) errors.push(`${w}: cfg.${f} must be numeric`);
    if (d.cls === 'ranged' && !isNum(d.cfg.minRange))
      errors.push(`${w}: a ranged kind needs cfg.minRange/maxRange/volley/projSpeed/projR`);
  }
  if (!isId(d.figure)) errors.push(`${w}: figure must name a known figure kind`);
  if (!isInt(d.cap) || d.cap <= 0) errors.push(`${w}: cap must be a positive integer`);
  if (typeof d.elite !== 'boolean') errors.push(`${w}: elite must be a boolean`);
  if (d.wave !== null && !isObj(d.wave)) errors.push(`${w}: wave must be an object or null`);
  if (isObj(d.wave)) {
    for (const f of ['from', 'cap', 'w'])
      if (!isNum(d.wave[f])) errors.push(`${w}: wave.${f} must be numeric`);
    if (d.wave.every !== undefined && !isNum(d.wave.every))
      errors.push(`${w}: wave.every must be numeric`);
  }
  if (d.fill !== null && !isObj(d.fill)) errors.push(`${w}: fill must be an object or null`);
  if (isObj(d.fill)) {
    if (!isInt(d.fill.order)) errors.push(`${w}: fill.order must be an integer (RNG order)`);
    if (!isNum(d.fill.weight)) errors.push(`${w}: fill.weight must be numeric`);
    if (d.fill.ramp !== undefined && !isNum(d.fill.ramp))
      errors.push(`${w}: fill.ramp must be numeric`);
  }
  if (!Array.isArray(d.events)) errors.push(`${w}: events must be an array`);
  if (!Array.isArray(d.behaviour)) errors.push(`${w}: behaviour must be an array`);
}

function checkBoss(d, key, errors, warnings, registry) {
  const w = `BOSSES.${key}`;
  common(d, key, 'boss', w, errors, warnings, false);
  if (!isInt(d.chapter)) errors.push(`${w}: chapter must be an integer`);
  if (!isStr(d.name)) errors.push(`${w}: name is required (feeds BOSS_NAMES)`);
  if (!isStr(d.displayName)) errors.push(`${w}: displayName is required`);
  if (!isId(d.figure)) errors.push(`${w}: figure must name a known figure kind`);
  if (!isId(d.mapId)) errors.push(`${w}: mapId must name a map descriptor`);
  if (registry.MAPS && registry.MAPS[d.chapter] && registry.MAPS[d.chapter].id !== d.mapId)
    errors.push(`${w}: mapId does not match MAPS[${d.chapter}].id`);
  if (registry.FIGURES && !registry.FIGURES[d.figure])
    errors.push(`${w}: figure "${d.figure}" is not in FIGURES`);
  if (d.kind !== undefined && !isId(d.kind))
    errors.push(`${w}: kind must be a lowercase id`);
  /* A boss MAY carry its own cfg (a genuinely different boss, CONTENT-GUIDE
     section 3); it then overrides the shared boss numbers for its chapter.
     The breath sub-block is the fire-breath attack (Emerald Drake). */
  if (d.cfg !== undefined) {
    if (!isObj(d.cfg)) errors.push(`${w}: cfg must be an object`);
    else {
      for (const f of ['hp', 'speed', 'radius', 'score', 'spawnMin', 'spawnMax',
                       'chargeSpeed', 'chargeTele', 'chargeDur', 'chargeCd',
                       'chargeRange', 'chargeDmg', 'slamTele', 'slamRange', 'slamDmg'])
        if (!isNum(d.cfg[f])) errors.push(`${w}: cfg.${f} must be numeric`);
      if (d.cfg.breath !== undefined) {
        if (!isObj(d.cfg.breath)) errors.push(`${w}: cfg.breath must be an object`);
        else for (const f of ['minRange', 'maxRange', 'range', 'halfAngleDeg',
                               'headDist', 'tele', 'dur', 'p2Dur', 'tickDmg',
                               'tickEvery', 'cd', 'p2Cd', 'firstCd'])
          if (!isNum(d.cfg.breath[f])) errors.push(`${w}: cfg.breath.${f} must be numeric`);
      }
    }
  }
}

function checkItem(d, key, errors, warnings) {
  const w = `ITEMS.${key}`;
  common(d, key, 'item', w, errors, warnings);
  if (!isStr(d.displayName)) errors.push(`${w}: displayName is required`);
  if (!isObj(d.sim)) { errors.push(`${w}: sim is required`); return; }
  if (!['always', 'chance'].includes(d.sim.drop))
    errors.push(`${w}: sim.drop must be always|chance`);
  if (d.sim.drop === 'chance' && !(isNum(d.sim.chance) && d.sim.chance >= 0 && d.sim.chance <= 1))
    errors.push(`${w}: sim.chance must be a probability 0..1`);
  if (!isVec2(d.sim.offset)) errors.push(`${w}: sim.offset must be [dx,dz]`);
  if (!isStr(d.sim.pool)) errors.push(`${w}: sim.pool must name the SIM array`);
  if (!isObj(d.view)) errors.push(`${w}: view is required`);
}

function checkProp(d, key, errors, warnings) {
  const w = `PROPS.${key}`;
  common(d, key, 'prop', w, errors, warnings);
  if (!isStr(d.displayName)) errors.push(`${w}: displayName is required`);
  if (d.mapKey !== null && !isStr(d.mapKey)) errors.push(`${w}: mapKey must be a string or null`);
  if (!isChapters(d.chapters)) errors.push(`${w}: chapters must be a non-empty int array`);
  if (!isObj(d.collider) || !isStr(d.collider.kind))
    errors.push(`${w}: collider.kind is required`);
  if (!isObj(d.view)) errors.push(`${w}: view is required`);
}

function checkMap(d, key, errors, warnings) {
  const w = `MAPS.${key}`;
  common(d, key, 'map', w, errors, warnings, false);
  if (!isInt(d.chapter)) errors.push(`${w}: chapter must be an integer`);
  if (!isStr(d.displayName)) errors.push(`${w}: displayName is required`);
  if (!isId(d.bossId)) errors.push(`${w}: bossId must name a boss descriptor`);
  if (!isObj(d.palette) || !isStr(d.palette.name)) errors.push(`${w}: palette.name is required`);
  if (!isObj(d.map)) { errors.push(`${w}: map is required`); return; }
  const m = d.map;
  if (!isInt(m.seed)) errors.push(`${w}: map.seed must be an integer`);
  if (!isObj(m.pond) || !isNum(m.pond.r)) errors.push(`${w}: map.pond is required`);
  if (!isObj(m.landmark)) errors.push(`${w}: map.landmark is required`);
  for (const f of ['trees', 'rocks', 'pillars', 'stones', 'fenceRuns', 'hills',
                   'torches', 'lavaPools', 'reeds'])
    if (!isInt(m[f])) errors.push(`${w}: map.${f} must be an integer`);
  if (!Array.isArray(m.eventPack)) errors.push(`${w}: map.eventPack must be an array`);
}

function checkUpgrade(d, key, errors, warnings) {
  const w = `UPGRADES.${key}`;
  common(d, key, 'upgrade', w, errors, warnings);
  if (!isStr(d.ic)) errors.push(`${w}: ic (card glyph) is required`);
  if (!isStr(d.displayName)) errors.push(`${w}: displayName is required`);
  if (!isStr(d.description)) errors.push(`${w}: description is required`);
  if (typeof d.apply !== 'function') errors.push(`${w}: apply(s) must be a function`);
}

const CHECKERS = {
  HEROES: checkHero, FIGURES: checkFigure, ENEMIES: checkEnemy,
  BOSSES: checkBoss, ITEMS: checkItem, PROPS: checkProp,
  MAPS: checkMap, UPGRADES: checkUpgrade,
};

/**
 * Validate the whole content registry.
 * @returns {{errors: string[], warnings: string[], counts: Object}}
 *          `errors` are fatal (an invalid descriptor would crash or silently
 *          never spawn); `warnings` describe non-fatal provenance gaps.
 */
export function validateRegistry(registry) {
  const errors = [], warnings = [], counts = {};
  for (const type of CONTENT_TYPES) {
    const table = registry[type];
    if (!isObj(table)) { errors.push(`${type}: registry table missing`); continue; }
    counts[type] = Object.keys(table).length;
    for (const [key, d] of Object.entries(table)) {
      if (!isObj(d)) { errors.push(`${type}.${key}: descriptor must be an object`); continue; }
      CHECKERS[type](d, String(key), errors, warnings, registry);
    }
  }
  /* Cross-type references: a figure id that does not exist would make
     rigParts() return [] and render an invisible character. */
  if (isObj(registry.FIGURES)) {
    for (const [type, field] of [['HEROES', 'figure'], ['ENEMIES', 'figure'], ['BOSSES', 'figure']]) {
      for (const [key, d] of Object.entries(registry[type] || {})) {
        if (d && d[field] && !registry.FIGURES[d[field]])
          errors.push(`${type}.${key}: ${field} "${d[field]}" is not in FIGURES`);
      }
    }
    for (const [key, h] of Object.entries(registry.HEROES || {}))
      if (h && !registry.FIGURES[h.figure])
        errors.push(`HEROES.${key}: safeHero() would fall back for a missing figure`);
  }
  /* ENEMIES.<kind>.figure must equal its own key today (one figure per kind). */
  for (const [key, d] of Object.entries(registry.ENEMIES || {}))
    if (d && d.figure !== key) errors.push(`ENEMIES.${key}: figure "${d.figure}" != kind`);
  return { errors, warnings, counts };
}

/** Fail loudly at boot. Called by src/game.js and by scripts/content-check.mjs. */
export function assertRegistry(registry) {
  const { errors } = validateRegistry(registry);
  if (errors.length) throw new Error('[content] invalid registry:\n  ' + errors.join('\n  '));
  return true;
}

/** Human-readable manifest — the "everything is traceable" report. */
export function describeRegistry(registry) {
  return CONTENT_TYPES.map((t) => `${t}:${Object.keys(registry[t] || {}).length}`).join(' ');
}
