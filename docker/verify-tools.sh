#!/bin/sh
set -eu

node --version
npm --version
python3 --version
uv --version
claude --version
codex --version
specify version
python -c 'import importlib.metadata; print("Python Playwright", importlib.metadata.version("playwright"))'
playwright --version
node -e 'console.log("Node Playwright", require("playwright/package.json").version)'
cc --version | head -1
