import { THRESHOLDS } from './config.js';

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
