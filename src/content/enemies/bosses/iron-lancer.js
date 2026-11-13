/* THE IRON LANCER — chapter 3 boss (VOLCANO CASTLE). Replaces the
   humanoid Magma Tyrant for chapter 3 only; chapter 1's Emerald Drake
   and chapter 2's Grave Sovereign are untouched. Killing him here is
   the victory condition (+200 G victory bonus).

   A genuinely different boss, so he carries his OWN cfg (the
   CONTENT-GUIDE section 3 "different boss" route):
   BOSS_CFG_BY_CHAPTER in bosses/index.js picks this up. He is a
   cavalry boss: the charge is his signature — faster, harder and more
   frequent than the warlord's, triggered from closer in (chargeRange
   4.5 m instead of 6.5 m) so he spends the fight galloping at the
   hero. Close up, his "slam" is a sword sweep / stomp. Phase 2
   (summon + enrage) still comes from shared.js — he summons 2
   soldiers at <=50% HP and enrages at <=30% like the others. */
export const ironLancer = {
  id: 'iron-lancer', type: 'boss', chapter: 3,
  name: 'THE IRON LANCER', displayName: 'THE IRON LANCER',
  mapId: 'volcano-castle', figure: 'knight-mount',
  kind: 'knight-mount',
  cfg: {
    hp: 420, spawnMin: 26, spawnMax: 30, speed: 6.8,
    chargeSpeed: 19.0, chargeTele: 0.55, chargeDur: 0.55,
    chargeCd: 2.2, chargeRange: 4.5, chargeDmg: 26,
    slamTele: 0.55, slamRange: 2.3, slamDmg: 24,
    radius: 1.35, score: 2200,
  },
  sharedSim: 'own cfg above; phase2 from src/content/enemies/bosses/shared.js',
  added: '2026-11-13',
  notes: 'Spawns 26-30 m out at the 180 s mark. Enrage banner: THE IRON LANCER RAGES. Figure is the custom knightMount renderer (mounted knight).',
  behaviour: [
    'Beyond 4.5 m with the charge ready: 0.55 s locked-facing telegraph (sword raised), then a 19 m/s charge for 26 dmg.',
    'Close (< slam range): telegraphed sword sweep / stomp for 24 dmg.',
    'Phase 2: summons 2 soldiers at <=50% HP; enrage at <=30% HP (approach speed x1.15, slam +4).',
  ],
};
export default ironLancer;
