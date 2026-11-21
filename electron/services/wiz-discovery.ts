import { WizClient } from './wiz-client';
import { DiscoveryResult } from '../../shared/types';

export class WizDiscoveryService {
  constructor(private client: WizClient) {}
  discover(timeoutMs?: number): Promise<DiscoveryResult[]> {
    return this.client.discover(timeoutMs);
  }
}
