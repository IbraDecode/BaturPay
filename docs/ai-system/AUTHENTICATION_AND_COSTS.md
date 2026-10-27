# Authentication and Cost Controls

Status: research and procedure notes; no login flow started and no provider credentials changed. User must authorize any paid account use.

## Current local status

- OpenCode `2.2.0`: `opencode auth list` reported no authenticated integrations. A configured OpenAI-compatible provider exists in the global config, but it is not reported as an authenticated integration. Do not assume it works or is trusted; see the OpenCode config audit.
- Claude Code `2.1.311`: `claude auth status` reported `loggedIn: false`, `authMethod: none`.
- Hermes Agent `0.22.5`: active Hermes session has a configured custom provider, but this is not proof that OpenCode or Claude can use the same account, subscription, or endpoint. Do not share Hermes tokens or config with either tool.
- GitHub CLI is authenticated as `IbraDecode`; do not expose its credential or let untrusted agent code use it.

## Official documented sign-in paths

### OpenCode

Official references: https://opencode.ai/docs/cli and https://opencode.ai/docs/providers/ . The CLI documents `opencode auth login` as provider credential setup; provider choices and auth can vary, including OAuth or API key depending on provider. Credentials are managed by OpenCode; current documentation mentions a user auth store. Use the interactive CLI on the owner-controlled terminal and select only an authorized provider/model. Do not paste keys in chat, task prompts, command-line arguments, or project config. Verify afterward with `opencode auth list` and a small bounded task only if the owner approves cost and endpoint.

The present custom provider URL and credential-field configuration is not independently validated. Before use, owner should verify endpoint operator, TLS, data retention, terms, model availability, pricing and credential provenance. Avoid sending proprietary or sensitive project content until trusted.

### Claude Code

Official references: https://code.claude.com/docs/en/authentication and https://code.claude.com/docs/en/costs . Claude Code supports authentication through Anthropic/Claude account flows, including Console/API-key pathways depending on organization policy and account. Some subscription plans may authorize Claude Code usage, but access, quotas and extra usage depend on plan/admin policy; API-key use is usage billed. A Claude subscription does not automatically authorize a separate third-party tool or Hermes/OpenCode integration.

Owner may run the official interactive login flow locally (e.g. `claude` and follow its `/login` workflow; current exact command should be checked with installed `claude --help` and official docs). Never transmit a token to Hermes. Verify with `claude auth status`. For future print-mode calls, specify bounded `--max-turns`, a narrow tool allowlist, and where relevant `--max-budget-usd`; do not enable permission bypass.

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
