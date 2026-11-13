/* TREE TRUNK — trunk-sized collider so the hero stops at the bark and can
   still walk under the canopy. */
export const trunk = {
  id: 'trunk', type: 'prop', displayName: 'TREE TRUNK',
  mapKey: 'trunk', chapters: [1, 2, 3],
  placement: { minR: 7, maxR: 37, minGap: 2.6, scale: [0.8, 1.5] },
  collider: { kind: 'disc', radius: 0.50 },
  view: { geometry: 'cylinder', radiusTop: 0.5, radiusBottom: 0.62, segments: 6,
          paletteSlot: 'trunk', offsetY: 1.55, scale: [0.55, 3.1, 0.55] },
  added: '2026-11-13',
  notes: 'tryPlace() bodyR 0.50 — changing this radius changes SIM colliders.',
};
export default trunk;
