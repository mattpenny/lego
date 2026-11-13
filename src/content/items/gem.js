/* XP GEM — dropped by EVERY enemy kill. One instanced dodecahedron. */
export const gem = {
  id: 'gem',
  type: 'item',
  displayName: 'XP GEM',
  sim: {
    drop: 'always',        // no RNG roll — one gem per kill
    xp: 1,
    score: 10,
    offset: [0, 0],        // [dx, dz] from the killed enemy
    pool: 'gems',
  },
  view: {
    mesh: 'gemMesh', geometry: 'dodecahedron', radius: 0.24,
    color: [0.40, 0.17, 0.88], sparkle: [0.54, 0.32, 0.98],
    instanceCap: 64, spin: 1.6,
  },
  added: '2026-11-13',
  notes: 'Collecting enough gems opens the level-up card (xpNeed = 8 + 6*(level-1)).',
};
export default gem;
