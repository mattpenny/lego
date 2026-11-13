/* MAGMA TYRANT — chapter 3 boss stub. Same sim entry (kind 'boss',
   CFG.boss), same figure (rigParts('boss')) and same phase-2 rules as the
   chapter 1 boss — only the name and palette differ. See ashen-warden.js
   for the shared BOSS_CFG / BOSS_PHASE2 / BOSS_TINT values.
   TODO: nothing chapter-specific exists to transcribe in phase 1; if a
   chapter variant is ever authored, it lands here. */

export const magmaTyrant = {
  kind: 'boss',
  chapter: 3,
  name: 'MAGMA TYRANT',
  stub: true,
  cfg: 'shared: CFG.boss (see ashen-warden.js BOSS_CFG)',
  phase2: 'shared: CFG.boss2 (see ashen-warden.js BOSS_PHASE2)',
  tint: 'shared: TINTS.boss (see ashen-warden.js BOSS_TINT)',
  base: 'custom',
  meshScale: 1.65,
  parts: null, // shared with ashen-warden: TODO there covers this file too
  behaviour: ['Identical stats/behaviour to the Ashen Warden in the current build; killing him on chapter 3 is the victory condition (+200 G victory bonus in the meta layer).'],
};
export default magmaTyrant;
