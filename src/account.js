/* =====================================================================
   AETHERBLADE — account progression client (Phase M2).

   The server-owned profile client for the aetherblade-api Worker:
   session storage, the auth/profile calls, the versioned account stat
   derivation (ACCOUNT-PROGRESSION-PLAN section 6) and the public
   progression snapshot that crosses the co-op handshake.

   This module is VIEW-LAYER infrastructure: it is never imported by
   the deterministic sim, and nothing in it runs at import time (no
   DOM, storage or network access until a function is called), so the
   headless boot/single smoke harnesses load it inertly. The sim only
   ever sees the DERIVED stat block, inserted into a hero's `mods`
   before tick 0 — exactly where the legacy localStorage tracks used
   to land.

   API shape note: the plan (section 3) sketched versioned /v1 paths,
   but the deployed M1 Worker serves unversioned routes
   (/auth/register, /auth/login, /auth/logout, /auth/reset, /profile)
   and its profile DTO carries no economy/profile version fields.
   This client codes to the DEPLOYED API; PROGRESSION_VERSION and
   ECONOMY_VERSION below are therefore client-side constants in M2
   and become server-issued fields when the API grows them.
   ===================================================================== */

export const API_DEFAULT = 'https://aetherblade-api.ccac-church.workers.dev';
export const SESSION_KEY = 'aetherblade-session-v1';

/* Handshake versions (plan section 6): a pairing is refused when
   either differs, in the same hard-fail style as the build stamp.
   PROGRESSION_VERSION covers the accountStats() formula below;
   ECONOMY_VERSION covers the reward/cost formulas (no economy calls
   exist in M2 — the constant rides the snapshot so a future economy
   change refuses stale pairings instead of drifting). */
export const PROGRESSION_VERSION = 1;
export const ECONOMY_VERSION = 1;

export const ACCOUNT_LEVEL_CAP = 30;

/* The plan section 5/6 gains, as data — the single source both
   accountStats() and the STATS.md generator read. Per account level
   above 1 (g = level - 1): HP +2*g, damage +floor(g/2), speed
   +0.01*g. Per equipment level: see `per` on each slot. */
export const ACCOUNT_GAINS = {
  levelCap: ACCOUNT_LEVEL_CAP,
  hpPerLevel: 2,
  dmgPerTwoLevels: 1,
  spdPerLevel: 0.01,
  slots: [
    { key: 'weapon', api: 'Weapon', label: 'WEAPON', stat: 'damage', per: 2 },
    { key: 'armour', api: 'Armour', label: 'ARMOUR', stat: 'max HP', per: 8 },
    { key: 'helm', api: 'Helm', label: 'HELM', stat: 'crit chance', per: 0.01 },
    { key: 'boots', api: 'Boots', label: 'BOOTS', stat: 'move speed', per: 0.075 },
    { key: 'charm', api: 'Charm', label: 'CHARM', stat: 'magic damage', per: 2 },
  ],
  /* Equipment upgrade costs (plan section 5), charged BY THE SERVER
     in M3; mirrored here only so the Armoury can display the exact
     price before the player commits. Cost to upgrade TO level T:
     gold 40 + 20(T-1) + 4(T-1)^2, shards ceil(T/3). */
  upgradeCost: { goldBase: 40, goldPerStep: 20, goldQuad: 4, shardDivisor: 3 },
};

/* Cost to upgrade one slot TO target level T (1..10). Display only —
   the server recomputes from its stored level and is authoritative. */
export function upgradeCostFor(targetLevel) {
  const c = ACCOUNT_GAINS.upgradeCost;
  const t = Math.min(10, Math.max(1, targetLevel | 0)) - 1;
  return {
    gold: c.goldBase + c.goldPerStep * t + c.goldQuad * t * t,
    shards: Math.ceil((t + 1) / c.shardDivisor),
  };
}

/* ---------- derived stat block (plan section 6) ---------- */

export function zeroBlock() {
  return { hp: 0, dmg: 0, spd: 0, crit: 0, magicDmg: 0 };
}

