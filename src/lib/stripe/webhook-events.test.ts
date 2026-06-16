import { describe, it, expect } from "vitest";
import { isHandledEvent, decideFulfillment } from "./webhook-events";

const evt = (type: string, object: Record<string, unknown> = { id: "obj_1" }) => ({
  type,
  data: { object },
});

describe("isHandledEvent", () => {
  it("recognizes the events we care about", () => {
    expect(isHandledEvent("payment_intent.succeeded")).toBe(true);
    expect(isHandledEvent("invoice.paid")).toBe(true);
    expect(isHandledEvent("customer.subscription.deleted")).toBe(true);
  });
  it("ignores everything else", () => {
    expect(isHandledEvent("charge.refunded")).toBe(false);
    expect(isHandledEvent("payout.paid")).toBe(false);
  });
});

describe("decideFulfillment", () => {
  const oneTime = { id: "pi_1", metadata: { plan: "one_time" } };

  it("grants a one-time payment, but defers a subscription's first charge to invoice.paid", () => {
    // one-time PI (tagged) → grant
    expect(decideFulfillment(evt("payment_intent.succeeded", oneTime))?.effect).toBe("grant");
    // subscription's first-charge PI (untagged) → noop, avoiding double-fulfillment
    expect(decideFulfillment(evt("payment_intent.succeeded", { id: "pi_2" }))?.effect).toBe("noop");
    // the subscription is fulfilled here instead
    expect(decideFulfillment(evt("invoice.paid"))?.effect).toBe("grant");
  });

  it("flags a one-time failure, but defers a subscription PI failure to invoice.payment_failed", () => {
    expect(decideFulfillment(evt("payment_intent.payment_failed", oneTime))?.effect).toBe("notify_failure");
    expect(decideFulfillment(evt("payment_intent.payment_failed", { id: "pi_2" }))?.effect).toBe("noop");
    expect(decideFulfillment(evt("invoice.payment_failed"))?.effect).toBe("notify_failure");
  });

  it("revokes on cancellation", () => {
    expect(decideFulfillment(evt("customer.subscription.deleted"))?.effect).toBe("revoke");
  });

  it("derives subscription effect from status", () => {
    expect(decideFulfillment(evt("customer.subscription.updated", { id: "sub_1", status: "active" }))?.effect).toBe("grant");
    expect(decideFulfillment(evt("customer.subscription.updated", { id: "sub_1", status: "unpaid" }))?.effect).toBe("revoke");
    expect(decideFulfillment(evt("customer.subscription.updated", { id: "sub_1", status: "past_due" }))?.effect).toBe("noop");
  });

  it("carries the object ref for the audit line", () => {
    expect(decideFulfillment(evt("payment_intent.succeeded", { id: "pi_42" }))?.ref).toBe("pi_42");
  });

  it("returns null for unhandled events", () => {
    expect(decideFulfillment(evt("charge.refunded"))).toBeNull();
  });
});
