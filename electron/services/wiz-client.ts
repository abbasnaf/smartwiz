import dgram from 'dgram';
import { networkInterfaces } from 'os';
import { DiscoveryResult, WizDeviceState } from '../../shared/types';
import {
  WIZ_PORT,
  buildGetPilotMessage,
  buildGetSystemConfigMessage,
  buildRegistrationProbe,
  buildSetPilotMessage,
  extractPilotState,
  parseWizResponse,
  SetPilotParams,
  WizResponse,
} from './wiz-protocol';
import { logError, logInfo, logWarn } from '../utils/logger';

export interface SendOptions {
  timeoutMs?: number;
  retries?: number;
}

export class WizClient {
  private defaultTimeoutMs: number;

  constructor(defaultTimeoutMs = 3000) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  setDefaultTimeout(ms: number) {
    this.defaultTimeoutMs = Math.max(500, ms);
  }

  async sendRequest(ip: string, message: Buffer, options: SendOptions = {}): Promise<WizResponse> {
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const retries = Math.max(0, options.retries ?? 0);
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.sendOnce(ip, message, timeoutMs);
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          logWarn(`WiZ request retry ${attempt + 1}/${retries} for ${ip}: ${String(err)}`);
          await delay(150 * (attempt + 1));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private sendOnce(ip: string, message: Buffer, timeoutMs: number): Promise<WizResponse> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      let settled = false;
      const timer = setTimeout(() => {
        finish(new Error(`UDP timeout after ${timeoutMs}ms for ${ip}`));
      }, timeoutMs);

      const finish = (err?: Error, response?: WizResponse) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.removeAllListeners();
        try { socket.close(); } catch { /* ignore */ }
        if (err) reject(err);
        else resolve(response as WizResponse);
      };

      socket.on('error', (err) => finish(err));
      socket.on('message', (msg) => {
        try {
          const parsed = parseWizResponse(msg);
          finish(undefined, parsed);
        } catch (err) {
          finish(err instanceof Error ? err : new Error('Invalid WiZ response'));
        }
      });

      socket.bind(0, undefined, () => {
        socket.send(message, WIZ_PORT, ip, (err) => {
          if (err) finish(err);
        });
      });
    });
  }

  async getPilot(ip: string, options: SendOptions = {}): Promise<WizDeviceState> {
    const response = await this.sendRequest(ip, buildGetPilotMessage(), { retries: 1, ...options });
    if (response.error) {
      throw new Error(response.error.message || `WiZ error ${response.error.code ?? 'unknown'}`);
    }
    const state = extractPilotState(response);
    if (!state) throw new Error('Missing pilot state in WiZ response');
    return state;
  }

  async setPilot(ip: string, params: SetPilotParams, options: SendOptions = {}): Promise<WizDeviceState | null> {
    const response = await this.sendRequest(ip, buildSetPilotMessage(params), { retries: 0, ...options });
    if (response.error) {
      throw new Error(response.error.message || `WiZ error ${response.error.code ?? 'unknown'}`);
    }
    // Some bulbs return success without full state; caller may refresh.
    return extractPilotState(response);
  }

  async getSystemConfig(ip: string, options: SendOptions = {}): Promise<Record<string, unknown>> {
    const response = await this.sendRequest(ip, buildGetSystemConfigMessage(), { retries: 1, ...options });
    if (response.error) {
      throw new Error(response.error.message || `WiZ error ${response.error.code ?? 'unknown'}`);
    }
    return (response.result as Record<string, unknown>) || {};
  }

  async testConnection(ip: string, options: SendOptions = {}): Promise<{ ok: boolean; state?: WizDeviceState; error?: string; config?: Record<string, unknown> }> {
    try {
      const [state, config] = await Promise.all([
        this.getPilot(ip, { retries: 0, ...options }),
        this.getSystemConfig(ip, { retries: 0, ...options }).catch(() => undefined),
      ]);
      return { ok: true, state, config };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async discover(timeoutMs = 3500): Promise<DiscoveryResult[]> {
    const results = new Map<string, DiscoveryResult>();
    const sockets: dgram.Socket[] = [];
    const localAddresses = getLocalIpv4Addresses();

    await Promise.all(localAddresses.map(async (local) => {
      await this.discoverOnInterface(local.address, local.broadcast, timeoutMs, results, sockets).catch((err) => {
        logWarn(`Discovery failed on ${local.address}: ${String(err)}`);
      });
    }));

    for (const s of sockets) {
      try { s.close(); } catch { /* ignore */ }
    }

    return Array.from(results.values());
  }

  private discoverOnInterface(localIp: string, broadcastIp: string, timeoutMs: number, results: Map<string, DiscoveryResult>, sockets: dgram.Socket[]): Promise<void> {
    return new Promise((resolve) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      sockets.push(socket);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try { socket.removeAllListeners('message'); } catch { /* ignore */ }
        resolve();
      };

      socket.on('error', (err) => {
        logWarn(`Discovery socket error on ${localIp}: ${err.message}`);
        finish();
      });

      socket.on('message', (msg, rinfo) => {
        try {
          const response = parseWizResponse(msg);
          const state = extractPilotState(response);
          const existing = results.get(rinfo.address) || { ip: rinfo.address };
          if (state) existing.state = state;
          if (state?.mac) existing.mac = state.mac;
          // getSystemConfig may include moduleName
          const result = response.result as Record<string, unknown> | undefined;
          if (result && typeof result.moduleName === 'string') existing.name = result.moduleName;
          if (result && typeof result.mac === 'string') existing.mac = result.mac;
          results.set(rinfo.address, existing);
        } catch (err) {
          logWarn(`Ignoring malformed discovery response from ${rinfo.address}: ${String(err)}`);
        }
      });

      socket.bind(0, localIp, () => {
        try { socket.setBroadcast(true); } catch { /* ignore */ }
        const probe = buildRegistrationProbe(randomMacLike(), localIp);
        const getPilot = buildGetPilotMessage();
        const targets = [broadcastIp, '255.255.255.255'];
        for (const target of targets) {
          socket.send(probe, WIZ_PORT, target, (err) => { if (err) logWarn(`Discovery send failed ${target}: ${err.message}`); });
          socket.send(getPilot, WIZ_PORT, target, (err) => { if (err) logWarn(`Discovery send failed ${target}: ${err.message}`); });
        }
        setTimeout(finish, timeoutMs);
      });
    });
  }
}

function getLocalIpv4Addresses(): Array<{ address: string; broadcast: string }> {
  const nets = networkInterfaces();
  const out: Array<{ address: string; broadcast: string }> = [];
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      out.push({ address: net.address, broadcast: computeBroadcast(net.address, net.netmask) });
    }
  }
  if (out.length === 0) out.push({ address: '0.0.0.0', broadcast: '255.255.255.255' });
  return out;
}

function computeBroadcast(ip: string, netmask: string): string {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  if (ipParts.length !== 4 || maskParts.length !== 4 || ipParts.some(Number.isNaN) || maskParts.some(Number.isNaN)) {
    return '255.255.255.255';
  }
  return ipParts.map((part, i) => (part | (~maskParts[i] & 255)) & 255).join('.');
}

function randomMacLike(): string {
  const bytes = Array.from({ length: 6 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
  return bytes.join('');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
