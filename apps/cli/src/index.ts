/**
 * Modul: CLI — BaturPay developer CLI
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Thin, scriptable client for the sandbox API. No money moves; no live calls.
 * Everything it does is reproducible from CI.
 */
import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import { randomHex, type EventEnvelope } from '@baturpay/core';
import { ApiClient } from './http.js';

const API_URL = process.env.BATURPAY_API_URL ?? 'http://localhost:4000';
const API_KEY = process.env.BATURPAY_API_KEY;

function client(): ApiClient {
  return new ApiClient({ baseUrl: API_URL, apiKey: API_KEY });
}

function requireKey(): string {
  if (!API_KEY) {
    throw new Error('BATURPAY_API_KEY is not set. Run `baturpay bootstrap --name demo` or export a key.');
  }
  return API_KEY;
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function newIdempotencyKey(): string {
  return randomHex(16);
}

interface RunResponse {
  runId: string;
  scenario: string;
  finalStatus: string;
  expectedSettleMinor: number;
  events: EventEnvelope[];
  deliveries: Array<{ deliveryId: string; eventType: string; scheduledAt: string; duplicate: boolean }>;
}

function toJUnit(run: RunResponse): string {
  const cases = run.events
    .map(
      (e) =>
        `    <testcase classname="baturpay.${run.scenario}" name="${e.sequence}-${e.type}"/>`,
    )
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="baturpay.${run.scenario}" tests="${run.events.length}" failures="0">`,
    cases,
    '</testsuite>',
    '',
  ].join('\n');
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('baturpay')
    .description('BaturPay sandbox developer CLI')
    .version('0.1.0');

  program
    .command('health')
    .description('Show API health and mode gate status')
    .action(async () => {
      const api = new ApiClient({ baseUrl: API_URL });
      printJson(await api.get('/health'));
    });

  program
    .command('bootstrap')
    .description('Create the first sandbox workspace and print its API key (once)')
    .requiredOption('--name <name>', 'workspace name')
    .action(async (opts: { name: string }) => {
      const api = new ApiClient({ baseUrl: API_URL });
      printJson(await api.post('/v1/workspaces', { name: opts.name }));
    });

  program
    .command('scenarios')
    .description('List available failure-first simulation scenarios')
    .action(async () => {
      requireKey();
      printJson(await client().get('/v1/scenarios'));
    });

  program
    .command('invoice:create')
    .description('Create a sandbox invoice')
    .requiredOption('--external-id <id>', 'your invoice reference')
    .requiredOption('--amount <minor>', 'amount in minor units (e.g. rupiah)')
    .option('--currency <code>', 'ISO-4217 currency', 'IDR')
    .option('--description <text>')
    .option('--scenario <name>')
    .action(async (opts: { externalId: string; amount: string; currency: string; description?: string; scenario?: string }) => {
      requireKey();
      const invoice = await client().post(
        '/v1/invoices',
        {
          externalId: opts.externalId,
          amountMinor: Number(opts.amount),
          currency: opts.currency,
          description: opts.description,
          scenario: opts.scenario,
        },
        { 'idempotency-key': newIdempotencyKey() },
      );
      printJson(invoice);
    });

  program
    .command('invoice:get <id>')
    .description('Retrieve an invoice')
    .action(async (id: string) => {
      requireKey();
      printJson(await client().get(`/v1/invoices/${id}`));
    });

  program
    .command('events <invoiceId>')
    .description('List the event stream for an invoice')
    .action(async (invoiceId: string) => {
      requireKey();
      printJson(await client().get(`/v1/invoices/${invoiceId}/events`));
    });

  program
    .command('run')
    .description('Run a scenario against an invoice')
    .requiredOption('--invoice <id>', 'invoice id')
    .requiredOption('--scenario <name>', 'scenario name')
    .option('--seed <seed>', 'deterministic seed')
    .option('--export <file>', 'write a JUnit report to this path')
    .action(async (opts: { invoice: string; scenario: string; seed?: string; export?: string }) => {
      requireKey();
      const run = await client().post<RunResponse>(
        '/v1/runs',
        { invoiceId: opts.invoice, scenario: opts.scenario, seed: opts.seed },
        { 'idempotency-key': newIdempotencyKey() },
      );
      if (opts.export) {
        writeFileSync(opts.export, toJUnit(run), 'utf8');
        console.log(`wrote ${opts.export}`);
      }
      printJson({ runId: run.runId, finalStatus: run.finalStatus, events: run.events.length, deliveries: run.deliveries.length });
    });

  program
    .command('endpoint:add')
    .description('Register a webhook endpoint (SSRF-guarded)')
    .requiredOption('--url <url>', 'https endpoint to receive webhooks')
    .option('--description <text>')
    .action(async (opts: { url: string; description?: string }) => {
      requireKey();
      printJson(await client().post('/v1/webhook-endpoints', { url: opts.url, description: opts.description }));
    });

  program
    .command('deliveries')
    .description('List recent webhook delivery attempts')
    .action(async () => {
      requireKey();
      printJson(await client().get('/v1/webhook-deliveries'));
    });

  program
    .command('dispatch')
    .description('Run one webhook dispatch tick (deliver any due webhooks)')
    .action(async () => {
      requireKey();
      printJson(await client().post('/v1/admin/dispatch-tick'));
    });

  program
    .command('key:create')
    .description('Mint an additional sandbox API key (shown once)')
    .action(async () => {
      requireKey();
      printJson(await client().post('/v1/keys'));
    });

  program
    .command('audit')
    .description('List recent audit events')
    .action(async () => {
      requireKey();
      printJson(await client().get('/v1/audit'));
    });

  return program;
}

const isMain = process.argv[1] !== undefined && /index\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  buildProgram()
    .parseAsync(process.argv)
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
}
