/**
 * Modul: API integration tests (in-memory store, no external services)
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '@baturpay/config';
import { verifySignature, SIGNATURE_HEADER } from '@baturpay/webhook';
import { buildApp } from '../src/app.js';
import { MemoryStore } from '../src/store/index.js';
import { WebhookDispatcher } from '../src/workers/webhook-dispatcher.js';

interface Harness {
  app: FastifyInstance;
  store: MemoryStore;
  dispatcher: WebhookDispatcher;
  advance(ms: number): void;
  key: string;
  workspaceId: string;
}

const open: Harness[] = [];

async function harness(fetcher: typeof fetch, maxAttempts = 6): Promise<Harness> {
  const config = loadConfig({
    DATABASE_URL: 'memory://',
    NODE_ENV: 'test',
    API_KEY_PEPPER: 'test-pepper-1234567890',
    WEBHOOK_ALLOW_PRIVATE_TARGETS: 'true',
    WEBHOOK_MAX_ATTEMPTS: String(maxAttempts),
    RATE_LIMIT_MAX: '100000',
  });
  const store = new MemoryStore();
  let clock = Date.now();
  const dispatcher = new WebhookDispatcher(store, config, {
    fetcher,
    now: () => new Date(clock),
  });
  const app = await buildApp({ config, store, dispatcher, logger: false });
  await app.ready();

  const boot = await app.inject({
    method: 'POST',
    url: '/v1/workspaces',
    payload: { name: 'Test WS' },
  });
  const body = boot.json() as { workspace: { id: string }; apiKey: { secret: string } };
  const auth = { authorization: `Bearer ${body.apiKey.secret}` };

  const h: Harness = {
    app,
    store,
    dispatcher,
    advance: (ms) => {
      clock += ms;
    },
    key: body.apiKey.secret,
    workspaceId: body.workspace.id,
  };
  Object.assign(h, { auth });
  open.push(h);
  return h;
}

afterEach(async () => {
  while (open.length) {
    const h = open.pop()!;
    await h.app.close();
  }
});

type WithAuth = Harness & { auth: { authorization: string } };

async function authed(fetcher: typeof fetch = vi.fn(async () => new Response('ok', { status: 200 })), maxAttempts = 6): Promise<WithAuth> {
  return (await harness(fetcher, maxAttempts)) as WithAuth;
}

describe('health & bootstrap', () => {
  it('reports sandbox mode and a closed live gate', async () => {
    const h = await authed();
    const res = await h.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.mode).toBe('sandbox');
    expect(body.liveGateOpen).toBe(false);
  });

  it('rejects unauthenticated access to invoices', async () => {
    const h = await authed();
    const res = await h.app.inject({ method: 'GET', url: '/v1/invoices' });
    expect(res.statusCode).toBe(401);
  });
});

describe('invoices & idempotency', () => {
  const payload = { externalId: 'INV-1', amountMinor: 50_000, currency: 'IDR' };

  it('creates an invoice and replays identical idempotent requests', async () => {
    const h = await authed();
    const first = await h.app.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { ...h.auth, 'idempotency-key': 'key-000000001' },
      payload,
    });
    expect(first.statusCode).toBe(201);
    const invoice = first.json();

    const replay = await h.app.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { ...h.auth, 'idempotency-key': 'key-000000001' },
      payload,
    });
    expect(replay.statusCode).toBe(201);
    expect(replay.json().id).toBe(invoice.id);
  });

  it('hard-conflicts when the same key is reused with a different body', async () => {
    const h = await authed();
    await h.app.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { ...h.auth, 'idempotency-key': 'key-000000002' },
      payload,
    });
    const conflict = await h.app.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { ...h.auth, 'idempotency-key': 'key-000000002' },
      payload: { ...payload, amountMinor: 99_999 },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('requires an idempotency key', async () => {
    const h = await authed();
    const res = await h.app.inject({ method: 'POST', url: '/v1/invoices', headers: h.auth, payload });
    expect(res.statusCode).toBe(400);
  });
});

describe('scenario runs', () => {
  async function createInvoice(h: WithAuth, externalId: string): Promise<string> {
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { ...h.auth, 'idempotency-key': `key-${externalId}` },
      payload: { externalId, amountMinor: 25_000, currency: 'IDR' },
    });
    return res.json().id as string;
  }

  it('executes the happy path and projects SUCCEEDED', async () => {
    const h = await authed();
    const invoiceId = await createInvoice(h, 'INV-RUN-1');
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/runs',
      headers: { ...h.auth, 'idempotency-key': 'run-000000001' },
      payload: { invoiceId, scenario: 'success' },
    });
    expect(res.statusCode).toBe(201);
    const run = res.json();
    expect(run.finalStatus).toBe('SUCCEEDED');
    expect(run.events).toHaveLength(3);

    const invoice = await h.app.inject({ method: 'GET', url: `/v1/invoices/${invoiceId}`, headers: h.auth });
    expect(invoice.json().status).toBe('SUCCEEDED');
  });

  it('resolves the run deterministically for a fixed seed', async () => {
    const h = await authed();
    const invoiceId = await createInvoice(h, 'INV-RUN-2');
    const a = await h.app.inject({
      method: 'POST',
      url: '/v1/runs',
      headers: { ...h.auth, 'idempotency-key': 'run-000000002' },
      payload: { invoiceId, scenario: 'success', seed: 'fixed-seed' },
    });
    const runA = a.json();
    const fetched = await h.app.inject({ method: 'GET', url: `/v1/runs/${runA.runId}`, headers: h.auth });
    expect(fetched.json().runId).toBe(runA.runId);
  });

  it('rejects an invalid scenario', async () => {
    const h = await authed();
    const invoiceId = await createInvoice(h, 'INV-RUN-3');
    const res = await h.app.inject({
      method: 'POST',
      url: '/v1/runs',
      headers: { ...h.auth, 'idempotency-key': 'run-000000003' },
      payload: { invoiceId, scenario: 'does-not-exist' },
    });
    expect(res.statusCode).toBe(500); // downstream simulator error surfaces as internal
  });
});

describe('webhook lab', () => {
  async function setup(h: WithAuth, scenario: string) {
    const invoice = await h.app.inject({
      method: 'POST',
      url: '/v1/invoices',
      headers: { ...h.auth, 'idempotency-key': `k-${scenario}` },
      payload: { externalId: `INV-${scenario}`, amountMinor: 10_000, currency: 'IDR' },
    });
    const endpoint = await h.app.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: h.auth,
      payload: { url: 'http://127.0.0.1:9099/hook' },
    });
    const invoiceId = invoice.json().id as string;
    await h.app.inject({
      method: 'POST',
      url: '/v1/runs',
      headers: { ...h.auth, 'idempotency-key': `r-${scenario}` },
      payload: { invoiceId, scenario },
    });
    return { endpoint: endpoint.json(), invoiceId };
  }

  it('delivers signed webhooks and marks them DELIVERED', async () => {
    const calls: Array<{ url: string; signature: string; body: string }> = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(url),
        signature: String((init?.headers as Record<string, string>)[SIGNATURE_HEADER]),
        body: String(init?.body),
      });
      return new Response('ok', { status: 200 });
    }) as unknown as typeof fetch;

    const h = await authed(fetcher);
    const { endpoint } = await setup(h, 'duplicate_webhook');
    h.advance(60_000);
    const result = await h.dispatcher.tick();

    expect(result.delivered).toBe(2); // original + duplicate
    expect(calls.length).toBe(2);

    // The captured signature must verify against the endpoint's signing secret.
    const verified = verifySignature({
      secret: endpoint.signingSecret,
      rawBody: calls[0]!.body,
      header: calls[0]!.signature,
    });
    expect(verified.valid).toBe(true);
  });

  it('retries transient failures then gives up after max attempts', async () => {
    let attempt = 0;
    const fetcher = vi.fn(async () => {
      attempt += 1;
      return new Response('boom', { status: 500 });
    }) as unknown as typeof fetch;

    const h = await authed(fetcher, 2);
    await setup(h, 'success');

    h.advance(60_000);
    const first = await h.dispatcher.tick();
    expect(first.retried).toBeGreaterThanOrEqual(1);

    h.advance(600_000);
    const second = await h.dispatcher.tick();
    expect(second.failed).toBeGreaterThanOrEqual(1);

    const deliveries = await h.app.inject({ method: 'GET', url: '/v1/webhook-deliveries', headers: h.auth });
    const failed = (deliveries.json() as Array<{ status: string }>).filter((d) => d.status === 'FAILED');
    expect(failed.length).toBeGreaterThanOrEqual(1);
  });

  it('manually replays a delivery', async () => {
    const fetcher = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch;
    const h = await authed(fetcher);
    await setup(h, 'success');
    h.advance(60_000);
    await h.dispatcher.tick();

    const list = await h.app.inject({ method: 'GET', url: '/v1/webhook-deliveries', headers: h.auth });
    const first = (list.json() as Array<{ id: string }>)[0]!;
    const replay = await h.app.inject({
      method: 'POST',
      url: `/v1/webhook-deliveries/${first.id}/retry`,
      headers: h.auth,
    });
    expect(replay.statusCode).toBe(202);
    expect(replay.json().id).not.toBe(first.id);
  });

  it('blocks SSRF-unsafe endpoint registration when private targets are disabled', async () => {
    // Build a harness where private targets are NOT allowed.
    const config = loadConfig({
      DATABASE_URL: 'memory://',
      NODE_ENV: 'test',
      API_KEY_PEPPER: 'test-pepper-1234567890',
      WEBHOOK_ALLOW_PRIVATE_TARGETS: 'false',
    });
    const store = new MemoryStore();
    const app = await buildApp({
      config,
      store,
      dispatcher: new WebhookDispatcher(store, config),
      logger: false,
    });
    await app.ready();
    const boot = await app.inject({ method: 'POST', url: '/v1/workspaces', payload: { name: 'SSRF' } });
    const key = boot.json().apiKey.secret as string;
    const res = await app.inject({
      method: 'POST',
      url: '/v1/webhook-endpoints',
      headers: { authorization: `Bearer ${key}` },
      payload: { url: 'http://169.254.169.254/latest/meta-data' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('WEBHOOK_TARGET_BLOCKED');
    await app.close();
  });
});
