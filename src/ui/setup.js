// ===========================================================================
// setup.js — pre-match selection: your club, the opponent, difficulty, and
// whether the opponent's AI adapts. Applying rebuilds the match.
// ===========================================================================

import { CLUBS, CLUB_IDS } from '../tactics/clubs.js';
import { SCENARIOS, SCENARIO_IDS } from '../modes/scenarios.js';
import { t } from './i18n.js';

export class Setup {
  constructor(el, { onApply }) {
    this.el = el;
    this.onApply = onApply;
    this.lang = 'ar';
    this._build();
  }

  _clubOptions(selected, customKey) {
    const custom = `<option value="">${t(customKey, this.lang)}</option>`;
    const clubs = CLUB_IDS.map(
      (id) => `<option value="${id}" ${selected === id ? 'selected' : ''}>${CLUBS[id].name[this.lang]}</option>`
    ).join('');
    return custom + clubs;
  }

  _build() {
    const L = (k) => t(k, this.lang);
    this.el.innerHTML = `
      <label class="su"><span>${L('yourClub')}</span><select data-su="home">${this._clubOptions('', 'custom')}</select></label>
      <label class="su"><span>${L('opponent')}</span><select data-su="away">${this._clubOptions('atletico', 'customAway')}</select></label>
      <label class="su"><span>${L('difficulty')}</span><select data-su="difficulty">
        <option value="easy">${L('diff_easy')}</option>
        <option value="normal" selected>${L('diff_normal')}</option>
        <option value="hard">${L('diff_hard')}</option>
      </select></label>
      <label class="su toggle"><input type="checkbox" data-su="adaptive" checked /><span>${L('adaptiveAI')}</span></label>
      <label class="su"><span>${L('scenario')}</span><select data-su="scenario">
        ${SCENARIO_IDS.map((id) => `<option value="${id}">${SCENARIOS[id].name[this.lang]}</option>`).join('')}
      </select></label>
      <button class="btn primary" data-su="apply">${L('apply2')}</button>`;
    this.el.querySelector('[data-su="apply"]').addEventListener('click', () => this.onApply(this.values()));
  }

  values() {
    const q = (s) => this.el.querySelector(`[data-su="${s}"]`);
    return {
      homeClubId: q('home').value || null,
      awayClubId: q('away').value || null,
      difficulty: q('difficulty').value,
      adaptive: q('adaptive').checked,
      scenario: q('scenario').value,
    };
  }

  setLang(lang) {
    const v = this.values();
    this.lang = lang;
    this._build();
    // restore selections
    const set = (s, val) => { const e = this.el.querySelector(`[data-su="${s}"]`); if (e) e.value = val; };
    set('home', v.homeClubId || '');
    set('away', v.awayClubId || '');
    set('difficulty', v.difficulty);
    set('scenario', v.scenario);
    this.el.querySelector('[data-su="adaptive"]').checked = v.adaptive;
  }
}
