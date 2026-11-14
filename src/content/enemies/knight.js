/* KNIGHT — armoured mini-boss. Five sword hits, uninterruptible wind-up.
   Great helm, tabard, heater shield and longsword live in figures/knight.js. */
export const knight = {
  id: 'knight', kind: 'knight', type: 'enemy', cls: 'melee', figure: 'knight',
  cfg: {
    hp: 185, speed: 2.60, dmg: 22, radius: 0.66, score: 320,
    reach: 2.0, arcDeg: 120, tele: 0.95, recovery: 0.60, cd: 0.70,
    poise: true,
  },
  cap: 1, wave: { from: 130, cap: 1, w: 0, every: 35, priority: 0 },
  elite: true, events: [1, 3], fill: null,
  added: '2026-11-13',
  notes: 'Scheduled elite (from 130 s, re-rolled every 35 s while absent). poise:true blocks hit-cancel.',
  behaviour: ['Long fully telegraphed wind-up that sword hits CANNOT interrupt. Also leads chapter 1/3 event packs.'],
};
export default knight;
