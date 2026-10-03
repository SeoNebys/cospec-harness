# Scenario → code → test mapping (cycle 1)

| Scenario | Primary code | Tests |
|---|---|---|
| SCN-001 Save + enrich + open + rename | service.save/captureInto; fetcher; app POST; public/app.js save/card | service.test (SCN-001), api.test (GET/POST), fetcher.test, e2e |
| SCN-002 Tags (reuse/create/lowercase/dedupe/remove) | service.addTag/removeTag; app tags/untag; app.js showTagPop | service.test (SCN-002), api.test (tags) |
| SCN-003 Notes (Markdown, preview/expand, edit) | service.setNote; app PATCH note; app.js mdToHtml/editNote | service.test (SCN-003), api.test (note) |
| SCN-004 Search (live, #tag, phrases, AND/OR/NOT, parens, case) | shared/query.js; app.js render/hl | query.test (all cases), e2e (search) |
| SCN-005 Reading list (opt-in, non-destructive) | service.setToRead; app.js views/toread | service.test (SCN-005), api.test (flags), e2e |
| SCN-006 Archive (hide/restore, excluded from views) | service.setArchived; app.js inView | service.test (SCN-006), api.test (bulk archive), e2e |
| SCN-007 Preserved copy (readable / PDF as-is) | fetcher.js buildReadable/PDF; store copies; service.getCopy; app copy route | fetcher.test, service.test (SCN-007), api.test (copy) |
| SCN-008 Edit/dedupe/delete | service.edit/findDuplicate/remove; canon | service.test (SCN-008 ×5), api.test (dup 409), e2e (dup/delete) |
| SCN-009 Empty & oversized states | public/app.js emptyState; styles.css clamps/ellipsis | e2e (empty state); layout via CSS |
| SCN-010 Sort + bulk with scoped selection | app.js sort/selection/bulk; service.bulk | service.test (SCN-010), api.test (bulk) |
| SCN-011 Errors (non-address, unreachable, retry) | service.save validation; captureInto; service.retry | service.test (SCN-011 ×2), api.test (unreachable), fetcher.test, e2e (reject) |
| SCN-012 Persistence / fixed snapshot | store persistence; no time-based mutation | service.test (SCN-012 reload) |

Run all: `cd implementation && npm test` (node:test) and the Playwright e2e
(`@playwright/test`).
