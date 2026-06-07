# Spirograph App — Assessment & Improvement Plan

> Prepared: 2026-04-21
> Status: Partially executed — see Progress Update below
> Last reviewed: 2026-06-06

---

## Progress Update — 2026-06-06

This plan was written against the **single-file (~3,450 line)** version. Since
then, **v3.0** shipped and executed the foundation sprint plus part of Phase 2.
Treat the sections below as historical context; the items here are the source of
truth for what is and isn't done.

**Done since this plan was written:**
- **4.1 ES module split** ✅ — `index.html` is now a shell loading one
  `<script type="module">`; logic lives in `js/spiro-math.js`, `js/state.js`,
  `js/curve-types.js`, `js/renderer.js`, `js/app.js`.
- **4.2 Curve-type abstraction** ✅ — a `CurveType` interface with a
  `CURVE_TYPES` registry (`js/curve-types.js`).
- **2.1 Guilloché mode** ✅ — `GuillocheCurve` ships as a registered curve type
  (the plan's "centerpiece," delivered as a drop-in type rather than the larger
  envelope/fill engine in 2.4).
- **2.2 Rose curve** ✅ and **2.3 Lissajous** ✅ — both registered curve types.
- **4.5 Phone-responsive layout** ✅ — controls/math/LFO panels behave as
  bottom sheets on compact screens.
- Loop-style selector (`once`/`wipe`/`rewind`/`trail`) replaced the old
  trail/loop booleans — see `DECISIONS.md`.

**Still open from this plan (not started):**
- **1.1 Variable-width strokes** — the tapered mode modulates width by *progress
  %*, not by curvature/speed as specified here.
- **1.2 Sub-pixel rendering**, **1.3 Parallel offset curves**, **1.4 Paper
  textures**, **1.5 Print-quality export**.
- **2.4 Curve composition engine** and **2.5 Crosshatch fills** — the true
  compound-pattern capstone is still unbuilt; current Guilloché is a single
  curve type, not envelope+fill composition.
- **3.x Discovery/UX** (gallery, "more like this," semantic controls, layer
  management, visual undo timeline, tutorials) — none started.
- **4.3 Rendering-pipeline refactor** and **4.4 State grouping** — `state` is
  still a flat ~30-key bag; `js/app.js` is a ~2,600-line god-module (Animator,
  Sound, UI, presets, settings, history, LFO). See `HANDOFF.md` watch points.
- **5.x Polish** (animation export, sound V2, community sharing, print
  templates, full light theme) — none started.

The "Priority Matrix" and "Recommended Starting Sequence" below are kept for
reference but are partly superseded; completed rows are noted inline.

---

## Part 1: Current State Assessment

### What the App Is

A single-file (~3,450 lines) HTML/CSS/JS Progressive Web App that renders parametric trochoid curves in real-time. It's iPad-first, touch-friendly, zero-dependency, and installable as a PWA. The design philosophy prioritizes immediacy — sliders give instant visual feedback, and there's always something beautiful on screen.

### Mathematical Foundation

The app generates two curve families:

- **Hypotrochoids** — a point on a circle rolling *inside* a fixed circle: `x(t) = (R-r)cos(t) + d·cos((R-r)/r · t)`
- **Epitrochoids** — a point on a circle rolling *outside* a fixed circle: `x(t) = (R+r)cos(t) - d·cos((R+r)/r · t)`

A 3D mode adds a sinusoidal z-component: `z(t) = h·sin(k·t)`, projected with perspective. The math module computes GCD for curve closure, loop counts, symmetry order, and simplified ratios.

### What It Does Well

**Rendering & Visual Polish.** Four stacked canvases handle layers, glow, the active curve, and overlays independently. The neon glow effect (blurred `lighter` composite) gives curves a luminous quality. Trail mode uses window-based rendering with `globalCompositeOperation: 'copy'` to eliminate anti-aliasing ghosts — a hard technical problem solved cleanly. Depth-modulated alpha and line width in 3D create convincing atmospheric perspective.

**Interaction Design.** The canvas-drag mapping is clever: radial movement controls `d` (pen distance), tangential controls `r` (wheel size). This gives users an intuitive "sculpting" feel without understanding the math. Pinch-zoom, shake-to-shuffle, tap-to-shift-hue, and the idle breathing animation all contribute to a toy-like playfulness. The LFO engine (9 modulatable parameters with rate/depth/waveform) turns the app into something closer to a visual synthesizer.

