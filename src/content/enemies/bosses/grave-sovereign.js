/* GRAVE SOVEREIGN — chapter 2 boss (GRAVEYARD FOREST).
   Same shared sim + figure as chapter 1; the chapter palette carries the
   identity. If a variant is ever authored, its stats go in THIS file. */
export const graveSovereign = {
  id: 'grave-sovereign', type: 'boss', chapter: 2,
  name: 'GRAVE SOVEREIGN', displayName: 'GRAVE SOVEREIGN',
  mapId: 'graveyard-forest', figure: 'boss',
  sharedSim: 'src/content/enemies/bosses/shared.js',
  added: '2026-11-13',
  notes: 'Name/banner identity only — stats and figure are shared (see bosses/shared.js).',
  behaviour: ['Identical stats to the Ashen Warden; the Graveyard Forest palette carries the chapter identity.'],
};
export default graveSovereign;
