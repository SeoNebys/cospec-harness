#!/usr/bin/env bash
# Start the bookmark manager. Creates the venv + installs deps on first run.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  echo "Setting up virtual environment…"
  python3 -m venv .venv
  .venv/bin/python -m ensurepip --upgrade >/dev/null
  .venv/bin/pip install --quiet -r requirements.txt
fi

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
echo "Bookmarks running at http://${HOST}:${PORT}"
exec .venv/bin/uvicorn app.main:app --host "$HOST" --port "$PORT" "$@"
