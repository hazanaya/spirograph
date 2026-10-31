# Changelog

All notable changes to this project will be documented in this file.

---

## [3.1.1] — 2026-10-31

Published as an open-source experiment at https://hazanaya.github.io/spirograph/.

### Added

- `LICENSE` (MIT) and a License section in the README.
- About panel: credit line "An experiment by Haza. Shared as is, no updates promised." with links to hazaelanaya.com and the source.

### Fixed

- Guarded both `drawImage(Renderer.glowCanvas, …)` calls against a zero-size canvas, which threw `InvalidStateError` on the first frame when the page loaded in a zero-size window.

### Changed

- Service worker cache bumped to `spirograph-v5`; `app.js` cache-buster to `?v=8`.
- `.claude/launch.json` serves `.` instead of an absolute path.

## [3.1.0] — 2026-06-06

### Changed

- Merged the v3 ES module branch into `main` and stabilized it as the current baseline.
- Bumped the service worker cache to `spirograph-v4` and precached ES module assets.
- Compact layouts now present controls, math, and modulation as bottom-sheet surfaces that close each other cleanly.

### Fixed

- Ported undo/redo, settings persistence, and LFO snapshot restore onto the module architecture.
- Prevented reloads from restoring active sound without a user gesture.
- Kept Trail mode and stamped layers mutually exclusive so layers stay visible and exportable.
- Synced color mode, loop style, palettes, stroke, background, and slider edits with history/UI state.

---

## [3.0.0] — 2026-04-21

### Added

**ES module architecture**
- Split ~2670-line inline `<script>` into five ES modules: `spiro-math.js`, `state.js`, `curve-types.js`, `renderer.js`, `app.js`
- `CurveType` abstraction: polymorphic `generatePoint`, `totalT`, `maxExtent`, `innerCenter` — new curves are drop-in modules
- Curve type selector added to Mode panel

**Three new curve types**
- **Rose (rhodonea)** — `ρ = R·cos(k·t) + d`; k controls petal count (1–20); 3D lift via h
- **Lissajous** — `x = R·sin(t+δ), y = r·sin(k·t)`; d slider controls phase offset (0–90°); 3D via h
- **Guilloché** — `ρ = R + r·cos(k·t)`; d controls interlace arm depth; always closes at 2π
- MathPanel equations and properties panel updated for all five curve types
- 4 built-in presets for each new curve type (20 total)
- Preset gallery filters to show only presets matching the active curve type

**Loop style selector**
- Replaced Trail + Loop toggle buttons with a single dropdown:
  - **Once** — draw once and stop; idle breathing animation plays
  - **Wipe** — after completing, erase from start while end stays, then redraw (original loop behavior)
  - **Rewind** — after completing, erase backward from tip to origin over ~3 s, then redraw
  - **Trail** — infinite snake wrap; head draws, tail follows with adjustable length (default)
- Trail Length slider shown only when Trail is selected
- `loopStyle` setting persisted; old `trailMode`/`loopMode` boolean keys migrated on first load

### Changed
- `state.mode` (string) replaced by `state.curveType` (CurveType instance) throughout
- `state.trailMode` + `state.loopMode` collapsed into `state.loopStyle` enum
- Trail length slider max extended to 100% (was 95%)

---

## [2.1.0] — 2026-03-29

### Added

**Trail mode (ghost-free)**
- Window-based trail rendering: clear canvas each frame, redraw only the visible portion
- Opaque canvas fill with `globalCompositeOperation: 'copy'` eliminates AA ghost artifacts
- Trail glow rendered via scratch buffer → blur → lighter composite onto opaque curve canvas
- Trail Length slider (5–95%) controls visible window size

**Loop mode**
- Draw/erase cycle: after curve completes, erasing head advances while drawn portion shrinks
- Once fully erased, drawing restarts from t=0 — infinite loop
- Trail and Loop can be combined or used independently

**Guide geometry improvements**
- Solid lines (no dashes) — prevents static-dot visual artifact on rolling circles
- 3D projected circles using point sampling (64/48 segments) through camera perspective
- Guide opacity slider 0–100% with 5x brighter range than before
- Guide rendering disabled during trail mode to prevent overlay ghost

**Settings persistence**
- All user preferences saved to localStorage every 2 seconds
- Restored on page load: 2D/3D, trail, loop, speed, stroke mode, colors, etc.
- Fresh defaults: 3D on, trail on, loop on, speed 0.1

