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
