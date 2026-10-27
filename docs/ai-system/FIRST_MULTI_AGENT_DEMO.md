# First Multi-Agent Demonstration (Plan)

Status: BLOCKED / NOT RUN. OpenCode and Claude Code are unauthenticated, and least-privilege execution has not been implemented or validated. This document describes acceptance criteria only; it is not evidence of a successful demo.

## Goal

Verify an end-to-end, nonfinancial workflow: Hermes produces a validated task, OpenCode implements one pure TypeScript utility in an isolated task worktree, a deterministic test runner verifies it, Claude Code independently reviews a pinned diff read-only, and Hermes accepts/rejects the outcome based on evidence.

## Safety and scope

- No payment code, provider calls, credentials, production data, deployment, package installation beyond explicitly approved minimal dev tooling, or network-dependent runtime behavior.
- Use a synthetic string/task-ID validation function with deterministic local tests.
- Use a dedicated worktree and one implementation owner. Reviewer must not write to that worktree.
- Require approved auth account/cost limits and an owner-approved isolation plan first.
- Do not use permission-bypass flags. Stop if unexpected auth, billing, permission or network prompts appear.

## Preconditions

1. Owner authorizes OpenCode and Claude account/provider use and acceptable spend limits.
2. Owner approves least-privilege execution strategy; verify actual file/command access limits.
3. Verify tool versions and relevant flags from local help; check authentication status without exposing credential data.
4. Repository has a clean base commit; no concurrent task owns the proposed files.
5. A local TypeScript runtime/test harness has been approved and verified, or the task uses an already available test runner. No dependency install without separate evaluation.

## Task contract (example)

- `task_id`: `demo-task-validation-001`
- `goal`: implement a pure `isValidTaskId` helper and deterministic tests.
- `scope`: only `packages/shared/src/task-id.ts` and its adjacent test file (paths finalized after repo conventions are approved).
- `forbidden`: payment/domain/provider/security config, credentials, lockfiles, global configuration, production or external services.
- `owner_agent`: OpenCode.
- `reviewer`: Claude Code (read-only, pinned diff).
- `acceptance_criteria`: accepts documented valid IDs; rejects empty, malformed, overlong IDs; deterministic; tests cover boundaries; no unrelated files changed.
- `verification`: exact formatter/lint/typecheck/test commands selected from repository toolchain, all exit 0; inspect diff; reviewer reports findings or explicitly none.
- `timeout`: 5 minutes per agent call; one attempt, then stop and report failure; no automatic retry.
- `evidence`: base/head commit, scoped diff, sanitized stdout/stderr, tool versions, exact commands/exit codes, review output and final Hermes decision.

The task ID above is a planned fixture, not a registry entry or a claim that the task has run.

## Procedure

1. Hermes records the task contract and confirms it passes schema validation and no file ownership conflict exists.
2. Create a clean dedicated Git worktree from the approved base commit.
3. Invoke OpenCode with only assigned context and permissions; monitor timeout/exit and inspect changed files.
4. Run local deterministic checks outside the agent; save sanitized evidence.
5. Pin the resulting diff/base/head and invoke Claude Code with read-only tools and a narrow request to report correctness, security, maintainability, and test gaps. Do not give it edit permission.
6. Resolve findings in a new explicitly assigned implementation turn/worktree; rerun the same checks and review if modified.
7. Hermes validates all criteria, test exit codes, expected file list, review outcome and scope. Mark VERIFIED only if all evidence passes; otherwise BLOCKED/FAILED.
8. Preserve review/evidence and worktree until owner confirms cleanup. Do not auto-commit or push demo code.

## Stop conditions

Authentication failure, unexpected cost/billing, missing permission controls, workspace escape, secret exposure, timeout, file-scope violation, failing test, reviewer write access, ambiguous Git state, or any financial/production operation attempt.

## Recovery

Stop agents; preserve logs/diff and worktree; revoke/rotate credentials only through owner-approved provider controls if exposure occurs; do not reset or clean destructively. Record the incident and escalate. The demonstration remains BLOCKED until preconditions and evidence are satisfied.
