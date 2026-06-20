// ===========================================================================
// simulation.js — the per-tick update. Pure logic: given (world, rng, dt) it
// advances the match one fixed step. No DOM, no rendering, no wall-clock.
//
// Phase 2 model:
//   • On-ball decisions: pass / dribble / shoot / clear, chosen by a weighted
//     score from goal distance+angle, pressure, passing lanes and attributes.
//   • Probabilistic outcomes: passes can be intercepted in the lane; tackles
//     win the ball off a carrier; shots can be saved by the keeper.
//   • Shots & goals; keeper saves (catch / parry).
//   • Proper restarts: kickoff, throw-in, corner, goal kick.
//   • Match flow: two 45' halves + stoppage time, half-time end-swap, full time.
// (Tactics, xG/xT and the adaptive AI arrive in later phases; hooks are here.)
// ===========================================================================

import {
  PITCH, PLAYER, BALL, SIM, DECISION, PASS, SHOT, GK, MATCH, STAMINA, FOUL_RATE,
  FIXED_DT, HALF_SECONDS, TEAM, CLOCK_RATE, DEADBALL_CLOCK_MULT,
} from './constants.js';
import { dist, dist2, norm, clamp, lerp, approach } from './vec.js';
import { roleLayer, isFullback } from '../tactics/tactics.js';
import { xgModel, xtValue, heatIndex, makeGrid } from '../analytics/analytics.js';
import { updateAI, aiReactSoon } from '../ai/adaptiveAI.js';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export function step(world, rng, dt = FIXED_DT) {
  if (world.phase === 'fulltime') return;

  // first-half stoppage time, decided once, deterministically
  if (world.tick === 0 && world.injury == null) {
    world.injury = rng.int(MATCH.INJ1_MIN, MATCH.INJ1_MAX);
  }

  snapshotPrev(world);

  if (world.phase === 'halftime') {
    updateHalftime(world, rng, dt);
    world.playTime += dt;
    world.tick += 1;
    return;
  }

  if (world.phase === 'deadball') updateDeadball(world, rng, dt);
  else updatePlay(world, rng, dt);

  updateAI(world); // adaptive opponent (no-op until its next evaluation)

  // movement time advances naturally; the match clock is decoupled — it runs
  // faster during play and even faster during restarts (dead time is skipped)
  world.playTime += dt;
  const clockMul = world.phase === 'deadball' ? CLOCK_RATE * DEADBALL_CLOCK_MULT : CLOCK_RATE;
  world.clock += dt * clockMul;
  world.tick += 1;
  checkClock(world);
}

function snapshotPrev(world) {
  for (const p of world.players) {
    p.px = p.x;
    p.py = p.y;
  }
  world.ball.px = world.ball.x;
  world.ball.py = world.ball.y;
}

// End-of-half / end-of-match transitions (hard whistle at threshold).
function checkClock(world) {
  if (world.half === 1 && world.clock >= HALF_SECONDS + world.injury) {
    world.phase = 'halftime';
    world.htTimer = MATCH.HALFTIME_PAUSE;
  } else if (world.half === 2 && world.clock >= 2 * HALF_SECONDS + world.injury) {
    world.phase = 'fulltime';
  }
}

function updateHalftime(world, rng, dt) {
  for (const p of world.players) {
    steerTo(p, p.home, dt, p.isGK ? PLAYER.GK_SPEED : PLAYER.BASE_SPEED);
  }
  world.htTimer -= dt;
  if (world.htTimer <= 0) {
    world.mirrorEnds();
    world.half = 2;
    world.clock = HALF_SECONDS; // resume the clock at 45:00
    world.injury = rng.int(MATCH.INJ2_MIN, MATCH.INJ2_MAX);
    aiReactSoon(world, 8); // the AI re-evaluates early in the second half
    world.startKickoff(world.other(world.firstKickoff));
  }
}

// ---------------------------------------------------------------------------
// Dead-ball restarts (kickoff / goal kick / throw-in / corner)
// ---------------------------------------------------------------------------
function updateDeadball(world, rng, dt) {
  const r = world.restart;
  const b = world.ball;
  b.x = r.x;
  b.y = r.y;
  b.vx = b.vy = 0;

  for (const p of world.players) {
    let t;
    if (r.type === 'kickoff') {
      if (p === r.receiver) {
        const dir = world.attackDir[p.team];
        t = { x: PITCH.LENGTH / 2 - dir * 1.4, y: PITCH.WIDTH / 2 };
      } else {
        t = p.home;
      }
    } else {
      t = p === r.receiver ? { x: r.x, y: r.y } : shiftedHome(p, world);
    }
    steerTo(p, t, dt, p.isGK ? PLAYER.GK_SPEED : PLAYER.BASE_SPEED);
  }

  r.timer -= dt;
  if (r.timer <= 0) {
    const rec = r.receiver || world.nearestTeammateTo(r.team, r);
    b.owner = rec;
    rec.hasBall = true;
    rec.holdTime = 0;
    rec.carryTime = 0;
    rec.nextDecision = r.type === 'kickoff' ? 0.4 : decisionTime(world, rec.team, rng);
    b.isShot = b.isPass = false;
    b.lastKicker = null;
    b.selfLock = 0;
    world.lastTouchTeam = rec.team;
    world.phase = 'play';
    world.restart = null;
  }
}

