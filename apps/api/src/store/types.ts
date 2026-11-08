/**
 * Modul: API — Store contracts
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * The persistence boundary. Two implementations exist: Postgres for deployment
 * and an in-memory store for hermetic tests and instant local demo. Services
 * depend only on this interface, never on `pg` directly.
 */
export interface Workspace {
  id: string;
  name: string;
  environment: 'sandbox';
  createdAt: string;
}

export interface ApiKeyRecord {
  id: string;
  workspaceId: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  createdAt: string;
  revokedAt: string | null;
}

export interface InvoiceRecord {
  id: string;
  workspaceId: string;
  externalId: string;
  amountMinor: number;
  currency: string;
  status: string;
  environment: 'sandbox';
  description: string | null;
  scenario: string | null;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface EventRecord {
  eventId: string;
  workspaceId: string;
  invoiceId: string;
  type: string;
  sequence: number;
  occurredAt: string;
  data: Record<string, unknown>;
}

export interface DeliveryPlanRecord {
  deliveryId: string;
  eventId: string;
  eventType: string;
  order: number;
  scheduledAt: string;
  duplicate: boolean;
}

export interface RunRecord {
  runId: string;
  workspaceId: string;
  invoiceId: string;
  scenario: string;
  seed: string;
  finalStatus: string;
  expectedSettleMinor: number;
  events: EventRecord[];
  deliveries: DeliveryPlanRecord[];
  createdAt: string;
}

export interface WebhookEndpointRecord {
  id: string;
  workspaceId: string;
  url: string;
  description: string | null;
  signingSecret: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
}

export type DeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED';

export interface WebhookDeliveryRecord {
  id: string;
  workspaceId: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  attempts: number;
  scheduledAt: string;
  lastAttemptAt: string | null;
  responseStatus: number | null;
  error: string | null;
  createdAt: string;
}

export interface IdempotencyPersist {
  keyHash: string;
  workspaceId: string;
  operation: string;
  requestFingerprint: string;
  responseStatus: number;
  responseBody: unknown;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  workspaceId: string | null;
  actor: string;
  action: string;
  resource: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DeliveryPatch {
  status?: DeliveryStatus;
  attempts?: number;
  lastAttemptAt?: string | null;
  responseStatus?: number | null;
  error?: string | null;
  scheduledAt?: string;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface Store {
  readonly kind: 'memory' | 'postgres';
  ping(): Promise<boolean>;
  close(): Promise<void>;

  createWorkspace(input: { id: string; name: string }): Promise<Workspace>;
  getWorkspace(id: string): Promise<Workspace | null>;
  listWorkspaces(): Promise<Workspace[]>;

  createApiKey(input: ApiKeyRecord): Promise<ApiKeyRecord>;
  findApiKeyByPrefix(prefix: string): Promise<ApiKeyRecord | null>;
  listApiKeys(workspaceId: string): Promise<ApiKeyRecord[]>;

  createInvoice(input: InvoiceRecord): Promise<InvoiceRecord>;
  getInvoice(workspaceId: string, id: string): Promise<InvoiceRecord | null>;
  getInvoiceByExternalId(workspaceId: string, externalId: string): Promise<InvoiceRecord | null>;
  listInvoices(workspaceId: string, opts: { limit: number; cursor?: string }): Promise<Page<InvoiceRecord>>;
  updateInvoiceStatus(workspaceId: string, id: string, status: string): Promise<InvoiceRecord | null>;

  appendEvent(input: EventRecord): Promise<EventRecord>;
  listEvents(workspaceId: string, invoiceId: string): Promise<EventRecord[]>;
  getEvent(workspaceId: string, eventId: string): Promise<EventRecord | null>;

  saveRun(input: RunRecord): Promise<RunRecord>;
  getRun(workspaceId: string, runId: string): Promise<RunRecord | null>;

  createWebhookEndpoint(input: WebhookEndpointRecord): Promise<WebhookEndpointRecord>;
  listWebhookEndpoints(workspaceId: string): Promise<WebhookEndpointRecord[]>;
  getWebhookEndpoint(workspaceId: string, id: string): Promise<WebhookEndpointRecord | null>;

  createDeliveries(input: WebhookDeliveryRecord[]): Promise<WebhookDeliveryRecord[]>;
  listDeliveries(workspaceId: string, opts: { limit: number }): Promise<WebhookDeliveryRecord[]>;
  getDelivery(workspaceId: string, id: string): Promise<WebhookDeliveryRecord | null>;
  dueDeliveries(nowIso: string, limit: number): Promise<WebhookDeliveryRecord[]>;
  updateDelivery(id: string, patch: DeliveryPatch): Promise<void>;

  getIdempotency(keyHash: string): Promise<IdempotencyPersist | null>;
  putIdempotency(record: IdempotencyPersist): Promise<void>;

  recordAudit(record: AuditRecord): Promise<void>;
  listAudit(workspaceId: string | null, limit: number): Promise<AuditRecord[]>;
}
