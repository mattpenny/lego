/* RANGER — holds a 7-11 m band and fires a dodgeable bolt every 2.3 s. */
export const ranger = {
  id: 'ranger', kind: 'ranger', type: 'enemy', cls: 'ranged', figure: 'ranger',
  cfg: {
    hp: 38, speed: 3.25, dmg: 13, radius: 0.42, score: 160,
    minRange: 7, maxRange: 11, volley: 2.3, projSpeed: 10.5, projR: 0.38,
  },
  cap: 3, wave: null, elite: false, events: [],
  /* The only ramped weight in the fill pool: 18 + elapsed*0.05. */
  fill: { order: 3, weight: 18, ramp: 0.05 },
  added: '2026-11-13',
  notes: 'cap 3 is CFG.caps.rangers — the only cap this kind has (no wave entry).',
  behaviour: ['Facing locks at fire, so a sidestep after the shot dodges it. Two sword hits.'],
};
export default ranger;
