/**
 * Modul: API — Store factory
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import type { AppConfig } from '@baturpay/config';
import { createPool } from '../db/pool.js';
import { MemoryStore } from './memory.js';
import { PgStore } from './pg.js';
import type { Store } from './types.js';

export type StoreDriver = 'auto' | 'memory' | 'postgres';

export async function createStore(config: AppConfig, driver: StoreDriver = 'auto'): Promise<Store> {
  const effective = resolveDriver(config, driver);
  if (effective === 'memory') return new MemoryStore();
  return new PgStore(createPool(config.databaseUrl));
}

export function resolveDriver(config: AppConfig, driver: StoreDriver): 'memory' | 'postgres' {
  if (driver !== 'auto') return driver;
  if (config.databaseUrl.startsWith('memory://')) return 'memory';
  return 'postgres';
}

export * from './types.js';
export { MemoryStore } from './memory.js';
export { PgStore } from './pg.js';
