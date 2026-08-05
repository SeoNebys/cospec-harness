@echo off
REM One-shot Windows build for the Bookmark Manager desktop icon (FR-019).
REM Run from the repo root:  packaging\build-windows.bat
setlocal

echo === Building web UI ===
pushd frontend || goto :error
call npm install || goto :error
call npm run build || goto :error
popd

echo === Setting up Python environment ===
py -m venv .venv || goto :error
call .venv\Scripts\activate.bat || goto :error
pip install -e .\backend || goto :error
pip install pyinstaller || goto :error

echo === Bundling BookmarkManager.exe ===
pyinstaller packaging\bookmark-manager.spec || goto :error

echo.
echo Done. Your executable is at: dist\BookmarkManager.exe
echo Next, create the double-click shortcut:
echo     powershell -ExecutionPolicy Bypass -File packaging\create-shortcut.ps1
goto :eof

:error
echo.
echo Build failed. See the messages above.
exit /b 1
