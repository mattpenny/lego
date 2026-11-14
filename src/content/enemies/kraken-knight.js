/* KRAKEN KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/kraken-knight.js. */
export const krakenKnight = {
  id: 'kraken-knight', kind: 'kraken-knight', type: 'enemy', cls: 'melee', figure: 'kraken-knight',
  cfg: {
    hp: 110, speed: 2.50, dmg: 19, radius: 0.54, score: 215,
    reach: 2.35, arcDeg: 112, tele: 0.62, recovery: 0.48, cd: 0.62,
  },
  cap: 1, wave: null, elite: false, events: [],
  fill: { order: 14, weight: 8, from: 84 },
  added: '2026-11-13',
  notes: 'Green feather crest, Teal octopus heater shield, morningstar and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 112-degree swing.'],
};
export default krakenKnight;
