/* =====================================================================
   SHARED BOSS SIM — all three chapter bosses are the SAME unit today.
   The single horned-warlord figure lives in src/content/figures/boss.js;
   the three name variants live in their own per-boss descriptor files.
   Splitting a boss into genuinely different stats/behaviour later means
   giving that file its own `cfg`/`phase2` instead of referencing these.
   ===================================================================== */

import { deepFreeze } from '../../schema.js';

export const BOSS_FIGURE = 'boss';

/** CFG.boss — phase 1 (approach / charge / slam). */
export const BOSS_CFG = deepFreeze({
  hp: 300, spawnMin: 26, spawnMax: 30, speed: 7.4,
  chargeSpeed: 16.0, chargeTele: 0.7, chargeDur: 0.55,
  chargeCd: 3.0, chargeRange: 6.5, chargeDmg: 20,
  slamTele: 0.55, slamRange: 2.3, slamDmg: 22,
  radius: 1.15, score: 1500,
});

/** CFG.boss2 — phase 2 (summons at 50% HP, enrages at 30% HP). */
export const BOSS_PHASE2 = deepFreeze({
  hpFrac: 0.30, speedMul: 1.15, slamBonus: 4,
  summonAt: 0.50, summonCount: 2, summonKind: 'soldier',
});

export default BOSS_CFG;
