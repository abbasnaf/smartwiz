/// <reference types="vite/client" />

import { AppSettings, DeviceSnapshot, DiscoveryResult, WizDeviceState } from '../shared/types';

export interface WizApi {
  getSnapshots: () => Promise<DeviceSnapshot[]>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  resetSettings: () => Promise<AppSettings>;
  discover: (timeoutMs?: number) => Promise<DiscoveryResult[]>;
  addDevice: (input: { id?: string; name: string; ip: string; mac?: string; room?: string }) => Promise<DeviceSnapshot>;
  updateDevice: (input: { id: string; name: string; ip: string; mac?: string; room?: string }) => Promise<DeviceSnapshot>;
  removeDevice: (id: string) => Promise<void>;
  reorderDevices: (ids: string[]) => Promise<void>;
  selectDevice: (id: string) => Promise<void>;
  testDevice: (ip: string) => Promise<{ ok: boolean; state?: WizDeviceState; error?: string; config?: Record<string, unknown> }>;
  refreshDevice: (id: string) => Promise<DeviceSnapshot | undefined>;
  setPower: (id: string, on: boolean) => Promise<void>;
  setBrightness: (id: string, dimming: number) => Promise<void>;
  setRgb: (id: string, r: number, g: number, b: number) => Promise<void>;
  setTemp: (id: string, temp: number) => Promise<void>;
  openSettings: () => Promise<void>;
  closePopup: () => Promise<void>;
  onSnapshotsUpdated: (cb: (snapshots: DeviceSnapshot[]) => void) => () => void;
  onSettingsUpdated: (cb: (settings: AppSettings) => void) => () => void;
}

declare global {
  interface Window {
    wiz: WizApi;
  }
}
