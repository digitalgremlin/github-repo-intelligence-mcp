import { THRESHOLDS } from './config.js';
import type { RawRepoPayload } from './types.js';

const DAY = 86400000;
const daysSince = (iso: string, now: Date): number => Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
const within = (iso: string, now: Date, days: number): boolean => daysSince(iso, now) <= days;

export type Trend = 'accelerating' | 'steady' | 'declining';

export function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[middle];

  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function momentumTrend(commits30d: number, commits90d: number): Trend {
  const runRate = commits30d * 3;
  const { acceleratingFactor, decliningFactor } = THRESHOLDS.momentum;

  if (runRate > commits90d * acceleratingFactor) return 'accelerating';
  if (runRate < commits90d * decliningFactor) return 'declining';
  return 'steady';
}

export interface ActivityMetrics {
  lastCommitDaysAgo: number | null;
  commits30d: number;
  commits90d: number;
  commits365d: number;
  releaseCount365d: number;
  lastReleaseDaysAgo: number | null;
  momentumTrend: Trend;
}

export function activityMetrics(p: RawRepoPayload, now: Date): ActivityMetrics {
  const ages = p.commitDates.map((date) => daysSince(date, now));
  const relAges = p.releaseDates.map((date) => daysSince(date, now)).filter((age) => age <= 365);
  const commits30d = ages.filter((age) => age <= 30).length;
  const commits90d = ages.filter((age) => age <= 90).length;

  return {
    lastCommitDaysAgo: ages.length ? Math.min(...ages) : null,
    commits30d,
    commits90d,
    commits365d: ages.filter((age) => age <= 365).length,
    releaseCount365d: relAges.length,
    lastReleaseDaysAgo: relAges.length ? Math.min(...relAges) : null,
    momentumTrend: momentumTrend(commits30d, commits90d),
  };
}

export interface IssueMetrics {
  openIssues: number;
  closedIssues: number;
  openClosedRatio: number | null;
  medianFirstResponseDays: number | null;
  medianTimeToCloseDays: number | null;
  staleOpenIssues: number;
  staleOpenRatio: number;
}

export function issueMetrics(p: RawRepoPayload, now: Date): IssueMetrics {
  const open = p.issues.filter((issue) => issue.state === 'OPEN');
  const closed = p.issues.filter((issue) => issue.state === 'CLOSED');
  const stale = open.filter((issue) => daysSince(issue.lastActivityAt, now) > THRESHOLDS.issues.staleIdleDays);
  const firstResp = p.issues
    .filter((issue) => issue.firstResponseAt)
    .map((issue) => daysSince(issue.createdAt, now) - daysSince(issue.firstResponseAt!, now));
  const ttc = closed
    .filter((issue) => issue.closedAt)
    .map((issue) => daysSince(issue.createdAt, now) - daysSince(issue.closedAt!, now));

  return {
    openIssues: open.length,
    closedIssues: closed.length,
    openClosedRatio: closed.length ? open.length / closed.length : null,
    medianFirstResponseDays: median(firstResp),
    medianTimeToCloseDays: median(ttc),
    staleOpenIssues: stale.length,
    staleOpenRatio: open.length ? stale.length / open.length : 0,
  };
}

export interface PrMetrics {
  openPrs: number;
  mergedPrs: number;
  closedUnmergedPrs: number;
  mergeRate: number | null;
  medianTimeToMergeDays: number | null;
  oldestOpenPrDaysAgo: number | null;
}

export function prMetrics(p: RawRepoPayload, now: Date): PrMetrics {
  const open = p.pulls.filter((pull) => pull.state === 'OPEN');
  const merged = p.pulls.filter((pull) => pull.state === 'MERGED');
  const closedUnmerged = p.pulls.filter((pull) => pull.state === 'CLOSED');
  const decided = merged.length + closedUnmerged.length;
  const ttm = merged
    .filter((pull) => pull.mergedAt)
    .map((pull) => daysSince(pull.createdAt, now) - daysSince(pull.mergedAt!, now));
  const openAges = open.map((pull) => daysSince(pull.createdAt, now));

  return {
    openPrs: open.length,
    mergedPrs: merged.length,
    closedUnmergedPrs: closedUnmerged.length,
    mergeRate: decided ? merged.length / decided : null,
    medianTimeToMergeDays: median(ttm),
    oldestOpenPrDaysAgo: openAges.length ? Math.max(...openAges) : null,
  };
}

export interface ContributorMetrics {
  totalContributors: number;
  topContributorShare: number;
  topTwoContributorShare: number;
  busFactorFlag: boolean;
}

export function contributorMetrics(p: RawRepoPayload, now: Date): ContributorMetrics {
  const sorted = [...p.contributors].sort((a, b) => b.commits - a.commits);
  const total = sorted.reduce((sum, contributor) => sum + contributor.commits, 0);
  const top = sorted[0]?.commits ?? 0;
  const topTwo = top + (sorted[1]?.commits ?? 0);
  const topShare = total ? top / total : 0;
  const topTwoShare = total ? topTwo / total : 0;
  const { busFactorTopShare, busFactorTopTwoShare } = THRESHOLDS.contributors;

  return {
    totalContributors: sorted.length,
    topContributorShare: topShare,
    topTwoContributorShare: topTwoShare,
    busFactorFlag: topShare > busFactorTopShare || topTwoShare > busFactorTopTwoShare,
  };
}
