/**
 * Modul: Webhook — Event deduplication
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Because delivery is at-least-once, the same eventId can arrive more than once.
 * We keep a bounded, time-windowed set so a flapping endpoint cannot grow memory
 * without bound. Real deployments back this with Redis/Postgres.
 */
export interface DedupStore {
  /** Returns true if this key was already seen (i.e. a duplicate). */
  seen(key: string): boolean;
  mark(key: string): void;
  size(): number;
}

export interface InMemoryDedupOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export class InMemoryDedupStore implements DedupStore {
  private readonly entries = new Map<string, number>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: InMemoryDedupOptions = {}) {
    this.ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
    this.maxEntries = options.maxEntries ?? 100_000;
    this.now = options.now ?? (() => Date.now());
  }

  private evictExpired(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [key, at] of this.entries) {
      if (at < cutoff) this.entries.delete(key);
    }
  }

  seen(key: string): boolean {
    this.evictExpired();
    const at = this.entries.get(key);
    if (at === undefined) return false;
    return at >= this.now() - this.ttlMs;
  }

  mark(key: string): void {
    this.evictExpired();
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, this.now());
  }

  size(): number {
    return this.entries.size;
  }
}

/** Composite key for a webhook delivery attempt: should an event be consumed once? */
export function deliveryDedupKey(workspaceId: string, eventId: string): string {
  return `wh:${workspaceId}:${eventId}`;
}
