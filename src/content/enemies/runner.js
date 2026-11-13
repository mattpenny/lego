/* RUNNER — stub. Real CFG below; figure not yet transcribed.
   TODO: fill `parts` from rigParts('runner') in src/game.js — the runner
   shares one rigParts block with brute and ranger (bodyParts base + a
   shared sword), told apart by TINTS.runner. See soldier.js / knight.js. */

export const runner = {
  kind: 'runner',
  cls: 'melee',
  stub: true,
  cfg: {
    hp: 42, speed: 4.65, dmg: 10, radius: 0.40, score: 100,
    // shared melee defaults: telegraph 0.55, strikeRange 1.8, strikeArcDeg 120, recovery 0.5
  },
  wave: null, // base kind: director fill from t=0
  tint: {
    armor: [0.22, 0.31, 0.25], trim: [0.15, 0.21, 0.17], cloth: [0.17, 0.24, 0.20],
    skin: [0.72, 0.86, 0.40], blade: [0.52, 0.58, 0.50], dark: [0.09, 0.13, 0.11],
    glow: [0.55, 0.82, 0.42],
  },
  base: 'bodyParts',
  meshScale: 1,
  parts: null, // TODO: transcribe rigParts('runner')
  behaviour: ['Fastest kind (4.65 m/s) — runs the hero down; two sword hits (34 vs 42 hp).'],
};
export default runner;
