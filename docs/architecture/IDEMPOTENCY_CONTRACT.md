# Idempotency Contract

Status: domain contract implemented and unit-tested; persistence, atomic claims, execution and crash recovery are NOT implemented. Not production-ready.

## Scope

An idempotency request is scoped by `(merchant_id, environment, operation, provider_account_id?, idempotency_key)`. The optional provider-account identifier separates two merchant-connected accounts; use one canonical absent-account representation. Supported operation values in this initial contract are `PAYMENT_CREATE` and `REFUND_CREATE` (refund execution itself is not implemented). A different merchant, environment, operation, provider account or key produces a different opaque SHA-256 storage key. The raw key is accepted for derivation and is not returned in the store request object.

## Fingerprint

`payloadFingerprint` hashes canonical JSON with recursively sorted object keys. This is a payload utility, not an API request canonicalization policy. The application must pass only semantically relevant, normalized operation fields; exclude the idempotency key, authentication headers, transient metadata, secrets and fields whose formatting is semantically irrelevant. Non-JSON values, undefined, sparse arrays, non-finite numbers, cycles and non-plain objects are rejected. Canonicalization needs adversarial review before treating its digest as a durable compatibility contract.

## Request/replay decision model

- No existing record → `CLAIM_REQUIRED`. A durable store must atomically claim before operation execution.
- Same scoped key, different fingerprint → `PAYLOAD_CONFLICT`; never execute.
- Same fingerprint, `IN_PROGRESS` → `IN_PROGRESS`; never execute a duplicate.
- Same fingerprint, `SUCCEEDED` or `FAILED_FINAL` and unexpired → `REPLAY` the stored sanitized response.
- `UNKNOWN` → `RECOVERY_REQUIRED`, even if its nominal retention time elapsed; do not issue a blind retry.
- A known-final entry past its configured expiry → `RETENTION_EXPIRED`; this contract does not automatically reclaim it. An explicit retention/reuse policy must decide what happens.

`FAILED_FINAL` means the operation outcome is known and safe to replay as that same final failure; transport failure or timeout is not sufficient to declare it. The domain model records response metadata only, and does not implement HTTP behavior.

## Retention and concurrency

Retention seconds are passed as configuration when forming a claim; this module selects no duration. In production, enforce uniqueness at the persistent database boundary with an atomic insert/unique constraint and return the existing row on conflict. A process-local map, preflight `SELECT`, advisory assumption or Redis-only state does not prove atomicity. Cross-system provider execution cannot share a PostgreSQL transaction; claim, provider request and finalization require separate guarded steps and explicit recovery for ambiguous outcomes. `AtomicIdempotencyStore` is only a TypeScript interface specifying the expected boundary: `claim` returns `CLAIMED` only for the caller that atomically inserted the record, and finalization/mark-unknown are explicit state writes. No storage implementation or database-backed concurrency test exists.

## Crash and recovery

A crash after claim but before dispatch leaves `IN_PROGRESS`; a crash after provider acceptance but before recording the response may leave `UNKNOWN`. Recovery must consult durable operation references and provider-supported status lookup under an approved provider-specific policy. Do not infer `FAILED`, release the key, or retry payment creation based only on timeout, worker restart or key expiry.

## No financial behavior

This contract stores no payment, does not call providers, issue refunds, hold funds, write a ledger or settle transactions. Provider key semantics and safe retry/recovery requirements remain OPEN until a provider is selected and validated. See `PERSISTENCE_DESIGN.md` for the proposed PostgreSQL atomic-claim protocol (design only).