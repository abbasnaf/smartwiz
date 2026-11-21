import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

class FakeSocket extends EventEmitter {
  sent: Array<{ msg: Buffer; port: number; ip: string }> = [];
  bind(_port?: any, _addr?: any, cb?: any) { if (typeof _addr === 'function') _addr(); else cb?.(); }
  send(msg: Buffer, port: number, ip: string, cb?: (err?: Error) => void) { this.sent.push({ msg, port, ip }); cb?.(); }
  close() {}
  setBroadcast() {}
  removeAllListeners() { super.removeAllListeners(); return this; }
}

let nextSocket: FakeSocket;
vi.mock('dgram', () => ({
  default: { createSocket: () => { nextSocket = new FakeSocket(); return nextSocket as any; } },
  createSocket: () => { nextSocket = new FakeSocket(); return nextSocket as any; },
}));

import { WizClient } from '../electron/services/wiz-client';

describe('WizClient', () => {
  it('parses getPilot response', async () => {
    const client = new WizClient(1000);
    const p = client.getPilot('1.2.3.4');
    // wait a tick for socket bind/send
    await new Promise((r) => setTimeout(r, 0));
    nextSocket.emit('message', Buffer.from(JSON.stringify({ method: 'getPilot', result: { state: true, dimming: 55 } })));
    const state = await p;
    expect(state.state).toBe(true);
    expect(state.dimming).toBe(55);
  });

  it('times out on no response', async () => {
    const client = new WizClient(50);
    await expect(client.getPilot('1.2.3.4', { retries: 0, timeoutMs: 50 })).rejects.toThrow(/timeout/i);
  });
});
