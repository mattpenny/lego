/* Upgrade registry — one file per level-up card.
   ORDER IS LOAD-BEARING: pickChoices() rolls rndI(s, UPGRADES.length) over
   this array, so reordering changes which cards appear and moves the digest. */

import { deepFreeze } from '../schema.js';
import { hide } from './hide.js';
import { edge } from './edge.js';
import { tempo } from './tempo.js';
import { reach } from './reach.js';
import { boots } from './boots.js';
import { reflex } from './reflex.js';
import { magnet } from './magnet.js';
import { crit } from './crit.js';
import { siphon } from './siphon.js';

export const UPGRADES = deepFreeze({ hide, edge, tempo, reach, boots, reflex, magnet, crit, siphon });
export const UPGRADE_IDS = deepFreeze(Object.keys(UPGRADES));

/** The runtime card list game.js consumes (short field names kept for UI). */
export const UPGRADE_LIST = deepFreeze(Object.values(UPGRADES).map((u) => ({
  id: u.id, ic: u.ic, name: u.displayName, ds: u.description, apply: u.apply,
})));
