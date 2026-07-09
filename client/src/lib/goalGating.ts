// ─── R3 — بوّابة الأهداف: الأدوات المرئية بناءً على أهداف التسجيل ──
// المصدر: ملف الاقتراح — «بوّابة تحدّد أي مخرجات تظهر للمدير» بناءً على
// الأهداف الـ٧ التي اختارها في /onboarding. مثال: من اختار "swot" لازم
// يوصل تلقائياً لـSWOT/TOWS؛ من اختار "kpis" يظهر له KPIs و OKRs.
//
// دالة نقيّة (pure) — لا تعتمد على state خارجي — تُختبر مباشرة في R8.

import type { GoalCode } from '@/types/user'

// المسارات الرسمية التي تخضع للبوّابة. المفاتيح مطابقة لـ`to` في nav.ts
// و ClientDetailPage.
export type GatedToolPath =
  | '/swot' | '/tows'
  | '/gap-analysis' | '/manager/dept-gap'
  | '/pestel' | '/manager/dept-pestel'
  | '/porter' | '/benchmarking' | '/stakeholders'
  | '/org-dna' | '/value-chain' | '/core-capabilities'
  | '/ambition-gap' | '/strategic-tensions'
  | '/directions' | '/scenarios' | '/choices'
  | '/ansoff' | '/bcg' | '/space' | '/qspm' | '/three-horizons'
  | '/priority-matrix' | '/risk-map'
  | '/objectives' | '/okrs' | '/ogsm' | '/annual-plan'
  | '/kpis' | '/kpi-entries'
  | '/initiatives' | '/projects' | '/gantt-chart' | '/tasks'
  | '/financial-analysis'
  | '/manager/dept-smart'
  | '/manager/dept-deep' | '/manager/deep-analysis'
  | '/manager/contradictions'
  | '/manager/strategic-plan'

// خريطة الهدف → مجموعة الأدوات التي يُشغّلها.
// المصدر: القسم الخامس من ملف الاقتراح («خريطة الـ٣٤ أداة»).
const GOAL_TO_TOOLS: Record<GoalCode, GatedToolPath[]> = {
  // "تحسين الأداء العام" — أدوات التحليل الأساسية للبيئة والفجوة والصحة.
  improve: [
    '/pestel', '/manager/dept-pestel',
    '/porter', '/benchmarking', '/value-chain', '/core-capabilities',
    '/gap-analysis', '/manager/dept-gap',
    '/manager/dept-deep', '/manager/deep-analysis',
    '/manager/dept-smart',
  ],
  // "تقارير أوضح للإدارة" — لوحات وسجلات ومؤشرات.
  reports: [
    '/kpis', '/kpi-entries',
    '/manager/dept-smart',
    '/financial-analysis',
  ],
  // "خطة استراتيجية سنوية" — التوجّه والاختيار والخطة.
  plan: [
    '/directions', '/scenarios', '/choices',
    '/ansoff', '/bcg', '/space', '/qspm', '/three-horizons',
    '/annual-plan', '/manager/strategic-plan',
    '/objectives', '/ogsm',
  ],
  // "بناء KPIs" — كل ما يتعلق بالمؤشرات والقياس.
  kpis: [
    '/kpis', '/kpi-entries', '/okrs', '/ogsm',
    '/manager/dept-smart',
  ],
  // "مواءمة الفريق" — التوليف والأولويات.
  alignment: [
    '/priority-matrix', '/objectives', '/okrs',
    '/manager/contradictions',
  ],
  // "تطوير الفريق" — القدرات والحوكمة.
  team: [
    '/core-capabilities', '/org-dna', '/stakeholders',
    '/initiatives', '/projects', '/tasks',
  ],
  // "تحليل SWOT إداري".
  swot: [
    '/swot', '/tows',
    '/ambition-gap', '/strategic-tensions',
    '/risk-map',
  ],
}

/**
 * يُرجع مجموعة الأدوات المرئية بناءً على الأهداف المختارة.
 *
 * القاعدة: أي هدف مختار يُشغّل مجموعة أدواته. لا هدف مختار = **كل الأدوات
 * مرئية** (لا نُخفي عن مدير لم يُكمل onboarding). هدف واحد = فقط أدواته.
 * أهداف متعدّدة = اتّحاد كل مجموعات الأدوات.
 *
 * @param goals قائمة أكواد الأهداف من `User.goals`.
 * @returns Set يحوي المسارات المرئية. استخدم `.has(path)` للفلترة.
 */
export function visibleTools(goals: string[] | null | undefined): Set<GatedToolPath> | null {
  if (!goals || goals.length === 0) return null // null = بلا فلترة
  const visible = new Set<GatedToolPath>()
  for (const g of goals) {
    const tools = GOAL_TO_TOOLS[g as GoalCode]
    if (tools) tools.forEach((t) => visible.add(t))
  }
  return visible
}

/**
 * هل الأداة مرئية بناءً على الأهداف؟ تسمح بمرور أي أداة غير خاضعة للبوّابة
 * (مثل لوحات القيادة، إعدادات، …) لأنها ليست في القائمة أصلاً.
 */
export function isToolVisible(
  path: string,
  visibleSet: Set<GatedToolPath> | null,
): boolean {
  if (visibleSet === null) return true // بلا فلترة
  if (!isGatedPath(path)) return true // المسار خارج البوّابة أصلاً
  return visibleSet.has(path as GatedToolPath)
}

function isGatedPath(path: string): path is GatedToolPath {
  return GATED_PATHS.has(path)
}

const GATED_PATHS: Set<string> = new Set(
  Object.values(GOAL_TO_TOOLS).flat(),
)
