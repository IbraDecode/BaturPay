/**
 * Modul: Core — Payment events
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Events are append-only facts. The invoice's current status is a projection of
 * its event stream; we never mutate the stream. Each event carries a monotonically
 * increasing sequence per invoice so consumers can detect gaps and reordering.
 */
import type { InvoiceStatus } from './state-machine.js';

export const EVENT_TYPES = [
  'invoice.created',
  'invoice.pending',
  'payment.succeeded',
  'payment.failed',
  'invoice.expired',
  'payment.refunded',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TO_STATUS: Record<EventType, InvoiceStatus> = {
  'invoice.created': 'CREATED',
  'invoice.pending': 'PENDING',
  'payment.succeeded': 'SUCCEEDED',
  'payment.failed': 'FAILED',
  'invoice.expired': 'EXPIRED',
  'payment.refunded': 'REFUNDED',
};

export function statusForEvent(type: EventType): InvoiceStatus {
  return EVENT_TO_STATUS[type];
}

export interface EventEnvelope<TData = Record<string, unknown>> {
  readonly eventId: string;
  readonly type: EventType;
  readonly workspaceId: string;
  readonly invoiceId: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly data: TData;
}

/** Events that are terminal for the forward flow. */
const TERMINAL_EVENTS: readonly EventType[] = ['payment.failed', 'invoice.expired', 'payment.refunded'];

export function isTerminalEvent(type: EventType): boolean {
  return TERMINAL_EVENTS.includes(type);
}
