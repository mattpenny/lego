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
    hp: 396, spawnMin: 26, spawnMax: 30, speed: 6.0,
    chargeSpeed: 16.0, chargeTele: 0.7, chargeDur: 0.55,
    chargeCd: 3.0, chargeRange: 6.5, chargeDmg: 24,
    /* AB-NET-15 (g): while CHARGING the drake ignores every prop/theme
       collider (fences, mesas, trees — straight line through); the
       arena boundary still applies. Matt asked for a long-distance
       charge that nothing blocks. */
    chargeThru: true,
    slamTele: 0.55, slamRange: 2.645, slamDmg: 26, dmgMul: 1.1,
    radius: 1.95, score: 1800,
    /* Fire breath: mid-range cone attack. Facing LOCKS at telegraph
       start (the game's dodge rule), the dragon is stationary while
       breathing, and ticks land every tickEvery for tickDmg scaled by
       cfg.dmgMul, rounded once per tick: tick 9 x 1.1 = 10, so a full
       1.2 s exposure is 6 ticks x 10 = 60 damage (boss buff
       2026-11-13: HP 360 -> 396, all damage x1.1, slam reach 2.3 ->
       2.645 and breath reach 9.5 -> 10.925 / selection 10 -> 11.5,
       +15% — telegraph, cone and i-frame rules deliberately
       unchanged, fairness stays). Roll i-frames are the only
       immunity; standing behind/beside the dragon is safe. Phase 2
       (summoned): longer breath (7 ticks = 70), shorter cooldown. */
    breath: {
      minRange: 3.5, maxRange: 11.5, range: 10.925, halfAngleDeg: 25,
      headDist: 3.38, tele: 0.8, dur: 1.2, p2Dur: 1.5,
      tickDmg: 9, tickEvery: 0.2, cd: 4.0, p2Cd: 3.0, firstCd: 5.0,
    },
  },
  sharedSim: 'own cfg above; phase2 from src/content/enemies/bosses/shared.js',
  added: '2026-11-13',
  notes: 'Spawns 26-30 m out at the 180 s mark. Enrage banner: EMERALD DRAKE RAGES. A treasure chest (view-only) sits outside the arena edge behind its spawn point.',
  behaviour: [
    'Close (< slam range): telegraphed stomp, same as the warlord slam.',
    'Mid range (3.5-11.5 m) with breath ready: 0.8 s locked-facing telegraph, then a 10.925 m / 50-degree fire cone, 10 dmg per 0.2 s tick (tickDmg 9 x dmgMul 1.1; 60 full exposure; 70 in phase 2).',
    'Far or breath on cooldown: telegraphed charge, as the warlord.',
    'Charge (AB-NET-15 (g)): while charging, the drake ignores ALL prop/theme colliders — fences, mesas, trees — and runs a straight line through them; only the arena boundary still stops it. Trigger, 0.7 s telegraph, 16 m/s speed and 26 landed damage unchanged.',
    'Phase 2: summons 2 soldiers at <=50% HP; breath lasts 1.5 s and cools down faster; enrage at <=30% HP.',
    'FURY at <=15% HP (<=59.4 of 396): approach speed x1.15 again (6.0 -> 6.9 enraged -> 7.935 furious) and attack tempo x1.15 — telegraphs/cooldowns starting in fury are divided by 1.15 (breath cd 4.0 -> 3.478 s); breath ticks/duration unchanged.',
    'Size x1.3 (2026-11-13): sim radius 1.5 -> 1.95, breath mouth offset headDist 2.6 -> 3.38, figure meshScale 1.3.',
  ],
};
export default emeraldDrake;
