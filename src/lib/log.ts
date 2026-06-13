/**
 * Minimal structured logger for the payment lifecycle.
 * See docs/STANDARDS.md → Domain: "Structured, correlated logging of the
 * payment lifecycle — never log secrets or card data."
 *
 * Every line is JSON with a correlation id so a single checkout attempt can be
 * traced across functions. Keys that commonly carry secrets are redacted
 * defensively, so a careless `log.info("x", stripeObject)` can't leak a key.
 */

const REDACT_KEYS = new Set([
  "client_secret",
  "secret",
  "stripe_secret_key",
  "stripe_webhook_secret",
  "card",
  "number",
  "cvc",
  "authorization",
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

export type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
  child(fields: Record<string, unknown>): Logger;
  log(level: Level, msg: string, fields?: Record<string, unknown>): void;
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(base: Record<string, unknown> = {}): Logger {
  const emit = (level: Level, msg: string, fields: Record<string, unknown> = {}) => {
    const line = { level, msg, ...redact({ ...base, ...fields }) as object };
    (level === "error" ? console.error : console.log)(JSON.stringify(line));
  };
  return {
    child: (fields) => createLogger({ ...base, ...fields }),
    log: emit,
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
  };
}

/** Exposed for testing the redaction logic. */
export const _redact = redact;
