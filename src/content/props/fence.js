/* FENCE RUN — posts + rails, with ONE capsule collider for the whole run.
   Two map arrays: `post` (rendered posts/rails) and `fence` (segments). */
export const fence = {
  id: 'fence', type: 'prop', displayName: 'FENCE RUN',
  mapKey: 'post', segmentKey: 'fence', chapters: [1, 2, 3, 4, 5, 6],
  placement: { runs: 6, minR: 12, maxR: 34, length: [6, 13], postStep: 1.4 },
  collider: { kind: 'seg', radius: 0.16 },
  view: { geometry: 'box',
          postColorByChapter: { 1: 0x8a6a44, 2: 0x49525a, 3: 0x8a6a44,
                                4: 0x6f8496, 5: 0x3a2b24, 6: 0x4a4234 },
          railColorByChapter: { 1: 0x96754c, 2: 0x4e585e, 3: 0x96754c,
                                4: 0x849aad, 5: 0x4a3328, 6: 0x5c5440 },
          postOffsetY: 0.55, postScale: [0.18, 1.1, 0.18],
          railOffsetY: 0.80, railScale: [0.09, 0.09, 1.5] },
  added: '2026-11-13',
  notes: 'A seg collider is a capsule from (ax,az) to (bx,bz); see moveWithCollision().',
};
export default fence;
