/* The geometry cache + primitive kinds of the figure builder.
   Transcribed from src/game.js (const GEO_CACHE + function prim).
   Phase-1 note: game.js keeps its own inline copy; this module is the
   canonical version for new code.

   prim(kind) returns ONE shared unit geometry per kind — figure parts
   clone it, bake their scale/rotation/offset into the clone, and merge.
   Kinds (the only names rigParts() may use in a part's `g` field):
     'box'   -> BoxGeometry(1,1,1)
     'sph'   -> SphereGeometry(0.5, 8, 6)
     'cyl'   -> CylinderGeometry(0.5, 0.5, 1, 8)
     'cyl12' -> CylinderGeometry(0.5, 0.5, 1, 12)   (minifig head/helm discs)
     'cone'  -> ConeGeometry(0.5, 1, 8)
   Any unknown kind falls back to 'box' (game.js behaviour). */

export const PRIM_KINDS = ['box', 'sph', 'cyl', 'cyl12', 'cone'];
export const PRIM_FALLBACK = 'box';

/* createPrimCache(T) — the prim() cache with the three.js namespace
   injected (in game.js it closes over the global T table instead).
   Returns { prim, cache } mirroring GEO_CACHE semantics. */
export function createPrimCache(T) {
  const cache = {};
  function prim(kind) {
    if (cache[kind]) return cache[kind];
    const g = kind === 'box' ? new T.BoxGeometry(1, 1, 1)
      : kind === 'sph' ? new T.SphereGeometry(0.5, 8, 6)
      : kind === 'cyl' ? new T.CylinderGeometry(0.5, 0.5, 1, 8)
      : kind === 'cyl12' ? new T.CylinderGeometry(0.5, 0.5, 1, 12)
      : kind === 'cone' ? new T.ConeGeometry(0.5, 1, 8)
      : new T.BoxGeometry(1, 1, 1);
    cache[kind] = g;
    return g;
  }
  return { prim, cache };
}
