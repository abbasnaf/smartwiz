import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { AppSettings, DeviceConfig, DeviceSnapshot, DiscoveryResult, WizDeviceState } from '../../shared/types';
import { ConfigStore } from './config-store';
import { WizClient } from './wiz-client';
import { clampBrightness, clampKelvin, clampRgb, isValidIpv4 } from './wiz-protocol';
import { logError, logInfo, logWarn } from '../utils/logger';

export interface DeviceManagerEvents {
  updated: [DeviceSnapshot[]];
}

export class DeviceManager extends EventEmitter {
  private snapshots = new Map<string, DeviceSnapshot>();
  private refreshTimer: NodeJS.Timeout | null = null;
  private commandQueues = new Map<string, Promise<void>>();

  constructor(private store: ConfigStore, private client: WizClient) {
    super();
    this.client.setDefaultTimeout(store.getSettings().udpTimeoutMs);
    for (const device of store.getDevices()) {
      this.snapshots.set(device.id, {
        config: device,
        state: null,
        status: 'disconnected',
      });
    }
  }

  getSnapshots(): DeviceSnapshot[] {
    const devices = this.store.getDevices();
    return devices.map((d) => this.snapshots.get(d.id) || { config: d, state: null, status: 'disconnected' });
  }

  getSelectedSnapshot(): DeviceSnapshot | undefined {
    const id = this.store.getSelectedDeviceId();
    if (!id) return this.getSnapshots()[0];
    return this.snapshots.get(id) || this.getSnapshots()[0];
  }

  private emitUpdated() {
    this.emit('updated', this.getSnapshots());
  }

  private updateSnapshot(id: string, patch: Partial<DeviceSnapshot>) {
    const current = this.snapshots.get(id);
    if (!current) return;
    this.snapshots.set(id, { ...current, ...patch, config: { ...current.config, ...(patch.config || {}) } });
    this.emitUpdated();
  }

  applySettings(settings: AppSettings) {
    this.client.setDefaultTimeout(settings.udpTimeoutMs);
    this.restartPolling(settings);
  }

  start() {
    this.restartPolling(this.store.getSettings());
    void this.refreshAll();
  }

  stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  restartPolling(settings = this.store.getSettings()) {
    this.stop();
    if (settings.autoRefresh) {
      this.refreshTimer = setInterval(() => {
        void this.refreshAll();
      }, Math.max(2000, settings.refreshIntervalMs));
    }
  }

  async refreshAll(): Promise<void> {
    const devices = this.store.getDevices();
    await Promise.all(devices.map((d) => this.refreshDevice(d.id)));
  }

