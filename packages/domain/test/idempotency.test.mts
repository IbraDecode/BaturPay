import test from "node:test";
import assert from "node:assert/strict";
import {
  createIdempotencyRequest,
  evaluateIdempotencyEntry,
  idempotencyStorageKey,
  payloadFingerprint,
  type IdempotencyEntry,
  type IdempotencyScope,
} from "../src/idempotency.mts";

const scope = { merchant_id: "merchant_demo_01", environment: "SANDBOX", operation: "PAYMENT_CREATE", provider_account_id: "provider-account-a" } as const satisfies Omit<IdempotencyScope, "idempotency_key">;

function entry(state: IdempotencyEntry["state"], fingerprint: string, expires_at = "2027-01-01T00:00:00.000Z"): IdempotencyEntry {
  const common = {
    storage_key: idempotencyStorageKey({ ...scope, idempotency_key: "key-001" }),
    merchant_id: scope.merchant_id,
    environment: scope.environment,
    operation: scope.operation,
    provider_account_id: scope.provider_account_id,
    fingerprint,
    expires_at,
  };
  if (state === "SUCCEEDED" || state === "FAILED_FINAL") {
    return { ...common, state, response: { status: 201, body: { payment_id: "pay_demo_1" } } };
  }
  return { ...common, state };
}

test("fingerprint is stable for equivalent JSON payloads independent of key order", () => {
  assert.equal(payloadFingerprint({ amount: 10, nested: { a: 1, b: 2 } }), payloadFingerprint({ nested: { b: 2, a: 1 }, amount: 10 }));
});

test("scope separates merchants, environments, operations, provider accounts, and keys", () => {
  const base = idempotencyStorageKey({ ...scope, idempotency_key: "key-001" });
  for (const other of [
    { ...scope, merchant_id: "merchant_demo_02", idempotency_key: "key-001" },
    { ...scope, environment: "PRODUCTION" as const, idempotency_key: "key-001" },
    { ...scope, operation: "REFUND_CREATE" as const, idempotency_key: "key-001" },
    { ...scope, provider_account_id: "provider-account-b", idempotency_key: "key-001" },
    { ...scope, idempotency_key: "key-002" },
  ]) assert.notEqual(idempotencyStorageKey(other), base);
});

test("new request yields a claim candidate and a fingerprint", () => {
  const request = createIdempotencyRequest({ ...scope, idempotency_key: "key-001" }, { amount_minor: 1250, currency: "IDR" }, 3600, new Date("2026-01-01T00:00:00.000Z"));
  assert.match(request.storage_key, /^[a-f0-9]{64}$/);
  assert.match(request.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(request.expires_at, "2026-01-01T01:00:00.000Z");
  assert.equal("idempotency_key" in request, false, "raw key must not be returned to the persistence port");
  assert.equal(evaluateIdempotencyEntry(request, undefined, new Date("2026-01-01T00:00:01.000Z")).kind, "CLAIM_REQUIRED");
  assert.throws(() => evaluateIdempotencyEntry({ ...request, fingerprint: "bad" }, undefined), /malformed/);
});

test("same key with a different payload fingerprint is rejected as conflict", () => {
  const req = createIdempotencyRequest({ ...scope, idempotency_key: "key-001" }, { amount_minor: 100 }, 3600);
  assert.equal(evaluateIdempotencyEntry(req, entry("IN_PROGRESS", "0".repeat(64)), new Date("2026-01-01T00:00:00.000Z")).kind, "PAYLOAD_CONFLICT");
});

test("duplicate in-progress request is not re-executed", () => {
  const req = createIdempotencyRequest({ ...scope, idempotency_key: "key-001" }, { amount_minor: 100 }, 3600);
  assert.equal(evaluateIdempotencyEntry(req, entry("IN_PROGRESS", req.fingerprint), new Date("2026-01-01T00:00:00.000Z")).kind, "IN_PROGRESS");
});

test("completed result is replayed without a second operation", () => {
  const req = createIdempotencyRequest({ ...scope, idempotency_key: "key-001" }, { amount_minor: 100 }, 3600);
  const decision = evaluateIdempotencyEntry(req, entry("SUCCEEDED", req.fingerprint), new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(decision.kind, "REPLAY");
  if (decision.kind === "REPLAY") assert.deepEqual(decision.response, { status: 201, body: { payment_id: "pay_demo_1" } });
});

test("unknown operation outcome requires recovery and is never replayed as failure", () => {
  const req = createIdempotencyRequest({ ...scope, idempotency_key: "key-001" }, { amount_minor: 100 }, 3600);
  assert.equal(evaluateIdempotencyEntry(req, entry("UNKNOWN", req.fingerprint), new Date("2026-01-01T00:00:00.000Z")).kind, "RECOVERY_REQUIRED");
});

test("failed-final result is replayable only when failure has been established as final", () => {
  const req = createIdempotencyRequest({ ...scope, idempotency_key: "key-001" }, { amount_minor: 100 }, 3600);
  assert.equal(evaluateIdempotencyEntry(req, entry("FAILED_FINAL", req.fingerprint), new Date("2026-01-01T00:00:00.000Z")).kind, "REPLAY");
});

test("expired entry returns policy-required rather than silently reclaiming the key", () => {
  const req = createIdempotencyRequest({ ...scope, idempotency_key: "key-001" }, { amount_minor: 100 }, 3600);
  assert.equal(evaluateIdempotencyEntry(req, entry("SUCCEEDED", req.fingerprint, "2025-12-31T23:59:59.000Z"), new Date("2026-01-01T00:00:00.000Z")).kind, "RETENTION_EXPIRED");
});

test("rejects invalid key, retention, and non-JSON payload values", () => {
  assert.throws(() => createIdempotencyRequest({ ...scope, idempotency_key: "" }, {}, 3600), /idempotency_key/);
  assert.throws(() => createIdempotencyRequest({ ...scope, idempotency_key: "key-001" }, {}, 0), /retentionSeconds/);
  assert.throws(() => payloadFingerprint({ secretLikeUndefined: undefined }), /JSON-compatible/);
  assert.throws(() => payloadFingerprint({ nonFinite: Number.NaN }), /JSON-compatible/);
  const sparse = new Array(2);
  assert.throws(() => payloadFingerprint(sparse), /dense data properties/);
  const getter = Object.defineProperty({}, "value", { enumerable: true, get: () => 1 });
  assert.throws(() => payloadFingerprint(getter), /data properties/);
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.throws(() => payloadFingerprint(circular), /circular/);
  assert.throws(() => payloadFingerprint("x".repeat(1_048_577)), /maximum canonical byte size/);
  let nested: unknown = {};
  for (let index = 0; index < 66; index += 1) nested = { nested };
  assert.throws(() => payloadFingerprint(nested), /maximum canonicalization depth/);
});
