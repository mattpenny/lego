#!/usr/bin/env node
/* =====================================================================
   build-single.mjs — the single-file PHONE build.

   The browser build is a module graph:
     index.html -> src/three.js (CLASSIC, bare top-level consts) +
                   src/main.js -> src/game.js -> src/content/** (ESM)

   A phone build must be ONE .html with no network fetches. This script
   bundles the ESM graph into a classic <script> by rewriting every module
   into a lazily-evaluated factory with a tiny __req() registry, then inlines
   three.js, the content bundle and src/game.css into a copy of index.html.

   Why a hand-rolled bundler instead of Vite/Rollup/esbuild: this checkout
   has no node_modules and `npm install` is unavailable in this environment.
   The module graph is small, static and acyclic, so a deterministic 120-line
   bundler is safer here than a build dependency.

   src/three.js deliberately stays a CLASSIC script: src/game.js reads its
   top-level consts (WebGLRenderer, Scene, ...) as bare globals.

   Usage:
     node scripts/build-single.mjs            write dist-single/aetherblade.html
     node scripts/build-single.mjs --check    fail if the build is stale
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist-single', 'aetherblade.html');
const ENTRY = 'src/main.js';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const rel = (p) => posix.normalize(relative(ROOT, p).split('\\').join('/'));

function resolveImport(from, spec) {
  if (!spec.startsWith('.')) throw new Error(`non-relative import "${spec}" in ${from}`);
  return rel(resolve(dirname(join(ROOT, from)), spec));
}

/** Rewrite one ESM file into a CommonJS-ish factory body.
    Only the static forms this codebase uses are supported; anything else
    fails loudly rather than silently producing a broken phone build. */
function transform(from, src) {
  const deps = [];
  const named = [];        // { local, exported }
  let defaultExpr = null;

  let out = src;

  /* -- imports: named lists (single- or multi-line) -- */
  out = out.replace(
    /^[ \t]*import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]\s*;[ \t]*$/gm,
    (_, spec, specPath) => {
      const to = resolveImport(from, specPath);
      deps.push(to);
      const pairs = spec.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
        const m = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(x);
        return m ? `${m[1]}: ${m[2]}` : x;
      });
      return `const { ${pairs.join(', ')} } = __req(${JSON.stringify(to)});`;
    },
  );

  /* -- imports: default / namespace / side-effect -- */
  out = out.replace(
    /^[ \t]*import\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]\s*;[ \t]*$/gm,
    (_, name, specPath) => {
      const to = resolveImport(from, specPath); deps.push(to);
      return `const ${name} = __req(${JSON.stringify(to)}).default;`;
    },
  );
  out = out.replace(
    /^[ \t]*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['"]([^'"]+)['"]\s*;[ \t]*$/gm,
    (_, name, specPath) => {
      const to = resolveImport(from, specPath); deps.push(to);
      return `const ${name} = __req(${JSON.stringify(to)});`;
    },
  );
  out = out.replace(
    /^[ \t]*import\s*['"]([^'"]+)['"]\s*;[ \t]*$/gm,
    (_, specPath) => {
      const to = resolveImport(from, specPath); deps.push(to);
      return `__req(${JSON.stringify(to)});`;
    },
  );
  if (/^[ \t]*import\b/m.test(out))
    throw new Error(`${from}: unsupported import form left after transform`);

  /* -- export declarations: just strip the keyword, record the name -- */
  out = out.replace(
    /^([ \t]*)export\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm,
    (_, indent, kind, name) => { named.push({ local: name, exported: name }); return `${indent}${kind} ${name}`; },
  );

  /* -- export { a, b as c } [from './x.js']; -- */
  out = out.replace(
    /^[ \t]*export\s*\{([\s\S]*?)\}\s*(?:from\s*['"]([^'"]+)['"])?\s*;[ \t]*$/gm,
    (_, spec, specPath) => {
      const to = specPath ? resolveImport(from, specPath) : null;
      if (to) deps.push(to);
      for (const raw of spec.split(',').map((x) => x.trim()).filter(Boolean)) {
        const m = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(raw);
        const local = m ? m[1] : raw, exported = m ? m[2] : raw;
        named.push({ local: to ? `__req(${JSON.stringify(to)}).${local}` : local, exported });
      }
      return '';
    },
  );

  /* -- export default EXPR; -- */
  out = out.replace(
    /^[ \t]*export\s+default\s+([\s\S]*?);[ \t]*$/gm,
    (_, expr) => { defaultExpr = expr.replace(/\s+/g, ' ').trim(); return ''; },
  );
  if (/^[ \t]*export\b/m.test(out))
    throw new Error(`${from}: unsupported export form left after transform`);

  /* Export assignments live at the END so forward references and re-exports
     of imports resolve to the final value. */
  const tail = named.map((n) => `__exports[${JSON.stringify(n.exported)}] = ${n.local};`).join('\n');
  if (defaultExpr !== null) {
    return { deps, body: `'use strict';\n${out}\n${tail}\n__exports.default = ${defaultExpr};` };
  }
  return { deps, body: `'use strict';\n${out}\n${tail}` };
}

