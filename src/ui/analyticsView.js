// ===========================================================================
// analyticsView.js — the analytics / post-match overlay (Phase 5).
// Live stat table, heatmap, shot map, pass network, momentum (cumulative xG),
// plain-language insights, and JSON / PNG export. Opens on demand and auto-opens
// at full time. Reads the current world; nothing here affects the simulation.
// ===========================================================================

import { TEAM_COLORS } from '../engine/constants.js';
import { t } from './i18n.js';
import { poss, passPct, ppdaFor, generateInsights } from '../analytics/analytics.js';
import { drawHeat, drawShotMap, drawPassNet, drawMomentum } from '../analytics/charts.js';
import { SCENARIOS } from '../modes/scenarios.js';

const ROWS = [
  ['st_poss', (w, tm) => poss(w, tm) + '%'],
  ['st_shots', (w, tm) => w.stats[tm].shots],
  ['st_sot', (w, tm) => w.stats[tm].shotsOnTarget],
  ['st_xg', (w, tm) => w.stats[tm].xg.toFixed(2)],
  ['st_xt', (w, tm) => w.xt[tm].toFixed(0)],
  ['st_passes', (w, tm) => w.stats[tm].passes],
  ['st_passpct', (w, tm) => passPct(w, tm) + '%'],
  ['st_int', (w, tm) => w.stats[tm].interceptions],
  ['st_tackles', (w, tm) => w.stats[tm].tackles],
  ['st_corners', (w, tm) => w.stats[tm].corners],
  ['st_fouls', (w, tm) => w.stats[tm].fouls],
  ['st_ppda', (w, tm) => { const v = ppdaFor(w, tm); return v ? v.toFixed(1) : '—'; }],
];

