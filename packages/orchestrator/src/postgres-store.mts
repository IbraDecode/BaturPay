import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  createIdempotencyRequest,
  evaluateIdempotencyEntry,
  payloadFingerprint,
  type IdempotencyEntry,
  type IdempotencyResponse,
  type IdempotencyScope,
} from "../../domain/src/idempotency.mts";
import {
  createPayment,
  markPaymentUnknown,
  type Payment,
  type PaymentEnvironment,
  type PaymentServiceModel,
  type PaymentStatus,
} from "../../domain/src/payment.mts";

const MIGRATION_VERSION = 1;
export const DEFAULT_IDEMPOTENCY_RETENTION_SECONDS = 365 * 24 * 60 * 60; // ponytail: retain final claims for one year; shorten only after owner-approved policy and replay-risk review.
const MIGRATION_URL = new URL("../../domain/migrations/001_initial.sql", import.meta.url);

export type PostgresPaymentStoreConfig = {
  connectionString?: string;
  poolMax?: number;
  connectionTimeoutMillis?: number;
  statementTimeoutMillis?: number;
  expectedDatabaseName?: string;
  allowTestDatabaseReset?: boolean;
};

export class PersistenceError extends Error {
  readonly kind: "DATABASE_CONFIG_INVALID" | "DATABASE_UNAVAILABLE" | "DATABASE_CONSTRAINT" | "RETRYABLE_TRANSACTION" | "MIGRATION_MISMATCH" | "STATE_CONFLICT" | "NOT_FOUND" | "INVALID_REQUEST" | "TEST_ONLY" | "INJECTED_FAILURE";
  readonly constraint?: string;

  constructor(kind: PersistenceError["kind"], constraint?: string) {
    super(kind);
    this.name = "PersistenceError";
    this.kind = kind;
    if (constraint) this.constraint = constraint;
  }
}

export type PaymentCreateCommand = {
  payment_id: string;
  merchant_id: string;
  environment: PaymentEnvironment;
  service_model: PaymentServiceModel;
  amount_minor: number;
  currency: string;
  provider_account_id?: string;
  idempotency_key: string;
  payload: unknown;
  retention_seconds?: number;
};

export type CreatePaymentResult =
  | { kind: "CREATED"; payment: Payment; idempotency_storage_key: string; fingerprint: string }
  | { kind: "DUPLICATE_IN_PROGRESS"; payment: Payment; idempotency_storage_key: string; fingerprint: string }
  | { kind: "REPLAY"; response: IdempotencyResponse; idempotency_storage_key: string }
  | { kind: "PAYLOAD_CONFLICT"; idempotency_storage_key: string }
  | { kind: "RECOVERY_REQUIRED"; idempotency_storage_key: string }
  | { kind: "RETENTION_EXPIRED"; idempotency_storage_key: string };

export type PaymentUpdateResult = { kind: "UPDATED"; payment: Payment } | { kind: "STALE_VERSION" };

export type PersistedIdempotency = {
  storage_key: string;
  merchant_id: string;
  environment: PaymentEnvironment;
  operation: "PAYMENT_CREATE" | "REFUND_CREATE";
  provider_account_id?: string;
  fingerprint: string;
  payment_id: string;
  state: IdempotencyEntry["state"];
  response?: IdempotencyResponse;
  recovery_code?: string;
  expires_at: string;
};

type PaymentRow = {
  payment_id: unknown;
  merchant_id: unknown;
  environment: unknown;
  service_model: unknown;
  amount_minor: unknown;
  currency: unknown;
  status: unknown;
  version: unknown;
};

type IdempotencyRow = {
  storage_key: unknown;
  merchant_id: unknown;
  environment: unknown;
  operation: unknown;
  provider_account_id: unknown;
  fingerprint: unknown;
  payment_id: unknown;
  state: unknown;
  response: unknown;
  recovery_code: unknown;
  expires_at: unknown;
};

function text(value: unknown, field: string, max = 255): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) {
    throw new PersistenceError("INVALID_REQUEST");
  }
  void field;
}

