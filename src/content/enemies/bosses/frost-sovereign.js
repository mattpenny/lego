/* GRAVE SOVEREIGN — chapter 4 boss (FROSTFALL GLACIER). PLACEHOLDER.
   Matt will create his own bosses for chapters 4-6; until then the new
   chapters reuse the existing bosses so every chapter is playable. This
   entry reuses the Grave Sovereign's warlord figure and the shared
   BOSS_CFG numbers verbatim, with HP raised to 520 for the late game
   (escalation: Ch.1 396 / Ch.2 330 shared / Ch.3 462, then 520 / 580 /
   640 across chapters 4-6). The handoff pack's own frost-warden
   descriptor was deliberately NOT adopted. */
export const frostSovereign = {
  id: 'frost-sovereign', type: 'boss', chapter: 4, placeholder: true,
  name: 'GRAVE SOVEREIGN', displayName: 'GRAVE SOVEREIGN',
  mapId: 'frostfall-glacier', figure: 'boss',
  cfg: {
    hp: 520, spawnMin: 26, spawnMax: 30, speed: 7.4,
    chargeSpeed: 16.0, chargeTele: 0.7, chargeDur: 0.55,
    chargeCd: 3.0, chargeRange: 6.5, chargeDmg: 20,
    slamTele: 0.55, slamRange: 2.645, slamDmg: 22, dmgMul: 1.1,
    radius: 1.495, score: 1500,
  },
  sharedSim: 'own cfg above (shared BOSS_CFG with hp 520); phase2 from src/content/enemies/bosses/shared.js',
  added: '2026-11-14',
  notes: 'PLACEHOLDER boss for chapter 4, pending Matt\'s own boss creation. Same unit as the chapter 2 Grave Sovereign (warlord figure, shared phase 2 + FURY, dmgMul 1.1, playerScaling applies).',
  behaviour: [
    'Identical behaviour to the Grave Sovereign: telegraphed slam, locked-facing charge, summons 2 soldiers at <=50% HP, enrage at <=30%, FURY at <=15% (<=78 of 520).',
  ],
};
export default frostSovereign;
