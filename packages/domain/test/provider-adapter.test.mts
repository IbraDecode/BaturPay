import test from "node:test";
import assert from "node:assert/strict";
import { candidateStatus, FakePaymentAdapter, isCapabilitySupported, normalizeProviderResult, type CreatePaymentRequest, type PaymentProviderAdapter, type ProviderCreatePaymentResult } from "../src/provider-adapter.mts";

const request: CreatePaymentRequest = {
  payment_id: "pay_demo_01", merchant_id: "merchant_demo_01", environment: "SANDBOX",
  service_model: "CONNECTED_PROVIDER", amount_minor: 2500, currency: "IDR", idempotency_key: "key-demo-01",
};

function observation(suggested_status: "PENDING" | "REQUIRES_ACTION" | "PROCESSING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED"): ProviderCreatePaymentResult {
  const common = { provider_operation_id: "op_fake_01", evidence: { reference: "test-evidence-01", received_at: "2026-01-01T00:00:00.000Z" } };
  if (suggested_status === "PAID" || suggested_status === "FAILED" || suggested_status === "EXPIRED" || suggested_status === "CANCELLED") return { kind: "FINAL", ...common, suggested_status };
  return { kind: "ACCEPTED", ...common, suggested_status };
}

test("fake adapter returns deterministic test observation and performs no network access", async () => {
  const result = observation("PENDING");
  const adapter = new FakePaymentAdapter(result);
  assert.equal(adapter.provider_id, "fake-test-adapter");
  assert.deepEqual(adapter.capabilities(), { payment_create: true, payment_status_lookup: false, refund_create: false, webhooks: false });
  assert.deepEqual(await adapter.createPayment(request), result);
});

test("normalizes provider result without mutating authoritative payment state", () => {
  const validFinal = observation("PAID");
  assert.deepEqual(normalizeProviderResult(validFinal), validFinal);
  assert.equal(candidateStatus({ kind: "FINAL", suggested_status: "PAID" }), "UNKNOWN");
  assert.deepEqual(normalizeProviderResult({ kind: "UNKNOWN", reason_code: "READ_TIMEOUT" }), { kind: "UNKNOWN", reason_code: "UNKNOWN_OUTCOME" });
  assert.deepEqual(normalizeProviderResult({ kind: "FINAL", suggested_status: "UNKNOWN", provider_operation_id: "op_1", evidence: { reference: "ref", received_at: "2026-01-01T00:00:00.000Z" } }), { kind: "UNKNOWN", reason_code: "INVALID_PROVIDER_RESPONSE" });
  assert.deepEqual(normalizeProviderResult(null), { kind: "UNKNOWN", reason_code: "INVALID_PROVIDER_RESPONSE" });
  assert.deepEqual(normalizeProviderResult({ kind: "UNSUPPORTED", capability: "REFUND_CREATE" }), { kind: "UNKNOWN", reason_code: "INVALID_PROVIDER_RESPONSE" });
  let getterCalled = false;
  const hostile = Object.defineProperty({}, "kind", { enumerable: true, get: () => { getterCalled = true; return "FINAL"; } });
  assert.deepEqual(normalizeProviderResult(hostile), { kind: "UNKNOWN", reason_code: "INVALID_PROVIDER_RESPONSE" });
  assert.equal(getterCalled, false);

  assert.equal(candidateStatus(validFinal), "PAID");
  assert.equal(candidateStatus({ kind: "UNKNOWN", reason_code: "TIMEOUT" }), "UNKNOWN");
  assert.equal(candidateStatus({ kind: "UNSUPPORTED", capability: "PAYMENT_CREATE" }), "UNSUPPORTED");
});

test("does not trust evidence fields as cryptographic proof or mutate authoritative state", () => {
  assert.equal(candidateStatus(observation("PAID")), "PAID");
  assert.equal(candidateStatus({ kind: "UNKNOWN", reason_code: "TIMEOUT" }), "UNKNOWN");
  assert.equal(candidateStatus({ kind: "UNSUPPORTED", capability: "PAYMENT_CREATE" }), "UNSUPPORTED");
});

test("unsupported provider capabilities remain explicit", () => {
  const adapter = new FakePaymentAdapter({ kind: "UNSUPPORTED", capability: "PAYMENT_CREATE" });
  assert.equal(isCapabilitySupported(adapter.capabilities(), "PAYMENT_CREATE"), false);
  assert.equal(isCapabilitySupported(adapter.capabilities(), "PAYMENT_STATUS_LOOKUP"), false);
  assert.equal(isCapabilitySupported(adapter.capabilities(), "REFUND_CREATE"), false);
  assert.equal(isCapabilitySupported(adapter.capabilities(), "WEBHOOKS"), false);
});

test("adapter contract returns observations only and has no payment-transition authority", () => {
  const methods = Object.getOwnPropertyNames(FakePaymentAdapter.prototype);
  assert.deepEqual(methods.sort(), ["capabilities", "constructor", "createPayment"].sort());
  const adapter: PaymentProviderAdapter = new FakePaymentAdapter(observation("PROCESSING"));
  assert.equal(typeof adapter.createPayment, "function");
});
