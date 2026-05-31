import { THRESHOLDS } from './config.js';
import type { DimensionVerdict, ActivityVerdict } from './types.js';
import type { ActivityMetrics, IssueMetrics, PrMetrics, ContributorMetrics } from './metrics.js';

export function activityVerdict(m: Pick<ActivityMetrics, 'lastCommitDaysAgo'>): ActivityVerdict {
  const d = m.lastCommitDaysAgo;
  const t = THRESHOLDS.activity;

  if (d === null || d > t.atRiskDays) return 'Likely abandoned';
  if (d <= t.healthyDays) return 'Healthy';
  if (d <= t.moderateDays) return 'Moderate';
  return 'At-Risk';
}

export function issueVerdict(m: Pick<IssueMetrics, 'medianFirstResponseDays' | 'staleOpenRatio'>): DimensionVerdict {
  const t = THRESHOLDS.issues;
  const resp = m.medianFirstResponseDays;
  const respHealthy = resp === null || resp <= t.healthy.firstResponseDays;
  const respModerate = resp === null || resp <= t.moderate.firstResponseDays;

  if (respHealthy && m.staleOpenRatio <= t.healthy.staleRatio) return 'Healthy';
  if (respModerate && m.staleOpenRatio <= t.moderate.staleRatio) return 'Moderate';
  return 'At-Risk';
}

export function prVerdict(m: Pick<PrMetrics, 'mergeRate' | 'oldestOpenPrDaysAgo'>): DimensionVerdict {
  const t = THRESHOLDS.pulls;
  const rate = m.mergeRate;
  const age = m.oldestOpenPrDaysAgo ?? 0;
  const rateHealthy = rate === null ? true : rate >= t.healthy.mergeRate;

  if (rateHealthy && age <= t.healthy.oldestOpenDays) return 'Healthy';

  const rateModerate = rate === null ? false : rate >= t.moderate.mergeRate;
  if (rateModerate || age <= t.moderate.oldestOpenDays) return 'Moderate';
  return 'At-Risk';
}

export function contributorVerdict(
  m: Pick<ContributorMetrics, 'activeContributors90d' | 'busFactorFlag'>,
): DimensionVerdict {
  const t = THRESHOLDS.contributors;

  if (m.activeContributors90d === 0) return 'At-Risk';
  if (m.activeContributors90d >= t.healthyMinActive && !m.busFactorFlag) return 'Healthy';
  return 'Moderate';
}
