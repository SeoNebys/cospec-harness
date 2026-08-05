import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { openDatabase } from './db/connection'
import { registerIpc } from './ipc'

// Boots the desktop app: opens the local database in the per-user data
// directory, wires up the operations the UI can call, and shows the window.
function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    title: 'Bookmarks',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const dataDir = app.getPath('userData')
  const db = openDatabase(join(dataDir, 'bookmarks.db'))
  registerIpc(db, dataDir)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
