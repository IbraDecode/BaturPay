# Proposed PostgreSQL Persistence Design

Status: implementation added in `packages/orchestrator/src/postgres-store.mts` with migration `packages/domain/migrations/001_initial.sql`; no reachable PostgreSQL server is present, so migration/integration behavior is NOT RUN and not verified. `pg` is a pinned runtime dependency. Design statements below describe intended behavior; tests must run against local isolated `baturpay_test` before claiming correctness.

## Assumptions and decisions

- PostgreSQL is the proposed durable source of truth for payments, operation claims, evidence references and audit events.
- Require a currently supported PostgreSQL version. Implemented migration uses `storage_key TEXT` with an exact 64-character lowercase-hex constraint—SHA-256 over the canonical full scope—as the unique serialization key, avoiding nullable-scope uniqueness semantics. Collision probability is computationally negligible but remains a documented tradeoff.
- Sandbox and production records are separated by an explicit `environment` column and included in all uniqueness and lookup scopes. Production/sandbox database separation is still an open deployment/security choice.
- No product-specific provider, custody, funds flow, settlement, ledger, pricing or retention duration is assumed.

## Proposed tables

1. `merchants`
   - Merchant identity and lifecycle; primary key `merchant_id UUID`.
   - No payment credential material.

2. `provider_accounts`
   - Merchant-owned account references for `CONNECTED_PROVIDER`; composite unique `(merchant_id, environment, provider_account_id)`.
   - Credentials must live in an independently approved secret manager; store only opaque version/reference metadata. Whether/how the `BATURPAY` path uses an account remains open.

3. `payments`
   - Authoritative payment aggregate: `payment_id UUID PRIMARY KEY`, `merchant_id`, `environment`, service model, amount in minor-unit `BIGINT CHECK (amount_minor > 0)`, currency, status, optimistic `version`, timestamps.
   - `UNIQUE (merchant_id, environment, payment_id)` supports tenant-scoped FKs; all query paths filter by merchant and environment. Add checks for allowed environments/models/statuses and version bounds.
   - Do not persist provider-reported status directly; application/domain transition gate must validate evidence and allowed transitions.

4. `payment_attempts`
   - Each external operation attempt: payment, provider/account reference, ordinal, normalized operation state, opaque provider operation ID, timestamps, error code (not raw secret-bearing body).
   - FK `(merchant_id, environment, payment_id)` to `payments`; unique `(payment_id, attempt_number)`; scoped unique provider operation ID where provider permits.
   - Retain attempts; never overwrite an ambiguous outcome with a guessed failure.

5. `idempotency_records`
   - `storage_key TEXT PRIMARY KEY` constrained to exactly 64 lowercase hex characters; value is SHA-256 over canonical merchant/environment/operation/provider-account/key scope. The raw key is not stored. Digest collision risk is computationally negligible but remains a design tradeoff.
   - Also store merchant, environment, operation, optional provider account, SHA-256 payload fingerprint, payment ID, `IN_PROGRESS|SUCCEEDED|FAILED_FINAL|UNKNOWN` state, sanitized cached response, expiry and timestamps.
   - The unique `storage_key` is the database claim serialization point. Do not perform an application-only check-then-insert.
   - FK to merchant and, where present, a provider account from the same merchant/environment. `FAILED_FINAL` means known no further side effect is pending; uncertainty must be `UNKNOWN`.
   - `PostgresPaymentStore` applies a provisional 365-day default when trusted application config omits retention; explicit server-side override remains possible. No automatic cleanup occurs. Final records past expiry continue reserving scope and return policy-required; unresolved `UNKNOWN` never expires into reclaim. Production duration, deletion/privacy balance and key-reuse policy remain OPEN.

6. `payment_evidence`
   - Append-only references to verified provider response, authenticated webhook or reconciliation evidence; include source, provider/account, received/verified timestamps and opaque evidence location/digest. Avoid storing full sensitive provider payloads by default.
   - Evidence verification/retention/privacy policy remains open. A type label or digest alone is not proof of authenticity.

7. `audit_events`
   - Append-only actor/action/tenant/environment/aggregate/reference/timestamp records. No secrets or raw credentials. Tamper-evident/retention requirements need a separate security decision.

## Atomic idempotency claim

The application-only `lookup-then-insert` pattern is forbidden. A PostgreSQL store must:

