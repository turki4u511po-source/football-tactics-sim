// ===========================================================================
// menu.js — the main menu (FIFA-like front screen). Routes to a new match
// (pre-match planning), season mode, or the sandbox lab.
// ===========================================================================

import { t } from './i18n.js';

export class Menu {
  constructor(el, handlers) {
    this.el = el;
    this.h = handlers;
    this.lang = 'ar';
    this.render();
    this.el.addEventListener('click', (e) => {
      const a = e.target.dataset.menu;
      if (a && this.h['on' + a]) this.h['on' + a]();
    });
  }
  setLang(lang) {
    this.lang = lang;
    this.render();
  }
  show(v) {
    this.el.classList.toggle('show', v);
  }
  render() {
    const L = (k) => t(k, this.lang);
    this.el.innerHTML = `
      <div class="menu-card">
        <h1>${L('title')}</h1>
        <p class="tag">${L('phaseTag')}</p>
        <div class="menu-btns">
          <button class="btn primary big" data-menu="NewMatch">${L('newMatch')}</button>
          <button class="btn big" data-menu="Season">${L('season')}</button>
          <button class="btn big" data-menu="Lab">${L('lab')}</button>
        </div>
      </div>`;
  }
}
