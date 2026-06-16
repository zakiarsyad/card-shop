/**
 * Pure helpers for the subscription flow. The Stripe call itself lives in the
 * function; the fiddly bit — pulling the first invoice's PaymentIntent client
 * secret out of the expanded subscription — is isolated here so it's testable
 * and resilient to the object shape.
 *
 * Current Stripe (basil API): create the subscription with
 *   payment_behavior: "default_incomplete"
 *   billing_mode: { type: "flexible" }
 *   expand: ["latest_invoice.confirmation_secret"]
 * then read `latest_invoice.confirmation_secret.client_secret`.
 * Verified against https://docs.stripe.com/billing/subscriptions/build-subscriptions
 */

// Minimal structural type — we only touch the fields we need.
export interface SubscriptionLike {
  id?: string;
  status?: string;
  // Current API exposes the period on subscription items; older API had it
  // on the subscription itself. We read items first, then fall back.
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }> };
  latest_invoice?:
    | string
    | null
    | {
        confirmation_secret?: { client_secret?: string | null } | null;
        // Fallback for older API shapes where the PI was nested directly.
        payment_intent?: string | { client_secret?: string | null } | null;
      };
}

/**
 * Extract the client secret used to confirm the subscription's first payment.
 * Prefers the modern `confirmation_secret`; falls back to a nested
 * `payment_intent.client_secret` for resilience. Throws if neither is present
 * (e.g. the invoice wasn't expanded, or the price was $0 with no payment due).
 */
export function extractSubscriptionClientSecret(sub: SubscriptionLike): string {
  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice === "string") {
    throw new Error("Subscription is missing an expanded latest_invoice");
  }

  const fromConfirmation = invoice.confirmation_secret?.client_secret;
  if (fromConfirmation) return fromConfirmation;

  const pi = invoice.payment_intent;
  if (pi && typeof pi === "object" && pi.client_secret) return pi.client_secret;

  throw new Error("No client secret on the subscription's first invoice");
}

/**
 * The end of the current billing period (Unix seconds) = the next charge date.
 * Reads the subscription item first (current API), falling back to the
 * subscription-level field (older API). Returns null if neither is present.
 */
export function subscriptionPeriodEnd(sub: SubscriptionLike): number | null {
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  if (typeof fromItem === "number") return fromItem;
  if (typeof sub.current_period_end === "number") return sub.current_period_end;
  return null;
}
