# My Bookmarks

Save fast, find it later, don't lose it.

## Run it

It's a static web app — no build step.

```bash
cd implementation
python3 -m http.server 8000
# then open http://localhost:8000/  in your browser
```

(Any static file server works. A module-aware server is needed because the app
uses ES modules — opening `index.html` via `file://` may be blocked by the
browser's module CORS rules, so prefer the server above.)

First run seeds a few sample links so the app isn't empty; use **Import** to
bring in a real pile, or delete the samples.

## Test

```bash
cd implementation
npm test      # node:test, 40 tests
```

## Layout

See `DESIGN.md` for the design record and the scenario-to-code map. In short:
`src/core/` holds the pure, tested rules; `app.js` is the UI; `src/services/`
is the seam to a future backend (live page fetch / snapshot / sync).
