/* HERO — the default blue lion knight skin.
   Phase-2 content descriptor (source of truth for the Armoury + slash FX).
   `figure` names the TINTS/rigParts kind in src/game.js; `slashTip.b` is
   the right-hand weapon bone (see src/rig/joints.js). */

export const hero = {
  id: 'hero',
  type: 'hero',
  displayName: 'HERO',
  price: 0,
  default: true,
  figure: 'hero',
  slashTip: { b: 8, o: [0, -0.86, 0] },
  added: '2026-11-13',
  notes: 'Always owned, never sold in the Armoury. Classic blue lion knight.',
};

export default hero;