**Speed slider redesign**
- Logarithmic scale: 0.01–10 range with 0.1 at center (50%)
- Default speed 0.1 for contemplative drawing
- Fine control at slow end, coarse at fast end

**Attract mode removed**
- Preset cycling replaced with direct randomized draw
- Canvas always matches panel state — no jumps

### Fixed

- **3D floating during drawing** — full curve redraw every frame enables smooth orbit while drawing
- **3D orbit reliability** — `Camera.dragging` flag tied to actual touch/mouse state
- **Ghost afterimage in trail mode** — opaque canvas + disabled depth alpha + hidden glow/layers
- **Guide circles in 3D** — projected through camera instead of flat 2D arcs

---

## [2.0.0] — 2026-03-29

### Added

**Unified animation loop (synth architecture)**
- One always-running RAF loop replaces 4 separate loops (Animator, IdleAnim, 3D orbit, ripples)
- Camera orbits during drawing in 3D — the curve draws while floating
- All parameter changes take effect immediately without stopping the animation
- Shape slider drag shows instant full-curve preview; release starts animated redraw

**Trail mode**
- "Trail" toggle in Drawing section — the curve wraps around endlessly, fading behind
- Trail Length slider (5–95%) controls how much of the curve stays visible
- Creates a luminous snake-chasing-its-tail effect

**Guide geometry opacity**
- "Guide" slider (0–100%) controls construction geometry visibility
- Smoothly fades the fixed ring, rolling wheel, and pen arm
- Works alongside the FX toggle

**Random start with slow default**
- Fresh visits randomize all parameters including 3D height/frequency
- Default speed reduced to 0.2 (slider range 0.05–10) for contemplative drawing

### Changed

- **Always-interactive canvas** — color, style, and speed changes during active animation
  flow naturally into the next frame instead of killing the animation
- **3D floating reliability** — replaced fragile `autoRotate` flag with `Camera.dragging`
  state tied to actual touch/mouse events; auto-orbit resumes reliably after any interaction
- **Attract mode preserves curve** — exiting attract mode keeps the displayed pattern
  instead of resetting to defaults; sliders sync to current state
- **IdleAnim is tick-based** — called per-frame by the unified loop instead of running
  its own RAF; no more competing animation loops

### Removed

- Standalone `start3DIdleRotation()` function (folded into unified loop)
- Separate ripple animation loops in touch handlers (unified loop handles ripples)
- Parameter space minimap (GCD-based loop counts produce inherently noisy heatmaps)

---

## [1.5.0] — 2026-03-29

### Added

**Color palette system**
- 7 curated palettes (Neon, Pastel, Mono, Warm, Cool, Ocean, Sunset) as tappable swatches
- Saturation (0–100%) and Lightness (10–90%) sliders for fine color control
- All curve rendering uses dynamic saturation/lightness instead of hardcoded values

**Brush/stroke variations**
- 4 stroke modes: Solid, Dotted, Dashed, Tapered
- Dotted renders filled circles at each point; Dashed uses scaled lineDash
- Tapered modulates line width by progress (thick→thin)

**Curve annotations**
- Toggle-able overlay showing symmetry axes (N dashed lines from center)
- Petal numbering at each tip (auto-detected via max-extent sampling)
- Period closure marker (diamond + t-value label where curve closes)
- Keyboard shortcut: A

**Parameter space minimap**
- Interactive R×r heatmap in the Parameters panel
- Each pixel colored by petal count (warm = few petals, cool = many)
- White crosshair shows current (R, r) position
- Click anywhere to jump to that parameter combination

**Random start**
- Fresh visits begin with randomized R, r, d, mode, hue, and sweep
- Filtered to skip high-loop-count patterns (>15 petals)

### Changed

- Default animation speed reduced from 3 to 1.5 for a more contemplative feel
- Color/style changes now take effect immediately during active animation
  (previously required waiting for curve completion)
- Attract mode exit preserves current curve instead of resetting to defaults

---

## [1.4.0] — 2026-03-29

### Added

**Direct number input**
- Click/tap any slider value to enter an exact number via inline input field
- Validates against slider min/max/step; commits on Enter or blur, cancels on Escape

**Background color picker**
- Color input in the Color section lets users set any background color
- All rendering (fade, glow, export) uses the custom background color dynamically

