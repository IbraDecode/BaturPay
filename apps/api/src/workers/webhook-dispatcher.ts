/**
 * Modul: API — Webhook dispatcher worker
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * At-least-once delivery with bounded retries and HMAC signatures. The HTTP
 * client is injectable so the whole retry/backoff path is unit-testable without
 * a network. This is the machinery a real integration must survive.
 */
import { SIGNATURE_HEADER, signPayload, isRetryableStatus, retryDelayMs, shouldRetry, DEFAULT_RETRY_POLICY } from '@baturpay/webhook';
import { createRng } from '@baturpay/simulator';
import type { AppConfig } from '@baturpay/config';
import type { Store } from '../store/types.js';

export interface DispatcherOptions {
  fetcher?: typeof fetch;
  now?: () => Date;
  batchSize?: number;
  timeoutMs?: number;
  retryPolicy?: typeof DEFAULT_RETRY_POLICY;
}

export interface TickResult {
  processed: number;
  delivered: number;
  retried: number;
  failed: number;
}

export class WebhookDispatcher {
  private timer: NodeJS.Timeout | null = null;
  private readonly fetcher: typeof fetch;
  private readonly now: () => Date;
  private readonly batchSize: number;
  private readonly timeoutMs: number;
  private readonly retryPolicy: typeof DEFAULT_RETRY_POLICY;

  constructor(
    private readonly store: Store,
    private readonly config: AppConfig,
    options: DispatcherOptions = {},
  ) {
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.batchSize = options.batchSize ?? 50;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.retryPolicy = options.retryPolicy ?? { ...DEFAULT_RETRY_POLICY, maxAttempts: config.webhook.maxAttempts };
  }

  async tick(): Promise<TickResult> {
    const now = this.now();
    const due = await this.store.dueDeliveries(now.toISOString(), this.batchSize);
    const result: TickResult = { processed: 0, delivered: 0, retried: 0, failed: 0 };

    for (const delivery of due) {
      result.processed += 1;
      const endpoint = await this.store.getWebhookEndpoint(delivery.workspaceId, delivery.endpointId);
      if (!endpoint || endpoint.status !== 'ACTIVE') {
        await this.store.updateDelivery(delivery.id, {
          status: 'FAILED',
          error: 'Endpoint missing or disabled',
          lastAttemptAt: now.toISOString(),
        });
        result.failed += 1;
        continue;
      }

      const attempt = delivery.attempts + 1;
      const body = JSON.stringify(delivery.payload);
      const signed = signPayload(endpoint.signingSecret, body, Math.floor(now.getTime() / 1000));

      let status: number | null = null;
      let errorText: string | null = null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          const response = await this.fetcher(endpoint.url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              [SIGNATURE_HEADER]: signed.header,
              'x-baturpay-event-id': delivery.eventId,
              'user-agent': 'BaturPay-Webhook/1.0 (+sandbox)',
            },
            body,
            signal: controller.signal,
          });
          status = response.status;
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        errorText = err instanceof Error ? err.message : String(err);
      }

      const success = status !== null && status >= 200 && status < 300;
      const at = now.toISOString();

      if (success) {
        await this.store.updateDelivery(delivery.id, {
          status: 'DELIVERED',
          attempts: attempt,
          lastAttemptAt: at,
          responseStatus: status,
          error: null,
        });
        result.delivered += 1;
        continue;
      }

      const retryable = isRetryableStatus(status);
      if (retryable && shouldRetry(attempt, this.retryPolicy)) {
        const jitterUnit = createRng(`${delivery.id}:${attempt}`).next();
        const delay = retryDelayMs(attempt + 1, this.retryPolicy, jitterUnit);
        await this.store.updateDelivery(delivery.id, {
          status: 'PENDING',
          attempts: attempt,
          lastAttemptAt: at,
          responseStatus: status,
          error: errorText ?? `HTTP ${status}`,
          scheduledAt: new Date(now.getTime() + delay).toISOString(),
        });
        result.retried += 1;
        continue;
      }

      await this.store.updateDelivery(delivery.id, {
        status: 'FAILED',
        attempts: attempt,
        lastAttemptAt: at,
        responseStatus: status,
        error: errorText ?? `HTTP ${status}`,
      });
      result.failed += 1;
    }

    return result;
  }

  start(intervalMs = 1_000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick().catch(() => {
        /* errors are recorded per-delivery; the loop must not die */
      });
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
