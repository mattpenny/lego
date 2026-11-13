/* Map registry — one file per chapter.
   PALETTES and every per-chapter buildMapData() constant are derived here. */

import { deepFreeze } from '../schema.js';
import { grassland } from './grassland.js';
import { graveyardForest } from './graveyard-forest.js';
import { volcanoCastle } from './volcano-castle.js';

export const MAPS = deepFreeze({
  1: grassland, 2: graveyardForest, 3: volcanoCastle,
});
export const MAP_IDS = deepFreeze(Object.values(MAPS).map((m) => m.id));

/** Ordered by chapter: PALETTES[ch-1] and MAP_CONFIGS[ch-1]. */
export const PALETTES = deepFreeze(Object.values(MAPS).map((m) => m.palette));
export const MAP_CONFIGS = deepFreeze(Object.values(MAPS).map((m) => m.map));
export const CHAPTER_NAMES = deepFreeze(PALETTES.map((p) => p.name));
export const EVENT_PACKS = deepFreeze(Object.fromEntries(
  Object.values(MAPS).map((m) => [m.chapter, m.map.eventPack]),
));

export function mapForChapter(chapter) {
  return MAPS[chapter] || MAPS[1];
}
