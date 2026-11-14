/* SPIKED OGRE — RUST HIDE (twin variant).
   Chapter 4 fields TWO Spiked Ogres at once (Matt, 2026-11-14: "bigger
   size and 2 together in different colour"). The second ogre is the same
   mould — same 13-joint rig, same 71 parts, same meshScale — wearing a
   rust red-brown hide instead of the first ogre's green, so the pair
   reads as two distinct bosses in the arena and in screenshots.

   The parts array is shared with figures/ogre.js on purpose: one mould,
   two hides. Only the tint (and the eye glow, pushed yellow so the faces
   differ at gameplay zoom too) changes. c = tint slot name. */

import { spikedOgre } from './ogre.js';

export const ogreRust = {
  ...spikedOgre,
  id: 'ogre-rust',
  displayName: 'SPIKED OGRE — RUST HIDE',
  tint: {
    ...spikedOgre.tint,
    skin: [0.545, 0.270, 0.145],   // rust red-brown hide (vs ogre green)
    glow: [1.000, 0.780, 0.150],   // sulphur-yellow rage eyes (vs orange)
  },
  added: '2026-11-14',
  notes: 'Twin variant of the Spiked Ogre figure: identical parts/rig/scale, rust red-brown hide and yellow eyes. Spawned as the second chapter-4 boss via the boss descriptor\'s twinFigure.',
};

export default ogreRust;
