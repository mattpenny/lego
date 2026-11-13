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
    build: 'AB-NET-11',
    graceMs: 60000,
  },

  /* PLAYER-COUNT DIFFICULTY SCALING (AB-NET-9) — Matt: "more players
     stronger the enemies and boss. Make good proportion for it." and,
     for the HP rule, "since more players more chance to hit the enemies
     or boss": N heroes land roughly N times the hits per second (focus
     fire, N magic meters, N interrupts), so total HP grows FASTER than
     the headcount would suggest but slower than N squared would give.
       hpMul  = N x (1 + 0.1 x (N-1))   →  1.0 / 2.2 / 3.6 / 5.2
     One HP rule covers regular enemies AND bosses (spawn-time,
     Math.round(base x hpMul)). Damage grows gently instead — incoming
     damage lands per-hero while outgoing damage is pooled — +10% per
     extra player, applied as ONE Math.round at each damage application
     on top of the existing per-source rounding (boss dmgMul etc.).
     The alive cap widens at N=3/4 so four heroes do not face an emptier
     field. N is the roster size LOCKED at run start (handshake-agreed);
     a mid-run departure does NOT rescale. The N=1 row is exactly the
     pre-scaling game: every multiplier 1.0 and the solo cap 8, so solo
     digests are bit-identical. Tune the proportions HERE — this table
     is the single adjustment surface (STATS.md renders it). */
  playerScaling: [
    null,   // index by roster size N (1..4); slot 0 unused
    { hpMul: 1.0, dmgMul: 1.0, aliveCap: 8  },
    { hpMul: 2.2, dmgMul: 1.1, aliveCap: 8  },
    { hpMul: 3.6, dmgMul: 1.2, aliveCap: 10 },
    { hpMul: 5.2, dmgMul: 1.3, aliveCap: 12 },
  ],
});

export default RULES;
