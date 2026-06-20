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
  PITCH, PLAYER, BALL, SIM, DECISION, PASS, SHOT, GK, MATCH,
  FIXED_DT, HALF_SECONDS, TEAM,
} from './constants.js';
import { dist, dist2, norm, clamp, lerp, approach } from './vec.js';

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
    world.tick += 1;
    return;
  }

  if (world.phase === 'deadball') updateDeadball(world, rng, dt);
  else updatePlay(world, rng, dt);

  world.clock += dt;
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
    rec.nextDecision = r.type === 'kickoff' ? 0.4 : rng.range(DECISION.MIN, DECISION.MAX);
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
    world.stats[b.owner.team].possTicks++;
    carrierLogic(world, rng, dt);
  } else {
    flightLogic(world, rng, dt);
  }
  if (world.phase === 'play') moveAll(world, dt);
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
      world.stats[opp.team].tackles++;
      giveBall(world, opp, rng);
      return;
    }
  }

  if (c.holdTime >= c.nextDecision) chooseAndExecute(c, world, rng);
}

function chooseAndExecute(c, world, rng) {
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
    shoot = clamp(quality, 0, 1) * SHOT.EAGERNESS + rng.spread(0.04);
  }

  // PASS
  const pass = bestPass(c, world);
  const passScore = pass ? pass.score : -1;

  // DRIBBLE (never dribble the ball into the keeper from point-blank range)
  let dribble = -1;
  if (!c.isGK && !forced && dGoal > 5) {
    const space = spaceAhead(c, world);
    dribble = space * (0.45 + 0.55 * c.attr.dribbling / 100) - 0.12 * pressure + (dGoal < 45 ? 0.05 : 0);
  }

  // CLEAR (deep defenders/keeper boot it clear when pressed; otherwise build short)
  let clear = -1;
  if (deepInOwnThird(c, world)) clear = 0.45 + 0.12 * pressure;

  let action = 'dribble';
  let bestv = dribble;
  if (passScore > bestv) { action = 'pass'; bestv = passScore; }
  if (shoot > bestv) { action = 'shoot'; bestv = shoot; }
  if (clear > bestv) { action = 'clear'; bestv = clear; }
  if (forced && action === 'dribble') action = pass ? 'pass' : 'clear';

  if (action === 'shoot') executeShot(c, world, rng);
  else if (action === 'pass') executePass(c, pass.mate, world, rng);
  else if (action === 'clear') executeClear(c, world, rng);
  else {
    // keep dribbling; re-decide shortly
    c.holdTime = 0;
    c.nextDecision = DECISION.DRIBBLE_GAP;
  }
}

