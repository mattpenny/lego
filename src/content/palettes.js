/* Extracted verbatim from src/game.js by scripts/migrate.mjs.
   Chapter palettes (index 0 = chapter 1). buildMapData() stays in game.js. */
export const PALETTES = [
  { name:'GRASSLAND', sky:0x8ec7f0, fog:0xa4cda6, ground:'#4da337', ground2:'#66bb47',
    path:'#c7ab6d', pond:0x2fa3dd, tree:0x35a047, trunk:0x7d5c39, rock:0x9aa294,
    hill:0x86a374, accent:0xffd98a, light:0xfff0d0, hemi:0xbcd8ff, amb:1.02 },
  { name:'GRAVEYARD FOREST', sky:0x5a7396, fog:0x64807a, ground:'#40604b', ground2:'#4f7358',
    path:'#92927f', pond:0x43a89e, tree:0x406652, trunk:0x615244, rock:0x939e97,
    hill:0x6d7d78, accent:0xc2ecdc, light:0xbcd0ff, hemi:0x9db9e2, amb:0.95 },
  { name:'VOLCANO CASTLE', sky:0x7a3a30, fog:0x84452f, ground:'#4d3638', ground2:'#63453a',
    path:'#7d5a44', pond:0xff7030, tree:0x5c3d2d, trunk:0x4d3630, rock:0x745854,
    hill:0x654a3e, accent:0xffa657, light:0xffb070, hemi:0xc97f66, amb:0.92 }
];
