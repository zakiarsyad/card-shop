import { describe, it, expect } from "vitest";
import { verifyCallbackToken, decideFulfillment } from "./webhook";

describe("verifyCallbackToken", () => {
  it("accepts only a present, exactly-matching token", () => {
    expect(verifyCallbackToken("abc", "abc")).toBe(true);
    expect(verifyCallbackToken("abc", "xyz")).toBe(false);
    expect(verifyCallbackToken("", "abc")).toBe(false);
    expect(verifyCallbackToken(null, "abc")).toBe(false);
    expect(verifyCallbackToken("abc", undefined)).toBe(false);
    expect(verifyCallbackToken(undefined, undefined)).toBe(false);
  });
});

describe("decideFulfillment", () => {
  it("grants on a succeeded payment.capture, keyed by reference_id", () => {
    const action = decideFulfillment({
      event: "payment.capture",
      data: { payment_id: "pm-1", status: "SUCCEEDED", reference_id: "ref-9" },
    });
    expect(action).toEqual({ effect: "grant", ref: "ref-9", description: "one-time purchase paid" });
  });

  it("does not fulfill on failures or non-succeeded captures", () => {
    expect(decideFulfillment({ event: "payment.failure", data: { status: "FAILED" } })).toBeNull();
    expect(decideFulfillment({ event: "payment.capture", data: { status: "PENDING" } })).toBeNull();
  });
});
