import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { PostgresPaymentStore, type PaymentCreateCommand, type PostgresPaymentStoreConfig } from "../src/postgres-store.mts";

const databaseUrl = process.env.BATURPAY_TEST_DATABASE_URL;
const configuredTestDatabase = process.env.BATURPAY_ALLOW_DATABASE_RESET === "1";
const isolatedNameApproved = process.env.BATURPAY_TEST_DATABASE_NAME === "baturpay_test";
const localTestHost = (() => {
  if (!databaseUrl) return false;
  try {
    const host = new URL(databaseUrl).hostname;
    return ["localhost", "127.0.0.1"].includes(host);
  } catch { return false; }
})();
const integrationEnabled = Boolean(databaseUrl && configuredTestDatabase && isolatedNameApproved && localTestHost);

function makeCommand(merchant_id: string, environment: "SANDBOX" | "PRODUCTION" = "SANDBOX", amount_minor = 1200): PaymentCreateCommand {
  return {
    payment_id: randomUUID(), merchant_id, environment, service_model: "CONNECTED_PROVIDER",
    amount_minor, currency: "IDR",
    idempotency_key: "test-key-01", payload: { amount_minor, currency: "IDR", reference: "order-01" },
    retention_seconds: 86_400,
  };
}

async function withStore<T>(run: (store: PostgresPaymentStore) => Promise<T>): Promise<T> {
  if (!databaseUrl || !configuredTestDatabase || !isolatedNameApproved || !localTestHost) throw new Error("Integration database must be an explicitly approved localhost baturpay_test database.");
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 1500, statement_timeout: 5000 });
  try {
    await client.connect();
  } catch {
    throw new Error("PostgreSQL test database unavailable; connection details redacted.");
  }
  try {
    const result = await client.query<{ current_database: string }>("SELECT current_database() AS current_database");
    assert.equal(result.rows[0]?.current_database, "baturpay_test", "refusing to run against any database other than baturpay_test");
  } catch {
    throw new Error("Unable to verify PostgreSQL test database name; connection details redacted.");
  } finally {
    await client.end();
  }
  const config: PostgresPaymentStoreConfig = {
    connectionString: databaseUrl,
    allowTestDatabaseReset: configuredTestDatabase,
    expectedDatabaseName: "baturpay_test",
    poolMax: 12,
  };
  const store = new PostgresPaymentStore(config);
  try {
    await store.migrateForTests();
    await store.resetForTests();
    return await run(store);
  } finally {
    await store.close();
  }
}