// --- candidate evaluation ---------------------------------------------------
function bestPass(c, world) {
  const goal = world.attackingGoal(c.team);
  const dGoalC = dist(c, goal);
  let best = null;
  let bestScore = 0.3; // low bar: keep a recycle option so bad chances are passed, not shot
  for (const m of world.teamPlayers(c.team)) {
    if (m === c || m.isGK) continue;
    const d = dist(c, m);
    if (d < SIM.PASS_MIN_RANGE || d > SIM.PASS_MAX_RANGE) continue;
    const progress = clamp((dGoalC - dist(m, goal)) / 30, -1, 1);
    const open = laneOpenness(c, m, world);
    const recPress = pressureCount(m, world);
    // value keeping the ball (open, unpressured) over forcing it forward
    const score = 0.55 * open + 0.22 * ((progress + 1) / 2) - 0.2 * recPress + 0.1 * (c.attr.passing / 100);
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
  const half = PITCH.GOAL_WIDTH / 2 - 0.3;
  const aim = { x: goal.x, y: goal.y + rng.spread(half * 0.85) };
  const pressure = pressureCount(c, world);
  const spread = SHOT.SPREAD * (0.5 + dGoal / SHOT.RANGE) * (1.4 - c.attr.shooting / 100) + 0.04 * pressure;
  kickToward(world.ball, c, aim, SHOT.SPEED, rng, spread);
  const b = world.ball;
  b.isShot = true;
  b.isPass = false;
  b.lastKicker = c;
  b.selfLock = 0.05;
  world.lastTouchTeam = c.team;
  const onTarget = predictOnTarget(world, c.team);
  b.shotOnTarget = onTarget;
  world.stats[c.team].shots++;
  if (onTarget) world.stats[c.team].shotsOnTarget++;
  world.events.push({ type: 'shot', team: c.team, t: world.clock, onTarget });
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

function giveBall(world, p, rng) {
  const b = world.ball;
  if (b.isPass && b.lastKicker && b.lastKicker.team === p.team && b.lastKicker !== p) {
    world.stats[p.team].passesCompleted++;
  }
  b.owner = p;
  p.hasBall = true;
  p.holdTime = 0;
  p.carryTime = 0;
  p.nextDecision = rng.range(DECISION.MIN, DECISION.MAX);
  b.vx = b.vy = 0;
  b.isShot = b.isPass = false;
  b.lastKicker = null;
  b.selfLock = 0;
  b.flightLock = 0;
  world.lastTouchTeam = p.team;
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
  world.score[scoring]++;
  world.events.push({ type: 'goal', team: scoring, t: world.clock, half: world.half, via, ownGoal });
  world.goalFlashUntil = world.clock + MATCH.GOAL_FLASH;
  world.goalFlashTeam = scoring;
  world.startKickoff(conceding);
}

function goalLineOut(world, goalX) {
  const defending = world.defenderOfGoalLine(goalX);
  const attacking = world.other(defending);
  const lt = world.lastTouchTeam;
  if (lt === defending) {
    // defender put it out → corner to the attackers
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
    if (p.hasBall) maxSpeed *= PLAYER.DRIBBLE_FACTOR; // dribbling is slower than running
    if (p.isGK && b.isShot && headingTowardOwnGoal(world, p)) maxSpeed *= GK.REACH_SPEED_BONUS;
    steerTo(p, target, dt, maxSpeed);
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
  for (let i = 1; i < defs.length; i++) {
    const d = defs[i];
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
  if (p.hasBall) return dribbleTarget(p, world);

  const rank = order[p.team].get(p) ?? 99;
  const myTeamHasBall = b.owner && b.owner.team === p.team;

  if (myTeamHasBall) {
    // closest pushes ahead to support; others keep the (ball-shifted) shape
    if (rank === 0) {
      const goal = world.attackingGoal(p.team);
      const dir = norm({ x: goal.x - b.x, y: goal.y - b.y });
      return { x: b.x + dir.x * 12, y: clamp(b.y + dir.y * 12, 6, PITCH.WIDTH - 6) };
    }
    return shiftedHome(p, world);
  }

  // defending / loose ball
  if (rank === 0) {
    // don't charge the opposing keeper inside his box — screen the outlet instead
    const o = b.owner;
    if (o && o.isGK && dist(o, world.ownGoal(o.team)) < 18) {
      const toMid = norm({ x: PITCH.LENGTH / 2 - o.x, y: PITCH.WIDTH / 2 - o.y });
      return { x: o.x + toMid.x * 15, y: clamp(o.y + toMid.y * 15, 6, PITCH.WIDTH - 6) };
    }
    return { x: b.x, y: b.y }; // primary presser
  }

  const mark = marks.get(p);
  if (mark) return markTarget(mark, world, p.team);

  // unassigned: hold a compact block, goal-side of the ball
  const home = shiftedHome(p, world);
  const gs = ballGoalSide(b, world.ownGoal(p.team), 10);
  return { x: lerp(home.x, gs.x, 0.4), y: lerp(home.y, gs.y, 0.4) };
}

// shadow an opponent from the goal side, tight enough to contest a pass to them
function markTarget(att, world, team) {
  const og = world.ownGoal(team);
  const dir = norm({ x: og.x - att.x, y: og.y - att.y });
  return { x: att.x + dir.x * 1.7, y: clamp(att.y + dir.y * 1.7, 3, PITCH.WIDTH - 3) };
}

// a point `back` meters goal-side of the ball (toward own goal)
function ballGoalSide(b, og, back) {
  const dir = norm({ x: og.x - b.x, y: og.y - b.y });
  return { x: b.x + dir.x * back, y: clamp(b.y + dir.y * back, 4, PITCH.WIDTH - 4) };
}

function shiftedHome(p, world) {
  const b = world.ball;
  const shiftX = (b.x - PITCH.LENGTH / 2) * SIM.BLOCK_SHIFT_X;
  const shiftY = (b.y - PITCH.WIDTH / 2) * SIM.BLOCK_SHIFT_Y;
  return {
    x: clamp(p.home.x + shiftX, 2, PITCH.LENGTH - 2),
    y: clamp(p.home.y + shiftY, 4, PITCH.WIDTH - 4),
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
