import { describe, it, expect } from "vitest";
import { median, momentumTrend } from "../src/metrics.js";

describe("median", () => {
  it("returns null for empty input", () => { expect(median([])).toBeNull(); });
  it("handles a single value", () => { expect(median([5])).toBe(5); });
  it("averages the middle two for even counts", () => { expect(median([1, 3, 5, 7])).toBe(4); });
  it("returns the middle for odd counts", () => { expect(median([1, 100, 2])).toBe(2); });
});

describe("momentumTrend", () => {
  // commits30d*3 vs commits90d, factors 1.2 / 0.8
  it("accelerating when 30d run-rate well above 90d", () => {
    expect(momentumTrend(50, 100)).toBe("accelerating"); // 150 > 120
  });
  it("declining when 30d run-rate well below 90d", () => {
    expect(momentumTrend(20, 100)).toBe("declining");    // 60 < 80
  });
  it("steady in the middle band", () => {
    expect(momentumTrend(35, 100)).toBe("steady");        // 105 between 80 and 120
  });
});
