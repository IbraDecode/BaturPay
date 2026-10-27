# Development Workflow

Status: initial proposal; no code toolchain, CI, or test suite is installed for this project yet.

## Task lifecycle

For every task create a unique ID, objective, scope/allowed paths, exclusions, one owner, dependencies, acceptance criteria, verification commands, deadline/retry limit, status, evidence paths, reviewer, approval requirement, and change history. Proposed states: `BACKLOG → READY → ASSIGNED → RUNNING → VERIFYING → REVIEW → DONE`; alternatives `BLOCKED`, `FAILED`, `CANCELLED`, `APPROVAL_REQUIRED`. Define/validate transitions before implementing a dispatcher.

## Change workflow

1. Read canonical project context and relevant architecture/decision records. Identify unresolved decisions.
2. Confirm repository state and tool versions. Do not modify global configuration.
3. Assign one implementer; isolate code changes in a branch/worktree. Never allow concurrent agents to edit the same files.
4. Implement only the accepted scope. For financial behavior, require a documented invariant and adversarial acceptance tests first.
5. Run progressively relevant checks: format, lint, typecheck, unit tests, integration/contract tests, architecture/security checks, database/migration checks, and build. Do not invent commands before toolchain is chosen.
6. Review the actual diff and run checks independently. For higher-risk code, use an independent reviewer on a pinned diff/commit.
7. Record exact commands, exit codes, tool versions, base/head commit, sanitized outputs, test results, findings and remaining gaps.
8. Mark DONE only when all acceptance criteria have verifiable evidence and any required human approval is recorded. Otherwise report BLOCKED/FAILED/APPROVAL_REQUIRED.

## Payment-focused future verification

At minimum evaluate duplicate request and webhook, out-of-order events, provider timeout/ambiguous `UNKNOWN`, safe recovery, concurrent/partial refund bounds, transaction rollback, worker crash/retry, ledger balance/immutability if approved, reconciliation mismatch and cross-tenant/environment access. A passing unit suite alone is not sufficient evidence of financial correctness.

## Failure and recovery

Bound runtime and attempts. Stop retrying when outcomes are ambiguous or external side effects may have occurred. Preserve a sanitized failure report and evidence; revert only task-scoped changes using Git/worktree controls. Never reset/delete a database containing valued data. Escalate business, financial, regulatory, production and material security decisions to the owner.

## Evidence

Each evidence bundle should identify task ID, repository commit, working tree state, tool versions, environment, commands/results, review outcome, approvals and unresolved work. Redact secrets and sensitive data. Evidence does not imply production readiness.
