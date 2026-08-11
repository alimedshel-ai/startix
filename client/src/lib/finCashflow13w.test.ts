import { describe, it, expect } from 'vitest'
import { computeCashflow13w, type Cashflow13wInput } from './finCashflow13w'

const base = (p: Partial<Cashflow13wInput> = {}): Cashflow13wInput => ({
  openingCash: 0, buckets: { b1: 0, b2: 0, b3: 0, b4: 0 }, monthlyOpex: 0, monthlyInstallments: 0, ...p,
})

describe('computeCashflow13w — بنية الجدول', () => {
  it('يُنتج ١٣ صفًّا مرقّمة ١..١٣', () => {
    const r = computeCashflow13w(base())
    expect(r.weeks).toHaveLength(13)
    expect(r.weeks[0].week).toBe(1)
    expect(r.weeks[12].week).toBe(13)
  })
})

describe('الخارج — تشغيل ÷٤٫٣٣ + أقساط أسابيع ٤/٨/١٢', () => {
  it('التشغيل الشهريّ يتوزّع أسبوعيًّا، والقسط يقع في ٤/٨/١٢ فقط', () => {
    const r = computeCashflow13w(base({ openingCash: 100000, monthlyOpex: 4330, monthlyInstallments: 5000 }))
    // أسبوع بلا قسط: الخارج ≈ ٤٣٣٠/٤٫٣٣ = ١٠٠٠
    expect(r.weeks[0].outflow).toBe(1000)     // أسبوع ١
    expect(r.weeks[3].outflow).toBe(6000)     // أسبوع ٤ = ١٠٠٠ + ٥٠٠٠ قسط
    expect(r.weeks[7].outflow).toBe(6000)     // أسبوع ٨
    expect(r.weeks[11].outflow).toBe(6000)    // أسبوع ١٢
    expect(r.weeks[4].outflow).toBe(1000)     // أسبوع ٥ بلا قسط
  })
})

describe('الداخل — توزيع الشرائح حسب العمر', () => {
  it('B1 يدخل أسابيع ١-٤ فقط (لا شيء بعد ٤ من B1)', () => {
    const r = computeCashflow13w(base({ buckets: { b1: 4000, b2: 0, b3: 0, b4: 0 } }))
    expect(r.weeks[0].inflow).toBe(1000)   // ٤٠٠٠/٤
    expect(r.weeks[3].inflow).toBe(1000)   // أسبوع ٤
    expect(r.weeks[4].inflow).toBe(0)      // أسبوع ٥ — لا B1
  })
  it('B4 يُخصَم باحتمال التحصيل (افتراضي ٠٫٤)', () => {
    const r = computeCashflow13w(base({ buckets: { b1: 0, b2: 0, b3: 0, b4: 7000 } }))
    // ٧٠٠٠×٠٫٤=٢٨٠٠ على أسابيع ٧-١٣ (٧ أسابيع) = ٤٠٠/أسبوع
    expect(r.weeks[6].inflow).toBe(400)    // أسبوع ٧
    expect(r.weeks[5].inflow).toBe(0)      // أسبوع ٦ — قبل النطاق
  })
})

describe('firstRiskWeek + safeWeeks — أقرب خطر', () => {
  it('نقد كافٍ ⇒ آمن ١٣ أسبوعًا', () => {
    const r = computeCashflow13w(base({ openingCash: 1000000, monthlyOpex: 4330 }))
    expect(r.firstRiskWeek).toBeNull()
    expect(r.safeWeeks).toBe(13)
  })
  it('نقد شحيح ⇒ يرصد أوّل أسبوع سالب', () => {
    // افتتاحيّ ٢٥٠٠، خارج ١٠٠٠/أسبوع، بلا داخل ⇒ سالب في الأسبوع ٣
    const r = computeCashflow13w(base({ openingCash: 2500, monthlyOpex: 4330 }))
    expect(r.firstRiskWeek).toBe(3)
    expect(r.safeWeeks).toBe(2)
    expect(r.minBalance).toBeLessThan(0)
  })
})
