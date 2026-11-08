/**
 * Modul: API — Run routes
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { errors } from '@baturpay/core';
import type { AppDeps } from '../deps.js';
import { toRunDto } from '../dto.js';
import { requireAuth, requestActor } from '../plugins/auth.js';
import { executeScenario, getRunOrThrow } from '../services/run-service.js';
import { enqueueFromRun } from '../services/webhook-service.js';

function idempotencyKey(request: FastifyRequest): string {
  const header = request.headers['idempotency-key'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || value.trim().length === 0) {
    throw errors.validation('Idempotency-Key header is required', { header: 'Idempotency-Key' });
  }
  return value;
}

export function registerRunRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.post('/v1/runs', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const result = await executeScenario(
      deps.store,
      {
        workspaceId: auth.workspaceId,
        actor: requestActor(request),
        idempotencyKey: idempotencyKey(request),
        body: request.body,
      },
      {
        afterPersist: async (run) => {
          await enqueueFromRun(deps.store, {
            workspaceId: auth.workspaceId,
            run,
            now: new Date(),
          });
        },
      },
    );
    return reply.status(201).send(toRunDto(result.run));
  });

  app.get('/v1/runs/:id', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const run = await getRunOrThrow(deps.store, auth.workspaceId, id);
    return reply.send(toRunDto(run));
  });
}
