/**
 * Modul: API — Authentication plugin
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { errors } from '@baturpay/core';
import type { AppConfig } from '@baturpay/config';
import { authenticateApiKey, type AuthenticatedKey } from '../services/auth.js';
import type { Store } from '../store/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthenticatedKey | null;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function extractBearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') return null;
  return token.trim();
}

/** preHandler that requires a valid sandbox API key. */
export function makeAuthHook(config: AppConfig, store: Store) {
  return async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) throw errors.unauthorized('Missing bearer API key');
    const auth = await authenticateApiKey(store, config.apiKeyPepper, token);
    if (!auth) throw errors.unauthorized('Invalid or revoked API key');
    request.auth = auth;
  };
}

export function requireAuth(request: FastifyRequest): AuthenticatedKey {
  if (!request.auth) throw errors.unauthorized('Authentication required');
  return request.auth;
}

export function requestActor(request: FastifyRequest): string {
  return request.auth ? `key:${request.auth.keyId}` : 'anonymous';
}
