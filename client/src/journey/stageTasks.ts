// ─── جدول «مرحلة المستقلّ → مهامها» — بيانات نقيّة (تعديل التسلسل = تعديل صفّ) ──
// طبقة بيانات تُقرأ لاحقاً من الواجهة (باتش 🔒). لا محرّك رحلة ثانٍ، لا استيراد
// classify/analysisPlan. القفل مشتقّ من حالة العميل عبر متطلّبات صريحة لكل مهمّة.
import type { ManagerStageKey } from './managerPath'

/** حالة العميل التي تُحدِّد إتاحة/قفل المهام (بوليّة صريحة، بلا منطق خفيّ). */
export interface StageTaskState {
  hasSpecialty: boolean   // اختار تخصّص الإدارة
  hasAudit: boolean       // تدقيق الإدارة منجَز
  hasMaturity: boolean    // تقييم النضج منجَز
  hasQuant: boolean       // المؤشرات الكمّية مُدخَلة (HR_QUANT)
  hasSwotSources: boolean // مصدرا التوليف (داخليّ + خارجيّ) جاهزان
}

/** تعريف مهمّة ثابت في الجدول (بلا حالة). */
export interface StageTaskDef {
  id: string
  labelAr: string
  /** متطلّبات الإتاحة — كلّها يجب أن تتحقّق وإلا قُفِلت المهمّة. */
  requires: (keyof StageTaskState)[]
}

/** مهمّة بعد تطبيق الحالة. */
export interface StageTask extends StageTaskDef {
  locked: boolean
  missing: (keyof StageTaskState)[]
}

// الجدول الوحيد: كل مرحلة من الأربع بمهامها. تعديل التسلسل = صفّ هنا لا منطق.
export const STAGE_TASKS: Record<ManagerStageKey, StageTaskDef[]> = {
  // التسلسل داخل الإداريّ: تخصّص ← تدقيق ← نضج ← كمّي (كلٌّ يشترط سابقه).
  'admin-diagnosis': [
    { id: 'dept-audit',       labelAr: 'تدقيق الإدارة', requires: ['hasSpecialty'] },
    { id: 'maturity',         labelAr: 'تقييم النضج',   requires: ['hasSpecialty', 'hasAudit'] },
    { id: 'quant-indicators', labelAr: 'التحليل الكمّي (المؤشرات + §د)', requires: ['hasMaturity'] },
  ],
  // مرحلة استهلاك — لا مهامّ خاصّة بها؛ تُقرأ مخرجاتها من الإداريّ. قائمة فارغة موثَّقة.
  'financial-diagnosis': [],
  'composite-analysis': [
    { id: 'synthesis-swot', labelAr: 'التوليف (SWOT)', requires: ['hasSwotSources'] },
  ],
  'guided-plan': [
    { id: 'generate-plan', labelAr: 'توليد الخطة الموجّهة', requires: ['hasQuant'] },
  ],
}

/**
 * مهام مرحلة بعد تطبيق حالة العميل — كلٌّ بحالة قفلها والمتطلّب الناقص.
 * مفتاح غير معروف → [] (لا أسماء مُخترَعة).
 */
export function tasksForStage(stage: ManagerStageKey, state: StageTaskState): StageTask[] {
  const defs = STAGE_TASKS[stage] ?? []
  return defs.map((d) => {
    const missing = d.requires.filter((r) => !state[r])
    return { ...d, locked: missing.length > 0, missing }
  })
}
