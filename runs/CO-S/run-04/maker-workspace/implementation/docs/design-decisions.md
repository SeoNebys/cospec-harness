# Design-decision record — Bookmarks (cycle 1)

Lightweight record of what was decided and why, for later-cycle impact analysis.
Implementation was derived from approved scenarios SCN-001..SCN-012; no prototype
code was reused.

## Architecture
- **Single-page app + thin Node server.** `server.mjs` (Node 24, `node:http`,
  no runtime dependencies) serves the static app from `public/` and exposes one
  API: `GET /api/metadata?url=...`.
- **Why a server at all:** automatic page-detail fetching (SCN-001) must read
  arbitrary third-party pages; browsers block that cross-origin, so the fetch +
  HTML parse happens server-side. Global `fetch` (Node 24) is used — no deps.
- **Bookmarks are NOT stored on the server.** They persist in the browser via
  `localStorage` (`store.mjs`), matching the private, browser-local persistence
  decision (SCN-012). The server is stateless. Dropped alternative: a server DB
  — deferred with cross-device sync to a later cycle.

## Modules (all framework-free ES modules)
- `public/model.mjs` — link normalization, light validity check, duplicate
  detection, host/id helpers. Pure.
- `public/search.mjs` — search query language: tokenizer + recursive-descent
  parser (precedence NOT > AND > OR, implicit AND, quoted phrases, `#tag` exact,
  parentheses). Returns a predicate over a normalized `{haystack, tags}` record.
  Malformed query falls back to a plain substring match. Pure.
- `public/markdown.mjs` — safe Markdown subset for notes. **Escapes HTML first**,
  then applies formatting — untrusted note text cannot inject markup.
- `public/store.mjs` — localStorage load/save with shape normalization.
- `src/metadata.mjs` — pure HTML → {title, description, image, favicon, host}
  extraction (Open Graph / Twitter / `<title>` / `<meta description>` / icon
  `<link>`), separated from network I/O for testability.
- `public/app.mjs` — state + DOM. Event delegation for card actions; string
  templates for rendering; inline editors for edit and organize.

## Key behavioural decisions
- **Fetch failure never blocks saving (SCN-008).** `/api/metadata` returns
  `{error:true}` on any failure; the client saves the bookmark anyway with the
  link as fallback title, shows a warning, offers Try again + manual Edit.
- **Duplicate = no second copy (SCN-009).** `findDuplicate` uses `sameLink`
  (trailing-slash-insensitive, case-insensitive). Archived duplicates are
  revealed in the Archive view.
- **Read later is a marker; archive is a move (SCN-006/007).** `inView` excludes
  archived items from All/Read-Later and from ordinary searches (matcher runs
  within the current view only).
- **Long descriptions clamp to 3 lines (CSS `-webkit-line-clamp`), missing
  fields are omitted quietly (SCN-010).**
- **Optional re-fetch on URL edit (SCN-002).** Default preserves curated
  title/description; only the checkbox re-pulls details.

## Security / robustness notes
- **SSRF guard** in `server.mjs` `isFetchableUrl`: only public http/https URLs;
  loopback and private ranges (127/10/192.168/172.16-31/169.254, localhost,
  *.local) are refused. Response body is capped (512KB / until `</head>`).
- **Note rendering** escapes before formatting (`markdown.mjs`).
- Card image/favicon URLs are gated to http(s) before being placed in CSS/`src`.

## Ports
- Final application: port **4000** (`npm start`), bound to `0.0.0.0`.
- Prototype (Phase 1) remains on 4001, separate.
