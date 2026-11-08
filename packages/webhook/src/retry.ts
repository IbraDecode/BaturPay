/**
 * Modul: Webhook — Retry & backoff
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Bounded exponential backoff with jitter. Delivery is at-least-once, so the
 * receiving endpoint must be idempotent; this schedule just decides WHEN we try.
 */
export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 6,
  baseDelayMs: 2_000,
  maxDelayMs: 3_600_000,
  jitterRatio: 0.2,
};

/**
 * Delay before attempt `attempt` (1-based). Attempt 1 is immediate.
 * `jitterUnit` is a value in [0,1) supplied by the caller so the function stays
 * pure and deterministic in tests.
 */
export function retryDelayMs(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  jitterUnit = 0,
): number {
  if (attempt <= 1) return 0;
  const exponent = Math.min(attempt - 2, 20);
  const raw = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** exponent);
  const jitter = raw * policy.jitterRatio * clamp01(jitterUnit);
  return Math.round(raw - raw * policy.jitterRatio + jitter * 1); // symmetric-ish spread
}

export function shouldRetry(attempt: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): boolean {
  return attempt < policy.maxAttempts;
}

/** Retry on network errors and 5xx/429/408; never retry other 4xx. */
export function isRetryableStatus(status: number | null): boolean {
  if (status === null) return true; // network failure
  if (status === 408 || status === 429) return true;
  return status >= 500 && status <= 599;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
