# Spirograph — Design Document

## Project Purpose

An interactive parametric curve toy that lets users explore hypotrochoids and epitrochoids
(the mathematical curves a classic Spirograph toy draws) in real time. The emphasis is on
immediate visual feedback, tactile interaction, and mathematical insight. A live Math panel
surfaces the underlying equations and properties as parameters change.

---

## Target Platform

**iPad-first**, with full desktop mouse support as a secondary target.

Specific iPad/iOS considerations baked in throughout:

| Feature | Implementation |
|---|---|
| PWA home-screen install | `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title` meta tags |
| Viewport | `maximum-scale=1.0, user-scalable=no, viewport-fit=cover` |
| Safe areas (notch / home bar) | `env(safe-area-inset-*)` on panel padding |
| Tap highlight suppression | `-webkit-tap-highlight-color: transparent` |
| Text-selection suppression | `-webkit-user-select: none` |
| Backdrop blur | `-webkit-backdrop-filter` (alongside standard `backdrop-filter`) |
| Momentum scrolling | `-webkit-overflow-scrolling: touch` on panels |
| Touch interactions | `touchstart / touchmove / touchend` with `preventDefault()` |
| Touch target size | All interactive buttons ≥ 44 × 44 px |
| Slider thumbs | 26 px diameter — fat enough for fingertip use |
| Shake to shuffle | `DeviceMotionEvent` / `accelerationIncludingGravity` |
| Font stack | `-apple-system, BlinkMacSystemFont, 'SF Pro Display'` / `'SF Mono'` |

---

## Architecture

The entire app lives in a single `index.html` file — no build step, no dependencies, no server
required. The JavaScript is organised into named singleton objects, each with a clear
responsibility.

### Canvas layers

Four stacked `<canvas>` elements fill the viewport:

| ID | z-index | Purpose |
|---|---|---|
| `layers-canvas` | 0 | Stamped ("frozen") completed curves — supports multi-layer compositing |
| `glow-canvas` | 1 | Persistent blurred glow — composited with `globalCompositeOperation: lighter` |
| `curve-canvas` | 2 | The curve currently being drawn |
| `overlay-canvas` | 3 | Construction geometry, pen trail, particles, and ripples — cleared every frame |

All canvases are scaled by `window.devicePixelRatio` for crisp rendering on Retina/ProMotion
displays.

### JS modules

#### `SpiroMath`
Pure math helpers. No DOM or canvas access.

- `gcd(a, b)` — Euclidean GCD
- `loopCount(R, r)` — number of petals/loops = `r / gcd(R, r)`
- `totalT(R, r)` — full parameter range to close the curve = `2π × loopCount`
- `hypoPoint(R, r, d, t)` — 2D hypotrochoid point
- `epiPoint(R, r, d, t)` — 2D epitrochoid point
- `hypoPoint3D` / `epiPoint3D` — adds sinusoidal z: `h·sin(k·t)`
- `point(mode, …)` — dispatcher combining all of the above
- `innerCenter` — rolling wheel centre (used for construction overlay)
- `maxExtent` — maximum radius of the curve (used for auto-scaling)
- `simplifyFraction` — reduces `R/r` to lowest terms for display

#### `Camera`
Perspective projection and interactive orbit for 3D mode.

- Stores `yaw`, `pitch`, `camDist`, `fov`
- `rotatePoint(p)` — applies yaw (Y-axis) then pitch (X-axis) rotation
- `project(p, …)` — rotates then applies `fov / (z + camDist)` perspective
- `update()` — applies inertial velocity with friction; auto-rotates slowly when idle
- Auto-rotate pauses while the user drags and resumes on `touchend` / `mouseup`

#### `Renderer`
Manages all four canvases and drawing primitives. DPR-aware throughout.

- `init()` — grabs canvas elements, runs `resize()`
- `resize()` — sets canvas resolution, resets `scale`, recalculates center
- `computeScale()` — fits the current curve inside 35% of the shortest screen dimension
- `toScreen(p)` — converts math-space point to canvas pixels (2D or 3D via `Camera`)
- `drawSegment(from, to, color)` — single coloured stroke; in 3D, depth-modulates alpha
  and line width
