/* SUN KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/sun-knight.js. */
export const sunKnight = {
  id: 'sun-knight', kind: 'sun-knight', type: 'enemy', cls: 'melee', figure: 'sun-knight',
  cfg: {
    hp: 97, speed: 2.65, dmg: 17, radius: 0.50, score: 190,
    reach: 2.2, arcDeg: 100, tele: 0.52, recovery: 0.42, cd: 0.55,
  },
  cap: 1, wave: null, elite: false, events: [],
  fill: { order: 9, weight: 8, from: 45 },
  added: '2026-11-13',
  notes: 'Violet feather crest, Violet sun heater shield, mace and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 100-degree swing.'],
};
export default sunKnight;
