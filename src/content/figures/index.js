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
import { frostarcher } from './frostarcher.js';
import { dwarf } from './dwarf.js';
/* Heraldic knights + archers from the LEGO reference photos. */
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
import { crossbowman } from './crossbowman.js';
import { russetArcher } from './russet-archer.js';
import { tealArcher } from './teal-archer.js';
/* Content pack 2026-11-14: the Ansum signature skin, the two reference-grid
   infantry figures, and the Spiked Ogre + its rust-hide twin variant. */
import { ansum } from './ansum.js';
import { spikedOgre } from './ogre.js';
import { ogreRust } from './ogre-rust.js';
import { blackRaven } from './black-raven.js';
import { spearman } from './spearman.js';

export const FIGURES = deepFreeze({
  hero, knight, soldier, brute, runner, ranger, archer, sorcerer, boss,
  dragon, 'knight-mount': knightMount, frostarcher, dwarf,
  'raven-knight': ravenKnight, 'eagle-knight': eagleKnight,
  'crimson-knight': crimsonKnight, 'axe-knight': axeKnight,
  'sun-knight': sunKnight, 'azure-knight': azureKnight,
  'obsidian-knight': obsidianKnight, 'unicorn-knight': unicornKnight,
  'lion-knight': lionKnight, 'kraken-knight': krakenKnight,
  'tower-knight': towerKnight, 'dragon-knight': dragonKnight,
  crossbowman, 'russet-archer': russetArcher, 'teal-archer': tealArcher,
  ansum, ogre: spikedOgre, 'ogre-rust': ogreRust,
  'black-raven': blackRaven, spearman,
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
