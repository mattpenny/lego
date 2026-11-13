/* Hero registry — the ONE place that defines playable skins.
   Add a skin by creating <id>.js here and importing it below. Nothing in
   src/game.js needs to change: prices, Armoury buttons, slash tips and
   display names are all derived from this table.

   IMPORTANT: ids are permanent. They are stored in localStorage under
   `aetherblade-meta-v1` and travel in the co-op hello/start handshake.
   Never rename an id; add a new one instead. */

import { deepFreeze } from '../schema.js';
import { hero } from './hero.js';
import { soldier } from './soldier.js';
import { archer } from './archer.js';
import { sorcerer } from './sorcerer.js';
import { knight } from './knight.js';
import { frostarcher } from './frostarcher.js';
import { dwarf } from './dwarf.js';

export const HEROES = deepFreeze({ hero, soldier, archer, sorcerer, knight, frostarcher, dwarf });

export const DEFAULT_HERO = 'hero';

/** Purchasable skins only — feeds CFG.meta.heroCosts. */
export const HERO_COSTS = deepFreeze(Object.fromEntries(
  Object.values(HEROES).filter((h) => !h.default).map((h) => [h.id, h.price]),
));

/** Weapon-tip anchors — feeds SLASH_TIP. */
export const HERO_SLASH_TIPS = deepFreeze(Object.fromEntries(
  Object.values(HEROES).map((h) => [h.id, h.slashTip]),
));

/** Signature magic, keyed by hero id — only heroes WITH a signature are
    listed; every other skin casts the plain blast. This is the home the
    registry gives per-hero abilities: the descriptor carries the block,
    castMagic() reads it through this table via the caster's heroId.
    Simulation input — hashed into SIM_CONTENT. */
export const HERO_MAGIC = deepFreeze(Object.fromEntries(
  Object.values(HEROES).filter((h) => h.magic).map((h) => [h.id, h.magic]),
));

export const HERO_IDS = deepFreeze(Object.keys(HEROES));

export function hasHero(id) {
  return Object.prototype.hasOwnProperty.call(HEROES, id);
}

/** Old saves / older peers may carry an unknown skin id — never crash the rig. */
export function safeHero(id) {
  return hasHero(id) ? id : DEFAULT_HERO;
}

export function heroName(id) {
  return (HEROES[id] || HEROES[DEFAULT_HERO]).displayName;
}

export { hero, soldier, archer, sorcerer, knight, frostarcher, dwarf };
