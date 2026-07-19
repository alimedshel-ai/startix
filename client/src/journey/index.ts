// ─── طبقة المسار الموجّه — نقطة الدخول الوحيدة ─────────────────────
// المصدر: «أوامر التعديل — مسار موجّه للمدير المستقل» §١-٤.
//
// ⛔ القاعدة الحاكمة: طبقة التوجيه تقرأ user.strategyPath وتحمّل تعريف
// تلك الخطة **فقط** — لا تعرض ولا تخلط عناصر خطة أخرى. resolvePath()
// هي البوّابة الوحيدة التي تختار أحد التعريفات الثلاثة المنفصلة.

import { JOURNEY_STAGES, stagesForPath, type StageId } from '@/lib/journeyStages'
import type { SpecialtyDeptType, StrategyPath } from '@/types/user'

import { OPERATIONAL_PATH } from './paths/operational'
import { STRATEGIC_PATH } from './paths/strategic'
import { TACTICAL_PATH } from './paths/tactical'
import type { PathDefinition, StepDestination } from './types'

export type { JourneyStep, PathDefinition, StepDestination } from './types'

// ─── اختيار الخطة (§٢) — تعريف واحد فقط، بلا خلط ──────────────────
// null → الخطة الاستراتيجيّة افتراضياً (سلوك LONG المتوافق مع القديم).
export function resolvePath(path: StrategyPath | null | undefined): PathDefinition {
  switch (path) {
    case 'QUICK':  return OPERATIONAL_PATH
    case 'MEDIUM': return TACTICAL_PATH
    case 'LONG':   return STRATEGIC_PATH
    default:       return STRATEGIC_PATH // null/قديم → استراتيجي (كل المراحل)
  }
}

// ─── خريطة الإدارة → مقطع المسار (يطابق router + ManagerJourneyMapPage) ──
export const DEPT_SLUG: Record<SpecialtyDeptType, string> = {
  HR: 'hr', FINANCE: 'finance', SALES: 'sales', MARKETING: 'marketing',
  OPERATIONS: 'operations', IT: 'it', CUSTOMER_SERVICE: 'cs', SUPPORT: 'cs',
  LOGISTICS: 'logistics', QUALITY: 'quality', PROJECTS: 'projects',
  GOVERNANCE: 'governance', COMPLIANCE: 'compliance',
}

/** مسار تدقيق الإدارة الأساسي للتخصّص (المرحلة ①، نقطة الدخول). */
export function auditRouteFor(specialty: SpecialtyDeptType | null | undefined): string | null {
  if (!specialty) return null
  return `/manager/${DEPT_SLUG[specialty]}/audit`
}

/**
 * يحوّل وجهة المرحلة إلى مسار فعلي:
 *   '@audit' → مسار تدقيق الإدارة (يحتاج التخصّص)، وإلا المسار كما هو.
 * إن كانت الوجهة '@audit' بلا تخصّص (مالك/داخلي) نُرجِع أوّل أداة تحليل بديلة.
 */
export function resolveDestination(
  dest: StepDestination,
  specialty: SpecialtyDeptType | null | undefined,
): string {
  if (dest === '@audit') {
    return auditRouteFor(specialty) ?? '/internal-environment'
  }
  return dest
}

// ─── مطابقة المسار الحالي بمرحلة ─────────────────────────────────
// نتعرّف على مرحلة الصفحة الحالية: مسار التدقيق → environment، وإلا عبر
// toolPaths في JOURNEY_STAGES (المصدر المحايد لبيانات المراحل).
export function stageForPath(pathname: string): StageId | null {
  // مسار تدقيق الإدارة /manager/<slug>/audit → مرحلة التشخيص.
  if (/^\/manager\/[^/]+\/audit(-pro)?$/.test(pathname)) return 'environment'
  for (const s of JOURNEY_STAGES) {
    if (s.toolPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      return s.id
    }
  }
  return null
}

// ─── حارس التطوير: تطابق عضويّة المراحل مع منطق القفل القائم ───────
// §٦: لا نغيّر منطق القفل/المراحل. هذا الحارس يضمن أن ترتيب مراحل كل
// خطة (المكتوب يدويّاً في ملفها المستقل) مطابق لـ stagesForPath —
// فيمنع أي انحراف صامت بين طبقة العرض ومنطق القفل. يعمل في dev فقط.
if (import.meta.env?.DEV) {
  for (const def of [OPERATIONAL_PATH, TACTICAL_PATH, STRATEGIC_PATH]) {
    const expected = stagesForPath(def.key).join(',')
    const actual = def.steps.map((s) => s.stageId).join(',')
    if (expected !== actual) {
      console.error(
        `[journey] عدم تطابق مراحل خطة ${def.key}: التعريف=[${actual}] بينما منطق القفل=[${expected}]. ` +
        'صحّح ترتيب steps في ملف الخطة ليطابق PATH_STAGES.',
      )
    }
  }
}
