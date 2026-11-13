/* CRIMSON KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/crimson-knight.js. */
export const crimsonKnight = {
  id: 'crimson-knight', kind: 'crimson-knight', type: 'enemy', cls: 'melee', figure: 'crimson-knight',
  cfg: {
    hp: 96, speed: 2.40, dmg: 17, radius: 0.54, score: 200,
    reach: 2.3, arcDeg: 115, tele: 0.62, recovery: 0.48, cd: 0.62,
  },
  cap: 1, wave: null, elite: false, events: [],
  fill: { order: 7, weight: 9, from: 32 },
  added: '2026-11-13',
  notes: 'Red feather crest, Black-red face heater shield, halberd and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 115-degree swing.'],
};
export default crimsonKnight;