// ---------------------------------------------------------------------------
// Open play
// ---------------------------------------------------------------------------
function updatePlay(world, rng, dt) {
  const b = world.ball;
  if (b.owner) {
    const team = b.owner.team;
    world.stats[team].possTicks++;
    // expected threat added: positive jumps in danger while in possession
    const xt = xtValue(b.x, b.y, world.attackingGoal(team).x);
    if (xt > world._lastXt[team]) world.xt[team] += xt - world._lastXt[team];
    world._lastXt[team] = xt;
    carrierLogic(world, rng, dt);
  } else {
    flightLogic(world, rng, dt);
  }
  if (world.phase === 'play') moveAll(world, dt);
  if (world.tick % 6 === 0) sampleHeat(world);
}

function sampleHeat(world) {
  // normalise to a constant attacking direction so the half-time end-swap
  // doesn't average every player's heat toward the centre
  for (const p of world.players) {
    let g = world.heat[p.id];
    if (!g) g = world.heat[p.id] = makeGrid();
    const nx = world.attackDir[p.team] > 0 ? p.x : PITCH.LENGTH - p.x;
    g[heatIndex(nx, p.y)] += 1;
  }
}

// --- the player on the ball -------------------------------------------------
function carrierLogic(world, rng, dt) {
  const b = world.ball;
  const c = b.owner;
  c.carryTime += dt;
  c.holdTime += dt;

  // glue the ball just ahead of the carrier
  const facing =
    Math.hypot(c.vx, c.vy) > 0.4
      ? norm({ x: c.vx, y: c.vy })
      : norm({ x: world.attackDir[c.team], y: 0 });
  b.x = clamp(c.x + facing.x * 1.05, 0, PITCH.LENGTH);
  b.y = clamp(c.y + facing.y * 1.05, 0, PITCH.WIDTH);
  b.vx = c.vx;
  b.vy = c.vy;

  // an adjacent opponent may tackle the ball away
  const opp = nearestOpponentWithin(world, c, PLAYER.STEAL_RADIUS);
  if (opp) {
    const tk = SIM.STEAL_CHANCE_PER_TICK * (0.6 + opp.attr.tackling / 100) * (1.2 - c.attr.dribbling / 200);
    if (rng.chance(tk)) {
      if (rng.chance(FOUL_RATE)) {
        // a foul — free kick to the carrier's team, no possession change
        world.stats[opp.team].fouls++;
        world.setRestart('freekick', c.team, b.x, b.y);
      } else {
        world.stats[opp.team].tackles++;
        giveBall(world, opp, rng);
      }
      return;
    }
  }

  if (c.holdTime >= c.nextDecision) chooseAndExecute(c, world, rng);
}

function chooseAndExecute(c, world, rng) {
  const tn = world.tuning[c.team];
  const goal = world.attackingGoal(c.team);
  const dGoal = dist(c, goal);
  const pressure = pressureCount(c, world);
  const forced = c.carryTime >= DECISION.MAX_CARRY;

  // SHOOT — a chance-quality score (xG-like, 0..1); only good chances win out
  let shoot = -1;
  if (!c.isGK && dGoal < SHOT.RANGE) {
    const prox = clamp(1 - dGoal / SHOT.RANGE, 0, 1);
    const ang = goalAngleFactor(c, goal);
    const quality = prox * ang * (1 - 0.14 * pressure) * (0.55 + 0.45 * c.attr.shooting / 100);
    // only shoot genuinely good chances — half-chances get recycled, which keeps
    // shot volume (and scorelines) sane even against a pinned opponent
    if (quality >= SHOT.MIN_QUALITY) shoot = clamp(quality, 0, 1) * SHOT.EAGERNESS * tn.shootEager + rng.spread(0.03);
  }

  // PASS / THROUGH-BALL (a progressive pass into space behind the line)
  const pass = bestPass(c, world);
  const passScore = pass ? pass.score : -1;
  const through = bestThroughBall(c, world);
  const throughScore = through ? through.score : -1;

  // DRIBBLE (never dribble the ball into the keeper from point-blank range)
  let dribble = -1;
  if (!c.isGK && !forced && dGoal > 5) {
    const space = spaceAhead(c, world);
    dribble = space * (0.45 + 0.55 * c.attr.dribbling / 100) - 0.12 * pressure + (dGoal < 45 ? 0.05 : 0);
  }

  // CLEAR (deep defenders/keeper; long build-up boots it, short build-up keeps it)
  let clear = -1;
  if (deepInOwnThird(c, world)) clear = 0.4 + 0.12 * pressure + tn.buildupLong * 0.45;

  let action = 'dribble';
  let bestv = dribble;
  if (passScore > bestv) { action = 'pass'; bestv = passScore; }
  if (throughScore > bestv) { action = 'through'; bestv = throughScore; }
  if (shoot > bestv) { action = 'shoot'; bestv = shoot; }
  if (clear > bestv) { action = 'clear'; bestv = clear; }
  if (forced && action === 'dribble') action = through ? 'through' : pass ? 'pass' : 'clear';

  if (action === 'shoot') executeShot(c, world, rng);
  else if (action === 'through') executeThroughBall(c, through.target, world, rng);
  else if (action === 'pass') executePass(c, pass.mate, world, rng);
  else if (action === 'clear') executeClear(c, world, rng);
  else {
    // keep dribbling; re-decide shortly (scaled by tempo)
    c.holdTime = 0;
    c.nextDecision = DECISION.DRIBBLE_GAP * world.tuning[c.team].tempoMul;
  }
}

