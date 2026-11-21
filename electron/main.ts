import { app, BrowserWindow } from 'electron';
import path from 'path';
import { ConfigStore } from './services/config-store';
import { WizClient } from './services/wiz-client';
import { DeviceManager } from './services/device-manager';
import { registerIpcHandlers } from './ipc/handlers';
import { createTray, applyStartupSetting, rebuildTrayMenu, getTray } from './tray';
import { createPopupWindow, showSettings, getPopupWindow, togglePopup } from './windows';
import { logError, logInfo } from './utils/logger';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  (app as any).isQuitting = false;
  app.setAppUserModelId('com.smartwiz.wiz-controller');

  const store = new ConfigStore();
  const client = new WizClient(store.getSettings().udpTimeoutMs);
  const deviceManager = new DeviceManager(store, client);

  app.on('second-instance', () => {
    const tray = getTray();
    if (tray) togglePopup(tray);
    else showSettings();
  });

  app.whenReady().then(() => {
    try {
      logInfo('App starting');
      applyStartupSetting(store.getSettings().startWithWindows);
      registerIpcHandlers(store, deviceManager, () => rebuildTrayMenu(store), {
        openSettings: () => showSettings(),
        closePopup: () => { const w = getPopupWindow(); if (w && !w.isDestroyed()) w.hide(); },
      });
      createTray(store);
      // Create popup hidden so it's ready
      createPopupWindow();
      deviceManager.start();

      const startedHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;
      if (!startedHidden && !store.getDevices().length) {
        // First run: show settings to help user configure device
        showSettings();
      }
    } catch (err) {
      logError('Failed during app startup', err);
    }
  });

  app.on('window-all-closed', () => {
    // Keep running in tray
  });

  app.on('before-quit', () => {
    (app as any).isQuitting = true;
    deviceManager.stop();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createPopupWindow();
  });
}
