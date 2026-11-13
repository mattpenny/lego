/* POND — solid water disc plus a rim ring. The collider follows the
   visible footprint +0.10 m so there is no invisible wall. */
export const pond = {
  id: 'pond', type: 'prop', displayName: 'POND',
  mapKey: 'pond', chapters: [1, 2, 3],
  collider: { kind: 'disc', pad: 0.10 },
  view: { geometry: 'circle', segments: 28, rim: 0.35,
          paletteSlot: 'pond', opacityByChapter: { 1: 0.82, 2: 0.82, 3: 0.92 },
          rimColorByChapter: { 1: 0x68735c, 2: 0x68735c, 3: 0x57382f },
          emissiveColor: 0xff4a10, emissiveIntensity: 0.7 },
  added: '2026-11-13',
  notes: 'Chapter 3 uses emissive lava water (0xff4a10, intensity 0.7).',
};
export default pond;
