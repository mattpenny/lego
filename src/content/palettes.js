/* Extracted verbatim from src/game.js by scripts/migrate.mjs.
   Chapter palettes (index 0 = chapter 1). buildMapData() stays in game.js. */
export const PALETTES = [
  { name:'GRASSLAND', sky:0x7fa6c8, fog:0x86a488, ground:'#40672f', ground2:'#4d7436',
    path:'#a8925f', pond:0x3f86a6, tree:0x2f6a32, trunk:0x5a432c, rock:0x77796e,
    hill:0x5b6152, accent:0xffd98a, light:0xfff0d0, hemi:0xbcd8ff, amb:0.85 },
  { name:'GRAVEYARD FOREST', sky:0x394a62, fog:0x3b4a4a, ground:'#28382f', ground2:'#314035',
    path:'#6a6a61', pond:0x2f5f5c, tree:0x2b3a30, trunk:0x3b332c, rock:0x636b66,
    hill:0x454c4a, accent:0xa8d8c8, light:0xbcd0ff, hemi:0x7f9bc0, amb:0.70 },
  { name:'VOLCANO CASTLE', sky:0x542a2c, fog:0x5a3029, ground:'#2b2228', ground2:'#37282a',
    path:'#4c3a34', pond:0xff5a1e, tree:0x3a2622, trunk:0x2c2020, rock:0x4a3a3a,
    hill:0x3b2b2b, accent:0xff8a3c, light:0xffb070, hemi:0xa05a50, amb:0.72 }
];