// --- candidate evaluation ---------------------------------------------------
function bestPass(c, world) {
  const tn = world.tuning[c.team];
  const goal = world.attackingGoal(c.team);
  const dGoalC = dist(c, goal);
  let best = null;
  let bestScore = 0.3; // low bar: keep a recycle option so bad chances are passed, not shot
  // directness trades openness (keep it) against progression (force it forward)
  const wOpen = 0.65 - 0.3 * tn.directness;
  const wProg = 0.12 + 0.4 * tn.directness;
  for (const m of world.teamPlayers(c.team)) {
    if (m === c || m.isGK) continue;
    const d = dist(c, m);
    if (d < SIM.PASS_MIN_RANGE || d > SIM.PASS_MAX_RANGE) continue;
    const progress = clamp((dGoalC - dist(m, goal)) / 30, -1, 1);
    const open = laneOpenness(c, m, world);
    const recPress = pressureCount(m, world);
    let score = wOpen * open + wProg * ((progress + 1) / 2) - 0.2 * recPress + 0.1 * (c.attr.passing / 100);
    if (tn.focus === 'left' && m.y < PITCH.WIDTH / 2) score += 0.05;
    else if (tn.focus === 'right' && m.y > PITCH.WIDTH / 2) score += 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best ? { mate: best, score: bestScore } : null;
}

function laneOpenness(a, b, world) {
  let minD = Infinity;
  for (const o of world.opponentsOf(a.team)) {
    const dd = pointSegDist(o, a, b);
    if (dd < minD) minD = dd;
  }
  return clamp(minD / 3.5, 0, 1);
}

function laneOpennessPoint(a, pt, world) {
  let minD = Infinity;
  for (const o of world.opponentsOf(a.team)) {
    if (o.isGK) continue;
    const dd = pointSegDist(o, a, pt);
    if (dd < minD) minD = dd;
  }
  return clamp(minD / 3.5, 0, 1);
}

// A progressive pass into the space ahead of an advancing team-mate. This is
// what breaks a defensive block and what punishes a high line (big space behind).
function bestThroughBall(c, world) {
  const goal = world.attackingGoal(c.team);
  const dGoalC = dist(c, goal);
  let best = null;
  let bestScore = 0.66; // through-balls are special: require a genuine opening
  for (const m of world.teamPlayers(c.team)) {
    if (m === c || m.isGK) continue;
    const dm = dist(c, m);
    if (dm < 6 || dm > 42) continue;
    if (dist(m, goal) > dGoalC - 4) continue; // the runner must be clearly more advanced
    const dir = norm({ x: goal.x - m.x, y: goal.y - m.y });
    const target = {
      x: clamp(m.x + dir.x * 9, 2, PITCH.LENGTH - 2),
      y: clamp(m.y + dir.y * 9, 4, PITCH.WIDTH - 4),
    };
    let space = Infinity;
    for (const o of world.opponentsOf(c.team)) {
      if (o.isGK) continue;
      space = Math.min(space, dist(o, target));
    }
    if (space < 4) continue; // the run must actually be into open space
    const lane = laneOpennessPoint(c, target, world);
    const danger = clamp(1 - dist(target, goal) / 60, 0, 1);
    const score = 0.4 * clamp(space / 9, 0, 1) + 0.35 * lane + 0.4 * danger + 0.1 * (c.attr.vision / 100);
    if (score > bestScore) {
      bestScore = score;
      best = { target, runner: m, score };
    }
  }
  return best;
}

// off-ball penetrating run toward goal, drifting into the nearest channel
function runTarget(p, world) {
  const goal = world.attackingGoal(p.team);
  const dir = norm({ x: goal.x - p.x, y: goal.y - p.y });
  const ahead = { x: p.x + dir.x * 14, y: p.y + dir.y * 14 };
  const o = nearestOpponentWithin(world, p, 8);
  if (o) ahead.y += (p.y >= o.y ? 1 : -1) * 5; // peel away from the marker
  return { x: clamp(ahead.x, 2, PITCH.LENGTH - 2), y: clamp(ahead.y, 5, PITCH.WIDTH - 5) };
}

function spaceAhead(c, world) {
  const goal = world.attackingGoal(c.team);
  const dir = norm({ x: goal.x - c.x, y: goal.y - c.y });
  const probe = { x: c.x + dir.x * 7, y: clamp(c.y + dir.y * 7, 2, PITCH.WIDTH - 2) };
  let minD = Infinity;
  for (const o of world.opponentsOf(c.team)) {
    const d = dist(o, probe);
    if (d < minD) minD = d;
  }
  return clamp(minD / 8, 0, 1);
}

function pressureCount(p, world) {
  let n = 0;
  for (const o of world.opponentsOf(p.team)) {
    if (dist2(o, p) <= DECISION.PRESSURE_RADIUS ** 2) n++;
  }
  return n;
}

function goalAngleFactor(c, goal) {
  // central & square to goal ≈ 1, very wide ≈ 0.3
  return 1 - clamp(Math.abs(c.y - goal.y) / (PITCH.WIDTH / 2), 0, 1) * 0.7;
}

// --- actions ----------------------------------------------------------------
function executePass(c, mate, world, rng) {
  const lead = { x: mate.x + mate.vx * 0.3, y: mate.y + mate.vy * 0.3 };
  const d = dist(c, mate);
  const power = clamp(PASS.BASE_SPEED + d * 0.7, 10, BALL.MAX_SPEED);
  const spread = PASS.SPREAD * (1.2 - c.attr.passing / 100);
  kickToward(world.ball, c, lead, power, rng, spread);
  const b = world.ball;
  b.isPass = true;
  b.isShot = false;
  b.lastKicker = c;
  b.selfLock = PASS.SELF_LOCK;
  world.lastTouchTeam = c.team;
  world.stats[c.team].passes++;
  releaseCarry(world, c);
}

function executeShot(c, world, rng) {
  const goal = world.attackingGoal(c.team);
  const dGoal = dist(c, goal);
  const b = world.ball;
  const defenders = defendersInCone(c, world);
  const gkClose = dist(world.goalkeeperOf(world.other(c.team)), goal) < 7;
  const xg = xgModel({ distance: dGoal, angleFactor: goalAngleFactor(c, goal), defenders, gkClose });

  // every attempt is a shot for the count + xG
  world.stats[c.team].shots++;
  world.stats[c.team].xg += xg;
  const shot = { team: c.team, x: c.x, y: c.y, dir: world.attackDir[c.team], xg, onTarget: false, outcome: 'off', t: world.clock };
  world.shotLog.push(shot);
  world.events.push({ type: 'shot', team: c.team, t: world.clock, xg });
  world.timeline.push({ t: world.clock, h: world.stats.home.xg, a: world.stats.away.xg });
  world.lastTouchTeam = c.team;

  // a packed block charges down the shot — this is what makes a deep block resilient
  if (defenders > 0 && rng.chance(clamp(0.34 * defenders, 0, 0.75))) {
    shot.outcome = 'blocked';
    const ang = Math.atan2(goal.y - c.y, goal.x - c.x) + rng.spread(1.3);
    b.vx = Math.cos(ang) * 8;
    b.vy = Math.sin(ang) * 8;
    b.isShot = b.isPass = false;
    b.lastKicker = c;
    b.selfLock = 0.1;
    b.flightLock = BALL.FLIGHT_LOCK;
    releaseCarry(world, c);
    return;
  }

  // clean strike on goal
  const half = PITCH.GOAL_WIDTH / 2 - 0.3;
  const aim = { x: goal.x, y: goal.y + rng.spread(half * 0.85) };
  const pressure = pressureCount(c, world);
  const spread = SHOT.SPREAD * (0.5 + dGoal / SHOT.RANGE) * (1.4 - c.attr.shooting / 100) + 0.04 * pressure;
  kickToward(b, c, aim, SHOT.SPEED, rng, spread);
  b.isShot = true;
  b.isPass = false;
  b.lastKicker = c;
  b.selfLock = 0.05;
  const onTarget = predictOnTarget(world, c.team);
  shot.onTarget = onTarget;
  if (onTarget) world.stats[c.team].shotsOnTarget++;
  b._shotEvent = shot; // updated to 'goal' / 'saved' on resolution
  releaseCarry(world, c);
}

// opponents standing between the shooter and the goal (inside a narrow cone)
function defendersInCone(c, world) {
  const goal = world.attackingGoal(c.team);
  let n = 0;
  for (const o of world.opponentsOf(c.team)) {
    if (o.isGK) continue;
    if (pointSegDist(o, c, goal) < 3.5 && dist(o, goal) < dist(c, goal)) n++;
  }
  return n;
}

function executeThroughBall(c, target, world, rng) {
  const d = dist(c, target);
  const power = clamp(PASS.BASE_SPEED + d * 0.8, 12, BALL.MAX_SPEED);
  kickToward(world.ball, c, target, power, rng, PASS.SPREAD * 0.9);
  const b = world.ball;
  b.isPass = true;
  b.isShot = false;
  b.lastKicker = c;
  b.selfLock = PASS.SELF_LOCK;
  world.lastTouchTeam = c.team;
  world.stats[c.team].passes++;
  releaseCarry(world, c);
}

function executeClear(c, world, rng) {
  const goal = world.attackingGoal(c.team);
  const dir = norm({ x: goal.x - c.x, y: 0 });
  const target = { x: c.x + dir.x * 50, y: clamp(c.y + rng.spread(22), 2, PITCH.WIDTH - 2) };
  kickToward(world.ball, c, target, 30, rng, 0.13); // big boot toward midfield
  const b = world.ball;
  b.isShot = b.isPass = false;
  b.lastKicker = c;
  b.selfLock = 0.1;
  world.lastTouchTeam = c.team;
  releaseCarry(world, c);
}

function kickToward(ball, from, to, power, rng, spread) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x) + rng.spread(spread);
  ball.vx = Math.cos(ang) * power;
  ball.vy = Math.sin(ang) * power;
  ball.flightLock = BALL.FLIGHT_LOCK; // let it travel before anyone collects it
}

