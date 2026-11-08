/**
 * Modul: Core — Invoice state machine
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Payment status and settlement status are intentionally modelled as two
 * separate machines. A successful payment is NOT the same fact as money having
 * settled. Conflating them is a common and expensive reporting bug.
 */
import { errors } from './errors.js';

export const INVOICE_STATUSES = [
  'CREATED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  CREATED: ['PENDING', 'FAILED', 'EXPIRED'],
  PENDING: ['SUCCEEDED', 'FAILED', 'EXPIRED'],
  SUCCEEDED: ['REFUNDED'],
  FAILED: [],
  EXPIRED: [],
  REFUNDED: [],
};

const TERMINAL: readonly InvoiceStatus[] = ['FAILED', 'EXPIRED', 'REFUNDED'];

/** SUCCEEDED is terminal for forward flow but may still be refunded. */
export function isTerminal(status: InvoiceStatus): boolean {
  return TERMINAL.includes(status);
}

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) return true; // idempotent no-op
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): InvoiceStatus {
  if (!canTransition(from, to)) {
    throw errors.invalidTransition(`Illegal invoice transition: ${from} -> ${to}`, { from, to });
  }
  return to;
}

export function nextStatus(from: InvoiceStatus, to: InvoiceStatus): InvoiceStatus {
  if (from === to) return from;
  return assertTransition(from, to);
}

// --- Settlement (separate lifecycle) --------------------------------------

export const SETTLEMENT_STATUSES = ['NOT_STARTED', 'PROCESSING', 'SETTLED', 'DISCREPANCY'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

const SETTLEMENT_TRANSITIONS: Record<SettlementStatus, readonly SettlementStatus[]> = {
  NOT_STARTED: ['PROCESSING'],
  PROCESSING: ['SETTLED', 'DISCREPANCY'],
  SETTLED: [],
  DISCREPANCY: ['PROCESSING'],
};

export function canTransitionSettlement(from: SettlementStatus, to: SettlementStatus): boolean {
  if (from === to) return true;
  return SETTLEMENT_TRANSITIONS[from].includes(to);
}

export function assertSettlementTransition(
  from: SettlementStatus,
  to: SettlementStatus,
): SettlementStatus {
  if (!canTransitionSettlement(from, to)) {
    throw errors.invalidTransition(`Illegal settlement transition: ${from} -> ${to}`, {
      from,
      to,
    });
  }
  return to;
}
