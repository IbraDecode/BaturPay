# Least-Privilege Plan for AI Engineering

Status: PROPOSED / NOT APPLIED. Evidence gathered 2026-10-27. The current process and all three agent binaries run as UID 0; Git worktrees do not change this privilege boundary.

## Current inventory (read-only)

- Linux x86_64 kernel `7.0.14-23-pve`; virtualization detection reports `lxc`. This does not establish that the container is disposable or that its host is controlled by the project owner.
- UID/EUID 0 (`root`), GID 0; no supplemental groups. `sudo` is installed. No sudo command was run.
- `/root` is a real directory, mode `0700`, UID/GID 0, with existing `.hermes`, `.config`, `.claude`, `.local`, `.opencode`, GitHub CLI state, shell history and setup scripts. No content/credential values from these stores were included in this plan.
- `/root/baturpay` is a real non-symlink directory, mode `0755`, UID/GID 0; contains Git repository and project documentation.
- Hermes home `/root/.hermes` is a real directory, mode `0700`, UID/GID 0; contains live state and credential-related files. Do not move/chown it casually.
- `/root/.config/opencode` is a real directory, mode `0755`; `/root/.claude` is mode `0755`; `/root/.local/share/opencode` is mode `0755`. File-specific OpenCode config findings are in `OPENCODE_CONFIG_AUDIT.md`.
- Tools found: `systemd-run`, `unshare`, `setpriv`, `runuser`, `aa-status`, `apparmor_parser`; no Docker, Podman, bubblewrap, firejail, nsjail or SELinux utilities found. `unshare --user --map-root-user true` succeeded, confirming user namespaces are available to this process. This is not evidence of filesystem/network isolation.
- `systemd-detect-virt` reports LXC. No service/resource/network policy was changed.

## Consequences of root agent execution

Any coding agent command executed as the current user can potentially modify/delete any file accessible to root, alter system/security settings, read root-owned credentials, run network processes, and use the GitHub credential helper. Prompt instructions and a task worktree are not security controls. Path scope, Git branch ownership, and read-only reviewer conventions help prevent accidental overlap but do not prevent malicious or compromised subprocesses. Credentials in `/root` are outside the BaturPay repo but accessible to root-run agents unless separately isolated.

## Target design recommendation

Because this LXC contains an already configured Hermes installation, model/auth state, GitHub auth and application data, do not rebuild the existing root-based setup in place. Preferred target is a **separate disposable development guest/container or host-managed non-root account**, with a dedicated workspace and credentials intentionally provisioned for that identity. Keep production and payment credentials absent. Since no container runtime is installed and this is an LXC guest, first ask the infrastructure owner what isolation is supported by the outer host; do not install Docker/Podman or assume nested container isolation.

If retaining current user identity for this phase, do not run autonomous code-writing agents until a real host-enforced boundary is approved. A repo worktree is not sufficient. Owner may decide whether to continue with manual/read-only work only.

## Phased implementation plan (proposal only)

### Phase 0 — preserve current state

- Do not alter user accounts, permissions, `/root` tree, global agent settings, services or runtime installation.
- Before any authorized change, capture a protected backup/snapshot appropriate to the LXC host, record exact scope, and define restore owner/procedure. No backup was created here.
- Approval required: infrastructure owner identifies whether LXC snapshot/restore is available and authorized.

### Phase 1 — choose isolation boundary

Option A (preferred): owner provisions a disposable, separately isolated development VM/guest or managed sandbox with a non-root user and no production secrets. Option B: infrastructure owner creates a dedicated non-root account in this LXC, but only if host policy, LXC user namespace mapping, writable volume ownership and existing services permit it. Do not make `root` home/state broadly readable to facilitate this.

Proposed discovery commands only (not run here): `getent passwd baturpay-agent`, `findmnt -T /root/baturpay`, `systemd-detect-virt`, host-admin confirmation of LXC idmap/cgroups/AppArmor, and `sudo -l` under an approved admin session. Do not create user or grant sudo. Never add passwordless sudo; if a task needs privilege, pause for command-specific human authorization.

