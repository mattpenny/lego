/* SORCERER — stub. Real CFG below; figure not yet transcribed.
   TODO: fill `parts` from rigParts('sorcerer') in src/game.js (taller
   violet pointed hat, starfield robe print, staff with a RED gem — the
   ranger keeps his own kit). See soldier.js / knight.js. */

export const sorcerer = {
  kind: 'sorcerer',
  cls: 'ranged',
  stub: true,
  cfg: {
    hp: 60, speed: 2.10, dmg: 10, radius: 0.50, score: 240,
    minRange: 8.5, maxRange: 13.5,
    volley: 3.6,                 // slow cycle…
    projSpeed: 7.5, projR: 0.52, // …heavy bolt…
    splash: 1.5,                 // …that detonates on the hero's position at fire time, 1.5 m splash
    tele: 0.95,                  // charge telegraph (the dodge window)
    recovery: 0.55,
  },
  wave: { from: 100, cap: 1, w: 0, every: 45 }, // from 100 s, cap 1 alive (CFG.caps.sorcerers)
  events: [2, 3], // chapter-event pack member in chapters 2 and 3 (CFG.events, at 90 s)
  tint: {
    armor: [0.045, 0.035, 0.060], trim: [0.300, 0.280, 0.360], cloth: [0.120, 0.060, 0.220],
    skin: [0.720, 0.680, 0.620], blade: [0.180, 0.120, 0.070], dark: [0.020, 0.020, 0.030],
    glow: [0.650, 0.300, 1.000],
  },
  base: 'bodyParts',
  meshScale: 1,
  parts: null, // TODO: transcribe rigParts('sorcerer')
  behaviour: ['Splash resolves centre-distance at detonation: inside 1.5 m takes the 10, outside takes 0. Elite caster — 3 XP gems, and elites can drop magic potions (25%).'],
};
export default sorcerer;
