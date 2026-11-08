/**
 * Modul: API — API key authentication
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Keys look like: sk_sandbox_<prefix>_<secret>
 * We store only a keyed hash plus the public prefix, so a database leak does
 * not expose usable credentials. Verification is constant-time.
 */
import { newId, safeEqualHex, sha256Hex, randomHex } from '@baturpay/core';
import type { ApiKeyRecord, Store } from '../store/types.js';

export const SANDBOX_KEY_SCHEME = 'sk_sandbox';

export interface ParsedApiKey {
  scheme: string;
  prefix: string;
  secret: string;
}

export interface MintedApiKey {
  plaintext: string;
  prefix: string;
  hash: string;
}

export function hashApiKey(pepper: string, plaintext: string): string {
  return sha256Hex(`${pepper}:${plaintext}`);
}

export function parseApiKey(plaintext: string): ParsedApiKey | null {
  const parts = plaintext.trim().split('_');
  if (parts.length < 4) return null;
  const [sk, scheme, prefix, ...rest] = parts as [string, string, string, ...string[]];
  const secret = rest.join('_');
  if (sk !== 'sk' || prefix.length < 6 || secret.length < 16) return null;
  return { scheme, prefix, secret };
}

export function mintApiKey(pepper: string): MintedApiKey {
  const prefix = randomHex(5);
  const secret = randomHex(24);
  const plaintext = `${SANDBOX_KEY_SCHEME}_${prefix}_${secret}`;
  return { plaintext, prefix, hash: hashApiKey(pepper, plaintext) };
}

export interface AuthenticatedKey {
  keyId: string;
  workspaceId: string;
  scopes: string[];
}

export async function authenticateApiKey(
  store: Store,
  pepper: string,
  plaintext: string,
): Promise<AuthenticatedKey | null> {
  const parsed = parseApiKey(plaintext);
  if (!parsed) return null;
  const record: ApiKeyRecord | null = await store.findApiKeyByPrefix(parsed.prefix);
  if (!record || record.revokedAt) return null;
  const expected = hashApiKey(pepper, plaintext);
  if (!safeEqualHex(expected, record.keyHash)) return null;
  return { keyId: record.id, workspaceId: record.workspaceId, scopes: record.scopes };
}

/** Build a persisted key record (hash only) for a workspace. */
export function buildApiKeyRecord(
  workspaceId: string,
  minted: MintedApiKey,
  scopes: string[],
): ApiKeyRecord {
  return {
    id: newId('key'),
    workspaceId,
    keyPrefix: minted.prefix,
    keyHash: minted.hash,
    scopes,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
}
