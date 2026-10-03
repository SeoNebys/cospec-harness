# Scenario-to-code mapping

| Scenario | Primary implementation | Verification |
|---|---|---|
| SCN-001 | `public/app.js` save flow; `lib/metadata.js`; bookmark API | e2e save test; metadata/unit and API tests |
| SCN-002 | `/api/metadata`, normalized duplicate branch, editor reuse | e2e duplicate test; API duplicate test |
| SCN-003 | editor label state and suggestions; canonical server labels | e2e save/batch tests; API label test |
| SCN-004 | sidebar/card label actions and view derivation | e2e import and label-view tests |
| SCN-005 | note toolbar/editor, sanitization, stored HTML | e2e formatted-note reopen; sanitization API test |
| SCN-006 | `searchMatch`, live input rendering and source reasons | e2e note-search test |
| SCN-007 | card clock, details switch, Read later view | e2e Read later and batch tests |
| SCN-008 | card anchors with `_blank`; separate details action | card markup; browser acceptance suite |
| SCN-009 | client validation plus `parseWebUrl` | e2e invalid-address test; URL unit tests |
| SCN-010 | metadata unavailable editor state | e2e manual fallback test |
| SCN-011 | `renderEmpty` search branch and clear action | advanced-search e2e coverage |
| SCN-012 | `renderEmpty` Read later branch | e2e Read later completion test |
| SCN-013 | CSS line clamps and first-three-label rendering | filled-library visual check; card renderer |
| SCN-014 | `lib/url.js` normalized key | URL unit tests; e2e normalized duplicate |
| SCN-015 | copied bookmark fields; no refresh path | API update/duplicate tests |
| SCN-016 | durable store with no external-page cleanup | restart persistence test |
| SCN-017 | single-item confirm modal and DELETE API | shared confirmation implementation; batch e2e |
| SCN-018 | archive flags, Archive view, restore actions | e2e archive/restore test |
| SCN-019 | `LibraryStore`, direct unauthenticated entry | restart persistence and initial-load tests |
| SCN-020 | persisted Sort dropdown and `visibleBookmarks` ordering | e2e sort test |
| SCN-021 | selection mode, scoped selection and `/api/bulk` | e2e batch tests; API batch test |
| SCN-022 | transfer parser, import preview and apply routes | transfer unit tests; e2e browser import |
| SCN-023 | browser/backup export and backup restore | transfer unit tests; e2e downloads/restore |
| SCN-024 | visible search options, active chips, full reset | e2e combined filters and reset |
