/**
 * Modul: Core tests — ids & hashing
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { describe, expect, it } from 'vitest';
import { isValidId, newId, ulidTime } from '../src/ids.js';
import { canonicalJson, hmacSha256Hex, safeEqualHex, sha256Hex } from '../src/hashing.js';

describe('ids', () => {
  it('creates prefixed, valid ids', () => {
    const id = newId('inv');
    expect(id.startsWith('inv_')).toBe(true);
    expect(isValidId(id, 'inv')).toBe(true);
    expect(isValidId(id, 'ws')).toBe(false);
  });

  it('is roughly time-sortable', () => {
    const a = newId('inv', 1_000);
    const b = newId('inv', 2_000);
    expect(a < b).toBe(true);
    expect(ulidTime(a)).toBe(1_000);
  });
});

describe('hashing', () => {
  it('canonicalizes object key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('computes stable sha256 and hmac', () => {
    expect(sha256Hex('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
    const mac = hmacSha256Hex('secret', 'msg');
    expect(mac).toHaveLength(64);
    expect(hmacSha256Hex('secret', 'msg')).toBe(mac);
  });

  it('compares hex in constant time semantics', () => {
    const a = sha256Hex('a');
    expect(safeEqualHex(a, a)).toBe(true);
    expect(safeEqualHex(a, sha256Hex('b'))).toBe(false);
    expect(safeEqualHex('zz', 'zz')).toBe(false); // not hex
    expect(safeEqualHex('aa', '')).toBe(false);
  });
});
