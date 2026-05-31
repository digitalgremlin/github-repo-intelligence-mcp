export const DEFAULTS = {
  cacheTtlMinutes: 20,
  analysisWindowDays: 90,
} as const;

export const THRESHOLDS = {
  activity: { healthyDays: 30, moderateDays: 180, atRiskDays: 365 },
  issues: {
    healthy: { firstResponseDays: 7, staleRatio: 0.40 },
    moderate: { firstResponseDays: 30, staleRatio: 0.60 },
    staleIdleDays: 90,
  },
  pulls: {
    healthy: { mergeRate: 0.60, oldestOpenDays: 30 },
    moderate: { mergeRate: 0.30, oldestOpenDays: 90 },
  },
  contributors: {
    healthyMinActive: 3,
    moderateMinActive: 2,
    busFactorTopShare: 0.50,
    busFactorTopTwoShare: 0.80,
  },
  momentum: { acceleratingFactor: 1.2, decliningFactor: 0.8 },
} as const;
