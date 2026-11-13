/* LANDMARK BLOCKS — the chapter set-piece. Eleven kinds, each with its own
   footprint radius. Kind 4 (castle wall) uses a LONG THIN capsule instead
   of a disc so the collider matches the visible box.

   Chapters 4-6 added five more silhouettes (6-10) so the snow / volcanic /
   dark-age maps can compose their own landmark out of `landmarkBlocks[]`
   instead of being stuck with windmill | crypt | keep. All five are plain
   boxes: no new renderer code, no new draw call. */
export const block = {
  id: 'block', type: 'prop', displayName: 'LANDMARK BUILDING',
  mapKey: 'block', chapters: [1, 2, 3, 4, 5, 6],
  placement: { landmarkStyle: 'per-chapter' },  // windmill | crypt | keep | explicit landmarkBlocks[]
  collider: {
    kind: 'disc',
    // BLOCK_R, indexed by block.kind. Simulation input: adding a kind changes the digest.
    radii: [1.7, 1.2, 2.7, 0.55, 2.7, 3.7, 0.85, 1.30, 2.00, 0.60, 1.60],
    fallback: 1.5,
    wallKind: 4, wallHalfLength: 2.7, wallRadius: 0.70,
  },
  // shapes[kind] = [sx, sy, sz, y] for the InstancedMesh placement.
  view: { geometry: 'box',
          colorByChapter: {
            1: 0x8f8a76, 2: 0x8f8a76, 3: 0x59423f,
            4: 0x8fa9c0, 5: 0x6b4a3b, 6: 0x6b6554,
          },
          shapes: [
            [3,    7,   3,   3.5 ],  // 0 windmill tower
            [2.2,  2.0, 2.2, 1.0 ],  // 1 millstone
            [5,    3.2, 4,   1.6 ],  // 2 crypt
            [0.8,  2.3, 0.8, 1.15],  // 3 grave marker
            [5.4,  5.0, 1.3, 2.5 ],  // 4 castle wall
            [7,   10,   7,   5.0 ],  // 5 keep
            [1.4,  6.5, 1.4, 3.25],  // 6 spire (ice / basalt fang)
            [2.2,  8.5, 2.2, 4.25],  // 7 forge chimney / stack
            [3.2,  9.0, 3.2, 4.5 ],  // 8 siege tower
            [0.9,  4.2, 0.9, 2.1 ],  // 9 banner / low monument
            [3.0,  1.2, 3.0, 0.6 ],  // 10 rubble / drift mound
          ] },
  added: '2026-11-13',
  notes: 'Kinds 0-5 are the original three chapters. Kinds 6-10 were added for chapters 4-6: spire, forge chimney, siege tower, banner, rubble mound. Every kind resolves through shapes[] and radii[].',
};
export default block;
