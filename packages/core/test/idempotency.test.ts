/**
 * Modul: Core tests — idempotency & mode gate
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { describe, expect, it } from 'vitest';
import {
  assertLiveAllowed,
  decideIdempotency,
  idempotencyKeyHash,
  liveGateStatus,
  requestFingerprint,
  type LiveGate,
} from '../src/index.js';

const sandboxGate: LiveGate = {
  mode: 'sandbox',
  livePaymentsEnabled: false,
  goLiveAttestation: '',
};

describe('idempotency', () => {
  it('produces stable fingerprints regardless of key order', () => {
    expect(requestFingerprint({ a: 1, b: 2 })).toBe(requestFingerprint({ b: 2, a: 1 }));
  });

  it('scopes keys per workspace and operation', () => {
    const base = { operation: 'create_invoice' as const, key: 'abcdefgh' };
    const a = idempotencyKeyHash({ ...base, workspaceId: 'ws_1' });
    const b = idempotencyKeyHash({ ...base, workspaceId: 'ws_2' });
    expect(a).not.toBe(b);
  });

  it('replays identical requests and conflicts on different bodies', () => {
    const fp = requestFingerprint({ amount: 100 });
    expect(decideIdempotency(null, fp).kind).toBe('fresh');
    expect(
      decideIdempotency(
        { keyHash: 'k', requestFingerprint: fp, responseStatus: 201, responseBody: {} },
        fp,
      ).kind,
    ).toBe('replay');
    expect(
      decideIdempotency(
        { keyHash: 'k', requestFingerprint: fp, responseStatus: 201, responseBody: {} },
        requestFingerprint({ amount: 999 }),
      ).kind,
    ).toBe('conflict');
  });
});

describe('live gate', () => {
  it('fails closed in sandbox', () => {
    const status = liveGateStatus(sandboxGate);
    expect(status.open).toBe(false);
    expect(status.reasons.length).toBeGreaterThan(0);
    expect(() => assertLiveAllowed(sandboxGate, 'charge')).toThrow(/blocked by the compliance gate/);
  });

  it('opens only when every condition is met', () => {
    const gate: LiveGate = {
      mode: 'production',
      livePaymentsEnabled: true,
      goLiveAttestation: 'ATT-2026-0001',
    };
    expect(liveGateStatus(gate).open).toBe(true);
    expect(() => assertLiveAllowed(gate, 'charge')).not.toThrow();
  });
});
