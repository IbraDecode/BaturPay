# Architecture Principles

Status: initial principles and proposals, not a finalized system architecture.

## Established direction

- Merchant integrates once through a stable BaturPay contract; provider-specific behavior is behind explicit adapters.
- Connected-provider and BaturPay service paths should share a consistent payment core where valid.
- Reliability, financial integrity, security, consistent state, idempotency, recovery, observability and auditability are priorities.
- Begin from a modular monolith with explicit module boundaries; do not adopt microservices without measured need.
- Use simulated provider and synthetic data initially.

## Required design constraints

1. One validated payment transition authority consumes persisted evidence from API responses, webhooks, polling and reconciliation. Adapters must not mutate payment state directly.
2. Model provider capabilities explicitly; unsupported operations must not be implied.
3. Treat ambiguous `UNKNOWN` outcomes as unresolved; never equate to failure or blindly retry a financial operation.
4. Design idempotency for concurrent requests, process crashes, retries, scope separation and request fingerprint conflicts. A cache alone is not correctness authority.
5. Persist webhook evidence before downstream processing; verify authenticity, anticipate duplicates/replay/out-of-order arrival, and provide retry/dead-letter observability.
6. Protect merchant and environment isolation at API, application, worker and database boundaries; test cross-tenant access.
7. If a ledger is approved, maintain immutable posted entries, balanced journals, transactional consistency, deterministic fee calculations and compensating corrections.
8. Refund amount and in-flight commitments must be concurrency-safe and bounded by refundable payment amount; define release/recovery semantics formally.
9. Distinguish reconciliation from settlement calculation, approval and proof of actual execution.
10. Keep audit evidence traceable, access-controlled and redacted; avoid logging credentials or sensitive payment data.
11. Require human approval for custody/fund-flow, wallet/payout, pricing/accounting policy, regulatory matters and live financial operations.

## Stack recommendation to evaluate

TypeScript/Node.js, PostgreSQL, Redis, BullMQ or an equivalent, Next.js, Git/automated CI, and Docker or alternative isolation were suggested. These are not selected decisions. Compare maintenance, version compatibility, security, transaction/concurrency semantics, testability, operating cost, team capability, failure recovery and isolation. PostgreSQL is the candidate durable idempotency/financial integrity source; Redis must not be the sole guard.

## Architecture validation

Before accepting module boundaries or schemas, document required invariants and ownership; test state transitions, concurrent operations, DB constraints, retries, duplicate/out-of-order events, worker crash and tenant boundaries. Architecture decisions require ADRs and identify reversible versus human-approved choices.
