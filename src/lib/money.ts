/**
 * Money is always integer minor units (e.g. cents). Never floats.
 * See docs/STANDARDS.md → Domain: "Money is integer minor units; respect
 * zero-decimal currencies; never floats."
 */

// Currencies treated as having no minor unit (amount == major unit).
// The base list is Stripe's zero-decimal set (https://docs.stripe.com/currencies#zero-decimal).
// `idr` is added for Xendit: it expects whole-rupiah integer amounts (no sen),
// so we treat Rp as having no minor unit here — we only use IDR for Xendit.
const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "idr", "jpy", "kmf", "krw", "mga",
  "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export function isZeroDecimalCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase());
}

/** Throws unless `value` is a non-negative integer (a valid minor-unit amount). */
export function assertMinorUnits(value: number, label = "amount"): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${label}: expected a non-negative integer minor-unit amount, got ${value}`);
  }
  return value;
}

/**
 * Format an integer minor-unit amount for display, e.g. (4900, "usd") → "$49.00".
 * Uses Intl so locale/currency symbol and zero-decimal handling are correct.
 */
export function formatAmount(
  minorUnits: number,
  currency: string,
  locale = "en-US",
): string {
  assertMinorUnits(minorUnits);
  const fractionDigits = isZeroDecimalCurrency(currency) ? 0 : 2;
  const major = isZeroDecimalCurrency(currency)
    ? minorUnits
    : minorUnits / 10 ** fractionDigits;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(major);
}
