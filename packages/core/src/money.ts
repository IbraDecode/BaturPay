/**
 * Modul: Core — Money
 * Powered by Ibra X 3.1 Sovereign Execution Engine
 * Author: Ibra Ramdan <ibradecode@gmail.com>
 *
 * Money is always represented as an integer count of minor units plus an
 * explicit currency. Floating point is never used for amounts. This avoids the
 * classic rounding bugs that cause reconciliation discrepancies.
 */
import { errors } from './errors.js';

export type CurrencyCode = 'IDR' | 'USD' | string;

export interface Money {
  /** Integer amount in the currency's minor unit (e.g. cents, or rupiah for IDR). */
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

/** ISO-4217 minor unit exponents we care about. Default is 2. */
const MINOR_UNIT_EXPONENT: Record<string, number> = {
  IDR: 0,
  JPY: 0,
  KRW: 0,
  VND: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  SGD: 2,
  MYR: 2,
  AUD: 2,
};

export function currencyExponent(currency: string): number {
  return MINOR_UNIT_EXPONENT[currency.toUpperCase()] ?? 2;
}

export function normalizeCurrency(currency: string): CurrencyCode {
  return currency.toUpperCase();
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw errors.validation('amountMinor must be a safe integer', { amountMinor });
  }
  if (currency.trim().length < 3) {
    throw errors.validation('currency must be an ISO-4217 code', { currency });
  }
  return { amountMinor, currency: normalizeCurrency(currency) };
}

/** Positive, non-zero amount — used for invoices. */
export function positiveMoney(amountMinor: number, currency: CurrencyCode): Money {
  const value = money(amountMinor, currency);
  if (value.amountMinor <= 0) {
    throw errors.validation('amount must be greater than zero', { amountMinor });
  }
  return value;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw errors.validation('currency mismatch', { left: a.currency, right: b.currency });
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function isZero(a: Money): boolean {
  return a.amountMinor === 0;
}

export function equalsMoney(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.amountMinor < b.amountMinor) return -1;
  if (a.amountMinor > b.amountMinor) return 1;
  return 0;
}

/** Human-readable string. IDR renders without decimals; others use their exponent. */
export function formatMoney(value: Money): string {
  const exp = currencyExponent(value.currency);
  if (exp === 0) {
    return `${value.currency} ${value.amountMinor.toLocaleString('en-US')}`;
  }
  const major = value.amountMinor / 10 ** exp;
  return `${value.currency} ${major.toFixed(exp)}`;
}

/** Convert a safe decimal-major amount (e.g. 50.00) into minor units. */
export function toMinorUnits(majorAmount: number, currency: string): number {
  if (!Number.isFinite(majorAmount)) {
    throw errors.validation('amount must be a finite number', { majorAmount });
  }
  const exp = currencyExponent(currency);
  const scaled = Math.round(majorAmount * 10 ** exp);
  if (!Number.isSafeInteger(scaled)) {
    throw errors.validation('amount out of safe integer range', { majorAmount, currency });
  }
  return scaled;
}
