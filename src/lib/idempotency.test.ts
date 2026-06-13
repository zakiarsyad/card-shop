import { describe, it, expect, vi } from "vitest";
import { createMemoryStore, processOnce } from "./idempotency";

describe("processOnce", () => {
  it("runs the handler the first time", async () => {
    const store = createMemoryStore();
    const fn = vi.fn();
    const r = await processOnce(store, "evt_1", fn);
    expect(r.processed).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("is a no-op on replay of the same event id", async () => {
    const store = createMemoryStore();
    const fn = vi.fn();
    await processOnce(store, "evt_1", fn);
    const r = await processOnce(store, "evt_1", fn);
    expect(r.processed).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1); // not called again
  });

  it("does not remember the id if the handler throws (so Stripe can retry)", async () => {
    const store = createMemoryStore();
    const fn = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    await expect(processOnce(store, "evt_1", fn)).rejects.toThrow("boom");
    expect(store.seen("evt_1")).toBe(false);
    const r = await processOnce(store, "evt_1", fn);
    expect(r.processed).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("tracks distinct ids independently", async () => {
    const store = createMemoryStore();
    await processOnce(store, "evt_1", () => {});
    expect(store.seen("evt_1")).toBe(true);
    expect(store.seen("evt_2")).toBe(false);
  });
});
