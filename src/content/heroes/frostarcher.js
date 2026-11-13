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
  attack: { kind: 'arrow', range: 14, speed: 26, aimDeg: 25, r: 0.25 },
  stats: { dmgMul: 0.8 },
  trait: 'Ranged arrows · lighter damage',
  added: '2026-11-13',
  notes: 'Signature magic FROST NOVA: the 60-dmg blast also freezes survivors 1.0 s (boss 0.5 s). Freeze is a sim timer in whole steps, hashed by simDigest. RANGED ATTACK: she shoots arrows instead of swinging — the arrow leaves at the sword hit moment (0.25 s), flies straight at 26 m/s up to 14 m, hits the FIRST body on its path for full hero damage through the normal damage pipeline, and aim-assist snaps to the nearest target inside a 25 deg cone of her facing at release. No sword lunge, no crescent.',
};

export default frostarcher;
