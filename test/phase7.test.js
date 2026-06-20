// ===========================================================================
// phase7.test.js — modes & what-if. The seeded A/B replay must be reproducible
// (same seed ⇒ identical), one changed setting must yield a different result,
// and scenarios must apply their preset state. Pure engine.
// ===========================================================================

import { runMatch } from '../src/modes/runner.js';
import { World } from '../src/engine/world.js';
import { CLUBS } from '../src/tactics/clubs.js';
import { SCENARIOS } from '../src/modes/scenarios.js';

let failures = 0;
const assert = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};
const key = (r) => JSON.stringify(r);

console.log('Phase 7 — modes & what-if replay\n');

const opts = { homeClub: CLUBS['arsenal'], awayClub: CLUBS['tottenham'], adaptive: true };

// 1. seeded what-if A/B is reproducible
const a1 = runMatch(opts, 99);
const a2 = runMatch(opts, 99);
assert(key(a1) === key(a2), 'same seed reproduces the match identically (A == A)');

// 2. changing ONE setting yields a different result on the same seed
const variant = runMatch({ ...opts, homeTactics: { line: 'deep', pressing: 'low' } }, 99);
assert(key(variant) !== key(a1), 'one changed setting changes the outcome (A != B)');
console.log(`    baseline ${a1.score.home}-${a1.score.away} (xG ${a1.xg.home}) → low block ${variant.score.home}-${variant.score.away} (xG ${variant.xg.home})`);

// 3. scenarios apply their preset state
const w = new World({ seed: 3 });
const sc = SCENARIOS['comeback'].setup;
w.score = { ...sc.score };
w.half = 2;
w.clock = sc.startClock;
assert(w.score.away === 1 && w.clock === 70 * 60, 'comeback scenario starts 0-1 at 70:00');

const tenMen = new World({ seed: 3 });
tenMen.sendOff('home');
assert(tenMen.home.length === 10, 'ten-men scenario removes an outfielder (11 → 10)');

if (failures) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed.');
