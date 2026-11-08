/**
 * Modul: Webhook tests
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { describe, expect, it } from 'vitest';
import { signPayload, verifySignature, SIGNATURE_HEADER } from '../src/signing.js';
import { assertSafeWebhookTarget, isPrivateIp, DEFAULT_SSRF_POLICY } from '../src/ssrf.js';
import { InMemoryDedupStore, deliveryDedupKey } from '../src/dedup.js';
import { isRetryableStatus, retryDelayMs, shouldRetry, DEFAULT_RETRY_POLICY } from '../src/retry.js';

describe('webhook signing', () => {
  const secret = 'whsec_test';
  const body = JSON.stringify({ hello: 'world' });

  it('signs and verifies a valid payload', () => {
    const signed = signPayload(secret, body, 1_000_000);
    expect(signed.header).toContain('t=1000000');
    const result = verifySignature({
      secret,
      rawBody: body,
      header: signed.header,
      nowSeconds: 1_000_000,
    });
    expect(result.valid).toBe(true);
  });

  it('rejects tampered bodies and expired timestamps', () => {
    const signed = signPayload(secret, body, 1_000_000);
    expect(
      verifySignature({ secret, rawBody: body + 'x', header: signed.header, nowSeconds: 1_000_000 })
        .valid,
    ).toBe(false);
    expect(
      verifySignature({ secret, rawBody: body, header: signed.header, nowSeconds: 2_000_000 }).valid,
    ).toBe(false);
  });

  it('rejects malformed headers', () => {
    expect(verifySignature({ secret, rawBody: body, header: 'garbage' }).valid).toBe(false);
  });

  it('uses a stable header name', () => {
    expect(SIGNATURE_HEADER).toBe('x-baturpay-signature');
  });
});

describe('ssrf guard', () => {
  it('classifies private ranges', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.1.2.3')).toBe(true);
    expect(isPrivateIp('172.16.5.5')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });

  it('blocks literal private targets by default', async () => {
    await expect(assertSafeWebhookTarget('http://127.0.0.1:9000/hook')).rejects.toThrow(
      /private\/loopback/,
    );
    await expect(assertSafeWebhookTarget('http://169.254.169.254/latest/meta-data')).rejects.toThrow();
  });

  it('blocks non-http schemes and embedded credentials', async () => {
    await expect(assertSafeWebhookTarget('ftp://example.com')).rejects.toThrow(/Protocol not allowed/);
    await expect(assertSafeWebhookTarget('http://user:pass@example.com')).rejects.toThrow(/credentials/);
  });

  it('allows private targets only when explicitly permitted', async () => {
    const target = await assertSafeWebhookTarget('http://127.0.0.1:9000/hook', {
      ...DEFAULT_SSRF_POLICY,
      allowPrivateTargets: true,
    });
    expect(target.ips).toContain('127.0.0.1');
  });

  it('allows a literal public IP', async () => {
    const target = await assertSafeWebhookTarget('https://1.1.1.1/hook');
    expect(target.ips).toContain('1.1.1.1');
  });
});

describe('dedup store', () => {
  it('detects repeats and can expire them', () => {
    let now = 0;
    const store = new InMemoryDedupStore({ ttlMs: 100, now: () => now });
    const key = deliveryDedupKey('ws_1', 'evt_1');
    expect(store.seen(key)).toBe(false);
    store.mark(key);
    expect(store.seen(key)).toBe(true);
    now = 1_000;
    expect(store.seen(key)).toBe(false);
  });

  it('bounds the number of entries', () => {
    const store = new InMemoryDedupStore({ maxEntries: 2, now: () => 0 });
    store.mark('a');
    store.mark('b');
    store.mark('c');
    expect(store.size()).toBeLessThanOrEqual(2);
  });
});

describe('retry policy', () => {
  it('delays 0 for the first attempt and grows after', () => {
    expect(retryDelayMs(1)).toBe(0);
    expect(retryDelayMs(2)).toBeGreaterThan(0);
    expect(retryDelayMs(5)).toBeGreaterThan(retryDelayMs(3));
  });

  it('caps the delay', () => {
    expect(retryDelayMs(50)).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.maxDelayMs);
  });

  it('stops at max attempts', () => {
    expect(shouldRetry(5)).toBe(true);
    expect(shouldRetry(6)).toBe(false);
  });

  it('only retries transient statuses', () => {
    expect(isRetryableStatus(null)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });
});
