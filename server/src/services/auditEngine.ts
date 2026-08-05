// Department audit engine. Implements the 4-dimension scoring shared by
// every department: governance 30 / financial 30 / team 20 / digital 20 = 100.
// Per plan §5.1, the question bank differs per department but the scoring
// formula is identical.

import {
  questionsForSizeAndVariant,
  type DeptCode,
  type DeptQuestion,
  type AuditAxis,
  type CompanySize,
} from '../lib/deptQuestions';

export const AXIS_CAP: Record<AuditAxis, number> = {
  governance: 30,
  financial: 30,
  team: 20,
  digital: 20,
};
export const AUDIT_TOTAL_MAX = AXIS_CAP.governance + AXIS_CAP.financial + AXIS_CAP.team + AXIS_CAP.digital; // 100

export interface AuditAnswer {
  questionId: string;
  value: string; // option value (one of the 4 options on the question)
}

export interface AxisBreakdown {
  axis: AuditAxis;
  raw: number;
  rawMax: number;
  score: number; // weighted to axis cap
  cap: number;
}

export interface AuditScore {
  byAxis: AxisBreakdown[];
  governance: number;
  financial: number;
  team: number;
  digital: number;
  total: number;
  healthPct: number;
  dangerZone: DangerZone;
}

export type DangerZone = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export function dangerZoneFor(healthPct: number): DangerZone {
  // Higher pct = healthier, so we invert the plan's risk-zone bands.
  // Plan §5.3 zones (risk %): Green 0–25 / Yellow 26–50 / Orange 51–75 / Red 76–100.
  const risk = 100 - healthPct;
  if (risk <= 25) return 'GREEN';
  if (risk <= 50) return 'YELLOW';
  if (risk <= 75) return 'ORANGE';
  return 'RED';
}

function pointsForOption(question: DeptQuestion, value: string): number {
  const opt = question.options.find((o) => o.value === value);
  if (!opt) throw new Error(`Unknown option "${value}" for question ${question.id}`);
  return opt.score;
}

/**
 * Score a set of answers for a department using the given question bank.
 * Per axis: rawSum / (questionsInAxis × 3) × axisCap, rounded to 1 decimal.
 */
export function scoreAudit(
  questions: DeptQuestion[],
  answers: AuditAnswer[]
): AuditScore {
  const byId = new Map(questions.map((q) => [q.id, q] as const));
  const answerById = new Map(answers.map((a) => [a.questionId, a] as const));

  const buckets: Record<AuditAxis, { raw: number; count: number }> = {
    governance: { raw: 0, count: 0 },
    financial: { raw: 0, count: 0 },
    team: { raw: 0, count: 0 },
    digital: { raw: 0, count: 0 },
  };
  for (const q of questions) {
    const a = answerById.get(q.id);
    const pts = a ? pointsForOption(q, a.value) : 0;
    buckets[q.axis].raw += pts;
    buckets[q.axis].count += 1;
  }

  const axes = (Object.keys(buckets) as AuditAxis[]).map<AxisBreakdown>((axis) => {
    const { raw, count } = buckets[axis];
    const rawMax = count * 3;
    const cap = AXIS_CAP[axis];
    const score = rawMax === 0 ? 0 : Math.round((raw / rawMax) * cap * 10) / 10;
    return { axis, raw, rawMax, score, cap };
  });
  void byId; // suppress unused; kept for future validation

  const get = (axis: AuditAxis) => axes.find((a) => a.axis === axis)!.score;
  const governance = get('governance');
  const financial = get('financial');
  const team = get('team');
  const digital = get('digital');
  const total = Math.round((governance + financial + team + digital) * 10) / 10;
  const healthPct = Math.round((total / AUDIT_TOTAL_MAX) * 100);
  const dangerZone = dangerZoneFor(healthPct);

  return { byAxis: axes, governance, financial, team, digital, total, healthPct, dangerZone };
}

// قيد الصحّة: كلا المساعدين يفلتران بالحجم عبر المصدر الواحد
// questionsForSizeAndVariant — نفس المجموعة التي قدّمها الـcontroller للمستخدم —
// كي لا ينكمش المقام على أسئلة لم تُطرح على الكيان الصغير.

/** يقيّم تدقيقاً أساسيّاً مفلتراً بحجم الكيان. */
export function scoreBasicAuditFor(
  dept: DeptCode,
  answers: AuditAnswer[],
  size: CompanySize
): AuditScore {
  return scoreAudit(questionsForSizeAndVariant(dept, 'basic', size), answers);
}

/** يقيّم تدقيقاً احترافيّاً (basic+pro) مفلتراً بحجم الكيان. */
export function scoreProAuditFor(
  dept: DeptCode,
  answers: AuditAnswer[],
  size: CompanySize
): AuditScore {
  return scoreAudit(questionsForSizeAndVariant(dept, 'pro', size), answers);
}
