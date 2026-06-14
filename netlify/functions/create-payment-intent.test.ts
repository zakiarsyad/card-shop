import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "@netlify/functions";

// Mock the Stripe client so the handler runs without network.
vi.mock("./_shared/stripe", () => ({ getStripe: vi.fn() }));
import { getStripe } from "./_shared/stripe";
import handler from "./create-payment-intent";

const ctx = {} as Context;
const post = (body: unknown) =>
  new Request("http://x/create-payment-intent", { method: "POST", body: JSON.stringify(body) });

let create: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  create = vi.fn().mockResolvedValue({ id: "pi_123", status: "requires_payment_method", client_secret: "pi_123_secret_abc" });
  (getStripe as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ paymentIntents: { create } });
});

// Request validation (plan/mode/idempotency) is covered by _shared/checkout.test.ts.
// These tests cover only what's specific to this handler.
describe("create-payment-intent handler", () => {
  it("rejects non-POST with 405", async () => {
    expect((await handler(new Request("http://x", { method: "GET" }), ctx)).status).toBe(405);
  });

  it("creates an intent with the catalog amount + an idempotency key, and returns the client secret", async () => {
    const res = await handler(post({ plan: "one_time" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientSecret: "pi_123_secret_abc", amount: 4900, currency: "usd", plan: "one_time" });
    // amount comes from the catalog (not the body), with an idempotency key attached
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 4900, currency: "usd" }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
  });

  it("maps a Stripe failure to a 502 without leaking internals", async () => {
    create.mockRejectedValueOnce(new Error("stripe boom"));
    const res = await handler(post({ plan: "one_time" }), ctx);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.code).toBe("stripe_error");
    expect(JSON.stringify(body)).not.toContain("boom");
  });
});
