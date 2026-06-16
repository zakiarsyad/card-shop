/**
 * Xendit webhook verification + fulfillment routing. Pure and tested.
 *
 * Verification: Xendit sends a static token in the `x-callback-token` header
 * (set in the dashboard). We compare it to our stored token — that's the whole
 * authenticity check (no per-message signature, unlike Stripe). See
 * https://docs.xendit.co/docs/handling-webhooks.
 *
 * Routing: for the one-time PAY flow, a successful `payment.capture` is the
 * source of truth for fulfillment (ADR-0002). There's no second event to
 * double-count (no Stripe-style invoice/intent split), so the rule is simple.
 */

export interface XenditWebhookEvent {
  event?: string;
  data?: {
    payment_id?: string;
    status?: string;
    reference_id?: string;
  };
}

/** True only when both tokens are present and equal. */
export function verifyCallbackToken(received: string | null | undefined, expected: string | undefined): boolean {
  return Boolean(expected) && Boolean(received) && received === expected;
}

export interface XenditFulfillment {
  effect: "grant";
  ref: string;
  description: string;
}

/** Decide fulfillment for an event; null means "nothing to fulfill". */
export function decideFulfillment(evt: XenditWebhookEvent): XenditFulfillment | null {
  if (evt.event === "payment.capture" && evt.data?.status === "SUCCEEDED") {
    return {
      effect: "grant",
      ref: evt.data.reference_id ?? evt.data.payment_id ?? "unknown",
      description: "one-time purchase paid",
    };
  }
  return null;
}
