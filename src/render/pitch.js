// ===========================================================================
// pitch.js — draws the top-down pitch and its markings.
// `tf` is the meter→pixel transform { scale, ox, oy }: px = ox + meters*scale.
// ===========================================================================

import { PITCH } from '../engine/constants.js';

const LINE = 'rgba(255,255,255,0.78)';
const GRASS_A = '#1f7a45';
const GRASS_B = '#1c7040';

export function drawPitch(ctx, tf) {
  const X = (m) => tf.ox + m * tf.scale;
  const Y = (m) => tf.oy + m * tf.scale;
  const S = tf.scale;
  const { LENGTH: L, WIDTH: W } = PITCH;

  // mowing stripes
  const stripes = 12;
  const sw = L / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? GRASS_B : GRASS_A;
    ctx.fillRect(X(i * sw), Y(0), sw * S + 1, W * S);
  }

  ctx.lineWidth = Math.max(1.2, 0.12 * S);
  ctx.strokeStyle = LINE;
  ctx.fillStyle = LINE;

  // outer boundary
  ctx.strokeRect(X(0), Y(0), L * S, W * S);

  // halfway line
  line(ctx, X(L / 2), Y(0), X(L / 2), Y(W));

  // center circle + spot
  circle(ctx, X(L / 2), Y(W / 2), PITCH.CENTER_CIRCLE_R * S);
  dot(ctx, X(L / 2), Y(W / 2), Math.max(1.6, 0.18 * S));

  // both ends: penalty area, goal area, penalty spot, arc, goal
  drawEnd(ctx, tf, 'left');
  drawEnd(ctx, tf, 'right');

  // corner arcs
  const cr = PITCH.CORNER_R * S;
  arc(ctx, X(0), Y(0), cr, 0, Math.PI / 2);
  arc(ctx, X(L), Y(0), cr, Math.PI / 2, Math.PI);
  arc(ctx, X(L), Y(W), cr, Math.PI, 1.5 * Math.PI);
  arc(ctx, X(0), Y(W), cr, 1.5 * Math.PI, 2 * Math.PI);
}

function drawEnd(ctx, tf, side) {
  const X = (m) => tf.ox + m * tf.scale;
  const Y = (m) => tf.oy + m * tf.scale;
  const S = tf.scale;
  const { LENGTH: L, WIDTH: W } = PITCH;
  const left = side === 'left';
  const goalLineX = left ? 0 : L;
  const dir = left ? 1 : -1; // into the pitch

  // penalty area
  const paW = PITCH.PENALTY_AREA_WIDTH;
  const paD = PITCH.PENALTY_AREA_DEPTH;
  rect(ctx, X(goalLineX), Y(W / 2 - paW / 2), dir * paD * S, paW * S);

  // goal area (six-yard box)
  const gaW = PITCH.GOAL_AREA_WIDTH;
  const gaD = PITCH.GOAL_AREA_DEPTH;
  rect(ctx, X(goalLineX), Y(W / 2 - gaW / 2), dir * gaD * S, gaW * S);

  // penalty spot
  const spotX = goalLineX + dir * PITCH.PENALTY_SPOT;
  dot(ctx, X(spotX), Y(W / 2), Math.max(1.4, 0.16 * S));

  // penalty arc (only the part outside the box)
  const a0 = left ? -0.93 : Math.PI - 0.93;
  const a1 = left ? 0.93 : Math.PI + 0.93;
  arc(ctx, X(spotX), Y(W / 2), PITCH.CENTER_CIRCLE_R * S, a0, a1);

  // goal (drawn just outside the goal line)
  const gW = PITCH.GOAL_WIDTH;
  const gD = PITCH.GOAL_DEPTH;
  ctx.save();
  ctx.lineWidth = Math.max(1.5, 0.16 * S);
  ctx.strokeStyle = '#ffffff';
  rect(ctx, X(goalLineX), Y(W / 2 - gW / 2), -dir * gD * S, gW * S);
  ctx.restore();
}

// --- tiny canvas helpers ---------------------------------------------------
function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
function rect(ctx, x, y, w, h) {
  ctx.strokeRect(x, y, w, h);
}
function circle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}
function arc(ctx, cx, cy, r, a0, a1) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, a0, a1);
  ctx.stroke();
}
function dot(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}
