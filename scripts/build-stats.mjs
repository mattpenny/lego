#!/usr/bin/env node
/* =====================================================================
   build-stats.mjs — generates STATS.md, the human-readable data sheet
   of every balance number in the game, straight from the content
   registry (src/content/index.js). The sheet can never drift from the
   game: regenerate it after any balance change with

       npm run stats:build

   Every row names its Source (content file + field) so the number can
   be traced to — and edited at — exactly one place.
   ===================================================================== */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HEROES, HERO_IDS, HERO_MAGIC, HERO_ATTACK, HERO_AIM_ASSIST, HERO_STATS, RULES,
  BOSSES, BOSS_CFG_BY_CHAPTER, BOSS_PHASE2, ENEMY_CFG, ENEMIES,
  ITEMS, ITEM_DROPS, GEM_XP, GEM_SCORE, UPGRADE_LIST, FIGURE_SCALES,
  MAPS, FILL_POOL, FILL_POOLS,
} from '../src/content/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src', 'content');

/** Find the descriptor file that declares `export const <name> =`. */
function sourceFileFor(exportName, folder) {
  const dir = join(DIR, folder);
  if (!existsSync(dir)) return '(folder missing)';
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'index.js').sort()) {
    if (new RegExp('export const ' + exportName + '\\s*=').test(readFileSync(join(dir, f), 'utf8')))
      return 'src/content/' + folder + '/' + f;
  }
  return '(not found)';
}
const fmt = (x) => (typeof x === 'number' ? String(Number(x.toFixed(4))) : String(x));
const mul = (b) => '×' + fmt(b.dmgMul || 1);
const landed = (base, b) => Math.round(base * (b.dmgMul || 1));

const L = [];
L.push('# AETHERBLADE — STATS');
L.push('');
L.push('> **GENERATED — do not hand-edit.** This sheet is built from the game\'s own');
L.push('> content registry by `scripts/build-stats.mjs`. After any balance change,');
L.push('> regenerate it with one command:');
L.push('>');
L.push('>     npm run stats:build');
L.push('>');
L.push('> Every row\'s **Source** column names the content file and field to edit.');
L.push('> "Effective" values are what the simulation actually deals, computed the');
L.push('> same way the sim computes them (multiplier applied, one Math.round).');
L.push('');

/* ---------------- Heroes ---------------- */
const HB = RULES.hero, MG = RULES.magic;
L.push('## Heroes');
L.push('');
L.push(`Base hero (all heroes share these unless a descriptor overrides them): damage **${HB.dmg}**, speed **${fmt(HB.runSpeed)} m/s**, roll **${fmt(HB.rollDist)} m** every **${fmt(HB.rollCd)} s**, sword range **${fmt(HB.range)} m** / arc **${HB.arcDeg}°**. Source: \`src/content/rules.js · hero\`.`);
L.push('');
L.push('| Hero | Role | Unlock | Attack | Damage / hit (effective) | Speed (m/s) | Roll (m / cd s) | Magic | Trait | Source |');
L.push('|---|---|---|---|---|---|---|---|---|---|');
for (const id of HERO_IDS) {
  const h = HEROES[id], st = HERO_STATS[id] || {}, atk = HERO_ATTACK[id];
  const dmg = Math.round(HB.dmg * (st.dmgMul || 1));
  const spd = HB.runSpeed * (st.speedMul || 1);
  const rd = HB.rollDist * (st.rollDistMul || 1), rc = HB.rollCd * (st.rollCdMul || 1);
  const aa = HERO_AIM_ASSIST[id];
  const atkTxt = atk
    ? `Arrow — range ${fmt(atk.range)} m, speed ${fmt(atk.speed)} m/s${aa ? `; aim assist — ${fmt(aa.coneDeg)}° cone${aa.lead ? ' + target lead (intercept)' : ''}` : ''}`
    : `Melee — range ${fmt(HB.range)} m, arc ${HB.arcDeg}°`;
  const m = HERO_MAGIC[id];
  const magTxt = !m ? `Arcane Blast — ${MG.dmg} dmg, ${fmt(MG.radius)} m radius, ${MG.cost} kills`
    : m.kind === 'frost' ? `Frost Nova — ${MG.dmg} dmg + freeze ${fmt(m.freezeSec)} s (boss ${fmt(m.bossFreezeSec)} s)`
    : m.kind === 'fire' ? `Fire Crescent — ${Math.round(MG.dmg * (m.dmgMul || 1))} dmg (${MG.dmg} × ${fmt(m.dmgMul || 1)}), no control or knockback`
    : `Earthquake — ${MG.dmg} dmg + knockback ${fmt(m.push)} m (boss ${fmt(m.bossPush)} m)`;
  const file = sourceFileFor(id, 'heroes');
  L.push(`| ${h.displayName} | ${h.role || '—'} | ${h.accountLevel ? `Account Lv ${h.accountLevel}` : h.price ? h.price + ' G' : 'default (free)'} | ${atkTxt} | ${dmg}${st.dmgMul ? ` (base ${HB.dmg} × ${fmt(st.dmgMul)})` : ''} | ${fmt(spd)}${st.speedMul ? ` (× ${fmt(st.speedMul)})` : ''} | ${fmt(rd)} / ${fmt(rc)}${st.rollDistMul || st.rollCdMul ? ' (descriptor multipliers)' : ''} | ${magTxt} | ${h.trait || '—'} | \`${file}\` |`);
}
L.push('');
L.push(`Magic basics (every hero): the meter fills **${MG.perKill} per kill**, casting costs **${MG.cost}**, the blast deals **${MG.dmg}** damage in a **${fmt(MG.radius)} m** radius. Source: \`src/content/rules.js · magic\`. Per-hero multipliers live in each descriptor's \`stats\` block; signature effects in its \`magic\` block.`);
L.push('');

