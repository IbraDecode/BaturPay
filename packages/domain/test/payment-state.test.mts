import test from "node:test";
import assert from "node:assert/strict";
import { PAYMENT_STATUSES, createPayment, transitionPayment, type Payment } from "../src/payment.mts";

function expectRejected(result: ReturnType<typeof transitionPayment>, code: string): void {
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected a rejected transition.");
  assert.equal(result.error.code, code);
}

const payment = (status: Payment["status"]): Payment => ({
  payment_id: "pay_demo_001",
  merchant_id: "merchant_demo_001",
  environment: "SANDBOX",
  service_model: "CONNECTED_PROVIDER",
  amount_minor: 1250,
  currency: "IDR",
  status,
  version: 1,
});

test("exports the proposed payment status set", () => {
  assert.deepEqual(PAYMENT_STATUSES, ["CREATED", "PENDING", "REQUIRES_ACTION", "PROCESSING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "UNKNOWN"]);
});

test("payment factory always starts at CREATED version 1", () => {
  const created = createPayment({ payment_id: "pay_factory", merchant_id: "merchant_factory", environment: "SANDBOX", service_model: "CONNECTED_PROVIDER", amount_minor: 500, currency: "IDR" });
  assert.equal(created.ok, true);
  if (!created.ok) throw new Error("Expected a valid payment creation.");
  assert.equal(created.payment.status, "CREATED");
  assert.equal(created.payment.version, 1);
  const invalid = createPayment({ payment_id: "", merchant_id: "merchant_factory", environment: "SANDBOX", service_model: "CONNECTED_PROVIDER", amount_minor: 500, currency: "IDR" });
  assert.equal(invalid.ok, false);
});

test("allows explicitly modeled payment transitions", () => {
  assert.equal(transitionPayment(payment("CREATED"), "PENDING", { evidence: "REQUEST_ACCEPTED" }).ok, true);
  assert.equal(transitionPayment(payment("PENDING"), "REQUIRES_ACTION", { evidence: "TRUSTED_PROVIDER_STATUS" }).ok, true);
  assert.equal(transitionPayment(payment("REQUIRES_ACTION"), "PROCESSING", { evidence: "TRUSTED_PROVIDER_STATUS" }).ok, true);
  assert.equal(transitionPayment(payment("PROCESSING"), "PAID", { evidence: "VERIFIED_WEBHOOK" }).ok, true);
});

test("allows provider-reported return to PENDING from action or processing as a proposed reconciliation case", () => {
  assert.equal(transitionPayment(payment("REQUIRES_ACTION"), "PENDING", { evidence: "TRUSTED_PROVIDER_STATUS" }).ok, true);
  assert.equal(transitionPayment(payment("PROCESSING"), "PENDING", { evidence: "TRUSTED_PROVIDER_STATUS" }).ok, true);
});

test("requires transition evidence and trusted evidence for terminal outcomes", () => {
  expectRejected(transitionPayment(payment("CREATED"), "PENDING"), "MISSING_EVIDENCE");
  expectRejected(transitionPayment(payment("PENDING"), "PAID", { evidence: "REQUEST_ACCEPTED" }), "MISSING_EVIDENCE");
});

test("rejects forged evidence labels and malformed context at runtime", () => {
  expectRejected(transitionPayment(payment("PENDING"), "PROCESSING", { evidence: "FORGED" as never }), "INVALID_EVIDENCE");
  expectRejected(transitionPayment(payment("PENDING"), "PROCESSING", null as never), "INVALID_EVIDENCE");
});

test("rejects invalid version values before transition", () => {
  expectRejected(transitionPayment({ ...payment("PENDING"), version: Number.MAX_SAFE_INTEGER }, "PAID", { evidence: "TRUSTED_PROVIDER_STATUS" }), "VERSION_EXHAUSTED");
});

test("rejects illegal transitions and does not change the input payment", () => {
  const current = payment("CREATED");
  const before = structuredClone(current);
  const result = transitionPayment(current, "PAID", { evidence: "TRUSTED_PROVIDER_STATUS" });
  expectRejected(result, "TRANSITION_NOT_ALLOWED");
  assert.deepEqual(current, before);
});

test("terminal statuses cannot transition", () => {
  for (const status of ["PAID", "FAILED", "EXPIRED", "CANCELLED"] as const) {
    expectRejected(transitionPayment(payment(status), "PENDING"), "TERMINAL_STATE");
  }
});

test("UNKNOWN remains ambiguous and cannot be retried or downgraded automatically", () => {
  const result = transitionPayment(payment("UNKNOWN"), "FAILED");
  expectRejected(result, "UNKNOWN_REQUIRES_EVIDENCE");
});

test("UNKNOWN can only resolve using explicit trusted evidence", () => {
  const result = transitionPayment(payment("UNKNOWN"), "PAID", { evidence: "TRUSTED_PROVIDER_STATUS" });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected trusted evidence to resolve UNKNOWN.");
  assert.equal(result.payment.status, "PAID");
  expectRejected(transitionPayment(payment("UNKNOWN"), "PAID"), "UNKNOWN_REQUIRES_EVIDENCE");
});

test("payment model rejects invalid immutable monetary identifiers", () => {
  const invalid = { ...payment("CREATED"), amount_minor: 0 };
  expectRejected(transitionPayment(invalid, "PENDING"), "INVALID_PAYMENT");
});
