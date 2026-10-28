export const PAYMENT_STATUSES = [
  "CREATED",
  "PENDING",
  "REQUIRES_ACTION",
  "PROCESSING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "UNKNOWN",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentEnvironment = "SANDBOX" | "PRODUCTION";
export type PaymentServiceModel = "CONNECTED_PROVIDER" | "BATURPAY";
export type PaymentTransitionEvidence =
  | "REQUEST_ACCEPTED"
  | "TRUSTED_PROVIDER_STATUS"
  | "VERIFIED_WEBHOOK"
  | "VERIFIED_RECONCILIATION";
export interface Payment {
  readonly payment_id: string;
  readonly merchant_id: string;
  readonly environment: PaymentEnvironment;
  readonly service_model: PaymentServiceModel;
  readonly amount_minor: number;
  readonly currency: string;
  readonly status: PaymentStatus;
  readonly version: number;
}

export interface PaymentTransitionContext {
  evidence?: PaymentTransitionEvidence;
}

export type PaymentCreationResult =
  | { ok: true; payment: Payment }
  | { ok: false; error: PaymentTransitionError };

export interface PaymentTransitionError {
  code: "INVALID_PAYMENT" | "INVALID_EVIDENCE" | "TERMINAL_STATE" | "MISSING_EVIDENCE" | "UNKNOWN_REQUIRES_EVIDENCE" | "TRANSITION_NOT_ALLOWED" | "VERSION_EXHAUSTED" | "UNVERIFIED_EVIDENCE";
  message: string;
}

export type PaymentTransitionResult =
  | { ok: true; payment: Payment }
  | { ok: false; error: PaymentTransitionError };

const TERMINAL_STATUSES: ReadonlySet<PaymentStatus> = new Set(["PAID", "FAILED", "EXPIRED", "CANCELLED"]);

const ALLOWED_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  CREATED: ["PENDING", "REQUIRES_ACTION", "PROCESSING", "FAILED", "EXPIRED", "CANCELLED", "UNKNOWN"],
  PENDING: ["REQUIRES_ACTION", "PROCESSING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "UNKNOWN"],
  REQUIRES_ACTION: ["PENDING", "PROCESSING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "UNKNOWN"],
  PROCESSING: ["PENDING", "PAID", "FAILED", "EXPIRED", "CANCELLED", "UNKNOWN"],
  PAID: [],
  FAILED: [],
  EXPIRED: [],
  CANCELLED: [],
  UNKNOWN: ["PENDING", "REQUIRES_ACTION", "PROCESSING", "PAID", "FAILED", "EXPIRED", "CANCELLED"],
};

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validatePayment(payment: unknown): payment is Payment {
  if (typeof payment !== "object" || payment === null || Array.isArray(payment)) return false;
  const value = payment as Record<string, unknown>;
  return (
    isNonEmpty(value.payment_id) &&
    isNonEmpty(value.merchant_id) &&
    (value.environment === "SANDBOX" || value.environment === "PRODUCTION") &&
    (value.service_model === "CONNECTED_PROVIDER" || value.service_model === "BATURPAY") &&
    Number.isSafeInteger(value.amount_minor) &&
    (value.amount_minor as number) > 0 &&
    typeof value.currency === "string" &&
    /^[A-Z]{3}$/.test(value.currency) &&
    PAYMENT_STATUSES.includes(value.status as PaymentStatus) &&
    Number.isSafeInteger(value.version) &&
    (value.version as number) >= 1 &&
    (value.version as number) <= Number.MAX_SAFE_INTEGER
  );
}

export function createPayment(input: Omit<Payment, "status" | "version">): PaymentCreationResult {
  const payment: Payment = { ...input, status: "CREATED", version: 1 };
  if (!validatePayment(payment)) {
    return {
      ok: false,
      error: { code: "INVALID_PAYMENT", message: "Payment identity, positive minor-unit amount, currency, environment, or service model is invalid." },
    };
  }
  return { ok: true, payment };
}

export function markPaymentUnknown(current: Payment): PaymentTransitionResult {
  if (!validatePayment(current)) {
    return { ok: false, error: { code: "INVALID_PAYMENT", message: "Payment data is invalid." } };
  }
  if (TERMINAL_STATUSES.has(current.status)) {
    return { ok: false, error: { code: "TERMINAL_STATE", message: "Terminal payment state cannot be marked UNKNOWN." } };
  }
  if (current.status === "UNKNOWN") {
    return { ok: false, error: { code: "TRANSITION_NOT_ALLOWED", message: "Payment is already UNKNOWN." } };
  }
  if (current.version === Number.MAX_SAFE_INTEGER) {
    return { ok: false, error: { code: "VERSION_EXHAUSTED", message: "Payment version cannot be incremented safely." } };
  }
  return { ok: true, payment: { ...current, status: "UNKNOWN", version: current.version + 1 } };
}

export function transitionPayment(
  current: Payment,
  next: PaymentStatus,
  context: PaymentTransitionContext = {},
): PaymentTransitionResult {
  if (!validatePayment(current)) {
    return {
      ok: false,
      error: { code: "INVALID_PAYMENT", message: "Payment identity, positive minor-unit amount, currency, environment, service model, status, or version is invalid." },
    };
  }
  if (!PAYMENT_STATUSES.includes(next)) {
    return { ok: false, error: { code: "TRANSITION_NOT_ALLOWED", message: "Unknown payment status." } };
  }
  if (typeof context !== "object" || context === null || Array.isArray(context)) {
    return { ok: false, error: { code: "INVALID_EVIDENCE", message: "Transition context must be an object." } };
  }
  const validEvidence: readonly PaymentTransitionEvidence[] = ["REQUEST_ACCEPTED", "TRUSTED_PROVIDER_STATUS", "VERIFIED_WEBHOOK", "VERIFIED_RECONCILIATION"];
  if (context.evidence !== undefined && !validEvidence.includes(context.evidence)) {
    return { ok: false, error: { code: "INVALID_EVIDENCE", message: "Transition evidence label is not recognized." } };
  }
  if (TERMINAL_STATUSES.has(current.status)) {
    return { ok: false, error: { code: "TERMINAL_STATE", message: `Terminal payment state ${current.status} cannot transition.` } };
  }
  if (current.version === Number.MAX_SAFE_INTEGER) {
    return { ok: false, error: { code: "VERSION_EXHAUSTED", message: "Payment version cannot be incremented safely." } };
  }
  if (!ALLOWED_TRANSITIONS[current.status].includes(next)) {
    return { ok: false, error: { code: "TRANSITION_NOT_ALLOWED", message: `Transition ${current.status} -> ${next} is not allowed.` } };
  }
  if (current.status === "UNKNOWN") {
    return { ok: false, error: { code: "UNKNOWN_REQUIRES_EVIDENCE", message: "UNKNOWN requires authoritative evidence; caller-supplied labels cannot resolve it." } };
  }
  if (!context.evidence) {
    return { ok: false, error: { code: "MISSING_EVIDENCE", message: "A validated transition evidence type is required." } };
  }
  return { ok: false, error: { code: "UNVERIFIED_EVIDENCE", message: "No evidence-verification authority exists in this package; caller-supplied labels cannot authorize payment state changes." } };
}
