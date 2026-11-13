/* Extracted verbatim from src/game.js by scripts/migrate.mjs.
   The in-run pick-3 upgrade pool. apply(s) mutates sim state; heroStats()
   (which reads this pool's counters) stays in game.js for phase 1. */
export const UPGRADES = [
  {id:'hide',  ic:'♥', name:'IRON HIDE',   ds:'+25 max HP and heal 25.', apply(s){ s.hero.maxHp+=25; s.hero.hp=Math.min(s.hero.maxHp,s.hero.hp+25); }},
  {id:'edge',  ic:'⚔', name:'HONED EDGE',  ds:'+20% sword damage.',       apply(s){ s.up.edge++; }},
  {id:'tempo', ic:'»', name:'QUICK TEMPO', ds:'-12% attack cooldown.',    apply(s){ s.up.tempo++; }},
  {id:'reach', ic:'↗', name:'LONG REACH',  ds:'+0.5 m range, +10° arc.',  apply(s){ s.up.reach++; }},
  {id:'boots', ic:'⇢', name:'SWIFT BOOTS', ds:'+8% move speed.',          apply(s){ s.up.boots++; }},
  {id:'reflex',ic:'↺', name:'REFLEXES',    ds:'-20% roll cooldown.',      apply(s){ s.up.reflex++; }},
  {id:'magnet',ic:'◈', name:'GEM MAGNET',  ds:'+0.9 m pickup radius.',    apply(s){ s.up.magnet++; }},
  {id:'crit',  ic:'✦', name:'KEEN EYE',    ds:'+15% critical chance.',    apply(s){ s.up.crit++; }},
  {id:'siphon',ic:'✚', name:'BLOOD SIPHON',ds:'Heal 3 HP on every kill.', apply(s){ s.up.siphon++; }}
];

/* ---- hand-authored mirror (NOT migrate-extracted) ----
   The permanent meta-progression tracks. In phase 1 the source of truth
   is CFG.meta inside src/game.js:
     costs [40,80,140,220,320] gold per step, 5 steps per track,
     hpPer +8 max HP, dmgPer +2 hero damage, spdPer +0.15 move speed,
     chapter clearBonus +50 G, victoryBonus +200 G,
     hero skin costs { soldier:150, archer:200, sorcerer:250, knight:300 }.
   This mirror exists so new code can import the data without game.js;
   if CFG.meta changes, update this to match (checked 2026-11-13). */
export const META = {
  costs: [40, 80, 140, 220, 320],
  steps: 5,
  clearBonus: 50,
  victoryBonus: 200,
  tracks: [
    { id: 'hp',  name: 'VITALITY', per: 8,    unit: 'max HP' },
    { id: 'dmg', name: 'POWER',    per: 2,    unit: 'damage' },
    { id: 'spd', name: 'SWIFTNESS', per: 0.15, unit: 'move speed' },
  ],
  heroCosts: { soldier: 150, archer: 200, sorcerer: 250, knight: 300 },
};
