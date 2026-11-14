/* UNICORN KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/unicorn-knight.js. */
export const unicornKnight = {
  id: 'unicorn-knight', kind: 'unicorn-knight', type: 'enemy', cls: 'melee', figure: 'unicorn-knight',
  cfg: {
    hp: 101, speed: 2.80, dmg: 17, radius: 0.50, score: 200,
    reach: 2.2, arcDeg: 100, tele: 0.50, recovery: 0.42, cd: 0.55,
  },
  cap: 1, wave: null, elite: false, events: [],
  fill: { order: 12, weight: 8, from: 68 },
  added: '2026-11-13',
  notes: 'Blue feather crest, Blue-white unicorn heater shield, pike and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 100-degree swing.'],
};
export default unicornKnight;