  async refreshDevice(id: string): Promise<DeviceSnapshot | undefined> {
    const snap = this.snapshots.get(id);
    if (!snap) return undefined;
    this.updateSnapshot(id, { status: snap.state ? snap.status : 'connecting', error: undefined });
    try {
      const state = await this.client.getPilot(snap.config.ip, { retries: 1 });
      const config = { ...snap.config, mac: state.mac || snap.config.mac, lastSeenAt: new Date().toISOString() };
      this.store.upsertDevice(config);
      this.updateSnapshot(id, { config, state, status: 'connected', lastUpdatedAt: new Date().toISOString(), error: undefined, pendingCommand: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.updateSnapshot(id, { status: 'disconnected', error: message, pendingCommand: false });
    }
    return this.snapshots.get(id);
  }

  async discover(timeoutMs?: number): Promise<DiscoveryResult[]> {
    const results = await this.client.discover(timeoutMs);
    logInfo(`Discovery found ${results.length} device(s)`);
    return results;
  }

  addOrUpdateDevice(input: { id?: string; name: string; ip: string; mac?: string; room?: string }): DeviceSnapshot {
    const ip = input.ip.trim();
    if (!isValidIpv4(ip)) throw new Error('Invalid IPv4 address');
    if (this.store.getDevices().some((device) => device.id !== input.id && device.ip === ip)) {
      throw new Error('A device with this IP address is already saved');
    }
    const name = input.name.trim() || `WiZ Bulb ${ip}`;
    const id = input.id || randomUUID();
    const existing = this.snapshots.get(id);
    const room = Object.prototype.hasOwnProperty.call(input, 'room')
      ? input.room?.trim() || undefined
      : existing?.config.room;
    const preservedMac = existing?.config.ip === ip ? existing.config.mac : undefined;
    const config: DeviceConfig = { id, name, ip, mac: input.mac ?? preservedMac, room };
    this.store.upsertDevice(config);
    this.snapshots.set(id, { config, state: existing?.state ?? null, status: 'disconnected' });
    if (!this.store.getSelectedDeviceId()) this.store.setSelectedDeviceId(id);
    this.emitUpdated();
    void this.refreshDevice(id);
    return this.snapshots.get(id)!;
  }

  selectDevice(id: string) {
    if (!this.snapshots.has(id)) throw new Error('Device not found');
    this.store.setSelectedDeviceId(id);
    this.emitUpdated();
    void this.refreshDevice(id);
  }

  removeDevice(id: string) {
    this.store.removeDevice(id);
    this.snapshots.delete(id);
    this.emitUpdated();
  }

  reorderDevices(ids: string[]) {
    this.store.reorderDevices(ids);
    this.emitUpdated();
  }

  async testDevice(ip: string): Promise<{ ok: boolean; state?: WizDeviceState; error?: string; config?: Record<string, unknown> }> {
    if (!isValidIpv4(ip.trim())) return { ok: false, error: 'Invalid IPv4 address' };
    return this.client.testConnection(ip.trim());
  }

  private enqueue<T>(deviceId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.commandQueues.get(deviceId) || Promise.resolve();
    const next = prev.then(fn, fn);
    this.commandQueues.set(deviceId, next.then(() => undefined, () => undefined));
    return next;
  }

  async setPower(deviceId: string, on: boolean): Promise<void> {
    return this.enqueue(deviceId, async () => {
      const snap = this.requireSnapshot(deviceId);
      this.updateSnapshot(deviceId, { pendingCommand: true, error: undefined });
      try {
        await this.client.setPilot(snap.config.ip, { state: on });
        const confirmed = await this.client.getPilot(snap.config.ip, { retries: 1 });
        this.updateSnapshot(deviceId, { state: confirmed, status: 'connected', pendingCommand: false, lastUpdatedAt: new Date().toISOString(), error: undefined });
      } catch (err) {
        this.handleCommandError(deviceId, err);
        throw err;
      }
    });
  }

  async setBrightness(deviceId: string, dimming: number): Promise<void> {
    return this.enqueue(deviceId, async () => {
      const snap = this.requireSnapshot(deviceId);
      this.updateSnapshot(deviceId, { pendingCommand: true, error: undefined });
      try {
        const value = clampBrightness(dimming);
        await this.client.setPilot(snap.config.ip, { dimming: value });
        const confirmed = await this.client.getPilot(snap.config.ip, { retries: 0 }).catch(() => null);
        this.updateSnapshot(deviceId, {
          state: confirmed || { ...(snap.state || { state: true }), dimming: value },
          status: confirmed ? 'connected' : snap.status,
          pendingCommand: false,
          lastUpdatedAt: new Date().toISOString(),
          error: confirmed ? undefined : 'Brightness command sent; state confirmation failed',
        });
      } catch (err) {
        this.handleCommandError(deviceId, err);
        throw err;
      }
    });
  }

  async setRgb(deviceId: string, r: number, g: number, b: number): Promise<void> {
    return this.enqueue(deviceId, async () => {
      const snap = this.requireSnapshot(deviceId);
      this.updateSnapshot(deviceId, { pendingCommand: true, error: undefined });
      try {
        const params = { r: clampRgb(r), g: clampRgb(g), b: clampRgb(b) };
        await this.client.setPilot(snap.config.ip, params);
        const confirmed = await this.client.getPilot(snap.config.ip, { retries: 0 }).catch(() => null);
        this.updateSnapshot(deviceId, {
          state: confirmed || { ...(snap.state || { state: true }), ...params },
          status: confirmed ? 'connected' : snap.status,
          pendingCommand: false,
          lastUpdatedAt: new Date().toISOString(),
          error: confirmed ? undefined : 'Color command sent; state confirmation failed',
        });
      } catch (err) {
        this.handleCommandError(deviceId, err);
        throw err;
      }
    });
  }

  async setColorTemperature(deviceId: string, temp: number): Promise<void> {
    return this.enqueue(deviceId, async () => {
      const snap = this.requireSnapshot(deviceId);
      this.updateSnapshot(deviceId, { pendingCommand: true, error: undefined });
      try {
        const value = clampKelvin(temp);
        await this.client.setPilot(snap.config.ip, { temp: value });
        const confirmed = await this.client.getPilot(snap.config.ip, { retries: 0 }).catch(() => null);
        this.updateSnapshot(deviceId, {
          state: confirmed || { ...(snap.state || { state: true }), temp: value },
          status: confirmed ? 'connected' : snap.status,
          pendingCommand: false,
          lastUpdatedAt: new Date().toISOString(),
          error: confirmed ? undefined : 'Temperature command sent; state confirmation failed',
        });
      } catch (err) {
        this.handleCommandError(deviceId, err);
        throw err;
      }
    });
  }

  private requireSnapshot(deviceId: string): DeviceSnapshot {
    const snap = this.snapshots.get(deviceId);
    if (!snap) throw new Error('Device not found');
    return snap;
  }

  private handleCommandError(deviceId: string, err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logError(`Device command failed for ${deviceId}`, err);
    this.updateSnapshot(deviceId, { status: 'error', pendingCommand: false, error: message });
  }
}
