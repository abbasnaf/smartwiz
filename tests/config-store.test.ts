import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
  },
}));

import { ConfigStore } from '../electron/services/config-store';

describe('ConfigStore', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiz-test-'));
    file = path.join(dir, 'config.json');
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('loads defaults when missing', () => {
    const store = new ConfigStore(file);
    expect(store.getSettings().refreshIntervalMs).toBe(5000);
    expect(store.getDevices()).toEqual([]);
  });

  it('persists devices and settings', () => {
    const store = new ConfigStore(file);
    store.upsertDevice({ id: '1', name: 'Lamp', ip: '192.168.1.10', room: 'Living room' });
    store.setSettings({ theme: 'light' });
    const store2 = new ConfigStore(file);
    expect(store2.getDevices()).toHaveLength(1);
    expect(store2.getDevices()[0].name).toBe('Lamp');
    expect(store2.getDevices()[0].room).toBe('Living room');
    expect(store2.getSettings().theme).toBe('light');
  });

  it('removes device and updates selection', () => {
    const store = new ConfigStore(file);
    store.upsertDevice({ id: '1', name: 'Lamp', ip: '192.168.1.10' });
    store.upsertDevice({ id: '2', name: 'Lamp2', ip: '192.168.1.11' });
    store.setSelectedDeviceId('1');
    store.removeDevice('1');
    expect(store.getDevices()).toHaveLength(1);
    expect(store.getSelectedDeviceId()).toBe('2');
  });

  it('reorders devices and rejects incomplete orders', () => {
    const store = new ConfigStore(file);
    store.upsertDevice({ id: '1', name: 'Lamp', ip: '192.168.1.10' });
    store.upsertDevice({ id: '2', name: 'Lamp 2', ip: '192.168.1.11' });

    store.reorderDevices(['2', '1']);
    expect(store.getDevices().map((device) => device.id)).toEqual(['2', '1']);
    expect(() => store.reorderDevices(['2', '2'])).toThrow('Device order must contain every saved device exactly once');
  });

  it('resets preferences without removing saved devices', () => {
    const store = new ConfigStore(file);
    store.upsertDevice({ id: '1', name: 'Lamp', ip: '192.168.1.10' });
    store.setSettings({ theme: 'light' });

    store.resetSettings();

    expect(store.getDevices()).toHaveLength(1);
    expect(store.getSettings().theme).toBe('dark');
  });
});
