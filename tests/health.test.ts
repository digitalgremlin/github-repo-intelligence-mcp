import { describe, it, expect } from "vitest";
import { composeOverall, rationale } from "../src/health.js";
import type { DimensionVerdict, ActivityVerdict } from "../src/types.js";

const v = (activity: ActivityVerdict, issues: DimensionVerdict, pulls: DimensionVerdict, contributors: DimensionVerdict) =>
  ({ activity, issues, pulls, contributors });

describe("composeOverall", () => {
  it("Likely abandoned when activity is abandoned", () => {
    expect(composeOverall(v("Likely abandoned", "Healthy", "Healthy", "Healthy"))).toBe("Likely abandoned");
  });
  it("At-risk when activity is At-Risk", () => {
    expect(composeOverall(v("At-Risk", "Healthy", "Healthy", "Healthy"))).toBe("At-risk");
  });
  it("At-risk when two non-activity dimensions are At-Risk", () => {
    expect(composeOverall(v("Healthy", "At-Risk", "At-Risk", "Healthy"))).toBe("At-risk");
  });
  it("Actively maintained when activity Healthy and no At-Risk dims", () => {
    expect(composeOverall(v("Healthy", "Moderate", "Healthy", "Healthy"))).toBe("Actively maintained");
  });
  it("Slowing when activity Healthy but one dim At-Risk", () => {
    expect(composeOverall(v("Healthy", "At-Risk", "Healthy", "Healthy"))).toBe("Slowing");
  });
  it("Slowing when activity Moderate", () => {
    expect(composeOverall(v("Moderate", "Healthy", "Healthy", "Healthy"))).toBe("Slowing");
  });
});

describe("rationale", () => {
  it("names the activity verdict and most-degraded dimension", () => {
    const text = rationale(v("Healthy", "At-Risk", "Healthy", "Healthy"));
    expect(text).toContain("activity is Healthy");
    expect(text).toContain("issues");
  });
});
