import { describe, expect, it } from 'vitest'

import {
  evalIndicator,
  FINANCIAL_INDICATOR_IDS,
  HR_QUANT_INDICATORS,
  isVisibleForSize,
  levelSummary,
  type QuantIndicator,
} from './hrQuantIndicators'

// ت٣ — ترشيح البنك بالحجم (ورقة 07، «المُقدَّم = المُقيَّم»).
const visibleCount = (size: string) =>
  HR_QUANT_INDICATORS.filter((i) => isVisibleForSize(i, size)).length

describe('ت٣ — ترشيح المؤشرات بحجم المنشأة', () => {
  it('MICRO يرى 22 مؤشراً (يخفي 9)', () => {
    expect(visibleCount('MICRO')).toBe(22)
  })
  it('صغير يرى 27 (يخفي 4 من طبقة MEDIUM)', () => {
    expect(visibleCount('SMALL')).toBe(27)
  })
  it('متوسط وكبير يريان الـ31 كاملة', () => {
    expect(visibleCount('MEDIUM')).toBe(31)
    expect(visibleCount('LARGE')).toBe(31)
  })
  it('بلا حجم معروف → البنك الكامل (لا إخفاء)', () => {
    expect(HR_QUANT_INDICATORS.filter((i) => isVisibleForSize(i, null)).length).toBe(31)
  })
  it('عدّادات الامتثال الأربعة (STR_05) ظاهرة لكل الأحجام — المقام يبقى 4', () => {
    for (const id of ['KPI_OPR_04', 'KPI_OPR_05', 'KPI_OPR_06', 'KPI_OPR_11']) {
      const ind = HR_QUANT_INDICATORS.find((i) => i.id === id)!
      expect(isVisibleForSize(ind, 'MICRO')).toBe(true)
    }
  })
  it('«المُقدَّم = المُقيَّم»: levelSummary.total يتبع الحجم', () => {
    expect(levelSummary('strategic', {}, 'MEDIUM').total).toBe(9)
    expect(levelSummary('strategic', {}, 'MICRO').total).toBe(6) // يخفي STR_07/08/09
  })
})

describe('بنك المؤشرات الكمّية — 31 مؤشراً / 3 مستويات', () => {
  it('العدد الإجماليّ = 31', () => {
    expect(HR_QUANT_INDICATORS).toHaveLength(31)
  })

  it('التوزيع: 9 استراتيجي + 11 تكتيكي + 11 تشغيلي', () => {
    const by = (l: string) => HR_QUANT_INDICATORS.filter((i) => i.level === l).length
    expect(by('strategic')).toBe(9)
    expect(by('tactical')).toBe(11)
    expect(by('operational')).toBe(11)
  })

  it('كل المعرّفات فريدة', () => {
    expect(new Set(HR_QUANT_INDICATORS.map((i) => i.id)).size).toBe(31)
  })

  it('معرّفات §د الخمسة موجودة في البنك', () => {
    for (const id of Object.values(FINANCIAL_INDICATOR_IDS)) {
      expect(HR_QUANT_INDICATORS.some((i) => i.id === id)).toBe(true)
    }
  })
})

describe('evalIndicator — الحالة حسب الاتجاه', () => {
  const lower: QuantIndicator = { id: 'x', level: 'tactical', axis: 'ATTD', name: 'غياب', unit: '%', target: 2, direction: 'lower' }
  const higher: QuantIndicator = { id: 'y', level: 'strategic', axis: 'EMP', name: 'eNPS', unit: 'درجة', target: 50, direction: 'higher' }

  it('أقلّ-أفضل: الفعليّ ≤ الهدف → ok', () => {
    expect(evalIndicator(lower, 2).status).toBe('ok')
    expect(evalIndicator(lower, 5).status).toBe('off')
  })
  it('أعلى-أفضل: الفعليّ ≥ الهدف → ok', () => {
    expect(evalIndicator(higher, 60).status).toBe('ok')
    expect(evalIndicator(higher, 30).status).toBe('off')
  })
  it('بلا إدخال → empty، الفجوة null', () => {
    expect(evalIndicator(lower, undefined)).toEqual({ gap: null, status: 'empty' })
  })
  it('الفجوة موقّعة (الفعليّ − الهدف)', () => {
    expect(evalIndicator(lower, 5).gap).toBe(3)
  })
})

describe('levelSummary', () => {
  it('يحسب المُدخَل/ضمن الهدف/التحقيق٪', () => {
    // تشغيلي: KPI_OPR_04 (إقامات، هدف 0) = 0 ✅ · KPI_OPR_07 (شكاوى، هدف 0) = 2 🔴
    const s = levelSummary('operational', { KPI_OPR_04: 0, KPI_OPR_07: 2 })
    expect(s.total).toBe(11)
    expect(s.entered).toBe(2)
    expect(s.ok).toBe(1)
    expect(s.off).toBe(1)
    expect(s.achievedPct).toBe(50)
  })
  it('بلا إدخال → تحقيق 0', () => {
    expect(levelSummary('strategic', {}).achievedPct).toBe(0)
  })
})
