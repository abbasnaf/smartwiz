import { WizDeviceState } from '../../shared/types';

export const WIZ_PORT = 38899;

export interface WizResponse<T = unknown> {
  method?: string;
  env?: string;
  result?: T;
  error?: { code?: number; message?: string };
}

export interface SetPilotParams {
  state?: boolean;
  dimming?: number;
  temp?: number;
  r?: number;
  g?: number;
  b?: number;
  c?: number;
  w?: number;
  sceneId?: number;
  speed?: number;
}

export function buildGetPilotMessage(): Buffer {
  return Buffer.from(JSON.stringify({ method: 'getPilot', params: {} }), 'utf8');
}

export function buildSetPilotMessage(params: SetPilotParams): Buffer {
  return Buffer.from(JSON.stringify({ method: 'setPilot', params }), 'utf8');
}

export function buildGetSystemConfigMessage(): Buffer {
  return Buffer.from(JSON.stringify({ method: 'getSystemConfig', params: {} }), 'utf8');
}

export function buildRegistrationProbe(phoneMac: string, phoneIp: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      method: 'registration',
      params: { phoneMac, register: false, phoneIp },
    }),
    'utf8',
  );
}

export function parseWizResponse(raw: Buffer | string): WizResponse {
  const text = typeof raw === 'string' ? raw : raw.toString('utf8');
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid WiZ response: not an object');
  }
  return parsed as WizResponse;
}

export function extractPilotState(response: WizResponse): WizDeviceState | null {
  const result = response?.result;
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  const state: WizDeviceState = {
    state: Boolean(r.state),
  };
  if (typeof r.mac === 'string') state.mac = r.mac;
  if (typeof r.dimming === 'number') state.dimming = r.dimming;
  if (typeof r.temp === 'number') state.temp = r.temp;
  if (typeof r.r === 'number') state.r = r.r;
  if (typeof r.g === 'number') state.g = r.g;
  if (typeof r.b === 'number') state.b = r.b;
  if (typeof r.c === 'number') state.c = r.c;
  if (typeof r.w === 'number') state.w = r.w;
  if (typeof r.sceneId === 'number') state.sceneId = r.sceneId;
  if (typeof r.speed === 'number') state.speed = r.speed;
  if (typeof r.rssi === 'number') state.rssi = r.rssi;
  if (typeof r.source === 'string') state.source = r.source;
  return state;
}

export function clampBrightness(value: number): number {
  if (!Number.isFinite(value)) return 10;
  return Math.max(10, Math.min(100, Math.round(value)));
}

export function clampKelvin(value: number): number {
  if (!Number.isFinite(value)) return 3000;
  return Math.max(2200, Math.min(6500, Math.round(value)));
}

export function clampRgb(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function isValidIpv4(ip: string): boolean {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}
