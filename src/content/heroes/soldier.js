/* SOLDIER skin — reuses the soldier enemy figure (kettle helm + chainmail).
   Cosmetic only: stats come from CFG.hero and the Armoury tracks. */

export const soldier = {
  id: 'soldier',
  type: 'hero',
  displayName: 'SOLDIER',
  price: 150,
  default: false,
  figure: 'soldier',
  slashTip: { b: 8, o: [0, 1.26, 0] },
  added: '2026-11-13',
  notes: 'Spear tip sits above the hand — SLASH_TIP uses a positive Y offset.',
};

export default soldier;
