/* DEPRECATED phase-1 mirror — kept only as a compatibility shim.
   Level-up cards are now authoritative in src/content/upgrades/<id>.js:
   one descriptor per card. src/content/upgrades/index.js derives the
   ordered UPGRADE_LIST consumed by pickChoices(). The ORDER is load-bearing.

   Old shape preserved: UPGRADES is an ARRAY (not the new id-keyed registry)
   and META is re-derived from RULES.meta + the hero descriptors. Neither
   file contains content data any more. */
import { RULES } from './rules.js';
import { HERO_COSTS } from './heroes/index.js';
import { UPGRADE_LIST } from './upgrades/index.js';

export const UPGRADES = UPGRADE_LIST;
export default UPGRADE_LIST;

export const META = Object.freeze({
  costs: RULES.meta.costs,
  steps: RULES.meta.steps,
  clearBonus: RULES.meta.clearBonus,
  victoryBonus: RULES.meta.victoryBonus,
  tracks: RULES.meta.tracks,
  heroCosts: HERO_COSTS,
});
