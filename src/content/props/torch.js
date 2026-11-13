/* TORCH / BRAZIER — post + glowing flame, solid disc collider. */
export const torch = {
  id: 'torch', type: 'prop', displayName: 'TORCH',
  mapKey: 'torch', chapters: [1, 2, 3],
  placement: { count: 12, radius: [8, 36], scale: [0.8, 1.3] },
  collider: { kind: 'disc', radius: 0.24 },
  view: { geometry: 'cylinder', radius: 0.5, segments: 6, color: 0x54443a,
          postOffsetY: 0.8, postScale: [0.18, 1.6, 0.18],
          flameGeometry: 'sphere', flameRadius: 0.5, flameSegments: [7, 5],
          flameOffsetY: 1.65, flameScale: 0.38,
          flameColorByChapter: { 1: 0xffc46a, 2: 0xffc46a, 3: 0xff7a28 } },
  added: '2026-11-13',
  notes: 'The flame is an emissive sphere at y = 1.65 * s.',
};
export default torch;
