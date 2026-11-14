# AETHERBLADE — STATS

> **GENERATED — do not hand-edit.** This sheet is built from the game's own
> content registry by `scripts/build-stats.mjs`. After any balance change,
> regenerate it with one command:
>
>     npm run stats:build
>
> Every row's **Source** column names the content file and field to edit.
> "Effective" values are what the simulation actually deals, computed the
> same way the sim computes them (multiplier applied, one Math.round).

## Heroes

Base hero (all heroes share these unless a descriptor overrides them): damage **34**, speed **6.2 m/s**, roll **3.5 m** every **1 s**, sword range **3.2 m** / arc **130°**. Source: `src/content/rules.js · hero`.

| Hero | Role | Unlock | Attack | Damage / hit (effective) | Speed (m/s) | Roll (m / cd s) | Magic | Trait | Source |
|---|---|---|---|---|---|---|---|---|---|
| Ansum | KNIGHT | default (free) | Melee — range 3.2 m, arc 130° | 34 | 6.2 | 3.5 / 1 | Arcane Blast — 60 dmg, 14 m radius, 20 kills | Balanced sword & shield | `src/content/heroes/hero.js` |
| SOLDIER | — | 150 G | Melee — range 3.2 m, arc 130° | 34 | 6.2 | 3.5 / 1 | Arcane Blast — 60 dmg, 14 m radius, 20 kills | — | `src/content/heroes/soldier.js` |
| ARCHER | — | 200 G | Melee — range 3.2 m, arc 130° | 34 | 6.2 | 3.5 / 1 | Arcane Blast — 60 dmg, 14 m radius, 20 kills | — | `src/content/heroes/archer.js` |
| SORCERER | — | 250 G | Melee — range 3.2 m, arc 130° | 34 | 6.2 | 3.5 / 1 | Arcane Blast — 60 dmg, 14 m radius, 20 kills | — | `src/content/heroes/sorcerer.js` |
| KNIGHT | — | 300 G | Melee — range 3.2 m, arc 130° | 34 | 6.2 | 3.5 / 1 | Arcane Blast — 60 dmg, 14 m radius, 20 kills | — | `src/content/heroes/knight.js` |
| Penny | ARCHER | 350 G | Arrow — range 14 m, speed 26 m/s; aim assist — 20° cone + target lead (intercept) | 27 (base 34 × 0.8) | 6.2 | 3.5 / 1 | Frost Nova — 60 dmg + freeze 1 s (boss 0.5 s) | Ranged arrows · lighter damage | `src/content/heroes/frostarcher.js` |
| Matt | DWARF | 400 G | Melee — range 3.2 m, arc 130° | 43 (base 34 × 1.25) | 5.022 (× 0.81) | 2.8 / 1.3 (descriptor multipliers) | Earthquake — 60 dmg + knockback 6 m (boss 3 m) | Heavy hammer · slower, short roll | `src/content/heroes/dwarf.js` |
| ANSUM | — | Account Lv 5 | Melee — range 3.2 m, arc 130° | 34 | 6.2 | 3.5 / 1 | Fire Crescent — 96 dmg (60 × 1.6), no control or knockback | — | `src/content/heroes/ansum.js` |

Magic basics (every hero): the meter fills **1 per kill**, casting costs **20**, the blast deals **60** damage in a **14 m** radius. Source: `src/content/rules.js · magic`. Per-hero multipliers live in each descriptor's `stats` block; signature effects in its `magic` block.

## Bosses

