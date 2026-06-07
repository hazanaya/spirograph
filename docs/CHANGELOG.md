# Changelog

_See also: root-level `CHANGELOG.md` for changes predating this tracking system._

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
