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

**The heraldic set (AB-NET-8).** Fifteen enemies landed at once from an
external handoff — 12 heraldic knights (raven, eagle, crimson, axe, sun,
azure, obsidian, unicorn, lion, kraken, tower, dragon), the crossbowman,
and the russet + teal archers. The integration was exactly this section's
recipe at bulk scale: the 15 enemy descriptors + 15 figure descriptors
are pure data in the registry format (the shared 29-part minifig body;
heraldry lives in tint slots + accessories, `meshScale` per figure), and
the only merges were the import/registration blocks of
`enemies/index.js` and `figures/index.js` plus the expected-count line in
`scripts/content-check.mjs` (ENEMIES 22, FIGURES 28). NO sim code changed:
the wave director's weighted fill is fully generic — `FILL_POOL` derives
from each descriptor's `fill {order, weight, from}` and `ENEMY_CAPS` from
its `cap`, so a new kind spawns by data alone. Ranged kinds (`cls:
'ranged'` with `minRange/maxRange/volley/projSpeed`) flow through the
same ranged path as the archer/ranger/sorcerer. The handoff's generator
script is documentation of how the descriptors were produced — the
descriptors are the deliverable; do not re-run it over hand-tuned files.
Every current number is in the generated **STATS.md**.

---

## 2. Adding a new HERO (playable skin)

Heroes are **cosmetic skins**: behaviour and stats come from `RULES.hero` and
the Armoury tracks, never from the skin — with three descriptor-carried
exceptions, all documented at the end of this section: signature **magic**,
a ranged **attack**, and balance **stats**. (Current build: **AB-NET-7**.)

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

**Names and roles.** `displayName` is the headline everywhere (hero-select
card, Armoury). The three identity heroes also carry an optional `role`
(`KNIGHT` / `ARCHER` / `DWARF`): the picker shows it as the class sub-line
under the personal name (the identity heroes are named **Ansum**, **Penny**
and **Matt**), and one-line surfaces render `Name · ROLE` via `heroLabel()`.
Both fields are view-only text — NOT in SIM_CONTENT — so renaming a hero
never moves a digest and never needs a stamp bump. The four class skins
have no `role`.

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

**Ranged attack (the second exception).** A hero descriptor may carry
an optional `attack` block — today exactly one hero does, and she is
the worked example of a ranged hero:

```js
attack: { kind: 'arrow', range: 14, speed: 26, aimDeg: 25, r: 0.25 },  // FROST ARCHER
```

`heroes/index.js` derives `HERO_ATTACK` from the descriptors that
carry one; it is hashed into `SIM_CONTENT`. `updateHero()` branches on
it at the hit moment: input, wind-up, swing duration and cooldown
cadence are **identical** to the sword (hit at 0.25 s; 31 steps dry /
36 in combat) — only the delivery differs. At the hit moment
`fireArrow()` spawns a deterministic sim projectile (`s.arrows`):
it flies straight along facing at `speed`, up to `range` metres, and
the per-step segment-vs-body test in `updateArrows()` (body radius +
arrow radius `r`) stops it at the **first** body on its path — no
piercing. Damage is the hero's current damage stat, routed through the
same `damageEnemy()`/`damageBoss()` pipeline as a sword hit (same
crit roll at hit time, same wind-up interrupt, same kill drops, frozen
enemies hittable, boss a valid target). **Aim assist**, fixed at
release: the nearest enemy/boss centre inside an `aimDeg` cone of the
hero's facing (and within `range` + its radius) donates the arrow's
direction; otherwise it flies along facing. No tracking after release.
A ranged hero gets **no forward lunge** (the sword's is melee-only)
and no slash crescent or weapon trail in the view; her `attack` state
plays the dedicated `shoot` clip (bow arm up, draw during the wind-up,
release at 0.25 s) and pooled arrow meshes fly the sim's arrows.
Arrows are hashed by `simDigest` **only while any are in flight** —
the shipped digest scenarios run the default melee hero, whose arrow
list is always empty, so adding the block left every recorded scenario
digest (and `combined`) bit-identical; only the `SIM_CONTENT` hash and
the net stamp moved (AB-NET-5 → **AB-NET-6**).

**Balance stats (the third exception).** A hero descriptor may carry
an optional `stats` block of multipliers:

```js
stats: { dmgMul: 0.8 },                                              // FROST ARCHER
stats: { dmgMul: 1.25, speedMul: 0.9, rollDistMul: 0.8, rollCdMul: 1.3 },  // EARTH DWARF
```

`heroes/index.js` derives `HERO_STATS`; hashed into `SIM_CONTENT`.
`heroStats()` applies each multiplier to the **base** stat first —
damage is rounded once, there, with `Math.round` (34 × 0.8 → 27;
34 × 1.25 → 43) — and only then do the existing upgrade curves and
additive meta mods compose on top, exactly as before. Any missing
field is ×1.0; a hero with NO `stats` block (the LION KNIGHT and all
four class skins) is ×1.0 throughout and bit-identical. Today's
settled balance: the archer trades damage for range (arrows at 0.8×);
the dwarf hits 1.25× but moves at 0.9× speed, rolls 2.8 m
(0.8 × 3.5 m) and waits 1.3 s between rolls (1.3 × 1.0 s).

**View-only per-hero dressing (never in `SIM_CONTENT`).** Two optional
descriptor fields affect presentation only:

- `slashTint: { core: [r,g,b], rim: [r,g,b] }` — derived into
  `HERO_SLASH_TINTS`. The hero's swings draw the slim crescent (same
  geometry, timing and brightness envelope as the default) from a
  palette with these colours baked in. The EARTH DWARF's hammer arc is
  pale orange: core `[1.0, 0.50, 0.08]` (#ff8014), rim
  `[1.0, 0.58, 0.20]` (baked at 36% brightness, like the default's
  rim). Everyone else keeps the luminous blue-white original. (The
  arc's first tint — pale red #ffb3a1 — washed out to near-white under
  the additive blend in phone play; Matt reported a "white crescent".
  Deepening the CORE, not the geometry or envelope, fixed the read:
  capture-measured added-light hue moved from ~21° to ~36° median.
  The dwarf figure likewise carries an oversized hammer head —
  0.84 m bright-steel block, gold striking faces and centre band —
  after the original 0.52 m dark-steel head read as a small stick at
  game distance. Both changes are figure/descriptor view data only;
  the combined digest did not move.)
- The dwarf also SWINGS differently (2026-11-14): `CLIPS.hammer` in
  game.js is his attack clip — a two-handed OVERHEAD slam in the pitch
  plane (weapon arm to −2.55 rad behind the crown at t=0.13, slammed
  to +0.95 with spine pitched +0.40 at the t=0.25 hit key, then
  recover), selected in syncViews by `heroId==='dwarf'` exactly the
  way ranged heroes swap in `CLIPS.shoot`. Same 0.625 s envelope,
  same hit frame; `updateAnim` drives it from the sim's state time
  like attack/shoot. His crescent follows the same arc: slash slots
  keyed `mk==='dwarf'` pitch the flat arc into the vertical facing
  plane (slot `rx`, rotation order YXZ) and sweep its centre from
  −100° to +49° over the shared q envelope, so the pale-orange arc
  crests over him and lands with the hit step. Other heroes' slots
  keep `rx=0` and the original yaw sweep — regression-captured
  unchanged. All view-only; digests bit-identical.
- The dwarf's CAST is a ground slam (2026-11-14): `CLIPS.groundslam`
  in game.js — a dedicated one-shot 0.9 s overhead slam for his
  Earthquake, distinct from the attack swing (bigger raise to −2.90
  behind the crown at t=0.20, hammer driven down at the t=0.34 impact
  key with spine +0.58 and a deep crouch, a hold at the bottom, then
  recover). The sim's 'magic' event (whose payload carries `sig`)
  starts it: consumeEvents routes `sig==='earth'` to
  `dwarfEarthCast()`, which finds the caster's view (the hero whose
  HERO_MAGIC kind is 'earth', nearest the event position in co-op)
  and sets `v.slamT=0`; syncViews then overrides that hero's clip
  until the slam plays out, sampled on the slam clock like
  attack/hammer are sampled on sim state time. At the impact frame
  (SLAM_IMPACT_T = 0.34, queued by dwarfEarthCast) `updateQuakes()`
  fires the earthquake read: a burnt-orange shockwave ring
  (0xc2611a) expanding to the blast radius over 0.45 s over a dust
  disc, plus dust bursts at the impact point 0.9 m in front of him
  and a small camera shake. This REPLACES the old immediate tan
  ring/bursts for earth casts; Frost Nova and the plain blast keep
  their existing treatment exactly. All view-only — the event
  payload is unchanged, no sim or content file is touched, digests
  bit-identical (capture sequence: raise → impact ring at his feet →
  ring at full expansion; rig `ab-quake-cast.mjs`, frames in
  rig/ab-quake-*.png).
