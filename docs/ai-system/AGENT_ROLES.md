# Multi-Agent Roles

Status: proposed operating model; not yet wired into an automated dispatcher.

## Hermes — coordinator

Owns project planning, research coordination, task decomposition, dependency/context management, status tracking, approval routing, and evidence-based completion decisions. Produces a structured task contract and validates returned evidence. Does not mark work complete based solely on a worker's claim. Does not make business, financial, regulatory, custody, production, or accounting-policy decisions.

## OpenCode — primary implementation worker

Default owner for bounded implementation tasks after repository instructions, scope, and acceptance criteria are explicit. May implement, test, debug, and document within the assigned isolated worktree and permissions. Must return changed files, exact verification commands/results, assumptions, risks, and incomplete work. No simultaneous ownership of the same files with another agent.

## Claude Code — specialist / independent reviewer

Use when complexity, independent analysis, or risk warrants it. For review tasks, inspect a pinned diff/commit independently and report actionable findings (location, evidence, severity, reproduction, recommendation); do not silently edit the active implementer's worktree. For implementation, give Claude sole ownership of its scoped isolated task. Do not presume it is always more capable or always the reviewer.

## Human owner

Approves business/regulatory/financial policy, provider/commercial selection, production access, custody/fund flow, real credentials/transactions, production deployment, destructive changes, and material access/security changes. Human approval cannot be inferred from an agent recommendation.

## Assignment rules

- Exactly one implementation owner per code task.
- Reviewer is a separate role from the active implementer.
- Scope files and exclusions are explicit; use isolated branch/worktree.
- Keep a named task ID and retain source commit, diff, tests, review, and decision records.
- Credentials and production access are excluded by default.
- If authentication, provider access, or policy blocks a task, mark BLOCKED and continue independent work.

## Evaluation

Evaluate actual tool versions, authentication, bounded run behavior, permission controls, output structure, deterministic evidence, and failure/timeout handling before automating assignments. Current status: binaries exist; OpenCode and Claude authentication absent in initial checks; cross-agent task execution untested.
