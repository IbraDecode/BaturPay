/**
 * Modul: Webhook — SSRF guard
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * A webhook sender is an SSRF primitive: an attacker can point it at internal
 * services or cloud metadata (169.254.169.254). We reject non-http(s) schemes,
 * embedded credentials, private/loopback/link-local targets, and we re-check
 * every resolved IP — not just the hostname string.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { errors } from '@baturpay/core';

export interface SsrfPolicy {
  allowPrivateTargets: boolean;
  allowlist: string[];
  allowedProtocols?: string[];
}

export const DEFAULT_SSRF_POLICY: SsrfPolicy = {
  allowPrivateTargets: false,
  allowlist: [],
  allowedProtocols: ['http:', 'https:'],
};

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

const PRIVATE_V4_CIDRS: ReadonlyArray<readonly [number, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
].map(([base, bits]) => [ipv4ToInt(base as string)!, bits as number] as const);

export function isPrivateIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  return PRIVATE_V4_CIDRS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (base & mask);
  });
}

export function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (/^fe[89ab][0-9a-f]:/.test(lower)) return true; // link-local fe80::/10
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // unique local fc00::/7
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isPrivateIpv4(mapped[1]!);
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return false;
}

export interface SafeTarget {
  url: URL;
  ips: string[];
}

export async function assertSafeWebhookTarget(
  rawUrl: string,
  policy: SsrfPolicy = DEFAULT_SSRF_POLICY,
): Promise<SafeTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw errors.webhookTargetBlocked('Webhook URL is not a valid absolute URL');
  }

  const protocols = policy.allowedProtocols ?? ['http:', 'https:'];
  if (!protocols.includes(url.protocol)) {
    throw errors.webhookTargetBlocked(`Protocol not allowed: ${url.protocol}`, {
      allowed: protocols,
    });
  }
  if (url.username || url.password) {
    throw errors.webhookTargetBlocked('Webhook URL must not embed credentials');
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const allowlisted = policy.allowlist.some((a) => a.toLowerCase() === host);

  // Literal IP: classify directly without DNS.
  if (isIP(host)) {
    if (isPrivateIp(host) && !(policy.allowPrivateTargets || allowlisted)) {
      throw errors.webhookTargetBlocked('Refusing to deliver to a private/loopback address', {
        host,
      });
    }
    return { url, ips: [host] };
  }

  let addresses: string[];
  try {
    const results = await lookup(host, { all: true });
    addresses = results.map((r) => r.address);
  } catch (cause) {
    throw errors.webhookTargetBlocked('Webhook host could not be resolved', {
      host,
      cause: String(cause),
    });
  }
  if (addresses.length === 0) {
    throw errors.webhookTargetBlocked('Webhook host resolved to no addresses', { host });
  }

  const privateHits = addresses.filter(isPrivateIp);
  if (privateHits.length > 0 && !(policy.allowPrivateTargets || allowlisted)) {
    throw errors.webhookTargetBlocked('Webhook host resolves to a private address', {
      host,
      addresses: privateHits,
    });
  }

  return { url, ips: addresses };
}
