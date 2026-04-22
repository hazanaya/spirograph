# Spirograph — TODO

Items are ordered by priority within each section.

---

## Bug fixes

- [x] Fix mode-toggle selector bug (Hypo/Epi and 2D/3D share querySelectorAll('[data-mode]'), causing them to interfere)

---

## Synth-style live controls

- [x] Real-time parameter morphing — R/r/d/h/k sliders show instant full-curve preview while dragging, restart animated drawing on release
- [x] Color control — Solid / Gradient / Rainbow mode toggle; hue/sweep sliders update color live with no animation restart
- [x] Stroke width slider — live redraw when curve is complete, works per-frame during animation
- [x] Slow-draw speed control — applied per-frame, no restart needed

---

## Drawing & creative

- [x] Save/export drawing as PNG
- [x] SVG export
- [x] Layered drawing — Layer+ stamps current curve, auto-rotates hue by golden angle
- [x] Onion skin mode — ghost of previous curve stays visible while morphing
- [ ] Multi-touch drawing — two independent spirographs via two fingers
- [x] Brush/stroke variations — solid, dotted, dashed, tapered modes
- [x] Background color picker — custom background with dynamic rendering
- [ ] Animation export — export the drawing animation as GIF/MP4/WebM
- [x] New curve types — Rose, Lissajous, Guilloché as drop-in CurveType modules
- [x] Loop style selector — Once / Wipe / Rewind / Trail completion behaviors

---

## Interaction & playfulness

- [x] Haptic feedback on curve completion (Vibration API)
- [x] Record and playback — capture a morphing session, replay as animation
- [x] Symmetry lock — constrain R/r to produce exact n-fold symmetry with Petals slider
- [x] Undo/redo — full parameter + layer history, Ctrl+Z / Ctrl+Y
- [ ] Parameter linking — link d to r so they move together (common in real Spirograph sets)

---

## Presets & sharing

- [x] Save custom presets locally (named, stored in localStorage)
- [x] Share a pattern as a URL (encode parameters in the hash)
- [ ] QR code generation for sharing patterns
- [x] Color palette presets — 7 curated palettes + saturation/lightness sliders
- [ ] Favorites/history — auto-save recent parameter combos for quick recall

---

## Math & education

- [x] Annotate the curve — symmetry axes, petal numbering, period closure marker
- [ ] Side-by-side compare mode — split screen, two parameter sets at once

---

## Polish & PWA

- [x] PWA: service worker + manifest for iPad home screen install and offline support
- [x] DeviceMotion permission prompt — iOS 13+ requestPermission() flow for shake-to-shuffle
- [x] Accessibility pass — ARIA labels on all interactive elements, aria-expanded on panel toggles
- [x] Immersive first launch — auto-hide panel, attract mode with preset cycling, ☰ hint pulse
- [x] Expressive canvas drag — radial controls d, tangential controls r
- [x] Tap-to-shift hue — tap canvas to nudge hue toward tap angle
- [x] Direct number input — tap slider values to type exact numbers
- [x] Background color picker — custom background with dynamic rendering
- [x] High-res export — long-press save or Ctrl+Shift+S for 4x resolution
- [x] Keyboard shortcuts — Space, R, E, L, F, M, Escape, 1-9, Ctrl+S, Ctrl+Z/Y
- [x] Unified animation loop — one always-running RAF, no competing loops
- [x] Always-interactive canvas — parameter changes never stop the animation
- [x] Trail mode — curve wraps endlessly with adjustable fade trail
- [x] Guide opacity slider — fade construction geometry 0–100%
- [x] Random start — fresh visits randomize all parameters
- [ ] Responsive phone layout — panels as bottom sheets on small screens

---

## Code quality

- [x] Input validation — guard against NaN/division-by-zero in SpiroMath
- [x] Explicit Evolve/IdleAnim guard — prevent glowCanvas opacity conflict
- [x] Unified animation loop — replaced 4 separate RAF loops with one
- [x] Camera.dragging — replaced fragile autoRotate flag
- [x] Split into ES modules — separate HTML, CSS, JS; native `<script type="module">`
- [ ] Gesture abstraction — extract 1-finger vs 2-finger logic into a handler