- `updateGlow()` — runs every third frame; blurs `curve-canvas` onto `glow-canvas` using
  `lighter` compositing
- `drawConstruction(R, r, d, t, mode)` — draws the animated fixed ring, rolling wheel,
  and pen arm as dim dashed/solid guides
- `stampLayer()` — composites the current curve + glow onto `layers-canvas` at reduced
  opacity for non-destructive layering
- `fadeCurve(alpha)` — semi-transparent fill over `curve-canvas` for ghost-trail effects

#### `PenTrail`
Visual decoration around the active pen tip.

- Maintains a rolling buffer of the last 12 screen positions
- Each buffered point is drawn as a wobbling circle whose radius and opacity grow with age
- Spawns 2 short-lived particles per frame; particles drift outward, shrink, and fade
- The newest tip point renders as a bright glowing dot with `shadowBlur`

#### `Ripples`
Expanding ring animation triggered by touch taps, curve completion, or idle wakeup.

- Each ripple has `radius`, `opacity`, `hue`, `maxRadius`
- `update(ctx)` — expands radius by 2.5 px/frame, multiplies opacity by 0.97
- `burst(x, y, hue, count)` — fires multiple staggered ripples with offset hues
- Drawn with `shadowBlur` for a soft neon look

#### `Sound`
Real-time audio synthesis via the Web Audio API.

- Single sine-wave oscillator → lowpass BiquadFilter → gain node → destination
- Oscillator frequency (120 – 620 Hz) maps to the pen's distance from the origin
- Filter cutoff (400 – 1600 Hz) maps to the current hue angle
- Fades in/out smoothly using `setTargetAtTime` to avoid clicks
- Lazily initialised on first user interaction (required by browser autoplay policy)

#### `IdleAnim`
"Breathing" animation displayed when drawing is complete and the user is inactive.

- Slowly rotates the entire `canvas-container` div (`rotate(angle)`)
- Cycles `hue-rotate` CSS filter continuously
- Pulses `glowCanvas` opacity sinusoidally
- Stopped immediately on any user interaction

#### `Evolve`
Autonomous parameter morphing for hypnotic continuous-drawing mode.

- Picks random `{R, r, d}` targets and lerps current values toward them at 0.3%/frame
- Picks new targets every 6–10 seconds
- Wraps `currentT` continuously so the curve never stops
- Calls `Renderer.fadeCurve(0.008)` each frame for a long ghostly trail effect

#### `Animator`
The main animation loop and playback state machine.

- `start()` — begins `requestAnimationFrame` loop; computes `totalT`; stops idle
- `pause()` — cancels RAF; fades sound out
- `reset()` — full clear of all canvases; resets `currentT`; clears PenTrail
- `softReset()` — fades instead of clearing; used when a slider changes mid-draw so the
  new curve morphs in smoothly
- `loop()` — advances `currentT` by `speed × 0.015` per step, 8 steps per RAF; draws
  segments; calls Evolve, Camera, PenTrail, Ripples, Glow, MathPanel each frame
- `onComplete()` — fires completion bloom (glow pulse + `Ripples.burst`), then starts
  `IdleAnim` after a 2-second delay
- `drawInstant()` — synchronous full redraw without animation; used after resize, pinch
  zoom, 3D orbit drag, and shuffle landing

#### `MathPanel`
The collapsible right-side panel showing live mathematics.

- **Classification** — names the curve type and petal/loop count
- **Equations** — colour-coded parametric equations with live `R`, `r`, `d` values
  substituted in; adds z(t) line in 3D mode
- **Properties** — GCD, loop count, simplified R/r fraction, period, d/r ratio,
  n-fold symmetry; adds h and k rows in 3D mode
- **Drawing Progress** — current `t` value, percentage complete, animated progress bar

#### `PRESETS` + gallery functions
Twelve named curves: Rose, Astroid, Deltoid, Pentaflower, Starfish, Cardioid, Nephroid,
Trefoil, Lace, Atom, Cosmos, Bloom.

