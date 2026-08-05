#!/usr/bin/env bash
# Run the app the "proper" way for local review: this invokes the one-click launcher
# (FR-019), which starts the single local process (serving both API and the built UI)
# and opens your default browser automatically.
#
# This is the same entry point the packaged desktop icon will run; the only difference is
# that a real install (see packaging/build.md) bundles Python so you don't need this
# script or a terminal at all.
set -euo pipefail

cd "$(dirname "$0")/backend"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  ./.venv/bin/pip install -e .
fi

exec ./.venv/bin/python -m src.launcher
