/**
 * Build the Xendit Payment Session request for the Components flow. Pure and
 * tested: amount/currency come from the server-side catalog (ADR-0004) — the
 * client sends only a plan key. Verified against
 * https://docs.xendit.co/apidocs/create-session.
 *
 * One product, two ways — like the Stripe demo, the difference is server-side:
 *  - one-time → session_type "PAY"
 *  - subscription → session_type "SUBSCRIPTION" with a monthly schedule
 */
import { priceFor, type Plan } from "../catalog";

export interface SessionRequestOptions {
  /** Unique merchant reference for this attempt (we reuse the idempotency token). */
  referenceId: string;
  /** Site origin — for the Components CORS allow-list. Xendit requires HTTPS here. */
  origin: string;
  /** ISO country; Xendit requires one of ID/PH/VN/TH/SG/MY. Defaults to ID. */
  country?: string;
  /** ISO datetime a subscription is anchored to (when billing starts). */
  anchorDate?: string;
}

interface BaseRequest {
  reference_id: string;
  mode: "COMPONENTS";
  amount: number;
  currency: string;
  country: string;
  components_configuration: { origins: string[] };
  metadata: { plan: string };
}
export interface XenditPaySession extends BaseRequest {
  session_type: "PAY";
}
export interface XenditCustomer {
  type: "INDIVIDUAL";
  reference_id: string;
  individual_detail: { given_names: string };
}
export interface XenditSubscriptionSession extends BaseRequest {
  session_type: "SUBSCRIPTION";
  // Subscriptions bill a customer recurringly, so Xendit requires one. In a real
  // app this is the logged-in user; here it's a demo placeholder.
  customer: XenditCustomer;
  subscription: { schedule: { anchor_date: string; interval: "MONTH"; interval_count: number } };
}
export type XenditSessionRequest = XenditPaySession | XenditSubscriptionSession;

export function buildSessionRequest(plan: Plan, opts: SessionRequestOptions): XenditSessionRequest {
  const { amount, currency } = priceFor(plan, "xendit");
  const base: BaseRequest = {
    reference_id: opts.referenceId,
    mode: "COMPONENTS",
    amount, // per-cycle amount for subscriptions
    currency: currency.toUpperCase(),
    country: opts.country ?? "ID",
    components_configuration: { origins: [opts.origin] },
    metadata: { plan: plan.key },
  };

  if (plan.mode === "subscription") {
    return {
      ...base,
      session_type: "SUBSCRIPTION",
      customer: {
        type: "INDIVIDUAL",
        reference_id: `cust-${opts.referenceId}`,
        individual_detail: { given_names: "Demo Customer" },
      },
      subscription: {
        schedule: { anchor_date: opts.anchorDate ?? "", interval: "MONTH", interval_count: 1 },
      },
    };
  }
  return { ...base, session_type: "PAY" };
}
