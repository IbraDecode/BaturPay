# Implementation Roadmap

Status: staged roadmap with local orchestration prototype underway; no payment application implementation implied.

Every phase should have a unique work package, one owner, dependencies, scoped files, acceptance criteria, deadline/retry limits, verification commands, evidence, and rollback plan. Use synthetic data and a simulated provider until separately approved.

| Phase | Goal and scope | Owner | Acceptance / evidence | Dependencies / rollback |
|---|---|---|---|---|
| 0. Repository context | Establish docs, Git baseline, project constraints and open decisions. | Hermes coordinates; human reviews context | Completed and pushed in prior commits; current repository state is verified per run report. | Done. |
| 1. Tool/environment readiness | Recheck installed versions, CLI/auth status, permissions without exposing secrets; document capabilities and blockers. | Hermes | Local evidence and official-source matrix; no OpenCode model task yet. | In progress; do not change global configuration. |
| 2. Multi-agent role/design | Hermes orchestrates and verifies; OpenCode is planned implementer; Claude is excluded from initial setup. | Hermes | Roles and gates documented; no direct shared protocol assumed. | Updated; remote call still gated. |
| 3. Local orchestration prototype | Implement task contract, validator, state transitions, local registry, evidence/review gates, bounded process runner, fixed validation executor and CLI. | Hermes implementation; local tests | `npm test` (33 passed), `npm run typecheck` passed; fixed executor CLI ran tests/typecheck and persisted `EXECUTED` evidence. `npm audit --omit=optional`: 0 vulnerabilities. | Implemented/tested locally; no sandbox claim; local JSON prototype only. |
| 4. OpenCode execution readiness | Verify trusted endpoint/account, cost authorization, and least-privilege runtime boundary; then run one bounded task if approved. | Owner authorizes; Hermes coordinates; OpenCode executes | Actual OpenCode task output, diff and Hermes-run tests/typecheck/verification. | BLOCKED: `opencode auth list` reports no authenticated integration; endpoint unverified; root in LXC without agent sandbox. |
| 5. Engineering baseline | Continue CI, package policy, dependency review, and application stack decisions. | Hermes researches; OpenCode may implement after readiness | Reproducible toolchain with typecheck/tests and minimal pinned dependencies. | Node 22 built-in tests; TypeScript 5.9.3 and Node types 22.20.3 pinned as dev dependencies; npm audit reported zero vulnerabilities at install. |
| 6. Payment domain specification | Define payment lifecycle, idempotency, adapter/webhook, refund, ledger, reconciliation, tenant/environment boundaries. | Hermes drafts; human for policy | Approved contracts/invariants and adversarial cases. | Not started; business/regulatory decisions remain open. |
| 7. Payment application | Add API, storage, simulator and operational features incrementally only after domain contracts. | OpenCode after readiness | Tests and security review for each module; no production data. | Not started. |
| 8. Provider sandbox and production readiness | Select provider only with owner agreement; separate sandbox and production decisions. | Human selects/approves; engineering implements | Provider contract evidence; explicit legal/security/operational approvals. | Not started; no live credentials or transactions. |

## Current position

Local task-contract/orchestration primitives and fixed validation executor are implemented. Latest typecheck and unit-test results are reported with this phase; a CLI validation smoke test verified the test/typecheck allowlist and `EXECUTED` evidence records. OpenCode has not run a coding task and no remote model request was sent. No payment app/schema/CI exists. The local registry remains single-process prototype state, not a secure queue or OS sandbox. TypeScript typechecking is now configured with pinned development tools. OpenCode remote dispatch remains blocked pending trusted provider/auth/cost confirmation and safe isolation.
