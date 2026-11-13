/* ARCHER — fast, weak arrows; holds further back than the ranger.
   Hood, quiver and longbow live in src/content/figures/archer.js. */
export const archer = {
  id: 'archer', kind: 'archer', type: 'enemy', cls: 'ranged', figure: 'archer',
  cfg: {
    hp: 34, speed: 3.55, dmg: 8, radius: 0.40, score: 150,
    minRange: 9, maxRange: 13, volley: 1.5, projSpeed: 14.0, projR: 0.30,
    tele: 0.42, recovery: 0.38,
  },
  cap: 2, wave: { from: 30, cap: 2, w: 18 }, elite: false, events: [],
  fill: { order: 4, weight: 18, from: 30 },
  added: '2026-11-13',
  notes: 'Joins the fill pool at 30 s. One sword hit kills it (34 dmg vs 34 hp).',
  behaviour: ['Arrow does exactly 8 on a stationary hero; sidestep-after-loose and roll i-frames dodge it.'],
};
export default archer;
