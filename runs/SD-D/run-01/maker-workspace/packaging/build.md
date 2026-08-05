# Packaging the one-click launcher (FR-019)

Goal: a normal application icon the user double-clicks — the app opens in their browser,
ready to use, with no terminal or configuration (SC-009). Everyday launch is one action;
installation is a one-time step.

## How it works

- The frontend is built into `backend/src/static/` and served by the **same** backend
  process, so there is exactly one thing to run (one process, one local port).
- `backend/src/launcher.py` starts that process, picks a free local port, and opens the
  default browser automatically.
- PyInstaller bundles Python + the backend + the built static assets into a single
  executable, so the end user needs neither Python nor Node installed.

## Build steps (run on each target OS)

```bash
# 1. Build the frontend into the backend's static dir
cd frontend && npm run build

# 2. Bundle the launcher into a single executable
cd ..
pip install pyinstaller
pyinstaller packaging/bookmark-manager.spec

# Result: dist/BookmarkManager (or dist/BookmarkManager.exe on Windows)
```

The executable is OS-specific — build it on Windows for a `.exe`, on macOS for a `.app`,
on Linux for an ELF binary.

## Making it a one-click icon (one-time install)

- **Windows**: place `BookmarkManager.exe` somewhere stable (e.g. `%LOCALAPPDATA%`), then
  create a Start-menu / Desktop shortcut to it. Add an `.ico` via the `icon=` field in the
  spec for a branded icon.
- **macOS**: build with `--windowed` to get `BookmarkManager.app`; drag it to
  `/Applications`. Add an `.icns` via the `icon=` field.
- **Linux**: install the binary to `~/.local/bin` and add a `.desktop` launcher entry in
  `~/.local/share/applications/` so it appears in the app menu.

## Data & portability

Bookmarks live in a single local SQLite file (`~/.bookmark-manager/bookmarks.db`), created
on first launch. Users can copy or back it up any time, and export to a standard bookmark
file from within the app (User Story 6).

## Status / validation note

The launcher mechanism (single process serving API + UI, auto-opening the browser, fast
startup) is implemented and validated. Producing the final signed, icon-bearing binary for
each OS is a build-machine step that must run on that OS; the spec file above is the
recipe. Code-signing/notarization (macOS) and SmartScreen (Windows) are out of scope for
this build.
