/* ASHEN WARDEN — chapter 1 boss stub. Real CFG below; figure not yet
   transcribed. All three chapter bosses share ONE sim entry (kind 'boss',
   CFG.boss) and one figure (rigParts('boss'), the horned black knight at
   meshScale 1.65) — only the name (BOSS_NAMES) and the chapter palette
   differ. TODO: transcribe rigParts('boss') into `parts`. */

export const BOSS_CFG = {
  hp: 300, spawnMin: 26, spawnMax: 30, // spawns 26–30 m out at the 180 s mark
  speed: 7.4,                          // hunt speed, with the pursuit ramp in updateBoss
  chargeSpeed: 16.0, chargeTele: 0.7, chargeDur: 0.55, chargeCd: 3.0, chargeRange: 6.5, chargeDmg: 20,
  slamTele: 0.55, slamRange: 2.3, slamDmg: 22,
  radius: 1.15, score: 1500,
};

/* Phase 2 (CFG.boss2): summons 2 soldiers once at <=50% HP; enrages at
   <=30% HP — speed x1.15, slam +4, banner "THE WARDEN RAGES". */
export const BOSS_PHASE2 = {
  hpFrac: 0.30, speedMul: 1.15, slamBonus: 4,
  summonAt: 0.50, summonCount: 2, summonKind: 'soldier',
};

export const BOSS_TINT = {
  armor: [0.035, 0.033, 0.032], trim: [0.240, 0.245, 0.260], metal: [0.300, 0.310, 0.330],
  cloth: [0.170, 0.015, 0.020], skin: [0.900, 0.680, 0.100], blade: [0.025, 0.025, 0.030],
  dark: [0.012, 0.012, 0.015], glow: [0.950, 0.200, 0.050],
};

export const ashenWarden = {
  kind: 'boss',
  chapter: 1,
  name: 'ASHEN WARDEN',
  stub: true,
  cfg: BOSS_CFG,
  phase2: BOSS_PHASE2,
  tint: BOSS_TINT,
  base: 'custom', // rigParts('boss') is the whole figure; bodyParts is NOT used
  meshScale: 1.65,
  parts: null, // TODO: transcribe rigParts('boss')
  behaviour: ['Spawns at tick 10800 (180 s) in the 26–30 m band; kills in ~9 hero hits. Slam and charge are telegraphed; wind-ups have poise.'],
};
export default ashenWarden;
