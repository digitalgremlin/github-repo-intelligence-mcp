// tests/cache.test.ts
import { describe, it, expect } from "vitest";
import { TtlLruCache } from "../src/cache.js";

describe("TtlLruCache", () => {
  it("returns a stored value before TTL", () => {
    let now = 0;
    const c = new TtlLruCache<string>(2, 60_000, () => now);
    c.set("a", "1");
    now = 30_000;
    expect(c.get("a")).toBe("1");
  });
  it("expires a value after TTL", () => {
    let now = 0;
    const c = new TtlLruCache<string>(2, 60_000, () => now);
    c.set("a", "1");
    now = 60_001;
    expect(c.get("a")).toBeUndefined();
  });
  it("evicts the least-recently-used at capacity", () => {
    const c = new TtlLruCache<string>(2, 60_000, () => 0);
    c.set("a", "1"); c.set("b", "2");
    c.get("a");          // a now most-recently-used
    c.set("c", "3");     // evicts b
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe("1");
    expect(c.get("c")).toBe("3");
  });
});