export class AnalyticsView {
  constructor(el, { getWorld, onRematch, onMenu }) {
    this.el = el;
    this.getWorld = getWorld;
    this.onRematch = onRematch || (() => {});
    this.onMenu = onMenu || (() => {});
    this.lang = 'ar';
    this.open = false;
    this.viewTeam = 'home';
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

  _onClick(e) {
    const act = e.target.dataset.act;
    if (act === 'a-close') this.toggle(false);
    else if (act === 'a-rematch') this.onRematch();
    else if (act === 'a-menu') this.onMenu();
    else if (act === 'a-team') {
      this.viewTeam = this.viewTeam === 'home' ? 'away' : 'home';
      this.render();
    } else if (act === 'a-json') this._exportJson();
    else if (act === 'a-png') this._exportPng();
  }

  render() {
    const w = this.getWorld();
    if (!w) return;
    const L = (k) => t(k, this.lang);
    const teamName = (tm) => w.teamName(tm, this.lang);

    const rows = ROWS.map(
      ([key, fn]) =>
        `<tr><td class="hv">${fn(w, 'home')}</td><td class="mid">${L(key)}</td><td class="av">${fn(w, 'away')}</td></tr>`
    ).join('');

    const insights = generateInsights(w, this.lang).map((i) => `<li>${i}</li>`).join('');
    const phaseDone = w.phase === 'fulltime';

    let scenarioBadge = '';
    if (w.scenario && SCENARIOS[w.scenario.id] && SCENARIOS[w.scenario.id].win) {
      const sc = SCENARIOS[w.scenario.id];
      const res = sc.win(w);
      const label = res.met ? t('challengeWon', this.lang) : t('challengeLost', this.lang);
      scenarioBadge = `<div class="scenario-badge ${res.met ? 'won' : 'lost'}">${sc.name[this.lang]} — ${label}</div>`;
    }

    this.el.innerHTML = `
      <div class="a-head">
        <h2>${L('analytics')} — <span style="color:${TEAM_COLORS.home.fill}">${teamName('home')}</span>
          ${w.score.home}-${w.score.away}
          <span style="color:${TEAM_COLORS.away.fill}">${teamName('away')}</span>
          ${phaseDone ? '· ' + t('fulltimeLbl', this.lang) : ''}</h2>
        <div class="a-actions">
          ${phaseDone ? `<button class="btn primary" data-act="a-rematch">${L('rematch')}</button>
          <button class="btn" data-act="a-menu">${L('mainMenu')}</button>` : ''}
          <button class="btn" data-act="a-json">${L('exportJson')}</button>
          <button class="btn" data-act="a-png">${L('exportPng')}</button>
          <button class="btn ghost" data-act="a-close">${L('close')}</button>
        </div>
      </div>
      ${scenarioBadge}
      <div class="a-body">
        <div class="a-left">
          <h3>${L('statsTitle')}</h3>
          <table class="stats">${rows}</table>
          <h3>${L('insightsTitle')}</h3>
          <ul class="insights">${insights}</ul>
        </div>
        <div class="a-right">
          <div class="chart"><span class="clab">${L('shotMap')}</span><canvas id="c-shot" width="380" height="240"></canvas></div>
          <div class="chart"><span class="clab">${L('heatmap')} · ${teamName(this.viewTeam)} <button class="mini" data-act="a-team">⇄</button></span><canvas id="c-heat" width="380" height="240"></canvas></div>
          <div class="chart"><span class="clab">${L('passNetwork')} · ${teamName(this.viewTeam)}</span><canvas id="c-net" width="380" height="240"></canvas></div>
          <div class="chart"><span class="clab">${L('momentum')}</span><canvas id="c-mom" width="380" height="240"></canvas></div>
        </div>
      </div>`;

    drawShotMap(this.el.querySelector('#c-shot').getContext('2d'), 380, 240, w);
    drawHeat(this.el.querySelector('#c-heat').getContext('2d'), 380, 240, w, this.viewTeam);
    drawPassNet(this.el.querySelector('#c-net').getContext('2d'), 380, 240, w, this.viewTeam);
    drawMomentum(this.el.querySelector('#c-mom').getContext('2d'), 380, 240, w);
  }

  _summary() {
    const w = this.getWorld();
    const team = (tm) => ({
      name: TEAM_COLORS[tm].name.en,
      goals: w.score[tm],
      possession: poss(w, tm),
      ...w.stats[tm],
      xt: +w.xt[tm].toFixed(1),
      ppda: ppdaFor(w, tm),
    });
    return {
      seed: w.seed,
      score: `${w.score.home}-${w.score.away}`,
      minute: +(w.clock / 60).toFixed(1),
      home: team('home'),
      away: team('away'),
      shots: w.shotLog,
      insights: generateInsights(w, 'en'),
    };
  }

  _download(href, name) {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  _exportJson() {
    const blob = new Blob([JSON.stringify(this._summary(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    this._download(url, `match-${this.getWorld().seed}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  _exportPng() {
    const w = this.getWorld();
    const cv = document.createElement('canvas');
    cv.width = 800;
    cv.height = 540;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0a121b';
    ctx.fillRect(0, 0, 800, 540);
    ctx.fillStyle = '#fff';
    ctx.font = '700 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Blue ${w.score.home} - ${w.score.away} Red`, 400, 28);
    // compose the four charts into the summary image
    const tmp = document.createElement('canvas');
    tmp.width = 380; tmp.height = 240;
    const tctx = tmp.getContext('2d');
    const blit = (drawFn, x, y) => { drawFn(tctx, 380, 240, w, this.viewTeam); ctx.drawImage(tmp, x, y, 380, 240); };
    blit((c, ww, hh, world) => drawShotMap(c, ww, hh, world), 12, 44);
    blit((c, ww, hh, world) => drawHeat(c, ww, hh, world, 'home'), 404, 44);
    blit((c, ww, hh, world) => drawPassNet(c, ww, hh, world, 'home'), 12, 292);
    blit((c, ww, hh, world) => drawMomentum(c, ww, hh, world), 404, 292);
    this._download(cv.toDataURL('image/png'), `match-${w.seed}.png`);
  }
}
