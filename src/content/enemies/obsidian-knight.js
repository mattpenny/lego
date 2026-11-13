/* OBSIDIAN KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/obsidian-knight.js. */
export const obsidianKnight = {
  id: 'obsidian-knight', kind: 'obsidian-knight', type: 'enemy', cls: 'melee', figure: 'obsidian-knight',
  cfg: {
    hp: 118, speed: 2.35, dmg: 19, radius: 0.58, score: 235,
    reach: 2.4, arcDeg: 120, tele: 0.72, recovery: 0.52, cd: 0.66,
  },
  cap: 1, wave: null, elite: false, events: [],
  fill: { order: 11, weight: 8, from: 60 },
  added: '2026-11-13',
  notes: 'Black feather crest, Black-red rune heater shield, flail and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 120-degree swing.'],
};
export default obsidianKnight;
