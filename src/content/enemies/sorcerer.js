/* SORCERER — slow fragile caster; 0.95 s charge, 10 dmg in a 1.5 m splash.
   Pointed hat, starfield robe and orb staff live in figures/sorcerer.js. */
export const sorcerer = {
  id: 'sorcerer', kind: 'sorcerer', type: 'enemy', cls: 'ranged', figure: 'sorcerer',
  cfg: {
    hp: 66, speed: 2.10, dmg: 11, radius: 0.50, score: 240,
    minRange: 8.5, maxRange: 13.5, volley: 3.6, projSpeed: 7.5, projR: 0.52,
    splash: 1.5, tele: 0.95, recovery: 0.55,
  },
  cap: 1, wave: { from: 100, cap: 1, w: 0, every: 45, priority: 1 },
  elite: true, events: [2, 3], fill: null,
  added: '2026-11-13',
  notes: 'Scheduled elite (from 100 s, re-rolled every 45 s while absent). Also in chapter 2/3 event packs.',
  behaviour: ['Splash resolves centre-distance at detonation. Elites can drop magic potions (25%).'],
};
export default sorcerer;
