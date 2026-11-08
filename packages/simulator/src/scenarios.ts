/**
 * Modul: Simulator — Scenario catalog
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Failure-first: each scenario models a real integration hazard, not just the
 * happy path. Steps are the canonical event stream; the webhook plan describes
 * how those events are (mis)delivered to the developer's endpoint.
 */
import type { EventType } from '@baturpay/core';

export interface ScenarioStep {
  /** Milliseconds after the previous step (must be >= 0). */
  readonly afterMs: number;
  readonly eventType: EventType;
  readonly data?: Record<string, unknown>;
}

export interface WebhookDeliveryPlan {
  /** Index into the event stream (0-based) this delivery carries. */
  readonly eventIndex: number;
  /** Artificial delay before the delivery attempt. */
  readonly delayMs: number;
  /** Deliver the exact same eventId twice (retry semantics). */
  readonly duplicate: boolean;
}

export interface ScenarioDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly steps: readonly ScenarioStep[];
  /** Order/delay overrides for deliveries. Empty => deliver in event order. */
  readonly deliveryPlan: readonly WebhookDeliveryPlan[];
  /** Optional: expected settled amount delta to model a discrepancy. */
  readonly settlementDeltaMinor?: number;
}

const SUCCESS_STEPS: readonly ScenarioStep[] = [
  { afterMs: 0, eventType: 'invoice.created' },
  { afterMs: 1_000, eventType: 'invoice.pending' },
  { afterMs: 4_000, eventType: 'payment.succeeded' },
];

export const SCENARIOS: readonly ScenarioDefinition[] = [
  {
    name: 'success',
    title: 'Happy path',
    description: 'Invoice is created, becomes pending, and is paid successfully.',
    steps: SUCCESS_STEPS,
    deliveryPlan: [],
  },
  {
    name: 'failure',
    title: 'Payment failure',
    description: 'Payment attempt fails after pending. Terminal FAILED state.',
    steps: [
      { afterMs: 0, eventType: 'invoice.created' },
      { afterMs: 1_000, eventType: 'invoice.pending' },
      { afterMs: 2_500, eventType: 'payment.failed', data: { reason: 'insufficient_funds' } },
    ],
    deliveryPlan: [],
  },
  {
    name: 'expiry',
    title: 'Invoice expiry',
    description: 'Invoice is never paid and expires.',
    steps: [
      { afterMs: 0, eventType: 'invoice.created' },
      { afterMs: 1_000, eventType: 'invoice.pending' },
      { afterMs: 900_000, eventType: 'invoice.expired' },
    ],
    deliveryPlan: [],
  },
  {
    name: 'pending_forever',
    title: 'Stuck pending',
    description: 'Payment stays pending. Tests timeouts and reconciliation of open items.',
    steps: [
      { afterMs: 0, eventType: 'invoice.created' },
      { afterMs: 1_000, eventType: 'invoice.pending' },
    ],
    deliveryPlan: [],
  },
  {
    name: 'duplicate_webhook',
    title: 'Duplicate webhook delivery',
    description:
      'Payment succeeds but the success webhook is delivered twice with the same eventId.',
    steps: SUCCESS_STEPS,
    deliveryPlan: [
      { eventIndex: 2, delayMs: 300, duplicate: false },
      { eventIndex: 2, delayMs: 900, duplicate: true },
    ],
  },
  {
    name: 'late_webhook',
    title: 'Late webhook',
    description: 'The success webhook arrives long after the invoice was paid.',
    steps: SUCCESS_STEPS,
    deliveryPlan: [{ eventIndex: 2, delayMs: 120_000, duplicate: false }],
  },
  {
    name: 'out_of_order',
    title: 'Out-of-order delivery',
    description: 'The success webhook is delivered before the pending webhook.',
    steps: SUCCESS_STEPS,
    deliveryPlan: [
      { eventIndex: 2, delayMs: 100, duplicate: false },
      { eventIndex: 1, delayMs: 5_000, duplicate: false },
    ],
  },
  {
    name: 'slow_timeout',
    title: 'Slow confirmation / client timeout',
    description:
      'The client times out while the payment is pending, then success arrives later. '
      + 'Redirecting to a success page must not be trusted.',
    steps: [
      { afterMs: 0, eventType: 'invoice.created' },
      { afterMs: 1_000, eventType: 'invoice.pending' },
      { afterMs: 60_000, eventType: 'payment.succeeded' },
    ],
    deliveryPlan: [{ eventIndex: 2, delayMs: 60_000, duplicate: false }],
  },
  {
    name: 'reconciliation_mismatch',
    title: 'Settlement discrepancy',
    description:
      'Payment succeeds, but the expected settled amount differs from the invoice. '
      + 'Reconciliation must flag a discrepancy rather than silently accept it.',
    steps: SUCCESS_STEPS,
    deliveryPlan: [],
    settlementDeltaMinor: -100,
  },
];

export function getScenario(name: string): ScenarioDefinition {
  const found = SCENARIOS.find((s) => s.name === name);
  if (!found) {
    throw new Error(`Unknown scenario: ${name}`);
  }
  return found;
}
