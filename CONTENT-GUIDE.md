# AETHERBLADE — Content Guide

*How to add heroes, enemies and bosses, piece by piece.*
*Written 2026-11-13 against build AB-NET-2 (solo digest `b0df261292c596f2`). Line numbers drift as the game grows — the function/constant names are the stable anchors; search for those.*

---

## 0. The one thing to understand first

**The game runs from a single runtime file: `src/game.js`.** Everything that
actually plays — stats, spawning, AI, figures, colours — lives there.

`src/content/` (enemies, bosses, palettes, upgrades) is a **registry that
mirrors** that data in tidy per-kind files. The game does **not** read it yet
(phase-1 extraction). So the workflow for any new content is:

1. Add it in `src/game.js` — this makes it real.
2. Mirror it into `src/content/…` — this keeps the registry truthful for the
   next person/agent.
3. Mirror it into the single-file build `lego-revised.html` (the phone
   artefact in `~/workspace/new-arcade-game/`).
4. Run the ship checklist in §5 (digest, net build stamp, deploy).

Files you will **not** normally touch: `src/three.js` (vendored engine),
`src/main.js` (loader), `src/rig/joints.js` / `src/rig/prims.js` (the shared
13-joint skeleton and the 5 primitive shapes every figure is built from),
`index.html` / `src/game.dom.html` / `src/game.css` (shell, DOM, styles —
only for UI work).

---

## 1. Adding a new ENEMY type

Worked example: a melee **lancer**. All edits are in `src/game.js` unless
noted. Pick a kind id — lowercase, one word (`lancer`). It is used as a key
everywhere below.

### 1.1 Stats — `CFG.enemy` (search `enemy: {`)

Add a block next to the existing kinds. Melee kinds use the shared defaults
(`CFG.enemy.telegraph / strikeRange / strikeArcDeg`) unless they override
`reach / arcDeg / tele / recovery / cd` like the soldier and knight do:

```js
lancer:{hp:88, speed:2.50, dmg:16, radius:0.50, score:140,
        reach:2.4, arcDeg:100, tele:0.55, recovery:0.45, cd:0.60},
```

A **ranged** kind instead declares `minRange / maxRange / volley / projSpeed
/ projR` (see ranger/archer/sorcerer). That alone switches the AI: the
movement code (`updateEnemy`, search `cfg.minRange`) kites at band range, and
the strike becomes a projectile. Add `splash:<metres>` for a bolt that
detonates with area damage (sorcerer-style). Add `poise:true` for a wind-up
that hero hits cannot interrupt (knight-style).

*Radius matters:* since 2026-11-13 the hero's hit test uses the enemy **body**
(cone widened by the radius, contact always hittable) — a fat kind is easier
to hit, which is intended.

### 1.2 Spawning — `CFG.caps`, `CFG.wave`, `spawnEnemy`

The director (`spawnEnemy`) fills an arena of at most `CFG.caps.enemies`
(**8, global, all kinds together**). Three things decide whether your kind
ever appears:

- **Cap.** Add `lancers:2` to `CFG.caps` if it needs its own alive cap, or
  give it a `cap` in its wave entry (the fallback for kinds not named in
  `capOf()` inside `spawnEnemy`).
- **Wave entry** in `CFG.wave`: `{from:<seconds into the wave>, cap, w:<fill
  weight>}`. `from` gates its first appearance.
- **The fill pool.** In `spawnEnemy`, the weighted pool is built from
  explicit `addT('kind', weight)` lines — add yours, gated by its `from`
  time like the archer's line. **No `addT` line = it never spawns**, however
  complete everything else is.

For an **elite on a timer** (knight/sorcerer pattern: `w:0, every:<seconds>`
in `CFG.wave`), also add a scheduled-elite block at the top of `spawnEnemy`
next to the knight/sorcerer blocks, with its own `s.<kind>NextAt` clock.

Optional appearances: the 90-second chapter event packs (`CFG.events.pack`,
lists of kind ids per chapter) and the boss's phase-2 summon
(`CFG.boss2.summonKind`).

### 1.3 Drops — `killEnemy`

Automatic for every kind: score from its CFG block, +1 magic meter, one XP
gem, 30% heal-brick chance. **Magic-potion drops are elite-only and the kind
list is hard-coded** in `killEnemy`:

```js
if((e.type==='sorcerer'||e.type==='knight') && rnd(s)<CFG.magic.potionChance)
```

Add your kind there if it should count as an elite.

### 1.4 Colours — `TINTS` (search `const TINTS={`)

One entry per kind: `armor / trim / cloth / skin / blade / dark` as
`[r,g,b]` triples 0–1, plus `glow` for emissive accents. These feed the
vertex colours of the figure. Keep the palette bright (the 2026-11-13 lift)
and keep ground-vs-enemy contrast — Chapter 2 is moonlit, Chapter 3 is dark
at the edges.

### 1.5 Figure — `rigParts(kind)` and the scale table

Figures are LEGO-style bodies assembled from primitives on the shared
13-joint rig. Add a branch:

```js
if(kind==='lancer'){ … }
```

Build from the shared base (`bodyParts(add, c, INK)`) plus kind-specific
parts via `add(joint, prim, offset, size, colour, rotation)` — copy the
soldier branch as the template; prims are `box / sph / cyl / cyl12 / cone`.
Every part must attach to an existing joint so the shared animation clips
pose it.

Then set its size in the mesh-scale table (search `mesh.scale.setScalar(1.65)`):
an unlisted kind renders at scale 1.00.

