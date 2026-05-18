// Department SMART recommendations: per-department KPI targets adjusted to
// the current audit score, plus axis-level insights. Plan §5.1.

import { DEPT_KPI_BANK, type KPISpec } from '../lib/deptKPIs';
import type { DeptCode } from '../lib/deptQuestions';
import type { AuditScore } from './auditEngine';

export interface SmartKPI {
  name: string;
  unit: string;
  targetValue: number;
  frequency: KPISpec['frequency'];
}

export interface SmartInsight {
  axis: 'governance' | 'financial' | 'team' | 'digital';
  severity: 'critical' | 'warning' | 'info';
  insight: string;
}

export interface SmartRecommendations {
  kpis: SmartKPI[];
  insights: SmartInsight[];
}

const PHRASE: Record<SmartInsight['axis'], string> = {
  governance: 'Governance is below target — add policies, documented delegations and a review cadence.',
  financial: 'Financial controls are weak — tighten cost tracking, forecasting and budget ownership.',
  team: 'Team capabilities are below target — invest in training, onboarding and skills matrices.',
  digital: 'Digital maturity is below target — adopt or fully use the systems the function relies on.',
};

function severity(scorePct: number): SmartInsight['severity'] {
  if (scorePct < 40) return 'critical';
  if (scorePct < 70) return 'warning';
  return 'info';
}

/**
 * Adjust a KPI's base target by the department's audit health. Stronger
 * departments get stretch targets; weaker departments get softened, more
 * realistic short-term targets.
 */
function adjustTarget(spec: KPISpec, healthPct: number): number {
  // Map health 0..100 → factor 0.7..1.2 (or inverted for lowerIsBetter).
  const factor = 0.7 + (healthPct / 100) * 0.5;
  const target = spec.lowerIsBetter ? spec.baseTarget * (2 - factor) : spec.baseTarget * factor;
  // Round nicely.
  if (target >= 1000) return Math.round(target / 100) * 100;
  if (target >= 10) return Math.round(target);
  return Math.round(target * 10) / 10;
}

export function smartRecommendations(dept: DeptCode, score: AuditScore): SmartRecommendations {
  const bank = DEPT_KPI_BANK[dept] ?? [];
  const kpis: SmartKPI[] = bank.map((spec) => ({
    name: spec.name,
    unit: spec.unit,
    targetValue: adjustTarget(spec, score.healthPct),
    frequency: spec.frequency,
  }));

  const insights: SmartInsight[] = (['governance', 'financial', 'team', 'digital'] as const)
    .map((axis) => {
      const axisScore = score[axis];
      const cap = axis === 'governance' || axis === 'financial' ? 30 : 20;
      const pct = (axisScore / cap) * 100;
      return { axis, pct };
    })
    .filter((row) => row.pct < 70)
    .map((row) => ({
      axis: row.axis,
      severity: severity(row.pct),
      insight: PHRASE[row.axis],
    }));

  return { kpis, insights };
}
