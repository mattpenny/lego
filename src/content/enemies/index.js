/* =====================================================================
   ENEMY REGISTRY — one file per kind, one barrel here.

   This is now the SOURCE OF TRUTH for CFG.enemy, CFG.caps and CFG.wave.
   src/game.js no longer contains any per-enemy literal. The derived tables
   below are the only thing the deterministic sim reads; the per-kind files
   are what a content author edits.

   `fill.order` is load-bearing: it fixes the weighted-pool iteration order
   in spawnEnemy(), and RNG consumption depends on that order. Do not
   reshuffle it without recording a new digest baseline + net build bump.
   ===================================================================== */

import { deepFreeze } from '../schema.js';
import { brute } from './brute.js';
import { runner } from './runner.js';
import { ranger } from './ranger.js';
import { soldier } from './soldier.js';
import { archer } from './archer.js';
import { sorcerer } from './sorcerer.js';
import { knight } from './knight.js';
import { MELEE_DEFAULTS, GLOBAL_ENEMY_CAP } from './shared.js';
import { BOSSES, BOSS_NAMES, BOSS_CFG, BOSS_PHASE2, BOSS_FIGURE, BOSS_IDS } from './bosses/index.js';

export const ENEMIES = deepFreeze({
  brute, runner, ranger, soldier, archer, sorcerer, knight,
});
export const ENEMY_KINDS = deepFreeze(Object.keys(ENEMIES));

/** CFG.enemy: four shared melee defaults + one entry per kind. */
export const ENEMY_CFG = deepFreeze(Object.assign({}, MELEE_DEFAULTS,
  Object.fromEntries(Object.entries(ENEMIES).map(([kind, d]) => [kind, d.cfg]))));

/** CFG.caps: the one global cap plus each descriptor's per-kind alive cap. */
export const ENEMY_CAPS = deepFreeze(Object.assign(
  { enemies: GLOBAL_ENEMY_CAP },
  Object.fromEntries(Object.values(ENEMIES).map((d) => [d.kind, d.cap])),
));

/** CFG.wave: only kinds with a scheduled wave entry appear here. */
export const WAVE_RULES = deepFreeze(Object.fromEntries(
  Object.values(ENEMIES).filter((d) => d.wave).map((d) => [d.kind, d.wave]),
));

/** Weighted fill pool, in deterministic iteration order. */
export const FILL_POOL = deepFreeze(Object.values(ENEMIES)
  .filter((d) => d.fill)
  .slice()
  .sort((a, b) => a.fill.order - b.fill.order)
  .map((d) => ({
    kind: d.kind,
    weight: d.fill.weight,
    ramp: d.fill.ramp || 0,
    from: d.fill.from === undefined ? 0 : d.fill.from,
  })));

/** Scheduled elites: every descriptor with a repeating wave entry, in
    priority order. Replaces the hard-coded knight-then-sorcerer if/else. */
export const SCHEDULED_ELITES = deepFreeze(Object.values(ENEMIES)
  .filter((d) => d.wave && d.wave.every !== undefined)
  .slice()
  .sort((a, b) => (a.wave.priority || 0) - (b.wave.priority || 0))
  .map((d) => d.kind));

/** The kind that always opens a run (first spawn while kills === 0). */
export const OPENER_KIND = (Object.values(ENEMIES).find((d) => d.opensFight) || {}).kind || 'soldier';

export { BOSSES, BOSS_NAMES, BOSS_CFG, BOSS_PHASE2, BOSS_FIGURE, BOSS_IDS, MELEE_DEFAULTS };
