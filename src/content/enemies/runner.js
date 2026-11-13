/* RUNNER — fastest kind, runs the hero down. Two hero sword hits to kill. */
export const runner = {
  id: 'runner', kind: 'runner', type: 'enemy', cls: 'melee', figure: 'runner',
  cfg: { hp: 42, speed: 4.65, dmg: 10, radius: 0.40, score: 100 },
  cap: 99, wave: null, elite: false, events: [],
  fill: { order: 2, weight: 22 },
  added: '2026-11-13',
  notes: 'Uses shared melee defaults. Small figure scale 0.90.',
  behaviour: ['Fastest kind (4.65 m/s); two sword hits (34 dmg vs 42 hp). Fill-pool weight 22.'],
};
export default runner;
