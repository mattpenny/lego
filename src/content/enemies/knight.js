/* KNIGHT — fully worked example of the enemy registry pattern.
   All numbers are the game's real values, read from src/game.js
   (CFG.enemy.knight + CFG.wave.knight + TINTS.knight + rigParts('knight')).
   See soldier.js for the descriptor field-by-field documentation. */

export const knight = {
  kind: 'knight',
  cls: 'melee',

  cfg: {
    hp: 168, speed: 2.60, dmg: 20, radius: 0.66, score: 320,
    reach: 2.0,        // longsword reach
    arcDeg: 120,       // frontal strike arc, checked AT the strike moment
    tele: 0.95,        // long telegraphed wind-up…
    recovery: 0.60,
    cd: 0.70,
    poise: true,       // …that CANNOT be interrupted by sword hits (mini-boss rule)
  },

  wave: { from: 130, cap: 1, w: 0, every: 35 }, // from 130 s; re-rolled every 35 s while absent
  events: [1, 3], // also the chapter-event pack leader in chapters 1 and 3 (CFG.events, at 90 s)

  tint: {
    armor: [0.330, 0.350, 0.380], trim: [0.700, 0.480, 0.090], cloth: [0.360, 0.035, 0.040],
    skin: [0.940, 0.750, 0.160], blade: [0.760, 0.800, 0.860], dark: [0.090, 0.090, 0.100],
    glow: [0.960, 0.820, 0.420],
  },

  base: 'bodyParts',
  meshScale: 1, // his bulk is in the parts (helm/pauldrons), not a view scale

  parts: [
    // spine (1): tabard + diamond emblem (two rotated squares)
    { j: 1, g: 'box', o: [0, 0.300, 0.235], s: [0.34, 0.32, 0.02], c: 'cloth', note: 'tabard' },
    { j: 1, g: 'box', o: [0, 0.320, 0.248], s: [0.15, 0.15, 0.02], c: 'trim', r: [0, 0, 0.78], note: 'emblem (diamond half)' },
    { j: 1, g: 'box', o: [0, 0.320, 0.248], s: [0.15, 0.15, 0.02], c: 'trim', r: [0, 0, -0.78], note: 'emblem (diamond half)' },
    // head (2): great helm — shell, visor slit, breath holes, red crest
    { j: 2, g: 'box', o: [0, 0.340, 0.000], s: [0.74, 0.44, 0.74], c: 'armor', note: 'great helm' },
    { j: 2, g: 'box', o: [0, 0.180, 0.340], s: [0.56, 0.055, 0.05], c: 'dark', note: 'visor slit' },
    { j: 2, g: 'box', o: [0, 0.020, 0.340], s: [0.30, 0.035, 0.04], c: 'dark', note: 'breath holes' },
    { j: 2, g: 'box', o: [0, 0.570, 0.000], s: [0.10, 0.32, 0.52], c: 'cloth', r: [0.16, 0, 0], note: 'red crest' },
    { j: 2, g: 'box', o: [0, 0.480, 0.340], s: [0.13, 0.10, 0.05], c: 'trim', note: 'crest base' },
    // rounded pauldrons on both upper arms (3 = upperArmL, 6 = upperArmR)
    { j: 3, g: 'sph', o: [0, 0.04, 0], s: [0.44, 0.30, 0.44], c: 'armor', note: 'rounded pauldron' },
    { j: 6, g: 'sph', o: [0, 0.04, 0], s: [0.44, 0.30, 0.44], c: 'armor', note: 'rounded pauldron' },
    // handL (5): heater shield — steel rim, red face, emblem
    { j: 5, g: 'cyl12', o: [0.03, -0.140, 0.150], s: [0.80, 0.10, 0.80], c: 'trim', r: [Math.PI / 2, 0, 0], note: 'shield rim' },
    { j: 5, g: 'cyl12', o: [0.03, -0.140, 0.190], s: [0.66, 0.10, 0.66], c: 'cloth', r: [Math.PI / 2, 0, 0], note: 'shield face' },
    { j: 5, g: 'box', o: [0.03, -0.140, 0.250], s: [0.17, 0.17, 0.02], c: 'trim', r: [0, 0, 0.78], note: 'shield emblem' },
    { j: 5, g: 'cyl12', o: [0.03, -0.140, 0.255], s: [0.13, 0.04, 0.13], c: 'trim', r: [Math.PI / 2, 0, 0], note: 'shield boss' },
    // handR (8): longsword — grip, pommel, crossguard, blade, fuller, tip
    { j: 8, g: 'cyl', o: [0, -0.050, 0], s: [0.10, 0.22, 0.10], c: 'dark', note: 'grip' },
    { j: 8, g: 'sph', o: [0, -0.180, 0], s: [0.12, 0.12, 0.12], c: 'trim', note: 'pommel' },
    { j: 8, g: 'box', o: [0, -0.210, 0], s: [0.46, 0.07, 0.13], c: 'trim', note: 'crossguard' },
    { j: 8, g: 'box', o: [0, -0.500, 0], s: [0.17, 0.56, 0.05], c: 'blade', note: 'blade' },
    { j: 8, g: 'box', o: [0, -0.500, 0.028], s: [0.03, 0.50, 0.012], c: 'trim', note: 'fuller line' },
    { j: 8, g: 'cone', o: [0, -0.820, 0], s: [0.17, 0.13, 0.05], c: 'blade', r: [Math.PI, 0, 0], note: 'tip' },
  ],

  behaviour: [
    'Melee AI with poise: closes to stand distance max(1.45, reach-0.35) = 1.65 m.',
    'Telegraph is 0.95 s and — unlike every other melee kind — a hero sword hit does NOT cancel it (damageEnemy skips the wind-up cancel for poise kinds). Dodge by leaving the 120° arc / 2.0 m reach, or roll through it.',
    'Strike deals 20 on the same strike-moment range+arc check as all melee; recovery 0.60 s, cooldown 0.70 s.',
    'Hero sword damage 34 vs hp 168 = exactly 5 hits; score 320, 4 XP gems — the wave\u2019s elite payout.',
    'Cap 1 alive; also summoned as the chapter-event pack at 90 s in chapters 1 and 3 (as slots free under the global 8-alive cap).',
  ],
};

export default knight;
