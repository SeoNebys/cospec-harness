# Phase 1 prototypes (exploration only)

These prototypes SIMULATE external behaviour for requirement exploration. They
are NOT the implementation and must not be reused as a basis for Phase 2 code
(see CLAUDE.md prohibitions). Approved behaviour is carried forward via the
approved scenarios (context/scenarios/).

- `index.html` + `app.js` + `shared.css` — the canonical, incrementally grown
  prototype reflecting all approved behaviour so far.
- Alternative sets kept for traceability of interaction exploration:
  - Correction interaction: `edit-a.html` / `edit-b.html` / `edit-c.html` (+`shared.js`)
  - Duplicate handling: `dup-a.html` / `dup-b.html` (+`dup.js`)
  - Tag entry: `tags-a.html` / `tags-b.html` / `tags-c.html` (+`tags.js`)

Page details (title/description/site/icon/thumbnail) are generated locally as
realistic stand-ins because a Phase-1 prototype does not fetch live pages; the
approved behaviour is that these come from the actual page.
