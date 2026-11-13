/* RANGER — stub. Real CFG below; figure not yet transcribed.
   TODO: fill `parts` from rigParts('ranger') in src/game.js — the ranger
   shares one rigParts block with brute and runner (bodyParts base + a
   shared sword) in the current build, told apart by TINTS.ranger.
   See soldier.js / knight.js for the worked pattern. */

export const ranger = {
  kind: 'ranger',
  cls: 'ranged',
  stub: true,
  cfg: {
    hp: 38, speed: 3.25, dmg: 13, radius: 0.42, score: 160,
    minRange: 7, maxRange: 11,   // keeps this band, strafing like all ranged kinds
    volley: 2.3,                 // seconds between shots
    projSpeed: 10.5, projR: 0.38,
  },
  wave: null, // base kind: director fill; global cap CFG.caps.rangers = 3 alive
  tint: {
    armor: [0.30, 0.15, 0.47], trim: [0.18, 0.09, 0.30], cloth: [0.22, 0.10, 0.36],
    skin: [0.82, 0.70, 0.98], blade: [0.62, 0.40, 0.82], dark: [0.11, 0.06, 0.18],
    glow: [0.78, 0.36, 1.00],
  },
  base: 'bodyParts',
  meshScale: 1,
  parts: null, // TODO: transcribe rigParts('ranger')
  behaviour: ['Holds 7–11 m, fires a dodgeable bolt every 2.3 s; facing locks at fire, so a sidestep after the shot dodges it. Two sword hits.'],
};
export default ranger;
