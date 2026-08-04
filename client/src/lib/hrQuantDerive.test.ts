import { describe, expect, it } from 'vitest'

import { deriveQuantActual, QUANT_CROSSOVER } from './hrQuantDerive'
import { HR_QUANT_INDICATORS } from './hrQuantIndicators'

describe('hrQuantDerive — اشتقاق الفعليّ من الأعداد (جدول العبور v3.2)', () => {
  // ── حالتا القبول الحاكمتان (§٨) ──
  it('§٨: التسرّب — headcount=50 + مغادرون=5 ⇒ ١٠٪', () => {
    expect(deriveQuantActual('KPI_STR_02', { FND_HEADCOUNT: 50, HRQ_LEAVERS_12M: 5 })).toBe(10)
  })
  it('§٨: الإيراد لكل موظف — إيراد ٣٠٠٠٠٠٠ ÷ موظفون ٢٠ ⇒ ١٥٠٠٠٠ ريال (بلا ×١٠٠)', () => {
    expect(deriveQuantActual('KPI_STR_06', { FND_ANNUAL_REVENUE: 3_000_000, FND_HEADCOUNT: 20 })).toBe(150000)
  })

  // ── عدد (ب) بوحدة غير ٪ لا يُضرب ×١٠٠ ──
  it('سنوات الخبرة — مجموع ١٥٠ ÷ ٥٠ ⇒ ٣ سنة (لا ٪)', () => {
    expect(deriveQuantActual('KPI_STR_03', { HRQ_TOTAL_EXP_YEARS: 150, FND_HEADCOUNT: 50 })).toBe(3)
  })
  it('مقامٌ مركّب — الغياب ١٠ ÷ (٥٠ × ٢٢) ⇒ ٠٫٩١٪', () => {
    expect(deriveQuantActual('KPI_TAC_10', { HRQ_ABSENCE_DAYS_M: 10, FND_HEADCOUNT: 50, FND_WORK_DAYS: 22 })).toBe(0.91)
  })
  it('مقامٌ HRQ لا FND — الشغور ٣ ÷ معتمدة ٢٠ ⇒ ١٥٪', () => {
    expect(deriveQuantActual('KPI_TAC_02', { HRQ_VACANT: 3, HRQ_APPROVED_HEADCOUNT: 20 })).toBe(15)
  })

  // ── مشتقّ (أ): الامتثال KPI_STR_05 ──
  it('الامتثال — متوسط (١ − مخالفات ÷ الموظفون) عبر العدّادات الأربعة', () => {
    // headcount=100 · إقامات5 · رخص0 · تأمين10 · عقود5 ⇒ 0.95·1·0.90·0.95 ⇒ 95٪
    const v = deriveQuantActual('KPI_STR_05', {
      FND_HEADCOUNT: 100, KPI_OPR_04: 5, KPI_OPR_05: 0, KPI_OPR_06: 10, KPI_OPR_11: 5,
    })
    expect(v).toBe(95)
  })

  // ── يدويّ/خام/كتالوج ⇒ null (لا يُشتقّ هنا) ──
  it('يدويّ (STR_07) وخام (OPR_02) وكتالوج (STR_04) ⇒ null', () => {
    expect(deriveQuantActual('KPI_STR_07', { anything: 1 })).toBeNull()
    expect(deriveQuantActual('KPI_OPR_02', { anything: 1 })).toBeNull()
    expect(deriveQuantActual('KPI_STR_04', { FND_HEADCOUNT: 50 })).toBeNull()
  })

  // ── لا اختلاق: نقص مدخلٍ أو مقام صفر ⇒ null ──
  it('نقص البسط ⇒ null (لا صفر مُختلَق)', () => {
    expect(deriveQuantActual('KPI_STR_02', { FND_HEADCOUNT: 50 })).toBeNull()
  })
  it('مقام صفر ⇒ null', () => {
    expect(deriveQuantActual('KPI_STR_02', { FND_HEADCOUNT: 0, HRQ_LEAVERS_12M: 5 })).toBeNull()
  })

  // ── اكتمال الجدول: كل مؤشرٍ من الـ٣١ له صفّ عبور ──
  it('جدول العبور يغطّي المؤشرات الـ٣١ صفّاً بصفّ', () => {
    const missing = HR_QUANT_INDICATORS.filter((i) => !QUANT_CROSSOVER[i.id])
    expect(missing.map((i) => i.id)).toEqual([])
    expect(Object.keys(QUANT_CROSSOVER)).toHaveLength(31)
  })
})
