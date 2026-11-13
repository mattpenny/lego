# AETHERBLADE — Content Guide

*How to add heroes, figures, enemies, bosses, items, props, maps and upgrades —
one file per thing.*
*Written 2026-11-13 against build AB-NET-2 (fresh digest `3211ebe328fd195f`,
combined `8ba246d908e892342f25d37bc2b5d606b7fe8451b96026eb1392f5237a60961b`).
Line numbers drift; the function/constant names are the stable anchors.*
*Updated 2026-11-13 after the full content-registry transform (Steps 0–5):
**every** content number now lives in `src/content/`, and `src/game.js`
contains no content literal at all. See §6.*

---

## 0. The one thing to understand first

**`src/game.js` is still the only runtime** — simulation, rendering, audio,
networking, HUD. But it no longer *contains* content. It imports a registry
and derives everything from it.

| Content | Source of truth (one file per id) | What `game.js` derives from it |
| --- | --- | --- |
| **Heroes / skins** | `src/content/heroes/<id>.js` | `CFG.meta.heroCosts`, `SLASH_TIP`, Armoury buttons, display names, safe-skin fallback |
| **Figures** (visual character designs) | `src/content/figures/<id>.js` | `TINTS`, `rigParts()`, per-figure mesh scale |
| **Enemies** | `src/content/enemies/<id>.js` | `CFG.enemy`, `CFG.caps`, `CFG.wave`, `FILL_POOL`, `SCHEDULED_ELITES`, `OPENER_KIND`, elite drop kinds |
| **Bosses** | `src/content/enemies/bosses/<id>.js` | `BOSS_NAMES`; shared sim in `bosses/shared.js` → `CFG.boss`, `CFG.boss2` |
| **Items / pickups** | `src/content/items/<id>.js` | `ITEM_DROPS`, `CFG.heal`, `CFG.magic.potion*`, `GEM_SCORE`, `GEM_XP` |
| **Props / terrain** | `src/content/props/<id>.js` | collider radii + every render geometry/offset/colour |
| **Maps / chapters** | `src/content/maps/<chapter>.js` | `PALETTES`, `MAP_CONFIGS`, `CHAPTER_NAMES`, `EVENT_PACKS` |
| **Upgrades** | `src/content/upgrades/<id>.js` | the ordered `UPGRADES` pool |
| **Global tuning** | `src/content/rules.js` | `RULES` → hero spec, magic, hit-stop, meta economy, net stamp |

The rule is simple: **find the folder for the type, add one file, add one line
to that folder's `index.js`.** `src/game.js` never needs editing.

⚠️ **Two files are shims, not sources.** `src/content/palettes.js` and
`src/content/upgrades.js` are deprecated phase-1 mirrors that now just
re-export from `maps/index.js` and `upgrades/index.js`. Do not edit them.

⚠️ `src/three.js` must stay a **classic** script: `game.js` reads its
top-level `const`s (`WebGLRenderer`, `Scene`, …) as bare globals. It is never
imported as a module.

⚠️ `index.html` is generated. Author `src/game.dom.html` and run
`npm run dom:sync`.

### Two build outputs

| Build | How | Output |
| --- | --- | --- |
| Browser / dev | `index.html` → classic `src/three.js` + module `src/main.js` | `npm run dev` |
| **Single-file phone** | `npm run single:build` — inlines CSS, three.js and a bundled ESM graph | `dist-single/aetherblade.html` |

The phone build is one self-contained `.html` with zero network fetches. It is
generated, never hand-edited, and `content:check` fails if it is stale or if
the inlined bundle does not boot.

---

## 1. Adding a new ENEMY

Worked example: a melee **lancer**. Two edits, both in `src/content/enemies/`.

### 1.1 The descriptor — `src/content/enemies/lancer.js`

Copy `soldier.js`. Pure data: no `three.js`, no DOM, no `Math.random`, no
`Date.now`.

```js
export const lancer = {
  id: 'lancer', kind: 'lancer', type: 'enemy', cls: 'melee', figure: 'lancer',
  cfg: {
    hp: 88, speed: 2.50, dmg: 16, radius: 0.50, score: 140,
    reach: 2.4, arcDeg: 100, tele: 0.55, recovery: 0.45, cd: 0.60,
  },
  cap: 2,                                        // its own alive cap
  wave: { from: 45, cap: 2, w: 14 },             // scheduled fill entry
  elite: false, events: [],                      // no chapter-event pack
  fill: { order: 5, weight: 14, from: 45 },       // weighted-pool entry
  added: '2026-11-13',
  notes: 'Longer reach than the soldier; two hits to kill.',
  behaviour: ['Closes to reach-0.35 m.'],
};
export default lancer;
```

