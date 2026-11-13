#!/usr/bin/env node
/* =====================================================================
   extract-figures.mjs — ONE-SHOT migration of figure geometry to data.

   src/game.js used to build all 9 minifigures with ~560 lines of add()
   calls inside rigParts(). This script evaluates that ORIGINAL code in a
   Node vm, captures the exact part arrays it produces, resolves each
   colour back to its TINTS slot name, and writes one pure-data file per
   figure under src/content/figures/.

   It is reproducible: the original source is snapshotted to
   scripts/figures-legacy.txt on first run, and every later run reads that
   snapshot instead of src/game.js (which is now data-driven).

   Usage: node scripts/extract-figures.mjs [--check]
     --check   regenerate in memory and compare to the files on disk;
               exit 1 on drift. Used by content:check.
   ===================================================================== */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT = join(ROOT, 'scripts/figures-legacy.txt');
const OUT = join(ROOT, 'src/content/figures');
const INK = [0.045, 0.045, 0.055];
const ADDED = '2026-11-13';

/* Pull a balanced brace block starting at the first '{' after `marker`. */
function blockAt(src, marker) {
  const a = src.indexOf(marker);
  if (a < 0) throw new Error('marker not found: ' + marker);
  const open = src.indexOf('{', a);
  let depth = 0, str = null, esc = false;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (str) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === str) str = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('unbalanced block after ' + marker);
}

/* Whole declaration from `marker` through its balanced body — needed for
   function signatures (blockAt() alone would drop the parameter list). */
function declAt(src, marker) {
  const a = src.indexOf(marker);
  if (a < 0) throw new Error('marker not found: ' + marker);
  const open = src.indexOf('{', a);
  let depth = 0, str = null, esc = false;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (str) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === str) str = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { str = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return src.slice(a, i + 1);
  }
  throw new Error('unbalanced declaration after ' + marker);
}

/* The object literal for TINTS is a standalone, comment-bearing literal. */
function tintsLiteral(src) {
  return blockAt(src, 'const TINTS=');
}

/** Original source, snapshotted once so the migration stays reproducible. */
export function legacySource() {
  if (existsSync(SNAPSHOT)) return readFileSync(SNAPSHOT, 'utf8');
  const game = readFileSync(join(ROOT, 'src/game.js'), 'utf8');
  const parts = [
    '/* Snapshot of the ORIGINAL figure code from src/game.js, taken before',
    '   Step 3 made figures data-driven. Kept for reproducibility. */',
    'const TINTS=' + tintsLiteral(game) + ';',
    declAt(game, 'function bodyParts'),
    declAt(game, 'function rigParts'),
  ].join('\n\n');
  writeFileSync(SNAPSHOT, parts + '\n');
  return parts;
}

/** Real per-figure view scales, from the old mesh.scale table. */
function meshScales(src) {
  const out = {};
  for (const m of src.matchAll(/if\(kind==='([a-z]+)'\)mesh\.scale\.setScalar\(([0-9.]+)\)/g))
    out[m[1]] = Number(m[2]);
  return out;
}

/** Evaluate the legacy builders and capture their exact part arrays. */
export function captureFigures() {
  const src = legacySource();
  const snapshotGame = existsSync(SNAPSHOT)
    ? readFileSync(join(ROOT, 'scripts/figures-legacy.txt'), 'utf8')
    : src;
  const scales = meshScales(readFileSync(join(ROOT, 'src/game.js'), 'utf8'));
  // The snapshot itself records the scales so it survives the game.js rewrite.
  const scaleLine = snapshotGame.match(/^\/\* SCALES (\{.*\}) \*\/$/m);
  const scaleMap = scaleLine ? JSON.parse(scaleLine[1]) : scales;

  const ctx = vm.createContext({ Math });
  vm.runInContext(src + '\n;this.__T = TINTS; this.__R = rigParts;', ctx);
  const TINTS = ctx.__T;
  const result = {};
  for (const kind of Object.keys(TINTS)) {
    const tint = TINTS[kind];
    const raw = ctx.__R(kind);
    const parts = raw.map((p) => {
      let slot = Object.keys(tint).find((k) => tint[k] === p.c);
      if (!slot) {
        const isInk = Array.isArray(p.c) && p.c.length === 3 &&
          p.c.every((v, i) => Math.abs(v - INK[i]) < 1e-12);
        if (!isInk) throw new Error(`figure ${kind}: unresolvable colour ${JSON.stringify(p.c)}`);
        slot = 'INK';
      }
      const out = { j: p.j, g: p.g, o: p.o, s: p.s, c: slot };
      if (p.r && p.r.some((v) => v !== 0)) out.r = p.r;
      return out;
    });
    result[kind] = {
      id: kind,
      type: 'figure',
      displayName: kind.toUpperCase(),
      tint,
      meshScale: scaleMap[kind] === undefined ? 1 : scaleMap[kind],
      parts,
      added: ADDED,
      notes: `Extracted verbatim from rigParts('${kind}') — ${parts.length} moulded parts.`,
    };
  }
  return result;
}

