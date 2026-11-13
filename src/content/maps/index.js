/* Map registry — one file per chapter.
   PALETTES and every per-chapter buildMapData() constant are derived here. */

import { deepFreeze } from '../schema.js';
import { grassland } from './grassland.js';
import { graveyardForest } from './graveyard-forest.js';
import { volcanoCastle } from './volcano-castle.js';
/* Chapters 4-6 — themed expansion (snow / volcanic / dark age), adopted
   from Matt's maps handoff 2026-11-14 (descriptors as data; the pack's
   one-off generator was NOT adopted — edit these files directly). */
import { frostfallGlacier } from './frostfall-glacier.js';
import { emberCaldera } from './ember-caldera.js';
import { darkAgeSiege } from './dark-age-siege.js';

export const MAPS = deepFreeze({
  1: grassland, 2: graveyardForest, 3: volcanoCastle,
  4: frostfallGlacier, 5: emberCaldera, 6: darkAgeSiege,
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