function releaseCarry(world, c) {
  c.hasBall = false;
  c.holdTime = 0;
  c.carryTime = 0;
  world.ball.owner = null;
}

function decisionTime(world, team, rng) {
  return rng.range(DECISION.MIN, DECISION.MAX) * world.tuning[team].tempoMul;
}

function giveBall(world, p, rng) {
  const b = world.ball;
  if (b.owner && b.owner !== p) b.owner.hasBall = false; // clear the dispossessed carrier
  if (b.isPass && b.lastKicker && b.lastKicker.team === p.team && b.lastKicker !== p) {
    world.stats[p.team].passesCompleted++;
    const k = `${b.lastKicker.id}|${p.id}`;
    world.passNet[p.team][k] = (world.passNet[p.team][k] || 0) + 1; // pass-network link
  }
  // a live shot collected by an outfielder (not a keeper save) = a block
  if (b.isShot && b._shotEvent && b._shotEvent.outcome === 'off') b._shotEvent.outcome = 'blocked';
  b._shotEvent = null;
  // winning the ball off the opponent opens a counter-attack window (movement time)
  if (b.lastKicker && b.lastKicker.team !== p.team && world.tuning[p.team].counter) {
    world.counterUntil[p.team] = world.playTime + 3;
  }
  b.owner = p;
  p.hasBall = true;
  p.holdTime = 0;
  p.carryTime = 0;
  p.nextDecision = decisionTime(world, p.team, rng);
  b.vx = b.vy = 0;
  b.isShot = b.isPass = false;
  b.lastKicker = null;
  b.selfLock = 0;
  b.flightLock = 0;
  world.lastTouchTeam = p.team;
  world._lastXt[p.team] = xtValue(b.x, b.y, world.attackingGoal(p.team).x);
}

