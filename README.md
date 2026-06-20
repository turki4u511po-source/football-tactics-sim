# ⚽ Football Tactics Simulator — محاكي التكتيك الكروي

A browser-based, **2D top-down football tactics simulator**: a tactical sandbox
where you design tactics, watch an AI-driven match play out as moving dots on a
top-down pitch, adjust live, manage the squad, and read analytics (xG, xT,
heatmaps, shot maps).

**100% client-side** (no backend), built with **vanilla JS + HTML5 Canvas**, and
deployable as a **static site to GitHub Pages**. UI is **Arabic-first (RTL)** with
bilingual English tactical terms.

> Built **phase by phase** per the build spec. **Current status: Phase 6 complete.**
>
> **Phase 2 — Football basics:** on-ball decisions (pass / dribble / shoot / clear),
> zonal marking, interceptions & tackles, shots with keeper saves, **goals**, proper
> restarts (kickoff / throw-in / corner / goal kick), and full match flow — two 45'
> halves + stoppage time, half-time end-swap, full time — playing 90 in-game minutes
> in ~5 real minutes and ending with a believable scoreline.
>
> **Phase 3 — Tactical system + Principles Engine:** every team instruction
> (mentality · playstyle · pressing · defensive line · width · tempo · build-up ·
> attacking focus) maps to numeric tuning that visibly changes the dots, plus
> **shape morphing** (different in-/out-of-possession positions), pressing triggers
> by line height, marking, **through-balls & penetrating runs**, and counter-attack
> transitions. `npm test` proves each setting moves play the expected way.
>
> **Phase 4 — Live control & management:** a slide-in **tactics panel** (Arabic RTL,
> bilingual) to change any instruction or the formation mid-match (effect within a
> couple of sim seconds), **substitutions** with a **stamina** model (fitness drains
> and lowers pace late; subs come on fresh), **man-marking** assignments, plus
> pause / 1× / 2× / 4× and **step-through**.
>
> **Phase 5 — Analytics:** live stat bar + a full **analytics / post-match screen**:
> possession, shots, **xG** (transparent model), **xT**, passes & accuracy, tackles,
> interceptions, corners, fouls, **PPDA**, a **shot map** (size = xG), team
> **heatmaps**, **pass network**, a **momentum** (cumulative-xG) graph, plain-language
> **insights** (Arabic/English), and **JSON / PNG export**. Auto-opens at full time.
>
> **Phase 6 — Real clubs + adaptive AI:** **17 clubs** (2025-26 identities) selectable
> as your team and the opponent — each a tactics preset + overall rating + signature
> (Barça's very-high line, Atlético's deep block, City's inverted full-back, …), with
> back-three formations added. An **adaptive AI** runs the opponent: it re-evaluates
> every ~10 min / after goals / at half-time and makes one change (chase when behind,
> park the bus when ahead late, drop & counter when dominated, drop a beaten high
> line; Hard also doubles up your strong flank). Difficulty Easy/Normal/Hard;
> adaptiveness can be turned off for a static sparring partner.
>
> *Balance note:* default and moderate match-ups produce believable scores (~2–6 goals);
> extreme **all-out-attacking-vs-deep-block** AI match-ups currently over-score — a known
> limitation of the chance model under sustained pressure (the club identities and the AI
> adaptation themselves are correct and visible).

---

## ▶ Run it

It's a static site — no build step, no dependencies.

```bash
# from the repo root, serve over HTTP (ES modules require http://, not file://)
npm run serve         # → http://localhost:8080
# or:  python3 -m http.server 8080
```

Then open the printed URL. Click **Play** (تشغيل). Try changing the **seed**
(البذرة) and pressing **Kickoff** (ضربة البداية) — the same seed reproduces the
same match exactly.

### Headless test (no browser needed)

```bash
npm test    # proves the engine is deterministic AND decoupled from rendering
```

---

## Phase 1 — what's in this build

- **Top-down pitch** on Canvas with full markings (boxes, arcs, spots, center
  circle, goals), drawn entirely with shapes — no image assets.
- **22 numbered dots** (Blue vs Red) in a 4-3-3 + a ball.
- **Kickoff**, then players that **react to the ball**: the team holds its shape
  but shifts as a block toward the ball, the nearest player presses/chases, the
  carrier dribbles and passes, and the keeper tracks its line.
- **Controls:** Play/Pause, speed 1× / 2× / 4×, Kickoff (restart), seed input,
  number toggle, and an **Arabic ↔ English** language switch (RTL/LTR).
- **HUD:** team names, score, in-game clock, phase.

> Not yet (later phases): real shots/goals, throw-ins/corners, the full tactical
> system, analytics (xG/xT/heatmaps), the 17 real clubs, and the adaptive AI.
> See the build spec for the roadmap (Phases 2–8).

---

## Architecture (the foundations that later phases build on)

```
index.html · styles.css
/src
  main.js            composition root: the only place engine ↔ render ↔ UI meet
  /engine            pure logic, ZERO DOM/Canvas refs (runs headless in Node)
    constants.js     pitch geometry, timing, tuning
    rng.js           seeded PRNG (mulberry32) — determinism
    vec.js           2D vector + scalar helpers
    entities.js      Player, Ball (state only)
    formations.js    normalized formation templates
    world.js         match state: teams, ball, clock, score, phase
    simulation.js    the per-tick update (movement, possession, kickoff)
    loop.js          fixed-timestep accumulator (+ interpolation alpha)
  /render            reads world state only; never mutates the sim
    pitch.js         pitch markings
    renderer.js      interpolated players/ball + visual cues
  /ui                Arabic-RTL shell
    i18n.js          bilingual labels
    hud.js           score / clock / phase
    controls.js      control bar
/test
  determinism.test.js
```

**Three principles are enforced from day one:**

1. **Engine decoupled from rendering.** `/engine` imports nothing from the DOM or
   Canvas. The render loop only *reads* state. (The headless `npm test` runs the
   entire engine in Node with no browser — that's the proof.)
2. **Fixed-timestep logic, interpolated rendering.** Logic ticks at a fixed 30 Hz
   of in-game time; rendering runs on `requestAnimationFrame` and interpolates
   between ticks, so motion is smooth at any framerate or playback speed. One
   match = **90 in-game minutes compressed into ~5 real minutes** (18× at 1×).
3. **Determinism.** Every random decision flows through a seeded PRNG. Same seed
   ⇒ identical match — the basis for replays and "what-if" A/B testing later.

**State is kept in memory only** (no `localStorage`/`sessionStorage`), so it runs
fine inside sandboxed viewers as well as on GitHub Pages.

---

## Deploy to GitHub Pages

The repo root *is* the site. In **Settings → Pages**, set the source to this
branch (root). A `.nojekyll` file is included so paths are served as-is. No build
step required.
