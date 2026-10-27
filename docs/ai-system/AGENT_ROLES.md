# Multi-Agent Roles

Status: proposed operating model; not yet wired into an automated dispatcher.

## Hermes — coordinator

Owns project planning, research coordination, task decomposition, dependency/context management, status tracking, approval routing, and evidence-based completion decisions. Produces a structured task contract and validates returned evidence. Does not mark work complete based solely on a worker's claim. Does not make business, financial, regulatory, custody, production, or accounting-policy decisions.

## OpenCode — primary implementation worker

Default owner for bounded implementation tasks after repository instructions, scope, and acceptance criteria are explicit. May implement, test, debug, and document within the assigned isolated worktree and permissions. Must return changed files, exact verification commands/results, assumptions, risks, and incomplete work. No simultaneous ownership of the same files with another agent.

## Claude Code — excluded from initial architecture

Claude Code is not part of the initial BaturPay agent architecture and is not a dependency, reviewer, or readiness blocker. Hermes performs independent verification using acceptance criteria, automated tests, and diff inspection. A separate reviewer may be proposed later only if a concrete need and authorization justify it; do not claim Claude Code reviewed any change.

## OpenCode — primary implementation worker

Default owner for bounded implementation tasks after repository instructions, scope, and acceptance criteria are explicit. May implement, test, debug, and document within the assigned workspace and permissions. Must return changed files, exact verification commands/results, assumptions, risks, and incomplete work. No simultaneous ownership of the same files with another process.

## Human owner

Approves business/regulatory/financial policy, provider/commercial selection, production access, custody/fund flow, real credentials/transactions, production deployment, destructive changes, and material access/security changes. Human approval cannot be inferred from an agent recommendation.

## Assignment rules

- Hermes owns orchestration and verification; OpenCode is the only initial coding agent.
- Exactly one implementation owner per code task.
- Scope files and exclusions are explicit; use a separate worktree where available, but do not treat it as a security sandbox.
- Keep a named task ID and retain source commit, diff, tests, evidence, and decision records.
- Credentials and production access are excluded by default.
- If OpenCode execution is not authorized or safe, mark only the agent task BLOCKED and continue independent local work.

## Evaluation

Current evidence: OpenCode v2.2.0 installed, but `opencode auth list` reports no authenticated integrations; a configured custom model endpoint remains unverified and was not called. Hermes has implemented and locally tested the initial task contract/registry and bounded process adapter. No OpenCode task has run. Claude Code is deliberately unused.