function validateCommand(value: unknown): asserts value is PaymentCreateCommand {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new PersistenceError("INVALID_REQUEST");
  const command = value as Record<string, unknown>;
  text(command.payment_id, "payment_id");
  text(command.merchant_id, "merchant_id");
  text(command.idempotency_key, "idempotency_key");
  if (command.provider_account_id !== undefined) text(command.provider_account_id, "provider_account_id");
  if (command.environment !== "SANDBOX" && command.environment !== "PRODUCTION") throw new PersistenceError("INVALID_REQUEST");
  if (command.service_model !== "CONNECTED_PROVIDER" && command.service_model !== "BATURPAY") throw new PersistenceError("INVALID_REQUEST");
  if (!Number.isSafeInteger(command.amount_minor) || (command.amount_minor as number) <= 0) throw new PersistenceError("INVALID_REQUEST");
  if (typeof command.currency !== "string" || !/^[A-Z]{3}$/.test(command.currency)) throw new PersistenceError("INVALID_REQUEST");
  if (command.retention_seconds !== undefined && (typeof command.retention_seconds !== "number" || !Number.isSafeInteger(command.retention_seconds) || command.retention_seconds <= 0)) throw new PersistenceError("INVALID_REQUEST");
  if (command.payload === undefined) throw new PersistenceError("INVALID_REQUEST");
}

const SENSITIVE_REPLAY_KEY = /(?:secret|credential|password|token|authorization|cookie|cvv|cvc|card[_-]?number|api[_-]?key|private[_-]?key)/i;

function assertSanitizedReplayValue(value: unknown, depth = 0): void {
  if (depth > 32) throw new PersistenceError("INVALID_REQUEST");
  if (typeof value === "string" && (/\bBearer\s+\S+/i.test(value) || /postgres(?:ql)?:\/\//i.test(value))) {
    throw new PersistenceError("INVALID_REQUEST");
  }
  if (Array.isArray(value)) {
    for (const item of value) assertSanitizedReplayValue(item, depth + 1);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_REPLAY_KEY.test(key)) throw new PersistenceError("INVALID_REQUEST");
    assertSanitizedReplayValue(item, depth + 1);
  }
}

