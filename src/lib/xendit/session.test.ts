import { describe, it, expect } from "vitest";
import { buildSessionRequest } from "./session";
import { getPlan } from "../catalog";

describe("buildSessionRequest — one-time (PAY)", () => {
  const req = buildSessionRequest(getPlan("one_time"), {
    referenceId: "ref_123",
    origin: "https://checkout.example.com",
  });

  it("builds a COMPONENTS PAY session with the server-side IDR price", () => {
    expect(req.session_type).toBe("PAY");
    expect(req.mode).toBe("COMPONENTS");
    expect(req.amount).toBe(750000);
    expect(req.currency).toBe("IDR");
    expect(req.country).toBe("ID");
  });

  it("carries the reference, plan metadata, and the components CORS origin", () => {
    expect(req.reference_id).toBe("ref_123");
    expect(req.metadata.plan).toBe("one_time");
    expect(req.components_configuration.origins).toEqual(["https://checkout.example.com"]);
  });
});

describe("buildSessionRequest — subscription (SUBSCRIPTION)", () => {
  const req = buildSessionRequest(getPlan("subscription"), {
    referenceId: "ref_sub",
    origin: "https://checkout.example.com",
    anchorDate: "2026-06-16T00:00:00.000Z",
  });

  it("builds a monthly SUBSCRIPTION session with the per-cycle IDR amount", () => {
    expect(req.session_type).toBe("SUBSCRIPTION");
    expect(req.amount).toBe(149000);
    expect(req.currency).toBe("IDR");
    if (req.session_type === "SUBSCRIPTION") {
      expect(req.subscription.schedule).toEqual({
        anchor_date: "2026-06-16T00:00:00.000Z",
        interval: "MONTH",
        interval_count: 1,
      });
      // Xendit requires a customer for subscriptions.
      expect(req.customer.type).toBe("INDIVIDUAL");
      expect(req.customer.reference_id).toBe("cust-ref_sub");
    }
  });
});
