// ===========================================================================
// analytics/analytics.js — pure analytics helpers (no DOM):
//   • xG model (transparent weighted formula, 0..1 per shot)
//   • xT value of a pitch position (expected-threat grid)
//   • heatmap grid helpers
//   • plain-language (Arabic/English) post-match insights
// The engine calls xgModel/xtValue; the UI renders the rest.
// ===========================================================================

import { PITCH } from '../engine/constants.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// --- xG: probability a shot becomes a goal (0..1) -------------------------
export function xgModel({ distance, angleFactor, defenders = 0, gkClose = false, header = false, setPiece = false }) {
  let xg = Math.exp(-distance / 9) * (0.32 + 0.68 * angleFactor);
  xg *= 1 - clamp(0.13 * defenders, 0, 0.7); // bodies in the way
  if (gkClose) xg *= 0.72; // keeper has narrowed the angle / rushed out
  if (header) xg *= 0.6;
  if (setPiece) xg *= 0.9;
  return clamp(xg, 0.01, 0.95);
}

// --- xT: danger of a position for the team attacking `attackGoalX` ---------
export function xtValue(x, y, attackGoalX) {
  const d = Math.abs(attackGoalX - x); // distance to the attacking goal line
  const prox = clamp(1 - d / PITCH.LENGTH, 0, 1);
  const lateral = Math.abs(y - PITCH.WIDTH / 2) / (PITCH.WIDTH / 2);
  return prox * prox * (1 - 0.55 * lateral);
}

// --- heatmap grid ---------------------------------------------------------
export const HEAT_COLS = 16;
export const HEAT_ROWS = 10;
export function makeGrid() {
  return new Float32Array(HEAT_COLS * HEAT_ROWS);
}
export function heatIndex(x, y) {
  const cx = clamp(Math.floor((x / PITCH.LENGTH) * HEAT_COLS), 0, HEAT_COLS - 1);
  const cy = clamp(Math.floor((y / PITCH.WIDTH) * HEAT_ROWS), 0, HEAT_ROWS - 1);
  return cy * HEAT_COLS + cx;
}

// --- plain-language insights from a finished/ongoing match ----------------
export function generateInsights(world, lang = 'ar') {
  const out = [];
  const s = world.stats;
  const ph = poss(world, 'home');
  const pa = 100 - ph;
  const push = (ar, en) => out.push(lang === 'ar' ? ar : en);

  // possession
  if (Math.abs(ph - 50) >= 9) {
    const dom = ph > 50 ? 'home' : 'away';
    const pct = dom === 'home' ? ph : pa;
    push(
      `${teamAr(dom)} سيطر على الاستحواذ (${pct}%).`,
      `${teamEn(dom)} dominated possession (${pct}%).`
    );
  }

  // xG quality of chances
  const xgh = s.home.xg, xga = s.away.xg;
  if (Math.abs(xgh - xga) > 0.4) {
    const better = xgh > xga ? 'home' : 'away';
    push(
      `${teamAr(better)} صنع الفرص الأخطر (xG ${xgh.toFixed(1)}–${xga.toFixed(1)}).`,
      `${teamEn(better)} created the better chances (xG ${xgh.toFixed(1)}–${xga.toFixed(1)}).`
    );
  }

  // wasted / clinical, per team
  for (const team of ['home', 'away']) {
    const g = world.score[team];
    const xg = s[team].xg;
    if (xg - g >= 1.3) push(`${teamAr(team)} أهدر فرصًا (xG ${xg.toFixed(1)} مقابل ${g} أهداف).`, `${teamEn(team)} wasted chances (xG ${xg.toFixed(1)} vs ${g} goals).`);
    else if (g - xg >= 1.3) push(`${teamAr(team)} كان حاسمًا أمام المرمى (${g} أهداف من xG ${xg.toFixed(1)}).`, `${teamEn(team)} was clinical (${g} goals from ${xg.toFixed(1)} xG).`);
  }

  // threatening flank (from the shot map)
  const side = flankSplit(world, 'home');
  if (side.total >= 4 && Math.abs(side.leftPct - 50) >= 18) {
    const f = side.leftPct > 50 ? ['الأيسر', 'left'] : ['الأيمن', 'right'];
    const pct = Math.max(side.leftPct, 100 - side.leftPct);
    push(`أغلب تهديد ${teamAr('home')} جاء من الجناح ${f[0]} (${pct}% من التسديدات).`, `Most of ${teamEn('home')}'s threat came from the ${f[1]} (${pct}% of shots).`);
  }

  // pressing intensity (PPDA)
  const ppda = ppdaFor(world, 'home');
  if (ppda && ppda < 9) push(`${teamAr('home')} ضغط بشدة على الخصم (PPDA ${ppda.toFixed(1)}).`, `${teamEn('home')} pressed intensely (PPDA ${ppda.toFixed(1)}).`);

  // late fitness
  const fit = avgStamina(world, 'home');
  if (world.clock > 70 * 60 && fit < 55) push(`تراجعت لياقة ${teamAr('home')} في آخر المباراة (متوسط ${Math.round(fit)}%).`, `${teamEn('home')}'s fitness dropped late (avg ${Math.round(fit)}%).`);

  if (!out.length) push('مباراة متكافئة بدون فروق واضحة في الأرقام.', 'An even game with no standout statistical differences.');
  return out;
}

// --- derived metrics (also used by the live stat bar) ---------------------
export function poss(world, team) {
  const h = world.stats.home.possTicks;
  const a = world.stats.away.possTicks;
  const tot = h + a || 1;
  return Math.round((100 * world.stats[team].possTicks) / tot);
}
export function passPct(world, team) {
  const s = world.stats[team];
  return s.passes ? Math.round((100 * s.passesCompleted) / s.passes) : 0;
}
export function ppdaFor(world, team) {
  // opponent passes allowed per our defensive action (tackles + interceptions)
  const opp = world.other(team);
  const acts = world.stats[team].tackles + world.stats[team].interceptions;
  return acts ? world.stats[opp].passes / acts : null;
}
export function avgStamina(world, team) {
  const f = world.teamPlayers(team).filter((p) => !p.isGK);
  return f.reduce((s, p) => s + p.currentStamina, 0) / (f.length || 1);
}
function flankSplit(world, team) {
  const shots = world.shotLog.filter((s) => s.team === team);
  let left = 0;
  for (const s of shots) if (s.y < PITCH.WIDTH / 2) left++;
  const total = shots.length;
  return { total, leftPct: total ? Math.round((100 * left) / total) : 50 };
}

function teamAr(team) {
  return team === 'home' ? 'الأزرق' : 'الأحمر';
}
function teamEn(team) {
  return team === 'home' ? 'Blue' : 'Red';
}
