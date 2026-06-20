// ===========================================================================
// charts.js — Canvas-drawn analytics: heatmap, shot map, pass network, momentum.
// Each draws onto a 2D context; pure functions reading world state.
// ===========================================================================

import { PITCH, TEAM_COLORS } from '../engine/constants.js';
import { drawPitch } from '../render/pitch.js';
import { HEAT_COLS, HEAT_ROWS } from './analytics.js';

export function fitPitch(w, h, margin = 8) {
  const scale = Math.min((w - 2 * margin) / PITCH.LENGTH, (h - 2 * margin) / PITCH.WIDTH);
  return { scale, ox: (w - PITCH.LENGTH * scale) / 2, oy: (h - PITCH.WIDTH * scale) / 2 };
}

export function drawHeat(ctx, w, h, world, team) {
  ctx.clearRect(0, 0, w, h);
  const tf = fitPitch(w, h);
  drawPitch(ctx, tf);
  const grid = new Float32Array(HEAT_COLS * HEAT_ROWS);
  for (const p of world.teamPlayers(team)) {
    const g = world.heat[p.id];
    if (g) for (let i = 0; i < grid.length; i++) grid[i] += g[i];
  }
  let max = 0;
  for (const v of grid) if (v > max) max = v;
  const cw = (PITCH.LENGTH / HEAT_COLS) * tf.scale;
  const ch = (PITCH.WIDTH / HEAT_ROWS) * tf.scale;
  const col = TEAM_COLORS[team].fill;
  const rgb = hexRgb(col);
  for (let r = 0; r < HEAT_ROWS; r++) {
    for (let c = 0; c < HEAT_COLS; c++) {
      const v = grid[r * HEAT_COLS + c] / (max || 1);
      if (v <= 0.03) continue;
      ctx.fillStyle = `rgba(${rgb},${0.12 + 0.68 * v})`;
      ctx.fillRect(tf.ox + c * cw, tf.oy + r * ch, cw + 1, ch + 1);
    }
  }
}

export function drawShotMap(ctx, w, h, world) {
  ctx.clearRect(0, 0, w, h);
  const tf = fitPitch(w, h);
  drawPitch(ctx, tf);
  for (const s of world.shotLog) {
    const dxFromGoal = Math.abs((s.dir > 0 ? PITCH.LENGTH : 0) - s.x);
    const mx = s.team === 'home' ? PITCH.LENGTH - dxFromGoal : dxFromGoal;
    const px = tf.ox + mx * tf.scale;
    const py = tf.oy + s.y * tf.scale;
    const r = 2 + 11 * Math.sqrt(s.xg);
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle =
      s.outcome === 'goal' ? 'rgba(39,174,96,0.9)' : s.onTarget ? 'rgba(242,201,76,0.8)' : 'rgba(220,220,220,0.45)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = TEAM_COLORS[s.team].fill;
    ctx.stroke();
  }
}

export function drawPassNet(ctx, w, h, world, team) {
  ctx.clearRect(0, 0, w, h);
  const tf = fitPitch(w, h);
  drawPitch(ctx, tf);
  const pos = {};
  for (const p of world.teamPlayers(team)) pos[p.id] = heatCentroid(world.heat[p.id]) || { x: p.home.x, y: p.home.y };
  const X = (m) => tf.ox + m.x * tf.scale;
  const Y = (m) => tf.oy + m.y * tf.scale;
  let maxC = 1;
  for (const k in world.passNet[team]) maxC = Math.max(maxC, world.passNet[team][k]);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  for (const k in world.passNet[team]) {
    const [a, b] = k.split('|');
    if (!pos[a] || !pos[b]) continue;
    ctx.lineWidth = 0.5 + 3.5 * (world.passNet[team][k] / maxC);
    ctx.beginPath();
    ctx.moveTo(X(pos[a]), Y(pos[a]));
    ctx.lineTo(X(pos[b]), Y(pos[b]));
    ctx.stroke();
  }
  for (const p of world.teamPlayers(team)) {
    const m = pos[p.id];
    ctx.beginPath();
    ctx.arc(X(m), Y(m), 7, 0, Math.PI * 2);
    ctx.fillStyle = TEAM_COLORS[team].fill;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(p.number), X(m), Y(m));
  }
}

export function drawMomentum(ctx, w, h, world) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0b1722';
  ctx.fillRect(0, 0, w, h);
  const tl = world.timeline;
  const pad = 22;
  const maxT = Math.max(1, tl[tl.length - 1].t);
  let maxX = 0.6;
  for (const p of tl) maxX = Math.max(maxX, p.h, p.a);
  const X = (t) => pad + (t / maxT) * (w - 2 * pad);
  const Y = (v) => h - pad - (v / maxX) * (h - 2 * pad);
  // axes
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.moveTo(pad, pad);
  ctx.lineTo(pad, h - pad);
  ctx.stroke();
  // half-time marker
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(X(45 * 60), pad);
  ctx.lineTo(X(45 * 60), h - pad);
  ctx.stroke();
  const series = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    tl.forEach((p, i) => {
      const x = X(p.t), y = Y(p[key]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  };
  series('h', TEAM_COLORS.home.fill);
  series('a', TEAM_COLORS.away.fill);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`xG ${maxX.toFixed(1)}`, pad + 2, pad - 6 + 10);
}

// --- helpers --------------------------------------------------------------
function heatCentroid(grid) {
  if (!grid) return null;
  let sx = 0, sy = 0, s = 0;
  for (let r = 0; r < HEAT_ROWS; r++) {
    for (let c = 0; c < HEAT_COLS; c++) {
      const v = grid[r * HEAT_COLS + c];
      sx += v * ((c + 0.5) / HEAT_COLS) * PITCH.LENGTH;
      sy += v * ((r + 0.5) / HEAT_ROWS) * PITCH.WIDTH;
      s += v;
    }
  }
  return s ? { x: sx / s, y: sy / s } : null;
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
