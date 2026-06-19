// ===========================================================================
// simulation.js — the per-tick update. Pure logic: given (world, rng, dt) it
// advances the match one fixed step. No DOM, no rendering, no wall-clock.
//
// Phase 1 behavior model (deliberately simple; Phase 2 adds real on-ball
// decisions, shots, goals and restarts):
//   • Team holds its formation shape but shifts as a block toward the ball.
//   • The closest field player on each team presses the ball / carrier.
//   • The carrier dribbles toward goal, then passes to the best forward option
//     or drives the ball ahead; opponents in range can win it.
//   • GK tracks the ball along its goal line.
//   • Ball reflects off the touchlines; reaching a goal line restarts a kickoff.
// ===========================================================================

import { PITCH, PLAYER, BALL, SIM, ATTACK_DIR, FIXED_DT } from './constants.js';
import { dist, dist2, norm, clamp, approach } from './vec.js';

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export function step(world, rng, dt = FIXED_DT) {
  snapshotPrev(world);

  if (world.phase === 'kickoff') {
    updateKickoff(world, dt);
  } else {
    updatePlay(world, rng, dt);
  }

  world.clock += dt;
  world.tick += 1;
}

// Save the current positions so the renderer can interpolate this tick → next.
function snapshotPrev(world) {
  for (const p of world.players) {
    p.px = p.x;
    p.py = p.y;
  }
  world.ball.px = world.ball.x;
  world.ball.py = world.ball.y;
}

// ---------------------------------------------------------------------------
// Kickoff: settle players onto their homes, then hand the ball to the kicker.
// ---------------------------------------------------------------------------
function updateKickoff(world, dt) {
  const b = world.ball;
  b.x = PITCH.LENGTH / 2;
  b.y = PITCH.WIDTH / 2;
  b.vx = b.vy = 0;

  const kicker = centralStriker(world, world.kickoffTeam);
  for (const p of world.players) {
    if (p === kicker) {
      // stand just behind the ball, ready to play it
      const dir = ATTACK_DIR[p.team];
      steerTo(p, { x: PITCH.LENGTH / 2 - dir * 1.4, y: PITCH.WIDTH / 2 }, dt);
    } else {
      steerTo(p, p.home, dt);
    }
  }

  world.kickoffTimer -= dt;
  if (world.kickoffTimer <= 0) {
    world.phase = 'play';
    b.owner = kicker;
    kicker.hasBall = true;
    kicker.holdTime = 0;
    kicker.nextRelease = 0.45; // play it quickly off the kickoff
    b.controlCooldown = 0;
  }
}

