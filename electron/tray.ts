import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { togglePopup, showSettings } from './windows';
import { ConfigStore } from './services/config-store';
import { logError } from './utils/logger';

let tray: Tray | null = null;

export function createTray(store: ConfigStore): Tray {
  const iconPath = resolveAsset('resources/icons/tray.png');
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) image = nativeImage.createEmpty();
  tray = new Tray(image);
  tray.setToolTip('WiZ Controller');
  rebuildTrayMenu(store);
  tray.on('click', () => { if (tray) togglePopup(tray); });
  return tray;
}

export function rebuildTrayMenu(store: ConfigStore) {
  if (!tray) return;
  const settings = store.getSettings();
  const menu = Menu.buildFromTemplate([
    { label: 'Open Quick Controls', click: () => { if (tray) togglePopup(tray); } },
    { label: 'Open Settings', click: () => showSettings() },
    { type: 'separator' },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: settings.startWithWindows,
      click: (item) => {
        try {
          store.setSettings({ startWithWindows: item.checked });
          applyStartupSetting(item.checked);
          rebuildTrayMenu(store);
        } catch (err) {
          logError('Failed to update startup setting', err);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

export function getTray() { return tray; }

export function applyStartupSetting(enabled: boolean) {
  if (process.platform !== 'win32') return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: ['--hidden'],
  });
}

export function resolveAsset(...segments: string[]): string {
  const candidates = [
    path.join(__dirname, '..', '..', ...segments),
    path.join(app.getAppPath(), ...segments),
    path.join(process.resourcesPath, ...segments),
    path.join(process.resourcesPath, 'app.asar.unpacked', ...segments),
  ];
  for (const p of candidates) {
    try { if (require('fs').existsSync(p)) return p; } catch { /* ignore */ }
  }
  return candidates[0];
}
