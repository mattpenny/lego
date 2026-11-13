/* MAGIC POTION — 25% drop from ELITE kills only, restores 10 magic. */
export const potion = {
  id: 'potion',
  type: 'item',
  displayName: 'MAGIC POTION',
  sim: {
    drop: 'chance',
    chance: 0.25,          // CFG.magic.potionChance
    gain: 10,              // CFG.magic.potionGain
    eliteKinds: ['sorcerer', 'knight'],  // only these kinds can roll a potion
    offset: [-0.35, 0.25],
    pool: 'potions',
  },
  view: {
    mesh: 'potionMesh', geometry: 'brick',
    body: [0.40, 0.17, 0.88], stud: [0.54, 0.32, 0.98], emblem: [0.88, 0.94, 1.00],
    instanceCap: 16, spin: 2.2,
  },
  added: '2026-11-13',
  notes: 'Elite-only. Adding a new elite kind means adding it to eliteKinds here.',
};
export default potion;
