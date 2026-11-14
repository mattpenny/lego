/* ANSUM — THE CRESCENT OF FIRE.
   Figure descriptor cloned from the reference photo: a raven knight in dark
   gunmetal plate with a red spiked fan crest, a yellow tabard bearing a black
   raven inside a red border, a raven heater shield and a flame-edged blade.

   Everything is expressed through the shared 13-joint rig and the eight
   standard tint slots (armor/trim/cloth/skin/blade/dark/glow/metal) plus
   'INK' for the printed face, so no renderer or animation change is needed.
   c = tint slot name. */

export const ansum = {
  id: 'ansum',
  type: 'figure',
  displayName: 'ANSUM — THE CRESCENT OF FIRE',
  tint: {
    armor: [0.150, 0.160, 0.185],   // dark gunmetal plate
    trim:  [0.640, 0.105, 0.090],   // crest red + tabard/shield border
    cloth: [0.880, 0.630, 0.110],   // yellow tabard field
    skin:  [0.960, 0.770, 0.160],   // classic minifig yellow
    blade: [0.735, 0.755, 0.800],   // polished steel
    dark:  [0.060, 0.060, 0.075],   // near-black: raven print, gaps, grip
    glow:  [1.000, 0.460, 0.105],   // fire on the crescent edge
    metal: [0.500, 0.520, 0.565],   // bright steel trim
  },
  meshScale: 1.12,
  parts: [
    /* ---------------- hips ---------------- */
    { j:0, g:'box',   o:[0, 0.01, 0],      s:[0.60, 0.22, 0.36], c:'armor' },
    { j:0, g:'box',   o:[0,-0.10, 0],      s:[0.52, 0.09, 0.30], c:'dark' },
    { j:0, g:'box',   o:[0,-0.10, 0.158],  s:[0.13, 0.07, 0.02], c:'metal' },
    { j:0, g:'cyl12', o:[ 0.27, 0, 0],     s:[0.10, 0.07, 0.10], c:'dark', r:[0,0,1.570796] },
    { j:0, g:'cyl12', o:[-0.27, 0, 0],     s:[0.10, 0.07, 0.10], c:'dark', r:[0,0,1.570796] },
    /* thigh guards hanging from the belt */
    { j:0, g:'box',   o:[ 0.16,-0.16, 0.10], s:[0.20, 0.22, 0.06], c:'armor', r:[0.10,0,0.05] },
    { j:0, g:'box',   o:[-0.16,-0.16, 0.10], s:[0.20, 0.22, 0.06], c:'armor', r:[0.10,0,-0.05] },

    /* ---------------- torso ---------------- */
    { j:1, g:'box',   o:[0, 0.10, 0],      s:[0.60, 0.28, 0.38], c:'armor' },
    { j:1, g:'box',   o:[0, 0.36, 0],      s:[0.86, 0.30, 0.44], c:'armor' },
    { j:1, g:'box',   o:[0, 0.545, 0],     s:[0.90, 0.06, 0.46], c:'metal' },
    { j:1, g:'box',   o:[0, 0.30,-0.235],  s:[0.56, 0.60, 0.04], c:'armor' },
    /* tabard: red border plate, yellow field on top of it, raven print on top */
    { j:1, g:'box',   o:[0, 0.295, 0.222], s:[0.58, 0.50, 0.02], c:'trim' },
    { j:1, g:'box',   o:[0, 0.295, 0.232], s:[0.54, 0.44, 0.02], c:'cloth' },
    /* black raven: body, head, beak, two wings, tail, legs */
    { j:1, g:'box',   o:[0.012, 0.288, 0.246], s:[0.098, 0.155, 0.012], c:'dark' },
    { j:1, g:'box',   o:[0.062, 0.378, 0.246], s:[0.062, 0.056, 0.012], c:'dark' },
    { j:1, g:'box',   o:[0.108, 0.372, 0.246], s:[0.048, 0.022, 0.012], c:'dark' },
    /* wings: near-horizontal bars read as a bird at gameplay zoom; the
       diagonal version collapsed into a blob */
    { j:1, g:'box',   o:[-0.092, 0.330, 0.246], s:[0.150, 0.038, 0.012], c:'dark', r:[0,0,0.20] },
    { j:1, g:'box',   o:[ 0.104, 0.320, 0.246], s:[0.135, 0.036, 0.012], c:'dark', r:[0,0,-0.16] },
    { j:1, g:'box',   o:[-0.030, 0.196, 0.246], s:[0.100, 0.034, 0.012], c:'dark', r:[0,0,-0.42] },
    { j:1, g:'box',   o:[ 0.000, 0.216, 0.246], s:[0.026, 0.052, 0.012], c:'dark' },
    { j:1, g:'box',   o:[ 0.034, 0.216, 0.246], s:[0.026, 0.052, 0.012], c:'dark' },
    /* chest straps */
    { j:1, g:'box',   o:[0, 0.46, 0.226], s:[0.64, 0.05, 0.02], c:'dark', r:[0,0,0.16] },
    { j:1, g:'cyl12', o:[0, 0.575, 0],     s:[0.30, 0.08, 0.30], c:'skin' },

    /* ---------------- head ---------------- */
    { j:2, g:'cyl12', o:[0, 0.13, 0],      s:[0.66, 0.44, 0.66], c:'skin' },
    /* great helm */
    { j:2, g:'cyl12', o:[0, 0.30, 0],      s:[0.78, 0.40, 0.78], c:'armor' },
    { j:2, g:'cyl12', o:[0, 0.48, 0],      s:[0.72, 0.10, 0.72], c:'armor' },
    { j:2, g:'sph',   o:[0, 0.545, 0],     s:[0.72, 0.22, 0.72], c:'armor' },
    /* brow band + nose guard */
    { j:2, g:'box',   o:[0, 0.405, 0.300], s:[0.64, 0.085, 0.11], c:'metal' },
    { j:2, g:'box',   o:[0, 0.300, 0.352], s:[0.075, 0.34, 0.06], c:'metal' },
    /* visor slit: dark recess with the eyes inside */
    { j:2, g:'box',   o:[0, 0.332, 0.340], s:[0.46, 0.078, 0.03], c:'dark' },
    { j:2, g:'box',   o:[0, 0.332, 0.350], s:[0.38, 0.036, 0.02], c:'INK' },
    /* cheek rivets */
    { j:2, g:'cyl12', o:[ 0.215, 0.245, 0.300], s:[0.048, 0.03, 0.048], c:'metal', r:[1.570796,0,0] },
    { j:2, g:'cyl12', o:[ 0.215, 0.150, 0.300], s:[0.048, 0.03, 0.048], c:'metal', r:[1.570796,0,0] },
    { j:2, g:'cyl12', o:[-0.215, 0.245, 0.300], s:[0.048, 0.03, 0.048], c:'metal', r:[1.570796,0,0] },
    { j:2, g:'cyl12', o:[-0.215, 0.150, 0.300], s:[0.048, 0.03, 0.048], c:'metal', r:[1.570796,0,0] },
    /* side plates */
    { j:2, g:'box',   o:[ 0.345, 0.235, 0.02], s:[0.075, 0.34, 0.42], c:'armor' },
    { j:2, g:'box',   o:[-0.345, 0.235, 0.02], s:[0.075, 0.34, 0.42], c:'armor' },
    /* ---- red fan crest: 11 spikes on an arc through the sagittal plane ---- */
    { j:2, g:'box',   o:[0, 0.612,-0.02],  s:[0.115, 0.13, 0.46], c:'trim' },
    { j:2, g:'cone',  o:[0, 0.905, 0.160], s:[0.085, 0.42, 0.055], c:'trim', r:[-1.200,0,0] },
    { j:2, g:'cone',  o:[0, 0.790, 0.268], s:[0.085, 0.42, 0.055], c:'trim', r:[-0.960,0,0] },
    { j:2, g:'cone',  o:[0, 0.640, 0.330], s:[0.085, 0.42, 0.055], c:'trim', r:[-0.720,0,0] },
    { j:2, g:'cone',  o:[0, 0.470, 0.345], s:[0.085, 0.42, 0.055], c:'trim', r:[-0.480,0,0] },
    { j:2, g:'cone',  o:[0, 0.300, 0.320], s:[0.085, 0.42, 0.055], c:'trim', r:[-0.240,0,0] },
    { j:2, g:'cone',  o:[0, 0.840,-0.010], s:[0.085, 0.44, 0.055], c:'trim', r:[0,0,0] },
    { j:2, g:'cone',  o:[0, 0.790,-0.290], s:[0.085, 0.42, 0.055], c:'trim', r:[0.240,0,0] },
    { j:2, g:'cone',  o:[0, 0.640,-0.360], s:[0.085, 0.42, 0.055], c:'trim', r:[0.480,0,0] },
    { j:2, g:'cone',  o:[0, 0.470,-0.375], s:[0.085, 0.42, 0.055], c:'trim', r:[0.720,0,0] },
    { j:2, g:'cone',  o:[0, 0.310,-0.350], s:[0.085, 0.42, 0.055], c:'trim', r:[0.960,0,0] },
    { j:2, g:'cone',  o:[0, 0.170,-0.290], s:[0.085, 0.40, 0.055], c:'trim', r:[1.200,0,0] },

    /* ---------------- left arm (shield) ---------------- */
    { j:3, g:'sph',   o:[0, 0.05, 0],      s:[0.52, 0.44, 0.52], c:'armor' },
    { j:3, g:'cyl12', o:[0,-0.055, 0],     s:[0.48, 0.08, 0.48], c:'metal' },
    { j:3, g:'cyl12', o:[0,-0.235, 0],     s:[0.25, 0.34, 0.25], c:'armor' },
    { j:4, g:'cyl12', o:[0,-0.170, 0],     s:[0.23, 0.32, 0.23], c:'armor' },
    { j:4, g:'cyl12', o:[0,-0.330, 0],     s:[0.26, 0.09, 0.26], c:'metal' },
    { j:5, g:'box',   o:[0,-0.140, 0.03],  s:[0.26, 0.21, 0.25], c:'metal' },
    /* raven heater shield */
    { j:5, g:'cyl12', o:[0.02,-0.175, 0.150], s:[0.96, 0.09, 0.96], c:'trim', r:[1.570796,0,0] },
    { j:5, g:'cyl12', o:[0.02,-0.175, 0.178], s:[0.78, 0.09, 0.78], c:'cloth', r:[1.570796,0,0] },
    { j:5, g:'box',   o:[0.02,-0.470, 0.165], s:[0.56, 0.34, 0.07], c:'cloth' },
    { j:5, g:'cone',  o:[0.02,-0.700, 0.165], s:[0.56, 0.30, 0.07], c:'cloth', r:[3.141593,0,0] },
    { j:5, g:'box',   o:[0.02,-0.470, 0.176], s:[0.62, 0.05, 0.05], c:'trim', r:[0,0,0] },
    /* shield raven */
    { j:5, g:'box',   o:[0.02,-0.360, 0.238], s:[0.090, 0.190, 0.012], c:'dark' },
    { j:5, g:'box',   o:[0.095,-0.245, 0.238], s:[0.075, 0.070, 0.012], c:'dark' },
    { j:5, g:'box',   o:[0.160,-0.250, 0.238], s:[0.060, 0.028, 0.012], c:'dark' },
    { j:5, g:'box',   o:[-0.075,-0.330, 0.238], s:[0.175, 0.050, 0.012], c:'dark', r:[0,0,0.60] },
    { j:5, g:'box',   o:[0.115,-0.355, 0.238], s:[0.160, 0.048, 0.012], c:'dark', r:[0,0,-0.45] },
    { j:5, g:'box',   o:[-0.055,-0.520, 0.238], s:[0.135, 0.048, 0.012], c:'dark', r:[0,0,-0.50] },
    { j:5, g:'cyl12', o:[0.02,-0.175, 0.232], s:[0.13, 0.03, 0.13], c:'metal', r:[1.570796,0,0] },

    /* ---------------- right arm (blade) ---------------- */
    { j:6, g:'sph',   o:[0, 0.05, 0],      s:[0.52, 0.44, 0.52], c:'armor' },
    { j:6, g:'cyl12', o:[0,-0.055, 0],     s:[0.48, 0.08, 0.48], c:'metal' },
    { j:6, g:'cyl12', o:[0,-0.235, 0],     s:[0.25, 0.34, 0.25], c:'armor' },
    { j:7, g:'cyl12', o:[0,-0.170, 0],     s:[0.23, 0.32, 0.23], c:'armor' },
    { j:7, g:'cyl12', o:[0,-0.330, 0],     s:[0.26, 0.09, 0.26], c:'metal' },
    { j:8, g:'box',   o:[0,-0.140, 0.03],  s:[0.26, 0.21, 0.25], c:'metal' },
    /* sword: grip, pommel, crescent guard, flame-edged blade */
    { j:8, g:'cyl',   o:[0,-0.050, 0],     s:[0.095, 0.26, 0.095], c:'dark' },
    { j:8, g:'sph',   o:[0,-0.195, 0],     s:[0.115, 0.115, 0.115], c:'metal' },
    { j:8, g:'box',   o:[0, 0.100, 0],     s:[0.30, 0.075, 0.115], c:'metal' },
    /* crescent guard: three boxes each side sweeping up into horns */
    { j:8, g:'box',   o:[ 0.150, 0.128, 0], s:[0.12, 0.055, 0.09], c:'metal', r:[0,0,0.42] },
    { j:8, g:'box',   o:[ 0.205, 0.196, 0], s:[0.10, 0.050, 0.08], c:'metal', r:[0,0,0.95] },
    { j:8, g:'cone',  o:[ 0.232, 0.268, 0], s:[0.07, 0.13, 0.06], c:'metal', r:[0,0,-0.35] },
    { j:8, g:'box',   o:[-0.150, 0.128, 0], s:[0.12, 0.055, 0.09], c:'metal', r:[0,0,-0.42] },
    { j:8, g:'box',   o:[-0.205, 0.196, 0], s:[0.10, 0.050, 0.08], c:'metal', r:[0,0,-0.95] },
    { j:8, g:'cone',  o:[-0.232, 0.268, 0], s:[0.07, 0.13, 0.06], c:'metal', r:[0,0,0.35] },
    /* blade points DOWN from the hand, matching the rig's slash convention */
    { j:8, g:'box',   o:[0,-0.480, 0],     s:[0.175, 0.56, 0.055], c:'blade' },
    { j:8, g:'box',   o:[0,-0.480, 0.030], s:[0.040, 0.50, 0.012], c:'dark' },
    { j:8, g:'cone',  o:[0,-0.830, 0],     s:[0.175, 0.17, 0.055], c:'blade', r:[3.141593,0,0] },
    /* fire along both edges + the tip: this is the burning crescent */
    { j:8, g:'box',   o:[ 0.088,-0.480, 0.012], s:[0.022, 0.54, 0.030], c:'glow' },
    { j:8, g:'box',   o:[-0.088,-0.480, 0.012], s:[0.022, 0.54, 0.030], c:'glow' },
    { j:8, g:'cone',  o:[0,-0.880, 0.010], s:[0.150, 0.20, 0.045], c:'glow', r:[3.141593,0,0] },
    { j:8, g:'sph',   o:[0,-0.300, 0.010], s:[0.19, 0.10, 0.05], c:'glow' },

    /* ---------------- legs ---------------- */
    { j:9,  g:'box',   o:[0,-0.235, 0],    s:[0.31, 0.48, 0.35], c:'armor' },
    { j:9,  g:'box',   o:[0,-0.180, 0.185], s:[0.26, 0.24, 0.03], c:'metal' },
    { j:10, g:'box',   o:[0,-0.215, 0],    s:[0.29, 0.40, 0.33], c:'armor' },
    { j:10, g:'box',   o:[0,-0.405, 0.085], s:[0.33, 0.14, 0.45], c:'armor' },
    { j:10, g:'box',   o:[0,-0.400, 0.290], s:[0.30, 0.11, 0.05], c:'metal' },
    { j:10, g:'cyl12', o:[0,-0.020, 0],    s:[0.30, 0.08, 0.30], c:'metal', r:[1.570796,0,0] },
    { j:11, g:'box',   o:[0,-0.235, 0],    s:[0.31, 0.48, 0.35], c:'armor' },
    { j:11, g:'box',   o:[0,-0.180, 0.185], s:[0.26, 0.24, 0.03], c:'metal' },
    { j:12, g:'box',   o:[0,-0.215, 0],    s:[0.29, 0.40, 0.33], c:'armor' },
    { j:12, g:'box',   o:[0,-0.405, 0.085], s:[0.33, 0.14, 0.45], c:'armor' },
    { j:12, g:'box',   o:[0,-0.400, 0.290], s:[0.30, 0.11, 0.05], c:'metal' },
    { j:12, g:'cyl12', o:[0,-0.020, 0],    s:[0.30, 0.08, 0.30], c:'metal', r:[1.570796,0,0] },
  ],
  added: '2026-11-14',
  notes: 'Raven knight from the reference photo: gunmetal great helm with a visor slit, brow band, cheek rivets and side plates; an 11-spike red fan crest; a yellow tabard with a black raven inside a red border; a raven heater shield; and a crescent-guard blade with fire along both edges. 98 moulded parts on the shared 13-joint rig.',
};

export default ansum;
