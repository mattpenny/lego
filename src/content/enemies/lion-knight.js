/* LION KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/lion-knight.js. */
export const lionKnight = {
  id: 'lion-knight', kind: 'lion-knight', type: 'enemy', cls: 'melee', figure: 'lion-knight',
  cfg: {
    hp: 119, speed: 2.45, dmg: 20, radius: 0.55, score: 220,
    reach: 2.4, arcDeg: 115, tele: 0.65, recovery: 0.50, cd: 0.64,
  },
  cap: 1, wave: null, elite: false, events: [],
  fill: { order: 13, weight: 9, from: 76 },
  added: '2026-11-13',
  notes: 'Red feather crest, White-red lion heater shield, warhammer and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 115-degree swing.'],
};
export default lionKnight;
