import { describe, it, expect } from "vitest";
import { extractSubscriptionClientSecret } from "./subscription";

describe("extractSubscriptionClientSecret", () => {
  it("reads the modern confirmation_secret.client_secret", () => {
    const sub = {
      id: "sub_1",
      latest_invoice: { confirmation_secret: { client_secret: "pi_abc_secret_1" } },
    };
    expect(extractSubscriptionClientSecret(sub)).toBe("pi_abc_secret_1");
  });

  it("falls back to a nested payment_intent.client_secret", () => {
    const sub = {
      latest_invoice: { payment_intent: { client_secret: "pi_legacy_secret" } },
    };
    expect(extractSubscriptionClientSecret(sub)).toBe("pi_legacy_secret");
  });

  it("throws when latest_invoice was not expanded (string id)", () => {
    expect(() => extractSubscriptionClientSecret({ latest_invoice: "in_123" })).toThrow(/expanded/);
  });

  it("throws when no client secret is present", () => {
    expect(() => extractSubscriptionClientSecret({ latest_invoice: {} })).toThrow(/client secret/);
    expect(() => extractSubscriptionClientSecret({})).toThrow();
  });
});