Field meanings:

- **`cfg`** — the sim block. Melee kinds inherit `telegraph / strikeRange /
  strikeArcDeg / recovery` from `src/content/enemies/shared.js` unless they
  override `reach / arcDeg / tele / recovery / cd`. A **ranged** kind instead
  declares `minRange / maxRange / volley / projSpeed / projR`; that alone
  switches the AI to kiting + projectiles. Add `splash:<m>` for an
  area-damage bolt (sorcerer) and `poise:true` for a wind-up hero hits cannot
  interrupt (knight).
- **`cap`** — alive cap for this kind (`CFG.caps.<kind>`). The global 8-alive
  cap is `GLOBAL_ENEMY_CAP` in `shared.js`.
- **`wave`** — scheduled entry: `{from, cap, w}` for a normal fill kind, or
  `{from, cap, w:0, every:<s>, priority:<n>}` for a **timer elite**. Any
  descriptor with `every` is added to `SCHEDULED_ELITES`, sorted by
  `priority` (knight 0, sorcerer 1 today).
- **`fill`** — the weighted pool entry. `order` is **load-bearing**: it fixes
  the RNG consumption order in `spawnEnemy()`. `weight` is the base weight;
  `ramp` adds `weight + elapsed*ramp`; `from` gates first appearance.
  **No `fill` = it never spawns from the pool** (elites have `fill: null`).
- **`opensFight: true`** — exactly one kind may carry this; it is always the
  first spawn while `kills === 0` (currently the soldier).
- **`elite`** — documentation flag. The actual potion-drop list is
  `ELITE_KINDS`, derived from `src/content/items/potion.js`.
- **`events`** — chapter indices whose 90-second event pack may contain this
  kind. The packs themselves live in the map descriptors.

### 1.2 Register it — `src/content/enemies/index.js`

Add the import and one entry in `ENEMIES`. Everything else
(`ENEMY_CFG`, `ENEMY_CAPS`, `WAVE_RULES`, `FILL_POOL`, `SCHEDULED_ELITES`,
`OPENER_KIND`) is derived.

### 1.3 The figure — `src/content/figures/lancer.js`

A figure owns its palette **and** its complete moulded part list. Copy a
similar figure and edit the parts:

```js
export const lancer = {
  id: 'lancer', type: 'figure', displayName: 'LANCER',
  tint: { armor:[…], trim:[…], cloth:[…], skin:[…], blade:[…], dark:[…], glow:[…] },
  meshScale: 1.02,
  parts: [
    { j:1, g:'box', o:[0,0.35,0], s:[0.86,0.28,0.44], c:'armor' },
    { j:8, g:'cyl', o:[0,0.05,0], s:[0.055,1.55,0.055], c:'blade' },
    …
  ],
  added: '2026-11-13',
  notes: '…',
};
export default lancer;
```

- `j` is the joint index (0 hips … 12 right foot). Every part must attach to
  an existing joint so the shared animation clips pose it.
- `g` is a primitive: `box / sph / cyl / cyl12 / cone`.
- `c` is a **tint slot name** (`armor`, `trim`, `metal`, `cloth`, `skin`,
  `blade`, `dark`, `glow`) or the special `'INK'` for the shared near-black
  face print. `rigParts()` resolves it against the figure's own tint.
- `meshScale` replaces the old hard-coded scale chain in `makeView()`.

The existing 9 figures were extracted mechanically from the legacy
`rigParts()` code; `npm run figures:check` proves they still reproduce it.

### 1.4 Ship it

A new enemy **changes the simulation** (new spawns consume RNG): the digest
moves, so re-record the baseline and bump the net stamp (§5).

---

## 2. Adding a new HERO (playable skin)

Heroes are **cosmetic skins**: behaviour and stats come from `RULES.hero` and
the Armoury tracks, never from the skin.

