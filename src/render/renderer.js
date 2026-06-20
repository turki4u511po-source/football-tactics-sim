// ===========================================================================
// renderer.js — owns the canvas and draws an interpolated view of the world.
// It only READS world state; it never mutates the simulation. Rendering is fully
// decoupled from the fixed-timestep logic (see loop.js / main.js).
// ===========================================================================

import { PITCH, PLAYER, BALL, TEAM_COLORS } from '../engine/constants.js';
import { drawPitch } from './pitch.js';
import { lerp } from '../engine/vec.js';
import { roleLayer } from '../tactics/tactics.js';

const MARGIN = 26; // CSS px of board around the pitch

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.cssW = 0;
    this.cssH = 0;
    this.tf = { scale: 1, ox: 0, oy: 0 };
    this.options = { numbers: true, shape: false, lang: 'ar' };
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(320, rect.width);
    this.cssH = Math.max(240, rect.height);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    this._computeTransform();
  }

  _computeTransform() {
    const availW = this.cssW - 2 * MARGIN;
    const availH = this.cssH - 2 * MARGIN;
    const scale = Math.min(availW / PITCH.LENGTH, availH / PITCH.WIDTH);
    const pitchW = PITCH.LENGTH * scale;
    const pitchH = PITCH.WIDTH * scale;
    this.tf = {
      scale,
      ox: (this.cssW - pitchW) / 2,
      oy: (this.cssH - pitchH) / 2,
    };
  }

  // alpha ∈ [0,1] interpolates previous tick (px,py) → current tick (x,y).
  render(world, alpha = 1) {
    const ctx = this.ctx;
    const { tf } = this;

    // board background
    ctx.fillStyle = '#0c1620';
    ctx.fillRect(0, 0, this.cssW, this.cssH);

    drawPitch(ctx, tf);

    if (this.options.shape) {
      this._drawShape(world, 'home', alpha);
      this._drawShape(world, 'away', alpha);
    }
    this._drawBall(world, alpha);
    for (const p of world.players) this._drawPlayer(p, alpha);
  }

  // formation/shape overlay: connect each line (defence / midfield / attack)
  _drawShape(world, team, alpha) {
    const ctx = this.ctx;
    const { scale, ox, oy } = this.tf;
    const col = TEAM_COLORS[team].fill;
    const px = (p) => ox + lerp(p.px, p.x, alpha) * scale;
    const py = (p) => oy + lerp(p.py, p.y, alpha) * scale;
    for (const layer of [0, 1, 2]) {
      const ps = world
        .teamPlayers(team)
        .filter((p) => !p.isGK && Math.round(roleLayer(p.role)) === layer)
        .sort((a, b) => a.y - b.y);
      if (ps.length < 2) continue;
      ctx.beginPath();
      ps.forEach((p, i) => (i ? ctx.lineTo(px(p), py(p)) : ctx.moveTo(px(p), py(p))));
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  _drawPlayer(p, alpha) {
    const ctx = this.ctx;
    const { scale, ox, oy } = this.tf;
    const x = ox + lerp(p.px, p.x, alpha) * scale;
    const y = oy + lerp(p.py, p.y, alpha) * scale;
    const r = Math.max(7, PLAYER.RADIUS * scale);
    const col = TEAM_COLORS[p.team];

    // ball-carrier highlight ring
    if (p.hasBall) {
      ctx.beginPath();
      ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffe25a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = col.fill;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = p.isGK ? '#ffd24a' : 'rgba(255,255,255,0.85)';
    ctx.stroke();

    if (this.options.numbers) {
      ctx.fillStyle = col.text;
      ctx.font = `${Math.round(r * 1.05)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.number), x, y + 0.5);
    }
  }

  _drawBall(world, alpha) {
    const ctx = this.ctx;
    const { scale, ox, oy } = this.tf;
    const b = world.ball;
    const x = ox + lerp(b.px, b.x, alpha) * scale;
    const y = oy + lerp(b.py, b.y, alpha) * scale;
    const r = Math.max(3.2, BALL.RADIUS * scale);

    ctx.beginPath();
    ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#222';
    ctx.stroke();
  }

  // map a CSS-pixel point (e.g. a click) back to pitch meters
  pixelToMeters(px, py) {
    return {
      x: (px - this.tf.ox) / this.tf.scale,
      y: (py - this.tf.oy) / this.tf.scale,
    };
  }
}
