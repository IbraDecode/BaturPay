# BaturPay — Canonical Project Context

Version: 0.1 (initial context)
Status: draft baseline; not a final product, legal, accounting, or provider specification.

## Authority labels

- **Established project direction:** BaturPay is a new payment orchestration infrastructure project, intended to give merchants a consistent integration over provider-specific adapters. Reliability, financial integrity, security, status consistency, idempotency, recovery, observability, auditability, provider extensibility, and merchant integration simplicity are priorities.
- **Planned, not implemented:** all product features and architecture below. No provider support or production service is currently established.
- **Recommendation:** use a modular monolith initially; make boundaries explicit and split services only when measured needs justify it. Use synthetic/sandbox data and a simulated provider for early development.
- **Assumption to validate:** TypeScript/Node.js, PostgreSQL, Redis, BullMQ or an equivalent worker, Next.js dashboards, Git/CI, and container or other isolation. Do not make irreversible commitments until compatibility, security, operational cost, and team capacity are assessed.
- **Human approval required:** provider/commercial selection; real credentials; production access; fund flow; custody; settlement execution; payout; wallet or stored value; pricing/fees; accounting policy; regulatory classification/obligations; live transactions; production deployment and destructive production schema/data operations.

## Product intent

BaturPay aims to let a merchant integrate once against a stable BaturPay contract. Provider adapters translate internal contracts to provider-specific requests/responses and expose explicit capabilities. An adapter cannot directly mutate internal payment state; all evidence from API responses, webhooks, polling, and reconciliation passes through one validated domain transition authority.

Two planned service paths:

1. `CONNECTED_PROVIDER`: merchant connects its own provider account. BaturPay offers orchestration and only those normalized capabilities verified for that provider.
2. `BATURPAY`: merchant uses capabilities made available through BaturPay. This path is blocked on human business, legal/regulatory, commercial, custody/fund-flow, settlement, operational, and pricing decisions. Do not implement fund custody, merchant wallet, payout, or money movement by implication.

Both paths should share a coherent payment core where their domain requirements permit it.

## Planned MVP (priority, not authorization)

Merchant API authentication; payment creation and retrieval; provider abstraction; attempts; dynamic QRIS through a properly authorized provider; secure webhook intake; idempotent processing; refunds; reconciliation foundation; merchant/operations dashboards; audit trail; sandbox; observability and automated tests. QRIS/provider integration must not be represented as supported until legally/contractually cleared and technically verified. Begin with simulated provider behavior.

## Domain investigation map

Candidate concepts—not yet approved schema: Merchant, MerchantEnvironment, APIKey, PaymentIntent, Payment, PaymentAttempt, ProviderAccount, ProviderCapability, ProviderOperation, OperationExecution, IdempotencyRecord, WebhookEvent/Delivery, PaymentEvidence, RoutingDecision, RecoveryCase, Refund, FeeCalculation, EconomicEvent, Journal/JournalEntry, SettlementBatch, ReconciliationRun, AuditEvent.

Before schema design establish ownership, aggregate boundaries, lifecycle, source of truth, retention, isolation, concurrency semantics, evidence provenance, and operational recovery for each necessary concept. Do not create every candidate entity by default.

### Payment state and ambiguous outcomes

Initial proposed states: `CREATED`, `PENDING`, `REQUIRES_ACTION`, `PROCESSING`, `PAID`, `FAILED`, `EXPIRED`, `CANCELLED`, `UNKNOWN`. This is a proposal requiring provider/domain validation. `UNKNOWN` means outcome cannot yet be established, not `FAILED`; do not issue a potentially duplicate financial operation until a safe recovery protocol resolves ambiguity. All state transitions must be validated by a single domain authority from persisted evidence.

### Idempotency

Define key scope (merchant, environment, operation and any provider account boundary), canonical request fingerprint, behavior for same key/different payload, concurrent requests, retention, crash recovery, and retry semantics before implementation. PostgreSQL is the candidate durable correctness boundary; Redis alone is insufficient for financial deduplication. This is a design requirement, not implemented behavior.

### Provider adapters and webhooks

Capabilities vary. Contracts should explicitly cover create/status/refund where supported, webhook authentication, normalized errors, timeouts, safe retry, ambiguous outcomes and recovery. Webhook intake must anticipate duplicates, replay, out-of-order events, persistence, retry/dead-letter behavior, redaction, and observability. Do not trust event content before provider-specific verification.

### Ledger, refund, reconciliation

Ledger model and accounting policy remain open. If approved, posted entries must be immutable; corrections use compensating entries; journals balance and financial recording is transactionally consistent. Do not implement wallet/custody/withdrawable balances or real movement without approval.

Refund design must define full/partial/parallel/in-flight/failed/ambiguous outcomes, maximum refundable amount, idempotency, cancellation/release semantics for reservations, provider reconciliation, and concurrency controls so successful refunds plus active commitments cannot exceed refundable payment value.

Keep internal/provider reconciliation distinct from settlement calculation, settlement approval, and proof of settlement execution. A computed settlement is not evidence that funds moved.

## Non-functional direction

Security and least privilege; tenant/environment isolation; deterministic and auditable financial decisions; resilience to duplicate and out-of-order input; recoverability; traceable evidence; safe credential handling; bounded automation; explicit human gates. Define measurable service-level and retention targets later; do not invent targets as settled requirements.

## Current state

Repository initialized at `/root/baturpay` from an empty directory. Documentation baseline only. No application code, dependencies, schema, agent dispatcher, CI, tests, provider integration, or E2E multi-agent demonstration exists yet. The host runs as root; agent usage must be treated as elevated risk. OpenCode and Claude Code showed no authenticated integration during the initial local audit. Never expose credential values in reports.