**Feature Depth.** Layering with golden-angle hue rotation, SVG export, undo/redo with canvas state, URL sharing, 12 curated presets with live thumbnails, symmetry lock, record/playback, annotations (symmetry axes, petal labeling), 7 color palettes, 4 stroke modes, evolve mode for autonomous morphing.

**Code Quality.** Modular singleton objects (SpiroMath, Renderer, Camera, Animator, LFOEngine, etc.) with clean separation. One unified RAF loop handles everything — no competing timers. Settings auto-persist every 2 seconds. Service worker with network-first HTML, cache-first assets.

### Current Limitations

**Pattern variety is narrow.** Despite the rich controls, every pattern the app generates is fundamentally a single trochoid curve (or a stack of them via layering). You can't combine two curves, fill regions between curves, or create compound patterns. The visual vocabulary — while beautiful — consists entirely of closed looping curves with uniform line weight.

**Line rendering is basic.** All curves are drawn as connected `lineTo` segments with round caps. There's no support for variable-width strokes that respond to curvature or speed, no hatching or cross-hatching fills, no ability to draw multiple parallel offset curves, and no fine-line work (sub-pixel rendering or line density control). The tapered stroke mode modulates width by progress percentage, not by geometric properties of the curve.

**Color is per-curve, not per-region.** The gradient/rainbow modes sweep hue along the parameter `t`, which creates nice progressions but can't do region-based coloring, moiré effects from overlapping semi-transparent curves, or the kind of tonal fills you see in engraved artwork.

**No compound pattern composition.** There's no way to use one curve as an envelope or boundary for another, to create concentric bands of different patterns, or to generate fills between two boundary curves. Every drawing is either one curve or manually layered independent curves.

**Export is limited.** PNG and SVG only. No animation export (GIF/MP4/WebM). The SVG export groups by hue bands, which is efficient, but there's no option for high-fidelity vector output with individual paths per curve segment.

**Phone layout is missing.** The side-panel UI assumes a tablet or desktop width. On phones the controls panel takes up too much screen space, and there's no bottom-sheet or compact mode.

---

## Part 2: UX & Visual Experience Review

### What Creates Delight

The first-launch experience is well designed: a randomized curve auto-plays with controls hidden, giving a "living screensaver" feel. The hint pulse on the hamburger menu teaches discoverability without a tutorial. Completion ripples and haptic feedback create satisfying micro-interactions. The evolve mode turns the app into ambient art.

The mathematical transparency (the live equations panel with color-coded parameters) is a standout feature. It bridges the gap between "toy" and "educational tool" without being didactic — the math is there if you want it, invisible if you don't.

### Where the Experience Falls Short

**Discovery is random, not guided.** The shuffle button produces random curves, but there's no way to explore the *space* of patterns systematically. Users can't say "show me all 5-petal flowers" or "find curves that look like stars." The preset gallery (12 named curves) helps, but it's a tiny window into a vast parameter space. There's no way to browse related patterns, to understand which parameter changes produce which visual effects, or to search by visual similarity.

**The controls feel like a synth, not a sketchbook.** The LFO drawer, parameter sliders, and mode toggles are powerful but intimidating. A new user sees ~30 controls and has no mental model for what they do. The mapping between numeric parameters and visual outcome is opaque unless you already understand trochoid geometry. There's no "beginner mode" that offers higher-level creative choices (e.g., "more complex," "more symmetrical," "spikier").

**Layering is manual and unstructured.** The Layer+ button stamps a curve and auto-rotates hue, which is clever, but there's no way to manage, reorder, delete, or adjust individual layers. Once stamped, a layer is baked into a flat bitmap. You can't go back and tweak the third layer's parameters.

**Patterns plateau visually.** After exploring for a while, the visual range starts to feel samey — everything is neon curves on dark backgrounds. There's no texture, no fill, no variation in density or line quality that would make one creation feel fundamentally different from another. The color palettes help, but the *geometry* of every output is a single closed trochoid.

**No gallery or history.** There's no auto-saved history of patterns you've explored, no way to bookmark a discovery, and no community gallery. Each session starts fresh (unless you manually saved a preset or used URL sharing).

---

## Part 3: Currency Pattern (Guilloche) Research

### What Guilloche Patterns Are