/** Walk the static graph from ENTRY; returns modules in dependency-first order. */
function collect() {
  const seen = new Set(), order = [], mods = {};
  function visit(path) {
    if (seen.has(path)) return;
    seen.add(path);
    if (!existsSync(join(ROOT, path))) throw new Error(`missing module: ${path}`);
    const { deps, body } = transform(path, read(path));
    for (const d of deps) visit(d);
    mods[path] = body;
    order.push(path);
  }
  visit(ENTRY);
  return { order, mods };
}

function bundle() {
  const { order, mods } = collect();
  const defs = order.map((p) =>
    `__fns[${JSON.stringify(p)}] = function(__req, __exports){\n${mods[p]}\n};`).join('\n');
  return `/* AETHERBLADE content bundle — generated by scripts/build-single.mjs.\n` +
    `   ${order.length} modules. Do not hand-edit; run npm run single:build. */\n` +
    `(function(){\n` +
    `  var __fns = {}, __mods = {}, __busy = {};\n` +
    `  function __req(path){\n` +
    `    if (__mods[path]) return __mods[path];\n` +
    `    if (__busy[path]) throw new Error('content cycle at ' + path);\n` +
    `    if (!__fns[path]) throw new Error('missing content module ' + path);\n` +
    `    __busy[path] = 1;\n` +
    `    var e = {}; __mods[path] = e;\n` +
    `    __fns[path](__req, e);\n` +
    `    delete __busy[path];\n` +
    `    return e;\n` +
    `  }\n` +
    defs + '\n' +
    `  __req(${JSON.stringify(ENTRY)});\n` +
    `})();\n`;
}

/** Inline src/game.css, src/three.js and the ESM bundle into index.html. */
function renderSingle() {
  let html = read('index.html');
  const css = read('src/game.css');
  const three = read('src/three.js');
  if (css.includes('</style') || three.includes('</script'))
    throw new Error('an inline asset contains a closing tag — cannot inline safely');
  /* Replacer FUNCTIONS (not strings): the inlined sources contain '$' which
     String.replace would otherwise interpret as $& / $' / $1 patterns. */
  html = html.replace('<link rel="stylesheet" href="src/game.css">',
    () => `<style>\n${css}\n</style>`);
  html = html.replace('<script src="src/three.js"></script>',
    () => `<script>\n${three}\n</script>`);
  html = html.replace('<script type="module" src="src/main.js"></script>',
    () => `<script>\n${bundle()}\n</script>`);
  for (const tag of [
    '<script src="src/three.js"></script>',
    '<script type="module" src="src/main.js"></script>',
    '<link rel="stylesheet" href="src/game.css">',
  ]) {
    if (html.includes(tag)) throw new Error('index.html shell changed — update build-single.mjs anchors: ' + tag);
  }
  return html;
}

const check = process.argv.includes('--check');
const html = renderSingle();
const sha = createHash('sha256').update(html, 'utf8').digest('hex');

if (check) {
  if (!existsSync(OUT)) {
    console.error('single build missing — run npm run single:build'); process.exit(1);
  }
  const current = readFileSync(OUT, 'utf8');
  if (current !== html) {
    console.error('single build is STALE — run npm run single:build'); process.exit(1);
  }
  console.log(`single build current — ${orderCount()} modules, ${html.length} bytes, sha ${sha.slice(0, 16)}…`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, html);
  console.log(`wrote dist-single/aetherblade.html — ${orderCount()} modules, ${html.length} bytes`);
  console.log(`sha256 ${sha}`);
}

function orderCount() { return collect().order.length; }
