# Tooling Research: Hermes, OpenCode, Claude Code

Research date: 2026-10-27 (environment conversation date). Local version/help/auth checks are from this session. Official documentation pages are living documents; retain a review date and recheck against installed versions before automation.

## Local installation and execution evidence

| Tool | Installed version | Local evidence | Auth/config readiness | Runtime task test |
|---|---|---|---|---|
| Hermes Agent | `0.22.5 (2026.9.24) stable local bf0203a794a0` | `hermes --version`; `hermes --help`; `hermes doctor` | Hermes config exists, mode 0600; doctor notes configured API key/custom endpoint (values withheld). Doctor exit 1 with warnings and some optional dependencies missing. | Not tested as coding executor for BaturPay. Built-in Hermes delegation is documented and available in this session, but external CLI delegation untested. |
| OpenCode | `2.2.0` | `opencode --version`; `opencode --help` | `opencode auth list` returned `No authenticated integrations`. A provider config exists; no credential value is documented here. | Not run; no authenticated integration was reported. |
| Claude Code | `2.1.311` | `claude --version`; `claude --help`; `claude auth status` | Auth status: `loggedIn: false`, method `none`. | Not run; no authenticated integration. |

Do not include secrets from local configuration in this report. The project config security concern is separately recorded in `docs/security/SECURITY_BASELINE.md`.

## Capability matrix

| Capability | Hermes | OpenCode | Claude Code | Status / qualification |
|---|---|---|---|---|
| CLI | `hermes --help` exposes chat, worktree and other commands. | `opencode --help` exposes `run`, session, serve, MCP and other commands. | Help exposes `-p/--print`, agents and permission-related flags. | Installed locally; exact bounded task not tested. |
| Skills / project instructions | Hermes skills and project context documented in official docs and local skill system. | Official docs describe agents and skill discovery; local project configuration not yet added. | Official docs recognize `CLAUDE.md`, skills, subagents. | Capability documented; no BaturPay tool-specific config created. |
| Agent/subagent | Official Hermes docs: `delegate_task` spawns isolated-context child agents; optional worktree isolation is configurable. | Official docs: custom agents with mode and permission configuration. | Official docs: custom subagents and CLI-defined agents. | Do not conflate same-platform child agents with cross-platform orchestration. |
| Permissions | Hermes has config/tool/terminal controls; exact BaturPay sandbox not tested. | Official permission rules `allow/ask/deny`, per agent; `--auto` can approve non-denied actions and should not be default. | Official CLI/settings expose tool and permission controls; avoid bypass mode. | Configure narrowly and test before production use. |
| Noninteractive CLI | `hermes chat -q` documented in Hermes skill/CLI help. | Official CLI has `opencode run`; local help lists run. | Official CLI supports `claude -p`. | Available paths; live AI runs blocked/unverified by auth status. |
| MCP | Hermes documents MCP management; doctor said no suspicious stdio commands. | Official CLI/docs include MCP management. | Official CLI docs include MCP configuration. | No project-scoped MCP configured or required; do not install yet. |
| Hooks | Hermes has hooks/automation, but not tested for this repo. | Plugins/configuration and permission systems documented; hook capability details need version-specific review before use. | Official docs have hooks reference. | No project hooks created or enabled. |
| Git isolation | Hermes supports worktree mode in CLI help/skill. | Worktree workflow can be implemented via Git; built-in support requires verification. | CLI docs/installed help support `--worktree` (verify help before invocation). | Git 2.34.1 installed; project repo now local. No agent worktree test yet. |
| Session management | Hermes session store and resume options documented/help. | CLI supports continue/session flags. | CLI supports resume/continue and session features. | No cross-agent session protocol established. |
| Model/auth | Current Hermes session operates through configured custom provider; provider details not copied. | Configured provider entry exists but `auth list` empty; do not assume functional. | Not logged in. | Do not initiate paid/auth-changing operations; human controls account authorization. |
| Network / API | Hermes tools depend on configured providers/tools. | OpenCode provider config contains endpoint/key field; safe to inspect owner-side, do not print. | Claude authentication absent. | External connectivity and terms/cost not tested. |

## Official sources checked

1. Hermes documentation — Delegation: https://hermes-agent.nousresearch.com/docs/user-guide/features/delegation — describes `delegate_task`, isolated child context, worktree isolation configuration and delegation limitations. Version-specific runtime behavior remains to be tested.
2. Hermes documentation — CLI commands: https://hermes-agent.nousresearch.com/docs/reference/cli-commands — `hermes mcp` and command reference.
3. OpenCode CLI: https://opencode.ai/docs/cli — documents CLI commands, `run`, custom agents, MCP and server options. Local `opencode --help` confirmed installed command surface generally, but flags may differ; confirm exact flags with installed help.
4. OpenCode agents: https://opencode.ai/docs/agents — documents agent modes and permission controls.
5. OpenCode permissions: https://opencode.ai/docs/permissions — documents `allow`, `ask`, `deny`, per-agent rules, and auto mode. Auto mode is intentionally not selected as default.
6. Claude Code CLI reference: https://code.claude.com/docs/en/cli-reference — documents print mode, agents and CLI options.
7. Claude Code hooks: https://code.claude.com/docs/en/hooks — hooks reference.
8. Claude Code subagents: https://code.claude.com/docs/en/sub-agents — custom subagent documentation.
9. Claude Code permissions: https://code.claude.com/docs/en/permissions — permission configuration.

The official pages are living web documents, not version-pinned copies. Confirm current behavior against local `--help` and a sandbox test before relying on a flag. Search/extract for this matrix completed; a complete crawl of every feature area requested in the master directive has not yet been performed.

## Integration conclusion

No evidence currently establishes a native shared Hermes/OpenCode/Claude task protocol. The simplest candidate is Hermes coordinating bounded local CLI subprocesses, a versioned repository task/result contract, Git worktrees, and evidence validation. This is an adapter architecture, not a built-in direct integration. OpenCode and Claude cannot yet participate in a real run until the owner authorizes/configures their authentication. No agent CLI was invoked to alter the repository.

## Risks and unknowns

- Authentication and actual model execution not validated for OpenCode/Claude.
- Provider/model connectivity, cost, rate limits and cost caps not tested.
- Exact tool permission behavior and sandbox confinement untested.
- Current OpenCode config has mode 0644 and provider credential field; do not assume it is harmless. See security baseline; no permission changed.
- Hermes doctor exit code 1 included warnings: legacy provider configuration, upstream npm advisories and missing optional tool dependencies. No upgrade or repair performed.
- No cross-agent review, task registry, worktree execution, hooks or MCP integration tested.

## Research status

Partial and evidence-based, not exhaustive. The next research pass should inspect each installed CLI's focused help for `run`, `agent`, `mcp`, `auth`, and worktree/session behavior; verify exact version-specific Claude/OpenCode controls; and test the least-privilege path in a disposable, no-network task once authentication is approved. Do not claim complete platform audit or production readiness.
