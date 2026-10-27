# BaturPay Orchestrator Prototype

Status: local-only prototype. It validates task contracts, stores task state in a local JSON file, records evidence/review decisions, and provides bounded subprocess primitives. It is not a secure distributed queue, sandbox, or live OpenCode dispatcher.

## Requirements

- Node.js >=22.6.0 (uses built-in TypeScript type stripping and the built-in test runner).
- No npm dependencies are declared or required for the test suite.

## Tests

From this directory:

```sh
npm test
```

## Local task registry CLI

Use an absolute registry path and an approved absolute workspace root. Create tasks from a JSON file matching `TaskContract`; use `npm run tasks -- ...` for commands:

```sh
npm run tasks -- --registry /absolute/path/tasks.json --workspace-root /absolute/workspaces create /absolute/path/task.json
npm run tasks -- --registry /absolute/path/tasks.json --workspace-root /absolute/workspaces list
```

Commands also exist for `transition`, `evidence`, and `review`; invoke with no args to display usage. Store registry state outside Git or ignore it; never put secrets in task/evidence JSON. The registry's checks are workflow/application controls and do not isolate the process from the host. Evidence is caller-supplied, not cryptographically attested. Review records represent Hermes checks, not independent third-party review.

## OpenCode adapter

`inspectOpenCode()` executes only local metadata commands (`--version`, `auth list`, `models`) and returns a summary without credential values. `runOpenCodeTask()` is an API surface only; it requires explicit owner authorization and a caller assertion that the sandbox was validated, then checks readiness and invokes the locally supported `opencode run --format json` interface with bounded execution. It has not been used to send a model request. The boolean sandbox field is not proof of isolation; do not set it true in the current root/LXC environment. The configured custom provider endpoint must be verified by the owner, and cost authorization is required before any remote model use.

## Limitations

- No validation command executor, Git worktree manager, automatic diff checker, CI integration, distributed locking, durable audit history, stale-lock recovery, retry scheduler, or OS sandbox.
- Local JSON state can be lost or corrupted; this is prototype state only.
- Workspaces are checked using resolved paths, but this check is not race-free and is not a security boundary.
- Type stripping runs tests but does not typecheck TypeScript; no `tsc` or Node type declarations are configured.
- Output redaction covers common key/token formats only and cannot guarantee that all secret forms are removed.
