// ===========================================================================
// labView.js — the Sandbox "Lab" (Phase 7):
//   • Seeded what-if A/B: run the match, change ONE setting, re-run the SAME
//     seed, show both results side by side with a diff.
//   • Test vs archetypes: run your tactic against a spectrum of clubs.
// Both reuse the deterministic headless runner, so results are reproducible.
// ===========================================================================

import { OPTIONS } from '../tactics/tactics.js';
import { CLUBS } from '../tactics/clubs.js';
import { runMatch } from '../modes/runner.js';
import { t, optLabel } from './i18n.js';

const WHATIF_SETTINGS = ['mentality', 'playstyle', 'pressing', 'line', 'width', 'tempo', 'buildup'];
const ARCHETYPES = ['atletico', 'barcelona', 'man-city', 'psg', 'tottenham', 'liverpool'];

export class LabView {
  constructor(el, { getSetup, getSeed }) {
    this.el = el;
    this.getSetup = getSetup;
    this.getSeed = getSeed;
    this.lang = 'ar';
    this.open = false;
    this.result = null; // 'whatif' | 'archetype'
    this.el.addEventListener('click', (e) => this._onClick(e));
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

  _baseOpts() {
    const s = this.getSetup();
    return {
      homeClub: s.homeClubId ? CLUBS[s.homeClubId] : undefined,
      awayClub: s.awayClubId ? CLUBS[s.awayClubId] : undefined,
      difficulty: s.difficulty,
      adaptive: s.adaptive,
    };
  }

  _onClick(e) {
    const act = e.target.dataset.act;
    if (act === 'lab-close') this.toggle(false);
    else if (act === 'lab-run') this._runWhatIf();
    else if (act === 'lab-arch') this._runArchetypes();
  }

  _runWhatIf() {
    const seed = this.getSeed();
    const setting = this.el.querySelector('[data-lab="setting"]').value;
    const value = this.el.querySelector('[data-lab="value"]').value;
    const base = runMatch(this._baseOpts(), seed);
    const variant = runMatch({ ...this._baseOpts(), homeTactics: { [setting]: value } }, seed);
    this.result = { kind: 'whatif', seed, setting, value, base, variant };
    this.render();
  }

  _runArchetypes() {
    const seed = this.getSeed();
    const s = this.getSetup();
    const home = { homeClub: s.homeClubId ? CLUBS[s.homeClubId] : undefined };
    const rows = ARCHETYPES.map((id) => ({ id, r: runMatch({ ...home, awayClub: CLUBS[id], adaptive: false }, seed) }));
    this.result = { kind: 'archetype', seed, rows };
    this.render();
  }

  render() {
    const L = (k) => t(k, this.lang);
    const settingOpts = WHATIF_SETTINGS.map((s) => `<option value="${s}">${L('s_' + s)}</option>`).join('');
    const selSetting = this.el.querySelector?.('[data-lab="setting"]')?.value || 'line';
    const valueOpts = OPTIONS[selSetting].map((v) => `<option value="${v}">${optLabel(v)}</option>`).join('');

    this.el.innerHTML = `
      <div class="a-head">
        <h2>${L('lab')}</h2>
        <button class="btn ghost" data-act="lab-close">${L('close')}</button>
      </div>
      <div class="lab-body">
        <section>
          <h3>${L('whatif')}</h3>
          <p class="muted">${L('whatifHint')}</p>
          <div class="lab-row">
            <select data-lab="setting">${settingOpts}</select>
            <select data-lab="value">${valueOpts}</select>
            <button class="btn primary" data-act="lab-run">${L('runAB')}</button>
          </div>
          <div data-lab="out"></div>
        </section>
        <section>
          <h3>${L('archTitle')}</h3>
          <p class="muted">${L('archHint')}</p>
          <button class="btn" data-act="lab-arch">${L('runArch')}</button>
          <div data-lab="archout"></div>
        </section>
      </div>`;

    // refresh value options when the setting changes
    const setSel = this.el.querySelector('[data-lab="setting"]');
    setSel.value = selSetting;
    setSel.addEventListener('change', () => {
      const vs = OPTIONS[setSel.value].map((v) => `<option value="${v}">${optLabel(v)}</option>`).join('');
      this.el.querySelector('[data-lab="value"]').innerHTML = vs;
    });

    if (this.result && this.result.kind === 'whatif') this.el.querySelector('[data-lab="out"]').innerHTML = this._whatIfTable();
    if (this.result && this.result.kind === 'archetype') this.el.querySelector('[data-lab="archout"]').innerHTML = this._archTable();
  }

  _whatIfTable() {
    const { setting, value, base, variant, seed } = this.result;
    const row = (label, fa, fb) => {
      const a = fa, b = fb;
      const d = (typeof a === 'number' && typeof b === 'number') ? b - a : '';
      const dc = d === '' ? '' : d > 0 ? 'up' : d < 0 ? 'down' : '';
      return `<tr><td>${label}</td><td>${a}</td><td>${b}</td><td class="${dc}">${d === '' ? '' : (d > 0 ? '+' : '') + (Math.round(d * 100) / 100)}</td></tr>`;
    };
    return `
      <p class="muted">${t('seed', this.lang)} ${seed} · ${t('s_' + setting, this.lang)} → <b>${optLabel(value)}</b></p>
      <table class="stats lab-tbl">
        <tr><th></th><th>A</th><th>B</th><th>Δ</th></tr>
        ${row(t('st_xg', this.lang) + ' (home)', base.xg.home, variant.xg.home)}
        ${row('Goals (home)', base.score.home, variant.score.home)}
        ${row('Goals (away)', base.score.away, variant.score.away)}
        ${row(t('st_xt', this.lang) + ' (home)', base.xt.home, variant.xt.home)}
        ${row(t('st_poss', this.lang) + ' (home)', base.poss.home, variant.poss.home)}
        ${row(t('st_shots', this.lang) + ' (home)', base.shots.home, variant.shots.home)}
      </table>`;
  }

  _archTable() {
    const name = (id) => CLUBS[id].name[this.lang];
    const rows = this.result.rows
      .map(({ id, r }) => {
        const res = r.score.home > r.score.away ? 'W' : r.score.home < r.score.away ? 'L' : 'D';
        return `<tr><td>${name(id)}</td><td>${r.score.home}-${r.score.away}</td><td class="${res === 'W' ? 'up' : res === 'L' ? 'down' : ''}">${res}</td><td>${r.xg.home}-${r.xg.away}</td></tr>`;
      })
      .join('');
    return `<table class="stats lab-tbl"><tr><th>${t('opponent', this.lang)}</th><th>${t('st_shots', this.lang)}…</th><th></th><th>xG</th></tr>${rows}</table>`;
  }
}