Each preset thumbnail is rendered synchronously onto a small off-screen `<canvas>` at
startup and displayed in a 3-column grid. Tapping a preset loads its parameters and
restarts animation.

#### `doShuffle`
Randomises parameters with a slot-machine effect: runs 18 rapid `drawInstant()` cycles
at 80 ms intervals, then commits with a brief white flash and restarts animation.
Intelligently skips patterns with more than 15 loops (avoids visually noisy dense fills).

---

## UI / Controls

### Left panel — Parameters & Actions

| Control | Effect |
|---|---|
| **R** slider (20–200) | Fixed ring radius |
| **r** slider (3–195) | Rolling wheel radius |
| **d** slider (1–195) | Pen distance from wheel centre |
| **h** slider (0–120) | 3D sinusoidal height (3D mode only) |
| **k** slider (1–20) | Z frequency multiplier (3D mode only) |
| Hypotrochoid / Epitrochoid | Curve type (wheel inside vs. outside ring) |
| 2D / 3D | Dimension toggle; 3D exposes h/k sliders |
| **Speed** (1–10) | Steps per frame multiplier |
| **Line Width** (0.5–5) | Stroke width in pixels |
| **Hue Start** (0–360°) | Starting colour angle |
| **Hue Sweep** (0–720°) | Colour range across one full revolution |
| **Play / Pause** | Toggle animation |
| **Clear** | Reset canvas and layer count |
| **FX** | Toggle construction overlay, glow, particles |
| **Save** | Composites all layers to PNG and triggers download |
| **Sound** | Toggle Web Audio synthesis |
| **Layer+** | Stamp current curve to background, start fresh |
| **Shuffle** | Slot-machine randomise |
| **Evolve** | Autonomous morphing mode |
| Preset gallery | 12 named thumbnails |

### Right panel — Math (ƒ button)

Live equations, pattern classification, mathematical properties, and a drawing progress
bar. Starts collapsed.

### Canvas gestures

| Gesture | Effect |
|---|---|
| Single tap (2D) | Spawn a ripple at tap position |
| Single finger drag (2D) | Adjusts `d` based on distance from centre |
| Two-finger pinch | Scale + pan the drawing |
| Single finger drag (3D) | Orbit the camera (yaw + pitch) |
| Shake device | Triggers Shuffle (≥ 25 m/s² acceleration, 2 s cooldown) |
| Mouse click | Ripple (desktop) |
| Mouse drag (3D) | Orbit camera |

---

## How to Run

No build step required.

```
open index.html
```

Or serve over HTTP for full DeviceMotionEvent support on iOS (requires HTTPS or localhost):

```
python3 -m http.server 8080
# then open http://localhost:8080 in Safari on iPad
```

For shake-to-shuffle on a real device, serve over HTTPS (iOS 13+ requires a permission
request for DeviceMotionEvent on some browsers, but Safari on localhost skips this).

---

## Known Quirks

- **DeviceMotion on iOS 13+**: Some browsers require `DeviceMotionEvent.requestPermission()`
  before the shake listener fires. The current implementation registers the listener
  unconditionally; shake-to-shuffle may silently do nothing without an explicit permission
  prompt. Workaround: use the Shuffle button.

- **Safari `backdrop-filter` + `overflow: hidden`**: The panel blur can occasionally
  render incorrectly on older iOS versions when combined with scrolling. Works correctly
  on iPadOS 16+.

- **Glow canvas opacity during idle**: `IdleAnim` directly sets `Renderer.glowCanvas.style.opacity`,
  which may conflict if `Evolve` mode is active simultaneously. The two modes are mutually
  exclusive in practice (Evolve calls `IdleAnim.stop()`), but there is no explicit guard.

- **AudioContext autoplay**: `Sound.init()` creates the AudioContext lazily on first toggle.
  If the page is loaded in a tab that the user has never interacted with, the context may
  start in `suspended` state; the code handles this with `ctx.resume()`.

- **Instant draw performance**: `drawInstant()` runs a tight synchronous loop and can
  briefly block the main thread on very high loop counts (r/gcd > 30) or large canvases.
  In practice this is imperceptible on iPad Pro hardware.
