/* EAGLE KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/eagle-knight.js. */
export const eagleKnight = {
  id: 'eagle-knight', kind: 'eagle-knight', type: 'enemy', cls: 'melee', figure: 'eagle-knight',
  cfg: {
    hp: 84, speed: 2.50, dmg: 16, radius: 0.52, score: 180,
    reach: 2.3, arcDeg: 110, tele: 0.58, recovery: 0.45, cd: 0.60,
  },
  cap: 2, wave: null, elite: false, events: [],
  fill: { order: 6, weight: 10, from: 24 },
  added: '2026-11-13',
  notes: 'Red feather crest, Gold eagle heater shield, spear and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 110-degree swing.'],
};
export default eagleKnight;
