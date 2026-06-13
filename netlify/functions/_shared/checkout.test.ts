import { describe, it, expect } from "vitest";
import { parseCheckoutRequest, resolveIdempotencyKey } from "./checkout";

const post = (body: unknown) =>
  new Request("http://localhost/fn", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("parseCheckoutRequest", () => {
  it("parses a valid one-time request", async () => {
    const r = await parseCheckoutRequest(post({ plan: "one_time" }), "payment");
    expect(r).not.toBeInstanceOf(Response);
    if (r instanceof Response) return;
    expect(r.plan.key).toBe("one_time");
    expect(r.idempotencyKey.length).toBeGreaterThanOrEqual(8);
  });

  it("preserves a client idempotency token and carries email", async () => {
    const r = await parseCheckoutRequest(
      post({ plan: "subscription", idempotencyKey: "client-token-123", email: "a@b.com" }),
      "subscription",
    );
    if (r instanceof Response) throw new Error("expected parsed request");
    expect(r.idempotencyKey).toBe("client-token-123");
    expect(r.email).toBe("a@b.com");
  });

  it("rejects a non-JSON body with 400 invalid_body", async () => {
    const r = await parseCheckoutRequest(post("not json"), "payment");
    expect(r).toBeInstanceOf(Response);
    if (!(r instanceof Response)) return;
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("invalid_body");
  });

  it("rejects an unknown plan with 400 unknown_plan", async () => {
    const r = (await parseCheckoutRequest(post({ plan: "free" }), "payment")) as Response;
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("unknown_plan");
  });

  it("rejects the wrong endpoint for the plan mode", async () => {
    const r = (await parseCheckoutRequest(post({ plan: "subscription" }), "payment")) as Response;
    expect(r.status).toBe(400);
    expect((await r.json()).error.code).toBe("wrong_endpoint");
  });
});

describe("resolveIdempotencyKey", () => {
  it("keeps a sufficiently long client token", () => {
    expect(resolveIdempotencyKey("abcd-efgh")).toBe("abcd-efgh");
  });
  it("mints a fresh key for missing or too-short tokens", () => {
    expect(resolveIdempotencyKey(undefined).length).toBeGreaterThanOrEqual(8);
    expect(resolveIdempotencyKey("short")).not.toBe("short");
  });
});
