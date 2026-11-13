/* CANOPY — lifted above the hero so leaves are walk-through. Three looks:
   kind 0 green, kind 1 dead (forest), kind 2 burnt (volcano). */
export const canopy = {
  id: 'canopy', type: 'prop', displayName: 'TREE CANOPY',
  mapKey: 'canopy', chapters: [1, 2, 3],
  placement: { follows: 'trunk' },
  collider: { kind: 'none' },
  view: { geometry: 'cone', segments: 7, paletteSlot: 'tree',
          deadColor: 0x51654e, burntColor: 0x4a322b,
          liftNormal: 4.4, liftDead: 3.4,
          scaleNormal: [2.5, 3.2, 2.5], scaleDead: [1.5, 1.6, 1.5] },
  added: '2026-11-13',
  notes: 'View-only; no collider. Chapter map sets canopyKind and canopyScale.',
};
export default canopy;
