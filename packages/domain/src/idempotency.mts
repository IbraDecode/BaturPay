import { createHash } from "node:crypto";

export type IdempotencyEnvironment = "SANDBOX" | "PRODUCTION";
export type IdempotencyOperation = "PAYMENT_CREATE" | "REFUND_CREATE";
export type IdempotencyRecordState = "IN_PROGRESS" | "SUCCEEDED" | "FAILED_FINAL" | "UNKNOWN";
export const MAX_CANONICAL_PAYLOAD_BYTES = 1_048_576;
const MAX_CANONICAL_DEPTH = 64;
const MAX_CONTAINER_ENTRIES = 10_000;

export interface IdempotencyScope {
  merchant_id: string;
  environment: IdempotencyEnvironment;
  operation: IdempotencyOperation;
  idempotency_key: string;
  provider_account_id?: string;
}

export interface IdempotencyResponse {
  status: number;
  body?: unknown;
}

export interface IdempotencyRequest {
  storage_key: string;
  merchant_id: string;
  environment: IdempotencyEnvironment;
  operation: IdempotencyOperation;
  provider_account_id?: string;
  fingerprint: string;
  retention_seconds: number;
  expires_at: string;
}

interface IdempotencyEntryBase {
  storage_key: string;
  merchant_id: string;
  environment: IdempotencyEnvironment;
  operation: IdempotencyOperation;
  provider_account_id?: string;
  fingerprint: string;
  expires_at: string;
}

export type IdempotencyEntry = IdempotencyEntryBase & (
  | { state: "IN_PROGRESS" | "UNKNOWN" }
  | { state: "SUCCEEDED" | "FAILED_FINAL"; response: IdempotencyResponse }
);

export type IdempotencyDecision =
  | { kind: "CLAIM_REQUIRED"; request: IdempotencyRequest }
  | { kind: "IN_PROGRESS"; storage_key: string }
  | { kind: "REPLAY"; storage_key: string; response: IdempotencyResponse }
  | { kind: "PAYLOAD_CONFLICT"; storage_key: string }
  | { kind: "RECOVERY_REQUIRED"; storage_key: string }
  | { kind: "RETENTION_EXPIRED"; storage_key: string }
  | { kind: "SCOPE_MISMATCH"; storage_key: string };

export type AtomicClaimResult =
  | { kind: "CLAIMED"; storage_key: string }
  | Exclude<IdempotencyDecision, { kind: "CLAIM_REQUIRED" }>;

function requireText(value: unknown, field: string, maxLength: number): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new TypeError(`${field} must be a non-empty string no longer than ${maxLength} characters.`);
  }
}

