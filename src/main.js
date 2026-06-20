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
import { Setup } from './ui/setup.js';
import { LabView } from './ui/labView.js';
import { SeasonView } from './ui/seasonView.js';
import { Season } from './modes/season.js';
import { CLUBS } from './tactics/clubs.js';
import { SCENARIOS } from './modes/scenarios.js';
import { t } from './ui/i18n.js';

const state = {
  lang: 'ar', speed: 1, paused: false, seed: 42,
  setup: { homeClubId: null, awayClubId: 'atletico', difficulty: 'normal', adaptive: true, scenario: 'none' },
  season: null,
  seasonMatch: null,
};

let world;
let rng;
let stepper;
let ftShown = false; // analytics auto-opened at full time?

// (Re)build a fresh, deterministic match from a seed.
function buildMatch(seedInput) {
  state.seed = normalizeSeed(seedInput);
  rng = makeRng(state.seed);
  const s = state.setup;
  const sc = SCENARIOS[s.scenario];
  const scSetup = (sc && sc.setup) || {};
  const awayId = scSetup.awayClubId || s.awayClubId; // scenario can force the opponent
  world = new World({
    seed: state.seed,
    homeClub: s.homeClubId ? CLUBS[s.homeClubId] : undefined,
    awayClub: awayId ? CLUBS[awayId] : undefined,
    difficulty: s.difficulty,
    adaptive: s.adaptive,
  });
  // apply scenario state (start clock / score / red card)
  if (scSetup.score) world.score = { ...scSetup.score };
  if (scSetup.startClock) {
    world.half = 2;
    world.clock = scSetup.startClock;
    world.injury = 150;
    world.tick = 1; // skip the tick-0 first-half stoppage roll
  }
  if (scSetup.redCard) world.sendOff(scSetup.redCard);
  if (s.scenario && s.scenario !== 'none') world.scenario = { id: s.scenario };
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
const lab = new LabView(document.getElementById('lab'), {
  getSetup: () => state.setup,
  getSeed: () => state.seed,
});
const seasonView = new SeasonView(document.getElementById('season'), {
  getSeason: () => state.season,
  onStart: (clubId) => {
    state.season = new Season({ userClubId: clubId, seed: state.seed, difficulty: state.setup.difficulty });
  },
  onPlay: () => startSeasonMatch(),
  onSim: () => state.season && !state.season.isOver() && state.season.simulateMatchday(),
  onAuto: () => state.season && state.season.simulateToEnd(),
  onNew: () => {
    state.season = null;
  },
});

// Launch the user's next league fixture as a live match (carrying form/fatigue).
function startSeasonMatch() {
  const s = state.season;
  if (!s || s.isOver()) return;
  const fx = s.userFixture();
  const seed = s.matchSeed(s.currentRound().indexOf(fx));
  state.seed = seed;
  rng = makeRng(seed);
  world = new World({ seed, ...s.matchOpts(fx.home, fx.away) });
  stepper = new FixedStepper((dt) => step(world, rng, dt));
  state.seasonMatch = fx;
  ftShown = false;
  state.paused = false;
  controls.setPlaying(true);
  seasonView.toggle(false);
}
const setup = new Setup(document.getElementById('setup'), {
  onApply: (vals) => {
    state.setup = vals;
    buildMatch(state.seed);
    state.paused = false;
    controls.setPlaying(true);
    if (panel.open) panel.refresh();
  },
});
const controls = new Controls(document.getElementById('controls'), {
  onPlayToggle: () => {
    state.paused = !state.paused;
    controls.setPlaying(!state.paused);
  },
  onStep: () => stepper.advance(0.5), // advance ~0.5s of in-game time while paused
  onTactics: () => panel.toggle(),
  onAnalytics: () => analytics.toggle(),
  onLab: () => lab.toggle(),
  onSeason: () => seasonView.toggle(),
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
  onToggleShape: (b) => {
    renderer.options.shape = b;
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
  setup.setLang(lang);
  lab.setLang(lang);
  seasonView.setLang(lang);
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

  // full time: record a league result (season) or open the post-match analytics
  if (world.phase === 'fulltime' && !ftShown) {
    ftShown = true;
    state.paused = true;
    controls.setPlaying(false);
    if (state.seasonMatch && state.season) {
      const fx = state.seasonMatch;
      state.seasonMatch = null;
      state.season.completeUserMatch(fx.home, fx.away, world.score.home, world.score.away);
      seasonView.toggle(true);
    } else {
      analytics.toggle(true);
    }
  }
  // keep an open analytics overlay live (~3 Hz) while the match runs
  if (analytics.open && !state.paused && ++frameCount % 20 === 0) analytics.render();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
