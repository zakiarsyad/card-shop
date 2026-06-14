import { describe, it, expect } from "vitest";
import { getStripe } from "./stripe";

describe("getStripe", () => {
  it("throws when the secret key is missing", () => {
    expect(() => getStripe({})).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("refuses live keys (this project is test-mode only)", () => {
    expect(() => getStripe({ STRIPE_SECRET_KEY: "sk_live_abc123" })).toThrow(/test mode only/i);
  });

  it("builds a client from a test key", () => {
    const stripe = getStripe({ STRIPE_SECRET_KEY: "sk_test_abc123" });
    // A real Stripe instance exposes the resources we use; no network at construction.
    expect(stripe.paymentIntents).toBeTruthy();
    expect(stripe.subscriptions).toBeTruthy();
    expect(stripe.webhooks).toBeTruthy();
  });
});
