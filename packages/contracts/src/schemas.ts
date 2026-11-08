/**
 * Modul: Contracts — Zod schemas (single source of truth)
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * These schemas are the authoritative shapes. The OpenAPI document, the CLI
 * types, and the test fixtures are all derived from / validated against them,
 * so documentation cannot silently drift from behaviour.
 */
import { z } from 'zod';

export const CONTRACT_VERSION = '2026-11-09';
export const API_PREFIX = '/v1';

export const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'ISO-4217 currency code');

export const moneySchema = z.object({
  amountMinor: z.number().int().safe(),
  currency: currencySchema,
});

export const invoiceStatusSchema = z.enum([
  'CREATED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
]);

export const settlementStatusSchema = z.enum([
  'NOT_STARTED',
  'PROCESSING',
  'SETTLED',
  'DISCREPANCY',
]);

export const createInvoiceRequestSchema = z.object({
  externalId: z.string().min(1).max(128),
  amountMinor: z.number().int().positive(),
  currency: currencySchema.default('IDR'),
  description: z.string().max(500).optional(),
  scenario: z.string().min(1).max(64).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const invoiceSchema = z.object({
  id: z.string().regex(/^inv_/),
  workspaceId: z.string().regex(/^ws_/),
  externalId: z.string(),
  amountMinor: z.number().int().positive(),
  currency: currencySchema,
  status: invoiceStatusSchema,
  environment: z.literal('sandbox'),
  description: z.string().nullable(),
  scenario: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const eventSchema = z.object({
  eventId: z.string().regex(/^evt_/),
  type: z.enum([
    'invoice.created',
    'invoice.pending',
    'payment.succeeded',
    'payment.failed',
    'invoice.expired',
    'payment.refunded',
  ]),
  workspaceId: z.string().regex(/^ws_/),
  invoiceId: z.string().regex(/^inv_/),
  sequence: z.number().int().positive(),
  occurredAt: z.string().datetime(),
  data: z.record(z.string(), z.unknown()),
});

export const runScenarioRequestSchema = z.object({
  invoiceId: z.string().regex(/^inv_/),
  scenario: z.string().min(1).max(64),
  seed: z.string().min(1).max(128).optional(),
});

export const scenarioRunSchema = z.object({
  runId: z.string().regex(/^run_/),
  scenario: z.string(),
  seed: z.string(),
  invoiceId: z.string().regex(/^inv_/),
  finalStatus: invoiceStatusSchema,
  expectedSettleMinor: z.number().int(),
  events: z.array(eventSchema),
  deliveries: z.array(
    z.object({
      deliveryId: z.string().regex(/^dlv_/),
      eventId: z.string().regex(/^evt_/),
      eventType: z.string(),
      order: z.number().int().positive(),
      scheduledAt: z.string().datetime(),
      duplicate: z.boolean(),
    }),
  ),
  createdAt: z.string().datetime(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const healthSchema = z.object({
  status: z.literal('ok'),
  mode: z.enum(['sandbox', 'production']),
  liveGateOpen: z.boolean(),
  contractVersion: z.string(),
  uptimeSeconds: z.number().nonnegative(),
});

export type CreateInvoiceRequest = z.infer<typeof createInvoiceRequestSchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type EventDto = z.infer<typeof eventSchema>;
export type RunScenarioRequest = z.infer<typeof runScenarioRequestSchema>;
export type ScenarioRun = z.infer<typeof scenarioRunSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type Health = z.infer<typeof healthSchema>;
