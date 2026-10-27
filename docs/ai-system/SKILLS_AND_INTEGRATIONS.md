# Skills and Integrations Inventory

Status: updated 2026-10-27. Inventory of local Hermes skills and official integrations; no third-party skill, MCP server, plugin, hook, or dependency installed for BaturPay. Hermes docs warn skill instructions/scripts execute with host capabilities; review before invocation.

## Existing relevant local Hermes skills

| Skill | Local source | Purpose | Decision / test |
|---|---|---|---|
| `hermes-agent` | `/root/.hermes/skills/autonomous-ai-agents/hermes-agent/SKILL.md` | Hermes setup/orchestration; docs reference workflow. | Used for Hermes context. Local file is preinstalled. No code/install performed. |
| `opencode` | `/root/.hermes/skills/autonomous-ai-agents/opencode/SKILL.md` | OpenCode CLI delegation instructions. | Reviewed, but some examples are guide text and require checking against actual CLI/version. No agent run due auth status. |
| `claude-code` | `/root/.hermes/skills/autonomous-ai-agents/claude-code/SKILL.md` | Claude Code CLI delegation. | Reviewed; invoke only after verifying local flags and authentication. No agent run due unauthenticated status. |
| `systematic-debugging` | Hermes software-development catalog | Structured debugging workflow. | Available by catalog; not installed/modified for project and not needed for documentation initialization. |
| `test-driven-development` | Hermes software-development catalog | TDD workflow. | Available by catalog; not installed/modified for project. Evaluate when code exists. |
| `requesting-code-review` | Hermes software-development catalog | Pre-commit review workflow. | Available by catalog; not installed/modified for project. |
| `sdlc-review` | Hermes devops catalog | Handoff/review routing. | Available by catalog; not installed/modified for project. |

This table records named local skill catalog entries and does not certify their upstream provenance, safety, or compatibility with BaturPay. Review individual skill source and any scripts before invoking third-party operations. No skills from external registries were fetched or installed.

## Integration inventory

| Integration | Current status | Action |
|---|---|---|
| OpenCode CLI | Installed v2.2.0; no authenticated integrations per `opencode auth list`; `opencode debug paths` confirms config directory. | Candidate bounded subprocess adapter; no run. Official CLI supports `run`, agent, auth and MCP commands. |
| Claude Code CLI | Installed v2.1.311; `claude auth status` says not logged in. | Candidate reviewer/engineering adapter; no run. Official CLI docs cover print mode, agents, permissions and MCP. |
| Hermes delegation | Built-in Hermes delegation documented; this session has the tool, but its use here was not an external coding task. | Can coordinate Hermes subagents, but does not by itself prove external CLI collaboration or sandboxing. |
| MCP servers | No project MCP configured. Hermes doctor found no suspicious MCP stdio commands globally. | None added; not required for first prototype. |
| Project hooks/plugins | None created. | Defer until concrete use case and version-specific security review. |
| Task registry/dispatcher | None implemented. | Design document only; first prove a bounded CLI task and worktree isolation. |

## Candidate skill domains to evaluate later

When implementation begins, evaluate focused, maintained skills for TypeScript/API, PostgreSQL/migrations, payment state machines, idempotency, webhook security, testing/concurrency, threat modeling, code review, CI, observability and recovery. Prefer first-party/local skills or author minimal project-specific instructions. Do not install a generic payment/financial skill without reviewing source and claims. Financial invariants must come from approved BaturPay contracts, not a skill.

## Required evaluation record before adding a skill/integration

Record source URL/revision, maintainer and maintenance signals, contents/scripts reviewed, permissions and network/file scope, dependency/license/advisory results, capability overlap with built-in tools, expected BaturPay benefit, isolated test results, and uninstall/rollback procedure. Human review is required for global/system installation, broad credentials, paid services or wide permissions.
