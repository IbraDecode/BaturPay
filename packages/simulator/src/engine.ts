/**
 * Modul: Simulator — Scenario engine
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Pure and deterministic: given the same input it produces the same events,
 * ids, and delivery schedule. Nothing here touches the network or the clock
 * beyond an explicit startAtMs, which keeps tests hermetic and replay exact.
 */
import {
  sha256Hex,
  statusForEvent,
  type EventEnvelope,
  type EventType,
  type InvoiceStatus,
} from '@baturpay/core';
import { getScenario } from './scenarios.js';
import type { ScenarioDefinition } from './scenarios.js';

export interface RunScenarioInput {
  readonly scenarioName: string;
  readonly workspaceId: string;
  readonly invoiceId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly seed?: string;
  readonly startAtMs?: number;
}

export interface PlannedDelivery {
  readonly deliveryId: string;
  readonly eventId: string;
  readonly eventType: EventType;
  readonly order: number;
  readonly scheduledAtMs: number;
  readonly duplicate: boolean;
}

export interface ScenarioRunResult {
  readonly runId: string;
  readonly scenarioName: string;
  readonly seed: string;
  readonly events: readonly EventEnvelope[];
  readonly deliveries: readonly PlannedDelivery[];
  readonly finalStatus: InvoiceStatus;
  readonly expectedSettleMinor: number;
}

/** Deterministic id derived from seed + role + index (no RNG, no clock). */
export function deterministicId(prefix: string, seed: string, role: string, index: number): string {
  const body = sha256Hex(`${seed}:${role}:${index}`).slice(0, 26).toUpperCase();
  return `${prefix}_${body}`;
}

function buildEvents(
  scenario: ScenarioDefinition,
  input: RunScenarioInput,
  seed: string,
  startAtMs: number,
): EventEnvelope[] {
  const events: EventEnvelope[] = [];
  let cursor = startAtMs;
  scenario.steps.forEach((step, index) => {
    cursor += step.afterMs;
    events.push({
      eventId: deterministicId('evt', seed, 'event', index),
      type: step.eventType,
      workspaceId: input.workspaceId,
      invoiceId: input.invoiceId,
      sequence: index + 1,
      occurredAt: new Date(cursor).toISOString(),
      data: {
        scenario: scenario.name,
        amountMinor: input.amountMinor,
        currency: input.currency,
        ...(step.data ?? {}),
      },
    });
  });
  return events;
}

function buildDeliveries(
  scenario: ScenarioDefinition,
  events: readonly EventEnvelope[],
  seed: string,
  startAtMs: number,
): PlannedDelivery[] {
  if (scenario.deliveryPlan.length === 0) {
    return events.map((event, index) => ({
      deliveryId: deterministicId('dlv', seed, 'delivery', index),
      eventId: event.eventId,
      eventType: event.type,
      order: index + 1,
      scheduledAtMs: Date.parse(event.occurredAt),
      duplicate: false,
    }));
  }

  return scenario.deliveryPlan.map((plan, index) => {
    const event = events[plan.eventIndex];
    if (!event) {
      throw new Error(`Scenario ${scenario.name} references missing event index ${plan.eventIndex}`);
    }
    return {
      deliveryId: deterministicId('dlv', seed, `plan-${index}`, index),
      eventId: event.eventId,
      eventType: event.type,
      order: index + 1,
      scheduledAtMs: startAtMs + plan.delayMs,
      duplicate: plan.duplicate,
    };
  });
}

export function runScenario(input: RunScenarioInput): ScenarioRunResult {
  const scenario = getScenario(input.scenarioName);
  const seed = input.seed ?? `${input.workspaceId}:${input.invoiceId}:${scenario.name}`;
  const startAtMs = input.startAtMs ?? Date.parse('2026-01-01T00:00:00.000Z');

  const events = buildEvents(scenario, input, seed, startAtMs);
  const deliveries = buildDeliveries(scenario, events, seed, startAtMs);
  const last = events[events.length - 1];
  if (!last) throw new Error(`Scenario ${scenario.name} produced no events`);

  return {
    runId: deterministicId('run', seed, 'run', 0),
    scenarioName: scenario.name,
    seed,
    events,
    deliveries,
    finalStatus: statusForEvent(last.type),
    expectedSettleMinor: input.amountMinor + (scenario.settlementDeltaMinor ?? 0),
  };
}

/** Helper for callers that just need a fresh deterministic run id. */
export function makeRunId(workspaceId: string, invoiceId: string, scenarioName: string): string {
  return deterministicId('run', `${workspaceId}:${invoiceId}:${scenarioName}`, 'run', 0);
}
