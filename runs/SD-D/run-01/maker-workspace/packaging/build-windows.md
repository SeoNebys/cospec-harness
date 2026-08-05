# Get a double-clickable Bookmark Manager icon on Windows

Follow these once on your Windows PC. The result is `BookmarkManager.exe` plus a Desktop
and Start-menu shortcut. After that, launching is a double-click — the app opens in your
browser, no terminal ever again.

## One-time prerequisites (to *build* the icon)

Install these once (needed only to produce the .exe, not to run it afterwards):

1. **Python 3.11+** — https://www.python.org/downloads/windows/
   During install, tick **"Add python.exe to PATH"**.
2. **Node.js 20+** — https://nodejs.org/ (the LTS installer).

## Build it (copy-paste into PowerShell, from the project folder)

```powershell
# From the repo root (the folder containing backend\ and frontend\):

# 1. Build the web UI into the backend
cd frontend
npm install
npm run build
cd ..

# 2. Set up Python and build the single .exe
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .\backend
pip install pyinstaller
pyinstaller packaging\bookmark-manager.spec

# Result: dist\BookmarkManager.exe
```

Or just run the bundled helper, which does all of the above:

```powershell
packaging\build-windows.bat
```

## Make the double-click icon

```powershell
# Creates Desktop + Start-menu shortcuts pointing at dist\BookmarkManager.exe
powershell -ExecutionPolicy Bypass -File packaging\create-shortcut.ps1
```

Now double-click **Bookmark Manager** on your Desktop (or find it in the Start menu). Your
browser opens with the app ready. That's it — everyday use is just that double-click.

## Optional: a nicer icon

Drop an icon file named `icon.ico` into the `packaging\` folder, change `icon=None` to
`icon="packaging/icon.ico"` in `packaging\bookmark-manager.spec`, and rebuild.

## Notes

- **Windows SmartScreen** may warn the first time because the .exe isn't code-signed
  (signing needs a paid certificate, out of scope here). Click **More info → Run anyway**;
  it only asks once.
- Your bookmarks live in `C:\Users\<you>\.bookmark-manager\bookmarks.db` — copy that file
  any time to back up, or use **Export to a file** inside the app.
- To move the app, keep `BookmarkManager.exe` somewhere stable (the shortcut script copies
  it to your local app-data by default) and re-run the shortcut script if you relocate it.
