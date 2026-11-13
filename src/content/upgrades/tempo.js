/* QUICK TEMPO — -12% attack cooldown per stack. */
export const tempo = {
  id: 'tempo', type: 'upgrade', ic: '»',
  displayName: 'QUICK TEMPO', description: '-12% attack cooldown.',
  added: '2026-11-13',
  apply(s) { s.up.tempo++; },
};
export default tempo;