1. **Create `src/content/heroes/<id>.js`:**

   ```js
   export const lancer = {
     id: 'lancer',              // PERMANENT — see the warning below
     type: 'hero',
     displayName: 'LANCER',
     price: 350,                // gold; 0 only for the free default
     default: false,            // exactly one hero has default:true
     figure: 'soldier',         // must name a figure descriptor
     slashTip: { b: 8, o: [0, 1.26, 0] },  // bone 8 = right hand, 5 = left
     added: '2026-11-13',
     notes: 'Reuses the soldier figure with a spear tip offset.',
   };
   ```

2. **Register it** in `src/content/heroes/index.js`. `HERO_COSTS`,
   `HERO_SLASH_TIPS`, `HERO_IDS`, the Armoury buttons, display names and the
   safe-skin fallback are all derived. There is no `heroCosts` literal and no
   id list in `game.js`.

3. **Figure.** Reusing an existing figure needs nothing. A genuinely new look
   is one new `src/content/figures/<id>.js` (§1.3) plus one barrel line —
   no `game.js` edit.

4. **Co-op.** Nothing else: the skin id travels in the pairing handshake and
   each hero renders with its owner's skin. Unknown ids from an old save or an
   older peer are funnelled through `safeHero()`.

5. **Verify.** `npm run content:check`.

⚠️ **Ids are permanent.** A skin id is written into the save (`localStorage`
key `aetherblade-meta-v1`), into the co-op `hello`/`start` handshake and into
the `RIG_GEO` geometry cache. Renaming one silently loses an unlock. Add a new
id instead.

Plain skins do not change the simulation, so no digest move and no
net-stamp bump.

**Signature magic (the one exception).** A hero descriptor may carry an
optional `magic` block — the registry's only per-hero sim ability:

```js
magic: { kind: 'frost', freezeSec: 1.0, bossFreezeSec: 0.5 },  // FROST ARCHER
magic: { kind: 'earth', push: 6, bossPush: 3 },                // EARTH DWARF
```

`heroes/index.js` derives `HERO_MAGIC` from the descriptors that carry
one; it is hashed into `SIM_CONTENT`, and `castMagic()` applies the
caster's signature to the survivors of the standard 60-dmg blast
(frost: a whole-step freeze timer on enemies/boss, hashed by
`simDigest`; earth: instant radial knockback clamped to
`ARENA_R − radius`). The caster is identified by the sim hero's
`heroId`, set from each player's own selected skin at run start (solo
and co-op) and hashed per hero. A hero WITHOUT a `magic` block casts
the plain blast, unchanged. Because this is simulation input, adding
or tuning a signature **does** move the digest: re-record the baseline
(`npm run content:baseline`) and bump `RULES.net.build`.

---

## 3. Adding a BOSS

Bosses share one sim entry (`BOSS_CFG` + `BOSS_PHASE2` in
`src/content/enemies/bosses/shared.js`) and one `boss` figure, renamed per
chapter. Two levels:

- **A new name / identity (view-only):** add
  `src/content/enemies/bosses/<id>.js` with `chapter`, `name`,
  `displayName`, `mapId`, `figure` and `sharedSim`. Add it to `BOSSES` in
  `bosses/index.js` (keyed by chapter) and set `bossId` on the map
  descriptor. `BOSS_NAMES` derives from chapter order.
- **A genuinely different boss (own HP/moves):** give `shared.js` per-chapter
  overrides, or add a `cfg` object to the descriptor and branch the boss AI on
  `s.chapter`. This **is** a sim change — full §5 routine.

Remember the standing proof rule: verify on the **natural path** (boss spawns
from the 3:00 timer at 26–30 m and walks in), never by teleporting it next to
the hero.

---

## 4. Items, props, maps, upgrades

- **Item / pickup:** `src/content/items/<id>.js` holds the drop rule
  (`always` / `chance`), the offset from the corpse, the consumable value and
  the instanced-mesh pool name. Add it to `ITEMS` and, if it needs sim wiring,
  to `ITEM_DROPS` usage in `killEnemy()`.
- **Prop / terrain:** `src/content/props/<id>.js` holds a `collider` block
  (sim input — changing it moves the digest) and a `view` block (geometry,
  offsets, scales, colours — view-only). `buildMapData()` and
  `buildMapMeshes()` read both; neither is hard-coded in `game.js`.
- **Map / chapter:** `src/content/maps/<chapter>.js` holds the palette, the
  deterministic seed (`9701 + chapter*7919`), pond/landmark positions, prop
  counts, landmark style, chapter-event pack and boss id. Add it to `MAPS`
  keyed by chapter number. **Order matters**: `PALETTES` and `MAP_CONFIGS` are
  built from `MAPS` in key order.
