import type { DimensionVerdict, ActivityVerdict, OverallVerdict } from './types.js';

export interface VerdictSet {
  activity: ActivityVerdict;
  issues: DimensionVerdict;
  pulls: DimensionVerdict;
  contributors: DimensionVerdict;
}

export function composeOverall(v: VerdictSet): OverallVerdict {
  if (v.activity === 'Likely abandoned') return 'Likely abandoned';

  const nonActivity = [v.issues, v.pulls, v.contributors];
  const atRiskCount = nonActivity.filter((x) => x === 'At-Risk').length;

  if (v.activity === 'At-Risk' || atRiskCount >= 2) return 'At-risk';
  if (v.activity === 'Healthy' && atRiskCount === 0) return 'Actively maintained';
  return 'Slowing';
}

const RANK: Record<DimensionVerdict, number> = { 'At-Risk': 0, Moderate: 1, Healthy: 2 };

export function rationale(v: VerdictSet): string {
  const dims: Array<[string, DimensionVerdict]> = [
    ['issues', v.issues],
    ['pull requests', v.pulls],
    ['contributors', v.contributors],
  ];
  const worst = dims.reduce((a, b) => (RANK[b[1]] < RANK[a[1]] ? b : a));
  return `Overall: activity is ${v.activity}; weakest dimension is ${worst[0]} (${worst[1]}).`;
}
