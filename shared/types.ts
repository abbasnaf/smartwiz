export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface WizDeviceState {
  mac?: string;
  state: boolean;
  dimming?: number; // 10-100
  temp?: number; // Kelvin
  r?: number;
  g?: number;
  b?: number;
  c?: number;
  w?: number;
  sceneId?: number;
  speed?: number;
  rssi?: number;
  source?: string;
}

export interface DeviceConfig {
  id: string;
  name: string;
  ip: string;
  mac?: string;
  room?: string;
  lastSeenAt?: string;
}

export interface DeviceSnapshot {
  config: DeviceConfig;
  state: WizDeviceState | null;
  status: ConnectionStatus;
  lastUpdatedAt?: string;
  error?: string;
  pendingCommand?: boolean;
}

export interface DiscoveryResult {
  ip: string;
  mac?: string;
  name?: string;
  state?: WizDeviceState;
}

export interface AppSettings {
  startWithWindows: boolean;
  minimizeToTray: boolean;
  theme: 'dark' | 'light' | 'system';
  autoRefresh: boolean;
  refreshIntervalMs: number;
  udpTimeoutMs: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  startWithWindows: false,
  minimizeToTray: true,
  theme: 'dark',
  autoRefresh: true,
  refreshIntervalMs: 5000,
  udpTimeoutMs: 3000,
};

export interface SavedConfig {
  devices: DeviceConfig[];
  selectedDeviceId?: string;
  settings: AppSettings;
}
