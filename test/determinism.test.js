// ===========================================================================
// determinism.test.js — headless smoke test (run with: npm test).
// Proves the spec's foundations, now through a FULL Phase-2 match:
//   1. DECOUPLED   — the engine runs with no DOM/Canvas (pure Node).
//   2. DETERMINISTIC — same seed ⇒ bit-identical match (score, stats, state).
//   3. ALIVE       — ball + players move; a full 90' match completes with a
//                    scoreline, two halves, and stoppage time.
// No test framework / no dependencies; exits non-zero on failure.
// ===========================================================================

import { World } from '../src/engine/world.js';
import { step } from '../src/engine/simulation.js';
import { makeRng } from '../src/engine/rng.js';
import { FIXED_DT, HALF_SECONDS, TICK_RATE } from '../src/engine/constants.js';

const MAX_TICKS = 200000; // safety cap (full match ≈ 171k ticks)

function playFullMatch(seed) {
  const rng = makeRng(seed);
  const world = new World({ seed });
  let ballPath = 0;
  let playerPath = 0;
  let bx = world.ball.x, by = world.ball.y;
  const sample = world.players[9];
  let sx = sample.x, sy = sample.y;

  let ticks = 0;
  while (world.phase !== 'fulltime' && ticks < MAX_TICKS) {
    step(world, rng, FIXED_DT);
    ballPath += Math.hypot(world.ball.x - bx, world.ball.y - by);
    bx = world.ball.x; by = world.ball.y;
    playerPath += Math.hypot(sample.x - sx, sample.y - sy);
    sx = sample.x; sy = sample.y;
    ticks++;
  }
  return { world, ballPath, playerPath, ticks };
}

function snapshot(world) {
  const parts = [];
  for (const p of world.players) parts.push(p.x.toFixed(5), p.y.toFixed(5));
  parts.push(world.ball.x.toFixed(5), world.ball.y.toFixed(5));
  parts.push(world.score.home, world.score.away, world.clock.toFixed(5));
  for (const team of ['home', 'away']) {
    const s = world.stats[team];
    parts.push(s.shots, s.shotsOnTarget, s.passes, s.passesCompleted, s.interceptions, s.tackles, s.possTicks);
  }
  return parts.join('|');
}

function possPct(world) {
  const h = world.stats.home.possTicks;
  const a = world.stats.away.possTicks;
  const tot = h + a || 1;
  return Math.round((100 * h) / tot);
}

let failures = 0;
const assert = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

console.log('Phase 2 — full-match determinism & flow (no DOM, pure engine)\n');

const a = playFullMatch(42);
const b = playFullMatch(42);
const c = playFullMatch(1337);

assert(snapshot(a.world) === snapshot(b.world), 'same seed reproduces an identical full match');
assert(snapshot(a.world) !== snapshot(c.world), 'a different seed produces a different match');
assert(a.world.phase === 'fulltime', 'the match reaches full time');
assert(a.world.half === 2, 'the match played two halves');
assert(a.world.clock >= 2 * HALF_SECONDS, `clock passed 90:00 incl. stoppage (final ${(a.world.clock / 60).toFixed(1)}m)`);
assert(a.ballPath > 1000 && a.playerPath > 1000, `ball & players cover real distance (ball ${a.ballPath.toFixed(0)}m)`);
const totalGoals = a.world.score.home + a.world.score.away;
assert(totalGoals <= 14, `scoreline is plausible (${a.world.score.home}-${a.world.score.away})`);
assert(a.world.stats.home.shots > 0 && a.world.stats.away.shots > 0, 'both teams registered shots');

console.log('\nSample scorelines:');
for (const seed of [42, 7, 1337, 2024, 99]) {
  const { world: w, ticks } = playFullMatch(seed);
  const realSecs = (ticks / TICK_RATE / 18).toFixed(1); // 18x compression at 1x
  console.log(
    `  seed ${String(seed).padStart(4)}  ${w.score.home}-${w.score.away}  ` +
      `| poss ${possPct(w)}%-${100 - possPct(w)}%  ` +
      `| shots ${w.stats.home.shots}/${w.stats.away.shots} (SOT ${w.stats.home.shotsOnTarget}/${w.stats.away.shotsOnTarget})  ` +
      `| pass% ${pct(w.stats.home.passesCompleted, w.stats.home.passes)}/${pct(w.stats.away.passesCompleted, w.stats.away.passes)}  ` +
      `| ~${realSecs}s @1x`
  );
}

function pct(ok, total) {
  return total ? Math.round((100 * ok) / total) : 0;
}

if (failures) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed.');
