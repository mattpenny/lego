// Assemble ONE self-contained HTML file from the shell template.
// Usage: node _build.js [template.html] [output.html]
//   defaults: _shell.html -> 3d_arena_action_combat.html
// Every path is resolved next to THIS script, so the repo builds on any machine.
const fs = require('fs');
const path = require('path');

const here = __dirname;
const read = f => fs.readFileSync(path.resolve(here, f), 'utf8');

const [template = '_shell.html', output = '3d_arena_action_combat.html'] = process.argv.slice(2);

let html = read(template);
const core = read('_three_core.js');
const parts = ['_g1.js', '_g2.js', '_g3.js', '_g4.js'].map(read);
const game = parts.join('\n');

fs.writeFileSync(path.resolve(here, '_game_combined.js'), game);

// Replacer FUNCTIONS: string replacements would interpret $&, $`, $' inside three.js.
html = html.replace('/*__CORE__*/', () => core);
html = html.replace('/*__GAME__*/', () => game);
fs.writeFileSync(path.resolve(here, output), html);

const net = [...html.matchAll(/(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+/gi)].map(m => m[0]);
console.log('built', output, html.length, 'bytes |', html.split('\n').length, 'lines');
console.log('external src/href refs:', net.length, net.slice(0, 5));
