/* EMERALD DRAKE — CUSTOM figure descriptor (hand-authored, NOT generated).
   The dragon is a quadruped: it cannot be expressed as moulded parts on
   the 13-joint humanoid rig, so this descriptor carries NO rig parts.
   `custom: 'dragon'` names the dedicated procedural builder in
   src/game.js PART 3 (buildDragonView), which reads ONLY this tint for
   its colours. schema.js validates the shape (CUSTOM_RENDERERS).

   Original brick-style dragon in the spirit of the reference photo:
   emerald segmented body, lime belly, dark-red wings, cream horns. */

export const dragon = {
  id: 'dragon',
  type: 'figure',
  displayName: 'EMERALD DRAKE',
  custom: 'dragon',
  tint: {
    armor: [0.100, 0.620, 0.280],   // emerald body
    trim:  [0.660, 0.870, 0.380],   // lime belly plates
    cloth: [0.520, 0.090, 0.130],   // dark-red wing membrane
    skin:  [0.930, 0.860, 0.630],   // cream horns / claws / teeth
    blade: [0.070, 0.070, 0.090],   // near-black wing spars
    dark:  [0.020, 0.220, 0.100],   // deep-green shadow plates
    glow:  [1.000, 0.450, 0.100],   // fire-orange eyes / mouth glow
    metal: [0.850, 0.620, 0.150],   // gold — treasure chest + hoard
  },
  meshScale: 1,                     // the custom builder works in world metres
  parts: [],                        // custom figures own no rig parts (schema)
  added: '2026-11-13',
  notes: 'Quadruped boss figure: segmented body ~5.4 m, articulated wings/neck/head/jaw/tail/legs, all procedural in game.js. View-only: tint edits never move the digest.',
};

export default dragon;
