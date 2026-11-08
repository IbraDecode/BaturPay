/**
 * Modul: API — Invoice routes
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { errors } from '@baturpay/core';
import type { AppDeps } from '../deps.js';
import { toEventDto, toInvoiceDto } from '../dto.js';
import { requireAuth, requestActor } from '../plugins/auth.js';
import { createInvoice, getInvoiceOrThrow, listInvoices } from '../services/invoice-service.js';

function idempotencyKey(request: FastifyRequest): string {
  const header = request.headers['idempotency-key'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value || value.trim().length === 0) {
    throw errors.validation('Idempotency-Key header is required', { header: 'Idempotency-Key' });
  }
  return value;
}

export function registerInvoiceRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/v1/invoices', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const query = request.query as { limit?: string; cursor?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 100);
    const page = await listInvoices(deps.store, auth.workspaceId, { limit, cursor: query.cursor });
    return reply.send({ data: page.data.map(toInvoiceDto), nextCursor: page.nextCursor });
  });

  app.post('/v1/invoices', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const result = await createInvoice(deps.store, {
      workspaceId: auth.workspaceId,
      actor: requestActor(request),
      idempotencyKey: idempotencyKey(request),
      body: request.body,
    });
    return reply.status(result.status).send(result.invoice);
  });

  app.get('/v1/invoices/:id', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    const invoice = await getInvoiceOrThrow(deps.store, auth.workspaceId, id);
    return reply.send(toInvoiceDto(invoice));
  });

  app.get('/v1/invoices/:id/events', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const { id } = request.params as { id: string };
    await getInvoiceOrThrow(deps.store, auth.workspaceId, id);
    const events = await deps.store.listEvents(auth.workspaceId, id);
    return reply.send(events.map(toEventDto));
  });
}
