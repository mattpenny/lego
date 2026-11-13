/* GRAVESTONE — chapters 2 and 6. Gets its collider from tryPlace() (and
   from the explicit map.extra.stone grave rows in chapter 6). */
export const stone = {
  id: 'stone', type: 'prop', displayName: 'GRAVESTONE',
  mapKey: 'stone', chapters: [2, 6],
  placement: { count: 30, minR: 6, maxR: 36, minGap: 1.2, scale: [0.8, 1.3] },
  collider: { kind: 'disc', radius: 0.38 },
  view: { geometry: 'box', color: 0x99a29a, offsetY: 0.42, scale: [0.62, 0.85, 0.17] },
  added: '2026-11-13',
  notes: 'Not repeated in the SOLID PROPS pass — tryPlace() already added its collider.',
};
export default stone;
