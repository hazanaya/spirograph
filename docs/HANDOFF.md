# Handoff — Current Project State
> Last updated: 2026-04-21

## Current Status
**Phase:** v3.0 — ES modules, extended curve types, loop style selector

## Architecture
The app is now split into five ES modules loaded via `<script type="module">` in `index.html`:

| File | Responsibility |
|------|---------------|
| `js/spiro-math.js` | Pure math — SpiroMath, Camera, hexToRgba |
| `js/state.js` | Shared singleton state object |
| `js/curve-types.js` | CurveType abstraction + all 5 curve implementations |
| `js/renderer.js` | Canvas rendering — Renderer, PenTrail, Ripples, Annotations |
| `js/app.js` | Entry point — Animator, Sound, UI wiring, presets, settings |

## What's Done (this session)

**Phase 2 — ES module split**
- Extracted ~2670-line inline `<script>` into five ES modules
- `state.curveType` (a CurveType instance) replaces the old `state.mode` string
- Curve type `<select>` added to the Mode panel section

**Phase 3 — New curve types**
- Rose (rhodonea): `ρ = R·cos(k·t) + d`, 1–20 petals, 3D z-lift
- Lissajous: `x = R·sin(t+δ), y = r·sin(k·t)`, phase offset via d slider
- Guilloché: `ρ = R + r·cos(k·t)`, interlace arm via d slider
- MathPanel equations/properties updated for all five types
- 20 built-in presets; gallery filters to show only the active curve type
- 4 presets each for Rose, Lissajous, and Guilloché

**Loop style selector**
- Replaced separate Trail/Loop toggle buttons with a single `<select>`:
  - **Once** — draw once, idle animation plays when done
  - **Wipe** — after completing, forward-erases from start then redraws (original loop mode)
  - **Rewind** — after completing, erases backward from tip to origin then redraws (new)
  - **Trail** — infinite snake wrap; head draws, tail follows (default)
- Trail Length slider only shown when Trail is selected
- Old `trailMode`/`loopMode` localStorage keys migrated automatically

## Known Issues
- Browser preview (preview tool iframe) can't render canvas apps (window.innerWidth = 0); verify at `http://localhost:8765`

## What's Next
- Responsive phone layout — bottom sheets on small screens
- Animation export (GIF/MP4/WebM)
- Parameter linking (d follows r)
- Multi-touch drawing
