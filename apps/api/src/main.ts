/**
 * Modul: API — Entry point
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { loadConfig } from '@baturpay/config';
import { liveGateStatus } from '@baturpay/core';
import { buildApp } from './app.js';
import { createStore } from './store/index.js';
import { WebhookDispatcher } from './workers/webhook-dispatcher.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const store = await createStore(config);
  const dispatcher = new WebhookDispatcher(store, config);
  const app = await buildApp({ config, store, dispatcher });

  const gate = liveGateStatus(config.liveGate);
  app.log.info(
    { mode: config.mode, store: store.kind, contractVersion: '2026-11-09' },
    'BaturPay API starting',
  );
  if (!gate.open) {
    app.log.warn(
      { reasons: gate.reasons },
      'Live money operations are DISABLED (compliance gate closed). Sandbox only.',
    );
  } else {
    app.log.error('Live gate is OPEN. Ensure licensed partner integration and approvals are in place.');
  }

  dispatcher.start(1_000);

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.port, host: config.host });
}

main().catch((err) => {
  console.error('fatal: failed to start BaturPay API');
  console.error(err);
  process.exit(1);
});