**Undo/redo**
- Full parameter + layer state history (up to 50 snapshots)
- Tracks slider changes, preset loads, shuffle, layer stamps, and clears
- Layer canvas content is captured and restored on undo
- Ctrl/Cmd+Z to undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z to redo

**High-res export**
- Standard save (click or Ctrl/Cmd+S) exports at screen resolution
- Long-press save button or Ctrl/Cmd+Shift+S exports at 4x resolution
- High-res re-renders the curve at full quality, not just upscaling pixels

**Keyboard shortcuts (desktop)**
- Space: play/pause
- R: shuffle
- E: toggle evolve
- L: add layer
- F: toggle FX
- M: toggle math panel
- Escape: toggle controls panel
- 1-9, 0: load presets
- Ctrl/Cmd+S: save PNG
- Ctrl/Cmd+Shift+S: save 4x PNG
- Ctrl/Cmd+Z: undo
- Ctrl/Cmd+Y: redo

---

## [1.3.0] — 2026-03-29

### Added

**Immersive first-launch experience**
- Panel auto-hides on fresh visit — full-screen canvas immersion from the start
- Attract mode cycles through 4 stunning presets (Pentaflower, Bloom, Cosmos, Nephroid)
  with crossfade transitions every 4 seconds until first user interaction
- Subtle pulse animation on ☰ button after 3 seconds hints at hidden controls
- First touch/click/keypress exits attract mode and opens the controls panel
- Shared URL links (`#R=...`) bypass attract mode and show controls immediately

**Expressive canvas gestures (2D mode)**
- Drag radially (toward/away from center) to morph pen distance `d`
- Drag tangentially (around the center) to morph rolling wheel `r`
- Both parameters respond simultaneously — the curve follows your finger's energy
- Release restarts the animated drawing from the new parameters

**Tap-to-shift hue**
- Tapping the canvas nudges the starting hue toward the tap angle (15% per tap)
- Works with completed curves in 2D mode — each tap recolors the composition
- Ripple color now matches the tap position's angular hue

---

## [1.2.0] — 2026-03-29

### Added

**Symmetry lock**
- Petals slider (2–30) constrains R/r to produce exact n-fold symmetry
- r slider auto-adjusts when R changes; disables manual r control while locked
- Petal count display always visible, shows current n-fold count

**PWA support**
- Service worker with network-first HTML / cache-first assets strategy
- Web app manifest with 192px and 512px icons
- `<link rel="manifest">`, `<link rel="apple-touch-icon">`, and `<meta name="theme-color">`

**Accessibility**
- ARIA labels on all sliders, action buttons, and panel toggles
- `aria-expanded` on panel toggle buttons, synced with open/close state
- `role="region"` with labels on controls and math panels
- Canvas container marked as `role="img"` with individual canvases `aria-hidden`

**DeviceMotion permission (iOS 13+)**
- Requests `DeviceMotionEvent.requestPermission()` on first touch interaction
- Shake-to-shuffle now works on real iOS devices (previously failed silently)

### Fixed

- **Evolve/IdleAnim conflict** — glow canvas opacity pulse in idle animation now
  checks `!state.isEvolving` to prevent fighting with Evolve mode
- **Input validation** — `SpiroMath` functions clamp r to prevent division by zero
  and NaN from edge-case parameter combinations
- **Line width live update** — changing line width while curve is complete now
  triggers a redraw (previously required restarting animation)

---

## [1.1.0] — 2026-03-28

### Added

**Synth-style live controls**
- Real-time parameter morphing — R/r/d/h/k sliders show instant full-curve preview
  while dragging; animated drawing restarts on release
- Solid / Gradient / Rainbow color mode toggle with live hue/sweep sliders
- Extended speed (0.5–10x) and line width (0.5–10 px) slider ranges

**SVG export**
- Vector curve output grouped by color bands with optimized path data

**Layer compositing improvements**
- Auto-rotate hue by golden angle (137.508°) between layer stamps for automatic
  color variety

**Onion skin mode**
- Ghost of previous curve stays visible while morphing parameters (◎ toggle button)

**Haptic feedback**
- Double-pulse vibration on curve completion via Vibration API

**Record and playback**
- Capture parameter snapshots every 150 ms during a morphing session
- Replay with live UI sync and visual recording indicator

**Custom presets**
- Save named presets to localStorage from the preset gallery
- Delete custom presets with one-tap × button

