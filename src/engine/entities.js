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
    this.holdTime = 0;       // how long this player has carried the ball
    this.nextRelease = 1.0;  // when they'll pass/drive next (seconds)

    // attributes (0–100) — Phase 1 only really uses pace; rest land in Phase 2/3
    this.attr = { pace: 72, passing: 70, shooting: 68, tackling: 68, positioning: 70 };
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
    this.owner = null;        // Player instance, or null when loose
    this.controlCooldown = 0; // while > 0 the ball is "in flight" and uncollectable
  }

  get pos() {
    return { x: this.x, y: this.y };
  }
}
