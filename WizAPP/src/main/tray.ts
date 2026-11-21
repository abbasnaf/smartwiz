import { ICON } from '@constants'
import BulbManager from '@main/bulbManager'
import { togglePopup, hidePopup } from '@main/popup'
import { BrowserWindow, Menu, Tray, app } from 'electron'
import log from 'electron-log'

let tray: Tray | null = null
let clickTimer: NodeJS.Timeout | null = null

export function createTray(mainWindow: BrowserWindow, bulbHelper: BulbManager): Tray {
  tray = new Tray(ICON)
  tray.setToolTip('WiZ APP')

  const openMainWindow = () => {
    hidePopup()
    if (mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }

  const rebuildMenu = () => {
    if (!tray) return
    const settings = bulbHelper.getSettings()
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open WiZAPP', click: openMainWindow },
      { label: 'Quick Controls', click: () => { if (tray) togglePopup(tray) } },
      { label: 'Settings', click: () => { openMainWindow(); mainWindow.webContents.send('navigate-to', '/settings') } },
      { type: 'separator' },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: !!settings.startWithWindows,
        click: (item) => {
          bulbHelper.setSettings({ startWithWindows: item.checked })
          rebuildMenu()
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          ;(app as any).isQuitting = true
          app.quit()
        }
      }
    ])
    tray.setContextMenu(contextMenu)
  }

  rebuildMenu()

  tray.on('click', () => {
    if (clickTimer) clearTimeout(clickTimer)
    clickTimer = setTimeout(() => {
      log.info('Tray single click - toggling quick controls')
      if (tray) togglePopup(tray)
      clickTimer = null
    }, 250)
  })

  tray.on('double-click', () => {
    if (clickTimer) {
      clearTimeout(clickTimer)
      clickTimer = null
    }
    log.info('Tray double click - opening main window')
    openMainWindow()
  })

  // Expose rebuild for settings changes
  ;(tray as any).__rebuildMenu = rebuildMenu
  return tray
}

export function rebuildTrayMenu() {
  if (tray && (tray as any).__rebuildMenu) (tray as any).__rebuildMenu()
}

export function getTray() { return tray }
