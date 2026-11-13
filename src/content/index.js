/* =====================================================================
   CONTENT REGISTRY — single source of truth for the WHOLE game.

   One folder per content TYPE, one file per content ID, one barrel here.
   Everything below is pure data (no three.js, no DOM, no Math.random, no
   Date.now), so it is safe for the deterministic sim, the view, Node
   tooling and the browser boot path alike.

   src/game.js imports ONLY from this file. It contains no content literal
   any more: CFG, PALETTES, UPGRADES, TINTS, rigParts(), buildMapData(),
   BOSS_NAMES and the level-up cards are all DERIVED from descriptors.

   Field conventions
     sim / cfg   simulation input — changing it moves simDigest()
     view        colours / geometry / scale — provably digest-safe
     added       ISO date, for provenance and the "traceable" report
   ===================================================================== */

import { deepFreeze, assertRegistry, validateRegistry, describeRegistry } from './schema.js';
import { RULES } from './rules.js';
import {
  HEROES, HERO_IDS, HERO_COSTS, HERO_SLASH_TIPS,
  DEFAULT_HERO, hasHero, safeHero, heroName,
} from './heroes/index.js';
import {
  FIGURES, FIGURE_IDS, FIGURE_INK, TINTS, FIGURE_SCALES,
} from './figures/index.js';
import {
  ENEMIES, ENEMY_KINDS, ENEMY_CFG, ENEMY_CAPS, WAVE_RULES, FILL_POOL,
  SCHEDULED_ELITES, OPENER_KIND,
  BOSSES, BOSS_NAMES, BOSS_CFG, BOSS_PHASE2, BOSS_FIGURE, BOSS_IDS,
  MELEE_DEFAULTS,
} from './enemies/index.js';
import {
  ITEMS, ITEM_IDS, ITEM_DROPS, HEAL_CFG, POTION_CFG,
  ELITE_KINDS, GEM_SCORE, GEM_XP,
} from './items/index.js';
import {
  PROPS, PROP_IDS, PLACE_RADII, BLOCK_R, BLOCK_FALLBACK_R,
  WALL_KIND, WALL_HALF_LENGTH, WALL_RADIUS, POND_PAD, FENCE_RADIUS, TORCH_RADIUS,
} from './props/index.js';
import {
  MAPS, MAP_IDS, PALETTES, MAP_CONFIGS, CHAPTER_NAMES, EVENT_PACKS, mapForChapter,
} from './maps/index.js';
import { UPGRADES, UPGRADE_IDS, UPGRADE_LIST } from './upgrades/index.js';

export const REGISTRY = deepFreeze({
  HEROES, FIGURES, ENEMIES, BOSSES, ITEMS, PROPS, MAPS, UPGRADES,
});

/**
 * SIM_CONTENT — ONLY the numbers the deterministic simulation reads.
 * scripts/content-check.mjs hashes this (stable, sorted JSON) into
 * scripts/content-baseline.json. Editing a simulation number in ANY
 * descriptor therefore fails the gate until a baseline is re-recorded and
 * the net build stamp is bumped. View/colour/geometry edits are excluded
 * on purpose: they must stay provably digest-safe.
 */
export const SIM_CONTENT = deepFreeze({
  rules: RULES,
  heroCosts: HERO_COSTS, slashTips: HERO_SLASH_TIPS,
  enemies: ENEMY_CFG, caps: ENEMY_CAPS, wave: WAVE_RULES, fillPool: FILL_POOL,
  scheduledElites: SCHEDULED_ELITES, openerKind: OPENER_KIND,
  boss: BOSS_CFG, boss2: BOSS_PHASE2,
  heal: HEAL_CFG, potion: POTION_CFG, eliteKinds: ELITE_KINDS,
  gemScore: GEM_SCORE, gemXp: GEM_XP,
  propRadii: PLACE_RADII, blockR: BLOCK_R, blockFallbackR: BLOCK_FALLBACK_R,
  wallKind: WALL_KIND, wallHalfLength: WALL_HALF_LENGTH, wallRadius: WALL_RADIUS,
  pondPad: POND_PAD, fenceRadius: FENCE_RADIUS, torchRadius: TORCH_RADIUS,
  maps: MAP_CONFIGS, eventPacks: EVENT_PACKS,
  upgradeOrder: UPGRADE_IDS,
});

export {
  deepFreeze, assertRegistry, validateRegistry, describeRegistry,
  RULES,
  HEROES, HERO_IDS, HERO_COSTS, HERO_SLASH_TIPS,
  DEFAULT_HERO, hasHero, safeHero, heroName,
  FIGURES, FIGURE_IDS, FIGURE_INK, TINTS, FIGURE_SCALES,
  ENEMIES, ENEMY_KINDS, ENEMY_CFG, ENEMY_CAPS, WAVE_RULES, FILL_POOL,
  SCHEDULED_ELITES, OPENER_KIND,
  BOSSES, BOSS_NAMES, BOSS_CFG, BOSS_PHASE2, BOSS_FIGURE, BOSS_IDS, MELEE_DEFAULTS,
  ITEMS, ITEM_IDS, ITEM_DROPS, HEAL_CFG, POTION_CFG, ELITE_KINDS, GEM_SCORE, GEM_XP,
  PROPS, PROP_IDS, PLACE_RADII, BLOCK_R, BLOCK_FALLBACK_R,
  WALL_KIND, WALL_HALF_LENGTH, WALL_RADIUS, POND_PAD, FENCE_RADIUS, TORCH_RADIUS,
  MAPS, MAP_IDS, PALETTES, MAP_CONFIGS, CHAPTER_NAMES, EVENT_PACKS, mapForChapter,
  UPGRADES, UPGRADE_IDS, UPGRADE_LIST,
};

/** Compact manifest for tooling / debug overlays. */
export function contentSummary() {
  const { counts } = validateRegistry(REGISTRY);
  return {
    counts,
    heroes: HERO_IDS, figures: FIGURE_IDS, enemyKinds: ENEMY_KINDS,
    items: ITEM_IDS, props: PROP_IDS, maps: MAP_IDS, upgrades: UPGRADE_IDS,
  };
}

export default REGISTRY;
