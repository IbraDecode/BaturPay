/**
 * Modul: API — Scenario catalog route
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import type { FastifyInstance } from 'fastify';
import { SCENARIOS } from '@baturpay/simulator';
import type { AppDeps } from '../deps.js';

export function registerScenarioRoutes(app: FastifyInstance, _deps: AppDeps): void {
  app.get('/v1/scenarios', { preHandler: app.authenticate }, async (_request, reply) => {
    return reply.send(
      SCENARIOS.map((s) => ({
        name: s.name,
        title: s.title,
        description: s.description,
        stepCount: s.steps.length,
        hasDiscrepancy: s.settlementDeltaMinor !== undefined && s.settlementDeltaMinor !== 0,
      })),
    );
  });
}
