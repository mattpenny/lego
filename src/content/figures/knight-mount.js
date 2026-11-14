/* THE IRON LANCER — CUSTOM figure descriptor (hand-authored, NOT
   generated). A mounted knight: neither the horse nor its rider can be
   expressed as moulded parts on the 13-joint humanoid rig, so this
   descriptor carries NO rig parts. `custom: 'knightMount'` names the
   dedicated procedural builder in src/game.js PART 3
   (makeKnightMountView), which reads ONLY this tint for its colours.
   schema.js validates the shape (CUSTOM_RENDERERS).

   Original brick-style build in the spirit of the reference photo:
   silver knight with a blue plume and a blue griffin tabard, on a
   brown horse with a tan mane and white lower legs. */

export const knightMount = {
  id: 'knight-mount',
  type: 'figure',
  displayName: 'THE IRON LANCER',
  custom: 'knightMount',
  tint: {
    armor: [0.800, 0.820, 0.880],   // polished silver plate
    trim:  [0.150, 0.310, 0.780],   // royal blue — tabard + plume
    cloth: [0.545, 0.360, 0.200],   // horse brown
    skin:  [0.850, 0.700, 0.470],   // tan mane / tail
    blade: [0.900, 0.920, 0.960],   // bright sword steel
    dark:  [0.150, 0.115, 0.085],   // hooves, saddle leather, visor slit
    glow:  [0.930, 0.940, 0.980],   // pale griffin emblem on the tabard
    metal: [0.620, 0.650, 0.710],   // darker steel — chainmail, stirrups
  },
  meshScale: 1.8,                   // custom builder works in world metres; root scaled x1.8 (boss size: x1.3 at AB-NET-7, x1.5 at AB-NET-19, then +20% lancer-only — Matt 2026-11-15: "iron lancer could be 20% larger")
  parts: [],                        // custom figures own no rig parts (schema)
  added: '2026-11-13',
  notes: 'Mounted boss figure: horse ~3.7 m long, rider to ~4.0 m with plume (at the x1.8 scale: the x1.5 boss rule of AB-NET-19 plus Matt\'s +20% lancer raise, 2026-11-15). Gallop / lean / sword-raise are procedural in game.js. View-only: tint edits never move the digest.',
};

export default knightMount;
