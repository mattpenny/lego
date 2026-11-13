#!/usr/bin/env node
/* =====================================================================
   digest-harness.mjs — deterministic sim digests WITHOUT a browser.

   src/game.js is an ES module whose IIFE is preceded by imports and whose
   PART 3 is render/audio/DOM. Everything between `const FIXED = 1/60;`
   and the `PART 3 — RENDER` banner is the pure deterministic sim: no T.*,
   no document/window, no Math.random, no Date.now (asserted below).

   We slice exactly that region and run it in a Node VM, injecting only the
   module-level bindings the real module imports. Then we exercise the same
   simStep()/simDigest() the game uses, through both the solo and co-op
   input paths. Any change to simulation behaviour moves these digests.

   Usage:
     node scripts/digest-harness.mjs               print digests
     node scripts/digest-harness.mjs --baseline    write content-baseline.json
     node scripts/digest-harness.mjs --check       compare with baseline
   ===================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { SIM_CONTENT } from '../src/content/index.js';

/** Order-independent JSON: key insertion order must not affect the hash. */
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

/** Every simulation number derived from a descriptor, in one hash. View-only
    fields (tints, parts, scales, colours) are deliberately excluded. */
function simContentHash() {
  return createHash('sha256').update(stable(SIM_CONTENT), 'utf8').digest('hex');
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'src/game.js');
const BASELINE = join(ROOT, 'scripts/content-baseline.json');

const START_ANCHOR = 'const FIXED = 1/60;';
const END_ANCHOR = 'PART 3 — RENDER';

function pureSimSource(src) {
  const a = src.indexOf(START_ANCHOR);
  const p3 = src.indexOf(END_ANCHOR);
  if (a < 0) throw new Error('anchor not found: ' + START_ANCHOR);
  if (p3 < 0) throw new Error('anchor not found: ' + END_ANCHOR);
  const end = src.lastIndexOf('/*', p3);
  if (end < a) throw new Error('could not locate the PART 3 comment opener');
  const slice = src.slice(a, end);
  /* Strip comments first: the PART 2 header states the invariant in prose
     (it literally mentions Date.now/Math.random), so comments must not be
     mistaken for code. */
  const probe = slice.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^\S\n]*\/\/.*$/gm, '');
  const forbidden = /\bT\.|document\b|window\b|\bAudio\b|\$\(|Math\.random|Date\.now|performance\./;
  const hit = forbidden.exec(probe);
  if (hit) {
    const upto = probe.slice(0, hit.index).split('\n').length;
    throw new Error(`sim region is not pure near slice line ${upto}: "${hit[0]}"`);
  }
  return slice;
}

const FOOTER = `
;({
  CFG, PALETTES, UPGRADES, simDigest, newSim, simStep, normInput, runHeadless,
  setSim(s){ SIM = s; }, getSim(){ return SIM; }, drainEV(){ EV.length = 0; }
})
`;

async function buildApi(src) {
  /* Module-level imports of src/game.js must be present as VM globals.
     Import the REAL registry and inject every named export, so a newly
     added descriptor table is automatically available to the sim slice —
     no hand-maintained mirror list to drift out of date.

     PART 2 no longer reaches into PART 3: camera shake is emitted as a
     cosmetic 'shake' event and applied by consumeEvents() in the view.
     EV is drained by runHeadless() and never hashed, so no stub is needed. */
  const content = await import('../src/content/index.js');
  const sandbox = { ...content };
  return vm.runInNewContext(pureSimSource(src) + FOOTER, vm.createContext(sandbox));
}

const idle = () => ({});
/* 31 steps is the dry attack cadence (CONTENT-GUIDE.md section 5.5). */
const combat = (i) => ({
  mx: Math.sin(i / 41), my: Math.cos(i / 29),
  attack: i % 31 === 0, roll: i % 211 === 0, magic: i % 601 === 0,
});

export async function computeDigests() {
  const src = readFileSync(GAME, 'utf8');
  const api = await buildApi(src);

  const solo = (seed, steps, fn) => api.runHeadless(seed, steps, fn);
  const coop = (seed, steps) => {
    api.setSim(api.newSim(seed >>> 0, 2));
    api.getSim().phase = 'play';
    for (let i = 0; i < steps; i++) {
      api.drainEV();
      api.simStep({
        p1: api.normInput({ mx: 0.4, my: 0.1, attack: i % 31 === 0 }),
        p2: api.normInput({ mx: -0.3, my: 0.2, attack: i % 37 === 0, roll: i % 233 === 0 }),
      });
    }
    return api.simDigest(api.getSim());
  };

  const checks = {
    fresh: api.simDigest(api.newSim(0x51A7E)),
    idle600: solo(0x51A7E, 600, idle),
    combat3600: solo(0xC0FFEE, 3600, combat),
    combat3600_altSeed: solo(0x13579B, 3600, combat),
    coop1200: coop(0x51A7E, 1200),
  };

  /* Determinism: an identical second pass must produce byte-identical values. */
  const again = {
    fresh: api.simDigest(api.newSim(0x51A7E)),
    idle600: solo(0x51A7E, 600, idle),
    combat3600: solo(0xC0FFEE, 3600, combat),
    combat3600_altSeed: solo(0x13579B, 3600, combat),
    coop1200: coop(0x51A7E, 1200),
  };
  for (const k of Object.keys(checks)) {
    if (checks[k] !== again[k])
      throw new Error(`non-deterministic sim digest for ${k}: ${checks[k]} vs ${again[k]}`);
  }

  const combined = createHash('sha256')
    .update(JSON.stringify(checks), 'utf8').digest('hex');
  return {
    sourceSha256: createHash('sha256').update(src, 'utf8').digest('hex'),
    build: api.CFG.net.build,
    heroCosts: { ...api.CFG.meta.heroCosts },
    simContentSha256: simContentHash(),
    checks,
    combined,
  };
}

const IS_MAIN = process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
const arg = IS_MAIN ? process.argv[2] : null;
if (!IS_MAIN) {
  /* imported by scripts/content-check.mjs — export only, no CLI output */
} else if (arg === '--baseline') {
  const out = await computeDigests();
  writeFileSync(BASELINE, JSON.stringify(out, null, 2) + '\n');
  console.log('baseline written to scripts/content-baseline.json');
  console.log(JSON.stringify(out.checks, null, 2));
  console.log('combined ' + out.combined);
  console.log('net build ' + out.build);
} else if (arg === '--check') {
  let base;
  try { base = JSON.parse(readFileSync(BASELINE, 'utf8')); }
  catch (e) { console.error('no baseline — run with --baseline first'); process.exit(2); }
  const now = await computeDigests();
  const diffs = [];
  for (const k of Object.keys(base.checks)) {
    if (base.checks[k] !== (now.checks[k] || '(missing)'))
      diffs.push(`${k}: ${base.checks[k]} -> ${now.checks[k] || '(missing)'}`);
  }
  if (base.build !== now.build) diffs.push(`net build: ${base.build} -> ${now.build}`);
  if (diffs.length) {
    console.error('DIGEST MOVED — simulation behaviour changed:');
    for (const d of diffs) console.error('  ' + d);
    process.exit(1);
  }
  console.log('digest unchanged (' + now.combined.slice(0, 16) + '…) — view-only change confirmed');
  console.log('net build ' + now.build + ' — no bump required');
} else if (arg === '--help') {
  console.log('usage: digest-harness.mjs [--baseline|--check]');
} else {
  console.log(JSON.stringify(await computeDigests(), null, 2));
}
