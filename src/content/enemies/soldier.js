/* SOLDIER — fully worked example of the enemy registry pattern.
   All numbers are the game's real values, read from src/game.js
   (CFG.enemy.soldier + CFG.wave.soldier + TINTS.soldier + rigParts('soldier')).
   Phase-1 note: game.js does not import this yet — it is the canonical
   descriptor the registry (./index.js) exposes for new code, shaped so it
   could drive the game: cfg feeds the sim, figure feeds the view.

   Registry descriptor fields:
     kind       sim/view kind key
     cls        'melee' | 'ranged' (how the AI drives it)
     cfg        per-kind CFG (merged over the shared CFG.enemy defaults:
                telegraph 0.55, strikeRange 1.8, strikeArcDeg 120, recovery 0.5)
     wave       wave-director entry (from = first-appearance second,
                cap = per-type alive limit, w = fill weight)
     tint       TINTS entry: named plastic colours, [r,g,b] linear 0..1
     base       figure base: 'bodyParts' = shared moulded body from game.js,
                or 'custom' = the kind block is the whole figure
     parts      the kind's signature parts, transcribed from rigParts():
                { j: joint index (see rig/joints.js), g: prim kind
                  (see rig/prims.js), o: offset, s: scale, c: tint slot,
                  r: euler rotation (omitted = none), note }
     meshScale  view scale applied to the merged figure (1 = none)
     behaviour  how the sim AI uses the cfg, in game.js terms */

export const soldier = {
  kind: 'soldier',
  cls: 'melee',

  cfg: {
    hp: 52, speed: 2.15, dmg: 14, radius: 0.46, score: 110,
    reach: 2.2,        // spear reach — a brute needs 1.8 m, the soldier lands at 2.2
    arcDeg: 110,       // frontal strike arc, checked AT the strike moment
    tele: 0.50,        // telegraph (wind-up) seconds; interruptible by a sword hit
    recovery: 0.42,    // post-strike recovery seconds
    cd: 0.55,          // attack cooldown seconds
  },

  wave: { from: 0, cap: 4, w: 34 }, // on the field from second 0 of every chapter

  tint: {
    armor: [0.180, 0.190, 0.200], trim: [0.380, 0.400, 0.420], cloth: [0.480, 0.030, 0.030],
    skin: [0.960, 0.780, 0.160], blade: [0.540, 0.580, 0.620], dark: [0.070, 0.070, 0.080],
    glow: [1.000, 0.460, 0.180],
  },

  base: 'bodyParts',
  meshScale: 1,

  parts: [
    // spine (1): chainmail print panel + mail rows
    { j: 1, g: 'box', o: [0, 0.300, 0.232], s: [0.36, 0.30, 0.02], c: 'trim', note: 'chainmail print' },
    { j: 1, g: 'box', o: [0, 0.380, 0.246], s: [0.36, 0.028, 0.02], c: 'dark', note: 'mail row' },
    { j: 1, g: 'box', o: [0, 0.320, 0.246], s: [0.36, 0.028, 0.02], c: 'dark', note: 'mail row' },
    { j: 1, g: 'box', o: [0, 0.260, 0.246], s: [0.36, 0.028, 0.02], c: 'dark', note: 'mail row' },
    // spine (1): red scarf + tail down the back
    { j: 1, g: 'box', o: [0, 0.545, 0], s: [0.90, 0.10, 0.50], c: 'cloth', note: 'red scarf' },
    { j: 1, g: 'box', o: [0, 0.30, -0.245], s: [0.24, 0.42, 0.05], c: 'cloth', r: [0.12, 0, 0], note: 'scarf tail' },
    // head (2): kettle helm — dome + wide brim + lip + cheek guards
    { j: 2, g: 'sph', o: [0, 0.420, 0], s: [0.66, 0.26, 0.66], c: 'trim', note: 'helm dome' },
    { j: 2, g: 'cyl12', o: [0, 0.220, 0], s: [0.86, 0.05, 0.86], c: 'trim', note: 'brim' },
    { j: 2, g: 'box', o: [0, 0.220, 0.355], s: [0.56, 0.04, 0.05], c: 'trim', note: 'brim lip' },
    { j: 2, g: 'cyl12', o: [0.33, 0.15, 0.04], s: [0.09, 0.28, 0.09], c: 'trim', note: 'cheek guard' },
    { j: 2, g: 'cyl12', o: [-0.33, 0.15, 0.04], s: [0.09, 0.28, 0.09], c: 'trim', note: 'cheek guard' },
    // handR (8): spear — butt near the floor, head above the shoulder
    { j: 8, g: 'cyl', o: [0, 0.100, 0], s: [0.055, 1.70, 0.055], c: 'blade', note: 'spear shaft' },
    { j: 8, g: 'box', o: [0, 0.980, 0], s: [0.14, 0.06, 0.06], c: 'dark', note: 'spear collar' },
    { j: 8, g: 'cone', o: [0, 1.090, 0], s: [0.10, 0.26, 0.10], c: 'trim', note: 'spear head' },
    // handL (5): small round shield
    { j: 5, g: 'cyl12', o: [0.02, -0.115, 0.150], s: [0.60, 0.09, 0.60], c: 'trim', r: [Math.PI / 2, 0, 0], note: 'shield rim' },
    { j: 5, g: 'cyl12', o: [0.02, -0.115, 0.190], s: [0.50, 0.09, 0.50], c: 'armor', r: [Math.PI / 2, 0, 0], note: 'shield face' },
    { j: 5, g: 'cyl12', o: [0.02, -0.115, 0.235], s: [0.10, 0.04, 0.10], c: 'dark', r: [Math.PI / 2, 0, 0], note: 'shield boss' },
  ],

  behaviour: [
    'Melee AI (game.js updateEnemies): closes to stand distance max(1.45, reach-0.35) = 1.85 m.',
    'Starts its telegraph when within reach-0.1 m and its cooldown is ready; facing locks at telegraph start.',
    'The strike lands ONLY if, at the strike moment, the hero is within reach (2.2 m) and inside the 110° frontal arc — sidestepping or rolling out during the 0.50 s telegraph dodges it cleanly.',
    'A hero sword hit during the telegraph interrupts it (no poise). Then recovery 0.42 s, cooldown 0.55 s.',
    'Hero sword damage 34 vs hp 52 = two hits to kill; drops score 110, 1 XP gem path, 30% heal-orb chance (shared killEnemy rules).',
  ],
};

export default soldier;
