/* HERALDIC BANNER KNIGHT — support ELITE (archery pack 2026-11-14,
   integrated AB-NET-20). Crimson cloth, gold trim and the back banner
   live in figures/heraldic-banner-knight.js.

   Its threat is the banner zone: every 12 s it plants a destroyable
   40 HP banner whose 4 m zone heals TRASH enemies (never elites or
   bosses) at 5 HP/s — +1 HP per 0.2 s tick, the pack's integer-
   friendly accumulator. The pack's `banner` block is flattened into
   cfg (banner*); bannerRange 8 is the plant trigger from the pack's
   behaviour lines ("if the hero is within 8 m"). The banner is a sim
   entity (s.banners): heroes damage it with sword and arrows, and
   killing the knight is not required to stop the heal. Event packs
   only: chapters 3-6 (see the map descriptors). */
export const heraldicBannerKnight = {
  id: 'heraldic-banner-knight', kind: 'heraldic-banner-knight', type: 'enemy', cls: 'melee', figure: 'heraldic-banner-knight',
  cfg: {
    hp: 185, speed: 2.9, dmg: 24, radius: 0.6, score: 950,
    reach: 2.1, arcDeg: 100, tele: 0.65, recovery: 0.75, cd: 1.8,
    bannerTele: 0.8, bannerHp: 40, bannerZone: 4, bannerHealPerSec: 5,
    bannerHealTick: 0.2, bannerDur: 12, bannerCd: 12, bannerRange: 8,
  },
  cap: 1, wave: null, elite: true, events: [3, 4, 5, 6], fill: null,
  added: '2026-11-14',
  notes: 'Elite support unit. Its threat is the banner zone; killing the knight is not required to stop the heal, and destroying the 40 HP banner is the clean counter. Cap 1. Intended for 90 s elite events and chapter 3-6 event packs.',
  behaviour: [
    'Melee approach; swings at 2.1 m reach, 100 deg arc, 0.65 s telegraph, 24 dmg.',
    'If its banner cooldown is ready, no banner of its own is alive, and the hero is within 8 m, it plants a banner at its current position after a 0.8 s plant telegraph.',
    'The banner has 40 HP, lasts 12 s, and heals trash enemies within 4 m for 1 HP every 0.2 s (5 HP/s). It does not heal elites or bosses.',
    'Banner cooldown is 12 s from plant; only one banner alive from this elite.',
    'Counter-play: destroy the 40 HP banner, or pull trash out of the 4 m zone; the knight\u2019s melee is slow enough to kite.',
  ],
};
export default heraldicBannerKnight;
