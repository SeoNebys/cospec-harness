# Planned exploration blocks (added SESSION-001, Phase 1)

New requirements raised by the client before the Phase 2 switch. Explored one
block at a time via prototype + guided confirmation. All settled.

| Block | Requirement | Scenario | Status |
|-------|-------------|----------|--------|
| A | Permanently delete a bookmark, distinct from archiving. | SCN-014 | settled |
| B | Edit the saved address itself. | SCN-015 | settled |
| C | Bulk select (incl. all-matching) and act together. | SCN-016 | settled |
| D | Save a search + tags as a reusable live collection. | SCN-017 | settled |
| E | Local page copy / PDF / Internet Archive copy. | SCN-018 | settled (external-service dep flagged) |
| F | Import/export standard browser-bookmark HTML. | SCN-019 | settled |
| G | Settings: text size, items per page. | SCN-020 | settled |
| H | Real favicon + preview image where available. | SCN-021 | settled (external-fetch dep flagged) |

External-service dependencies (E, H) are simulated in the Phase 1 prototype and
must be implemented and validated honestly in Phase 2.
