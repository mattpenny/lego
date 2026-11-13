/* CHAPTER 1 — GRASSLAND.
   `palette` is the old PALETTES[0] entry; `map` is every per-chapter number
   buildMapData() used to hard-code. Both are now the source of truth. */
export const grassland = {
  id: 'grassland', type: 'map', chapter: 1,
  displayName: 'GRASSLAND', bossId: 'ashen-warden',
  palette: {
    name: 'GRASSLAND', sky: 0x8ec7f0, fog: 0xa4cda6,
    ground: '#4da337', ground2: '#66bb47', path: '#c7ab6d',
    pond: 0x2fa3dd, tree: 0x35a047, trunk: 0x7d5c39, rock: 0x9aa294,
    hill: 0x86a374, accent: 0xffd98a, light: 0xfff0d0, hemi: 0xbcd8ff, amb: 1.02,
  },
  map: {
    seed: 17620,                 // 9701 + chapter*7919
    pond: { x: -15, z: 14, r: 5.2 },
    landmark: { x: -20, z: -18 }, landmarkStyle: 'windmill',
    trees: 38, canopyKind: 0, canopyScale: 1.25,
    rocks: 24, pillars: 8, stones: 0,
    fenceRuns: 6, hills: 64, torches: 12, lavaPools: 0, reeds: 18,
    eventPack: ['knight'],       // 90-second chapter event
  },
  added: '2026-11-13',
  notes: 'Windmill tower (block kind 0) plus four millstones (kind 1).',
};
export default grassland;
