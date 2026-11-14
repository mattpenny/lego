/* CHAPTER 4 BOSS — THE SPIKED OGRE (x2).
   From Matt's content pack 2026-11-14, replacing the Grave Sovereign
   placeholder on frostfall-glacier. BOSS_NAMES[chapter-1] feeds the boss
   HUD and BOSS_CFG_BY_CHAPTER[chapter] feeds the deterministic sim.

   MATT'S OVERRIDES on the pack's single-ogre design:
   - BIGGER: the ogre figure renders at meshScale 1.55 (figures/ogre.js),
     ~1.55x the base figure height, towering over the heroes.
   - TWO AT ONCE, DIFFERENT COLOURS: `twinFigure` makes spawnBoss field
     a second ogre wearing the rust-hide variant figure
     (figures/ogre-rust.js). Both run this same cfg and the shared
     phase-2/FURY machinery, independently. The chapter clears only when
     BOTH are dead. Player-count HP scaling applies per ogre (solo total
     2 x 520 = 1,040 HP). */
export const spikedOgre = {
  id: "spiked-ogre", type: 'boss', chapter: 4,
  name: "THE SPIKED OGRE", displayName: "THE SPIKED OGRE",
  mapId: "frostfall-glacier", figure: "ogre", twinFigure: "ogre-rust", kind: "boss",
  cfg: {
    hp: 520,
    spawnMin: 26,
    spawnMax: 30,
    speed: 5.6,
    chargeSpeed: 14,
    chargeTele: 0.8,
    chargeDur: 0.6,
    chargeCd: 3.4,
    chargeRange: 8,
    chargeDmg: 24,
    slamTele: 0.6,
    slamRange: 2.6,
    slamDmg: 26,
    spinTele: 0.75,
    spinDur: 0.55,
    spinRange: 4.6,
    spinDmg: 30,
    spinCd: 6.5,
    superTele: 0.95,
    superDur: 0.45,
    superRange: 5.4,
    superDmg: 38,
    superCd: 9,
    radius: 1.45,
    score: 2600,
  },
  sharedSim: 'own cfg above; phase2 from src/content/enemies/bosses/shared.js',
  added: '2026-11-14',
  notes: "Chapter 4 boss — fought as a PAIR (green hide + rust hide, twinFigure). A club-swinging ogre with two attacks no other boss has: a 360-degree spin that hits everything around it, and a super slam that damages a 5.4 m circle and kicks dust out of the ground. Each ogre scores 2600 on death; the chapter clears when both are dead.",
  behaviour: [
    "TWO ogres spawn together (green + rust hides); each fights independently with this full move set, its own phase 2 and its own FURY.",
    "Close (< 5.4 m) with the super slam ready: 0.95 s telegraph, then a circular 38-dmg ground slam over a 5.4 m radius.",
    "Close (< 4.6 m) with the spin ready: 0.75 s telegraph, then a 360-degree club sweep for 30 dmg to everything in 4.6 m.",
    "Close (< 2.6 m): telegraphed 0.6 s club sweep for 26 dmg.",
    "Beyond 8 m with the charge ready: 0.8 s locked-facing telegraph, then a 14 m/s charge for 24 dmg.",
    "Phase 2 (per ogre): summons 2 soldiers at <=50% HP; enrage at <=30% HP (approach speed x1.15, slam +4); FURY at <=15%.",
  ],
};
export default spikedOgre;
