/* CROSSBOWMAN — archer added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/crossbowman.js. */
export const crossbowman = {
  id: 'crossbowman', kind: 'crossbowman', type: 'enemy', cls: 'ranged', figure: 'crossbowman',
  cfg: {
    hp: 53, speed: 2.80, dmg: 13, radius: 0.44, score: 175,
    minRange: 7.5, maxRange: 11.5, volley: 2.6, projSpeed: 16.0, projR: 0.28,
    tele: 0.60, recovery: 0.45,
  },
  cap: 2, wave: null, elite: false, events: [],
  fill: { order: 17, weight: 11, from: 22 },
  added: '2026-11-13',
  notes: 'Wide-brim kettle helm, quilted white gambeson and a brown crossbow (BrickTactical reference). Slower, harder-hitting bolt than the archer.',
  behaviour: ['Holds a 7.5-11.5 m band and fires a fast bolt every 2.6 s; sidestep after the loose beats it.'],
};
export default crossbowman;
