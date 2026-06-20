// ===========================================================================
// modes/season.js — Season / Career mode (Phase 8). A small league: a
// double round-robin fixture list, a points table, and squads that carry
// FATIGUE, FORM and slow DEVELOPMENT across matches (which nudge each club's
// effective rating). Deterministic: non-played matches are simulated headlessly
// with per-fixture seeds. No DOM.
// ===========================================================================

import { CLUBS } from '../tactics/clubs.js';
import { runMatch } from './runner.js';

// a deliberately mixed league (aggressive + moderate + deep) so the table stays
// believable rather than full of blow-outs
const LEAGUE = ['liverpool', 'tottenham', 'atletico', 'al-hilal', 'al-qadsiah', 'man-utd', 'dortmund', 'al-ittihad'];
export const LEAGUE_IDS = LEAGUE;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function emptyRow() {
  return { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
}

// circle-method double round-robin (each pair plays home and away)
function doubleRoundRobin(ids) {
  const arr = [...ids];
  const n = arr.length;
  const first = [];
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      round.push(r % 2 ? { home: b, away: a } : { home: a, away: b });
    }
    first.push(round);
    arr.splice(1, 0, arr.pop()); // rotate, keep first fixed
  }
  const second = first.map((round) => round.map((f) => ({ home: f.away, away: f.home })));
  return [...first, ...second];
}

export class Season {
  constructor({ userClubId, seed = 1, difficulty = 'normal' } = {}) {
    this.seed = seed >>> 0 || 1;
    this.difficulty = difficulty;
    this.clubs = LEAGUE.includes(userClubId) || !userClubId ? [...LEAGUE] : [userClubId, ...LEAGUE.slice(0, LEAGUE.length - 1)];
    this.userClubId = userClubId && this.clubs.includes(userClubId) ? userClubId : this.clubs[0];
    this.fixtures = doubleRoundRobin(this.clubs);
    this.round = 0;

    this.table = {};
    this.form = {};
    this.fatigue = {};
    this.dev = {};
    for (const id of this.clubs) {
      this.table[id] = emptyRow();
      this.form[id] = 0;
      this.fatigue[id] = 0;
      this.dev[id] = 0;
    }
    this.resultsLog = []; // resultsLog[round] = [{home,away,hg,ag}]
  }

  get totalRounds() {
    return this.fixtures.length;
  }
  isOver() {
    return this.round >= this.fixtures.length;
  }
  currentRound() {
    return this.fixtures[this.round] || [];
  }
  userFixture() {
    return this.currentRound().find((f) => f.home === this.userClubId || f.away === this.userClubId) || null;
  }

  // effective rating = base ± form, − fatigue, + slow development
  effRating(id) {
    return clamp(CLUBS[id].rating + 0.05 * this.form[id] - 0.07 * this.fatigue[id] + this.dev[id], 0.58, 1.07);
  }
  clubFor(id) {
    return { ...CLUBS[id], rating: this.effRating(id) };
  }
  matchOpts(home, away) {
    return { homeClub: this.clubFor(home), awayClub: this.clubFor(away), difficulty: this.difficulty, adaptive: true };
  }
  matchSeed(idx) {
    return ((this.seed * 100003 + this.round * 131 + idx * 17) >>> 0) || 1;
  }

  _record(home, away, hg, ag) {
    apply(this.table[home], hg, ag);
    apply(this.table[away], ag, hg);
    this.fatigue[home] += 0.5;
    this.fatigue[away] += 0.5;
    this.form[home] = clamp(this.form[home] * 0.65 + (hg > ag ? 0.4 : hg < ag ? -0.4 : 0.05), -1, 1);
    this.form[away] = clamp(this.form[away] * 0.65 + (ag > hg ? 0.4 : ag < hg ? -0.4 : 0.05), -1, 1);
  }

  // recover + develop, then move to the next matchday
  _advance(roundResults) {
    this.resultsLog[this.round] = roundResults;
    for (const id of this.clubs) {
      this.fatigue[id] = Math.max(0, this.fatigue[id] - 0.4); // rest between games
      this.dev[id] = clamp(this.dev[id] + 0.004 * this.form[id], -0.03, 0.07); // slow development
    }
    this.round++;
  }

  // simulate every fixture this round except `skip` (the user's, if played live)
  _simRound(skip) {
    const out = [];
    this.currentRound().forEach((f, idx) => {
      if (skip && f.home === skip.home && f.away === skip.away) return;
      const s = runMatch(this.matchOpts(f.home, f.away), this.matchSeed(idx));
      const [hg, ag] = compressScore(s.score.home, s.score.away);
      this._record(f.home, f.away, hg, ag);
      out.push({ home: f.home, away: f.away, hg, ag });
    });
    return out;
  }

  // the user played their match live → record it, sim the rest, advance
  completeUserMatch(home, away, hg, ag) {
    this._record(home, away, hg, ag);
    const others = this._simRound({ home, away });
    this._advance([{ home, away, hg, ag }, ...others]);
  }

  // simulate the whole current round (including the user's), advance
  simulateMatchday() {
    const res = this._simRound(null);
    this._advance(res);
  }

  // auto-play the rest of the season
  simulateToEnd() {
    while (!this.isOver()) this.simulateMatchday();
  }

  standings() {
    return this.clubs
      .map((id) => ({ id, ...this.table[id], gd: this.table[id].gf - this.table[id].ga }))
      .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  }
}

// compress a raw sim score into a believable league range while preserving the
// result (winner/draw). Keeps the engine's chance model but a sane scoreline.
function compressScore(hg, ag) {
  const c = (g) => Math.round(7 * (1 - Math.exp(-g / 5)));
  let h = c(hg);
  let a = c(ag);
  if (hg > ag && h <= a) h = a + 1;
  else if (ag > hg && a <= h) a = h + 1;
  else if (hg === ag) a = h; // keep draws level
  return [h, a];
}

function apply(row, gf, ga) {
  row.p++;
  row.gf += gf;
  row.ga += ga;
  if (gf > ga) {
    row.w++;
    row.pts += 3;
  } else if (gf < ga) {
    row.l++;
  } else {
    row.d++;
    row.pts++;
  }
}
