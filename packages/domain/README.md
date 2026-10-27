# BaturPay Domain Foundation

Status: pure local domain model prototype; no provider, persistence, API, database, or funds flow is implemented.

## Payment state machine

`src/payment.mts` exports a `Payment` value, proposed status set, runtime invariants, and a pure `transitionPayment` function. It validates merchant/payment identifiers, environment (`SANDBOX`/`PRODUCTION`), service model (`CONNECTED_PROVIDER`/`BATURPAY`), positive integer minor-unit amount, ISO-like 3-letter uppercase currency, status, and version.

A transition returns a new payment with version incremented; it does not mutate its input. Every transition requires evidence metadata. Terminal outcomes require provider-status, verified-webhook, or verified-reconciliation evidence labels. `UNKNOWN` is not `FAILED` and can only resolve with trusted provider status or verified reconciliation labels. These labels are caller-supplied values at this pure-function layer; they do NOT prove the underlying evidence was authentic. A future application service must verify and persist evidence before calling this function.

The transition graph and statuses are an initial proposed contract, not validated against a selected provider. Provider-specific semantics, event ordering, cancellation/expiry behavior, and policy approval remain open. Do not use this package alone as an authoritative payment-state authority or to execute real transactions.

## Tests

Domain tests run with the orchestrator package:

```sh
cd packages/orchestrator
npm test
npm run typecheck
```

## Idempotency and provider boundary

`src/idempotency.mts` defines scoped keys, canonical payload fingerprints, duplicate/fingerprint-mismatch/in-progress/replay/unknown/expiry decisions, and an `AtomicIdempotencyStore` port. It does not implement atomic claims or storage; a future PostgreSQL adapter must enforce the unique scope index and resolve claim conflicts transactionally. A timeout or `UNKNOWN` never authorizes a blind retry. Retention duration is supplied as configuration, and expiry does not silently reclaim a key.

`src/provider-adapter.mts` defines request/result/capability types, a runtime response normalizer that falls back to `UNKNOWN` for malformed responses, and a deterministic `FakePaymentAdapter` for tests. Adapter results are observations only; they cannot mutate a `Payment`. The fake does not connect to any service and is not a production provider.

## Not implemented

No idempotency persistence/concurrency control, API, webhook authentication, PostgreSQL schema/migration/connection, ledger, real refund, settlement, reconciliation engine, production provider implementation, recovery worker, or production financial behavior exists yet. See `docs/architecture/PERSISTENCE_DESIGN.md` and `docs/architecture/IDEMPOTENCY_CONTRACT.md`.