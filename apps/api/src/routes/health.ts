/**
 * Modul: API — Health & contract routes
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { CONTRACT_VERSION } from '@baturpay/contracts';
import { liveGateStatus } from '@baturpay/core';
import type { AppDeps } from '../deps.js';

export function registerHealthRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/health', async () => ({
    status: 'ok' as const,
    mode: deps.config.mode,
    liveGateOpen: liveGateStatus(deps.config.liveGate).open,
    contractVersion: CONTRACT_VERSION,
    uptimeSeconds: Math.max(0, (Date.now() - deps.startedAt) / 1000),
  }));

  app.get('/v1/contracts', async () => {
    const document = readOpenApiDocument();
    return {
      version: CONTRACT_VERSION,
      apiPrefix: '/v1',
      openapi: '3.1.0',
      document,
    };
  });
}

function readOpenApiDocument(): unknown {
  const candidates = [
    path.join(process.cwd(), 'packages/contracts/openapi.json'),
    path.join(process.cwd(), '../packages/contracts/openapi.json'),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf8'));
    } catch {
      continue;
    }
  }
  return null;
}
