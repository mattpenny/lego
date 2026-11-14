/* SPEARMAN — levy soldier from the LEGO reference grid.
   Palette, moulded parts and mesh scale live in src/content/figures/spearman.js.

   The roster's ONLY long-reach, narrow-arc melee kind. Every other melee unit
   swings a 100-130 degree arc at ~1.8-2.8 m; the spearman pokes a 42-degree
   point out to 3.15 m. That changes the counter-play: backing straight away
   keeps you inside the point, so the answer is to strafe around it. */
export const spearman = {
  id: 'spearman', kind: 'spearman', type: 'enemy', cls: 'melee', figure: 'spearman',
  cfg: {
    hp: 58, speed: 2.35, dmg: 12, radius: 0.44, score: 130,
    reach: 3.15, arcDeg: 42, tele: 0.46, recovery: 0.36, cd: 0.64,
  },
  cap: 4, wave: null, elite: false, events: [],
  fill: { order: 21, weight: 14, from: 10 },
  added: '2026-11-14',
  notes: 'Kettle-helm levy with a spear taller than the figure. Longest melee reach (3.15 m) and narrowest arc (42 deg).',
  behaviour: [
    'Thrusts from 3.15 m — outside every other melee reach — for 12 dmg on a 42-degree arc.',
    'Cheap and numerous (cap 4, weight 14 from wave 10), so it applies spacing pressure early.',
  ],
};
export default spearman;
