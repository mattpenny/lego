/* SWIFT BOOTS — +8% move speed per stack. */
export const boots = {
  id: 'boots', type: 'upgrade', ic: '⇢',
  displayName: 'SWIFT BOOTS', description: '+8% move speed.',
  added: '2026-11-13',
  apply(s) { s.up.boots++; },
};
export default boots;
