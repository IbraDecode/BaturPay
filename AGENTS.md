# Agent Instructions for BaturPay

## Authority and scope

Treat `docs/ai-system/PROJECT_CONTEXT.md` as the canonical product context. This repository is a new project; do not invent existing code, decisions, integrations, or production capability. Use the records in `docs/ai-system/OPEN_DECISIONS.md` for unresolved matters. If these documents conflict, stop and report the conflict rather than silently choosing.

## Work protocol

Every task must have a unique ID, one implementation owner, objective, scoped files, explicit exclusions, dependencies, acceptance criteria, verification commands, timeout/retry limits, and evidence output. Do not let concurrent agents edit the same files. Use isolated branches/worktrees for code changes where available. Reviewers inspect independently and do not modify an active implementer's files unless ownership is explicitly transferred.

Do not call work complete merely because an agent says it is done. Run the applicable checks, inspect the diff, record command outputs and environment/commit context, and report failures or untested criteria. Never weaken a financial invariant or delete a failing test to obtain a green result.

## Safety

- Never reveal, commit, log, or copy credentials, API keys, tokens, private keys, production data, or sensitive provider payloads.
- Use simulated providers and synthetic data by default. Do not contact payment providers or execute financial operations without explicit authorization.
- No production deployment, production credentials, destructive migration/data operation, material permission/authentication change, paid service activation, custody/fund-flow decision, or regulatory/business decision without human approval.
- Treat `UNKNOWN` payment outcomes as unresolved, not failed. Do not retry ambiguous financial operations without a domain-approved recovery protocol.
- Avoid root-level or global configuration changes. Work only within the repository unless explicitly authorized.
- Do not add dependencies until need, maintenance, license, compatibility, advisories, and installation effects have been assessed.
- Do not add MCP servers, plugins, hooks, or third-party skills without evaluating source, scope, permissions, dependencies, and removal path.

## Engineering principles

Prefer a modular monolith and explicit contracts. Keep provider-specific behavior behind adapters. Route all payment state changes through a single validated domain transition authority using evidence. Design idempotency and financial invariants into persistence and concurrency control; Redis alone is not the correctness boundary. Posted ledger records, if later approved and implemented, are immutable and corrected by compensating entries.

## Required handoff

Report task ID, summary, changed files, decisions, assumptions, exact commands and results, evidence locations, risks, incomplete work, and human approval needs. Distinguish verified behavior from design intent. Never claim production readiness without a separately approved and evidenced readiness review.
