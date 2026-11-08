/**
 * Modul: API — DTO serialization
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Records from the store are mapped to the public contract shapes here. This is
 * the only place that decides what leaves the API, so secrets never leak.
 */
import type {
  EventRecord,
  InvoiceRecord,
  RunRecord,
  WebhookDeliveryRecord,
  WebhookEndpointRecord,
} from './store/types.js';

export function toInvoiceDto(inv: InvoiceRecord) {
  return {
    id: inv.id,
    workspaceId: inv.workspaceId,
    externalId: inv.externalId,
    amountMinor: inv.amountMinor,
    currency: inv.currency,
    status: inv.status,
    environment: 'sandbox' as const,
    description: inv.description,
    scenario: inv.scenario,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}

export function toEventDto(event: EventRecord) {
  return {
    eventId: event.eventId,
    type: event.type,
    workspaceId: event.workspaceId,
    invoiceId: event.invoiceId,
    sequence: event.sequence,
    occurredAt: event.occurredAt,
    data: event.data,
  };
}

export function toRunDto(run: RunRecord) {
  return {
    runId: run.runId,
    scenario: run.scenario,
    seed: run.seed,
    invoiceId: run.invoiceId,
    finalStatus: run.finalStatus,
    expectedSettleMinor: run.expectedSettleMinor,
    events: run.events.map(toEventDto),
    deliveries: run.deliveries.map((d) => ({
      deliveryId: d.deliveryId,
      eventId: d.eventId,
      eventType: d.eventType,
      order: d.order,
      scheduledAt: d.scheduledAt,
      duplicate: d.duplicate,
    })),
    createdAt: run.createdAt,
  };
}

export function toEndpointDto(endpoint: WebhookEndpointRecord) {
  return {
    id: endpoint.id,
    workspaceId: endpoint.workspaceId,
    url: endpoint.url,
    description: endpoint.description,
    status: endpoint.status,
    createdAt: endpoint.createdAt,
  };
}

export function toDeliveryDto(delivery: WebhookDeliveryRecord) {
  return {
    id: delivery.id,
    endpointId: delivery.endpointId,
    eventId: delivery.eventId,
    eventType: delivery.eventType,
    status: delivery.status,
    attempts: delivery.attempts,
    scheduledAt: delivery.scheduledAt,
    lastAttemptAt: delivery.lastAttemptAt,
    responseStatus: delivery.responseStatus,
    error: delivery.error,
    createdAt: delivery.createdAt,
  };
}
