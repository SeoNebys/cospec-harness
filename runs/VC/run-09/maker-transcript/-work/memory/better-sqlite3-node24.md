---
name: better-sqlite3-node24
description: better-sqlite3 <13 core-dumps on process exit under Node 24; pin v13+
metadata: 
  node_type: memory
  type: reference
  originSessionId: 8f7d4215-c79b-4f6d-841e-005ff63f439f
  modified: 2026-09-19T02:08:32.921Z
---

In this environment (Node.js 24.21), `better-sqlite3@11.x` aborts on process
exit with `Assertion failed: (env) != nullptr` in `Statement::~Statement`
(RemoveEnvironmentCleanupHook). The addon works fine at runtime — the crash is
only at teardown, so it silently corrupts "clean shutdown" and makes every
server restart look like a crash (core dumped, exit 134).

**Fix:** use `better-sqlite3@^13` (13.0.3 verified clean, exit 0 on natural
exit and on SIGTERM). Also add SIGTERM/SIGINT handlers that call `db.close()`
before exit. Node 24's built-in `node:sqlite` (DatabaseSync) is a viable
native-free alternative and includes FTS5, but needs `--experimental-sqlite`
and returns BigInt lastInsertRowid.
