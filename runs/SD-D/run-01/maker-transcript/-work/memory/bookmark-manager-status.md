---
name: bookmark-manager-status
description: Build status and key implementation choices for the bookmark-manager project
metadata: 
  node_type: memory
  type: project
  originSessionId: 03a7963e-fa1d-4d06-ad17-a78ecc5fb181
---

`specs/001-bookmark-manager` — local-first single-user bookmark manager. Backend:
Python/FastAPI + SQLite (FTS5) in `backend/`; frontend: React/Vite/TS in `frontend/`,
built into `backend/src/static` and served by the one process. Run locally via
`./run-mvp.sh` (invokes `python -m src.launcher`, which auto-opens the browser).

**User Stories 1–6 built and tested (42 backend tests pass)**: save, browse/open,
edit/delete/notes, tags/search/sort (incl. **exact-phrase search via quoted queries**,
FR-012c/T042c — done), import, export. One-click launcher works.

Windows packaging tooling delivered (client is on **Windows**): `packaging/build-windows.md`,
`build-windows.bat`, `create-shortcut.ps1`, plus `bookmark-manager.spec` + `run_app.py`
entry wrapper. The actual `BookmarkManager.exe` + Start-menu/Desktop shortcut must be built
by running these on the client's Windows PC (can't build from Linux; no objdump/Windows host).

Deferred/known items: linting config (T004/T005); note editor is a lightweight
contentEditable, not Tiptap (an allowed fallback); polish phase (T059–T064: long-title
truncation, 5k perf check, unit tests, docs). See [[bookmark-manager-client]] for how the
client works.

Gotcha: background `uvicorn`/`launcher` test servers linger across turns and `pkill -f`
doesn't reliably kill them; sweep by PID via `/proc/*/cmdline`, and prefer TestClient/pytest
for verification over curl against a fixed port (stale zombies cause false results).
