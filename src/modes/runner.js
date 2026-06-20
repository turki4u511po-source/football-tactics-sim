// ===========================================================================
// modes/runner.js — run a full match headlessly (in memory) and return a
// summary. Deterministic by seed. Powers the seeded what-if A/B tool and the
// "test against archetypes" sweep. No DOM.
// ===========================================================================

import { World } from '../engine/world.js';
import { step } from '../engine/simulation.js';
import { makeRng } from '../engine/rng.js';
import { FIXED_DT } from '../engine/constants.js';
import { poss } from '../analytics/analytics.js';

export function runMatch(opts, seed) {
  const w = new World({ seed, ...opts });
  const rng = makeRng(seed);
  let t = 0;
  while (w.phase !== 'fulltime' && t < 200000) {
    step(w, rng, FIXED_DT);
    t++;
  }
  return summarize(w);
}

function summarize(w) {
  return {
    score: { home: w.score.home, away: w.score.away },
    shots: { home: w.stats.home.shots, away: w.stats.away.shots },
    xg: { home: +w.stats.home.xg.toFixed(2), away: +w.stats.away.xg.toFixed(2) },
    xt: { home: Math.round(w.xt.home), away: Math.round(w.xt.away) },
    poss: { home: poss(w, 'home'), away: poss(w, 'away') },
    aiChanges: w.ai.changes.length,
  };
}
