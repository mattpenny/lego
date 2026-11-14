/* KETTLE-HELM ARCHER — regular ranged trash (archery pack 2026-11-14,
   integrated AB-NET-20). Palette, kettle helm and bow live in
   src/content/figures/kettle-archer.js.

   The pack shipped an `attack` block; it is translated here into the
   live ranged schema with every number's meaning preserved:
   range 17 -> maxRange, "backpedals inside 6 m" -> minRange 6 with
   fleeSpeed 2.0 (its approach speed stays the pack's 3.5), pack cd
   2.9 -> volley, projectileSpeed/projectileRadius -> projSpeed/projR.
   The fill weight is the pack's 0.9 expressed on the live pool scale
   (ratio to the crossbow-herald's 0.55 preserved: 13 vs 8). */
export const kettleArcher = {
  id: 'kettle-archer', kind: 'kettle-archer', type: 'enemy', cls: 'ranged', figure: 'kettle-archer',
  cfg: {
    hp: 42, speed: 3.5, dmg: 9, radius: 0.45, score: 75,
    minRange: 6, maxRange: 17, volley: 2.9, projSpeed: 15, projR: 0.08,
    tele: 0.75, recovery: 0.85, fleeSpeed: 2.0,
  },
  cap: 6, wave: null, elite: false, events: [],
  fill: { order: 22, weight: 13, from: 18 },
  added: '2026-11-14',
  notes: 'Low-HP ranged trash. Its threat is the telegraphed arrow, not its HP. Counter-play is strafing after the draw telegraph or closing inside 6 m to force the backpedal recovery window.',
  behaviour: [
    'Approaches until the hero is within 17 m, then stops and begins a 0.75 s draw telegraph.',
    'Fires one non-homing arrow along its locked facing at 15 m/s for 9 dmg.',
    'After firing, 0.85 s recovery; volley cycle 2.9 s.',
    'If the hero closes within 6 m, backpedals at 2.0 m/s while drawing; does not melee.',
  ],
};
export default kettleArcher;
