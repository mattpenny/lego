/* ASHEN WARDEN — chapter 1 boss (GRASSLAND).
   Name/banner identity only: sim + figure are shared, see shared.js and
   src/content/figures/boss.js. No palette is duplicated here any more —
   the old BOSS_TINT had drifted from the 2026-11-13 palette lift. */
export const ashenWarden = {
  id: 'ashen-warden', type: 'boss', chapter: 1,
  name: 'ASHEN WARDEN', displayName: 'ASHEN WARDEN',
  mapId: 'grassland', figure: 'boss',
  sharedSim: 'src/content/enemies/bosses/shared.js',
  added: '2026-11-13',
  notes: 'Spawns 26-30 m out at the 180 s mark. Enrage banner: THE WARDEN RAGES.',
  behaviour: ['Kills in ~9 hero hits. Slam and charge are telegraphed; wind-ups have poise.'],
};
export default ashenWarden;
