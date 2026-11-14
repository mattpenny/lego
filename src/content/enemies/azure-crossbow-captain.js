/* AZURE CROSSBOW CAPTAIN — ranged ELITE (archery pack 2026-11-14,
   integrated AB-NET-20). Gold sash, brighter plume and the crossbow
   live in figures/azure-crossbow-captain.js.

   Elite status is justified by the MARKED VOLLEY zone, not raw stats.
   The pack's `markedVolley` block is flattened into cfg (volley*) —
   the same treatment the Spiked Ogre's spin/super blocks got — and
   the sim runs it on the boss fixed-ring pattern: the ring centre is
   the target hero's position SNAPPED at telegraph start, telegraphed
   with a fixed-radius warning ring (never an expanding one), and one
   damage tick lands inside it. The pack gave the normal attack only
   a range (18); the kite band's floor (minRange 11) is the one
   integrator translation, in family with the other crossbow kinds.
   Event packs only: chapters 4-6 (see the map descriptors). */
export const azureCrossbowCaptain = {
  id: 'azure-crossbow-captain', kind: 'azure-crossbow-captain', type: 'enemy', cls: 'ranged', figure: 'azure-crossbow-captain',
  cfg: {
    hp: 165, speed: 3.3, dmg: 18, radius: 0.55, score: 850,
    minRange: 11, maxRange: 18, volley: 3.2, projSpeed: 24, projR: 0.07,
    tele: 0.8, recovery: 1.0,
    volleyRange: 18, volleyTele: 0.85, volleyRadius: 2.4, volleyDmg: 22,
    volleyCd: 8, volleyActive: 0.2,
  },
  cap: 1, wave: null, elite: true, events: [4, 5, 6], fill: null,
  added: '2026-11-14',
  notes: 'Elite status is justified by the Marked Volley zone, not raw stats. Normal bolts pressure; the marked ring forces a roll or movement. Cap 1. Intended for 90 s elite events and chapter 4-6 event packs.',
  behaviour: [
    'Normal attack: aims at the hero for 0.8 s, fires one 24 m/s bolt for 18 dmg, recovery 1.0 s, volley cycle 3.2 s.',
    'Every 8 s, if the hero is within 18 m: marks a fixed 2.4 m radius ring at the hero\u2019s position at telegraph start; the ring warns for 0.85 s.',
    'When the telegraph ends, one 22 dmg tick lands on heroes inside the ring over a 0.2 s active window; roll i-frames avoid it.',
    'Counter-play: move out of the fixed ring during the 0.85 s telegraph; do not roll early. Punish during the 1.0 s post-volley recovery.',
  ],
};
export default azureCrossbowCaptain;
