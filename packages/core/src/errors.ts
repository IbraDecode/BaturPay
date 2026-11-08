/**
 * Modul: Core — Errors
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_TRANSITION'
  | 'LIVE_OPERATION_BLOCKED'
  | 'WEBHOOK_TARGET_BLOCKED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL_ERROR';

const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  IDEMPOTENCY_CONFLICT: 409,
  INVALID_TRANSITION: 422,
  LIVE_OPERATION_BLOCKED: 451,
  WEBHOOK_TARGET_BLOCKED: 400,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
};

export interface BaturPayErrorOptions {
  details?: Record<string, unknown>;
  cause?: unknown;
}

/**
 * Base error for all domain failures. Carries a stable machine code and an
 * HTTP status so both the API and the CLI can render it consistently without
 * leaking internal stack traces to clients.
 */
export class BaturPayError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, options: BaturPayErrorOptions = {}) {
    super(message);
    this.name = 'BaturPayError';
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.details = options.details ?? {};
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }

  toJSON(): Record<string, unknown> {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export const errors = {
  validation: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('VALIDATION_ERROR', message, { details }),
  notFound: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('NOT_FOUND', message, { details }),
  conflict: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('CONFLICT', message, { details }),
  unauthorized: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('UNAUTHORIZED', message, { details }),
  forbidden: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('FORBIDDEN', message, { details }),
  rateLimited: (message = 'Rate limit exceeded', details?: Record<string, unknown>) =>
    new BaturPayError('RATE_LIMITED', message, { details }),
  idempotencyConflict: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('IDEMPOTENCY_CONFLICT', message, { details }),
  invalidTransition: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('INVALID_TRANSITION', message, { details }),
  liveBlocked: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('LIVE_OPERATION_BLOCKED', message, { details }),
  webhookTargetBlocked: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('WEBHOOK_TARGET_BLOCKED', message, { details }),
  upstream: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('UPSTREAM_ERROR', message, { details }),
  internal: (message: string, details?: Record<string, unknown>) =>
    new BaturPayError('INTERNAL_ERROR', message, { details }),
};

export function isBaturPayError(value: unknown): value is BaturPayError {
  return value instanceof BaturPayError;
}

/** Normalize unknown throws into a BaturPayError without losing the cause. */
export function toBaturPayError(value: unknown): BaturPayError {
  if (isBaturPayError(value)) return value;
  if (value instanceof Error) {
    return new BaturPayError('INTERNAL_ERROR', value.message, { cause: value });
  }
  return new BaturPayError('INTERNAL_ERROR', 'Unknown error', { details: { value: String(value) } });
}