// ---------------------------------------------------------------------------
// Loose-ball physics, control / interception / saves, out-of-play & goals
// ---------------------------------------------------------------------------
function flightLogic(world, rng, dt) {
  const b = world.ball;
  if (b.selfLock > 0) b.selfLock -= dt;
  if (b.flightLock > 0) b.flightLock -= dt;

  const damp = Math.exp(-BALL.LINEAR_DAMP * dt);
  b.vx *= damp;
  b.vy *= damp;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // goal line?
  if (b.x <= BALL.RADIUS || b.x >= PITCH.LENGTH - BALL.RADIUS) {
    const goalX = b.x <= BALL.RADIUS ? 0 : PITCH.LENGTH;
    // a goal needs the ball crossing INTO the net (not running along the byline)
    const inward = goalX === 0 ? b.vx < -1.5 : b.vx > 1.5;
    if (inward && Math.abs(b.y - PITCH.WIDTH / 2) <= PITCH.GOAL_WIDTH / 2) scoreGoal(world, goalX);
    else goalLineOut(world, goalX);
    return;
  }
  // touchline?
  if (b.y <= BALL.RADIUS || b.y >= PITCH.WIDTH - BALL.RADIUS) {
    touchlineOut(world);
    return;
  }

  attemptControl(world, rng);
}

function attemptControl(world, rng) {
  const b = world.ball;
  let best = null;
  let bestD = Infinity;
  let bestIsSave = false;

  for (const p of world.players) {
    const d = dist(p, b);
    let reach = PLAYER.CONTROL_RADIUS;
    let save = false;
    if (p.isGK && b.isShot && headingTowardOwnGoal(world, p)) {
      reach = GK.SAVE_REACH;
      save = true;
    }
    // keeper saves bypass the flight lock; normal control does not
    if (!save) {
      if (b.flightLock > 0) continue;
      if (p === b.lastKicker && b.selfLock > 0) continue;
    }
    if (d <= reach && d < bestD) {
      bestD = d;
      best = p;
      bestIsSave = save;
    }
  }
  if (!best) return;

  if (bestIsSave) {
    if (b._shotEvent) b._shotEvent.outcome = 'saved';
    if (rng.chance(GK.CATCH_CHANCE)) {
      giveBall(world, best, rng); // caught
      world.events.push({ type: 'save', team: best.team, t: world.clock, caught: true });
    } else {
      // parried wide (toward the nearer touchline & away from goal)
      const og = world.ownGoal(best.team);
      const intoPlay = og.x === 0 ? 1 : -1;
      const side = b.y <= PITCH.WIDTH / 2 ? -1 : 1;
      b.vx = intoPlay * 4 + rng.spread(2);
      b.vy = side * 13 + rng.spread(2);
      b.isShot = false;
      b.lastKicker = best;
      b.selfLock = 0.12;
      b.flightLock = BALL.FLIGHT_LOCK;
      world.events.push({ type: 'save', team: best.team, t: world.clock, caught: false });
    }
    return;
  }

  const interception = b.isPass && b.lastKicker && best.team !== b.lastKicker.team;
  giveBall(world, best, rng);
  if (interception) world.stats[best.team].interceptions++;
}

