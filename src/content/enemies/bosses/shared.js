/* =====================================================================
   SHARED BOSS SIM — all three chapter bosses are the SAME unit today.
   The single horned-warlord figure lives in src/content/figures/boss.js;
   the three name variants live in their own per-boss descriptor files.
   Splitting a boss into genuinely different stats/behaviour later means
   giving that file its own `cfg`/`phase2` instead of referencing these.
   ===================================================================== */

import { deepFreeze } from '../../schema.js';

export const BOSS_FIGURE = 'boss';

/** CFG.boss — phase 1 (approach / charge / slam).
    dmgMul scales EVERY boss->hero damage number (slam, charge, breath
    ticks) by one multiplier, rounded once at the point of application
    in the sim (Grave Sovereign, chapter 2: slam 24, enraged slam 29,
    charge 22 after x1.1). Boss buff 2026-11-13: HP 300 -> 330,
    damage x1.1, slam reach 2.3 -> 2.645 (+15%). */
export const BOSS_CFG = deepFreeze({
  hp: 330, spawnMin: 26, spawnMax: 30, speed: 7.4,
  chargeSpeed: 16.0, chargeTele: 0.7, chargeDur: 0.55,
  chargeCd: 3.0, chargeRange: 6.5, chargeDmg: 20,
  slamTele: 0.55, slamRange: 2.645, slamDmg: 22, dmgMul: 1.1,
  radius: 1.495, score: 1500,
});

/** CFG.boss2 — phase 2 (summons at 50% HP, enrages at 30% HP) and
    FURY (a third phase at 15% HP, added 2026-11-13): once per boss,
    the first step HP <= fury.hpFrac of max. Fury stacks MULTIPLICATIVELY
    on enrage: approach speed x fury.speedMul again (Sovereign
    7.4 -> 8.51 enraged -> 9.7865 furious), and attack TEMPO x
    fury.tempoMul — telegraphs and cooldowns that START while furious
    are divided by tempoMul; timers already running keep the duration
    they started with. Radius above is the buffed 1.15 x 1.3 (boss
    size x1.3, same round: figures scaled to match). */
export const BOSS_PHASE2 = deepFreeze({
  hpFrac: 0.30, speedMul: 1.15, slamBonus: 4,
  summonAt: 0.50, summonCount: 2, summonKind: 'soldier',
  fury: { hpFrac: 0.15, speedMul: 1.15, tempoMul: 1.15 },
});

export default BOSS_CFG;
