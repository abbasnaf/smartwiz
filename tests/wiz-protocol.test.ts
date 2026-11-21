import { describe, it, expect } from 'vitest';
import { buildGetPilotMessage, buildSetPilotMessage, parseWizResponse, extractPilotState, clampBrightness, clampKelvin, clampRgb, isValidIpv4 } from '../electron/services/wiz-protocol';

describe('wiz-protocol', () => {
  it('builds getPilot message', () => {
    const msg = JSON.parse(buildGetPilotMessage().toString('utf8'));
    expect(msg).toEqual({ method: 'getPilot', params: {} });
  });

  it('builds setPilot message', () => {
    const msg = JSON.parse(buildSetPilotMessage({ state: true, dimming: 50 }).toString('utf8'));
    expect(msg).toEqual({ method: 'setPilot', params: { state: true, dimming: 50 } });
  });

  it('parses valid response', () => {
    const res = parseWizResponse(Buffer.from('{"method":"getPilot","result":{"state":true,"dimming":80}}'));
    expect(res.result).toBeTruthy();
  });

  it('throws on invalid json', () => {
    expect(() => parseWizResponse(Buffer.from('{bad'))).toThrow();
  });

  it('extracts pilot state', () => {
    const state = extractPilotState({ result: { state: true, dimming: 70, temp: 3000, mac: 'aabbccddeeff' } });
    expect(state).toMatchObject({ state: true, dimming: 70, temp: 3000, mac: 'aabbccddeeff' });
  });

  it('clamps values', () => {
    expect(clampBrightness(0)).toBe(10);
    expect(clampBrightness(101)).toBe(100);
    expect(clampKelvin(1000)).toBe(2200);
    expect(clampKelvin(9000)).toBe(6500);
    expect(clampRgb(-1)).toBe(0);
    expect(clampRgb(300)).toBe(255);
  });

  it('validates ipv4', () => {
    expect(isValidIpv4('192.168.1.2')).toBe(true);
    expect(isValidIpv4('192.168.1.256')).toBe(false);
    expect(isValidIpv4('abc')).toBe(false);
  });
});
