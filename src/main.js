// ===========================================================================
// main.js — composition root. Owns the requestAnimationFrame loop and wires
// engine ↔ renderer ↔ UI. This is the ONLY place the fixed-step engine and the
// (variable-rate) render loop meet; the engine never touches the DOM.
// ===========================================================================

import { World } from './engine/world.js';
import { step } from './engine/simulation.js';
import { FixedStepper } from './engine/loop.js';
import { makeRng, hashSeed } from './engine/rng.js';
import { TIME_SCALE } from './engine/constants.js';
import { Renderer } from './render/renderer.js';
import { Hud } from './ui/hud.js';
import { Controls } from './ui/controls.js';
import { Panel } from './ui/panel.js';
import { AnalyticsView } from './ui/analyticsView.js';
import { t } from './ui/i18n.js';

const state = { lang: 'ar', speed: 1, paused: false, seed: 42 };

let world;
let rng;
let stepper;
let ftShown = false; // analytics auto-opened at full time?

// (Re)build a fresh, deterministic match from a seed.
function buildMatch(seedInput) {
  state.seed = normalizeSeed(seedInput);
  rng = makeRng(state.seed);
  world = new World({ seed: state.seed });
  stepper = new FixedStepper((dt) => step(world, rng, dt));
  ftShown = false;
}

function normalizeSeed(v) {
  if (v === undefined || v === null || String(v).trim() === '') return state.seed;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(1, Math.floor(Math.abs(n)));
  return hashSeed(String(v)); // allow word seeds
}

// --- DOM wiring ------------------------------------------------------------
const canvas = document.getElementById('pitch');
const renderer = new Renderer(canvas);
const hud = new Hud(document.getElementById('hud'));
const panel = new Panel(document.getElementById('panel'), { getWorld: () => world });
const analytics = new AnalyticsView(document.getElementById('analytics'), { getWorld: () => world });
const controls = new Controls(document.getElementById('controls'), {
  onPlayToggle: () => {
    state.paused = !state.paused;
    controls.setPlaying(!state.paused);
  },
  onStep: () => stepper.advance(0.5), // advance ~0.5s of in-game time while paused
  onTactics: () => panel.toggle(),
  onAnalytics: () => analytics.toggle(),
  onRestart: () => {
    buildMatch(controls.getSeed());
    if (panel.open) panel.refresh();
  },
  onSeed: (v) => {
    buildMatch(v);
    state.paused = false;
    controls.setPlaying(true);
    if (panel.open) panel.refresh();
  },
  onSpeed: (n) => {
    state.speed = n;
    controls.setSpeed(n);
  },
  onToggleNumbers: (b) => {
    renderer.options.numbers = b;
  },
  onToggleLang: () => setLang(state.lang === 'ar' ? 'en' : 'ar'),
});

function setLang(lang) {
  state.lang = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  renderer.options.lang = lang;
  controls.setLang(lang);
  hud.setLang(lang);
  panel.setLang(lang);
  analytics.setLang(lang);
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n, lang);
  });
}

buildMatch(state.seed);
setLang(state.lang);
controls.setPlaying(!state.paused);
window.addEventListener('resize', () => renderer.resize());

// --- Render loop (variable rate) ------------------------------------------
let last = performance.now();
let frameCount = 0;
function frame(now) {
  const realDt = Math.min((now - last) / 1000, 0.1); // clamp big gaps (tab switches)
  last = now;

  // keep the canvas crisp if layout changed (no explicit resize event needed)
  if (Math.abs(canvas.clientWidth - renderer.cssW) > 1 || Math.abs(canvas.clientHeight - renderer.cssH) > 1) {
    renderer.resize();
  }

  const inGameDt = state.paused ? 0 : realDt * TIME_SCALE * state.speed;
  const alpha = stepper.advance(inGameDt);
  renderer.render(world, state.paused ? 1 : alpha);
  hud.update(world);

  // auto-open the post-match analytics at full time
  if (world.phase === 'fulltime' && !ftShown) {
    ftShown = true;
    state.paused = true;
    controls.setPlaying(false);
    analytics.toggle(true);
  }
  // keep an open analytics overlay live (~3 Hz) while the match runs
  if (analytics.open && !state.paused && ++frameCount % 20 === 0) analytics.render();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
