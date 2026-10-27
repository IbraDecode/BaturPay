# Security Baseline

Status: initial control baseline; not a completed security assessment or production control implementation.

## Current environment findings

Initial audit ran as UID 0 (`root`), increasing the impact of mistakes or malicious content. `/root/.config/opencode/opencode.json` was mode `0644` and contained provider configuration including a key field; the value was deliberately not printed. This permission should be reviewed by the owner, but has not been changed. Hermes configuration was mode `0600`. OpenCode and Claude Code reported no authenticated integration in initial checks. No BaturPay app or production credentials are known/required at this stage.

## Baseline rules

- Do not include credentials, secrets, private keys, provider payloads or production data in prompts, repository files, test output or logs. Use environment/secret manager mechanisms only after their behavior is verified.
- `.env` and private key files are ignored. Keep a safe `.env.example` only with placeholder names and no usable values.
- Use synthetic data and a simulated provider by default; no live provider calls, real transactions or production deployments during foundation work.
- Scope agent execution to `/root/baturpay`, an isolated worktree and narrow permissions. Do not use permission-bypass modes as defaults. Avoid running agents as root if a safe, reviewed non-root execution arrangement is established; do not change host accounts or permissions without impact review and approval.
- Review every MCP/plugin/skill/hook source, command, permission, network access, dependencies, maintenance, license, and removal path before enabling it.
- Inspect package lifecycle scripts, lockfiles and advisories before installing dependencies. Pin and record versions; do not weaken a security gate to pass CI.
- Keep authentication and tenant/environment authorization explicit and tested. Never rely on untrusted client claims or webhook payloads without verification.
- Sanitize logs and errors; restrict access to task evidence; never store secret-bearing raw request bodies by default.
- Require review and human approval for system/global permission changes, production credentials, external paid services, destructive operations, deployment and financial operations.

## Initial risk register

| Risk | Evidence / uncertainty | Initial mitigation |
|---|---|---|
| Elevated process privilege | Current shell UID is root. | Keep work scoped; no broad commands. Plan a least-privilege execution model; human approval before system changes. |
| OpenCode config read permissions | Config mode 0644 and key field exists; whether value is sensitive/usable is not established here. | Do not print value. Owner review mode/content locally; consider correction only after assessment. |
| Agent auth unavailable | OpenCode auth list empty; Claude auth status not logged in. | Do not claim live agent integration or trigger paid/authenticated requests. Human handles any future login. |
| Hermes dependency advisory warnings | `hermes doctor` reported upstream npm package findings; full advisory details were not captured in project audit. | Treat as environment concern; do not make a local upstream dependency edit. Recheck with current upstream-supported process. |
| Broad optional tool surface | Hermes doctor reported several optional tools lack dependencies/configuration. | Do not enable/install unrelated tools for BaturPay foundation. |
| No project isolation/CI yet | New empty repository at start. | Establish scoped workflow and checks before application code; no production readiness claim. |

## Verification required before higher-risk phases

Perform threat modeling; verify secret redaction; test authentication, authorization, tenant/environment isolation, webhook signatures/replay protections, idempotency/concurrency, dependency advisories, audit event controls, backup/restore, worker retry and incident recovery. Record tool/version/environment and exact evidence. Production use requires a separate security review and owner approval.
