/**
 * Modul: Core tests — state machine
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { describe, expect, it } from 'vitest';
import {
  assertSettlementTransition,
  assertTransition,
  canTransition,
  isTerminal,
  nextStatus,
} from '../src/state-machine.js';

describe('invoice state machine', () => {
  it('allows the happy path', () => {
    expect(canTransition('CREATED', 'PENDING')).toBe(true);
    expect(canTransition('PENDING', 'SUCCEEDED')).toBe(true);
    expect(nextStatus('CREATED', 'PENDING')).toBe('PENDING');
  });

  it('rejects illegal jumps', () => {
    expect(canTransition('CREATED', 'SUCCEEDED')).toBe(false);
    expect(() => assertTransition('CREATED', 'REFUNDED')).toThrow(/Illegal invoice transition/);
  });

  it('treats same-status as idempotent no-op', () => {
    expect(canTransition('PENDING', 'PENDING')).toBe(true);
    expect(nextStatus('PENDING', 'PENDING')).toBe('PENDING');
  });

  it('never resurrects a terminal state', () => {
    expect(isTerminal('FAILED')).toBe(true);
    expect(isTerminal('EXPIRED')).toBe(true);
    expect(canTransition('FAILED', 'PENDING')).toBe(false);
    expect(canTransition('EXPIRED', 'SUCCEEDED')).toBe(false);
  });

  it('allows refund only from SUCCEEDED', () => {
    expect(canTransition('SUCCEEDED', 'REFUNDED')).toBe(true);
    expect(canTransition('PENDING', 'REFUNDED')).toBe(false);
  });
});

describe('settlement state machine', () => {
  it('is independent from payment status', () => {
    expect(assertSettlementTransition('NOT_STARTED', 'PROCESSING')).toBe('PROCESSING');
    expect(assertSettlementTransition('PROCESSING', 'DISCREPANCY')).toBe('DISCREPANCY');
    expect(() => assertSettlementTransition('NOT_STARTED', 'SETTLED')).toThrow();
  });
});
