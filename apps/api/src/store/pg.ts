/**
 * Modul: API — Postgres store
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import type { Pool } from 'pg';
import type {
  ApiKeyRecord,
  AuditRecord,
  DeliveryPatch,
  EventRecord,
  IdempotencyPersist,
  InvoiceRecord,
  Page,
  RunRecord,
  Store,
  WebhookDeliveryRecord,
  WebhookEndpointRecord,
  Workspace,
} from './types.js';

interface Row {
  [key: string]: unknown;
}

const iso = (value: unknown): string => (value instanceof Date ? value.toISOString() : String(value));
const num = (value: unknown): number => Number(value);

function toWorkspace(r: Row): Workspace {
  return { id: String(r.id), name: String(r.name), environment: 'sandbox', createdAt: iso(r.created_at) };
}

function toApiKey(r: Row): ApiKeyRecord {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    keyPrefix: String(r.key_prefix),
    keyHash: String(r.key_hash),
    scopes: (r.scopes as string[]) ?? [],
    createdAt: iso(r.created_at),
    revokedAt: r.revoked_at ? iso(r.revoked_at) : null,
  };
}

function toInvoice(r: Row): InvoiceRecord {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    externalId: String(r.external_id),
    amountMinor: num(r.amount_minor),
    currency: String(r.currency),
    status: String(r.status),
    environment: 'sandbox',
    description: r.description === null ? null : String(r.description),
    scenario: r.scenario === null ? null : String(r.scenario),
    metadata: (r.metadata as Record<string, string>) ?? {},
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function toEvent(r: Row): EventRecord {
  return {
    eventId: String(r.event_id),
    workspaceId: String(r.workspace_id),
    invoiceId: String(r.invoice_id),
    type: String(r.type),
    sequence: num(r.sequence),
    occurredAt: iso(r.occurred_at),
    data: (r.data as Record<string, unknown>) ?? {},
  };
}

function toRun(r: Row): RunRecord {
  const payload = (r.payload as { events?: EventRecord[]; deliveries?: RunRecord['deliveries'] }) ?? {};
  return {
    runId: String(r.run_id),
    workspaceId: String(r.workspace_id),
    invoiceId: String(r.invoice_id),
    scenario: String(r.scenario),
    seed: String(r.seed),
    finalStatus: String(r.final_status),
    expectedSettleMinor: num(r.expected_settle_minor),
    events: payload.events ?? [],
    deliveries: payload.deliveries ?? [],
    createdAt: iso(r.created_at),
  };
}

function toEndpoint(r: Row): WebhookEndpointRecord {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    url: String(r.url),
    description: r.description === null ? null : String(r.description),
    signingSecret: String(r.signing_secret),
    status: (String(r.status) as WebhookEndpointRecord['status']) ?? 'ACTIVE',
    createdAt: iso(r.created_at),
  };
}

function toDelivery(r: Row): WebhookDeliveryRecord {
  return {
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    endpointId: String(r.endpoint_id),
    eventId: String(r.event_id),
    eventType: String(r.event_type),
    payload: (r.payload as Record<string, unknown>) ?? {},
    status: String(r.status) as WebhookDeliveryRecord['status'],
    attempts: num(r.attempts),
    scheduledAt: iso(r.scheduled_at),
    lastAttemptAt: r.last_attempt_at ? iso(r.last_attempt_at) : null,
    responseStatus: r.response_status === null || r.response_status === undefined ? null : num(r.response_status),
    error: r.error === null ? null : String(r.error),
    createdAt: iso(r.created_at),
  };
}

function toIdempotency(r: Row): IdempotencyPersist {
  return {
    keyHash: String(r.key_hash),
    workspaceId: String(r.workspace_id),
    operation: String(r.operation),
    requestFingerprint: String(r.request_fingerprint),
    responseStatus: num(r.response_status),
    responseBody: r.response_body,
    createdAt: iso(r.created_at),
  };
}

function toAudit(r: Row): AuditRecord {
  return {
    id: String(r.id),
    workspaceId: r.workspace_id === null ? null : String(r.workspace_id),
    actor: String(r.actor),
    action: String(r.action),
    resource: r.resource === null ? null : String(r.resource),
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: iso(r.created_at),
  };
}

export class PgStore implements Store {
  readonly kind = 'postgres' as const;

  constructor(private readonly pool: Pool) {}

  async ping(): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 AS ok');
    return res.rows.length === 1;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async createWorkspace(input: { id: string; name: string }): Promise<Workspace> {
    const res = await this.pool.query(
      'INSERT INTO workspaces (id, name) VALUES ($1, $2) RETURNING *',
      [input.id, input.name],
    );
    return toWorkspace(res.rows[0] as Row);
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    const res = await this.pool.query('SELECT * FROM workspaces WHERE id = $1', [id]);
    return res.rows[0] ? toWorkspace(res.rows[0] as Row) : null;
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const res = await this.pool.query('SELECT * FROM workspaces ORDER BY created_at');
    return res.rows.map((r) => toWorkspace(r as Row));
  }

  async createApiKey(input: ApiKeyRecord): Promise<ApiKeyRecord> {
    const res = await this.pool.query(
      `INSERT INTO api_keys (id, workspace_id, key_prefix, key_hash, scopes, created_at, revoked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [input.id, input.workspaceId, input.keyPrefix, input.keyHash, input.scopes, input.createdAt, input.revokedAt],
    );
    return toApiKey(res.rows[0] as Row);
  }

  async findApiKeyByPrefix(prefix: string): Promise<ApiKeyRecord | null> {
    const res = await this.pool.query('SELECT * FROM api_keys WHERE key_prefix = $1 LIMIT 1', [prefix]);
    return res.rows[0] ? toApiKey(res.rows[0] as Row) : null;
  }

  async listApiKeys(workspaceId: string): Promise<ApiKeyRecord[]> {
    const res = await this.pool.query('SELECT * FROM api_keys WHERE workspace_id = $1 ORDER BY created_at', [
      workspaceId,
    ]);
    return res.rows.map((r) => toApiKey(r as Row));
  }

  async createInvoice(input: InvoiceRecord): Promise<InvoiceRecord> {
    const res = await this.pool.query(
      `INSERT INTO invoices (id, workspace_id, external_id, amount_minor, currency, status, environment, description, scenario, metadata, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'sandbox',$7,$8,$9,$10,$11) RETURNING *`,
      [
        input.id,
        input.workspaceId,
        input.externalId,
        input.amountMinor,
        input.currency,
        input.status,
        input.description,
        input.scenario,
        JSON.stringify(input.metadata),
        input.createdAt,
        input.updatedAt,
      ],
    );
    return toInvoice(res.rows[0] as Row);
  }

  async getInvoice(workspaceId: string, id: string): Promise<InvoiceRecord | null> {
    const res = await this.pool.query('SELECT * FROM invoices WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
    return res.rows[0] ? toInvoice(res.rows[0] as Row) : null;
  }

  async getInvoiceByExternalId(workspaceId: string, externalId: string): Promise<InvoiceRecord | null> {
    const res = await this.pool.query(
      'SELECT * FROM invoices WHERE external_id = $1 AND workspace_id = $2 LIMIT 1',
      [externalId, workspaceId],
    );
    return res.rows[0] ? toInvoice(res.rows[0] as Row) : null;
  }

  async listInvoices(workspaceId: string, opts: { limit: number; cursor?: string }): Promise<Page<InvoiceRecord>> {
    const params: unknown[] = [workspaceId];
    let where = 'workspace_id = $1';
    if (opts.cursor) {
      params.push(opts.cursor);
      where += ` AND (created_at, id) < (SELECT created_at, id FROM invoices WHERE id = $${params.length})`;
    }
    params.push(opts.limit + 1);
    const res = await this.pool.query(
      `SELECT * FROM invoices WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    const rows = res.rows.map((r) => toInvoice(r as Row));
    const hasMore = rows.length > opts.limit;
    const data = hasMore ? rows.slice(0, opts.limit) : rows;
    return { data, nextCursor: hasMore ? data[data.length - 1]!.id : null };
  }

  async updateInvoiceStatus(workspaceId: string, id: string, status: string): Promise<InvoiceRecord | null> {
    const res = await this.pool.query(
      'UPDATE invoices SET status = $1, updated_at = now() WHERE id = $2 AND workspace_id = $3 RETURNING *',
      [status, id, workspaceId],
    );
    return res.rows[0] ? toInvoice(res.rows[0] as Row) : null;
  }

  async appendEvent(input: EventRecord): Promise<EventRecord> {
    const res = await this.pool.query(
      `INSERT INTO events (event_id, workspace_id, invoice_id, type, sequence, occurred_at, data)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        input.eventId,
        input.workspaceId,
        input.invoiceId,
        input.type,
        input.sequence,
        input.occurredAt,
        JSON.stringify(input.data),
      ],
    );
    return toEvent(res.rows[0] as Row);
  }

  async listEvents(workspaceId: string, invoiceId: string): Promise<EventRecord[]> {
    const res = await this.pool.query(
      'SELECT * FROM events WHERE workspace_id = $1 AND invoice_id = $2 ORDER BY sequence',
      [workspaceId, invoiceId],
    );
    return res.rows.map((r) => toEvent(r as Row));
  }

  async getEvent(workspaceId: string, eventId: string): Promise<EventRecord | null> {
    const res = await this.pool.query('SELECT * FROM events WHERE workspace_id = $1 AND event_id = $2', [
      workspaceId,
      eventId,
    ]);
    return res.rows[0] ? toEvent(res.rows[0] as Row) : null;
  }

  async saveRun(input: RunRecord): Promise<RunRecord> {
    const res = await this.pool.query(
      `INSERT INTO runs (run_id, workspace_id, invoice_id, scenario, seed, final_status, expected_settle_minor, payload, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        input.runId,
        input.workspaceId,
        input.invoiceId,
        input.scenario,
        input.seed,
        input.finalStatus,
        input.expectedSettleMinor,
        JSON.stringify({ events: input.events, deliveries: input.deliveries }),
        input.createdAt,
      ],
    );
    return toRun(res.rows[0] as Row);
  }

  async getRun(workspaceId: string, runId: string): Promise<RunRecord | null> {
    const res = await this.pool.query('SELECT * FROM runs WHERE workspace_id = $1 AND run_id = $2', [
      workspaceId,
      runId,
    ]);
    return res.rows[0] ? toRun(res.rows[0] as Row) : null;
  }

  async createWebhookEndpoint(input: WebhookEndpointRecord): Promise<WebhookEndpointRecord> {
    const res = await this.pool.query(
      `INSERT INTO webhook_endpoints (id, workspace_id, url, description, signing_secret, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [input.id, input.workspaceId, input.url, input.description, input.signingSecret, input.status, input.createdAt],
    );
    return toEndpoint(res.rows[0] as Row);
  }

  async listWebhookEndpoints(workspaceId: string): Promise<WebhookEndpointRecord[]> {
    const res = await this.pool.query(
      'SELECT * FROM webhook_endpoints WHERE workspace_id = $1 ORDER BY created_at',
      [workspaceId],
    );
    return res.rows.map((r) => toEndpoint(r as Row));
  }

  async getWebhookEndpoint(workspaceId: string, id: string): Promise<WebhookEndpointRecord | null> {
    const res = await this.pool.query(
      'SELECT * FROM webhook_endpoints WHERE id = $1 AND workspace_id = $2',
      [id, workspaceId],
    );
    return res.rows[0] ? toEndpoint(res.rows[0] as Row) : null;
  }

  async createDeliveries(input: WebhookDeliveryRecord[]): Promise<WebhookDeliveryRecord[]> {
    const out: WebhookDeliveryRecord[] = [];
    for (const d of input) {
      const res = await this.pool.query(
        `INSERT INTO webhook_deliveries (id, workspace_id, endpoint_id, event_id, event_type, payload, status, attempts, scheduled_at, last_attempt_at, response_status, error, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
        [
          d.id,
          d.workspaceId,
          d.endpointId,
          d.eventId,
          d.eventType,
          JSON.stringify(d.payload),
          d.status,
          d.attempts,
          d.scheduledAt,
          d.lastAttemptAt,
          d.responseStatus,
          d.error,
          d.createdAt,
        ],
      );
      out.push(toDelivery(res.rows[0] as Row));
    }
    return out;
  }

  async listDeliveries(workspaceId: string, opts: { limit: number }): Promise<WebhookDeliveryRecord[]> {
    const res = await this.pool.query(
      'SELECT * FROM webhook_deliveries WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2',
      [workspaceId, opts.limit],
    );
    return res.rows.map((r) => toDelivery(r as Row));
  }

  async getDelivery(workspaceId: string, id: string): Promise<WebhookDeliveryRecord | null> {
    const res = await this.pool.query('SELECT * FROM webhook_deliveries WHERE id = $1 AND workspace_id = $2', [
      id,
      workspaceId,
    ]);
    return res.rows[0] ? toDelivery(res.rows[0] as Row) : null;
  }

  async dueDeliveries(nowIso: string, limit: number): Promise<WebhookDeliveryRecord[]> {
    const res = await this.pool.query(
      `SELECT * FROM webhook_deliveries WHERE status = 'PENDING' AND scheduled_at <= $1 ORDER BY scheduled_at LIMIT $2`,
      [nowIso, limit],
    );
    return res.rows.map((r) => toDelivery(r as Row));
  }

  async updateDelivery(id: string, patch: DeliveryPatch): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const set = (col: string, value: unknown): void => {
      params.push(value);
      sets.push(`${col} = $${params.length}`);
    };
    if (patch.status !== undefined) set('status', patch.status);
    if (patch.attempts !== undefined) set('attempts', patch.attempts);
    if (patch.lastAttemptAt !== undefined) set('last_attempt_at', patch.lastAttemptAt);
    if (patch.responseStatus !== undefined) set('response_status', patch.responseStatus);
    if (patch.error !== undefined) set('error', patch.error);
    if (patch.scheduledAt !== undefined) set('scheduled_at', patch.scheduledAt);
    if (sets.length === 0) return;
    params.push(id);
    await this.pool.query(`UPDATE webhook_deliveries SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
  }

  async getIdempotency(keyHash: string): Promise<IdempotencyPersist | null> {
    const res = await this.pool.query('SELECT * FROM idempotency_keys WHERE key_hash = $1', [keyHash]);
    return res.rows[0] ? toIdempotency(res.rows[0] as Row) : null;
  }

  async putIdempotency(record: IdempotencyPersist): Promise<void> {
    await this.pool.query(
      `INSERT INTO idempotency_keys (key_hash, workspace_id, operation, request_fingerprint, response_status, response_body, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (key_hash) DO NOTHING`,
      [
        record.keyHash,
        record.workspaceId,
        record.operation,
        record.requestFingerprint,
        record.responseStatus,
        JSON.stringify(record.responseBody),
        record.createdAt,
      ],
    );
  }

  async recordAudit(record: AuditRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_events (id, workspace_id, actor, action, resource, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [record.id, record.workspaceId, record.actor, record.action, record.resource, JSON.stringify(record.metadata), record.createdAt],
    );
  }

  async listAudit(workspaceId: string | null, limit: number): Promise<AuditRecord[]> {
    const res = workspaceId
      ? await this.pool.query('SELECT * FROM audit_events WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2', [
          workspaceId,
          limit,
        ])
      : await this.pool.query('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT $1', [limit]);
    return res.rows.map((r) => toAudit(r as Row));
  }
}
