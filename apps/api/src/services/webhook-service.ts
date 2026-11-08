/**
 * Modul: API — Webhook service
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { errors, newId, randomBase64Url } from '@baturpay/core';
import { assertSafeWebhookTarget } from '@baturpay/webhook';
import type { AppConfig } from '@baturpay/config';
import type { RunRecord, Store, WebhookDeliveryRecord, WebhookEndpointRecord } from '../store/types.js';
import { recordAudit } from './audit.js';

export interface RegisterEndpointInput {
  workspaceId: string;
  actor: string;
  url: string;
  description?: string;
}

export interface RegisterEndpointResult {
  endpoint: WebhookEndpointRecord;
  /** Shown to the caller exactly once. */
  signingSecret: string;
}

export async function registerEndpoint(
  store: Store,
  config: AppConfig,
  input: RegisterEndpointInput,
): Promise<RegisterEndpointResult> {
  await assertSafeWebhookTarget(input.url, {
    allowPrivateTargets: config.webhook.allowPrivateTargets,
    allowlist: config.webhook.allowlist,
    allowedProtocols: ['http:', 'https:'],
  });

  const endpoint: WebhookEndpointRecord = {
    id: newId('wh'),
    workspaceId: input.workspaceId,
    url: input.url,
    description: input.description ?? null,
    signingSecret: randomBase64Url(32),
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };
  await store.createWebhookEndpoint(endpoint);
  await recordAudit(store, {
    workspaceId: input.workspaceId,
    actor: input.actor,
    action: 'webhook.endpoint_registered',
    resource: endpoint.id,
    metadata: { url: endpoint.url },
  });
  return { endpoint, signingSecret: endpoint.signingSecret };
}

export async function listEndpoints(store: Store, workspaceId: string): Promise<WebhookEndpointRecord[]> {
  return store.listWebhookEndpoints(workspaceId);
}

/**
 * Materialize a run's delivery plan into concrete, time-scheduled deliveries
 * for every active endpoint. Timing is rebased to `now` so a demo run fires in
 * the intended relative order rather than all at once.
 */
export async function enqueueFromRun(
  store: Store,
  input: { workspaceId: string; run: RunRecord; now: Date },
): Promise<WebhookDeliveryRecord[]> {
  const endpoints = (await store.listWebhookEndpoints(input.workspaceId)).filter((e) => e.status === 'ACTIVE');
  if (endpoints.length === 0 || input.run.deliveries.length === 0) return [];

  const eventById = new Map(input.run.events.map((e) => [e.eventId, e]));
  const baseMs = Math.min(...input.run.deliveries.map((d) => Date.parse(d.scheduledAt)));
  const nowMs = input.now.getTime();
  const created: WebhookDeliveryRecord[] = [];

  for (const endpoint of endpoints) {
    for (const plan of input.run.deliveries) {
      const event = eventById.get(plan.eventId);
      if (!event) continue;
      const offset = Date.parse(plan.scheduledAt) - baseMs;
      created.push({
        id: newId('dlv'),
        workspaceId: input.workspaceId,
        endpointId: endpoint.id,
        eventId: plan.eventId,
        eventType: plan.eventType,
        payload: {
          eventId: event.eventId,
          type: event.type,
          invoiceId: event.invoiceId,
          sequence: event.sequence,
          occurredAt: event.occurredAt,
          data: event.data,
          simulated: true,
        },
        status: 'PENDING',
        attempts: 0,
        scheduledAt: new Date(nowMs + offset).toISOString(),
        lastAttemptAt: null,
        responseStatus: null,
        error: null,
        createdAt: input.now.toISOString(),
      });
    }
  }

  await store.createDeliveries(created);
  return created;
}

export async function listDeliveries(
  store: Store,
  workspaceId: string,
  limit = 50,
): Promise<WebhookDeliveryRecord[]> {
  return store.listDeliveries(workspaceId, { limit });
}

export async function replayDelivery(
  store: Store,
  input: { workspaceId: string; actor: string; deliveryId: string },
): Promise<WebhookDeliveryRecord> {
  const original = await store.getDelivery(input.workspaceId, input.deliveryId);
  if (!original) throw errors.notFound('Delivery not found', { id: input.deliveryId });
  const endpoint = await store.getWebhookEndpoint(input.workspaceId, original.endpointId);
  if (!endpoint) throw errors.notFound('Endpoint not found', { id: original.endpointId });

  const now = new Date().toISOString();
  const replay = await store.createDeliveries([
    {
      ...original,
      id: newId('dlv'),
      status: 'PENDING',
      attempts: 0,
      scheduledAt: now,
      lastAttemptAt: null,
      responseStatus: null,
      error: null,
      createdAt: now,
    },
  ]);

  await recordAudit(store, {
    workspaceId: input.workspaceId,
    actor: input.actor,
    action: 'webhook.delivery_replayed',
    resource: input.deliveryId,
    metadata: { eventId: original.eventId, endpointId: original.endpointId },
  });

  return replay[0]!;
}
