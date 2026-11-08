/**
 * Modul: API — Audit service
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { newId } from '@baturpay/core';
import type { AuditRecord, Store } from '../store/types.js';

export interface AuditInput {
  workspaceId: string | null;
  actor: string;
  action: string;
  resource?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAudit(store: Store, input: AuditInput): Promise<AuditRecord> {
  const record: AuditRecord = {
    id: newId('aud'),
    workspaceId: input.workspaceId,
    actor: input.actor,
    action: input.action,
    resource: input.resource ?? null,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  };
  await store.recordAudit(record);
  return record;
}
