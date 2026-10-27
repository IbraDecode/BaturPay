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

## Not implemented

No idempotency persistence/concurrency control, provider adapter, API, webhook authentication, database, ledger, refund, settlement, reconciliation engine, or production financial behavior exists yet.