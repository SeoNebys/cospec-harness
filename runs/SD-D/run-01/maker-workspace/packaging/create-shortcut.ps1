# Creates Desktop + Start-menu shortcuts for BookmarkManager.exe (FR-019, one-time install).
# Usage (from repo root):
#     powershell -ExecutionPolicy Bypass -File packaging\create-shortcut.ps1

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$builtExe = Join-Path $repoRoot "dist\BookmarkManager.exe"
if (-not (Test-Path $builtExe)) {
    Write-Error "BookmarkManager.exe not found. Build it first (see packaging\build-windows.md)."
}

# Install the exe to a stable location under the user's local app data.
$installDir = Join-Path $env:LOCALAPPDATA "BookmarkManager"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
$targetExe = Join-Path $installDir "BookmarkManager.exe"
Copy-Item $builtExe $targetExe -Force

$WshShell = New-Object -ComObject WScript.Shell

function New-Shortcut($linkPath) {
    $shortcut = $WshShell.CreateShortcut($linkPath)
    $shortcut.TargetPath = $targetExe
    $shortcut.WorkingDirectory = $installDir
    $shortcut.Description = "Bookmark Manager"
    $shortcut.Save()
}

# Desktop shortcut
$desktop = [Environment]::GetFolderPath("Desktop")
New-Shortcut (Join-Path $desktop "Bookmark Manager.lnk")

# Start-menu shortcut
$startMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
New-Shortcut (Join-Path $startMenu "Bookmark Manager.lnk")

Write-Host "Installed to $targetExe"
Write-Host "Shortcuts created on your Desktop and in the Start menu. Double-click 'Bookmark Manager' to launch."
