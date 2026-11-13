/* EARTH DWARF skin — short, wide, bearded (see figures/dwarf.js).
   The war hammer rides the RIGHT hand with its head up, so the slash
   tip sits on the hammer head (bone 8, long offset). His signature is
   in the MAGIC: his blast is an Earthquake that also knocks every
   survivor directly away from him (bosses half as far). */

export const dwarf = {
  id: 'dwarf',
  type: 'hero',
  displayName: 'EARTH DWARF',
  price: 400,
  default: false,
  figure: 'dwarf',
  slashTip: { b: 8, o: [0, 0.66, 0] },
  slashTint: { core: [1.0, 0.70, 0.63], rim: [0.98, 0.80, 0.74] },
  magic: { kind: 'earth', push: 6, bossPush: 3 },
  stats: { dmgMul: 1.25, speedMul: 0.9, rollDistMul: 0.8, rollCdMul: 1.3 },
  trait: 'Heavy hammer · slower, short roll',
  added: '2026-11-13',
  notes: 'Signature magic EARTHQUAKE: the 60-dmg blast also knocks survivors 6 m directly away from the caster (boss 3 m), clamped to ARENA_R - radius. Instant sim displacement, hashed by simDigest. His hammer swing keeps the standard sword sim but draws its slim crescent in PALE RED (slashTint: core #ffb3a1, paler rim) — view-only, derived into HERO_SLASH_TINTS, NOT part of SIM_CONTENT.',
};

export default dwarf;