function asPayment(row: PaymentRow): Payment {
  const amount = typeof row.amount_minor === "string" ? Number(row.amount_minor) : row.amount_minor;
  const version = typeof row.version === "string" ? Number(row.version) : row.version;
  const payment: Payment = {
    payment_id: row.payment_id as string,
    merchant_id: row.merchant_id as string,
    environment: row.environment as PaymentEnvironment,
    service_model: row.service_model as PaymentServiceModel,
    amount_minor: amount as number,
    currency: row.currency as string,
    status: row.status as PaymentStatus,
    version: version as number,
  };
  const created = createPayment({
    payment_id: payment.payment_id,
    merchant_id: payment.merchant_id,
    environment: payment.environment,
    service_model: payment.service_model,
    amount_minor: payment.amount_minor,
    currency: payment.currency,
  });
  if (!created.ok) throw new PersistenceError("DATABASE_CONSTRAINT");
  if (!Number.isSafeInteger(amount) || typeof version !== "number" || !Number.isSafeInteger(version) || version < 1 || version > Number.MAX_SAFE_INTEGER) {
    throw new PersistenceError("DATABASE_CONSTRAINT");
  }
  if (!(["CREATED", "PENDING", "REQUIRES_ACTION", "PROCESSING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "UNKNOWN"] as unknown[]).includes(payment.status)) {
    throw new PersistenceError("DATABASE_CONSTRAINT");
  }
  return payment;
}

function asIdempotency(row: IdempotencyRow): PersistedIdempotency {
  const states = ["IN_PROGRESS", "SUCCEEDED", "FAILED_FINAL", "UNKNOWN"];
  if (typeof row.storage_key !== "string" || !/^[a-f0-9]{64}$/.test(row.storage_key) ||
      typeof row.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(row.fingerprint) ||
      typeof row.merchant_id !== "string" || !row.merchant_id.trim() || row.merchant_id.length > 255 ||
      typeof row.payment_id !== "string" || !row.payment_id.trim() || row.payment_id.length > 255 ||
      (row.environment !== "SANDBOX" && row.environment !== "PRODUCTION") ||
      (row.operation !== "PAYMENT_CREATE" && row.operation !== "REFUND_CREATE") ||
      !states.includes(String(row.state)) ||
      (row.provider_account_id !== null && (typeof row.provider_account_id !== "string" || !row.provider_account_id.trim() || row.provider_account_id.length > 255)) ||
      (row.recovery_code !== null && (typeof row.recovery_code !== "string" || !/^[A-Z0-9_]{1,64}$/.test(row.recovery_code))) ||
      !((row.expires_at instanceof Date && Number.isFinite(row.expires_at.getTime())) || (typeof row.expires_at === "string" && Number.isFinite(Date.parse(row.expires_at))))) {
    throw new PersistenceError("DATABASE_CONSTRAINT");
  }
  const state = row.state as PersistedIdempotency["state"];
  const final = state === "SUCCEEDED" || state === "FAILED_FINAL";
  if (final !== (row.response !== null) || (state === "UNKNOWN") !== (row.recovery_code !== null)) {
    throw new PersistenceError("DATABASE_CONSTRAINT");
  }
  const result: PersistedIdempotency = {
    storage_key: row.storage_key,
    merchant_id: row.merchant_id,
    environment: row.environment,
    operation: row.operation as PersistedIdempotency["operation"],
    fingerprint: row.fingerprint,
    payment_id: row.payment_id,
    state,
    expires_at: (row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at)).toISOString(),
  };
  if (row.provider_account_id !== null) result.provider_account_id = row.provider_account_id;
  if (row.recovery_code !== null) result.recovery_code = row.recovery_code;
  if (row.response !== null) {
    try {
      if (typeof row.response !== "object" || row.response === null || Array.isArray(row.response)) throw new Error("invalid");
      const response = row.response as IdempotencyResponse;
      if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) throw new Error("invalid");
      payloadFingerprint(response);
      assertSanitizedReplayValue(response);
      result.response = structuredClone(response);
    } catch {
      throw new PersistenceError("DATABASE_CONSTRAINT");
    }
  }
  return result;
}

function publicIdempotencyEntry(record: PersistedIdempotency): IdempotencyEntry {
  return {
    storage_key: record.storage_key,
    merchant_id: record.merchant_id,
    environment: record.environment,
    operation: record.operation,
    ...(record.provider_account_id ? { provider_account_id: record.provider_account_id } : {}),
    fingerprint: record.fingerprint,
    state: record.state,
    expires_at: record.expires_at,
    ...(record.response ? { response: record.response } : {}),
  } as IdempotencyEntry;
}

function mapDatabaseError(error: unknown): PersistenceError {
  if (error instanceof PersistenceError) return error;
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; constraint?: unknown };
    if (candidate.code === "23505" || candidate.code === "23503" || candidate.code === "23514" || candidate.code === "22P02") {
      const constraint = typeof candidate.constraint === "string" && /^[a-z0-9_]{1,63}$/.test(candidate.constraint) ? candidate.constraint : undefined;
      return new PersistenceError("DATABASE_CONSTRAINT", constraint);
    }
    if (candidate.code === "40001" || candidate.code === "40P01") return new PersistenceError("RETRYABLE_TRANSACTION");
  }
  return new PersistenceError("DATABASE_UNAVAILABLE");
}

export class PostgresPaymentStore {
  readonly #pool: Pool;
  readonly #expectedDatabaseName: string | undefined;
  readonly #allowTestDatabaseReset: boolean;

