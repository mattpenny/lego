/* AZURE CROSSBOW CAPTAIN - figure descriptor.
   Variant of azure-crossbow-herald. Adds gold captain sash across the torso
   and a brighter plume. meshScale 1.05 for elite read at distance.
   c = tint slot name; INK is shared near-black. */

import { crossbowHerald } from './crossbow-herald.js';

const baseParts = crossbowHerald.parts;
const extraParts = [
  { j:1, g:'box', o:[0,0.28,0.245], s:[0.60,0.10,0.03], c:'trim', r:[0,0,0.45] },
  { j:1, g:'box', o:[0,0.28,-0.24], s:[0.60,0.10,0.03], c:'trim', r:[0,0,-0.45] },
  { j:2, g:'box', o:[0,0.62,0], s:[0.12,0.24,0.12], c:'armor', r:[0.10,0,0] },
  { j:2, g:'box', o:[0,0.82,-0.02], s:[0.16,0.18,0.08], c:'armor', r:[0.35,0,0] },
  { j:2, g:'box', o:[0,0.94,-0.06], s:[0.12,0.12,0.05], c:'armor', r:[0.75,0,0] },
];

export const azureCrossbowCaptain = {
  id: 'azure-crossbow-captain',
  type: 'figure',
  displayName: 'AZURE CROSSBOW CAPTAIN',
  tint: {
    armor: [0.170, 0.340, 0.820],
    trim:  [0.890, 0.690, 0.230],
    cloth: [0.100, 0.200, 0.560],
    skin:  [0.960, 0.770, 0.160],
    blade: [0.340, 0.150, 0.090],
    dark:  [0.070, 0.070, 0.080],
    glow:  [0.560, 0.620, 0.720],
    metal: [0.640, 0.680, 0.740],
  },
  meshScale: 1.05,
  parts: [...baseParts, ...extraParts],
  added: '2026-11-14',
  notes: 'Captain variant of azure-crossbow-herald. Gold sash + brighter plume + 1.05 scale.',
};

export default azureCrossbowCaptain;
