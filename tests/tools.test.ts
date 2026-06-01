// tests/tools.test.ts
import { describe, it, expect } from "vitest";
import { buildRepoHealth, buildActivity, buildIssues, buildPulls, buildContributors } from "../src/tools.js";
import type { RawRepoPayload } from "../src/types.js";

const NOW = new Date("2026-06-01T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

const healthy: RawRepoPayload = {
  owner: "o", name: "n", isPrivate: false, stars: 5, forks: 1,
  commitDates: [daysAgo(1), daysAgo(2), daysAgo(3)],
  releaseDates: [daysAgo(10)],
  issues: [{ createdAt: daysAgo(5), closedAt: daysAgo(4), firstResponseAt: daysAgo(4), lastActivityAt: daysAgo(4), state: "CLOSED" }],
  pulls: [{ createdAt: daysAgo(5), mergedAt: daysAgo(4), closedAt: null, state: "MERGED" }],
  contributors: [
    { login: "a", commits: 10, firstCommitAt: daysAgo(400) },
    { login: "b", commits: 9, firstCommitAt: daysAgo(300) },
    { login: "c", commits: 8, firstCommitAt: daysAgo(200) },
  ],
};

describe("buildRepoHealth", () => {
  it("returns overall verdict, per-dimension verdicts, and raw context", () => {
    const out = buildRepoHealth(healthy, NOW, true);
    expect(out.repo).toBe("o/n");
    expect(out.overallVerdict).toBe("Actively maintained");
    expect(out.dimensions.activity.verdict).toBe("Healthy");
    expect(out.authenticated).toBe(true);
    expect(out.stars).toBe(5);
    expect(typeof out.rationale).toBe("string");
  });
});

describe("dimension tools echo the repo and a verdict", () => {
  it("activity", () => { expect(buildActivity(healthy, NOW).verdict).toBe("Healthy"); });
  it("issues", () => { expect(buildIssues(healthy, NOW).verdict).toBeDefined(); });
  it("pulls", () => { expect(buildPulls(healthy, NOW).verdict).toBeDefined(); });
  it("contributors", () => { expect(buildContributors(healthy, NOW).verdict).toBe("Healthy"); });
});
