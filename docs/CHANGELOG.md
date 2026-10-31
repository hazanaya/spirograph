# Changelog

_See also: root-level `CHANGELOG.md` for changes predating this tracking system._

## [2026-10-31] — Published as open source
- Released under MIT at https://github.com/hazanaya/spirograph, live at
  https://hazanaya.github.io/spirograph/ (GitHub Pages from `main` root).
- `docs/HANDOFF.md`: phase set to Published; publishing chunks 1–3 recorded as done,
  chunk 4 (Squarespace card) left to Haza; offline check noted.
- Root `CHANGELOG.md`: 3.1.1 entry (license, About credit, zero-size canvas guard, cache bump).

## [2026-06-06] — Doc Refresh: Plan ↔ Reality Sync
- Updated `docs/IMPROVEMENT-PLAN.md`: added a Progress Update mapping each plan
  item to done/open. Recorded that v3.0 shipped the foundation sprint (4.1 ES
  modules, 4.2 curve-type abstraction) and curve types 2.1 Guilloché, 2.2 Rose,
  2.3 Lissajous, plus 4.5 phone layout — the plan predated the modules split.
- Annotated the plan's Recommended Starting Sequence with completion status.
- Added Tech-health watch points to `docs/HANDOFF.md`: ~2,600-line `app.js`
  god-module, flat ~30-key `state`, no automated tests, empty STACK/ARCHITECTURE
  stubs.
- Docs only; no code changes.

## [2026-06-06] — Session Button-Up / v3 Merge + Stabilization
- Merged local branch `haza/thirsty-villani-31aa75` into `main`; no extra git worktrees remain registered for this repo.
- Completed the ES module stabilization pass: undo/settings snapshots, LFO restoration, color/loop UI sync, and consistent history pushes.
- Made Trail mode mutually exclusive with stamped layers; adding a layer switches to Wipe and disables Trail while layers are visible.
- Hardened sound persistence so audio does not auto-resume after reload without a user gesture.
- Added compact bottom-sheet panel behavior for controls, math, and LFO drawer.
- Bumped service worker cache to `spirograph-v4` and precached module files.
- Verified syntax, whitespace, conflict markers, browser console, rendered pixels, LFO drawer, and layer/trail behavior.

## [2026-04-02] — Retroactive Scaffolding
- Added README, CLAUDE.md, and docs/ structure
- Contributor: Claude Code
