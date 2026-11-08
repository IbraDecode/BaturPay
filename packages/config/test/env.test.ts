/**
 * Modul: Config tests
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { describe, expect, it } from 'vitest';
import { liveGateStatus } from '@baturpay/core';
import { loadConfig } from '../src/index.js';

describe('config', () => {
  it('defaults to a closed sandbox gate', () => {
    const config = loadConfig({});
    expect(config.mode).toBe('sandbox');
    expect(liveGateStatus(config.liveGate).open).toBe(false);
  });

  it('keeps live blocked when only the mode is production', () => {
    const config = loadConfig({ BATURPAY_MODE: 'production' });
    expect(liveGateStatus(config.liveGate).open).toBe(false);
  });

  it('opens the gate only with all three conditions', () => {
    const config = loadConfig({
      BATURPAY_MODE: 'production',
      LIVE_PAYMENTS_ENABLED: 'true',
      GO_LIVE_ATTESTATION: 'ATT-2026-0001',
    });
    expect(liveGateStatus(config.liveGate).open).toBe(true);
  });

  it('parses booleans and lists', () => {
    const config = loadConfig({ WEBHOOK_EGRESS_ALLOWLIST: 'a.com, b.com ,', WEBHOOK_ALLOW_PRIVATE_TARGETS: 'false' });
    expect(config.webhook.allowlist).toEqual(['a.com', 'b.com']);
    expect(config.webhook.allowPrivateTargets).toBe(false);
  });

  it('rejects invalid ports', () => {
    expect(() => loadConfig({ PORT: '99999' })).toThrow();
  });
});
