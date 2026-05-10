// Department SMART recommendations. Phase 4 ships the signature; per-dept
// KPI banks + AI insights are filled in during Phase 5.

import type { AuditScore } from './auditEngine';

export type DeptCode =
  | 'HR'
  | 'FINANCE'
  | 'SALES'
  | 'MARKETING'
  | 'OPERATIONS'
  | 'IT'
  | 'CUSTOMER_SERVICE'
  | 'SUPPORT'
  | 'LOGISTICS'
  | 'QUALITY'
  | 'PROJECTS'
  | 'GOVERNANCE'
  | 'COMPLIANCE';

export interface SmartKPI {
  name: string;
  unit: string;
  targetValue: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export interface SmartInsight {
  axis: keyof AuditScore;
  insight: string;
}

export interface SmartRecommendations {
  kpis: SmartKPI[];
  insights: SmartInsight[];
}

export function smartRecommendations(_dept: DeptCode, score: AuditScore): SmartRecommendations {
  const insights: SmartInsight[] = (
    ['governance', 'financial', 'team', 'digital'] as const
  )
    .filter((axis) => score[axis] < 9)
    .map((axis) => ({ axis, insight: `${axis} axis is below median — prioritize.` }));
  return { kpis: [], insights };
}
