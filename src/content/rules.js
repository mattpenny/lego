/* =====================================================================
   GLOBAL SIM RULES — the numbers that are NOT tied to a content id.

   Per-id content lives in its own file (heroes/, enemies/, items/, props/,
   maps/, figures/, upgrades/, enemies/bosses/). This file holds the few
   cross-cutting tuning values that the deterministic sim needs but that
   do not belong to any single piece of content: hero combat spec, magic,
   hit-stop, chapter-event clock, meta economy and the net build stamp.

   EVERY value here is simulation input. Changing one moves simDigest() and
   therefore requires a net build bump + a fresh content baseline. View-only
   values never belong in this file.
   ===================================================================== */

import { deepFreeze } from './schema.js';

export const RULES = deepFreeze({
  /* hero movement / sword spec — "exact combat spec numbers, do not improve" */
  hero: {
    hp: 100, runSpeed: 6.2, walkSpeed: 3.1,
    runTilt: 0.55, accelTau: 20, stopTau: 34,
    swingDur: 0.625, hitAt: 0.25, swingCd: 0.5,
    range: 3.2, arcDeg: 130, lunge: 0.65,
    rollDur: 0.45, rollDist: 3.5, rollCd: 1.0,
    dmg: 34,
  },

  waveSeconds: 180,
  eventAt: 90,                 // chapter elite pack fires at 90 s

  magic: {
    perKill: 1, cost: 20, dmg: 60, radius: 14, stopMs: 250,
    /* potionChance / potionGain are derived from src/content/items/potion.js */
  },

  hitStopMs: { hit: 80, kill: 120, bossSlam: 150, bossKill: 250 },
  maxEntities: 16,

  meta: {
    costs: [40, 80, 140, 220, 320], steps: 5,
    hpPer: 8, dmgPer: 2, spdPer: 0.15,
    clearBonus: 50, victoryBonus: 200, scoreGoldDivisor: 10,
    /* The three permanent Armoury tracks, in button order. */
    tracks: [
      { id: 'hp',  name: 'ARMOUR HP', per: 8,    unit: 'max HP' },
      { id: 'dmg', name: 'EDGE DMG',  per: 2,    unit: 'damage' },
      { id: 'spd', name: 'BOOTS SPD', per: 0.15, unit: 'move speed' },
    ],
    /* heroCosts is derived from src/content/heroes/ */
  },

  net: {
    delay: 6, checkpoint: 600, stallMs: 250,
    relay: 'wss://dragon-alley-relay.ccac-church.workers.dev/ws',
    /* LOAD-BEARING: co-op peers must agree. Bump ONLY when sim behaviour
       actually changes. A view-only content edit must NOT bump this. */
    build: 'AB-NET-5',
    graceMs: 60000,
  },
});

export default RULES;