const DISPLAY = {
  hero: 'BLUE LION KNIGHT', knight: 'ELITE KNIGHT', soldier: 'KETTLE-HELM SOLDIER',
  brute: 'BRUTE', runner: 'RUNNER', ranger: 'RANGER', archer: 'ARCHER',
  sorcerer: 'SORCERER', boss: 'HORNED WARLORD',
};

function render(d) {
  const tint = Object.entries(d.tint)
    .map(([k, v]) => `    ${k}: [${v.map((n) => n.toFixed(3)).join(', ')}],`).join('\n');
  const parts = d.parts.map((p) => {
    const f = (a) => '[' + a.map((n) => String(+n.toFixed(6))).join(',') + ']';
    let s = `    { j:${p.j}, g:'${p.g}', o:${f(p.o)}, s:${f(p.s)}, c:'${p.c}'`;
    if (p.r) s += `, r:${f(p.r)}`;
    return s + ' },';
  }).join('\n');
  return `/* ${d.displayName} — figure descriptor (generated, do not hand-edit).
   Source of truth for TINTS.${d.id}, rigParts('${d.id}') and its mesh scale.
   c = tint slot name; 'INK' is the shared near-black face-print colour.
   Regenerate with: node scripts/extract-figures.mjs */

export const ${d.id} = {
  id: '${d.id}',
  type: 'figure',
  displayName: '${d.displayName}',
  tint: {
${tint}
  },
  meshScale: ${d.meshScale},
  parts: [
${parts}
  ],
  added: '${d.added}',
  notes: ${JSON.stringify(d.notes)},
};

export default ${d.id};
`;
}

/* ---- CLI ------------------------------------------------------------- */
const IS_MAIN = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_MAIN) {
  const figures = captureFigures();
  for (const d of Object.values(figures)) d.displayName = DISPLAY[d.id] || d.displayName;
  // Persist the scale table into the snapshot so future runs are independent
  // of src/game.js, whose old mesh.scale table is removed by the rewrite.
  if (!existsSync(SNAPSHOT)) legacySource();
  let snap = readFileSync(SNAPSHOT, 'utf8');
  if (!/^\/\* SCALES /m.test(snap)) {
    const scales = meshScales(readFileSync(join(ROOT, 'src/game.js'), 'utf8'));
    snap += '\n/* SCALES ' + JSON.stringify(scales) + ' */\n';
    writeFileSync(SNAPSHOT, snap);
  }
  if (process.argv.includes('--check')) {
    let bad = 0;
    for (const d of Object.values(figures)) {
      const p = join(OUT, d.id + '.js');
      if (!existsSync(p) || readFileSync(p, 'utf8') !== render(d)) {
        console.error('  DRIFT  ' + p); bad++;
      }
    }
    if (bad) { console.error(`figure extraction drift: ${bad} file(s)`); process.exit(1); }
    console.log(`figures OK — ${Object.keys(figures).length} descriptors match the legacy rig`);
  } else {
    mkdirSync(OUT, { recursive: true });
    for (const d of Object.values(figures)) writeFileSync(join(OUT, d.id + '.js'), render(d));
    console.log(`wrote ${Object.keys(figures).length} figure descriptors to src/content/figures/`);
  }
}