1. Begin a short transaction.
2. `INSERT` an `IN_PROGRESS` idempotency record with its computed scope key, fingerprint and policy-provided expiry, using the database unique index as the serialization authority (`INSERT ... ON CONFLICT DO NOTHING RETURNING ...`). Insert the corresponding internal operation/attempt reference in the same transaction when applicable.
3. If the insert returns a row, this caller owns the claim and commits before any provider network call.
4. If conflict occurs, read the existing row using `SELECT ... FOR UPDATE` and compare scope, fingerprint, state and expiry. Return conflict for changed payload, in-progress for an active operation, cached response for an unexpired final result, recovery-required for `UNKNOWN`, and policy-required for expiry. Never automatically execute a second provider call as a consequence of conflict/timeout.
5. Use bounded lock/statement timeouts and retry only known-safe database serialization/deadlock outcomes with bounded attempts; a connection loss during commit is itself an ambiguous local outcome and requires lookup by the same scope.

The exact database protocol needs integration tests with concurrent real PostgreSQL sessions before any atomic-claim guarantee can be made. A fake store cannot prove unique-index or crash behavior.

## Transaction boundaries and state updates

- Claim: short database transaction; commit before external network interaction.
- Provider operation: outside the database transaction; record/retain the operation reference and mark `UNKNOWN` after timeout or uncertain transport result. Never hold a row lock across provider network I/O.
- Finalization: after independently verifying provider evidence, one short transaction locks/optimistically updates the payment (`UPDATE ... WHERE version = expected_version AND status = allowed_from`), appends evidence and attempt outcome, records the idempotency final response, and appends audit event. Require exactly one row updated; otherwise roll back and reload/reconcile.
- Recovery: acquire an explicit lease/lock or use optimistic version/CAS; query provider only through an approved adapter and provider-supported lookup semantics. Do not retry create blindly for `UNKNOWN`.
- Provider idempotency is an additional defense, not a replacement for BaturPay's local unique claim; provider key semantics/retention must be validated per provider.

## Indexes and tenant safety

- Unique idempotency scope index described above (the key consistency gate).
- `payments (merchant_id, environment, created_at DESC)` for tenant-scoped listing.
- `payment_attempts (payment_id, attempt_number)` unique; scoped provider operation reference index.
- `idempotency_records (state, updated_at)` for recovery workers and `(expires_at)` for retention maintenance; maintenance must never delete unresolved `UNKNOWN` records.
- `payment_evidence (payment_id, received_at)` and `audit_events (merchant_id, environment, occurred_at)`.
- Scope every query and FK by tenant/environment. PostgreSQL RLS may be defense-in-depth but must not replace application authorization or correct composite FKs. Avoid cross-tenant identifiers as sole authorization checks.

## Migrations and errors

- Versioned, reviewed SQL migrations; no destructive auto-sync. Use expand/backfill/validate/contract for changes to populated tables.
- Set lock and statement timeouts for deployment; test migration against realistic volume, backup/restore, and rollback/forward-fix strategy before production.
- Map unique violations by named constraint to domain outcomes; distinguish connection/serialization/deadlock/constraint errors; do not return raw SQL or provider details to callers. Preserve safe correlation IDs and redact secrets.
- Production migration, backups, retention/destruction and RLS policies require operator approval and environment-specific runbooks.

## Implemented persistence boundary (static review; not database-verified)

The version-1 migration also installs database triggers: payment insert must start `CREATED` at version 1; normal payment updates cannot alter immutable request fields or jump to provider/terminal statuses; only an in-progress operation may mark its payment `UNKNOWN` with an exact version increment. The paired idempotency update then requires that payment to be `UNKNOWN` in the same transaction. Final idempotency rows are immutable; `UNKNOWN` cannot be silently reset. Payment and idempotency rows cannot be deleted through `DELETE`, and evidence rows cannot be updated/deleted. This deliberately blocks all success/failure transitions because no evidence-verification authority exists yet.

The guarded integration suite resets only local database named `baturpay_test`. PostgreSQL `TRUNCATE` bypasses row delete triggers; test-reset method checks actual DB name and requires explicit opt-in. Production DB role ownership/grants still need operator hardening so app roles cannot alter/drop triggers or truncate tables.

## Explicitly absent

Implemented migration currently creates `merchants`, `provider_accounts`, `idempotency_records`, `payments`, and `payment_evidence`; the design-only `payment_attempts` and `audit_events` tables are not implemented. `PostgresPaymentStore` uses `pg`, a checksum-tracked version-1 migration, explicit transactions, a unique hashed scope key, conditional updates and parameterized SQL. `AtomicIdempotencyStore` remains an abstract domain port; no database-backed conformance implementation or real concurrency behavior is verified until local PostgreSQL integration tests pass. No RLS policy, backup/restore or deployed recovery worker exists.