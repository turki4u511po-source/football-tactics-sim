// ===========================================================================
// determinism.test.js — headless smoke test (run with: npm test).
// Proves two foundational guarantees from the spec:
//   1. The engine is DECOUPLED from rendering — it runs with no DOM/Canvas.
//   2. It is DETERMINISTIC — same seed ⇒ bit-identical match; and that real
//      motion actually happens (ball + players move).
// No test framework / no dependencies; exits non-zero on failure.
// ===========================================================================

import { World } from '../src/engine/world.js';
import { step } from '../src/engine/simulation.js';
import { makeRng } from '../src/engine/rng.js';
import { FIXED_DT } from '../src/engine/constants.js';

function simulate(seed, ticks) {
  const rng = makeRng(seed);
  const world = new World({ seed });
  let ballPath = 0;
  let playerPath = 0;
  let bx = world.ball.x;
  let by = world.ball.y;
  const sample = world.players[5]; // a home central midfielder
  let sx = sample.x;
  let sy = sample.y;

  for (let i = 0; i < ticks; i++) {
    step(world, rng, FIXED_DT);
    ballPath += Math.hypot(world.ball.x - bx, world.ball.y - by);
    bx = world.ball.x;
    by = world.ball.y;
    playerPath += Math.hypot(sample.x - sx, sample.y - sy);
    sx = sample.x;
    sy = sample.y;
  }
  return { world, ballPath, playerPath };
}

function snapshot(world) {
  const parts = [];
  for (const p of world.players) parts.push(p.x.toFixed(6), p.y.toFixed(6), p.hasBall ? 1 : 0);
  parts.push(world.ball.x.toFixed(6), world.ball.y.toFixed(6));
  parts.push(world.clock.toFixed(6), world.score.home, world.score.away);
  return parts.join('|');
}

let failures = 0;
function assert(cond, msg) {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
}

const TICKS = 3000; // 100 in-game seconds
console.log('Determinism & motion smoke test (no DOM, pure engine)\n');

const a = simulate(42, TICKS);
const b = simulate(42, TICKS);
const c = simulate(1337, TICKS);

assert(snapshot(a.world) === snapshot(b.world), 'same seed reproduces an identical match');
assert(snapshot(a.world) !== snapshot(c.world), 'a different seed produces a different match');
assert(a.ballPath > 10, `the ball actually moves (path ≈ ${a.ballPath.toFixed(0)} m)`);
assert(a.playerPath > 5, `players actually move (sample path ≈ ${a.playerPath.toFixed(0)} m)`);
assert(Math.abs(a.world.clock - TICKS * FIXED_DT) < 1e-6, `clock advanced to ${a.world.clock.toFixed(0)}s in-game`);

console.log(
  `\nseed 42 → ball at (${a.world.ball.x.toFixed(1)}, ${a.world.ball.y.toFixed(1)}), ` +
    `${a.world.ball.owner ? 'held by ' + a.world.ball.owner.id : 'loose'}`
);

if (failures) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed.');
