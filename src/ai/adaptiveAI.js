// ===========================================================================
// ai/adaptiveAI.js — the adaptive opponent (controls the AWAY team).
// Deterministic: it reads match state at intervals (and just after goals / at
// half-time) and makes ONE tactical change, so it reacts to the player's
// patterns rather than following a script. Runs inside the engine step.
// ===========================================================================

import { poss } from '../analytics/analytics.js';

const INTERVAL = { easy: 15 * 60, normal: 10 * 60, hard: 7 * 60 };

// Called every tick; cheap (mostly a clock check).
export function updateAI(world) {
  const ai = world.ai;
  if (!ai || !ai.enabled || world.phase !== 'play') return;
  if (world.clock < ai.nextEval) return;
  ai.nextEval = world.clock + (INTERVAL[ai.difficulty] || INTERVAL.normal);
  evaluate(world);
}

// Force a re-think soon after a goal or at the start of the second half.
export function aiReactSoon(world, delay = 5) {
  if (world.ai && world.ai.enabled) world.ai.nextEval = Math.min(world.ai.nextEval, world.clock + delay);
}

function evaluate(world) {
  const ai = world.ai;
  const me = ai.team;
  const opp = world.other(me);
  const t = world.tactics[me];
  const diff = world.score[me] - world.score[opp];
  const oppPoss = poss(world, opp);
  const hard = ai.difficulty === 'hard';
  const easy = ai.difficulty === 'easy';

  let change = null;
  let reason = null;

  if (diff <= -2 || (diff <= -1 && world.clock > 60 * 60)) {
    // chasing the game → throw caution out
    if (t.mentality !== 'attacking') { change = { mentality: 'attacking' }; reason = 'chasing the game'; }
    else if (t.line === 'deep' || t.line === 'normal') { change = { line: 'high' }; reason = 'pushing the line up'; }
    else if (t.pressing === 'low' || t.pressing === 'mid') { change = { pressing: 'high' }; reason = 'pressing higher' ; }
  } else if (diff >= 1 && world.clock > 72 * 60) {
    // protecting a lead late → park the bus
    if (t.mentality !== 'defensive') { change = { mentality: 'defensive' }; reason = 'protecting the lead'; }
    else if (t.line !== 'deep') { change = { line: 'deep' }; reason = 'dropping deeper'; }
    else if (t.pressing !== 'low') { change = { pressing: 'low' }; reason = 'low block, burning time'; }
  } else if (!easy && oppPoss > 60) {
    // being dominated on the ball → sit and counter
    if (t.playstyle !== 'counter') { change = { playstyle: 'counter' }; reason = 'countering the pressure'; }
    else if (t.line === 'veryhigh' || t.line === 'high') { change = { line: 'normal' }; reason = 'compacting the block'; }
    else if (t.pressing === 'gegenpress' || t.pressing === 'high') { change = { pressing: 'mid' }; reason = 'conserving energy'; }
  }

  // smarter levels notice their high line being beaten over the top
  if ((hard || !easy) && !change && t.line === 'veryhigh' && world.stats[opp].xg > world.stats[me].xg + 1) {
    change = { line: 'high' };
    reason = 'the high line was being beaten in behind';
  }
  // hard difficulty also matches the player's dominant attacking flank
  if (hard && !change && oppPoss > 52) {
    const sh = world.shotLog.filter((s) => s.team === opp);
    if (sh.length >= 4) {
      const left = sh.filter((s) => s.y < 34).length / sh.length;
      if (left > 0.66 && t.focus !== 'left') { change = { focus: 'left' }; reason = 'doubling up where they attack'; }
      else if (left < 0.34 && t.focus !== 'right') { change = { focus: 'right' }; reason = 'doubling up where they attack'; }
    }
  }

  if (change) {
    world.setTactics(me, change);
    ai.changes.push({ minute: Math.floor(world.clock / 60), change, reason });
  }
}
