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
  payment_id: string;
  merchant_id: string;
  environment: PaymentEnvironment;
  service_model: PaymentServiceModel;
  amount_minor: number;
  currency: string;
  status: PaymentStatus;
  version: number;
}

export interface PaymentTransitionContext {
  evidence?: PaymentTransitionEvidence;
}

export interface PaymentTransitionError {
  code: "INVALID_PAYMENT" | "TERMINAL_STATE" | "MISSING_EVIDENCE" | "UNKNOWN_REQUIRES_EVIDENCE" | "TRANSITION_NOT_ALLOWED";
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
    (value.version as number) >= 1
  );
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
  if (TERMINAL_STATUSES.has(current.status)) {
    return { ok: false, error: { code: "TERMINAL_STATE", message: `Terminal payment state ${current.status} cannot transition.` } };
  }
  if (current.status === "UNKNOWN" && !(context.evidence === "TRUSTED_PROVIDER_STATUS" || context.evidence === "VERIFIED_RECONCILIATION")) {
    return { ok: false, error: { code: "UNKNOWN_REQUIRES_EVIDENCE", message: "UNKNOWN must be resolved from trusted provider status or verified reconciliation evidence." } };
  }
  if (!context.evidence) {
    return { ok: false, error: { code: "MISSING_EVIDENCE", message: "A validated transition evidence type is required." } };
  }
  const verifiedOutcomeEvidence: readonly PaymentTransitionEvidence[] = ["TRUSTED_PROVIDER_STATUS", "VERIFIED_WEBHOOK", "VERIFIED_RECONCILIATION"];
  if (["PAID", "FAILED", "EXPIRED", "CANCELLED"].includes(next) && !verifiedOutcomeEvidence.includes(context.evidence)) {
    return { ok: false, error: { code: "MISSING_EVIDENCE", message: "A terminal payment outcome requires verified provider or reconciliation evidence." } };
  }
  if (!ALLOWED_TRANSITIONS[current.status].includes(next)) {
    return { ok: false, error: { code: "TRANSITION_NOT_ALLOWED", message: `Transition ${current.status} -> ${next} is not allowed.` } };
  }
  if (current.status === "UNKNOWN" && next === "UNKNOWN") {
    return { ok: false, error: { code: "TRANSITION_NOT_ALLOWED", message: "UNKNOWN cannot transition to itself." } };
  }

  return { ok: true, payment: { ...current, status: next, version: current.version + 1 } };
}
