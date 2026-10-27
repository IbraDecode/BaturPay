# Implementation Roadmap

Status: staged proposal; no application implementation implied.

Every phase should have a unique work package, one owner, dependencies, scoped files, acceptance criteria, deadline/retry limits, verification commands, evidence, and rollback plan. Use synthetic data and a simulated provider until separately approved.

| Phase | Goal and scope | Owner | Acceptance / evidence | Dependencies / rollback |
|---|---|---|---|---|
| 0. Repository context | Establish docs, Git baseline, project constraints and open decisions. | Hermes coordinates; human reviews context | Required docs exist, links resolve, labels distinguish settled direction vs proposal/approval. Git status and file inventory recorded. | None. Revert only new documentation if inaccurate; no destructive changes. |
| 1. Tool/environment readiness | Recheck installed versions, permission/auth state without exposing secrets; document capabilities and blockers. | Hermes; platform CLI checks | Version/help outputs; sanitized auth status; official-source matrix; security risks. | Phase 0. Do not alter global configuration. |
| 2. Multi-agent design | Specify task/result contract, state transitions, isolation, approvals and verification gates. | Hermes | Contract/schema reviewed; transition and failure cases testable. | Phase 1. Amend docs, no runtime dispatcher yet. |
| 3. Minimal coordination prototype | Only after tool readiness: local schema/state validator, worktree wrapper and evidence layout if necessary. | OpenCode implements; Claude reviews if authenticated; Hermes verifies | Unit tests for valid/invalid transitions, duplicate task IDs, timeout/failure paths; clean isolated worktree demo. | Phase 2. Remove prototype branch/worktree; retain evidence. |
| 4. Engineering baseline | Evaluate/decide TypeScript runtime and package manager, lint/type/test tools, PostgreSQL/Redis role, CI and dependency policy. | Hermes researches; OpenCode proposes/implements; independent review | Reproducible install/build/checks and documented versions/licensing/security. | Phases 0-3 as appropriate. Remove dependencies/config on isolated branch if rejected. |
| 5. Domain specification | Define payment lifecycle, idempotency, adapter/webhook, refund, ledger, reconciliation, tenant/environment boundaries. | Domain/engineering workgroup; human for policy | State diagrams, contracts, invariants, adversarial cases, unresolved policy register. | Research/provider assumptions. No real provider, accounting policy or fund flow without owner approval. |
| 6. Domain core | Implement smallest pure domain model and transition authority, with property/unit tests. | OpenCode; Claude reviews high-risk diff | Allowed transitions enforced; UNKNOWN behavior; evidence provenance; negative/property tests pass. | Phase 5. Revert feature branch if invariants fail. |
| 7. Persistence/API/simulator | Add DB constraints/migrations, idempotent API, simulated adapter, worker and webhook processing incrementally. | OpenCode | Integration/concurrency/replay/failure tests; migration forward/backward behavior locally; no provider secrets. | Phases 4-6. Reset disposable local DB only. |
| 8. Operational foundation | Observability, audit trail, reconciliation simulator, dashboards and security review. | OpenCode + independent review | Evidence-backed operational scenarios and threat-model findings resolved or accepted. | Phases 6-7. No production deployment. |
| 9. External provider sandbox | Select provider and obtain required agreements/approval; integrate sandbox credentials securely. | Human selects/approves; engineering implements | Contract tests, credential redaction/rotation, failure/timeout/reconciliation tests, provider approval evidence. | Legal/commercial and technical review. Disable integration/revoke test credential if needed. |
| 10. Production readiness | Separate legal, financial, security, reliability, operational, incident, backup and deployment review. | Human decision owners | Explicit approvals, live readiness evidence and rollback plans. | All prior phases; production action requires separate explicit approval. |

## Current position

Phase 0 documentation and local Git initialization are underway/completed only when verified in the run report. Phase 1 research is partial. No application, schema, dependencies, CI, agent dispatcher, or E2E demo exists. Authentication blockers prevent claiming that coding agents have collaborated live.
