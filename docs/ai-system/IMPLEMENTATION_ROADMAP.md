# Implementation Roadmap

Status: staged roadmap with local orchestration prototype underway; no payment application implementation implied.

Every phase should have a unique work package, one owner, dependencies, scoped files, acceptance criteria, deadline/retry limits, verification commands, evidence, and rollback plan. Use synthetic data and a simulated provider until separately approved.

| Phase | Goal and scope | Owner | Acceptance / evidence | Dependencies / rollback |
|---|---|---|---|---|
| 0. Repository context | Establish docs, Git baseline, project constraints and open decisions. | Hermes coordinates; human reviews context | Completed and pushed in prior commits; current repository state is verified per run report. | Done. |
| 1. Tool/environment readiness | Recheck installed versions, CLI/auth status, permissions without exposing secrets; document capabilities and blockers. | Hermes | Local evidence and official-source matrix; no OpenCode model task yet. | In progress; do not change global configuration. |
| 2. Multi-agent role/design | Hermes orchestrates and verifies; OpenCode is planned implementer; Claude is excluded from initial setup. | Hermes | Roles and gates documented; no direct shared protocol assumed. | Updated; remote call still gated. |
| 3. Local orchestration prototype | Implement task contract, validator, state transitions, local registry, evidence/review gates, bounded process runner and CLI. | Hermes implementation; local tests | `npm test` passes; CLI create/list/transition smoke test; no external AI or payment operation. | Prototype implemented/tested locally; evidence in current execution; no sandbox claim. |
| 4. OpenCode execution readiness | Verify the trusted endpoint/account, cost authorization, and least-privilege runtime boundary; then run one bounded task if approved. | Owner authorizes; Hermes coordinates; OpenCode executes | Actual OpenCode task output, diff and independent Hermes tests/verification. | BLOCKED: no authenticated integration reported; endpoint unverified; current process is root in LXC without an agent sandbox. |
| 5. Engineering baseline | Evaluate TypeScript/package/test/typecheck strategy and dependency policy. | Hermes researches; OpenCode may implement after readiness | Reproducible toolchain with typecheck and tests, minimal pinned dependencies. | Node 22 built-in test + strip-types currently used; LSP lacks Node types, formal typecheck not done. |
| 6. Payment domain specification | Define payment lifecycle, idempotency, adapter/webhook, refund, ledger, reconciliation, tenant/environment boundaries. | Hermes drafts; human for policy | Approved contracts/invariants and adversarial cases. | Not started; business/regulatory decisions remain open. |
| 7. Payment application | Add API, storage, simulator and operational features incrementally only after domain contracts. | OpenCode after readiness | Tests and security review for each module; no production data. | Not started. |
| 8. Provider sandbox and production readiness | Select provider only with owner agreement; separate sandbox and production decisions. | Human selects/approves; engineering implements | Provider contract evidence; explicit legal/security/operational approvals. | Not started; no live credentials or transactions. |

## Current position

Local task-contract/orchestration primitives exist and their 27 unit tests pass; CLI smoke test confirmed create, list, and guarded lifecycle using a disposable registry. No OpenCode coding task has run, no remote model request was sent, and no payment application/schema/dependency/CI exists. The local registry is a single-process local prototype, not a secured distributed task queue or OS sandbox. TypeScript LSP/typecheck has not passed because Node type declarations and `tsc` are absent; no dependencies were installed. OpenCode remote dispatch remains blocked pending trusted provider/auth/cost confirmation and safe isolation.
