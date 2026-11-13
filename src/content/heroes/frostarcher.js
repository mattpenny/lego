/* FROST ARCHER skin — cyan-robed bow heroine (see figures/frostarcher.js).
   Her bow is in the LEFT hand, so slashTip.b is 5, exactly like the
   archer skin. Her signature is in the MAGIC: her blast is a Frost Nova
   that also freezes every survivor (bosses for half as long). */

export const frostarcher = {
  id: 'frostarcher',
  type: 'hero',
  displayName: 'FROST ARCHER',
  price: 350,
  default: false,
  figure: 'frostarcher',
  slashTip: { b: 5, o: [0.02, 0.40, 0.27] },
  magic: { kind: 'frost', freezeSec: 1.0, bossFreezeSec: 0.5 },
  added: '2026-11-13',
  notes: 'Signature magic FROST NOVA: the 60-dmg blast also freezes survivors 1.0 s (boss 0.5 s). Freeze is a sim timer in whole steps, hashed by simDigest.',
};

export default frostarcher;