function scoreGoal(world, goalX) {
  const conceding = world.defenderOfGoalLine(goalX);
  const scoring = world.other(conceding);
  const b = world.ball;
  const via = b.isShot ? 'shot' : b.isPass ? 'pass' : b.lastKicker ? 'loose' : 'none';
  const ownGoal = b.lastKicker && b.lastKicker.team === conceding;
  if (b._shotEvent) b._shotEvent.outcome = 'goal';
  world.score[scoring]++;
  world.events.push({ type: 'goal', team: scoring, t: world.clock, half: world.half, via, ownGoal });
  world.goalFlashUntil = world.playTime + MATCH.GOAL_FLASH;
  world.goalFlashTeam = scoring;
  aiReactSoon(world); // the AI re-thinks shortly after a goal
  world.startKickoff(conceding);
}

function goalLineOut(world, goalX) {
  const defending = world.defenderOfGoalLine(goalX);
  const attacking = world.other(defending);
  const lt = world.lastTouchTeam;
  if (lt === defending) {
    // defender put it out → corner to the attackers
    world.stats[attacking].corners++;
    const cx = goalX === 0 ? 1 : PITCH.LENGTH - 1;
    const cy = world.ball.y < PITCH.WIDTH / 2 ? 1 : PITCH.WIDTH - 1;
    world.setRestart('corner', attacking, cx, cy);
  } else {
    // attacker put it out (or unknown) → goal kick to the defenders
    const gkX = goalX === 0 ? PITCH.GOAL_AREA_DEPTH - 1 : PITCH.LENGTH - (PITCH.GOAL_AREA_DEPTH - 1);
    world.setRestart('goalkick', defending, gkX, PITCH.WIDTH / 2);
  }
}

function touchlineOut(world) {
  const b = world.ball;
  const team = world.lastTouchTeam ? world.other(world.lastTouchTeam) : TEAM.HOME;
  const y = b.y <= BALL.RADIUS ? 0.3 : PITCH.WIDTH - 0.3;
  const x = clamp(b.x, 2, PITCH.LENGTH - 2);
  world.setRestart('throwin', team, x, y);
}

function headingTowardOwnGoal(world, gk) {
  const og = world.ownGoal(gk.team);
  const b = world.ball;
  const dx = og.x - b.x;
  if (b.vx === 0 || Math.sign(dx) !== Math.sign(b.vx)) return false;
  return dist(b, og) <= GK.ANTICIPATE_RANGE;
}

function predictOnTarget(world, team) {
  const goal = world.attackingGoal(team);
  const b = world.ball;
  const dir = world.attackDir[team]; // +1 attacking +x, -1 attacking -x
  if (b.vx * dir <= 1.0) return false; // not travelling toward goal with intent
  const t = (goal.x - b.x) / b.vx;
  const projY = b.y + b.vy * t;
  return Math.abs(projY - goal.y) <= PITCH.GOAL_WIDTH / 2;
}

// ---------------------------------------------------------------------------
// Off-ball movement
// ---------------------------------------------------------------------------
function moveAll(world, dt) {
  const b = world.ball;
  // rank each team's field players by distance to the ball (0 = closest)
  const order = { home: rankByBall(world.home, b), away: rankByBall(world.away, b) };

  // the defending team(s) assign markers to opponents (loose ball ⇒ both defend)
  const inPoss = b.owner ? b.owner.team : null;
  const marks = new Map();
  if (inPoss !== TEAM.HOME) assignMarks(world, TEAM.HOME, order.home, marks);
  if (inPoss !== TEAM.AWAY) assignMarks(world, TEAM.AWAY, order.away, marks);

  for (const p of world.players) {
    const target = decideTarget(p, world, order, marks);
    let maxSpeed = p.isGK ? PLAYER.GK_SPEED : PLAYER.BASE_SPEED;
    maxSpeed *= STAMINA.MIN_SPEED_FACTOR + (1 - STAMINA.MIN_SPEED_FACTOR) * (p.currentStamina / 100);
    if (b.owner === p) maxSpeed *= PLAYER.DRIBBLE_FACTOR; // dribbling is slower than running
    if (p.isGK && b.isShot && headingTowardOwnGoal(world, p)) maxSpeed *= GK.REACH_SPEED_BONUS;
    steerTo(p, target, dt, maxSpeed);
    p.currentStamina = Math.max(0, p.currentStamina - STAMINA.DRAIN_PER_M * Math.hypot(p.vx, p.vy) * dt);
  }
}

function rankByBall(teamPlayers, b) {
  const field = teamPlayers.filter((p) => !p.isGK);
  field.sort((a, c) => dist2(a, b) - dist2(c, b));
  const m = new Map();
  field.forEach((p, i) => m.set(p, i));
  return m;
}

// Greedy marking: the ball-presser (rank 0) is excluded; every other outfielder
// picks up the nearest still-unmarked opponent. This denies passing options and
// is what stops attackers receiving freely in the box.
function assignMarks(world, team, order, marks) {
  const defs = world.teamPlayers(team).filter((p) => !p.isGK);
  defs.sort((a, c) => (order.get(a) ?? 99) - (order.get(c) ?? 99));
  const taken = new Set();
  // man-marked targets are reserved (handled directly in decideTarget)
  for (const mid in world.manMarks) {
    const m = world.playerById(mid);
    if (m && m.team === team) {
      const t = world.playerById(world.manMarks[mid]);
      if (t) taken.add(t);
    }
  }
  // the presser (rank 0) plus the nearest markers pick up opponents; the rest
  // hold a zonal block (compactness), which is harder to play through than pure
  // man-marking and keeps chances realistic
  const limit = Math.min(defs.length, 7);
  for (let i = 1; i < limit; i++) {
    const d = defs[i];
    if (world.manMarks[d.id]) continue; // man-marker: handled separately
    let best = null;
    let bd = Infinity;
    for (const o of world.opponentsOf(team)) {
      if (o.isGK || taken.has(o)) continue;
      const dd = dist2(d, o);
      if (dd < bd) {
        bd = dd;
        best = o;
      }
    }
    if (best) {
      marks.set(d, best);
      taken.add(best);
    }
  }
}

