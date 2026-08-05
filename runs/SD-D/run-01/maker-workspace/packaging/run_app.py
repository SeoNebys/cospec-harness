"""PyInstaller entry point.

Runs the launcher as part of the ``src`` package (so its relative imports work) rather
than executing launcher.py directly as a top-level script.
"""

import os
import sys

# Make the backend's ``src`` package importable when frozen or run from the repo.
_BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
if os.path.isdir(_BACKEND):
    sys.path.insert(0, _BACKEND)

from src.launcher import main  # noqa: E402

if __name__ == "__main__":
    main()
