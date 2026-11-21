import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import { AppSettings, DeviceConfig, DeviceSnapshot, DiscoveryResult, WizDeviceState } from '../shared/types';

const api = {
  getSnapshots: (): Promise<DeviceSnapshot[]> => ipcRenderer.invoke(IPC.GET_SNAPSHOTS),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.GET_SETTINGS),
  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke(IPC.SET_SETTINGS, settings),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.RESET_SETTINGS),
  discover: (timeoutMs?: number): Promise<DiscoveryResult[]> => ipcRenderer.invoke(IPC.DISCOVER, timeoutMs),
  addDevice: (input: { id?: string; name: string; ip: string; mac?: string; room?: string }): Promise<DeviceSnapshot> => ipcRenderer.invoke(IPC.ADD_DEVICE, input),
  updateDevice: (input: { id: string; name: string; ip: string; mac?: string; room?: string }): Promise<DeviceSnapshot> => ipcRenderer.invoke(IPC.UPDATE_DEVICE, input),
  removeDevice: (id: string): Promise<void> => ipcRenderer.invoke(IPC.REMOVE_DEVICE, id),
  reorderDevices: (ids: string[]): Promise<void> => ipcRenderer.invoke(IPC.REORDER_DEVICES, ids),
  selectDevice: (id: string): Promise<void> => ipcRenderer.invoke(IPC.SELECT_DEVICE, id),
  testDevice: (ip: string): Promise<{ ok: boolean; state?: WizDeviceState; error?: string; config?: Record<string, unknown> }> => ipcRenderer.invoke(IPC.TEST_DEVICE, ip),
  refreshDevice: (id: string): Promise<DeviceSnapshot | undefined> => ipcRenderer.invoke(IPC.REFRESH_DEVICE, id),
  setPower: (id: string, on: boolean): Promise<void> => ipcRenderer.invoke(IPC.SET_POWER, { id, on }),
  setBrightness: (id: string, dimming: number): Promise<void> => ipcRenderer.invoke(IPC.SET_BRIGHTNESS, { id, dimming }),
  setRgb: (id: string, r: number, g: number, b: number): Promise<void> => ipcRenderer.invoke(IPC.SET_RGB, { id, r, g, b }),
  setTemp: (id: string, temp: number): Promise<void> => ipcRenderer.invoke(IPC.SET_TEMP, { id, temp }),
  openSettings: (): Promise<void> => ipcRenderer.invoke(IPC.OPEN_SETTINGS),
  closePopup: (): Promise<void> => ipcRenderer.invoke(IPC.CLOSE_POPUP),
  onSnapshotsUpdated: (cb: (snapshots: DeviceSnapshot[]) => void) => {
    const handler = (_: unknown, snapshots: DeviceSnapshot[]) => cb(snapshots);
    ipcRenderer.on(IPC.SNAPSHOTS_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC.SNAPSHOTS_UPDATED, handler);
  },
  onSettingsUpdated: (cb: (settings: AppSettings) => void) => {
    const handler = (_: unknown, settings: AppSettings) => cb(settings);
    ipcRenderer.on(IPC.SETTINGS_UPDATED, handler);
    return () => ipcRenderer.removeListener(IPC.SETTINGS_UPDATED, handler);
  },
};

contextBridge.exposeInMainWorld('wiz', api);

export type WizApi = typeof api;
