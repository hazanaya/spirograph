# Changelog

All notable changes to this project will be documented in this file.

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