Impact/downtime: separate guest has setup/storage cost; in-place account changes may affect existing files, SSH/Git credential helpers and agent homes. No downtime is acceptable without an owner-approved maintenance plan.

### Phase 2 — provision scoped workspace

- Create a dedicated path (preferably outside root home, e.g. `/work/baturpay`) owned only by the approved non-root identity; do not recursively chown `/root`, `/root/.hermes`, `/root/.config`, `/root/.claude`, or `/root`.
- Copy/clone only reviewed project source, excluding `.git-credentials`, `gh` auth, Hermes auth, OpenCode auth and Claude auth. Require clean clone/commit verification. If shared workspace is needed, use a dedicated group/ACL with explicit mode and audit; not world-writable.
- Use one Git worktree/branch per active implementation task and exclusive path ownership. This prevents conflicting edits but is only workflow isolation.
- Rollback: stop agents; preserve branch/diff; remove only newly created workspace after owner confirms; restore from snapshot if needed. No recursive cleanup.

Approval required before creating user/path or changing ownership/ACL.

### Phase 3 — execution confinement

Evaluate kernel/host-supported controls with infrastructure owner. Candidate controls: dedicated unprivileged UID plus user/mount/PID/network namespaces, seccomp, AppArmor profile, cgroup CPU/memory/pids limits, read-only system mounts, only workspace/temp writable, no host sockets, no credentials mount, network denied by default. Validate LXC idmap and outer-host policy before relying on namespaces. `unshare` user namespace success alone does not prove other namespaces or syscalls are confined.

Possible systemd controls (proposal only): `systemd-run --user --wait --pipe --property=NoNewPrivileges=yes --property=ProtectSystem=strict --property=ProtectHome=read-only --property=PrivateTmp=yes --property=PrivateDevices=yes --property=RestrictSUIDSGID=yes ...`; exact directives, user session, cgroup delegation and filesystem exceptions must be verified before use. Do not run as root and do not assume systemd unit restrictions replace a sandbox. No sandbox command was tested.

Container alternative, only if approved/provisioned by host owner: run non-root in container, drop capabilities, no privileged mode, no host Docker socket, readonly rootfs, explicitly mounted task workspace/temp only, resource limits, network disabled/allowlisted, and no secret mounts. A container does not protect credentials mounted into it or escape risk from unreviewed runtime configuration.

Approval required before installing runtime, changing service/security policy, enabling AppArmor profiles or network restrictions.

### Phase 4 — credential and network policy

- Keep GitHub write credential outside agent process; perform push as a separate human-controlled gate after inspecting exact diff. Current `gh` session is available to root; do not expose it to coding agent child processes.
- Never mount Hermes/Claude/OpenCode auth stores into disposable workers unless the owner intentionally authorizes model use; provision only the chosen model authentication through official UX, with cost cap.
- Deny network for pure code tasks; if dependency retrieval is needed, allow only approved registry endpoints and review lockfiles/scripts. No live payment endpoint access.
- Ensure logs/output are sanitized and do not persist credentials.

### Phase 5 — validation and rollback

Before first autonomous code task, use harmless sentinel files to test that worker cannot read outside assigned workspace, reviewer cannot edit, denied commands fail, network matches policy, limits/timeout work, and crash preserves the branch/evidence. Capture versions, command, exit codes and filesystem/network test results. If any boundary fails, stop agent, retain worktree/evidence, remove only task-created resources after review, and revert the isolated environment to its snapshot. Never “fix” a sandbox test by broadening permissions without approval.

## Required approvals

1. Infrastructure owner: whether this LXC is disposable, snapshot/restore support, nested isolation support and resource constraints.
2. Owner: choose separate guest vs dedicated non-root user; approve any user/path/ownership/ACL changes.
3. Owner: approve any sandbox/runtime install, AppArmor/systemd/network policy changes.
4. Owner: approve model account and cost cap, and whether/where its credential may be exposed to the isolated worker.

Current status: no changes applied; root execution risk remains. Ready for manual planning only, not autonomous code execution.
