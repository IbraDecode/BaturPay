/**
 * Modul: Contracts tests
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONTRACT_VERSION,
  createInvoiceRequestSchema,
  invoiceSchema,
  scenarioRunSchema,
} from '../src/index.js';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8'));

const openapi = () =>
  JSON.parse(readFileSync(fileURLToPath(new URL('../openapi.json', import.meta.url)), 'utf8'));

describe('contract fixtures', () => {
  it('create-invoice request matches its schema', () => {
    expect(createInvoiceRequestSchema.parse(fixture('create-invoice.request.json'))).toBeTruthy();
  });

  it('invoice response matches its schema', () => {
    expect(invoiceSchema.parse(fixture('invoice.response.json'))).toBeTruthy();
  });

  it('scenario-run response matches its schema', () => {
    const parsed = scenarioRunSchema.parse(fixture('scenario-run.response.json'));
    expect(parsed.deliveries.some((d) => d.duplicate)).toBe(true);
  });

  it('rejects an invoice with a zero amount', () => {
    const bad = { ...(fixture('invoice.response.json') as Record<string, unknown>), amountMinor: 0 };
    expect(() => invoiceSchema.parse(bad)).toThrow();
  });
});

describe('openapi document', () => {
  it('parses and matches the contract version', () => {
    const doc = openapi();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.version).toBe(CONTRACT_VERSION);
  });

  it('documents the core endpoints', () => {
    const doc = openapi();
    for (const path of [
      '/health',
      '/v1/invoices',
      '/v1/invoices/{id}',
      '/v1/invoices/{id}/events',
      '/v1/runs',
      '/v1/webhook-endpoints',
      '/v1/contracts',
    ]) {
      expect(Object.keys(doc.paths)).toContain(path);
    }
  });

  it('declares an idempotency header on invoice creation', () => {
    const doc = openapi();
    const params = doc.paths['/v1/invoices'].post.parameters as Array<{ name: string }>;
    expect(params.map((p) => p.name)).toContain('Idempotency-Key');
  });
});
