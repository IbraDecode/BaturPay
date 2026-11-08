/**
 * Modul: Web — API client
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
export const API_URL =
  process.env.NEXT_PUBLIC_BATURPAY_API_URL ?? 'http://localhost:4000';

export interface Health {
  status: string;
  mode: 'sandbox' | 'production';
  liveGateOpen: boolean;
  contractVersion: string;
}

export interface Invoice {
  id: string;
  externalId: string;
  amountMinor: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface Delivery {
  id: string;
  eventType: string;
  status: string;
  attempts: number;
  responseStatus: number | null;
  error: string | null;
}

export interface Scenario {
  name: string;
  title: string;
  description: string;
}

async function request<T>(path: string, apiKey: string | null, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  headers.accept = 'application/json';
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  if (init?.body) headers['content-type'] = 'application/json';
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await response.text();
  const parsed = text.length > 0 ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = (parsed as { error?: { message?: string } } | null)?.error?.message ?? response.statusText;
    throw new Error(message);
  }
  return parsed as T;
}

export const api = {
  health: () => request<Health>('/health', null),
  scenarios: (key: string) => request<Scenario[]>('/v1/scenarios', key),
  invoices: (key: string) => request<{ data: Invoice[] }>('/v1/invoices', key),
  deliveries: (key: string) => request<Delivery[]>('/v1/webhook-deliveries', key),
  createInvoice: (key: string, externalId: string, amountMinor: number) =>
    request<Invoice>('/v1/invoices', key, {
      method: 'POST',
      headers: { 'idempotency-key': `web-${Date.now()}-${Math.random().toString(16).slice(2)}` } as Record<string, string>,
      body: JSON.stringify({ externalId, amountMinor, currency: 'IDR' }),
    }),
  runScenario: (key: string, invoiceId: string, scenario: string) =>
    request<{ runId: string; finalStatus: string }>('/v1/runs', key, {
      method: 'POST',
      headers: { 'idempotency-key': `web-run-${Date.now()}` } as Record<string, string>,
      body: JSON.stringify({ invoiceId, scenario }),
    }),
  dispatch: (key: string) =>
    request<{ delivered: number; retried: number; failed: number }>('/v1/admin/dispatch-tick', key, {
      method: 'POST',
    }),
  bootstrap: (name: string) =>
    request<{ apiKey: { secret: string }; workspace: { id: string } }>('/v1/workspaces', null, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
};
