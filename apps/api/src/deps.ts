/**
 * Modul: API — Dependency container
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import type { AppConfig } from '@baturpay/config';
import type { Store } from './store/types.js';
import type { WebhookDispatcher } from './workers/webhook-dispatcher.js';

export interface AppDeps {
  config: AppConfig;
  store: Store;
  dispatcher: WebhookDispatcher;
  startedAt: number;
}
