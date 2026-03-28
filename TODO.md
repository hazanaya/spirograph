# Spirograph — TODO

Items are ordered by priority within each section.

---

## Bug fixes

- [x] Fix mode-toggle selector bug (Hypo/Epi and 2D/3D share querySelectorAll('[data-mode]'), causing them to interfere)

---

## Synth-style live controls ← HIGH PRIORITY

- [x] Real-time parameter morphing — R/r/d/h/k sliders show instant full-curve preview while dragging, restart animated drawing on release (no stop-and-restart feel)
- [x] Color control — Solid / Gradient / Rainbow mode toggle; hue/sweep sliders update color live with no animation restart
- [ ] Stroke width slider — from hairline to thick brushstroke *(slider exists; confirm live update works without restart)*
- [ ] Slow-draw speed control — set how fast the curve draws *(slider exists; confirm live update works without restart)*

---

## Drawing & creative

- [ ] Save/export drawing as PNG or SVG from within the app *(PNG save exists; add SVG export)*
- [ ] Layered drawing — stack multiple spirographs without clearing, each a different color *(Layer+ exists; improve UX)*
- [ ] Onion skin mode — ghost of previous curve stays visible while morphing

---

## Interaction & playfulness

- [ ] Haptic feedback on curve completion (Vibration API)
- [ ] Record and playback — capture a morphing session, replay as animation
- [ ] Multi-touch drawing — two independent spirographs via two fingers

---

## Presets & sharing

- [ ] Save custom presets locally (named, stored in localStorage)
- [ ] Share a pattern as a URL (encode parameters in the hash)
- [ ] QR code generation for sharing patterns

---

## Math & education

- [ ] Annotate the curve — highlight petal formation, symmetry axes, period markers
- [ ] Side-by-side compare mode — split screen, two parameter sets at once

---

## Polish & PWA

- [ ] PWA: add service worker + manifest so it installs to iPad home screen and works offline
- [ ] Dark/light mode toggle
- [ ] Accessibility pass — keyboard nav, VoiceOver labels
