/* BRUTE — stub. Real CFG below; figure not yet transcribed.
   TODO: fill `parts` from rigParts('brute') in src/game.js — note the
   brute shares one rigParts block with runner and ranger (bodyParts base
   + a shared sword), and is told apart by TINTS.brute and meshScale 1.18.
   Follow the worked pattern in soldier.js / knight.js. */

export const brute = {
  kind: 'brute',
  cls: 'melee',
  stub: true,
  cfg: {
    hp: 76, speed: 2.35, dmg: 18, radius: 0.62, score: 120,
    // no per-kind overrides: uses the shared melee defaults —
    // telegraph 0.55, strikeRange 1.8, strikeArcDeg 120, recovery 0.5
  },
  wave: null, // base kind: the wave director fills with brute/runner/ranger from t=0
  tint: {
    armor: [0.36, 0.13, 0.09], trim: [0.20, 0.08, 0.06], cloth: [0.27, 0.10, 0.07],
    skin: [0.92, 0.58, 0.16], blade: [0.48, 0.27, 0.21], dark: [0.15, 0.07, 0.06],
    glow: [0.85, 0.25, 0.12],
  },
  base: 'bodyParts',
  meshScale: 1.18,
  parts: null, // TODO: transcribe rigParts('brute')
  behaviour: ['Three hero sword hits (34 dmg vs 76 hp). The wave\u2019s heavy baseline melee.'],
};
export default brute;
