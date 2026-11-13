/* TOWER KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/tower-knight.js. */
export const towerKnight = {
  id: 'tower-knight', kind: 'tower-knight', type: 'enemy', cls: 'melee', figure: 'tower-knight',
  cfg: {
    hp: 126, speed: 2.20, dmg: 20, radius: 0.60, score: 250,
    reach: 2.3, arcDeg: 120, tele: 0.78, recovery: 0.55, cd: 0.70,
  },
  cap: 1, wave: null, elite: false, events: [],
  fill: { order: 15, weight: 8, from: 92 },
  added: '2026-11-13',
  notes: 'Blue feather crest, Blue-gold tower heater shield, fork and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 120-degree swing.'],
};
export default towerKnight;
