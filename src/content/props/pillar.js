/* PILLAR — tall cylinder, a physical blocker. */
export const pillar = {
  id: 'pillar', type: 'prop', displayName: 'STONE PILLAR',
  mapKey: 'pillar', chapters: [1, 2, 3, 4, 5, 6],
  placement: { minR: 9, maxR: 36, minGap: 2.2, scale: [0.8, 1.5] },
  collider: { kind: 'disc', radius: 0.70 },
  view: { geometry: 'cylinder', radiusTop: 0.5, radiusBottom: 0.55, segments: 8,
          paletteSlot: 'rock', offsetY: 1.7, scale: [1.05, 3.4, 1.05] },
  added: '2026-11-13',
  notes: 'Counts: ch1 8, ch2 12, ch3 18, ch4 20, ch5 18, ch6 16 — plus hand-placed colonnades from map.extra.pillar in chapters 4-6.',
};
export default pillar;
