/* =====================================================================
   ENEMY SHARED RULES — defaults inherited by every melee enemy, plus the
   one global alive cap. These are simulation input, not per-id content:
   they are the fallback values read when a descriptor omits a field.
   ===================================================================== */

import { deepFreeze } from '../schema.js';

/** CFG.enemy's four non-kind keys. Used by startTelegraph/strikeEnemy/
 *  updateEnemies whenever a per-kind cfg does not override them. */
export const MELEE_DEFAULTS = deepFreeze({
  telegraph: 0.55, strikeRange: 1.8, strikeArcDeg: 120, recovery: 0.5,
});

/** CFG.caps.enemies — ONE global cap shared by all seven kinds. */
export const GLOBAL_ENEMY_CAP = 8;

export default MELEE_DEFAULTS;
