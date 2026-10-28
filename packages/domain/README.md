# BaturPay Domain Foundation

Status: pure payment-domain model plus PostgreSQL persistence/idempotency code and versioned migration are implemented locally; real PostgreSQL integration remains unverified because no server/client is available in this environment. No provider or payment API integration or real funds flow exists.

## Payment state machine

`src/payment.mts` exports a `Payment` value, proposed status set, runtime invariants, and a pure `transitionPayment` function. It validates merchant/payment identifiers, environment (`SANDBOX`/`PRODUCTION`), service model (`CONNECTED_PROVIDER`/`BATURPAY`), positive integer minor-unit amount, ISO-like 3-letter uppercase currency, status, and version.

`transitionPayment` is fail-closed: it never authorizes a status change from caller-supplied labels because no verifier capability exists yet. `markPaymentUnknown` creates a new value, increments version and marks only nonterminal payments ambiguous. It cannot declare success/failure or resolve `UNKNOWN`. Evidence labels remain metadata, not proof.

The transition graph and statuses are an initial proposed contract, not validated against a selected provider. Provider-specific semantics, event ordering, cancellation/expiry behavior, and policy approval remain open. Do not use this package alone as an authoritative payment-state authority or to execute real transactions.

## Tests

Domain tests run with the orchestrator package:

```sh
cd packages/orchestrator
npm test
npm run typecheck
```

## Idempotency and provider boundary

`src/idempotency.mts` defines scoped keys, canonical payload fingerprints and deterministic duplicate/conflict/replay/recovery decisions. `packages/orchestrator/src/postgres-store.mts` implements payment+claim creation in one transaction using a unique hashed scope key, persistence, restart inspection and ambiguity recovery. The implementation is not integration-verified without PostgreSQL. A timeout or `UNKNOWN` never authorizes a blind retry. Retention duration is explicit configuration; expired keys are not silently reclaimed.

`src/provider-adapter.mts` defines request/result/capability types, a runtime response normalizer that falls back to `UNKNOWN` for malformed responses, and a deterministic `FakePaymentAdapter` for tests. Adapter results are observations only; they cannot mutate a `Payment`. The fake does not connect to any service and is not a production provider.

## Not implemented

No payment API, webhook authentication, ledger, real refund, settlement, reconciliation engine, production provider implementation, recovery worker, or production financial behavior exists. PostgreSQL implementation is not verified until the integration suite passes against local isolated PostgreSQL. See `docs/architecture/PERSISTENCE_DESIGN.md` and `docs/architecture/IDEMPOTENCY_CONTRACT.md`.