| Chapter | Boss | HP | Speed (m/s) | Radius (m) | Figure scale | Score | Source |
|---|---|---|---|---|---|---|---|
| 1 | EMERALD DRAKE | 396 | 6 | 1.95 | ×1.3 | 1800 | `src/content/enemies/bosses/emerald-drake.js · cfg` |
| 2 | GRAVE SOVEREIGN | 330 | 7.4 | 1.495 | ×2.475 | 1500 | `src/content/enemies/bosses/shared.js (BOSS_CFG) · cfg` |
| 3 | THE IRON LANCER | 462 | 6.8 | 1.755 | ×1.5 | 2200 | `src/content/enemies/bosses/iron-lancer.js · cfg` |
| 4 | THE SPIKED OGRE | 520 | 5.6 | 1.45 | ×1.55 | 2600 | `src/content/enemies/bosses/spiked-ogre.js · cfg` |
| 5 | EMERALD DRAKE (PLACEHOLDER) | 580 | 6 | 1.95 | ×1.3 | 1800 | `src/content/enemies/bosses/caldera-drake.js · cfg` |
| 6 | THE IRON LANCER (PLACEHOLDER) | 640 | 6.8 | 1.755 | ×1.5 | 2200 | `src/content/enemies/bosses/siege-lancer.js · cfg` |

Boss size: boss figures sit at **×1.5** their original size (radius is the sim body; the figure scale is the matching view size) — Matt's all-bosses-bigger call (AB-NET-19). Two exceptions: the Emerald Drake (chapters 1 and 5) keeps **×1.3** — Matt exempted the dragon — and chapter 4's Spiked Ogre sits at **×1.55**, Matt's bigger-boss call (AB-NET-17). Chapter 4 is Matt's own boss design and fields **TWO** ogres at once (`twinFigure` — the chapter clears only when both are dead; each carries the full HP and score above, so the solo fight totals 1,040 HP). Chapters 5-6 bosses remain PLACEHOLDERS (earlier bosses reappearing with late-game HP) pending Matt's own boss creations.

### Boss attacks — base → effective (damage multiplier applied once, one rounding)

