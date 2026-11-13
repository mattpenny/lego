/* EMERALD DRAKE — chapter 5 boss (EMBER CALDERA). PLACEHOLDER.
   Matt will create his own bosses for chapters 4-6; until then the new
   chapters reuse the existing bosses so every chapter is playable. This
   entry reuses the Emerald Drake's dragon figure and its full cfg
   (fire breath included — a natural fit for the caldera) verbatim,
   with HP raised to 580 for the late game (escalation: Ch.1 396 /
   Ch.2 330 shared / Ch.3 462, then 520 / 580 / 640 across chapters
   4-6). The handoff pack's own cinder-lancer descriptor was
   deliberately NOT adopted. */
export const calderaDrake = {
  id: 'caldera-drake', type: 'boss', chapter: 5, placeholder: true,
  name: 'EMERALD DRAKE', displayName: 'EMERALD DRAKE',
  mapId: 'ember-caldera', figure: 'dragon',
  kind: 'dragon',
  cfg: {
    hp: 580, spawnMin: 26, spawnMax: 30, speed: 6.0,
    chargeSpeed: 16.0, chargeTele: 0.7, chargeDur: 0.55,
    chargeCd: 3.0, chargeRange: 6.5, chargeDmg: 24,
    slamTele: 0.55, slamRange: 2.645, slamDmg: 26, dmgMul: 1.1,
    radius: 1.95, score: 1800,
    breath: {
      minRange: 3.5, maxRange: 11.5, range: 10.925, halfAngleDeg: 25,
      headDist: 3.38, tele: 0.8, dur: 1.2, p2Dur: 1.5,
      tickDmg: 9, tickEvery: 0.2, cd: 4.0, p2Cd: 3.0, firstCd: 5.0,
    },
  },
  sharedSim: 'own cfg above (Emerald Drake cfg with hp 580); phase2 from src/content/enemies/bosses/shared.js',
  added: '2026-11-14',
  notes: 'PLACEHOLDER boss for chapter 5, pending Matt\'s own boss creation. Same unit as the chapter 1 Emerald Drake (dragon figure, breath rules unchanged, dmgMul 1.1, FURY at <=15% = <=87 of 580, playerScaling applies).',
  behaviour: [
    'Identical behaviour to the Emerald Drake: locked-facing fire breath (60 full exposure, 70 in phase 2), telegraphed stomp up close, charge from range, summons at <=50% HP, enrage at <=30%, FURY at <=15%.',
  ],
};
export default calderaDrake;
