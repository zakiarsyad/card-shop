import { describe, it, expect } from "vitest";
import { getPlan, isPlanKey, priceIdFor, priceFor, PLANS } from "./catalog";

describe("getPlan", () => {
  it("resolves known plans with authoritative amounts", () => {
    expect(getPlan("one_time").amount).toBe(4900);
    expect(getPlan("one_time").mode).toBe("payment");
    expect(getPlan("subscription").amount).toBe(900);
    expect(getPlan("subscription").mode).toBe("subscription");
    expect(getPlan("subscription").interval).toBe("month");
  });

  it("rejects unknown / tampered keys (client cannot smuggle a plan)", () => {
    expect(() => getPlan("free")).toThrow();
    expect(() => getPlan("")).toThrow();
    expect(() => getPlan(undefined)).toThrow();
    expect(() => getPlan({ amount: 1 })).toThrow();
  });
});

describe("isPlanKey", () => {
  it("guards plan keys", () => {
    expect(isPlanKey("one_time")).toBe(true);
    expect(isPlanKey("subscription")).toBe(true);
    expect(isPlanKey("nope")).toBe(false);
    expect(isPlanKey(42)).toBe(false);
  });
});

describe("priceIdFor", () => {
  it("reads the right env var per plan", () => {
    const env = {
      PRICE_ONE_TIME: "price_one",
      PRICE_SUBSCRIPTION: "price_sub",
    };
    expect(priceIdFor("one_time", env)).toBe("price_one");
    expect(priceIdFor("subscription", env)).toBe("price_sub");
  });

  it("throws when the price id is missing", () => {
    expect(() => priceIdFor("one_time", {})).toThrow(/PRICE_ONE_TIME/);
  });
});

describe("priceFor", () => {
  it("returns the provider override, else falls back to the default price", () => {
    const oneTime = getPlan("one_time");
    expect(priceFor(oneTime, "stripe")).toEqual({ amount: 4900, currency: "usd" });
    expect(priceFor(oneTime, "xendit")).toEqual({ amount: 750000, currency: "idr" });
  });
});

describe("catalog integrity", () => {
  it("every amount (default + per-provider) is a non-negative integer (minor units)", () => {
    for (const plan of Object.values(PLANS)) {
      expect(Number.isInteger(plan.amount)).toBe(true);
      expect(plan.amount).toBeGreaterThanOrEqual(0);
      for (const price of Object.values(plan.prices ?? {})) {
        expect(Number.isInteger(price.amount)).toBe(true);
        expect(price.amount).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
