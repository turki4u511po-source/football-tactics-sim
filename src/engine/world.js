// ===========================================================================
// world.js — the match state container. Builds the two teams + ball, owns the
// clock/score/phase/stats and the dead-ball restart system. No behavior here
// (that lives in simulation.js) and no DOM.
// ===========================================================================

import { PITCH, TEAM, TEAM_COLORS, RESTART_PAUSE, STAMINA } from './constants.js';
import { Player, Ball } from './entities.js';
import { FORMATIONS, DEFAULT_FORMATION } from './formations.js';
import { lerp, dist2 } from './vec.js';
import { defaultTactics, derive } from '../tactics/tactics.js';

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
  return { shots: 0, shotsOnTarget: 0, xg: 0, passes: 0, passesCompleted: 0, tackles: 0, interceptions: 0, fouls: 0, corners: 0, possTicks: 0 };
}

// scale a team's skill attributes by an overall club rating (modest spread)
function scaleAttrs(players, rating) {
  const f = 0.7 + 0.4 * rating; // ~0.96 .. 1.07 over the club range
  for (const p of players) {
    for (const k of ['pace', 'passing', 'shooting', 'dribbling', 'tackling', 'positioning', 'vision']) {
      p.attr[k] = Math.min(99, Math.round(p.attr[k] * f));
    }
  }
}

// Bench players for a team (generic roles, off the pitch until subbed on).
const BENCH_ROLES = ['CB', 'FB', 'CM', 'CM', 'AM', 'W', 'ST'];
function makeBench(team) {
  const bench = [];
  for (let i = 0; i < STAMINA.BENCH_SIZE; i++) {
    const p = new Player({
      id: `${team}-sub${i + 1}`,
      team,
      number: 12 + i,
      role: BENCH_ROLES[i] || 'CM',
      x: PITCH.LENGTH / 2,
      y: -10,
      isGK: false,
    });
    p.onPitch = false;
    bench.push(p);
  }
  return bench;
}

