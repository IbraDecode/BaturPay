# First Non-Financial Demo

Status: PARTIAL_LOCAL_FOUNDATION; NOT a multi-agent demo. Hermes created and tested local task contract, registry, and process-adapter readiness gates. OpenCode did not implement this code; no external agent request was sent. No payment functionality is in scope.

## Goal

Complete a later end-to-end flow where Hermes creates a task, OpenCode implements a small pure TypeScript utility in an isolated workspace, local tests run, and Hermes verifies the result and evidence. Claude Code is excluded from the initial architecture.

## Already verified locally

- Task validator, status transitions, JSON registry, dependency gate, workspace-root/symlink checks, same-workspace active-owner check, and append-only evidence interface are implemented under `packages/orchestrator/src/`.
- Local test suite: `npm test` in `packages/orchestrator`; 26 tests passed.
- Process adapter uses argument-array spawning without a shell, bounded output, timeout/exit reporting and a reduced environment. Adapter task execution refuses unless explicit owner authorization and sandbox validation are supplied.
- OpenCode readiness check reported v2.2.0, no authenticated integration, and an unverified custom model endpoint. No model request was sent.

These checks demonstrate local Hermes-authored code only, not OpenCode performance, sandbox confinement, authentication, or multi-agent handoff.

## Remaining prerequisites

1. Owner verifies the configured OpenCode endpoint/provider and authorizes its account, model usage, and cost ceiling. No credential is to be sent in chat or a prompt.
2. Owner/infrastructure approves and provides a non-root, host-enforced isolated environment. Current process runs as root in LXC; worktree alone is not isolation.
3. Verify OpenCode permission behavior and denial of filesystem/network escape in a harmless sandbox before a coding task.
4. Establish a clean task workspace and ownership lock; ensure no concurrent writer.
5. Confirm runtime/typecheck strategy; no app dependencies have been installed.

## Future demo contract

- `task_id`: `demo-task-validation-001`
- `title`: Implement task-ID utility
- `objective`: implement a pure task-ID validator and focused unit tests
- `owner`: `OPENCODE`
- `workspace`: a newly created isolated worktree below an approved root
- `dependencies`: none
- `acceptance_criteria`: accepts valid IDs; rejects missing/malformed/overlong IDs; deterministic errors; tests cover success/failure; no unrelated edits
- `risk_level`: `LOW`
- `status`: initially `PROPOSED`
- `validation_commands`: local approved test/typecheck commands
- `evidence`: exact command, exit code, changed files, test summary, base/head commit, timestamps
- `review_status`: `PENDING` until Hermes checks acceptance/diff/tests
- `approval_required`: false for synthetic local task; agent model-use authorization is a separate prerequisite

## Run and acceptance procedure

1. Hermes validates contract, dependencies, workspace realpath, and no active workspace owner.
2. Move task through guarded states only after preconditions hold.
3. Run OpenCode using the version-checked `opencode run` interface through bounded adapter; record actual exit code and sanitized output. Do not set `--auto` or pass unneeded credentials.
4. Run local tests independently, inspect exact diff and file scope, verify evidence shape and acceptance criteria.
5. Hermes approves/blocks based on test and diff evidence. Do not mark DONE on an agent claim alone.
6. Preserve evidence and workspace until reviewed; no automatic commit/push.

Stop on auth/billing prompt, sandbox escape, secret exposure, timeout, nonzero exit, scope breach, or any payment/production operation. This demo remains BLOCKED until OpenCode authorization and isolation prerequisites are met.
