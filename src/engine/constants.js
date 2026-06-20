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
  DRIBBLE_FACTOR: 0.86,// a player on the ball is slower than one running freely
  SLOW_RADIUS: 2.2,    // start easing when within this of target
  CONTROL_RADIUS: 1.5, // distance to collect a loose ball
  STEAL_RADIUS: 2.0,   // opponent must be within this to contest the carrier
};

// --- Ball tuning ----------------------------------------------------------
export const BALL = {
  RADIUS: 0.45,
  LINEAR_DAMP: 0.9,    // exp velocity damping per second when loose
  MAX_SPEED: 32,
  WALL_BOUNCE: 0.55,   // touchline reflection energy retained
  FLIGHT_LOCK: 0.10,  // seconds after a kick during which the ball is uncollectable
};

// --- Off-ball / shape knobs ----------------------------------------------
export const SIM = {
  STEAL_CHANCE_PER_TICK: 0.045,// per-tick probability an adjacent opponent tackles the carrier
  BLOCK_SHIFT_X: 0.42,        // how far the team shifts toward the ball along x
  BLOCK_SHIFT_Y: 0.40,        // ... and along y
  PASS_MIN_RANGE: 5,          // teammates closer than this aren't pass targets
  PASS_MAX_RANGE: 38,         // ... nor farther than this
};

// --- On-ball decision making (Phase 2) -----------------------------------
export const DECISION = {
  MIN: 0.9,                   // seconds between carrier decisions (min)
  MAX: 2.0,                   // ... and max
  DRIBBLE_GAP: 0.6,           // quicker re-think while dribbling
  PRESSURE_RADIUS: 5.0,       // opponents within this count as "pressure"
  MAX_CARRY: 4.0,             // force a release after carrying this long
};

export const PASS = {
  BASE_SPEED: 13,             // m/s, scaled up with distance
  SELF_LOCK: 0.18,            // seconds the passer can't recollect their own pass
  SPREAD: 0.10,              // base aim jitter (radians), reduced by passing skill
};

export const SHOT = {
  RANGE: 19,                  // only consider shooting within this of goal (m)
  GOOD_RANGE: 11,             // high-confidence shooting distance
  SPEED: 27,                  // shot ball speed (m/s)
  SPREAD: 0.42,             // base aim jitter (radians), worse w/ distance & pressure
  EAGERNESS: 0.8,        // global damping on how readily players shoot
};

export const GK = {
  LINE_OFFSET: 2.2,           // how far off the goal line the keeper sits
  SAVE_REACH: 4.8,           // a shot within this of the keeper can be saved
  CATCH_CHANCE: 0.93,         // chance a reachable shot is caught (else parried wide)
  ANTICIPATE_RANGE: 40,       // start tracking an incoming shot within this
  REACH_SPEED_BONUS: 2.2,     // keeper moves faster reacting to a live shot
  TRACK_Y: 3.4,              // max lateral offset from goal centre in open play
  RUSH_RANGE: 16,             // come off the line to narrow the angle within this
  RUSH_OUT: 8.0,              // max distance off the line when rushing a 1v1
};

// --- Match flow ----------------------------------------------------------
export const MATCH = {
  INJ1_MIN: 60,  INJ1_MAX: 150,   // first-half stoppage time (seconds)
  INJ2_MIN: 120, INJ2_MAX: 300,   // second-half stoppage time (seconds)
  HALFTIME_PAUSE: 4,              // in-game seconds spent at half-time
  GOAL_FLASH: 2.4,               // in-game seconds the GOAL banner shows
};

// stamina: drains with distance covered, lowering top speed late in the game
export const STAMINA = {
  DRAIN_PER_M: 0.0022,    // stamina lost per metre run
  MIN_SPEED_FACTOR: 0.74, // top-speed multiplier at 0 stamina
  BENCH_SIZE: 7,
  MAX_SUBS: 5,
};

// dead-ball restart hold times (in-game seconds before play resumes)
export const RESTART_PAUSE = {
  kickoff: 0.9,
  goalkick: 0.7,
  throwin: 0.55,
  corner: 0.8,
  freekick: 0.7,
};

export const FOUL_RATE = 0.05; // share of won tackles that are fouls
