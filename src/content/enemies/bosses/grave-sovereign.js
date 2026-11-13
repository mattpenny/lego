/* GRAVE SOVEREIGN — chapter 2 boss (GRAVEYARD FOREST).
   Same shared sim + figure as chapter 1; the chapter palette carries the
   identity. If a variant is ever authored, its stats go in THIS file. */
export const graveSovereign = {
  id: 'grave-sovereign', type: 'boss', chapter: 2,
  name: 'GRAVE SOVEREIGN', displayName: 'GRAVE SOVEREIGN',
  mapId: 'graveyard-forest', figure: 'boss',
  sharedSim: 'src/content/enemies/bosses/shared.js',
  added: '2026-11-13',
  notes: 'Name/banner identity only — stats and figure are shared (see bosses/shared.js).',
  behaviour: [
    'Identical stats to the Ashen Warden (shared BOSS_CFG: HP 330, slam 24 / enraged 29, charge 22 after dmgMul 1.1, radius 1.495 after the x1.3 size buff); the Graveyard Forest palette carries the chapter identity.',
    'Shared phases: summons 2 soldiers at <=50% HP; enrage at <=30% (speed x1.15, slam +4); FURY at <=15% HP (<=49.5 of 330): speed x1.15 again (7.4 -> 8.51 -> 9.7865) and attack tempo x1.15 for telegraphs/cooldowns starting in fury.',
  ],
};
export default graveSovereign;
