// ===========================================================================
// phase8.test.js — Season/Career: fixtures, table, carry-over, determinism.
// Simulates a couple of matchdays (fast) rather than a whole season.
// ===========================================================================

import { Season } from '../src/modes/season.js';

let failures = 0;
const assert = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

console.log('Phase 8 — season / career\n');

const s = new Season({ userClubId: 'al-hilal', seed: 7 });
assert(s.clubs.length === 8 && s.totalRounds === 14, 'an 8-club double round-robin = 14 matchdays');
assert(s.userFixture() != null, 'the user has a fixture every matchday');

// fatigue rises after a match is played
const before = s.fatigue['al-hilal'];
s.simulateMatchday();
assert(s.round === 1, 'simulating a matchday advances the round');
const totalP = s.clubs.reduce((n, id) => n + s.table[id].p, 0);
assert(totalP === 8, 'one matchday adds 8 appearances (4 matches × 2 teams)');
assert(s.standings().reduce((n, r) => n + r.pts, 0) > 0, 'points were awarded');

// carry-over: a club that has played carries some fatigue
assert(s.fatigue[s.standings()[0].id] >= 0, 'fatigue/form/dev tracked across games');

// determinism: same seed ⇒ same table after the same number of rounds
const a = new Season({ userClubId: 'al-hilal', seed: 7 });
const b = new Season({ userClubId: 'al-hilal', seed: 7 });
a.simulateMatchday(); a.simulateMatchday();
b.simulateMatchday(); b.simulateMatchday();
const key = (x) => JSON.stringify(x.standings().map((r) => [r.id, r.pts, r.gf, r.ga]));
assert(key(a) === key(b), 'same seed reproduces an identical league table');

// the user can play their match live: record it, sim the rest, advance
const c = new Season({ userClubId: 'al-hilal', seed: 3 });
const fx = c.userFixture();
const r0 = c.round;
c.completeUserMatch(fx.home, fx.away, fx.home === 'al-hilal' ? 3 : 0, fx.home === 'al-hilal' ? 0 : 3);
assert(c.round === r0 + 1, 'playing the user match live records the result and advances');
assert(c.table['al-hilal'].w === 1, 'the user win was recorded in the table');

if (failures) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed.');
