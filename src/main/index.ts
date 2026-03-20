import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import fs from 'fs'

const store = new Store()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  const bounds = store.get('windowBounds', { width: 860, height: 560, x: undefined, y: undefined }) as {
    width: number
    height: number
    x?: number
    y?: number
  }

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 500,
    minHeight: 400,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    alwaysOnTop: store.get('alwaysOnTop', true) as boolean,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function saveBounds() {
  if (!mainWindow) return
  store.set('windowBounds', mainWindow.getBounds())
}

function createTray() {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  const menu = Menu.buildFromTemplate([
    { label: '显示', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
  tray.setToolTip('Desktop Notes')
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
    }
  })
}

// IPC: 读取便签
ipcMain.handle('note:read', () => {
  const notePath = join(app.getPath('userData'), 'note.md')
  if (!fs.existsSync(notePath)) return ''
  return fs.readFileSync(notePath, 'utf-8')
})

// IPC: 写入便签
ipcMain.handle('note:write', (_event, content: string) => {
  const notePath = join(app.getPath('userData'), 'note.md')
  fs.writeFileSync(notePath, content, 'utf-8')
})

// IPC: 置顶切换
ipcMain.handle('window:toggleAlwaysOnTop', () => {
  if (!mainWindow) return
  const current = mainWindow.isAlwaysOnTop()
  mainWindow.setAlwaysOnTop(!current)
  store.set('alwaysOnTop', !current)
  return !current
})

ipcMain.handle('window:isAlwaysOnTop', () => {
  return mainWindow?.isAlwaysOnTop() ?? true
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.desktop-notes')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()
  createTray()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
