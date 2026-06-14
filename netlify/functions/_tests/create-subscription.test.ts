import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "@netlify/functions";

vi.mock("../_shared/stripe", () => ({ getStripe: vi.fn() }));
import { getStripe } from "../_shared/stripe";
import handler from "../create-subscription";

const ctx = {} as Context;
const post = (body: unknown) =>
  new Request("http://x/create-subscription", { method: "POST", body: JSON.stringify(body) });

let customersCreate: ReturnType<typeof vi.fn>;
let subscriptionsCreate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("PRICE_SUBSCRIPTION", "price_sub_123");
  customersCreate = vi.fn().mockResolvedValue({ id: "cus_123" });
  subscriptionsCreate = vi.fn().mockResolvedValue({
    id: "sub_123",
    status: "incomplete",
    latest_invoice: { confirmation_secret: { client_secret: "pi_sub_secret_abc" } },
  });
  (getStripe as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    customers: { create: customersCreate },
    subscriptions: { create: subscriptionsCreate },
  });
});

// Request validation is covered by _shared/checkout.test.ts; secret extraction by
// subscription.test.ts. These cover only this handler's Stripe orchestration.
describe("create-subscription handler", () => {
  it("rejects non-POST with 405", async () => {
    expect((await handler(new Request("http://x", { method: "GET" }), ctx)).status).toBe(405);
  });

  it("creates customer + incomplete subscription and returns the first-invoice secret", async () => {
    const res = await handler(post({ plan: "subscription", idempotencyKey: "tok-12345678" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      clientSecret: "pi_sub_secret_abc",
      amount: 900,
      currency: "usd",
      plan: "subscription",
      subscriptionId: "sub_123",
    });
    expect(subscriptionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_123", items: [{ price: "price_sub_123" }], payment_behavior: "default_incomplete" }),
      { idempotencyKey: "tok-12345678" },
    );
    // customer create uses a distinct, derived idempotency key
    expect(customersCreate).toHaveBeenCalledWith(expect.anything(), { idempotencyKey: "tok-12345678:customer" });
  });

  it("maps a Stripe failure to a 502", async () => {
    subscriptionsCreate.mockRejectedValueOnce(new Error("stripe boom"));
    const res = await handler(post({ plan: "subscription" }), ctx);
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("stripe_error");
  });
});
