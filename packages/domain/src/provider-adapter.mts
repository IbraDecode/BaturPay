import type { PaymentEnvironment, PaymentServiceModel } from "./payment.mts";

export type ProviderOperationStatus = "PENDING" | "REQUIRES_ACTION" | "PROCESSING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";
export type ProviderCapabilityName = "PAYMENT_CREATE" | "PAYMENT_STATUS_LOOKUP" | "REFUND_CREATE" | "WEBHOOKS";

export interface ProviderCapabilities {
  payment_create: boolean;
  payment_status_lookup: boolean;
  refund_create: boolean;
  webhooks: boolean;
}

export interface CreatePaymentRequest {
  payment_id: string;
  merchant_id: string;
  environment: PaymentEnvironment;
  service_model: PaymentServiceModel;
  amount_minor: number;
  currency: string;
  idempotency_key: string;
}

export interface ProviderEvidenceReference {
  /** Opaque reference for separate evidence verification/storage; not proof by itself. */
  reference: string;
  received_at: string;
}

const NORMALIZED_REASON_CODES = ["TIMEOUT", "TRANSPORT_ERROR", "PROVIDER_REJECTED", "UNKNOWN_OUTCOME", "INVALID_PROVIDER_RESPONSE"] as const;
export type ProviderUnknownReason = (typeof NORMALIZED_REASON_CODES)[number];

export type ProviderCreatePaymentResult =
  | { kind: "ACCEPTED"; provider_operation_id: string; suggested_status: "PENDING" | "REQUIRES_ACTION" | "PROCESSING"; evidence: ProviderEvidenceReference }
  | { kind: "FINAL"; provider_operation_id: string; suggested_status: "PAID" | "FAILED" | "EXPIRED" | "CANCELLED"; evidence: ProviderEvidenceReference }
  | { kind: "UNKNOWN"; provider_operation_id?: string; reason_code: ProviderUnknownReason; evidence?: ProviderEvidenceReference }
  | { kind: "UNSUPPORTED"; capability: "PAYMENT_CREATE" };

/** Provider boundary only. Implementations return observations; they cannot mutate Payment state. */
export interface PaymentProviderAdapter {
  readonly provider_id: string;
  capabilities(): Readonly<ProviderCapabilities>;
  createPayment(request: CreatePaymentRequest): Promise<ProviderCreatePaymentResult>;
}

/** Test-only deterministic adapter. Never connects to a network or represents a real provider. */
export class FakePaymentAdapter implements PaymentProviderAdapter {
  readonly provider_id = "fake-test-adapter";
  readonly #result: ProviderCreatePaymentResult;

  constructor(result: ProviderCreatePaymentResult) {
    this.#result = result;
  }

  capabilities(): Readonly<ProviderCapabilities> {
    return Object.freeze({
      payment_create: !(this.#result.kind === "UNSUPPORTED" && this.#result.capability === "PAYMENT_CREATE"),
      payment_status_lookup: false,
      refund_create: false,
      webhooks: false,
    });
  }

  async createPayment(_request: CreatePaymentRequest): Promise<ProviderCreatePaymentResult> {
    return structuredClone(this.#result);
  }
}

/** Maps normalized provider observations to candidate domain statuses; does not apply transitions. */
function dataRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return undefined;
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return undefined;
    }
    return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value])) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function normalizeEvidence(value: unknown): ProviderEvidenceReference | undefined {
  const candidate = dataRecord(value);
  if (!candidate || Object.keys(candidate).length !== 2) return undefined;
  const reference = candidate.reference;
  const receivedAt = candidate.received_at;
  if (typeof reference !== "string" || reference.trim().length === 0 || reference.length > 512) return undefined;
  if (typeof receivedAt !== "string" || receivedAt.length > 40 || Number.isNaN(Date.parse(receivedAt))) return undefined;
  return { reference, received_at: receivedAt };
}

/** Converts untrusted provider-shaped data to a normalized observation; malformed input remains UNKNOWN. */
export function normalizeProviderResult(value: unknown): ProviderCreatePaymentResult {
  const candidate = dataRecord(value);
  if (!candidate) return { kind: "UNKNOWN", reason_code: "INVALID_PROVIDER_RESPONSE" };
  if (candidate.kind === "UNSUPPORTED" && ["PAYMENT_CREATE"].includes(candidate.capability as string)) {
    return { kind: "UNSUPPORTED", capability: "PAYMENT_CREATE" };
  }
  if (candidate.kind === "UNKNOWN") {
    const providerId = candidate.provider_operation_id;
    const evidence = normalizeEvidence(candidate.evidence);
    return {
      kind: "UNKNOWN",
      ...(typeof providerId === "string" && providerId.trim().length > 0 && providerId.length <= 255 ? { provider_operation_id: providerId } : {}),
      reason_code: NORMALIZED_REASON_CODES.includes(candidate.reason_code as ProviderUnknownReason) ? candidate.reason_code as ProviderUnknownReason : "UNKNOWN_OUTCOME",
      ...(evidence ? { evidence } : {}),
    };
  }
  const acceptedStatuses = ["PENDING", "REQUIRES_ACTION", "PROCESSING"] as const;
  const finalStatuses = ["PAID", "FAILED", "EXPIRED", "CANCELLED"] as const;
  const providerId = candidate.provider_operation_id;
  const evidence = normalizeEvidence(candidate.evidence);
  if (typeof providerId !== "string" || providerId.trim().length === 0 || providerId.length > 255 || !evidence) {
    return { kind: "UNKNOWN", reason_code: "INVALID_PROVIDER_RESPONSE" };
  }
  const common = { provider_operation_id: providerId, evidence };
  if (candidate.kind === "ACCEPTED" && acceptedStatuses.includes(candidate.suggested_status as (typeof acceptedStatuses)[number])) {
    return { kind: "ACCEPTED", ...common, suggested_status: candidate.suggested_status as (typeof acceptedStatuses)[number] };
  }
  if (candidate.kind === "FINAL" && finalStatuses.includes(candidate.suggested_status as (typeof finalStatuses)[number])) {
    return { kind: "FINAL", ...common, suggested_status: candidate.suggested_status as (typeof finalStatuses)[number] };
  }
  return { kind: "UNKNOWN", reason_code: "INVALID_PROVIDER_RESPONSE" };
}

export function candidateStatus(value: unknown): ProviderOperationStatus | "UNKNOWN" | "UNSUPPORTED" {
  const result = normalizeProviderResult(value);
  if (result.kind === "UNSUPPORTED") return "UNSUPPORTED";
  if (result.kind === "UNKNOWN") return "UNKNOWN";
  return result.suggested_status;
}

export function isCapabilitySupported(capabilities: Readonly<ProviderCapabilities>, capability: ProviderCapabilityName): boolean {
  switch (capability) {
    case "PAYMENT_CREATE": return capabilities.payment_create;
    case "PAYMENT_STATUS_LOOKUP": return capabilities.payment_status_lookup;
    case "REFUND_CREATE": return capabilities.refund_create;
    case "WEBHOOKS": return capabilities.webhooks;
  }
}
