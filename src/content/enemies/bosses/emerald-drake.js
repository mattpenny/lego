/* EMERALD DRAKE — chapter 1 boss (GRASSLAND). Replaces the humanoid
   Ashen Warden for chapter 1 only; chapters 2/3 keep the shared warlord.

   This boss is genuinely different, so it carries its OWN cfg (the
   CONTENT-GUIDE section 3 "different boss" route): BOSS_CFG_BY_CHAPTER in
   bosses/index.js picks this up, and the sim branches on the presence of
   cfg.breath. Phase 2 (summon + enrage) still comes from shared.js —
   the dragon summons 2 soldiers at <=50% HP and enrages at <=30% like
   the warlord, and its breath follows the phase-2 numbers below. */
export const emeraldDrake = {
  id: 'emerald-drake', type: 'boss', chapter: 1,
  name: 'EMERALD DRAKE', displayName: 'EMERALD DRAKE',
  mapId: 'grassland', figure: 'dragon',
  kind: 'dragon',
  cfg: {
    hp: 360, spawnMin: 26, spawnMax: 30, speed: 6.0,
    chargeSpeed: 16.0, chargeTele: 0.7, chargeDur: 0.55,
    chargeCd: 3.0, chargeRange: 6.5, chargeDmg: 24,
    slamTele: 0.55, slamRange: 2.3, slamDmg: 26,
    radius: 1.5, score: 1800,
    /* Fire breath: mid-range cone attack. Facing LOCKS at telegraph
       start (the game's dodge rule), the dragon is stationary while
       breathing, and ticks land every tickEvery for tickDmg — a full
       1.2 s exposure is 6 ticks x 9 = 54 damage (buffed 2026-11-13:
       Matt found the original 7-dmg ticks too weak; slam/charge also
       raised and the breath repeats sooner — telegraph, cone and
       i-frame rules deliberately unchanged, fairness stays). Roll
       i-frames are the only immunity; standing behind/beside the
       dragon is safe. Phase 2 (summoned): longer breath (7 ticks
       = 63), shorter cooldown. */
    breath: {
      minRange: 3.5, maxRange: 10, range: 9.5, halfAngleDeg: 25,
      headDist: 2.6, tele: 0.8, dur: 1.2, p2Dur: 1.5,
      tickDmg: 9, tickEvery: 0.2, cd: 4.0, p2Cd: 3.0, firstCd: 5.0,
    },
  },
  sharedSim: 'own cfg above; phase2 from src/content/enemies/bosses/shared.js',
  added: '2026-11-13',
  notes: 'Spawns 26-30 m out at the 180 s mark. Enrage banner: EMERALD DRAKE RAGES. A treasure chest (view-only) sits outside the arena edge behind its spawn point.',
  behaviour: [
    'Close (< slam range): telegraphed stomp, same as the warlord slam.',
    'Mid range (3.5-10 m) with breath ready: 0.8 s locked-facing telegraph, then a 9.5 m / 50-degree fire cone, 9 dmg per 0.2 s tick (54 full exposure; 63 in phase 2).',
    'Far or breath on cooldown: telegraphed charge, as the warlord.',
    'Phase 2: summons 2 soldiers at <=50% HP; breath lasts 1.5 s and cools down faster; enrage at <=30% HP.',
  ],
};
export default emeraldDrake;
