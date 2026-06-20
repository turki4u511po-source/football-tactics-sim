// ===========================================================================
// panel.js — the live tactics & management overlay (Phase 4).
// Reads/writes the CURRENT world directly, so every change takes effect within
// a couple of sim seconds: team instructions, formation, substitutions
// (stamina-aware) and man-marking. Rebuilds its content on refresh().
// ===========================================================================

import { OPTIONS } from '../tactics/tactics.js';
import { STAMINA } from '../engine/constants.js';
import { t, optLabel } from './i18n.js';

const TEAM = 'home'; // the user's team

export class Panel {
  constructor(el, { getWorld }) {
    this.el = el;
    this.getWorld = getWorld;
    this.lang = 'ar';
    this.open = false;
    this.selOut = null;
    this.selIn = null;

    this.el.addEventListener('change', (e) => this._onChange(e));
    this.el.addEventListener('click', (e) => this._onClick(e));
  }

  setLang(lang) {
    this.lang = lang;
    if (this.open) this.refresh();
  }

  toggle(force) {
    this.open = force === undefined ? !this.open : force;
    this.el.classList.toggle('open', this.open);
    if (this.open) this.refresh();
  }

  // ---- events -------------------------------------------------------------
  _onChange(e) {
    const w = this.getWorld();
    const tgt = e.target;
    if (tgt.dataset.set) {
      w.setTactics(TEAM, { [tgt.dataset.set]: tgt.value });
      this.refresh();
    } else if (tgt.dataset.mark) {
      w.setManMark(tgt.dataset.mark, tgt.value || null);
    }
  }

  _onClick(e) {
    const w = this.getWorld();
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      if (pick.dataset.pick === 'out') this.selOut = pick.dataset.id;
      else this.selIn = pick.dataset.id;
      this.refresh();
      return;
    }
    if (e.target.dataset.act === 'sub' && this.selOut && this.selIn) {
      if (w.substitute(TEAM, this.selOut, this.selIn)) {
        this.selOut = this.selIn = null;
        this.refresh();
      }
    }
    if (e.target.dataset.act === 'close') this.toggle(false);
  }

  // ---- render -------------------------------------------------------------
  refresh() {
    const w = this.getWorld();
    if (!w) return;
    const L = (k) => t(k, this.lang);
    const tac = w.tactics[TEAM];

    const settingRow = (key) => {
      const opts = OPTIONS[key]
        .map((v) => `<option value="${v}" ${tac[key] === v ? 'selected' : ''}>${optLabel(v)}</option>`)
        .join('');
      return `<label class="prow"><span>${L('s_' + key)}</span><select data-set="${key}">${opts}</select></label>`;
    };

    const onPitch = w.teamPlayers(TEAM);
    const away = w.opponentsOf(TEAM).filter((p) => !p.isGK);

    const subPlayerRow = (p, kind) => {
      const sel = (kind === 'out' ? this.selOut : this.selIn) === p.id;
      const stam = Math.round(p.currentStamina);
      const bar =
        kind === 'out'
          ? `<span class="stam"><span class="stamfill" style="width:${stam}%;background:${stam < 35 ? '#eb5757' : stam < 65 ? '#f2c94c' : '#27ae60'}"></span></span>`
          : '';
      return `<div class="pp ${sel ? 'sel' : ''}" data-pick="${kind}" data-id="${p.id}">
        <b>${p.number}</b> <span class="role">${p.role}</span> ${bar}</div>`;
    };

    const manMarkRow = (p) => {
      const cur = w.manMarks[p.id] || '';
      const opts =
        `<option value="">${L('none')}</option>` +
        away
          .map((o) => `<option value="${o.id}" ${cur === o.id ? 'selected' : ''}>#${o.number} ${o.role}</option>`)
          .join('');
      return `<label class="prow small"><span>#${p.number} ${p.role}</span><select data-mark="${p.id}">${opts}</select></label>`;
    };

    const subsRemaining = STAMINA.MAX_SUBS - w.subsUsed[TEAM];

    this.el.innerHTML = `
      <div class="panel-head">
        <h2>${L('tactics')} — ${this.lang === 'ar' ? 'الأزرق' : 'Blue'}</h2>
        <button class="btn ghost" data-act="close">${L('close')}</button>
      </div>

      <section><h3>${L('teamShape')}</h3>
        <div class="grid">${OPTIONS && ['formation', 'mentality', 'playstyle', 'pressing', 'line', 'width', 'tempo', 'buildup', 'focus'].map(settingRow).join('')}</div>
      </section>

      <section><h3>${L('subsTitle')} <small>(${subsRemaining} ${L('subsLeft')})</small></h3>
        <div class="subcols">
          <div><div class="collab">${L('stamina')}</div>${onPitch.map((p) => subPlayerRow(p, 'out')).join('')}</div>
          <div><div class="collab">${L('bench')}</div>${w.bench[TEAM].map((p) => subPlayerRow(p, 'in')).join('')}</div>
        </div>
        <button class="btn primary wide" data-act="sub" ${this.selOut && this.selIn ? '' : 'disabled'}>${L('subBtn')}</button>
      </section>

      <section><h3>${L('manMarkTitle')}</h3>
        <div class="grid">${onPitch.filter((p) => !p.isGK).map(manMarkRow).join('')}</div>
      </section>`;
  }
}