- **Upgrade card:** `src/content/upgrades/<id>.js` holds `ic`, `displayName`,
  `description` and the `apply(s)` hook. Add it to `UPGRADES` in the exact
  intended order. **Order is load-bearing**: `pickChoices()` rolls
  `rndI(s, UPGRADES.length)`, so reordering changes which cards appear and
  moves the digest.
- **Armoury track:** add an entry to `RULES.meta.tracks` (id, label, per-step
  value, unit). Buttons and labels are generated from it.
- **Balance pass:** numbers in `RULES` only. Still a sim change (§5).

---

## 5. Ship checklist (every content change)

1. **Gate:** `npm run content:check` — 17 checks: schema, no content literals
   in `game.js`, cross-references, figure reproduction, `SIM_CONTENT` hash,
   digests, boot, DOM, single-file build, helpers. Then load the page in a
   real browser with zero console errors.
2. **See it spawn:** prove the new kind actually appears (a kind that never
   spawns is the classic silent failure — check its `fill` block), and prove
   timer-driven things on the natural path (events at tick 5400, boss at tick
   10800).
3. **Determinism:** `npm run digest:check`. Unchanged for view-only work. For
   deliberate sim work: `npm run content:baseline` to re-record, then bump the
   net stamp.
4. **Net stamp:** if the digest moved, bump `RULES.net.build`
   (`AB-NET-2` → `AB-NET-3`, …). Old and new builds then refuse to pair
   instead of desyncing mid-run.
5. **Combat invariants:** attack cadence 31 steps dry / 36 in combat; swing
   0.625 s, hit at 0.25 s, range 3.2 m, arc 130° — unchanged unless the change
   is deliberately about them.
6. **Phone build:** `npm run single:build` (then `npm run single:smoke`).
   `content:check` fails if `dist-single/aetherblade.html` is stale or its
   inlined bundle does not boot.
7. **Deploy:** copy the project into the `deploy-lego/` clone of
   `mattpenny/lego`, commit, push, then curl the live `src/game.js` and
   compare size/markers.
8. **Record:** dated entry in `PLAN.md` (what changed, new digest, new net
   stamp), and refresh `aetherblade-refactor.zip`.
9. **Phone check is the final word:** desktop/headless proof does not replace
   opening it on a real phone.

*Golden rule, learned the hard way on this project: verify through the real
input path and the natural timer path — a passing staged test is not proof.*

> **Workspace note (2026-11-13):** `PLAN.md`, `lego-revised.html`,
> `deploy-lego/` and `aetherblade-refactor.zip` are **not present** in this
> checkout. Checklist items 7–8 could not be performed here. The single-file
> phone build now lives at `dist-single/aetherblade.html` and is generated by
> `npm run single:build`.

---

## 6. Registry tooling

### Layout

```
src/content/
  schema.js              pure-data validation + deepFreeze + assertRegistry
  rules.js               RULES: cross-cutting sim tuning + net stamp
  index.js               REGISTRY + SIM_CONTENT + every derived table
  heroes/<id>.js         one per skin        + index.js derives costs/tips/ids
  figures/<id>.js        one per visual design + index.js derives TINTS/scales
  enemies/<id>.js        one per kind        + index.js derives cfg/caps/wave/pool
  enemies/bosses/<id>.js one per chapter boss + shared.js holds BOSS_CFG/PHASE2
  items/<id>.js          one per pickup      + index.js derives drop table
  props/<id>.js          one per prop family + index.js derives collider radii
  maps/<chapter>.js      one per chapter     + index.js derives palettes/configs
  upgrades/<id>.js       one per card        + index.js derives the ordered list
  palettes.js            DEPRECATED shim → maps/index.js
  upgrades.js            DEPRECATED shim → upgrades/index.js
scripts/
  content-check.mjs      the 17-check gate
  content-summary.mjs    traceability report: id -> source file -> sim values
  digest-harness.mjs     pure-sim VM slice + deterministic digests
  content-baseline.json  recorded digests + SIM_CONTENT hash
  extract-figures.mjs    regenerates figures/ from figures-legacy.txt
  build-single.mjs       single-file phone build (custom ESM bundler)
  single-smoke.mjs       executes the inlined bundle headlessly
  sync-dom.mjs           index.html <- src/game.dom.html
  boot-smoke.mjs         real module graph boots without a browser
```

