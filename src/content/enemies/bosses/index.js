/* Boss registry — one descriptor file per chapter boss.
   BOSS_NAMES is DERIVED, so adding a chapter means adding one file here. */

import { deepFreeze } from '../../schema.js';
import { ashenWarden } from './ashen-warden.js';
import { graveSovereign } from './grave-sovereign.js';
import { magmaTyrant } from './magma-tyrant.js';
import { BOSS_CFG, BOSS_PHASE2, BOSS_FIGURE } from './shared.js';

export const BOSSES = deepFreeze({
  1: ashenWarden, 2: graveSovereign, 3: magmaTyrant,
});
export const BOSS_IDS = deepFreeze(Object.values(BOSSES).map((b) => b.id));

/** BOSS_NAMES[chapter-1] — replaces the hard-coded array in src/game.js. */
export const BOSS_NAMES = deepFreeze(Object.values(BOSSES).map((b) => b.name));

export { BOSS_CFG, BOSS_PHASE2, BOSS_FIGURE };
