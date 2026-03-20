import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import fs from 'fs'

type Mode = 'split' | 'edit' | 'preview'
type Theme = 'yellow' | 'gray' | 'mint' | 'blue'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let store: InstanceType<typeof Store>

function buildMenu(mode: Mode, theme: Theme) {
  const modeItems = (
    [
      { label: '分屏', value: 'split' },
      { label: '纯编辑', value: 'edit' },
      { label: '纯预览', value: 'preview' }
    ] as { label: string; value: Mode }[]
  ).map((item) => ({
    label: item.label,
    type: 'radio' as const,
    checked: mode === item.value,
    click: () => {
      store.set('mode', item.value)
      mainWindow?.webContents.send('mode:change', item.value)
      buildMenu(item.value, store.get('theme', 'yellow') as Theme)
    }
  }))

  const themeItems = (
    [
      { label: '暖黄', value: 'yellow' },
      { label: '冷灰', value: 'gray' },
      { label: '薄荷绿', value: 'mint' },
      { label: '天蓝', value: 'blue' }
    ] as { label: string; value: Theme }[]
  ).map((item) => ({
    label: item.label,
    type: 'radio' as const,
    checked: theme === item.value,
    click: () => {
      store.set('theme', item.value)
      mainWindow?.webContents.send('theme:change', item.value)
      buildMenu(store.get('mode', 'split') as Mode, item.value)
    }
  }))

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Desktop Notes',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: '显示模式', enabled: false },
        ...modeItems,
        { type: 'separator' },
        { label: '主题色', enabled: false },
        ...themeItems
      ]
    }
  ]))
}

function createWindow(): void {
  const bounds = store.get('windowBounds', { width: 860, height: 560 }) as {
    width: number; height: number; x?: number; y?: number
  }

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 300,
    minHeight: 300,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 8 },
    alwaysOnTop: is.dev ? false : store.get('alwaysOnTop', true) as boolean,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.webContents.send('init', {
      mode: store.get('mode', 'split'),
      theme: store.get('theme', 'yellow'),
      alwaysOnTop: mainWindow?.isAlwaysOnTop() ?? true
    })
    if (is.dev) mainWindow?.webContents.openDevTools({ mode: 'detach' })
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
  tray = new Tray(nativeImage.createEmpty())
  tray.setToolTip('Desktop Notes')
  tray.on('click', () => {
    mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show()
  })
}

function registerIpcHandlers() {
  ipcMain.handle('note:read', () => {
    const notePath = join(app.getPath('userData'), 'note.md')
    if (!fs.existsSync(notePath)) return ''
    return fs.readFileSync(notePath, 'utf-8')
  })

  ipcMain.handle('note:write', (_event, content: string) => {
    fs.writeFileSync(join(app.getPath('userData'), 'note.md'), content, 'utf-8')
  })

  ipcMain.handle('window:toggleAlwaysOnTop', () => {
    if (!mainWindow) return
    const next = !mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(next)
    store.set('alwaysOnTop', next)
    return next
  })

  ipcMain.handle('window:isAlwaysOnTop', () => mainWindow?.isAlwaysOnTop() ?? true)

  ipcMain.handle('settings:get', (_event, key: string) => store.get(key))

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    store.set(key, value)
  })

  ipcMain.handle('mode:set', (_event, newMode: Mode) => {
    store.set('mode', newMode)
    buildMenu(newMode, store.get('theme', 'yellow') as Theme)
  })

  ipcMain.handle('theme:set', (_event, newTheme: Theme) => {
    store.set('theme', newTheme)
    buildMenu(store.get('mode', 'split') as Mode, newTheme)
  })
}

app.whenReady().then(() => {
  store = new Store()
  electronApp.setAppUserModelId('com.desktop-notes')
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  registerIpcHandlers()
  buildMenu(store.get('mode', 'split') as Mode, store.get('theme', 'yellow') as Theme)
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
