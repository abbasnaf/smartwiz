import path from 'path';
import { BrowserWindow, screen, Tray, app, nativeTheme } from 'electron';
import { logError } from './utils/logger';

export interface WindowRefs {
  popup: BrowserWindow | null;
  settings: BrowserWindow | null;
}

const refs: WindowRefs = { popup: null, settings: null };

function getRendererUrl(hash: string): string {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) return `${devUrl}#${hash}`;
  return path.join(__dirname, '../../dist-renderer/index.html');
}

async function loadWindow(win: BrowserWindow, hash: string) {
  const target = getRendererUrl(hash);
  if (target.startsWith('http')) {
    await win.loadURL(target);
  } else {
    await win.loadFile(target, { hash });
  }
}

export function getPopupWindow() { return refs.popup; }
export function getSettingsWindow() { return refs.settings; }

export function createPopupWindow(): BrowserWindow {
  if (refs.popup && !refs.popup.isDestroyed()) return refs.popup;
  const win = new BrowserWindow({
    width: 360,
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
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on('blur', () => {
    if (!win.isDestroyed() && win.isVisible()) {
      // Delay slightly so tray click can toggle without immediate reopen race
      setTimeout(() => {
        if (!win.isDestroyed() && win.isVisible() && !win.webContents.isDevToolsOpened()) win.hide();
      }, 120);
    }
  });
  win.on('closed', () => { refs.popup = null; });
  void loadWindow(win, '/popup').catch((err) => logError('Failed to load popup', err));
  refs.popup = win;
  return win;
}

export function createSettingsWindow(): BrowserWindow {
  if (refs.settings && !refs.settings.isDestroyed()) {
    refs.settings.show();
    refs.settings.focus();
    return refs.settings;
  }
  const win = new BrowserWindow({
    width: 920,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    show: false,
    frame: true,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.on('ready-to-show', () => win.show());
  win.on('closed', () => { refs.settings = null; });
  void loadWindow(win, '/settings').catch((err) => logError('Failed to load settings', err));
  refs.settings = win;
  return win;
}

export function positionPopupNearTray(win: BrowserWindow, tray: Tray) {
  const trayBounds = tray.getBounds();
  const winBounds = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: Math.round(trayBounds.x + trayBounds.width / 2), y: Math.round(trayBounds.y + trayBounds.height / 2) });
  const wa = display.workArea;
  const margin = 8;

  let x: number;
  let y: number;

  const trayCenterX = Math.round(trayBounds.x + trayBounds.width / 2);
  const trayCenterY = Math.round(trayBounds.y + trayBounds.height / 2);

  // Determine taskbar position by comparing workArea to display bounds
  const db = display.bounds;
  const taskbarBottom = wa.y + wa.height < db.y + db.height;
  const taskbarTop = wa.y > db.y;
  const taskbarLeft = wa.x > db.x;
  const taskbarRight = wa.x + wa.width < db.x + db.width;

  if (taskbarBottom || (!taskbarTop && !taskbarLeft && !taskbarRight)) {
    x = Math.round(trayCenterX - winBounds.width / 2);
    y = Math.round(trayBounds.y - winBounds.height - margin);
  } else if (taskbarTop) {
    x = Math.round(trayCenterX - winBounds.width / 2);
    y = Math.round(trayBounds.y + trayBounds.height + margin);
  } else if (taskbarLeft) {
    x = Math.round(trayBounds.x + trayBounds.width + margin);
    y = Math.round(trayCenterY - winBounds.height / 2);
  } else { // taskbarRight
    x = Math.round(trayBounds.x - winBounds.width - margin);
    y = Math.round(trayCenterY - winBounds.height / 2);
  }

  x = Math.max(wa.x + margin, Math.min(x, wa.x + wa.width - winBounds.width - margin));
  y = Math.max(wa.y + margin, Math.min(y, wa.y + wa.height - winBounds.height - margin));

  win.setPosition(x, y, false);
}

export function togglePopup(tray: Tray) {
  const win = createPopupWindow();
  if (win.isVisible()) {
    win.hide();
    return;
  }
  positionPopupNearTray(win, tray);
  win.show();
  win.focus();
}

export function showSettings() {
  createSettingsWindow();
}
