/**
 * Modul: API — Admin routes (workspaces, keys, audit, dispatch)
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { errors, newId } from '@baturpay/core';
import type { AppDeps } from '../deps.js';
import { requireAuth, requestActor } from '../plugins/auth.js';
import { buildApiKeyRecord, mintApiKey } from '../services/auth.js';
import { recordAudit } from '../services/audit.js';

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
});

export function registerAdminRoutes(app: FastifyInstance, deps: AppDeps): void {
  // First-run bootstrap: allowed without auth only while no workspace exists.
  app.post('/v1/workspaces', async (request, reply) => {
    const body = createWorkspaceSchema.parse(request.body);
    const existing = await deps.store.listWorkspaces();
    if (existing.length > 0) {
      await app.authenticate(request, reply);
      if (!request.auth) throw errors.unauthorized('Authentication required to add workspaces');
    }

    const workspace = await deps.store.createWorkspace({ id: newId('ws'), name: body.name });
    const minted = mintApiKey(deps.config.apiKeyPepper);
    const record = buildApiKeyRecord(workspace.id, minted, ['sandbox:*']);
    await deps.store.createApiKey(record);
    await recordAudit(deps.store, {
      workspaceId: workspace.id,
      actor: 'bootstrap',
      action: 'workspace.created',
      resource: workspace.id,
      metadata: { name: workspace.name },
    });
    return reply.status(201).send({
      workspace,
      apiKey: { id: record.id, prefix: record.keyPrefix, secret: minted.plaintext },
      notice: 'Store the secret now; it is shown only once.',
    });
  });

  app.post('/v1/keys', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const minted = mintApiKey(deps.config.apiKeyPepper);
    const record = buildApiKeyRecord(auth.workspaceId, minted, ['sandbox:*']);
    await deps.store.createApiKey(record);
    await recordAudit(deps.store, {
      workspaceId: auth.workspaceId,
      actor: requestActor(request),
      action: 'api_key.created',
      resource: record.id,
    });
    return reply.status(201).send({
      id: record.id,
      prefix: record.keyPrefix,
      secret: minted.plaintext,
      notice: 'Store the secret now; it is shown only once.',
    });
  });

  app.get('/v1/keys', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const keys = await deps.store.listApiKeys(auth.workspaceId);
    return reply.send(
      keys.map((k) => ({
        id: k.id,
        prefix: k.keyPrefix,
        scopes: k.scopes,
        createdAt: k.createdAt,
        revokedAt: k.revokedAt,
      })),
    );
  });

  app.get('/v1/audit', { preHandler: app.authenticate }, async (request, reply) => {
    const auth = requireAuth(request);
    const query = request.query as { limit?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? 50) || 50, 1), 200);
    const records = await deps.store.listAudit(auth.workspaceId, limit);
    return reply.send(records);
  });

  // Manual dispatch trigger; handy for demos and tests where no interval runs.
  app.post('/v1/admin/dispatch-tick', { preHandler: app.authenticate }, async (_request, reply) => {
    const result = await deps.dispatcher.tick();
    return reply.send(result);
  });
}
