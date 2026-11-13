/* LAVA POOL — volcanic chapters 3 and 5, flat translucent circle.
   No collider and no sim damage rule; purely cosmetic. */
export const lava = {
  id: 'lava', type: 'prop', displayName: 'LAVA POOL',
  mapKey: 'lava', chapters: [3, 5],
  placement: { count: 9, radius: [8, 38], scale: [1.2, 3.3] },
  collider: { kind: 'none' },
  view: { geometry: 'circle', segments: 14, color: 0xff5a18, opacity: 0.9 },
  added: '2026-11-13',
  notes: 'Cosmetic hazard — the sim has no lava damage rule.',
};
export default lava;