**URL sharing**
- All parameters encoded in the location hash (`#R=100&r=63&d=50&...`)
- Shared URLs auto-load state on open
- Share button copies URL to clipboard with "Copied!" feedback

### Fixed

- Mode-toggle selector bug — Hypo/Epi and 2D/3D buttons no longer interfere with
  each other

---

## [1.0.0] — 2026-03-28

### Added

**Core parametric engine**
- Hypotrochoid and epitrochoid rendering with configurable R (fixed ring), r (rolling
  wheel), and d (pen distance) parameters
- 3D mode: sinusoidal z-component `h·sin(k·t)` lifts the curve through space; h and k
  are independently controllable
- Automatic scale computation to fit the curve within 35% of the shortest screen dimension
- GCD-based loop-count calculation ensures the curve closes exactly before drawing stops

**Multi-layer canvas rendering**
- Four stacked canvases: background layer store, glow, active curve, and overlay
- Device-pixel-ratio–aware scaling for crisp Retina/ProMotion display output
- Blurred glow canvas composited with `lighter` blending for neon bloom effect
- `fadeCurve` semi-transparent fill for ghost-trail effect in Evolve mode

**Animated pen effects**
- Rolling 12-point pen trail with wobbling circles and opacity gradient
- Particle emitter: 2 particles per frame, radial velocity, life-based fade
- Bright glowing tip dot with `shadowBlur`

**Ripple system**
- Touch-tap ripples at arbitrary screen positions
- Completion burst: 5 staggered ripples from canvas centre on curve close
- Soft neon ring rendering with per-ripple hue

**3D camera**
- Perspective projection with configurable FOV and camera distance
- Yaw + pitch orbit with inertial friction
- Auto-rotate when idle; pauses on user interaction, resumes on release

**Sound synthesis**
- Web Audio API: sine oscillator → lowpass BiquadFilter → gain
- Oscillator frequency mapped to pen distance from origin (120–620 Hz)
- Filter cutoff mapped to current hue (400–1600 Hz)
- Smooth fade in/out via `setTargetAtTime`

**Idle animation**
- "Breathing" mode activates 2 seconds after curve completes
- Slow canvas rotation + continuous `hue-rotate` CSS filter cycle
- Pulsing glow opacity

**Auto-Evolve mode**
- Continuously lerps R, r, d toward random targets at 0.3%/frame
- New targets picked every 6–10 seconds
- Ghostly infinite trail via `fadeCurve(0.008)` each frame

**Shuffle**
- Slot-machine animation: 18 rapid parameter randomisations at 80 ms intervals
- Intelligent filter: skips patterns with > 15 loops
- Finalises with a white-flash transition

**Layer compositing**
- "Layer+" stamps the current curve onto the background canvas at reduced opacity
- Layer count badge on button; Clear resets layer count

**Math panel**
- Live colour-coded parametric equations with substituted values
- Pattern classification (hypotrochoid / epitrochoid, loop count, petal/cusp label)
- Mathematical properties: GCD, simplified R/r fraction, period, d/r ratio, n-fold symmetry
- 3D properties (h, k) shown when in 3D mode
- Drawing progress: current t, percentage complete, animated progress bar

**Preset gallery**
- 12 named presets: Rose, Astroid, Deltoid, Pentaflower, Starfish, Cardioid, Nephroid,
  Trefoil, Lace, Atom, Cosmos, Bloom
- Each preset rendered as a live thumbnail at startup

**Canvas interactions**
- Single-finger drag (2D): adjusts d continuously with soft-reset morphing
- Two-finger pinch: scale + pan
- Single-finger drag (3D): orbit camera
- Tap: spawn ripple
- Shake (DeviceMotionEvent, ≥ 25 m/s²): trigger Shuffle

**iPad / iOS polish**
- Full PWA meta tags for home-screen install
- `viewport-fit=cover` + `env(safe-area-inset-*)` for notch/home-bar avoidance
- `-webkit-backdrop-filter` on frosted-glass panels
- `-webkit-overflow-scrolling: touch` for smooth panel scrolling
- Touch targets ≥ 44 × 44 px throughout
- 26 px slider thumbs optimised for fingertip use
- SF Pro Display / SF Mono font stack

**Save**
- Composites all canvas layers to a full-resolution PNG and triggers browser download
  with a timestamped filename
