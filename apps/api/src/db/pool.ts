/**
 * Modul: API — Postgres pool
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { Pool, type PoolConfig } from 'pg';

export function createPool(databaseUrl: string): Pool {
  const sslMode = process.env.PGSSLMODE;
  const useSsl = sslMode === 'require' || sslMode === 'verify-full';
  const config: PoolConfig = {
    connectionString: databaseUrl,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };
  if (useSsl) config.ssl = { rejectUnauthorized: sslMode === 'verify-full' };
  return new Pool(config);
}
