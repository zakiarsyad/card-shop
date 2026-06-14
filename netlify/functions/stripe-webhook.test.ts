import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "@netlify/functions";
import Stripe from "stripe";
import handler from "./stripe-webhook";

const ctx = {} as Context;
const SECRET = "whsec_test_secret";
const signer = new Stripe("sk_test_dummy");

// Build a request with a genuine Stripe signature (local HMAC, no network).
function signed(event: unknown): Request {
  const payload = JSON.stringify(event);
  const sig = signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return new Request("http://x/stripe-webhook", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": sig },
  });
}

const event = (id: string, type: string, object: Record<string, unknown> = { id: "pi_1" }) => ({
  id,
  type,
  data: { object },
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
});

describe("stripe-webhook handler", () => {
  it("rejects non-POST with 405", async () => {
    expect((await handler(new Request("http://x", { method: "GET" }), ctx)).status).toBe(405);
  });

  it("rejects a request with no signature header (400)", async () => {
    const req = new Request("http://x", { method: "POST", body: "{}" });
    const res = await handler(req, ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_signature");
  });

  it("rejects a tampered/invalid signature (400)", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify(event("evt_bad", "payment_intent.succeeded")),
      headers: { "stripe-signature": "t=1,v1=deadbeef" },
    });
    expect((await handler(req, ctx)).status).toBe(400);
  });

  it("processes a verified handled event once, and treats a replay as a no-op", async () => {
    const evt = event("evt_dup", "payment_intent.succeeded");
    const first = await handler(signed(evt), ctx);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ received: true, handled: true, duplicate: false });

    const replay = await handler(signed(evt), ctx);
    expect(await replay.json()).toEqual({ received: true, handled: true, duplicate: true });
  });

  it("acknowledges but ignores an unhandled event type", async () => {
    const res = await handler(signed(event("evt_ignore", "charge.refunded")), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true, handled: false });
  });
});
