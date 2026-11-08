/**
 * Modul: API — In-memory store
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Used for hermetic tests and `BATURPAY_MODE=sandbox` demo where no database is
 * configured. Semantics mirror the Postgres store; data is process-local.
 */
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

export class MemoryStore implements Store {
  readonly kind = 'memory' as const;

  private workspaces = new Map<string, Workspace>();
  private apiKeys = new Map<string, ApiKeyRecord>();
  private invoices = new Map<string, InvoiceRecord>();
  private events = new Map<string, EventRecord>();
  private runs = new Map<string, RunRecord>();
  private endpoints = new Map<string, WebhookEndpointRecord>();
  private deliveries = new Map<string, WebhookDeliveryRecord>();
  private idempotency = new Map<string, IdempotencyPersist>();
  private audit: AuditRecord[] = [];

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    /* nothing to release */
  }

  async createWorkspace(input: { id: string; name: string }): Promise<Workspace> {
    const ws: Workspace = {
      id: input.id,
      name: input.name,
      environment: 'sandbox',
      createdAt: new Date().toISOString(),
    };
    this.workspaces.set(input.id, ws);
    return ws;
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    return this.workspaces.get(id) ?? null;
  }

  async listWorkspaces(): Promise<Workspace[]> {
    return [...this.workspaces.values()];
  }

  async createApiKey(input: ApiKeyRecord): Promise<ApiKeyRecord> {
    this.apiKeys.set(input.id, input);
    return input;
  }

  async findApiKeyByPrefix(prefix: string): Promise<ApiKeyRecord | null> {
    for (const key of this.apiKeys.values()) {
      if (key.keyPrefix === prefix) return key;
    }
    return null;
  }

  async listApiKeys(workspaceId: string): Promise<ApiKeyRecord[]> {
    return [...this.apiKeys.values()].filter((k) => k.workspaceId === workspaceId);
  }

  async createInvoice(input: InvoiceRecord): Promise<InvoiceRecord> {
    this.invoices.set(input.id, input);
    return input;
  }

  async getInvoice(workspaceId: string, id: string): Promise<InvoiceRecord | null> {
    const found = this.invoices.get(id);
    if (!found || found.workspaceId !== workspaceId) return null;
    return found;
  }

  async getInvoiceByExternalId(workspaceId: string, externalId: string): Promise<InvoiceRecord | null> {
    for (const inv of this.invoices.values()) {
      if (inv.workspaceId === workspaceId && inv.externalId === externalId) return inv;
    }
    return null;
  }

  async listInvoices(workspaceId: string, opts: { limit: number; cursor?: string }): Promise<Page<InvoiceRecord>> {
    const all = [...this.invoices.values()]
      .filter((i) => i.workspaceId === workspaceId)
      .sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));
    return paginate(all, opts.limit, opts.cursor);
  }

  async updateInvoiceStatus(workspaceId: string, id: string, status: string): Promise<InvoiceRecord | null> {
    const found = await this.getInvoice(workspaceId, id);
    if (!found) return null;
    const updated: InvoiceRecord = { ...found, status, updatedAt: new Date().toISOString() };
    this.invoices.set(id, updated);
    return updated;
  }

  async appendEvent(input: EventRecord): Promise<EventRecord> {
    this.events.set(input.eventId, input);
    return input;
  }

  async listEvents(workspaceId: string, invoiceId: string): Promise<EventRecord[]> {
    return [...this.events.values()]
      .filter((e) => e.workspaceId === workspaceId && e.invoiceId === invoiceId)
      .sort((a, b) => a.sequence - b.sequence);
  }

  async getEvent(workspaceId: string, eventId: string): Promise<EventRecord | null> {
    const found = this.events.get(eventId);
    if (!found || found.workspaceId !== workspaceId) return null;
    return found;
  }

  async saveRun(input: RunRecord): Promise<RunRecord> {
    this.runs.set(input.runId, input);
    return input;
  }

  async getRun(workspaceId: string, runId: string): Promise<RunRecord | null> {
    const found = this.runs.get(runId);
    if (!found || found.workspaceId !== workspaceId) return null;
    return found;
  }

  async createWebhookEndpoint(input: WebhookEndpointRecord): Promise<WebhookEndpointRecord> {
    this.endpoints.set(input.id, input);
    return input;
  }

  async listWebhookEndpoints(workspaceId: string): Promise<WebhookEndpointRecord[]> {
    return [...this.endpoints.values()].filter((e) => e.workspaceId === workspaceId);
  }

  async getWebhookEndpoint(workspaceId: string, id: string): Promise<WebhookEndpointRecord | null> {
    const found = this.endpoints.get(id);
    if (!found || found.workspaceId !== workspaceId) return null;
    return found;
  }

  async createDeliveries(input: WebhookDeliveryRecord[]): Promise<WebhookDeliveryRecord[]> {
    for (const d of input) this.deliveries.set(d.id, d);
    return input;
  }

  async listDeliveries(workspaceId: string, opts: { limit: number }): Promise<WebhookDeliveryRecord[]> {
    return [...this.deliveries.values()]
      .filter((d) => d.workspaceId === workspaceId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, opts.limit);
  }

  async getDelivery(workspaceId: string, id: string): Promise<WebhookDeliveryRecord | null> {
    const found = this.deliveries.get(id);
    if (!found || found.workspaceId !== workspaceId) return null;
    return found;
  }

  async dueDeliveries(nowIso: string, limit: number): Promise<WebhookDeliveryRecord[]> {
    return [...this.deliveries.values()]
      .filter((d) => d.status === 'PENDING' && d.scheduledAt <= nowIso)
      .sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1))
      .slice(0, limit);
  }

  async updateDelivery(id: string, patch: DeliveryPatch): Promise<void> {
    const found = this.deliveries.get(id);
    if (!found) return;
    this.deliveries.set(id, { ...found, ...patch });
  }

  async getIdempotency(keyHash: string): Promise<IdempotencyPersist | null> {
    return this.idempotency.get(keyHash) ?? null;
  }

  async putIdempotency(record: IdempotencyPersist): Promise<void> {
    this.idempotency.set(record.keyHash, record);
  }

  async recordAudit(record: AuditRecord): Promise<void> {
    this.audit.push(record);
  }

  async listAudit(workspaceId: string | null, limit: number): Promise<AuditRecord[]> {
    return this.audit
      .filter((a) => workspaceId === null || a.workspaceId === workspaceId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  }
}

function paginate<T extends { id: string }>(all: T[], limit: number, cursor?: string): Page<T> {
  let start = 0;
  if (cursor) {
    const idx = all.findIndex((item) => item.id === cursor);
    start = idx === -1 ? 0 : idx + 1;
  }
  const slice = all.slice(start, start + limit);
  const hasMore = start + limit < all.length;
  return { data: slice, nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null };
}
