/**
 * Modul: Core — Identifiers
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Prefixed, lexicographically sortable identifiers (ULID-style). Sortable ids
 * keep database indexes friendly and let us page by id without extra columns.
 * The prefix makes an id self-describing in logs and support tickets.
 */
import { randomBytes } from 'node:crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export type IdPrefix =
  | 'ws'
  | 'key'
  | 'inv'
  | 'evt'
  | 'run'
  | 'wh'
  | 'dlv'
  | 'aud'
  | 'ctr'
  | 'usr';

function encodeTime(ms: number, length: number): string {
  let value = ms;
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out = CROCKFORD[value % 32]! + out;
    value = Math.floor(value / 32);
  }
  return out;
}

function encodeRandom(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CROCKFORD[bytes[i]! % 32];
  }
  return out;
}

/** Monotonic-ish ULID: 10 time chars + 16 random chars = 26 chars. */
export function ulid(now: number = Date.now()): string {
  return encodeTime(now, 10) + encodeRandom(16);
}

export function newId(prefix: IdPrefix, now: number = Date.now()): string {
  return `${prefix}_${ulid(now)}`;
}

/** Extract the millisecond timestamp encoded in a ULID body. */
export function ulidTime(id: string): number {
  const body = id.includes('_') ? id.slice(id.indexOf('_') + 1) : id;
  let ms = 0;
  for (const ch of body.slice(0, 10)) {
    const idx = CROCKFORD.indexOf(ch.toUpperCase());
    if (idx === -1) return Number.NaN;
    ms = ms * 32 + idx;
  }
  return ms;
}

export function isValidId(id: string, prefix?: IdPrefix): boolean {
  const match = /^([a-z]{2,3})_([0-9A-HJKMNP-TV-Z]{26})$/.exec(id);
  if (!match) return false;
  if (prefix && match[1] !== prefix) return false;
  return true;
}
