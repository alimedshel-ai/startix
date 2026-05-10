// Department audit engine. Phase 4 ships the signature; per-department logic
// (HR, Finance, Sales, etc.) lands in Phase 5.

export type AuditAxis = 'governance' | 'financial' | 'team' | 'digital';
export const AUDIT_AXIS_MAX = 18; // 4 axes × 18 = 72 total
export const AUDIT_TOTAL_MAX = 72;

export interface AuditAnswer {
  questionId: string;
  axis: AuditAxis;
  score: number; // 0..3 typical Likert
}

export interface AuditScore {
  governance: number;
  financial: number;
  team: number;
  digital: number;
  total: number;
  healthPct: number;
}

export function calculateAuditScore(answers: AuditAnswer[]): AuditScore {
  const buckets: Record<AuditAxis, number> = {
    governance: 0,
    financial: 0,
    team: 0,
    digital: 0,
  };
  for (const a of answers) buckets[a.axis] += a.score;

  for (const k of Object.keys(buckets) as AuditAxis[]) {
    buckets[k] = Math.min(buckets[k], AUDIT_AXIS_MAX);
  }
  const total = buckets.governance + buckets.financial + buckets.team + buckets.digital;
  const healthPct = Math.round((total / AUDIT_TOTAL_MAX) * 100);
  return { ...buckets, total, healthPct };
}
