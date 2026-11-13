/* SOLDIER — kettle-helm infantry with a 2.2 m spear. Opens every fight. */
export const soldier = {
  id: 'soldier', kind: 'soldier', type: 'enemy', cls: 'melee', figure: 'soldier',
  cfg: {
    hp: 52, speed: 2.15, dmg: 14, radius: 0.46, score: 110,
    reach: 2.2, arcDeg: 110, tele: 0.50, recovery: 0.42, cd: 0.55,
  },
  cap: 4, wave: { from: 0, cap: 4, w: 34 }, elite: false, events: [],
  opensFight: true,
  fill: { order: 0, weight: 34 },
  added: '2026-11-13',
  notes: 'The very first spawn of a run is always a soldier (spawnEnemy, elapsed<3).',
  behaviour: [
    'Closes to max(1.45, reach-0.35) = 1.85 m; telegraph starts within reach-0.1 m.',
    'Hero sword hits interrupt the wind-up (no poise). Two sword hits to kill.',
  ],
};
export default soldier;
