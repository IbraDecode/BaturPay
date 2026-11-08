/**
 * Modul: API — Invoice service
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import {
  errors,
  idempotencyKeyHash,
  newId,
  positiveMoney,
  requestFingerprint,
} from '@baturpay/core';
import { createInvoiceRequestSchema, type CreateInvoiceRequest } from '@baturpay/contracts';
import { toInvoiceDto } from '../dto.js';
import type { InvoiceRecord, Page, Store } from '../store/types.js';
import { recordAudit } from './audit.js';

export interface CreateInvoiceInput {
  workspaceId: string;
  actor: string;
  idempotencyKey: string;
  body: unknown;
}

export type CreateInvoiceResult =
  | { outcome: 'created'; status: 201; invoice: ReturnType<typeof toInvoiceDto> }
  | { outcome: 'replayed'; status: number; invoice: unknown };

export async function createInvoice(store: Store, input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const parsed: CreateInvoiceRequest = createInvoiceRequestSchema.parse(input.body);
  const amount = positiveMoney(parsed.amountMinor, parsed.currency ?? 'IDR');

  const keyHash = idempotencyKeyHash({
    workspaceId: input.workspaceId,
    operation: 'create_invoice',
    key: input.idempotencyKey,
  });
  const fingerprint = requestFingerprint(parsed);

  const existing = await store.getIdempotency(keyHash);
  if (existing) {
    if (existing.requestFingerprint !== fingerprint) {
      throw errors.idempotencyConflict('Idempotency key was reused with a different request body');
    }
    return { outcome: 'replayed', status: existing.responseStatus, invoice: existing.responseBody };
  }

  const duplicate = await store.getInvoiceByExternalId(input.workspaceId, parsed.externalId);
  if (duplicate) {
    throw errors.conflict('An invoice with this externalId already exists', {
      externalId: parsed.externalId,
    });
  }

  const now = new Date().toISOString();
  const record: InvoiceRecord = {
    id: newId('inv'),
    workspaceId: input.workspaceId,
    externalId: parsed.externalId,
    amountMinor: amount.amountMinor,
    currency: amount.currency,
    status: 'CREATED',
    environment: 'sandbox',
    description: parsed.description ?? null,
    scenario: parsed.scenario ?? null,
    metadata: parsed.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
  await store.createInvoice(record);

  const dto = toInvoiceDto(record);
  await store.putIdempotency({
    keyHash,
    workspaceId: input.workspaceId,
    operation: 'create_invoice',
    requestFingerprint: fingerprint,
    responseStatus: 201,
    responseBody: dto,
    createdAt: now,
  });
  await recordAudit(store, {
    workspaceId: input.workspaceId,
    actor: input.actor,
    action: 'invoice.created',
    resource: record.id,
    metadata: { externalId: record.externalId, amountMinor: record.amountMinor },
  });

  return { outcome: 'created', status: 201, invoice: dto };
}

export async function getInvoiceOrThrow(store: Store, workspaceId: string, id: string): Promise<InvoiceRecord> {
  const invoice = await store.getInvoice(workspaceId, id);
  if (!invoice) throw errors.notFound('Invoice not found', { id });
  return invoice;
}

export async function listInvoices(
  store: Store,
  workspaceId: string,
  opts: { limit: number; cursor?: string },
): Promise<Page<InvoiceRecord>> {
  return store.listInvoices(workspaceId, opts);
}
