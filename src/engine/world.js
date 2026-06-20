// ===========================================================================
// world.js — the match state container. Builds the two teams + ball, owns the
// clock/score/phase/stats and the dead-ball restart system. No behavior here
// (that lives in simulation.js) and no DOM.
// ===========================================================================

import { PITCH, TEAM, RESTART_PAUSE } from './constants.js';
import { Player, Ball } from './entities.js';
import { FORMATIONS, DEFAULT_FORMATION } from './formations.js';
import { lerp, dist2 } from './vec.js';

// Map a normalized formation slot into pitch meters for one team.
// Home starts on the left half (own goal at x=0); away mirrors into the right.
function slotToMeters(slot, attackDir) {
  let x = lerp(2.5, PITCH.LENGTH * 0.47, slot.nx);
  const y = lerp(4, PITCH.WIDTH - 4, slot.ny);
  if (attackDir < 0) x = PITCH.LENGTH - x;
  return { x, y };
}

function placeTeam(team, formationName, attackDir) {
  const tmpl = FORMATIONS[formationName] || FORMATIONS[DEFAULT_FORMATION];
  return tmpl.map((slot, i) => {
    const { x, y } = slotToMeters(slot, attackDir);
    return new Player({
      id: `${team}-${i + 1}`,
      team,
      number: i + 1,
      role: slot.role,
      x,
      y,
      isGK: !!slot.isGK,
    });
  });
}

function emptyStats() {
  return { shots: 0, shotsOnTarget: 0, passes: 0, passesCompleted: 0, tackles: 0, interceptions: 0, possTicks: 0 };
}

export class World {
  constructor({ seed = 1, homeFormation = DEFAULT_FORMATION, awayFormation = DEFAULT_FORMATION } = {}) {
    this.seed = seed;
    this.homeFormation = homeFormation;
    this.awayFormation = awayFormation;

    // live attacking direction per team (flips at half-time)
    this.attackDir = { home: +1, away: -1 };

    this.home = placeTeam(TEAM.HOME, homeFormation, this.attackDir.home);
    this.away = placeTeam(TEAM.AWAY, awayFormation, this.attackDir.away);
    this.players = [...this.home, ...this.away];

    this.ball = new Ball(PITCH.LENGTH / 2, PITCH.WIDTH / 2);

    this.clock = 0;            // in-game seconds elapsed
    this.tick = 0;
    this.half = 1;
    this.injury = null;        // current half's stoppage time (computed by sim on tick 0)
    this.htTimer = 0;          // half-time countdown
    this.score = { home: 0, away: 0 };
    this.stats = { home: emptyStats(), away: emptyStats() };
    this.events = [];          // light event log (goals, etc.) for later analytics

    this.firstKickoff = TEAM.HOME;
    this.lastTouchTeam = null;

    // banner / cue helpers (read by the renderer)
    this.goalFlashUntil = 0;
    this.goalFlashTeam = null;

    // phase: 'deadball' | 'play' | 'halftime' | 'fulltime'
    this.phase = 'deadball';
    this.restart = null;
    this.startKickoff(TEAM.HOME);
  }

  // --- lookups -------------------------------------------------------------
  teamPlayers(team) {
    return team === TEAM.HOME ? this.home : this.away;
  }
  opponentsOf(team) {
    return team === TEAM.HOME ? this.away : this.home;
  }
  other(team) {
    return team === TEAM.HOME ? TEAM.AWAY : TEAM.HOME;
  }
  goalkeeperOf(team) {
    return this.teamPlayers(team).find((p) => p.isGK);
  }

  // Center of the goal this team is ATTACKING / DEFENDING (uses live direction).
  attackingGoal(team) {
    return { x: this.attackDir[team] > 0 ? PITCH.LENGTH : 0, y: PITCH.WIDTH / 2 };
  }
  ownGoal(team) {
    return { x: this.attackDir[team] > 0 ? 0 : PITCH.LENGTH, y: PITCH.WIDTH / 2 };
  }

  // The team that defends a given goal-line x (0 or LENGTH).
  defenderOfGoalLine(goalX) {
    return this.ownGoal(TEAM.HOME).x === goalX ? TEAM.HOME : TEAM.AWAY;
  }

  // The forward most likely to take the kickoff (closest home anchor to goal).
  centralStriker(team) {
    const goal = this.attackingGoal(team);
    let best = null;
    let bestD = Infinity;
    for (const p of this.teamPlayers(team)) {
      if (p.isGK) continue;
      const d = dist2(p.home, goal);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  nearestTeammateTo(team, pt) {
    let best = null;
    let bestD = Infinity;
    for (const p of this.teamPlayers(team)) {
      if (p.isGK) continue;
      const d = dist2(p, pt);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  // --- dead-ball restarts --------------------------------------------------
  // type ∈ 'kickoff' | 'goalkick' | 'throwin' | 'corner'; team = who restarts.
  setRestart(type, team, x, y) {
    const receiver =
      type === 'kickoff'
        ? this.centralStriker(team)
        : type === 'goalkick'
        ? this.goalkeeperOf(team)
        : this.nearestTeammateTo(team, { x, y });

    this.phase = 'deadball';
    this.restart = { type, team, x, y, timer: RESTART_PAUSE[type], receiver };

    const b = this.ball;
    b.x = b.px = x;
    b.y = b.py = y;
    b.vx = b.vy = 0;
    b.owner = null;
    b.isShot = false;
    b.selfLock = 0;
    b.lastKicker = null;

    for (const p of this.players) {
      p.hasBall = false;
      p.holdTime = 0;
      p.carryTime = 0;
    }
    this.lastTouchTeam = null;
  }

  startKickoff(team) {
    this.setRestart('kickoff', team, PITCH.LENGTH / 2, PITCH.WIDTH / 2);
  }

  // --- half-time end swap --------------------------------------------------
  mirrorEnds() {
    this.attackDir.home *= -1;
    this.attackDir.away *= -1;
    for (const p of this.players) {
      p.home.x = PITCH.LENGTH - p.home.x;
      p.x = PITCH.LENGTH - p.x;
      p.px = PITCH.LENGTH - p.px;
      p.vx = -p.vx;
    }
  }
}
