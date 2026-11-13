/* AXE KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/axe-knight.js. */
export const axeKnight = {
  id: 'axe-knight', kind: 'axe-knight', type: 'enemy', cls: 'melee', figure: 'axe-knight',
  cfg: {
    hp: 104, speed: 2.30, dmg: 19, radius: 0.56, score: 210,
    reach: 2.5, arcDeg: 120, tele: 0.70, recovery: 0.52, cd: 0.68,
  },
  cap: 1, wave: null, elite: false, events: [],
  fill: { order: 8, weight: 9, from: 38 },
  added: '2026-11-13',
  notes: 'Green feather crest, Green axe heater shield, poleaxe and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 120-degree swing.'],
};
export default axeKnight;
