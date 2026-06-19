// ===========================================================================
// rng.js — deterministic seeded PRNG (mulberry32)
// Every random decision in the engine MUST flow through one of these so that
// "same seed + same tactics ⇒ identical match" holds. Never use Math.random().
// ===========================================================================

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // convenience helpers (all deterministic, all derived from the same stream)
  rng.range = (min, max) => min + (max - min) * rng();
  rng.int = (min, max) => Math.floor(min + (max - min + 1) * rng());
  rng.chance = (p) => rng() < p;
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.spread = (s) => (rng() - 0.5) * 2 * s; // symmetric jitter in [-s, s]
  return rng;
}

// Hash an arbitrary string to a 32-bit seed so users can type word seeds.
export function hashSeed(str) {
  str = String(str);
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
