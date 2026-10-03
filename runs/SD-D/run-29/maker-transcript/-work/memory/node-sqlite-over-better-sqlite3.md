---
name: node-sqlite-over-better-sqlite3
description: "In this Node 24.21 runtime, better-sqlite3 aborts on process exit; use built-in node:sqlite"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5f73f3ce-fcd3-4f2e-90b5-8e0d3a068598
  modified: 2026-09-27T06:16:14.443Z
---

In the `/work` shared image (Node **24.21.0**), the native `better-sqlite3`
binding **aborts the process** on teardown/exit with a V8 assertion
(`RemoveEnvironmentCleanupHook ... Assertion failed: (env) != nullptr`, in the
`Statement`/`Database` destructor). It crashes both under the `node:test` runner
and when an Express server exits — masking the real error with a core dump.

**Use Node's built-in `node:sqlite` (`DatabaseSync`) instead.** It is stable
here, needs no native build, and requires no `--experimental` flag on 24.21. API
notes vs better-sqlite3: `db.exec('PRAGMA …')` (no `.pragma()`), `run()` returns
`{ changes, lastInsertRowid }`, named params use `@name` object keys, rows are
null-prototype objects. It has **no `db.transaction()`** — wrap BEGIN/COMMIT/
ROLLBACK yourself and make it **reentrant** (skip nested BEGIN) since SQLite
rejects nested transactions.

Other gotchas seen: `node --test <dir>` treats a bare dir as a module entry — use
a glob like `tests/unit/*.test.js`. See the bookmark-manager app under
`specs/001-bookmark-manager/` which documents this in plan.md deviations.
