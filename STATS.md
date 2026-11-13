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
| Penny | ARCHER | 350 G | Arrow — range 14 m, speed 26 m/s | 27 (base 34 × 0.8) | 6.2 | 3.5 / 1 | Frost Nova — 60 dmg + freeze 1 s (boss 0.5 s) | Ranged arrows · lighter damage | `src/content/heroes/frostarcher.js` |
| Matt | DWARF | 400 G | Melee — range 3.2 m, arc 130° | 43 (base 34 × 1.25) | 5.58 (× 0.9) | 2.8 / 1.3 (descriptor multipliers) | Earthquake — 60 dmg + knockback 6 m (boss 3 m) | Heavy hammer · slower, short roll | `src/content/heroes/dwarf.js` |

Magic basics (every hero): the meter fills **1 per kill**, casting costs **20**, the blast deals **60** damage in a **14 m** radius. Source: `src/content/rules.js · magic`. Per-hero multipliers live in each descriptor's `stats` block; signature effects in its `magic` block.

## Bosses

| Chapter | Boss | HP | Speed (m/s) | Radius (m) | Figure scale | Score | Source |
|---|---|---|---|---|---|---|---|
| 1 | EMERALD DRAKE | 396 | 6 | 1.95 | ×1.3 | 1800 | `src/content/enemies/bosses/emerald-drake.js · cfg` |
| 2 | GRAVE SOVEREIGN | 330 | 7.4 | 1.495 | ×2.145 | 1500 | `src/content/enemies/bosses/shared.js (BOSS_CFG) · cfg` |
| 3 | THE IRON LANCER | 462 | 6.8 | 1.755 | ×1.3 | 2200 | `src/content/enemies/bosses/iron-lancer.js · cfg` |

Boss size: all three figures and sim radii are **×1.3** their original size (radius is the sim body; the figure scale is the matching view size).

### Boss attacks — base → effective (damage multiplier applied once, one rounding)

| Boss | Attack | Base | × dmgMul | Effective | Range / notes | Source field |
|---|---|---|---|---|---|---|
| EMERALD DRAKE | Slam | 26 | ×1.1 | **29** | reach 2.645 m (centre distance), telegraph 0.55 s | `src/content/enemies/bosses/emerald-drake.js · cfg.slamDmg / cfg.slamRange` |
| EMERALD DRAKE | Slam (enraged) | 26 + 4 bonus | ×1.1 | **33** | bonus added BEFORE the multiplier | `cfg.slamDmg` + `bosses/shared.js · BOSS_PHASE2.slamBonus` |
| EMERALD DRAKE | Charge | 24 | ×1.1 | **26** | trigger ≤ 6.5 m, speed 16 m/s, telegraph 0.7 s | `src/content/enemies/bosses/emerald-drake.js · cfg.chargeDmg / cfg.chargeRange` |
| EMERALD DRAKE | Fire breath (per tick) | 9 | ×1.1 | **10** | cone 10.925 m, half-angle 25°, ticks every 0.2 s, telegraph 0.8 s | `src/content/enemies/bosses/emerald-drake.js · cfg.breath.tickDmg` |
| EMERALD DRAKE | Fire breath (full exposure) | — | — | **60** (phase 1, 6 ticks) / **70** (phase 2, 7 ticks) | fires from 3.5–11.5 m, mouth offset (headDist) 3.38 m, breath cooldown 4 s (phase 2: 3 s) | `src/content/enemies/bosses/emerald-drake.js · cfg.breath` |
| GRAVE SOVEREIGN | Slam | 22 | ×1.1 | **24** | reach 2.645 m (centre distance), telegraph 0.55 s | `src/content/enemies/bosses/shared.js (BOSS_CFG) · cfg.slamDmg / cfg.slamRange` |
| GRAVE SOVEREIGN | Slam (enraged) | 22 + 4 bonus | ×1.1 | **29** | bonus added BEFORE the multiplier | `cfg.slamDmg` + `bosses/shared.js · BOSS_PHASE2.slamBonus` |
| GRAVE SOVEREIGN | Charge | 20 | ×1.1 | **22** | trigger ≤ 6.5 m, speed 16 m/s, telegraph 0.7 s | `src/content/enemies/bosses/shared.js (BOSS_CFG) · cfg.chargeDmg / cfg.chargeRange` |
| THE IRON LANCER | Slam | 24 | ×1.1 | **26** | reach 2.645 m (centre distance), telegraph 0.55 s | `src/content/enemies/bosses/iron-lancer.js · cfg.slamDmg / cfg.slamRange` |
| THE IRON LANCER | Slam (enraged) | 24 + 4 bonus | ×1.1 | **31** | bonus added BEFORE the multiplier | `cfg.slamDmg` + `bosses/shared.js · BOSS_PHASE2.slamBonus` |
| THE IRON LANCER | Charge | 26 | ×1.1 | **29** | trigger ≤ 4.5 m, speed 19 m/s, telegraph 0.55 s | `src/content/enemies/bosses/iron-lancer.js · cfg.chargeDmg / cfg.chargeRange` |

### Boss phases (shared by all three bosses)

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
| SORCERER | 60 | 10 | 2.1 | 0.5 | 240 | Ranged — band 8.5–13.5 m, volley every 3.6 s, projectile 7.5 m/s, splash 1.5 m, telegraph 0.95 s | `src/content/enemies/sorcerer.js · cfg` |
| KNIGHT | 168 | 20 | 2.6 | 0.66 | 320 | Melee — reach 2 m, arc 120°, telegraph 0.95 s, recovery 0.6 s, cooldown 0.7 s, poise (windup uninterruptible) | `src/content/enemies/knight.js · cfg` |

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
