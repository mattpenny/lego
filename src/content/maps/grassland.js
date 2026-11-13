/* CHAPTER 1 — GRASSLAND.
   `palette` is the old PALETTES[0] entry; `map` is every per-chapter number
   buildMapData() used to hard-code. Both are now the source of truth. */
export const grassland = {
  id: 'grassland', type: 'map', chapter: 1,
  displayName: 'GRASSLAND', bossId: 'emerald-drake',
  palette: {
    name: 'GRASSLAND', sky: 0x8ec7f0, fog: 0xa4cda6,
    ground: '#4da337', ground2: '#66bb47', path: '#c7ab6d',
    pond: 0x2fa3dd, tree: 0x35a047, trunk: 0x7d5c39, rock: 0x9aa294,
    hill: 0x86a374, accent: 0xffd98a, light: 0xfff0d0, hemi: 0xbcd8ff, amb: 1.02,
    texStyle: 'grass', sunIntensity: 1.45, lavaWater: false,
  },
  map: {
    seed: 17620,                 // 9701 + chapter*7919
    pond: { x: -15, z: 14, r: 5.2 },
    landmark: { x: -20, z: -18 }, landmarkStyle: 'windmill',
    trees: 38, canopyKind: 0, canopyScale: 1.25,
    rocks: 24, pillars: 8, stones: 0,
    fenceRuns: 6, hills: 64, torches: 12, lavaPools: 0, reeds: 18,
    eventPack: ['knight'],       // 90-second chapter event
    /* CHAPTER-1-ONLY fill-pool overrides (AB-NET-10): {from, weight}
       replace the kind's global fill entry IN THIS CHAPTER ONLY, so
       Matt's 15 heraldic kinds actually show up across the first map's
       3-minute wave in a deliberate stagger (globals in the enemy
       descriptors still govern chapters 2-3). Substitution, not
       addition: the spawn interval, the alive cap and every per-kind
       cap are untouched — heraldic spawns replace base-kind spawns.
       Early ~20-45 s: raven / crossbowman / russet (light bodies).
       Mid ~50-90 s: eagle / teal / sun / azure / crimson.
       Late ~100-150 s: axe / obsidian / unicorn / lion / kraken.
       Final stretch 150 s+: tower + dragon as showcase singles.
       Weights on the cap-1 kinds are deliberately heavy: a capped
       kind leaves the pool while it is alive, so a heavy weight buys
       ONE prompt appearance (the showcase single), not pressure —
       the alive cap, not the weight, bounds how many can press the
       hero at once. The early/mid kinds carry a small negative ramp
       for the mirror-image reason: they have had their appearances
       by the late game and should stop eating the tail rolls. */
    fill: {
      /* The three always-eligible base kinds DECAY over the wave
         (negative ramp, this chapter only), handing the late-game
         share to the heraldic tail instead of crowding it out.
         Weights stay positive all wave: 34->23, 26->8, 22->8. */
      'soldier':        { ramp: -0.06 },
      'brute':          { ramp: -0.10 },
      'runner':         { ramp: -0.08 },
      'raven-knight':   { from: 18,  weight: 30, ramp: -0.10 },
      'crossbowman':    { from: 22,  weight: 26, ramp: -0.08 },
      'russet-archer':  { from: 28,  weight: 26, ramp: -0.08 },
      'eagle-knight':   { from: 52,  weight: 30, ramp: -0.06 },
      'teal-archer':    { from: 58,  weight: 28, ramp: -0.06 },
      'sun-knight':     { from: 64,  weight: 26, ramp: -0.05 },
      'azure-knight':   { from: 72,  weight: 30, ramp: -0.05 },
      'crimson-knight': { from: 82,  weight: 24, ramp: -0.04 },
      'axe-knight':     { from: 100, weight: 26 },
      'obsidian-knight': { from: 108, weight: 34 },
      'unicorn-knight': { from: 116, weight: 56 },
      'lion-knight':    { from: 124, weight: 48 },
      'kraken-knight':  { from: 132, weight: 44 },
      'tower-knight':   { from: 150, weight: 100 },
      'dragon-knight':  { from: 158, weight: 110 },
    },
  },
  added: '2026-11-13',
  notes: 'Windmill tower (block kind 0) plus four millstones (kind 1).',
};
export default grassland;
