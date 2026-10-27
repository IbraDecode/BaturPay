# Authentication and Cost Controls

Status: research and procedure notes; no login flow started and no provider credentials changed. User must authorize any paid account use.

## Current local status (rechecked 2026-10-27)

- OpenCode `2.2.0`: `opencode auth list` reports `No authenticated integrations`. Global config selects model `ibra-studio/cx/gpt-6-luna[1m]` under provider alias `ibra-studio` / display name `IBRA STUDIO AI`. The config has a custom `baseURL` and a non-empty literal `apiKey` field; the value is withheld and was not tested. Endpoint operator, TLS/data handling, account ownership, model availability and pricing remain unverified. Do not send project source or credentials to this endpoint until the owner verifies and authorizes it. See `../security/OPENCODE_CONFIG_AUDIT.md`.
- OpenCode model catalog lists the configured model and several public/free-labelled models. Catalog presence is not evidence that a model can be used, is free, or is authorized; no model request was made.
- Claude Code is excluded from the initial BaturPay architecture and is not a readiness dependency.
- Hermes Agent `0.22.5` uses its own configured provider/session. This does not establish that OpenCode can use Hermes credentials, account entitlement or endpoint. Never copy Hermes credentials/config into OpenCode.
- GitHub CLI is authenticated as `IbraDecode`; keep its credential outside coding-agent subprocesses.
- No owner authorization for external-model cost, endpoint trust or sending project source was identified in this phase.

## Official documented sign-in paths

### OpenCode

Official references: https://opencode.ai/docs/cli and https://opencode.ai/docs/providers/ . The CLI documents `opencode auth login` as provider credential setup; provider choices and auth can vary, including OAuth or API key depending on provider. Credentials are managed by OpenCode; current documentation mentions a user auth store. Use the interactive CLI on the owner-controlled terminal and select only an authorized provider/model. Do not paste keys in chat, task prompts, command-line arguments, or project config. Verify afterward with `opencode auth list` and a small bounded task only if the owner approves cost and endpoint.

The present custom provider URL and credential-field configuration is not independently validated. Before use, owner should verify endpoint operator, TLS, data retention, terms, model availability, pricing and credential provenance. Avoid sending proprietary or sensitive project content until trusted.

### Claude Code

Official references: https://code.claude.com/docs/en/authentication and https://code.claude.com/docs/en/costs . Claude Code supports authentication through Anthropic/Claude account flows, including Console/API-key pathways depending on organization policy and account. Some subscription plans may authorize Claude Code usage, but access, quotas and extra usage depend on plan/admin policy; API-key use is usage billed. A Claude subscription does not automatically authorize a separate third-party tool or Hermes/OpenCode integration.

Owner may run the official interactive login flow locally (e.g. `claude` and follow its `/login` workflow; confirm exact command against installed `claude --help` and official docs). Never transmit a token to Hermes. Verify with `claude auth status`. For this installed v2.1.311, local help confirmed `--max-budget-usd`, `--allowedTools` and permission-mode options, but the captured help did NOT show `--max-turns`; do not rely on that flag until exact support is verified. Prefer a narrow tool allowlist, explicit timeout at the process supervisor, and supported spend limits; do not enable permission bypass.

### Hermes

Official configuration docs: https://hermes-agent.nousresearch.com/docs/user-guide/configuration . Hermes separates settings from secrets and supports provider/API-key and OAuth paths depending on provider. Existing Hermes auth must remain isolated; do not copy credentials into OpenCode/Claude. Confirm provider terms, billing and model routing from the account owner before additional calls.

## Cost and exposure safeguards

- Ask the owner to select authorized accounts/models and state a maximum cost before any remote coding-agent task.
- Do not assume subscription coverage applies to a different CLI, provider endpoint or API; check official account terms.
- Use short, bounded, nonfinancial test tasks; cap turns and budget where supported.
- Verify custom endpoints independently and use least-sensitive source context first.
- Never place credentials in Git, prompts, args, logs, screenshots, or task evidence. Use only official local auth UX/credential store.
- Stop if authentication prompts for unexpected permissions, billing, an account switch, or a new service.

## Demonstration readiness

OpenCode and Claude Code are currently unauthenticated, so real dual-agent demonstration is BLOCKED. No authentication was attempted. Proceed only after the owner authorizes accounts/costs and approves an isolation plan.