/* ---------------- Bosses ---------------- */
L.push('## Bosses');
L.push('');
L.push('| Chapter | Boss | HP | Speed (m/s) | Radius (m) | Figure scale | Score | Source |');
L.push('|---|---|---|---|---|---|---|---|');
const BOSS_FILE = { 1: 'src/content/enemies/bosses/emerald-drake.js', 2: 'src/content/enemies/bosses/shared.js (BOSS_CFG)', 3: 'src/content/enemies/bosses/iron-lancer.js',
                    4: 'src/content/enemies/bosses/spiked-ogre.js', 5: 'src/content/enemies/bosses/caldera-drake.js', 6: 'src/content/enemies/bosses/siege-lancer.js' };
const BOSS_CHAPTERS = Object.keys(BOSSES).map(Number).sort((a, b) => a - b);
for (const ch of BOSS_CHAPTERS) {
  const b = BOSS_CFG_BY_CHAPTER[ch], d = BOSSES[ch];
  L.push(`| ${ch} | ${d.displayName}${d.placeholder ? ' (PLACEHOLDER)' : ''} | ${b.hp} | ${fmt(b.speed)} | ${fmt(b.radius)} | ×${fmt(FIGURE_SCALES[d.figure] || 1)} | ${b.score} | \`${BOSS_FILE[ch]} · cfg\` |`);
}
L.push('');
L.push('Boss size: boss figures sit at **×1.5** their original size (radius is the sim body; the figure scale is the matching view size) — Matt\'s all-bosses-bigger call (AB-NET-19). Three exceptions: the Emerald Drake (chapters 1 and 5) keeps **×1.3** — Matt exempted the dragon — chapter 4\'s Spiked Ogre sits at **×1.55**, Matt\'s bigger-boss call (AB-NET-17), and the Iron Lancer (chapters 3 and 6) sits at **×1.8** — the ×1.5 rule plus Matt\'s extra 20% for the lancer (2026-11-15). Chapter 4 is Matt\'s own boss design and fields **TWO** ogres at once (`twinFigure` — the chapter clears only when both are dead; each carries the full HP and score above, so the solo fight totals 1,040 HP). Chapters 5-6 bosses remain PLACEHOLDERS (earlier bosses reappearing with late-game HP) pending Matt\'s own boss creations.');
L.push('');
L.push('### Boss attacks — base → effective (damage multiplier applied once, one rounding)');
L.push('');
L.push('| Boss | Attack | Base | × dmgMul | Effective | Range / notes | Source field |');
L.push('|---|---|---|---|---|---|---|');
for (const ch of BOSS_CHAPTERS) {
  const b = BOSS_CFG_BY_CHAPTER[ch], d = BOSSES[ch], f = BOSS_FILE[ch];
  const P = BOSS_PHASE2;
  L.push(`| ${d.displayName} | Slam | ${b.slamDmg} | ${mul(b)} | **${landed(b.slamDmg, b)}** | reach ${fmt(b.slamRange)} m (centre distance), telegraph ${fmt(b.slamTele)} s | \`${f} · cfg.slamDmg / cfg.slamRange\` |`);
  L.push(`| ${d.displayName} | Slam (enraged) | ${b.slamDmg} + ${P.slamBonus} bonus | ${mul(b)} | **${landed(b.slamDmg + P.slamBonus, b)}** | bonus added BEFORE the multiplier | \`cfg.slamDmg\` + \`bosses/shared.js · BOSS_PHASE2.slamBonus\` |`);
  L.push(`| ${d.displayName} | Charge | ${b.chargeDmg} | ${mul(b)} | **${landed(b.chargeDmg, b)}** | trigger ≤ ${fmt(b.chargeRange)} m, speed ${fmt(b.chargeSpeed)} m/s, telegraph ${fmt(b.chargeTele)} s${b.chargeThru ? '; ignores ALL prop/theme colliders while charging (arena edge still applies)' : ''} | \`${f} · cfg.chargeDmg / cfg.chargeRange\` |`);
  if (b.spinDmg) L.push(`| ${d.displayName} | Whirlwind spin | ${b.spinDmg} | ${mul(b)} | **${landed(b.spinDmg, b)}** | full circle, range ${fmt(b.spinRange)} m, telegraph ${fmt(b.spinTele)} s, duration ${fmt(b.spinDur)} s, cooldown ${fmt(b.spinCd)} s | \`${f} · cfg.spinDmg / cfg.spinRange\` |`);
  if (b.superDmg) L.push(`| ${d.displayName} | Super slam | ${b.superDmg} | ${mul(b)} | **${landed(b.superDmg, b)}** | full circle (no safe arc), range ${fmt(b.superRange)} m, telegraph ${fmt(b.superTele)} s, duration ${fmt(b.superDur)} s, cooldown ${fmt(b.superCd)} s | \`${f} · cfg.superDmg / cfg.superRange\` |`);
  if (b.breath) {
    const br = b.breath, t = landed(br.tickDmg, b);
    /* Ticks per breath = how many tick events the sim's accumulator
       emits during the state: floor(dur / tickEvery) — measured in-sim
       (phase 1: 6 ticks, phase 2: 7 ticks; a Math.round here would
       claim 8 phase-2 ticks and overstate the exposure). */
    const ticks1 = Math.floor(br.dur / br.tickEvery + 1e-6), ticks2 = Math.floor(br.p2Dur / br.tickEvery + 1e-6);
    L.push(`| ${d.displayName} | Fire breath (per tick) | ${br.tickDmg} | ${mul(b)} | **${t}** | cone ${fmt(br.range)} m, half-angle ${br.halfAngleDeg}°, ticks every ${fmt(br.tickEvery)} s, telegraph ${fmt(br.tele)} s | \`${f} · cfg.breath.tickDmg\` |`);
    L.push(`| ${d.displayName} | Fire breath (full exposure) | — | — | **${t * ticks1}** (phase 1, ${ticks1} ticks) / **${t * ticks2}** (phase 2, ${ticks2} ticks) | fires from ${fmt(br.minRange)}–${fmt(br.maxRange)} m, mouth offset (headDist) ${fmt(br.headDist)} m, breath cooldown ${fmt(br.cd)} s (phase 2: ${fmt(br.p2Cd)} s) | \`${f} · cfg.breath\` |`);
  }
}
L.push('');
L.push('### Boss phases (shared by all bosses)');
L.push('');
L.push('| Phase | Triggers at | Effect | Source |');
L.push('|---|---|---|---|');
const P = BOSS_PHASE2;
L.push(`| Summon | HP ≤ ${P.summonAt * 100}% | calls ${P.summonCount} × ${P.summonKind} adds, once | \`src/content/enemies/bosses/shared.js · BOSS_PHASE2\` |`);
L.push(`| Enrage | HP ≤ ${P.hpFrac * 100}% | approach speed ×${fmt(P.speedMul)}; slam +${P.slamBonus} (before the damage multiplier) | \`src/content/enemies/bosses/shared.js · BOSS_PHASE2\` |`);
L.push(`| Fury | HP ≤ ${P.fury.hpFrac * 100}% | approach speed ×${fmt(P.fury.speedMul)} MORE (×${fmt(P.speedMul * P.fury.speedMul)} total with enrage); attack tempo ×${fmt(P.fury.tempoMul)} — cooldowns and telegraphs that START in fury are divided by ${fmt(P.fury.tempoMul)}; timers already running keep their duration; breath tick rate/duration unchanged | \`src/content/enemies/bosses/shared.js · BOSS_PHASE2.fury\` |`);
L.push('');