  constructor(config: PostgresPaymentStoreConfig = {}) {
    const connectionString = config.connectionString ?? process.env.BATURPAY_DATABASE_URL;
    if (!connectionString || !/^postgres(?:ql)?:\/\//i.test(connectionString)) throw new PersistenceError("DATABASE_CONFIG_INVALID");
    if (config.expectedDatabaseName !== undefined && config.expectedDatabaseName !== "baturpay_test") throw new PersistenceError("TEST_ONLY");
    this.#expectedDatabaseName = config.expectedDatabaseName ?? undefined;
    this.#allowTestDatabaseReset = config.allowTestDatabaseReset === true;
    this.#pool = new Pool({
      connectionString,
      max: config.poolMax ?? 8,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 1500,
      statement_timeout: config.statementTimeoutMillis ?? 5000,
      application_name: "baturpay-domain",
    });
    this.#pool.on("error", () => undefined);
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }

  async #assertExpectedDatabase(client: Pick<PoolClient, "query"> = this.#pool): Promise<void> {
    if (!this.#expectedDatabaseName) return;
    try {
      const result = await client.query<{ current_database: string }>("SELECT current_database() AS current_database");
      if (result.rows[0]?.current_database !== this.#expectedDatabaseName) throw new PersistenceError("TEST_ONLY");
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async #transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect().catch((error: unknown) => { throw mapDatabaseError(error); });
    try {
      await client.query("BEGIN");
      await this.#assertExpectedDatabase(client);
      const value = await run(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw mapDatabaseError(error);
    } finally {
      client.release();
    }
  }

  async migrate(): Promise<void> {
    const sql = await readFile(MIGRATION_URL, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    await this.#transaction(async (client) => {
      await this.#assertExpectedDatabase(client);
      await client.query("SELECT pg_advisory_xact_lock(741028113)");
      await client.query("CREATE TABLE IF NOT EXISTS baturpay_schema_migrations (version INTEGER PRIMARY KEY, checksum TEXT NOT NULL CHECK (length(checksum) = 64 AND checksum ~ '^[0-9a-f]{64}$'), applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp())");
      const latest = await client.query<{ version: number | null }>("SELECT max(version)::int AS version FROM baturpay_schema_migrations");
      if ((latest.rows[0]?.version ?? 0) > MIGRATION_VERSION) throw new PersistenceError("MIGRATION_MISMATCH");
      const current = await client.query<{ checksum: string }>("SELECT checksum FROM baturpay_schema_migrations WHERE version = $1", [MIGRATION_VERSION]);
      if (current.rowCount && current.rows[0]?.checksum === checksum) {
        const required = ["idempotency_scope_unique", "payment_amount_positive", "payment_merchant_environment_id_unique", "idempotency_payment_fk", "payment_evidence_payment_fk"];
        const found = await client.query<{ count: string }>("SELECT count(DISTINCT c.conname)::text AS count FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = current_schema() AND c.conname = ANY($1::text[])", [required]);
        const requiredTriggers = ["payments_initial_state_guard", "payments_state_guard", "idempotency_initial_state_guard", "idempotency_state_guard", "payments_no_delete", "idempotency_records_no_delete", "payment_evidence_no_update"];
        const triggers = await client.query<{ count: string }>("SELECT count(DISTINCT tr.tgname)::text AS count FROM pg_trigger tr JOIN pg_class t ON t.oid = tr.tgrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = current_schema() AND NOT tr.tgisinternal AND tr.tgname = ANY($1::text[])", [requiredTriggers]);
        if (Number(found.rows[0]?.count ?? "0") !== required.length || Number(triggers.rows[0]?.count ?? "0") !== requiredTriggers.length) throw new PersistenceError("MIGRATION_MISMATCH");
      } else if (current.rowCount) {
        throw new PersistenceError("MIGRATION_MISMATCH");
      }
      if (current.rowCount) return;
      await client.query(sql);
      await client.query("INSERT INTO baturpay_schema_migrations (version, checksum) VALUES ($1, $2)", [MIGRATION_VERSION, checksum]);
    }).catch((error: unknown) => { throw mapDatabaseError(error); });
  }

  async migrateForTests(): Promise<void> {
    this.#requireTestDatabase();
    await this.migrate();
  }

  async resetForTests(): Promise<void> {
    this.#requireTestDatabase();
    await this.#transaction(async (client) => {
      await this.#assertExpectedDatabase(client);
      await client.query("TRUNCATE TABLE payment_evidence, payments, idempotency_records, provider_accounts, merchants RESTART IDENTITY CASCADE");
    });
  }

  #requireTestDatabase(): void {
    if (!this.#allowTestDatabaseReset || this.#expectedDatabaseName !== "baturpay_test") throw new PersistenceError("TEST_ONLY");
  }

  async registerProviderAccount(merchantId: string, environment: PaymentEnvironment, providerAccountId: string): Promise<void> {
    text(merchantId, "merchant_id"); text(providerAccountId, "provider_account_id");
    if (environment !== "SANDBOX" && environment !== "PRODUCTION") throw new PersistenceError("INVALID_REQUEST");
    await this.#transaction(async (client) => {
      await client.query("INSERT INTO merchants (merchant_id) VALUES ($1) ON CONFLICT DO NOTHING", [merchantId]);
      await client.query("INSERT INTO provider_accounts (merchant_id, environment, provider_account_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [merchantId, environment, providerAccountId]);
    });
  }

  #request(command: PaymentCreateCommand) {
    validateCommand(command);
    const scope: IdempotencyScope = {
      merchant_id: command.merchant_id,
      environment: command.environment,
      operation: "PAYMENT_CREATE",
      idempotency_key: command.idempotency_key,
      ...(command.provider_account_id !== undefined ? { provider_account_id: command.provider_account_id } : {}),
    };
    const fingerprint = payloadFingerprint({
      merchant_id: command.merchant_id,
      environment: command.environment,
      service_model: command.service_model,
      provider_account_id: command.provider_account_id ?? null,
      amount_minor: command.amount_minor,
      currency: command.currency,
      payload: command.payload,
    });
    const request = createIdempotencyRequest(scope, {
      merchant_id: command.merchant_id,
      environment: command.environment,
      service_model: command.service_model,
      provider_account_id: command.provider_account_id ?? null,
      amount_minor: command.amount_minor,
      currency: command.currency,
      payload: command.payload,
    }, command.retention_seconds ?? DEFAULT_IDEMPOTENCY_RETENTION_SECONDS);
    return { request, fingerprint };
  }

  async createPayment(command: PaymentCreateCommand): Promise<CreatePaymentResult> {
    const { request, fingerprint } = this.#request(command);
    return this.#transaction(async (client) => {
      await client.query("INSERT INTO merchants (merchant_id) VALUES ($1) ON CONFLICT DO NOTHING", [command.merchant_id]);
      const claim = await client.query<IdempotencyRow>(
        `INSERT INTO idempotency_records (storage_key, merchant_id, environment, operation, provider_account_id, fingerprint, payment_id, state, retention_seconds, expires_at)
         VALUES ($1, $2, $3, 'PAYMENT_CREATE', $4, $5, $6, 'IN_PROGRESS', $7, $8)
         ON CONFLICT (storage_key) DO NOTHING RETURNING *`,
        [request.storage_key, command.merchant_id, command.environment, command.provider_account_id ?? null, fingerprint, command.payment_id, request.retention_seconds, request.expires_at],
      );
      if (claim.rowCount === 0) {
        const existingResult = await client.query<IdempotencyRow>("SELECT * FROM idempotency_records WHERE storage_key = $1 FOR UPDATE", [request.storage_key]);
        if (!existingResult.rowCount || !existingResult.rows[0]) throw new PersistenceError("DATABASE_UNAVAILABLE");
        const existing = asIdempotency(existingResult.rows[0]);
        const decision = evaluateIdempotencyEntry(request, publicIdempotencyEntry(existing));
        if (decision.kind === "PAYLOAD_CONFLICT") return { kind: "PAYLOAD_CONFLICT", idempotency_storage_key: request.storage_key };
        if (decision.kind === "RECOVERY_REQUIRED") return { kind: "RECOVERY_REQUIRED", idempotency_storage_key: request.storage_key };
        if (decision.kind === "RETENTION_EXPIRED") return { kind: "RETENTION_EXPIRED", idempotency_storage_key: request.storage_key };
        if (decision.kind === "REPLAY") return { kind: "REPLAY", response: decision.response, idempotency_storage_key: request.storage_key };
        if (decision.kind !== "IN_PROGRESS") throw new PersistenceError("DATABASE_CONSTRAINT");
        const paymentResult = await client.query<PaymentRow>("SELECT payment_id, merchant_id, environment, service_model, amount_minor, currency, status, version FROM payments WHERE merchant_id = $1 AND environment = $2 AND payment_id = $3", [command.merchant_id, command.environment, existing.payment_id]);
        if (!paymentResult.rowCount || !paymentResult.rows[0]) throw new PersistenceError("DATABASE_CONSTRAINT");
        return { kind: "DUPLICATE_IN_PROGRESS", payment: asPayment(paymentResult.rows[0]), idempotency_storage_key: request.storage_key, fingerprint };
      }

      const created = createPayment({
        payment_id: command.payment_id,
        merchant_id: command.merchant_id,
        environment: command.environment,
        service_model: command.service_model,
        amount_minor: command.amount_minor,
        currency: command.currency,
      });
      if (!created.ok) throw new PersistenceError("INVALID_REQUEST");
      const payment = created.payment;
      await client.query(
        `INSERT INTO payments (payment_id, merchant_id, environment, service_model, provider_account_id, amount_minor, currency, status, version, idempotency_storage_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [payment.payment_id, payment.merchant_id, payment.environment, payment.service_model, command.provider_account_id ?? null, payment.amount_minor, payment.currency, payment.status, payment.version, request.storage_key],
      );
      return { kind: "CREATED", payment, idempotency_storage_key: request.storage_key, fingerprint };
    });
  }

  async getPayment(merchantId: string, environment: PaymentEnvironment, paymentId: string): Promise<Payment | null> {
    text(merchantId, "merchant_id"); text(paymentId, "payment_id");
    if (environment !== "SANDBOX" && environment !== "PRODUCTION") throw new PersistenceError("INVALID_REQUEST");
    try {
      await this.#assertExpectedDatabase();
      const result = await this.#pool.query<PaymentRow>("SELECT payment_id, merchant_id, environment, service_model, amount_minor, currency, status, version FROM payments WHERE merchant_id = $1 AND environment = $2 AND payment_id = $3", [merchantId, environment, paymentId]);
      return result.rows[0] ? asPayment(result.rows[0]) : null;
    } catch (error) { throw mapDatabaseError(error); }
  }

  async markUnknown(storageKey: string, fingerprint: string, expectedVersion: number, reason: string): Promise<PaymentUpdateResult> {
    if (!/^[a-f0-9]{64}$/.test(storageKey) || !/^[a-f0-9]{64}$/.test(fingerprint) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || !/^[A-Z0-9_]{1,64}$/.test(reason)) {
      throw new PersistenceError("INVALID_REQUEST");
    }
    return this.#transaction(async (client) => {
      const operation = await client.query<IdempotencyRow>("SELECT * FROM idempotency_records WHERE storage_key = $1 AND fingerprint = $2 FOR UPDATE", [storageKey, fingerprint]);
      if (!operation.rowCount || !operation.rows[0]) throw new PersistenceError("NOT_FOUND");
      const record = asIdempotency(operation.rows[0]);
      const selected = await client.query<PaymentRow>("SELECT payment_id, merchant_id, environment, service_model, amount_minor, currency, status, version FROM payments WHERE merchant_id = $1 AND environment = $2 AND payment_id = $3 FOR UPDATE", [record.merchant_id, record.environment, record.payment_id]);
      if (!selected.rowCount || !selected.rows[0]) throw new PersistenceError("DATABASE_CONSTRAINT");
      const current = asPayment(selected.rows[0]);
      if (current.version !== expectedVersion || record.state !== "IN_PROGRESS") return { kind: "STALE_VERSION" };
      const marked = markPaymentUnknown(current);
      if (!marked.ok) throw new PersistenceError("STATE_CONFLICT");
      const updatedPayment = await client.query("UPDATE payments SET status = 'UNKNOWN', version = $1, updated_at = clock_timestamp() WHERE payment_id = $2 AND merchant_id = $3 AND environment = $4 AND version = $5", [marked.payment.version, current.payment_id, current.merchant_id, current.environment, expectedVersion]);
      if (updatedPayment.rowCount !== 1) return { kind: "STALE_VERSION" };
      const updatedOperation = await client.query("UPDATE idempotency_records SET state = 'UNKNOWN', recovery_code = $1, updated_at = clock_timestamp() WHERE storage_key = $2 AND fingerprint = $3 AND state = 'IN_PROGRESS'", [reason, storageKey, fingerprint]);
      if (updatedOperation.rowCount !== 1) throw new PersistenceError("STATE_CONFLICT");
      await client.query("INSERT INTO payment_evidence (payment_id, merchant_id, environment, evidence_kind, reference, received_at) VALUES ($1, $2, $3, 'OPERATION_AMBIGUOUS', $4, clock_timestamp())", [current.payment_id, current.merchant_id, current.environment, `operation:${storageKey}`]);
      return { kind: "UPDATED", payment: marked.payment };
    });
  }

  async finalize(storageKey: string, fingerprint: string, state: "SUCCEEDED" | "FAILED_FINAL", response: IdempotencyResponse): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(storageKey) || !/^[a-f0-9]{64}$/.test(fingerprint) || typeof response !== "object" || response === null || Array.isArray(response)) throw new PersistenceError("INVALID_REQUEST");
    let serialized: string;
    try {
      payloadFingerprint(response);
      if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) throw new Error("invalid status");
      assertSanitizedReplayValue(response);
      serialized = JSON.stringify(response);
      if (serialized === undefined || Buffer.byteLength(serialized, "utf8") > 1_048_576) throw new Error("invalid response");
      payloadFingerprint(JSON.parse(serialized));
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      throw new PersistenceError("INVALID_REQUEST");
    }
    await this.#assertExpectedDatabase();
    const result = await this.#pool.query("UPDATE idempotency_records SET state = $1, response = $2::jsonb, recovery_code = NULL, updated_at = clock_timestamp() WHERE storage_key = $3 AND fingerprint = $4 AND state = 'IN_PROGRESS'", [state, serialized, storageKey, fingerprint]).catch((error: unknown) => { throw mapDatabaseError(error); });
    if (result.rowCount !== 1) throw new PersistenceError("STATE_CONFLICT");
  }

  async getIdempotency(command: PaymentCreateCommand): Promise<PersistedIdempotency | null> {
    const { request } = this.#request(command);
    try {
      await this.#assertExpectedDatabase();
      const result = await this.#pool.query<IdempotencyRow>("SELECT * FROM idempotency_records WHERE storage_key = $1 AND merchant_id = $2 AND environment = $3", [request.storage_key, command.merchant_id, command.environment]);
      return result.rows[0] ? asIdempotency(result.rows[0]) : null;
    } catch (error) { throw mapDatabaseError(error); }
  }

  async getSchemaVersion(): Promise<number> {
    try {
      await this.#assertExpectedDatabase();
      const result = await this.#pool.query<{ version: number }>("SELECT version FROM baturpay_schema_migrations ORDER BY version DESC LIMIT 1");
      return result.rows[0]?.version ?? 0;
    } catch (error) { throw mapDatabaseError(error); }
  }

  async hasConstraint(table: string, constraint: string): Promise<boolean> {
    if (!/^[a-z_]{1,63}$/.test(table) || !/^[a-z_]{1,63}$/.test(constraint)) throw new PersistenceError("INVALID_REQUEST");
    try {
      await this.#assertExpectedDatabase();
      const result = await this.#pool.query("SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid WHERE t.relname = $1 AND c.conname = $2", [table, constraint]);
      return result.rowCount === 1;
    } catch (error) { throw mapDatabaseError(error); }
  }

  async hasTrigger(table: string, trigger: string): Promise<boolean> {
    if (!/^[a-z_]{1,63}$/.test(table) || !/^[a-z_]{1,63}$/.test(trigger)) throw new PersistenceError("INVALID_REQUEST");
    try {
      await this.#assertExpectedDatabase();
      const result = await this.#pool.query("SELECT 1 FROM pg_trigger tr JOIN pg_class t ON t.oid = tr.tgrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = current_schema() AND t.relname = $1 AND tr.tgname = $2 AND NOT tr.tgisinternal", [table, trigger]);
      return result.rowCount === 1;
    } catch (error) { throw mapDatabaseError(error); }
  }

  async countPayments(): Promise<number> { this.#requireTestDatabase(); return this.#count("payments"); }
  async countIdempotencyRecords(): Promise<number> { this.#requireTestDatabase(); return this.#count("idempotency_records"); }

  async #count(table: "payments" | "idempotency_records"): Promise<number> {
    try {
      await this.#assertExpectedDatabase();
      const result = await this.#pool.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`);
      return Number(result.rows[0]?.count ?? "0");
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async attemptDirectPaymentInsertForTests(command: PaymentCreateCommand, status: PaymentStatus): Promise<void> {
    this.#requireTestDatabase();
    const { request } = this.#request(command);
    await this.#transaction(async (client) => {
      await client.query("INSERT INTO merchants (merchant_id) VALUES ($1) ON CONFLICT DO NOTHING", [command.merchant_id]);
      await client.query("INSERT INTO payments (payment_id, merchant_id, environment, service_model, provider_account_id, amount_minor, currency, status, version, idempotency_storage_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9)", [command.payment_id, command.merchant_id, command.environment, command.service_model, command.provider_account_id ?? null, command.amount_minor, command.currency, status, request.storage_key]);
    });
  }

  async attemptDirectPaymentStatusUpdateForTests(merchantId: string, environment: PaymentEnvironment, paymentId: string, next: PaymentStatus): Promise<void> {
    this.#requireTestDatabase();
    await this.#transaction(async (client) => {
      await client.query("UPDATE payments SET status = $1, version = version + 1, updated_at = clock_timestamp() WHERE merchant_id = $2 AND environment = $3 AND payment_id = $4", [next, merchantId, environment, paymentId]);
    });
  }

  async injectDuplicateIdempotencyForTests(command: PaymentCreateCommand): Promise<void> {
    this.#requireTestDatabase();
    const { request, fingerprint } = this.#request(command);
    await this.#transaction(async (client) => {
      await client.query("INSERT INTO idempotency_records (storage_key, merchant_id, environment, operation, provider_account_id, fingerprint, payment_id, state, retention_seconds, expires_at) VALUES ($1, $2, $3, 'PAYMENT_CREATE', $4, $5, $6, 'IN_PROGRESS', $7, $8)", [request.storage_key, command.merchant_id, command.environment, command.provider_account_id ?? null, fingerprint, command.payment_id, request.retention_seconds, request.expires_at]);
    });
  }

  async createPaymentWithInjectedFailureForTests(command: PaymentCreateCommand): Promise<never> {
    this.#requireTestDatabase();
    const { request, fingerprint } = this.#request(command);
    return this.#transaction(async (client) => {
      await client.query("INSERT INTO merchants (merchant_id) VALUES ($1) ON CONFLICT DO NOTHING", [command.merchant_id]);
      await client.query("INSERT INTO idempotency_records (storage_key, merchant_id, environment, operation, provider_account_id, fingerprint, payment_id, state, retention_seconds, expires_at) VALUES ($1, $2, $3, 'PAYMENT_CREATE', $4, $5, $6, 'IN_PROGRESS', $7, $8)", [request.storage_key, command.merchant_id, command.environment, command.provider_account_id ?? null, fingerprint, command.payment_id, request.retention_seconds, request.expires_at]);
      await client.query("INSERT INTO payments (payment_id, merchant_id, environment, service_model, provider_account_id, amount_minor, currency, status, version, idempotency_storage_key) VALUES ($1, $2, $3, $4, $5, $6, $7, 'CREATED', 1, $8)", [command.payment_id, command.merchant_id, command.environment, command.service_model, command.provider_account_id ?? null, command.amount_minor, command.currency, request.storage_key]);
      throw new PersistenceError("INJECTED_FAILURE");
    });
  }
}
