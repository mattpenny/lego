/* ANSUM — THE CRESCENT OF FIRE.
   Level-5 signature SKIN for the base hero (the knight hero named
   Ansum), from Matt's content pack 2026-11-14. The figure is the raven
   knight in dark plate with the red fan crest (figures/ansum.js); the
   blade carries fire along both edges, and the blast inherits it: FIRE
   CRESCENT is the standard 60-dmg nova multiplied by `dmgMul`, so the
   caster trades the Frost Archer's control and the Dwarf's shove for
   raw burst.

   UNLOCK (Matt's override of the pack's 500-gold price): NOT sold for
   gold. The skin unlocks for signed-in accounts at account level >= 5
   (`accountLevel`); the account profile is the source of truth, guests
   cannot unlock it, and the Armoury shows the requirement while locked.
   It carries no `stats` block, so it plays with the base hero's exact
   numbers — only the figure and the signature differ.

   `magic` is SIMULATION input — it is hashed into SIM_CONTENT by the
   registry, so changing `dmgMul` is a net-build change. */

export const ansum = {
  id: 'ansum',
  type: 'hero',
  displayName: 'ANSUM',
  price: 0,
  accountLevel: 5,
  default: false,
  figure: 'ansum',
  slashTip: { b: 8, o: [0, -1.00, 0] },
  magic: { kind: 'fire', dmgMul: 1.6 },
  added: '2026-11-14',
  notes: 'Signature skin of the base hero. Signature magic FIRE CRESCENT: the 60-dmg blast lands at 96 dmg (60 x 1.6) on every target in radius, no control and no knockback. Highest burst of the three signatures; the trade is that nothing is held in place. Unlock: account level 5 (not purchasable).',
};

export default ansum;
