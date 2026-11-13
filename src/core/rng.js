/* Extracted verbatim from src/game.js by scripts/migrate.mjs.
   The sim owns ONE xorshift32 state (an object with .rng/.rngCalls);
   mkRng() makes independent cosmetic-only streams. */
function nextU32(x){
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return x >>> 0;
}
function rnd(s){ s.rng = nextU32(s.rng); s.rngCalls++; return s.rng / 4294967296; }
function rndR(s,a,b){ return a + (b-a)*rnd(s); }
function rndI(s,n){ return Math.floor(rnd(s)*n); }
/* Cosmetic-only RNG. Never touches sim.rng and never writes sim state. */
function mkRng(seed){ let x=(seed>>>0)||1; return function(){ x=nextU32(x); return x/4294967296; }; }

export { nextU32, rnd, rndR, rndI, mkRng };