export class World {
  constructor({
    seed = 1, homeTactics, awayTactics, homeFormation, awayFormation,
    homeClub, awayClub, difficulty = 'normal', adaptive = true,
  } = {}) {
    this.seed = seed;

    // a club (if given) provides tactics + rating + display name
    const ht = homeClub ? { ...defaultTactics(), ...homeClub.tactics } : homeTactics || defaultTactics();
    const at = awayClub ? { ...defaultTactics(), ...awayClub.tactics } : awayTactics || defaultTactics();
    this.tactics = { home: ht, away: at };
    if (homeFormation) this.tactics.home.formation = homeFormation;
    if (awayFormation) this.tactics.away.formation = awayFormation;
    this.tuning = { home: derive(this.tactics.home), away: derive(this.tactics.away) };
    this.homeFormation = this.tactics.home.formation;
    this.awayFormation = this.tactics.away.formation;
    this.clubName = {
      home: homeClub ? homeClub.name : TEAM_COLORS.home.name,
      away: awayClub ? awayClub.name : TEAM_COLORS.away.name,
    };
    this.rating = { home: homeClub ? homeClub.rating : 1, away: awayClub ? awayClub.rating : 1 };

    // adaptive-AI config (the AI controls the away team)
    this.ai = { enabled: adaptive, difficulty, team: TEAM.AWAY, nextEval: 0, changes: [] };

    // live attacking direction per team (flips at half-time)
    this.attackDir = { home: +1, away: -1 };

    this.home = placeTeam(TEAM.HOME, this.homeFormation, this.attackDir.home);
    this.away = placeTeam(TEAM.AWAY, this.awayFormation, this.attackDir.away);
    this.players = [...this.home, ...this.away];
    if (homeClub) scaleAttrs(this.home, homeClub.rating);
    if (awayClub) scaleAttrs(this.away, awayClub.rating);

    // substitutes (off the pitch until brought on)
    this.bench = { home: makeBench(TEAM.HOME), away: makeBench(TEAM.AWAY) };
    this.subsUsed = { home: 0, away: 0 };
    this.manMarks = {}; // markerPlayerId -> targetPlayerId (man-marking assignments)
    this._index();

    this.ball = new Ball(PITCH.LENGTH / 2, PITCH.WIDTH / 2);

    this.clock = 0;            // in-game seconds elapsed
    this.tick = 0;
    this.half = 1;
    this.injury = null;        // current half's stoppage time (computed by sim on tick 0)
    this.htTimer = 0;          // half-time countdown
    this.score = { home: 0, away: 0 };
    this.stats = { home: emptyStats(), away: emptyStats() };
    this.events = [];          // light event log (goals, etc.) for later analytics

    // analytics (Phase 5)
    this.shotLog = [];         // { team, x, y, xg, onTarget, outcome, t }
    this.passNet = { home: {}, away: {} }; // "fromId|toId" -> count
    this.heat = {};            // playerId -> Float32Array position grid
    this.timeline = [{ t: 0, h: 0, a: 0 }]; // cumulative xG over time (momentum)
    this.xt = { home: 0, away: 0 };          // expected-threat added
    this._lastXt = { home: 0, away: 0 };

    this.firstKickoff = TEAM.HOME;
    this.lastTouchTeam = null;
    this.counterUntil = { home: 0, away: 0 }; // counter-attack transition window (clock seconds)

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
  teamName(team, lang = 'ar') {
    const n = this.clubName[team];
    return (n && (n[lang] || n.ar)) || team;
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

  _index() {
    this._byId = new Map();
    for (const p of [...this.players, ...this.bench.home, ...this.bench.away]) this._byId.set(p.id, p);
  }
  playerById(id) {
    return this._byId ? this._byId.get(id) : null;
  }

  // Bring `inId` (bench) on for `outId` (pitch) on the same team. The sub
  // inherits the position/role/anchor and comes on fresh.
  substitute(team, outId, inId) {
    if (this.subsUsed[team] >= STAMINA.MAX_SUBS) return false;
    const arr = this.teamPlayers(team);
    const out = arr.find((p) => p.id === outId);
    const inc = this.bench[team].find((p) => p.id === inId);
    if (!out || !inc) return false;

    inc.home = { x: out.home.x, y: out.home.y };
    inc.x = out.x; inc.y = out.y; inc.px = out.x; inc.py = out.y;
    inc.vx = inc.vy = 0;
    inc.role = out.role;
    inc.isGK = out.isGK;
    inc.onPitch = true;
    inc.currentStamina = 100;
    inc.hasBall = false;

    const i = arr.indexOf(out);
    arr[i] = inc;
    out.onPitch = false;
    out.hasBall = false;
    const bi = this.bench[team].indexOf(inc);
    this.bench[team][bi] = out;

    if (this.ball.owner === out) this.ball.owner = inc;
    this.players = [...this.home, ...this.away];
    this.subsUsed[team]++;
    this._index();
    return true;
  }

  // Man-marking: marker (a player on `team`) shadows a specific opponent.
  setManMark(markerId, targetId) {
    if (targetId) this.manMarks[markerId] = targetId;
    else delete this.manMarks[markerId];
  }

  // Apply tactical changes (pre-match or live). Re-derives tuning; if the
  // formation changes, re-places that team's anchors.
  setTactics(team, partial) {
    Object.assign(this.tactics[team], partial);
    this.tuning[team] = derive(this.tactics[team]);
    if (partial.formation) {
      const dir = this.attackDir[team];
      const fresh = placeTeam(team, partial.formation, dir);
      const old = this.teamPlayers(team);
      // keep live positions/numbers; just move each player's formation anchor
      old.forEach((p, i) => {
        if (fresh[i]) {
          p.home = { x: fresh[i].home.x, y: fresh[i].home.y };
          p.role = fresh[i].role;
          p.isGK = fresh[i].isGK;
        }
      });
      if (team === TEAM.HOME) this.homeFormation = partial.formation;
      else this.awayFormation = partial.formation;
    }
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
