import { BrowserWindow, screen, Tray } from 'electron'
import { is } from '@electron-toolkit/utils'
import { join } from 'path'
import { ICON, SANDBOX } from '@constants'

let popupWindow: BrowserWindow | null = null

export function createPopupWindow(): BrowserWindow {
  if (popupWindow && !popupWindow.isDestroyed()) return popupWindow

  popupWindow = new BrowserWindow({
    width: 380,
    height: 560,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    icon: ICON,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: SANDBOX
    }
  })

  popupWindow.on('blur', () => {
    if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) {
      setTimeout(() => {
        if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) popupWindow.hide()
      }, 150)
    }
  })

  popupWindow.on('closed', () => {
    popupWindow = null
  })

  loadPopupRoute(popupWindow)
  return popupWindow
}

function loadPopupRoute(win: BrowserWindow) {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/popup`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/popup' })
  }
}

export function getPopupWindow() {
  return popupWindow
}

export function positionPopupNearTray(win: BrowserWindow, tray: Tray) {
  const trayBounds = tray.getBounds()
  const winBounds = win.getBounds()
  const display = screen.getDisplayNearestPoint({
    x: Math.round(trayBounds.x + trayBounds.width / 2),
    y: Math.round(trayBounds.y + trayBounds.height / 2)
  })
  const wa = display.workArea
  const margin = 8
  const trayCenterX = Math.round(trayBounds.x + trayBounds.width / 2)
  const trayCenterY = Math.round(trayBounds.y + trayBounds.height / 2)
  const db = display.bounds
  const taskbarBottom = wa.y + wa.height < db.y + db.height
  const taskbarTop = wa.y > db.y
  const taskbarLeft = wa.x > db.x
  const taskbarRight = wa.x + wa.width < db.x + db.width

  let x: number
  let y: number
  if (taskbarBottom || (!taskbarTop && !taskbarLeft && !taskbarRight)) {
    x = Math.round(trayCenterX - winBounds.width / 2)
    y = Math.round(trayBounds.y - winBounds.height - margin)
  } else if (taskbarTop) {
    x = Math.round(trayCenterX - winBounds.width / 2)
    y = Math.round(trayBounds.y + trayBounds.height + margin)
  } else if (taskbarLeft) {
    x = Math.round(trayBounds.x + trayBounds.width + margin)
    y = Math.round(trayCenterY - winBounds.height / 2)
  } else {
    x = Math.round(trayBounds.x - winBounds.width - margin)
    y = Math.round(trayCenterY - winBounds.height / 2)
  }

  x = Math.max(wa.x + margin, Math.min(x, wa.x + wa.width - winBounds.width - margin))
  y = Math.max(wa.y + margin, Math.min(y, wa.y + wa.height - winBounds.height - margin))
  win.setPosition(x, y, false)
}

export function togglePopup(tray: Tray) {
  const win = createPopupWindow()
  if (win.isVisible()) {
    win.hide()
    return
  }
  positionPopupNearTray(win, tray)
  win.show()
  win.focus()
}

export function hidePopup() {
  if (popupWindow && !popupWindow.isDestroyed()) popupWindow.hide()
}
