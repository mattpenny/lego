/* SPEARMAN — levy soldier, cloned from the LEGO reference grid
   (row-2 right figure of 61oJx4yOx2L.jpg).

   Reference reads: a plain steel kettle helm with a wide flared brim and a
   nose guard, a yellow minifig face with a heavy brow and a set grimace,
   sideburns, a sleeveless cream tunic over bare reddish-tan arms, a brown
   leather belt, brown trousers with a yellow band above tan boots, and a
   long plain spear.

   Gameplay reason this figure exists: every other melee kind swings a wide
   arc at short range. The spearman is the roster's only LONG-REACH, NARROW-ARC
   threat — it pokes from outside sword range, so the counter-play is to
   strafe around the point rather than back off.

   c = tint slot name. */

export const spearman = {
  id: 'spearman',
  type: 'figure',
  displayName: 'SPEARMAN',
  tint: {
    armor: [0.640, 0.660, 0.700],   // plain steel kettle helm
    trim:  [1.000, 0.905, 0.655],   // cream tunic and tan boots. Warm rather
                                    // than neutral: the key light is near-vertical,
                                    // so vertical faces are dim and a neutral
                                    // cream reads as grey against the sky light.
    cloth: [0.285, 0.190, 0.130],   // brown trousers
    skin:  [0.960, 0.770, 0.160],   // classic minifig yellow
    blade: [0.560, 0.580, 0.620],   // spear shaft steel
    dark:  [0.075, 0.065, 0.060],   // brow, mouth, buckle, sideburns
    glow:  [0.790, 0.560, 0.375],   // bare reddish-tan arms
    metal: [0.330, 0.215, 0.140],   // leather belt and grip wrap
  },
  meshScale: 1.00,
  parts: [
    /* ---------------- hips ---------------- */
    { j:0, g:'box',   o:[0, 0.01, 0],         s:[0.56, 0.22, 0.34], c:'cloth' },
    { j:0, g:'box',   o:[0,-0.10, 0],         s:[0.54, 0.10, 0.32], c:'metal' },
    { j:0, g:'box',   o:[0,-0.10, 0.166],     s:[0.12, 0.08, 0.02], c:'dark' },
    { j:0, g:'cyl12', o:[ 0.25, 0, 0],        s:[0.09, 0.07, 0.09], c:'cloth', r:[0,0,1.570796] },
    { j:0, g:'cyl12', o:[-0.25, 0, 0],        s:[0.09, 0.07, 0.09], c:'cloth', r:[0,0,1.570796] },

    /* ---------------- torso: sleeveless cream tunic ---------------- */
    { j:1, g:'box',   o:[0, 0.10, 0],         s:[0.58, 0.28, 0.36], c:'trim' },
    { j:1, g:'box',   o:[0, 0.36, 0],         s:[0.80, 0.30, 0.42], c:'trim' },
    { j:1, g:'box',   o:[0, 0.545, 0],        s:[0.84, 0.06, 0.44], c:'trim' },
    { j:1, g:'box',   o:[0, 0.30,-0.225],     s:[0.54, 0.58, 0.04], c:'trim' },
    /* plain tunic hem — an angled pair of plates here read as a row of beads
       at gameplay zoom, so the hem is left square */
    { j:1, g:'cyl12', o:[0, 0.575, 0],        s:[0.30, 0.08, 0.30], c:'skin' },

    /* ---------------- head + kettle helm ---------------- */
    { j:2, g:'cyl12', o:[0, 0.13, 0],         s:[0.64, 0.44, 0.64], c:'skin' },
    { j:2, g:'cyl12', o:[0, 0.375, 0],        s:[0.30, 0.09, 0.30], c:'skin' },
    /* dome, rounded cap, then the wide flared brim (an upright cone is
       widest at its base, so it flares down and out like the reference) */
    { j:2, g:'cone',  o:[0, 0.500, 0],        s:[0.76, 0.36, 0.76], c:'armor' },
    { j:2, g:'sph',   o:[0, 0.665, 0],        s:[0.30, 0.22, 0.30], c:'armor' },
    { j:2, g:'cone',  o:[0, 0.340, 0],        s:[0.94, 0.19, 0.94], c:'armor' },
    { j:2, g:'box',   o:[0, 0.140, 0.352],    s:[0.07, 0.30, 0.03], c:'armor' },
    /* face */
    { j:2, g:'box',   o:[ 0.115, 0.198, 0.322], s:[0.16, 0.034, 0.02], c:'dark', r:[0,0, 0.20] },
    { j:2, g:'box',   o:[-0.115, 0.198, 0.322], s:[0.16, 0.034, 0.02], c:'dark', r:[0,0,-0.20] },
    { j:2, g:'box',   o:[ 0.115, 0.148, 0.322], s:[0.072, 0.072, 0.02], c:'INK' },
    { j:2, g:'box',   o:[-0.115, 0.148, 0.322], s:[0.072, 0.072, 0.02], c:'INK' },
    { j:2, g:'box',   o:[0, 0.070, 0.330],    s:[0.10, 0.10, 0.08], c:'skin' },
    { j:2, g:'box',   o:[0, 0.030, 0.322],    s:[0.20, 0.050, 0.02], c:'dark' },
    { j:2, g:'box',   o:[0, 0.032, 0.334],    s:[0.16, 0.024, 0.012], c:'trim' },
    /* sideburns */
    { j:2, g:'box',   o:[ 0.272, 0.090, 0.270], s:[0.06, 0.18, 0.12], c:'dark' },
    { j:2, g:'box',   o:[-0.272, 0.090, 0.270], s:[0.06, 0.18, 0.12], c:'dark' },

    /* ---------------- left arm (bare) ---------------- */
    { j:3, g:'box',   o:[0,-0.20, 0],         s:[0.22, 0.44, 0.24], c:'glow' },
    { j:4, g:'box',   o:[0,-0.17, 0],         s:[0.20, 0.34, 0.22], c:'glow' },
    { j:5, g:'cyl12', o:[0,-0.04, 0],         s:[0.26, 0.12, 0.26], c:'skin', r:[1.570796,0,0] },
    { j:5, g:'box',   o:[0,-0.12, 0.05],      s:[0.10, 0.11, 0.14], c:'skin' },

    /* ---------------- right arm + long spear ---------------- */
    { j:6, g:'box',   o:[0,-0.20, 0],         s:[0.22, 0.44, 0.24], c:'glow' },
    { j:7, g:'box',   o:[0,-0.17, 0],         s:[0.20, 0.34, 0.22], c:'glow' },
    { j:8, g:'cyl12', o:[0,-0.04, 0],         s:[0.26, 0.12, 0.26], c:'skin', r:[1.570796,0,0] },
    { j:8, g:'box',   o:[0,-0.12, 0.05],      s:[0.10, 0.11, 0.14], c:'skin' },
    /* shaft taller than the figure, so the long reach reads at a glance */
    { j:8, g:'cyl',   o:[0, 0.55, 0],         s:[0.078, 3.30, 0.078], c:'blade' },
    { j:8, g:'cyl12', o:[0,-0.02, 0],         s:[0.105, 0.30, 0.105], c:'metal' },
    { j:8, g:'cyl12', o:[0,-1.06, 0],         s:[0.095, 0.08, 0.095], c:'metal' },
    { j:8, g:'cyl12', o:[0, 2.10, 0],         s:[0.120, 0.12, 0.120], c:'metal' },
    { j:8, g:'cone',  o:[0, 2.46, 0],         s:[0.20, 0.54, 0.20], c:'blade' },

    /* ---------------- legs: brown trousers, tan boots ---------------- */
    { j:9,  g:'box',   o:[0,-0.23, 0],        s:[0.30, 0.50, 0.34], c:'cloth' },
    { j:10, g:'box',   o:[0,-0.20, 0],        s:[0.27, 0.42, 0.31], c:'cloth' },
    { j:10, g:'box',   o:[0,-0.305, 0],       s:[0.28, 0.05, 0.32], c:'skin' },
    { j:10, g:'box',   o:[0,-0.42, 0.09],     s:[0.31, 0.16, 0.46], c:'trim' },
    { j:11, g:'box',   o:[0,-0.23, 0],        s:[0.30, 0.50, 0.34], c:'cloth' },
    { j:12, g:'box',   o:[0,-0.20, 0],        s:[0.27, 0.42, 0.31], c:'cloth' },
    { j:12, g:'box',   o:[0,-0.305, 0],       s:[0.28, 0.05, 0.32], c:'skin' },
    { j:12, g:'box',   o:[0,-0.42, 0.09],     s:[0.31, 0.16, 0.46], c:'trim' },
  ],
  added: '2026-11-14',
  notes: 'Levy spearman from the reference grid: steel kettle helm with a flared brim and nose guard, bare tan arms, cream tunic, brown trousers, and a spear taller than the figure. 41 moulded parts on the shared 13-joint rig.',
};
export default spearman;
