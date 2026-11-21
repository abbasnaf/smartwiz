import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppSettings, DEFAULT_SETTINGS, DeviceConfig, SavedConfig } from '../../shared/types';
import { logError } from '../utils/logger';

export class ConfigStore {
  private filePath: string;
  private data: SavedConfig;

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(app.getPath('userData'), 'config.json');
    this.data = this.load();
  }

  private load(): SavedConfig {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<SavedConfig>;
        return {
          devices: Array.isArray(parsed.devices)
            ? parsed.devices.filter(isDeviceConfig).map((device) => ({
                ...device,
                room: typeof device.room === 'string' && device.room.trim() ? device.room.trim() : undefined,
              }))
            : [],
          selectedDeviceId: typeof parsed.selectedDeviceId === 'string' ? parsed.selectedDeviceId : undefined,
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        };
      }
    } catch (err) {
      logError('Failed to load config, using defaults', err);
    }
    return { devices: [], settings: { ...DEFAULT_SETTINGS } };
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      logError('Failed to save config', err);
    }
  }

  get(): SavedConfig {
    return structuredClone(this.data);
  }

  getSettings(): AppSettings {
    return { ...this.data.settings };
  }

  setSettings(settings: Partial<AppSettings>) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
  }

  getDevices(): DeviceConfig[] {
    return [...this.data.devices];
  }

  getSelectedDeviceId(): string | undefined {
    return this.data.selectedDeviceId;
  }

  setSelectedDeviceId(id: string | undefined) {
    this.data.selectedDeviceId = id;
    this.save();
  }

  upsertDevice(device: DeviceConfig) {
    const idx = this.data.devices.findIndex((d) => d.id === device.id);
    if (idx >= 0) this.data.devices[idx] = device;
    else this.data.devices.push(device);
    if (!this.data.selectedDeviceId) this.data.selectedDeviceId = device.id;
    this.save();
  }

  removeDevice(id: string) {
    this.data.devices = this.data.devices.filter((d) => d.id !== id);
    if (this.data.selectedDeviceId === id) this.data.selectedDeviceId = this.data.devices[0]?.id;
    this.save();
  }

  reorderDevices(ids: string[]) {
    const devicesById = new Map(this.data.devices.map((device) => [device.id, device]));
    if (ids.length !== this.data.devices.length || new Set(ids).size !== ids.length || ids.some((id) => !devicesById.has(id))) {
      throw new Error('Device order must contain every saved device exactly once');
    }
    this.data.devices = ids.map((id) => devicesById.get(id)!);
    this.save();
  }

  resetSettings() {
    this.data.settings = { ...DEFAULT_SETTINGS };
    this.save();
  }
}

function isDeviceConfig(value: unknown): value is DeviceConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.ip === 'string';
}
