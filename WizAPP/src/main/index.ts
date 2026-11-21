import { HIDE_MENU, ICON, MIN_HEIGHT, MIN_WIDTH, SANDBOX } from '@constants'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import checkForUpdates from '@main/autoUpdater'
import BulbManager from '@main/bulbManager'
import registerIPCEvents from '@main/ipcEvents'
import initializeLanguage from '@main/localization'
import initializeLogger from '@main/logger'
import { createPopupWindow, hidePopup } from '@main/popup'
import { createTray } from '@main/tray'
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron'
import log from 'electron-log'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null
let bulbHelper: BulbManager | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    height: MIN_HEIGHT,
    width: MIN_WIDTH,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    icon: ICON,
    show: false,
    backgroundColor: '#1e1e1e',
    title: 'WiZ APP',
    autoHideMenuBar: HIDE_MENU,
    ...(process.platform === 'linux' ? { icon: ICON } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      devTools: !app.isPackaged,
      sandbox: SANDBOX
    }
  })

  ipcMain.on('show-window', () => mainWindow?.show())
  ipcMain.on('open-main-window', () => {
    hidePopup()
    if (!mainWindow || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
  ipcMain.on('hide-popup', () => hidePopup())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', (e) => {
    const isQuitting = (app as any).isQuitting
    if (!isQuitting) {
      e.preventDefault()
      log.info('Hiding main window to tray...')
      mainWindow?.hide()
      return
    }
    log.info('Closing app...')
  })

  mainWindow.on('minimize', () => {
    log.info('Minimized window - hiding to tray...')
    mainWindow?.hide()
  })

  return mainWindow
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    hidePopup()
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    checkForUpdates()
    electronApp.setAppUserModelId('com.wiz-app')
    app.setName('Wiz App')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    initializeLogger()
    initializeLanguage(app)

    const win = createWindow()

    if (HIDE_MENU && process.platform !== 'darwin') {
      Menu.setApplicationMenu(null)
    }

    const bh = new BulbManager(win)
    bulbHelper = bh
    registerIPCEvents(bh)

    win.once('ready-to-show', () => {
      createTray(win, bh)
      createPopupWindow()
      bh.applyStartupSetting(bh.getSettings().startWithWindows)
      const startedHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden
      if (!startedHidden) {
        win.show()
      }
    })

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('before-quit', () => {
  ;(app as any).isQuitting = true
  bulbHelper?.endConnection()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!(app as any).isQuitting) return
    app.quit()
  }
})
