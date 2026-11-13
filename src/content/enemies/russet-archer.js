/* RUSSET ARCHER — archer added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/russet-archer.js. */
export const russetArcher = {
  id: 'russet-archer', kind: 'russet-archer', type: 'enemy', cls: 'ranged', figure: 'russet-archer',
  cfg: {
    hp: 36, speed: 3.60, dmg: 9, radius: 0.40, score: 155,
    minRange: 8.5, maxRange: 12.5, volley: 1.7, projSpeed: 13.5, projR: 0.3,
    tele: 0.44, recovery: 0.38,
  },
  cap: 2, wave: null, elite: false, events: [],
  fill: { order: 18, weight: 11, from: 28 },
  added: '2026-11-13',
  notes: 'Brown hood, orange ranger tunic, quiver and recurve bow (hooded archer reference, left figure).',
  behaviour: ['Fast kiting archer with a light arrow; one sword hit kills it.'],
};
export default russetArcher;
