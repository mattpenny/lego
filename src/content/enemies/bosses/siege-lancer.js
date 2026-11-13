/* THE IRON LANCER — chapter 6 boss (DARK AGE SIEGE). PLACEHOLDER.
   Matt will create his own bosses for chapters 4-6; until then the new
   chapters reuse the existing bosses so every chapter is playable.
   Killing this placeholder in chapter 6 is the campaign VICTORY
   condition, exactly as the chapter 3 lancer kill was before the
   campaign grew. This entry reuses the Iron Lancer's knight-mount
   figure and its full cavalry cfg verbatim, with HP raised to 640 —
   the top of the escalation (Ch.1 396 / Ch.2 330 shared / Ch.3 462,
   then 520 / 580 / 640 across chapters 4-6). The handoff pack's own
   siege-wyrm descriptor was deliberately NOT adopted. */
export const siegeLancer = {
  id: 'siege-lancer', type: 'boss', chapter: 6, placeholder: true,
  name: 'THE IRON LANCER', displayName: 'THE IRON LANCER',
  mapId: 'dark-age-siege', figure: 'knight-mount',
  kind: 'knight-mount',
  cfg: {
    hp: 640, spawnMin: 26, spawnMax: 30, speed: 6.8,
    chargeSpeed: 19.0, chargeTele: 0.55, chargeDur: 0.55,
    chargeCd: 2.2, chargeRange: 4.5, chargeDmg: 26,
    slamTele: 0.55, slamRange: 2.645, slamDmg: 24, dmgMul: 1.1,
    radius: 1.755, score: 2200,
  },
  sharedSim: 'own cfg above (Iron Lancer cfg with hp 640); phase2 from src/content/enemies/bosses/shared.js',
  added: '2026-11-14',
  notes: 'PLACEHOLDER boss for chapter 6, pending Matt\'s own boss creation. Same unit as the chapter 3 Iron Lancer (mounted knight figure, charge-led, dmgMul 1.1, FURY at <=15% = <=96 of 640, playerScaling applies).',
  behaviour: [
    'Identical behaviour to the Iron Lancer: 19 m/s telegraphed charges from 4.5 m+, sword sweep up close, summons 2 soldiers at <=50% HP, enrage at <=30%, FURY at <=15%.',
  ],
};
export default siegeLancer;
