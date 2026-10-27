# Least-Privilege Plan for AI Engineering

Status: proposal; NOT APPLIED. The host currently runs this session as root. Do not treat a worktree as a security sandbox by itself.

## Goals

Limit agent file access to an assigned task workspace, restrict execution and network as required, keep credentials out of worker context, and preserve human review of privileged or financial operations.

## Staged plan

1. **Immediate, current session:** stay within `/root/baturpay`; do not invoke untrusted project scripts, install dependencies, or run payment integrations. Avoid global/system edits. Use allowlisted, read-only inspection where feasible. Never use permission-bypass flags by default.
2. **Owner-reviewed identity design:** determine whether a dedicated non-root account can own a workspace without compromising existing files/services. Inventory required access, home paths, package caches, GitHub credential needs, and backup/restore. No account or ownership changes until the owner approves an explicit change plan.
3. **Disposable task workspace:** create isolated Git worktree/branch for each code owner, with file/path ownership and clean-base checks. Set a hard timeout and attempt cap. Remove only task-created worktree after confirming evidence and preserving changes; never delete user data.
4. **Execution sandbox:** compare available OS sandbox/container mechanisms. If adopting containers, use non-root in-container UID, drop capabilities, read-only root filesystem where possible, explicit writable worktree/temp mounts, no host socket, no secrets mount, resource caps and default-deny network. A container alone does not prove containment.
5. **Permissions:** configure per-agent least privilege (read-only reviewer, narrow edit scope, explicit shell approvals). Deny external-directory access and destructive Git operations by default. Test that denied actions are denied before using autonomous coding tasks.
6. **Network:** disable by default for code implementation tasks; allow only documented package/provider endpoints when specifically required and approved. Never point an agent at a live payment provider for initial tests.
7. **Credential separation:** do not pass `gh` or model tokens into untrusted child process environments. Use credential helpers only for explicit, trusted Git operations. Redact logs and task evidence.
8. **Observability/recovery:** record tool version, task ID, working directory, command, start/end, exit code and sanitized output. Preserve task branch/diff on failure; stop at ambiguous external side effects. Maintain an owner-reviewed backup/restore procedure.
9. **Review gates:** human approval required for global/system security changes, provider credentials, paid services, production, data deletion/migration, financial operations and business/regulatory policy.

## Acceptance checks before real coding agent use

- Worker cannot read files outside assigned workspace (verify with harmless sentinel files).
- Reviewer cannot write to the implementation worktree.
- Destructive/system commands are blocked or require explicit approval.
- Network behavior matches policy; no production/secret endpoints reachable.
- Timeout, forced stop, crash and cleanup preserve uncommitted work/evidence.
- Credential values do not appear in process args, logs, prompts, artifacts or Git.
- Owner approves identity and isolation design.

No security boundary has been implemented or tested yet; root risk remains open.
