/**
 * Modul: Config — Environment loading & mode gate
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * One validated config object for the whole process. Invalid or missing config
 * fails loudly at boot rather than at the first request.
 */
import { z } from 'zod';
import type { LiveGate, RuntimeMode } from '@baturpay/core';

const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z.object({
  BATURPAY_MODE: z.enum(['sandbox', 'production']).default('sandbox'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1).default('postgres://baturpay:baturpay@localhost:5432/baturpay'),
  API_KEY_PEPPER: z.string().min(8).default('change-me-development-only-pepper'),
  WEBHOOK_SIGNING_SECRET: z.string().min(8).default('change-me-development-only-webhook-secret'),
  SESSION_JWT_SECRET: z.string().min(8).default('change-me-development-only-session-secret'),
  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(6),
  WEBHOOK_ALLOW_PRIVATE_TARGETS: boolFromString.default(true),
  WEBHOOK_EGRESS_ALLOWLIST: z.string().default('localhost,127.0.0.1'),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(600),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  LIVE_PAYMENTS_ENABLED: boolFromString.default(false),
  GO_LIVE_ATTESTATION: z.string().default(''),
  PROVIDER_SANDBOX_ENABLED: boolFromString.default(true),
  PROVIDER_LIVE_ENABLED: boolFromString.default(false),
});

export type RawEnv = Record<string, string | undefined>;

export interface AppConfig {
  mode: RuntimeMode;
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  host: string;
  publicBaseUrl: string;
  databaseUrl: string;
  apiKeyPepper: string;
  webhookSigningSecret: string;
  sessionJwtSecret: string;
  webhook: {
    maxAttempts: number;
    allowPrivateTargets: boolean;
    allowlist: string[];
  };
  rateLimit: {
    max: number;
    windowMs: number;
  };
  providers: {
    sandboxEnabled: boolean;
    liveEnabled: boolean;
  };
  liveGate: LiveGate;
  isProductionMode: boolean;
  isTest: boolean;
}

export function loadConfig(env: RawEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);
  const mode = parsed.BATURPAY_MODE as RuntimeMode;
  const liveGate: LiveGate = {
    mode,
    livePaymentsEnabled: parsed.LIVE_PAYMENTS_ENABLED,
    goLiveAttestation: parsed.GO_LIVE_ATTESTATION,
  };
  return {
    mode,
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    host: parsed.HOST,
    publicBaseUrl: parsed.PUBLIC_BASE_URL.replace(/\/$/, ''),
    databaseUrl: parsed.DATABASE_URL,
    apiKeyPepper: parsed.API_KEY_PEPPER,
    webhookSigningSecret: parsed.WEBHOOK_SIGNING_SECRET,
    sessionJwtSecret: parsed.SESSION_JWT_SECRET,
    webhook: {
      maxAttempts: parsed.WEBHOOK_MAX_ATTEMPTS,
      allowPrivateTargets: parsed.WEBHOOK_ALLOW_PRIVATE_TARGETS,
      allowlist: parsed.WEBHOOK_EGRESS_ALLOWLIST.split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    },
    rateLimit: { max: parsed.RATE_LIMIT_MAX, windowMs: parsed.RATE_LIMIT_WINDOW_MS },
    providers: {
      sandboxEnabled: parsed.PROVIDER_SANDBOX_ENABLED,
      liveEnabled: parsed.PROVIDER_LIVE_ENABLED,
    },
    liveGate,
    isProductionMode: mode === 'production',
    isTest: parsed.NODE_ENV === 'test',
  };
}
