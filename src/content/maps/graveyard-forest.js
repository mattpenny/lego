/* CHAPTER 2 — GRAVEYARD FOREST.
   Dead-tree canopies, gravestones and a crypt landmark. */
export const graveyardForest = {
  id: 'graveyard-forest', type: 'map', chapter: 2,
  displayName: 'GRAVEYARD FOREST', bossId: 'grave-sovereign',
  palette: {
    name: 'GRAVEYARD FOREST', sky: 0x5a7396, fog: 0x64807a,
    ground: '#40604b', ground2: '#4f7358', path: '#92927f',
    pond: 0x43a89e, tree: 0x406652, trunk: 0x615244, rock: 0x939e97,
    hill: 0x6d7d78, accent: 0xc2ecdc, light: 0xbcd0ff, hemi: 0x9db9e2, amb: 0.95,
  },
  map: {
    seed: 25539,                 // 9701 + chapter*7919
    pond: { x: 17, z: -16, r: 5.2 },
    landmark: { x: 18, z: -18 }, landmarkStyle: 'crypt',
    trees: 34, canopyKind: 1, canopyScale: 1.0,
    rocks: 24, pillars: 12, stones: 30,
    fenceRuns: 6, hills: 64, torches: 12, lavaPools: 0, reeds: 18,
    eventPack: ['sorcerer', 'archer', 'archer'],
  },
  added: '2026-11-13',
  notes: 'Crypt (block kind 2) plus four grave markers (kind 3); 30 gravestones from tryPlace().',
};
export default graveyardForest;
