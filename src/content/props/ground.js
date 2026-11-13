/* GROUND — one 150x150 plane with a procedural 512x512 CanvasTexture. */
export const ground = {
  id: 'ground', type: 'prop', displayName: 'GROUND PLANE',
  mapKey: null, chapters: [1, 2, 3, 4, 5, 6],
  collider: { kind: 'none' },
  view: { geometry: 'plane', width: 150, height: 150, texture: 'groundTexture',
          paletteSlot: 'ground', textureSize: 512,
          textureSeedBase: 4400, textureSeedStep: 313 },
  added: '2026-11-13',
  notes: 'Texture variant is chosen by palette.texStyle (grass | ash | snow | mud); the seed still varies by chapter so all six are distinct.',
};
export default ground;
