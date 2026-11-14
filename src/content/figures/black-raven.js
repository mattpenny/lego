/* BLACK RAVEN — hooded demon knight, cloned from the LEGO reference grid
   (bottom-right figure of 61oJx4yOx2L.jpg).

   Reference reads: glossy black pointed hood with a wide flared brim, a dark
   crimson demon face with a heavy brow and a fanged grimace, a black cuirass
   carrying WHITE plate sections at the collar, chest sides and waist, a red
   heater shield on the chest with a black raven silhouette, and a huge black
   notched glaive in the weapon hand.

   Everything is expressed through the shared 13-joint rig and the eight
   standard tint slots plus 'INK' for the printed pupils, so no renderer or
   animation change is needed. c = tint slot name. */

export const blackRaven = {
  id: 'black-raven',
  type: 'figure',
  displayName: 'BLACK RAVEN',
  tint: {
    armor: [0.082, 0.082, 0.100],   // glossy black plate and hood
    trim:  [0.815, 0.825, 0.860],   // the white breastplate sections
    cloth: [0.055, 0.055, 0.070],   // hood drape fabric
    skin:  [0.615, 0.105, 0.078],   // crimson demon hide
    blade: [0.205, 0.212, 0.245],   // glaive steel — deliberately lighter than
                                    // the black plate so the weapon separates
                                    // from the hood at gameplay zoom
    dark:  [0.032, 0.032, 0.042],   // near-black gaps, belt, mouth cavity
    glow:  [0.780, 0.095, 0.072],   // the red chest shield
    metal: [0.395, 0.405, 0.445],   // grey steel: bracers, buckle, blade edge
  },
  meshScale: 1.10,
  parts: [
    /* ---------------- hips ---------------- */
    { j:0, g:'box',   o:[0, 0.01, 0],         s:[0.58, 0.22, 0.34], c:'armor' },
    { j:0, g:'box',   o:[0,-0.11, 0],         s:[0.50, 0.09, 0.29], c:'dark' },
    { j:0, g:'box',   o:[0,-0.11, 0.152],     s:[0.13, 0.07, 0.02], c:'metal' },
    { j:0, g:'cyl12', o:[ 0.26, 0, 0],        s:[0.09, 0.07, 0.09], c:'dark', r:[0,0,1.570796] },
    { j:0, g:'cyl12', o:[-0.26, 0, 0],        s:[0.09, 0.07, 0.09], c:'dark', r:[0,0,1.570796] },
    /* white thigh plates hanging off the belt */
    { j:0, g:'box',   o:[ 0.17,-0.17, 0.10],  s:[0.21, 0.24, 0.06], c:'trim', r:[0.08,0, 0.05] },
    { j:0, g:'box',   o:[-0.17,-0.17, 0.10],  s:[0.21, 0.24, 0.06], c:'trim', r:[0.08,0,-0.05] },

    /* ---------------- torso ---------------- */
    { j:1, g:'box',   o:[0, 0.10, 0],         s:[0.60, 0.28, 0.38], c:'armor' },
    { j:1, g:'box',   o:[0, 0.36, 0],         s:[0.86, 0.30, 0.44], c:'armor' },
    { j:1, g:'box',   o:[0, 0.545, 0],        s:[0.90, 0.06, 0.46], c:'metal' },
    { j:1, g:'box',   o:[0, 0.30,-0.235],     s:[0.56, 0.60, 0.04], c:'armor' },
    /* white gorget across the collarbone with a black notch at its centre */
    { j:1, g:'box',   o:[0, 0.485, 0.222],    s:[0.74, 0.13, 0.03], c:'trim' },
    { j:1, g:'box',   o:[0, 0.485, 0.232],    s:[0.16, 0.09, 0.02], c:'dark' },
    /* white breast plates angled in from the shoulders */
    { j:1, g:'box',   o:[ 0.285, 0.355, 0.228], s:[0.24, 0.28, 0.03], c:'trim', r:[0,0,-0.30] },
    { j:1, g:'box',   o:[-0.285, 0.355, 0.228], s:[0.24, 0.28, 0.03], c:'trim', r:[0,0, 0.30] },
    /* red heater shield emblem: square shoulders, pointed base */
    { j:1, g:'box',   o:[0, 0.300, 0.238],    s:[0.38, 0.31, 0.02], c:'glow' },
    { j:1, g:'cone',  o:[0, 0.110, 0.238],    s:[0.38, 0.18, 0.02], c:'glow', r:[3.141593,0,0] },
    /* black raven on the shield: body, head, two raised wings, tail */
    { j:1, g:'box',   o:[0.000, 0.290, 0.250], s:[0.075, 0.135, 0.012], c:'dark' },
    { j:1, g:'box',   o:[0.046, 0.372, 0.250], s:[0.055, 0.050, 0.012], c:'dark' },
    { j:1, g:'box',   o:[-0.096, 0.348, 0.250], s:[0.135, 0.034, 0.012], c:'dark', r:[0,0, 0.30] },
    { j:1, g:'box',   o:[ 0.104, 0.342, 0.250], s:[0.128, 0.032, 0.012], c:'dark', r:[0,0,-0.26] },
    { j:1, g:'box',   o:[-0.060, 0.222, 0.250], s:[0.085, 0.030, 0.012], c:'dark', r:[0,0, 0.46] },
    { j:1, g:'box',   o:[ 0.062, 0.220, 0.250], s:[0.085, 0.030, 0.012], c:'dark', r:[0,0,-0.46] },
    { j:1, g:'box',   o:[0.020, 0.196, 0.250], s:[0.085, 0.028, 0.012], c:'dark', r:[0,0,-0.30] },
    /* white waist plates + belt buckle */
    { j:1, g:'box',   o:[ 0.235,-0.020, 0.222], s:[0.24, 0.15, 0.03], c:'trim', r:[0,0, 0.40] },
    { j:1, g:'box',   o:[-0.235,-0.020, 0.222], s:[0.24, 0.15, 0.03], c:'trim', r:[0,0,-0.40] },
    { j:1, g:'box',   o:[0,-0.055, 0.205],    s:[0.13, 0.10, 0.03], c:'metal' },
    { j:1, g:'cyl12', o:[0, 0.575, 0],        s:[0.30, 0.08, 0.30], c:'skin' },

    /* ---------------- head + hood ---------------- */
    { j:2, g:'cyl12', o:[0, 0.13, 0],         s:[0.64, 0.44, 0.64], c:'skin' },
    { j:2, g:'cyl12', o:[0, 0.375, 0],        s:[0.30, 0.09, 0.30], c:'skin' },
    /* the pointed hood: tall crown cone, apex cap, then the wide flared brim.
       An upright cone is widest at its base, so the brim flares down and out —
       exactly the reference silhouette. The brim's base sits at y 0.20, just
       above the brow, so the face stays open. */
    { j:2, g:'cone',  o:[0, 0.560,-0.030],    s:[0.80, 0.54, 0.78], c:'armor' },
    { j:2, g:'cone',  o:[0, 0.860,-0.045],    s:[0.23, 0.21, 0.23], c:'armor' },
    { j:2, g:'cone',  o:[0, 0.310,-0.020],    s:[0.90, 0.17, 0.88], c:'armor' },
    /* side flaps sweeping down past the jaw */
    { j:2, g:'box',   o:[ 0.345, 0.020, 0.020], s:[0.10, 0.40, 0.44], c:'armor', r:[0,0,-0.10] },
    { j:2, g:'box',   o:[-0.345, 0.020, 0.020], s:[0.10, 0.40, 0.44], c:'armor', r:[0,0, 0.10] },
    { j:2, g:'box',   o:[0, 0.060,-0.315],    s:[0.54, 0.44, 0.06], c:'cloth', r:[-0.10,0,0] },
    /* demon face: heavy brow, pale eyes, wide fanged grimace */
    { j:2, g:'box',   o:[ 0.115, 0.150, 0.318], s:[0.135, 0.100, 0.02], c:'trim' },
    { j:2, g:'box',   o:[-0.115, 0.150, 0.318], s:[0.135, 0.100, 0.02], c:'trim' },
    { j:2, g:'box',   o:[ 0.105, 0.145, 0.332], s:[0.060, 0.072, 0.02], c:'INK' },
    { j:2, g:'box',   o:[-0.105, 0.145, 0.332], s:[0.060, 0.072, 0.02], c:'INK' },
    { j:2, g:'box',   o:[ 0.115, 0.222, 0.320], s:[0.17, 0.034, 0.02], c:'dark', r:[0,0, 0.22] },
    { j:2, g:'box',   o:[-0.115, 0.222, 0.320], s:[0.17, 0.034, 0.02], c:'dark', r:[0,0,-0.22] },
    { j:2, g:'box',   o:[0, 0.070, 0.335],    s:[0.10, 0.11, 0.08], c:'skin' },
    { j:2, g:'box',   o:[0,-0.010, 0.330],    s:[0.30, 0.090, 0.02], c:'dark' },
    { j:2, g:'box',   o:[0,-0.008, 0.342],    s:[0.26, 0.046, 0.015], c:'trim' },
    { j:2, g:'cone',  o:[ 0.125,-0.055, 0.342], s:[0.045, 0.10, 0.045], c:'trim' },
    { j:2, g:'cone',  o:[-0.125,-0.055, 0.342], s:[0.045, 0.10, 0.045], c:'trim' },

    /* ---------------- left arm (free hand) ---------------- */
    { j:3, g:'sph',   o:[0, 0.04, 0],         s:[0.48, 0.34, 0.48], c:'armor' },
    { j:3, g:'box',   o:[0,-0.20, 0],         s:[0.22, 0.44, 0.24], c:'armor' },
    { j:4, g:'box',   o:[0,-0.17, 0],         s:[0.20, 0.34, 0.22], c:'armor' },
    { j:4, g:'cyl12', o:[0,-0.31, 0],         s:[0.22, 0.10, 0.22], c:'metal' },
    { j:5, g:'cyl12', o:[0,-0.04, 0],         s:[0.26, 0.12, 0.26], c:'dark', r:[1.570796,0,0] },
    { j:5, g:'box',   o:[0,-0.12, 0.05],      s:[0.10, 0.11, 0.14], c:'dark' },

    /* ---------------- right arm + black glaive ---------------- */
    { j:6, g:'sph',   o:[0, 0.04, 0],         s:[0.48, 0.34, 0.48], c:'armor' },
    { j:6, g:'box',   o:[0,-0.20, 0],         s:[0.22, 0.44, 0.24], c:'armor' },
    { j:7, g:'box',   o:[0,-0.17, 0],         s:[0.20, 0.34, 0.22], c:'armor' },
    { j:7, g:'cyl12', o:[0,-0.31, 0],         s:[0.22, 0.10, 0.22], c:'metal' },
    { j:8, g:'cyl12', o:[0,-0.04, 0],         s:[0.26, 0.12, 0.26], c:'dark', r:[1.570796,0,0] },
    { j:8, g:'box',   o:[0,-0.12, 0.05],      s:[0.10, 0.11, 0.14], c:'dark' },
    /* shaft, grip wrap, butt cap, socket collar */
    { j:8, g:'cyl',   o:[0, 0.40, 0],         s:[0.105, 2.10, 0.105], c:'blade' },
    { j:8, g:'cyl12', o:[0,-0.04, 0],         s:[0.135, 0.34, 0.135], c:'dark' },
    { j:8, g:'cyl12', o:[0,-0.62, 0],         s:[0.145, 0.09, 0.145], c:'metal' },
    { j:8, g:'cyl12', o:[0, 1.50, 0],         s:[0.165, 0.13, 0.165], c:'metal' },
    /* Blade: ONE solid plate so the silhouette stays a blade rather than a
       staircase. The bright straight edge sits on the shaft side (as in the
       reference); the notched back is black with two metal serration tips
       that outline it against the dark palettes. Kept shorter than the
       reference so it does not swallow the figure at gameplay zoom. */
    { j:8, g:'box',   o:[-0.155, 1.86, 0],    s:[0.34, 0.62, 0.055], c:'blade' },
    { j:8, g:'box',   o:[-0.190, 2.06, 0],    s:[0.26, 0.24, 0.055], c:'blade', r:[0,0,-0.24] },
    { j:8, g:'cone',  o:[-0.235, 2.22, 0],    s:[0.16, 0.24, 0.055], c:'blade', r:[0,0,-0.30] },
    /* bright cutting edge on the shaft side, bright notched back on the other:
       the outline is what makes an all-black glaive readable */
    { j:8, g:'box',   o:[0.012, 1.86, 0],     s:[0.045, 0.62, 0.062], c:'metal' },
    { j:8, g:'box',   o:[-0.318, 1.86, 0],    s:[0.045, 0.62, 0.060], c:'metal' },
    { j:8, g:'box',   o:[-0.330, 2.00, 0],    s:[0.075, 0.085, 0.066], c:'dark' },
    { j:8, g:'box',   o:[-0.330, 1.74, 0],    s:[0.075, 0.085, 0.066], c:'dark' },
    { j:8, g:'cone',  o:[-0.02, 1.56, 0],     s:[0.11, 0.18, 0.05], c:'metal', r:[0,0, 1.90] },

    /* ---------------- legs ---------------- */
    { j:9,  g:'box',   o:[0,-0.23, 0],        s:[0.30, 0.50, 0.34], c:'armor' },
    { j:10, g:'box',   o:[0,-0.20, 0],        s:[0.27, 0.42, 0.31], c:'armor' },
    { j:10, g:'cyl12', o:[0,-0.02, 0],        s:[0.28, 0.07, 0.28], c:'metal', r:[1.570796,0,0] },
    { j:10, g:'box',   o:[0,-0.42, 0.09],     s:[0.31, 0.15, 0.46], c:'dark' },
    { j:11, g:'box',   o:[0,-0.23, 0],        s:[0.30, 0.50, 0.34], c:'armor' },
    { j:12, g:'box',   o:[0,-0.20, 0],        s:[0.27, 0.42, 0.31], c:'armor' },
    { j:12, g:'cyl12', o:[0,-0.02, 0],        s:[0.28, 0.07, 0.28], c:'metal', r:[1.570796,0,0] },
    { j:12, g:'box',   o:[0,-0.42, 0.09],     s:[0.31, 0.15, 0.46], c:'dark' },
  ],
  added: '2026-11-14',
  notes: 'Hooded demon knight from the reference grid: pointed black hood with a flared brim, crimson fanged face, black cuirass with white collar/chest/waist plates, a red heater shield carrying a black raven, and a huge black notched glaive. 67 moulded parts on the shared 13-joint rig.',
};
export default blackRaven;
