/* AZURE KNIGHT — heraldic knight added from the LEGO reference photos.
   Palette, moulded parts and mesh scale live in src/content/figures/azure-knight.js. */
export const azureKnight = {
  id: 'azure-knight', kind: 'azure-knight', type: 'enemy', cls: 'melee', figure: 'azure-knight',
  cfg: {
    hp: 99, speed: 2.55, dmg: 18, radius: 0.52, score: 195,
    reach: 2.35, arcDeg: 110, tele: 0.58, recovery: 0.45, cd: 0.60,
  },
  cap: 2, wave: null, elite: false, events: [],
  fill: { order: 10, weight: 9, from: 52 },
  added: '2026-11-13',
  notes: 'Red feather crest, Blue-red quartered heater shield, glaive and a full-length cloak. Heraldic knight from the 12-figure reference grid.',
  behaviour: ['Plate-armoured melee. Closes to reach-0.35 m, telegraphs a 110-degree swing.'],
};
export default azureKnight;