| Boss | Attack | Base | × dmgMul | Effective | Range / notes | Source field |
|---|---|---|---|---|---|---|
| EMERALD DRAKE | Slam | 26 | ×1.1 | **29** | reach 2.645 m (centre distance), telegraph 0.55 s | `src/content/enemies/bosses/emerald-drake.js · cfg.slamDmg / cfg.slamRange` |
| EMERALD DRAKE | Slam (enraged) | 26 + 4 bonus | ×1.1 | **33** | bonus added BEFORE the multiplier | `cfg.slamDmg` + `bosses/shared.js · BOSS_PHASE2.slamBonus` |
| EMERALD DRAKE | Charge | 24 | ×1.1 | **26** | trigger ≤ 6.5 m, speed 16 m/s, telegraph 0.7 s; ignores ALL prop/theme colliders while charging (arena edge still applies) | `src/content/enemies/bosses/emerald-drake.js · cfg.chargeDmg / cfg.chargeRange` |
| EMERALD DRAKE | Fire breath (per tick) | 9 | ×1.1 | **10** | cone 10.925 m, half-angle 25°, ticks every 0.2 s, telegraph 0.8 s | `src/content/enemies/bosses/emerald-drake.js · cfg.breath.tickDmg` |
| EMERALD DRAKE | Fire breath (full exposure) | — | — | **60** (phase 1, 6 ticks) / **70** (phase 2, 7 ticks) | fires from 3.5–11.5 m, mouth offset (headDist) 3.38 m, breath cooldown 4 s (phase 2: 3 s) | `src/content/enemies/bosses/emerald-drake.js · cfg.breath` |
| GRAVE SOVEREIGN | Slam | 22 | ×1.1 | **24** | reach 2.645 m (centre distance), telegraph 0.55 s | `src/content/enemies/bosses/shared.js (BOSS_CFG) · cfg.slamDmg / cfg.slamRange` |
| GRAVE SOVEREIGN | Slam (enraged) | 22 + 4 bonus | ×1.1 | **29** | bonus added BEFORE the multiplier | `cfg.slamDmg` + `bosses/shared.js · BOSS_PHASE2.slamBonus` |
| GRAVE SOVEREIGN | Charge | 20 | ×1.1 | **22** | trigger ≤ 6.5 m, speed 16 m/s, telegraph 0.7 s | `src/content/enemies/bosses/shared.js (BOSS_CFG) · cfg.chargeDmg / cfg.chargeRange` |
| THE IRON LANCER | Slam | 24 | ×1.1 | **26** | reach 2.645 m (centre distance), telegraph 0.55 s | `src/content/enemies/bosses/iron-lancer.js · cfg.slamDmg / cfg.slamRange` |
| THE IRON LANCER | Slam (enraged) | 24 + 4 bonus | ×1.1 | **31** | bonus added BEFORE the multiplier | `cfg.slamDmg` + `bosses/shared.js · BOSS_PHASE2.slamBonus` |
| THE IRON LANCER | Charge | 26 | ×1.1 | **29** | trigger ≤ 4.5 m, speed 19 m/s, telegraph 0.55 s | `src/content/enemies/bosses/iron-lancer.js · cfg.chargeDmg / cfg.chargeRange` |
| THE SPIKED OGRE | Slam | 26 | ×1 | **26** | reach 2.6 m (centre distance), telegraph 0.6 s | `src/content/enemies/bosses/spiked-ogre.js · cfg.slamDmg / cfg.slamRange` |
| THE SPIKED OGRE | Slam (enraged) | 26 + 4 bonus | ×1 | **30** | bonus added BEFORE the multiplier | `cfg.slamDmg` + `bosses/shared.js · BOSS_PHASE2.slamBonus` |
| THE SPIKED OGRE | Charge | 24 | ×1 | **24** | trigger ≤ 8 m, speed 14 m/s, telegraph 0.8 s | `src/content/enemies/bosses/spiked-ogre.js · cfg.chargeDmg / cfg.chargeRange` |
| THE SPIKED OGRE | Whirlwind spin | 30 | ×1 | **30** | full circle, range 4.6 m, telegraph 0.75 s, duration 0.55 s, cooldown 6.5 s | `src/content/enemies/bosses/spiked-ogre.js · cfg.spinDmg / cfg.spinRange` |
| THE SPIKED OGRE | Super slam | 38 | ×1 | **38** | full circle (no safe arc), range 5.4 m, telegraph 0.95 s, duration 0.45 s, cooldown 9 s | `src/content/enemies/bosses/spiked-ogre.js · cfg.superDmg / cfg.superRange` |
| EMERALD DRAKE | Slam | 26 | ×1.1 | **29** | reach 2.645 m (centre distance), telegraph 0.55 s | `src/content/enemies/bosses/caldera-drake.js · cfg.slamDmg / cfg.slamRange` |
| EMERALD DRAKE | Slam (enraged) | 26 + 4 bonus | ×1.1 | **33** | bonus added BEFORE the multiplier | `cfg.slamDmg` + `bosses/shared.js · BOSS_PHASE2.slamBonus` |
| EMERALD DRAKE | Charge | 24 | ×1.1 | **26** | trigger ≤ 6.5 m, speed 16 m/s, telegraph 0.7 s; ignores ALL prop/theme colliders while charging (arena edge still applies) | `src/content/enemies/bosses/caldera-drake.js · cfg.chargeDmg / cfg.chargeRange` |
| EMERALD DRAKE | Fire breath (per tick) | 9 | ×1.1 | **10** | cone 10.925 m, half-angle 25°, ticks every 0.2 s, telegraph 0.8 s | `src/content/enemies/bosses/caldera-drake.js · cfg.breath.tickDmg` |
| EMERALD DRAKE | Fire breath (full exposure) | — | — | **60** (phase 1, 6 ticks) / **70** (phase 2, 7 ticks) | fires from 3.5–11.5 m, mouth offset (headDist) 3.38 m, breath cooldown 4 s (phase 2: 3 s) | `src/content/enemies/bosses/caldera-drake.js · cfg.breath` |
| THE IRON LANCER | Slam | 24 | ×1.1 | **26** | reach 2.645 m (centre distance), telegraph 0.55 s | `src/content/enemies/bosses/siege-lancer.js · cfg.slamDmg / cfg.slamRange` |
| THE IRON LANCER | Slam (enraged) | 24 + 4 bonus | ×1.1 | **31** | bonus added BEFORE the multiplier | `cfg.slamDmg` + `bosses/shared.js · BOSS_PHASE2.slamBonus` |
| THE IRON LANCER | Charge | 26 | ×1.1 | **29** | trigger ≤ 4.5 m, speed 19 m/s, telegraph 0.55 s | `src/content/enemies/bosses/siege-lancer.js · cfg.chargeDmg / cfg.chargeRange` |

