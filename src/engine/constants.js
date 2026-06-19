// ===========================================================================
// constants.js — shared simulation constants (pure data, no DOM)
// All spatial units are METERS; the renderer scales meters → pixels.
// ===========================================================================

// --- Pitch geometry (real football pitch, meters) -------------------------
// x runs goal-to-goal (length), y runs touchline-to-touchline (width).
export const PITCH = {
  LENGTH: 105,
  WIDTH: 68,
  GOAL_WIDTH: 7.32,
  GOAL_DEPTH: 2.2,
  PENALTY_AREA_DEPTH: 16.5,
  PENALTY_AREA_WIDTH: 40.32,
  GOAL_AREA_DEPTH: 5.5,
  GOAL_AREA_WIDTH: 18.32,
  PENALTY_SPOT: 11.0,
  CENTER_CIRCLE_R: 9.15,
  CORNER_R: 1.0,
};

// --- Timing ---------------------------------------------------------------
export const TICK_RATE = 30;                                  // logic ticks / in-game second
export const FIXED_DT = 1 / TICK_RATE;                        // in-game seconds per tick
export const MATCH_SECONDS = 90 * 60;                         // 5400 in-game seconds (full match)
export const REAL_MATCH_SECONDS = 5 * 60;                     // 300 real seconds at 1x
export const TIME_SCALE = MATCH_SECONDS / REAL_MATCH_SECONDS; // 18 in-game s per real s @ 1x
export const HALF_SECONDS = MATCH_SECONDS / 2;

export const SPEEDS = [1, 2, 4];

// --- Teams ----------------------------------------------------------------
export const TEAM = { HOME: 'home', AWAY: 'away' };

// Home attacks toward +x (defends x = 0). Away attacks toward -x (defends x = LENGTH).
export const ATTACK_DIR = { home: +1, away: -1 };

export const TEAM_COLORS = {
  home: { fill: '#2f80ed', text: '#ffffff', ring: '#bcdcff', name: { ar: 'الأزرق', en: 'Blue' } },
  away: { fill: '#eb5757', text: '#ffffff', ring: '#ffd0d0', name: { ar: 'الأحمر', en: 'Red' } },
};

// --- Player movement tuning (meters, seconds) -----------------------------
export const PLAYER = {
  RADIUS: 1.15,
  BASE_SPEED: 7.4,     // m/s outfield top speed
  GK_SPEED: 5.6,
  ACCEL: 22,           // m/s^2 toward desired velocity
  SLOW_RADIUS: 2.2,    // start easing when within this of target
  CONTROL_RADIUS: 1.5, // distance to collect a loose ball
  STEAL_RADIUS: 1.4,   // opponent must be within this to contest the carrier
};

// --- Ball tuning ----------------------------------------------------------
export const BALL = {
  RADIUS: 0.45,
  LINEAR_DAMP: 0.9,    // exp velocity damping per second when loose
  MAX_SPEED: 32,
  WALL_BOUNCE: 0.55,   // touchline reflection energy retained
};

// --- Phase-1 behavior knobs ----------------------------------------------
export const SIM = {
  KICKOFF_PAUSE: 0.9,         // in-game seconds the kickoff is held before play
  STEAL_CHANCE_PER_TICK: 0.05,// per-tick probability an in-range opponent wins the ball
  BLOCK_SHIFT_X: 0.42,        // how far the team shifts toward the ball along x
  BLOCK_SHIFT_Y: 0.40,        // ... and along y
  HOLD_MIN: 0.7,              // carrier holds the ball this long (min) before releasing
  HOLD_MAX: 1.7,              // ... and at most this long
  PASS_MIN_RANGE: 6,          // teammates closer than this aren't pass targets
  PASS_MAX_RANGE: 34,         // ... nor farther than this
};