if (!integrationEnabled) {
  test("PostgreSQL integration suite requires an isolated, explicitly approved baturpay_test database", { skip: "Set BATURPAY_TEST_DATABASE_URL to a localhost PostgreSQL URL, BATURPAY_TEST_DATABASE_NAME=baturpay_test and BATURPAY_ALLOW_DATABASE_RESET=1; the suite verifies current_database() before migration/reset." }, () => {});
} else {
  test("creates and retrieves a payment from PostgreSQL", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    const created = await store.createPayment(command);
    assert.equal(created.kind, "CREATED");
    const retrieved = await store.getPayment("merchant-a", "SANDBOX", command.payment_id);
    assert.deepEqual(retrieved, created.kind === "CREATED" ? created.payment : null);
  }));

  test("atomically persists payment and idempotency claim and replays a duplicate", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    const first = await store.createPayment(command);
    assert.equal(first.kind, "CREATED");
    const duplicate = await store.createPayment({ ...command, payment_id: randomUUID() });
    assert.equal(duplicate.kind, "DUPLICATE_IN_PROGRESS");
    assert.equal(await store.countPayments(), 1);
    assert.equal(await store.countIdempotencyRecords(), 1);
  }));

  test("completed identical request replays the cached result without another payment", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    const first = await store.createPayment(command);
    assert.equal(first.kind, "CREATED");
    if (first.kind !== "CREATED") return;
    const response = { status: 202, body: { payment_id: first.payment.payment_id, status: first.payment.status } };
    await store.finalize(first.idempotency_storage_key, first.fingerprint, "SUCCEEDED", response);
    const duplicate = await store.createPayment({ ...command, payment_id: randomUUID() });
    assert.equal(duplicate.kind, "REPLAY");
    if (duplicate.kind === "REPLAY") assert.deepEqual(duplicate.response, response);
    assert.equal(await store.countPayments(), 1);
  }));

  test("database rejects direct insertion of a non-CREATED payment state", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    await assert.rejects(store.attemptDirectPaymentInsertForTests(command, "PAID"), (error: unknown) => {
      assert.equal((error as { kind?: string }).kind, "DATABASE_CONSTRAINT");
      assert.equal((error as { constraint?: string }).constraint, "payments_initial_state_guard");
      return true;
    });
    assert.equal(await store.countPayments(), 0);
  }));

  test("database rejects direct caller-labeled transition to a terminal payment outcome", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    await store.createPayment(command);
    await assert.rejects(store.attemptDirectPaymentStatusUpdateForTests("merchant-a", "SANDBOX", command.payment_id, "PAID"), (error: unknown) => {
      assert.equal((error as { kind?: string }).kind, "DATABASE_CONSTRAINT");
      assert.equal((error as { constraint?: string }).constraint, "payments_transition_guard");
      return true;
    });
    assert.equal((await store.getPayment("merchant-a", "SANDBOX", command.payment_id))?.status, "CREATED");
  }));

  test("same key with changed payload is a conflict and does not create another payment", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    await store.createPayment(command);
    const conflict = await store.createPayment({ ...command, payment_id: randomUUID(), amount_minor: 1300, payload: { amount_minor: 1300, currency: "IDR", reference: "order-01" } });
    assert.equal(conflict.kind, "PAYLOAD_CONFLICT");
    assert.equal(await store.countPayments(), 1);
  }));

  test("genuinely concurrent same-scope calls create exactly one authoritative payment", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    const [one, two] = await Promise.all([
      store.createPayment(command),
      store.createPayment({ ...command, payment_id: randomUUID() }),
    ]);
    assert.equal([one, two].filter((result) => result.kind === "CREATED").length, 1);
    assert.equal([one, two].filter((result) => result.kind === "DUPLICATE_IN_PROGRESS").length, 1);
    assert.equal(await store.countPayments(), 1);
  }));

  test("different merchant or environment scopes can create independent payments", async () => withStore(async (store) => {
    const [one, two, three] = await Promise.all([
      store.createPayment(makeCommand("merchant-a", "SANDBOX")),
      store.createPayment(makeCommand("merchant-b", "SANDBOX")),
      store.createPayment(makeCommand("merchant-a", "PRODUCTION")),
    ]);
    assert.deepEqual([one.kind, two.kind, three.kind], ["CREATED", "CREATED", "CREATED"]);
    assert.equal(await store.countPayments(), 3);
  }));

  test("database uniqueness protects idempotency scope even if application claim is bypassed", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    const first = await store.createPayment(command);
    assert.equal(first.kind, "CREATED");
    await assert.rejects(store.injectDuplicateIdempotencyForTests(command), (error: unknown) => {
      assert.equal((error as { kind?: string }).kind, "DATABASE_CONSTRAINT");
      assert.equal((error as { constraint?: string }).constraint, "idempotency_records_pkey");
      return true;
    });
    assert.equal(await store.countPayments(), 1);
  }));

  test("injected transaction failure rolls back payment and idempotency row together", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    await assert.rejects(store.createPaymentWithInjectedFailureForTests(command));
    assert.equal(await store.countPayments(), 0);
    assert.equal(await store.countIdempotencyRecords(), 0);
  }));

  test("in-progress claim persists across process-like store restart and blocks a retry", async () => {
    const command = makeCommand("merchant-a");
    const firstStore = new PostgresPaymentStore({ connectionString: databaseUrl!, allowTestDatabaseReset: true, expectedDatabaseName: "baturpay_test" });
    try {
      await firstStore.migrateForTests();
      await firstStore.resetForTests();
      assert.equal((await firstStore.createPayment(command)).kind, "CREATED");
    } finally {
      await firstStore.close();
    }
    const secondStore = new PostgresPaymentStore({ connectionString: databaseUrl!, allowTestDatabaseReset: true, expectedDatabaseName: "baturpay_test" });
    try {
      assert.equal((await secondStore.getIdempotency(command))?.state, "IN_PROGRESS");
      assert.equal((await secondStore.createPayment({ ...command, payment_id: randomUUID() })).kind, "DUPLICATE_IN_PROGRESS");
      assert.equal(await secondStore.countPayments(), 1);
    } finally {
      await secondStore.close();
    }
  });

  test("persisted UNKNOWN record requires recovery after reopening the store", async () => {
    const command = makeCommand("merchant-a");
    const firstStore = new PostgresPaymentStore({ connectionString: databaseUrl!, allowTestDatabaseReset: true, expectedDatabaseName: "baturpay_test" });
    let created: Awaited<ReturnType<typeof firstStore.createPayment>>;
    try {
      await firstStore.migrateForTests();
      await firstStore.resetForTests();
      created = await firstStore.createPayment(command);
      assert.equal(created.kind, "CREATED");
      if (created.kind === "CREATED") await firstStore.markUnknown(created.idempotency_storage_key, created.fingerprint, 1, "TIMEOUT");
    } finally {
      await firstStore.close();
    }
    const secondStore = new PostgresPaymentStore({ connectionString: databaseUrl!, allowTestDatabaseReset: true, expectedDatabaseName: "baturpay_test" });
    try {
      const record = await secondStore.getIdempotency(command);
      assert.equal(record?.state, "UNKNOWN");
      const retry = await secondStore.createPayment({ ...command, payment_id: randomUUID() });
      assert.equal(retry.kind, "RECOVERY_REQUIRED");
      assert.equal(await secondStore.countPayments(), 1);
    } finally {
      await secondStore.close();
    }
  });

  test("optimistic version check rejects stale ambiguity updates", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    const created = await store.createPayment(command);
    assert.equal(created.kind, "CREATED");
    if (created.kind !== "CREATED") return;
    const first = await store.markUnknown(created.idempotency_storage_key, created.fingerprint, 1, "TIMEOUT");
    assert.equal(first.kind, "UPDATED");
    const stale = await store.markUnknown(created.idempotency_storage_key, created.fingerprint, 1, "TIMEOUT");
    assert.equal(stale.kind, "STALE_VERSION");
    assert.equal((await store.getPayment("merchant-a", "SANDBOX", command.payment_id))?.version, 2);
  }));

  test("UNKNOWN operation remains ambiguous and does not become payment failure", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a");
    const created = await store.createPayment(command);
    assert.equal(created.kind, "CREATED");
    if (created.kind !== "CREATED") return;
    await store.markUnknown(created.idempotency_storage_key, created.fingerprint, 1, "TIMEOUT");
    const record = await store.getIdempotency(command);
    assert.equal(record?.state, "UNKNOWN");
    assert.equal((await store.getPayment("merchant-a", "SANDBOX", command.payment_id))?.status, "UNKNOWN");
  }));

  test("tenant and environment lookups do not reveal another payment", async () => withStore(async (store) => {
    const command = makeCommand("merchant-a", "SANDBOX");
    await store.createPayment(command);
    assert.equal(await store.getPayment("merchant-b", "SANDBOX", command.payment_id), null);
    assert.equal(await store.getPayment("merchant-a", "PRODUCTION", command.payment_id), null);
  }));

  test("migration version and required constraints are present", async () => withStore(async (store) => {
    assert.equal(await store.getSchemaVersion(), 1);
    assert.ok(await store.hasConstraint("idempotency_records", "idempotency_scope_unique"));
    assert.ok(await store.hasConstraint("payments", "payment_amount_positive"));
    assert.ok(await store.hasTrigger("payments", "payments_initial_state_guard"));
    assert.ok(await store.hasTrigger("payments", "payments_state_guard"));
    assert.ok(await store.hasTrigger("idempotency_records", "idempotency_initial_state_guard"));
    assert.ok(await store.hasTrigger("idempotency_records", "idempotency_state_guard"));
  }));

}

test("unavailable database returns a bounded sanitized availability error", async () => {
  const store = new PostgresPaymentStore({
    connectionString: "postgresql://127.0.0.1:1/baturpay_test",
    allowTestDatabaseReset: true,
    expectedDatabaseName: "baturpay_test",
    connectionTimeoutMillis: 300,
  });
  try {
    await assert.rejects(store.countPayments(), (error: unknown) => {
      assert.equal((error as { kind?: string }).kind, "DATABASE_UNAVAILABLE");
      assert.equal(JSON.stringify(error).includes("127.0.0.1"), false);
      return true;
    });
  } finally {
    await store.close();
  }
});
