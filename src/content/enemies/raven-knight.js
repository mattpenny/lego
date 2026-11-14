/* RAVEN KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/raven-knight.js. */
export const ravenKnight = {
  id: 'raven-knight', kind: 'raven-knight', type: 'enemy', cls: 'melee', figure: 'raven-knight',
  cfg: {
    hp: 86, speed: 2.55, dmg: 17, radius: 0.50, score: 170,
    reach: 2.25, arcDeg: 105, tele: 0.55, recovery: 0.44, cd: 0.58,
  },
  cap: 2, wave: null, elite: false, events: [],
  fill: { order: 5, weight: 10, from: 18 },
  added: '2026-11-13',
  notes: 'Blue feather crest, Navy raven heater shield, lance and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 105-degree swing.'],
};
export default ravenKnight;
