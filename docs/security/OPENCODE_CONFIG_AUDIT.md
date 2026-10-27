# OpenCode Configuration Security Audit

Status: VERIFIED for local metadata and structural checks; credential validity and endpoint trust remain OPEN.

## Officially identified configuration path

OpenCode v2.2.0 `opencode debug paths` reports global config directory `/root/.config/opencode`. The discovered file `/root/.config/opencode/opencode.json` is a regular file, not a symlink, at its resolved path. Official references: https://opencode.ai/docs/config/ and https://opencode.ai/docs/cli (CLI documents `opencode debug paths`; local command output confirmed paths).

## Observed facts (credential values withheld)

- Config file owner UID 0, group GID 0, mode `0644`, size 548 bytes.
- Parent `/root` mode `0700`, owner/group 0:0; `/root/.config` and `/root/.config/opencode` mode `0755`, owner/group 0:0.
- JSON is parseable and contains a provider `options.apiKey` field whose value is a non-empty literal string of length 35. The value was never printed, copied, logged, or sent to any service. Classification as “non-empty literal” does not establish that it is a valid, active, or provider-issued credential; it might be a placeholder or another value.
- The JSON also defines an OpenAI-compatible provider endpoint. Its owner, data handling, TLS behavior, model availability and billing were not independently verified. No request was sent.
- `opencode auth list` reports no authenticated integrations.
- `/root/baturpay` Git history contains no OpenCode config path; initial secret-pattern scan of project files found no candidate credential. The config is outside the repository. No broad machine backup/history scan was performed.
- No file permission/content, credential, or authentication setting was modified.

## Access/risk interpretation

The file mode `0644` alone allows reads by any process that can traverse all parent directories. Here `/root` is mode `0700`, which ordinarily prevents other unprivileged local users from traversing into `/root`; therefore the specific claim that ordinary local users can read this file is NOT established by the `0644` mode alone. UID 0 and privileged processes can read it. Other privileged services, backups, host namespaces, ACLs, or alternate mounts were not audited. The mode is broader than necessary as defense-in-depth, but no correction is made without owner approval.

## Recommended owner actions (not performed)

1. Confirm locally whether the non-empty literal is an actual secret or a placeholder; do not paste it into chat or send it to an endpoint.
2. Verify the custom endpoint operator, TLS certificate, terms, data retention, and billing before sending any project source.
3. If it is a real provider credential and access/exposure is unacceptable, rotate/revoke through the provider's official console, then update OpenCode through its supported credential mechanism; verify the new status without printing the value. Do not rotate automatically.
4. Consider restricting file mode (e.g. owner-only) after verifying which user/process must read it. This report intentionally made no permission change.
5. Re-scan backups or other Git repositories only if the owner requests and defines scope. No credential was found in the BaturPay repository's commits by path or heuristic scan.

## Recovery considerations

Before changing config, owner should preserve an appropriately protected backup, record current provider/model names without secrets, adjust through OpenCode's documented settings/auth UI where possible, validate with `opencode auth list` and a bounded authorized request only if cost is approved, and restore the protected backup if the supported configuration becomes unusable. Rotation invalidates the old key and may interrupt other clients; check dependencies first. No recovery action has been taken.