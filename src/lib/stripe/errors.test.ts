import { describe, it, expect } from "vitest";
import { mapStripeError } from "./errors";

describe("mapStripeError", () => {
  it("maps a generic decline with the decline_code message", () => {
    const e = mapStripeError({ type: "card_error", code: "card_declined", decline_code: "insufficient_funds" });
    expect(e.kind).toBe("card_declined");
    expect(e.message).toMatch(/insufficient funds/i);
    expect(e.retryable).toBe(true);
  });

  it("falls back to a generic decline message for unknown decline_code", () => {
    const e = mapStripeError({ type: "card_error", code: "card_declined", decline_code: "generic_decline" });
    expect(e.kind).toBe("card_declined");
    expect(e.message).toMatch(/declined/i);
  });

  it("treats bad card details as incorrect_details", () => {
    expect(mapStripeError({ type: "card_error", code: "incorrect_cvc" }).kind).toBe("incorrect_details");
    expect(mapStripeError({ type: "card_error", code: "expired_card" }).kind).toBe("incorrect_details");
  });

  it("recognizes authentication_required", () => {
    const e = mapStripeError({ type: "card_error", code: "authentication_required" });
    expect(e.kind).toBe("authentication_required");
  });

  it("treats canceled/failed 3-D Secure as an auth failure, not a config error", () => {
    // Stripe sends this with type invalid_request_error — must NOT become "config".
    const e = mapStripeError({ type: "invalid_request_error", code: "payment_intent_authentication_failure" });
    expect(e.kind).toBe("authentication_required");
    expect(e.kind).not.toBe("config");
    expect(e.title).toMatch(/authentication failed/i);
    expect(e.retryable).toBe(true);
  });

  it("maps validation errors", () => {
    expect(mapStripeError({ type: "validation_error" }).kind).toBe("incorrect_details");
  });

  it("maps network and rate-limit errors as retryable", () => {
    expect(mapStripeError({ type: "api_connection_error" }).kind).toBe("network");
    expect(mapStripeError({ type: "rate_limit_error" }).kind).toBe("rate_limited");
  });

  it("maps our own misconfiguration as non-retryable config error", () => {
    const e = mapStripeError({ type: "invalid_request_error" });
    expect(e.kind).toBe("config");
    expect(e.retryable).toBe(false);
  });

  it("never returns an empty message, even for null", () => {
    const e = mapStripeError(null);
    expect(e.kind).toBe("unknown");
    expect(e.message.length).toBeGreaterThan(0);
  });
});
