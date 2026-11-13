/* ARCHER — stub. Real CFG below; figure not yet transcribed.
   TODO: fill `parts` from rigParts('archer') in src/game.js (hood, back
   quiver with 3 arrows, longbow in handL). See soldier.js / knight.js. */

export const archer = {
  kind: 'archer',
  cls: 'ranged',
  stub: true,
  cfg: {
    hp: 34, speed: 3.55, dmg: 8, radius: 0.40, score: 150,
    minRange: 9, maxRange: 13,   // holds further back than the ranger
    volley: 1.5,                 // fast cycle, weak arrows
    projSpeed: 14.0, projR: 0.30,
    tele: 0.42, recovery: 0.38,
  },
  wave: { from: 30, cap: 2, w: 18 }, // joins from 30 s (CFG.caps.archers = 2 alive)
  tint: {
    armor: [0.200, 0.110, 0.050], trim: [0.440, 0.290, 0.120], cloth: [0.090, 0.215, 0.110],
    skin: [0.950, 0.760, 0.140], blade: [0.310, 0.200, 0.075], dark: [0.070, 0.055, 0.035],
    glow: [0.300, 0.900, 0.350],
  },
  base: 'bodyParts',
  meshScale: 1,
  parts: null, // TODO: transcribe rigParts('archer')
  behaviour: ['Arrow does exactly 8 on a stationary hero; sidestep-after-loose and roll i-frames dodge it. Fragile: one sword hit (34 dmg vs 34 hp).'],
};
export default archer;
