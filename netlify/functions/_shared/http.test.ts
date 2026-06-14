import { describe, it, expect } from "vitest";
import { json, errorResponse, methodNotAllowed, readJson, correlationId } from "./http";

describe("json", () => {
  it("serializes data with a 200 status and JSON content-type", async () => {
    const res = json({ ok: true });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("honors a custom status", () => {
    expect(json({}, 201).status).toBe(201);
  });
});

describe("errorResponse", () => {
  it("shapes a { error: { code, message } } body", async () => {
    const res = errorResponse(400, "bad_thing", "Bad thing happened.");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: "bad_thing", message: "Bad thing happened." } });
  });
});

describe("methodNotAllowed", () => {
  it("returns 405 with an Allow header", () => {
    const res = methodNotAllowed();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
  });
});

describe("readJson", () => {
  const post = (body: string) => new Request("http://x", { method: "POST", body });

  it("parses a JSON body", async () => {
    expect(await readJson(post('{"a":1}'))).toEqual({ a: 1 });
  });

  it("returns {} for an empty body", async () => {
    expect(await readJson(new Request("http://x", { method: "POST" }))).toEqual({});
  });

  it("returns undefined on invalid JSON (caller decides how to respond)", async () => {
    expect(await readJson(post("not json"))).toBeUndefined();
  });
});

describe("correlationId", () => {
  it("returns a short non-empty id", () => {
    const id = correlationId();
    expect(id).toHaveLength(8);
    expect(correlationId()).not.toBe(id); // distinct per call
  });
});
