// ===========================================================================
// loop.js — fixed-timestep accumulator, decoupled from rendering and the DOM.
// Feed it in-game time; it runs whole FIXED_DT steps and returns the leftover
// fraction (alpha ∈ [0,1)) so the renderer can interpolate between ticks.
// ===========================================================================

import { FIXED_DT } from './constants.js';

export class FixedStepper {
  // stepFn(dt) advances the simulation exactly one fixed tick.
  constructor(stepFn) {
    this.stepFn = stepFn;
    this.acc = 0;
  }

  // Advance by `inGameDt` seconds. `maxSteps` guards against a "spiral of
  // death" if the tab was backgrounded or speed is very high.
  advance(inGameDt, maxSteps = 1200) {
    this.acc += inGameDt;
    let n = 0;
    while (this.acc >= FIXED_DT && n < maxSteps) {
      this.stepFn(FIXED_DT);
      this.acc -= FIXED_DT;
      n++;
    }
    if (n >= maxSteps) this.acc = 0; // drop the backlog rather than freeze
    return this.acc / FIXED_DT;       // render interpolation alpha
  }

  reset() {
    this.acc = 0;
  }
}
