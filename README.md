# Spirograph

> Status: **Experiment, published; open source (MIT); no maintenance promised** | Created: 2025-03-31
>
> Live: https://hazanaya.github.io/spirograph/ · Shared as is: no updates promised, no support offered.

## Overview
Interactive spirograph generator built as a Progressive Web App. Features ghost-free trail mode.

## Key Files
- `index.html` — Main PWA application
- `Design.md` — Design documentation
- `CHANGELOG.md` — Change history (original)
- `TODO.md` — Planned tasks
- `manifest.json` / `sw.js` — PWA configuration
- `LICENSE` — MIT

## For AI Assistants
1. Read `CLAUDE.md` for context
2. Read `docs/HANDOFF.md` for current state
3. Read `Design.md` and `TODO.md` for plans

## Running locally
Any static file server works; the app uses relative paths only, so a subfolder is fine:

```sh
python3 -m http.server 8765
```

## License
MIT, see `LICENSE`. This is a finished experiment: fork it, learn from it, change it. It is shared as is, with no updates promised.
