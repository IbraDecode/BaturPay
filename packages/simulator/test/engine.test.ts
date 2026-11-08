/**
 * Modul: Simulator tests
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { describe, expect, it } from 'vitest';
import { createRng, runScenario, SCENARIOS } from '../src/index.js';

const base = {
  workspaceId: 'ws_test',
  invoiceId: 'inv_test',
  amountMinor: 50_000,
  currency: 'IDR',
} as const;

describe('scenario engine', () => {
  it('is fully deterministic for the same input', () => {
    const a = runScenario({ ...base, scenarioName: 'success', seed: 'fixed' });
    const b = runScenario({ ...base, scenarioName: 'success', seed: 'fixed' });
    expect(a).toEqual(b);
  });

  it('carries an increasing sequence and the right final status', () => {
    const run = runScenario({ ...base, scenarioName: 'success' });
    expect(run.events.map((e) => e.sequence)).toEqual([1, 2, 3]);
    expect(run.finalStatus).toBe('SUCCEEDED');
  });

  it('marks failure and expiry as terminal', () => {
    expect(runScenario({ ...base, scenarioName: 'failure' }).finalStatus).toBe('FAILED');
    expect(runScenario({ ...base, scenarioName: 'expiry' }).finalStatus).toBe('EXPIRED');
  });

  it('duplicates a webhook delivery for the duplicate scenario', () => {
    const run = runScenario({ ...base, scenarioName: 'duplicate_webhook' });
    const duplicates = run.deliveries.filter((d) => d.duplicate);
    expect(duplicates).toHaveLength(1);
    const dup = duplicates[0]!;
    const original = run.deliveries.find((d) => d.eventId === dup.eventId && !d.duplicate);
    expect(original).toBeDefined();
  });

  it('delivers out of order for the out_of_order scenario', () => {
    const run = runScenario({ ...base, scenarioName: 'out_of_order' });
    const successAt = run.deliveries.find((d) => d.eventType === 'payment.succeeded')!.scheduledAtMs;
    const pendingAt = run.deliveries.find((d) => d.eventType === 'invoice.pending')!.scheduledAtMs;
    expect(successAt).toBeLessThan(pendingAt);
  });

  it('flags a settlement discrepancy', () => {
    const run = runScenario({ ...base, scenarioName: 'reconciliation_mismatch' });
    expect(run.expectedSettleMinor).toBe(base.amountMinor - 100);
  });

  it('rejects unknown scenarios', () => {
    expect(() => runScenario({ ...base, scenarioName: 'nope' })).toThrow(/Unknown scenario/);
  });

  it('exposes the full failure-first catalog', () => {
    const names = SCENARIOS.map((s) => s.name);
    expect(names).toContain('duplicate_webhook');
    expect(names).toContain('out_of_order');
    expect(names).toContain('slow_timeout');
    expect(names).toContain('reconciliation_mismatch');
  });
});

describe('prng', () => {
  it('replays the same sequence for a seed', () => {
    const a = createRng('seed-1');
    const b = createRng('seed-1');
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it('produces different sequences for different seeds', () => {
    expect(createRng('a').next()).not.toBe(createRng('b').next());
  });
});
