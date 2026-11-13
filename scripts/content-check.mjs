#!/usr/bin/env node
/* =====================================================================
   content-check.mjs — the "everything is traceable" gate (full transform).

   Run `npm run content:check` before every commit. One pass verifies:
     1. all 8 descriptor tables satisfy src/content/schema.js
     2. src/game.js contains NO duplicated content literal — every table is
        derived from src/content/ (CFG, TINTS, rigParts, scales, palettes,
        upgrades, boss names, props, maps, enemy caps and fill pool)
     3. every cross-type reference resolves (hero/enemy/boss -> figure,
        map -> boss, chapter -> map) and all load-bearing orders are stable
     4. the 9 figure descriptors still reproduce the legacy rig byte-for-byte
     5. SIM_CONTENT hash — changing ANY simulation number in ANY descriptor
        fails the gate until a baseline is re-recorded (+ net build bump)
     6. the deterministic sim digests equal scripts/content-baseline.json
     7. the real ES module graph boots headlessly (scripts/boot-smoke.mjs)
     8. index.html is generated from src/game.dom.html, not hand-edited
     9. the single-file phone build is current (scripts/build-single.mjs)
    10. public helper API (safeHero / heroName / HERO_COSTS) is consistent

   Fatal findings exit 1. Advisory notes are printed as info/warnings.
   ===================================================================== */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REGISTRY, HEROES, HERO_COSTS, FIGURES, ENEMIES, BOSSES, ITEMS, PROPS, MAPS,
  UPGRADES, UPGRADE_IDS, FILL_POOL, WAVE_RULES, ENEMY_CAPS, BOSS_NAMES,
  SCHEDULED_ELITES, OPENER_KIND,
  MAP_CONFIGS, PALETTES, SIM_CONTENT, DEFAULT_HERO,
  validateRegistry, describeRegistry, contentSummary, hasHero, safeHero, heroName,
} from '../src/content/index.js';
import { computeDigests } from './digest-harness.mjs';
import { bodyFromIndex, expectedBody } from './sync-dom.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const gameSrc = read('src/game.js');
const errors = [], warnings = [], info = [];

function run(script, args = []) {
  return spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT, encoding: 'utf8',
  });
}

/* ---- 1. schema ------------------------------------------------------ */
{
  const { errors: e, warnings: w, counts } = validateRegistry(REGISTRY);
  errors.push(...e.map((x) => 'schema: ' + x));
  warnings.push(...w);
  info.push('registry  ' + describeRegistry(REGISTRY));
  const expected = { HEROES: 5, FIGURES: 9, ENEMIES: 7, BOSSES: 3,
                     ITEMS: 3, PROPS: 14, MAPS: 3, UPGRADES: 9 };
  for (const [k, v] of Object.entries(expected)) {
    if (counts[k] !== v) errors.push(`schema: expected ${v} ${k}, found ${counts[k]}`);
  }
  info.push('counts    ' + JSON.stringify(counts));
}