/* ---------------- Enemies ---------------- */
L.push('## Enemies');
L.push('');
L.push(`Shared melee defaults: telegraph ${fmt(ENEMY_CFG.telegraph)} s, strike range ${fmt(ENEMY_CFG.strikeRange)} m, arc ${ENEMY_CFG.strikeArcDeg}°, recovery ${fmt(ENEMY_CFG.recovery)} s (a kind's own \`tele/recovery/cd/reach\` overrides). Every kill drops **${GEM_XP} XP** (one gem, +${GEM_SCORE} score). Sources: \`src/content/enemies/shared.js · MELEE_DEFAULTS\`, \`src/content/items/gem.js\`.`);
L.push('');
L.push('| Enemy | HP | Damage | Speed (m/s) | Radius (m) | Score | Attack | Source |');
L.push('|---|---|---|---|---|---|---|---|');
for (const kind of Object.keys(ENEMIES)) {
  const c = ENEMY_CFG[kind]; if (!c) continue;
  const atk = c.volley
    ? `Ranged — band ${fmt(c.minRange)}–${fmt(c.maxRange)} m, volley every ${fmt(c.volley)} s, projectile ${fmt(c.projSpeed)} m/s${c.splash ? `, splash ${fmt(c.splash)} m` : ''}${c.tele ? `, telegraph ${fmt(c.tele)} s` : ''}`
    : `Melee — reach ${fmt(c.reach || ENEMY_CFG.strikeRange)} m, arc ${c.arcDeg || ENEMY_CFG.strikeArcDeg}°, telegraph ${fmt(c.tele || ENEMY_CFG.telegraph)} s, recovery ${fmt(c.recovery || ENEMY_CFG.recovery)} s${c.cd ? `, cooldown ${fmt(c.cd)} s` : ''}${c.poise ? ', poise (windup uninterruptible)' : ''}`;
  /* Descriptor exports are camelCase (ravenKnight) while kinds are
     kebab-case (raven-knight) — convert before the source lookup. */
  const exportName = kind.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
  L.push(`| ${ENEMIES[kind].displayName || kind.toUpperCase()} | ${c.hp} | ${c.dmg} | ${fmt(c.speed)} | ${fmt(c.radius)} | ${c.score} | ${atk} | \`${sourceFileFor(exportName, 'enemies')} · cfg\` |`);
}
L.push('');

