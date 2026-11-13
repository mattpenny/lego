/* HILL RING — 64 rocky mounds forming the visible edge of the arena.
   Purely cosmetic; ARENA_R (40 m) is the real movement boundary. */
export const hill = {
  id: 'hill', type: 'prop', displayName: 'TERRAIN EDGE HILLS',
  mapKey: 'hill', chapters: [1, 2, 3],
  placement: { count: 64, radius: [45, 51], scale: [6, 14] },
  collider: { kind: 'none' },
  view: { geometry: 'dodecahedron', paletteSlot: 'hill',
          offsetY: 0.32, scale: [1, 1.35, 0.85], rotation: [0.15, null, 0.1] },
  added: '2026-11-13',
  notes: 'View-only. Do not add colliders here or the arena effectively shrinks.',
};
export default hill;
