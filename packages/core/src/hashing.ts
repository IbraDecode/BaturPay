/**
 * Modul: Core — Hashing & canonical encoding
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Deterministic JSON with sorted object keys, so fingerprints are stable. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      output[key] = sortDeep(input[key]);
    }
    return output;
  }
  return value;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hmacSha256Hex(secret: string, input: string | Buffer): string {
  return createHmac('sha256', secret).update(input).digest('hex');
}

export function hmacSha256Base64(secret: string, input: string | Buffer): string {
  return createHmac('sha256', secret).update(input).digest('base64');
}

/** Constant-time hex comparison to avoid signature timing leaks. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function randomBase64Url(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
