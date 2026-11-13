/* LANDMARK BLOCKS — the chapter set-piece. Six kinds, each with its own
   footprint radius. Kind 4 (castle wall) uses a LONG THIN capsule instead
   of a disc so the collider matches the visible box. */
export const block = {
  id: 'block', type: 'prop', displayName: 'LANDMARK BUILDING',
  mapKey: 'block', chapters: [1, 2, 3],
  placement: { landmarkStyle: 'per-chapter' },  // windmill | crypt | keep
  collider: {
    kind: 'disc',
    radii: [1.7, 1.2, 2.7, 0.55, 2.7, 3.7],   // BLOCK_R, indexed by block.kind
    fallback: 1.5,
    wallKind: 4, wallHalfLength: 2.7, wallRadius: 0.70,
  },
  // shapes[kind] = [sx, sy, sz, y] for the InstancedMesh placement.
  view: { geometry: 'box', colorByChapter: { 1: 0x8f8a76, 2: 0x8f8a76, 3: 0x59423f },
          shapes: [
            [3,    7,   3,   3.5 ],  // 0 windmill tower
            [2.2,  2.0, 2.2, 1.0 ],  // 1 millstone
            [5,    3.2, 4,   1.6 ],  // 2 crypt
            [0.8,  2.3, 0.8, 1.15],  // 3 grave marker
            [5.4,  5.0, 1.3, 2.5 ],  // 4 castle wall
            [7,   10,   7,   5.0 ],  // 5 keep
          ] },
  added: '2026-11-13',
  notes: 'Kinds: 0 windmill tower, 1 millstone, 2 crypt, 3 grave marker, 4 castle wall, 5 keep.',
};
export default block;
