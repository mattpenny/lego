/* POND — solid water disc plus a rim ring. The collider follows the
   visible footprint +0.10 m so there is no invisible wall. */
export const pond = {
  id: 'pond', type: 'prop', displayName: 'POND',
  mapKey: 'pond', chapters: [1, 2, 3, 4, 5, 6],
  collider: { kind: 'disc', pad: 0.10 },
  view: { geometry: 'circle', segments: 28, rim: 0.35,
          paletteSlot: 'pond',
          opacityByChapter: { 1: 0.82, 2: 0.82, 3: 0.92, 4: 0.90, 5: 0.94, 6: 0.84 },
          rimColorByChapter: { 1: 0x68735c, 2: 0x68735c, 3: 0x57382f,
                               4: 0xbcd2e2, 5: 0x3b2018, 6: 0x4c5042 },
          emissiveColor: 0xff4a10, emissiveIntensity: 0.7 },
  added: '2026-11-13',
  notes: 'Emissive lava water is now driven by palette.lavaWater, not a hard-coded chapter number. Chapters 3 and 5 set it; chapter 4 is a near-opaque frozen pond.',
};
export default pond;
