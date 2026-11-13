/* POND REEDS — 18 cones ringing the pond. No collider. */
export const reeds = {
  id: 'reeds', type: 'prop', displayName: 'POND REEDS',
  mapKey: 'reeds', chapters: [1, 2, 3, 4, 5, 6],
  placement: { count: 18, fromPondEdge: [0.4, 1.5], scale: [0.6, 1.3] },
  collider: { kind: 'none' },
  view: { geometry: 'cone', segments: 5, offsetY: 0.42, scale: [0.25, 0.9, 0.25],
          colorByChapter: { 1: 0x5f9c4a, 2: 0x64766b, 3: 0x64766b,
                            4: 0x9fc6d8, 5: 0x6b3a24, 6: 0x6a6a4e } },
  added: '2026-11-13',
  notes: 'View-only dressing around the pond radius.',
};
export default reeds;