Guilloche (pronounced ghee-YOSH) patterns are the intricate, mathematically precise line engravings found on banknotes, stock certificates, passports, and fine watchmaking. Originally produced by engine-turning lathes, they serve as anti-counterfeiting measures because their fine, precise geometry is extremely difficult to reproduce by hand or photocopier.

The key visual characteristics are: extremely fine parallel lines (often 0.1–0.3mm apart), complex interlocking wave patterns that create moiré effects, fills between boundary curves, crosshatching from overlapping pattern layers, and the illusion of 3D depth through line density variation.

### Mathematical Approaches

#### 1. Envelope-Based Guilloche (The Core Technique)

The fundamental guilloche algorithm defines two boundary curves (inner and outer envelopes) and fills between them with a modulated wave. In polar form:

```
Inner envelope:  r_inner(θ) = R1 + A1·sin(n1·θ + φ1)
Outer envelope:  r_outer(θ) = R2 + A2·sin(n2·θ + φ2)
```

The fill curve oscillates between these envelopes:

```
r(θ) = midpoint(θ) + amplitude(θ)·sin(nodes·θ)
where:
  midpoint(θ)  = (r_inner(θ) + r_outer(θ)) / 2
  amplitude(θ) = (r_outer(θ) - r_inner(θ)) / 2
```

The critical parameters are `nodes` (oscillation count) and `div` (a divisor that prevents premature closure). The rule of thumb: make `div` a small prime and ensure `nodes` is not a multiple of `div`.

#### 2. Rose Curves

```
r(θ) = a·cos(k·θ)
```

When `k` is rational (p/q), these produce closed curves with predictable petal counts. They're a special case of hypotrochoids and appear frequently in currency rosettes and corner ornaments.

#### 3. Lissajous Figures

```
x(t) = A·sin(a·t + δ)
y(t) = B·sin(b·t)
```

These produce the interlocking figure-eight and pretzel patterns seen in currency borders. The ratio a/b determines the figure's topology; the phase δ controls its orientation. Small rational ratios (3/2, 5/4, 7/6) produce the most interesting closed figures.

#### 4. Superposition and Moiré

Currency patterns achieve their visual density by overlaying 2–5 pattern layers at slight angular offsets. The interaction between layers creates moiré interference patterns that are nearly impossible to reproduce accurately, which is exactly the security feature.

#### 5. Displacement Mapping

A more advanced technique applies a secondary parametric displacement to each point:

```
r'(θ) = r(θ) + D·sin(f·θ + φ)^n
```

The exponent `n` controls the sharpness of the displacement (n=1 is smooth sine, n>1 creates sharper peaks). This can transform simple circles into the complex, organic-looking borders seen on banknotes.

### How the Current Spirograph Math Connects

The app's existing hypotrochoid/epitrochoid equations are actually the mathematical cousins of guilloche patterns. The relationship:

| Current App | Guilloche Extension |
|---|---|
| Single trochoid curve | Two envelope curves + fill wave |
| Fixed R, r, d parameters | Envelopes where R, r, d vary with θ |
| One pen position (d) | Multiple parallel offset curves |
| Solid stroke | Fine-line density fills |
| Layer+ (manual stacking) | Automatic multi-layer compositing |
| HSL color sweep | Region-based and moiré coloring |

The key insight is that the existing `SpiroMath.hypoPoint()` and `epiPoint()` functions already generate the building blocks. A guilloche pattern is essentially "use one trochoid as the inner boundary, another as the outer boundary, and fill between them with a modulated wave that itself follows trochoid-like math."

### Parameters to Expose for Guilloche Mode

**Envelope controls:**
- Inner radius base + wave amplitude, frequency, phase
- Outer radius base + wave amplitude, frequency, phase
- Envelope shape (trochoid, rose, Lissajous, circle, custom)

**Fill controls:**
- Number of fill lines (density: 10–200)
- Fill wave: nodes, div, waveform (sine, triangle, sawtooth)
- Line weight (0.1–2px for fine engraving look)
- Fill direction (radial, concentric, linear, spiral)

**Composition controls:**
- Number of pattern layers (1–5)
- Per-layer rotation offset
- Per-layer color/opacity
- Moiré preview (show layer interactions)

**Rendering controls:**
- Anti-aliased sub-pixel line mode
- Crosshatch angle and density
- Background tint (aged paper, white, dark)

---

## Part 4: Improvement Plan

### Phase 1: Visual Quality & Line Rendering (Foundation)

**Goal:** Make existing patterns more beautiful and enable the fine-line rendering that guilloche requires.

