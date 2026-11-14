/* Boss registry — one descriptor file per chapter boss.
   BOSS_NAMES is DERIVED, so adding a chapter means adding one file here. */

import { deepFreeze } from '../../schema.js';
import { emeraldDrake } from './emerald-drake.js';
import { graveSovereign } from './grave-sovereign.js';
import { ironLancer } from './iron-lancer.js';
/* Chapter 4 — Matt's own boss (content pack 2026-11-14): THE SPIKED
   OGRE replaces the Grave Sovereign placeholder, fielded as a twin pair
   (see the descriptor's twinFigure). Chapters 5-6 remain PLACEHOLDER
   bosses (Matt creates his own later): the existing bosses reappear
   with late-game HP. The earlier handoff pack's frost-warden /
   cinder-lancer / siege-wyrm were NOT adopted. */
import { spikedOgre } from './spiked-ogre.js';
import { calderaDrake } from './caldera-drake.js';
import { siegeLancer } from './siege-lancer.js';
import { BOSS_CFG, BOSS_PHASE2, BOSS_FIGURE } from './shared.js';

export const BOSSES = deepFreeze({
  1: emeraldDrake, 2: graveSovereign, 3: ironLancer,
  4: spikedOgre, 5: calderaDrake, 6: siegeLancer,
});
export const BOSS_IDS = deepFreeze(Object.values(BOSSES).map((b) => b.id));

/** BOSS_NAMES[chapter-1] — replaces the hard-coded array in src/game.js. */
export const BOSS_NAMES = deepFreeze(Object.values(BOSSES).map((b) => b.name));

/** Per-chapter boss sim: a descriptor with its own `cfg` (the Emerald
    Drake) overrides the shared warlord numbers for its chapter only.
    Chapters without a `cfg` fall back to BOSS_CFG from shared.js. */
export const BOSS_CFG_BY_CHAPTER = deepFreeze(Object.fromEntries(
  Object.values(BOSSES).map((b) => [b.chapter, b.cfg || BOSS_CFG])));

export { BOSS_CFG, BOSS_PHASE2, BOSS_FIGURE };