/* ---------------- Items ---------------- */
L.push('## Items & pickups');
L.push('');
L.push('| Item | Effect | Drop rule | Source |');
L.push('|---|---|---|---|');
for (const id of Object.keys(ITEMS)) {
  const s = ITEM_DROPS[id], it = ITEMS[id], file = sourceFileFor(id, 'items');
  const eff = id === 'gem' ? `+${s.xp} XP, +${s.score} score`
    : id === 'heal' ? `restores ${s.amount} HP`
    : `+${s.gain} magic meter`;
  const drop = s.drop === 'always' ? 'every enemy kill'
    : `${Math.round(s.chance * 100)}% chance per kill${s.eliteKinds ? ' — ELITE kills only (' + s.eliteKinds.join(', ') + ')' : ''}`;
  L.push(`| ${it.displayName} | ${eff} | ${drop} | \`${file} · sim\` |`);
}
L.push('');
L.push(`Level-up curve: XP needed for the next level = 8 + 6 × (level − 1) gems. Source: \`src/content/items/gem.js · notes\` / sim level rule.`);
L.push('');

/* ---------------- Upgrades ---------------- */
L.push('## Upgrades — level-up picks (choose 1 of 3)');
L.push('');
L.push('Each pick applies its effect once; picks stack with no per-upgrade cap in the data.');
L.push('');
L.push('| Upgrade | Effect per pick | Source |');
L.push('|---|---|---|');
for (const u of UPGRADE_LIST)
  L.push(`| ${u.name} | ${u.ds} | \`${sourceFileFor(u.id, 'upgrades')}\` |`);