One more cosmetic hook: ranged kinds should be added to the telegraph-pose
list (search `'cast':'telegraph'` in the view's pose function) so they raise
their weapon to cast instead of using the melee wind-up pose.

### 1.6 Mirror into the registry

Create `src/content/enemies/lancer.js` (copy `soldier.js` — the fully-worked
format: cfg, wave, tint, parts transcription) and register it in
`src/content/enemies/index.js` (`import` + an `ENEMIES` entry). This file is
documentation today, but keep it honest — it is what the next refactor phase
will consume.

### 1.7 Ship it

Follow §5. A new enemy **changes the simulation**, so the net build stamp
must bump and the digest baseline moves.

---

## 2. Adding a new HERO (playable skin)

Heroes are **cosmetic skins**: behaviour and stats come from `CFG.hero` and
the Armoury upgrade tracks, never from the skin. (A hero with its own stats
or abilities is a bigger feature — per-skin stats in hero creation inside
`newSim`; ask for it as its own task.)

1. **Figure.** If the hero reuses an existing kind's figure (the current
   skins reuse soldier/archer/sorcerer/knight), nothing to build. A new look
   needs its own `rigParts` branch + `TINTS` entry, exactly as in §1.5/§1.4.
2. **Price.** Add the kind id to `CFG.meta.heroCosts`
   (`heroCosts:{ soldier:150, archer:200, sorcerer:250, knight:300 }`).
   That single entry is the whole unlock logic: the Armoury builds its
   UNLOCK/USE buttons from `heroCosts`, the display name is the kind id
   upper-cased, and ownership persists in the existing save
   (`localStorage` key `aetherblade-meta-v1` — do not rename it; existing
   players' gold lives there).
3. **Slash alignment.** Add a `SLASH_TIP` entry (`{b:<bone>, o:[x,y,z]}` —
   bone 8 is the right-hand weapon bone for sword/spear/staff, bone 5 the
   left hand for the bow) so the slash edge and trail start at the weapon
   tip. A missing entry falls back to the hero sword tip — playable, but the
   effect will sit slightly off a long weapon.
4. **Co-op.** Nothing else: the skin id travels in the pairing handshake and
   each hero renders with its owner's skin automatically.

Skins do not change the simulation (same stats), so no digest move and no
net-stamp bump **unless** the new figure work touched sim code — when in
doubt, run the digest check in §5 and let it decide.

---

## 3. Adding a BOSS variant

Today all three chapter bosses are **one** sim entry (`CFG.boss` + phase-2
rules in `CFG.boss2`) wearing the `boss` figure, renamed per chapter
(`BOSS_NAMES`). Two levels of "new boss":

- **A new look per chapter (view-only):** add a `rigParts` branch selected
  by chapter index where the boss view is built, plus its `TINTS` entry.
  No sim change, no digest move, no net-stamp bump.
- **A genuinely different boss (own HP/moves):** give `CFG.boss` per-chapter
  overrides where the boss spawns (`spawnBoss` reads `CFG.boss` once) and
  branch the boss AI (`updateBoss`) on chapter or on a `bossKind` field.
  This **is** a sim change — full §5 routine, net stamp bump included.
  Mirror the descriptor into `src/content/enemies/bosses/` either way.

Remember the standing proof rule: a boss change must be verified on the
**natural path** (boss spawns from the 3:00 timer at 26–30 m and walks in),
never by teleporting it next to the hero.

---

## 4. Other growth points (same pattern)

- **New upgrade in the level-up pool:** the `UPGRADES` table in `game.js`
  (id, name, max stacks, apply hook) + mirror in `src/content/upgrades.js`.
  If the upgrade changes the hero/enemy numbers the sim reads, it is a sim
  change (§5 routine).
- **New chapter / palette:** the palettes table in `game.js` (ground, sky,
  fog, lights, prop colours) + the `CHAPTERS` name list, mirrored in
  `src/content/palettes.js`. View-only — but re-check HUD/slash readability
  on the new ground colour.
- **Balance passes:** numbers in `CFG` only. Even a pure numbers change is
  a sim change — digest and net stamp still move (§5).

---

## 5. Ship checklist (every content change)

1. **Syntax + boot:** the page loads with zero console errors; a run starts.
2. **See it spawn:** director audit or a staged spawn proves the new kind
   actually appears (a kind that never spawns is the classic silent failure —
   check the `addT` line), and a natural-path run proves anything
   timer-driven (events at tick 5400, boss at tick 10800).
3. **Determinism:** run the headless digest twice — identical. Compare with
   the previous baseline: unchanged for view-only work; a **new** baseline
   for sim work, recorded in `PLAN.md`.
4. **Net stamp:** if the digest moved, bump `CFG.net.build`
   (`AB-NET-2` → `AB-NET-3`, …) in `game.js` **and** in the single file, so
   old and new builds refuse to pair instead of desyncing mid-run.
5. **Combat invariants:** attack cadence still 31 steps dry / 36 in combat;
   the settled numbers (swing 0.625 s, hit at 0.25 s, range 3.2 m, arc
   130°) unchanged unless the change is deliberately about them.
6. **Mirror:** the same edits land in `lego-revised.html` (single-file
   phone build) — verify its digest equals the project's.
7. **Deploy:** copy the project files into the `deploy-lego/` clone of
   `mattpenny/lego` at repo root, commit, push, then curl the live
   `src/game.js` and compare size/markers.
8. **Record:** dated entry in `PLAN.md` (what changed, new digest, new net
   stamp), and refresh `aetherblade-refactor.zip`.
9. **Phone check is the final word:** desktop/headless proof does not
   replace opening it on a real phone — layout, touch and feel verdicts
   belong to the device.

*Golden rule, learned the hard way on this project: verify through the real
input path and the natural timer path — a passing staged test is not proof.*
