/* MAGMA TYRANT — chapter 3 boss (VOLCANO CASTLE).
   Killing him here is the victory condition (+200 G victory bonus). */
export const magmaTyrant = {
  id: 'magma-tyrant', type: 'boss', chapter: 3,
  name: 'MAGMA TYRANT', displayName: 'MAGMA TYRANT',
  mapId: 'volcano-castle', figure: 'boss',
  sharedSim: 'src/content/enemies/bosses/shared.js',
  added: '2026-11-13',
  notes: 'Name/banner identity only — stats and figure are shared (see bosses/shared.js).',
  behaviour: ['Identical stats to the Ashen Warden; killing him on chapter 3 wins the run.'],
};
export default magmaTyrant;
