# PyInstaller spec for the one-click Bookmark Manager launcher (FR-019).
# Build from the repo root after building the frontend into backend/src/static:
#     cd frontend && npm run build
#     pyinstaller packaging/bookmark-manager.spec
#
# Produces a single self-contained executable (dist/BookmarkManager[.exe]) that starts the
# local process and opens the browser. Build on each target OS (the binary is OS-specific).

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Bundle the built frontend at src/static (matches main.py's _MEIPASS lookup).
datas = [("backend/src/static", "src/static")]
datas += collect_data_files("bleach")

# uvicorn/anyio and the ASGI stack import several modules dynamically; name them so the
# frozen binary includes them.
hiddenimports = (
    collect_submodules("uvicorn")
    + collect_submodules("anyio")
    + [
        "h11",
        "click",
        "sqlmodel",
        "sqlalchemy.sql.default_comparator",
        "sqlalchemy.dialects.sqlite",
    ]
)

a = Analysis(
    ["packaging/run_app.py"],
    pathex=["backend"],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name="BookmarkManager",
    console=False,  # no terminal window — this is a desktop app
    icon=None,  # to brand it, set to "packaging/icon.ico" and drop an .ico there
)
