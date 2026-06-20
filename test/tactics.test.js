// ===========================================================================
// tactics.test.js — proves Phase 3: tactical settings VISIBLY change behaviour.
// Runs paired full matches (one setting flipped) and asserts the measurable
// difference goes the right way. Pure engine, deterministic.
// ===========================================================================

import { World } from '../src/engine/world.js';
import { step } from '../src/engine/simulation.js';
import { makeRng } from '../src/engine/rng.js';
import { FIXED_DT } from '../src/engine/constants.js';
import { defaultTactics, roleLayer } from '../src/tactics/tactics.js';

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const stdev = (a) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
};

// Measure home-team behaviour over a full match with the given home tactics.
function measure(homeOverrides, seed) {
  const homeTactics = { ...defaultTactics(), ...homeOverrides };
  const w = new World({ seed, homeTactics });
  const rng = makeRng(seed);
  const C = 34; // pitch centre (WIDTH/2)
  const isWide = (p) => /(RW|LW|RB|LB)/.test(p.role);
  let defDepth = 0, defN = 0, teamX = 0, teamXN = 0, wideY = 0, wideN = 0;
  let t = 0;
  while (w.phase !== 'fulltime' && t < 200000) {
    step(w, rng, FIXED_DT);
    t++;
    if (t % 12 !== 0) continue; // sample to keep it quick
    const ogX = w.ownGoal('home').x;
    const out = w.home.filter((p) => !p.isGK);
    const def = out.filter((p) => roleLayer(p.role) === 0);
    const owner = w.ball.owner;
    if (owner && owner.team === 'away') {
      defDepth += mean(def.map((p) => Math.abs(p.x - ogX)));
      defN++;
    } else if (owner && owner.team === 'home') {
      teamX += mean(out.map((p) => Math.abs(p.x - ogX)));
      teamXN++;
      wideY += mean(out.filter(isWide).map((p) => Math.abs(p.y - C)));
      wideN++;
    }
  }
  const possTicks = w.stats.home.possTicks;
  const poss = possTicks / (possTicks + w.stats.away.possTicks || 1);
  return {
    defDepth: defDepth / (defN || 1),
    teamX: teamX / (teamXN || 1),
    wideY: wideY / (wideN || 1),
    passPerPossSec: w.stats.home.passes / (possTicks / 30 || 1),
    poss,
  };
}

// average a metric over a few seeds for stability
function avg(overrides, key, seeds = [11, 22, 33]) {
  return mean(seeds.map((s) => measure(overrides, s)[key]));
}

let failures = 0;
const assert = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
};

console.log('Phase 3 — settings visibly change behaviour\n');

const deepLine = avg({ line: 'deep' }, 'defDepth');
const highLine = avg({ line: 'veryhigh' }, 'defDepth');
assert(highLine > deepLine + 12, `defensive line: very-high sits ${(highLine - deepLine).toFixed(0)}m higher than deep (${deepLine.toFixed(0)}→${highLine.toFixed(0)}m)`);

const defMent = avg({ mentality: 'defensive' }, 'teamX');
const attMent = avg({ mentality: 'attacking' }, 'teamX');
assert(attMent > defMent + 4, `mentality: attacking pushes ${(attMent - defMent).toFixed(0)}m further up than defensive`);

const narrow = avg({ width: 'narrow' }, 'wideY');
const wide = avg({ width: 'wide' }, 'wideY');
assert(wide > narrow + 3, `width: wide pushes the flanks ${(wide - narrow).toFixed(1)}m wider (${narrow.toFixed(0)}→${wide.toFixed(0)}m from centre)`);

const slow = avg({ tempo: 'slow' }, 'passPerPossSec');
const fast = avg({ tempo: 'high' }, 'passPerPossSec');
assert(fast > slow * 1.15, `tempo: high plays faster (${fast.toFixed(2)} vs ${slow.toFixed(2)} passes/possession-sec)`);

const possession = avg({ playstyle: 'possession' }, 'poss');
const counter = avg({ playstyle: 'counter' }, 'poss');
assert(possession > counter, `playstyle: possession keeps more of the ball (${(possession * 100).toFixed(0)}%) than counter (${(counter * 100).toFixed(0)}%)`);

if (failures) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log('\nAll checks passed.');
