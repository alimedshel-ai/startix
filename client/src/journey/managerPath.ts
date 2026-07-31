// ─── محرّك مسار المدير المستقل — طبقة بيانات نقيّة (لا محرّك رحلة ثانٍ) ──────
// المراحل الأربع للمستقلّ **عرضٌ** للست PATH_STAGES لا بديلٌ عنها: كل مرحلة
// تحمل `mapsTo: StageId` من الست، فيستهلكها useGuidedNext لاحقاً (باتش 🔒) بلا
// تعارض مع المحرّك القائم (classify/nextStep/rescue). لا تستورد classify ولا
// analysisPlan — طبقة مستقلّة تُقرأ فقط.
//
// النوع (①..⑥) مرجعه الوحيد `journeyStages.ts` (StageId) — لا أسماء مُخترعة.
import type { StageId } from '@/lib/journeyStages'
import type { ManagerType, SpecialtyDeptType } from '@/types/user'

/** مفاتيح مراحل المستقلّ الأربع — ثابتة بالترتيب. */
export type ManagerStageKey =
  | 'admin-diagnosis'      // تشخيص إداري
  | 'financial-diagnosis'  // تشخيص مالي
  | 'composite-analysis'   // تحليل مركّب
  | 'guided-plan'          // خطة موجّهة (نوعها من نتيجة التحليل لا العميل)

export interface ManagerStage {
  key: ManagerStageKey
  order: number          // 1..4 (ترتيب ثابت)
  labelAr: string
  /** المرحلة المقابلة من الست — نقطة الاستهلاك من المحرّك الموحّد لاحقاً. */
  mapsTo: StageId
  /** مقفلة إن نقص مُدخَلها (بلا تخصّص = لا تشخيص إداريّ). */
  locked: boolean
  unlockHint?: string
}

/** الدور المُميِّز: نوع المدير أو مالك. (المستثمر خارج هذه الطبقة.) */
export type PathRole = ManagerType | 'OWNER' | null | undefined

// الأربع الثابتة + خريطة الاستهلاك للست (القيم من journeyStages.StageId).
const PRO_STAGES: readonly Omit<ManagerStage, 'locked' | 'unlockHint'>[] = [
  { key: 'admin-diagnosis',     order: 1, labelAr: 'تشخيص إداري', mapsTo: 'environment' },
  { key: 'financial-diagnosis', order: 2, labelAr: 'تشخيص مالي',  mapsTo: 'environment' },
  { key: 'composite-analysis',  order: 3, labelAr: 'تحليل مركّب', mapsTo: 'synthesis' },
  { key: 'guided-plan',         order: 4, labelAr: 'خطة موجّهة',  mapsTo: 'initiatives' },
] as const

/**
 * مراحل المدير المستقل الأربع بالترتيب الثابت.
 * - غير المستقلّ (مالك/داخليّ) → [] (هذه الطبقة خاصّة بالمستقلّ).
 * - مستقلّ بلا تخصّص → الأربع تُرجَع لكن **مقفلة** (التخصّص مُدخَل التشخيص الإداريّ).
 */
export function managerStages(role: PathRole, specialty?: SpecialtyDeptType | null): ManagerStage[] {
  if (role !== 'INDEPENDENT_PRO') return []
  const needsSpecialty = !specialty
  return PRO_STAGES.map((s) => ({
    ...s,
    locked: needsSpecialty,
    unlockHint: needsSpecialty ? 'اختر تخصّص الإدارة أوّلاً — هو مُدخَل التشخيص الإداريّ.' : undefined,
  }))
}

/** هل يملك هذا الدور مسار المستقلّ الرباعيّ أصلاً؟ */
export function hasManagerPath(role: PathRole): boolean {
  return role === 'INDEPENDENT_PRO'
}
