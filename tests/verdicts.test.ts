import { describe, it, expect } from "vitest";
import { activityVerdict, issueVerdict, prVerdict, contributorVerdict } from "../src/verdicts.js";

describe("activityVerdict", () => {
  it.each([
    [10, "Healthy"], [30, "Healthy"],
    [31, "Moderate"], [180, "Moderate"],
    [181, "At-Risk"], [365, "At-Risk"],
    [366, "Likely abandoned"],
  ])("lastCommit %i days -> %s", (days, expected) => {
    expect(activityVerdict({ lastCommitDaysAgo: days } as any)).toBe(expected);
  });
  it("null last commit -> Likely abandoned", () => {
    expect(activityVerdict({ lastCommitDaysAgo: null } as any)).toBe("Likely abandoned");
  });
});

describe("issueVerdict", () => {
  it("Healthy when fast response and low stale ratio", () => {
    expect(issueVerdict({ medianFirstResponseDays: 5, staleOpenRatio: 0.3 } as any)).toBe("Healthy");
  });
  it("Moderate when within moderate band", () => {
    expect(issueVerdict({ medianFirstResponseDays: 20, staleOpenRatio: 0.55 } as any)).toBe("Moderate");
  });
  it("At-Risk beyond moderate", () => {
    expect(issueVerdict({ medianFirstResponseDays: 40, staleOpenRatio: 0.7 } as any)).toBe("At-Risk");
  });
  it("null median judged on stale ratio alone", () => {
    expect(issueVerdict({ medianFirstResponseDays: null, staleOpenRatio: 0.3 } as any)).toBe("Healthy");
  });
});

describe("prVerdict", () => {
  it("Healthy with high merge rate and fresh backlog", () => {
    expect(prVerdict({ mergeRate: 0.7, oldestOpenPrDaysAgo: 20 } as any)).toBe("Healthy");
  });
  it("Moderate when merge rate OR backlog qualifies", () => {
    expect(prVerdict({ mergeRate: 0.4, oldestOpenPrDaysAgo: 200 } as any)).toBe("Moderate");
  });
  it("At-Risk when neither qualifies", () => {
    expect(prVerdict({ mergeRate: 0.1, oldestOpenPrDaysAgo: 200 } as any)).toBe("At-Risk");
  });
  it("null merge rate judged on backlog age", () => {
    expect(prVerdict({ mergeRate: null, oldestOpenPrDaysAgo: 20 } as any)).toBe("Healthy");
  });
});

describe("contributorVerdict", () => {
  it("Healthy with 3+ active and no bus-factor", () => {
    expect(contributorVerdict({ totalContributors: 5, busFactorFlag: false } as any)).toBe("Healthy");
  });
  it("solo active maintainer caps at Moderate", () => {
    expect(contributorVerdict({ totalContributors: 1, busFactorFlag: true } as any)).toBe("Moderate");
  });
  it("At-Risk when no active contributors", () => {
    expect(contributorVerdict({ totalContributors: 0, busFactorFlag: true } as any)).toBe("At-Risk");
  });
});
