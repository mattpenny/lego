/* HONED EDGE — +20% sword damage per stack. */
export const edge = {
  id: 'edge', type: 'upgrade', ic: '⚔',
  displayName: 'HONED EDGE', description: '+20% sword damage.',
  added: '2026-11-13',
  apply(s) { s.up.edge++; },
};
export default edge;
