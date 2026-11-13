/* CANOPY — lifted above the hero so leaves are walk-through. Four looks:
   kind 0 green, kind 1 dead (forest / dark age), kind 2 burnt (volcano),
   kind 3 snow-laden (glacier). Kind 3 is a view-only colour + scale
   variant of the same cone geometry, so it adds no draw call. */
export const canopy = {
  id: 'canopy', type: 'prop', displayName: 'TREE CANOPY',
  mapKey: 'canopy', chapters: [1, 2, 3, 4, 5, 6],
  placement: { follows: 'trunk' },
  collider: { kind: 'none' },
  view: { geometry: 'cone', segments: 7, paletteSlot: 'tree',
          deadColor: 0x51654e, burntColor: 0x4a322b, snowColor: 0xeaf6ff,
          liftNormal: 4.4, liftDead: 3.4, liftSnow: 4.6,
          scaleNormal: [2.5, 3.2, 2.5], scaleDead: [1.5, 1.6, 1.5],
          scaleSnow: [2.7, 3.5, 2.7] },
  added: '2026-11-13',
  notes: 'View-only; no collider. Chapter map sets canopyKind and canopyScale. Kind 3 (snow) uses snowColor / liftSnow / scaleSnow.',
};
export default canopy;
