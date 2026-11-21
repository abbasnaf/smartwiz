import { networkInterfaces } from 'os';

export function getPrimaryLocalIpv4(): string | null {
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}
