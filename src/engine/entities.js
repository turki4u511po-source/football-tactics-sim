// ===========================================================================
// entities.js — Player and Ball. Plain state holders, no behavior, no DOM.
// px/py hold the PREVIOUS tick's position so the renderer can interpolate.
// ===========================================================================

export class Player {
  constructor({ id, team, number, role, x, y, isGK = false }) {
    this.id = id;
    this.team = team;
    this.number = number;
    this.role = role;
    this.isGK = isGK;

    // formation anchor ("home") the player returns to
    this.home = { x, y };

    // live kinematics
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;

    // previous-tick snapshot (for render interpolation)
    this.px = x;
    this.py = y;

    // ball relationship
    this.hasBall = false;
    this.holdTime = 0;       // time since the last decision while carrying
    this.carryTime = 0;      // total time carrying this possession
    this.nextDecision = 1.0; // when they'll next decide (seconds)

    // attributes (0–100); Phase 2 uses passing/shooting/dribbling/tackling/positioning
    this.attr = {
      pace: 72,
      passing: 70,
      shooting: 68,
      dribbling: 70,
      tackling: 68,
      positioning: 70,
      vision: 70,
      strength: 70,
      stamina: 90,
    };
  }

  get pos() {
    return { x: this.x, y: this.y };
  }
}

export class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.px = x;
    this.py = y;
    this.owner = null;       // Player instance, or null when loose
    this.isShot = false;     // true while a shot is in flight (for saves + stats)
    this.isPass = false;     // true while a pass is in flight (pass vs interception)
    this.flightLock = 0;     // seconds after a kick during which NOBODY can collect it
    this.selfLock = 0;       // seconds the last kicker can't recollect their own ball
    this.lastKicker = null;  // who last struck the ball (for self-lock + accounting)
  }

  get pos() {
    return { x: this.x, y: this.y };
  }
}
