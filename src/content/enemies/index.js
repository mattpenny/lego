/* Enemy registry — the one import point for every kind descriptor.
   Keys match the game's kind names (CFG.enemy keys in src/game.js).
   soldier.js and knight.js are fully worked; the rest are honest stubs
   carrying their real CFG values (see each file's TODO).
   Phase-1 note: src/game.js does not consume this registry yet. */

import { brute } from './brute.js';
import { runner } from './runner.js';
import { ranger } from './ranger.js';
import { soldier } from './soldier.js';
import { archer } from './archer.js';
import { sorcerer } from './sorcerer.js';
import { knight } from './knight.js';
import { ashenWarden } from './bosses/ashen-warden.js';
import { graveSovereign } from './bosses/grave-sovereign.js';
import { magmaTyrant } from './bosses/magma-tyrant.js';

export const ENEMIES = {
  brute,
  runner,
  ranger,
  soldier,
  archer,
  sorcerer,
  knight,
};

/* Chapter bosses, keyed by chapter (BOSS_NAMES order in game.js). */
export const BOSSES = {
  1: ashenWarden,
  2: graveSovereign,
  3: magmaTyrant,
};

export const ENEMY_KINDS = Object.keys(ENEMIES);