function decideTarget(p, world, order, marks) {
  const b = world.ball;
  if (p.isGK) return goalkeeperTarget(p, world);
  if (b.owner === p) return dribbleTarget(p, world); // authoritative: only the real carrier dribbles

  const rank = order[p.team].get(p) ?? 99;
  const myTeamHasBall = b.owner && b.owner.team === p.team;

  const tn = world.tuning[p.team];

  // man-marking: shadow the assigned opponent (defensive duty) over zonal shape
  if (!myTeamHasBall && world.manMarks[p.id]) {
    const tgt = world.playerById(world.manMarks[p.id]);
    if (tgt && tgt.onPitch) return markTarget(tgt, world, p.team);
  }

  if (myTeamHasBall) {
    const goal = world.attackingGoal(p.team);
    // closest pushes ahead to support; further on a counter-attack
    if (rank === 0) {
      const dir = norm({ x: goal.x - b.x, y: goal.y - b.y });
      const reach = world.counterUntil[p.team] > world.playTime ? 20 : 12;
      return { x: b.x + dir.x * reach, y: clamp(b.y + dir.y * reach, 6, PITCH.WIDTH - 6) };
    }
    // forwards make penetrating runs (toward goal, into channels) when advanced
    if (roleLayer(p.role) >= 2 && dist(b, goal) < 72) return runTarget(p, world);
    return shiftedHome(p, world);
  }

  // defending / loose ball — pressing setting decides how high we engage, but a
  // LOOSE ball is always contested (the block only "sits off" a settled opponent)
  const ballDepth = Math.abs(b.x - world.ownGoal(p.team).x); // how deep the ball is in our half
  const engage = !b.owner || tn.pressHard || ballDepth <= tn.pressRange;
  const isPresser = rank === 0 || (rank === 1 && tn.gegen);
  if (isPresser) {
    const o = b.owner;
    if (o && o.isGK && dist(o, world.ownGoal(o.team)) < 18) {
      // don't charge the opposing keeper inside his box — screen the outlet
      const toMid = norm({ x: PITCH.LENGTH / 2 - o.x, y: PITCH.WIDTH / 2 - o.y });
      return { x: o.x + toMid.x * 15, y: clamp(o.y + toMid.y * 15, 6, PITCH.WIDTH - 6) };
    }
    if (engage) return { x: b.x, y: b.y }; // close down the carrier
    return shiftedHome(p, world); // low/mid block: hold the line, don't chase high
  }

  const mark = marks.get(p);
  if (mark) return markTarget(mark, world, p.team);

  // unassigned: hold a compact block, goal-side of the ball
  const home = shiftedHome(p, world);
  const gs = ballGoalSide(b, world.ownGoal(p.team), 10);
  return { x: lerp(home.x, gs.x, 0.4), y: lerp(home.y, gs.y, 0.4) };
}

// shadow an opponent from the goal side — close enough to contest, loose enough
// that the attacking side can still create the occasional chance
function markTarget(att, world, team) {
  const og = world.ownGoal(team);
  const dir = norm({ x: og.x - att.x, y: og.y - att.y });
  return { x: att.x + dir.x * 2.6, y: clamp(att.y + dir.y * 2.6, 3, PITCH.WIDTH - 3) };
}

// a point `back` meters goal-side of the ball (toward own goal)
function ballGoalSide(b, og, back) {
  const dir = norm({ x: og.x - b.x, y: og.y - b.y });
  return { x: b.x + dir.x * back, y: clamp(b.y + dir.y * back, 4, PITCH.WIDTH - 4) };
}

// Tactical anchor for a player given the phase. This is where shape MORPHING and
// the §3 settings (line height, mentality push, width, focus, inverted FB) live.
function phaseHome(p, world, inPoss) {
  const tn = world.tuning[p.team];
  const dir = world.attackDir[p.team];
  const ogX = world.ownGoal(p.team).x;
  const layer = Math.max(roleLayer(p.role), 0); // 0 def .. 2 fwd
  const C = PITCH.WIDTH / 2;

  // depth from own goal: defensive block sits at the line; in possession it pushes
  // up — but defenders hold back (rest defense) so the team never fully camps
  const push = layer >= 1 ? tn.attackPush : tn.attackPush * 0.25;
  const depth = inPoss ? tn.lineBase + push + layer * 16 : tn.lineBase + layer * 10;
  let x = ogX + dir * depth;

  // width: spread from centre (wider in possession, compact when defending)
  const spread = inPoss ? tn.widthBias : tn.defWidthBias;
  let y = C + (p.home.y - C) * spread;

  // inverted full-backs tuck inside and step into midfield in possession
  if (inPoss && tn.invertedFB && isFullback(p.role)) {
    y = lerp(y, C, 0.55);
    x = ogX + dir * (tn.lineBase + tn.attackPush + 6);
  }

  // attacking focus biases the advanced players toward a flank / the middle
  if (inPoss && layer >= 1) {
    if (tn.focus === 'left') y = lerp(y, 7, 0.2);
    else if (tn.focus === 'right') y = lerp(y, PITCH.WIDTH - 7, 0.2);
    else if (tn.focus === 'middle') y = lerp(y, C, 0.22);
  }

  return { x: clamp(x, 2, PITCH.LENGTH - 2), y: clamp(y, 4, PITCH.WIDTH - 4) };
}