**1.1 — Variable-width strokes**
Replace the fixed `lineWidth` with a width function that can respond to curvature, speed (dθ/dt mapped to screen space), or a custom envelope. This enables tapered, calligraphic-looking curves without changing the underlying math. Implementation: compute curvature at each point via the parametric curvature formula `κ(t) = |x'y'' - y'x''| / (x'² + y'²)^(3/2)` and map it to width.

**1.2 — Sub-pixel line rendering**
For guilloche-quality fine lines, the app needs lines thinner than 1 CSS pixel. Use `ctx.lineWidth = 0.5` (or lower) with careful anti-aliasing. Consider rendering at 2–4× resolution and downsampling for smoother thin lines. The existing DPR-aware scaling already supports this; the change is mostly about allowing the line width slider to go below 0.5px and ensuring the glow system works with very thin strokes.

**1.3 — Parallel offset curves**
Add a "line count" parameter that draws N parallel copies of the current curve at small radial offsets. This is the simplest way to create a guilloche-like density of lines. Offset a trochoid by scaling `d` slightly for each copy: `d_i = d + i·spacing`. Fast to implement, dramatic visual impact.

**1.4 — Background and paper textures**
Add warm paper-tone backgrounds (cream, parchment, aged ivory) alongside the existing dark mode. Guilloche patterns look best on light backgrounds. Consider a subtle noise texture overlay to simulate paper grain.

**1.5 — Export quality improvements**
The existing 4× PNG export is good. Add a "print quality" SVG export that preserves individual curve paths (not grouped by hue band), uses hairline strokes, and includes metadata. Add PDF export option for print-ready output.

### Phase 2: New Pattern Types (The Guilloche Engine)

**Goal:** Extend the math engine to support envelope-based patterns, rose curves, Lissajous figures, and composed multi-curve patterns.

**2.1 — Guilloche pattern mode**
Add a new "Guilloche" mode alongside Hypotrochoid/Epitrochoid. This mode defines two envelope curves (inner and outer boundaries) and fills between them with a modulated wave. The envelope curves themselves can be circles, trochoids, or rose curves — reusing the existing SpiroMath functions. Key parameters: inner/outer base radius, envelope wave (amplitude, frequency, phase for each), fill nodes, fill div, fill line count.

**2.2 — Rose curve mode**
Add `r(θ) = a·cos(k·θ)` as a curve type. Rose curves are simple to implement and produce beautiful, recognizable patterns (the "flower" shapes). When `k = p/q` is rational, the curve closes after `q` full rotations with a predictable number of petals. Expose `k` as a fraction (numerator/denominator sliders) for precise control.

**2.3 — Lissajous figure mode**
Add `x = A·sin(a·t + δ), y = B·sin(b·t)` as a curve type. The frequency ratio a/b and phase δ control the figure's shape. These produce the interlocking, woven-looking patterns common in currency borders. Expose amplitude, frequency ratio, and phase.

**2.4 — Curve composition engine**
Allow two curves to be combined: one as an envelope/boundary, one as a fill or modulator. This is the architectural leap that enables true guilloche patterns. The composition could work as: (a) curve A defines the path, curve B oscillates around it; (b) curves A and B define boundaries, fill lines interpolate between them; or (c) curve A modulates a parameter of curve B (e.g., A's radius at angle θ becomes B's pen distance).

**2.5 — Crosshatch fill mode**
When a closed curve is complete, offer a fill option that renders the interior with fine parallel lines at a specified angle, or crosshatched lines at two angles. This is a common feature of security printing — the portrait area of a banknote is essentially crosshatch fills with varying density.

### Phase 3: UX & Discovery Improvements

**Goal:** Make pattern exploration intuitive, help users discover beauty, and support richer creative workflows.

**3.1 — Pattern gallery / explorer**
Replace the simple preset strip with a browsable gallery. Show a grid of thumbnails organized by category (flowers, stars, spirals, lace, guilloche, etc.) or by mathematical property (symmetry order, loop count, complexity). Generate thumbnails lazily using off-screen canvas. Allow users to save discoveries to a personal gallery (IndexedDB, not just localStorage).

**3.2 — "More like this" exploration**
When viewing a pattern, offer a "variations" button that generates 6–12 nearby patterns by perturbing parameters within a small neighborhood. This enables local exploration: you find something close to what you want, then refine via variations rather than manual slider tweaking. Think of it as a visual "neighborhood search."

