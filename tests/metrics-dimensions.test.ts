import { describe, it, expect } from "vitest";
import { activityMetrics, issueMetrics, prMetrics, contributorMetrics } from "../src/metrics.js";
import type { RawRepoPayload } from "../src/types.js";

const NOW = new Date("2026-06-01T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

const base: RawRepoPayload = {
  owner: "o", name: "n", isPrivate: false, stars: 100, forks: 10,
  commitDates: [], releaseDates: [], issues: [], pulls: [], contributors: [],
};

describe("activityMetrics", () => {
  it("counts commits in 30/90/365 windows and last-commit recency", () => {
    const p = { ...base, commitDates: [daysAgo(2), daysAgo(20), daysAgo(60), daysAgo(300)] };
    const m = activityMetrics(p, NOW);
    expect(m.lastCommitDaysAgo).toBe(2);
    expect(m.commits30d).toBe(2);
    expect(m.commits90d).toBe(3);
    expect(m.commits365d).toBe(4);
  });
  it("reports null release recency when there are no releases", () => {
    const m = activityMetrics({ ...base, releaseDates: [] }, NOW);
    expect(m.releaseCount365d).toBe(0);
    expect(m.lastReleaseDaysAgo).toBeNull();
  });
});

describe("issueMetrics", () => {
  it("computes ratios, medians, and stale backlog", () => {
    const p = { ...base, issues: [
      { createdAt: daysAgo(10), closedAt: daysAgo(8), firstResponseAt: daysAgo(9), lastActivityAt: daysAgo(8), state: "CLOSED" as const },
      { createdAt: daysAgo(120), closedAt: null, firstResponseAt: null, lastActivityAt: daysAgo(100), state: "OPEN" as const },
      { createdAt: daysAgo(5), closedAt: null, firstResponseAt: daysAgo(4), lastActivityAt: daysAgo(4), state: "OPEN" as const },
    ]};
    const m = issueMetrics(p, NOW);
    expect(m.openIssues).toBe(2);
    expect(m.closedIssues).toBe(1);
    expect(m.staleOpenIssues).toBe(1);        // the 100d-idle open one
    expect(m.staleOpenRatio).toBeCloseTo(0.5);
    expect(m.medianFirstResponseDays).toBe(1); // single response: 10d->9d = 1d
  });
});

describe("prMetrics", () => {
  it("computes merge rate, median time-to-merge, oldest open age", () => {
    const p = { ...base, pulls: [
      { createdAt: daysAgo(10), mergedAt: daysAgo(7), closedAt: null, state: "MERGED" as const },
      { createdAt: daysAgo(20), mergedAt: null, closedAt: daysAgo(19), state: "CLOSED" as const },
      { createdAt: daysAgo(14), mergedAt: null, closedAt: null, state: "OPEN" as const },
    ]};
    const m = prMetrics(p, NOW);
    expect(m.mergedPrs).toBe(1);
    expect(m.closedUnmergedPrs).toBe(1);
    expect(m.openPrs).toBe(1);
    expect(m.mergeRate).toBeCloseTo(0.5);
    expect(m.medianTimeToMergeDays).toBe(3);
    expect(m.oldestOpenPrDaysAgo).toBe(14);
  });
  it("returns null merge rate with no decided PRs", () => {
    const m = prMetrics({ ...base, pulls: [
      { createdAt: daysAgo(3), mergedAt: null, closedAt: null, state: "OPEN" as const },
    ]}, NOW);
    expect(m.mergeRate).toBeNull();
  });
});

describe("contributorMetrics", () => {
  it("computes total contributors, shares, and bus-factor flag", () => {
    const p = { ...base, contributors: [
      { login: "a", commits: 60, firstCommitAt: daysAgo(400) },
      { login: "b", commits: 30, firstCommitAt: daysAgo(10) },
      { login: "c", commits: 10, firstCommitAt: daysAgo(5) },
    ]};
    const m = contributorMetrics(p, NOW);
    expect(m.totalContributors).toBe(3);
    expect(m.topContributorShare).toBeCloseTo(0.6);
    expect(m.topTwoContributorShare).toBeCloseTo(0.9);
    expect(m.busFactorFlag).toBe(true);       // 0.6 > 0.50
  });
});
