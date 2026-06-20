// ===========================================================================
// seasonView.js — Season / Career overlay (Phase 8): league table, your next
// fixture (play it live or simulate), latest results, your form/fatigue, and a
// season-start club picker. Reads the Season model owned by main.js.
// ===========================================================================

import { CLUBS } from '../tactics/clubs.js';
import { LEAGUE_IDS } from '../modes/season.js';
import { t } from './i18n.js';

export class SeasonView {
  constructor(el, handlers) {
    this.el = el;
    this.h = handlers;
    this.lang = 'ar';
    this.open = false;
    this.el.addEventListener('click', (e) => this._click(e));
  }

  setLang(lang) {
    this.lang = lang;
    if (this.open) this.render();
  }
  toggle(force) {
    this.open = force === undefined ? !this.open : force;
    this.el.classList.toggle('open', this.open);
    if (this.open) this.render();
  }

  _click(e) {
    const a = e.target.dataset.act;
    if (a === 'se-close') this.toggle(false);
    else if (a === 'se-start') { this.h.onStart(this.el.querySelector('[data-se="club"]').value); this.render(); }
    else if (a === 'se-play') this.h.onPlay();
    else if (a === 'se-sim') { this.h.onSim(); this.render(); }
    else if (a === 'se-auto') { this.h.onAuto(); this.render(); }
    else if (a === 'se-new') { this.h.onNew(); this.render(); }
  }

  render() {
    const L = (k) => t(k, this.lang);
    const name = (id) => CLUBS[id].name[this.lang];
    const s = this.h.getSeason();

    if (!s) {
      const opts = LEAGUE_IDS.map((id) => `<option value="${id}">${name(id)}</option>`).join('');
      this.el.innerHTML = `
        <div class="a-head"><h2>${L('season')}</h2><button class="btn ghost" data-act="se-close">${L('close')}</button></div>
        <div class="se-start">
          <p class="muted">${L('yourClub')}</p>
          <select data-se="club">${opts}</select>
          <button class="btn primary" data-act="se-start">${L('startSeason')}</button>
        </div>`;
      return;
    }

    const star = (id) => (id === s.userClubId ? 'me' : '');
    const rows = s.standings()
      .map((r, i) => `<tr class="${star(r.id)}"><td>${i + 1}</td><td class="tname">${name(r.id)}</td>
        <td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td>
        <td>${r.gd >= 0 ? '+' : ''}${r.gd}</td><td class="pts">${r.pts}</td></tr>`)
      .join('');

    const fx = s.userFixture();
    let fixtureHtml;
    if (s.isOver()) {
      const champ = s.standings()[0];
      fixtureHtml = `<div class="scenario-badge won">${L('seasonOver')}: ${name(champ.id)} 🏆</div>
        <button class="btn" data-act="se-new">${L('newSeason')}</button>`;
    } else {
      const homeSide = fx.home === s.userClubId;
      const opp = homeSide ? fx.away : fx.home;
      fixtureHtml = `
        <div class="se-fixture">
          <div class="muted">${L('matchday')} ${s.round + 1}/${s.totalRounds} — ${L('nextFixture')}</div>
          <div class="se-match">${homeSide ? name(s.userClubId) : name(opp)} <span class="muted">${L('vs')}</span> ${homeSide ? name(opp) : name(s.userClubId)}</div>
          <div class="se-buttons">
            <button class="btn primary" data-act="se-play">${L('playMatch')}</button>
            <button class="btn" data-act="se-sim">${L('simMatchday')}</button>
            <button class="btn ghost" data-act="se-auto">${L('autoSim')}</button>
          </div>
        </div>`;
    }

    // latest results (previous round)
    const last = s.resultsLog[s.round - 1] || [];
    const resultsHtml = last.length
      ? `<h3>${L('recentResults')}</h3><div class="se-results">${last
          .map((m) => `<span>${name(m.home)} ${m.hg}-${m.ag} ${name(m.away)}</span>`)
          .join('')}</div>`
      : '';

    const fForm = (Math.round(s.form[s.userClubId] * 100) / 100);
    const fFat = (Math.round(s.fatigue[s.userClubId] * 100) / 100);

    this.el.innerHTML = `
      <div class="a-head">
        <h2>${L('season')} — ${name(s.userClubId)}</h2>
        <button class="btn ghost" data-act="se-close">${L('close')}</button>
      </div>
      ${fixtureHtml}
      <div class="se-body">
        <div>
          <h3>${L('leagueTable')}</h3>
          <table class="stats se-table">
            <tr><th>#</th><th class="tname">Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr>
            ${rows}
          </table>
          <p class="muted">${L('formLbl')}: ${fForm >= 0 ? '+' : ''}${fForm} · ${L('fatigueLbl')}: ${fFat}</p>
        </div>
        <div>${resultsHtml}</div>
      </div>`;
  }
}
