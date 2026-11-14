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
/* Heraldic knight order — 12 shields from the LEGO reference grid. */
import { ravenKnight } from './raven-knight.js';
import { eagleKnight } from './eagle-knight.js';
import { crimsonKnight } from './crimson-knight.js';
import { axeKnight } from './axe-knight.js';
import { sunKnight } from './sun-knight.js';
import { azureKnight } from './azure-knight.js';
import { obsidianKnight } from './obsidian-knight.js';
import { unicornKnight } from './unicorn-knight.js';
import { lionKnight } from './lion-knight.js';
import { krakenKnight } from './kraken-knight.js';
import { towerKnight } from './tower-knight.js';
import { dragonKnight } from './dragon-knight.js';
/* Archers — wide-brim crossbowman + two hooded rangers. */
import { crossbowman } from './crossbowman.js';
import { russetArcher } from './russet-archer.js';
import { tealArcher } from './teal-archer.js';
/* Reference-grid infantry (content pack 2026-11-14): the hooded demon
   knight elite and the long-reach levy. Fill orders 20/21 continue the
   pool sequence; their stat blocks are the pack's, verbatim. */
import { blackRaven } from './black-raven.js';
import { spearman } from './spearman.js';
/* Archery pack 2026-11-14 (AB-NET-20): two regular ranged kinds (fill
   orders 22/23 continue the pool sequence) and two event-only elites
   whose signature mechanics (Marked Volley, banner) ride flattened
   cfg blocks — see their descriptors and CONTENT-GUIDE section 17. */
import { kettleArcher } from './kettle-archer.js';
import { crossbowHerald } from './crossbow-herald.js';
import { azureCrossbowCaptain } from './azure-crossbow-captain.js';
import { heraldicBannerKnight } from './heraldic-banner-knight.js';
import { MELEE_DEFAULTS, GLOBAL_ENEMY_CAP } from './shared.js';
import { BOSSES, BOSS_NAMES, BOSS_CFG, BOSS_PHASE2, BOSS_FIGURE, BOSS_IDS, BOSS_CFG_BY_CHAPTER } from './bosses/index.js';

export const ENEMIES = deepFreeze({
  brute, runner, ranger, soldier, archer, sorcerer, knight,
  'raven-knight': ravenKnight, 'eagle-knight': eagleKnight,
  'crimson-knight': crimsonKnight, 'axe-knight': axeKnight,
  'sun-knight': sunKnight, 'azure-knight': azureKnight,
  'obsidian-knight': obsidianKnight, 'unicorn-knight': unicornKnight,
  'lion-knight': lionKnight, 'kraken-knight': krakenKnight,
  'tower-knight': towerKnight, 'dragon-knight': dragonKnight,
  crossbowman, 'russet-archer': russetArcher, 'teal-archer': tealArcher,
  'black-raven': blackRaven, spearman,
  'kettle-archer': kettleArcher, 'crossbow-herald': crossbowHerald,
  'azure-crossbow-captain': azureCrossbowCaptain,
  'heraldic-banner-knight': heraldicBannerKnight,
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

export { BOSSES, BOSS_NAMES, BOSS_CFG, BOSS_PHASE2, BOSS_FIGURE, BOSS_IDS, BOSS_CFG_BY_CHAPTER, MELEE_DEFAULTS };