function clampInt(v, lo, hi) {
  v = Math.round(Number(v));
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

/* Normalise an equipment object with LOWERCASE slot keys to the five
   clamped levels accountStats() consumes. Unknown keys are dropped. */
export function sanitizeEquipment(raw) {
  const out = {};
  for (const s of ACCOUNT_GAINS.slots)
    out[s.key] = clampInt(raw && raw[s.key], 0, 10);
  return out;
}

/* The versioned derivation. level 1 + all-zero equipment is the zero
   block exactly (integer zeros; speed 0.01*0 + 0.075*0 === 0). */
export function accountStats(level, equipment) {
  const g = clampInt(level, 1, ACCOUNT_LEVEL_CAP) - 1;
  const eq = sanitizeEquipment(equipment);
  return {
    hp: ACCOUNT_GAINS.hpPerLevel * g + ACCOUNT_GAINS.slots[1].per * eq.armour,
    dmg: Math.floor(g / 2) * ACCOUNT_GAINS.dmgPerTwoLevels + ACCOUNT_GAINS.slots[0].per * eq.weapon,
    spd: ACCOUNT_GAINS.spdPerLevel * g + ACCOUNT_GAINS.slots[3].per * eq.boots,
    crit: ACCOUNT_GAINS.slots[2].per * eq.helm,
    magicDmg: ACCOUNT_GAINS.slots[4].per * eq.charm,
  };
}

/* API profile DTO (capitalised equipment keys) -> derived block. */
export function profileBlock(profile) {
  if (!profile) return zeroBlock();
  const eq = {};
  for (const s of ACCOUNT_GAINS.slots)
    eq[s.key] = profile.equipment ? profile.equipment[s.api] : 0;
  return accountStats(profile.level, eq);
}

/* ---------- public progression snapshot (plan section 6) ---------- */

/* What crosses the co-op handshake: identity + derivation inputs,
   never balances in spendable form beyond the public level/ kit,
   and never the session token. Gold/shards/total XP stay home. */
export function profileSnapshot(profile, user, heroId) {
  const eq = {};
  for (const s of ACCOUNT_GAINS.slots)
    eq[s.key] = profile && profile.equipment ? profile.equipment[s.api] : 0;
  return sanitizeSnapshot({
    displayName: user ? user.username : 'PLAYER',
    accountLevel: profile ? profile.level : 1,
    equipment: eq,
    heroId: heroId || 'hero',
  });
}

export function guestSnapshot(heroId) {
  return sanitizeSnapshot({
    displayName: 'GUEST',
    accountLevel: 1,
    equipment: { weapon: 0, armour: 0, helm: 0, boots: 0, charm: 0 },
    heroId: heroId || 'hero',
  });
}

/* Canonicalise a snapshot received from a peer (or built locally) so
   every client derives from byte-identical inputs. heroId is passed
   through as a string — callers run it through safeHero(). */
export function sanitizeSnapshot(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    displayName: String(r.displayName == null ? 'GUEST' : r.displayName).slice(0, 24) || 'GUEST',
    accountLevel: clampInt(r.accountLevel, 1, ACCOUNT_LEVEL_CAP),
    equipment: sanitizeEquipment(r.equipment),
    heroId: String(r.heroId == null ? 'hero' : r.heroId),
    progressionVersion: r.progressionVersion == null ? PROGRESSION_VERSION : (r.progressionVersion | 0),
    economyVersion: r.economyVersion == null ? ECONOMY_VERSION : (r.economyVersion | 0),
  };
}

export function snapshotBlock(snap) {
  if (!snap) return zeroBlock();
  return accountStats(snap.accountLevel, snap.equipment);
}

/* ---------- progression digest (plan section 6) ---------- */

/* JSON with recursively sorted keys — the canonical form both sides
   hash. Numbers serialise via String(), identical on every client
   because the inputs were sanitised through the same clamps. */
export function canonicalJSON(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJSON).join(',') + ']';
  return '{' + Object.keys(v).sort()
    .map((k) => JSON.stringify(k) + ':' + canonicalJSON(v[k])).join(',') + '}';
}

function fnv1aHex(str) {
  let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return 'fnv:' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/* SHA-256 (crypto.subtle) where the platform offers it — every
   secure-context browser does — with a deterministic FNV fallback for
   the rare context without it. The algorithm tag is part of the
   digest string, so a mixed pair mismatches loudly instead of
   silently agreeing on different hashes. */
async function sha256Hex(str) {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return 'sha256:' + [...new Uint8Array(buf)]
        .map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* fall through to the FNV form */ }
  return fnv1aHex(str);
}

