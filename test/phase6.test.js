// ===========================================================================
// phase6.test.js — clubs load with distinct identities, the AI adapts, and the
// whole thing stays deterministic. Pure engine.
// ===========================================================================

import { World } from '../src/engine/world.js';
import { step } from '../src/engine/simulation.js';
import { makeRng } from '../src/engine/rng.js';
import { FIXED_DT } from '../src/engine/constants.js';
import { CLUBS } from '../src/tactics/clubs.js';
import { roleLayer } from '../src/tactics/tactics.js';

function run(opts, seed, ticks = 200000) {
  const w = new World({ seed, ...opts });
  const rng = makeRng(seed);
  let t = 0;
  while (w.phase !== 'fulltime' && t < ticks) {
    step(w, rng, FIXED_DT);
    t++;
  }
  return w;
}

function snap(w) {
  return [w.score.home, w.score.away, w.stats.home.shots, w.stats.away.shots, w.stats.home.xg.toFixed(3), w.ai.changes.length].join('|');
}

// average home defensive-line depth (from own goal) while defending
function defenceDepth(homeClubId, seed) {
  const w = new World({ seed, homeClub: CLUBS[homeClubId], adaptive: false });
  const rng = makeRng(seed);
  let sum = 0, n = 0, t = 0;
  while (w.phase !== 'fulltime' && t < 200000) {
    step(w, rng, FIXED_DT);
    t++;
    if (t % 15 || !(w.ball.owner && w.ball.owner.team === 'away')) continue;
    const ogX = w.ownGoal('home').x;
    const def = w.home.filter((p) => !p.isGK && roleLayer(p.role) === 0);
    sum += def.reduce((s, p) => s + Math.abs(p.x - ogX), 0) / def.length;
    n++;
  }
  return sum / (n || 1);
}

let failures = 0;
const assert = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

console.log('Phase 6 — clubs + adaptive AI\n');

// 1. determinism with clubs + AI
const a = run({ homeClub: CLUBS['man-city'], awayClub: CLUBS['atletico'] }, 21);
const b = run({ homeClub: CLUBS['man-city'], awayClub: CLUBS['atletico'] }, 21);
assert(snap(a) === snap(b), 'same seed + same clubs reproduces an identical match');

// 2. the adaptive AI actually makes changes (and can be turned off)
const adaptOn = run({ homeClub: CLUBS['man-city'], awayClub: CLUBS['al-qadsiah'], adaptive: true }, 21);
const adaptOff = run({ homeClub: CLUBS['man-city'], awayClub: CLUBS['al-qadsiah'], adaptive: false }, 21);
assert(adaptOn.ai.changes.length >= 1, `adaptive AI made ${adaptOn.ai.changes.length} in-match change(s)`);
assert(adaptOff.ai.changes.length === 0, 'AI adaptation can be switched off (sandbox)');

// 3. clubs have visibly different identities: Barça's line is far higher than Atlético's
const barca = defenceDepth('barcelona', 5);
const atleti = defenceDepth('atletico', 5);
assert(barca > atleti + 10, `Barça defends ${(barca - atleti).toFixed(0)}m higher than Atlético (${atleti.toFixed(0)}→${barca.toFixed(0)}m)`);

if (failures) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed.');
