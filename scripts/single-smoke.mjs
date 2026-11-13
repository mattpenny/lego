#!/usr/bin/env node
/* =====================================================================
   single-smoke.mjs — prove the generated ONE-FILE phone build really boots.

   build-single.mjs --check only proves the file is byte-current. This script
   goes further: it installs the same inert engine/DOM stubs used by
   boot-smoke.mjs (by importing it), extracts the inlined content bundle from
   dist-single/aetherblade.html, and executes it for real. That catches a
   broken ESM->classic rewrite (missing named export, bad __req path, cycle),
   which a byte comparison cannot detect.

   The vendored three.js <script> is NOT executed: engine globals are stubbed,
   just as in the module build. what IS executed is the whole content registry
   plus the game IIFE, exactly as a phone would run it.
   ===================================================================== */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'dist-single', 'aetherblade.html');

/* Importing boot-smoke installs all global stubs AND validates the module
   build first. Two independent boots of the same game is intentional: the
   second one must overwrite window.__GAME with an equally healthy runtime. */
await import('./boot-smoke.mjs');

if (!existsSync(OUT)) throw new Error('dist-single/aetherblade.html missing — run npm run single:build');
const html = readFileSync(OUT, 'utf8');

/* No network fetches are allowed in the phone build. */
for (const tag of ['src/three.js', 'src/main.js', 'src/game.css']) {
  if (new RegExp(`<(?:script|link)[^>]+${tag.replace('.', '\\.')}`).test(html))
    throw new Error(`phone build still references ${tag}`);
}
if (!html.includes('<style>')) throw new Error('phone build has no inlined CSS');

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (scripts.length !== 2)
  throw new Error(`expected 2 inline scripts (three.js + bundle), found ${scripts.length}`);
const bundle = scripts[1];
if (!bundle.includes('AETHERBLADE content bundle'))
  throw new Error('second <script> is not the generated content bundle');

const before = globalThis.__GAME;
vm.runInThisContext(bundle, { filename: 'aetherblade.bundle.js' });
const G = globalThis.__GAME;
if (!G || typeof G.digest !== 'function')
  throw new Error('phone bundle did not install window.__GAME');
if (G === before)
  throw new Error('phone bundle did not re-boot the game (window.__GAME unchanged)');

const baseline = JSON.parse(readFileSync(resolve(ROOT, 'scripts/content-baseline.json'), 'utf8'));
if (G.digest() !== baseline.checks.fresh)
  throw new Error(`phone build fresh digest ${G.digest()} != baseline ${baseline.checks.fresh}`);
if (G.CFG.net.build !== baseline.build)
  throw new Error(`phone build net stamp ${G.CFG.net.build} != ${baseline.build}`);

/* Exercise the descriptor tables that only exist inside the bundle. */
if (Object.keys(G.CFG.enemy).length < 8) throw new Error('phone build enemy CFG is incomplete');
if (G.CFG.caps.enemies !== 8) throw new Error('phone build global enemy cap drifted');
G.reset(0x51A7E, 'play');
for (let i = 0; i < 60; i++) G.step({});
if (G.sim.heroes[0].hp <= 0) throw new Error('phone build hero died on an idle 60-step run');

console.log(`single OK — ${scripts[0].length} B engine + ${bundle.length} B bundle, ` +
  `${Object.keys(G.CFG.enemy).length} enemy cfg entries, digest ${G.digest()}`);
