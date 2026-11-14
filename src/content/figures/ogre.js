/* SPIKED OGRE — chapter 4 boss figure.
   Cloned from the reference photo: a squat, top-heavy troll with a green hide,
   tusks, a studded brow, bony spikes across the skull and back, and a GIANT
   SPIKED CLUB in the weapon hand (joint 8).

   Deliberately exaggerated for a boss silhouette at gameplay zoom: shoulders
   wider than the hips, arms long enough to reach the ground, short legs. The
   club alone is taller than the ogre's torso, which is what makes the spin
   attack readable from across the arena.
   c = tint slot name. */

export const spikedOgre = {
  id: 'ogre',
  type: 'figure',
  displayName: 'SPIKED OGRE',
  tint: {
    armor: [0.330, 0.215, 0.135],   // boiled leather straps and boots
    trim:  [0.880, 0.850, 0.735],   // bone: tusks, spikes, teeth
    cloth: [0.195, 0.135, 0.100],   // loincloth
    skin:  [0.355, 0.535, 0.255],   // ogre green
    blade: [0.415, 0.275, 0.155],   // club timber
    dark:  [0.065, 0.058, 0.055],   // mouth, gaps, grip wrap
    glow:  [1.000, 0.420, 0.100],   // rage-lit eyes
    metal: [0.450, 0.440, 0.415],   // club bands and studs
  },
  meshScale: 1.55,
  parts: [
    /* ---------------- hips ---------------- */
    { j:0, g:'box',   o:[0, 0.00, 0],      s:[0.80, 0.26, 0.46], c:'armor' },
    { j:0, g:'box',   o:[0,-0.13, 0],      s:[0.72, 0.10, 0.40], c:'dark' },
    { j:0, g:'box',   o:[0,-0.13, 0.205],  s:[0.18, 0.09, 0.03], c:'metal' },
    { j:0, g:'box',   o:[0,-0.34, 0.200],  s:[0.44, 0.42, 0.05], c:'cloth', r:[0.08,0,0] },
    { j:0, g:'box',   o:[0,-0.32,-0.200],  s:[0.44, 0.40, 0.05], c:'cloth', r:[-0.06,0,0] },

    /* ---------------- torso ---------------- */
    { j:1, g:'sph',   o:[0, 0.14, 0],      s:[0.98, 0.46, 0.58], c:'skin' },
    { j:1, g:'box',   o:[0, 0.42, 0],      s:[1.06, 0.36, 0.58], c:'skin' },
    { j:1, g:'box',   o:[0, 0.60, 0],      s:[0.98, 0.20, 0.54], c:'skin' },
    { j:1, g:'box',   o:[0, 0.40, 0.300],  s:[0.90, 0.14, 0.04], c:'armor', r:[0,0,0.26] },
    { j:1, g:'box',   o:[0.21, 0.45, 0.320], s:[0.15, 0.13, 0.04], c:'metal' },
    /* bony spikes along the spine */
    { j:1, g:'cone',  o:[0, 0.66,-0.30],   s:[0.13, 0.34, 0.13], c:'trim', r:[-0.55,0,0] },
    { j:1, g:'cone',  o:[0, 0.50,-0.34],   s:[0.12, 0.30, 0.12], c:'trim', r:[-0.80,0,0] },
    { j:1, g:'cone',  o:[0, 0.32,-0.36],   s:[0.11, 0.26, 0.11], c:'trim', r:[-1.00,0,0] },
    { j:1, g:'cyl12', o:[0, 0.70, 0],      s:[0.34, 0.10, 0.34], c:'skin' },

    /* ---------------- head ---------------- */
    { j:2, g:'cyl12', o:[0, 0.12, 0],      s:[0.62, 0.42, 0.62], c:'skin' },
    { j:2, g:'box',   o:[0, 0.26, 0.280],  s:[0.62, 0.11, 0.15], c:'skin' },
    { j:2, g:'box',   o:[0, 0.10, 0.320],  s:[0.16, 0.13, 0.11], c:'skin' },
    { j:2, g:'box',   o:[0,-0.06, 0.260],  s:[0.52, 0.17, 0.17], c:'skin' },
    { j:2, g:'box',   o:[0,-0.02, 0.345],  s:[0.40, 0.045, 0.02], c:'dark' },
    /* eyes, deep-set and glowing */
    { j:2, g:'box',   o:[ 0.135, 0.185, 0.312], s:[0.10, 0.055, 0.02], c:'glow' },
    { j:2, g:'box',   o:[-0.135, 0.185, 0.312], s:[0.10, 0.055, 0.02], c:'glow' },
    { j:2, g:'box',   o:[ 0.135, 0.225, 0.316], s:[0.15, 0.045, 0.02], c:'skin', r:[0,0,-0.16] },
    { j:2, g:'box',   o:[-0.135, 0.225, 0.316], s:[0.15, 0.045, 0.02], c:'skin', r:[0,0, 0.16] },
    /* tusks, pointing up out of the lower jaw */
    { j:2, g:'cone',  o:[ 0.175,-0.02, 0.330], s:[0.080, 0.22, 0.080], c:'trim', r:[0.55,0,-0.26] },
    { j:2, g:'cone',  o:[-0.175,-0.02, 0.330], s:[0.080, 0.22, 0.080], c:'trim', r:[0.55,0, 0.26] },
    { j:2, g:'box',   o:[ 0.100,-0.045, 0.352], s:[0.055, 0.05, 0.02], c:'trim' },
    { j:2, g:'box',   o:[-0.100,-0.045, 0.352], s:[0.055, 0.05, 0.02], c:'trim' },
    /* ears */
    { j:2, g:'cone',  o:[ 0.320, 0.10, 0], s:[0.10, 0.17, 0.10], c:'skin', r:[0,0,-1.20] },
    { j:2, g:'cone',  o:[-0.320, 0.10, 0], s:[0.10, 0.17, 0.10], c:'skin', r:[0,0, 1.20] },
    /* skull spikes */
    { j:2, g:'cone',  o:[ 0.00, 0.42, 0.02], s:[0.10, 0.26, 0.10], c:'trim', r:[0,0,0] },
    { j:2, g:'cone',  o:[ 0.19, 0.36,-0.02], s:[0.085, 0.21, 0.085], c:'trim', r:[0,0,-0.34] },
    { j:2, g:'cone',  o:[-0.19, 0.36,-0.02], s:[0.085, 0.21, 0.085], c:'trim', r:[0,0, 0.34] },
    { j:2, g:'cone',  o:[ 0.00, 0.32,-0.20], s:[0.085, 0.22, 0.085], c:'trim', r:[0.45,0,0] },

    /* ---------------- left arm (free hand) ---------------- */
    { j:3, g:'sph',   o:[0, 0.08, 0],      s:[0.64, 0.54, 0.64], c:'skin' },
    { j:3, g:'cone',  o:[0, 0.30, 0],      s:[0.11, 0.24, 0.11], c:'trim', r:[0,0,0] },
    { j:3, g:'cyl12', o:[0,-0.280, 0],     s:[0.32, 0.42, 0.32], c:'skin' },
    { j:4, g:'cyl12', o:[0,-0.200, 0],     s:[0.32, 0.38, 0.32], c:'skin' },
    { j:4, g:'cyl12', o:[0,-0.380, 0],     s:[0.36, 0.11, 0.36], c:'armor' },
    { j:5, g:'box',   o:[0,-0.170, 0.02],  s:[0.36, 0.28, 0.34], c:'skin' },
    { j:5, g:'box',   o:[0,-0.300, 0.06],  s:[0.30, 0.12, 0.26], c:'skin' },

    /* ---------------- right arm + GIANT SPIKED CLUB ---------------- */
    { j:6, g:'sph',   o:[0, 0.08, 0],      s:[0.64, 0.54, 0.64], c:'skin' },
    { j:6, g:'cone',  o:[0, 0.30, 0],      s:[0.11, 0.24, 0.11], c:'trim', r:[0,0,0] },
    { j:6, g:'cyl12', o:[0,-0.280, 0],     s:[0.32, 0.42, 0.32], c:'skin' },
    { j:7, g:'cyl12', o:[0,-0.200, 0],     s:[0.32, 0.38, 0.32], c:'skin' },
    { j:7, g:'cyl12', o:[0,-0.380, 0],     s:[0.36, 0.11, 0.36], c:'armor' },
    { j:8, g:'box',   o:[0,-0.170, 0.02],  s:[0.36, 0.28, 0.34], c:'skin' },
    { j:8, g:'box',   o:[0,-0.300, 0.06],  s:[0.30, 0.12, 0.26], c:'skin' },
    /* club: shaft, grip wrap, butt cap, head, bands, nine spikes */
    { j:8, g:'cyl',   o:[0, 0.34, 0],      s:[0.17, 1.26, 0.17], c:'blade' },
    { j:8, g:'cyl12', o:[0,-0.10, 0],      s:[0.21, 0.26, 0.21], c:'dark' },
    { j:8, g:'cyl12', o:[0,-0.28, 0],      s:[0.25, 0.10, 0.25], c:'metal' },
    { j:8, g:'cyl12', o:[0, 0.82, 0],      s:[0.30, 0.09, 0.30], c:'metal' },
    { j:8, g:'cyl12', o:[0, 1.10, 0],      s:[0.68, 0.74, 0.68], c:'blade' },
    { j:8, g:'cyl12', o:[0, 1.46, 0],      s:[0.56, 0.17, 0.56], c:'metal' },
    { j:8, g:'cyl12', o:[0, 0.88, 0],      s:[0.70, 0.11, 0.70], c:'metal' },
    /* spike ring: up, four cardinal, four diagonal */
    { j:8, g:'cone',  o:[ 0.00, 1.66, 0.00], s:[0.14, 0.32, 0.14], c:'trim', r:[0,0,0] },
    { j:8, g:'cone',  o:[ 0.56, 1.16, 0.00], s:[0.14, 0.34, 0.14], c:'trim', r:[0,0,-1.570796] },
    { j:8, g:'cone',  o:[-0.56, 1.16, 0.00], s:[0.14, 0.34, 0.14], c:'trim', r:[0,0, 1.570796] },
    { j:8, g:'cone',  o:[ 0.00, 1.16, 0.56], s:[0.14, 0.34, 0.14], c:'trim', r:[1.570796,0,0] },
    { j:8, g:'cone',  o:[ 0.00, 1.16,-0.56], s:[0.14, 0.34, 0.14], c:'trim', r:[-1.570796,0,0] },
    { j:8, g:'cone',  o:[ 0.42, 1.40, 0.42], s:[0.12, 0.28, 0.12], c:'trim', r:[0.72,0,-0.72] },
    { j:8, g:'cone',  o:[-0.42, 1.40, 0.42], s:[0.12, 0.28, 0.12], c:'trim', r:[0.72,0, 0.72] },
    { j:8, g:'cone',  o:[ 0.42, 1.40,-0.42], s:[0.12, 0.28, 0.12], c:'trim', r:[-0.72,0,-0.72] },
    { j:8, g:'cone',  o:[-0.42, 1.40,-0.42], s:[0.12, 0.28, 0.12], c:'trim', r:[-0.72,0, 0.72] },

    /* ---------------- legs ---------------- */
    { j:9,  g:'box',   o:[0,-0.240, 0],    s:[0.38, 0.46, 0.42], c:'skin' },
    { j:10, g:'box',   o:[0,-0.220, 0],    s:[0.36, 0.40, 0.40], c:'skin' },
    { j:10, g:'box',   o:[0,-0.430, 0.110], s:[0.40, 0.17, 0.56], c:'armor' },
    { j:10, g:'cyl12', o:[0,-0.020, 0],    s:[0.38, 0.09, 0.38], c:'armor', r:[1.570796,0,0] },
    { j:11, g:'box',   o:[0,-0.240, 0],    s:[0.38, 0.46, 0.42], c:'skin' },
    { j:12, g:'box',   o:[0,-0.220, 0],    s:[0.36, 0.40, 0.40], c:'skin' },
    { j:12, g:'box',   o:[0,-0.430, 0.110], s:[0.40, 0.17, 0.56], c:'armor' },
    { j:12, g:'cyl12', o:[0,-0.020, 0],    s:[0.38, 0.09, 0.38], c:'armor', r:[1.570796,0,0] },
  ],
  added: '2026-11-14',
  notes: 'Squat top-heavy troll from the reference photo: green hide, tusks, glowing eyes, bony skull and spine spikes, leather straps, and a giant spiked club taller than its torso. 71 moulded parts on the shared 13-joint rig, rendered at meshScale 1.55.',
};

export default spikedOgre;