**3.3 — Semantic controls**
Add a layer above the raw math parameters with higher-level creative language: "Complexity" (maps to loop count via R/r ratio), "Pointiness" (maps to d/r ratio), "Symmetry" (constrains R/r to integer ratios), "Density" (maps to line count for guilloche), "Fineness" (maps to line width). These don't replace the detailed controls; they provide an accessible on-ramp.

**3.4 — Layer management panel**
Show a vertical strip of layer thumbnails (like Photoshop layers). Each layer remembers its parameters and can be: toggled visible/hidden, deleted, reordered, re-entered for parameter editing, duplicated with offset. Layers become first-class objects, not baked bitmaps.

**3.5 — Undo with visual timeline**
Replace the invisible undo stack with a visual filmstrip of recent states (thumbnail + parameter diff). Users can scrub through their exploration history and branch from any point. This is particularly valuable when randomizing — you often pass through something beautiful and want to go back.

**3.6 — Guided tutorials / challenges**
Short, interactive walkthroughs: "Make a 7-petal flower," "Create a guilloche border," "Layer three patterns into a mandala." Each tutorial highlights which controls to use and explains the math behind the result. Gamification optional but effective (e.g., "Discover 5 star patterns").

### Phase 4: Architecture & Technical Quality

**Goal:** Make the codebase sustainable for the complexity of phases 1–3.

**4.1 — Split into ES modules**
The 3,450-line single file is approaching the limit of comfortable single-file maintenance. Split into: `math.js` (SpiroMath + new curve types), `renderer.js` (canvas management, drawing primitives), `ui.js` (controls, panels, events), `state.js` (parameter management, persistence, URL sharing), `effects.js` (glow, particles, ripples, idle animation), `lfo.js` (modulation engine), `guilloche.js` (new envelope/fill engine). Use native `<script type="module">` — no bundler needed.

**4.2 — Curve type abstraction**
Currently, the hypo/epi switch is a boolean that branches throughout the code. Introduce a `CurveType` interface with `point(t)`, `maxExtent()`, `totalT()`, `classification()` methods. Each curve type (hypotrochoid, epitrochoid, rose, lissajous, guilloche) implements this interface. This makes adding new curve types clean and prevents the mode-branching from becoming unwieldy.

**4.3 — Rendering pipeline refactor**
The current rendering is tightly coupled to the specific drawing modes (trail, loop, evolve). For guilloche patterns with many fill lines, the renderer needs to support batch drawing (thousands of fine lines per frame) efficiently. Consider: pre-computing curve points into typed arrays, using `Path2D` objects for complex fills, and exploring OffscreenCanvas or Web Workers for heavy rendering jobs.

**4.4 — State management cleanup**
The current `state` object is a flat bag of ~30+ properties. As curve types multiply, group state by concern: `state.geometry` (R, r, d, mode, curveType), `state.appearance` (color, lineWidth, strokeMode), `state.animation` (speed, trail, loop, evolve), `state.view` (3D, camera, scale). This supports cleaner persistence, URL sharing, and preset management.

**4.5 — Phone-responsive layout**
Implement a compact layout for screens < 768px: controls as a bottom sheet (swipe up to reveal), parameter groups as horizontal swipe cards, floating action buttons for play/shuffle/save. The canvas gets full-screen real estate by default.

### Phase 5: Polish & Delight

**Goal:** Elevate the experience from "cool tool" to "something you show people."

**5.1 — Animation export**
Record the animation loop as WebM or GIF. Use the existing `MediaRecorder` API on a canvas captureStream(). For GIF, use a client-side GIF encoder (gif.js or similar). The evolve mode and LFO modulations are particularly beautiful when exported as loops.

**5.2 — Sound design V2**
The current audio (sine oscillator mapped to pen distance) is functional but thin. Map curve complexity to harmonic richness: more loops = more overtones. Use the LFO engine's waveforms to modulate audio parameters, creating a true audio-visual synthesis link. Add reverb (ConvolverNode) for depth.

**5.3 — Community sharing**
A simple gallery backend (could be as minimal as a GitHub-backed JSON file) where users can publish patterns with a title and tags. Others can browse, load, and remix. The existing URL-hash sharing is the foundation; a gallery adds discoverability.

**5.4 — Print-ready templates**
Pre-composed layouts for printing: currency-style borders, certificate frames, mandala coloring pages, decorative panels. These combine multiple pattern types with proper alignment and are exported as high-resolution SVG or PDF.

