/**
 * Modul: API — Run service
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Applies a deterministic scenario to an invoice. The scenario is a scripted
 * event stream; the invoice status is derived by walking that stream through the
 * state machine, so an invalid history is rejected instead of silently stored.
 */
import {
  errors,
  idempotencyKeyHash,
  nextStatus,
  requestFingerprint,
  statusForEvent,
  type InvoiceStatus,
} from '@baturpay/core';
import { runScenarioRequestSchema, type RunScenarioRequest } from '@baturpay/contracts';
import { runScenario as simulate, type ScenarioRunResult } from '@baturpay/simulator';
import type { DeliveryPlanRecord, EventRecord, InvoiceRecord, RunRecord, Store } from '../store/types.js';
import { recordAudit } from './audit.js';

export interface RunScenarioInput {
  workspaceId: string;
  actor: string;
  idempotencyKey: string;
  body: unknown;
}

export type RunScenarioOutcome =
  | { outcome: 'executed'; run: RunRecord }
  | { outcome: 'replayed'; run: RunRecord };

export interface RunScenarioDeps {
  afterPersist?: (run: RunRecord) => Promise<void>;
}

export async function executeScenario(
  store: Store,
  input: RunScenarioInput,
  deps: RunScenarioDeps = {},
): Promise<RunScenarioOutcome> {
  const parsed: RunScenarioRequest = runScenarioRequestSchema.parse(input.body);

  const keyHash = idempotencyKeyHash({
    workspaceId: input.workspaceId,
    operation: 'run_scenario',
    key: input.idempotencyKey,
  });
  const fingerprint = requestFingerprint(parsed);
  const existingKey = await store.getIdempotency(keyHash);
  if (existingKey) {
    if (existingKey.requestFingerprint !== fingerprint) {
      throw errors.idempotencyConflict('Idempotency key was reused with a different request body');
    }
    const runId = (existingKey.responseBody as { runId?: string } | null)?.runId;
    if (runId) {
      const run = await store.getRun(input.workspaceId, runId);
      if (run) return { outcome: 'replayed', run };
    }
  }

  const invoice = await store.getInvoice(input.workspaceId, parsed.invoiceId);
  if (!invoice) throw errors.notFound('Invoice not found', { invoiceId: parsed.invoiceId });

  const simulation: ScenarioRunResult = simulate({
    scenarioName: parsed.scenario,
    workspaceId: input.workspaceId,
    invoiceId: invoice.id,
    amountMinor: invoice.amountMinor,
    currency: invoice.currency,
    seed: parsed.seed ?? `${invoice.workspaceId}:${invoice.id}:${parsed.scenario}`,
  });

  // Walk the derived status through the state machine to validate the history.
  let status = invoice.status as InvoiceStatus;
  for (const event of simulation.events) {
    status = nextStatus(status, statusForEvent(event.type));
  }

  const persisted = await store.getRun(input.workspaceId, simulation.runId);
  if (persisted) return { outcome: 'replayed', run: persisted };

  const events: EventRecord[] = [];
  for (const event of simulation.events) {
    events.push(
      await store.appendEvent({
        eventId: event.eventId,
        workspaceId: event.workspaceId,
        invoiceId: event.invoiceId,
        type: event.type,
        sequence: event.sequence,
        occurredAt: event.occurredAt,
        data: event.data,
      }),
    );
  }

  await store.updateInvoiceStatus(input.workspaceId, invoice.id, status);

  const deliveries: DeliveryPlanRecord[] = simulation.deliveries.map((d) => ({
    deliveryId: d.deliveryId,
    eventId: d.eventId,
    eventType: d.eventType,
    order: d.order,
    scheduledAt: new Date(d.scheduledAtMs).toISOString(),
    duplicate: d.duplicate,
  }));

  const run: RunRecord = {
    runId: simulation.runId,
    workspaceId: input.workspaceId,
    invoiceId: invoice.id,
    scenario: simulation.scenarioName,
    seed: simulation.seed,
    finalStatus: status,
    expectedSettleMinor: simulation.expectedSettleMinor,
    events,
    deliveries,
    createdAt: new Date().toISOString(),
  };
  await store.saveRun(run);

  await store.putIdempotency({
    keyHash,
    workspaceId: input.workspaceId,
    operation: 'run_scenario',
    requestFingerprint: fingerprint,
    responseStatus: 201,
    responseBody: { runId: run.runId },
    createdAt: run.createdAt,
  });

  await recordAudit(store, {
    workspaceId: input.workspaceId,
    actor: input.actor,
    action: 'scenario.executed',
    resource: run.runId,
    metadata: { invoiceId: invoice.id, scenario: run.scenario, finalStatus: run.finalStatus },
  });

  if (deps.afterPersist) await deps.afterPersist(run);

  return { outcome: 'executed', run };
}

export async function getRunOrThrow(store: Store, workspaceId: string, runId: string): Promise<RunRecord> {
  const run = await store.getRun(workspaceId, runId);
  if (!run) throw errors.notFound('Run not found', { runId });
  return run;
}
