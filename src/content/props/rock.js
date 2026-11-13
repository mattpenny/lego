/* ROCK — dodecahedron boulder, solid disc collider. */
export const rock = {
  id: 'rock', type: 'prop', displayName: 'BOULDER',
  mapKey: 'rock', chapters: [1, 2, 3],
  placement: { minR: 6, maxR: 38, minGap: 1.9, scale: [0.55, 1.55] },
  collider: { kind: 'disc', radius: 1.0 },
  view: { geometry: 'dodecahedron', paletteSlot: 'rock',
          offsetY: 0.46, scale: [1.7, 1.1, 1.5] },
  added: '2026-11-13',
  notes: 'Chapter 3 places 30 rocks, other chapters 24.',
};
export default rock;
