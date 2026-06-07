# Decision Log
_(Project predates the tracking system. See Design.md for historical context.)_

## 2026-06-06 — ES Modules Are The Baseline
Merged `haza/thirsty-villani-31aa75` into `main` and kept the ES module architecture as the project baseline. Future work should extend `js/app.js`, `js/renderer.js`, `js/state.js`, `js/spiro-math.js`, and `js/curve-types.js` instead of reintroducing a large inline script in `index.html`.

## 2026-06-06 — `loopStyle` Replaces Trail/Loop Booleans
The canonical draw-completion state is now `state.loopStyle` with `once`, `wipe`, `rewind`, and `trail`. Old persisted `trailMode`/`loopMode` booleans are migration-only compatibility keys.

## 2026-06-06 — Layers And Trail Are Mutually Exclusive
Layer compositing uses `layersCanvas`; Trail mode hides layer/glow surfaces while redrawing a moving window. To avoid invisible layers and confusing exports, adding a layer switches Trail to Wipe and disables the Trail option until layers are cleared.

## 2026-06-06 — Audio State Is Gesture-Only
Settings persistence intentionally excludes active `soundOn` state. Browsers require a user gesture to start or resume audio, so reloads restore the visual/session settings but leave sound off until the user toggles it.

## 2026-06-06 — Service Worker Tracks Module Assets
The service worker cache was bumped to `spirograph-v4` and now precaches the ES module files. Future module path or query-string changes should bump the cache name and script version together.
