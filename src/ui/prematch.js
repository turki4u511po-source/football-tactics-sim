// ===========================================================================
// prematch.js — pre-match planning screen (shown before kickoff). Pick teams,
// difficulty, scenario, your formation and all team instructions, then kick off.
// Writes a config that main.js turns into the match.
// ===========================================================================

import { OPTIONS, defaultTactics } from '../tactics/tactics.js';
import { CLUBS, CLUB_IDS } from '../tactics/clubs.js';
import { SCENARIOS, SCENARIO_IDS } from '../modes/scenarios.js';
import { t, optLabel } from './i18n.js';

const INSTR = ['formation', 'mentality', 'playstyle', 'pressing', 'line', 'width', 'tempo', 'buildup', 'focus'];

export class PreMatch {
  constructor(el, { onKickoff, onBack, getConfig }) {
    this.el = el;
    this.h = { onKickoff, onBack };
    this.cfg = getConfig();
    this.lang = 'ar';
    this.el.addEventListener('click', (e) => {
      const a = e.target.dataset.act;
      if (a === 'pm-kick') this.h.onKickoff(this._read());
      else if (a === 'pm-back') this.h.onBack();
    });
    // picking a club loads its tactical identity into the form (then tweak it)
    this.el.addEventListener('change', (e) => {
      if (e.target.dataset.pm === 'home') {
        this.cfg = this._read();
        const id = this.cfg.homeClubId;
        this.cfg.tactics = { ...defaultTactics(), ...(id ? CLUBS[id].tactics : {}) };
        this.render();
      }
    });
  }

  setLang(lang) {
    this.lang = lang;
    if (this.el.classList.contains('show')) this.render();
  }
  show(v) {
    this.el.classList.toggle('show', v);
    if (v) this.render();
  }

  _read() {
    const v = (s) => this.el.querySelector(`[data-pm="${s}"]`);
    const tactics = {};
    for (const k of INSTR) tactics[k] = v(k).value;
    tactics.invertedFB = v('invertedFB').checked;
    return {
      homeClubId: v('home').value || null,
      awayClubId: v('away').value || null,
      difficulty: v('difficulty').value,
      adaptive: v('adaptive').checked,
      scenario: v('scenario').value,
      tactics,
    };
  }

  render() {
    const L = (k) => t(k, this.lang);
    const c = this.cfg;
    const clubOpts = (sel, customKey) =>
      `<option value="">${L(customKey)}</option>` +
      CLUB_IDS.map((id) => `<option value="${id}" ${sel === id ? 'selected' : ''}>${CLUBS[id].name[this.lang]}</option>`).join('');
    const instrRow = (k) =>
      `<label class="pm-field"><span>${L('s_' + k)}</span><select data-pm="${k}">
        ${OPTIONS[k].map((v) => `<option value="${v}" ${c.tactics[k] === v ? 'selected' : ''}>${optLabel(v)}</option>`).join('')}
      </select></label>`;

    this.el.innerHTML = `
      <div class="pm-card">
        <div class="a-head"><h2>${L('preMatchTitle')}</h2>
          <button class="btn ghost" data-act="pm-back">${L('back')}</button></div>

        <h3>${L('teamsTitle')}</h3>
        <div class="pm-grid">
          <label class="pm-field"><span>${L('yourClub')}</span><select data-pm="home">${clubOpts(c.homeClubId, 'custom')}</select></label>
          <label class="pm-field"><span>${L('opponent')}</span><select data-pm="away">${clubOpts(c.awayClubId, 'customAway')}</select></label>
          <label class="pm-field"><span>${L('difficulty')}</span><select data-pm="difficulty">
            <option value="easy" ${c.difficulty === 'easy' ? 'selected' : ''}>${L('diff_easy')}</option>
            <option value="normal" ${c.difficulty === 'normal' ? 'selected' : ''}>${L('diff_normal')}</option>
            <option value="hard" ${c.difficulty === 'hard' ? 'selected' : ''}>${L('diff_hard')}</option>
          </select></label>
          <label class="pm-field"><span>${L('scenario')}</span><select data-pm="scenario">
            ${SCENARIO_IDS.map((id) => `<option value="${id}" ${c.scenario === id ? 'selected' : ''}>${SCENARIOS[id].name[this.lang]}</option>`).join('')}
          </select></label>
          <label class="pm-field toggle"><input type="checkbox" data-pm="adaptive" ${c.adaptive ? 'checked' : ''} /><span>${L('adaptiveAI')}</span></label>
        </div>

        <h3>${L('yourTactics')}</h3>
        <div class="pm-grid">
          ${INSTR.map(instrRow).join('')}
          <label class="pm-field toggle"><input type="checkbox" data-pm="invertedFB" ${c.tactics.invertedFB ? 'checked' : ''} /><span>${L('invFB')}</span></label>
        </div>

        <button class="btn primary big" data-act="pm-kick">${L('kickOff')} ⚽</button>
      </div>`;
  }
}
