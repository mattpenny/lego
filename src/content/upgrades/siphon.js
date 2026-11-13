/* BLOOD SIPHON — heal 3 HP per stack on every kill. */
export const siphon = {
  id: 'siphon', type: 'upgrade', ic: '✚',
  displayName: 'BLOOD SIPHON', description: 'Heal 3 HP on every kill.',
  added: '2026-11-13',
  apply(s) { s.up.siphon++; },
};
export default siphon;
