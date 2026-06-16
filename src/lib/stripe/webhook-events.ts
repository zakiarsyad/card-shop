/**
 * Webhook event routing. Maps Stripe event types to the fulfillment action we
 * would take. Pure and framework-free so routing is unit-testable; the actual
 * side effect (logging / "fulfillment") happens in the function.
 *
 * Fulfillment is the webhook's job, never the redirect (ADR-0002). In this demo
 * "fulfillment" is logged/stubbed — see the README production notes for what a
 * real system would do (ledger, entitlement grant, receipt, dunning).
 */

export const HANDLED_EVENTS = new Set<string>([
  // One-time + subscription first/again charges.
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  // Subscription invoice lifecycle.
  "invoice.paid",
  "invoice.payment_failed",
  // Subscription state.
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export function isHandledEvent(type: string): boolean {
  return HANDLED_EVENTS.has(type);
}

export type FulfillmentEffect = "grant" | "revoke" | "notify_failure" | "noop";

export interface FulfillmentAction {
  effect: FulfillmentEffect;
  /** Human-readable description for the log/audit line. */
  description: string;
  /** The Stripe object id the action concerns (pi_…, in_…, sub_…). */
  ref: string;
}

interface EventLike {
  type: string;
  data: { object: Record<string, unknown> };
}

/**
 * Decide what a handled event means for fulfillment. Returns null for events
 * we don't act on. Keeping this pure means the "what should happen" decision is
 * tested without touching Stripe or side effects.
 */
export function decideFulfillment(event: EventLike): FulfillmentAction | null {
  const obj = event.data.object ?? {};
  const ref = typeof obj.id === "string" ? obj.id : "unknown";

  switch (event.type) {
    // A subscription's first charge fires payment_intent.* AND invoice.*. To
    // avoid double-fulfillment, subscriptions are owned by the invoice events;
    // here we act only on one-time payments (tagged metadata.plan=one_time).
    case "payment_intent.succeeded":
      return isOneTimePayment(obj)
        ? { effect: "grant", description: "Grant access for completed one-time payment", ref }
        : { effect: "noop", description: "Subscription charge — fulfilled via invoice.paid", ref };
    case "payment_intent.payment_failed":
      return isOneTimePayment(obj)
        ? { effect: "notify_failure", description: "Flag failed one-time payment", ref }
        : { effect: "noop", description: "Subscription charge failed — handled via invoice.payment_failed", ref };
    case "invoice.paid":
      return { effect: "grant", description: "Grant/renew access for paid invoice", ref };
    case "invoice.payment_failed":
      return { effect: "notify_failure", description: "Flag failed invoice (dunning candidate)", ref };
    case "customer.subscription.deleted":
      return { effect: "revoke", description: "Revoke access for canceled subscription", ref };
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const status = typeof obj.status === "string" ? obj.status : "";
      if (status === "active" || status === "trialing") {
        return { effect: "grant", description: `Ensure access for ${status} subscription`, ref };
      }
      if (status === "canceled" || status === "unpaid") {
        return { effect: "revoke", description: `Revoke access for ${status} subscription`, ref };
      }
      return { effect: "noop", description: `Subscription is ${status || "in a transient state"}`, ref };
    }
    default:
      return null;
  }
}

/** One-time PaymentIntents are tagged with metadata.plan = "one_time". */
function isOneTimePayment(obj: Record<string, unknown>): boolean {
  const meta = obj.metadata;
  return typeof meta === "object" && meta !== null && (meta as Record<string, unknown>).plan === "one_time";
}
