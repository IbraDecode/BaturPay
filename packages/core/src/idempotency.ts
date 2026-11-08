/**
 * Modul: Core — Idempotency
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Rules enforced here:
 *  - The same idempotency key with the same request body returns the original result.
 *  - The same key with a DIFFERENT body is a hard conflict (prevents silent data loss).
 *  - Keys are scoped to (workspace, operation) so tenants cannot collide.
 */
import { errors } from './errors.js';
import { canonicalJson, sha256Hex } from './hashing.js';

export const IDEMPOTENT_OPERATIONS = ['create_invoice', 'run_scenario', 'retry_webhook'] as const;
export type IdempotentOperation = (typeof IDEMPOTENT_OPERATIONS)[number];

export interface IdempotencyScope {
  workspaceId: string;
  operation: IdempotentOperation;
  key: string;
}

export function assertIdempotencyKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed.length < 8 || trimmed.length > 255) {
    throw errors.validation('idempotency key must be 8..255 characters', {
      length: trimmed.length,
    });
  }
}

export function idempotencyKeyHash(scope: IdempotencyScope): string {
  assertIdempotencyKey(scope.key);
  return sha256Hex(`${scope.workspaceId}:${scope.operation}:${scope.key}`);
}

export function requestFingerprint(payload: unknown): string {
  return sha256Hex(canonicalJson(payload));
}

export interface IdempotencyRecordView {
  keyHash: string;
  requestFingerprint: string;
  responseStatus: number;
  responseBody: unknown;
}

export type IdempotencyDecision =
  | { kind: 'fresh' }
  | { kind: 'replay'; record: IdempotencyRecordView }
  | { kind: 'conflict' };

export function decideIdempotency(
  existing: IdempotencyRecordView | null,
  incomingFingerprint: string,
): IdempotencyDecision {
  if (!existing) return { kind: 'fresh' };
  if (existing.requestFingerprint === incomingFingerprint) {
    return { kind: 'replay', record: existing };
  }
  return { kind: 'conflict' };
}

export function assertNoConflict(decision: IdempotencyDecision): void {
  if (decision.kind === 'conflict') {
    throw errors.idempotencyConflict(
      'Idempotency key was reused with a different request body',
    );
  }
}
