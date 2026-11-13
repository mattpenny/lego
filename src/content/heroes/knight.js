/* KNIGHT skin — reuses the knight elite figure (great helm + plate). */

export const knight = {
  id: 'knight',
  type: 'hero',
  displayName: 'KNIGHT',
  price: 300,
  default: false,
  figure: 'knight',
  slashTip: { b: 8, o: [0, -0.92, 0] },
  added: '2026-11-13',
  notes: 'Renders at meshScale 1.28 (the knight scale, shared with the enemy).',
};

export default knight;
