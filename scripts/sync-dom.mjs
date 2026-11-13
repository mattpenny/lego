#!/usr/bin/env node
/* =====================================================================
   sync-dom.mjs — regenerate index.html from the ONE authored DOM source.

   src/game.dom.html is the authored body markup (also consumed by the
   single-file phone build). index.html is a GENERATED shell around it.
   Never hand-edit the body of index.html: run `npm run dom:sync` instead.
   `npm run content:check` fails if the two drift apart.

   The duplication is intentional (a plain classic <script> tag is needed
   for the vendored three.js, so the page cannot fetch a DOM fragment at
   runtime) — but only ONE of the two is authored by hand.
   ===================================================================== */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOM = join(ROOT, 'src/game.dom.html');
const HTML = join(ROOT, 'index.html');

const HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>AETHERBLADE — 3D Arena Survivor</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="src/game.css">
</head>
<body>
`;

const FOOT = `
<script src="src/three.js"></script>
<script type="module" src="src/main.js"></script>
</body>
</html>
`;

/** The exact body markup index.html must contain, derived from the DOM source. */
export function expectedBody() {
  return readFileSync(DOM, 'utf8').trim();
}

export function renderIndexHtml() {
  return HEAD + expectedBody() + FOOT;
}

/** Extract the generated body region from an index.html string. */
export function bodyFromIndex(html) {
  const a = html.indexOf('<body>');
  const b = html.indexOf('<script src="src/three.js"></script>');
  if (a < 0 || b < 0) return null;
  return html.slice(a + '<body>'.length, b).trim();
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const before = readFileSync(HTML, 'utf8');
  const after = renderIndexHtml();
  if (before === after) console.log('index.html already in sync with src/game.dom.html');
  else {
    writeFileSync(HTML, after);
    console.log('index.html regenerated from src/game.dom.html');
  }
}