**5.5 — Dark/light mode**
The current dark UI with neon glow is distinctive, but guilloche patterns (and many artistic uses) look better on light backgrounds. Add a full light theme with appropriate panel styling, not just a background color change.

---

## Priority Matrix

| Phase | Effort | Impact | Dependency | Suggested Order |
|---|---|---|---|---|
| 1.1 Variable-width strokes | Medium | High | None | Start here |
| 1.3 Parallel offset curves | Low | Very High | None | Start here |
| 1.4 Backgrounds & textures | Low | Medium | None | Start here |
| 2.1 Guilloche mode | High | Very High | 1.3 (offset curves) | Second |
| 2.2 Rose curves | Low | Medium | 4.2 (curve abstraction) | Third |
| 2.3 Lissajous figures | Low | Medium | 4.2 | Third |
| 3.1 Pattern gallery | Medium | High | None | Can parallel Phase 2 |
| 3.2 "More like this" | Low | High | 3.1 (gallery) | After gallery |
| 3.3 Semantic controls | Medium | High | None | Can parallel Phase 2 |
| 4.1 ES modules split | Medium | Medium (maintainability) | None | Before Phase 2 if possible |
| 4.2 Curve type abstraction | Medium | High (extensibility) | 4.1 | Before new curve types |
| 1.2 Sub-pixel rendering | Low | Medium | None | With Phase 2 |
| 2.4 Curve composition | High | Very High | 4.2, 2.1 | Phase 2 capstone |
| 2.5 Crosshatch fills | Medium | High | 2.4 (composition) | After composition |
| 3.4 Layer management | High | Medium | 4.4 (state cleanup) | Phase 3 |
| 3.5 Visual undo timeline | Medium | Medium | None | Phase 3 |
| 4.3 Rendering pipeline | High | Medium (perf) | 4.1 | With Phase 2 |
| 4.5 Phone layout | Medium | High | None | Anytime |
| 5.1 Animation export | Medium | High | None | Phase 5 |
| 5.4 Print templates | Medium | Medium | 2.1, 2.4 | Phase 5 |

---

## Recommended Starting Sequence

**Immediate wins (1–2 days each):**
1. Parallel offset curves (1.3) — highest visual impact for lowest effort
2. Light backgrounds and paper tones (1.4) — unlocks the guilloche aesthetic
3. Variable-width strokes (1.1) — transforms line quality

**Foundation sprint (1–2 weeks):** ✅ DONE (v3.0)
4. ES module split (4.1) — ✅ done
5. Curve type abstraction (4.2) — ✅ done

**Guilloche sprint (2–3 weeks):** partially done
6. Rose curve mode (2.2) — ✅ done
7. Lissajous mode (2.3) — ✅ done
8. Guilloche envelope mode (2.1) — ✅ done as a single `GuillocheCurve` type
9. Curve composition (2.4) — ⬜ still open (the true compound-pattern capstone)

**Experience sprint (1–2 weeks):**
10. Pattern gallery (3.1) + "More like this" (3.2)
11. Semantic controls (3.3)
12. Phone layout (4.5)

---

## Research Sources

- [Guilloché — Wikipedia](https://en.wikipedia.org/wiki/Guilloch%C3%A9)
- [Guilloché Pattern — Wolfram MathWorld](https://mathworld.wolfram.com/GuillochePattern.html)
- [Coding Curves 12: Guilloche Patterns — Bit-101](https://www.bit-101.com/2017/2023/01/coding-curves-12-guilloche-patterns/)
- [Guilloché Patterns — Wolfram Demonstrations](https://demonstrations.wolfram.com/GuillochePatterns/)
- [Guilloché Pattern Generator — Sub.blue](http://2008.sub.blue/projects/guilloche.html)
- [Guilloche Pattern Generator — Prabin Pebam](https://prabinpebam.github.io/guilloche/)
- [Guilloché Patterns — Mathling](https://mathling.com/art/20231110_guilloche.html)
- [Coding Curves 11: Roses — Bit-101](https://www.bit-101.com/2017/2023/01/coding-curves-11-roses/)
- [Offset Sine Guilloche Math — Bill Ooms (PDF)](https://www.billooms.com/cornlathe/downloads/GuillocheMath.pdf)
- [Ben Hodosi — Security Document & Guilloche Designer](https://benhodosi.com/)
