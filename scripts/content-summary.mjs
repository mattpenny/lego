#!/usr/bin/env node
/* =====================================================================
   content-summary.mjs — the "everything is traceable" report.

   Lists every content id, its type, its SOURCE FILE, its provenance date and
   the simulation values it contributes. Run `npm run content:summary`.
   This is the audit view of the architecture CONTENT-GUIDE.md describes.
   ===================================================================== */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { REGISTRY, SIM_CONTENT, contentSummary } from '../src/content/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'src', 'content');

/** Find the descriptor file that declares `export const <id> =`. */
function sourceFileFor(exportName, folder) {
  const dir = join(DIR, folder);
  if (!existsSync(dir)) return '(folder missing)';
  const files = readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'index.js').sort();
  for (const f of files) {
    const text = readFileSync(join(dir, f), 'utf8');
    if (new RegExp('export const ' + exportName + '\\s*=').test(text))
      return 'src/content/' + folder + '/' + f;
  }
  return '(not found)';
}

function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object')
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const simHash = createHash('sha256').update(stable(SIM_CONTENT), 'utf8').digest('hex');

const folders = {
  HEROES: 'heroes', FIGURES: 'figures', ENEMIES: 'enemies',
  BOSSES: 'enemies/bosses', ITEMS: 'items', PROPS: 'props',
  MAPS: 'maps', UPGRADES: 'upgrades',
};

console.log('AETHERBLADE CONTENT REGISTRY');
console.log('='.repeat(78));
console.log('counts  ' + JSON.stringify(contentSummary().counts));
console.log('net     ' + SIM_CONTENT.rules.net.build);
console.log('');

for (const [type, table] of Object.entries(REGISTRY)) {
  console.log('-- ' + type + ' (' + Object.keys(table).length + ') ' +
    '-'.repeat(Math.max(0, 60 - type.length)));
  for (const [key, d] of Object.entries(table)) {
    /* MAPS / BOSSES are keyed by chapter number, so resolve by the descriptor
       id (kebab-case) and then its camelCase export name. */
    const ident = String(d.id || key);
    const camel = ident.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    let file = sourceFileFor(ident, folders[type]);
    if (file === '(not found)') file = sourceFileFor(camel, folders[type]);
    const bits = [];
    if (d.cfg && typeof d.cfg === 'object') bits.push('cfg:' + Object.keys(d.cfg).length);
    if (d.sharedSim) bits.push('sim:' + d.sharedSim.split('/').pop());
    if (d.cap !== undefined) bits.push('cap:' + d.cap);
    if (d.fill) bits.push('fill#' + d.fill.order + '/w' + d.fill.weight);
    if (d.wave) bits.push('wave@' + d.wave.from);
    if (d.figure) bits.push('figure:' + d.figure);
    if (d.parts) bits.push('parts:' + d.parts.length);
    if (d.map && d.map.seed) bits.push('seed:' + d.map.seed);
    if (d.sim && d.sim.drop) bits.push('drop:' + d.sim.drop);
    if (d.collider) bits.push('collider:' + d.collider.kind);
    if (d.price !== undefined) bits.push('price:' + d.price);
    if (d.chapter) bits.push('ch:' + d.chapter);
    console.log('  ' + String(d.id || key).padEnd(19) + file.padEnd(48) + bits.join(' '));
  }
  console.log('');
}

console.log('Load-bearing orders (SIM_CONTENT hash guards all of them):');
console.log('  fill pool   ' + SIM_CONTENT.fillPool.map((f) => f.kind).join(' -> '));
console.log('  upgrades    ' + SIM_CONTENT.upgradeOrder.join(' -> '));
console.log('  map seeds   ' + SIM_CONTENT.maps.map((m) => m.seed).join(' -> '));
console.log('  boss names  ' + Object.values(REGISTRY.BOSSES).map((b) => b.name).join(' / '));
console.log('  sim hash    ' + simHash);
