/* LONG REACH — +0.5 m range and +10 degrees of arc per stack. */
export const reach = {
  id: 'reach', type: 'upgrade', ic: '↗',
  displayName: 'LONG REACH', description: '+0.5 m range, +10° arc.',
  added: '2026-11-13',
  apply(s) { s.up.reach++; },
};
export default reach;
