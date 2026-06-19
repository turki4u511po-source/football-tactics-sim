// ===========================================================================
// hud.js — score + clock + phase readout. Reads world state once per frame.
// ===========================================================================

import { TEAM_COLORS, MATCH_SECONDS } from '../engine/constants.js';
import { t } from './i18n.js';

export class Hud {
  constructor(el) {
    this.el = el;
    this.lang = 'ar';
    this.el.innerHTML = `
      <div class="hud-team home">
        <span class="dot"></span><span class="name" data-home-name></span>
      </div>
      <div class="hud-center">
        <div class="score"><span data-score-home>0</span> - <span data-score-away>0</span></div>
        <div class="clock" data-clock>00:00</div>
        <div class="phase" data-phase></div>
      </div>
      <div class="hud-team away">
        <span class="name" data-away-name></span><span class="dot"></span>
      </div>`;

    this.$ = (sel) => this.el.querySelector(sel);
    this.$('.hud-team.home .dot').style.background = TEAM_COLORS.home.fill;
    this.$('.hud-team.away .dot').style.background = TEAM_COLORS.away.fill;
  }

  setLang(lang) {
    this.lang = lang;
  }

  update(world) {
    this.$('[data-home-name]').textContent = TEAM_COLORS.home.name[this.lang];
    this.$('[data-away-name]').textContent = TEAM_COLORS.away.name[this.lang];
    this.$('[data-score-home]').textContent = world.score.home;
    this.$('[data-score-away]').textContent = world.score.away;

    const clamped = Math.min(world.clock, MATCH_SECONDS);
    this.$('[data-clock]').textContent = formatClock(clamped);

    const phaseKey = world.phase === 'kickoff' ? 'kickoff' : 'inPlay';
    this.$('[data-phase]').textContent = t(phaseKey, this.lang);
  }
}

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