/* ---- 2. no duplicated content literal left in game.js --------------- */
{
  const banned = [
    [/const TINTS\s*=\s*\{/, 'TINTS palette literal'],
    [/function bodyParts\s*\(/, 'hand-written bodyParts()'],
    [/const PALETTES\s*=\s*\[/, 'PALETTES literal'],
    [/const UPGRADES\s*=\s*\[/, 'UPGRADES literal'],
    [/const BOSS_NAMES\s*=\s*\[/, 'BOSS_NAMES literal'],
    [/const SLASH_TIP\s*=\s*\{/, 'SLASH_TIP literal'],
    [/mesh\.scale\.setScalar\(1\.65\)/, 'hard-coded figure scale chain'],
    [/addT\('soldier'/, 'hard-coded weighted fill pool'],
    [/CAP\.rangers/, 'plural cap aliases (legacy CFG.caps shape)'],
    [/FXSHAKE\(0\./, 'PART 2 reaching into the render layer for shake'],
    [/'ASHEN WARDEN'/, 'hard-coded boss name'],
    [/new T\.PlaneGeometry\(150,150\)/, 'hard-coded ground plane size'],
    [/mkRng\(4400\+ch\*313\)/, 'hard-coded ground texture seed'],
  ];
  for (const [rx, label] of banned) {
    if (rx.test(gameSrc)) errors.push(`wiring: src/game.js still contains ${label}`);
  }
  const required = [
    ["from './content/index.js'", 'content registry import'],
    ['assertRegistry(REGISTRY)', 'boot-time registry assertion'],
    ['Object.assign({}, RULES, {', 'CFG derived from RULES'],
    ['heroCosts: HERO_COSTS', 'hero costs derived from HEROES'],
    ['const UPGRADES = UPGRADE_LIST', 'level-up cards derived from descriptors'],
    ['FIGURES[kind]||FIGURES.hero', 'rigParts resolved from FIGURES'],
    ['FIGURE_SCALES[kind]', 'view scale derived from FIGURES'],
    ['for(const f of FILL_POOL)', 'fill pool derived from ENEMIES'],
    ['for(const k of SCHEDULED_ELITES)', 'scheduled elites derived from ENEMIES'],
    ['by[OPENER_KIND]', 'opening spawn derived from ENEMIES'],
    ['ITEM_DROPS.gem', 'drop table derived from ITEMS'],
    ['d=sim.map,V=PROPS', 'prop view data derived from PROPS'],
    ['MAP_CONFIGS[chapter-1]', 'map data derived from MAPS'],
    ['BOSS_NAMES', 'boss names derived from BOSSES'],
    ["case 'shake': FXSHAKE(e.v)", 'shake event consumed by the view'],
    ['CFG.meta.tracks.map(trackBtn)', 'Armoury tracks derived from RULES.meta'],
  ];
  for (const [needle, label] of required) {
    if (!gameSrc.includes(needle)) errors.push(`wiring: missing ${label} ("${needle}")`);
  }
  for (const [file, tag] of [
    ['src/content/palettes.js', 'DEPRECATED'],
    ['src/content/upgrades.js', 'DEPRECATED'],
  ]) {
    if (!read(file).includes(tag))
      errors.push(`wiring: ${file} is still a hand-maintained mirror, not a compatibility shim`);
  }
  info.push('wiring    game.js has no content literals; obsolete mirrors are shims');
}

/* ---- 3. cross-type references + load-bearing order ------------------ */
{
  for (const [type, table] of [['HEROES', HEROES], ['ENEMIES', ENEMIES], ['BOSSES', BOSSES]]) {
    for (const [key, d] of Object.entries(table)) {
      if (!FIGURES[d.figure])
        errors.push(`refs: ${type}.${key}.figure "${d.figure}" has no figure descriptor`);
    }
  }
  for (const [ch, m] of Object.entries(MAPS)) {
    if (!Object.values(BOSSES).some((b) => b.id === m.bossId))
      errors.push(`refs: MAPS.${ch}.bossId "${m.bossId}" has no boss descriptor`);
    if (m.chapter !== Number(ch))
      errors.push(`refs: MAPS.${ch}.chapter is ${m.chapter}, key mismatch`);
    if (!m.map.eventPack.length) errors.push(`refs: MAPS.${ch} has an empty chapter event pack`);
  }
  if (BOSS_NAMES.length !== Object.keys(BOSSES).length)
    errors.push('refs: BOSS_NAMES length does not match BOSSES');
  if (PALETTES.length !== Object.keys(MAPS).length || MAP_CONFIGS.length !== PALETTES.length)
    errors.push('refs: PALETTES / MAP_CONFIGS length does not match MAPS');
  const orders = FILL_POOL.map((f) => ENEMIES[f.kind].fill.order);
  if (new Set(orders).size !== orders.length)
    errors.push('refs: duplicate enemy fill.order — weighted RNG order would be ambiguous');
  for (let i = 1; i < orders.length; i++) {
    if (orders[i] <= orders[i - 1]) errors.push('refs: FILL_POOL is not sorted by fill.order');
  }
  /* Elite priority order decides which scheduled elite wins a tie; a reorder
     changes nothing in the digest today, but it would silently change spawns
     if two elites ever became eligible on the same tick. */
  const prio = SCHEDULED_ELITES.map((k) => (ENEMIES[k].wave.priority || 0));
  for (let i = 1; i < prio.length; i++) {
    if (prio[i] <= prio[i - 1]) errors.push('refs: SCHEDULED_ELITES is not sorted by wave.priority');
  }
  if (!ENEMIES[OPENER_KIND] || !ENEMIES[OPENER_KIND].opensFight)
    errors.push(`refs: OPENER_KIND "${OPENER_KIND}" does not name a descriptor with opensFight:true`);
  for (const f of FILL_POOL) {
    if (!ENEMY_CAPS[f.kind] && !(WAVE_RULES[f.kind] && WAVE_RULES[f.kind].cap))
      errors.push(`refs: FILL_POOL kind "${f.kind}" has no alive cap`);
  }
  if (UPGRADE_IDS.length !== Object.keys(UPGRADES).length)
    errors.push('refs: UPGRADE_IDS length does not match UPGRADES');
  /* The weighted pool order and the upgrade-card order both consume sim.rng.
     SIM_CONTENT below hashes both, so a reorder cannot slip through. */
  info.push(`refs      ${Object.keys(FIGURES).length} figures, ${FILL_POOL.length} pool entries, ` +
            `${UPGRADE_IDS.length} upgrade cards, ${BOSS_NAMES.length} boss names`);
}

/* ---- 4. figure descriptors still reproduce the legacy rig ----------- */
{
  const r = run('extract-figures.mjs', ['--check']);
  if (r.status !== 0) errors.push('figures: descriptors drifted from the legacy rig\n    ' +
    (r.stderr || r.stdout || '').trim().split('\n').slice(0, 3).join('\n    '));
  else info.push('figures   ' + (r.stdout || '').trim().split('\n')[0]);
}

/* ---- 5. SIM_CONTENT / deterministic digest gate --------------------- */
{
  let baseline;
  try { baseline = JSON.parse(read('scripts/content-baseline.json')); }
  catch (e) { errors.push('digest: no baseline — run npm run content:baseline'); }
  const now = await computeDigests();
  if (baseline) {
    if (baseline.simContentSha256 !== now.simContentSha256)
      errors.push('sim-content: a simulation number in a descriptor changed — re-record the ' +
        'baseline with npm run content:baseline AND bump RULES.net.build');
    for (const [k, v] of Object.entries(baseline.checks)) {
      if (now.checks[k] !== v)
        errors.push(`digest: ${k} moved (${v} -> ${now.checks[k] || 'missing'})`);
    }
    if (baseline.combined !== now.combined)
      errors.push('digest: combined hash moved — simulation behaviour changed');
    if (baseline.build !== now.build)
      errors.push(`digest: net build moved ${baseline.build} -> ${now.build} (bump both builds)`);
    if (JSON.stringify(baseline.heroCosts) !== JSON.stringify(now.heroCosts))
      errors.push('digest: CFG.meta.heroCosts no longer matches the recorded baseline');
    if (JSON.stringify(now.heroCosts) !== JSON.stringify(HERO_COSTS))
      errors.push('digest: CFG.meta.heroCosts no longer matches HERO_COSTS from the registry');
    info.push(`digest    ${now.combined.slice(0, 16)}… unchanged, net ${now.build}`);
    info.push(`sim       ${now.simContentSha256.slice(0, 16)}… descriptor sim numbers locked`);
  }
  /* The projection itself must stay complete, or the hash is meaningless. */
  if (!SIM_CONTENT || !SIM_CONTENT.rules || !SIM_CONTENT.upgradeOrder)
    errors.push('sim-content: SIM_CONTENT projection is incomplete');
}

/* ---- 6. real module-graph boot (CONTENT-GUIDE.md 5.1) ---------------- */
/* Separate process on purpose: boot-smoke installs global DOM/engine stubs
   which must never leak into this checker's own process. */
{
  const r = run('boot-smoke.mjs');
  if (r.status !== 0) {
    const out = (r.stderr || r.stdout || '').trim().split('\n').slice(0, 6).join('\n    ');
    errors.push(`boot: module graph did not boot cleanly\n    ${out}`);
  } else {
    const lines = (r.stdout || '').trim().split('\n');
    info.push('boot      ' + lines[0].replace(/^boot OK — /, 'OK — '));
    for (const l of lines.slice(1)) info.push('boot      ' + l.trim());
  }
}

/* ---- 7. index.html is a generated mirror of game.dom.html ---------- */
{
  const body = bodyFromIndex(read('index.html'));
  if (body === null) errors.push('dom: could not locate body region in index.html');
  else if (body !== expectedBody())
    errors.push('dom: index.html has drifted from src/game.dom.html — run npm run dom:sync');
  else info.push('dom       index.html generated from src/game.dom.html');
}

/* ---- 8. single-file phone build ------------------------------------ */
{
  const out = join(ROOT, 'dist-single', 'aetherblade.html');
  if (!existsSync(out)) {
    errors.push('single: dist-single/aetherblade.html missing — run npm run single:build');
  } else {
    const r = run('build-single.mjs', ['--check']);
    if (r.status !== 0) errors.push('single: phone build is stale — run npm run single:build\n    ' +
      (r.stderr || r.stdout || '').trim().split('\n').slice(0, 4).join('\n    '));
    else info.push('single    ' + (r.stdout || '').trim().split('\n')[0]);
    /* Byte equality is not enough: actually execute the inlined ESM bundle. */
    const b = run('single-smoke.mjs');
    if (b.status !== 0) errors.push('single: inlined bundle did not boot\n    ' +
      (b.stderr || b.stdout || '').trim().split('\n').slice(0, 6).join('\n    '));
    else info.push('single    ' + (b.stdout || '').trim().split('\n').filter((l) => l.startsWith('single OK'))[0]);
  }
}

/* ---- 9. public helper API ------------------------------------------- */
{
  if (safeHero('__unknown_skin__') !== DEFAULT_HERO)
    errors.push(`helpers: safeHero() did not fall back to "${DEFAULT_HERO}"`);
  if (!hasHero(DEFAULT_HERO) || heroName(DEFAULT_HERO) !== HEROES[DEFAULT_HERO].displayName)
    errors.push('helpers: default hero lookup / display name is broken');
  if (Object.keys(HERO_COSTS).length !== Object.keys(HEROES).length - 1)
    errors.push('helpers: HERO_COSTS should price every non-default hero');
  info.push('helpers   safeHero / heroName / HERO_COSTS consistent');
  info.push('content   ' + contentSummary().counts.HEROES + ' heroes, ' +
    Object.keys(ITEMS).length + ' items, ' + Object.keys(PROPS).length + ' props, ' +
    Object.keys(MAPS).length + ' maps');
}

/* ---- report --------------------------------------------------------- */
for (const line of info) console.log('  ' + line);
for (const w of warnings) console.log('  WARN  ' + w);
if (errors.length) {
  for (const e of errors) console.error('  FAIL  ' + e);
  console.error(`\ncontent:check FAILED — ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`\ncontent:check OK — ${info.length} checks passed, ${warnings.length} warning(s)`);
console.log('summary  ' + JSON.stringify(contentSummary().counts));
