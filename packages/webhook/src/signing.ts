/**
 * Modul: Webhook — Signing & verification
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Signature scheme (Stripe-style):
 *   header:  t=<unix-seconds>,v1=<hex hmac-sha256(secret, `${t}.${rawBody}`)>
 * The timestamp is bound into the signed payload so a captured signature cannot
 * be replayed forever. Verification is constant-time and enforces a tolerance.
 */
import { hmacSha256Hex, safeEqualHex } from '@baturpay/core';

export const SIGNATURE_HEADER = 'x-baturpay-signature';
export const DEFAULT_TOLERANCE_SECONDS = 300;

export interface SignedPayload {
  header: string;
  timestamp: number;
  signature: string;
}

export function signPayload(
  secret: string,
  rawBody: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): SignedPayload {
  if (secret.length === 0) throw new Error('signing secret must not be empty');
  const signature = hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return { timestamp, signature, header: `t=${timestamp},v1=${signature}` };
}

export interface VerifyOptions {
  secret: string;
  rawBody: string;
  header: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}

export type VerifyResult =
  | { valid: true; timestamp: number }
  | { valid: false; reason: 'malformed' | 'expired' | 'mismatch' };

export function parseSignatureHeader(header: string): { timestamp: number; signature: string } | null {
  const parts = header.split(',').map((p) => p.trim());
  const map = new Map<string, string>();
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) return null;
    map.set(part.slice(0, idx), part.slice(idx + 1));
  }
  const t = map.get('t');
  const v1 = map.get('v1');
  if (!t || !v1 || !/^\d+$/.test(t)) return null;
  return { timestamp: Number(t), signature: v1 };
}

export function verifySignature(options: VerifyOptions): VerifyResult {
  const parsed = parseSignatureHeader(options.header);
  if (!parsed) return { valid: false, reason: 'malformed' };

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > tolerance) {
    return { valid: false, reason: 'expired' };
  }

  const expected = hmacSha256Hex(options.secret, `${parsed.timestamp}.${options.rawBody}`);
  if (!safeEqualHex(expected, parsed.signature)) {
    return { valid: false, reason: 'mismatch' };
  }
  return { valid: true, timestamp: parsed.timestamp };
}