function canonicalJson(value: unknown, seen = new Set<object>(), depth = 0): string {
  if (depth > MAX_CANONICAL_DEPTH) throw new TypeError("Payload exceeds maximum canonicalization depth.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Payload must contain only finite JSON-compatible numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError("Payload must not contain circular references.");
    if (value.length > MAX_CONTAINER_ENTRIES) throw new TypeError("Payload array exceeds maximum item count.");
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== "string" || (key !== "length" && !/^(0|[1-9][0-9]*)$/.test(key)))) {
      throw new TypeError("Payload arrays must not contain extra or symbol properties.");
    }
    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError("Payload arrays must contain dense data properties only.");
      }
    }
    seen.add(value);
    for (let index = 0; index < value.length; index += 1) items.push(canonicalJson(value[index], seen, depth + 1));
    seen.delete(value);
    return `[${items.join(",")}]`;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError("Payload must contain only plain JSON-compatible objects.");
    if (seen.has(object)) throw new TypeError("Payload must not contain circular references.");
    const ownKeys = Reflect.ownKeys(object);
    if (ownKeys.length > MAX_CONTAINER_ENTRIES) throw new TypeError("Payload object exceeds maximum property count.");
    if (ownKeys.some((key) => typeof key !== "string")) throw new TypeError("Payload objects must not contain symbol properties.");
    seen.add(object);
    const keys = (ownKeys as string[]).sort();
    const entries = keys.map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(object, key);
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable || descriptor.value === undefined) {
        throw new TypeError("Payload must contain only enumerable JSON-compatible data properties.");
      }
      return `${JSON.stringify(key)}:${canonicalJson(descriptor.value, seen, depth + 1)}`;
    });
    seen.delete(object);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError("Payload must contain only JSON-compatible values.");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function scopeMaterial(scope: IdempotencyScope): string {
  requireText(scope.merchant_id, "merchant_id", 255);
  if (scope.operation !== "PAYMENT_CREATE" && scope.operation !== "REFUND_CREATE") {
    throw new TypeError("operation must be a supported idempotency operation.");
  }
  requireText(scope.idempotency_key, "idempotency_key", 255);
  if (scope.environment !== "SANDBOX" && scope.environment !== "PRODUCTION") {
    throw new TypeError("environment must be SANDBOX or PRODUCTION.");
  }
  if (scope.provider_account_id !== undefined) requireText(scope.provider_account_id, "provider_account_id", 255);
  return canonicalJson({
    merchant_id: scope.merchant_id,
    environment: scope.environment,
    operation: scope.operation,
    ...(scope.provider_account_id !== undefined ? { provider_account_id: scope.provider_account_id } : {}),
    idempotency_key: scope.idempotency_key,
  });
}

export function payloadFingerprint(payload: unknown): string {
  const canonical = canonicalJson(payload);
  if (Buffer.byteLength(canonical, "utf8") > MAX_CANONICAL_PAYLOAD_BYTES) {
    throw new TypeError("Payload exceeds maximum canonical byte size.");
  }
  return sha256(canonical);
}

export function idempotencyStorageKey(scope: IdempotencyScope): string {
  return sha256(scopeMaterial(scope));
}

export function createIdempotencyRequest(
  scope: IdempotencyScope,
  payload: unknown,
  retentionSeconds: number,
  now = new Date(),
): IdempotencyRequest {
  if (!Number.isSafeInteger(retentionSeconds) || retentionSeconds <= 0) {
    throw new TypeError("retentionSeconds must be a positive safe integer provided by policy configuration.");
  }
  if (Number.isNaN(now.getTime())) throw new TypeError("now must be a valid date.");
  const scopeText = scopeMaterial(scope);
  const expiresAt = new Date(now.getTime() + retentionSeconds * 1000);
  if (Number.isNaN(expiresAt.getTime())) throw new TypeError("retentionSeconds exceeds supported date range.");
  return {
    storage_key: sha256(scopeText),
    merchant_id: scope.merchant_id,
    environment: scope.environment,
    operation: scope.operation,
    ...(scope.provider_account_id !== undefined ? { provider_account_id: scope.provider_account_id } : {}),
    fingerprint: payloadFingerprint(payload),
    retention_seconds: retentionSeconds,
    expires_at: expiresAt.toISOString(),
  };
}

function validateRequest(request: unknown): request is IdempotencyRequest {
  if (typeof request !== "object" || request === null || Array.isArray(request)) return false;
  const value = request as Record<string, unknown>;
  return typeof value.storage_key === "string" && /^[a-f0-9]{64}$/.test(value.storage_key) &&
    typeof value.fingerprint === "string" && /^[a-f0-9]{64}$/.test(value.fingerprint) &&
    typeof value.merchant_id === "string" && value.merchant_id.trim().length > 0 &&
    (value.environment === "SANDBOX" || value.environment === "PRODUCTION") &&
    (value.operation === "PAYMENT_CREATE" || value.operation === "REFUND_CREATE") &&
    (value.provider_account_id === undefined || (typeof value.provider_account_id === "string" && value.provider_account_id.trim().length > 0)) &&
    Number.isSafeInteger(value.retention_seconds) && (value.retention_seconds as number) > 0 &&
    typeof value.expires_at === "string" && !Number.isNaN(Date.parse(value.expires_at));
}

