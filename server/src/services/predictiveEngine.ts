// 90-day forecasting. Phase 4 ships the signature; AI-augmented version
// (Claude-driven scenarios with confidence intervals) lands in Phase 7.

export interface ForecastInput {
  revenueTrend: number[]; // recent monthly revenue, oldest → newest
  costTrend: number[];
}

export interface ForecastResult {
  optimisticRevenue: number;
  neutralRevenue: number;
  pessimisticRevenue: number;
  estimatedRunwayMonths: number | null;
}

export function forecast90d(input: ForecastInput): ForecastResult {
  const last = input.revenueTrend[input.revenueTrend.length - 1] ?? 0;
  const recent = input.revenueTrend.slice(-3);
  const avg = recent.length ? recent.reduce((s, v) => s + v, 0) / recent.length : last;
  const drift = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;

  const lastCost = input.costTrend[input.costTrend.length - 1] ?? 0;
  const cashSurplus = avg - lastCost;
  const runway =
    cashSurplus > 0 ? null : lastCost > 0 ? Math.max(1, Math.round(avg / lastCost) * 3) : null;

  return {
    optimisticRevenue: Math.round((avg + Math.max(drift, 0)) * 3),
    neutralRevenue: Math.round(avg * 3),
    pessimisticRevenue: Math.round((avg - Math.max(-drift, 0)) * 3),
    estimatedRunwayMonths: runway,
  };
}
