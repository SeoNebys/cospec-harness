# Session log — SESSION-001 (Cycle 1, Phase 1)

## Text substitutions (where a prototype was not used, with reason)

- SCN-011 (shared collection across devices): cross-device sync cannot be
  reproduced in a single prototype instance, so the behaviour was confirmed by
  direct discussion. Persistence between visits is likewise a storage behaviour
  not meaningfully shown in the in-memory prototype.
- Temporal-context edge cases: not applicable to this app — there is no
  time-based/automatic behaviour (archiving is a manual action; no expiry or
  scheduled changes). Confirmed by reasoning, no prototype needed.

## Key interaction explorations

- Tag entry method: chip input (type + Enter/comma, × to remove) chosen; client
  approved directly (SCN-002).
- Sort control: three alternatives compared (segmented strip / dropdown / menu
  button); client chose the compact dropdown (SCN-007).

## Prototype notes

- Phase 1 prototype in prototypes/index.html simulates page-detail lookup,
  favicons, and fetch failure; state is in-memory only. Per project rules this
  prototype must NOT be reused as a basis for Phase 2 implementation; approved
  behaviour is carried forward via the SCN GWT specs only.
- Review helpers: `?seed=1` loads sample data for scale/long-content review;
  `?sort_ui=segmented|select|menu` was used only for the sort comparison and the
  final app uses the dropdown.

## Later-cycle requests

- L-01: PULLED INTO CYCLE 1 — personal settings (default sort, list density, font
  size) implemented as SCN-016. See context/later-cycle-requests.md.

## Phase 2 (development) — done

- Production app built in implementation/ from approved GWT (not from prototype
  code), Node built-ins only. See implementation/DESIGN.md and SCENARIO_MAP.md.

## Phase 3 (verification) — passed

- Node unit/integration tests (23) pass: `cd implementation && node --test`.
  Covers SCN-001,002,003,005,006,010,011,012,013,014,015,016 + query (004) + urls.
- Browser acceptance (Playwright) 19/19 checks pass:
  `cd implementation && node server.js & APP_URL=... python tests/acceptance.py`.
  Covers SCN-001,003,004,005,006,007,008,011,012,013,014,015,016.
- Real behaviours confirmed live: metadata auto-fill, preserved-copy capture
  (HTML + PDF) stored and served, settings persistence across reload.
