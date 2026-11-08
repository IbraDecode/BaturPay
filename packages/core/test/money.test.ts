/**
 * Modul: Core tests — money
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 */
import { describe, expect, it } from 'vitest';
import {
  addMoney,
  compareMoney,
  currencyExponent,
  formatMoney,
  money,
  positiveMoney,
  toMinorUnits,
} from '../src/money.js';

describe('money', () => {
  it('creates integer minor-unit money', () => {
    expect(money(50_000, 'IDR')).toEqual({ amountMinor: 50_000, currency: 'IDR' });
  });

  it('rejects non-integer and unsafe amounts', () => {
    expect(() => money(1.5, 'IDR')).toThrow(/safe integer/);
    expect(() => money(Number.MAX_SAFE_INTEGER + 2, 'IDR')).toThrow(/safe integer/);
  });

  it('rejects zero or negative invoice amounts', () => {
    expect(() => positiveMoney(0, 'IDR')).toThrow(/greater than zero/);
    expect(() => positiveMoney(-10, 'IDR')).toThrow(/greater than zero/);
  });

  it('normalizes currency case', () => {
    expect(money(100, 'idr').currency).toBe('IDR');
  });

  it('adds and compares only within one currency', () => {
    expect(addMoney(money(100, 'IDR'), money(250, 'IDR')).amountMinor).toBe(350);
    expect(() => addMoney(money(100, 'IDR'), money(100, 'USD'))).toThrow(/currency mismatch/);
    expect(compareMoney(money(1, 'IDR'), money(2, 'IDR'))).toBe(-1);
  });

  it('formats IDR without decimals and USD with two', () => {
    expect(currencyExponent('IDR')).toBe(0);
    expect(formatMoney(money(50_000, 'IDR'))).toBe('IDR 50,000');
    expect(formatMoney(money(1234, 'USD'))).toBe('USD 12.34');
  });

  it('converts decimal major amounts to minor units safely', () => {
    expect(toMinorUnits(50_000, 'IDR')).toBe(50_000);
    expect(toMinorUnits(12.34, 'USD')).toBe(1234);
    expect(toMinorUnits(12.345, 'USD')).toBe(1235);
  });
});
