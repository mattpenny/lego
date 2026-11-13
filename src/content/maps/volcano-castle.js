/* CHAPTER 3 — VOLCANO CASTLE.
   Burnt crowns, lava pools and a ring of castle walls around the keep. */
export const volcanoCastle = {
  id: 'volcano-castle', type: 'map', chapter: 3,
  displayName: 'VOLCANO CASTLE', bossId: 'iron-lancer',
  palette: {
    name: 'VOLCANO CASTLE', sky: 0x7a3a30, fog: 0x84452f,
    ground: '#4d3638', ground2: '#63453a', path: '#7d5a44',
    pond: 0xff7030, tree: 0x5c3d2d, trunk: 0x4d3630, rock: 0x745854,
    hill: 0x654a3e, accent: 0xffa657, light: 0xffb070, hemi: 0xc97f66, amb: 0.92,
    texStyle: 'ash', sunIntensity: 1.30, lavaWater: true,
  },
  map: {
    seed: 33458,                 // 9701 + chapter*7919
    pond: { x: -19, z: 12, r: 4.6 },
    landmark: { x: 20, z: -18 }, landmarkStyle: 'keep',
    trees: 12, canopyKind: 2, canopyScale: 1.25,
    rocks: 30, pillars: 18, stones: 0,
    fenceRuns: 6, hills: 64, torches: 12, lavaPools: 9, reeds: 18,
    eventPack: ['knight', 'sorcerer'],
  },
  added: '2026-11-13',
  notes: 'Six castle walls (block kind 4, capsule colliders) around a central keep (kind 5). Victory is here.',
};
export default volcanoCastle;
