import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../../shared/ipc';
import { AppSettings } from '../../shared/types';
import { DeviceManager } from '../services/device-manager';
import { ConfigStore } from '../services/config-store';
import { isValidIpv4 } from '../services/wiz-protocol';

function assertString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string`);
  return value.trim();
}
function assertBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${name} must be a boolean`);
  return value;
}
function assertNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return value;
}
function optionalString(value: unknown, name: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${name} must be ${maxLength} characters or fewer`);
  return trimmed || undefined;
}

export function registerIpcHandlers(
  store: ConfigStore,
  deviceManager: DeviceManager,
  onSettingsChanged: (settings: AppSettings) => void,
  ui: { openSettings: () => void; closePopup: () => void },
) {
  ipcMain.handle(IPC.GET_SNAPSHOTS, () => deviceManager.getSnapshots());
  ipcMain.handle(IPC.GET_SETTINGS, () => store.getSettings());
  ipcMain.handle(IPC.SET_SETTINGS, (_evt, partial: Partial<AppSettings>) => {
    if (!partial || typeof partial !== 'object') throw new Error('Invalid settings');
    const next: Partial<AppSettings> = {};
    if (partial.startWithWindows !== undefined) next.startWithWindows = assertBoolean(partial.startWithWindows, 'startWithWindows');
    if (partial.minimizeToTray !== undefined) next.minimizeToTray = assertBoolean(partial.minimizeToTray, 'minimizeToTray');
    if (partial.theme !== undefined) {
      if (!['dark', 'light', 'system'].includes(partial.theme)) throw new Error('Invalid theme');
      next.theme = partial.theme;
    }
    if (partial.autoRefresh !== undefined) next.autoRefresh = assertBoolean(partial.autoRefresh, 'autoRefresh');
    if (partial.refreshIntervalMs !== undefined) next.refreshIntervalMs = Math.max(2000, Math.min(60000, Math.round(assertNumber(partial.refreshIntervalMs, 'refreshIntervalMs'))));
    if (partial.udpTimeoutMs !== undefined) next.udpTimeoutMs = Math.max(500, Math.min(15000, Math.round(assertNumber(partial.udpTimeoutMs, 'udpTimeoutMs'))));
    store.setSettings(next);
    const settings = store.getSettings();
    deviceManager.applySettings(settings);
    onSettingsChanged(settings);
    broadcast(IPC.SETTINGS_UPDATED, settings);
    return settings;
  });
  ipcMain.handle(IPC.RESET_SETTINGS, () => {
    store.resetSettings();
    const settings = store.getSettings();
    deviceManager.applySettings(settings);
    onSettingsChanged(settings);
    broadcast(IPC.SETTINGS_UPDATED, settings);
    return settings;
  });
  ipcMain.handle(IPC.DISCOVER, async (_evt, timeoutMs?: unknown) => {
    const t = timeoutMs === undefined ? undefined : Math.max(500, Math.min(15000, Math.round(assertNumber(timeoutMs, 'timeoutMs'))));
    return deviceManager.discover(t);
  });
  ipcMain.handle(IPC.ADD_DEVICE, (_evt, input: any) => {
    const name = assertString(input?.name, 'name');
    const ip = assertString(input?.ip, 'ip');
    if (!isValidIpv4(ip)) throw new Error('Invalid IPv4 address');
    if (name.length > 64) throw new Error('name must be 64 characters or fewer');
    return deviceManager.addOrUpdateDevice({
      name,
      ip,
      ...(input?.room !== undefined ? { room: optionalString(input.room, 'room', 40) } : {}),
      mac: optionalString(input?.mac, 'mac', 64),
    });
  });
  ipcMain.handle(IPC.UPDATE_DEVICE, (_evt, input: any) => {
    const id = assertString(input?.id, 'id');
    const name = assertString(input?.name, 'name');
    const ip = assertString(input?.ip, 'ip');
    if (!isValidIpv4(ip)) throw new Error('Invalid IPv4 address');
    if (name.length > 64) throw new Error('name must be 64 characters or fewer');
    return deviceManager.addOrUpdateDevice({
      id,
      name,
      ip,
      ...(input?.room !== undefined ? { room: optionalString(input.room, 'room', 40) } : {}),
      mac: optionalString(input?.mac, 'mac', 64),
    });
  });
  ipcMain.handle(IPC.REMOVE_DEVICE, (_evt, id: unknown) => { deviceManager.removeDevice(assertString(id, 'id')); });
  ipcMain.handle(IPC.REORDER_DEVICES, (_evt, ids: unknown) => {
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string' && Boolean(id.trim()))) throw new Error('ids must be an array of non-empty strings');
    deviceManager.reorderDevices(ids.map((id: string) => id.trim()));
  });
  ipcMain.handle(IPC.SELECT_DEVICE, (_evt, id: unknown) => { deviceManager.selectDevice(assertString(id, 'id')); });
  ipcMain.handle(IPC.TEST_DEVICE, async (_evt, ip: unknown) => deviceManager.testDevice(assertString(ip, 'ip')));
  ipcMain.handle(IPC.REFRESH_DEVICE, async (_evt, id: unknown) => deviceManager.refreshDevice(assertString(id, 'id')));
  ipcMain.handle(IPC.SET_POWER, async (_evt, payload: any) => { await deviceManager.setPower(assertString(payload?.id, 'id'), assertBoolean(payload?.on, 'on')); });
  ipcMain.handle(IPC.SET_BRIGHTNESS, async (_evt, payload: any) => { await deviceManager.setBrightness(assertString(payload?.id, 'id'), assertNumber(payload?.dimming, 'dimming')); });
  ipcMain.handle(IPC.SET_RGB, async (_evt, payload: any) => { await deviceManager.setRgb(assertString(payload?.id, 'id'), assertNumber(payload?.r, 'r'), assertNumber(payload?.g, 'g'), assertNumber(payload?.b, 'b')); });
  ipcMain.handle(IPC.SET_TEMP, async (_evt, payload: any) => { await deviceManager.setColorTemperature(assertString(payload?.id, 'id'), assertNumber(payload?.temp, 'temp')); });
  ipcMain.handle(IPC.OPEN_SETTINGS, async () => { ui.openSettings(); });
  ipcMain.handle(IPC.CLOSE_POPUP, async () => { ui.closePopup(); });

  deviceManager.on('updated', (snapshots) => { broadcast(IPC.SNAPSHOTS_UPDATED, snapshots); });
}

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}
