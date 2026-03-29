# Changelog

All notable changes to this project will be documented in this file.

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
