import type { RawRepoPayload } from "./types.js";
import {
  activityMetrics, issueMetrics, prMetrics, contributorMetrics,
} from "./metrics.js";
import { activityVerdict, issueVerdict, prVerdict, contributorVerdict } from "./verdicts.js";
import { composeOverall, rationale } from "./health.js";

const iso = (d: Date) => d.toISOString();
const repoId = (p: RawRepoPayload) => `${p.owner}/${p.name}`;

export function buildActivity(p: RawRepoPayload, now: Date) {
  const m = activityMetrics(p, now);
  return { repo: repoId(p), verdict: activityVerdict(m), ...m, fetchedAt: iso(now) };
}
export function buildIssues(p: RawRepoPayload, now: Date) {
  const m = issueMetrics(p, now);
  return { repo: repoId(p), verdict: issueVerdict(m), ...m, fetchedAt: iso(now) };
}
export function buildPulls(p: RawRepoPayload, now: Date) {
  const m = prMetrics(p, now);
  return { repo: repoId(p), verdict: prVerdict(m), ...m, fetchedAt: iso(now) };
}
export function buildContributors(p: RawRepoPayload, now: Date) {
  const m = contributorMetrics(p, now);
  return { repo: repoId(p), verdict: contributorVerdict(m), ...m, fetchedAt: iso(now) };
}

export function buildRepoHealth(p: RawRepoPayload, now: Date, authenticated: boolean) {
  const a = activityMetrics(p, now);
  const i = issueMetrics(p, now);
  const pr = prMetrics(p, now);
  const c = contributorMetrics(p, now);
  const verdicts = {
    activity: activityVerdict(a), issues: issueVerdict(i),
    pulls: prVerdict(pr), contributors: contributorVerdict(c),
  };
  return {
    repo: repoId(p),
    overallVerdict: composeOverall(verdicts),
    dimensions: {
      activity: { verdict: verdicts.activity, lastCommitDaysAgo: a.lastCommitDaysAgo, commits90d: a.commits90d },
      issues: { verdict: verdicts.issues, medianFirstResponseDays: i.medianFirstResponseDays, staleOpenRatio: i.staleOpenRatio },
      pullRequests: { verdict: verdicts.pulls, mergeRate: pr.mergeRate, oldestOpenPrDaysAgo: pr.oldestOpenPrDaysAgo },
      contributors: { verdict: verdicts.contributors, totalContributors: c.totalContributors, busFactorFlag: c.busFactorFlag },
    },
    rationale: rationale(verdicts),
    stars: p.stars, forks: p.forks,
    fetchedAt: iso(now), authenticated,
  };
}
