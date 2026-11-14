/* BLACK RAVEN — hooded demon knight from the LEGO reference grid.
   Palette, moulded parts and mesh scale live in src/content/figures/black-raven.js.

   The roster's heaviest non-boss melee kind: it hits harder than any heraldic
   knight (22 vs 15) and swings a 130-degree arc, but it is slow and capped at
   two alive. Its role is to break a kite loop — you cannot simply out-walk it
   while it winds up, because the wind-up is short and the arc is wide. */
export const blackRaven = {
  id: 'black-raven', kind: 'black-raven', type: 'enemy', cls: 'melee', figure: 'black-raven',
  cfg: {
    hp: 132, speed: 2.80, dmg: 22, radius: 0.52, score: 260,
    reach: 2.80, arcDeg: 130, tele: 0.60, recovery: 0.50, cd: 0.70,
  },
  cap: 2, wave: null, elite: true, events: [],
  fill: { order: 20, weight: 8, from: 46 },
  added: '2026-11-14',
  notes: 'Hooded demon knight: black notched glaive, red chest shield, crimson fanged face. Heaviest non-boss melee hit in the roster.',
  behaviour: [
    'Closes to reach-0.35 m, telegraphs a 130-degree swing for 22 dmg — the widest melee arc after the boss slam.',
    'Slow (2.80 m/s) and capped at 2 alive, so it is a threat to hold position against, not to swarm with.',
  ],
};
export default blackRaven;