function centralStriker(world, team) {
  const goal = world.attackingGoal(team);
  let best = null;
  let bestD = Infinity;
  for (const p of world.teamPlayers(team)) {
    if (p.isGK) continue;
    const d = dist2(p.home, goal);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Open play
// ---------------------------------------------------------------------------
function updatePlay(world, rng, dt) {
  const b = world.ball;
  if (b.controlCooldown > 0) b.controlCooldown -= dt;

  resolvePossession(world, rng);

  // Closest field player to the ball on each team = that team's presser/chaser.
  const chaser = {
    home: closestFieldPlayer(world.home, b),
    away: closestFieldPlayer(world.away, b),
  };

  for (const p of world.players) {
    const target = decideTarget(p, world, chaser);
    steerTo(p, target, dt);
  }

  if (b.owner) {
    updateCarry(world, rng, dt);
  } else {
    moveLooseBall(world, dt);
  }
}

// Who controls the ball? Resolve steals and loose-ball collection.
function resolvePossession(world, rng) {
  const b = world.ball;

  if (b.owner) {
    // An opponent in range may win the ball (per-tick probability).
    const opp = nearestOpponentWithin(world, b.owner, PLAYER.STEAL_RADIUS);
    if (opp && rng.chance(SIM.STEAL_CHANCE_PER_TICK)) {
      releaseBall(world, 0.12);
      // knock it slightly toward the tackler so they collect it next ticks
      const d = norm({ x: opp.x - b.x, y: opp.y - b.y });
      b.vx = d.x * 4;
      b.vy = d.y * 4;
    }
    return;
  }

  if (b.controlCooldown > 0) return; // ball is in flight, uncollectable

  // Loose & settled: nearest player within control radius collects it.
  let best = null;
  let bestD = PLAYER.CONTROL_RADIUS ** 2;
  for (const p of world.players) {
    const d = dist2(p, b);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (best) {
    b.owner = best;
    best.hasBall = true;
    best.holdTime = 0;
    best.nextRelease = rng.range(SIM.HOLD_MIN, SIM.HOLD_MAX);
    b.vx = b.vy = 0;
  }
}

// ---------------------------------------------------------------------------
// Movement targets per player
// ---------------------------------------------------------------------------
function decideTarget(p, world, chaser) {
  const b = world.ball;

  if (p.isGK) return goalkeeperTarget(p, world);
  if (p.hasBall) return dribbleTarget(p, world);

  const myTeamHasBall = b.owner && b.owner.team === p.team;
  const iAmChaser = chaser[p.team] === p;

  if (iAmChaser && !myTeamHasBall) {
    // press the carrier / chase the loose ball
    return { x: b.x, y: b.y };
  }
  if (myTeamHasBall && iAmChaser) {
    // closest support player makes a run ahead of the carrier toward goal
    const goal = world.attackingGoal(p.team);
    const dir = norm({ x: goal.x - b.x, y: goal.y - b.y });
    return { x: b.x + dir.x * 12, y: clamp(b.y + dir.y * 12, 6, PITCH.WIDTH - 6) };
  }
  // everyone else: hold formation shape, shifted as a block toward the ball
  return shiftedHome(p, world);
}

// Team shifts toward the ball while keeping relative shape.
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
  const goal = world.ownGoal(p.team);
  const lineX = goal.x + ATTACK_DIR[p.team] * 2.2; // sit a touch off the line
  // track the ball's y but stay roughly within the six-yard width
  const y = clamp(b.y, PITCH.WIDTH / 2 - 9, PITCH.WIDTH / 2 + 9);
  return { x: lineX, y };
}

function dribbleTarget(p, world) {
  const goal = world.attackingGoal(p.team);
  const dir = norm({ x: goal.x - p.x, y: goal.y - p.y });
  return { x: p.x + dir.x * 6, y: p.y + dir.y * 6 };
}

// ---------------------------------------------------------------------------
// Ball when carried: stick it just ahead of the carrier, release on a timer.
// ---------------------------------------------------------------------------
function updateCarry(world, rng, dt) {
  const b = world.ball;
  const c = b.owner;

  const facing =
    Math.hypot(c.vx, c.vy) > 0.4
      ? norm({ x: c.vx, y: c.vy })
      : norm({ x: ATTACK_DIR[c.team], y: 0 });
  b.x = clamp(c.x + facing.x * 1.1, 0, PITCH.LENGTH);
  b.y = clamp(c.y + facing.y * 1.1, 0, PITCH.WIDTH);
  b.vx = c.vx;
  b.vy = c.vy;

  c.holdTime += dt;
  if (c.holdTime >= c.nextRelease) {
    const mate = bestPassTarget(c, world);
    if (mate) {
      kickBall(b, c, mate, passPower(dist(c, mate)), rng, 0.06);
    } else {
      // no good option: drive the ball forward toward goal
      const goal = world.attackingGoal(c.team);
      kickBall(b, c, goal, 16, rng, 0.12);
    }
    releaseBall(world, 0.22);
  }
}

// Best forward passing option: a teammate ahead of the carrier, in range.
function bestPassTarget(carrier, world) {
  const goal = world.attackingGoal(carrier.team);
  const carrierGoalDist = dist(carrier, goal);
  let best = null;
  let bestScore = 0.5; // require a minimum gain to bother passing

  for (const m of world.teamPlayers(carrier.team)) {
    if (m === carrier || m.isGK) continue;
    const d = dist(carrier, m);
    if (d < SIM.PASS_MIN_RANGE || d > SIM.PASS_MAX_RANGE) continue;
    const progress = carrierGoalDist - dist(m, goal); // how much closer to goal
    const score = progress - 0.25 * d;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

function passPower(d) {
  // enough pace to cover the distance against ball damping
  return clamp(d * 1.25 + 5, 9, BALL.MAX_SPEED);
}

function kickBall(b, from, to, power, rng, spread) {
  let dir = norm({ x: to.x - from.x, y: to.y - from.y });
  // apply a small deterministic angular jitter
  const ang = Math.atan2(dir.y, dir.x) + rng.spread(spread);
  b.vx = Math.cos(ang) * power;
  b.vy = Math.sin(ang) * power;
}

function releaseBall(world, cooldown) {
  const b = world.ball;
  if (b.owner) b.owner.hasBall = false;
  b.owner = null;
  b.controlCooldown = cooldown;
}

// ---------------------------------------------------------------------------
// Loose ball physics
// ---------------------------------------------------------------------------
function moveLooseBall(world, dt) {
  const b = world.ball;
  const damp = Math.exp(-BALL.LINEAR_DAMP * dt);
  b.vx *= damp;
  b.vy *= damp;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  const r = BALL.RADIUS;

  // touchlines: reflect
  if (b.y < r) {
    b.y = r;
    b.vy = Math.abs(b.vy) * BALL.WALL_BOUNCE;
  } else if (b.y > PITCH.WIDTH - r) {
    b.y = PITCH.WIDTH - r;
    b.vy = -Math.abs(b.vy) * BALL.WALL_BOUNCE;
  }

  // goal lines: restart a kickoff for the defending team (Phase 1 stand-in for
  // goals / goal-kicks / corners, which arrive in Phase 2)
  if (b.x <= r) {
    world.startKickoff('home'); // ball reached home's goal line → home restarts
  } else if (b.x >= PITCH.LENGTH - r) {
    world.startKickoff('away');
  }
}

// ---------------------------------------------------------------------------
// Steering & lookups
// ---------------------------------------------------------------------------
function steerTo(p, target, dt) {
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const d = Math.hypot(dx, dy);
  const maxSpeed = p.isGK ? PLAYER.GK_SPEED : PLAYER.BASE_SPEED;
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

function closestFieldPlayer(teamPlayers, point) {
  let best = null;
  let bestD = Infinity;
  for (const p of teamPlayers) {
    if (p.isGK) continue;
    const d = dist2(p, point);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
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
