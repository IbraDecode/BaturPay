# Multi-Agent Orchestration Design

Status: proposed design; no dispatcher or automated workflow has been implemented or E2E-tested. Current agent execution remains blocked pending least-privilege isolation and model authorization.

## Candidate initial architecture

Use Hermes as coordinator and a repository-backed task/evidence contract. Invoke OpenCode or Claude Code as bounded CLI subprocesses from an explicit project worktree. Keep a single implementation owner per task. Run verification as a separate, recorded process. Use Claude as an independent reviewer when available and justified. Hermes determines the final status from machine-checkable task metadata plus Git/test/review evidence.

```text
Owner approval (when required)
          |
Hermes: task contract + routing + dependency/status tracking
          |
   isolated worktree (one owner)
          |
 OpenCode OR Claude CLI (bounded, scoped permissions)
          |
 automated checks -> pinned diff review -> evidence record
          |
 Hermes: PASS / FAIL / BLOCKED / approval required
```

This is a file/Git/CLI adapter design, not a claim of native Hermes↔OpenCode↔Claude protocol integration. Official product docs and actual runtime tests must confirm every flag and permission behavior before implementation.

## Task contract (proposed JSON)

Minimal required fields for a first dispatcher: `task_id`, `title`, `objective`, `owner`, `workspace`, `dependencies`, `acceptance_criteria`, `risk_level`, `status`, `validation_commands`, `evidence`, `review_status`, `approval_required`. Recommended additions before production-like use: `allowed_paths`, `forbidden_paths`, `base_commit`, `timeout_seconds`, `max_attempts`, `artifacts`, `approval_record`, `history`. Validate against a versioned JSON Schema before dispatch and before accepting a result. Never put credentials or sensitive production payloads in a task contract.

Proposed allowed statuses: `PROPOSED`, `READY`, `RUNNING`, `BLOCKED`, `REVIEW`, `DONE`, `FAILED`. Define guarded transitions: PROPOSED→READY after criteria/workspace/approval checks; READY→RUNNING on exclusive assignment; RUNNING→REVIEW only after bounded exit and verification; any active state may become BLOCKED/FAILED with reason/evidence; REVIEW→DONE only when independent review, tests, scope checks and required approvals are satisfied. Reopening DONE requires a new task/change record.

Result contract: task ID, summary, changed files, decisions, assumptions, exact commands/exit codes, test outputs/artifact references, risks, unfinished work, and human decisions required. Agent prose alone is not evidence.

## State model

Proposed statuses: `BACKLOG`, `READY`, `ASSIGNED`, `RUNNING`, `VERIFYING`, `REVIEW`, `APPROVAL_REQUIRED`, `DONE`, `BLOCKED`, `FAILED`, `CANCELLED`.

Enforce valid transitions (e.g. DONE only from VERIFYING/REVIEW or approval completion with all acceptance criteria evidenced). Record actor, timestamp, prior/new state, and reason. No automatic infinite retries: bounded attempts and deadlines; failures become BLOCKED/FAILED for review.

## Isolation and permissions

- Create a dedicated Git worktree/branch per code task; refuse dispatch if paths overlap an active task's declared ownership.
- Verify clean state and expected base commit before dispatch; capture diff and commit afterward.
- Run agents in project directory only. Avoid global configuration changes and elevated/root execution where a non-root isolated user can later be established safely.
- No bypass-all-permissions flags by default. Use narrow allowlists and human review for shell/network/install actions.
- Production credentials, live provider access, deployment and financial operations are prohibited in the initial demo.
- Preserve logs with secret redaction; log command, version, working tree, timestamps, exit code and evidence hashes, not secrets.

## Minimal phases before automation

1. Confirm CLI flags and noninteractive behavior from installed-version help and official docs.
2. Validate task/result schema and state transition logic with local fixtures.
3. Test worktree isolation and timeout handling using a no-network, non-financial task.
4. Test one real OpenCode task only after valid authentication/permissions are available.
5. Run review on the pinned diff via Claude only after authentication is available.
6. Independently rerun tests and inspect evidence; report any missing phase honestly.

## Evidence store

Keep task JSON, sanitized stdout/stderr, Git base/head/diff references, test reports, review findings, approval record, and timestamps under a task-specific directory ignored if it contains sensitive or local-only output. Repository may later hold sanitized durable records. Define retention and tamper-evidence needs before production usage.

## Risks / unresolved

OpenCode and Claude were unauthenticated in initial audit. This prevents live multi-agent demonstration. Running as root increases impact. CLI docs/flags and permissions must be verified against exact local versions. Git worktree support and provider/model costs must be tested. No dispatcher, queue, task registry implementation, evidence store, or timeout/retry controller currently exists.
