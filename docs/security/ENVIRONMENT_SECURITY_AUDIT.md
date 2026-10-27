# Environment Security Audit

Status: IN_PROGRESS; local baseline only. No host hardening or global configuration changes were made.

## Observed environment

- Linux x86_64; audit process is UID 0 (`root`). Running coding agents as root gives them broad filesystem and system authority and raises the impact of malicious instructions, compromised dependencies, or mistakes.
- `/root/.hermes/config.yaml` exists with mode `0600`; Hermes home includes credential-related stores. Secret values were not read into this report.
- `/root/.config/opencode/opencode.json` exists with mode `0644` and contains an API-key field; see `OPENCODE_CONFIG_AUDIT.md`. Value not printed.
- `/root/.claude/settings.json` mode `0644` and contains theme-only settings as observed. Claude auth status says not logged in.
- `gh auth status` indicates logged-in user `IbraDecode`; token value was redacted. GitHub CLI is a credential-bearing tool; do not run arbitrary untrusted code that can access its credential store.
- OpenCode auth list reports no authenticated integrations.
- Tools found: Git 2.34.1, Node.js 22.23.4, npm 10.9.9, Python 3.14.9. Docker/Podman, pnpm/yarn/uv were not detected in the initial audit.
- BaturPay repository contains documentation only; no application dependencies, CI, credentials, or production data.

## Risks and controls

1. **Root execution:** do not run untrusted agent code or third-party scripts in the current unrestricted context. Keep tasks scoped to repo and use narrowly permitted commands. Plan non-root isolation separately.
2. **Credential exposure:** no credential values in reports or Git. Keep tokens out of prompts, output, task artifacts and project config. The OpenCode config needs owner review.
3. **Network and endpoint trust:** do not send proprietary code/secret data to a custom endpoint before verifying provider ownership, TLS, retention and billing.
4. **Third-party skills/MCP/hooks:** none installed for the project. Review full source, commands, permissions, dependencies, network access and removal steps before enabling.
5. **Dependency execution:** no application package installation has occurred. Review lockfile, lifecycle scripts, licenses and advisories before installing.
6. **GitHub credential:** use official `gh` CLI; never print token values or expose them to project code. Remote operations are limited to the named repository.
7. **Secrets scanning:** filename/pattern scan of project files found no likely secret or private key. This is heuristic and not a complete secret-history scan.

## Not performed

No chmod/chown, user creation, container runtime installation, firewall/network changes, global agent configuration changes, credential rotation, production access or live payment tests. A security review and least-privilege design are required before broad agent execution.
