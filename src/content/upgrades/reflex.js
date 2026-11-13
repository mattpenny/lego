/* REFLEXES — -20% roll cooldown per stack. */
export const reflex = {
  id: 'reflex', type: 'upgrade', ic: '↺',
  displayName: 'REFLEXES', description: '-20% roll cooldown.',
  added: '2026-11-13',
  apply(s) { s.up.reflex++; },
};
export default reflex;
