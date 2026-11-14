/* CROSSBOW HERALD — regular heraldic ranged kind (archery pack
   2026-11-14, integrated AB-NET-20). Azure tabard, steel trim, blue
   plume and the crossbow live in figures/azure-crossbow-herald.js
   (the pack named the figure azure-crossbow-herald; the registry
   requires figure id == kind, so the figure was aligned to
   'crossbow-herald' on integration — see figures/crossbow-herald.js).

   Pack `attack` block translated to the live ranged schema: the
   pack's "holds at 18-21 m" -> minRange 18 / maxRange 21, its slow
   1.8 m/s back-away -> fleeSpeed, cd 3.6 -> volley, projectileSpeed
   26 / projectileRadius 0.06 -> projSpeed / projR. Fill weight is
   the pack's 0.55 on the live pool scale (see kettle-archer). */
export const crossbowHerald = {
  id: 'crossbow-herald', kind: 'crossbow-herald', type: 'enemy', cls: 'ranged', figure: 'crossbow-herald',
  cfg: {
    hp: 58, speed: 3.1, dmg: 14, radius: 0.5, score: 110,
    minRange: 18, maxRange: 21, volley: 3.6, projSpeed: 26, projR: 0.06,
    tele: 0.9, recovery: 1.0, fleeSpeed: 1.8,
  },
  cap: 4, wave: null, elite: false, events: [],
  fill: { order: 23, weight: 8, from: 55 },
  added: '2026-11-14',
  notes: 'Slower, harder-hitting ranged heraldic kind. Low cap and long reload keep it fair. Bolt is linear and dodgeable; counter-play is rolling the line and closing during its 1.0 s recovery.',
  behaviour: [
    'Holds an 18-21 m band from the hero and aims for 0.9 s.',
    'Fires a fast linear bolt at 26 m/s for 14 dmg; the bolt does not home after release.',
    'After firing, 1.0 s recovery; volley cycle 3.6 s.',
    'Will not advance into melee; inside its band it backs away slowly at 1.8 m/s.',
  ],
};
export default crossbowHerald;