// Tactical anchor + a modest shift toward the ball (compactness / ball-side).
function shiftedHome(p, world) {
  const b = world.ball;
  const inPoss = b.owner ? b.owner.team === p.team : false;
  const base = phaseHome(p, world, inPoss);
  const sx = (b.x - PITCH.LENGTH / 2) * (inPoss ? 0.18 : 0.3);
  const sy = (b.y - PITCH.WIDTH / 2) * (inPoss ? 0.22 : 0.34);
  return {
    x: clamp(base.x + sx, 2, PITCH.LENGTH - 2),
    y: clamp(base.y + sy, 4, PITCH.WIDTH - 4),
  };
}

function goalkeeperTarget(p, world) {
  const b = world.ball;
  const og = world.ownGoal(p.team);
  const intoPlay = og.x === 0 ? 1 : -1;
  const lineX = og.x + intoPlay * GK.LINE_OFFSET;

  // react to a live shot: get to its projected point on the line
  if (b.isShot && headingTowardOwnGoal(world, p)) {
    const t = b.vx !== 0 ? Math.max((lineX - b.x) / b.vx, 0) : 0;
    const projY = b.y + b.vy * t;
    const y = clamp(projY, PITCH.WIDTH / 2 - PITCH.GOAL_WIDTH / 2 - 1.5, PITCH.WIDTH / 2 + PITCH.GOAL_WIDTH / 2 + 1.5);
    return { x: lineX, y };
  }

  // rush out to narrow the angle against a close opponent carrier
  if (b.owner && b.owner.team !== p.team) {
    const dOwn = dist(b.owner, og);
    if (dOwn < GK.RUSH_RANGE) {
      const t = clamp(1 - dOwn / GK.RUSH_RANGE, 0, 1);
      const outX = lerp(lineX, og.x + intoPlay * GK.RUSH_OUT, t);
      const aimY = clamp(b.owner.y, PITCH.WIDTH / 2 - 6, PITCH.WIDTH / 2 + 6);
      return { x: outX, y: lerp(PITCH.WIDTH / 2, aimY, 0.85) };
    }
  }

  // open play: stay near the centre of goal so both posts are within reach
  const y = clamp(b.y, PITCH.WIDTH / 2 - GK.TRACK_Y, PITCH.WIDTH / 2 + GK.TRACK_Y);
  return { x: lineX, y };
}

function dribbleTarget(c, world) {
  if (c.isGK) return { x: c.x, y: c.y }; // keeper distributes, doesn't roam
  const goal = world.attackingGoal(c.team);
  let dir = norm({ x: goal.x - c.x, y: goal.y - c.y });
  const opp = nearestOpponentWithin(world, c, 5);
  if (opp) {
    const away = norm({ x: c.x - opp.x, y: c.y - opp.y });
    dir = norm({ x: dir.x * 0.7 + away.x * 0.5, y: dir.y * 0.6 + away.y * 0.7 });
  }
  return { x: c.x + dir.x * 6, y: clamp(c.y + dir.y * 6, 2, PITCH.WIDTH - 2) };
}

// ---------------------------------------------------------------------------
// Steering & geometry helpers
// ---------------------------------------------------------------------------
function steerTo(p, target, dt, maxSpeed) {
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const d = Math.hypot(dx, dy);
  const desiredSpeed = d > PLAYER.SLOW_RADIUS ? maxSpeed : (maxSpeed * d) / PLAYER.SLOW_RADIUS;
  const inv = d || 1;
  const desiredVx = (dx / inv) * desiredSpeed;
  const desiredVy = (dy / inv) * desiredSpeed;
  const maxDv = PLAYER.ACCEL * dt;
  p.vx = approach(p.vx, desiredVx, maxDv);
  p.vy = approach(p.vy, desiredVy, maxDv);
  p.x = clamp(p.x + p.vx * dt, 0, PITCH.LENGTH);
  p.y = clamp(p.y + p.vy * dt, 0, PITCH.WIDTH);
}

function nearestOpponentWithin(world, player, radius) {
  const r2 = radius ** 2;
  let best = null;
  let bestD = r2;
  for (const o of world.opponentsOf(player.team)) {
    if (o.isGK) continue;
    const d = dist2(o, player);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function deepInOwnThird(c, world) {
  const ogX = world.ownGoal(c.team).x;
  return ogX === 0 ? c.x < PITCH.LENGTH / 3 : c.x > (PITCH.LENGTH * 2) / 3;
}

// distance from point p to segment a→b
function pointSegDist(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const len2 = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / len2;
  t = clamp(t, 0, 1);
  const cx = a.x + abx * t;
  const cy = a.y + aby * t;
  return Math.hypot(p.x - cx, p.y - cy);
}
