# Open Decisions Register

Status: initial register. No decision below is silently settled by a proposed technical design. Assign a human owner and record decision/date/evidence before implementation depends on it.

| ID | Decision / question | Why it matters | Safe interim position | Approval |
|---|---|---|---|---|
| OD-001 | Which provider(s) are commercially and legally authorized for MVP and dynamic QRIS? | Capability, contracts, geography, compliance, credential and operational requirements. | Simulated provider only; do not claim support. | Human owner |
| OD-002 | Is BATURPAY service path in MVP? What are legal entity, merchant onboarding, fund flow, custody and settlement responsibilities? | Could create regulated activity and material financial obligations. | Do not implement fund custody, wallet, payout or real movement. | Human/business/legal |
| OD-003 | What regulatory classification, licenses, obligations and jurisdiction apply? | Determines permissible product and controls. | Treat as unresolved; obtain qualified advice. | Human/legal |
| OD-004 | What is the canonical accounting and ledger model, chart of accounts, posting policy and correction policy? | Financial reporting and integrity. | No production ledger/accounting policy; document technical invariants only. | Human/finance |
| OD-005 | Pricing, fee calculation, tax, refunds of fees, settlement and reserves? | Financial/commercial policy. | No pricing or money movement implementation. | Human/business/finance |
| OD-006 | What are exact state transitions and terminal semantics across target providers? | Consistency, recovery and merchant contract. | Candidate graph remains PROPOSED; `transitionPayment` fails closed because no evidence verifier exists, and only conservative ambiguity-to-`UNKNOWN` is enabled. Validate remaining transitions per provider. | Product/domain owner |
| OD-007 | Idempotency key scope, canonicalization, retention, conflict behavior, and active-operation reservation semantics? | Prevent duplicate operations and unsafe retries. | Domain contract and PostgreSQL store propose merchant+environment+operation+provider-account+key scope, SHA-256 canonical payload fingerprint, and conservative duplicate/UNKNOWN decisions. Code uses provisional 365-day retention, no automatic deletion, and no key reuse after expiry. Store implementation exists but DB integration is NOT RUN; production retention/privacy and reuse policy remain OPEN. | Product/engineering; policy where financial |
| OD-008 | Refund commitment reservation/release rules for pending, failed, ambiguous and cancelled attempts? | Prevent over-refund under concurrency. | Block real refunds; model synthetic cases. | Product/finance |
| OD-009 | Tenant/environment boundary and API key lifecycle/roles? | Security and data isolation. | Design least-privilege separation; no final auth model. | Security/product |
| OD-010 | Data retention, privacy, residency, deletion and audit requirements? | Compliance and operational storage. | Minimize and redact synthetic/local data. | Human/legal/security |
| OD-011 | What are reliability/SLO, recovery time, recovery point and incident escalation targets? | Infrastructure and architecture sizing. | No numeric targets assumed. | Human/product/operations |
| OD-012 | Select final stack/tooling (TypeScript runtime/package manager, DB, queue, dashboard, isolation). | Reproducibility, maintenance and operating cost. | Evaluate available tools and compatibility; avoid unnecessary dependencies. | Engineering owner |
| OD-013 | How should AI agents run with least privilege (dedicated non-root user, sandbox/container, network policy)? | Current host runs as root; tool actions have elevated impact. | No global/system changes; use scoped worktree and narrow commands. | Human/system owner for material changes |
| OD-014 | Which agent-authentication methods/models are authorized and what cost limits apply? | Needed for actual agent dispatch; accounts/costs are user-controlled. | No login attempts or paid calls; report unauthenticated tools. | Human owner |
| OD-015 | Evidence retention, tamper-evidence and CI artifact policy? | Auditability and storage/security. | Keep only sanitized local evidence for prototypes. | Engineering/security |
| OD-016 | Production deployment, provider credentials and go-live approval process? | Prevent unauthorized live operations. | No deployment or live credentials. | Human owner |

## Decision record format

For each decision: ID, status (OPEN/PROPOSED/APPROVED/REJECTED), accountable owner, date, options considered, rationale, source evidence, consequences, review trigger, and explicit approver. A technical recommendation is not an approval.
