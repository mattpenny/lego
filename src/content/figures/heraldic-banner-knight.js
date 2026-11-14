/* HERALDIC BANNER KNIGHT - figure descriptor.
   Derived from knight.js. Crimson cloth + gold trim. Adds a back banner pole
   and banner cloth visible above the head. meshScale 1.28 (same as knight).
   c = tint slot name; INK is shared near-black. */

import { knight } from './knight.js';

const baseParts = knight.parts;
const bannerParts = [
  { j:1, g:'cyl', o:[0,0.30,-0.42], s:[0.06,1.20,0.06], c:'dark' },
  { j:1, g:'box', o:[0,0.55,-0.42], s:[0.44,0.60,0.02], c:'trim' },
  { j:1, g:'box', o:[0,0.55,-0.41], s:[0.30,0.42,0.01], c:'cloth' },
  { j:1, g:'sph', o:[0,0.94,-0.42], s:[0.10,0.10,0.10], c:'trim' },
  { j:2, g:'box', o:[0,0.62,0], s:[0.10,0.24,0.10], c:'cloth', r:[0.10,0,0] },
  { j:2, g:'box', o:[0,0.82,-0.02], s:[0.14,0.16,0.06], c:'cloth', r:[0.35,0,0] },
];

export const heraldicBannerKnight = {
  id: 'heraldic-banner-knight',
  type: 'figure',
  displayName: 'HERALDIC BANNER KNIGHT',
  tint: {
    armor: [0.480, 0.500, 0.550],
    trim:  [0.870, 0.660, 0.180],
    cloth: [0.680, 0.130, 0.120],
    skin:  [0.960, 0.760, 0.170],
    blade: [0.780, 0.800, 0.860],
    dark:  [0.080, 0.080, 0.090],
    glow:  [0.960, 0.780, 0.360],
  },
  meshScale: 1.28,
  parts: [...baseParts, ...bannerParts],
  added: '2026-11-14',
  notes: 'Derived from knight.js. Crimson cloak + gold trim; back banner pole + cloth + gold finial.',
};

export default heraldicBannerKnight;
