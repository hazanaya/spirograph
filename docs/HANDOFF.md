# Handoff — Current Project State
> Last updated: 2026-06-06

## Current Status
**Phase:** v3 modules merged into `main` with stabilization pass complete.

The local feature branch `haza/thirsty-villani-31aa75` has been merged into `main`. There are no additional git worktrees registered for this repo; the prior "worktree" cleanup was a local branch merge.

## Architecture
The app is a single-page PWA shell in `index.html` with native ES modules:

| File | Responsibility |
|------|---------------|
| `js/spiro-math.js` | Pure math, `SpiroMath`, `Camera`, `hexToRgba` |
| `js/state.js` | Shared singleton state object |
| `js/curve-types.js` | `CurveType` abstraction and all curve implementations |
| `js/renderer.js` | Canvas rendering, layers, trails, ripples, annotations |
| `js/app.js` | Animator, Sound, UI wiring, presets, settings, history, LFO |

## Completed This Session
- Merged v3.0 ES module architecture and new curve types into `main`.
- Kept `loopStyle` as the canonical draw-completion state: `once`, `wipe`, `rewind`, `trail`.
- Ported stabilization behavior onto the module architecture:
  - Shared state snapshots for undo/redo and persisted settings.
  - Old `trailMode`/`loopMode` settings migrate into `loopStyle`.
  - Sound active state is not auto-restored after reload because browsers require a user gesture.
  - LFO state participates in undo/settings, and the LFO drawer builds from settled app state.
  - Layer compositing and Trail mode are mutually exclusive; adding a layer switches to Wipe and disables Trail until layers are cleared.
  - Color mode, palettes, stroke style, background, loop style, and key sliders now push history consistently.
  - Mobile panels behave as bottom sheets, with controls/math/LFO closing each other on compact layouts.
- Bumped service worker cache to `spirograph-v4` and precached the ES module files.
- Resolved `.claude/launch.json` to the local project path.

## Verification
Run from repo root:

```sh
for f in js/*.js sw.js; do node --check "$f" || exit 1; done
git diff --check
rg -n '^<<<<<<<|^=======|^>>>>>>>' .
```

Browser smoke completed at `http://127.0.0.1:8787/`:
- Page title: `Spirograph`
- Console errors: none
- Screenshot pixel check: nonblank rendered viewport
- LFO drawer opens with 9 modulation rows
- Layer+ while Trail is selected switches loop style to Wipe, increments the layer badge, hides/disables Trail

## Known Issues / Watch Points
- Animation export remains unimplemented.
- Parameter linking (`d` follows `r`) remains unimplemented.
- Multi-touch drawing remains unimplemented.
- If validating PWA offline behavior, reload once after service worker activation before testing offline mode.

### Tech-health watch points (recorded 2026-06-06)
- **`js/app.js` is a ~2,600-line god-module.** The ES module split fixed the
  inline-script bloat but `app.js` now holds Animator, Sound, UI wiring, presets,
  settings, history, and the LFO engine together. `IMPROVEMENT-PLAN.md` 4.1
  envisioned a further split into `ui.js` / `effects.js` / `lfo.js`; not done.
- **`state` is a flat ~30-key object** (`js/state.js`). Plan 4.4 (group into
  `geometry` / `appearance` / `animation` / `view`) is untouched — this is what
  makes presets, URL-sharing, and undo fiddlier as features grow.
- **No automated tests.** Verification is manual: `node --check` on each module
  plus a browser smoke test (see Verification above).
- **`docs/STACK.md` and `docs/ARCHITECTURE.md` are empty stubs** — fill or remove.
- **`IMPROVEMENT-PLAN.md` was written against the pre-modules single-file app.**
  See its "Progress Update — 2026-06-06" section: the foundation sprint and the
  rose/lissajous/guilloche curve types already shipped in v3.0.

## Next Session Suggestions
- Start with `git status --short --branch`; it should be clean after this handoff commit.
- Use `python3 -m http.server 8787 --bind 127.0.0.1` or the `.claude/launch.json` port `8765`.
- Prefer extending the module structure instead of reintroducing inline app script.
