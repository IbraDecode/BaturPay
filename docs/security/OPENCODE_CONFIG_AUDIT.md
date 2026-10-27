# OpenCode Configuration Security Audit

Status: IN_PROGRESS; static metadata audit only, not a full secret-scanner or filesystem-access review.

## Scope and method

Checked the local config path `/root/.config/opencode/opencode.json` without printing credential values. The file exists, is 548 bytes, and has mode `0644`. A sanitized structural read showed an OpenAI-compatible provider configuration with a custom base URL and an `apiKey` field; the value was redacted. The configured model/provider is recorded only in local context and is not copied here. `opencode auth list` reported no authenticated integrations. No permission or config content was changed.

## Findings

- Mode `0644` makes the configuration readable by other local users if the file is on a multi-user system. It contains a credential field, but this audit does not establish whether the value is a valid secret, a placeholder, or usable.
- The custom base URL is a tunnel-like hostname. This audit did not validate its operator, TLS, data handling, availability, billing, or whether requests are forwarded to an authorized model endpoint. Do not send project secrets or sensitive source to it without owner verification.
- The file is outside `/root/baturpay`; no project-level OpenCode configuration was created.
- No credentials were printed, copied, or changed. No live request was sent.

## Recommendation

Owner should locally confirm the provider endpoint and credential provenance. If the credential is real, treat it as exposed to local users with read access and review whether rotation is warranted through the provider's official controls. Any permission correction must follow a human-approved plan; none was applied by this audit. Prefer documented OpenCode auth storage or a trusted secret mechanism after verifying compatibility and ownership. Avoid embedding provider credentials in project config or committing them.

## Verification limits

A local structural scan and file mode check are not proof that the credential is absent from backups, process memory, shell history, or previous Git history. No token value is retained in this report.