# Scenario-to-code map

| Scenarios | Primary implementation | Tests |
|---|---|---|
| SCN-001, SCN-009, SCN-010, SCN-016 | `server.js` create endpoint; `src/domain.js`; add dialog in `public/app.js` | `domain.test.js`; production acceptance test save/invalid/basic/duplicate flows |
| SCN-002, SCN-008, SCN-011, SCN-019 | `public/app.js` filtering/highlighting/clear logic; `src/domain.js` equivalent domain rules | domain search test; production acceptance note-search test |
| SCN-003, SCN-004, SCN-012 | `server.js` patch endpoint; `src/domain.js` canonical tags; sidebar/card tag UI | canonical-tag unit test; production acceptance tag flow |
| SCN-005, SCN-013 | Read-later patch and dedicated view in `public/app.js` | production acceptance mark/remove/empty-view flow |
| SCN-006, SCN-014 | Archive patch, card menu, restore, and empty view in `public/app.js` | production acceptance archive/restore flow |
| SCN-007, SCN-015 | Note editor and patch flow in `public/app.js` and `server.js` | production acceptance note save; note-search test |
| SCN-017 | Card clamping, expansion state, and Show more/less in `public/app.js` and `styles.css` | domain content remains searchable; browser rendering exercised by acceptance suite |
| SCN-018 | Whole-result pagination in `public/app.js`; `src/domain.js` pagination rule | pagination unit test; production acceptance page navigation |
| SCN-020 | Refresh endpoint in `server.js`; refresh action and preservation messaging in `public/app.js` | production acceptance metadata update with note/tag preservation |
