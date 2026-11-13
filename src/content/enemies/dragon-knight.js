/* DRAGON KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/dragon-knight.js. */
export const dragonKnight = {
  id: 'dragon-knight', kind: 'dragon-knight', type: 'enemy', cls: 'melee', figure: 'dragon-knight',
  cfg: {
    hp: 138, speed: 2.30, dmg: 21, radius: 0.60, score: 270,
    reach: 2.5, arcDeg: 120, tele: 0.80, recovery: 0.56, cd: 0.72,
    poise: true,
  },
  cap: 1, wave: null, elite: false, events: [],
  fill: { order: 16, weight: 7, from: 105 },
  added: '2026-11-13',
  notes: 'Yellow feather crest, Black-gold dragon heater shield, lucern and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 120-degree swing.'],
};
export default dragonKnight;
