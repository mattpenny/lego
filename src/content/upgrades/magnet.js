/* GEM MAGNET — +0.9 m pickup radius per stack. */
export const magnet = {
  id: 'magnet', type: 'upgrade', ic: '◈',
  displayName: 'GEM MAGNET', description: '+0.9 m pickup radius.',
  added: '2026-11-13',
  apply(s) { s.up.magnet++; },
};
export default magnet;