### Commands

| Command | What it does |
| --- | --- |
| `npm run content:check` | **Run before every commit.** All 17 checks. |
| `npm run content:summary` | Report every content id, its source file and its sim values. |
| `npm run boot:smoke` | Boots the module graph in Node with inert engine/DOM stubs; asserts `window.__GAME`, the baseline digest, net build, that `CFG.enemy/caps/wave/heal/boss/events/meta` really came from descriptors, and that a 120-step run starts. |
| `npm run digest:check` | Determinism vs `scripts/content-baseline.json`. |
| `npm run content:baseline` | **Deliberate sim changes only** — re-record digests + `SIM_CONTENT` hash. |
| `npm run figures:check` | Prove the figure descriptors still reproduce the legacy rig. |
| `npm run dom:sync` | Regenerate `index.html` from `src/game.dom.html`. |
| `npm run single:build` | Build `dist-single/aetherblade.html`. |
| `npm run single:smoke` | Execute the inlined phone bundle headlessly. |

### What `content:check` enforces

1. all 8 descriptor tables satisfy `schema.js`, with expected counts
2. `src/game.js` contains **no** content literal (TINTS, rigParts, palettes,
   upgrades, boss names, prop geometry, fill pool, scales) and the obsolete
   mirrors are shims
3. every cross-type reference resolves (hero/enemy/boss → figure,
   map → boss, chapter → map) and load-bearing orders are sorted
4. the 9 figures still reproduce the legacy rig
5. `SIM_CONTENT` hash matches the baseline — changing **any** simulation
   number in **any** descriptor fails until the baseline is re-recorded
6. the deterministic digests, combined hash, net stamp and hero costs match
7. the real ES module graph boots
8. `index.html` is generated from `src/game.dom.html`
9. the phone build is current **and** its inlined bundle boots
10. `safeHero` / `heroName` / `HERO_COSTS` are consistent

### Digest-safe vs digest-moving

`SIM_CONTENT` (in `src/content/index.js`) is the exact projection of
simulation input: rules, hero costs/tips, enemy cfg/caps/wave/fill order,
boss cfg, item drops, collider radii, map configs, event packs and the upgrade
order. It is hashed with sorted keys.

**Excluded on purpose:** figure tints, part lists and mesh scales; prop `view`
blocks; map `palette` blocks; upgrade labels. Editing those is provably
view-only — the digests will not move.

**Included:** anything the sim reads. A change there moves the hash, so the
gate fails until you re-record the baseline and bump `RULES.net.build`.

### Load-bearing orders

Three arrays consume `sim.rng` or decide outcomes, and are hashed by
`SIM_CONTENT` so a silent reorder cannot slip through:

- **`FILL_POOL`** — weighted enemy pool, ordered by `fill.order`
  (`soldier → brute → runner → ranger → archer`).
- **`UPGRADE_LIST`** — level-up cards, in descriptor order
  (`hide → edge → tempo → reach → boots → reflex → magnet → crit → siphon`).
- **`MAP_CONFIGS`** — chapters in key order; each carries its own seed.

`SCHEDULED_ELITES` is ordered by `wave.priority` (knight, then sorcerer) and is
checked to stay sorted.

### Adding a *new kind* of content (a 9th table)

1. Create the folder + one file per id + an `index.js` barrel.
2. Add a `check<Type>` function and a `CONTENT_TYPES` entry in `schema.js`.
3. Add the table to `REGISTRY` in `src/content/index.js`.
4. Add its simulation fields to `SIM_CONTENT` if the sim reads them.
5. Add `game.js` wiring and a `content:check` assertion.

### History: why the digest did not move

The whole transform (Steps 0–5) changed **no simulation behaviour**. Every
derived table reproduces the old literal exactly — proven by
`figures:check`, by the digest harness (all five digests unchanged) and by
`boot:smoke`. `combined` is still
`8ba246d908e892342f25d37bc2b5d606b7fe8451b96026eb1392f5237a60961b`, fresh
`3211ebe328fd195f`, net build still `AB-NET-2` — no stamp bump needed.

The one architectural leak was also closed: the five `FXSHAKE()` calls in
PART 2 (pure sim) now emit `emit('shake', {v})`, consumed by
`consumeEvents()` in PART 3. `EV` is drained by `runHeadless()` and never
hashed, so the digests are unaffected and the sim region is pure again.