L.push('');
L.push('## Meta tracks — permanent (Armoury, bought with gold)');
L.push('');
const MT = RULES.meta;
L.push(`Cost per level (all tracks): **${MT.costs.join(' / ')} G** for levels 1–${MT.steps}. Gold also: +${MT.clearBonus} G per chapter clear, +${MT.victoryBonus} G victory bonus, run score ÷ ${MT.scoreGoldDivisor}. Source: \`src/content/rules.js · meta\`.`);
L.push('');
L.push('| Track | Per level | Max total | Source |');
L.push('|---|---|---|---|');
for (const t of MT.tracks)
  L.push(`| ${t.name} | +${fmt(t.per)} ${t.unit} | +${fmt(t.per * MT.steps)} ${t.unit} | \`src/content/rules.js · meta.tracks\` |`);
L.push('');
L.push(`Hero unlock costs are in the Heroes table above (Source: each descriptor's \`price\`, mirrored in \`src/content/rules.js\`-derived hero costs).`);
L.push('');

/* ---------------- Multiplayer scaling ---------------- */
L.push('## Multiplayer scaling — player-count difficulty (co-op)');
L.push('');
L.push('Co-op runs scale with the roster size **N locked at run start** (a mid-run departure does not rescale). One HP rule covers regular enemies AND bosses:');
L.push('');
L.push('> **HP multiplier = N × (1 + 0.1 × (N−1))** — each extra player adds their full share plus 10%, because more players land proportionally more hits per second (focus fire, N magic meters, N interrupts). Applied once at spawn: `Math.round(base HP × hpMul)`.');
L.push('>');
L.push('> **Damage** dealt TO heroes grows gently instead (+10% per extra player — incoming damage lands per-hero while outgoing damage is pooled): one extra `Math.round` at each damage application, on top of the existing per-source rounding (boss `dmgMul` first, phase-2 slam bonus added before both). The **alive cap** widens at N=3/4 so four heroes do not face an emptier field. Nothing else scales (speeds, ranges, telegraphs, %-based phase thresholds, XP, drops).');
L.push('');
L.push('| Players (N) | Enemy + boss HP | Damage to heroes | Alive cap | Brute HP (base 76) | Emerald Drake HP (base 396) | Source |');
L.push('|---|---|---|---|---|---|---|');
{
  const PS = RULES.playerScaling;
  const bruteHp = (ENEMY_CFG.brute || {}).hp;
  const drakeHp = (BOSS_CFG_BY_CHAPTER[1] || {}).hp;
  for (let n = 1; n <= 4; n++) {
    const r = PS[n];
    L.push(`| ${n} | ×${fmt(r.hpMul)} | ×${fmt(r.dmgMul)} | ${r.aliveCap} | ${Math.round(bruteHp * r.hpMul)} | ${Math.round(drakeHp * r.hpMul)} | \`src/content/rules.js · playerScaling[${n}]\` |`);
  }
}
L.push('');
L.push('Tune the proportions in `src/content/rules.js · playerScaling` — this table is generated from that single source. The N=1 row is exactly the solo game (all ×1.0, cap 8).');
L.push('');

