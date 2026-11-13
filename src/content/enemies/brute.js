/* BRUTE — the wave's heavy baseline melee. Three hero sword hits to kill.
   Appearance lives in src/content/figures/brute.js — never duplicated here. */
export const brute = {
  id: 'brute', kind: 'brute', type: 'enemy', cls: 'melee', figure: 'brute',
  cfg: { hp: 76, speed: 2.35, dmg: 18, radius: 0.62, score: 120 },
  cap: 99, wave: null, elite: false, events: [],
  fill: { order: 1, weight: 26 },
  added: '2026-11-13',
  notes: 'Uses the shared melee defaults (telegraph 0.55, strikeRange 1.8, arc 120°, recovery 0.5).',
  behaviour: ['Three hero sword hits (34 dmg vs 76 hp). Base fill-pool member from t=0, weight 26.'],
};
export default brute;
