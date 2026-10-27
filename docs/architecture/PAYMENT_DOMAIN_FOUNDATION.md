# Payment Domain Foundation

Status: PROPOSED / locally implemented pure transition prototype. It is not a provider-validated or production payment contract.

## Current implemented slice

`packages/domain/src/payment.mts` defines:

- Payment identity: payment ID, merchant ID, environment, service model, amount in minor units, currency, status and version.
- Environments: `SANDBOX`, `PRODUCTION`.
- Service models: `CONNECTED_PROVIDER`, `BATURPAY` (classification only; no operational flow implemented).
- Candidate payment statuses: `CREATED`, `PENDING`, `REQUIRES_ACTION`, `PROCESSING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, `UNKNOWN`.
- Pure validation/transition function that returns a new aggregate value and increments version; it does not mutate input or persist data.

## Invariants in this prototype

- IDs and required strings are non-empty; amount is a positive safe integer in minor units; currency is three uppercase letters; version is a positive integer.
- Terminal statuses (`PAID`, `FAILED`, `EXPIRED`, `CANCELLED`) cannot transition.
- Transitions are explicit in a static graph; arbitrary state changes are rejected.
- Every allowed transition requires an evidence label. Terminal outcomes require a provider-status, verified-webhook, or reconciliation evidence label.
- `UNKNOWN` is not equivalent to `FAILED`; it only resolves to a known state with a trusted provider-status or verified-reconciliation evidence label.

Important limitation: evidence labels are plain caller-supplied metadata in this pure function; they are not proof of signature verification, provider authenticity, persistence, or authorization. A future domain/application service must validate and persist evidence before using it. Adapters must not directly mutate authoritative state.

## Proposed transition graph (initial, unverified)

- `CREATED` → `PENDING`, `REQUIRES_ACTION`, `PROCESSING`, `FAILED`, `EXPIRED`, `CANCELLED`, `UNKNOWN`
- `PENDING` → `REQUIRES_ACTION`, `PROCESSING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, `UNKNOWN`
- `REQUIRES_ACTION` → `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, `UNKNOWN`
- `PROCESSING` → `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, `UNKNOWN`
- `UNKNOWN` → `PENDING`, `REQUIRES_ACTION`, `PROCESSING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED` with trusted resolution evidence
- Terminal statuses have no outgoing transitions

This graph intentionally requires provider and product validation. It may be too permissive for out-of-order events or some provider semantics; do not treat it as final policy.

## Service-model distinction

`CONNECTED_PROVIDER` identifies a merchant-owned provider-account path. `BATURPAY` identifies a proposed service path where BaturPay provides capability. The code currently treats these only as an enum field; it does not implement or imply identical fund flow, custody, obligations, pricing, settlement, or liability. Decisions OD-001–OD-005 remain open. No wallet, custody, payout, refund, settlement execution, or live provider integration is implemented.

## Deferred domain contracts

Before persistence/API implementation, specify and test: idempotency scope and concurrent request behavior; provider capability/adapter contract; evidence and webhook authentication; duplicate/out-of-order event policy; refund concurrency/amount bounds; audit-event schema; recovery behavior; merchant/environment authorization; accounting/ledger model; reconciliation versus settlement. Database/queue selection remains a separate, dependency-driven decision.

## Verification

The model is exercised by `packages/domain/test/payment-state.test.mts`. The orchestrator package's strict typecheck includes the domain source/tests; its fixed test executor includes this domain test file. This only verifies local code behavior, not provider compatibility, financial correctness, regulatory suitability, or production readiness.
