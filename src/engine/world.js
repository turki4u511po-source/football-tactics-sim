// ===========================================================================
// world.js — the match state container. Builds the two teams + ball, owns the
// clock/score/phase. No behavior here (that lives in simulation.js) and no DOM.
// ===========================================================================

import { PITCH, TEAM, ATTACK_DIR, SIM } from './constants.js';
import { Player, Ball } from './entities.js';
import { FORMATIONS, DEFAULT_FORMATION } from './formations.js';
import { lerp } from './vec.js';

// Map a normalized formation slot into pitch meters for one team.
// Home occupies the left half (own goal at x=0); away mirrors into the right half.
function slotToMeters(slot, team) {
  let x = lerp(2.5, PITCH.LENGTH * 0.47, slot.nx);
  const y = lerp(4, PITCH.WIDTH - 4, slot.ny);
  if (ATTACK_DIR[team] < 0) x = PITCH.LENGTH - x; // mirror for away
  return { x, y };
}

function placeTeam(team, formationName) {
  const tmpl = FORMATIONS[formationName] || FORMATIONS[DEFAULT_FORMATION];
  return tmpl.map((slot, i) => {
    const { x, y } = slotToMeters(slot, team);
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

export class World {
  constructor({ seed = 1, homeFormation = DEFAULT_FORMATION, awayFormation = DEFAULT_FORMATION } = {}) {
    this.seed = seed;
    this.homeFormation = homeFormation;
    this.awayFormation = awayFormation;

    this.home = placeTeam(TEAM.HOME, homeFormation);
    this.away = placeTeam(TEAM.AWAY, awayFormation);
    this.players = [...this.home, ...this.away];

    this.ball = new Ball(PITCH.LENGTH / 2, PITCH.WIDTH / 2);

    this.clock = 0;             // in-game seconds elapsed
    this.tick = 0;
    this.score = { home: 0, away: 0 };

    this.phase = 'kickoff';     // 'kickoff' | 'play'
    this.kickoffTeam = TEAM.HOME;
    this.kickoffTimer = SIM.KICKOFF_PAUSE;
  }

  teamPlayers(team) {
    return team === TEAM.HOME ? this.home : this.away;
  }

  opponentsOf(team) {
    return team === TEAM.HOME ? this.away : this.home;
  }

  // Center of the goal this team is ATTACKING.
  attackingGoal(team) {
    return { x: ATTACK_DIR[team] > 0 ? PITCH.LENGTH : 0, y: PITCH.WIDTH / 2 };
  }

  // Center of the goal this team is DEFENDING.
  ownGoal(team) {
    return { x: ATTACK_DIR[team] > 0 ? 0 : PITCH.LENGTH, y: PITCH.WIDTH / 2 };
  }

  // Begin (or restart) a kickoff for `team`. Resets the ball to center and
  // sends every player back toward their formation home.
  startKickoff(team) {
    this.phase = 'kickoff';
    this.kickoffTeam = team;
    this.kickoffTimer = SIM.KICKOFF_PAUSE;
    const b = this.ball;
    b.x = b.px = PITCH.LENGTH / 2;
    b.y = b.py = PITCH.WIDTH / 2;
    b.vx = b.vy = 0;
    b.owner = null;
    b.controlCooldown = 0;
    for (const p of this.players) {
      p.hasBall = false;
      p.holdTime = 0;
    }
  }
}
