---
name: bookmark-manager-project
description: "Bookmark Manager app — status, stack, how to launch, E2E caveat"
metadata: 
  node_type: memory
  type: project
  originSessionId: d6541e9a-504e-48d2-a8a3-45a8e34a5911
---

Personal, single-user, local bookmark manager built via Spec-Driven Development
(spec/plan/tasks/implement in `specs/001-bookmark-manager/`). All 7 user stories
+ Phase 10 polish complete as of 2026-07-13; client signed off.

Stack: FastAPI + SQLite backend (`backend/`), React + Vite + TS frontend
(`frontend/`), single deployable — backend serves the built UI at localhost:8765.
Launch instructions for a non-technical user live in `README.md`.

Proof state: backend pytest is the reliable green (36 tests); a 24-check
API-level quickstart sweep passes on a clean DB. **Playwright E2E specs exist for
all stories but CANNOT run in this sandbox** — no root to install Chromium system
libs (libglib etc.). Backend tests are the trustworthy signal; run E2E on a real
machine via `npx playwright install`. See [[sandbox-no-root-for-chromium]].

If reopening: `rm` any stale `/tmp/live-demo.db`, start with
`BOOKMARK_DB_PATH=... uvicorn src.app:app --port 8765` from `backend/`.

Parked idea (client's own, 2026-07-13, NOT yet started): detecting/flagging
**dead links** — a saved page that now 404s / is gone, so clicking through lands
on nothing. Client will raise it through the spec if it becomes a real itch once
the app holds their everyday pile. If they return with it, start at
speckit-specify, not code.
