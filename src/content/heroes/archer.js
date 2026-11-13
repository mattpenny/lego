/* ARCHER skin — reuses the archer enemy figure (hood + quiver + bow).
   The bow is held in the LEFT hand, so slashTip.b is 5, not 8. */

export const archer = {
  id: 'archer',
  type: 'hero',
  displayName: 'ARCHER',
  price: 200,
  default: false,
  figure: 'archer',
  slashTip: { b: 5, o: [0.02, 0.40, 0.27] },
  added: '2026-11-13',
  notes: 'Only skin whose slash edge starts on bone 5 (handL).',
};

export default archer;
