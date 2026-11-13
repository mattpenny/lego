/* HEAL BRICK — 30% drop on any enemy kill, restores 20 HP. */
export const heal = {
  id: 'heal',
  type: 'item',
  displayName: 'HEAL BRICK',
  sim: {
    drop: 'chance',
    chance: 0.30,          // CFG.heal.chance — one rnd(s) roll per kill
    amount: 20,            // CFG.heal.amount
    offset: [0.35, -0.25],
    pool: 'heals',
  },
  view: {
    mesh: 'healMesh', geometry: 'brick',
    body: [0.80, 0.07, 0.08], stud: [0.88, 0.13, 0.14], emblem: [0.96, 0.96, 0.96],
    instanceCap: 32, spin: 0,
  },
  added: '2026-11-13',
  notes: 'Heals the nearest living hero; in co-op each brick heals only one hero.',
};
export default heal;
