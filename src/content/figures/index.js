/* Figure registry — one file per visual character design.
   A figure owns its palette AND its moulded part list. Heroes, enemies and
   bosses reference a figure by id; nothing else duplicates TINTS or parts. */

import { deepFreeze } from '../schema.js';
import { hero } from './hero.js';
import { knight } from './knight.js';
import { soldier } from './soldier.js';
import { brute } from './brute.js';
import { runner } from './runner.js';
import { ranger } from './ranger.js';
import { archer } from './archer.js';
import { sorcerer } from './sorcerer.js';
import { boss } from './boss.js';
import { dragon } from './dragon.js';
import { knightMount } from './knight-mount.js';

export const FIGURES = deepFreeze({
  hero, knight, soldier, brute, runner, ranger, archer, sorcerer, boss,
  dragon, 'knight-mount': knightMount,
});
export const FIGURE_IDS = deepFreeze(Object.keys(FIGURES));

/** Shared near-black ink used for printed faces on every minifigure. */
export const FIGURE_INK = deepFreeze([0.045, 0.045, 0.055]);

/** TINTS — derived, never hand-written. View-only, never hashed by simDigest. */
export const TINTS = deepFreeze(Object.fromEntries(
  Object.values(FIGURES).map((f) => [f.id, f.tint]),
));

/** Per-figure view scale (makeView). Unlisted figures render at 1.00. */
export const FIGURE_SCALES = deepFreeze(Object.fromEntries(
  Object.values(FIGURES).map((f) => [f.id, f.meshScale]),
));
