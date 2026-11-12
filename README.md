# AETHERBLADE — 3D Arena Survivor

A single-file browser game: a brick-minifigure knight carving through three chapters of a
procedurally built arena, then a boss. No network requests, no image/audio assets, no build
step required to play — **open `3d_arena_action_combat.html` and press START RUN**.

![The four wave additions](enemy_wave_lineup.png)

## Play

- **Desktop:** WASD / arrows to move · SPACE or J to attack · SHIFT or K to roll · P pause · M mute · F fullscreen
- **Phone / tablet (landscape):** left thumbstick · ATTACK · ROLL. Safe-area insets and a padded
  hit area are handled; pointer, touch and click input paths all work.
- Survive **3:00** per chapter, kill the boss, carry upgrades forward. The 8-alive enemy cap and
  the boss's telegraphed charge/slam are unchanged from the original prototype.

## Enemies

| Unit | Role | HP | Damage | Reach / range | Notes |
|---|---|---|---|---|---|
| Brute | melee filler | 76 | 18 | 1.8 m | 3 sword hits |
| Runner | fast filler | 42 | 10 | 1.8 m | — |
| Ranger | caster | 38 | 13 | 7–11 m | slow purple bolt |
| **Soldier** | melee backbone (from 0 s) | 52 | 14 | **2.2 m** | 2 hits; kettle helm, chainmail, red scarf, spear, small shield |
| **Archer** | fast ranged (from ~30 s) | 34 | 8 | 9–13 m | arrow 14 m/s, 1.5 s volley; hood, quiver, bow |
| **Sorcerer** | elite caster (from ~100 s, max 1) | 60 | 10 | 8.5–13.5 m | 0.95 s charge, bolt lands where you stood, **1.5 m splash** |
| **Knight** | elite melee (from ~130 s, max 1) | 168 | 20 | 2.0 m | **5 sword hits**, uninterruptible 0.95 s wind-up, red heater shield |

All attacks lock facing at wind-up, re-check range and arc at the strike moment, and respect the
roll's i-frames. One global cap of 8 alive covers all seven kinds.

## Rebuild

The HTML is generated from source parts; edit the parts, not the 57k-line output.

```bash
node _build.js            # _shell.html -> 3d_arena_action_combat.html
node _build.js other.html out.html
```

The script resolves every path relative to itself and refuses nothing else — output is
byte-identical to the committed HTML when the sources are unchanged.

| File | What it is |
|---|---|
| `3d_arena_action_combat.html` | **the game** — generated, fully self-contained |
| `_shell.html` | HTML/CSS shell with `/*__CORE__*/` and `/*__GAME__*/` slots |
| `_g1.js` | config, deterministic RNG, map data, upgrades, `newSim` |
| `_g2.js` | simulation: hero, enemies, spawn director, projectiles, boss |
| `_g3.js` | three.js scene, minifig rig + clips, VFX, synthesised audio |
| `_g4.js` | input (touch/pointer/keyboard), HUD, overlays, camera, main loop |
| `_three_core.js` | vendored three.js r170 |
| `_build.js` | assembler |

## Credits / licence

- **three.js r170** — MIT, © 2010-2024 three.js authors. Vendored inline; the `@license`
  banner inside `_three_core.js` and the built HTML **must be kept** (MIT requires retaining
  the notice).
- **Rig, animation clips, minifig geometry, terrain, VFX, music** — authored procedurally in
  this repo (CC0-style, no third-party models/textures/fonts/audio).
- The game's own code has no licence file yet — add one before publishing if you want terms
  (MIT pairs cleanly with the vendored dependency).

QA tooling (`_audit*.js`, `_cdp*.js`) is optional and never needed by the game: it drives
headless Chrome through CDP and hardcodes a Windows Chrome path, so treat it as a reference
harness rather than part of the build.
