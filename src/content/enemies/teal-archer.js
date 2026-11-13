/* TEAL ARCHER — archer added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/teal-archer.js. */
export const tealArcher = {
  id: 'teal-archer', kind: 'teal-archer', type: 'enemy', cls: 'ranged', figure: 'teal-archer',
  cfg: {
    hp: 42, speed: 3.35, dmg: 10, radius: 0.41, score: 165,
    minRange: 8, maxRange: 12, volley: 2, projSpeed: 12.5, projR: 0.31,
    tele: 0.48, recovery: 0.40,
  },
  cap: 2, wave: null, elite: false, events: [],
  fill: { order: 19, weight: 10, from: 40 },
  added: '2026-11-13',
  notes: 'Teal hood, orange ranger tunic, quiver, blue-grey bracer and clasp (hooded archer reference, right figure).',
  behaviour: ['Slightly sturdier than the russet archer; holds a closer 8-12 m band.'],
};
export default tealArcher;