/* Digest over the AGREED roster: each player's canonical snapshot +
   the stat block this client derives from it. Host and guests compute
   it over the same start payload; a mismatch refuses the pairing. */
async function rosterDigest(players) {
  const canon = (players || []).map((p) => ({
    slot: p.slot, snap: sanitizeSnapshot(p.snap), block: snapshotBlock(p.snap),
  }));
  return sha256Hex(canonicalJSON(canon));
}

/* ---------- session storage (plan section 2) ---------- */

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && typeof s.token === 'string' && s.token) return s;
  } catch (e) { /* storage unavailable — session simply does not persist */ }
  return null;
}

export function saveSession(token, expiresAt) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt: expiresAt || null })); }
  catch (e) { /* see loadSession */ }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* see loadSession */ }
}

/* ---------- API client ---------- */

/* Base-URL resolution mirrors the co-op relay override pattern in
   game.js: ?api= query param, then localStorage 'aetherblade-api',
   then the deployed production Worker. */
export function apiBase() {
  try {
    const q = new URLSearchParams(location.search).get('api');
    if (q) return q.replace(/\/+$/, '');
    const ls = localStorage.getItem('aetherblade-api');
    if (ls) return ls.replace(/\/+$/, '');
  } catch (e) { /* non-browser context */ }
  return API_DEFAULT;
}

/* One call. Resolves {status, body} for ANY HTTP response (errors are
   data: body.error.message is the player-facing string); rejects only
   on transport failure, which callers treat as "account unavailable". */
async function apiCall(path, opts) {
  const o = opts || {};
  const headers = { 'Content-Type': 'application/json' };
  if (o.token) headers.Authorization = 'Bearer ' + o.token;
  const res = await fetch(apiBase() + path, {
    method: o.method || 'GET',
    headers,
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
  });
  let body = null;
  try { body = await res.json(); } catch (e) { /* non-JSON error page */ }
  return { status: res.status, body };
}

export function apiErrorText(r, fallback) {
  return (r && r.body && r.body.error && r.body.error.message) || fallback;
}

export const apiRegister = (username, password, email) =>
  apiCall('/auth/register', { method: 'POST', body: { username, password, email } });
export const apiLogin = (username, password) =>
  apiCall('/auth/login', { method: 'POST', body: { username, password } });
export const apiLogout = (token) =>
  apiCall('/auth/logout', { method: 'POST', token });
export const apiReset = (username, recoveryCode, newPassword) =>
  apiCall('/auth/reset', { method: 'POST', body: { username, recoveryCode, newPassword } });
export const apiProfile = (token) =>
  apiCall('/profile', { token });

/* Phase M3: server progression. /health reports the API scope; the
   game enables server run crediting + equipment spending only when
   the scope is 'M3', and otherwise keeps the exact M2 behaviour
   (push-order safety: the game ships before the API redeploy). */
export const apiHealth = () =>
  apiCall('/health', {});
export const apiSubmitRun = (token, payload) =>
  apiCall('/runs', { method: 'POST', token, body: payload });
export const apiUpgradeEquipment = (token, slot, idempotencyKey) =>
  apiCall('/equipment/upgrade', { method: 'POST', token, body: { slot, idempotencyKey } });

/* Email (2026-11-14): accounts carry an email for reset-by-email.
   The reset request answers 503 EMAIL_NOT_CONFIGURED until the
   Worker has a RESEND_API_KEY secret; the UI says so plainly and
   points at the recovery code. */
export const apiSetEmail = (token, email) =>
  apiCall('/profile/email', { method: 'POST', token, body: { email } });
export const apiResetEmailRequest = (username, email) =>
  apiCall('/auth/reset-email/request', { method: 'POST', body: { username, email } });
export const apiResetEmailConfirm = (username, code, newPassword) =>
  apiCall('/auth/reset-email/confirm', { method: 'POST', body: { username, code, newPassword } });

/* Client-side email shape check; the server validates strictly and
   is authoritative — this only saves a round trip for typos. */
export function emailLooksValid(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/* The async functions above are declared without the export keyword
   (the single-file bundler has no `export async function` form) and
   exported here instead. */
export { sha256Hex, rosterDigest, apiCall };
