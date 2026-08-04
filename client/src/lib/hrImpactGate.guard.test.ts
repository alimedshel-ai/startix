import { describe, expect, it } from 'vitest'

// ─── تريبواير الرقعة F (ف٤) — أثر §د لا يتسرّب إلى الدرجة/البوابات ─────────
// قاعدة مغلقة: أثر §د بالريال يُستخدم في هدف المبادرة والأولوية وخطة ٩٠ يوماً
// فقط. ممنوع أن يدخل في درجة الصحّة (healthPct/classifyClient) أو بوابات
// الإكمال. هذا الاختبار يقفل ملفّات القلب ضدّ استيراد رموز محرّك §د.
//
// عكس نمط divergentNextGuard: هناك «الاسم صفرٌ في كل src»؛ هنا الرموز مشروعة
// (المحرّك + المولّد + الواجهة) لكنها ممنوعة داخل ملفّات الدرجة/البوابات تحديداً.

// رموز محرّك §د (hrFinancialImpact) + جسره (hrInitiativeImpact).
const IMPACT_SYMBOLS = [
  'hrFinancialImpact',
  'hrInitiativeImpact',
  'computeHrFinancialImpact',
  'turnoverCost',
  'absenceImpact',
  'vacancyImpact',
  'enpsImpact',
  'hrCostImpact',
  'hrGoalLineForText',
  'totalSavingSAR',
]

// ملفّات الدرجة/البوابات — يجب ألّا تعرف §د إطلاقاً.
const GATE_MODULES = [
  '/journey/classify.ts',
  '/hooks/useRescue.ts',
  '/hooks/useGuidedNext.ts',
  '/hooks/useJourneyCompletions.ts',
  '/lib/journeyStages.ts',
  '/journey/stageStatus.ts',
  '/journey/nextStep.ts',
  '/lib/initiativeState.ts',
]

const sources = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('تريبواير §د (ف٤) — لا تسرّب للأثر المالي إلى الدرجة/البوابات', () => {
  for (const mod of GATE_MODULES) {
    const entry = Object.entries(sources).find(([path]) => path.endsWith(mod))

    it(`${mod} موجود (الحارس يحرس ملفّاً حيّاً لا وهماً)`, () => {
      expect(entry, `لم يُعثر على ${mod} — حدّث GATE_MODULES`).toBeTruthy()
    })

    it(`${mod} لا يستورد أيّ رمز من محرّك §د`, () => {
      const src = entry?.[1] ?? ''
      const hits = IMPACT_SYMBOLS.filter((sym) => src.includes(sym))
      expect(hits).toEqual([])
    })
  }
})
