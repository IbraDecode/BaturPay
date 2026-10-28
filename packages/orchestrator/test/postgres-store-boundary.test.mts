import test from "node:test";
import assert from "node:assert/strict";
import { PostgresPaymentStore, PersistenceError, DEFAULT_IDEMPOTENCY_RETENTION_SECONDS } from "../src/postgres-store.mts";

const databaseUrl = "postgresql://127.0.0.1:1/baturpay_test";
const digest = "a".repeat(64);

function store(): PostgresPaymentStore {
  return new PostgresPaymentStore({ connectionString: databaseUrl, allowTestDatabaseReset: true, expectedDatabaseName: "baturpay_test", connectionTimeoutMillis: 200 });
}

test("uses conservative 365-day default idempotency retention", () => {
  assert.equal(DEFAULT_IDEMPOTENCY_RETENTION_SECONDS, 365 * 24 * 60 * 60);
});

test("rejects malformed replay response before attempting database connection", async () => {
  const db = store();
  try {
    await assert.rejects(db.finalize(digest, digest, "SUCCEEDED", null as never), (error: unknown) => {
      assert.ok(error instanceof PersistenceError);
      assert.equal(error.kind, "INVALID_REQUEST");
      return true;
    });
  } finally {
    await db.close();
  }
});

test("refuses credential-shaped replay fields and values before persistence", async () => {
  const db = store();
  try {
    for (const body of [
      { access_token: "x" },
      { data: "Bearer x" },
      { metadata: { api_key: "y" } },
    ]) {
      await assert.rejects(db.finalize(digest, digest, "SUCCEEDED", { status: 200, body }), (error: unknown) => {
        assert.ok(error instanceof PersistenceError);
        assert.equal(error.kind, "INVALID_REQUEST");
        assert.equal(JSON.stringify(error).includes("Bearer x"), false);
        return true;
      });
    }
  } finally {
    await db.close();
  }
});

test("rejects invalid database URLs without retaining or echoing the URL", () => {
  assert.throws(() => new PostgresPaymentStore({ connectionString: "not-a-postgresql-url-with-placeholder" }), (error: unknown) => {
    assert.ok(error instanceof PersistenceError);
    assert.equal(error.kind, "DATABASE_CONFIG_INVALID");
    assert.equal(JSON.stringify(error).includes("placeholder"), false);
    return true;
  });
});