### Boss phases (shared by all bosses)

| Phase | Triggers at | Effect | Source |
|---|---|---|---|
| Summon | HP ≤ 50% | calls 2 × soldier adds, once | `src/content/enemies/bosses/shared.js · BOSS_PHASE2` |
| Enrage | HP ≤ 30% | approach speed ×1.15; slam +4 (before the damage multiplier) | `src/content/enemies/bosses/shared.js · BOSS_PHASE2` |
| Fury | HP ≤ 15% | approach speed ×1.15 MORE (×1.3225 total with enrage); attack tempo ×1.15 — cooldowns and telegraphs that START in fury are divided by 1.15; timers already running keep their duration; breath tick rate/duration unchanged | `src/content/enemies/bosses/shared.js · BOSS_PHASE2.fury` |

## Enemies

Shared melee defaults: telegraph 0.55 s, strike range 1.8 m, arc 120°, recovery 0.5 s (a kind's own `tele/recovery/cd/reach` overrides). Every kill drops **1 XP** (one gem, +10 score). Sources: `src/content/enemies/shared.js · MELEE_DEFAULTS`, `src/content/items/gem.js`.

| Enemy | HP | Damage | Speed (m/s) | Radius (m) | Score | Attack | Source |
|---|---|---|---|---|---|---|---|
| BRUTE | 76 | 18 | 2.35 | 0.62 | 120 | Melee — reach 1.8 m, arc 120°, telegraph 0.55 s, recovery 0.5 s | `src/content/enemies/brute.js · cfg` |
| RUNNER | 42 | 10 | 4.65 | 0.4 | 100 | Melee — reach 1.8 m, arc 120°, telegraph 0.55 s, recovery 0.5 s | `src/content/enemies/runner.js · cfg` |
| RANGER | 38 | 13 | 3.25 | 0.42 | 160 | Ranged — band 7–11 m, volley every 2.3 s, projectile 10.5 m/s | `src/content/enemies/ranger.js · cfg` |
| SOLDIER | 52 | 14 | 2.15 | 0.46 | 110 | Melee — reach 2.2 m, arc 110°, telegraph 0.5 s, recovery 0.42 s, cooldown 0.55 s | `src/content/enemies/soldier.js · cfg` |
| ARCHER | 34 | 8 | 3.55 | 0.4 | 150 | Ranged — band 9–13 m, volley every 1.5 s, projectile 14 m/s, telegraph 0.42 s | `src/content/enemies/archer.js · cfg` |
| SORCERER | 66 | 11 | 2.1 | 0.5 | 240 | Ranged — band 8.5–13.5 m, volley every 3.6 s, projectile 7.5 m/s, splash 1.5 m, telegraph 0.95 s | `src/content/enemies/sorcerer.js · cfg` |
| KNIGHT | 185 | 22 | 2.6 | 0.66 | 320 | Melee — reach 2 m, arc 120°, telegraph 0.95 s, recovery 0.6 s, cooldown 0.7 s, poise (windup uninterruptible) | `src/content/enemies/knight.js · cfg` |
| RAVEN-KNIGHT | 86 | 17 | 2.55 | 0.5 | 170 | Melee — reach 2.25 m, arc 105°, telegraph 0.55 s, recovery 0.44 s, cooldown 0.58 s | `src/content/enemies/raven-knight.js · cfg` |
| EAGLE-KNIGHT | 92 | 18 | 2.5 | 0.52 | 180 | Melee — reach 2.3 m, arc 110°, telegraph 0.58 s, recovery 0.45 s, cooldown 0.6 s | `src/content/enemies/eagle-knight.js · cfg` |
| CRIMSON-KNIGHT | 106 | 19 | 2.4 | 0.54 | 200 | Melee — reach 2.3 m, arc 115°, telegraph 0.62 s, recovery 0.48 s, cooldown 0.62 s | `src/content/enemies/crimson-knight.js · cfg` |
| AXE-KNIGHT | 114 | 21 | 2.3 | 0.56 | 210 | Melee — reach 2.5 m, arc 120°, telegraph 0.7 s, recovery 0.52 s, cooldown 0.68 s | `src/content/enemies/axe-knight.js · cfg` |
| SUN-KNIGHT | 97 | 17 | 2.65 | 0.5 | 190 | Melee — reach 2.2 m, arc 100°, telegraph 0.52 s, recovery 0.42 s, cooldown 0.55 s | `src/content/enemies/sun-knight.js · cfg` |
| AZURE-KNIGHT | 99 | 18 | 2.55 | 0.52 | 195 | Melee — reach 2.35 m, arc 110°, telegraph 0.58 s, recovery 0.45 s, cooldown 0.6 s | `src/content/enemies/azure-knight.js · cfg` |
| OBSIDIAN-KNIGHT | 130 | 21 | 2.35 | 0.58 | 235 | Melee — reach 2.4 m, arc 120°, telegraph 0.72 s, recovery 0.52 s, cooldown 0.66 s | `src/content/enemies/obsidian-knight.js · cfg` |
| UNICORN-KNIGHT | 101 | 17 | 2.8 | 0.5 | 200 | Melee — reach 2.2 m, arc 100°, telegraph 0.5 s, recovery 0.42 s, cooldown 0.55 s | `src/content/enemies/unicorn-knight.js · cfg` |
| LION-KNIGHT | 119 | 20 | 2.45 | 0.55 | 220 | Melee — reach 2.4 m, arc 115°, telegraph 0.65 s, recovery 0.5 s, cooldown 0.64 s | `src/content/enemies/lion-knight.js · cfg` |
| KRAKEN-KNIGHT | 110 | 19 | 2.5 | 0.54 | 215 | Melee — reach 2.35 m, arc 112°, telegraph 0.62 s, recovery 0.48 s, cooldown 0.62 s | `src/content/enemies/kraken-knight.js · cfg` |
| TOWER-KNIGHT | 139 | 22 | 2.2 | 0.6 | 250 | Melee — reach 2.3 m, arc 120°, telegraph 0.78 s, recovery 0.55 s, cooldown 0.7 s | `src/content/enemies/tower-knight.js · cfg` |
| DRAGON-KNIGHT | 152 | 23 | 2.3 | 0.6 | 270 | Melee — reach 2.5 m, arc 120°, telegraph 0.8 s, recovery 0.56 s, cooldown 0.72 s, poise (windup uninterruptible) | `src/content/enemies/dragon-knight.js · cfg` |
| CROSSBOWMAN | 53 | 13 | 2.8 | 0.44 | 175 | Ranged — band 7.5–11.5 m, volley every 2.6 s, projectile 16 m/s, telegraph 0.6 s | `src/content/enemies/crossbowman.js · cfg` |
| RUSSET-ARCHER | 40 | 10 | 3.6 | 0.4 | 155 | Ranged — band 8.5–12.5 m, volley every 1.7 s, projectile 13.5 m/s, telegraph 0.44 s | `src/content/enemies/russet-archer.js · cfg` |
| TEAL-ARCHER | 46 | 11 | 3.35 | 0.41 | 165 | Ranged — band 8–12 m, volley every 2 s, projectile 12.5 m/s, telegraph 0.48 s | `src/content/enemies/teal-archer.js · cfg` |
| BLACK-RAVEN | 132 | 22 | 2.8 | 0.52 | 260 | Melee — reach 2.8 m, arc 130°, telegraph 0.6 s, recovery 0.5 s, cooldown 0.7 s | `src/content/enemies/black-raven.js · cfg` |
| SPEARMAN | 58 | 12 | 2.35 | 0.44 | 130 | Melee — reach 3.15 m, arc 42°, telegraph 0.46 s, recovery 0.36 s, cooldown 0.64 s | `src/content/enemies/spearman.js · cfg` |

## Items & pickups

| Item | Effect | Drop rule | Source |
|---|---|---|---|
| XP GEM | +1 XP, +10 score | every enemy kill | `src/content/items/gem.js · sim` |
| HEAL BRICK | restores 20 HP | 30% chance per kill | `src/content/items/heal.js · sim` |
| MAGIC POTION | +10 magic meter | 25% chance per kill — ELITE kills only (sorcerer, knight) | `src/content/items/potion.js · sim` |

Level-up curve: XP needed for the next level = 8 + 6 × (level − 1) gems. Source: `src/content/items/gem.js · notes` / sim level rule.

## Upgrades — level-up picks (choose 1 of 3)

Each pick applies its effect once; picks stack with no per-upgrade cap in the data.

| Upgrade | Effect per pick | Source |
|---|---|---|
| IRON HIDE | +25 max HP and heal 25. | `src/content/upgrades/hide.js` |
| HONED EDGE | +20% sword damage. | `src/content/upgrades/edge.js` |
| QUICK TEMPO | -12% attack cooldown. | `src/content/upgrades/tempo.js` |
| LONG REACH | +0.5 m range, +10° arc. | `src/content/upgrades/reach.js` |
| SWIFT BOOTS | +8% move speed. | `src/content/upgrades/boots.js` |
| REFLEXES | -20% roll cooldown. | `src/content/upgrades/reflex.js` |
| GEM MAGNET | +0.9 m pickup radius. | `src/content/upgrades/magnet.js` |
| KEEN EYE | +15% critical chance. | `src/content/upgrades/crit.js` |
| BLOOD SIPHON | Heal 3 HP on every kill. | `src/content/upgrades/siphon.js` |

## Meta tracks — permanent (Armoury, bought with gold)

Cost per level (all tracks): **40 / 80 / 140 / 220 / 320 G** for levels 1–5. Gold also: +50 G per chapter clear, +200 G victory bonus, run score ÷ 10. Source: `src/content/rules.js · meta`.

| Track | Per level | Max total | Source |
|---|---|---|---|
| ARMOUR HP | +8 max HP | +40 max HP | `src/content/rules.js · meta.tracks` |
| EDGE DMG | +2 damage | +10 damage | `src/content/rules.js · meta.tracks` |
| BOOTS SPD | +0.15 move speed | +0.75 move speed | `src/content/rules.js · meta.tracks` |

Hero unlock costs are in the Heroes table above (Source: each descriptor's `price`, mirrored in `src/content/rules.js`-derived hero costs).

## Multiplayer scaling — player-count difficulty (co-op)

Co-op runs scale with the roster size **N locked at run start** (a mid-run departure does not rescale). One HP rule covers regular enemies AND bosses:

> **HP multiplier = N × (1 + 0.1 × (N−1))** — each extra player adds their full share plus 10%, because more players land proportionally more hits per second (focus fire, N magic meters, N interrupts). Applied once at spawn: `Math.round(base HP × hpMul)`.
>
> **Damage** dealt TO heroes grows gently instead (+10% per extra player — incoming damage lands per-hero while outgoing damage is pooled): one extra `Math.round` at each damage application, on top of the existing per-source rounding (boss `dmgMul` first, phase-2 slam bonus added before both). The **alive cap** widens at N=3/4 so four heroes do not face an emptier field. Nothing else scales (speeds, ranges, telegraphs, %-based phase thresholds, XP, drops).

| Players (N) | Enemy + boss HP | Damage to heroes | Alive cap | Brute HP (base 76) | Emerald Drake HP (base 396) | Source |
|---|---|---|---|---|---|---|
| 1 | ×1 | ×1 | 8 | 76 | 396 | `src/content/rules.js · playerScaling[1]` |
| 2 | ×2.2 | ×1.1 | 8 | 167 | 871 | `src/content/rules.js · playerScaling[2]` |
| 3 | ×3.6 | ×1.2 | 10 | 274 | 1426 | `src/content/rules.js · playerScaling[3]` |
| 4 | ×5.2 | ×1.3 | 12 | 395 | 2059 | `src/content/rules.js · playerScaling[4]` |

Tune the proportions in `src/content/rules.js · playerScaling` — this table is generated from that single source. The N=1 row is exactly the solo game (all ×1.0, cap 8).

## Chapter fill composition — per-chapter pool overrides

The weighted fill pool is global (each kind's `fill {from, weight, ramp}` in its enemy descriptor), except where a map descriptor carries `map.fill` overrides — `{from, weight, ramp}` replace the global entry **in that chapter only** (same kinds, same pool order, same per-kind caps, same global alive cap, same spawn interval). Chapters without overrides use the global pool unchanged.

### Chapter 1 — GRASSLAND (overrides)

| Enemy | Global from (s) / weight / ramp | This chapter from (s) / weight / ramp | Source |
|---|---|---|---|
| SOLDIER | 0 / 34 / 0 | **0 / 34 / -0.02** | `src/content/maps/grassland.js · map.fill` |
| BRUTE | 0 / 26 / 0 | **0 / 26 / -0.03** | `src/content/maps/grassland.js · map.fill` |
| RUNNER | 0 / 22 / 0 | **0 / 22 / -0.03** | `src/content/maps/grassland.js · map.fill` |
| RAVEN-KNIGHT | 18 / 10 / 0 | **18 / 16 / -0.06** | `src/content/maps/grassland.js · map.fill` |
| EAGLE-KNIGHT | 24 / 10 / 0 | **52 / 30 / -0.06** | `src/content/maps/grassland.js · map.fill` |
| CRIMSON-KNIGHT | 32 / 9 / 0 | **82 / 40 / -0.04** | `src/content/maps/grassland.js · map.fill` |
| AXE-KNIGHT | 38 / 9 / 0 | **100 / 56 / 0** | `src/content/maps/grassland.js · map.fill` |
| SUN-KNIGHT | 45 / 8 / 0 | **64 / 26 / -0.05** | `src/content/maps/grassland.js · map.fill` |
| AZURE-KNIGHT | 52 / 9 / 0 | **72 / 30 / -0.05** | `src/content/maps/grassland.js · map.fill` |
| OBSIDIAN-KNIGHT | 60 / 8 / 0 | **108 / 34 / 0** | `src/content/maps/grassland.js · map.fill` |
| UNICORN-KNIGHT | 68 / 8 / 0 | **116 / 56 / 0** | `src/content/maps/grassland.js · map.fill` |
| LION-KNIGHT | 76 / 9 / 0 | **124 / 48 / 0** | `src/content/maps/grassland.js · map.fill` |
| KRAKEN-KNIGHT | 84 / 8 / 0 | **132 / 80 / 0** | `src/content/maps/grassland.js · map.fill` |
| TOWER-KNIGHT | 92 / 8 / 0 | **150 / 200 / 0** | `src/content/maps/grassland.js · map.fill` |
| DRAGON-KNIGHT | 105 / 7 / 0 | **158 / 160 / 0** | `src/content/maps/grassland.js · map.fill` |
| CROSSBOWMAN | 22 / 11 / 0 | **22 / 14 / -0.05** | `src/content/maps/grassland.js · map.fill` |
| RUSSET-ARCHER | 28 / 11 / 0 | **28 / 14 / -0.05** | `src/content/maps/grassland.js · map.fill` |
| TEAL-ARCHER | 40 / 10 / 0 | **58 / 28 / -0.06** | `src/content/maps/grassland.js · map.fill` |
| BLACK-RAVEN | 46 / 8 / 0 | **9999 / 8 / 0** | `src/content/maps/grassland.js · map.fill` |

### Chapter 2 — GRAVEYARD FOREST (overrides)

| Enemy | Global from (s) / weight / ramp | This chapter from (s) / weight / ramp | Source |
|---|---|---|---|
| BLACK-RAVEN | 46 / 8 / 0 | **120 / 8 / 0** | `src/content/maps/graveyard-forest.js · map.fill` |

## Account progression — the server profile stat block (M2/M3)

Rendered from `src/account.js · ACCOUNT_GAINS` (the same table the client derivation runs). Composition (plan §6): the in-run upgrade curves multiply the hero-multiplied content base, and this permanent block is added LAST (`damage = round(34 × heroDmgMul) × 1.20^Edge + P.dmg`, likewise speed; max HP adds P.hp; P.crit joins the base 5% crit chance before the Keen Eye curve; P.magicDmg adds to the 60-damage magic blast): `P.hp = 2·(L−1) + 8·Armour`, `P.dmg = floor((L−1)/2) + 2·Weapon`, `P.spd = 0.01·(L−1) + 0.075·Boots`, `P.crit = 1%·Helm`, `P.magicDmg = 2·Charm`. At level 1 with all equipment 0 the block is exactly zero — bit-identical to the pre-account game. Guests use the legacy local tracks; signed-in play uses this block, and in server (M3) mode the local tracks no longer apply to the account at all.

Progression version **1** · economy version **1** · account level cap **30** · level gains: +2 HP per level, +1 damage per 2 levels, +0.01 speed per level.

| Equipment slot | Per level | Source |
|---|---|---|
| WEAPON | +2 damage | `src/account.js · ACCOUNT_GAINS` |
| ARMOUR | +8 max HP | `src/account.js · ACCOUNT_GAINS` |
| HELM | +0.01 crit chance | `src/account.js · ACCOUNT_GAINS` |
| BOOTS | +0.075 move speed | `src/account.js · ACCOUNT_GAINS` |
| CHARM | +2 magic damage | `src/account.js · ACCOUNT_GAINS` |

Server economy (M3, economy version 1 — the Worker recomputes everything from submitted counters; the client only displays). Run entitlement: `gold = floor(score/10) + 50 × chaptersCleared + 200 × victory`, `account XP = floor(score/50) + 20 × chaptersCleared + 40 × victory`, `Aether Shards = chaptersCleared + 2 × victory + min(3, floor(eliteKills/8))` (elites = the registry ELITE_KINDS). Chapter checkpoints credit immediately during the run; the final submission credits only the uncredited difference, and replays never double-credit. Signed-in accounts own all three identity heroes (Lion Knight, Frost Archer, Earth Dwarf) from the start; in server mode the equipment buttons below replace the local legacy tracks in the Armoury.

| Upgrade to level | Gold | Aether Shards |
|---|---|---|
| 1 | 40 | 1 |
| 2 | 64 | 1 |
| 3 | 96 | 1 |
| 4 | 136 | 2 |
| 5 | 184 | 2 |
| 6 | 240 | 2 |
| 7 | 304 | 3 |
| 8 | 376 | 3 |
| 9 | 456 | 3 |
| 10 | 544 | 4 |

One slot from 0 to 10 costs **2,440 G + 22 Aether Shards**; all five slots **12,200 G + 110**. The server derives the price from its stored level — the request names only the slot.
