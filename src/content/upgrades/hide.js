/* IRON HIDE — +25 max HP and heal 25, for EVERY hero in co-op. */
export const hide = {
  id: 'hide', type: 'upgrade', ic: '♥',
  displayName: 'IRON HIDE', description: '+25 max HP and heal 25.',
  added: '2026-11-13',
  apply(s) { for (const h of s.heroes) { h.maxHp += 25; h.hp = Math.min(h.maxHp, h.hp + 25); } },
};
export default hide;