- `trait: '…'` — the one-line tradeoff shown on the hero's
  CHOOSE YOUR HERO card ("Ranged arrows · lighter damage" / "Heavy
  hammer · slower, short roll" / "Balanced sword & shield"), read from
  the descriptor so card and content cannot drift. The schema
  **requires** a trait on any hero that is `default`, carries an
  `attack` block, or carries a `stats` block — the pickable identity
  heroes; class skins are not on that screen and need none.

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

**Boss numbers (AB-NET-7).** Every boss→hero damage value is scaled by ONE
multiplier: `cfg.dmgMul` on the shared `BOSS_CFG` and on each own-`cfg` boss
(default 1 when absent), applied with a single `Math.round` at each damage
point — slam (the phase-2 slamBonus is added BEFORE the multiply), charge,
and breath tick. **Phases** are shared, in `BOSS_PHASE2`: Summon ≤50%
(2 × soldier) · Enrage ≤30% (approach speed ×1.15, slam +4) · **Fury ≤15%**
(approach speed ×1.15 MORE — ×1.3225 total — and attack tempo ×1.15:
cooldowns and telegraphs that START in fury are divided by 1.15, timers
already running keep their duration; breath tick rate/duration and charge
speed unchanged). The fury flag is hashed sim state. **Size:** `cfg.radius`
is the sim body — all three bosses are ×1.3 (1.95 / 1.495 / 1.755) — and the
matching figure scale is the figure descriptor's `meshScale` (warlord
2.145, which includes its original 1.65; dragon and knightMount 1.3; the
descriptor snapshot in `scripts/figures-legacy.txt` must match). The
dragon's `breath.headDist` is the mouth offset and scales with the body
(3.38) — geometry, not attack range. For every current number, see the
generated **STATS.md** at the repo root (`npm run stats:build`).

Remember the standing proof rule: verify on the **natural path** (boss spawns
from the 3:00 timer at 26–30 m and walks in), never by teleporting it next to
the hero.

