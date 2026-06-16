import { describe, it, expect } from "vitest";
import { extractSubscriptionClientSecret, subscriptionPeriodEnd } from "./subscription";

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

describe("subscriptionPeriodEnd", () => {
  it("reads current_period_end from the subscription item (current API)", () => {
    expect(subscriptionPeriodEnd({ items: { data: [{ current_period_end: 1234 }] } })).toBe(1234);
  });
  it("falls back to the subscription-level field (older API)", () => {
    expect(subscriptionPeriodEnd({ current_period_end: 5678 })).toBe(5678);
  });
  it("returns null when neither is present", () => {
    expect(subscriptionPeriodEnd({})).toBeNull();
  });
});
