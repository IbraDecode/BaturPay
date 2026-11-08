/**
 * Modul: Simulator — Deterministic PRNG
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Seeded mulberry32 generator. Same seed => same sequence, so a chaotic-looking
 * scenario can be replayed byte-for-byte in CI or during incident review.
 */
import { sha256Hex } from '@baturpay/core';

export function seedToInt(seed: string): number {
  return parseInt(sha256Hex(seed).slice(0, 8), 16) >>> 0;
}

export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** true with probability p */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: string): Rng {
  let state = seedToInt(seed);
  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chance: (p) => next() < p,
    pick: <T,>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('cannot pick from an empty list');
      return items[Math.floor(next() * items.length)]!;
    },
  };
}
