/* SKY — procedural dome, recoloured per chapter by setSky(). */
export const sky = {
  id: 'sky', type: 'prop', displayName: 'SKY DOME',
  mapKey: null, chapters: [1, 2, 3, 4, 5, 6],
  collider: { kind: 'none' },
  view: { geometry: 'dome', radius: 190, widthSegments: 16, heightSegments: 12,
          fogNear: 48, fogFar: 150, paletteSlot: 'sky', fog: true },
  added: '2026-11-13',
  notes: 'Fog and hemisphere/ambient light colours come from the chapter map descriptor.',
};
export default sky;