**Boss arrival keeps the field (AB-NET-13, Matt's call).** `spawnBoss()`
no longer clears `s.enemies`: whatever is alive at tick 10800 stays —
current HP, current state — and keeps fighting alongside the boss
(targeting, damage, drops, XP all normal; the alive cap governs
*spawning* only, so boss + a full leftover field is expected). Wave
spawning still stops at the spawn (the spawn block runs only in phase
`play`); phase-2 summons add on top of the remains; in-flight enemy
projectiles still clear at the spawn (transient, not field enemies);
chapter advance (`phase 'clear'`) still resets the field for the next
chapter. The `spawnBossNow()` test hook still stages a clear field on
purpose — it is a staging tool, not the game flow. Verified by census
A/B (rig `ab-boss-escorts.mjs`): identical fields at tick 10799 on
both builds; old build 8 → 0 at the spawn, new build 8 → 8 with
identical ids/HPs. The director-audit bot kills the Ch.1 boss with
escorts on 3/3 seeds and advances; the honest no-refill canary's one
boss-reaching seed flipped from a 38-HP-margin kill to a death — a
full leftover field is a real difficulty step for a marginal fighter,
recorded in PLAN.md, deliberately not tuned away.

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

## 7. Multiplayer — up to 4 players (AB-NET-9) + player-count scaling

**Rooms hold 1 host + up to 3 guests.** The lobby is roster-based: guests
`hello` with their hero snapshot, the host broadcasts the `roster`, and the
host presses **START RUN** with 2–4 present — the roster locks at start (no
mid-run joins) and the `start` message (seed + roster) is the agreed state
every client builds the sim from. Player indices are roster order; relay
slot numbers ride along in each snapshot.

**Transport:** the room relay has two generations. On the **v5 relay** the
game runs a 2-player room exactly as it did at AB-NET-8 (no slot events;
the sender is simply "the other player"). **3–4 players need relay v6**
(standalone project `aetherblade-relay-v6/` next to this repo — same worker
name and URL, deployed by Matt; AB rooms are namespaced by the `0` second
character of the room code, and v6 stamps every forwarded message with the
sender's slot as `from`). A 3rd joiner on a v5 relay just sees ROOM IS
FULL; the lobby copy says so honestly.

**Lockstep** is the 2P machinery generalised: a tick runs when EVERY
roster frame exists; digest checkpoints (every 600 ticks) are compared
across ALL players; any mismatch is the same hard desync stop. **Drops:**
a dropped slot is held for the 60 s resume window and a rejoin replays to
the agreed tick exactly as in 2P. In **3–4P**, if the window lapses the
remaining players agree a removal step (min of their first-missing steps
for that slot) and that hero is removed there on every client — the run
continues, and **level-up picking passes to the lowest-numbered remaining
player**. In 2P the legacy flow is untouched (PARTNER LEFT → continue
solo).

**Player-count difficulty (`RULES.playerScaling`, in `SIM_CONTENT`)** —
Matt's proportions, one table, tuned in `src/content/rules.js`: HP for
enemies AND bosses is `N × (1 + 0.1 × (N−1))` (×1.0 / ×2.2 / ×3.6 / ×5.2,
one `Math.round` at spawn); damage to heroes is ×1.0 / ×1.1 / ×1.2 / ×1.3
(one extra round per application, after the existing per-source
rounding); alive cap 8 / 8 / 10 / 12. N is the roster size **locked at
run start** — a mid-run removal does NOT rescale. The N=1 row is exactly
the pre-scaling game, so solo digests are the regression anchor. STATS.md
renders this table ("Multiplayer scaling") — it is the adjustment
surface. Baseline note for AB-NET-9: the table landing moved ONLY the
`coop1200` digest (N=2 enemies now spawn at ×2.2 HP); the four solo
digests are bit-identical to AB-NET-8.

## 8. Per-chapter fill overrides (AB-NET-10)

The weighted fill pool is **global** by default — one `FILL_POOL`
derived from the enemy descriptors' `fill {order, weight, ramp, from}`.
A map descriptor may narrow it for its own chapter: `map.fill` in
`src/content/maps/<id>.js` maps kind → `{from?, weight?, ramp?}`, and
`src/content/index.js` derives `FILL_POOLS[chapter]` (same kinds, same
load-bearing order; only the named fields are replaced). `spawnEnemy()`
rolls `FILL_POOLS[s.chapter] || FILL_POOL`. Chapters without the block
are bit-identical to the pre-override game — the Chapter 2/3 director
audits reproduce the AB-NET-8 first-spawn tables exactly.

Today only **Chapter 1 (Grassland)** carries overrides, staggering
Matt's 15 heraldic kinds across the first wave (they previously pooled
at weights 7–11 from 18–105 s and barely showed): early trio
(raven/crossbowman/russet, from 18/22/28 s), mid group (eagle → crimson,
52–82 s), late group (axe → kraken, 100–132 s), and tower + dragon as
heavy-weight showcase singles (150/158 s — a cap-1 kind leaves the pool
while alive, so a heavy weight buys one prompt appearance, not
pressure). The always-eligible base kinds (soldier/brute/runner) carry
negative ramps in this chapter so they hand the late-game share to the
tail. Spawn interval, per-kind caps and the global alive cap are NOT
overridable — composition substitutes, it never adds. `map.fill` is
schema-validated (kinds must be fill-pool enemies; fields numeric) and
hashed into `SIM_CONTENT` twice over (via `maps` and `fillPools`), so
any edit is a sim change: re-record the baseline and bump the net
stamp. STATS.md renders the table ("Chapter fill composition").

**Difficulty note (measured, AB-NET-10):** the denser heraldic mix is
tougher for the weak no-refill canary bot — 5-seed median survival
5499 → 3776 ticks, median kills 35 → 16 (earlier death on 5/5 seeds)
versus the AB-NET-9 pool — while the competent audit bot still clears
Chapter 1 on every seed. Matt settled the AB-NET-8 difficulty and then
ordered this visibility change; the delta is recorded here and in
PLAN.md rather than silently tuned away. If he wants Chapter 1 softer,
the lever is the `map.fill` table in `grassland.js` (lower the early
trio's weights first).

**Softening (AB-NET-12, Matt's final call 2026-11-14):** he took the
lever. In `grassland.js` only: the early trio's weights were halved
(raven 30→16, crossbowman 26→14, russet-archer 26→14, ramps eased to
−0.06/−0.05/−0.05; `from` times unchanged) and the base kinds' decay
ramps eased (soldier −0.06→−0.02, brute −0.10→−0.03, runner
−0.08→−0.03) so base kinds hold the early share longer. Five cap-1
kinds also had weights raised purely for presence robustness
(crimson 24→40, axe 26→56, kraken 44→80, tower 100→200, dragon
110→160): at the old weights, which cap-1 kind missed the ≥2-of-3-seeds
audit bar rotated with every stream change. Re-measured on the SAME
canary (5 seeds, no refill): median survival **3776 → 6325 ticks**,
median kills **16 → 37** — past the ≥4700 target and the AB-NET-9
reference (5499/35); one seed now kills the boss outright. Director
audit: union 15/15, every kind on ≥2 of 3 seeds, alive max 8, no cap
violations; chapters 2/3 first-spawn + per-kind-alive tables
bit-identical to pre-change. Only the two Ch.1 combat digests moved
(combat3600 + altSeed); baseline re-recorded, stamp AB-NET-12.

## 9. Chapters 4–6 and placeholder bosses (AB-NET-11)

The campaign is **six chapters**: 4 FROSTFALL GLACIER, 5 EMBER CALDERA,
6 DARK AGE SIEGE, adopted as data from Matt's maps handoff (2026-11-14).
VICTORY now requires the chapter 6 boss kill. Everything chapter-counted
is DERIVED: `CHAPTER_COUNT = MAP_CONFIGS.length` in game.js drives
progression, the clear/victory overlays, armoury stars and the
`__GAME.setChapter` clamp — there is no hard-coded `3` left. Adding a
chapter is still one descriptor file + one registry line + one boss.

New descriptor surface the renderer consumes (all validated in
content:check's refs gate):
- `map.landmarkBlocks[]` — explicit set-piece blocks RELATIVE to
  `map.landmark`; when present it replaces the legacy
  windmill|crypt|keep branch. Colliders come from the SOLID PROPS pass
  (BLOCK_R, extended to 11 kinds — kinds 6–10 are the new silhouettes).
- `map.extra.<family>[]` — hand-placed dressing in ABSOLUTE coords,
  appended to the sim arrays; rock/pillar/stone/trunk/torch entries
  also get colliders.
- `map.theme` (Ch.5 only) — VIEW-ONLY silhouette vocabulary (mesas,
  skyline, cones, craters, rims, ribbons, columns, embers), one
  instanced draw per family, read straight from MAP_CONFIGS by
  buildMapMeshes. Only the `cr` radii on mesas/cones/columns mirror
  into `sim.map.colliders` in buildMapData (before tryPlace, so the
  seeded scatter avoids them). The main caldera mesa is a 14.7 m-radius
  collider disc — keep it a disc.
- Palette flags on EVERY chapter: `texStyle`
  (grass|ash|snow|mud|caldera), `sunIntensity`, `lavaWater` — these
  replaced the renderer's chapter-number special cases; Ch.1–3 carry
  exactly the values their hard-coded branches used, so their look is
  unchanged.
- Prop `chapters` arrays and every `*ByChapter` colour table cover all
  six chapters (refs gate fails otherwise).

**Placeholder bosses.** Matt creates his own bosses for chapters 4–6;
the handoff pack's frost-warden / cinder-lancer / siege-wyrm were NOT
adopted, and its `bosses/shared.js` was REJECTED (stale pre-buff
numbers — copying it would have silently reverted the AB-NET-7 boss
buff). Until Matt's bosses land, the existing three reappear as their
own registry entries (`placeholder: true` in the descriptor, marked in
STATS.md): Ch.4 GRAVE SOVEREIGN on the warlord figure/cfg at HP 520,
Ch.5 EMERALD DRAKE (dragon, breath) at HP 580, Ch.6 THE IRON LANCER
(knight-mount) at HP 640 — the escalation continues 396/330/462 →
520/580/640 for a hero who arrives levelled with upgrades carried.
All standing rules apply (dmgMul 1.1, phase 2, FURY at 15%,
playerScaling — measured ×2.2 at N=2: 1144/1276/1408).

**Save compatibility (hard gate, verified):** `aetherblade-meta-v1`
saves from the 3-chapter era load untouched — loadMeta default-fills
`best`/`cleared` for chapters 4–6 and preserves gold/tracks/heroes.
Verified with a fabricated old-format save: backfilled slots, armoury
renders six chapter lines, zero page errors.

**Digest story:** every scenario digest AND the combined digest are
bit-identical to AB-NET-10 — Ch.1–3 sim behaviour is provably
untouched (their map objects gained nothing; the palette flags are not
hashed; BLOCK_R only appended kinds). Only the SIM_CONTENT hash moved
(registry growth), re-recorded via content:baseline with the stamp
bumped AB-NET-10 → AB-NET-11.

**Known wrinkle (observed, not fixed):** on Ch.5's east side, the
second mesa (26,−8, cr 6.3), a cinder cone (32.3,−9.9, cr 4.9) and the
basalt column cluster form a pocket where a purely radial-steering
audit bot and the drake can pin each other across the mesa rim
(canonical-seed audit run stalled there; the same bot killed the boss
on two other seeds, and a variant bot killed it on the canonical seed
in open ground). A human simply walks around the mesa. If Matt wants
the pocket gone, the lever is data: shrink mesa 2's `cr` or move the
cone — a sim-visible change, so baseline + stamp per process.

## 10. Account progression — the server profile in game (AB-NET-14, Phase M2)

The account system from `../ACCOUNT-PROGRESSION-PLAN.md` is wired in.
The M1 API (`https://aetherblade-api.ccac-church.workers.dev`, its own
Worker + D1 project) owns the profile; the game is a client.

**Client module — `src/account.js`.** Session storage, the auth/profile
calls, the versioned stat derivation and the co-op snapshot/digest.
It is view-layer infrastructure: the sim never imports it, nothing runs
at import time, and the sim only ever sees the DERIVED block in a hero's
`mods` before tick 0. It deliberately has no `export async function`
(the single-file bundler has no such form — async functions are declared
plainly and re-exported via an `export { … }` list). API base resolution
mirrors the relay override: `?api=` query param, then localStorage
`aetherblade-api`, then the production Worker. The session token lives
in localStorage `aetherblade-session-v1` (plan §2).

**The stat block.** `accountStats(level, equipment)` (plan §6):
`P.hp = 2·(L−1) + 8·Armour`, `P.dmg = floor((L−1)/2) + 2·Weapon`,
`P.spd = 0.01·(L−1) + 0.075·Boots`, `P.crit = 1%·Helm`,
`P.magicDmg = 2·Charm`. `ACCOUNT_GAINS` in the same module is the single
source the STATS.md "Account progression" section renders. Composition
in `heroStats()`: content base → hero multipliers → in-run upgrade
curves multiply the hero-multiplied base, the account block's hp/dmg/spd
added after (exactly where the legacy track mods always landed);
`md.crit` is added to the base 5% before the Keen Eye curve, and
`castMagic` deals `CFG.magic.dmg + caster.mods.magicDmg`. Hero `mods`
therefore carry five fields now: `{hp, dmg, spd, crit, magicDmg}`.

**Who uses which block.** Solo: the account block when signed in
(profile fetched on boot when a token exists), the LEGACY local tracks
otherwise — guest play is byte-for-byte the pre-account game. API
failure degrades to guest with a landing notice ("ACCOUNT UNAVAILABLE —
PLAYING AS GUEST" + a RETRY ACCOUNT button); a 401 clears the dead
session. Play is never blocked on the API.

**Digest discipline.** A Lv1 / zero-equipment profile derives the exact
zero block, and every shipped scenario runs zero blocks: the M2
re-record moved only `build` (AB-NET-14), `simContentSha256` (the stamp
string lives in RULES) and `sourceSha256`; combined digest `b288e3cd…`
and every scenario digest are bit-identical to AB-NET-13. The two new
sim-visible fields are hashed CONDITONALLY (a `X<n>` extension block in
`simDigest`, emitted only when some hero carries nonzero crit or
magicDmg — the same conditional-hash precedent as hero arrows), so
equipped-account runs are fully hashed without moving zero-block runs.

**Co-op.** The handshake carries the public SNAPSHOT (plan §6:
displayName, accountLevel, equipment, heroId, progressionVersion,
economyVersion) inside the existing hello/roster/start messages — no
relay features; 2P on the live v5 relay works unchanged. Raw mods no
longer cross the wire: each client derives every block locally via
`snapshotBlock()`. The host rejects a version-mismatched hello in the
VERSION MISMATCH style; the start message carries `pdigest`, a SHA-256
over the canonical (sorted-key) roster of `{slot, snap, block}` that
each guest recomputes and refuses on mismatch before applying. Guests
carry the explicit GUEST zero snapshot. Gold, shards, total XP and the
token NEVER cross the wire.

**UI.** Landing chip (guest notice / account line) + LOG IN / REGISTER
button; `#acct` modal (login / register / reset / recovery / account
views) in the coop parchment language. Registration and reset both end
on the recovery view: the one-time code, large, with an I-SAVED-MY-CODE
step as the only way out — the reset view states the code was REPLACED.
The Armoury gains an account panel (username, level + XP progress,
gold, shards, five equipment rows) above the local hall, and a LOG OUT
button when signed in.

**Transitional seams (deliberate, flagged in the M2 report).** (1) Hero
ownership is the UNION of profile heroes and local unlocks when signed
in (profile-owned heroes show "(ACCOUNT)" and select without purchase).
(2) Armoury spending stays LOCAL in M2, for guests and signed-in
players alike — server-side spending is a later phase. (3) Run-end gold
still credits the LOCAL save for signed-in runs until run-result
submission lands; nothing is credited server-side in M2. (4) The
plan's migration import is NOT built (later phase).

**Proof (rig `ab-m2-accounts.mjs`, evidence `rig/ab-m2-accounts.json`).**
Production E2E from the built dist-single via a loopback forwarder
(headless Chromium cannot open external CONNECT tunnels in the rig
sandbox; auth/D1/validation are production — only TCP transport is
forwarded): register `m2_verify_05` through the game's own UI →
recovery code shown → Lv1/zero defaults in Armoury + zero block in a
run → session restored on reload → logout (token cleared) → one
wrong-password attempt rejected with the server's message → login →
reset rotated the recovery code → login with the new password. Stubbed
/profile (forwarder-side only) Lv5 + {Weapon 3, Armour 5, Helm 4,
Boots 10, Charm 3} → block {hp 48, dmg 8, spd 0.79, crit 0.04,
magicDmg 6}, maxHp 148; measured in sim: sword hit exactly 42
(= 34 + 2·3 + floor(4/2)), magic blast exactly 66 (= 60 + 2·3).
Co-op on the v5 stand-in: stub-account host + guest, blocks identical
on both pages, checkpoints 600/1200 agree, 1337+ steps, no desync.

**Live-API divergences from the plan (client codes to the API).** The
plan sketched `/v1/*` paths and profile `economy_version` /
`profile_version` fields; the deployed Worker serves unversioned routes
and no version fields, so PROGRESSION_VERSION / ECONOMY_VERSION are
client constants (= 1) in M2. Validation follows the API (username
3–16, password 8–128), not the plan's 3–20 / 10–128. Recovery codes as
issued are 32 characters.

### Phase M3 — server progression, gated on the API health scope (built 2026-11-14, awaiting Matt's API redeploy)

**The gate.** `serverProgression()` is true only when signed in AND
`/health` reports `scope: 'M3'` (learned by `acctRefreshScope()` at
boot and on every account set). The game ships FIRST: against the live
M1 API everything below is inert and signed-in play is exactly M2,
local crediting included. When Matt redeploys the API and the health
scope flips, the mode switches itself on. There is no client flag.

**Matt's hero rule (2026-11-14).** Accounts own all three identity
heroes (hero / frostarcher / dwarf) from the beginning: the API's
`/profile` returns `stored ∪ {hero, frostarcher, dwarf}` (new
registrations persist the full set), so `hselOwned()` / `profileOwns()`
open the picker with no prices or unlock buttons for accounts.
Guests are unchanged — local-gold unlocks exactly as before. Class
skins keep the M2 seam (profile ∪ local unlocks, local purchase);
that is deliberate and flagged, not a silent redesign.

**Run submission.** A view-layer `RUN` tracker (never in the sim):
the run id is generated at run start — solo locally, in co-op by the
host and shared via the start payload's `runId`, so every participant
submits under the same id to their own account and receives the full
team outcome once. Elite kills are counted in `consumeEvents` from
the sim's kill events for kinds in the registry ELITE_KINDS
(sorcerer/knight — the scheduled-elite kinds). Settlement points in
`syncOverlay`: chapter clear → `POST /runs` stage `chapter-N`;
death/victory → the final stage. In server mode the local save keeps
only records (cleared flags, bests) — gold/XP/shards are credited by
the server from the cumulative counters, and the returned profile
re-renders the chip and Armoury. A failed send keeps the payload in
`RUN.pending`: the Armoury account panel shows a quiet "LAST RUN
COULD NOT BE SAVED" line with a RETRY RUN SAVE button — never a
modal, never blocked play (plan §8: online-only rewards, no
persistent queue).

**Equipment spending.** In server mode the Armoury's five equipment
buttons replace the local legacy track buttons (plan §5: convert,
don't duplicate — the tracks remain for guests and for pre-M3 API
fallback). A click calls `POST /equipment/upgrade` with a fresh
idempotency key; the server derives the price from its stored level
(`upgradeCostFor()` in account.js is display-only), and the returned
profile re-renders the hall.

**Email.** Registration requires an email (client + server
validated). The account panel (landing ACCOUNT button when signed in)
shows the account email and lets a signed-in user add/replace one
(`POST /profile/email`) — the path for pre-email accounts. The reset
view offers both paths: recovery code, and reset-by-email (username +
email → 6-digit code → new password; success rotates the recovery
code and shows it like the code reset). Until the Worker has a
`RESEND_API_KEY` secret the API answers `EMAIL_NOT_CONFIGURED` and
the UI says plainly that email reset isn't switched on yet and to
use the recovery code. Codes are never sent by the game itself.

**Proof.** API suite: 178 assertions against real Wrangler Dev +
local D1 (evidence `aetherblade-api/tests/local-test-output.txt`) —
plan entitlement math incl. the §10 golden run (286 XP / 1,334 G /
4 shards), checkpoint-then-final delta crediting, idempotent
replays, cap rejections, monotonic/stage/party guards, the 30-run
daily cap, exact equipment costs (Weapon 2→3 = 96 G + 1 shard;
Helm 0→10 = 2,440 G + 22 shards), heroes backfill on an M1-shaped
profile, plus the full email section (required/validated email,
duplicate-email 409, add-email, `EMAIL_NOT_CONFIGURED`, and
reset-by-email end to end against a stubbed Resend endpoint:
indistinguishable matched/unmatched responses, single-use, expiry,
5-attempt lockout, request throttling, sessions revoked). Game E2E
(rig `ab-m3-accounts.mjs`, evidence `rig/ab-m3-accounts.json`)
against a LOCAL M3 API through the built dist-single and the game's
own UI: register with email → all 3 heroes open → staged dwarf run
(4 elite kills, boss) → checkpoint + final credited to the cent by
the plan formulas with local gold untouched → Armoury Weapon upgrade
charged by the server → local save wiped, progression identical from
the server alone → email-reset not-configured message → M1-shaped
account adds its email → guest picker still locked. Digests:
`digest:check` unchanged (`b288e3cd…`) — progression lives entirely
outside the sim.

**Still open after M3.** Legacy-save import (the plan's M4) is not
built. The M2 seams that remain: class skins (profile ∪ local) and
local bests/cleared records for signed-in runs.

## 11. Pacing, schedule, anti-trap steering, drake charge (AB-NET-15)

**Pacing is not sim time.** The sim step is always 1/60 game-second
(`FIXED`); combat timers are tick counts and never scale. Two separate
clocks sit on top of it in `src/game.js`:

- `STEP_HZ = 66` / `PACE_DT = 1/66` — wall-clock pacing. Both the solo
  accumulator in `frame()` and the per-session accumulator in
  `netFrame(now, dt)` buy one sim step per `PACE_DT` of elapsed wall
  time, so solo and co-op both run at 66 steps per real second (the
  game plays 10% faster than at 60). The net accumulator's debt is
  capped at 0.25 s: a stalled frame catches up a bounded amount and
  the game can NEVER run faster than the clock. (Pre-fix, `netFrame()`
  stepped as fast as input frames arrived — and `netSample()` refills
  the input runway itself — so co-op ran away to ~165–180 steps/s on
  real phones. The digest harness steps the sim directly and cannot
  see pacing; only an honest-clock rig can. Rig: `ab-pace2.mjs`,
  evidence `rig/ab-pace-{before,after}.json`.)
- `SCHED_DT = 1/66` — the chapter-schedule clock. `waveLeft` and
  `spawnTimer` drain `SCHED_DT` per step, so every schedule threshold
  (boss spawn, 90 s elite events, `map.fill` from-times and ramps,
  spawn cadence) lands at the same REAL second as it did at 60 steps/s:
  the boss spawns at step 11,880 ≈ 180.0 real seconds — chapters are
  still 3:00 of real time. The boss countdown HUD formats `waveLeft`
  (a seconds value), so it reads real seconds with no extra code.
  The M3 client reports `durationSec = floor(tick/60)` (game-seconds):
  a full chapter reports 198 s, above the API's 170 s floor — legit
  chapters still pass.

**Balance (same round).** Elite kinds (`ELITE_KINDS`) plus all 15
heraldic kinds: HP and damage ×1.1 in their content definitions (one
`Math.round` on HP; a kind in both sets would be buffed once — there
is no overlap today). Earth Dwarf `speedMul` 0.9 → 0.81 (effective
base speed 5.58 → 5.022 m/s). Bosses and base kinds untouched.

**Penny aim assist.** `frostarcher` (Penny — NOT the melee `archer`
class skin, which has no ranged attack) carries
`aimAssist: { coneDeg: 20, lead: true }` on her hero descriptor.
`HERO_AIM_ASSIST` is derived in `src/content/heroes/index.js` and
rides `SIM_CONTENT`, so the assist is sim-side and lockstep-safe:
`fireArrow()` aims at the intercept point (target velocity × arrow
travel time, one refinement pass) for the enemy nearest her aim line
inside the cone. Enable it on a future ranged hero by adding the same
block — no code change. Damage, cadence, projectile speed and band
are unchanged. Measured (rig `ab-arrow-lead.mjs`): crossing runners
at band range 0% → 100% hits in the synthetic constant-velocity test;
targets that reverse direction mid-flight now dodge cleanly (33% →
0%); targets outside the cone are still never snapped to.

**Magic FX lifetime (view-only).** Cast effects live ≈1 s: bolt pool
life 1.0 s (strike-in 0.08, hold, fade over the last 40% with a 0.7
power tail), signature rings expand on their old schedule (0.5 s)
then hold and fade to 1.0 s, the Earthquake ring keeps its 0.45 s
expansion then holds/fades to 1.0 s; the cast flash fades over
0.95 s. Constants: `BOLT_LIFE`, `RING_LIFE`/`RING_EXPAND`,
`QUAKE_LIFE`/`QUAKE_EXPAND`. Damage numbers, pickups and slash
crescents are out of scope and unchanged. Digests must not move from
FX work — `digest:check` is the guard.

**Anti-trap steering (f).** Radial steering + positional push-out has
an equilibrium: a chaser aimed at a collider's centre (or squarely at
a fence run) is pushed back exactly as fast as it advances. Enemies
and the boss therefore carry watchdog state in the sim (`stuckT`,
`detourT`, `detourS`, `lastD`, `wantMode`, `watchX/Z` — set in
`makeEnemy` / `spawnBoss`): an entity that intends to close (or flee)
but makes no progress AND barely moves for 40 steps starts a
tangential detour toward the more open side (`pickDetourSide`). A
closing detour persists until the straight path to the target is
clear (`pathClear`) or the enemy is close enough to commit — a timed
burst would expire back into the same equilibrium; a fleeing detour
is a 55-step slide; a detour that itself wedges flips side after 40
stalled steps; hard cap 900 steps. Displacement is measured against
the pre-move snapshot `watchX/Z` (snapshotting post-move at the tail
always reads zero — that bug was caught by the fence rig, not by
inspection). The BOSS additionally ignores fence-kind colliders
outright: fence segment colliders carry `fence: 1` from
`buildMapData`, and `moveWithCollision(s, e, dx, dz, radius, opts)`
honours `opts.skipFence` / `opts.skipAll`; hero and enemy calls pass
no opts, so hero fence collision is exactly as before. Proof (rig
`ab-fence-trap.mjs`): staged fence line — melee enemies 6/6 trapped
→ 0/6, all reach and attack; boss trapped (no hit in 3,600 steps) →
crosses and hits at tick 89; full natural Ch.1 wave audit
(`ab-ch1-audit-f.mjs`): 0 permanently stuck, alive cap 8 and per-kind
caps hold. The known Ch.5 mesa pocket is resolved by this steering
(drake reaches the hero across mesa 2; first hit tick 1,040, and the
natural Ch.5 boss kill now completes) — no Ch.5 map data was changed.

**Drake charge (g).** Both drake descriptors (chapter 1
`emerald-drake`, chapter 5 `caldera-drake`) carry `chargeThru: true`:
while in the `charge` state the drake's `moveWithCollision` call
passes `{skipAll: true}` — it runs a straight line through fences,
mesas and props; the arena clamp still applies. Everything else
about the charge is unchanged (trigger beyond `chargeRange` 6.5 m —
in practice any range where breath doesn't take the slot — 0.7 s
telegraph, 16 m/s, 24 × 1.1 = 26 landed damage, mild homing).
Proof (rig `ab-drake-charge.mjs`): across the Ch.5 mesa the charging
drake previously stopped at the rim (closest centre distance exactly
8.25 m = mesa radius + body radius) and only hit at tick 1,198 after
walking around; now it passes through the mesa centre (0.12 m) and
hits at tick 105 for exactly 26.

**Digest attribution for the round** (baselines re-recorded once, via
`content:baseline`, stamp AB-NET-14 → AB-NET-15; final combined
`42bfc451…`): (a) pacing — no movement (structurally invisible to the
harness; `fresh` unchanged throughout). (b) schedule stretch —
`idle600`, `combat3600`, `combat3600_altSeed`, `coop1200` moved
(`waveLeft`/`spawnTimer` are hashed). (c) balance — `combat3600`
moved again; other scenarios unchanged. (d) aim assist — no scenario
digest moved (no shipped scenario fields a ranged hero); the change
is fingerprinted in the SIM_CONTENT hash. (f) steering —
`combat3600` + `combat3600_altSeed` moved (in-window wedges detour);
`idle600`/`coop1200` unchanged. (g) chargeThru — no scenario digest
moved beyond (f); fingerprinted in SIM_CONTENT. (e) FX — none
(view-only, verified by `digest:check` after the change).

**Known rig debt.** `ab-2p-regression.mjs`'s `guestMagicCast`
sub-criterion fails on AB-NET-14 as well as AB-NET-15 (double-Penny
bot reaches only ~1–6 kills inside the rig's 6,000-step exit; the
meter needs 20). Its checkpoint-agreement, desync and error criteria
pass on both builds and both relay protocols — treat those as the
regression signal until the rig's bot or exit rule is reworked.
`ab-boss-escorts.mjs` takes its "before" census at hard-coded tick
10,799, so on AB-NET-15 its `vanished` column counts kills/replacements
during the extra ~1,080 steps before the 11,880 spawn; the
`escortsAtSpawn` figure (8 on every run) is the persistence signal.

## 12. Form fields vs the game keyboard (AB-NET-15, input fix)

**Bug (Matt, 2026-11-14):** after the account wipe he tried to create
a new account and "some letters" would not type. The global `keydown`
handler `preventDefault()`s every key in `GAME_KEYS` (w/a/s/d, arrows,
space, j/k, shift, p/m/f/g, enter) — originally it exempted only
`#coopInput`, so every account field silently ate those characters:
typing `password` landed `or`, a username lost a/d/f/g/j/k/m/p/s/w in
both cases, an email like `WaSd.JkPmFg@ExAmPlE.cOm` landed `.@ExlE.cO`,
and even a recovery code (`GKS1-…-W2…-J…`) could not be typed back.
The handler's side effects also fired mid-typing (Shift/K latched
rolls, G latched magic, M muted, F fullscreened, Ctrl+A was blocked
too). The M2/M3 account E2Es never saw it: they set values with
`pg.fill()`, which bypasses per-key `keydown` entirely.

**Fix — one central guard** in the keyboard section of `game.js`:
`isFormTarget(e)` (target is INPUT / TEXTAREA / SELECT or
contentEditable) makes the `keydown` handler return before any
preventDefault or game effect, replacing the `#coopInput` special
case (the room-code field is an INPUT, so it is covered by the same
guard; its own Enter-to-join listener is unchanged). The `keyup`
handler is deliberately **unguarded**: it only clears `UI.keys`, and
a movement key released over a field must still stop the hero.

**Proof** (rig `crane/ab-keyboard-input.mjs`, evidence
`rig/ab-keyboard-input-{before,after}.json`) — real
`page.keyboard.type()` into every text field in the game: login /
register / reset / reset-by-email usernames, passwords, emails, the
recovery-code field, the 6-digit mail-code field, the signed-in
account panel's email field, and the co-op room code. Before: every
account field lost exactly the GAME_KEYS characters (itemised in the
evidence) and typing produced 420 handler invocations with 17 roll
and 17 magic latches. After: **18/18 fields return the typed string
byte-for-byte**, zero game side effects while typing, a full
keyboard-typed reset-by-email → new-password → login → email-update
loop completes against a local M3 API, the held-key-across-modal
sequence converges back to neutral input, and in-game keyboard play
(move D/W, attack J, roll K, magic G) is verified working in a live
solo run. Zero page errors. **Digests unchanged** (`42bfc451…`) —
input handling lives outside the sim; no stamp bump.

## 13. Landing compaction for short viewports + the title is now ANSUMBLADE (2026-11-14)

Two player-facing changes in one view-only round (digests unchanged,
stamp stays AB-NET-15), built in an isolated clone because the netcode
fix owned the main one.

**Landing overflow (Matt's phone screenshot).** The landing stack was
designed for two buttons; CO-OP and LOG IN / REGISTER pushed ARMOURY
off the bottom of phone-landscape viewports. Measured before (rig
`crane/ab-layout.mjs`, evidence `rig/ab-layout-{before,after}.json`):
ARMOURY bottom **361.8** in a 360px-tall viewport (1,050 px² overlap
with the WASD hint line) and only **1.6 px** of hint clearance at
640×320 — and real phone serif metrics run taller than the rig's, so
marginal sizes fail on devices too. `--u` cannot absorb it (JS clamps
it to ≥ 0.78), and the landing card's `max-height:96vh` + visible
overflow decentred the spill. Fix, all landing-scoped in `game.css`:
two height tiers (`max-height:430px`, `max-height:345px`) shrink the
emblem (84→64→52 ×u), the title (43→34→28 ×u), rule/button margins and
gaps, and button padding, and uncap the landing card's height so flex
centring is honest again; the modal cards' `max-height` gained `dvh`
lines after the `vh` ones. After: every button inside the viewport at
800×360 / 740×360 / 667×375 / 640×320 with **zero** hint overlap and
46–73 px of bottom clearance; the 1280×720 control's rects are
byte-identical to before, so tall/desktop is untouched. The other
screens were captured at 740×360: account login, hero picker and the
co-op lobby sit fully in view; the register view and the Armoury
scroll inside their cards by design (primary actions reachable).
Note: `#ovBody` (the account status chip) stays `display:none` on the
landing by the landing stylesheet's own design — it is not part of the
visible stack and was left as-is.

**Rename: AETHERBLADE → ANSUMBLADE, player-visible strings only.**
Landing H1 (`syncOverlay`), the VICTORY screen's sub, the co-op
version-mismatch body, the `#rotate` landscape text, and the document
`<title>` (authored in the `scripts/sync-dom.mjs` HEAD template, so
`dom:sync` + `single:build` propagate it). Deliberately NOT renamed,
or every player loses state: the localStorage keys
(`aetherblade-meta-v1`, `aetherblade-session-v1`, `aetherblade-api`,
`aetherblade-relay`), the `aetherblade-api` Worker URL, the co-op
hello payload `game:'aetherblade'`, the room-code namespacing, the
repo/folder names, and code comments. `digest:check` unchanged
(`42bfc451…`) proves no title string lives in hashed content.

## 14. The level-up picker: downed players are skipped, and the sim auto-picks (AB-NET-16)

Matt, 2026-11-14, real 2P game: the party reached LEVEL 2 with the
HOST DOWN; the guest's screen said "The host is choosing for the
party." and the run hung there forever.

Root cause (rig `crane/ab-picker-lock.mjs` mode `repro`, pre-fix
build; evidence `rig/ab-picker-lock-before.json`): the picker was
the lowest-numbered non-REMOVED slot, with no regard for downed
state, and three facts composed the lock — (1) the downed host was
the sole eligible picker; (2) his own caption was the plain solo
text "The arena is paused.", so nothing ever told him he could and
must pick while spectating; (3) the living guest was hard-locked
out — card clicks work on every client, but `netSample` stamps
`upgrade:-1` on every non-picker frame, so her click was silently
discarded. The downed host's tap DID mechanically land when the rig
made it (the run resumed), so this was a role/communication lock,
not a dead input path. No timeout existed anywhere in the chain.

The fix (three parts, all deriving from the same sim state on every
client):

- `netPickerSlot(sess)` now skips players whose sim hero is DOWNED,
  exactly as it already skipped disconnected (removed) slots. If
  every remaining player is downed the run is ending anyway and it
  falls back to the lowest remaining slot. The picker is derived
  LIVE — refreshed in `netSample` (the stamp gate) and in
  `syncOverlay` (the caption) — because downs happen inside sim
  steps with no net event to mirror them on. A derivation caught
  mid-transition can delay a pick a few ticks; frames are the
  shared truth, so it can never desync one.
- Captions are one rule for every party size (the 2P hardcode
  "The host is choosing for the party." is gone): the picker reads
  "You are choosing for the party.", everyone else reads
  "P{n} is choosing for the party." naming the actual picker.
- Safety net in the sim itself: `simStep`'s level-up branch counts
  `s.pickWait` while no pick arrives, and at `RULES.pickTimeoutSteps`
  = 1200 steps (≈20 game-seconds) applies the FIRST offered upgrade
  (`applyUpgrade(s, 0)`). The count lives inside the shared state
  machine, so the auto-pick lands on the same tick on every client.
  Gated to `s.players > 1` — solo is exempt, a lone player may
  think forever. `pickWait` is NOT hashed in `simDigest` (the
  `choices`/`resume` precedent: a pure function of hashed history;
  the applied upgrade itself IS hashed via `s.up`/hero state).

Who picks now: host downed → lowest-numbered LIVING player (the
guest in 2P); guest downed → the host, as before; a disconnected
player's slot stays skipped by the older removal rule; the picker
idle/AFK in any co-op run → the sim auto-picks after 1200 steps.

Digests: NO scenario digest moved (combined stays `42bfc451…`) —
solo scenarios are players===1 so the net never runs there, and the
`coop1200` harness never sends a pick and cannot sit 1200 steps in
the level-up state inside its 1200-step window. The baseline
re-record moved only `build` (AB-NET-15 → AB-NET-16 — sim behaviour
genuinely changes for co-op waits, so old/new builds must refuse to
pair), `simContentSha256` (RULES carries the new constant) and
`sourceSha256`.

Proofs (`crane/ab-picker-lock.mjs` + `ab-picker-timeout-vm.mjs` +
`ab-picker-solo.mjs`; evidence in `rig/ab-picker-lock-*.json`,
`rig/ab-picker-timeout-vm.json`, `rig/ab-picker-solo.json`):
(i) downed host → picker 1 on both pages, captions "P2 is
choosing…" / "You are choosing…", the guest's real mouse click
resumed both pages, checkpoints agree after resume, zero desync;
(ii) nobody picks → the run exits the screen after 1184 observed
steps (1200 bound minus poll lag), exactly one upgrade applied,
checkpoints agree, zero desync — and the VM proof pins the bound
exactly (levelup at wait-step 1199, auto-pick on step 1200, a real
pick on the boundary step wins, solo never auto-picks in 2500
steps); (iii) living host picks as before, captions "You are
choosing…" / "P1 is choosing…"; (iv) `ab-4p-drops.mjs` still
passes (host removal → pickerSlot 1 on the remaining pages);
(v) solo screen + click path unchanged ("The arena is paused.");
(vi) all gates green. Rig note: co-op guests are zero-block by
design in the account era (`guestSnapshot`) — seeded META tracks
do nothing in co-op; the rig fighters are Penny (`frostarcher`)
kiters, the proven N=2 survivors.

---

## 15. Graphics quality — HD/SD toggle (2026-11-14, view-only, NO net stamp)

An external agent proposed a graphics upgrade (clearcoat physical
materials, a PMREM studio environment, real shadows, an HD/SD toggle).
It was audited against the real code first — every cited line was real —
then implemented in CORRECTED form. This section is the record of what
shipped, what was deliberately left out, and why.

**The setting.** `localStorage` key **`ab_gfx`**: `'high'` = HD,
anything else (including absent) = SD. **Default is SD for everyone.**
It is read once, before the renderer exists (`let GFX_HIGH` in the
renderer block), because antialias is a creation-time choice. The HUD
toggle is `#btnGfx` in `#fsRow` (label `HD`/`SD`, `.low` dims it in SD).

**SD is the shipped renderer, exactly.** Lambert materials everywhere,
`shadowMap` never enabled, `scene.environment` never assigned, antialias
off, pixelRatio `min(dpr, 1.25)`, blob shadows under characters. This is
guaranteed by construction, not by discipline: in SD no code path builds
a `MeshPhysicalMaterial`, assigns an environment, or enables shadows —
`MAT()`/`CHARMAT()` fall through to the same Lambert constructors with
the same arguments as before the round, and `ensureStudioEnv()` is never
called. Proof: side-by-side arena captures of this build's SD against
the pre-round build (rig `ab-gfx-arena-sd.png` vs
`ab-gfx-arena-sd-pristine.png`) — same flat palette, same blob shadows;
the pixel diff (MAD 14.0) is camera-lerp/anim phase between two live
stagings, not a rendering difference.

**HD changes, all in the view layer of `src/game.js`:**

- **Materials.** `MAT()` (props) returns `MeshPhysicalMaterial`
  {roughness 0.26, clearcoat 0.35, clearcoatRoughness 0.12};
  `CHARMAT()` (the three rig builders `makeView` / `makeDragonView` /
  `makeKnightMountView`, the heal/potion brick pickups, the arrow pool)
  returns the same class at {roughness 0.24, clearcoat 0.42,
  clearcoatRoughness 0.10} — glossy ABS plastic. The class is chosen
  when a material is BUILT: a live toggle re-skins everything built
  afterwards (new spawns, the next chapter's map meshes, the reopened
  picker); already-built materials follow on next load.
- **Environment.** `ensureStudioEnv()` PMREMs a two-panel procedural
  studio scene (warm top panel, cool rim panel, `0x28364a` backing)
  into `scene.environment` at intensity 0.5. Zero external HDRI files.
  Built lazily — an SD boot never pays for it.
- **Shadows.** `renderer.shadowMap.enabled` + `PCFSoftShadowMap`, sun
  `castShadow`, one 2048 map. The shadow camera is a **±30 m box that
  follows the focus character** (`updateSunFollow()`, called from
  `frame()` after `updateCamera`): the hero-select figure while the
  picker is open, else the local hero, snapped to 0.5 m steps so texels
  don't swim. The sun keeps its exact `(28,46,18)` offset from the
  focus, so the light DIRECTION — and therefore all Lambert shading —
  is identical wherever the rig sits; only the shadow window moves.
  Ground and `inst()` props receive; characters and `inst()` props
  cast — except `MeshBasicMaterial` instances (torch flames, lava
  discs, glow decals), which never cast: a solid shadow from a
  transparent glow disc reads as a scorch mark. **Blob shadows are OFF
  in HD** (`updatePickupMeshes` writes count 0): a blob under a real
  cast shadow double-darkens and hides it.
- **Pixel ratio** `min(dpr, 2)`.

**The toggle handler** persists the choice, then applies live what is
safe mid-run: pixel ratio, `shadowMap.enabled`, `sun.castShadow`, the
environment assignment/intensity, and a **full scene traverse setting
`needsUpdate` on every material** — shadow/env state is compiled into
each material's program, and the external proposal refreshed only
clearcoat materials, which would have left the Lambert ground, water
and crowds in the old state. It never reloads the page. Material class
and antialias follow the saved setting on next load, by design.

**Deliberately NOT done** (the proposal had all of these): ACES
tone mapping and its re-lit hemi/sun/ambient values — every chapter
palette and figure tint was tuned under NoToneMapping Lambert and
brightened in an approved round, so that part was a re-grade, not an
upgrade; `DataTexture`/`RGBAFormat` in the `T` map (nothing used
them); a ±44 m shadow box (too coarse: ~4.3 cm/texel); HD as the
default (the game's 3D direction was approved on a 60 FPS phone gate —
the heavy path is opt-in until a real phone proves it).

**Invariants.** Pure view layer: `digest:check` unchanged
(`42bfc451…`), **no net-stamp bump** — HD is a per-device setting, so
HD and SD players pair freely. `scripts/boot-smoke.mjs` `engineNames`
gained `MeshPhysicalMaterial`, `PMREMGenerator`, `PCFSoftShadowMap`
(the list mirrors the `T` map; the smoke installs those globals).

**Proof** (rigs `crane/ab-gfx-shots.mjs`, `ab-gfx-shots2.mjs`,
`ab-gfx-follow.mjs`, `ab-gfx-followb.mjs`, `ab-gfx-metrics.mjs`,
`ab-gfx-coop.mjs`; captures in `rig/ab-gfx-*.png`, data in
`rig/ab-gfx-{metrics,coop,follow}.json`): frame-matched hero-select
pair — HD shows armour sheen and a figure-shaped cast shadow where SD
shows the blob; arena ring in both modes; shadow-follow pair 44 m
apart (24,18) / (−20,14) with cast shadows under the hero in both;
mixed co-op (host HD, guest SD) through the v6 relay stand-in —
checkpoints 600 + 1200 agree on both pages (`2450880e…` at 1200),
hero HP arrays identical after combat, no desync, zero page errors.
Rig lessons: wall-time waits mis-frame captures (the view clock is
dt-clamped per rendered frame — wait on `__GAME.frames`), and
`netHashes` objects are never stringify-equal across pages (`bySlot`
is keyed by the peer's slot) — compare `lastMine`/`lastTheirs`.

**Performance honesty.** Headless numbers are a RELATIVE signal only:
on the shared 1.5-CPU VM under SwiftShader (CPU rendering), the staged
ring measured SD ≈ 783 ms median frame at 1055×487 vs HD ≈ 4933 ms at
1688×780, draw calls 28 vs 25 — dominated by software rasterisation,
the 2.56× pixel count and contention with parallel work. They say
"HD costs much more GPU-side work", nothing more precise. **The real
verdict is Matt's phone**: if HD holds 60 FPS there, the default can
be revisited; until then SD remains the default.
## 16. Matt's content pack: twin Spiked Ogres, two new enemies, the ANSUM skin (AB-NET-17)

On 2026-11-14 Matt uploaded a content pack built by another agent
(`aetherblade-new-content.zip`: 8 new content files + their versions of
the shared files). The pack was authored against a STALE tree (stamp
AB-NET-10), so the integration rule was: **new content files as-is,
shared files never overwritten** — only the mechanisms the new content
needs were ported onto the current tree. Matt's own overrides beat the
pack README wherever they differ.

**Chapter 4 boss — the Spiked Ogre, TWINS.** The pack shipped one ogre;
Matt ordered two at once in different colours, bigger. The boss
descriptor (`enemies/bosses/spiked-ogre.js`) gains `twinFigure:
'ogre-rust'`: `spawnBoss` fields two instances of the same boss — the
original green hide (`figures/ogre.js`, meshScale 1.55) and a rust
red-brown variant (`figures/ogre-rust.js`, same parts, tint override) —
sweeping in from opposite sides. Consequences in the sim:

- The sim now carries **`s.bosses[]`** (it was a single `s.boss`).
  `s.boss` survives as a compat alias (first living boss) for the
  view/audio/hook readers. The chapter clears only when **every** boss
  is dead; each ogre scores the descriptor's full 2,600 and carries the
  full 520 HP — player-count scaling applies per ogre, so the solo
  fight totals **1,040 HP**. Phase 2 (summon/enrage) and FURY run per
  ogre independently through the shared machinery.
- New signature states, ported from the pack's game.js: **spin**
  (telegraph 0.75 s, 0.55 s whirl, 4.6 m full circle, 30 dmg, cd 6.5 s)
  and **super slam** (telegraph 0.95 s, 5.4 m full circle — no safe
  arc — 38 dmg, cd 9 s), in the approach priority after breath and
  before charge/slam. Their cooldowns and one-shot hit flags ride the
  per-boss digest line, so twin fights stay lockstep-verifiable.
- Telegraphs render as fixed-radius warning rings (`fireWarn` +
  `WARN_POOL`, widened 2 → 4 because two ogres can telegraph at once)
  plus `dustRing()` on the shared particle system.
- The boss HUD aggregates: one bar, summed HP over summed max HP, the
  name gains a `× N` suffix while more than one boss lives, and the
  off-screen arrow tracks the nearest living boss.
- The chapter-4 placeholder (`frost-sovereign.js`, a Grave Sovereign
  re-skin) is retired — this is Matt's own boss now. Chapters 5–6
  placeholders remain.

**Pack bug #1 — fixed here.** Their bug log named it: `syncViews`
built every non-custom boss with a hard-coded `makeView('boss', …)`,
so a standard-rig boss would draw as the generic warlord (the drake
and lancer are custom figures, which masked it). Our tree had the same
line; the boss view loop now builds `makeView(b.fig, b.id)` with the
figure carried on the boss at spawn, and drops a stale view whose kind
no longer matches. The same kind guard was added to the **enemy** view
loop: entity ids restart with a fresh sim (test hooks, co-op resume
replay), and a stale dragon/lancer view (stub bones) under a recycled
id crashed `updateAnim` — measured in the pack rigs, fixed by the same
one-line pattern the hero/boss loops already had.

**Enemies — black-raven and spearman**, stat blocks verbatim from the
pack (the AB-NET-15 ×1.1 elite/heraldic buff does NOT apply — they were
authored fresh). Placement follows the descriptors' fill semantics
through per-chapter overrides: **spearman** (58 HP, reach 3.15 m, cap
4) is global fill from 10 s in every chapter — the early spacing
filler. **Black-raven** (132 HP, 22 dmg, reach 2.80 m, cap 2) is
global from 46 s, **gated out of chapter 1** (`grassland.js` fill
override `from: 9999` — chapter 1 stays Matt's softened opener) and a
**late cameo in chapter 2** (`graveyard-forest.js` override
`from: 120`); chapters 3–6 take it from 46 s. Proof note: a natural
wave deals too few eligible draws to census a ~3%-weight kind (the
director is cap-bound, ~55 post-46 s draws per wave), so placement was
proven by pinned-clock pool censuses — chapter 1 dealt 0 ravens in 217
draws, chapter 2 at 150 s dealt 12, chapter 3 dealt 7 — with the
natural-wave census as supporting evidence (33 spearmen across four
chapter-1 waves; alive caps 4/2 never exceeded).

**ANSUM — a skin, not a hero.** The pack's `heroes/ansum.js` joins the
base hero's skin list (skins ARE hero-registry entries in this
codebase, so HEROES goes 7 → 8; no new identity, stats or playable
character was added). Matt's unlock rule overrides the pack's 500 G
price: the descriptor carries **`accountLevel: 5`** and `price: 0`.
The gate is view-layer and reads the account profile (the source of
truth): signed-in level ≥ 5 selects it in the Armoury like any skin
(label shows `(ACCOUNT LV 5)`); below 5, and for guests, the button is
a lock that explains itself (`🔒 HERO: ANSUM · ACCOUNT LV 5`) and
**`activeSkin()` falls back to the plain hero at every run/roster
entry point**, so a forged or stale local save cannot wear it. Its
signature is the new **`fire`** magic kind: `castMagic` scales the
blast by the caster's `dmgMul` — (60 + magicDmg mods) × 1.6 = **96**
for a plain account, no freeze/knockback — with an orange burst +
ring VFX branch. Co-op rosters carry the skin id in the snapshot, so
a fire cast resolves identically on every client. Proof (rig
`ab-pack-coop.mjs`, two maxed test accounts — in the account era
co-op snapshots zero local tracks, so naked accounts cannot farm
the 20-kill meter at N=2 scaling): across the successful paired
runs, the host's heroId was `ansum` on BOTH pages; a fire cast was
recorded at the same net step (4914) on both pages with all 10
checkpoint hashes cross-agreeing through step 6000
(`lastMine == lastTheirs`), and in a second run a raven-knight lost
exactly 96 HP on both pages at the cast step with the meter ledger
(29 kills, magic 8) balancing only with exactly one 20-point cast.
The bot farm itself is variance-heavy on a throttled VM (several
attempts died or timed out short of 20 kills) — every sync-critical
assertion held in every run that reached a cast; solo fire damage
(exactly 96 × 4 targets) is proven deterministically in
`ab-pack-ansum.mjs`.

**Picker flow fix (measured while integrating).** Armoury-selected
skins could never reach a run: START RUN → the identity picker →
BEGIN RUN unconditionally overwrote `META.heroSkin` with the
highlighted identity (measured: an owned knight skin entered the run
as plain `hero`). That would have made ANSUM — and every class skin —
display-only. The picker now writes the identity only when a card was
actually picked, or an identity is already worn; a plain confirm keeps
the Armoury selection. View/flow only, no sim change.

**Housekeeping from the pack.** `loadMeta()` gained the pack's
one-line guard (`m.hints = m.hints || {}`) for old saves. The pack's
DELETE.txt named `frost-warden.js` — that file never existed in this
tree (their chapter-4 boss); nothing was deleted for it. STATS.md was
regenerated; its generator learned the fire branch, `accountLevel`
unlocks, spin/super attack rows, and the chapter-4 boss file.

**Digests.** Re-recorded once via `content:baseline` on the merged
tree (this round rebased onto AB-NET-16, so the stamp is AB-NET-17;
the picker fix itself had moved no scenario digest). fresh
`83c6cea8…` and idle600 `a3447f9a…` and coop1200 `fc3c8cb2…`
unchanged; combat3600 `1f8cd372…` and altSeed `c7833f01…` moved
(the fill pool gained two kinds and their caps); combined
`faea7271…`. Counts: HEROES 8, FIGURES 33 (+5: ansum, black-raven,
spearman, ogre, ogre-rust), ENEMIES 24, BOSSES 6.
