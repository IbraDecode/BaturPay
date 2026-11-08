/**
 * Modul: API — Webhook routes
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppDeps } from '../deps.js';
import { toDeliveryDto, toEndpointDto } from '../dto.js';
import { requireAuth, requestActor } from '../plugins/auth.js';
import {
  listDeliveries,
  listEndpoints,
  registerEndpoint,
  replayDelivery,
} from '../services/webhook-service.js';

const createEndpointSchema = z.object({
  url: z.string().url(),
  description: z.string().max(200).optional(),
});

export function registerWebhookRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/v1/webhook-endpoints', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const endpoints = await listEndpoints(deps.store, auth.workspaceId);
    return reply.send(endpoints.map(toEndpointDto));
  });

  app.post('/v1/webhook-endpoints', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const body = createEndpointSchema.parse(request.body);
    const result = await registerEndpoint(deps.store, deps.config, {
      workspaceId: auth.workspaceId,
      actor: requestActor(request),
      url: body.url,
      description: body.description,
    });
    // signing secret is returned exactly once
    return reply.status(201).send({ ...toEndpointDto(result.endpoint), signingSecret: result.signingSecret });
  });

  app.get('/v1/webhook-deliveries', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const query = request.query as { limit?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 200);
    const deliveries = await listDeliveries(deps.store, auth.workspaceId, limit);
    return reply.send(deliveries.map(toDeliveryDto));
  });

  app.post('/v1/webhook-deliveries/:id/retry', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const delivery = await replayDelivery(deps.store, {
      workspaceId: auth.workspaceId,
      actor: requestActor(request),
      deliveryId: id,
    });
    return reply.status(202).send(toDeliveryDto(delivery));
  });
}