/* ---------------- Chapter fill composition ---------------- */
L.push('## Chapter fill composition — per-chapter pool overrides');
L.push('');
L.push('The weighted fill pool is global (each kind\'s `fill {from, weight, ramp}` in its enemy descriptor), except where a map descriptor carries `map.fill` overrides — `{from, weight, ramp}` replace the global entry **in that chapter only** (same kinds, same pool order, same per-kind caps, same global alive cap, same spawn interval). Chapters without overrides use the global pool unchanged.');
L.push('');
for (const m of Object.values(MAPS)) {
  if (!m.map.fill) continue;
  const pool = FILL_POOLS[m.chapter];
  L.push(`### Chapter ${m.chapter} — ${m.displayName} (overrides)`);
  L.push('');
  L.push('| Enemy | Global from (s) / weight / ramp | This chapter from (s) / weight / ramp | Source |');
  L.push('|---|---|---|---|');
  for (const f of pool) {
    if (!m.map.fill[f.kind]) continue;
    const g = FILL_POOL.find((x) => x.kind === f.kind);
    L.push(`| ${ENEMIES[f.kind].displayName || f.kind.toUpperCase()} | ${fmt(g.from)} / ${fmt(g.weight)} / ${fmt(g.ramp)} | **${fmt(f.from)} / ${fmt(f.weight)} / ${fmt(f.ramp)}** | \`src/content/maps/${m.id}.js · map.fill\` |`);
  }
  L.push('');
}

/* ---------------- Account progression (Phase M2) ---------------- */
const { ACCOUNT_GAINS, PROGRESSION_VERSION, ECONOMY_VERSION, ACCOUNT_LEVEL_CAP, upgradeCostFor } =
  await import('../src/account.js');
L.push('## Account progression — the server profile stat block (M2/M3)');
L.push('');
L.push('Rendered from `src/account.js · ACCOUNT_GAINS` (the same table the client derivation runs). Composition (plan §6): the in-run upgrade curves multiply the hero-multiplied content base, and this permanent block is added LAST (`damage = round(34 × heroDmgMul) × 1.20^Edge + P.dmg`, likewise speed; max HP adds P.hp; P.crit joins the base 5% crit chance before the Keen Eye curve; P.magicDmg adds to the 60-damage magic blast): `P.hp = 2·(L−1) + 8·Armour`, `P.dmg = floor((L−1)/2) + 2·Weapon`, `P.spd = 0.01·(L−1) + 0.075·Boots`, `P.crit = 1%·Helm`, `P.magicDmg = 2·Charm`. At level 1 with all equipment 0 the block is exactly zero — bit-identical to the pre-account game. Guests use the legacy local tracks; signed-in play uses this block, and in server (M3) mode the local tracks no longer apply to the account at all.');
L.push('');
L.push(`Progression version **${PROGRESSION_VERSION}** · economy version **${ECONOMY_VERSION}** · account level cap **${ACCOUNT_LEVEL_CAP}** · level gains: +${ACCOUNT_GAINS.hpPerLevel} HP per level, +${ACCOUNT_GAINS.dmgPerTwoLevels} damage per 2 levels, +${ACCOUNT_GAINS.spdPerLevel} speed per level.`);
L.push('');
L.push('| Equipment slot | Per level | Source |');
L.push('|---|---|---|');
for (const s of ACCOUNT_GAINS.slots)
  L.push(`| ${s.label} | +${s.per} ${s.stat} | \`src/account.js · ACCOUNT_GAINS\` |`);
L.push('');
L.push('Server economy (M3, economy version 1 — the Worker recomputes everything from submitted counters; the client only displays). Run entitlement: `gold = floor(score/10) + 50 × chaptersCleared + 200 × victory`, `account XP = floor(score/50) + 20 × chaptersCleared + 40 × victory`, `Aether Shards = chaptersCleared + 2 × victory + min(3, floor(eliteKills/8))` (elites = the registry ELITE_KINDS). Chapter checkpoints credit immediately during the run; the final submission credits only the uncredited difference, and replays never double-credit. Signed-in accounts own all three identity heroes (Lion Knight, Frost Archer, Earth Dwarf) from the start; in server mode the equipment buttons below replace the local legacy tracks in the Armoury.');
L.push('');
L.push('| Upgrade to level | Gold | Aether Shards |');
L.push('|---|---|---|');
for (let t = 1; t <= 10; t++) {
  const c = upgradeCostFor(t);
  L.push(`| ${t} | ${c.gold} | ${c.shards} |`);
}
L.push('');
L.push('One slot from 0 to 10 costs **2,440 G + 22 Aether Shards**; all five slots **12,200 G + 110**. The server derives the price from its stored level — the request names only the slot.');
L.push('');

writeFileSync(join(ROOT, 'STATS.md'), L.join('\n'));
console.log('wrote STATS.md —', L.length, 'lines');