function validateEntry(entry: unknown): entry is IdempotencyEntry {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
  const value = entry as Record<string, unknown>;
  if (typeof value.storage_key !== "string" || !/^[a-f0-9]{64}$/.test(value.storage_key) ||
      typeof value.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(value.fingerprint) ||
      typeof value.merchant_id !== "string" || value.merchant_id.trim().length === 0 ||
      (value.environment !== "SANDBOX" && value.environment !== "PRODUCTION") ||
      (value.operation !== "PAYMENT_CREATE" && value.operation !== "REFUND_CREATE") ||
      (value.provider_account_id !== undefined && (typeof value.provider_account_id !== "string" || value.provider_account_id.trim().length === 0)) ||
      typeof value.expires_at !== "string" || Number.isNaN(Date.parse(value.expires_at))) return false;
  if (value.state === "IN_PROGRESS" || value.state === "UNKNOWN") return value.response === undefined;
  if (value.state !== "SUCCEEDED" && value.state !== "FAILED_FINAL") return false;
  if (typeof value.response !== "object" || value.response === null || Array.isArray(value.response)) return false;
  const response = value.response as Record<string, unknown>;
  if (!Number.isInteger(response.status) || (response.status as number) < 100 || (response.status as number) > 599) return false;
  try {
    if (response.body !== undefined) payloadFingerprint(response.body);
  } catch {
    return false;
  }
  return true;
}

export function evaluateIdempotencyEntry(
  request: IdempotencyRequest,
  existing: IdempotencyEntry | undefined,
  now = new Date(),
): IdempotencyDecision {
  if (Number.isNaN(now.getTime())) throw new TypeError("now must be a valid date.");
  if (!validateRequest(request)) throw new TypeError("Idempotency request is malformed.");
  if (!existing) return { kind: "CLAIM_REQUIRED", request };
  if (!validateEntry(existing)) throw new TypeError("Existing idempotency entry is malformed.");
  if (existing.storage_key !== request.storage_key || existing.merchant_id !== request.merchant_id ||
      existing.environment !== request.environment || existing.operation !== request.operation ||
      existing.provider_account_id !== request.provider_account_id) {
    return { kind: "SCOPE_MISMATCH", storage_key: request.storage_key };
  }
  const expiry = Date.parse(existing.expires_at);
  if (Number.isNaN(expiry)) throw new TypeError("Existing idempotency entry has invalid expires_at.");
  if ((existing.state === "SUCCEEDED" || existing.state === "FAILED_FINAL") && expiry <= now.getTime()) {
    return { kind: "RETENTION_EXPIRED", storage_key: request.storage_key };
  }
  if (existing.fingerprint !== request.fingerprint) return { kind: "PAYLOAD_CONFLICT", storage_key: request.storage_key };
  if (existing.state === "UNKNOWN") return { kind: "RECOVERY_REQUIRED", storage_key: request.storage_key };
  if (existing.state === "IN_PROGRESS") return { kind: "IN_PROGRESS", storage_key: request.storage_key };
  if (existing.state !== "SUCCEEDED" && existing.state !== "FAILED_FINAL") {
    return { kind: "SCOPE_MISMATCH", storage_key: request.storage_key };
  }
  return { kind: "REPLAY", storage_key: request.storage_key, response: structuredClone(existing.response) };
}

/**
 * A production implementation must make claim atomic (e.g. PostgreSQL INSERT with a
 * unique constraint over storage_key inside a transaction). This is an interface only;
 * no storage or concurrency guarantee is provided by this package.
 */
export interface AtomicIdempotencyStore {
  claim(request: IdempotencyRequest): Promise<AtomicClaimResult>;
  finalize(storageKey: string, fingerprint: string, state: "SUCCEEDED" | "FAILED_FINAL", response: IdempotencyResponse): Promise<void>;
  markUnknown(storageKey: string, fingerprint: string, reason: string): Promise<void>;
}
