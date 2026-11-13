/* KEEN EYE — +15% critical chance per stack. */
export const crit = {
  id: 'crit', type: 'upgrade', ic: '✦',
  displayName: 'KEEN EYE', description: '+15% critical chance.',
  added: '2026-11-13',
  apply(s) { s.up.crit++; },
};
export default crit;
