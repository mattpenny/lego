/* Item registry — one file per pickup type.
   `sim` values are the authoritative numbers the deterministic simulation
   reads; `view` describes the instanced cosmetic mesh. */

import { deepFreeze } from '../schema.js';
import { gem } from './gem.js';
import { heal } from './heal.js';
import { potion } from './potion.js';

export const ITEMS = deepFreeze({ gem, heal, potion });
export const ITEM_IDS = deepFreeze(Object.keys(ITEMS));

/** Flat drop table consumed by killEnemy()/collectPickups(). */
export const ITEM_DROPS = deepFreeze({
  gem: gem.sim, heal: heal.sim, potion: potion.sim,
});

/** Wiring helpers so game.js never hard-codes an item number. */
export const HEAL_CFG = deepFreeze({ chance: heal.sim.chance, amount: heal.sim.amount });
export const POTION_CFG = deepFreeze({ chance: potion.sim.chance, gain: potion.sim.gain });
export const ELITE_KINDS = deepFreeze(potion.sim.eliteKinds.slice());
export const GEM_SCORE = gem.sim.score;
export const GEM_XP = gem.sim.xp;
