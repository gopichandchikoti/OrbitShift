# ADR-0001: Stack, UI layer, level pipeline and audio

Status: accepted, 2026-11-03. Applies to Orbit Shift 1.0.0.

## Context

Orbit Shift is a one-touch orbital gravity puzzle game with 120 levels, shipped as a browser game and an offline Android
APK from one repository. The brief asked for Phaser 3, TypeScript, Vite and Capacitor, a deterministic fixed-step
simulation, accessibility to WCAG 2.2 AA, and original art and sound with no hosted dependencies.

## Decisions

### 1. Phaser 3.90.0, pinned (not Phaser 4)

`npm view phaser` reports `4.x` as `latest`. The brief says Phaser 3, so `package.json` pins `3.90.0` exactly (the last
3.x). Moving to 4 is a separate, deliberate migration, not something to pick up by accident from a caret range.

### 2. Menus, HUD and dialogs are DOM; only the playfield is canvas

A canvas has no keyboard focus, no screen-reader tree and no text zoom. The rulebook requires all three, and axe-core can
only audit a DOM. So Phaser draws the playfield (planets, hazards, ship, particles) and the ambient menu backdrop, and a
small vanilla-TypeScript DOM layer (`src/ui`) sits exactly over the letterboxed canvas for everything the player reads or
presses. `UiLayer` makes content under a dialog `inert`, traps Tab, restores focus on close and owns a live region.

Consequence: two renderers must agree on geometry. `trackCanvas` keeps the UI layer pixel-aligned with the canvas, and an
end-to-end test asserts the two rectangles match on phone, tall-phone and desktop viewports.

Rejected: Phaser-native menus (not accessible), React (not needed; the brief says to avoid it without a reason).

### 3. A pure, deterministic simulation that Phaser never touches

`src/game/simulation` has no Phaser, DOM or wall-clock dependency. Time is an integer tick at 60 Hz; every moving thing
(moving planets, satellites, lasers, pulses) is a closed-form function of the tick. `FixedStepper` converts frame time to
whole steps (catch-up capped at 5). Consequences:

- The aiming preview is the *same* `stepSim` run forward, so it cannot disagree with the real flight. A test compares
  real positions with preview points to 9 decimal places, including with moving planets and an orbiting satellite.
- A level's solution can be recorded as a list of release ticks and replayed bit-for-bit.
- Rendering interpolates (`ship-view.ts`) and never feeds back into the simulation.

The gravity model is arcade, not n-body: each planet pulls with `g * (1 - d/R)^2`, which is zero at its influence radius
and bounded at its centre. Inversion fields negate planetary pull; active pulses push outward.

### 4. Levels are data, produced by a seeded generator and accepted only if a solver proves them

120 levels cannot be hand-balanced by a single pass here, and "authored" must not mean "unchecked". So:

1. `scripts/levels/generator` builds a candidate from a chapter recipe and a seed (planet chain, decoys, moving planets,
   hazards placed near a baseline route, shards and gates placed on the verified route).
2. `src/game/tools/solver` does a breadth-first search over *release ticks*. A launch only counts when a run of
   consecutive release ticks (the recipe's minimum window, 5-12 ticks) all end the same way, so no required move is a
   one-frame trick. The recorded route is the widest-window one found at the fewest launches.
3. A candidate is kept only if the route is long enough, hazards actually change the baseline route, every wormhole is
   used, the structural validator passes, the layout is not a near-copy of an accepted level (Jaccard < 0.55 on a
   coarse grid) and the route replays to three stars.
4. The result is written as typed TypeScript (`src/game/levels/data/chapter-NN.ts`, `Level[]`), so the compiler checks the
   shape. `npm run levels:check` (part of `npm run build`) re-runs schema, geometry, replay, distinctness, chapter themes
   and family coverage over all 120.

What this proves: every level has a replayable winning route with comfortable timing windows. What it does **not**
prove: that a level is fun, fair or readable to a person. `docs/LEVEL_QA.md` therefore keeps a separate, initially empty
"played by a person" column fed from `qa/manual-playthroughs.json`, which only a human edits.

### 5. Sound is synthesised, not shipped

Every effect and the background music are generated with the Web Audio API (`src/audio`). There are no audio files to
license, download or bundle, and the APK stays small. Trade-off: the sound design is only as good as the synthesis, and
it has not been heard on a phone speaker by me.

### 6. Saves: localStorage with a rolling backup

`SaveSlot` writes `{version, data}` and copies the previous good save to a `.backup` key first, validates on load, migrates
older versions and falls back to the backup and then to defaults. Capacitor Preferences was considered and rejected for
1.0: it would add async boot and a second code path for a persistence the WebView already provides, and the Android
checks confirm progress survives a process kill and an in-place update.

### 7. Android

Capacitor 8, one shared web bundle, `webDir: dist`, no `server.url`. The manifest declares no permissions; the Haptics
plugin contributes `VIBRATE`. Portrait is locked. The app id is `com.portfolio.orbitshift`; `versionName` and
`versionCode` are derived from `package.json` in `build.gradle` so the APK and web build cannot drift. The deliverable is
a **debug-signed** APK for sideloading; a release signing setup was not requested and is not configured.

## Consequences and open risks

- Float math in `Math.sin/cos` is engine-defined, so recorded solutions are verified on V8 (Node, Chrome, Android
  WebView). Safari/JavaScriptCore could differ in the last bits; the timing windows (at least 5 ticks) make that
  irrelevant to play, but the replay tests are only run on V8.
- The Phaser drawing code cannot run under Node, so it is excluded from unit coverage (with `src/main.ts` and the dev
  inspector) and is covered by the Playwright suite and screenshots instead. This is stated in `vite.config.ts`.
- Performance on a real phone is unmeasured (see the README).
