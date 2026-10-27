# Multi-Agent Orchestration Design

Status: local dispatcher prototype implemented and tested; external OpenCode execution remains BLOCKED and no end-to-end agent handoff has been tested.

## Candidate initial architecture

Use Hermes as coordinator and a repository-backed task/evidence contract. OpenCode is the sole initial coding agent, invoked as a bounded CLI subprocess only after owner authorization and sandbox validation. Keep one implementation owner per task. Hermes runs verification separately and inspects the diff/evidence before changing status. Claude Code is excluded from the initial architecture. The current local registry/process adapter does not itself prove agent execution or provide a security sandbox.

```text
Owner approval (when required)
          |
Hermes: task contract + routing + dependency/status tracking
          |
   assigned workspace (workflow isolation only)
          |
 OpenCode CLI (future; authorization + sandbox required)
          |
 automated checks -> Hermes diff/evidence verification
          |
 Hermes: DONE / FAILED / BLOCKED / approval required

Current implemented local components: contract validator, JSON task registry, and bounded subprocess helper. Current OpenCode dispatch: deliberately gated and not executed.
```

This is a repository-local prototype, not native Hermes↔OpenCode protocol integration. It currently validates/stores tasks and safely runs bounded local processes; it does NOT automatically dispatch tasks, execute validation command lists, create Git worktrees, inspect code diffs, or enforce OS isolation. OpenCode adapter checks readiness and refuses a remote task without explicit owner authorization and a caller-asserted validated sandbox. These are software gates, not proof that a sandbox exists.

## Task contract (TypeScript)

The implemented contract fields are `task_id`, `title`, `objective`, `owner`, `workspace`, `dependencies`, `acceptance_criteria`, `risk_level`, `status`, `validation_commands`, `evidence`, `review_status`, `approval_required`. Allowed owner values are `HERMES` and `OPENCODE`; risk values are `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`; statuses are `PROPOSED`, `READY`, `RUNNING`, `BLOCKED`, `REVIEW`, `DONE`, `FAILED`; review states are `NOT_REQUIRED`, `PENDING`, `APPROVED`, `REJECTED`. Task/evidence validation is implemented in `packages/orchestrator/src/task-contract.mts`. Registry and CLI are local JSON only.

The registry guards legal state transitions, dependency completion, workspace realpath under the configured root, exclusive RUNNING ownership for a workspace, executed validation evidence for every declared validation command, review outcome, and explicit human approval when `approval_required` is true. The local validation executor has a fixed allowlist for `ORCHESTRATOR_TESTS` and `ORCHESTRATOR_TYPECHECK`, and is limited to this package root; it never executes arbitrary task-provided shell strings. Evidence sources are labelled `CALLER`, `EXECUTED`, or `HERMES_REVIEW`; only `EXECUTED` validation records satisfy the validation gate. Labels reflect software pathways, not cryptographic attestation; a same-process caller can forge registry input. Treat local state as prototype, not an authoritative production audit log.

Result contract: task ID, summary, changed files, decisions, assumptions, exact commands/exit codes, test outputs/artifact references, risks, unfinished work, and human decisions required. Agent prose alone is not evidence.

Tests use the built-in Node runner with type stripping. Strict TypeScript typecheck is also configured and run separately with pinned development dependencies.

## Implemented local surfaces

- `packages/orchestrator/src/task-contract.mts`: data types, enumerations, runtime validation, state transition rules.
- `packages/orchestrator/src/task-registry.mts`: local JSON state, atomic rename writes, exclusive writer lock, dependency/workspace/review/evidence/approval gates, symlink-aware workspace-root checks and evidence provenance.
- `packages/orchestrator/src/validation-executor.mts`: fixed local validation allowlist, workspace-bound execution, timeout/output caps, real process exit status, and distinct requested/running/verified/failed/blocked results.
- `packages/orchestrator/src/cli.mts`: local create/list/transition/evidence/review commands; `validate <task-id>` runs only the fixed allowlisted checks for a RUNNING task and records completed validation results.
- `packages/orchestrator/src/process-runner.mts`: argument-array process invocation (`shell: false`), allowlisted inherited environment, credential-like extra-variable rejection, output bound, best-effort common-secret redaction, timeout/termination, exit and signal capture.
- `packages/orchestrator/src/opencode-adapter.mts`: local CLI version/auth/model readiness inspection and a remote-task function gated by owner authorization and caller-supplied sandbox readiness. The remote-task path has NOT run.

Test command: `npm test` from `packages/orchestrator`; last completed run reported 32/32 passing before the latest initial-state regression was added. `npm run typecheck` passed before that final test-only addition. A validation CLI smoke test ran both allowlisted commands and persisted their exit-0 records as `EXECUTED`. Re-run both gates before committing.

## Isolation and permissions

- No Git worktree or OS sandbox is created by this prototype. Workspace path checking is a defense-in-depth application check, not a security boundary; symlink resolution is checked on registry operations but race/TOCTOU remains possible.
- Current environment runs as root in LXC. Do not execute OpenCode tasks in this context until infrastructure/owner provides a validated host-enforced boundary and model-use authorization.
- Do not use permission-bypass flags by default. Production credentials, live provider access, deployment and financial operations are prohibited.
- The process helper inherits only PATH/HOME/TMPDIR/LANG/LC_ALL/TERM by default and explicitly rejects credential-like extra env variable names. A caller-supplied prompt and already-configured CLI environment still require careful handling.

## Next steps before agent automation

1. Decide and validate TypeScript type-check approach; current local Node test runner strips types but does not typecheck.
2. Provide an isolated non-root execution boundary and test filesystem/network limits, timeout, crash handling and review read-only access.
3. Confirm owner-authorized OpenCode provider, authentication, data policy and cost cap. Current CLI reports no authenticated integration and configured custom endpoint remains unverified.
4. Add real worktree manager and exclusive file ownership only after tests prove correct behavior.
5. Run one small OpenCode task only when prior gates pass; independently verify diff/tests/evidence with Hermes.

## Evidence and limitations

Registry JSON is prototype state and may use default umask-dependent mode for its containing directory; file content writes request mode `0600`. There is no task history journal/tamper-evidence, process crash recovery for a stale lock, automatic timeout retry controller, validation command executor, output redaction, distributed locking, or secure sandbox. Commands/evidence supplied via CLI are claims until the caller verifies them. Keep secrets out of task fields and evidence.

## Risks / unresolved

OpenCode reports no authenticated integrations; model endpoint trust and costs are unverified. Running as root increases impact. Typecheck not configured. CLI task execution is intentionally blocked/not run. No payment feature is implemented.
