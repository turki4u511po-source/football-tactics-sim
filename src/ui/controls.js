// ===========================================================================
// controls.js — builds the control bar and wires it to handlers from main.js.
// Knows nothing about the engine internals; just emits intent via callbacks.
// ===========================================================================

import { SPEEDS } from '../engine/constants.js';
import { t } from './i18n.js';

export class Controls {
  constructor(el, handlers) {
    this.el = el;
    this.h = handlers;
    this.lang = 'ar';
    this.playing = false;
    this.speed = 1;
    this._build();
  }

  _build() {
    this.el.innerHTML = `
      <button class="btn primary" data-act="play"></button>
      <button class="btn" data-act="step"></button>
      <button class="btn" data-act="restart"></button>
      <div class="group" data-group="speed">
        <span class="lbl" data-lbl="speed"></span>
        ${SPEEDS.map((s) => `<button class="btn speed" data-speed="${s}">${s}×</button>`).join('')}
      </div>
      <div class="group">
        <span class="lbl" data-lbl="seed"></span>
        <input class="seed" type="text" inputmode="numeric" value="42" />
        <button class="btn" data-act="apply"></button>
      </div>
      <label class="group toggle">
        <input type="checkbox" data-act="numbers" checked />
        <span class="lbl" data-lbl="numbers"></span>
      </label>
      <button class="btn accent" data-act="tactics"></button>
      <button class="btn accent" data-act="analytics"></button>
      <button class="btn ghost" data-act="lang"></button>`;

    const q = (s) => this.el.querySelector(s);
    this.$play = q('[data-act="play"]');
    this.$seed = q('.seed');

    this.$play.addEventListener('click', () => this.h.onPlayToggle());
    q('[data-act="step"]').addEventListener('click', () => this.h.onStep());
    q('[data-act="tactics"]').addEventListener('click', () => this.h.onTactics());
    q('[data-act="analytics"]').addEventListener('click', () => this.h.onAnalytics());
    q('[data-act="restart"]').addEventListener('click', () => this.h.onRestart());
    q('[data-act="apply"]').addEventListener('click', () => this.h.onSeed(this.$seed.value));
    this.$seed.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.h.onSeed(this.$seed.value);
    });
    q('[data-act="numbers"]').addEventListener('change', (e) => this.h.onToggleNumbers(e.target.checked));
    q('[data-act="lang"]').addEventListener('click', () => this.h.onToggleLang());

    this.el.querySelectorAll('[data-speed]').forEach((b) => {
      b.addEventListener('click', () => this.h.onSpeed(Number(b.dataset.speed)));
    });

    this.setLang(this.lang);
    this.setSpeed(this.speed);
    this.setPlaying(this.playing);
  }

  setPlaying(playing) {
    this.playing = playing;
    this.$play.textContent = t(playing ? 'pause' : 'play', this.lang);
  }

  setSpeed(speed) {
    this.speed = speed;
    this.el.querySelectorAll('[data-speed]').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.speed) === speed);
    });
  }

  setLang(lang) {
    this.lang = lang;
    this.el.querySelector('[data-act="restart"]').textContent = t('restart', lang);
    this.el.querySelector('[data-act="step"]').textContent = t('step', lang);
    this.el.querySelector('[data-act="tactics"]').textContent = t('tactics', lang);
    this.el.querySelector('[data-act="analytics"]').textContent = t('analytics', lang);
    this.el.querySelector('[data-act="apply"]').textContent = t('apply', lang);
    this.el.querySelector('[data-act="lang"]').textContent = t('language', lang);
    this.el.querySelector('[data-lbl="speed"]').textContent = t('speed', lang);
    this.el.querySelector('[data-lbl="seed"]').textContent = t('seed', lang);
    this.el.querySelector('[data-lbl="numbers"]').textContent = t('numbers', lang);
    this.setPlaying(this.playing);
  }

  getSeed() {
    return this.$seed.value;
  }
}
