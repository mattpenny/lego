#!/usr/bin/env node
/* =====================================================================
   migrate.mjs — one-shot extractor: single-file AETHERBLADE build ->
   the aetherblade-refactor/ module layout (phase 1: works as-is).

   Usage:  node scripts/migrate.mjs <source.html> [projectRoot]

   It extracts, verbatim wherever the format allows:
     src/three.js        <- 1st <script> block (vendored three.js r170)
     src/game.js         <- 2nd <script> block (the game IIFE) + the one
                            allowed glue footer (`export {};`, see below)
     src/game.css        <- the <style> block
     src/game.dom.html   <- the <body> markup before the first <script>
     src/core/rng.js     <- the xorshift RNG block out of the game script
     src/core/input.js   <- the button-binding block out of the game script
     src/content/palettes.js <- the PALETTES table out of the game script
     src/content/upgrades.js <- the UPGRADES table out of the game script
     src/main.js, index.html <- generated shell (DOM pasted in)

   Hand-authored phase-1 modules (content/enemies/**, rig/**,
   package.json, vite.config.js) are NOT touched by this script.
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const srcPath = process.argv[2];
if (!srcPath) { console.error('usage: node scripts/migrate.mjs <source.html> [projectRoot]'); process.exit(1); }
const root = process.argv[3] ? resolve(process.argv[3])
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');

const html = readFileSync(srcPath, 'utf8');
const md5 = s => createHash('md5').update(s, 'utf8').digest('hex');
const out = (rel, content) => {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
  console.log(`  ${rel}  (${Buffer.byteLength(content)} B, md5 ${md5(content)})`);
};
const between = (s, open, close, from = 0) => {
  const a = s.indexOf(open, from); if (a < 0) throw new Error('anchor not found: ' + open);
  const b = s.indexOf(close, a + open.length); if (b < 0) throw new Error('anchor not found: ' + close);
  return { text: s.slice(a + open.length, b), end: b + close.length };
};

/* ---- the two script blocks, in document order ---- */
const s1Open = html.indexOf('<script>');
const s1 = between(html, '<script>', '</script>', 0);
const s2 = between(html, '<script>', '</script>', s1Open + 1);
if (html.indexOf('<script>', s1Open + 1) !== html.lastIndexOf('<script>'))
  throw new Error('expected exactly 2 <script> blocks');

/* ---- style + body markup ---- */
const css = between(html, '<style>', '</style>').text;
const bodyOpen = html.indexOf('<body>');
const dom = html.slice(bodyOpen + '<body>'.length, s1Open);

console.log('migrating', srcPath, '->', root);
out('src/three.js', s1.text);
out('src/game.css', css);
out('src/game.dom.html', dom);

/* ---- game.js: verbatim IIFE + the minimal module glue ---- */
const GLUE = '\n\n/* -- phase-1 module glue (the ONLY edit vs the single-file build) --\n' +
  '   src/main.js loads this file as an ES module; the IIFE above is untouched. */\n' +
  'export {};\n';
out('src/game.js', s2.text + GLUE);

const game = s2.text;
const sliceGame = (openAnchor, closeAnchor) => {
  const a = game.indexOf(openAnchor); if (a < 0) throw new Error('game anchor not found: ' + openAnchor);
  const b = game.indexOf(closeAnchor, a); if (b < 0) throw new Error('game anchor not found: ' + closeAnchor);
  return game.slice(a, b + closeAnchor.length);
};

/* ---- core/rng.js: the xorshift block, verbatim + exports ---- */
const rngBlock = sliceGame('function nextU32(x){', 'return x/4294967296; }; }');
out('src/core/rng.js',
`/* Extracted verbatim from src/game.js by scripts/migrate.mjs.
   The sim owns ONE xorshift32 state (an object with .rng/.rngCalls);
   mkRng() makes independent cosmetic-only streams. */
${rngBlock}

export { nextU32, rnd, rndR, rndI, mkRng };
`);

/* ---- core/input.js: the button-binding block, verbatim + exports ---- */
const inputBlock = sliceGame('const BTN_PTR=', "bindButton('btnAttack',false); bindButton('btnRoll',true);");
out('src/core/input.js',
`/* Extracted verbatim from src/game.js by scripts/migrate.mjs.
   FIDELITY NOTE: this is the game's real binding code, lifted as-is. It is
   NOT imported by src/main.js in phase 1 — game.js still runs its own inline
   copy. It references game-scope collaborators that live in game.js
   ($, UI, Audio, INPUT_LOG, ATK_BUFFER), and importing it executes the
   bindings, so wire it in only when those are injected/passed (phase 2).
   The btnMagic binding in game.js is an anonymous IIFE (it adds
   BTN_PTR.btnMagic) and is therefore not part of this extract. */
${inputBlock}

export { BTN_PTR, bindButton, buttonRelease };
`);

/* ---- content tables: verbatim literals, `const` -> `export const` ---- */
const table = name => {
  const a = game.indexOf('const ' + name + ' = ['); if (a < 0) throw new Error('table not found: ' + name);
  const b = game.indexOf('\n];', a); if (b < 0) throw new Error('table end not found: ' + name);
  return 'export const ' + name + game.slice(a + ('const ' + name).length, b + 3);
};
out('src/content/palettes.js',
`/* Extracted verbatim from src/game.js by scripts/migrate.mjs.
   Chapter palettes (index 0 = chapter 1). buildMapData() stays in game.js. */
${table('PALETTES')}
`);
out('src/content/upgrades.js',
`/* Extracted verbatim from src/game.js by scripts/migrate.mjs.
   The in-run pick-3 upgrade pool. apply(s) mutates sim state; heroStats()
   (which reads this pool's counters) stays in game.js for phase 1. */
${table('UPGRADES')}
`);

/* ---- generated shell: main.js + index.html (DOM pasted in) ---- */
out('src/main.js',
`// Phase 1 entry point: the whole game still ships as one extracted IIFE.
// index.html loads src/three.js as a CLASSIC script before this module,
// because the vendored r170 block declares its API as top-level consts in
// the global lexical scope — and src/game.js reads them as bare globals
// (WebGLRenderer, Scene, ...). Do not import three.js as a module: its
// consts would become module-private and the game would not boot.
import './game.js';
`);
out('index.html',
`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>AETHERBLADE — 3D Arena Survivor</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="src/game.css">
</head>
<body>${dom}<script src="src/three.js"></script>
<script type="module" src="src/main.js"></script>
</body>
</html>
`);
console.log('done.');
