/**
 * Modul: API — Application assembly
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { liveGateStatus } from '@baturpay/core';
import type { AppConfig } from '@baturpay/config';
import type { AppDeps } from './deps.js';
import { makeAuthHook } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/errors.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerInvoiceRoutes } from './routes/invoices.js';
import { registerRunRoutes } from './routes/runs.js';
import { registerScenarioRoutes } from './routes/scenarios.js';
import { registerWebhookRoutes } from './routes/webhooks.js';
import type { Store } from './store/types.js';
import { WebhookDispatcher } from './workers/webhook-dispatcher.js';

export interface BuildAppOptions {
  config: AppConfig;
  store: Store;
  dispatcher?: WebhookDispatcher;
  logger?: boolean;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config, store } = options;
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: true,
    bodyLimit: 1024 * 512,
  });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    allowList: [],
  });

  app.decorateRequest('auth', null);

  const dispatcher = options.dispatcher ?? new WebhookDispatcher(store, config);
  const deps: AppDeps = { config, store, dispatcher, startedAt: Date.now() };

  app.decorate('authenticate', makeAuthHook(config, store));

  registerErrorHandler(app);

  app.get('/', async () => ({
    name: 'BaturPay API',
    mode: config.mode,
    liveGate: liveGateStatus(config.liveGate),
    docs: '/v1/contracts',
    health: '/health',
  }));

  registerHealthRoutes(app, deps);
  registerScenarioRoutes(app, deps);
  registerInvoiceRoutes(app, deps);
  registerRunRoutes(app, deps);
  registerWebhookRoutes(app, deps);
  registerAdminRoutes(app, deps);

  app.addHook('onClose', async () => {
    dispatcher.stop();
    await store.close();
  });

  return app;
}
